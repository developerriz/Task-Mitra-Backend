// src/utils/sendEmail.js
const nodemailer = require("nodemailer");

let transporter;

async function createTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === "true"; // true for 465, false for 587
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("SMTP configuration missing (SMTP_HOST, SMTP_USER, SMTP_PASS)");
  }

  const opts = {
    host,
    port,
    secure,
    auth: { user, pass },
    // timeouts to fail fast if network blocked
    connectionTimeout: 30000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
    // allow self-signed certs in non-prod if explicitly enabled
    tls: process.env.SMTP_ALLOW_SELF_SIGNED === "true" ? { rejectUnauthorized: false } : undefined,
  };

  transporter = nodemailer.createTransport(opts);

  try {
    await transporter.verify(); // throws on network/auth failure
    console.info("Nodemailer transporter verified and ready");
  } catch (err) {
    console.error("Nodemailer verify failed:", err);
    // rethrow so caller sees this in logs
    throw err;
  }

  return transporter;
}

/* ============================
   Plain text fallback template
   ============================ */
function buildLeadText({ name, phone, service, message, ip, userAgent, referrer, receivedAt }) {
  const received = receivedAt ? new Date(receivedAt).toISOString() : new Date().toISOString();
  return `New Lead Received

Name: ${name || "-"}
Phone: ${phone || "-"}
Service: ${service || "-"}
Message: ${message || "-"}

Received at: ${received}
IP: ${ip || "-"}
User-Agent: ${userAgent || "-"}
Referrer: ${referrer || "-"}
`;
}

/* ==========================================
   HTML template (kept clean and responsive)
   ========================================== */
function buildLeadHtmlClean(lead = {}) {
  const { name, phone, service, message, ip, referrer, receivedAt } = lead;
  const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const received = receivedAt ? new Date(receivedAt).toLocaleString() : new Date().toLocaleString();

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:12px auto;padding:18px;background:#fff;border-radius:8px;border:1px solid #eee">
      <h2>📩 New Lead Received</h2>
      <p><strong>Name:</strong> ${esc(name)}</p>
      <p><strong>Phone:</strong> ${esc(phone)}</p>
      <p><strong>Service:</strong> ${esc(service)}</p>
      <p><strong>Message:</strong><div style="padding:8px;background:#f8fafc;border-radius:6px">${esc(message||"-")}</div></p>
      <p style="color:#64748b;font-size:12px">Received at: ${esc(received)}<br/>IP: ${esc(ip||"-")}<br/>Referrer: ${esc(referrer||"-")}</p>
    </div></body></html>`;
}

/* ============================
   Main sendEmail function
   ============================ */
module.exports = async function sendEmail({ to, subject, text, html, leadData = {} }) {
  if (!to && !process.env.EMAIL_TO) throw new Error("sendEmail: missing 'to' and EMAIL_TO not set");
  const finalTo = to || process.env.EMAIL_TO;
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) throw new Error("sendEmail: missing 'from' (set SMTP_FROM or SMTP_USER)");

  try {
    const t = await createTransporter();
    const finalText = text || buildLeadText(leadData);
    const finalHtml = html || buildLeadHtmlClean(leadData);

    const info = await t.sendMail({
      from,
      to: finalTo,
      subject: subject || `New Lead: ${leadData.service || "Inquiry"}`,
      text: finalText,
      html: finalHtml,
    });

    console.info("Email sent:", info.messageId || info.response);
    return info;
  } catch (err) {
    console.error("sendEmail error:", err);
    throw err;
  }
};
