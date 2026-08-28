import mongoose from 'mongoose';

const contestSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  isArchived: { type: Boolean, default: false },
  paused: { type: Boolean, default: false },
  submission_status: { type: String, enum: ['open', 'closed'], default: 'open' },
  scoreboard_visibility: { type: String, enum: ['public', 'hidden'], default: 'public' },
  scoreboard_freeze_time: { type: Date, default: null },
  participation_mode: { type: String, enum: ['solo', 'team'], default: 'solo' },
  max_team_size: { type: Number, default: 4 },
  banner_url: { type: String, default: '' },
  pre_registration_enabled: { type: Boolean, default: false },
  pre_registration_fields: [{
    label: { type: String, required: true },
    type: { type: String, enum: ['text', 'email', 'number', 'select', 'textarea'], default: 'text' },
    required: { type: Boolean, default: true },
    options: [String],
  }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

contestSchema.virtual('status').get(function () {
  const now = new Date();
  if (this.isArchived) return 'archived';
  if (this.startDate && now < this.startDate) return 'upcoming';
  if (this.endDate && now > this.endDate) return 'archived';
  return 'active';
});

contestSchema.set('toJSON', { virtuals: true });

export default mongoose.model('Contest', contestSchema);
