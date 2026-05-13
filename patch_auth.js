const fs = require('fs');
const file = 'backend/src/controllers/authController.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/documentFileName: req.file.filename,/, `documentFileName: req.file.filename,\n            documentUrl: req.file.path,`);

fs.writeFileSync(file, content, 'utf8');
