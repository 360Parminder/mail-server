// /Users/parmindersingh/Downloads/Parminder/Projects/mail-server/src/smtpserver.js
const { SMTPServer } = require("smtp-server");
const { simpleParser } = require("mailparser");
const User = require("../src/model/userModel"); // must expose `email` field
const Mail = require("../src/model/mailModel"); // must match mail schema
const fs = require("fs");
const path = require("path");

const allowedDomains = ["rajdoot.wtf", "example.com"]; // replace with your domains

// File upload configuration
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ✅ Complete saveAttachment function (inline)
function saveAttachment(attachment, callback) {
  try {
    const timestamp = Date.now();
    const ext = path.extname(attachment.filename) || "";
    const safeFilename = `${timestamp}-${Math.random()
      .toString(36)
      .substr(2, 9)}${ext}`;
    const filePath = path.join(UPLOAD_DIR, safeFilename);

    fs.writeFileSync(filePath, attachment.content);

    const publicUrl = `${BASE_URL}/files/${safeFilename}`;

    callback(null, {
      filename: attachment.filename,
      contentType: attachment.contentType,
      size: attachment.size,
      contentDisposition: attachment.contentDisposition || "attachment",
      checksum: attachment.checksum,
      url: publicUrl,
    });
  } catch (err) {
    console.error("Attachment save error:", err);
    callback(err, null);
  }
}

const server = new SMTPServer({
  logger: true,
  secure: false,
  disabledCommands: ["STARTTLS"],
  authOptional: true,

  onConnect(session, callback) {
    session._rcptUsers = new Map();
    console.log("Client connected:", session.remoteAddress);
    callback();
  },

  onMailFrom(address, session, callback) {
    console.log("Mail from:", address.address);
    callback();
  },

  async onRcptTo(address, session, callback) {
    try {
      const recipient = String(address.address || "").toLowerCase();

      // Validate user and cache for onData
      const user = await User.findOne({ email: recipient })
        .select("_id email")
        .lean();
      if (!user) {
        return callback(new Error("Recipient address not found"));
      }
      if (!session._rcptUsers) session._rcptUsers = new Map();
      session._rcptUsers.set(recipient, user._id);

      callback(); // Accept recipient
    } catch (err) {
      console.error("Error checking recipient:", err);
      callback(new Error("Internal server error"));
    }
  },

  onData(stream, session, callback) {
    simpleParser(stream, async (err, parsed) => {
      if (err) {
        console.error("Error parsing email:", err);
        return callback(err);
      }

      try {
        // Build headers plain object from Map
        const headers = {};
        try {
          for (const [key, value] of parsed.headers) {
            headers[key] = value;
          }
        } catch {
          // ignore if headers map not iterable
        }

        const fromAddress =
          parsed.from?.value?.[0]?.address?.toLowerCase() ||
          parsed.from?.text ||
          "";
        const actualmail = fromAddress.match(/<(.+)>/);
        const fromAddr = actualmail ? actualmail[1] : fromAddress;
        const toList = (parsed.to?.value || [])
          .map((v) => v.address?.toLowerCase())
          .filter(Boolean);
        const ccList = (parsed.cc?.value || [])
          .map((v) => v.address?.toLowerCase())
          .filter(Boolean);
        const bccList = (parsed.bcc?.value || [])
          .map((v) => v.address?.toLowerCase())
          .filter(Boolean);

        // ✅ FIXED: Process attachments FIRST - convert buffers to URLs
        const attachmentPromises = (parsed.attachments || []).map(
          (att) =>
            new Promise((resolve, reject) => {
              saveAttachment(att, (err, result) => {
                if (err) reject(err);
                else resolve(result);
              });
            })
        );

        let attachments = [];
        try {
          attachments = await Promise.all(attachmentPromises);
        } catch (attErr) {
          console.error("Some attachments failed to save:", attErr);
          // Continue with successful ones or empty array
        }

        // Save one Mail document per recipient user we accepted
        const entries = Array.from(session._rcptUsers || []);
        if (entries.length === 0) {
          return callback(new Error("No valid recipients"));
        }

        const savePromises = entries.map(async ([recipient, userId]) => {
          const mail = new Mail({
            name: parsed.from?.value?.[0]?.name || "",
            recipient: recipient,
            user: userId,
            from: fromAddress,
            to: toList.length ? toList : [recipient],
            cc: ccList,
            bcc: bccList,
            subject: parsed.subject || "",
            text: parsed.text || "",
            html: parsed.html || "",
            date: parsed.date || new Date(),
            messageId: parsed.messageId || "",
            attachments, // ✅ Contains URLs only, no huge buffers
          });
          await mail.save();
        });

        await Promise.all(savePromises);

        console.log(
          `✅ Saved email "${parsed.subject || "(no subject)"}" for ${
            entries.length
          } recipient(s) with ${attachments.length} attachments`
        );
        callback(null, "Message accepted");
      } catch (saveErr) {
        console.error("Error saving email:", saveErr);
        callback(new Error("Failed to save email"));
      }
    });
  },
});

server.on("error", (err) => {
  console.error("SMTP server error:", err);
});

const PORT = Number(process.env.SMTP_PORT || 25);
server.listen(PORT, () => {
  console.log(`🚀 SMTP server is listening on port ${PORT}`);
  console.log(`📁 Attachments saved to: ${UPLOAD_DIR}`);
  console.log(`🌐 Public URLs: ${BASE_URL}/files/[filename]`);
});
