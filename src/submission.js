// submission.js
require('dotenv').config();
const { SMTPServer } = require('smtp-server');
const { simpleParser } = require('mailparser');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const User = require('./model/userModel');
const Email = require('./model/mailModel');

const {
  SUBMIT_PORT = 587,
  SUBMIT_HOST = '192.168.1.40',
  MONGO_URI,
  MAX_SIZE = 25 * 1024 * 1024 // 25MB
} = process.env;

if (!MONGO_URI) {
  console.error('MONGO_URI missing');
  process.exit(1);
}

async function connectDB() {
  await mongoose.connect(MONGO_URI, {
    autoIndex: false,
    maxPoolSize: 10
  });
  console.log('Mongo connected');
}

function buildServer() {
  return new SMTPServer({
    banner: 'Submission Service',
    size: Number(MAX_SIZE),
    secure: false,
    disabledCommands: ['STARTTLS'], // allow STARTTLS if you terminate TLS at proxy set to ["STARTTLS"]
    authOptional: true,
 socketTimeout: 2 * 60 * 1000,
    // Only AUTH PLAIN/LOGIN allowed by default; restrict mechanisms if needed
   onAuth: async (auth, session, callback) => {
    console.log(auth);
    
  try {
    const { username, password } = auth;
    const u = (username || '').toLowerCase().trim();
    const user = await User.findOne({
      $or: [{ email: u }, { aliases: u }]
    }).lean();
    console.log('AUTH attempt', { u, found: !!user });
    if (!user) return callback(new Error('Invalid credentials'));
    const ok = await bcrypt.compare(password || '', user.password || '');
    console.log('AUTH bcrypt', ok);
    if (!ok) return callback(new Error('Invalid credentials'));
    session.user = { _id: user._id, email: user.email, aliases: user.aliases || [] };
    return callback(null, { user: session.user });
  } catch (e) {
    console.error('AUTH exception', e);
    return callback(new Error('Auth failed'));
  }
},

    onMailFrom: (address, session, callback) => {
      const from = (address.address || '').toLowerCase();
      const allowed = new Set([session.user.email, ...(session.user.aliases || [])]);
      if (!allowed.has(from)) return callback(new Error('Not allowed to send as this address'));
      return callback();
    },
    onRcptTo: (_address, _session, callback) => callback(),
    onData: (stream, session, callback) => {
      simpleParser(stream, async (err, parsed) => {
        if (err) return callback(err);
        try {
          await Email.create({
            messageId: parsed.messageId || `${Date.now()}-${Math.random()}`,
            from: parsed.from?.text || '',
            to: parsed.to?.value?.map(v => v.address) || [],
            cc: parsed.cc?.value?.map(v => v.address) || [],
            bcc: parsed.bcc?.value?.map(v => v.address) || [],
            subject: parsed.subject || '',
            text: parsed.text || '',
            html: parsed.html || '',
            headers: Object.fromEntries(parsed.headerLines.map(h => [h.key, h.line])),
            user: session.user._id,
            receivedAt: new Date()
          });
          return callback(null, 'Queued');
        } catch (e) {
            return callback(new Error('Store failed'));
        }
      });
    },
    onClose: () => { /* connection closed */ }
  });
}

async function start() {
  await connectDB();
  const server = buildServer();

  server.on('error', err => {
    console.error('SMTP error', err);
  });

  server.listen(Number(SUBMIT_PORT), SUBMIT_HOST, () => {
    console.log(`Submission SMTP listening on ${SUBMIT_HOST}:${SUBMIT_PORT}`);
  });

  const shutdown = async () => {
    console.log('Shutting down...');
    server.close(() => console.log('SMTP closed'));
    await mongoose.connection.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch(e => {
  console.error('Startup failed', e);
  process.exit(1);
});
