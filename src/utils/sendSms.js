const twilio = require("twilio");

let client;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
}

const sendSms = async ({ to, body }) => {
  if (!client) {
    throw new Error("Twilio client not configured. Check env variables.");
  }
  return client.messages.create({
    body,
    from: process.env.TWILIO_FROM,
    to,
  });
};

module.exports = sendSms;
