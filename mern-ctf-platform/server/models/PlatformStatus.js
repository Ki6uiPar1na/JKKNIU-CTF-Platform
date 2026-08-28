import mongoose from 'mongoose';

const platformStatusSchema = new mongoose.Schema({
  submission_status: { type: String, enum: ['open', 'closed'], default: 'closed' },
  submission_start_time: { type: Date, default: null },
  submission_end_time: { type: Date, default: null },
  platform_name: { type: String, default: 'CTF Platform' },
  logo_url: { type: String, default: null },
  smtp_host: { type: String, default: '' },
  smtp_port: { type: Number, default: 587 },
  smtp_secure: { type: Boolean, default: false },
  smtp_user: { type: String, default: '' },
  smtp_pass: { type: String, default: '' },
  smtp_from_email: { type: String, default: '' },
  smtp_from_name: { type: String, default: '' },
}, { timestamps: true });

platformStatusSchema.methods.getTransporter = function () {
  if (!this.smtp_host || !this.smtp_user || !this.smtp_pass) return null;
  return { host: this.smtp_host, port: this.smtp_port, secure: this.smtp_secure, auth: { user: this.smtp_user, pass: this.smtp_pass } };
};

export default mongoose.model('PlatformStatus', platformStatusSchema);
