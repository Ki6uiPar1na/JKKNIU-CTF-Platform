import mongoose from 'mongoose';

const preRegistrationSchema = new mongoose.Schema({
  contest_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Contest', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  data: { type: Map, of: String, default: {} },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
}, { timestamps: true });

preRegistrationSchema.index({ contest_id: 1, user_id: 1 }, { unique: true });

export default mongoose.model('PreRegistration', preRegistrationSchema);
