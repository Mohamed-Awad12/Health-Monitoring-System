const express = require("express");
const authController = require("../controllers/authController");
const { authenticate } = require("../middlewares/auth");
const { requireCaptcha } = require("../middlewares/captcha");
const { requireCsrf } = require("../middlewares/csrf");
const {
  authAccountLimiter,
  authIpLimiter,
  authenticatedWriteLimiter,
} = require("../middlewares/rateLimits");
const validate = require("../middlewares/validate");
const { doctorVerificationUpload } = require("../middlewares/upload");
const {
  changePasswordSchema,
  deleteAccountSchema,
  registerPatientSchema,
  registerDoctorSchema,
  registerAdminBootstrapSchema,
  loginSchema,
  refreshTokenSchema,
  updateProfileSchema,
  updateTwoFactorSchema,
  verifyTwoFactorSchema,
  verifyEmailSchema,
  resendVerificationEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require("../validations/authValidation");

const router = express.Router();

router.post(
  "/register/admin/bootstrap",
  authIpLimiter,
  validate({ body: registerAdminBootstrapSchema }),
  authAccountLimiter,
  requireCaptcha,
  authController.registerAdminBootstrap
);

router.post(
  "/register/patient",
  authIpLimiter,
  validate({ body: registerPatientSchema }),
  authAccountLimiter,
  requireCaptcha,
  authController.registerPatient
);

router.post(
  "/register/doctor",
  authIpLimiter,
  doctorVerificationUpload.single("verificationDocument"),
  validate({ body: registerDoctorSchema }),
  authAccountLimiter,
  requireCaptcha,
  authController.registerDoctor
);

router.post(
  "/login",
  authIpLimiter,
  validate({ body: loginSchema }),
  authAccountLimiter,
  requireCaptcha,
  authController.login
);
router.post(
  "/refresh",
  authIpLimiter,
  requireCsrf,
  validate({ body: refreshTokenSchema }),
  authController.refresh
);
router.post(
  "/2fa/verify",
  authIpLimiter,
  validate({ body: verifyTwoFactorSchema }),
  authAccountLimiter,
  requireCaptcha,
  authController.verifyTwoFactor
);
router.post(
  "/verify-email",
  authIpLimiter,
  validate({ body: verifyEmailSchema }),
  authAccountLimiter,
  requireCaptcha,
  authController.verifyEmail
);
router.post(
  "/verify-email/resend",
  authIpLimiter,
  validate({ body: resendVerificationEmailSchema }),
  authAccountLimiter,
  requireCaptcha,
  authController.resendVerificationEmail
);
router
  .route("/me")
  .get(authenticate, authController.getCurrentUser)
  .patch(
    authenticate,
    authenticatedWriteLimiter,
    requireCsrf,
    validate({ body: updateProfileSchema }),
    authController.updateCurrentUser
  )
  .delete(
    authenticate,
    authenticatedWriteLimiter,
    requireCsrf,
    validate({ body: deleteAccountSchema }),
    authController.deleteCurrentUser
  );

router.patch(
  "/me/password",
  authenticate,
  authenticatedWriteLimiter,
  requireCsrf,
  validate({ body: changePasswordSchema }),
  authController.changeCurrentUserPassword
);

router.patch(
  "/me/2fa",
  authenticate,
  authenticatedWriteLimiter,
  requireCsrf,
  validate({ body: updateTwoFactorSchema }),
  authController.updateCurrentUserTwoFactor
);

router.post(
  "/logout",
  authenticate,
  authenticatedWriteLimiter,
  requireCsrf,
  authController.logout
);
router.post(
  "/forgot-password",
  authIpLimiter,
  validate({ body: forgotPasswordSchema }),
  authAccountLimiter,
  requireCaptcha,
  authController.forgotPassword
);
router.post(
  "/reset-password",
  authIpLimiter,
  validate({ body: resetPasswordSchema }),
  authAccountLimiter,
  requireCaptcha,
  authController.resetPassword
);

module.exports = router;
