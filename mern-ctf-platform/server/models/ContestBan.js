import mongoose from 'mongoose';

const contestBanSchema = new mongoose.Schema({
  contest_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Contest', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  team_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  reason: { type: String, default: '' },
  banned_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

contestBanSchema.index(
  { contest_id: 1, user_id: 1 },
  { unique: true, partialFilterExpression: { user_id: { $ne: null } } }
);
contestBanSchema.index(
  { contest_id: 1, team_id: 1 },
  { unique: true, partialFilterExpression: { team_id: { $ne: null } } }
);

export default mongoose.model('ContestBan', contestBanSchema);