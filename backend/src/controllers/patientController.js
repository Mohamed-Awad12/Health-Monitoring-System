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
const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");
const { getRangeBounds } = require("../utils/time");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const listDoctors = catchAsync(async (req, res) => {
  const search = req.query.search?.trim() || "";
  const page = req.query.page || 1;
  const limit = req.query.limit || 12;

  if (!search) {
    return res.json({
      doctors: [],
      pagination: {
        page: 1,
        limit,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });
  }

  const skip = (page - 1) * limit;
  const filter = { role: ROLES.DOCTOR };
  const safeSearchRegex = new RegExp(`^${escapeRegex(search)}`, "i");
  filter.name = safeSearchRegex;

  const [doctors, totalDoctors] = await Promise.all([
    User.find(filter)
      .select("name email specialty")
      .sort({ name: 1, _id: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  const doctorIds = doctors.map((doctor) => doctor._id);
  const relations = doctorIds.length
    ? await DoctorPatient.find({
        patient: req.user._id,
        doctor: { $in: doctorIds },
      })
      .select("doctor status requestedAt respondedAt assignedAt endedAt updatedAt")
      .lean()
    : [];

  const relationMap = new Map(relations.map((relation) => [relation.doctor.toString(), relation]));

  const payload = doctors.map((doctor) => {
    const relation = relationMap.get(doctor._id.toString());

    return {
      ...doctor,
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

  const totalPages = totalDoctors > 0 ? Math.ceil(totalDoctors / limit) : 1;

  res.json({
    doctors: payload,
    pagination: {
      page,
      limit,
      total: totalDoctors,
      totalPages,
      hasNextPage: skip + payload.length < totalDoctors,
      hasPreviousPage: page > 1,
    },
  });
});

const linkDevice = catchAsync(async (req, res) => {
  const { deviceSecretId, label } = req.body;
  let device = await Device.findOne({ deviceSecretId }).select("+deviceSecretId");

  if (device?.patient && device.patient.toString() !== req.user._id.toString()) {
    throw new ApiError(409, "This device is already linked to another patient");
  }

  if (!device) {
    device = await Device.create({
      deviceSecretId,
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

const assignDoctor = catchAsync(async (req, res) => {
  const { doctorId } = req.body;
  const doctor = await User.findOne({ _id: doctorId, role: ROLES.DOCTOR }).lean();
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

  res.json({
    message: "Doctor assignment ended",
    assignment: relation,
  });
});

const getDashboard = catchAsync(async (req, res) => {
  const dashboard = await getPatientDashboard(
    req.user._id,
    req.query.range || "day"
  );

  res.json(dashboard);
});

const getReadings = catchAsync(async (req, res) => {
  const readings = await getReadingFeed(req.user._id, req.query.range || "day");
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
    return res.send(pdfBuffer);
  }

  const csvBuffer = buildCsvReport({ patient, readings });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="pulse-oximeter-${range}.csv"`
  );

  return res.send(csvBuffer);
});

const generateAssistantReport = catchAsync(async (req, res) => {
  const result = await generateHealthAssistantReport(req.body);

  res.json(result);
});

module.exports = {
  listDoctors,
  linkDevice,
  assignDoctor,
  unassignDoctor,
  getDashboard,
  getReadings,
  getAlerts,
  acknowledgeAlert,
  downloadReport,
  generateAssistantReport,
};
