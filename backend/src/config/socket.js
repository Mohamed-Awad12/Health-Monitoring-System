const { Server } = require("socket.io");
const env = require("./env");
const User = require("../models/User");
const { verifyToken } = require("../utils/jwt");

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

const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: isSocketOriginAllowed,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error("Authentication token is required"));
      }

      const decoded = verifyToken(token);
      const user = await User.findById(decoded.sub).select("_id role");

      if (!user) {
        return next(new Error("User not found"));
      }

      socket.user = {
        id: user._id.toString(),
        role: user.role,
      };

      return next();
    } catch (error) {
      return next(new Error("Socket authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.user.id}`);
    socket.join(`${socket.user.role}:${socket.user.id}`);

    socket.emit("connection:ready", {
      userId: socket.user.id,
      role: socket.user.role,
      connectedAt: new Date().toISOString(),
    });
  });

  return io;
};

const getIO = () => io;

module.exports = {
  initializeSocket,
  getIO,
};
