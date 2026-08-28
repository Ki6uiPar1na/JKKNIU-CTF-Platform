import { Router } from 'express';
import mongoose from 'mongoose';
import Solve from '../models/Solve.js';
import Challenge from '../models/Challenge.js';
import User from '../models/User.js';
import Contest from '../models/Contest.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const contestId = req.query.contestId;
    if (!contestId) {
      return res.status(400).json({ success: false, error: 'contestId is required.' });
    }

    const contest = await Contest.findById(contestId);
    if (!contest) return res.status(404).json({ success: false, error: 'Contest not found.' });

    if (contest.scoreboard_visibility === 'hidden') {
      return res.json({ success: true, scoreboard: [], hidden: true });
    }

    const isFrozen = contest.scoreboard_freeze_time && new Date() > new Date(contest.scoreboard_freeze_time);
    const matchStage = { contest_id: new mongoose.Types.ObjectId(contestId) };
    if (isFrozen) {
      matchStage.solved_at = { $lte: new Date(contest.scoreboard_freeze_time) };
    }

    const pipeline = [
      { $match: matchStage },
      { $lookup: { from: 'challenges', localField: 'challenge_id', foreignField: '_id', as: 'challenge' } },
      { $unwind: '$challenge' },
      { $match: { 'challenge.visibility': 1 } },
    ];

    if (contest.participation_mode === 'team') {
      pipeline.push(
        { $match: { team_id: { $ne: null } } },
        { $lookup: { from: 'teams', localField: 'team_id', foreignField: '_id', as: 'team' } },
        { $unwind: '$team' },
        { $group: { _id: '$team_id', user_name: { $first: '$team.name' }, total_score: { $sum: '$challenge.point' }, latest_solve_time: { $max: '$solved_at' } } },
      );
    } else {
      pipeline.push(
        { $lookup: { from: 'users', localField: 'user_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $match: { 'user.role': 1 } },
        { $group: { _id: '$user_id', user_name: { $first: '$user.user_name' }, total_score: { $sum: '$challenge.point' }, latest_solve_time: { $max: '$solved_at' } } },
      );
    }

    pipeline.push(
      { $lookup: { from: 'hintreveals', let: { group_id: '$_id', isTeam: { $eq: [contest.participation_mode, 'team'] } }, pipeline: [
        { $match: { $expr: { $cond: ['$$isTeam', { $eq: ['$team_id', '$$group_id'] }, { $eq: ['$user_id', '$$group_id'] }] } } },
        { $group: { _id: null, total_cost: { $sum: '$cost' } } },
      ], as: 'hint_costs' } },
      { $addFields: { total_score: { $subtract: ['$total_score', { $ifNull: [{ $arrayElemAt: ['$hint_costs.total_cost', 0] }, 0] }] } } },
    );

    pipeline.push(
      { $sort: { total_score: -1, latest_solve_time: 1 } },
    );

    const scoreboard = await Solve.aggregate(pipeline);

    const result = scoreboard.map((entry, index) => ({
      rank: index + 1,
      user_id: entry._id,
      user_name: entry.user_name,
      total_score: entry.total_score,
      latest_solve_time: entry.latest_solve_time,
    }));

    res.json({ success: true, scoreboard: result, frozen: isFrozen });
  } catch {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

export default router;
