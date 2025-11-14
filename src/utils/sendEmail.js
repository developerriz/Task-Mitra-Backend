// src/utils/sendEmail.js
const nodemailer = require('nodemailer');

let transporter;

function createTransporter() {
  if (transporter) return transporter;

  const opts = {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    }
  };

  if (process.env.NODE_ENV !== "production" && process.env.SMTP_ALLOW_SELF_SIGNED === "true") {
    opts.tls = { rejectUnauthorized: false };
  }

  transporter = nodemailer.createTransport(opts);

  transporter.verify((err) => {
    if (err) console.error("Nodemailer verify failed:", err);
    else console.info("Nodemailer transporter ready");
  });

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
   Modern, clean, responsive HTML template
   No Images, No Logo
   ========================================== */
function buildLeadHtmlClean(lead = {}) {
  const { name, phone, service, message, ip, referrer, receivedAt } = lead;

  const esc = (s) =>
    String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const received = receivedAt
    ? new Date(receivedAt).toLocaleString()
    : new Date().toLocaleString();

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>New Lead</title>

<style>
  body {
    margin: 0;
    padding: 0;
    background: #f5f7fb;
    font-family: Arial, Helvetica, sans-serif;
  }

  .container {
    max-width: 600px;
    margin: 24px auto;
    background: #ffffff;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 5px 20px rgba(0,0,0,0.08);
  }

  h2 {
    margin: 0 0 16px 0;
    font-size: 22px;
    font-weight: 700;
    color: #1e293b;
  }

  .row {
    margin-bottom: 14px;
  }

  .label {
    font-weight: bold;
    color: #334155;
    margin-bottom: 4px;
    display: block;
  }

  .value {
    padding: 10px 12px;
    background: #f8fafc;
    border-radius: 8px;
    color: #0f172a;
    font-size: 14px;
    line-height: 1.4;
  }

  .message-box {
    padding: 14px;
    background: #eef2ff;
    border-left: 4px solid #4f46e5;
    border-radius: 8px;
    color: #1e1b4b;
    font-size: 14px;
  }

  .meta {
    margin-top: 22px;
    font-size: 12px;
    color: #64748b;
  }

  .footer {
    text-align: center;
    margin-top: 24px;
    font-size: 12px;
    color: #94a3b8;
  }

  @media (max-width: 500px) {
    .container {
      padding: 18px;
    }
  }
</style>
</head>

<body>
  <div class="container">

    <h2>📩 New Lead Received</h2>

    <div class="row">
      <span class="label">Name</span>
      <div class="value">${esc(name)}</div>
    </div>

    <div class="row">
      <span class="label">Phone</span>
      <div class="value">${esc(phone)}</div>
    </div>

    <div class="row">
      <span class="label">Service</span>
      <div class="value">${esc(service)}</div>
    </div>

    <div class="row">
      <span class="label">Message</span>
      <div class="message-box">${esc(message || "-")}</div>
    </div>

    <div class="meta">
      Received at: ${esc(received)}<br />
      IP: ${esc(ip || "-")}<br />
      Referrer: ${esc(referrer || "-")}
    </div>

    <div class="footer">
      © ${new Date().getFullYear()} TaskMitra — Lead Notification System
    </div>

  </div>
</body>
</html>`;
}

/* ============================
   Main sendEmail function
   ============================ */
module.exports = async function sendEmail({
  to,
  subject,
  text,
  html,
  leadData = {}
}) {
  try {
    const t = createTransporter();
    if (!t) throw new Error("Email transporter missing");

    const finalText = text || buildLeadText(leadData);
    const finalHtml = html || buildLeadHtmlClean(leadData);

    const info = await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text: finalText,
      html: finalHtml
    });

    console.info("Email sent:", info.messageId);
    return info;
  } catch (err) {
    console.error("sendEmail error:", err);
    throw err;
  }
};
