const mongoose = require("mongoose");
const crypto = require("crypto");

const hashDeviceSecret = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");

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

deviceSchema.index({ patient: 1, updatedAt: -1 });
deviceSchema.index({ patient: 1, isActive: 1 });

deviceSchema.statics.hashSecret = hashDeviceSecret;

deviceSchema.statics.secretLookupFilter = function secretLookupFilter(secret) {
  const normalizedSecret = String(secret || "").trim();

  return {
    deviceSecretId: {
      $in: [normalizedSecret, hashDeviceSecret(normalizedSecret)],
    },
  };
};

module.exports = mongoose.model("Device", deviceSchema);
