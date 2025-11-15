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

/**
 * Helper to safely extract a SendGrid message id from the response returned by @sendgrid/mail.
 * sendGridRes is usually an array; headers might be an AxiosHeaders instance or plain object.
 */
function getSendgridMessageId(sendGridRes) {
  try {
    if (!sendGridRes) return null;
    const first = Array.isArray(sendGridRes) ? sendGridRes[0] : sendGridRes;
    if (!first) return null;
    const headers = first.headers;
    if (!headers) return null;
    // AxiosHeaders may behave like a map; try both access patterns
    return headers['x-message-id'] || (typeof headers.get === 'function' && headers.get('x-message-id')) || null;
  } catch (e) {
    return null;
  }
}

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

    // Start notifications
    const tasks = [];
    const notificationMeta = []; // keep track of which task is which (sms/email)

    if (process.env.CONTACT_PHONE) {
      notificationMeta.push({ channel: "sms", dest: process.env.CONTACT_PHONE });
      tasks.push(
        (async () => {
          try {
            return await sendSms({ to: process.env.CONTACT_PHONE, body: smsText });
          } catch (err) {
            // keep error informative but not huge
            throw new Error(err?.message || String(err));
          }
        })()
      );
    }

    if (process.env.EMAIL_TO) {
      notificationMeta.push({ channel: "email", dest: process.env.EMAIL_TO });
      tasks.push(
        (async () => {
          try {
            return await sendEmail({
              to: process.env.EMAIL_TO,
              subject: emailSubject,
              leadData: lead,
            });
          } catch (err) {
            throw new Error(err?.response?.body?.errors?.map(e => e.message).join(", ") || err?.message || String(err));
          }
        })()
      );
    }

    // Fire-and-forget response to client
    res.status(201).json({ message: "Lead submitted successfully", leadId: lead._id });

    // When tasks finish, persist results to the lead document so you can trace delivery later
    Promise.allSettled(tasks)
      .then(async (results) => {
        try {
          const notifications = {}; // { sms: {...}, email: {...} }

          for (let i = 0; i < results.length; i++) {
            const meta = notificationMeta[i] || { channel: `notification_${i}`, dest: null };
            const r = results[i];

            if (meta.channel === "sms") {
              if (r.status === "fulfilled") {
                // Twilio returns an object with .sid
                notifications.sms = {
                  sent: true,
                  sid: r.value?.sid || null,
                  status: r.value?.status || "unknown",
                  to: meta.dest,
                  error: null,
                };
                console.info(`SMS succeeded for lead ${lead._id}:`, notifications.sms.sid);
              } else {
                notifications.sms = {
                  sent: false,
                  sid: null,
                  status: "failed",
                  to: meta.dest,
                  error: String(r.reason?.message || r.reason || "unknown error").slice(0, 1000),
                };
                console.error(`SMS failed for lead ${lead._id}:`, notifications.sms.error);
              }
            } else if (meta.channel === "email") {
              if (r.status === "fulfilled") {
                const sgMessageId = getSendgridMessageId(r.value);
                notifications.email = {
                  sent: true,
                  sendgridMessageId: sgMessageId,
                  rawResponse: !!r.value, // boolean to indicate response presence
                  to: meta.dest,
                  error: null,
                };
                console.info(`Email accepted by SendGrid for lead ${lead._id}:`, sgMessageId);
              } else {
                notifications.email = {
                  sent: false,
                  sendgridMessageId: null,
                  rawResponse: false,
                  to: meta.dest,
                  error: String(r.reason?.message || r.reason || "unknown error").slice(0, 1000),
                };
                console.error(`Email failed for lead ${lead._id}:`, notifications.email.error);
              }
            } else {
              // generic handling
              notifications[meta.channel] = {
                sent: r.status === "fulfilled",
                result: r.status === "fulfilled" ? r.value : null,
                error: r.status === "rejected" ? String(r.reason?.message || r.reason) : null,
                to: meta.dest,
              };
            }
          }

          // Attach notifications + timestamp to lead and save
          lead.notifications = {
            ...lead.notifications, // preserve if anything existed
            ...notifications,
            lastUpdatedAt: new Date(),
          };

          await lead.save();
          console.info(`Lead ${lead._id} updated with notification results.`);
        } catch (e) {
          console.error("Failed to save notification results for lead", lead._id, e);
        }
      })
      .catch((e) => {
        console.error("Notification handling unexpected error:", e);
      });

  } catch (err) {
    console.error("submitLead error:", err);
    return res.status(500).json({ error: "Server error. Try again later." });
  }
};
