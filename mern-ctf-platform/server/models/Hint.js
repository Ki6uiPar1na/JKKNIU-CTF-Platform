import mongoose from 'mongoose';

const hintSchema = new mongoose.Schema({
  challenge_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Challenge', required: true },
  content: { type: String, required: true },
  cost: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

export default mongoose.model('Hint', hintSchema);
