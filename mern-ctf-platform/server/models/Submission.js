import mongoose from 'mongoose';

const submissionSchema = new mongoose.Schema({
  submitted_flag: { type: String, required: true },
  challenge_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Challenge', required: true },
  contest_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Contest', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  team_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  submission_type: { type: String, enum: ['correct', 'incorrect'], required: true },
  practice: { type: Boolean, default: false },
}, { timestamps: true });

submissionSchema.virtual('timestamp_of_submission').get(function () {
  return this.createdAt;
});

submissionSchema.set('toJSON', { virtuals: true });

export default mongoose.model('Submission', submissionSchema);
