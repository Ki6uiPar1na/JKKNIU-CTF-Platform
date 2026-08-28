import mongoose from 'mongoose';
import crypto from 'crypto';

const teamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  password: { type: String, required: true },
  captain: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  contest_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Contest', required: true },
  invite_code: { type: String, unique: true, default: () => crypto.randomBytes(16).toString('hex') },
}, { timestamps: true });

teamSchema.index({ name: 1, contest_id: 1 }, { unique: true });

teamSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export default mongoose.model('Team', teamSchema);
