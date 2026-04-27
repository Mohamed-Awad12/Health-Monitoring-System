const crypto = require("crypto");
const env = require("../config/env");
const {
  sendEmailVerificationMessage,
  sendPasswordResetEmail,
} = require("./emailService");

const buildOtp = () =>
  crypto.randomInt(0, 1000000).toString().padStart(6, "0");

const hashValue = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");

const restoreSnapshot = async (user, snapshot) => {
  Object.assign(user, snapshot);
  await user.save({ validateBeforeSave: false });
};

const sendEmailVerificationOtp = async (user) => {
  const snapshot = {
    emailVerified: user.emailVerified,
    emailVerificationTokenHash: user.emailVerificationTokenHash ?? null,
    emailVerificationExpiresAt: user.emailVerificationExpiresAt ?? null,
  };
  const otp = buildOtp();

  user.emailVerified = false;
  user.emailVerificationTokenHash = hashValue(otp);
  user.emailVerificationExpiresAt = new Date(
    Date.now() + env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES * 60 * 1000
  );

  await user.save();

  const emailSent = await sendEmailVerificationMessage({ user, otp });

  if (emailSent) {
    return true;
  }

  await restoreSnapshot(user, snapshot);
  return false;
};

const sendPasswordResetOtp = async (user) => {
  const snapshot = {
    passwordResetTokenHash: user.passwordResetTokenHash ?? null,
    passwordResetExpiresAt: user.passwordResetExpiresAt ?? null,
  };
  const otp = buildOtp();

  user.passwordResetTokenHash = hashValue(otp);
  user.passwordResetExpiresAt = new Date(
    Date.now() + env.PASSWORD_RESET_OTP_TTL_MINUTES * 60 * 1000
  );

  await user.save({ validateBeforeSave: false });

  const emailSent = await sendPasswordResetEmail({ user, otp });

  if (emailSent) {
    return true;
  }

  await restoreSnapshot(user, snapshot);
  return false;
};

module.exports = {
  hashValue,
  sendEmailVerificationOtp,
  sendPasswordResetOtp,
};
