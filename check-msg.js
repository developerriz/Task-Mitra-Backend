// check-msg.js
require('dotenv').config();
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

(async () => {
  try {
    const sid = 'SM944544626d1cf27a36c6b9404ae593b9'; // replace with the SID from your log
    const m = await client.messages(sid).fetch();
    console.log('Message fetch:', {
      sid: m.sid,
      status: m.status,
      errorCode: m.errorCode,
      errorMessage: m.errorMessage,
      from: m.from,
      to: m.to,
      dateCreated: m.dateCreated,
    });
  } catch (err) {
    console.error('Fetch failed:', err.status, err.code, err.message);
  }
})();
