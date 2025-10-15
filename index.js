const SMTPServer = require('smtp-server').SMTPServer;
const simpleParser = require('mailparser').simpleParser;


const server = new SMTPServer({
    allowInsecureAuth: true,
    authOptional: true,
  onConnect(session, callback) {
    console.log('Client connected:', session.remoteAddress);
    callback(); // Accept the connection
  },
  onMailFrom(address, session, callback) {
    console.log('Mail from:', address.address);
    callback(); // Accept the sender
  },
  onRcptTo(address, session, callback) {
    console.log('Recipient to:', address.address);
    callback(); // Accept the recipient
  },

});

server.listen(25, () => {
  console.log('SMTP server is listening on port 25');
});