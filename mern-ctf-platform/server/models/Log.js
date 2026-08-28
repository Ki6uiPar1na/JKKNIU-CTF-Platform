import mongoose from 'mongoose';

const logSchema = new mongoose.Schema({
  admin_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  admin_name: { type: String, required: true },
  action: { type: String, required: true },
  target_type: { type: String, default: '' },
  target_id: { type: String, default: '' },
  details: { type: String, default: '' },
  created_at: { type: Date, default: Date.now },
});

logSchema.index({ created_at: -1 });
logSchema.index({ target_type: 1, target_id: 1 });

export default mongoose.model('Log', logSchema);
