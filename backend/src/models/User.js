const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { ROLES } = require("../constants/roles");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    emailVerificationTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    passwordResetTokenHash: {
      type: String,
      select: false,
    },
    passwordResetExpiresAt: {
      type: Date,
      select: false,
    },
    emailVerificationExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      required: true,
      index: true,
    },
    specialty: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 25,
    },
    doctorVerification: {
      status: {
        type: String,
        enum: ["not_submitted", "pending", "approved", "rejected"],
        default: function doctorVerificationStatusDefault() {
          return this.role === ROLES.DOCTOR ? "pending" : "not_submitted";
        },
        index: true,
      },
      documentFileName: {
        type: String,
        trim: true,
        maxlength: 255,
      },
      documentOriginalName: {
        type: String,
        trim: true,
        maxlength: 255,
      },
      documentMimeType: {
        type: String,
        trim: true,
        maxlength: 120,
      },
      documentSize: {
        type: Number,
        min: 0,
      },
      documentUploadedAt: {
        type: Date,
      },
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      reviewedAt: {
        type: Date,
      },
      reviewNote: {
        type: String,
        trim: true,
        maxlength: 300,
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.password;
        delete ret.emailVerificationTokenHash;
        delete ret.emailVerificationExpiresAt;
        delete ret.passwordResetTokenHash;
        delete ret.passwordResetExpiresAt;
        return ret;
      },
    },
  }
);

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) {
    return next();
  }

  this.password = await bcrypt.hash(this.password, 12);
  return next();
});

userSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.index({ role: 1, name: 1 });
userSchema.index({ role: 1, "doctorVerification.status": 1, createdAt: -1 });

module.exports = mongoose.model("User", userSchema);
