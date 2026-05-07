const env = require("../config/env");
const Alert = require("../models/Alert");
const DoctorPatient = require("../models/DoctorPatient");
const pushNotificationService = require("./pushNotificationService");
const { logSecurityEvent } = require("./securityEventLogger");

const ALERT_DEDUP_MS = env.ALERT_DEDUP_MINUTES * 60 * 1000;

const pickThreshold = (values, fallback, reducer) => {
  const customValues = values.filter((value) => Number.isFinite(value));

  if (!customValues.length) {
    return fallback;
  }

  return reducer(...customValues);
};

const getPatientAlertThresholds = async (patientId) => {
  const relations = await DoctorPatient.find({
    patient: patientId,
    status: "active",
  })
    .select("thresholds")
    .lean();

  return {
    lowSpo2: pickThreshold(
      relations.map((relation) => relation.thresholds?.lowSpo2),
      env.PATIENT_LOW_SPO2_THRESHOLD,
      Math.min
    ),
    lowBpm: pickThreshold(
      relations.map((relation) => relation.thresholds?.lowBpm),
      env.PATIENT_LOW_BPM_THRESHOLD,
      Math.min
    ),
    highBpm: pickThreshold(
      relations.map((relation) => relation.thresholds?.highBpm),
      env.PATIENT_HIGH_BPM_THRESHOLD,
      Math.max
    ),
  };
};

const buildAlertDefinitions = (reading, thresholds) => {
  const definitions = [];

  if (reading.spo2 < thresholds.lowSpo2) {
    definitions.push({
      type: "spo2_low",
      severity: "critical",
      message: `Critical oxygen saturation detected (${reading.spo2}%).`,
    });
  }

  if (reading.bpm < thresholds.lowBpm) {
    definitions.push({
      type: "bpm_low",
      severity: "warning",
      message: `Low heart rate detected (${reading.bpm} BPM).`,
    });
  }

  if (reading.bpm > thresholds.highBpm) {
    definitions.push({
      type: "bpm_high",
      severity: "warning",
      message: `High heart rate detected (${reading.bpm} BPM).`,
    });
  }

  return definitions;
};

const evaluateReadingAlerts = async (reading) => {
  const thresholds = await getPatientAlertThresholds(reading.patient);
  const alertDefinitions = buildAlertDefinitions(reading, thresholds);

  if (!alertDefinitions.length) {
    return [];
  }

  const dedupeCutoff = new Date(Date.now() - ALERT_DEDUP_MS);
  const checks = await Promise.all(
    alertDefinitions.map((definition) =>
      Alert.findOne({
        patient: reading.patient,
        type: definition.type,
        status: "open",
        createdAt: { $gte: dedupeCutoff },
      }).lean()
    )
  );

  const alertPayloads = alertDefinitions
    .filter((_definition, index) => !checks[index])
    .map((definition) => ({
      patient: reading.patient,
      reading: reading._id,
      type: definition.type,
      severity: definition.severity,
      message: definition.message,
      metrics: {
        spo2: reading.spo2,
        bpm: reading.bpm,
      },
    }));

  if (!alertPayloads.length) {
    return [];
  }

  const createdAlerts = await Alert.insertMany(alertPayloads);

  notifyAlertRecipients(createdAlerts, reading).catch((error) => {
    logSecurityEvent({
      severity: "warning",
      type: "push_notification_alert_dispatch_failed",
      details: {
        message: error?.message || String(error),
      },
    });
  });

  return createdAlerts;
};

const notifyAlertRecipients = async (alerts, reading) => {
  const careTeam = await DoctorPatient.find({
    patient: reading.patient,
    status: "active",
  })
    .select("doctor")
    .lean();
  const doctorIds = careTeam.map((relation) => relation.doctor).filter(Boolean);

  await Promise.allSettled(
    alerts.flatMap((alert) => {
      const payload = {
        title: "Pulse alert",
        body: alert.message,
        type: "alert",
        alertId: alert._id,
        patientId: alert.patient,
        createdAt: alert.createdAt,
      };

      return [
        pushNotificationService.sendToUser(alert.patient, payload),
        ...doctorIds.map((doctorId) =>
          pushNotificationService.sendToUser(doctorId, payload)
        ),
      ];
    })
  );
};

module.exports = {
  evaluateReadingAlerts,
  getPatientAlertThresholds,
};
