import svgCaptcha from 'svg-captcha';
import crypto from 'crypto';

const captchaStore = new Map();
const MAX_SIZE = 1000;
const EXPIRY_MS = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of captchaStore) {
    if (now - val.timestamp > EXPIRY_MS) captchaStore.delete(key);
  }
}, 60 * 1000);

export const generateCaptcha = (req, res) => {
  if (captchaStore.size >= MAX_SIZE) {
    return res.status(429).json({ success: false, error: 'Too many CAPTCHA requests.' });
  }

  const captcha = svgCaptcha.create({
    size: 6,
    ignoreChars: '0o1iIl',
    noise: 3,
    color: true,
    background: '#0d0d0d',
  });

  const id = crypto.randomUUID();
  captchaStore.set(id, { text: captcha.text.toUpperCase(), timestamp: Date.now() });

  res.json({ success: true, captchaId: id, svg: captcha.data });
};

export const validateCaptcha = (req, res, next) => {
  const { captchaId, captchaText } = req.body;

  if (!captchaId || !captchaText) {
    return res.status(400).json({ success: false, error: 'CAPTCHA is required.' });
  }

  const stored = captchaStore.get(captchaId);
  if (!stored) {
    return res.status(400).json({ success: false, error: 'CAPTCHA expired. Please refresh.' });
  }

  captchaStore.delete(captchaId);

  if (stored.text !== captchaText.toUpperCase()) {
    return res.status(400).json({ success: false, error: 'CAPTCHA verification failed.' });
  }

  next();
};
