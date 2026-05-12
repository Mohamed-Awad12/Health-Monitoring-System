const mongoose = require("mongoose");

const chatConversationSchema = new mongoose.Schema(
  {
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DoctorPatient",
      required: true,
      unique: true,
      index: true,
    },
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
      enum: ["active", "archived"],
      default: "active",
      index: true,
    },
    lastMessage: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ChatMessage",
        default: null,
      },
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      senderRole: {
        type: String,
        enum: ["patient", "doctor"],
        default: null,
      },
      bodyPreview: {
        type: String,
        trim: true,
        maxlength: 240,
        default: "",
      },
      type: {
        type: String,
        enum: ["text"],
        default: "text",
      },
      sentAt: {
        type: Date,
        default: null,
      },
    },
    unreadCounts: {
      patient: {
        type: Number,
        min: 0,
        default: 0,
      },
      doctor: {
        type: Number,
        min: 0,
        default: 0,
      },
    },
    lastReadAt: {
      patient: {
        type: Date,
        default: null,
      },
      doctor: {
        type: Date,
        default: null,
      },
    },
    archivedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

chatConversationSchema.index({ doctor: 1, status: 1, updatedAt: -1 });
chatConversationSchema.index({ patient: 1, status: 1, updatedAt: -1 });

module.exports = mongoose.model("ChatConversation", chatConversationSchema);
