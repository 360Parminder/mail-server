const SMTPServer = require('smtp-server').SMTPServer;
const simpleParser = require('mailparser').simpleParser;


const server = new SMTPServer({
  authOptional: true,
  onData(stream, session, callback) {
    simpleParser(stream)
      .then(parsed => {
        console.log('Received email:');
        console.log('From:', parsed.from.text);
        console.log('To:', parsed.to.text);
        console.log('Subject:', parsed.subject);
        console.log('Text body:', parsed.text);
        console.log('HTML body:', parsed.html);
      })
      .catch(err => {
        console.error('Error parsing email:', err);
      })
      .finally(() => {
        callback();
      });
  },
});

server.listen(2525, () => {
  console.log('SMTP server is listening on port 2525');
});