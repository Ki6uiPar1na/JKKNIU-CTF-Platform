import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import mongoSanitize from 'express-mongo-sanitize';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { seedPlatformStatus, seedDefaultContest } from './utils/seed.js';
import { connectRedis } from './utils/redis.js';
import authRoutes from './routes/auth.js';
import challengeRoutes from './routes/challenges.js';
import submissionRoutes from './routes/submissions.js';
import scoreboardRoutes from './routes/scoreboard.js';
import userRoutes from './routes/users.js';
import adminRoutes from './routes/admin.js';
import contestRoutes from './routes/contests.js';
import teamRoutes from './routes/teams.js';
import PlatformStatus from './models/PlatformStatus.js';

dotenv.config();

const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`FATAL: ${key} is not set.`);
    process.exit(1);
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    },
  },
}));
app.use(cors({
  origin: process.env.CLIENT_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(mongoSanitize());

const skipIfAdmin = (req) => {
  try {
    const token = req.cookies?.admintoken || req.headers.authorization?.replace('Bearer ', '');
    if (!token) return false;
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    return decoded.role === 0 || decoded.role === 2;
  } catch { return false; }
};

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many requests, try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/auth/refresh', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

const submitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, submission_type: 'blank', message: 'Too many submissions. Slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipIfAdmin,
});
app.use('/api/submissions/submit', submitLimiter);
app.use('/api/contests/:id/submit', submitLimiter);

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { success: false, error: 'Too many requests, try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipIfAdmin,
});
app.use('/api/users/password', generalLimiter);
app.use('/api/users/profile', generalLimiter);
app.use('/api/contests/:id/pre-register', generalLimiter);
app.use('/api/contests/:contestId/teams', generalLimiter);

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { success: false, error: 'Too many requests, try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipIfAdmin,
});
app.use('/api/admin', adminLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/scoreboard', scoreboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contests', contestRoutes);
app.use('/api/contests', teamRoutes);
app.use('/api/captcha', (await import('./middleware/captcha.js')).generateCaptcha);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'OK' });
});

app.get('/api/time', (req, res) => {
  res.json({ serverTime: Date.now() });
});

app.get('/api/platform/info', async (req, res) => {
  try {
    const status = await PlatformStatus.findById('000000000000000000000001').select('platform_name logo_url');
    if (!status) return res.json({ success: true, platform_name: 'CTF Platform', logo_url: null });
    res.json({ success: true, platform_name: status.platform_name, logo_url: status.logo_url });
  } catch { res.json({ success: true, platform_name: 'CTF Platform', logo_url: null }); }
});



const uploadsPath = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsPath));

const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuildPath));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  }
});

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    await connectRedis();
    console.log('Connected to Redis');
    await seedPlatformStatus();
    await seedDefaultContest();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
