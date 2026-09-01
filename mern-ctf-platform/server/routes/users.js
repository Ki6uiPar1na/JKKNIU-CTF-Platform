import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Contest from '../models/Contest.js';
import Submission from '../models/Submission.js';
import Solve from '../models/Solve.js';
import Challenge from '../models/Challenge.js';
import HintReveal from '../models/HintReveal.js';
import { verifyToken } from '../middleware/auth.js';
import { generateToken } from '../utils/jwt.js';
import { requireValidObjectId } from '../utils/validate.js';

const router = Router();

router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { full_name, user_name } = req.body;
    const errors = {};

    if (!full_name) errors.full_name = 'Full name is required.';
    if (!user_name || user_name.length < 3) errors.user_name = 'Username must be at least 3 characters.';

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const existing = await User.findOne({ user_name, _id: { $ne: req.user.user_id } });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Username is already taken.' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.user_id,
      { full_name, user_name },
      { new: true }
    );

    const token = generateToken(user);

    res.cookie('admintoken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 72 * 60 * 60 * 1000,
      path: '/',
    });

    res.json({ success: true, message: 'Profile updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.put('/password', verifyToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password) {
      return res.status(400).json({ success: false, error: 'Current password is required.' });
    }
    if (!new_password) return res.status(400).json({ success: false, error: 'New password is required.' });
    if (new_password.length < 8) return res.status(400).json({ success: false, error: 'New password must be at least 8 characters.' });
    if (!/[A-Z]/.test(new_password)) return res.status(400).json({ success: false, error: 'New password must contain an uppercase letter.' });
    if (!/[a-z]/.test(new_password)) return res.status(400).json({ success: false, error: 'New password must contain a lowercase letter.' });
    if (!/[0-9]/.test(new_password)) return res.status(400).json({ success: false, error: 'New password must contain a number.' });

    const user = await User.findById(req.user.user_id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const isMatch = await user.comparePassword(current_password);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Current password is incorrect.' });
    }

    user.password = new_password;
    user.token_version = (user.token_version || 0) + 1;
    await user.save();

    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.get('/profile/:userId', verifyToken, requireValidObjectId('userId'), async (req, res) => {
  try {
    // Users can only view their own profile or profiles of users in shared contests
    const u = await User.findById(req.params.userId);
    if (!u) return res.status(404).json({ success: false, error: 'User not found.' });

    // Only return profile if viewing own, or viewing a non-admin user (public info)
    if (req.user.user_id !== req.params.userId && u.role !== 1) {
      return res.status(403).json({ success: false, error: 'Not authorized to view this profile.' });
    }

    const contestId = req.query.contestId || null;
    const subFilter = { user_id: u._id };
    const solveFilter = { user_id: u._id };
    if (contestId) {
      subFilter.contest_id = contestId;
      solveFilter.contest_id = contestId;
    }

    // Mask admin profiles
    if (u.role === 0 || u.role === 2) {
      return res.json({
        success: true,
        user: { id: u._id, full_name: 'Unknown', user_name: 'Anonymous', role: -1 },
        rank: null,
        total_submissions: 0,
        total_correct: 0,
        total_score: 0,
        correct_by_category: {},
      });
    }

    const totalSubmissions = await Submission.countDocuments(subFilter);
    const totalCorrect = await Solve.countDocuments(solveFilter);

    const correctByCategory = await Solve.aggregate([
      { $match: solveFilter },
      {
        $lookup: {
          from: 'challenges',
          localField: 'challenge_id',
          foreignField: '_id',
          as: 'challenge',
        },
      },
      { $unwind: '$challenge' },
      { $match: { 'challenge.visibility': 1 } },
      {
        $group: {
          _id: '$challenge.category',
          correct_count: { $sum: 1 },
        },
      },
    ]);

    const categoryMap = {};
    for (const c of correctByCategory) categoryMap[c._id] = c.correct_count;

    const scoreResult = await Solve.aggregate([
      { $match: solveFilter },
      {
        $lookup: {
          from: 'challenges',
          localField: 'challenge_id',
          foreignField: '_id',
          as: 'challenge',
        },
      },
      { $unwind: '$challenge' },
      { $match: { 'challenge.visibility': 1 } },
      { $group: { _id: null, total_score: { $sum: '$challenge.point' } } },
    ]);
    let totalScore = scoreResult.length > 0 ? scoreResult[0].total_score : 0;

    // Deduct hint costs (same as scoreboard)
    const hintCost = await HintReveal.aggregate([
      { $match: { user_id: u._id } },
      ...(contestId ? [{ $match: { contest_id: contestId } }] : []),
      { $group: { _id: null, total_cost: { $sum: '$cost' } } },
    ]);
    if (hintCost.length > 0) {
      totalScore = Math.max(0, totalScore - hintCost[0].total_cost);
    }

    const matchStage = contestId
      ? { $match: { contest_id: contestId } }
      : { $match: {} };

    const rankResult = await Solve.aggregate([
      matchStage,
      {
        $lookup: {
          from: 'challenges',
          localField: 'challenge_id',
          foreignField: '_id',
          as: 'challenge',
        },
      },
      { $unwind: '$challenge' },
      { $match: { 'challenge.visibility': 1 } },
      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      { $match: { 'user.role': 1 } },
      {
        $group: {
          _id: '$user_id',
          total_score: { $sum: '$challenge.point' },
          latest_solve_time: { $max: '$solved_at' },
        },
      },
      {
        $lookup: {
          from: 'hintreveals',
          let: { user_id: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$user_id', '$$user_id'] } } },
            { $group: { _id: null, total_cost: { $sum: '$cost' } } },
          ],
          as: 'hint_costs',
        },
      },
      {
        $addFields: {
          total_score: { $subtract: ['$total_score', { $ifNull: [{ $arrayElemAt: ['$hint_costs.total_cost', 0] }, 0] }] },
        },
      },
      { $match: { total_score: { $gt: 0 } } },
      { $sort: { total_score: -1, latest_solve_time: 1 } },
    ]);

    let rank = null;
    for (let i = 0; i < rankResult.length; i++) {
      if (rankResult[i]._id.equals(u._id)) {
        rank = i + 1;
        break;
      }
    }

    res.json({
      success: true,
      user: {
        id: u._id,
        user_name: u.user_name,
        full_name: u.full_name,
      },
      rank,
      total_submissions: totalSubmissions,
      total_correct: totalCorrect,
      total_score: totalScore,
      correct_by_category: categoryMap,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.get('/me/contests', verifyToken, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.user_id);

    const participation = await Solve.aggregate([
      { $match: { user_id: userId } },
      { $lookup: { from: 'challenges', localField: 'challenge_id', foreignField: '_id', as: 'challenge' } },
      { $unwind: '$challenge' },
      { $match: { 'challenge.visibility': 1 } },
      { $group: { _id: '$contest_id', total_score: { $sum: '$challenge.point' }, solves: { $sum: 1 } } },
    ]);

    const result = [];
    for (const p of participation) {
      const contest = await Contest.findById(p._id).select('title startDate endDate isArchived');
      if (!contest) continue;

      const scoreboard = await Solve.aggregate([
        { $match: { contest_id: contest._id } },
        { $lookup: { from: 'challenges', localField: 'challenge_id', foreignField: '_id', as: 'challenge' } },
        { $unwind: '$challenge' },
        { $match: { 'challenge.visibility': 1 } },
        { $lookup: { from: 'users', localField: 'user_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $match: { 'user.role': 1 } },
        { $group: { _id: '$user_id', total_score: { $sum: '$challenge.point' }, latest_solve_time: { $max: '$solved_at' } } },
        { $sort: { total_score: -1, latest_solve_time: 1 } },
      ]);

      let rank = null;
      for (let i = 0; i < scoreboard.length; i++) {
        if (scoreboard[i]._id.equals(userId)) { rank = i + 1; break; }
      }

      result.push({
        contest_id: contest._id,
        contest_title: contest.title,
        start_date: contest.startDate,
        end_date: contest.endDate,
        is_archived: contest.isArchived,
        status: contest.status,
        total_score: p.total_score,
        solves: p.solves,
        rank,
        participants: scoreboard.length,
      });
    }

    result.sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      return new Date(b.start_date) - new Date(a.start_date);
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

export default router;
