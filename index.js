const { SMTPServer } = require('smtp-server');
const { simpleParser } = require('mailparser')


const server = new SMTPServer({
  logger: true,
  secure: false, // Set true if using TLS (port 465)
  disabledCommands: ['STARTTLS'], // enable if you want to secure connection
  authOptional: true, // require authentication to send mail
  onConnect(session, callback) {
    console.log('Client connected:', session.remoteAddress);
    callback();
  },
  
  onMailFrom(address, session, callback) {
    console.log('Mail from:', address.address);
    // Additional checks can be implemented here, e.g., block unauthorized senders

    callback();
  },
  onRcptTo(address, session, callback) {
    console.log('Recipient to:', address.address);
    // Here check if recipient address belongs to your users/custom domains
    // Example MongoDB query to verify recipient could be added here
    callback();
  },
  onData(stream, session, callback) {
    simpleParser(stream, async (err, parsed) => {
      if (err) {
        console.error('Error parsing email:', err);
        return callback(err);
      }
      console.log('Email subject:', parsed.subject);
      // Here save the parsed email to your database, routing by recipient addresses
      
      // Example: Save email to MongoDB linked to recipient user(s)
      // You can iterate session.envelope.rcptTo for recipients
      
      callback(null, 'Message accepted');
    });
  }
});

server.listen(25, () => {
  console.log('SMTP server is listening on port 25');
});
