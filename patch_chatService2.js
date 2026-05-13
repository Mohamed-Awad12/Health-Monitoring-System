const fs = require('fs');
const file = 'backend/src/services/chatService.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/const getMessageAttachmentForUser = async \([\s\S]*?return {\s*filePath,\s*attachment: message.attachment,\s*message: serializeMessage\(message, user._id\),\s*};\s*};/, `const getMessageAttachmentForUser = async (conversationId, messageId, user) => {
  const { conversation, relation } = await getConversationForUser(conversationId, user);
  ensureConversationIsActive(conversation);
  assertActiveAssignment(relation);
  
  const message = await ChatMessage.findOne({ _id: messageId, conversation: conversation._id }).lean();
  
  if (!message?.attachment?.storedName && !message?.attachment?.cloudinaryUrl) {
    throw new ApiError(404, "Attachment not found");
  }
  
  // If we have a Cloudinary URL, use that directly
  let filePath = message.attachment.cloudinaryUrl || "";
  
  // Fallback to old format local disk if no cloudinaryUrl but has storedName
  if (!filePath && message.attachment.storedName) {
     filePath = resolveAttachmentFilePath(message.attachment.storedName);
     if (!fs.existsSync(filePath)) {
       throw new ApiError(404, "Attachment file is unavailable");
     }
  }

  return {
    filePath,
    attachment: message.attachment,
    message: serializeMessage(message, user._id),
  };
};`);

fs.writeFileSync(file, content, 'utf8');
