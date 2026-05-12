const express = require("express");
const chatController = require("../controllers/chatController");
const { ROLES } = require("../constants/roles");
const { authenticate, authorize, ensureApprovedDoctor } = require("../middlewares/auth");
const { requireCsrf } = require("../middlewares/csrf");
const { authenticatedWriteLimiter } = require("../middlewares/rateLimits");
const validate = require("../middlewares/validate");
const {
  chatConversationParamsSchema,
  chatMessagesQuerySchema,
  sendChatMessageSchema,
} = require("../validations/chatValidation");

const router = express.Router();

router.use(authenticate, authorize(ROLES.PATIENT, ROLES.DOCTOR), ensureApprovedDoctor);

router.get("/conversations", chatController.listConversations);
router.get(
  "/conversations/:conversationId/messages",
  validate({
    params: chatConversationParamsSchema,
    query: chatMessagesQuerySchema,
  }),
  chatController.listMessages
);
router.post(
  "/conversations/:conversationId/messages",
  authenticatedWriteLimiter,
  requireCsrf,
  validate({
    params: chatConversationParamsSchema,
    body: sendChatMessageSchema,
  }),
  chatController.createMessage
);
router.post(
  "/conversations/:conversationId/read",
  authenticatedWriteLimiter,
  requireCsrf,
  validate({
    params: chatConversationParamsSchema,
  }),
  chatController.markRead
);

module.exports = router;
