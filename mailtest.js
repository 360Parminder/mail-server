// test-smtp-send.js
const nodemailer = require('nodemailer');

async function testSMTP() {
  let transporter = nodemailer.createTransport({
    host: "localhost",      // same as your SMTP server's host
    port: 25,               // your SMTP port
    secure: false,          // false for localhost or non-TLS test
    tls: { rejectUnauthorized: false }, // Allow self-signed certificates
  });

  let info = await transporter.sendMail({
    from: '"Local Test" <test@example.com>',
    to: "parminder@rajdoot.wtf",
    subject: "Hello SMTP Localhost",
    text: "This is a test email sent to your locally running SMTP server!"
  });

  console.log("Message sent:", info.messageId);
}

testSMTP().catch(console.error);
