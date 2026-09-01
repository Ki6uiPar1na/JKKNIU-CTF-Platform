import jwt from 'jsonwebtoken';

export const generateToken = (user) => {
  const payload = {
    user_id: user._id,
    role: user.role,
    user_name: user.user_name,
    ver: user.token_version || 0,
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_EXPIRES_IN || '72h',
  });
};

// generateTokenFromPayload removed — signing arbitrary payloads is a security risk
