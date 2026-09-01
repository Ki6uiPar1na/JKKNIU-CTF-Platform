import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const verifyToken = async (req, res, next) => {
  const token = req.cookies?.admintoken || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }

  try {
    let decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

    // Verify user still exists, is active, and the token version hasn't been invalidated
    try {
      const user = await User.findById(decoded.user_id).select('status role user_name token_version');
      if (!user || user.status === 2 || user.status === 3) {
        return res.status(403).json({ success: false, error: 'Account deactivated.' });
      }
      if (user.token_version !== (decoded.ver ?? 0)) {
        return res.status(403).json({ success: false, error: 'Session expired. Please log in again.' });
      }
      // Authoritative fields come from the database, not the token
      decoded = { ...decoded, role: user.role, user_name: user.user_name };
    } catch {
      // DB unavailable — fall back to JWT-only auth
    }

    req.user = decoded;
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
      let decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      const user = await User.findById(decoded.user_id).select('status role user_name token_version');
      if (user && user.status !== 2 && user.status !== 3 && user.token_version === (decoded.ver ?? 0)) {
        decoded = { ...decoded, role: user.role, user_name: user.user_name };
        req.user = decoded;
      }
    } catch {
      // Ignore invalid token
    }
  }
  next();
};
