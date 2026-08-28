import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const verifyToken = async (req, res, next) => {
  const token = req.cookies?.admintoken || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    req.user = decoded;

    // Verify user still exists and is active
    try {
      const user = await User.findById(decoded.user_id).select('status');
      if (!user || user.status === 2) {
        return res.status(403).json({ success: false, error: 'Account deactivated.' });
      }
    } catch {
      // DB unavailable — fall back to JWT-only auth
    }

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired.' });
    }
    return res.status(403).json({ success: false, error: 'Invalid or expired token.' });
  }
};

export const adminOnly = (req, res, next) => {
  if (req.user?.role !== 0 && req.user?.role !== 2) {
    return res.status(403).json({ success: false, error: 'Admin access required.' });
  }
  next();
};

export const superAdminOnly = (req, res, next) => {
  if (req.user?.role !== 2) {
    return res.status(403).json({ success: false, error: 'Superadmin access required.' });
  }
  next();
};

export const optionalAuth = async (req, res, next) => {
  const token = req.cookies?.admintoken || req.headers.authorization?.replace('Bearer ', '');

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      const user = await User.findById(decoded.user_id).select('status');
      if (user && user.status !== 2) {
        req.user = decoded;
      }
    } catch {
      // Ignore invalid token
    }
  }
  next();
};
