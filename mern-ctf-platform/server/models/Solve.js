import mongoose from 'mongoose';

const solveSchema = new mongoose.Schema({
  submission_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission', required: true },
  challenge_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Challenge', required: true },
  contest_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Contest', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  team_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  solved_at: { type: Date, default: Date.now },
}, { timestamps: false });

solveSchema.index({ user_id: 1, challenge_id: 1, contest_id: 1 }, { unique: true });
solveSchema.index({ team_id: 1, challenge_id: 1, contest_id: 1 }, { unique: true, sparse: true });

export default mongoose.model('Solve', solveSchema);
