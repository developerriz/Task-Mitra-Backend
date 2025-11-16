const twilio = require("twilio");

let client;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
}

const sendWhatsAppMessage = async ({ to, body }) => {
  if (!client) {
    throw new Error("Twilio client not configured. Check env vars.");
  }

  
  return client.messages.create({
    from: "whatsapp:+14155238886",           // Twilio WhatsApp sandbox number
    to: `whatsapp:${to}`,                    // User number must include whatsapp:
    body,
  });
};

module.exports = sendWhatsAppMessage;
