const { getIO } = require("../config/socket");
const catchAsync = require("../utils/catchAsync");
const { setNoStoreHeaders } = require("../utils/httpCache");
const {
  listConversationsForUser,
  getConversationForUser,
  getMessageAttachmentForUser,
  listConversationMessages,
  sendMessage,
  sendAttachmentMessage,
  markConversationRead,
} = require("../services/chatService");

const emitConversationUpdate = async (conversationId, user) => {
  const io = getIO();

  if (!io) {
    return;
  }

  const { summary } = await getConversationForUser(conversationId, user);

  io.to(`user:${user._id}`).emit("chat:conversation:updated", {
    conversation: summary,
  });
};

const emitNewMessage = async (conversationId, senderId, payload) => {
  const io = getIO();

  if (!io) {
    return;
  }

  const recipientSummary = (
    await getConversationForUser(conversationId, {
      _id: payload.recipientId,
      role: payload.recipientRole,
    })
  ).summary;

  io.to(`user:${senderId}`).emit("chat:message:new", {
    conversation: payload.conversation,
    message: payload.message,
  });
  io.to(`user:${payload.recipientId}`).emit("chat:message:new", {
    conversation: recipientSummary,
    message: payload.recipientMessage,
  });
};

const emitConversationRead = (conversationId, reader, participant, readAt) => {
  const io = getIO();

  if (!io || !conversationId || !reader?._id || !participant?.id || !readAt) {
    return;
  }

  const payload = {
    conversationId,
    readerId: reader._id.toString(),
    readerRole: reader.role,
    participantId: participant.id,
    readAt: new Date(readAt).toISOString(),
  };

  io.to(`user:${reader._id}`).emit("chat:conversation:read", payload);
  io.to(`user:${participant.id}`).emit("chat:conversation:read", payload);
};

const listConversations = catchAsync(async (req, res) => {
  const conversations = await listConversationsForUser(req.user);

  setNoStoreHeaders(res);
  res.json({ conversations });
});

const listMessages = catchAsync(async (req, res) => {
  const payload = await listConversationMessages(
    req.params.conversationId,
    req.user,
    req.query
  );

  setNoStoreHeaders(res);
  res.json(payload);
});

const createMessage = catchAsync(async (req, res) => {
  const payload = await sendMessage(req.params.conversationId, req.user, req.body.body);
  await emitNewMessage(req.params.conversationId, req.user._id, payload);

  setNoStoreHeaders(res);
  res.status(201).json({
    message: "Chat message sent",
    conversation: payload.conversation,
    chatMessage: payload.message,
  });
});

const createAttachmentMessage = catchAsync(async (req, res) => {
  const payload = await sendAttachmentMessage(req.params.conversationId, req.user, {
    body: req.body.body || "",
    file: req.file,
  });
  await emitNewMessage(req.params.conversationId, req.user._id, payload);

  setNoStoreHeaders(res);
  res.status(201).json({
    message: "Chat attachment sent",
    conversation: payload.conversation,
    chatMessage: payload.message,
  });
});

const streamAttachment = catchAsync(async (req, res) => {
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
    `${dispositionType}; filename*=UTF-8''${safeFileName}`
  );
  res.type(payload.attachment.mimeType || "application/octet-stream");

  if (payload.attachment.sizeBytes) {
    res.setHeader("Content-Length", String(payload.attachment.sizeBytes));
  }

  res.sendFile(payload.filePath);
});

const markRead = catchAsync(async (req, res) => {
  const payload = await markConversationRead(req.params.conversationId, req.user);
  const io = getIO();

  if (io) {
    await emitConversationUpdate(req.params.conversationId, req.user);
    await emitConversationUpdate(req.params.conversationId, {
      _id: payload.conversation.participant.id,
      role: payload.conversation.participant.role,
    });
    emitConversationRead(
      req.params.conversationId,
      req.user,
      payload.conversation.participant,
      payload.readAt
    );
  }

  setNoStoreHeaders(res);
  res.json({
    message: "Conversation marked as read",
    ...payload,
  });
});

module.exports = {
  listConversations,
  listMessages,
  createMessage,
  createAttachmentMessage,
  streamAttachment,
  markRead,
};
