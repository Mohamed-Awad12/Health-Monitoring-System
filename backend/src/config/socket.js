const { Server } = require("socket.io");
const env = require("./env");
const DoctorPatient = require("../models/DoctorPatient");
const User = require("../models/User");
const { logSecurityEvent } = require("../services/securityEventLogger");
const {
  getConversationForUser,
  sendMessage,
} = require("../services/chatService");
const metricsService = require("../services/metricsService");
const { addConnection, getPresence, removeConnection } = require("../services/presenceService");
const { parseCookies } = require("../utils/cookies");
const { verifyToken } = require("../utils/jwt");
const { chatMessageBodySchema } = require("../validations/chatValidation");

let io;

const localhostOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

const normalizeOrigin = (origin) => origin.replace(/\/$/, "");

const allowedOrigins = env.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)
  .map(normalizeOrigin);

const isSocketOriginAllowed = (origin, callback) => {
  if (!origin) {
    return callback(null, true);
  }

  const normalizedOrigin = normalizeOrigin(origin);

  if (allowedOrigins.includes("*") || allowedOrigins.includes(normalizedOrigin)) {
    return callback(null, true);
  }

  if (env.NODE_ENV !== "production" && localhostOriginPattern.test(normalizedOrigin)) {
    return callback(null, true);
  }

  return callback(new Error(`CORS origin not allowed: ${origin}`));
};

const isValidObjectId = (value) => /^[0-9a-fA-F]{24}$/.test(String(value || ""));

const getCounterpartUserIds = async (userId, role) => {
  const relations =
    role === "doctor"
      ? await DoctorPatient.find({
          doctor: userId,
          status: "active",
        })
          .select("patient")
          .lean()
      : await DoctorPatient.find({
          patient: userId,
          status: "active",
        })
          .select("doctor")
          .lean();

  const counterpartIds = relations.map((relation) =>
    role === "doctor"
      ? relation.patient?.toString?.()
      : relation.doctor?.toString?.()
  );

  return [...new Set(counterpartIds.filter(Boolean))];
};

const emitPresenceUpdate = async (user) => {
  if (!io) {
    return;
  }

  const counterpartUserIds = await getCounterpartUserIds(user.id, user.role);
  const payload = {
    userId: user.id,
    role: user.role,
    ...getPresence(user.id),
    updatedAt: new Date().toISOString(),
  };

  counterpartUserIds.forEach((counterpartUserId) => {
    io.to(`user:${counterpartUserId}`).emit("chat:presence:update", payload);
  });
};

const createSocketAck = (callback) =>
  typeof callback === "function" ? callback : () => {};

const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: isSocketOriginAllowed,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const cookieToken = parseCookies(socket.handshake.headers.cookie)[
        env.AUTH_COOKIE_NAME
      ];
      const token = socket.handshake.auth?.token || cookieToken;

      if (!token) {
        return next(new Error("Authentication token is required"));
      }

      const decoded = verifyToken(token);
      const user = await User.findById(decoded.sub).select(
        "_id role name emailVerified doctorVerification.status"
      );

      if (!user) {
        return next(new Error("User not found"));
      }

      if (!user.emailVerified) {
        return next(new Error("Email verification is required"));
      }

      socket.user = {
        id: user._id.toString(),
        role: user.role,
        name: user.name,
      };

      return next();
    } catch (error) {
      return next(new Error("Socket authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    metricsService.incrementSocketConnections();
    socket.join(`user:${socket.user.id}`);
    socket.join(`${socket.user.role}:${socket.user.id}`);
    socket.data.lastChatMessageAt = 0;

    const connectionState = addConnection(socket.user.id);

    if (connectionState.becameOnline) {
      emitPresenceUpdate(socket.user).catch(() => {});
    }

    socket.emit("connection:ready", {
      userId: socket.user.id,
      role: socket.user.role,
      name: socket.user.name,
      connectedAt: new Date().toISOString(),
    });

    socket.on("chat:message:send", async (payload = {}, callback) => {
      const ack = createSocketAck(callback);

      try {
        if (!isValidObjectId(payload.conversationId)) {
          throw new Error("Conversation not found");
        }

        const now = Date.now();

        if (now - socket.data.lastChatMessageAt < 250) {
          throw new Error("You are sending messages too quickly");
        }

        const parsedBody = chatMessageBodySchema.safeParse(payload.body);

        if (!parsedBody.success) {
          throw new Error(parsedBody.error.issues[0]?.message || "Invalid chat message");
        }

        socket.data.lastChatMessageAt = now;

        const messagePayload = await sendMessage(
          payload.conversationId,
          {
            _id: socket.user.id,
            role: socket.user.role,
          },
          parsedBody.data
        );
        const recipientSummary = (
          await getConversationForUser(payload.conversationId, {
            _id: messagePayload.recipientId,
            role: messagePayload.recipientRole,
          })
        ).summary;

        io.to(`user:${socket.user.id}`).emit("chat:message:new", {
          conversation: messagePayload.conversation,
          message: messagePayload.message,
        });
        io.to(`user:${messagePayload.recipientId}`).emit("chat:message:new", {
          conversation: recipientSummary,
          message: messagePayload.message,
        });

        ack({
          ok: true,
          messageId: messagePayload.message.id,
        });
      } catch (error) {
        logSecurityEvent({
          severity: "warning",
          type: "chat_socket_send_failed",
          userId: socket.user.id,
          details: {
            message: error.message,
            conversationId: payload?.conversationId || null,
          },
        });
        ack({
          ok: false,
          message: error.message || "Failed to send chat message",
        });
      }
    });

    const handleTypingUpdate = async (payload = {}, callback, isTyping) => {
      const ack = createSocketAck(callback);

      try {
        if (!isValidObjectId(payload.conversationId)) {
          throw new Error("Conversation not found");
        }

        const { summary } = await getConversationForUser(payload.conversationId, {
          _id: socket.user.id,
          role: socket.user.role,
        });

        io.to(`user:${summary.participant.id}`).emit("chat:typing:update", {
          conversationId: payload.conversationId,
          userId: socket.user.id,
          role: socket.user.role,
          name: socket.user.name,
          isTyping,
          updatedAt: new Date().toISOString(),
        });

        ack({ ok: true });
      } catch (error) {
        ack({
          ok: false,
          message: error.message || "Failed to update typing state",
        });
      }
    };

    socket.on("chat:typing:start", (payload = {}, callback) => {
      handleTypingUpdate(payload, callback, true).catch(() => {});
    });

    socket.on("chat:typing:stop", (payload = {}, callback) => {
      handleTypingUpdate(payload, callback, false).catch(() => {});
    });

    socket.on("disconnect", () => {
      const disconnectState = removeConnection(socket.user.id);

      if (disconnectState.becameOffline) {
        emitPresenceUpdate(socket.user).catch(() => {});
      }

      metricsService.decrementSocketConnections();
    });
  });

  return io;
};

const getIO = () => io;

module.exports = {
  initializeSocket,
  getIO,
};
