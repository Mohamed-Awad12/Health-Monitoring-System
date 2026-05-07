const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { ROLES } = require("../constants/roles");
const { sendOtpEmail } = require("./emailService");
const { hashValue } = require("./userOtpService");

const TEMP_TOKEN_EXPIRES_IN = "10m";
const TWO_FACTOR_ROLES = new Set([ROLES.DOCTOR, ROLES.ADMIN]);

const buildOtp = () =>
  crypto.randomInt(0, 1000000).toString().padStart(6, "0");

const roleSupportsTwoFactor = (role) => TWO_FACTOR_ROLES.has(role);

const signTwoFactorTempToken = (user) =>
  jwt.sign(
    {
      sub: user._id.toString(),
      type: "two_factor",
    },
    env.JWT_SECRET,
    { expiresIn: TEMP_TOKEN_EXPIRES_IN }
  );

const verifyTwoFactorTempToken = (token) => {
  const decoded = jwt.verify(token, env.JWT_SECRET);

  if (decoded.type !== "two_factor") {
    throw new Error("Invalid two-factor token");
  }

  return decoded;
};

const createTwoFactorChallenge = async (user) => {
  if (!roleSupportsTwoFactor(user.role)) {
    return null;
  }

  const otp = buildOtp();
  user.twoFactorSecret = hashValue(otp);
  await user.save({ validateBeforeSave: false });

  const emailSent = await sendOtpEmail({
    email: user.email,
    otp,
  });

  if (!emailSent) {
    user.twoFactorSecret = null;
    await user.save({ validateBeforeSave: false });
    return null;
  }

  return signTwoFactorTempToken(user);
};

const verifyTwoFactorOtp = (user, otp) =>
  Boolean(user?.twoFactorSecret && hashValue(otp) === user.twoFactorSecret);

module.exports = {
  createTwoFactorChallenge,
  roleSupportsTwoFactor,
  verifyTwoFactorOtp,
  verifyTwoFactorTempToken,
};
