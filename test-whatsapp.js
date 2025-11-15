// test-whatsapp.js
require('dotenv').config();
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function send() {
  const toRaw = process.env.CONTACT_PHONE || '+91YOURNUMBER'; // no 'whatsapp:' prefix here
  const to = `whatsapp:${toRaw.replace(/\s+/g, '')}`;
  const from = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'; // sandbox default

  try {
    console.log('Sending from', from, 'to', to);
    const msg = await client.messages.create({
      from,
      to,
      body: 'Test WhatsApp message from TaskMitra (sandbox).'
    });
    console.log('Message created:', { sid: msg.sid, status: msg.status });
  } catch (err) {
    console.error('Send failed:', err.status, err.code, err.message, err.moreInfo || '');
  }
}

send();
