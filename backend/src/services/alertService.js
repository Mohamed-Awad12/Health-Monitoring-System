const env = require("../config/env");
const Alert = require("../models/Alert");

const ALERT_DEDUP_MS = 5 * 60 * 1000;

const buildAlertDefinitions = (reading) => {
  const definitions = [];

  if (reading.spo2 < env.PATIENT_LOW_SPO2_THRESHOLD) {
    definitions.push({
      type: "spo2_low",
      severity: "critical",
      message: `Critical oxygen saturation detected (${reading.spo2}%).`,
    });
  }

  if (reading.bpm < env.PATIENT_LOW_BPM_THRESHOLD) {
    definitions.push({
      type: "bpm_low",
      severity: "warning",
      message: `Low heart rate detected (${reading.bpm} BPM).`,
    });
  }

  if (reading.bpm > env.PATIENT_HIGH_BPM_THRESHOLD) {
    definitions.push({
      type: "bpm_high",
      severity: "warning",
      message: `High heart rate detected (${reading.bpm} BPM).`,
    });
  }

  return definitions;
};

const evaluateReadingAlerts = async (reading) => {
  const alertDefinitions = buildAlertDefinitions(reading);

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

  return Alert.insertMany(alertPayloads);
};

module.exports = {
  evaluateReadingAlerts,
};
