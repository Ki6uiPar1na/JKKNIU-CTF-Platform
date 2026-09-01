import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  member_id: { type: Number, required: true },
  full_name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  user_name: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: Number, default: 1 },
  status: { type: Number, default: 0 },
  session: { type: String, default: '' },
  token_version: { type: Number, default: 0 },
  reset_password_token: { type: String, default: null, select: false },
  reset_password_expires: { type: Date, default: null, select: false },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.reset_password_token;
  delete obj.reset_password_expires;
  return obj;
};

export default mongoose.model('User', userSchema);
