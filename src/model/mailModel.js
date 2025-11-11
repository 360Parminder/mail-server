const mongoose = require('mongoose');

const AttachmentSchema = new mongoose.Schema({
  filename: String,
  contentType: String,
  size: Number,
  url: String,             // Can store file URL or storage reference
});

const EmailSchema = new mongoose.Schema({
  messageId: { type: String, required: true, unique: true },
  name: { type: String },                             // Optional display name of sender
  recipient: { type: String, required: true },
  from: { type: String, required: true },
  to: [{ type: String, required: true }],          // Support multiple recipients
  cc: [{ type: String }],
  bcc: [{ type: String }],
  subject: { type: String },
  text: { type: String },
  html: { type: String },
  attachments: [AttachmentSchema],
  date: { type: Date, default: Date.now },         // Received/sent date
  folder: { type: String, default: 'inbox' },      // inbox, sent, drafts, trash, spam, etc.
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // owner of the email
  threadId: { type: String },                      // for email threads/conversations
  inReplyTo: { type: String },                     // messageId of the email replied to
  unread: { type: Boolean, default: true },
  flagged: { type: Boolean, default: false },
  starred: { type: Boolean, default: false },
  labels: [{ type: String }],                      // for custom tags/labels
}, { timestamps: true });

module.exports = mongoose.model('Email', EmailSchema);
