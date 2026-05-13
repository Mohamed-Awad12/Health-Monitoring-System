const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;
const ApiError = require("../utils/ApiError");
const env = require("../config/env");

if (env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
}

const allowedDocumentMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const allowedChatAttachmentMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "audio/aac",
  "audio/m4a",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/wave",
  "audio/webm",
  "audio/x-m4a",
  "audio/x-wav",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "text/plain",
]);

const getResourceType = (mimetype) => {
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("audio/") || mimetype.startsWith("video/")) return "video";
  return "raw";
};

const doctorVerificationStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: "doctor-verifications",
      resource_type: "raw", 
      format: file.originalname.split('.').pop().toLowerCase()
    };
  },
});

const chatAttachmentStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const isImage = file.mimetype.startsWith("image/");
    const isAudio = file.mimetype.startsWith("audio/") || file.mimetype.startsWith("video/");
    const resource_type = isAudio ? "video" : (isImage ? "image" : "raw");

    const params = {
      folder: "chat-attachments",
      resource_type: resource_type,
    };
    
    if (resource_type === "raw" || resource_type === "video") {
      params.format = file.originalname.split('.').pop().toLowerCase() || "webm";
    }

    return params;
  },
});

const doctorVerificationUpload = multer({
  storage: doctorVerificationStorage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedDocumentMimeTypes.has(file.mimetype)) {
      callback(
        new ApiError(
          400,
          "Unsupported document format. Use PDF, JPEG, PNG, or WEBP."
        )
      );
      return;
    }
    callback(null, true);
  },
});

const chatAttachmentUpload = multer({
  storage: chatAttachmentStorage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedChatAttachmentMimeTypes.has(file.mimetype)) {
      callback(
        new ApiError(
          400,
          "Unsupported attachment format. Use images, audio, PDF, text, Word, Excel, or ZIP files."
        )
      );
      return;
    }
    callback(null, true);
  },
});

module.exports = {
  doctorVerificationUpload,
  doctorVerificationDir: "",
  chatAttachmentUpload,
  chatAttachmentsDir: "",
};
