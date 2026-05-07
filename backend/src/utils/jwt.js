const jwt = require("jsonwebtoken");
const env = require("../config/env");

const signToken = (user) =>
  jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );

const signRefreshToken = (userId) =>
  jwt.sign(
    {
      sub: userId.toString(),
      type: "refresh",
    },
    env.REFRESH_TOKEN_SECRET,
    { expiresIn: env.REFRESH_TOKEN_EXPIRES_IN }
  );

const verifyToken = (token) => jwt.verify(token, env.JWT_SECRET);
const verifyRefreshToken = (token) => jwt.verify(token, env.REFRESH_TOKEN_SECRET);

module.exports = {
  signRefreshToken,
  signToken,
  verifyRefreshToken,
  verifyToken,
};
