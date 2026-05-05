const fs = require("fs");
const path = require("path");
const User = require("../models/User");
const { ROLES } = require("../constants/roles");
const { adminUsersTag, doctorDirectoryTag } = require("../services/cacheTags");
const responseCache = require("../services/responseCache");
const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");
const { applyLastModified, setCachingHeaders, setNoStoreHeaders } = require("../utils/httpCache");
const { doctorVerificationDir } = require("../middlewares/upload");
const { deleteUserAccount } = require("../services/accountService");
const { sendEmailVerificationOtp } = require("../services/userOtpService");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeOptionalString = (value) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
};

const invalidateAdminUsersCache = () => {
  responseCache.invalidateByTags([adminUsersTag, doctorDirectoryTag]);
};

const listUsers = catchAsync(async (req, res) => {
  const page = Number(req.query.page);
  const limit = Number(req.query.limit);
  const skip = (page - 1) * limit;
  const filter = {};

  if (req.query.role && req.query.role !== "all") {
    filter.role = req.query.role;
  }

  if (
    req.query.doctorVerificationStatus &&
    req.query.doctorVerificationStatus !== "all"
  ) {
    filter.role = ROLES.DOCTOR;
    filter["doctorVerification.status"] = req.query.doctorVerificationStatus;
  }

  if (req.query.search) {
    const safeSearchRegex = new RegExp(escapeRegex(req.query.search), "i");
    filter.$or = [{ name: safeSearchRegex }, { email: safeSearchRegex }];
  }

  const cachedPayload = await responseCache.remember(
    `admin:users:${JSON.stringify(req.query)}`,
    30 * 1000,
    async () => {
      const [users, totalUsers] = await Promise.all([
        User.find(filter)
          .select(
            "name email role specialty phone emailVerified doctorVerification createdAt updatedAt"
          )
          .sort({ createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        User.countDocuments(filter),
      ]);

      return {
        users,
        pagination: {
          page,
          limit,
          total: totalUsers,
          totalPages: totalUsers > 0 ? Math.ceil(totalUsers / limit) : 1,
          hasNextPage: skip + users.length < totalUsers,
          hasPreviousPage: page > 1,
        },
        lastModified: users[0]?.updatedAt || users[0]?.createdAt || null,
      };
    },
    [adminUsersTag]
  );

  setCachingHeaders(res, {
    scope: "private",
    maxAge: 30,
    staleWhileRevalidate: 30,
  });
  applyLastModified(res, cachedPayload.lastModified);
  res.json({
    users: cachedPayload.users,
    pagination: cachedPayload.pagination,
  });
});

const getUserById = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.userId)
    .select(
      "name email role specialty phone emailVerified doctorVerification createdAt updatedAt"
    )
    .lean();

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  setNoStoreHeaders(res);
  res.json({ user });
});

const createUser = catchAsync(async (req, res) => {
  const existingUser = await User.findOne({ email: req.body.email }).lean();

  if (existingUser) {
    throw new ApiError(409, "Email is already in use");
  }

  const role = req.body.role;
  const specialty = role === ROLES.DOCTOR ? normalizeOptionalString(req.body.specialty) : undefined;

  const user = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    role,
    specialty,
    phone: normalizeOptionalString(req.body.phone),
    emailVerified: req.body.emailVerified,
    emailVerificationTokenHash: null,
    emailVerificationExpiresAt: null,
    doctorVerification:
      role === ROLES.DOCTOR
        ? {
            status: "approved",
            reviewNote: "Approved by admin at account creation",
            reviewedBy: req.user._id,
            reviewedAt: new Date(),
          }
        : {
            status: "not_submitted",
    },
  });

  invalidateAdminUsersCache();
  setNoStoreHeaders(res);
  res.status(201).json({
    message: "User created successfully",
    user: user.toJSON(),
  });
});

const updateUser = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (req.body.email && req.body.email !== user.email) {
    const existingEmail = await User.findOne({
      email: req.body.email,
      _id: { $ne: user._id },
    }).lean();

    if (existingEmail) {
      throw new ApiError(409, "Email is already in use");
    }
  }

  if (req.body.name !== undefined) {
    user.name = req.body.name;
  }

  if (req.body.email !== undefined) {
    user.email = req.body.email;
  }

  if (req.body.password !== undefined) {
    user.password = req.body.password;
  }

  if (req.body.phone !== undefined) {
    user.phone = normalizeOptionalString(req.body.phone);
  }

  if (req.body.emailVerified !== undefined) {
    user.emailVerified = req.body.emailVerified;
  }

  if (req.body.specialty !== undefined) {
    user.specialty = normalizeOptionalString(req.body.specialty);
  }

  if (req.body.role !== undefined) {
    user.role = req.body.role;
  }

  if (user.role !== ROLES.DOCTOR) {
    user.specialty = undefined;
    user.doctorVerification = {
      status: "not_submitted",
      documentFileName: undefined,
      documentOriginalName: undefined,
      documentMimeType: undefined,
      documentSize: undefined,
      documentUploadedAt: undefined,
      reviewedBy: undefined,
      reviewedAt: undefined,
      reviewNote: undefined,
    };
  } else if (!normalizeOptionalString(user.specialty || "")) {
    throw new ApiError(400, "specialty is required for doctor role");
  } else if (!user.doctorVerification?.status) {
    user.doctorVerification = {
      status: "approved",
      reviewNote: "Approved by admin during profile update",
      reviewedBy: req.user._id,
      reviewedAt: new Date(),
    };
  }

  await user.save();
  invalidateAdminUsersCache();

  setNoStoreHeaders(res);
  res.json({
    message: "User updated successfully",
    user: user.toJSON(),
  });
});

const deleteUser = catchAsync(async (req, res) => {
  if (req.params.userId === req.user._id.toString()) {
    throw new ApiError(409, "You cannot delete your own admin account");
  }

  const user = await User.findById(req.params.userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.role === ROLES.ADMIN) {
    const adminCount = await User.countDocuments({ role: ROLES.ADMIN });

    if (adminCount <= 1) {
      throw new ApiError(409, "You cannot delete the last admin account");
    }
  }

  await deleteUserAccount(user);
  invalidateAdminUsersCache();

  setNoStoreHeaders(res);
  res.json({
    message: "User deleted successfully",
  });
});

const getDoctorVerificationDocument = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.userId)
    .select("role doctorVerification")
    .lean();

  if (!user || user.role !== ROLES.DOCTOR) {
    throw new ApiError(404, "Doctor user not found");
  }

  const documentFileName = user.doctorVerification?.documentFileName;

  if (!documentFileName) {
    throw new ApiError(404, "Doctor verification document not found");
  }

  const safeName = path.basename(documentFileName);
  const absolutePath = path.join(doctorVerificationDir, safeName);

  if (!fs.existsSync(absolutePath)) {
    throw new ApiError(404, "Doctor verification document file is missing");
  }

  if (user.doctorVerification?.documentMimeType) {
    res.setHeader("Content-Type", user.doctorVerification.documentMimeType);
  }

  res.setHeader(
    "Content-Disposition",
    `inline; filename="${user.doctorVerification.documentOriginalName || safeName}"`
  );
  setCachingHeaders(res, {
    scope: "private",
    maxAge: 300,
    staleWhileRevalidate: 300,
  });

  res.sendFile(absolutePath);
});

const reviewDoctorVerification = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.userId);

  if (!user || user.role !== ROLES.DOCTOR) {
    throw new ApiError(404, "Doctor user not found");
  }

  if (!user.doctorVerification?.documentFileName) {
    throw new ApiError(409, "Doctor has not uploaded a verification document");
  }

  user.doctorVerification.status = req.body.status;
  user.doctorVerification.reviewedBy = req.user._id;
  user.doctorVerification.reviewedAt = new Date();
  user.doctorVerification.reviewNote = normalizeOptionalString(req.body.reviewNote) || "";

  await user.save();
  invalidateAdminUsersCache();

  setNoStoreHeaders(res);
  res.json({
    message:
      req.body.status === "approved"
        ? "Doctor verification approved"
        : "Doctor verification rejected",
    user: user.toJSON(),
  });
});

const sendVerificationEmailToUser = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.userId).select(
    "+emailVerificationTokenHash +emailVerificationExpiresAt"
  );

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.emailVerified) {
    throw new ApiError(400, "User email is already verified");
  }

  const emailSent = await sendEmailVerificationOtp(user);

  if (!emailSent) {
    throw new ApiError(500, "Failed to send verification email");
  }

  setNoStoreHeaders(res);
  res.status(200).json({
    message: "Verification OTP sent successfully",
  });
});

module.exports = {
  sendVerificationEmailToUser,
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getDoctorVerificationDocument,
  reviewDoctorVerification,
};
