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
  const filePath = message.attachment.cloudinaryUrl || message.attachment.storedName;
  return {
    filePath,
    attachment: message.attachment,
    message: serializeMessage(message, user._id),
  };
};`);

fs.writeFileSync(file, content, 'utf8');
