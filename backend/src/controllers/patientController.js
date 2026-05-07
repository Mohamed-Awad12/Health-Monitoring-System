const crypto = require("crypto");
const { getIO } = require("../config/socket");
const Alert = require("../models/Alert");
const Device = require("../models/Device");
const DoctorPatient = require("../models/DoctorPatient");
const Reading = require("../models/Reading");
const User = require("../models/User");
const { ROLES } = require("../constants/roles");
const { getPatientDashboard, getReadingFeed } = require("../services/analyticsService");
const {
  generateHealthAssistantReport,
} = require("../services/healthAssistantService");
const { buildCsvReport, buildPdfReport } = require("../services/reportService");
const {
  registerSubscription,
  unregisterSubscription,
} = require("../services/pushNotificationService");
const {
  doctorDirectoryTag,
  doctorScopeTag,
  patientScopeTag,
} = require("../services/cacheTags");
const responseCache = require("../services/responseCache");
const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");
const { applyLastModified, setCachingHeaders, setNoStoreHeaders } = require("../utils/httpCache");
const env = require("../config/env");
const { getRangeBounds } = require("../utils/time");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getLatestDate = (...values) => {
  const validDates = values
    .flat()
    .filter(Boolean)
    .map((value) => (value instanceof Date ? value : new Date(value)))
    .filter((value) => !Number.isNaN(value.getTime()));

  if (!validDates.length) {
    return null;
  }

  return new Date(Math.max(...validDates.map((value) => value.getTime())));
};

const invalidatePatientCache = (patientId, doctorId = null) => {
  const tags = [patientScopeTag(patientId)];

  if (doctorId) {
    tags.push(doctorScopeTag(doctorId));
  }

  responseCache.invalidateByTags(tags);
};

const listDoctors = catchAsync(async (req, res) => {
  const search = req.query.search?.trim() || "";
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 12);
  const hasSearch = Boolean(search);
  const skip = hasSearch ? (page - 1) * limit : 0;
  const filter = {
    role: ROLES.DOCTOR,
    emailVerified: true,
    "doctorVerification.status": "approved",
  };

  if (hasSearch) {
    const safeSearchRegex = new RegExp(`^${escapeRegex(search)}`, "i");
    filter.name = safeSearchRegex;
  }

  const cachedPayload = await responseCache.remember(
    `patient:${req.user._id}:doctor-directory:${search}:${page}:${limit}`,
    env.DIRECTORY_CACHE_TTL_SECONDS * 1000,
    async () => {
      let doctors = [];
      let totalDoctors = 0;

      if (hasSearch) {
        [doctors, totalDoctors] = await Promise.all([
          User.find(filter)
            .select("name email specialty updatedAt")
            .sort({ name: 1, _id: 1 })
            .skip(skip)
            .limit(limit)
            .lean(),
          User.countDocuments(filter),
        ]);
      } else {
        doctors = await User.find(filter)
          .select("name email specialty updatedAt doctorVerification.reviewedAt")
          .sort({ "doctorVerification.reviewedAt": -1, createdAt: -1, _id: -1 })
          .limit(6)
          .lean();

        doctors.sort((firstDoctor, secondDoctor) =>
          String(firstDoctor.name || "").localeCompare(String(secondDoctor.name || ""))
        );
        totalDoctors = doctors.length;
      }

      const doctorIds = doctors.map((doctor) => doctor._id);
      const relations = doctorIds.length
        ? await DoctorPatient.find({
            patient: req.user._id,
            doctor: { $in: doctorIds },
          })
            .select("doctor status requestedAt respondedAt assignedAt endedAt updatedAt")
            .lean()
        : [];

      const relationMap = new Map(
        relations.map((relation) => [relation.doctor.toString(), relation])
      );

      const payload = doctors.map((doctor) => {
        const relation = relationMap.get(doctor._id.toString());

        return {
          _id: doctor._id,
          name: doctor.name,
          email: doctor.email,
          specialty: doctor.specialty,
          assignment: relation
            ? {
                id: relation._id,
                status: relation.status,
                requestedAt: relation.requestedAt,
                respondedAt: relation.respondedAt,
                assignedAt: relation.assignedAt,
                endedAt: relation.endedAt,
                updatedAt: relation.updatedAt,
              }
            : null,
        };
      });

      return {
        doctors: payload,
        pagination: {
          page: hasSearch ? page : 1,
          limit: hasSearch ? limit : 6,
          total: totalDoctors,
          totalPages: totalDoctors > 0 ? Math.ceil(totalDoctors / limit) : 1,
          hasNextPage: hasSearch && skip + payload.length < totalDoctors,
          hasPreviousPage: hasSearch && page > 1,
        },
        lastModified: getLatestDate(
          doctors.map((doctor) => doctor.updatedAt),
          relations.map((relation) => relation.updatedAt)
        ),
      };
    },
    [patientScopeTag(req.user._id), doctorDirectoryTag]
  );

  setCachingHeaders(res, {
    scope: "private",
    maxAge: env.DIRECTORY_CACHE_TTL_SECONDS,
    staleWhileRevalidate: env.DIRECTORY_CACHE_TTL_SECONDS,
  });
  applyLastModified(res, cachedPayload.lastModified);
  res.json({
    doctors: cachedPayload.doctors,
    pagination: cachedPayload.pagination,
  });
});

const linkDevice = catchAsync(async (req, res) => {
  const { deviceSecretId, label } = req.body;
  let device = await Device.findOne(Device.secretLookupFilter(deviceSecretId)).select(
    "+deviceSecretId"
  );

  if (device?.patient && device.patient.toString() !== req.user._id.toString()) {
    throw new ApiError(409, "This device is already linked to another patient");
  }

  if (!device) {
    device = await Device.create({
      deviceSecretId: Device.hashSecret(deviceSecretId),
      patient: req.user._id,
      label: label || "Primary Pulse Oximeter",
    });
  } else {
    device.patient = req.user._id;
    device.label = label || device.label;
    device.isActive = true;
    await device.save();
  }

  await Device.updateMany(
    {
      patient: req.user._id,
      _id: { $ne: device._id },
    },
    {
      $set: { patient: null },
    }
  );

  invalidatePatientCache(req.user._id);

  setNoStoreHeaders(res);
  res.json({
    message: "Device linked successfully",
    device: {
      id: device._id,
      label: device.label,
      isActive: device.isActive,
      lastSeenAt: device.lastSeenAt,
    },
  });
});

const rotateDeviceSecret = catchAsync(async (req, res) => {
  const device = await Device.findOne({
    patient: req.user._id,
    isActive: true,
  }).select("+deviceSecretId");

  if (!device) {
    throw new ApiError(404, "No active device found for this patient");
  }

  const newDeviceSecretId = crypto.randomBytes(24).toString("hex");
  const rotatedAt = new Date();

  device.deviceSecretId = Device.hashSecret(newDeviceSecretId);
  await device.save();

  invalidatePatientCache(req.user._id);

  const io = getIO();

  if (io) {
    io.to(`patient:${req.user._id}`).emit("device:secret-rotated", {
      patientId: req.user._id,
      deviceId: device._id,
      rotatedAt,
    });
  }

  setNoStoreHeaders(res);
  res.json({
    message: "Device secret rotated successfully",
    deviceSecretId: newDeviceSecretId,
    rotatedAt,
  });
});

const assignDoctor = catchAsync(async (req, res) => {
  const { doctorId } = req.body;
  const doctor = await User.findOne({
    _id: doctorId,
    role: ROLES.DOCTOR,
    emailVerified: true,
    "doctorVerification.status": "approved",
  }).lean();
  const now = new Date();

  if (!doctor) {
    throw new ApiError(404, "Doctor not found");
  }

  const existingRelation = await DoctorPatient.findOne({
    doctor: doctorId,
    patient: req.user._id,
  }).lean();

  if (existingRelation?.status === "active") {
    throw new ApiError(409, "You are already assigned to this doctor");
  }

  if (existingRelation?.status === "pending") {
    throw new ApiError(409, "You already have a pending request for this doctor");
  }

  const relation = await DoctorPatient.findOneAndUpdate(
    {
      doctor: doctorId,
      patient: req.user._id,
    },
    {
      $set: {
        status: "pending",
        requestedAt: now,
        respondedAt: null,
        assignedAt: null,
        endedAt: null,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  )
    .populate("doctor", "name email specialty")
    .lean();

  invalidatePatientCache(req.user._id, doctorId);

  setNoStoreHeaders(res);
  res.json({
    message: "Assignment request sent successfully",
    assignment: relation,
  });
});

const unassignDoctor = catchAsync(async (req, res) => {
  const relation = await DoctorPatient.findOne({
    _id: req.params.assignmentId,
    patient: req.user._id,
  });

  if (!relation) {
    throw new ApiError(404, "Assignment not found");
  }

  if (!["active", "pending"].includes(relation.status)) {
    throw new ApiError(409, "Only active or pending assignments can be unassigned");
  }

  const previousStatus = relation.status;
  const now = new Date();

  relation.status = "ended";
  relation.respondedAt = now;
  relation.endedAt = now;

  if (previousStatus === "pending") {
    relation.assignedAt = null;
  }

  await relation.save();
  invalidatePatientCache(req.user._id, relation.doctor);

  setNoStoreHeaders(res);
  res.json({
    message: "Doctor assignment ended",
    assignment: relation,
  });
});

const getDashboard = catchAsync(async (req, res) => {
  const range = req.query.range || "day";
  const dashboard = await responseCache.remember(
    `patient:${req.user._id}:dashboard:${range}`,
    env.PATIENT_DASHBOARD_CACHE_TTL_SECONDS * 1000,
    () => getPatientDashboard(req.user._id, range),
    [patientScopeTag(req.user._id)]
  );

  setCachingHeaders(res, {
    scope: "private",
    maxAge: env.PATIENT_DASHBOARD_CACHE_TTL_SECONDS,
    staleWhileRevalidate: env.PATIENT_DASHBOARD_CACHE_TTL_SECONDS,
  });
  applyLastModified(res, dashboard.lastModified);
  res.json(dashboard);
});

const getReadings = catchAsync(async (req, res) => {
  const range = req.query.range || "day";
  const readings = await responseCache.remember(
    `patient:${req.user._id}:readings:${range}`,
    env.READING_FEED_CACHE_TTL_SECONDS * 1000,
    () => getReadingFeed(req.user._id, range),
    [patientScopeTag(req.user._id)]
  );

  setCachingHeaders(res, {
    scope: "private",
    maxAge: env.READING_FEED_CACHE_TTL_SECONDS,
    staleWhileRevalidate: env.READING_FEED_CACHE_TTL_SECONDS,
  });
  applyLastModified(res, readings.lastModified);
  res.json(readings);
});

const getAlerts = catchAsync(async (req, res) => {
  const filter = {
    patient: req.user._id,
  };

  if (req.query.status && req.query.status !== "all") {
    filter.status = req.query.status;
  }

  const alerts = await Alert.find(filter)
    .sort({ createdAt: -1 })
    .populate("acknowledgedBy", "name role")
    .lean();

  setCachingHeaders(res, {
    scope: "private",
    maxAge: 10,
    staleWhileRevalidate: 10,
  });
  applyLastModified(
    res,
    getLatestDate(alerts.map((alert) => alert.acknowledgedAt || alert.updatedAt || alert.createdAt))
  );
  res.json({ alerts });
});

const acknowledgeAlert = catchAsync(async (req, res) => {
  const alert = await Alert.findOne({
    _id: req.params.alertId,
    patient: req.user._id,
  });

  if (!alert) {
    throw new ApiError(404, "Alert not found");
  }

  alert.status = "acknowledged";
  alert.acknowledgedBy = req.user._id;
  alert.acknowledgedAt = new Date();
  await alert.save();
  invalidatePatientCache(req.user._id);

  setNoStoreHeaders(res);
  res.json({
    message: "Alert acknowledged",
    alert,
  });
});

const downloadReport = catchAsync(async (req, res) => {
  const range = req.query.range || "day";
  const format = req.query.format || "csv";
  const { start, end } = getRangeBounds(range);
  const [patient, readings, summary] = await Promise.all([
    User.findById(req.user._id).select("name email").lean(),
    Reading.find({
      patient: req.user._id,
      timestamp: { $gte: start, $lte: end },
    })
      .sort({ timestamp: 1 })
      .lean(),
    getReadingFeed(req.user._id, range),
  ]);

  if (format === "pdf") {
    const pdfBuffer = await buildPdfReport({
      patient,
      readings,
      range,
      summary: summary.summary,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="pulse-oximeter-${range}.pdf"`
    );
    setNoStoreHeaders(res);
    return res.send(pdfBuffer);
  }

  const csvBuffer = buildCsvReport({ patient, readings });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="pulse-oximeter-${range}.csv"`
  );
  setNoStoreHeaders(res);

  return res.send(csvBuffer);
});

const generateAssistantReport = catchAsync(async (req, res) => {
  const result = await generateHealthAssistantReport(req.body);
  setNoStoreHeaders(res);

  res.json(result);
});

const subscribePush = catchAsync(async (req, res) => {
  const subscription = await registerSubscription(req.user._id, req.body);

  if (!subscription) {
    throw new ApiError(404, "User not found");
  }

  setNoStoreHeaders(res);
  res.status(201).json({
    message: "Push subscription registered",
    subscription,
  });
});

const unsubscribePush = catchAsync(async (req, res) => {
  await unregisterSubscription(req.user._id, req.body.endpoint);

  setNoStoreHeaders(res);
  res.json({
    message: "Push subscription removed",
  });
});

module.exports = {
  listDoctors,
  linkDevice,
  rotateDeviceSecret,
  assignDoctor,
  unassignDoctor,
  getDashboard,
  getReadings,
  getAlerts,
  acknowledgeAlert,
  downloadReport,
  generateAssistantReport,
  subscribePush,
  unsubscribePush,
};
