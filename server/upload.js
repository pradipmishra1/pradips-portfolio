// ═══════════════════════════════════════════════════════════════
// UPLOADS — multer for receiving files, sharp for optimizing them.
// This directly fixes "laggy" complaints caused by raw, oversized
// phone-camera-sized JPEGs being served at full resolution.
// ═══════════════════════════════════════════════════════════════
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Store in memory first, then process with sharp before writing to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 }, // 12MB raw upload cap
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    cb(ok ? null : new Error('Only JPG, PNG, or WEBP images are allowed'), ok);
  },
});

// Resize/compress and save as webp — much smaller, fixes load lag
async function processAndSave(buffer, { maxWidth = 1600 } = {}) {
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.webp`;
  const filepath = path.join(UPLOAD_DIR, filename);

  await sharp(buffer)
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(filepath);

  return filename;
}

module.exports = { upload, processAndSave, UPLOAD_DIR };
