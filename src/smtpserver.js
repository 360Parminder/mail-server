// /Users/parmindersingh/Downloads/Parminder/Projects/mail-server/src/smtpserver.js
const { SMTPServer } = require("smtp-server");
const { simpleParser } = require("mailparser");
const mongoose = require("mongoose");
const User = require("../src/model/userModel"); // must expose `email` field
const Mail = require("../src/model/mailModel"); // must match mail schema

const allowedDomains = ["rajdoot.wtf", "example.com"]; // replace with your domains

const server = new SMTPServer({
    logger: true,
    secure: false,
    disabledCommands: ["STARTTLS"],
    authOptional: true,

    onConnect(session, callback) {
        // Will collect validated recipients -> userId map during RCPT TO
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
            // console.log("Recipient to:", recipient);

            // const domain = recipient.split("@")[1];
            // if (!domain || !allowedDomains.includes(domain)) {
            //     return callback(new Error("Recipient domain not allowed"));
            // }

            // Validate user and cache for onData
            const user = await User.findOne({ email: recipient }).select("_id email").lean();
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
                const toList = (parsed.to?.value || []).map((v) => v.address?.toLowerCase()).filter(Boolean);
                const ccList = (parsed.cc?.value || []).map((v) => v.address?.toLowerCase()).filter(Boolean);
                const bccList = (parsed.bcc?.value || []).map((v) => v.address?.toLowerCase()).filter(Boolean);

                const attachments = (parsed.attachments || []).map((a) => ({
                    filename: a.filename,
                    contentType: a.contentType,
                    size: a.size,
                    contentDisposition: a.contentDisposition,
                    checksum: a.checksum,
                    content: a.content, // Buffer
                }));

                // Save one Mail document per recipient user we accepted
                const entries = Array.from(session._rcptUsers || []);
                if (entries.length === 0) {
                    // No validated recipients; reject
                    return callback(new Error("No valid recipients"));
                }

                const savePromises = entries.map(async ([recipient, userId]) => {

                    const mail = new Mail({
                        name: parsed.from?.value?.[0]?.name || "", // optional display name
                        recipient: recipient,
                        user: userId,
                        from:fromAddress,
                        to: toList.length ? toList : [recipient], // ensure recipient appears in 'to'
                        cc: ccList,
                        bcc: bccList,
                        subject: parsed.subject || "",
                        text: parsed.text || "",
                        html: parsed.html || "",
                        date: parsed.date || new Date(),
                        messageId: parsed.messageId || "",
                        attachments,
                    });
                    await mail.save();
                });

                await Promise.all(savePromises);

                console.log(
                    `Saved email "${parsed.subject || "(no subject)"}" for ${entries.length} recipient(s)`
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
    console.log(`SMTP server is listening on port ${PORT}`);
});
