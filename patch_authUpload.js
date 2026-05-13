const fs = require('fs');
const file = 'backend/src/middlewares/upload.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/const doctorVerificationStorage = new CloudinaryStorage\(\{[\s\S]*?\}\);/, `const doctorVerificationStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: "doctor-verifications",
      resource_type: "raw", 
      format: file.originalname.split('.').pop().toLowerCase()
    };
  },
});`);

content = content.replace(/const chatAttachmentStorage = new CloudinaryStorage\(\{[\s\S]*?\}\);/, `const chatAttachmentStorage = new CloudinaryStorage({
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
});`);

fs.writeFileSync(file, content, 'utf8');
