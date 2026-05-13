const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatConversation",
      required: true,
      index: true,
    },
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DoctorPatient",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    senderRole: {
      type: String,
      enum: ["patient", "doctor"],
      required: true,
      index: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recipientRole: {
      type: String,
      enum: ["patient", "doctor"],
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["text", "image", "audio", "file"],
      default: "text",
    },
    body: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    attachment: {
      storedName: {
        type: String,
        trim: true,
        default: "",
      },
      cloudinaryUrl: {
        type: String,
        trim: true,
        default: "",
      },
      originalName: {
        type: String,
        trim: true,
        default: "",
      },
      mimeType: {
        type: String,
        trim: true,
        default: "",
      },
      sizeBytes: {
        type: Number,
        min: 0,
        default: 0,
      },
      extension: {
        type: String,
        trim: true,
        default: "",
      },
    },
    readAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

chatMessageSchema.index({ conversation: 1, createdAt: -1, _id: -1 });
chatMessageSchema.index({ recipient: 1, readAt: 1, createdAt: -1 });

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
