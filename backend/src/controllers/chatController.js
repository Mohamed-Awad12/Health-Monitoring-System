const { getIO } = require("../config/socket");
const catchAsync = require("../utils/catchAsync");
const { setNoStoreHeaders } = require("../utils/httpCache");
const {
  listConversationsForUser,
  getConversationForUser,
  listConversationMessages,
  sendMessage,
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
  const io = getIO();

  if (io) {
    const recipientSummary = (
      await getConversationForUser(req.params.conversationId, {
        _id: payload.recipientId,
        role: payload.recipientRole,
      })
    ).summary;

    io.to(`user:${req.user._id}`).emit("chat:message:new", {
      conversation: payload.conversation,
      message: payload.message,
    });
    io.to(`user:${payload.recipientId}`).emit("chat:message:new", {
      conversation: recipientSummary,
      message: payload.message,
    });
  }

  setNoStoreHeaders(res);
  res.status(201).json({
    message: "Chat message sent",
    conversation: payload.conversation,
    chatMessage: payload.message,
  });
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
  markRead,
};
