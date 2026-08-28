import mongoose from 'mongoose';

export function validateObjectId(...paramNames) {
  return (req, res, next) => {
    for (const name of paramNames) {
      const value = req.params[name];
      if (value && !mongoose.Types.ObjectId.isValid(value)) {
        return res.status(400).json({ success: false, error: 'Invalid ID format.' });
      }
    }
    next();
  };
}
