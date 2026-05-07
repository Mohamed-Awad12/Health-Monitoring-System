const env = require("../config/env");

let warnedAboutMissingWebhook = false;
let warnedAboutDisabledEmails = false;

const ALERT_TYPE_LABELS = {
  spo2_low: "Low oxygen saturation",
  bpm_low: "Low heart rate",
  bpm_high: "High heart rate",
};

const parseBoolean = (value, fallback) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }

    if (["0", "false", "no", "off"].includes(normalized)) {
      return false;
    }
  }

  return fallback;
};

const emailsEnabled = () => parseBoolean(env.EMAIL_ALERTS_ENABLED, true);

const getWebhookHeaders = () => {
  const headers = {
    "Content-Type": "application/json",
  };
  const authHeader = String(env.EMAIL_WEBHOOK_AUTH_HEADER || "").trim();
  const authValue = String(env.EMAIL_WEBHOOK_AUTH_VALUE || "").trim();

  if (authHeader && authValue) {
    headers[authHeader] = authValue;
  }

  return headers;
};

const isEmailDeliveryAvailable = () => {
  if (!emailsEnabled()) {
    if (!warnedAboutDisabledEmails) {
      // eslint-disable-next-line no-console
      console.warn("Email notifications are disabled via EMAIL_ALERTS_ENABLED.");
      warnedAboutDisabledEmails = true;
    }

    return false;
  }

  if (!env.EMAIL_WEBHOOK_URL) {
    if (!warnedAboutMissingWebhook) {
      // eslint-disable-next-line no-console
      console.warn("EMAIL_WEBHOOK_URL is not configured; email delivery is skipped.");
      warnedAboutMissingWebhook = true;
    }

    return false;
  }

  return true;
};

const postToEmailWebhook = async ({ email, payload, logLabel }) => {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    env.EMAIL_WEBHOOK_TIMEOUT_MS
  );

  try {
    const response = await fetch(env.EMAIL_WEBHOOK_URL, {
      method: "POST",
      headers: getWebhookHeaders(),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const responseBody = (await response.text()).slice(0, 500);

      // eslint-disable-next-line no-console
      console.error(`Failed to send email webhook for ${logLabel || email}:`, {
        status: response.status,
        statusText: response.statusText,
        body: responseBody || undefined,
      });
      return false;
    }

    return true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Failed to send email webhook for ${logLabel || email}:`, {
      name: error?.name,
      message: error?.message || String(error),
    });
    return false;
  } finally {
    clearTimeout(timeout);
  }
};

const sendOtpEmail = async ({ email, otp }) => {
  if (!email || !otp || !isEmailDeliveryAvailable()) {
    return false;
  }

  return postToEmailWebhook({
    email,
    payload: {
      email,
      otp,
    },
    logLabel: `otp:${email}`,
  });
};

const sendAlertEmail = async ({ email, subject, text }) => {
  if (!email || !subject || !text || !isEmailDeliveryAvailable()) {
    return false;
  }

  return postToEmailWebhook({
    email,
    payload: {
      email,
      subject,
      text,
      type: "alert",
    },
    logLabel: `alert:${email}`,
  });
};

const sendEmailVerificationMessage = async ({ user, otp }) => {
  if (!user?.email || !otp) {
    return false;
  }

  return sendOtpEmail({
    email: user.email,
    otp,
  });
};

const sendPasswordResetEmail = async ({ user, otp }) => {
  if (!user?.email || !otp) {
    return false;
  }

  return sendOtpEmail({
    email: user.email,
    otp,
  });
};

const buildRecipientList = ({ patient, doctors }) => {
  const recipients = new Map();

  const addRecipient = (recipient, role) => {
    if (!recipient?.email || !recipient.emailVerified) {
      return;
    }

    const normalizedEmail = recipient.email.trim().toLowerCase();

    if (!normalizedEmail || recipients.has(normalizedEmail)) {
      return;
    }

    recipients.set(normalizedEmail, {
      email: normalizedEmail,
      name: recipient.name || "User",
      role,
    });
  };

  addRecipient(patient, "patient");
  doctors.forEach((doctor) => addRecipient(doctor, "doctor"));

  return Array.from(recipients.values());
};

const sendAlertEmailsToCareTeam = async ({ alert, reading, patient, doctors = [] }) => {
  if (!alert || !patient) {
    return {
      attempted: 0,
      sent: 0,
    };
  }

  const recipients = buildRecipientList({ patient, doctors });

  if (!recipients.length) {
    return {
      attempted: 0,
      sent: 0,
    };
  }

  const alertTypeLabel = ALERT_TYPE_LABELS[alert.type] || "Vital sign";
  const eventTimestamp = new Date(reading?.timestamp || alert.createdAt || new Date())
    .toISOString();

  const subject = `[Pulse Oximeter] ${alertTypeLabel} alert for ${patient.name || "patient"}`;

  const results = await Promise.all(
    recipients.map((recipient) => {
      const text = [
        `Hello ${recipient.name},`,
        "",
        `An alert was triggered for patient ${patient.name || "Unknown"}.`,
        `Alert type: ${alertTypeLabel}`,
        `Severity: ${alert.severity}`,
        `Message: ${alert.message}`,
        `SpO2: ${alert.metrics?.spo2 ?? reading?.spo2 ?? "N/A"}%`,
        `BPM: ${alert.metrics?.bpm ?? reading?.bpm ?? "N/A"}`,
        `Timestamp: ${eventTimestamp}`,
        "",
        "Please review the dashboard for full details.",
      ].join("\n");

      return sendAlertEmail({
        email: recipient.email,
        subject,
        text,
      });
    })
  );

  return {
    attempted: recipients.length,
    sent: results.filter(Boolean).length,
  };
};

module.exports = {
  sendOtpEmail,
  sendEmailVerificationMessage,
  sendPasswordResetEmail,
  sendAlertEmailsToCareTeam,
};
