const env = require("../config/env");
const { ROLES } = require("../constants/roles");
const User = require("../models/User");
const {
  hashValue,
  sendEmailVerificationOtp,
  sendPasswordResetOtp,
} = require("../services/userOtpService");
const { deleteUserAccount } = require("../services/accountService");
const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");
const { signToken } = require("../utils/jwt");

const validateAdminBootstrapToken = (token) => {
  if (!env.ADMIN_BOOTSTRAP_TOKEN) {
    throw new ApiError(403, "Admin bootstrap is disabled");
  }

  if (!token || token !== env.ADMIN_BOOTSTRAP_TOKEN) {
    throw new ApiError(403, "Invalid admin bootstrap token");
  }
};

const normalizeOptionalString = (value) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
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

    const emailSent = await sendEmailVerificationOtp(user);

    // No token is returned so they are forced to verify their email (and login later).
    const token = null;

    res.status(201).json({
      message: emailSent
        ? `${role} registered successfully`
        : `${role} registered successfully, but we could not send the verification OTP.`,
      token,
      user: user.toJSON(),
      emailVerification: {
        verified: user.emailVerified,
        emailSent,
      },
    });
  });

const login = catchAsync(async (req, res) => {
  const normalizedEmail = req.body.email?.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select(
    "+password +emailVerificationTokenHash +emailVerificationExpiresAt"
  );

  if (!user || !(await user.comparePassword(String(req.body.password || "")))) {
    throw new ApiError(401, "Invalid email or password");
  }

  if (!user.emailVerified) {
    const emailSent = await sendEmailVerificationOtp(user);

    throw new ApiError(
      403,
      emailSent
        ? "Please verify your email before logging in."
        : "Please verify your email before logging in. We could not send a new OTP right now.",
      {
        code: "EMAIL_NOT_VERIFIED",
        email: user.email,
        emailSent,
      }
    );
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

  const emailSent = await sendEmailVerificationOtp(user);

  if (!emailSent) {
    throw new ApiError(500, "Failed to send verification OTP");
  }

  res.json({
    message: "Verification OTP sent successfully",
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

const updateCurrentUser = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).select(
    "+emailVerificationTokenHash +emailVerificationExpiresAt"
  );

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const normalizedEmail = req.body.email?.trim().toLowerCase();
  const emailChanged = Boolean(normalizedEmail && normalizedEmail !== user.email);

  if (emailChanged) {
    const existingUser = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: user._id },
    }).lean();

    if (existingUser) {
      throw new ApiError(409, "Email is already in use");
    }
  }

  if (req.body.name !== undefined) {
    user.name = req.body.name;
  }

  if (req.body.phone !== undefined) {
    user.phone = normalizeOptionalString(req.body.phone);
  }

  if (emailChanged) {
    user.email = normalizedEmail;
    user.emailVerified = false;
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpiresAt = null;

    const emailSent = await sendEmailVerificationOtp(user);

    res.json({
      message: emailSent
        ? "Profile updated. Verify your new email address to continue."
        : "Profile updated. Verify your new email address to continue. We could not send a new OTP right now.",
      user: user.toJSON(),
      sessionRevoked: true,
      emailVerification: {
        verified: user.emailVerified,
        emailSent,
      },
    });
    return;
  }

  await user.save();

  res.json({
    message: "Profile updated successfully",
    user: user.toJSON(),
    sessionRevoked: false,
    emailVerification: {
      verified: user.emailVerified,
    },
  });
});

const changeCurrentUserPassword = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).select("+password");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const passwordMatches = await user.comparePassword(req.body.currentPassword);

  if (!passwordMatches) {
    throw new ApiError(400, "Current password is incorrect");
  }

  if (req.body.currentPassword === req.body.newPassword) {
    throw new ApiError(400, "New password must be different from the current password");
  }

  user.password = req.body.newPassword;
  await user.save();

  res.json({
    message: "Password updated successfully",
    user: user.toJSON(),
  });
});

const deleteCurrentUser = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).select("+password");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const passwordMatches = await user.comparePassword(req.body.currentPassword);

  if (!passwordMatches) {
    throw new ApiError(400, "Current password is incorrect");
  }

  if (user.role === ROLES.ADMIN) {
    const adminCount = await User.countDocuments({ role: ROLES.ADMIN });

    if (adminCount <= 1) {
      throw new ApiError(409, "You cannot delete the last admin account");
    }
  }

  await deleteUserAccount(user);

  res.json({
    message: "Account deleted successfully",
  });
});

const forgotPassword = catchAsync(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select(
    "+passwordResetTokenHash +passwordResetExpiresAt"
  );
  if (!user) {
    throw new ApiError(404, "There is no user with that email address");
  }

  const emailSent = await sendPasswordResetOtp(user);

  if (!emailSent) {
    throw new ApiError(500, "Failed to send password reset OTP");
  }

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
  changeCurrentUserPassword,
  deleteCurrentUser,
  forgotPassword,
  resetPassword,
  registerAdminBootstrap,
  registerPatient: register(ROLES.PATIENT),
  registerDoctor: register(ROLES.DOCTOR),
  login,
  verifyEmail,
  resendVerificationEmail,
  getCurrentUser,
  updateCurrentUser,
};
