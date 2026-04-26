const nodemailer = require("nodemailer");
const env = require("../config/env");

let transporter;
let transporterReady = false;
let warnedAboutMissingSmtp = false;
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

const smtpSecureEnabled = () => parseBoolean(env.SMTP_SECURE, false);

const isSmtpConfigured = () =>
  Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

const getFromAddress = () => {
  const configuredFrom = String(env.EMAIL_FROM || "").trim();

  if (!configuredFrom) {
    return env.SMTP_USER || "no-reply@pulse-oximeter.local";
  }

  if (!configuredFrom.includes("@") && env.SMTP_USER) {
    return `"${configuredFrom}" <${env.SMTP_USER}>`;
  }

  return configuredFrom;
};

const getTransporter = async () => {
  if (!isSmtpConfigured()) {
    if (!warnedAboutMissingSmtp) {
      // eslint-disable-next-line no-console
      console.warn("SMTP is not configured; email delivery is simulated.");
      warnedAboutMissingSmtp = true;
    }

    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: smtpSecureEnabled(),
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }

  if (!transporterReady) {
    await transporter.verify();
    transporterReady = true;

    // eslint-disable-next-line no-console
    console.log("SMTP connection verified.");
  }

  return transporter;
};

const sendEmail = async ({ to, subject, text }) => {
  if (!emailsEnabled()) {
    if (!warnedAboutDisabledEmails) {
      // eslint-disable-next-line no-console
      console.warn("Email notifications are disabled via EMAIL_ALERTS_ENABLED.");
      warnedAboutDisabledEmails = true;
    }

    return false;
  }

  if (!to) {
    return false;
  }

  try {
    const transporterInstance = await getTransporter();

    if (!transporterInstance) {
      // Simulate sending email
      console.warn("   => SIMULATED EMAIL CONTENT:\n   To: " + to + "\n   Subject: " + subject + "\n   Body:\n" + text);
      return true;
    }

    await transporterInstance.sendMail({
      from: getFromAddress(),
      to,
      subject,
      text,
    });

    return true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Failed to send email to ${to}:`, error.message || error);
    return false;
  }
};

const sendEmailVerificationMessage = async ({ user, otp }) => {
  if (!user?.email || !otp) {
    return false;
  }

  const subject = "Your Pulse Oximeter verification OTP";
  const text = [
    `Hello ${user.name || "there"},`,
    "",
    "Use this one-time password (OTP) to verify your email address:",
    `OTP: ${otp}`,
    `This OTP expires in ${env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES} minutes.`,
    "",
    "If you did not create this account, you can ignore this message.",
  ].join("\n");

  return sendEmail({
    to: user.email,
    subject,
    text,
  });
};

const sendPasswordResetEmail = async ({ user, otp }) => {
  if (!user?.email || !otp) {
    return false;
  }

  const subject = "Your Pulse Oximeter password reset OTP";
  const text = [
    `Hello ${user.name || "there"},`,
    "",
    "We received a request to reset your password.",
    "Use this one-time password (OTP) to reset your password:",
    `OTP: ${otp}`,
    `This OTP expires in ${env.PASSWORD_RESET_OTP_TTL_MINUTES} minutes.`,
    "",
    "If you did not request this, you can ignore this message.",
  ].join("\n");

  return sendEmail({
    to: user.email,
    subject,
    text,
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

      return sendEmail({
        to: recipient.email,
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
  sendEmailVerificationMessage,
  sendPasswordResetEmail,
  sendAlertEmailsToCareTeam,
};
