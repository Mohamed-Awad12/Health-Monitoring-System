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
  },
  { timestamps: true }
);

doctorPatientSchema.index({ doctor: 1, patient: 1 }, { unique: true });

module.exports = mongoose.model("DoctorPatient", doctorPatientSchema);
