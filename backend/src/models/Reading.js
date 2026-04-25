const mongoose = require("mongoose");

const readingSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    device: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Device",
      required: true,
      index: true,
    },
    spo2: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    bpm: {
      type: Number,
      required: true,
      min: 0,
      max: 250,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    source: {
      type: String,
      default: "device",
    },
  },
  { timestamps: true }
);

readingSchema.index({ patient: 1, timestamp: -1 });
readingSchema.index({ device: 1, timestamp: -1 });

module.exports = mongoose.model("Reading", readingSchema);
