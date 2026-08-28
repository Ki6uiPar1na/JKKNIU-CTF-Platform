import mongoose from 'mongoose';

const hintRevealSchema = new mongoose.Schema({
  hint_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Hint', required: true },
  contest_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Contest', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  team_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  cost: { type: Number, required: true },
}, { timestamps: true });

hintRevealSchema.index({ hint_id: 1, user_id: 1 }, { unique: true, sparse: true });
hintRevealSchema.index({ hint_id: 1, team_id: 1 }, { unique: true, sparse: true });

export default mongoose.model('HintReveal', hintRevealSchema);
