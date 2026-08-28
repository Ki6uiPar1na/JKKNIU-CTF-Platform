import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  contest_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Contest', required: true },
  title: { type: String, required: true },
  content: { type: String, default: '' },
  type: { type: String, enum: ['alert', 'pop'], default: 'alert' },
}, { timestamps: true });

notificationSchema.set('toJSON', { virtuals: true });

export default mongoose.model('Notification', notificationSchema);
