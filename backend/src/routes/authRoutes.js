const express = require("express");
const authController = require("../controllers/authController");
const { authenticate } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const { doctorVerificationUpload } = require("../middlewares/upload");
const {
  registerPatientSchema,
  registerDoctorSchema,
  registerAdminBootstrapSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require("../validations/authValidation");

const router = express.Router();

router.post(
  "/register/admin/bootstrap",
  validate({ body: registerAdminBootstrapSchema }),
  authController.registerAdminBootstrap
);

router.post(
  "/register/patient",
  validate({ body: registerPatientSchema }),
  authController.registerPatient
);

router.post(
  "/register/doctor",
  doctorVerificationUpload.single("verificationDocument"),
  validate({ body: registerDoctorSchema }),
  authController.registerDoctor
);

router.post("/login", validate({ body: loginSchema }), authController.login);
router.post(
  "/verify-email",
  validate({ body: verifyEmailSchema }),
  authController.verifyEmail
);
router.post(
  "/verify-email/resend",
  validate({ body: resendVerificationEmailSchema }),
  authController.resendVerificationEmail
);
router.get("/me", authenticate, authController.getCurrentUser);


router.post("/forgot-password", validate({ body: forgotPasswordSchema }), authController.forgotPassword);
router.post("/reset-password", validate({ body: resetPasswordSchema }), authController.resetPassword);

module.exports = router;
