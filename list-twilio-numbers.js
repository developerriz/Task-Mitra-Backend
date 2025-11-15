// list-twilio-numbers.js
require('dotenv').config();
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN; // or use API key/secret method
const client = twilio(accountSid, authToken);

(async () => {
  try {
    const numbers = await client.incomingPhoneNumbers.list({limit: 100});
    console.log('Owned Twilio numbers:');
    numbers.forEach(n => console.log(n.phoneNumber));
  } catch (err) {
    console.error('Failed to list numbers:', err.message || err);
  }
})();
