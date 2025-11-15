// smtp-check.js
require("dotenv").config();
const nodemailer = require("nodemailer");

(async function () {
  try {
    console.log("Testing SMTP connection to", process.env.SMTP_HOST, "port", process.env.SMTP_PORT);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 30000,
      greetingTimeout: 10000,
      socketTimeout: 30000,
      tls: process.env.SMTP_ALLOW_SELF_SIGNED === "true" ? { rejectUnauthorized: false } : undefined,
    });

    await transporter.verify();
    console.log("Transporter verified OK.");

    if (process.env.EMAIL_TO) {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: process.env.EMAIL_TO,
        subject: "SMTP connectivity test",
        text: "This is a connectivity test from TaskMitra backend",
      });
      console.log("sendMail ok:", info && (info.messageId || info.response));
    } else {
      console.log("EMAIL_TO not set, skipping sendMail.");
    }
  } catch (err) {
    console.error("SMTP check failed:", err);
    process.exit(1);
  }
})();
