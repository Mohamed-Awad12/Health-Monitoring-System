const fs = require("fs");
const path = require("path");
const multer = require("multer");
const ApiError = require("../utils/ApiError");

const uploadRoot = path.resolve(__dirname, "../../uploads");
const doctorVerificationDir = path.join(uploadRoot, "doctor-verifications");

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

const allowedDocumentMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
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

module.exports = {
  doctorVerificationUpload,
  doctorVerificationDir,
};
