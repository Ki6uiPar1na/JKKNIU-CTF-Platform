import mongoose from 'mongoose';

const flagSchema = new mongoose.Schema({
  value: { type: String, required: true },
  challenge_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Challenge', required: true },
  is_case_sensitive: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model('Flag', flagSchema);
