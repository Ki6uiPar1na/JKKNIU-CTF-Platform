import mongoose from 'mongoose';

export function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

export function requireValidObjectId(...fieldNames) {
  return (req, res, next) => {
    for (const name of fieldNames) {
      const value = name.includes('.') ? name.split('.').reduce((o, k) => o?.[k], req) : req.params[name] || req.body[name] || req.query[name];
      if (value && !isValidObjectId(value)) {
        return res.status(400).json({ success: false, error: `Invalid ${name}.` });
      }
    }
    next();
  };
}
