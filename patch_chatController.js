const fs = require('fs');
const file = 'backend/src/controllers/chatController.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/const streamAttachment = catchAsync\(async \(req, res\) => \{[\s\S]*?res\.sendFile\(payload\.filePath\);\s*\}\);/, `const streamAttachment = catchAsync(async (req, res) => {
  const payload = await getMessageAttachmentForUser(
    req.params.conversationId,
    req.params.messageId,
    req.user
  );
  const shouldDownload = Boolean(req.query.download);
  const safeFileName = encodeURIComponent(payload.attachment.originalName || "attachment");
  const dispositionType =
    shouldDownload || payload.message.type === "file" ? "attachment" : "inline";

  setNoStoreHeaders(res);
  res.setHeader(
    "Content-Disposition",
    \`\${dispositionType}; filename*=UTF-8''\${safeFileName}\`
  );
  
  if (payload.filePath.startsWith("http")) {
    return res.redirect(payload.filePath);
  }

  res.type(payload.attachment.mimeType || "application/octet-stream");

  if (payload.attachment.sizeBytes) {
    res.setHeader("Content-Length", String(payload.attachment.sizeBytes));
  }

  res.sendFile(payload.filePath);
});`);

fs.writeFileSync(file, content, 'utf8');
