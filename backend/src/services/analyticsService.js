const mongoose = require("mongoose");
const Alert = require("../models/Alert");
const Device = require("../models/Device");
const DoctorPatient = require("../models/DoctorPatient");
const Reading = require("../models/Reading");
const { getRangeBounds } = require("../utils/time");

const toObjectId = (id) => new mongoose.Types.ObjectId(id);

const serializeRelation = (relation) => {
  if (!relation) {
    return null;
  }

  return {
    id: relation._id,
    status: relation.status,
    requestedAt: relation.requestedAt,
    respondedAt: relation.respondedAt,
    assignedAt: relation.assignedAt,
    endedAt: relation.endedAt,
    doctor: relation.doctor || null,
  };
};

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

const getTrendSeries = async (patientId, range = "day") => {
  const { start, end, format } = getRangeBounds(range);

  return Reading.aggregate([
    {
      $match: {
        patient: toObjectId(patientId),
        timestamp: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format,
            date: "$timestamp",
          },
        },
        avgSpo2: { $avg: "$spo2" },
        avgBpm: { $avg: "$bpm" },
        latestTimestamp: { $max: "$timestamp" },
      },
    },
    {
      $project: {
        _id: 0,
        label: "$_id",
        spo2: { $round: ["$avgSpo2", 1] },
        bpm: { $round: ["$avgBpm", 1] },
        timestamp: "$latestTimestamp",
      },
    },
    { $sort: { timestamp: 1 } },
  ]);
};

const getSummary = async (patientId, range = "day") => {
  const { start, end } = getRangeBounds(range);
  const [summary] = await Reading.aggregate([
    {
      $match: {
        patient: toObjectId(patientId),
        timestamp: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: null,
        averageSpo2: { $avg: "$spo2" },
        averageBpm: { $avg: "$bpm" },
        minimumSpo2: { $min: "$spo2" },
        minimumBpm: { $min: "$bpm" },
        maximumSpo2: { $max: "$spo2" },
        maximumBpm: { $max: "$bpm" },
        totalReadings: { $sum: 1 },
      },
    },
  ]);

  if (!summary) {
    return {
      averageSpo2: null,
      averageBpm: null,
      minimumSpo2: null,
      minimumBpm: null,
      maximumSpo2: null,
      maximumBpm: null,
      totalReadings: 0,
    };
  }

  return {
    averageSpo2: summary.averageSpo2 ? Number(summary.averageSpo2.toFixed(1)) : null,
    averageBpm: summary.averageBpm ? Number(summary.averageBpm.toFixed(1)) : null,
    minimumSpo2: summary.minimumSpo2,
    minimumBpm: summary.minimumBpm,
    maximumSpo2: summary.maximumSpo2,
    maximumBpm: summary.maximumBpm,
    totalReadings: summary.totalReadings,
  };
};

const getPatientDashboard = async (patientId, range = "day") => {
  const [latestReading, series, summary, openAlertCount, relations, device] =
    await Promise.all([
      Reading.findOne({ patient: patientId }).sort({ timestamp: -1 }).lean(),
      getTrendSeries(patientId, range),
      getSummary(patientId, range),
      Alert.countDocuments({ patient: patientId, status: "open" }),
      DoctorPatient.find({
        patient: patientId,
        status: { $in: ["active", "pending", "denied"] },
      })
        .sort({ updatedAt: -1, assignedAt: -1, requestedAt: -1, respondedAt: -1 })
        .populate("doctor", "name email specialty")
        .lean(),
      Device.findOne({ patient: patientId }).select("-deviceSecretId").lean(),
    ]);

  const activeRelations = relations.filter((relation) => relation.status === "active");
  const pendingRelations = relations.filter((relation) => relation.status === "pending");
  const deniedRelation =
    relations.find((relation) => relation.status === "denied") || null;
  const lastModified = getLatestDate(
    latestReading?.timestamp,
    latestReading?.updatedAt,
    relations.map((relation) => relation.updatedAt || relation.respondedAt),
    device?.updatedAt,
    device?.lastSeenAt
  );

  return {
    latestReading,
    series,
    summary,
    openAlertCount,
    lastModified,
    activeDoctor: activeRelations[0]?.doctor || null,
    careTeam: {
      active: activeRelations.map(serializeRelation),
      pending: pendingRelations.map(serializeRelation),
      lastDenied: serializeRelation(deniedRelation),
    },
    device: device
      ? {
          id: device._id,
          label: device.label,
          isActive: device.isActive,
          lastSeenAt: device.lastSeenAt,
        }
      : null,
  };
};

const getReadingFeed = async (patientId, range = "day") => {
  const { start, end } = getRangeBounds(range);
  const [series, latestReading, summary] = await Promise.all([
    getTrendSeries(patientId, range),
    Reading.findOne({
      patient: patientId,
      timestamp: { $gte: start, $lte: end },
    })
      .sort({ timestamp: -1 })
      .lean(),
    getSummary(patientId, range),
  ]);

  return {
    latestReading,
    lastModified: getLatestDate(latestReading?.timestamp, latestReading?.updatedAt),
    summary,
    series,
    range,
  };
};

module.exports = {
  getPatientDashboard,
  getReadingFeed,
};
