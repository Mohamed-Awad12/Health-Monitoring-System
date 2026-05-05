const DoctorPatient = require("../models/DoctorPatient");
const Device = require("../models/Device");
const Reading = require("../models/Reading");
const User = require("../models/User");
const { getIO } = require("../config/socket");
const { doctorScopeTag, patientScopeTag } = require("../services/cacheTags");
const { evaluateReadingAlerts } = require("../services/alertService");
const responseCache = require("../services/responseCache");
const { sendAlertEmailsToCareTeam } = require("../services/emailService");
const { logSecurityEvent } = require("../services/securityEventLogger");
const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");
const { setNoStoreHeaders } = require("../utils/httpCache");

const ingestReading = catchAsync(async (req, res) => {
  const { deviceSecretId, spo2, bpm, timestamp } = req.body;
  const device = await Device.findOne({
    deviceSecretId,
    isActive: true,
  }).select("+deviceSecretId");

  if (!device) {
    logSecurityEvent({
      severity: "warning",
      type: "unknown_or_inactive_device_ingest_attempt",
      req,
      details: {
        deviceSecretId,
      },
    });
    throw new ApiError(401, "Unknown or inactive device");
  }

  if (!device.patient) {
    throw new ApiError(409, "Device is not linked to a patient account");
  }

  const readingTimestamp = timestamp || new Date();
  const reading = await Reading.create({
    patient: device.patient,
    device: device._id,
    spo2,
    bpm,
    timestamp: readingTimestamp,
  });

  device.lastSeenAt = readingTimestamp;
  await device.save();

  const alerts = await evaluateReadingAlerts(reading);
  const careTeam = await DoctorPatient.find({
    patient: device.patient,
    status: "active",
  })
    .select("doctor")
    .populate("doctor", "_id name email emailVerified")
    .lean();
  const careTeamDoctors = careTeam
    .map((relation) => relation.doctor)
    .filter(Boolean);
  responseCache.invalidateByTags([
    patientScopeTag(device.patient),
    ...careTeamDoctors.map((doctor) => doctorScopeTag(doctor._id)),
  ]);

  if (alerts.length) {
    const patient = await User.findById(device.patient)
      .select("name email emailVerified")
      .lean();

    if (patient) {
      await Promise.allSettled(
        alerts.map((alert) =>
          sendAlertEmailsToCareTeam({
            alert,
            reading,
            patient,
            doctors: careTeamDoctors,
          })
        )
      );
    }
  }

  const io = getIO();

  if (io) {
    const readingPayload = {
      id: reading._id,
      patientId: reading.patient,
      spo2: reading.spo2,
      bpm: reading.bpm,
      timestamp: reading.timestamp,
    };

    io.to(`patient:${reading.patient}`).emit("reading:new", readingPayload);

    careTeam.forEach((relation) => {
      if (!relation.doctor?._id) {
        return;
      }

      io.to(`doctor:${relation.doctor._id}`).emit("reading:new", readingPayload);
    });

    alerts.forEach((alert) => {
      const alertPayload = {
        id: alert._id,
        patientId: alert.patient,
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        metrics: alert.metrics,
        createdAt: alert.createdAt,
      };

      io.to(`patient:${alert.patient}`).emit("alert:new", alertPayload);

      careTeam.forEach((relation) => {
        if (!relation.doctor?._id) {
          return;
        }

        io.to(`doctor:${relation.doctor._id}`).emit("alert:new", alertPayload);
      });
    });
  }

  setNoStoreHeaders(res);
  res.status(201).json({
    message: "Reading stored successfully",
    readingId: reading._id,
    alertsTriggered: alerts.length,
  });
});

module.exports = {
  ingestReading,
};
