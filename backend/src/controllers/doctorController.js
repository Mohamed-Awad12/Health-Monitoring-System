const mongoose = require("mongoose");
const { getIO } = require("../config/socket");
const Alert = require("../models/Alert");
const DoctorPatient = require("../models/DoctorPatient");
const Reading = require("../models/Reading");
const { doctorScopeTag, patientScopeTag } = require("../services/cacheTags");
const { getPatientDashboard, getReadingFeed } = require("../services/analyticsService");
const {
  registerSubscription,
  unregisterSubscription,
} = require("../services/pushNotificationService");
const responseCache = require("../services/responseCache");
const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");
const { applyLastModified, setCachingHeaders, setNoStoreHeaders } = require("../utils/httpCache");
const env = require("../config/env");
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

const invalidateDoctorCache = (doctorId, patientId = null) => {
  const tags = [doctorScopeTag(doctorId)];

  if (patientId) {
    tags.push(patientScopeTag(patientId));
  }

  responseCache.invalidateByTags(tags);
};

const getPatientTelemetryMaps = async (patientIds) => {
  if (!patientIds.length) {
    return {
      latestMap: new Map(),
      alertMap: new Map(),
    };
  }

  const [latestReadings, alertCounts] = await Promise.all([
    Reading.aggregate([
      {
        $match: {
          patient: { $in: patientIds },
        },
      },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: "$patient",
          spo2: { $first: "$spo2" },
          bpm: { $first: "$bpm" },
          timestamp: { $first: "$timestamp" },
        },
      },
    ]),
    Alert.aggregate([
      {
        $match: {
          patient: { $in: patientIds },
          status: "open",
        },
      },
      {
        $group: {
          _id: "$patient",
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  return {
    latestMap: new Map(latestReadings.map((item) => [item._id.toString(), item])),
    alertMap: new Map(alertCounts.map((item) => [item._id.toString(), item.count])),
  };
};

const formatAssignment = (relation, latestMap, alertMap) => ({
  assignmentId: relation._id,
  assignmentStatus: relation.status,
  requestedAt: relation.requestedAt,
  respondedAt: relation.respondedAt,
  assignedAt: relation.assignedAt,
  thresholds: relation.thresholds || null,
  ...relation.patient,
  latestReading: latestMap.get(relation.patient._id.toString()) || null,
  openAlertCount: alertMap.get(relation.patient._id.toString()) || 0,
});

const ensureDoctorPatientAccess = async (doctorId, patientId) => {
  const relation = await DoctorPatient.findOne({
    doctor: doctorId,
    patient: patientId,
    status: "active",
  }).lean();

  if (!relation) {
    throw new ApiError(403, "Patient is not assigned to this doctor");
  }
};

const listAssignedPatients = catchAsync(async (req, res) => {
  const searchRegex = req.query.search
    ? new RegExp(escapeRegex(req.query.search), "i")
    : null;
  const cachedPayload = await responseCache.remember(
    `doctor:${req.user._id}:patients:${req.query.search || ""}`,
    env.DOCTOR_PATIENTS_CACHE_TTL_SECONDS * 1000,
    async () => {
      const relations = await DoctorPatient.find({
        doctor: req.user._id,
        status: { $in: ["active", "pending"] },
      })
        .populate({
          path: "patient",
          select: "name email updatedAt",
          match: searchRegex
            ? {
                $or: [{ name: searchRegex }, { email: searchRegex }],
              }
            : {},
        })
        .sort({ requestedAt: -1, assignedAt: -1, updatedAt: -1 })
        .lean();

      const populatedRelations = relations.filter((relation) => relation.patient);
      const patientIds = [
        ...new Set(populatedRelations.map((relation) => relation.patient._id.toString())),
      ].map((patientId) => new mongoose.Types.ObjectId(patientId));

      const { latestMap, alertMap } = await getPatientTelemetryMaps(patientIds);

      return {
        patients: populatedRelations
          .filter((relation) => relation.status === "active")
          .map((relation) => formatAssignment(relation, latestMap, alertMap)),
        pendingAssignments: populatedRelations
          .filter((relation) => relation.status === "pending")
          .map((relation) => formatAssignment(relation, latestMap, alertMap)),
        lastModified: getLatestDate(
          populatedRelations.map(
            (relation) =>
              relation.updatedAt ||
              relation.assignedAt ||
              relation.requestedAt ||
              relation.patient?.updatedAt
          )
        ),
      };
    },
    [doctorScopeTag(req.user._id)]
  );

  setCachingHeaders(res, {
    scope: "private",
    maxAge: env.DOCTOR_PATIENTS_CACHE_TTL_SECONDS,
    staleWhileRevalidate: env.DOCTOR_PATIENTS_CACHE_TTL_SECONDS,
  });
  applyLastModified(res, cachedPayload.lastModified);
  res.json({
    patients: cachedPayload.patients,
    pendingAssignments: cachedPayload.pendingAssignments,
  });
});

const getPatientDashboardForDoctor = catchAsync(async (req, res) => {
  await ensureDoctorPatientAccess(req.user._id, req.params.patientId);

  const range = req.query.range || "day";
  const dashboard = await responseCache.remember(
    `doctor:${req.user._id}:patient-dashboard:${req.params.patientId}:${range}`,
    env.PATIENT_DASHBOARD_CACHE_TTL_SECONDS * 1000,
    () => getPatientDashboard(req.params.patientId, range),
    [doctorScopeTag(req.user._id), patientScopeTag(req.params.patientId)]
  );

  setCachingHeaders(res, {
    scope: "private",
    maxAge: env.PATIENT_DASHBOARD_CACHE_TTL_SECONDS,
    staleWhileRevalidate: env.PATIENT_DASHBOARD_CACHE_TTL_SECONDS,
  });
  applyLastModified(res, dashboard.lastModified);
  res.json(dashboard);
});

const getPatientReadingsForDoctor = catchAsync(async (req, res) => {
  await ensureDoctorPatientAccess(req.user._id, req.params.patientId);

  const range = req.query.range || "day";
  const readings = await responseCache.remember(
    `doctor:${req.user._id}:patient-readings:${req.params.patientId}:${range}`,
    env.READING_FEED_CACHE_TTL_SECONDS * 1000,
    () => getReadingFeed(req.params.patientId, range),
    [doctorScopeTag(req.user._id), patientScopeTag(req.params.patientId)]
  );

  setCachingHeaders(res, {
    scope: "private",
    maxAge: env.READING_FEED_CACHE_TTL_SECONDS,
    staleWhileRevalidate: env.READING_FEED_CACHE_TTL_SECONDS,
  });
  applyLastModified(res, readings.lastModified);
  res.json(readings);
});

const getPatientAlertsForDoctor = catchAsync(async (req, res) => {
  await ensureDoctorPatientAccess(req.user._id, req.params.patientId);

  const filter = {
    patient: req.params.patientId,
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

const acknowledgeAlertAsDoctor = catchAsync(async (req, res) => {
  const alert = await Alert.findById(req.params.alertId).lean();

  if (!alert) {
    throw new ApiError(404, "Alert not found");
  }

  await ensureDoctorPatientAccess(req.user._id, alert.patient);

  const updatedAlert = await Alert.findByIdAndUpdate(
    req.params.alertId,
    {
      $set: {
        status: "acknowledged",
        acknowledgedBy: req.user._id,
        acknowledgedAt: new Date(),
      },
    },
    { new: true }
  );
  invalidateDoctorCache(req.user._id, alert.patient);

  setNoStoreHeaders(res);
  res.json({
    message: "Alert acknowledged",
    alert: updatedAlert,
  });
});

const saveAlertNoteAsDoctor = catchAsync(async (req, res) => {
  const alert = await Alert.findById(req.params.alertId);

  if (!alert) {
    throw new ApiError(404, "Alert not found");
  }

  await ensureDoctorPatientAccess(req.user._id, alert.patient);

  const note = typeof req.body.note === "string" ? req.body.note.trim() : "";
  alert.doctorNote = note || null;
  alert.notedAt = note ? new Date() : null;
  await alert.save();
  await alert.populate("acknowledgedBy", "name role");
  invalidateDoctorCache(req.user._id, alert.patient);

  const io = getIO();

  if (io) {
    const payload = {
      id: alert._id,
      patientId: alert.patient,
      doctorNote: alert.doctorNote,
      notedAt: alert.notedAt,
    };

    io.to(`patient:${alert.patient}`).emit("alert:note-updated", payload);
    io.to(`doctor:${req.user._id}`).emit("alert:note-updated", payload);
  }

  setNoStoreHeaders(res);
  res.json({
    message: "Alert note saved",
    alert,
  });
});

const approveAssignment = catchAsync(async (req, res) => {
  const relation = await DoctorPatient.findOne({
    _id: req.params.assignmentId,
    doctor: req.user._id,
  });

  if (!relation) {
    throw new ApiError(404, "Assignment request not found");
  }

  if (relation.status !== "pending") {
    throw new ApiError(409, "Assignment request has already been resolved");
  }

  const now = new Date();

  relation.status = "active";
  relation.respondedAt = now;
  relation.assignedAt = now;
  relation.endedAt = null;
  await relation.save();
  invalidateDoctorCache(req.user._id, relation.patient);

  await relation.populate("patient", "name email");
  await relation.populate("doctor", "name email specialty");

  setNoStoreHeaders(res);
  res.json({
    message: "Assignment approved",
    assignment: relation.toObject(),
  });
});

const denyAssignment = catchAsync(async (req, res) => {
  const relation = await DoctorPatient.findOne({
    _id: req.params.assignmentId,
    doctor: req.user._id,
  });

  if (!relation) {
    throw new ApiError(404, "Assignment request not found");
  }

  if (relation.status !== "pending") {
    throw new ApiError(409, "Assignment request has already been resolved");
  }

  relation.status = "denied";
  relation.respondedAt = new Date();
  relation.assignedAt = null;
  relation.endedAt = null;
  await relation.save();
  invalidateDoctorCache(req.user._id, relation.patient);

  await relation.populate("patient", "name email");
  await relation.populate("doctor", "name email specialty");

  setNoStoreHeaders(res);
  res.json({
    message: "Assignment denied",
    assignment: relation.toObject(),
  });
});

const updateAssignmentThresholds = catchAsync(async (req, res) => {
  const relation = await DoctorPatient.findOne({
    _id: req.params.assignmentId,
    doctor: req.user._id,
  });

  if (!relation) {
    throw new ApiError(404, "Assignment not found");
  }

  if (relation.status !== "active") {
    throw new ApiError(409, "Only active assignments can update alert thresholds");
  }

  relation.thresholds = relation.thresholds || {};

  ["lowSpo2", "lowBpm", "highBpm"].forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      relation.thresholds[field] = req.body[field];
    }
  });

  await relation.save();
  invalidateDoctorCache(req.user._id, relation.patient);
  await relation.populate("patient", "name email");
  await relation.populate("doctor", "name email specialty");

  setNoStoreHeaders(res);
  res.json({
    message: "Assignment thresholds updated",
    assignment: relation.toObject(),
  });
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
  listAssignedPatients,
  getPatientDashboardForDoctor,
  getPatientReadingsForDoctor,
  getPatientAlertsForDoctor,
  acknowledgeAlertAsDoctor,
  saveAlertNoteAsDoctor,
  approveAssignment,
  denyAssignment,
  updateAssignmentThresholds,
  subscribePush,
  unsubscribePush,
};
