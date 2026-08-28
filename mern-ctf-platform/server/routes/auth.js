import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { generateToken } from '../utils/jwt.js';
import { validateCaptcha } from '../middleware/captcha.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

router.post('/signup', validateCaptcha, async (req, res) => {
  try {
    const { member_id, full_name, username, email, password, session } = req.body;

    const errors = {};
    if (!member_id) errors.member_id = 'Member ID is required.';
    if (!full_name) errors.full_name = 'Full name is required.';
    else if (full_name.length > 100) errors.full_name = 'Full name must be under 100 characters.';
    if (!username || username.length < 3) errors.username = 'Username must be at least 3 characters.';
    else if (username.length > 30) errors.username = 'Username must be under 30 characters.';
    if (!email) errors.email = 'Email is required.';
    else if (email.length > 100) errors.email = 'Email must be under 100 characters.';
    if (!password) errors.password = 'Password is required.';
    else if (password.length < 8) errors.password = 'Password must be at least 8 characters.';
    else if (!/[A-Z]/.test(password)) errors.password = 'Password must contain an uppercase letter.';
    else if (!/[a-z]/.test(password)) errors.password = 'Password must contain a lowercase letter.';
    else if (!/[0-9]/.test(password)) errors.password = 'Password must contain a number.';
    if (!session) errors.session = 'Session is required.';

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ success: false, errors: { email: 'This email is already registered.' } });
    }

    const existingUsername = await User.findOne({ user_name: username });
    if (existingUsername) {
      return res.status(400).json({ success: false, errors: { username: 'This username is already taken.' } });
    }

    const user = await User.create({
      member_id,
      full_name,
      user_name: username,
      email,
      password,
      session,
      role: 1,
      status: 0,
    });

    res.json({ success: true, message: 'Signup successful. Redirecting to login...' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error during signup.' });
  }
});

router.post('/login', validateCaptcha, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Please provide both email and password.' });
    }

    const user = await User.findOne({ email });

    // Constant-time comparison: always run bcrypt to prevent user enumeration
    let isMatch = false;
    let userStatus = null;
    if (user) {
      isMatch = await user.comparePassword(password);
      userStatus = user.status;
    } else {
      // Compare against dummy hash to normalize timing
      const dummyHash = '$2b$12$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ12';
      await bcrypt.compare(password, dummyHash);
    }

    if (!user || !isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    if (userStatus === 0) {
      return res.status(403).json({
        success: false,
        error: 'Your account is pending approval. Please wait or contact the club executives for assistance.',
      });
    }

    if (userStatus === 2) {
      return res.status(403).json({
        success: false,
        error: 'Your account has been deactivated. Contact support.',
      });
    }

    const token = generateToken(user);

    res.cookie('admintoken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 72 * 60 * 60 * 1000,
      path: '/',
    });

    res.json({ success: true, role: user.role });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error during login.' });
  }
});

router.post('/refresh', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.user_id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const token = generateToken(user);

    res.cookie('admintoken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 72 * 60 * 60 * 1000,
      path: '/',
    });

    res.json({ success: true, role: user.role });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Token refresh failed.' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email is required.' });

    const user = await User.findOne({ email });
    // Don't reveal whether email exists
    if (!user) return res.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });

    const crypto = (await import('crypto')).default;
    const token = crypto.randomBytes(32).toString('hex');
    user.reset_password_token = token;
    user.reset_password_expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const PlatformStatus = (await import('../models/PlatformStatus.js')).default;
    const status = await PlatformStatus.findById('000000000000000000000001');
    if (!status || !status.smtp_host || !status.smtp_user || !status.smtp_pass) {
      return res.status(400).json({ success: false, error: 'SMTP not configured. Contact the administrator.' });
    }

    const nodemailer = (await import('nodemailer')).default;
    const transporter = nodemailer.createTransport({
      host: status.smtp_host,
      port: status.smtp_port,
      secure: status.smtp_secure,
      auth: { user: status.smtp_user, pass: status.smtp_pass },
    });

    const fromName = status.smtp_from_name || 'JKKNIU CTF';
    const fromEmail = status.smtp_from_email || status.smtp_user;
    const resetUrl = `${process.env.CLIENT_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000'}/reset-password/${token}`;

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: user.email,
      subject: 'Password Reset - JKKNIU CTF',
      html: `<p>Hello ${user.full_name},</p><p>You requested a password reset.</p><p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 1 hour.</p><p>If you didn't request this, ignore this email.</p>`,
    });

    res.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.post('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 8) return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });

    const user = await User.findOne({
      reset_password_token: token,
      reset_password_expires: { $gt: new Date() },
    });

    if (!user) return res.status(400).json({ success: false, error: 'Reset token is invalid or expired.' });

    user.password = password;
    user.reset_password_token = null;
    user.reset_password_expires = null;
    await user.save();

    res.json({ success: true, message: 'Password has been reset. You can now log in.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('admintoken', { path: '/' });
  res.json({ success: true, message: 'Logged out successfully.' });
});

router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.user_id).select('-session');
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

export default router;
