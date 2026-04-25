const mongoose = require("mongoose");
const Alert = require("../models/Alert");
const DoctorPatient = require("../models/DoctorPatient");
const Reading = require("../models/Reading");
const { getPatientDashboard, getReadingFeed } = require("../services/analyticsService");
const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");

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
  const searchRegex = req.query.search ? new RegExp(req.query.search, "i") : null;
  const relations = await DoctorPatient.find({
    doctor: req.user._id,
    status: { $in: ["active", "pending"] },
  })
    .populate({
      path: "patient",
      select: "name email",
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

  const activePatients = populatedRelations
    .filter((relation) => relation.status === "active")
    .map((relation) => formatAssignment(relation, latestMap, alertMap));
  const pendingAssignments = populatedRelations
    .filter((relation) => relation.status === "pending")
    .map((relation) => formatAssignment(relation, latestMap, alertMap));

  res.json({
    patients: activePatients,
    pendingAssignments,
  });
});

const getPatientDashboardForDoctor = catchAsync(async (req, res) => {
  await ensureDoctorPatientAccess(req.user._id, req.params.patientId);

  const dashboard = await getPatientDashboard(
    req.params.patientId,
    req.query.range || "day"
  );

  res.json(dashboard);
});

const getPatientReadingsForDoctor = catchAsync(async (req, res) => {
  await ensureDoctorPatientAccess(req.user._id, req.params.patientId);

  const readings = await getReadingFeed(
    req.params.patientId,
    req.query.range || "day"
  );

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

  res.json({
    message: "Alert acknowledged",
    alert: updatedAlert,
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

  await relation.populate("patient", "name email");
  await relation.populate("doctor", "name email specialty");

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

  await relation.populate("patient", "name email");
  await relation.populate("doctor", "name email specialty");

  res.json({
    message: "Assignment denied",
    assignment: relation.toObject(),
  });
});

module.exports = {
  listAssignedPatients,
  getPatientDashboardForDoctor,
  getPatientReadingsForDoctor,
  getPatientAlertsForDoctor,
  acknowledgeAlertAsDoctor,
  approveAssignment,
  denyAssignment,
};
