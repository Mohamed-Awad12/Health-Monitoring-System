const fs = require("fs");
const path = require("path");
const ChatConversation = require("../models/ChatConversation");
const ChatMessage = require("../models/ChatMessage");
const DoctorPatient = require("../models/DoctorPatient");
const { chatAttachmentsDir } = require("../middlewares/upload");
const ApiError = require("../utils/ApiError");
const { getPresence } = require("./presenceService");

const ACTIVE_RELATION_STATUS = "active";
const fallbackChatAttachmentsDir = path.join(__dirname, "../../uploads/chat-attachments");

const buildConversationPreview = (body = "") => {
  const normalized = String(body || "").replace(/\s+/g, " ").trim();

  if (normalized.length <= 140) {
    return normalized;
  }

  return `${normalized.slice(0, 137)}...`;
};

const buildAttachmentMessageType = (mimeType = "") => {
  if (String(mimeType).startsWith("image/")) {
    return "image";
  }

  if (String(mimeType).startsWith("audio/")) {
    return "audio";
  }

  return "file";
};

const buildAttachmentPreviewText = (type, attachment = null) => {
  if (type === "image") {
    return attachment?.originalName
      ? `Image: ${attachment.originalName}`
      : "Sent an image";
  }

  if (type === "audio") {
    return attachment?.originalName
      ? `Voice note: ${attachment.originalName}`
      : "Sent a voice note";
  }

  return attachment?.originalName ? `File: ${attachment.originalName}` : "Sent a file";
};

const buildMessagePreview = ({ body = "", type = "text", attachment = null }) => {
  const textPreview = buildConversationPreview(body);

  if (textPreview) {
    return textPreview;
  }

  if (type === "text") {
    return "";
  }

  return buildConversationPreview(buildAttachmentPreviewText(type, attachment));
};

const getCounterpartRole = (role) => (role === "doctor" ? "patient" : "doctor");

const serializeParticipant = (participant, presence) => ({
  id: participant?._id?.toString?.() || participant?.id || "",
  name: participant?.name || "",
  email: participant?.email || "",
  role: participant?.role || "",
  specialty: participant?.specialty || "",
  onlineStatus: presence,
});

const serializeConversation = (conversation, currentUserRole, participant) => {
  const unreadCount =
    currentUserRole === "doctor"
      ? conversation.unreadCounts?.doctor || 0
      : conversation.unreadCounts?.patient || 0;
  const lastReadAt =
    currentUserRole === "doctor"
      ? conversation.lastReadAt?.doctor || null
      : conversation.lastReadAt?.patient || null;

  return {
    id: conversation._id.toString(),
    assignmentId: conversation.assignment.toString(),
    status: conversation.status,
    participant,
    unreadCount,
    lastReadAt,
    latestActivityAt:
      conversation.lastMessage?.sentAt ||
      conversation.updatedAt ||
      conversation.createdAt,
    lastMessage: conversation.lastMessage?.sentAt
      ? {
          id: conversation.lastMessage.id?.toString?.() || "",
          bodyPreview: conversation.lastMessage.bodyPreview || "",
          senderId: conversation.lastMessage.sender?.toString?.() || "",
          senderRole: conversation.lastMessage.senderRole || "",
          sentAt: conversation.lastMessage.sentAt,
          type: conversation.lastMessage.type || "text",
        }
      : null,
  };
};

const hasStoredAttachment = (attachment = null) =>
  Boolean(String(attachment?.storedName || "").trim());

const hasRemoteAttachment = (attachment = null) =>
  Boolean(String(attachment?.cloudinaryUrl || "").trim());

const hasAttachmentSource = (attachment = null) =>
  hasStoredAttachment(attachment) || hasRemoteAttachment(attachment);

const resolveAttachmentFilePath = (storedName = "") => {
  if (!storedName) {
    return "";
  }

  return path.join(chatAttachmentsDir || fallbackChatAttachmentsDir, storedName);
};

const isAttachmentAvailable = (attachment = null) => {
  if (hasRemoteAttachment(attachment)) {
    return true;
  }

  if (!hasStoredAttachment(attachment)) {
    return false;
  }

  const filePath = resolveAttachmentFilePath(attachment.storedName);

  return Boolean(filePath) && fs.existsSync(filePath);
};

const serializeAttachment = (message) => {
  const attachment = message.attachment;

  if (!hasAttachmentSource(attachment)) {
    return null;
  }

  const conversationId = message.conversation.toString();
  const messageId = message._id.toString();
  const urlPath = `/chat/conversations/${conversationId}/messages/${messageId}/attachment`;
  const isAvailable = isAttachmentAvailable(attachment);

  return {
    originalName: attachment.originalName || "",
    mimeType: attachment.mimeType || "application/octet-stream",
    sizeBytes: attachment.sizeBytes || 0,
    extension: attachment.extension || "",
    isAvailable,
    urlPath,
    downloadUrlPath: `${urlPath}?download=1`,
  };
};

const serializeMessage = (message, currentUserId) => ({
  id: message._id.toString(),
  conversationId: message.conversation.toString(),
  assignmentId: message.assignment.toString(),
  senderId: message.sender.toString(),
  senderRole: message.senderRole,
  recipientId: message.recipient.toString(),
  recipientRole: message.recipientRole,
  body: message.body || "",
  type: message.type,
  attachment: serializeAttachment(message),
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
  readAt: message.readAt,
  isOwnMessage: message.sender.toString() === String(currentUserId),
});

const createStoredAttachmentPayload = (file) => ({
  storedName: file.filename || "",
  originalName: file.originalname || file.filename || "attachment",
  mimeType: file.mimetype || "application/octet-stream",
  sizeBytes: file.size || 0,
  extension: path.extname(file.originalname || "").toLowerCase(),
  cloudinaryUrl: file.path || "",
});

const getConversationQueryForUser = (conversationId, user) =>
  user.role === "doctor"
    ? { _id: conversationId, doctor: user._id }
    : { _id: conversationId, patient: user._id };

const syncConversationForAssignment = async (relation) => {
  const assignmentId = relation?._id?.toString?.() || relation?._id;
  const doctorId = relation?.doctor?._id?.toString?.() || relation?.doctor;
  const patientId = relation?.patient?._id?.toString?.() || relation?.patient;

  if (!assignmentId || !doctorId || !patientId) {
    throw new ApiError(500, "Cannot synchronize chat conversation without assignment data");
  }

  if (relation.status !== ACTIVE_RELATION_STATUS) {
    return ChatConversation.findOneAndUpdate(
      { assignment: assignmentId },
      {
        $set: {
          doctor: doctorId,
          patient: patientId,
          status: "archived",
          archivedAt: new Date(),
        },
      },
      { new: true }
    );
  }

  return ChatConversation.findOneAndUpdate(
    { assignment: assignmentId },
    {
      $set: {
        doctor: doctorId,
        patient: patientId,
        status: "active",
        archivedAt: null,
      },
      $setOnInsert: {
        unreadCounts: {
          doctor: 0,
          patient: 0,
        },
        lastReadAt: {
          doctor: null,
          patient: null,
        },
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );
};

const syncConversationsForRelations = async (relations) => {
  if (!Array.isArray(relations) || !relations.length) {
    return [];
  }

  await Promise.all(relations.map((relation) => syncConversationForAssignment(relation)));

  return ChatConversation.find({
    assignment: { $in: relations.map((relation) => relation._id) },
    status: "active",
  }).lean();
};

const getParticipantProjection = "name email role specialty";

const listConversationsForUser = async (user) => {
  const relationQuery =
    user.role === "doctor"
      ? { doctor: user._id, status: ACTIVE_RELATION_STATUS }
      : { patient: user._id, status: ACTIVE_RELATION_STATUS };
  const relationPopulatePath = user.role === "doctor" ? "patient" : "doctor";

  const relations = await DoctorPatient.find(relationQuery)
    .sort({ assignedAt: -1, updatedAt: -1 })
    .populate(relationPopulatePath, getParticipantProjection)
    .lean();

  if (!relations.length) {
    return [];
  }

  const conversations = await syncConversationsForRelations(relations);
  const conversationMap = new Map(
    conversations.map((conversation) => [conversation.assignment.toString(), conversation])
  );

  const serializedConversations = relations
    .map((relation) => {
      const conversation = conversationMap.get(relation._id.toString());

      if (!conversation) {
        return null;
      }

      const participant = relation[relationPopulatePath];
      const presence = getPresence(participant?._id || participant?.id);

      return serializeConversation(
        conversation,
        user.role,
        serializeParticipant(participant, presence)
      );
    })
    .filter(Boolean)
    .sort((firstConversation, secondConversation) => {
      const firstDate = new Date(firstConversation.latestActivityAt || 0).getTime();
      const secondDate = new Date(secondConversation.latestActivityAt || 0).getTime();

      return secondDate - firstDate;
    });

  return serializedConversations;
};

const getConversationForUser = async (conversationId, user) => {
  const conversation = await ChatConversation.findOne(
    getConversationQueryForUser(conversationId, user)
  ).lean();

  if (!conversation) {
    throw new ApiError(404, "Conversation not found");
  }

  const relation = await DoctorPatient.findOne({
    _id: conversation.assignment,
  })
    .populate("doctor", getParticipantProjection)
    .populate("patient", getParticipantProjection)
    .lean();

  if (!relation) {
    throw new ApiError(404, "Conversation assignment not found");
  }

  const participant = user.role === "doctor" ? relation.patient : relation.doctor;

  if (!participant) {
    throw new ApiError(404, "Conversation participant not found");
  }

  return {
    conversation,
    relation,
    participant,
    summary: serializeConversation(
      conversation,
      user.role,
      serializeParticipant(participant, getPresence(participant._id))
    ),
  };
};

const ensureConversationIsActive = (conversation) => {
  if (conversation.status !== "active") {
    throw new ApiError(403, "Conversation is not available for messaging");
  }
};

const assertActiveAssignment = (relation) => {
  if (relation.status !== ACTIVE_RELATION_STATUS) {
    throw new ApiError(403, "Only active doctor-patient assignments can exchange messages");
  }
};

const createConversationMessage = async (
  conversation,
  relation,
  user,
  { body = "", type = "text", attachment = null } = {}
) => {
  ensureConversationIsActive(conversation);
  assertActiveAssignment(relation);

  if (type === "text" && !body) {
    throw new ApiError(400, "Message is required");
  }

  if (type !== "text" && !hasAttachmentSource(attachment)) {
    throw new ApiError(400, "Attachment is required");
  }

  const recipientRole = getCounterpartRole(user.role);
  const recipientId =
    recipientRole === "doctor"
      ? conversation.doctor.toString()
      : conversation.patient.toString();
  const message = await ChatMessage.create({
    conversation: conversation._id,
    assignment: conversation.assignment,
    sender: user._id,
    senderRole: user.role,
    recipient: recipientId,
    recipientRole,
    body,
    type,
    attachment,
  });

  await ChatConversation.findByIdAndUpdate(conversation._id, {
    $set: {
      status: "active",
      archivedAt: null,
      lastMessage: {
        id: message._id,
        sender: user._id,
        senderRole: user.role,
        bodyPreview: buildMessagePreview({ body, type, attachment }),
        type,
        sentAt: message.createdAt,
      },
      [`unreadCounts.${user.role}`]: 0,
      [`lastReadAt.${user.role}`]: message.createdAt,
    },
    $inc: {
      [`unreadCounts.${recipientRole}`]: 1,
    },
  });

  return {
    message,
    recipientId,
    recipientRole,
  };
};

const listConversationMessages = async (conversationId, user, query = {}) => {
  const { conversation, relation, summary } = await getConversationForUser(
    conversationId,
    user
  );

  ensureConversationIsActive(conversation);

  assertActiveAssignment(relation);

  const limit = query.limit || 30;
  const filter = {
    conversation: conversationId,
  };

  if (query.before) {
    filter.createdAt = {
      $lt: new Date(query.before),
    };
  }

  const messages = await ChatMessage.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();
  const hasMore = messages.length > limit;
  const page = hasMore ? messages.slice(0, limit) : messages;
  const orderedMessages = [...page].reverse();

  return {
    conversation: summary,
    messages: orderedMessages.map((message) => serializeMessage(message, user._id)),
    pagination: {
      hasMore,
      nextCursor: hasMore ? page[page.length - 1]?.createdAt || null : null,
    },
  };
};

const sendMessage = async (conversationId, user, body) => {
  const { conversation, relation, summary } = await getConversationForUser(
    conversationId,
    user
  );
  const { message, recipientId, recipientRole } = await createConversationMessage(
    conversation,
    relation,
    user,
    {
      body,
      type: "text",
    }
  );

  const refreshedConversation = await getConversationForUser(conversation._id, user);
  const serializedMessage = serializeMessage(message.toObject(), user._id);
  const recipientMessage = serializeMessage(message.toObject(), recipientId);

  return {
    conversation: refreshedConversation.summary,
    message: serializedMessage,
    recipientMessage,
    recipientId,
    recipientRole,
    participant: summary.participant,
  };
};

const sendAttachmentMessage = async (conversationId, user, { body = "", file } = {}) => {
  if (!file) {
    throw new ApiError(400, "Attachment is required");
  }

  const { conversation, relation, summary } = await getConversationForUser(
    conversationId,
    user
  );
  const attachment = createStoredAttachmentPayload(file);
  const type = buildAttachmentMessageType(file.mimetype);
  const { message, recipientId, recipientRole } = await createConversationMessage(
    conversation,
    relation,
    user,
    {
      body,
      type,
      attachment,
    }
  );

  const refreshedConversation = await getConversationForUser(conversation._id, user);
  const serializedMessage = serializeMessage(message.toObject(), user._id);
  const recipientMessage = serializeMessage(message.toObject(), recipientId);

  return {
    conversation: refreshedConversation.summary,
    message: serializedMessage,
    recipientMessage,
    recipientId,
    recipientRole,
    participant: summary.participant,
  };
};

const getMessageAttachmentForUser = async (conversationId, messageId, user) => {
  const { conversation, relation } = await getConversationForUser(conversationId, user);
  ensureConversationIsActive(conversation);
  assertActiveAssignment(relation);

  const message = await ChatMessage.findOne({ _id: messageId, conversation: conversation._id }).lean();

  if (!hasAttachmentSource(message?.attachment)) {
    throw new ApiError(404, "Attachment not found");
  }

  let filePath = hasRemoteAttachment(message.attachment)
    ? message.attachment.cloudinaryUrl.trim()
    : "";

  if (!filePath && hasStoredAttachment(message.attachment)) {
    filePath = resolveAttachmentFilePath(message.attachment.storedName);

    if (!filePath || !fs.existsSync(filePath)) {
      throw new ApiError(404, "Attachment file is unavailable");
    }
  }

  if (!filePath) {
    throw new ApiError(404, "Attachment file is unavailable");
  }

  return {
    filePath,
    attachment: message.attachment,
    message: serializeMessage(message, user._id),
  };
};

const markConversationRead = async (conversationId, user) => {
  const { conversation, relation, summary } = await getConversationForUser(
    conversationId,
    user
  );

  ensureConversationIsActive(conversation);

  assertActiveAssignment(relation);

  const now = new Date();

  await ChatMessage.updateMany(
    {
      conversation: conversation._id,
      recipient: user._id,
      readAt: null,
    },
    {
      $set: {
        readAt: now,
      },
    }
  );

  await ChatConversation.findByIdAndUpdate(conversation._id, {
    $set: {
      [`unreadCounts.${user.role}`]: 0,
      [`lastReadAt.${user.role}`]: now,
    },
  });

  const refreshedConversation = await getConversationForUser(conversation._id, user);

  return {
    conversation: refreshedConversation.summary,
    readAt: now,
  };
};

module.exports = {
  listConversationsForUser,
  getConversationForUser,
  listConversationMessages,
  sendMessage,
  sendAttachmentMessage,
  getMessageAttachmentForUser,
  markConversationRead,
  syncConversationForAssignment,
};
