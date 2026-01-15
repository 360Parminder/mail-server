const fs = require('fs');
const path = require('path');

// Add near top of file with other requires
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

// Ensure uploads directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Function to save attachment and return public URL
export function saveAttachment(attachment, callback) {
  try {
    const timestamp = Date.now();
    const ext = path.extname(attachment.filename) || '';
    const safeFilename = `${timestamp}-${Math.random().toString(36).substr(2, 9)}${ext}`;
    const filePath = path.join(UPLOAD_DIR, safeFilename);
    
    fs.writeFileSync(filePath, attachment.content);
    
    const publicUrl = `${BASE_URL}/files/${safeFilename}`;
    
    // Return attachment data WITHOUT content buffer (save space in DB)
    callback(null, {
      filename: attachment.filename,
      contentType: attachment.contentType,
      size: attachment.size,
      contentDisposition: attachment.contentDisposition,
      checksum: attachment.checksum,
      url: publicUrl  // NEW: public download link
    });
  } catch (err) {
    console.error('Attachment save error:', err);
    callback(err, null);
  }
}
