// src/utils/sendEmail.js
const sgMail = require('@sendgrid/mail');

function ensureApiKey() {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) throw new Error('Missing SENDGRID_API_KEY environment variable');
  sgMail.setApiKey(key);
}

/* ============================
   Reuse your templates (unchanged)
   ============================ */
function buildLeadText({ name, phone, service, message, ip, userAgent, referrer, receivedAt }) {
  const received = receivedAt ? new Date(receivedAt).toISOString() : new Date().toISOString();
  return `New Lead Received

Name: ${name || '-'}
Phone: ${phone || '-'}
Service: ${service || '-'}
Message: ${message || '-'}

Received at: ${received}
IP: ${ip || '-'}
User-Agent: ${userAgent || '-'}
Referrer: ${referrer || '-'}
`;
}

function buildLeadHtmlClean(lead = {}) {
  const { name, phone, service, message, ip, referrer, receivedAt } = lead;
  const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
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
   Main sendEmail function using SendGrid
   ============================ */
module.exports = async function sendEmail({ to, subject, text, html, leadData = {} } = {}) {
  ensureApiKey();

  const finalTo = to || process.env.EMAIL_TO;
  if (!finalTo) throw new Error("sendEmail: missing 'to' and EMAIL_TO not set");

  const from = process.env.SENDGRID_FROM;
  if (!from) throw new Error("sendEmail: missing 'from' (set SENDGRID_FROM)");

  const finalText = text || buildLeadText(leadData);
  const finalHtml = html || buildLeadHtmlClean(leadData);
  const finalSubject = subject || `New Lead: ${leadData.service || 'Inquiry'}`;

  const msg = {
    to: finalTo,
    from,
    subject: finalSubject,
    text: finalText,
    html: finalHtml,
  };

  try {
    // sgMail.send returns a Promise that resolves to an array of responses (one per recipient)
    const res = await sgMail.send(msg);
    // res is usually an array of responses; log status for debugging
    if (Array.isArray(res)) {
      console.info('SendGrid responses:', res.map(r => ({ statusCode: r.statusCode, headers: r.headers })));
    } else {
      console.info('SendGrid response:', res);
    }
    // Return the raw response for caller to use (keeps parity with nodemailer returning info)
    return res;
  } catch (err) {
    // SendGrid error objects often contain response.body with details
    console.error('sendEmail (SendGrid) error:', err && (err.response?.body || err.message || err));
    throw err;
  }
};
