const env = require("../config/env");
const { ROLES } = require("../constants/roles");
const User = require("../models/User");
const { adminUsersTag, doctorDirectoryTag } = require("../services/cacheTags");
const responseCache = require("../services/responseCache");
const {
  hashValue,
  sendEmailVerificationOtp,
  sendPasswordResetOtp,
} = require("../services/userOtpService");
const { deleteUserAccount } = require("../services/accountService");
const { logSecurityEvent } = require("../services/securityEventLogger");
const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");
const { clearCsrfCookie, clearAuthCookie, setAuthCookie } = require("../utils/cookies");
const { setNoStoreHeaders } = require("../utils/httpCache");
const { signToken } = require("../utils/jwt");
const { issueCsrfToken } = require("../middlewares/csrf");

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

const establishSession = (req, res, user) => {
  const token = signToken(user);
  const csrfToken = issueCsrfToken(req, res);

  setAuthCookie(res, token);

  return {
    token: null,
    csrfToken,
  };
};

const revokeSession = (res) => {
  clearAuthCookie(res);
  clearCsrfCookie(res);
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
    responseCache.invalidateByTags([adminUsersTag]);

    const emailSent = await sendEmailVerificationOtp(user);

    // No token is returned so they are forced to verify their email (and login later).
    const token = null;

    setNoStoreHeaders(res);
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
    logSecurityEvent({
      severity: "warning",
      type: "failed_login_attempt",
      req,
      details: {
        email: normalizedEmail,
      },
    });
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

  const session = establishSession(req, res, user);

  setNoStoreHeaders(res);
  res.json({
    message: "Login successful",
    token: session.token,
    csrfToken: session.csrfToken,
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
  responseCache.invalidateByTags([adminUsersTag, doctorDirectoryTag]);

  setNoStoreHeaders(res);
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
    setNoStoreHeaders(res);
    res.json({
      message: "If an account exists, a verification OTP has been sent.",
    });
    return;
  }

  if (user.emailVerified) {
    setNoStoreHeaders(res);
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

  setNoStoreHeaders(res);
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
  responseCache.invalidateByTags([adminUsersTag]);

  const session = establishSession(req, res, user);

  setNoStoreHeaders(res);
  res.status(201).json({
    message: "Admin registered successfully",
    token: session.token,
    csrfToken: session.csrfToken,
    user: user.toJSON(),
    emailVerification: {
      verified: true,
      emailSent: false,
    },
  });
});

const getCurrentUser = catchAsync(async (req, res) => {
  setNoStoreHeaders(res);
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
    responseCache.invalidateByTags([adminUsersTag, doctorDirectoryTag]);
    revokeSession(res);

    setNoStoreHeaders(res);
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
  responseCache.invalidateByTags([adminUsersTag, doctorDirectoryTag]);

  setNoStoreHeaders(res);
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

  setNoStoreHeaders(res);
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
  revokeSession(res);

  setNoStoreHeaders(res);
  res.json({
    message: "Account deleted successfully",
  });
});

const forgotPassword = catchAsync(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select(
    "+passwordResetTokenHash +passwordResetExpiresAt"
  );

  if (!user) {
    logSecurityEvent({
      severity: "warning",
      type: "password_reset_requested_for_unknown_email",
      req,
      details: {
        email: req.body.email,
      },
    });
    setNoStoreHeaders(res);
    res.status(200).json({
      message: "If the email exists, a password reset OTP has been sent.",
    });
    return;
  }

  const emailSent = await sendPasswordResetOtp(user);

  if (!emailSent) {
    throw new ApiError(500, "Failed to send password reset OTP");
  }

  setNoStoreHeaders(res);
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
  revokeSession(res);

  setNoStoreHeaders(res);
  res.status(200).json({
    message: "Password successfully updated",
  });
});

const logout = catchAsync(async (_req, res) => {
  revokeSession(res);
  setNoStoreHeaders(res);

  res.status(200).json({
    message: "Logged out successfully",
  });
});

module.exports = {
  changeCurrentUserPassword,
  deleteCurrentUser,
  forgotPassword,
  logout,
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
