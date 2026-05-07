const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reading: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reading",
      required: true,
    },
    type: {
      type: String,
      enum: ["spo2_low", "bpm_low", "bpm_high"],
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ["warning", "critical"],
      default: "critical",
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    metrics: {
      spo2: Number,
      bpm: Number,
    },
    status: {
      type: String,
      enum: ["open", "acknowledged"],
      default: "open",
      index: true,
    },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
    doctorNote: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    notedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

alertSchema.index({ patient: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("Alert", alertSchema);
