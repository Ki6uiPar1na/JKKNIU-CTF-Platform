import { Router } from 'express';
import mongoose from 'mongoose';
import Challenge from '../models/Challenge.js';
import Submission from '../models/Submission.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

router.get('/', verifyToken, async (req, res) => {
  try {
    const filter = { visibility: 1 };
    if (req.query.contestId) filter.contest_id = req.query.contestId;

    const challenges = await Challenge.find(filter).sort({ category: 1 });
    const grouped = {};
    for (const ch of challenges) {
      if (!grouped[ch.category]) grouped[ch.category] = [];
      grouped[ch.category].push(ch);
    }

    const subFilter = { user_id: new mongoose.Types.ObjectId(req.user.user_id), practice: { $ne: true } };
    if (req.query.contestId) subFilter.contest_id = req.query.contestId;

    const submissions = await Submission.aggregate([
      { $match: subFilter },
      {
        $group: {
          _id: '$challenge_id',
          solved: { $max: { $cond: [{ $eq: ['$submission_type', 'correct'] }, 1, 0] } },
          tried: { $max: { $cond: [{ $eq: ['$submission_type', 'incorrect'] }, 1, 0] } },
          total_submissions: { $sum: 1 },
        },
      },
    ]);

    const userProgress = {};
    for (const s of submissions) {
      const ch = challenges.find(c => c._id.equals(s._id));
      userProgress[s._id] = {
        status: s.solved ? 'solved' : s.tried ? 'tried' : 'not_tried',
        total_submissions: s.total_submissions,
        remaining_attempts: Math.max(0, (ch?.max_attempts || 0) - s.total_submissions),
      };
    }

    res.json({ success: true, challenges: grouped, user_progress: userProgress });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.get('/categories', verifyToken, async (req, res) => {
  try {
    const filter = { visibility: 1 };
    if (req.query.contestId) filter.contest_id = req.query.contestId;
    const categories = await Challenge.distinct('category', filter);
    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

export default router;
