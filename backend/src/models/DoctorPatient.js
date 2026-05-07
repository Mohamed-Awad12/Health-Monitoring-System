const mongoose = require("mongoose");

const doctorPatientSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "active", "denied", "ended"],
      default: "pending",
      index: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
    assignedAt: {
      type: Date,
      default: null,
      index: true,
    },
    endedAt: {
      type: Date,
      default: null,
      index: true,
    },
    thresholds: {
      lowSpo2: {
        type: Number,
        min: 50,
        max: 100,
        default: null,
      },
      lowBpm: {
        type: Number,
        min: 10,
        max: 300,
        default: null,
      },
      highBpm: {
        type: Number,
        min: 10,
        max: 300,
        default: null,
      },
    },
  },
  { timestamps: true }
);

doctorPatientSchema.index({ doctor: 1, patient: 1 }, { unique: true });
doctorPatientSchema.index({ patient: 1, status: 1, updatedAt: -1 });
doctorPatientSchema.index({ doctor: 1, status: 1, updatedAt: -1 });

module.exports = mongoose.model("DoctorPatient", doctorPatientSchema);
