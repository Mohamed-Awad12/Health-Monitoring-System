const ChatConversation = require("../models/ChatConversation");
const ChatMessage = require("../models/ChatMessage");
const DoctorPatient = require("../models/DoctorPatient");
const ApiError = require("../utils/ApiError");
const { getPresence } = require("./presenceService");

const ACTIVE_RELATION_STATUS = "active";

const buildConversationPreview = (body = "") => {
  const normalized = String(body || "").replace(/\s+/g, " ").trim();

  if (normalized.length <= 140) {
    return normalized;
  }

  return `${normalized.slice(0, 137)}...`;
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

const serializeMessage = (message, currentUserId) => ({
  id: message._id.toString(),
  conversationId: message.conversation.toString(),
  assignmentId: message.assignment.toString(),
  senderId: message.sender.toString(),
  senderRole: message.senderRole,
  recipientId: message.recipient.toString(),
  recipientRole: message.recipientRole,
  body: message.body,
  type: message.type,
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
  readAt: message.readAt,
  isOwnMessage: message.sender.toString() === String(currentUserId),
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

const listConversationMessages = async (conversationId, user, query = {}) => {
  const { conversation, relation, summary } = await getConversationForUser(
    conversationId,
    user
  );

  ensureConversationIsActive(conversation);

  if (relation.status !== ACTIVE_RELATION_STATUS) {
    throw new ApiError(403, "Conversation is not available for this assignment");
  }

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

  ensureConversationIsActive(conversation);

  if (relation.status !== ACTIVE_RELATION_STATUS) {
    throw new ApiError(403, "Only active doctor-patient assignments can exchange messages");
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
  });

  await ChatConversation.findByIdAndUpdate(conversation._id, {
    $set: {
      status: "active",
      archivedAt: null,
      lastMessage: {
        id: message._id,
        sender: user._id,
        senderRole: user.role,
        bodyPreview: buildConversationPreview(body),
        type: "text",
        sentAt: message.createdAt,
      },
      [`unreadCounts.${user.role}`]: 0,
      [`lastReadAt.${user.role}`]: message.createdAt,
    },
    $inc: {
      [`unreadCounts.${recipientRole}`]: 1,
    },
  });

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

const markConversationRead = async (conversationId, user) => {
  const { conversation, relation, summary } = await getConversationForUser(
    conversationId,
    user
  );

  ensureConversationIsActive(conversation);

  if (relation.status !== ACTIVE_RELATION_STATUS) {
    throw new ApiError(403, "Conversation is no longer active");
  }

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
  markConversationRead,
  syncConversationForAssignment,
};
