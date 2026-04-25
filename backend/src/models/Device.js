const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema(
  {
    deviceSecretId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      select: false,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    label: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastSeenAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Device", deviceSchema);
