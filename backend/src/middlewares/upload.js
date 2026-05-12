const fs = require("fs");
const path = require("path");
const multer = require("multer");
const ApiError = require("../utils/ApiError");

const uploadRoot = path.resolve(__dirname, "../../uploads");
const doctorVerificationDir = path.join(uploadRoot, "doctor-verifications");
const chatAttachmentsDir = path.join(uploadRoot, "chat-attachments");

const ensureUploadDirectory = (targetDir) => {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
};

const sanitizeFileBaseName = (fileName) =>
  fileName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);

const doctorVerificationStorage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    ensureUploadDirectory(doctorVerificationDir);
    callback(null, doctorVerificationDir);
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const baseName = sanitizeFileBaseName(path.basename(file.originalname, extension) || "doc");
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    callback(null, `${baseName}-${uniqueSuffix}${extension}`);
  },
});

const chatAttachmentStorage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    ensureUploadDirectory(chatAttachmentsDir);
    callback(null, chatAttachmentsDir);
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const baseName = sanitizeFileBaseName(path.basename(file.originalname, extension) || "chat");
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    callback(null, `${baseName}-${uniqueSuffix}${extension}`);
  },
});

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
  doctorVerificationDir,
  chatAttachmentUpload,
  chatAttachmentsDir,
};
