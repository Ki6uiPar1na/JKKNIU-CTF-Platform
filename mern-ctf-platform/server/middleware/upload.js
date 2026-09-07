import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', 'uploads', 'banners');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Only image files (jpg, png, gif, webp) are allowed.'), false);
};

export const uploadBanner = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('banner');

const challengeDir = path.join(__dirname, '..', 'uploads', 'challenges');

if (!fs.existsSync(challengeDir)) {
  fs.mkdirSync(challengeDir, { recursive: true });
}

function sanitizeFilename(original) {
  const base = path.basename(original);
  const ext = path.extname(base);
  const name = path.basename(base, ext)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 100);
  const prefix = crypto.randomBytes(4).toString('hex');
  return `${prefix}-${name}${ext}`;
}

const challengeStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, challengeDir),
  filename: (req, file, cb) => {
    cb(null, sanitizeFilename(file.originalname));
  },
});

const challengeFileFilter = (req, file, cb) => {
  cb(null, true);
};

export const uploadChallengeFile = multer({
  storage: challengeStorage,
  fileFilter: challengeFileFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
}).single('file');
