import { Router } from 'express';
import mongoose from 'mongoose';
import Contest from '../models/Contest.js';
import Challenge from '../models/Challenge.js';
import Submission from '../models/Submission.js';
import Solve from '../models/Solve.js';
import Flag from '../models/Flag.js';
import Hint from '../models/Hint.js';
import HintReveal from '../models/HintReveal.js';
import Notification from '../models/Notification.js';
import Team from '../models/Team.js';
import PreRegistration from '../models/PreRegistration.js';
import { verifyToken, optionalAuth } from '../middleware/auth.js';
import { cache } from '../middleware/cache.js';
import { cacheDel, makeCacheKey } from '../utils/redis.js';
import { validateObjectId } from '../middleware/validateObjectId.js';
import { getContestBan, getContestBans, bannedMatchStage } from '../utils/contestBan.js';
import { notifyBloodIfEarned, notifySolve } from '../utils/discordNotifier.js';

const router = Router();

router.param('id', validateObjectId('id'));
router.param('contestId', validateObjectId('contestId'));
router.param('challengeId', validateObjectId('challengeId'));
router.param('hintId', validateObjectId('hintId'));

async function isPreRegAccepted(contestId, userId) {
  const contest = await Contest.findById(contestId).select('pre_registration_enabled startDate');
  if (!contest) return false;

  if (!contest.pre_registration_enabled) return true;

  const reg = await PreRegistration.findOne({ contest_id: contestId, user_id: userId });
  if (!reg) return false;
  return reg.status === 'accepted';
}

router.get('/', cache(15), async (req, res) => {
  try {
    const { status } = req.query;
    const now = new Date();
    const filter = {};
    if (status === 'active') {
      filter.isArchived = false;
      filter.$and = [
        { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
        { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
      ];
    } else if (status === 'upcoming') {
      filter.isArchived = false;
      filter.startDate = { $gt: now };
    } else if (status === 'archived') {
      filter.$or = [
        { isArchived: true },
        { endDate: { $lt: now } },
      ];
    }
    const contests = await Contest.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, contests });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.get('/:id', cache(30), async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.id);
    if (!contest) return res.status(404).json({ success: false, error: 'Contest not found.' });
    res.json({ success: true, contest });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.get('/:id/challenges', verifyToken, async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.id);
    if (!contest) return res.status(404).json({ success: false, error: 'Contest not found.' });

    if (await getContestBan(req.params.id, req.user.user_id)) {
      return res.status(403).json({ success: false, error: 'You are banned from this contest.' });
    }

    const isAdmin = req.user.role === 0 || req.user.role === 2;
    if (contest.paused && !isAdmin) {
      return res.json({ success: true, challenges: {}, user_progress: {} });
    }

    if (!(await isPreRegAccepted(req.params.id, req.user.user_id))) {
      return res.json({ success: true, challenges: {}, user_progress: {} });
    }

    const challengeFilter = { contest_id: req.params.id, visibility: 1 };
    const challenges = await Challenge.find(challengeFilter).sort({ category: 1 });

    const solveMap = new Map();
    const solveAgg = await Solve.aggregate([
      { $match: { contest_id: contest._id } },
      {
        $lookup: { from: 'users', localField: 'user_id', foreignField: '_id', as: 'user' },
      },
      {
        $lookup: { from: 'teams', localField: 'team_id', foreignField: '_id', as: 'team' },
      },
      {
        $group: {
          _id: '$challenge_id',
          solve_rows: { $sum: 1 },
          entries: { $push: { user: { $first: '$user.user_name' }, team: { $first: '$team.name' } } },
        },
      },
    ]);
    for (const s of solveAgg) {
      const unique = [];
      const seen = new Set();
      for (const e of s.entries) {
        const name = (e.team || e.user || '').toString().trim();
        if (!name || seen.has(name)) continue;
        seen.add(name);
        unique.push(name);
      }
      solveMap.set(s._id.toString(), { count: s.solve_rows, solvers: unique });
    }

    const grouped = {};
    for (const ch of challenges) {
      if (!grouped[ch.category]) grouped[ch.category] = [];
      const sol = solveMap.get(ch._id.toString()) || { count: 0, solvers: [] };
      grouped[ch.category].push({ ...ch.toObject(), solves: sol });
    }

    const submissions = await Submission.aggregate([
      { $match: { user_id: new mongoose.Types.ObjectId(req.user.user_id), contest_id: contest._id, practice: { $ne: true } } },
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

router.get('/:id/categories', verifyToken, async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.id);
    if (!contest) return res.status(404).json({ success: false, error: 'Contest not found.' });

    if (await getContestBan(req.params.id, req.user.user_id)) {
      return res.status(403).json({ success: false, error: 'You are banned from this contest.' });
    }

    const isAdmin = req.user.role === 0 || req.user.role === 2;
    if (contest.paused && !isAdmin) {
      return res.json({ success: true, categories: [] });
    }

    if (!(await isPreRegAccepted(req.params.id, req.user.user_id))) {
      return res.json({ success: true, categories: [] });
    }

    const categories = await Challenge.distinct('category', { contest_id: req.params.id, visibility: 1 });
    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.post('/:id/submit', verifyToken, async (req, res) => {
  try {
    const { submitted_flag, challenge_id } = req.body;
    const user_id = req.user.user_id;
    const contestId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(challenge_id)) {
      return res.json({ success: false, submission_type: 'blank', message: 'Invalid challenge.' });
    }

    const contest = await Contest.findById(contestId);
    if (!contest) return res.json({ success: false, submission_type: 'blank', message: 'Contest not found.' });

    if (contest.isArchived || contest.status === 'archived') {
      return res.json({ success: false, submission_type: 'blank', message: 'This contest has ended.' });
    }

    const now = new Date();
    if (contest.startDate && now < new Date(contest.startDate)) {
      return res.json({ success: false, submission_type: 'blank', message: 'The contest has not started yet.' });
    }
    if (contest.endDate && now > new Date(contest.endDate)) {
      return res.json({ success: false, submission_type: 'blank', message: 'The contest has ended.' });
    }

    if (contest.submission_status === 'closed') {
      return res.json({ success: false, submission_type: 'blank', message: 'Submissions are closed for this contest.' });
    }

    if (contest.paused) {
      return res.json({ success: false, submission_type: 'blank', message: 'Submissions are paused for this contest.' });
    }

    if (await getContestBan(contestId, user_id)) {
      return res.json({ success: false, submission_type: 'blank', message: 'You are banned from this contest.' });
    }

    if (!(await isPreRegAccepted(contestId, user_id))) {
      return res.json({ success: false, submission_type: 'blank', message: 'Your pre-registration has not been accepted yet.' });
    }

    let team_id = null;
    let team_name = null;
    if (contest.participation_mode === 'team') {
      const team = await Team.findOne({ contest_id: contestId, members: user_id });
      if (!team) return res.json({ success: false, submission_type: 'blank', message: 'You must be in a team to submit in this contest.' });
      team_id = team._id;
      team_name = team.name;
    }

    const challenge = await Challenge.findOne({ _id: challenge_id, contest_id: contestId });
    if (!challenge) {
      return res.json({ success: false, submission_type: 'blank', message: 'Challenge not found.' });
    }

    if (challenge.visibility !== 1) {
      return res.json({ success: false, submission_type: 'blank', message: 'Challenge not found.' });
    }

    const isPractice = challenge.submission_enabled === 0;

    const subFilter = { challenge_id, contest_id: contestId };
    if (team_id) subFilter.team_id = team_id;
    else subFilter.user_id = user_id;

    const userSubs = await Submission.find(subFilter);
    const scoredSubs = userSubs.filter(s => !s.practice);

    if (!isPractice) {
      const solved = scoredSubs.some(s => s.submission_type === 'correct');
      if (solved) {
        return res.json({ success: false, submission_type: 'already_solved', message: 'This challenge is already solved.' });
      }
      if (scoredSubs.length >= challenge.max_attempts) {
        return res.json({ success: false, submission_type: 'blank', message: 'No remaining attempts.' });
      }
    }

    const flags = await Flag.find({ challenge_id });
    const match = flags.find(f => {
      if (f.is_case_sensitive) return f.value === submitted_flag;
      return f.value.toLowerCase() === submitted_flag.toLowerCase();
    });

    const submission_type = match ? 'correct' : 'incorrect';

    const submission = await Submission.create({
      submitted_flag,
      challenge_id,
      contest_id: contestId,
      user_id,
      team_id,
      submission_type,
      practice: isPractice,
    });

    let responseMessage = isPractice ? 'Wrong Flag (practice — no points affected)' : 'Wrong Flag';

    if (submission_type === 'correct' && !isPractice) {
      try {
        const solveData = {
          submission_id: submission._id,
          challenge_id,
          contest_id: contestId,
          user_id,
          solved_at: new Date(),
        };
        if (team_id) solveData.team_id = team_id;
        await Solve.create(solveData);
        notifyBloodIfEarned(contestId, challenge_id, {
          solver_name: team_name || req.user?.user_name || 'Anonymous',
          contest_title: contest.title,
        });
        notifySolve(contestId, challenge_id, { user_id, team_id });
        responseMessage = 'Correct flag! Challenge solved.';
      } catch (solveErr) {
        console.error('Solve create error:', solveErr.message, solveErr.code, JSON.stringify(solveErr.keyValue || {}));
        if (solveErr.code === 11000) {
          return res.json({ success: false, submission_type: 'already_solved', message: 'This challenge is already solved.' });
        }
      }
    } else if (submission_type === 'correct' && isPractice) {
      responseMessage = 'Correct flag! (practice — no points awarded)';
    }

    await cacheDel(makeCacheKey(`/api/contests/${contestId}/scoreboard*`));
    await cacheDel(makeCacheKey(`/api/contests/${contestId}/scoreboard/timeline*`));

    res.json({ success: true, submission_type, practice: isPractice, message: responseMessage });
  } catch (err) {
    console.error('Submit error:', err.message, err.stack);
    res.status(500).json({ success: false, submission_type: 'blank', message: 'Server error.' });
  }
});

router.get('/:id/scoreboard', optionalAuth, async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.id);
    if (!contest) return res.status(404).json({ success: false, error: 'Contest not found.' });

    const isAdmin = req.user && (req.user.role === 0 || req.user.role === 2);
    if (contest.scoreboard_visibility === 'hidden' && !isAdmin) {
      return res.json({ success: true, scoreboard: [], hidden: true, message: 'Scoreboard is hidden for this contest.' });
    }
    const isFrozen = contest.scoreboard_freeze_time && new Date() > new Date(contest.scoreboard_freeze_time);
    const matchStage = { contest_id: contest._id };
    if (isFrozen && !isAdmin) {
      matchStage.solved_at = { $lte: new Date(contest.scoreboard_freeze_time) };
    }

    const pipeline = [
      { $match: matchStage },
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
    ];

    const { bannedUserIds, bannedTeamIds } = await getContestBans(contest._id);
    const banStage = bannedMatchStage(bannedUserIds, bannedTeamIds);
    if (banStage) pipeline.push(banStage);

    if (contest.participation_mode === 'team') {
      pipeline.push(
        { $match: { team_id: { $ne: null } } },
        {
          $lookup: {
            from: 'teams',
            localField: 'team_id',
            foreignField: '_id',
            as: 'team',
          },
        },
        { $unwind: '$team' },
        {
          $group: {
            _id: '$team_id',
            user_name: { $first: '$team.name' },
            total_score: { $sum: '$challenge.point' },
            latest_solve_time: { $max: '$solved_at' },
          },
        },
      );
    } else {
      pipeline.push(
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
            user_name: { $first: '$user.user_name' },
            total_score: { $sum: '$challenge.point' },
            latest_solve_time: { $max: '$solved_at' },
          },
        },
      );
    }

    if (contest.participation_mode === 'team') {
      pipeline.push(
        {
          $lookup: {
            from: 'hintreveals',
            let: { team_id: '$_id' },
            pipeline: [
              { $match: { $expr: { $eq: ['$team_id', '$$team_id'] } } },
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
      );
    } else {
      pipeline.push(
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
      );
    }

    pipeline.push({ $match: { total_score: { $gt: 0 } } });
    pipeline.push({ $sort: { total_score: -1, latest_solve_time: 1 } });

    const scoreboard = await Solve.aggregate(pipeline);

    const result = scoreboard.map((entry, index) => ({
      rank: index + 1,
      user_id: entry._id,
      user_name: entry.user_name,
      total_score: entry.total_score,
      latest_solve_time: entry.latest_solve_time,
    }));

    res.json({ success: true, scoreboard: result, frozen: !isAdmin && isFrozen });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

// ─── Hint Reveal (cost deduction) ───

router.post('/:contestId/hints/:hintId/reveal', verifyToken, async (req, res) => {
  try {
    const hint = await Hint.findById(req.params.hintId);
    if (!hint) return res.status(404).json({ success: false, error: 'Hint not found.' });
    if (hint.cost === 0) return res.status(400).json({ success: false, error: 'Free hints do not need to be revealed.' });

    const contest = await Contest.findById(req.params.contestId);
    if (!contest) return res.status(404).json({ success: false, error: 'Contest not found.' });

    if (await getContestBan(req.params.contestId, req.user.user_id)) {
      return res.status(403).json({ success: false, error: 'You are banned from this contest.' });
    }

    if (contest.startDate && new Date() < new Date(contest.startDate)) {
      return res.status(403).json({ success: false, error: 'Contest has not started.' });
    }

    const hintChallenge = await Challenge.findOne({ _id: hint.challenge_id, contest_id: contest._id });
    if (!hintChallenge || hintChallenge.visibility !== 1) {
      return res.status(404).json({ success: false, error: 'Hint not found.' });
    }

    let user_id = null, team_id = null;
    if (contest.participation_mode === 'team') {
      const team = await Team.findOne({ contest_id: contest._id, members: req.user.user_id });
      if (!team) return res.status(400).json({ success: false, error: 'You must be in a team to reveal hints.' });
      team_id = team._id;
    } else {
      user_id = req.user.user_id;
    }

    const filter = { hint_id: hint._id, contest_id: contest._id };
    if (team_id) filter.team_id = team_id;
    else filter.user_id = user_id;

    const existing = await HintReveal.findOne(filter);
    if (existing) return res.json({ success: true, message: 'Hint already revealed.', hint, already_revealed: true });

    await HintReveal.create({ ...filter, cost: hint.cost });

    await cacheDel(makeCacheKey(`/api/contests/${req.params.contestId}/scoreboard*`));
    await cacheDel(makeCacheKey(`/api/contests/${req.params.contestId}/scoreboard/timeline*`));

    res.json({ success: true, message: `Hint revealed for ${hint.cost} points!`, hint, cost: hint.cost });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

// ─── Hints (public) ───

router.get('/:contestId/challenges/:challengeId/hints', verifyToken, async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.contestId);
    if (!contest) return res.status(404).json({ success: false, error: 'Contest not found.' });

    if (await getContestBan(req.params.contestId, req.user.user_id)) {
      return res.status(403).json({ success: false, error: 'You are banned from this contest.' });
    }

    if (contest.startDate && new Date() < new Date(contest.startDate))
      return res.status(403).json({ success: false, error: 'Contest has not started.' });

    if (contest.paused && req.user.role !== 0 && req.user.role !== 2) {
      return res.status(403).json({ success: false, error: 'Contest is paused.' });
    }

    if (!(await isPreRegAccepted(req.params.contestId, req.user.user_id))) {
      return res.status(403).json({ success: false, error: 'Your pre-registration has not been accepted yet.' });
    }

    const challenge = await Challenge.findOne({ _id: req.params.challengeId, contest_id: contest._id });
    if (!challenge || challenge.visibility !== 1) {
      return res.status(404).json({ success: false, error: 'Challenge not found.' });
    }

    const hints = await Hint.find({ challenge_id: req.params.challengeId }).sort({ cost: 1 });
    const cheapHints = hints.filter(h => h.cost === 0);
    const paidHints = hints.filter(h => h.cost > 0);

    let revealedIds = [];
    if (contest) {
      let filter = { hint_id: { $in: hints.map(h => h._id) }, contest_id: contest._id };
      if (contest.participation_mode === 'team') {
        const team = await Team.findOne({ contest_id: contest._id, members: req.user.user_id });
        if (team) filter.team_id = team._id;
      } else {
        filter.user_id = req.user.user_id;
      }
      const reveals = await HintReveal.find(filter);
      revealedIds = reveals.map(r => r.hint_id.toString());
    }

    const visiblePaidHints = paidHints.map(h => {
      const obj = h.toObject();
      if (!revealedIds.includes(h._id.toString())) obj.content = null;
      return obj;
    });

    res.json({ success: true, hints: cheapHints, paid_hints: visiblePaidHints, revealed_ids: revealedIds });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

// ─── Notifications (public) ───

router.get('/:contestId/notifications', cache(5), async (req, res) => {
  try {
    const notifications = await Notification.find({ contest_id: req.params.contestId }).sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, notifications });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.get('/:id/scoreboard/timeline', optionalAuth, async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.id);
    if (!contest) return res.status(404).json({ success: false, error: 'Contest not found.' });

    if (contest.scoreboard_visibility === 'hidden') {
      return res.json({ success: true, timeline: [] });
    }

    const matchStage = { contest_id: contest._id };
    if (contest.scoreboard_freeze_time && new Date() > new Date(contest.scoreboard_freeze_time)) {
      matchStage.solved_at = { $lte: new Date(contest.scoreboard_freeze_time) };
    }

    const pipeline = [
      { $match: matchStage },
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
    ];

    const { bannedUserIds, bannedTeamIds } = await getContestBans(contest._id);
    const banStage = bannedMatchStage(bannedUserIds, bannedTeamIds);
    if (banStage) pipeline.push(banStage);

    if (contest.participation_mode === 'team') {
      pipeline.push(
        { $match: { team_id: { $ne: null } } },
        {
          $lookup: {
            from: 'teams',
            localField: 'team_id',
            foreignField: '_id',
            as: 'team',
          },
        },
        { $unwind: '$team' },
        {
          $group: {
            _id: '$team_id',
            user_name: { $first: '$team.name' },
            data: {
              $push: {
                time: '$solved_at',
                score: '$challenge.point',
              },
            },
          },
        },
      );
    } else {
      pipeline.push(
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
            user_name: { $first: '$user.user_name' },
            data: {
              $push: {
                time: '$solved_at',
                score: '$challenge.point',
              },
            },
          },
        },
      );
    }

    const revealField = contest.participation_mode === 'team' ? '$team_id' : '$user_id';
    pipeline.push({
      $lookup: {
        from: 'hintreveals',
        let: { gid: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: [revealField, '$$gid'] } } },
          { $sort: { createdAt: 1 } },
        ],
        as: 'reveals',
      },
    });

    const raw = await Solve.aggregate(pipeline);

    const timeline = raw.map(entry => {
      const sorted = (entry.data || []).sort((a, b) => new Date(a.time) - new Date(b.time));
      const events = [
        ...sorted.map(d => ({ time: new Date(d.time), delta: d.score })),
        ...(entry.reveals || []).map(r => ({ time: new Date(r.createdAt), delta: -r.cost })),
      ].sort((a, b) => a.time - b.time);
      let running = 0;
      const points = events.map(e => {
        running += e.delta;
        return { time: e.time.toISOString(), score: running };
      });
      const lastSolveTime = sorted.length ? new Date(sorted[sorted.length - 1].time).getTime() : 0;
      return {
        user_name: entry.user_name,
        data: points,
        final_score: points.length ? points[points.length - 1].score : 0,
        last_solve_time: lastSolveTime,
      };
    });

    const filtered = timeline
      .filter(e => e.data.length > 0)
      .sort((a, b) => b.final_score - a.final_score || a.last_solve_time - b.last_solve_time)
      .slice(0, 10)
      .map((entry, idx) => ({ ...entry, rank: idx + 1 }));

    res.json({ success: true, timeline: filtered });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.get('/:id/profile', verifyToken, async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.id);
    if (!contest) return res.status(404).json({ success: false, error: 'Contest not found.' });

    const isTeamMode = contest.participation_mode === 'team';
    let userId = req.user.user_id;
    let teamId = null;
    let team = null;

    const activeBan = await getContestBan(contest._id, userId);
    if (activeBan) return res.status(403).json({ success: false, error: 'You are banned from this contest.' });

    if (isTeamMode) {
      team = await Team.findOne({ contest_id: contest._id, $or: [{ captain: userId }, { members: userId }] });
      if (team) teamId = team._id;
    }

    const solveFilter = { contest_id: contest._id };
    if (teamId) {
      solveFilter.team_id = teamId;
    } else {
      solveFilter.user_id = new mongoose.Types.ObjectId(userId);
    }

    const solves = await Solve.aggregate([
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
      { $sort: { solved_at: 1 } },
      {
        $project: {
          challenge_name: '$challenge.name',
          category: '$challenge.category',
          points: '$challenge.point',
          solved_at: 1,
          _id: 0,
        },
      },
    ]);

    const hintRevealFilter = { contest_id: contest._id };
    if (teamId) {
      hintRevealFilter.team_id = teamId;
    } else {
      hintRevealFilter.user_id = userId;
    }
    const hintReveals = await HintReveal.find(hintRevealFilter).sort({ createdAt: -1 }).lean();
    const totalHintCost = hintReveals.reduce((sum, r) => sum + r.cost, 0);

    const totalScore = solves.reduce((sum, s) => sum + s.points, 0) - totalHintCost;

    const userName = teamId ? team.name : req.user.user_name;

    const scoreboardFilter = { contest_id: contest._id };
    if (isTeamMode) {
      scoreboardFilter.participation_mode = 'team';
    }

    let rank = null;
    // Same pipeline as scoreboard to ensure rank matches
    const scoreboardPipeline = [
      { $match: { contest_id: contest._id } },
      { $lookup: { from: 'challenges', localField: 'challenge_id', foreignField: '_id', as: 'challenge' } },
      { $unwind: '$challenge' },
      { $match: { 'challenge.visibility': 1 } },
    ];

    const { bannedUserIds, bannedTeamIds } = await getContestBans(contest._id);
    const banStage = bannedMatchStage(bannedUserIds, bannedTeamIds);
    if (banStage) scoreboardPipeline.push(banStage);

    if (isTeamMode) {
      scoreboardPipeline.push(
        { $match: { team_id: { $ne: null } } },
        { $lookup: { from: 'teams', localField: 'team_id', foreignField: '_id', as: 'team' } },
        { $unwind: '$team' },
        { $group: { _id: '$team_id', user_name: { $first: '$team.name' }, total: { $sum: '$challenge.point' }, latest_solve_time: { $max: '$solved_at' } } },
      );
    } else {
      scoreboardPipeline.push(
        { $lookup: { from: 'users', localField: 'user_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $match: { 'user.role': 1 } },
        { $group: { _id: '$user_id', user_name: { $first: '$user.user_name' }, total: { $sum: '$challenge.point' }, latest_solve_time: { $max: '$solved_at' } } },
      );
    }

    // Hint cost deduction (same as scoreboard)
    const hintLookup = {
      $lookup: {
        from: 'hintreveals',
        let: { group_id: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: [isTeamMode ? '$team_id' : '$user_id', '$$group_id'] } } },
          { $group: { _id: null, total_cost: { $sum: '$cost' } } },
        ],
        as: 'hint_costs',
      },
    };
    const hintSubtract = {
      $addFields: {
        total: { $subtract: ['$total', { $ifNull: [{ $arrayElemAt: ['$hint_costs.total_cost', 0] }, 0] }] },
      },
    };
    scoreboardPipeline.push(hintLookup, hintSubtract);
    scoreboardPipeline.push({ $match: { total: { $gt: 0 } } });
    scoreboardPipeline.push({ $sort: { total: -1, latest_solve_time: 1 } });

    const allScores = await Solve.aggregate(scoreboardPipeline);
    const idx = allScores.findIndex(s => String(s._id) === String(teamId || userId));
    if (idx !== -1) rank = idx + 1;

    const submissions = await Submission.find({
      contest_id: contest._id,
      ...(teamId ? { team_id: teamId } : { user_id: userId }),
    })
      .populate('challenge_id', 'name')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({
      success: true,
      user_name: userName,
      score: totalScore,
      rank,
      solves,
      hint_costs: totalHintCost,
      hint_reveals: hintReveals.map(r => ({
        hint_id: r.hint_id,
        cost: r.cost,
        created_at: r.createdAt,
      })),
      submissions: submissions.map(s => ({
        challenge_name: s.challenge_id?.name || 'Unknown',
        submission_type: s.submission_type,
        created_at: s.createdAt,
      })),
      team: team
        ? await (async () => {
            await team.populate('members', 'user_name full_name');
            await team.populate('captain', 'user_name full_name');
            const memberDetails = await Promise.all((team.members || []).map(async m => {
              const mId = m._id || m;
              const memberSolves = await Solve.aggregate([
                { $match: { contest_id: contest._id, user_id: mId } },
                { $lookup: { from: 'challenges', localField: 'challenge_id', foreignField: '_id', as: 'challenge' } },
                { $unwind: '$challenge' },
                { $group: { _id: null, total: { $sum: '$challenge.point' } } },
              ]);
              const hintCosts = await HintReveal.aggregate([
                { $match: { contest_id: contest._id, user_id: mId } },
                { $group: { _id: null, total: { $sum: '$cost' } } },
              ]);
              const total = (memberSolves[0]?.total || 0) - (hintCosts[0]?.total || 0);
              return {
                _id: mId,
                user_name: m.user_name || 'Unknown',
                full_name: m.full_name || '',
                total_score: total,
              };
            }));
            return {
              _id: team._id,
              name: team.name,
              invite_code: team.invite_code,
              captain: { _id: team.captain._id || team.captain, user_name: team.captain.user_name || 'Unknown' },
              members: memberDetails,
            };
          })()
        : null,
      participation_mode: contest.participation_mode,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

// ─── Contest Submissions (spectator view) ───

router.get('/:id/submissions', verifyToken, async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.id);
    if (!contest) return res.status(404).json({ success: false, error: 'Contest not found.' });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;

    const filter = { contest_id: contest._id };

    const total = await Submission.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    const submissions = await Submission.find(filter)
      .populate('user_id', 'user_name')
      .populate('challenge_id', 'name point')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const isAdmin = req.user.role === 0 || req.user.role === 2;

    const data = submissions.map(s => ({
      submission_id: s._id,
      user_name: s.user_id?.user_name,
      challenge_name: s.challenge_id?.name,
      challenge_point: s.challenge_id?.point,
      challenge_id: s.challenge_id?._id,
      submitted_flag: isAdmin ? s.submitted_flag : '••••••',
      submission_type: s.submission_type,
      practice: !!s.practice,
      timestamp_of_submission: s.createdAt,
    }));

    res.json({
      success: true,
      data,
      pagination: { total_rows: total, total_pages: totalPages, current_page: page, limit },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

// ─── First Blood (first solvers per challenge) ───

router.get('/:id/first-blood', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 0 && req.user.role !== 2) return res.status(403).json({ success: false, error: 'Access denied.' });

    const contest = await Contest.findById(req.params.id);
    if (!contest) return res.status(404).json({ success: false, error: 'Contest not found.' });

    const isTeamMode = contest.participation_mode === 'team';

    const pipeline = [
      { $match: { contest_id: contest._id } },
      { $lookup: { from: 'challenges', localField: 'challenge_id', foreignField: '_id', as: 'challenge' } },
      { $unwind: '$challenge' },
      { $match: { 'challenge.visibility': 1 } },
    ];

    const { bannedUserIds, bannedTeamIds } = await getContestBans(contest._id);
    const banStage = bannedMatchStage(bannedUserIds, bannedTeamIds);
    if (banStage) pipeline.push(banStage);

    pipeline.push({ $sort: { solved_at: 1 } });

    if (isTeamMode) {
      pipeline.push(
        { $match: { team_id: { $ne: null } } },
        { $lookup: { from: 'teams', localField: 'team_id', foreignField: '_id', as: 'team' } },
        { $unwind: '$team' },
        { $group: { _id: '$challenge_id', challenge_name: { $first: '$challenge.name' }, category: { $first: '$challenge.category' }, points: { $first: '$challenge.point' }, solver_name: { $first: '$team.name' }, solved_at: { $first: '$solved_at' } } },
      );
    } else {
      pipeline.push(
        { $lookup: { from: 'users', localField: 'user_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $match: { 'user.role': 1 } },
        { $group: { _id: '$challenge_id', challenge_name: { $first: '$challenge.name' }, category: { $first: '$challenge.category' }, points: { $first: '$challenge.point' }, solver_name: { $first: '$user.user_name' }, solved_at: { $first: '$solved_at' } } },
      );
    }

    pipeline.push({ $sort: { solved_at: -1 } });

    const results = await Solve.aggregate(pipeline);

    res.json({ success: true, bloods: results });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

// ─── Pre-registration ───

router.get('/:id/pre-registration', optionalAuth, async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.id).select('pre_registration_enabled pre_registration_fields startDate title');
    if (!contest) return res.status(404).json({ success: false, error: 'Contest not found.' });

    let myStatus = null;
    if (req.user) {
      const reg = await PreRegistration.findOne({ contest_id: req.params.id, user_id: req.user.user_id });
      if (reg) myStatus = reg.status;
    }

    res.json({
      success: true,
      enabled: contest.pre_registration_enabled,
      fields: contest.pre_registration_fields,
      title: contest.title,
      isUpcoming: contest.startDate && new Date(contest.startDate) > new Date(),
      myStatus,
    });
  } catch { res.status(500).json({ success: false, error: 'Server error.' }); }
});

router.post('/:id/pre-register', verifyToken, async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.id);
    if (!contest) return res.status(404).json({ success: false, error: 'Contest not found.' });

    if (await getContestBan(req.params.id, req.user.user_id)) {
      return res.status(403).json({ success: false, error: 'You are banned from this contest.' });
    }

    if (!contest.pre_registration_enabled)
      return res.status(400).json({ success: false, error: 'Pre-registration is not enabled for this contest.' });

    const existing = await PreRegistration.findOne({ contest_id: contest._id, user_id: req.user.user_id });
    if (existing) return res.status(400).json({ success: false, error: 'You are already pre-registered.' });

    const data = {};
    for (const field of contest.pre_registration_fields) {
      const value = req.body[field.label];
      if (field.required && !value) return res.status(400).json({ success: false, error: `"${field.label}" is required.` });
      if (value) data[field.label] = value;
    }

    await PreRegistration.create({ contest_id: contest._id, user_id: req.user.user_id, data });
    res.json({ success: true, message: 'Pre-registered successfully!' });
  } catch { res.status(500).json({ success: false, error: 'Server error.' }); }
});

export default router;
