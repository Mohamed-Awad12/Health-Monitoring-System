const express = require("express");
const adminController = require("../controllers/adminController");
const { authenticate, authorize } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");
const { requireCsrf } = require("../middlewares/csrf");
const { authenticatedWriteLimiter } = require("../middlewares/rateLimits");
const validate = require("../middlewares/validate");
const {
  userListQuerySchema,
  userParamsSchema,
  createUserSchema,
  updateUserSchema,
  reviewDoctorVerificationSchema,
} = require("../validations/adminValidation");

const router = express.Router();

router.use(authenticate, authorize(ROLES.ADMIN));

router.get("/users", validate({ query: userListQuerySchema }), adminController.listUsers);
router.get("/users/:userId", validate({ params: userParamsSchema }), adminController.getUserById);
router.post(
  "/users",
  authenticatedWriteLimiter,
  requireCsrf,
  validate({ body: createUserSchema }),
  adminController.createUser
);
router.patch(
  "/users/:userId",
  authenticatedWriteLimiter,
  requireCsrf,
  validate({ params: userParamsSchema, body: updateUserSchema }),
  adminController.updateUser
);
router.get(
  "/users/:userId/doctor-verification/document",
  validate({ params: userParamsSchema }),
  adminController.getDoctorVerificationDocument
);
router.patch(
  "/users/:userId/doctor-verification",
  authenticatedWriteLimiter,
  requireCsrf,
  validate({ params: userParamsSchema, body: reviewDoctorVerificationSchema }),
  adminController.reviewDoctorVerification
);
router.delete(
  "/users/:userId",
  authenticatedWriteLimiter,
  requireCsrf,
  validate({ params: userParamsSchema }),
  adminController.deleteUser
);


router.post(
  "/users/:userId/send-verification",
  authenticatedWriteLimiter,
  requireCsrf,
  validate({ params: userParamsSchema }),
  adminController.sendVerificationEmailToUser
);

module.exports = router;
