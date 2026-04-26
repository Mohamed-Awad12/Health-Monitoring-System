const crypto = require("crypto");
const env = require("../config/env");
const { ROLES } = require("../constants/roles");
const User = require("../models/User");
const { sendEmailVerificationMessage, sendPasswordResetEmail } = require("../services/emailService");
const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");
const { signToken } = require("../utils/jwt");

const buildEmailVerificationOtp = () =>
  crypto.randomInt(0, 1000000).toString().padStart(6, "0");

const hashValue = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");

const issueEmailVerificationOtp = async (user) => {
  const otp = buildEmailVerificationOtp();

  user.emailVerified = false;
  user.emailVerificationTokenHash = hashValue(otp);
  user.emailVerificationExpiresAt = new Date(
    Date.now() + env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES * 60 * 1000
  );

  await user.save();

  return otp;
};

const sendVerificationEmail = async (user) => {
  const verificationOtp = await issueEmailVerificationOtp(user);

  return sendEmailVerificationMessage({
    user,
    otp: verificationOtp,
  });
};

const queueVerificationEmail = async (user) => {
  try {
    await sendVerificationEmail(user);
    return true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Failed to queue verification email for ${user.email}:`, error.message || error);
    return false;
  }
};

const validateAdminBootstrapToken = (token) => {
  if (!env.ADMIN_BOOTSTRAP_TOKEN) {
    throw new ApiError(403, "Admin bootstrap is disabled");
  }

  if (!token || token !== env.ADMIN_BOOTSTRAP_TOKEN) {
    throw new ApiError(403, "Invalid admin bootstrap token");
  }
};

const register = (role) =>
  catchAsync(async (req, res) => {
    const existingUser = await User.findOne({ email: req.body.email }).lean();

    if (existingUser) {
      throw new ApiError(409, "Email is already in use");
    }

    if (role === ROLES.DOCTOR && !req.file) {
      throw new ApiError(400, "Doctor verification document is required");
    }

    const doctorVerification =
      role === ROLES.DOCTOR
        ? {
            status: "pending",
            documentFileName: req.file.filename,
            documentOriginalName: req.file.originalname,
            documentMimeType: req.file.mimetype,
            documentSize: req.file.size,
            documentUploadedAt: new Date(),
            reviewedBy: null,
            reviewedAt: null,
            reviewNote: "",
          }
        : undefined;

    const user = await User.create({
      ...req.body,
      role,
      specialty: role === ROLES.DOCTOR ? req.body.specialty : undefined,
      doctorVerification,
    });

    void queueVerificationEmail(user);

    // No token is returned so they are forced to verify their email (and login later).
    const token = null;

    res.status(201).json({
      message: `${role} registered successfully`,
      token,
      user: user.toJSON(),
      emailVerification: {
        verified: user.emailVerified,
        emailSent: true,
      },
    });
  });

const login = catchAsync(async (req, res) => {
  const normalizedEmail = req.body.email?.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select("+password");

  if (!user || !(await user.comparePassword(String(req.body.password || "")))) {
    throw new ApiError(401, "Invalid email or password");
  }

  if (!user.emailVerified) {
    void queueVerificationEmail(user);

    throw new ApiError(403, "Please verify your email before logging in.", {
      code: "EMAIL_NOT_VERIFIED",
      email: user.email,
      emailSent: true,
    });
  }

  if (
    user.role === ROLES.DOCTOR &&
    user.doctorVerification?.status &&
    user.doctorVerification.status !== "approved"
  ) {
    throw new ApiError(
      403,
      "Doctor account is pending admin approval. Upload verification and wait for approval."
    );
  }

  const token = signToken(user);

  res.json({
    message: "Login successful",
    token,
    user: user.toJSON(),
    emailVerification: {
      verified: user.emailVerified,
    },
  });
});

const verifyEmail = catchAsync(async (req, res) => {
  const normalizedEmail = req.body.email.trim().toLowerCase();
  const user = await User.findOne({
    email: normalizedEmail,
  }).select("+emailVerificationTokenHash +emailVerificationExpiresAt");

  if (
    !user ||
    !user.emailVerificationTokenHash ||
    !user.emailVerificationExpiresAt ||
    user.emailVerificationExpiresAt <= new Date()
  ) {
    throw new ApiError(400, "Invalid or expired verification OTP");
  }

  const providedOtpHash = hashValue(req.body.otp);

  if (providedOtpHash !== user.emailVerificationTokenHash) {
    throw new ApiError(400, "Invalid or expired verification OTP");
  }

  user.emailVerified = true;
  user.emailVerificationTokenHash = null;
  user.emailVerificationExpiresAt = null;
  await user.save();

  res.json({
    message: "Email verified successfully",
    user: user.toJSON(),
  });
});

const resendVerificationEmail = catchAsync(async (req, res) => {
  const normalizedEmail = req.body.email.trim().toLowerCase();

  const user = await User.findOne({ email: normalizedEmail }).select(
    "+emailVerificationTokenHash +emailVerificationExpiresAt"
  );

  if (!user) {
    res.json({
      message: "If an account exists, a verification OTP has been sent.",
    });
    return;
  }

  if (user.emailVerified) {
    res.json({
      message: "Email is already verified",
      emailVerification: {
        verified: true,
        emailSent: false,
      },
    });
    return;
  }

  void queueVerificationEmail(user);

  res.json({
    message: "Verification OTP is being sent",
    emailVerification: {
      verified: false,
      emailSent: true,
    },
  });
});

const registerAdminBootstrap = catchAsync(async (req, res) => {
  const bootstrapToken = req.headers["x-admin-bootstrap-token"];
  validateAdminBootstrapToken(typeof bootstrapToken === "string" ? bootstrapToken : "");

  const existingAdmin = await User.findOne({ role: ROLES.ADMIN }).lean();

  if (existingAdmin) {
    throw new ApiError(409, "An admin user already exists");
  }

  const existingUser = await User.findOne({ email: req.body.email }).lean();

  if (existingUser) {
    throw new ApiError(409, "Email is already in use");
  }

  const user = await User.create({
    ...req.body,
    role: ROLES.ADMIN,
    specialty: undefined,
    emailVerified: true,
    emailVerificationTokenHash: null,
    emailVerificationExpiresAt: null,
  });

  const token = signToken(user);

  res.status(201).json({
    message: "Admin registered successfully",
    token,
    user: user.toJSON(),
    emailVerification: {
      verified: true,
      emailSent: false,
    },
  });
});

const getCurrentUser = catchAsync(async (req, res) => {
  res.json({
    user: req.user.toJSON(),
  });
});


const forgotPassword = catchAsync(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    throw new ApiError(404, "There is no user with that email address");
  }

  const otp = buildEmailVerificationOtp();
  user.passwordResetTokenHash = hashValue(otp);
  user.passwordResetExpiresAt = new Date(
    Date.now() + env.PASSWORD_RESET_OTP_TTL_MINUTES * 60 * 1000
  );
  await user.save({ validateBeforeSave: false });

  await sendPasswordResetEmail({ user, otp });

  res.status(200).json({
    message: "Password reset OTP sent to email",
  });
});

const resetPassword = catchAsync(async (req, res) => {
  const now = new Date();
  let user = null;

  if ("token" in req.body) {
    const hashedToken = hashValue(req.body.token);

    user = await User.findOne({
      passwordResetTokenHash: hashedToken,
      passwordResetExpiresAt: { $gt: now },
    });
  } else {
    const normalizedEmail = req.body.email.trim().toLowerCase();
    user = await User.findOne({
      email: normalizedEmail,
    }).select("+passwordResetTokenHash +passwordResetExpiresAt");

    if (
      !user ||
      !user.passwordResetTokenHash ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt <= now ||
      user.passwordResetTokenHash !== hashValue(req.body.otp)
    ) {
      throw new ApiError(400, "OTP is invalid or has expired");
    }
  }

  if (!user) {
    throw new ApiError(400, "Token is invalid or has expired");
  }

  user.password = req.body.password;
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  await user.save();

  res.status(200).json({
    message: "Password successfully updated",
  });
});

module.exports = {
  forgotPassword,
  resetPassword,
  registerAdminBootstrap,
  registerPatient: register(ROLES.PATIENT),
  registerDoctor: register(ROLES.DOCTOR),
  login,
  verifyEmail,
  resendVerificationEmail,
  getCurrentUser,
};
