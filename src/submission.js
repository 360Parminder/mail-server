const { SMTPServer } = require('smtp-server');
const { simpleParser } = require('mailparser');
const bcrypt = require('bcryptjs');
const Email = require('./model/mailModel');
const User = require('./model/userModel');


const MAX_SIZE = process.env.SUBMIT_MAX_SIZE || (10 * 1024 * 1024); // 10 MB default

const server = buildServer();

const PORT = process.env.SUBMIT_PORT || 587;
const HOST = process.env.SUBMIT_HOST || '192.168.1.40';

function buildServer() {
  return new SMTPServer({
    banner: 'Submission Service',
    size: Number(MAX_SIZE),
    secure: false,
    // Offer STARTTLS only if you terminate TLS here; remove to allow STARTTLS
    // disabledCommands: ['STARTTLS'],
    authOptional: false, // require AUTH before mail transactions
    // optionally: hide AUTH until TLS if you enable STARTTLS
    // authMethods: ['PLAIN', 'LOGIN'],

    onAuth: async (auth, session, callback) => {
      try {
        const { username, password } = auth || {};
        const u = (username || '').toLowerCase().trim();
        const user = await User.findOne({ $or: [{ email: u }, { aliases: u }] }).lean();
        if (!user) return callback(new Error('Invalid credentials'));
        const ok = await bcrypt.compare(password || '', user.password || '');
        if (!ok) return callback(new Error('Invalid credentials'));
        session.user = { _id: user._id, email: user.email, aliases: user.aliases || [] };
        return callback(null, { user: session.user });
      } catch (e) {
        return callback(new Error('Auth failed'));
      }
    },

    onMailFrom: (address, session, callback) => {
      if (!session.user) return callback(Object.assign(new Error('530 Authentication required'), { responseCode: 530 }));
      const from = (address?.address || '').toLowerCase();
      const allowed = new Set([session.user.email, ...(session.user.aliases || [])]);
      if (!allowed.has(from)) return callback(new Error('Not allowed to send as this address'));
      return callback();
    },

    onRcptTo: (_address, _session, callback) => callback(),

    onData: (stream, session, callback) => {
      if (!session.user) return callback(Object.assign(new Error('530 Authentication required'), { responseCode: 530 }));
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
            headers: Object.fromEntries((parsed.headerLines || []).map(h => [h.key, h.line])),
            user: session.user._id,
            receivedAt: new Date()
          });
          return callback(null, 'Queued');
        } catch (e) {
          return callback(new Error('Store failed'));
        }
      });
    },
  });
}

buildServer().listen(process.env.SUBMIT_PORT || 587, process.env.SUBMIT_HOST || '192.168.1.40');

