// controllers/contactController.js
const Joi = require("joi");
const Lead = require("../models/Lead");
const sendSms = require("../utils/sendSms");
const sendEmail = require("../utils/sendEmail");

// conservative phone regex (optional, you can relax if needed)
const PHONE_RE = /^[+\d][\d\-\s().]{5,28}\d$/;

const contactSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150).required(),
  phone: Joi.string().trim().min(6).max(30).required().pattern(PHONE_RE)
    .messages({ "string.pattern.base": "Invalid phone number format." }),
  service: Joi.string().trim().min(2).max(200).required(),
  message: Joi.string().trim().allow("").max(2000),
}).options({ stripUnknown: true });

const sanitize = (s) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim() : s);

exports.submitLead = async (req, res) => {
  try {
    const { error, value } = contactSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // sanitize & defensive truncation
    const leadPayload = {
      name: sanitize(value.name).slice(0, 150),
      phone: sanitize(value.phone).slice(0, 30),
      service: sanitize(value.service).slice(0, 200),
      message: sanitize(value.message || "").slice(0, 2000),
      ip: req.ip || req.headers["x-forwarded-for"] || req.connection?.remoteAddress,
      userAgent: req.get("user-agent") || "",
      referrer: req.get("referer") || req.get("referrer") || "",
      receivedAt: new Date()
    };

    // Save to DB
    const lead = new Lead(leadPayload);
    await lead.save();

    // Build SMS text
    const smsText = `New inquiry from ${lead.name} (${lead.phone}) for "${lead.service}". Msg: ${lead.message || "-"}`;

    // Build email subject (HTML will be built inside sendEmail using leadData)
    const emailSubject = `New Lead: ${lead.service} - ${lead.name}`;

    // Start notifications but do NOT await them (non-blocking)
    const tasks = [];

    if (process.env.CONTACT_PHONE) {
      tasks.push(
        (async () => {
          try {
            return await sendSms({ to: process.env.CONTACT_PHONE, body: smsText });
          } catch (err) {
            throw new Error(`SMS error: ${err.message || err}`);
          }
        })()
      );
    }

    if (process.env.EMAIL_TO) {
      tasks.push(
        (async () => {
          try {
            // pass lead (Mongoose doc or plain object) as leadData so sendEmail will generate the HTML template
            return await sendEmail({
              to: process.env.EMAIL_TO,
              subject: emailSubject,
              // text fallback will be auto-generated inside sendEmail if not provided
              leadData: lead,
              // optional: add options for CTA or colors:
              // options: { viewUrl: `${process.env.BASE_URL}/admin/leads/${lead._id}` }
            });
          } catch (err) {
            throw new Error(`Email error: ${err.message || err}`);
          }
        })()
      );
    }

    // Fire-and-forget, but log results when they finish
    Promise.allSettled(tasks).then((results) => {
      results.forEach((r, i) => {
        if (r.status === "rejected") {
          console.error(`Notification ${i} failed for lead ${lead._id}:`, r.reason);
        } else {
          console.info(`Notification ${i} succeeded for lead ${lead._id}:`, r.value?.sid || r.value?.messageId || "ok");
        }
      });
    }).catch((e) => {
      console.error("Notification handling unexpected error:", e);
    });

    // Respond immediately
    return res.status(201).json({ message: "Lead submitted successfully", leadId: lead._id });
  } catch (err) {
    console.error("submitLead error:", err);
    return res.status(500).json({ error: "Server error. Try again later." });
  }
};
