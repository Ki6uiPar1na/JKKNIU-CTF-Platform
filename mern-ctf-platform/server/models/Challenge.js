import mongoose from 'mongoose';

const challengeSchema = new mongoose.Schema({
  contest_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Contest', required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  point: { type: Number, required: true },
  max_attempts: { type: Number, required: true },
  category: { type: String, required: true },
  visibility: { type: Number, default: 1 },
  files: [{ type: String }],
}, { timestamps: true });

export default mongoose.model('Challenge', challengeSchema);
