import { Router } from 'express';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Contest from '../models/Contest.js';
import Challenge from '../models/Challenge.js';
import Flag from '../models/Flag.js';
import Submission from '../models/Submission.js';
import Solve from '../models/Solve.js';
import Log from '../models/Log.js';
import Team from '../models/Team.js';
import Hint from '../models/Hint.js';
import Notification from '../models/Notification.js';
import PlatformStatus from '../models/PlatformStatus.js';
import PreRegistration from '../models/PreRegistration.js';
import ContestBan from '../models/ContestBan.js';
import { verifyToken, adminOnly, superAdminOnly } from '../middleware/auth.js';
import { logAdminAction } from '../utils/logger.js';
import { uploadBanner, uploadChallengeFile } from '../middleware/upload.js';
import { cache } from '../middleware/cache.js';
import { cacheDel, makeCacheKey } from '../utils/redis.js';
import { stripHtml } from '../utils/sanitize.js';
import { validateObjectId } from '../middleware/validateObjectId.js';

import { getContestBans, bannedMatchStage } from '../utils/contestBan.js';
import { storeFile, deleteStoredFile } from '../utils/cloudinary.js';
import { isValidWebhookUrl, notifyDiscord, getScoreSummary, sendDiscordTest, DISCORD_EVENTS, notifySolve, notifyBloodIfEarned } from '../utils/discordNotifier.js';

function csvValue(v) {
  const s = String(v ?? '');
  const escaped = s.replace(/"/g, '""');
  if (s.startsWith('=') || s.startsWith('+') || s.startsWith('-') || s.startsWith('@')) {
    return `"'${escaped}"`;
  }
  return `"${escaped}"`;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

const router = Router();
router.use(verifyToken, adminOnly);

router.param('id', validateObjectId('id'));
router.param('contestId', validateObjectId('contestId'));
router.param('challengeId', validateObjectId('challengeId'));
router.param('teamId', validateObjectId('teamId'));
router.param('userId', validateObjectId('userId'));
router.param('hintId', validateObjectId('hintId'));
router.param('notificationId', validateObjectId('notificationId'));
router.param('contestId2', validateObjectId('contestId2'));
router.param('banId', validateObjectId('banId'));
router.param('challengeId', validateObjectId('challengeId'));
router.param('teamId', validateObjectId('teamId'));
router.param('userId', validateObjectId('userId'));
router.param('hintId', validateObjectId('hintId'));
router.param('notificationId', validateObjectId('notificationId'));

// ─── Logs (read-only, no delete) ───

router.get('/logs', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const total = await Log.countDocuments();
    const totalPages = Math.ceil(total / limit);

    const logs = await Log.find()
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      data: logs,
      pagination: { total_rows: total, total_pages: totalPages, current_page: page, limit },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

// ─── Dashboard / Stats ───

router.get('/stats', cache(30), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 1 });
    const pendingUsers = await User.countDocuments({ status: 0 });
    const totalChallenges = await Challenge.countDocuments();
    const totalSubmissions = await Submission.countDocuments();
    const totalSolves = await Solve.countDocuments();
    const totalContests = await Contest.countDocuments();
    res.json({ success: true, data: { totalUsers, pendingUsers, totalChallenges, totalSubmissions, totalSolves, totalContests } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.get('/stats/:contestId', async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.contestId);
    if (!contest) return res.status(404).json({ success: false, error: 'Contest not found.' });
    const totalChallenges = await Challenge.countDocuments({ contest_id: contest._id });
    const totalSubmissions = await Submission.countDocuments({ contest_id: contest._id });
    const totalSolves = await Solve.countDocuments({ contest_id: contest._id });
    const totalParticipants = (await Solve.distinct('user_id', { contest_id: contest._id })).length;
    res.json({ success: true, data: { totalChallenges, totalSubmissions, totalSolves, totalParticipants } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

// ─── Contests ───

router.get('/contests', cache(15), async (req, res) => {
  try {
    const contests = await Contest.find().sort({ createdAt: -1 }).populate('createdBy', 'user_name email');
    res.json({ success: true, contests });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.post('/contests', async (req, res) => {
  try {
    const { title, description, banner_url, startDate, endDate } = req.body;
    const errors = {};
    if (!title) errors.title = 'Title is required.';
    else if (title.length > 200) errors.title = 'Title must be under 200 characters.';
    if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
      errors.endDate = 'End date must be after start date.';
    }
    if (Object.keys(errors).length > 0) return res.status(400).json({ success: false, errors });

    const contest = await Contest.create({
      title,
      description: stripHtml(description || ''),
      banner_url: banner_url || '',
      startDate: startDate || null,
      endDate: endDate || null,
      createdBy: req.user.user_id,
    });
    logAdminAction(req, 'Created contest', 'contest', contest._id, `Title: ${title}`);
    await cacheDel(makeCacheKey('/api/contests*'));
    await cacheDel(makeCacheKey('/api/admin/contests*'));
    const host = req.get('host');
    const isLoopback = !host || host.startsWith('localhost') || host.startsWith('127.0.0.1');
    notifyDiscord('new_contest', { contest, base_url: `${isLoopback ? 'http' : 'https'}://${host || 'dailyctf.jkkniuctf.tech'}` });
    res.json({ success: true, message: 'Contest created successfully.', contest });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.get('/contests/:id', async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.id);
    if (!contest) return res.status(404).json({ success: false, error: 'Contest not found.' });
    res.json({ success: true, contest });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.put('/contests/:id', async (req, res) => {
  try {
    const { title, description, banner_url, startDate, endDate, isArchived, paused, submission_status, scoreboard_visibility, scoreboard_freeze_time, participation_mode, max_team_size } = req.body;
    const contest = await Contest.findById(req.params.id);
    if (!contest) return res.status(404).json({ success: false, error: 'Contest not found.' });
    const wasArchived = contest.isArchived;

    if (title !== undefined) contest.title = title;
    if (description !== undefined) contest.description = stripHtml(description);
    if (banner_url !== undefined) contest.banner_url = banner_url;
    if (startDate !== undefined) contest.startDate = startDate;
    if (endDate !== undefined) contest.endDate = endDate;
    if (contest.startDate && contest.endDate && new Date(contest.startDate) >= new Date(contest.endDate)) {
      return res.status(400).json({ success: false, error: 'End date must be after start date.' });
    }
    if (isArchived !== undefined) contest.isArchived = isArchived;
    if (paused !== undefined) contest.paused = paused;
    if (submission_status !== undefined) contest.submission_status = submission_status;
    if (scoreboard_visibility !== undefined) contest.scoreboard_visibility = scoreboard_visibility;
    if (scoreboard_freeze_time !== undefined) contest.scoreboard_freeze_time = scoreboard_freeze_time;
    if (participation_mode !== undefined) contest.participation_mode = participation_mode;
    if (max_team_size !== undefined) contest.max_team_size = max_team_size;

    await contest.save();
    if (isArchived === true && !wasArchived) {
      const scoreboard = await getScoreSummary(contest._id, 5);
      notifyDiscord('contest_end', { contest_title: contest.title, contest_id: contest._id, scoreboard });
    }
    logAdminAction(req, 'Updated contest', 'contest', contest._id, `Title: ${contest.title}`);
    await cacheDel(makeCacheKey('/api/contests*'));
    await cacheDel(makeCacheKey(`/api/admin/contests*`));
    await cacheDel(makeCacheKey(`/api/contests/${req.params.id}*`));
    res.json({ success: true, message: 'Contest updated successfully.', contest });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.delete('/contests/:id', async (req, res) => {
  try {
    const contestId = req.params.id;
    await Flag.deleteMany({ challenge_id: { $in: (await Challenge.find({ contest_id: contestId })).map(c => c._id) } });
    await Challenge.deleteMany({ contest_id: contestId });
    await Submission.deleteMany({ contest_id: contestId });
    await Solve.deleteMany({ contest_id: contestId });
    const deletedContest = await Contest.findByIdAndDelete(contestId);
    logAdminAction(req, 'Deleted contest', 'contest', contestId, `Title: ${deletedContest?.title || contestId}`);
    await cacheDel(makeCacheKey('/api/contests*'));
    await cacheDel(makeCacheKey('/api/admin/contests*'));
    res.json({ success: true, message: 'Contest and all associated data deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

// ─── Contest Banner Upload ───

router.post('/upload-banner', (req, res) => {
  uploadBanner(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, error: err.message });
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded.' });
    try {
      const banner_url = await storeFile(req.file, 'banners', 'image');
      logAdminAction(req, 'Uploaded banner', 'banner', '', `File: ${req.file.originalname}`);
      res.json({ success: true, banner_url });
    } catch { res.status(500).json({ success: false, error: 'Server error.' }); }
  });
});

router.post('/contests/:id/banner', (req, res) => {
  uploadBanner(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, error: err.message });
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded.' });
    try {
      const banner_url = await storeFile(req.file, 'banners', 'image');
      const contest = await Contest.findByIdAndUpdate(req.params.id, { banner_url }, { new: true });
      if (!contest) return res.status(404).json({ success: false, error: 'Contest not found.' });
      res.json({ success: true, banner_url });
    } catch { res.status(500).json({ success: false, error: 'Server error.' }); }
  });
});

// ─── Challenges (admin, contest-scoped) ───

router.get('/contests/:contestId/challenges', cache(15), async (req, res) => {
  try {
    const contestId = req.params.contestId;
    const challenges = await Challenge.find({ contest_id: contestId }).sort({ category: 1 });

    const solvesAgg = await Solve.aggregate([
      { $match: { contest_id: new mongoose.Types.ObjectId(contestId) } },
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
    const solveMap = new Map();
    for (const s of solvesAgg) {
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

    const result = [];
    for (const ch of challenges) {
      const flags = await Flag.find({ challenge_id: ch._id });
      const sol = solveMap.get(ch._id.toString()) || { count: 0, solvers: [] };
      result.push({
        ...ch.toObject(),
        flags: flags.map(f => f.value),
        is_case_sensitive: flags.length > 0 ? flags[0].is_case_sensitive : false,
        solves: { count: sol.count, solvers: sol.solvers },
      });
    }
    res.json({ success: true, challenges: result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.post('/contests/:contestId/challenges', async (req, res) => {
  try {
    const { challenge_name, category, description, points, max_attempts, flag_value, case_sensitive, visibility, submission_enabled } = req.body;
    const contestId = req.params.contestId;

    const contest = await Contest.findById(contestId);
    if (!contest) return res.status(404).json({ success: false, error: 'Contest not found.' });

    const errors = {};
    if (!challenge_name) errors.challenge_name = 'Challenge name is required.';
    else if (challenge_name.length > 200) errors.challenge_name = 'Challenge name must be under 200 characters.';
    if (!category) errors.category = 'Category is required.';
    else if (category.length > 100) errors.category = 'Category must be under 100 characters.';
    if (!description) errors.description = 'Description is required.';
    else if (description.length > 10000) errors.description = 'Description must be under 10000 characters.';
    if (!points || points <= 0) errors.points = 'Points must be positive.';
    if (!max_attempts || max_attempts <= 0) errors.max_attempts = 'Max attempts must be positive.';
    if (!flag_value) errors.flag_value = 'At least one flag is required.';

    if (Object.keys(errors).length > 0) return res.status(400).json({ success: false, errors });

    const sanitizedDescription = stripHtml(description || '');

    const challenge = await Challenge.create({
      contest_id: contestId,
      name: challenge_name,
      description: sanitizedDescription,
      point: points,
      max_attempts,
      category,
      visibility: visibility ?? 1,
      submission_enabled: submission_enabled ?? 1,
    });

    const flags = flag_value.split(',').map(f => f.trim()).filter(Boolean);
    for (const value of flags) {
      await Flag.create({
        value,
        challenge_id: challenge._id,
        is_case_sensitive: case_sensitive === 1 || case_sensitive === true,
      });
    }

    logAdminAction(req, 'Created challenge', 'challenge', challenge._id, `Name: ${challenge_name}, Contest: ${contestId}`);
    await cacheDel(makeCacheKey(`/api/contests/${contestId}/challenges*`));
    await cacheDel(makeCacheKey(`/api/admin/contests/${contestId}/challenges*`));
    notifyDiscord('new_challenge', { challenge, contest });
    res.json({ success: true, message: 'Challenge added successfully.', challenge });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

// ─── Bulk Challenge Operations (must be before /challenges/:id routes) ───

router.post('/challenges/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, error: 'No challenge IDs provided.' });

    const challenges = await Challenge.find({ _id: { $in: ids } });
    const contestIds = [...new Set(challenges.map(c => c.contest_id.toString()))];

    await Flag.deleteMany({ challenge_id: { $in: ids } });
    await Challenge.deleteMany({ _id: { $in: ids } });

    for (const cid of contestIds) {
      await cacheDel(makeCacheKey(`/api/contests/${cid}/challenges*`));
      await cacheDel(makeCacheKey(`/api/admin/contests/${cid}/challenges*`));
    }

    logAdminAction(req, 'Bulk deleted challenges', 'challenge', '', `IDs: ${ids.join(', ')}`);
    res.json({ success: true, message: `${ids.length} challenges deleted.` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.put('/challenges/bulk-visibility', async (req, res) => {
  try {
    const { ids, visibility } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, error: 'No challenge IDs provided.' });
    if (visibility !== 0 && visibility !== 1) return res.status(400).json({ success: false, error: 'Visibility must be 0 or 1.' });

    const challenges = await Challenge.find({ _id: { $in: ids } });
    const contestIds = [...new Set(challenges.map(c => c.contest_id.toString()))];

    await Challenge.updateMany({ _id: { $in: ids } }, { $set: { visibility } });

    for (const cid of contestIds) {
      await cacheDel(makeCacheKey(`/api/contests/${cid}/challenges*`));
      await cacheDel(makeCacheKey(`/api/admin/contests/${cid}/challenges*`));
    }

    logAdminAction(req, `Bulk set challenges visibility to ${visibility}`, 'challenge', '', `IDs: ${ids.join(', ')}`);
    res.json({ success: true, message: `${ids.length} challenges updated.` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.put('/challenges/bulk-submission', async (req, res) => {
  try {
    const { ids, submission_enabled } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, error: 'No challenge IDs provided.' });
    if (submission_enabled !== 0 && submission_enabled !== 1) return res.status(400).json({ success: false, error: 'Submission status must be 0 or 1.' });

    const challenges = await Challenge.find({ _id: { $in: ids } });
    const contestIds = [...new Set(challenges.map(c => c.contest_id.toString()))];

    await Challenge.updateMany({ _id: { $in: ids } }, { $set: { submission_enabled } });

    for (const cid of contestIds) {
      await cacheDel(makeCacheKey(`/api/contests/${cid}/challenges*`));
      await cacheDel(makeCacheKey(`/api/admin/contests/${cid}/challenges*`));
    }

    logAdminAction(req, `Bulk set challenges submission to ${submission_enabled}`, 'challenge', '', `IDs: ${ids.join(', ')}`);
    res.json({ success: true, message: `${ids.length} challenges updated.` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.put('/challenges/:id', async (req, res) => {
  try {
    const { challenge_name, category, description, points, max_attempts, flag_value, case_sensitive, visibility, submission_enabled } = req.body;
    const challenge = await Challenge.findByIdAndUpdate(req.params.id, {
      name: challenge_name,
      description: stripHtml(description || ''),
      point: points,
      max_attempts,
      category,
      visibility,
      submission_enabled,
    });

    if (!challenge) return res.status(404).json({ success: false, error: 'Challenge not found.' });

    await Flag.deleteMany({ challenge_id: req.params.id });

    const flags = flag_value.split(',').map(f => f.trim()).filter(Boolean);
    for (const value of flags) {
      await Flag.create({
        value,
        challenge_id: req.params.id,
        is_case_sensitive: case_sensitive === 1 || case_sensitive === true,
      });
    }

    logAdminAction(req, 'Updated challenge', 'challenge', req.params.id, `Name: ${challenge_name}`);
    const challengeDoc = await Challenge.findById(req.params.id);
    if (challengeDoc) {
      await cacheDel(makeCacheKey(`/api/contests/${challengeDoc.contest_id}/challenges*`));
      await cacheDel(makeCacheKey(`/api/admin/contests/${challengeDoc.contest_id}/challenges*`));
    }
    res.json({ success: true, message: 'Challenge updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.delete('/challenges/:id', async (req, res) => {
  try {
    const challenge = await Challenge.findById(req.params.id);
    await Flag.deleteMany({ challenge_id: req.params.id });
    const deletedChallenge = await Challenge.findByIdAndDelete(req.params.id);
    logAdminAction(req, 'Deleted challenge', 'challenge', req.params.id, `Name: ${deletedChallenge?.name || req.params.id}`);
    if (challenge) {
      await cacheDel(makeCacheKey(`/api/contests/${challenge.contest_id}/challenges*`));
      await cacheDel(makeCacheKey(`/api/admin/contests/${challenge.contest_id}/challenges*`));
    }
    res.json({ success: true, message: 'Challenge deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.put('/challenges/:id/toggle-visibility', async (req, res) => {
  try {
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) return res.status(404).json({ success: false, error: 'Challenge not found.' });

    challenge.visibility = challenge.visibility === 1 ? 0 : 1;
    await challenge.save();

    await cacheDel(makeCacheKey(`/api/contests/${challenge.contest_id}/challenges*`));
    await cacheDel(makeCacheKey(`/api/admin/contests/${challenge.contest_id}/challenges*`));

    logAdminAction(req, 'Toggled challenge visibility', 'challenge', challenge._id, `Name: ${challenge.name}, Visible: ${challenge.visibility}`);
    res.json({
      success: true,
      message: `Challenge visibility updated to ${challenge.visibility === 1 ? 'Visible' : 'Hidden'}.`,
      new_visibility: challenge.visibility,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.put('/challenges/:id/toggle-submission', async (req, res) => {
  try {
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) return res.status(404).json({ success: false, error: 'Challenge not found.' });

    challenge.submission_enabled = challenge.submission_enabled === 1 ? 0 : 1;
    await challenge.save();

    await cacheDel(makeCacheKey(`/api/contests/${challenge.contest_id}/challenges*`));
    await cacheDel(makeCacheKey(`/api/admin/contests/${challenge.contest_id}/challenges*`));

    logAdminAction(req, 'Toggled challenge submission', 'challenge', challenge._id, `Name: ${challenge.name}, Solving enabled: ${challenge.submission_enabled}`);
    res.json({
      success: true,
      message: challenge.submission_enabled === 1
        ? 'Challenge solving enabled — points will count.'
        : 'Challenge locked — now open for practice only (no points awarded).',
      new_submission_enabled: challenge.submission_enabled,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

// ─── Challenge File Upload ───

router.post('/challenges/:id/upload', (req, res) => {
  uploadChallengeFile(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, error: err.message });
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded.' });
    try {
      const fileUrl = await storeFile(req.file, 'challenges', 'raw');
      const challenge = await Challenge.findByIdAndUpdate(
        req.params.id,
        { $push: { files: fileUrl } },
        { new: true }
      );
      if (!challenge) return res.status(404).json({ success: false, error: 'Challenge not found.' });
      logAdminAction(req, 'Uploaded challenge file', 'challenge', req.params.id, `File: ${req.file.originalname}`);
      res.json({ success: true, files: challenge.files });
    } catch { res.status(500).json({ success: false, error: 'Server error.' }); }
  });
});

router.delete('/challenges/:id/files', async (req, res) => {
  try {
    const { fileUrl } = req.body;
    if (!fileUrl) return res.status(400).json({ success: false, error: 'File URL is required.' });
    const challenge = await Challenge.findByIdAndUpdate(
      req.params.id,
      { $pull: { files: fileUrl } },
      { new: true }
    );
    if (!challenge) return res.status(404).json({ success: false, error: 'Challenge not found.' });
    await deleteStoredFile(fileUrl);
    logAdminAction(req, 'Deleted challenge file', 'challenge', req.params.id, `File: ${fileUrl}`);
    res.json({ success: true, files: challenge.files });
  } catch { res.status(500).json({ success: false, error: 'Server error.' }); }
});

// ─── Users ───

router.get('/users', cache(30), async (req, res) => {
  try {
    const users = await User.find().sort({ id: 1 }).select('-session');
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.get('/users/pending', async (req, res) => {
  try {
    const users = await User.find({ status: 0 }).select('-session');
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.put('/users/:id/status', async (req, res) => {
  try {
    const { action } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' });

    if (action === 'approved') {
      user.status = 1;
      await user.save();
      logAdminAction(req, 'Approved user', 'user', req.params.id);
      res.json({ success: true, message: 'User has been approved.' });
    } else if (action === 'rejected') {
      user.status = 3;
      await user.save();
      logAdminAction(req, 'Rejected user', 'user', req.params.id);
      res.json({ success: true, message: 'User has been rejected.' });
    } else {
      res.status(400).json({ success: false, error: 'Invalid action.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const { full_name, user_name, email, new_password } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' });

    if (user.role === 2 && req.user.user_id !== req.params.id) {
      return res.status(403).json({ success: false, error: 'Only the superadmin account itself can modify it.' });
    }
    if (user.role === 0 && req.user.role === 0 && req.user.user_id !== req.params.id) {
      return res.status(403).json({ success: false, error: 'Admins cannot modify other admins.' });
    }

    if (new_password) {
      if (new_password.length < 8) return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });
      if (!/[A-Z]/.test(new_password)) return res.status(400).json({ success: false, error: 'Password must contain an uppercase letter.' });
      if (!/[a-z]/.test(new_password)) return res.status(400).json({ success: false, error: 'Password must contain a lowercase letter.' });
      if (!/[0-9]/.test(new_password)) return res.status(400).json({ success: false, error: 'Password must contain a number.' });
      user.password = new_password;
      user.token_version = (user.token_version || 0) + 1;
    }
    if (full_name) {
      if (full_name.length > 100) return res.status(400).json({ success: false, error: 'Full name must be under 100 characters.' });
      user.full_name = full_name;
    }
    if (user_name) {
      if (user_name.length > 30) return res.status(400).json({ success: false, error: 'Username must be under 30 characters.' });
      const existingUser = await User.findOne({ user_name, _id: { $ne: req.params.id } });
      if (existingUser) return res.status(400).json({ success: false, error: 'Username is already taken.' });
      user.user_name = user_name;
    }
    if (email) {
      const normalizedEmail = normalizeEmail(email);
      if (!EMAIL_RE.test(normalizedEmail)) return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
      if (normalizedEmail.length > 100) return res.status(400).json({ success: false, error: 'Email must be under 100 characters.' });
      const existingEmail = await User.findOne({ email: normalizedEmail, _id: { $ne: req.params.id } });
      if (existingEmail) return res.status(400).json({ success: false, error: 'Email is already registered.' });
      user.email = normalizedEmail;
    }
    await user.save();
    logAdminAction(req, 'Updated user', 'user', req.params.id);
    res.json({ success: true, message: 'User updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.post('/users', async (req, res) => {
  try {
    const { member_id, full_name, user_name, password, session } = req.body;
    const email = normalizeEmail(req.body.email);
    const errors = {};
    if (!full_name) errors.full_name = 'Full name is required.';
    else if (full_name.length > 100) errors.full_name = 'Full name must be under 100 characters.';
    if (!user_name) errors.user_name = 'Username is required.';
    else if (user_name.length > 30) errors.user_name = 'Username must be under 30 characters.';
    if (!email) errors.email = 'Email is required.';
    else if (!EMAIL_RE.test(email)) errors.email = 'Please provide a valid email address.';
    else if (email.length > 100) errors.email = 'Email must be under 100 characters.';
    if (member_id && !/^\d+$/.test(String(member_id))) errors.member_id = 'Member ID must be numeric.';
    if (!password) errors.password = 'Password is required.';
    else if (password.length < 8) errors.password = 'Password must be at least 8 characters.';
    else if (!/[A-Z]/.test(password)) errors.password = 'Password must contain an uppercase letter.';
    else if (!/[a-z]/.test(password)) errors.password = 'Password must contain a lowercase letter.';
    else if (!/[0-9]/.test(password)) errors.password = 'Password must contain a number.';
    if (Object.keys(errors).length > 0) return res.status(400).json({ success: false, errors });

    const existingEmail = await User.findOne({ email });
    if (existingEmail) return res.status(400).json({ success: false, error: 'Email is already registered.' });

    const existingUsername = await User.findOne({ user_name });
    if (existingUsername) return res.status(400).json({ success: false, error: 'Username is already taken.' });

    const user = await User.create({
      member_id: member_id ? Number(member_id) : Math.floor(Math.random() * 100000),
      full_name,
      user_name,
      email,
      password,
      session: session || '',
      role: 1,
      status: 1,
    });
    logAdminAction(req, 'Created user', 'user', user._id);
    res.json({ success: true, message: 'User created successfully.', user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, error: 'User not found.' });
    if (target.role === 2) {
      return res.status(403).json({ success: false, error: 'Cannot delete a superadmin.' });
    }
    if (target.role === 0) {
      return res.status(403).json({ success: false, error: 'Cannot delete another admin.' });
    }
    await User.findByIdAndDelete(req.params.id);
    logAdminAction(req, 'Deleted user', 'user', req.params.id);
    res.json({ success: true, message: 'User has been deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.post('/users/:id/make-admin', superAdminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { role: 0 }, { new: true });
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' });
    logAdminAction(req, 'Promoted user to admin', 'user', req.params.id, `Username: ${user.user_name}`);
    res.json({ success: true, message: 'User promoted to admin.' });
  } catch { res.status(500).json({ success: false, error: 'Server error.' }); }
});

router.post('/users/:id/make-superadmin', superAdminOnly, async (req, res) => {
  try {
    const existing = await User.findOne({ role: 2, _id: { $ne: req.params.id } });
    if (existing) return res.status(400).json({ success: false, error: 'Only one superadmin account is allowed.' });

    const user = await User.findByIdAndUpdate(req.params.id, { role: 2 }, { new: true });
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' });
    logAdminAction(req, 'Promoted user to superadmin', 'user', req.params.id, `Username: ${user.user_name}`);
    res.json({ success: true, message: 'User promoted to superadmin.' });
  } catch { res.status(500).json({ success: false, error: 'Server error.' }); }
});

router.post('/users/:id/demote', superAdminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' });
    if (user.role !== 0) return res.status(400).json({ success: false, error: 'Only admins can be demoted.' });

    const superadmin = await User.findOne({ role: 2 });
    if (superadmin && superadmin._id.toString() === req.user.user_id && user.role === 2) {
      return res.status(400).json({ success: false, error: 'Cannot demote yourself.' });
    }

    user.role = 1;
    await user.save();
    logAdminAction(req, 'Demoted admin to user', 'user', req.params.id, `Username: ${user.user_name}`);
    res.json({ success: true, message: 'Admin demoted to user.' });
  } catch { res.status(500).json({ success: false, error: 'Server error.' }); }
});

// ─── Pre-registration ───

router.put('/contests/:id/pre-registration', async (req, res) => {
  try {
    const { enabled, fields } = req.body;
    const contest = await Contest.findById(req.params.id);
    if (!contest) return res.status(404).json({ success: false, error: 'Contest not found.' });
    if (enabled !== undefined) contest.pre_registration_enabled = enabled;
    if (fields !== undefined) contest.pre_registration_fields = fields;
    await contest.save();
    logAdminAction(req, `${enabled ? 'Enabled' : 'Disabled'} pre-registration`, 'contest', contest._id, `Title: ${contest.title}`);
    await cacheDel(makeCacheKey('/api/admin/contests*'));
    await cacheDel(makeCacheKey(`/api/contests/${req.params.id}*`));
    res.json({ success: true, message: 'Pre-registration settings updated.' });
  } catch { res.status(500).json({ success: false, error: 'Server error.' }); }
});

router.get('/contests/:id/pre-registrations', async (req, res) => {
  try {
    const list = await PreRegistration.find({ contest_id: req.params.id })
      .populate('user_id', 'user_name full_name email member_id')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: list });
  } catch { res.status(500).json({ success: false, error: 'Server error.' }); }
});

router.put('/contests/:id/pre-registrations/:userId/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['accepted', 'rejected'].includes(status))
      return res.status(400).json({ success: false, error: 'Invalid status.' });
    const updated = await PreRegistration.findOneAndUpdate(
      { contest_id: req.params.id, user_id: req.params.userId },
      { status },
      { new: true }
    );
    if (!updated) return res.status(404).json({ success: false, error: 'Pre-registration not found.' });
    logAdminAction(req, `${status} pre-registration`, 'contest', req.params.id);
    res.json({ success: true, message: `Pre-registration ${status}.`, data: updated });
  } catch { res.status(500).json({ success: false, error: 'Server error.' }); }
});

router.delete('/contests/:id/pre-registrations/:userId', async (req, res) => {
  try {
    await PreRegistration.findOneAndDelete({ contest_id: req.params.id, user_id: req.params.userId });
    logAdminAction(req, 'Removed pre-registration', 'contest', req.params.id);
    res.json({ success: true, message: 'Pre-registration removed.' });
  } catch { res.status(500).json({ success: false, error: 'Server error.' }); }
});

router.get('/contests/:id/pre-registrations/export', async (req, res) => {
  try {
    const list = await PreRegistration.find({ contest_id: req.params.id })
      .populate('user_id', 'user_name full_name email member_id')
      .sort({ createdAt: -1 });

    const contest = await Contest.findById(req.params.id);
    const fieldLabels = (contest?.pre_registration_fields || []).map(f => f.label);

    const header = ['Name', 'Email', 'Username', 'Member ID', 'Status', 'Registered At', ...fieldLabels];
    const rows = list.map(r => {
      const base = [
        r.user_id?.full_name || '',
        r.user_id?.email || '',
        r.user_id?.user_name || '',
        r.user_id?.member_id || '',
        r.status || 'pending',
        r.createdAt ? new Date(r.createdAt).toISOString() : '',
      ];
      const fieldVals = fieldLabels.map(l => (r.data?.get ? r.data.get(l) : (r.data?.[l] || '')) || '');
      return base.concat(fieldVals);
    });

    const csv = [header.join(','), ...rows.map(r => r.map(v => csvValue(v)).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="pre-registrations-${req.params.id}.csv"`);
    res.send(csv);
  } catch { res.status(500).json({ success: false, error: 'Server error.' }); }
});

// ─── Bans (per-contest user/team bans) ───
// Banning only revokes access to the contest. Solves, submissions and points stay intact,
// and are unaffected when the ban is later removed.

router.get('/contests/:id/bans', async (req, res) => {
  try {
    const bans = await ContestBan.find({ contest_id: req.params.id })
      .populate('user_id', 'user_name full_name email')
      .populate('team_id', 'name')
      .populate('banned_by', 'user_name')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: bans });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.post('/contests/:id/bans', async (req, res) => {
  try {
    const { user_id, team_id, reason } = req.body;
    const contest = await Contest.findById(req.params.id);
    if (!contest) return res.status(404).json({ success: false, error: 'Contest not found.' });

    const filter = { contest_id: contest._id };
    if (user_id && mongoose.Types.ObjectId.isValid(user_id)) {
      filter.user_id = user_id;
    } else if (team_id && mongoose.Types.ObjectId.isValid(team_id)) {
      filter.team_id = team_id;
    } else {
      return res.status(400).json({ success: false, error: 'Provide a valid user_id or team_id to ban.' });
    }

    let targetName = '';
    if (filter.team_id) {
      const team = await Team.findOne({ _id: filter.team_id, contest_id: contest._id });
      if (!team) return res.status(404).json({ success: false, error: 'Team not found in this contest.' });
      targetName = team.name;
    } else {
      const user = await User.findById(filter.user_id);
      if (!user) return res.status(404).json({ success: false, error: 'User not found.' });
      if (user.role !== 1) return res.status(400).json({ success: false, error: 'You cannot ban admins.' });
      targetName = user.user_name;
    }

    const existing = await ContestBan.findOne(filter);
    if (existing) return res.json({ success: true, message: 'Already banned from this contest.', ban: existing });

    const ban = await ContestBan.create({
      contest_id: contest._id,
      user_id: filter.user_id || null,
      team_id: filter.team_id || null,
      reason: String(reason || '').slice(0, 500),
      banned_by: req.user.user_id,
    });
    const target = filter.team_id ? `Team ${team_id}` : `User ${user_id}`;
    logAdminAction(req, 'Banned from contest', 'contest', contest._id, `Banned ${target}${reason ? `: ${reason}` : ''}`);
    notifyDiscord('ban', {
      target_type: filter.team_id ? 'team' : 'user',
      target_name: targetName,
      contest_title: contest.title,
      reason: String(reason || ''),
    });

    res.json({ success: true, message: 'User/team banned from the contest. Their saved points remain intact.', ban });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.delete('/contests/:id/bans/:banId', async (req, res) => {
  try {
    const ban = await ContestBan.findOneAndDelete({ _id: req.params.banId, contest_id: req.params.id });
    if (!ban) return res.status(404).json({ success: false, error: 'Ban not found.' });
    logAdminAction(req, 'Unbanned from contest', 'contest', req.params.id,
      ban.team_id ? `Unbanned team ${ban.team_id}` : `Unbanned user ${ban.user_id}`);
    res.json({ success: true, message: 'Unbanned. All previously earned points remain intact.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

// ─── Submissions ───

router.get('/submissions', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const contestId = req.query.contestId;

    const filter = {};
    if (contestId) filter.contest_id = contestId;

    const total = await Submission.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    const submissions = await Submission.find(filter)
      .populate('user_id', 'user_name')
      .populate('challenge_id', 'name point')
      .populate('contest_id', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const data = submissions.map(s => ({
      submission_id: s._id,
      user_name: s.user_id?.user_name,
      challenge_name: s.challenge_id?.name,
      challenge_point: s.challenge_id?.point,
      challenge_id: s.challenge_id?._id,
      contest_title: s.contest_id?.title,
      submitted_flag: s.submitted_flag,
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

router.get('/submissions/:id', async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate('user_id', 'user_name full_name email member_id')
      .populate({ path: 'team_id', select: 'name captain', populate: { path: 'captain', select: 'user_name' } })
      .populate('challenge_id', 'name category point max_attempts description')
      .populate('contest_id', 'title participation_mode');

    if (!submission) return res.status(404).json({ success: false, error: 'Submission not found.' });

    const solve = await Solve.findOne({ submission_id: submission._id }).select('_id solved_at').lean();

    res.json({
      success: true,
      data: {
        submission_id: submission._id,
        submitted_flag: submission.submitted_flag,
        submission_type: submission.submission_type,
        practice: !!submission.practice,
        user: submission.user_id,
        team: submission.team_id,
        challenge: submission.challenge_id,
        contest: submission.contest_id,
        solve,
        timestamp_of_submission: submission.createdAt,
        updated_at: submission.updatedAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.get('/solves', async (req, res) => {
  try {
    const contestId = req.query.contestId;
    const filter = {};
    if (contestId) filter.contest_id = contestId;

    const solves = await Solve.find(filter)
      .populate('user_id', 'user_name')
      .populate('challenge_id', 'name point')
      .populate('submission_id', 'submitted_flag submission_type createdAt')
      .populate('contest_id', 'title')
      .sort({ solved_at: -1 });

    const data = solves.map(s => ({
      id: s._id,
      submission_id: s.submission_id?._id,
      user_name: s.user_id?.user_name,
      challenge_name: s.challenge_id?.name,
      challenge_point: s.challenge_id?.point,
      challenge_id: s.challenge_id?._id,
      contest_title: s.contest_id?.title,
      submitted_flag: s.submission_id?.submitted_flag,
      submission_type: s.submission_id?.submission_type,
      timestamp_of_submission: s.submission_id?.createdAt,
    }));

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

// ─── Platform Status ───

router.get('/platform-status', superAdminOnly, async (req, res) => {
  try {
    let status = await PlatformStatus.findById('000000000000000000000001');
    if (!status) {
      status = await PlatformStatus.create({
        _id: '000000000000000000000001',
        submission_status: 'closed',
      });
    }
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.put('/platform-status', superAdminOnly, async (req, res) => {
  try {
    const { action, start_time, end_time } = req.body;
    let update = {};

    switch (action) {
      case 'manual_open':
        update = { submission_status: 'open', submission_start_time: null, submission_end_time: null };
        break;
      case 'manual_close':
        update = { submission_status: 'closed', submission_start_time: null, submission_end_time: null };
        break;
      case 'schedule':
        update = {
          submission_status: 'open',
          submission_start_time: start_time || null,
          submission_end_time: end_time || null,
        };
        break;
      case 'update_branding':
        update = {};
        if (req.body.platform_name !== undefined) update.platform_name = req.body.platform_name;
        if (req.body.logo_url !== undefined) update.logo_url = req.body.logo_url;
        if (Object.keys(update).length === 0) return res.status(400).json({ success: false, error: 'No fields to update.' });
        break;
      default:
        return res.status(400).json({ success: false, error: 'Invalid action.' });
    }

    await PlatformStatus.findByIdAndUpdate('000000000000000000000001', update);
    logAdminAction(req, 'Updated platform status', 'settings', '', `Action: ${action}`);
    res.json({ success: true, message: 'Platform status updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

// ─── Logo Upload ───

router.post('/upload-logo', superAdminOnly, (req, res) => {
  uploadBanner(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, error: err.message });
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded.' });
    try {
      const logo_url = await storeFile(req.file, 'banners', 'image');
      await PlatformStatus.findByIdAndUpdate('000000000000000000000001', { logo_url });
      logAdminAction(req, 'Updated platform logo', 'settings', '', `Logo: ${logo_url}`);
      res.json({ success: true, logo_url });
    } catch { res.status(500).json({ success: false, error: 'Server error.' }); }
  });
});

// ─── SMTP Configuration ───

router.get('/smtp-config', superAdminOnly, async (req, res) => {
  try {
    let status = await PlatformStatus.findById('000000000000000000000001').select('smtp_host smtp_port smtp_secure smtp_user smtp_pass smtp_from_email smtp_from_name');
    if (!status) return res.json({ success: true, data: {} });
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.put('/smtp-config', superAdminOnly, async (req, res) => {
  try {
    const { smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, smtp_from_email, smtp_from_name } = req.body;
    const update = {};
    if (smtp_host !== undefined) update.smtp_host = stripHtml(smtp_host).trim();
    if (smtp_port !== undefined) update.smtp_port = Number(smtp_port);
    if (smtp_secure !== undefined) update.smtp_secure = Boolean(smtp_secure);
    if (smtp_user !== undefined) update.smtp_user = stripHtml(smtp_user).trim();
    if (smtp_pass !== undefined) update.smtp_pass = smtp_pass.trim();
    if (smtp_from_email !== undefined) update.smtp_from_email = stripHtml(smtp_from_email).trim();
    if (smtp_from_name !== undefined) update.smtp_from_name = stripHtml(smtp_from_name).trim();
    if (Object.keys(update).length === 0) return res.status(400).json({ success: false, error: 'No fields to update.' });
    await PlatformStatus.findByIdAndUpdate('000000000000000000000001', update);
    logAdminAction(req, 'Updated SMTP config', 'settings');
    res.json({ success: true, message: 'SMTP configuration saved.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.post('/test-smtp', superAdminOnly, async (req, res) => {
  try {
    const nodemailer = (await import('nodemailer')).default;
    let status = await PlatformStatus.findById('000000000000000000000001');
    if (!status || !status.smtp_host || !status.smtp_user || !status.smtp_pass)
      return res.status(400).json({ success: false, error: 'SMTP not configured.' });
    const transporter = nodemailer.createTransport({
      host: status.smtp_host,
      port: status.smtp_port,
      secure: status.smtp_secure,
      auth: { user: status.smtp_user, pass: status.smtp_pass },
    });
    await transporter.verify();
    res.json({ success: true, message: 'SMTP connection successful.' });
  } catch (err) {
    res.status(500).json({ success: false, error: `SMTP test failed: ${err.message}` });
  }
});

// ─── Discord Notifications ───

router.get('/discord-config', superAdminOnly, async (req, res) => {
  try {
    let status = await PlatformStatus.findById('000000000000000000000001');
    if (!status) status = await PlatformStatus.create({});
    res.json({ success: true, data: status.discord_webhooks });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.put('/discord-config', superAdminOnly, async (req, res) => {
  try {
    const { discord_webhooks } = req.body;
    if (!discord_webhooks || typeof discord_webhooks !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid Discord configuration.' });
    }

    const config = {};
    for (const event of DISCORD_EVENTS) {
      const entry = discord_webhooks[event] || {};
      const url = String(entry.webhook_url || '').trim();
      const enabled = Boolean(entry.enabled);
      if (url && !isValidWebhookUrl(url)) {
        return res.status(400).json({ success: false, error: `Invalid webhook URL for ${event}. Must be a Discord webhook URL.` });
      }
      if (enabled && !url) {
        return res.status(400).json({ success: false, error: `You enabled "${event}" but didn't provide a webhook URL.` });
      }
      config[event] = { enabled: enabled && !!url, webhook_url: url };
    }

    let status = await PlatformStatus.findById('000000000000000000000001');
    if (!status) status = await PlatformStatus.create({});
    status.discord_webhooks = config;
    await status.save();
    logAdminAction(req, 'Updated Discord webhook configuration', 'config');
    res.json({ success: true, message: 'Discord notification settings saved.', data: status.discord_webhooks });
  } catch (err) {
    console.error('discord-config save error:', err.message);
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.post('/discord-config/test', superAdminOnly, async (req, res) => {
  try {
    const { event, webhook_url } = req.body;
    if (!DISCORD_EVENTS.includes(event)) {
      return res.status(400).json({ success: false, error: 'Invalid event.' });
    }
    if (webhook_url && String(webhook_url).trim() && !isValidWebhookUrl(webhook_url)) {
      return res.status(400).json({ success: false, error: 'Invalid webhook URL. Must be a Discord webhook URL.' });
    }
    await sendDiscordTest(event, webhook_url || '');
    res.json({ success: true, message: 'Discord test message sent.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message || 'Discord test failed.' });
  }
});

// ─── Send Email ───

router.post('/send-email', superAdminOnly, async (req, res) => {
  try {
    const { recipients, subject, message } = req.body;
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0)
      return res.status(400).json({ success: false, error: 'No recipients specified.' });
    if (!subject || !subject.trim())
      return res.status(400).json({ success: false, error: 'Subject is required.' });
    if (!message || !message.trim())
      return res.status(400).json({ success: false, error: 'Message is required.' });

    const nodemailer = (await import('nodemailer')).default;
    let status = await PlatformStatus.findById('000000000000000000000001');
    if (!status || !status.smtp_host || !status.smtp_user || !status.smtp_pass)
      return res.status(400).json({ success: false, error: 'SMTP not configured.' });

    const users = await User.find({ _id: { $in: recipients } }).select('email full_name');
    if (users.length === 0)
      return res.status(400).json({ success: false, error: 'No valid users found.' });

    const transporter = nodemailer.createTransport({
      host: status.smtp_host,
      port: status.smtp_port,
      secure: status.smtp_secure,
      auth: { user: status.smtp_user, pass: status.smtp_pass },
    });

    const fromName = status.smtp_from_name || 'JKKNIU CTF';
    const fromEmail = status.smtp_from_email || status.smtp_user;
    const sent = [];
    const failed = [];

    for (const user of users) {
      try {
        await transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to: user.email,
          subject,
          html: message.replace(/\n/g, '<br>'),
        });
        sent.push(user.email);
      } catch (err) {
        failed.push({ email: user.email, error: err.message });
      }
    }

    logAdminAction(req, `Sent email to ${sent.length} user(s)`, 'email');
    res.json({
      success: true,
      message: `Email sent to ${sent.length} user(s)${failed.length ? `, ${failed.length} failed.` : '.'}`,
      sent,
      failed,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

// ─── Team Management ───

router.get('/contests/:contestId/teams', async (req, res) => {
  try {
    const teams = await Team.find({ contest_id: req.params.contestId })
      .populate('captain', 'user_name')
      .populate('members', 'user_name');
    res.json({ success: true, teams });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.put('/teams/:teamId/password', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 8)
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });
    const team = await Team.findById(req.params.teamId);
    if (!team) return res.status(404).json({ success: false, error: 'Team not found.' });
    team.password = await bcrypt.hash(password, 10);
    await team.save();
    logAdminAction(req, `Changed password for team "${team.name}"`, 'team', team._id);
    res.json({ success: true, message: 'Team password updated.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.put('/teams/:teamId/captain', async (req, res) => {
  try {
    const { user_id } = req.body;
    const team = await Team.findById(req.params.teamId);
    if (!team) return res.status(404).json({ success: false, error: 'Team not found.' });
    if (!team.members.some(m => m.toString() === user_id))
      return res.status(400).json({ success: false, error: 'User is not a member of this team.' });
    team.captain = user_id;
    await team.save();
    logAdminAction(req, `Changed captain of team "${team.name}"`, 'team', team._id);
    res.json({ success: true, message: 'Captain updated.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.delete('/teams/:teamId/members/:userId', async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) return res.status(404).json({ success: false, error: 'Team not found.' });
    if (team.captain.toString() === req.params.userId) {
      return res.status(400).json({ success: false, error: 'Cannot remove the captain. Transfer captaincy first.' });
    }
    team.members.pull(req.params.userId);
    await team.save();
    logAdminAction(req, `Removed member from team "${team.name}"`, 'team', team._id);
    res.json({ success: true, message: 'Member removed from team.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.delete('/teams/:teamId', async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) return res.status(404).json({ success: false, error: 'Team not found.' });
    const name = team.name;
    await Team.deleteOne({ _id: team._id });
    logAdminAction(req, `Disbanded team "${name}"`, 'team', req.params.teamId);
    res.json({ success: true, message: 'Team disbanded.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

// ─── Hints ───

router.get('/challenges/:challengeId/hints', async (req, res) => {
  try {
    const hints = await Hint.find({ challenge_id: req.params.challengeId }).sort({ cost: 1 });
    res.json({ success: true, hints });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.post('/challenges/:challengeId/hints', async (req, res) => {
  try {
    const { content, cost } = req.body;
    if (!content) return res.status(400).json({ success: false, error: 'Hint content is required.' });
    const hint = await Hint.create({ challenge_id: req.params.challengeId, content, cost: parseInt(cost) || 0 });
    logAdminAction(req, `Added hint to challenge ${req.params.challengeId}`, 'hint', hint._id);
    res.status(201).json({ success: true, message: 'Hint added!', hint });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.put('/hints/:hintId', async (req, res) => {
  try {
    const { content, cost } = req.body;
    const hint = await Hint.findByIdAndUpdate(req.params.hintId, { content, cost: parseInt(cost) || 0 }, { new: true });
    if (!hint) return res.status(404).json({ success: false, error: 'Hint not found.' });
    logAdminAction(req, `Updated hint ${req.params.hintId}`, 'hint', hint._id);
    res.json({ success: true, message: 'Hint updated!', hint });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.delete('/hints/:hintId', async (req, res) => {
  try {
    const hint = await Hint.findByIdAndDelete(req.params.hintId);
    if (!hint) return res.status(404).json({ success: false, error: 'Hint not found.' });
    logAdminAction(req, `Deleted hint ${req.params.hintId}`, 'hint', hint._id);
    res.json({ success: true, message: 'Hint deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

// ─── Notifications ───

router.get('/contests/:contestId/notifications', async (req, res) => {
  try {
    const notifications = await Notification.find({ contest_id: req.params.contestId }).sort({ createdAt: -1 });
    res.json({ success: true, notifications });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.post('/contests/:contestId/notifications', async (req, res) => {
  try {
    const { title, content, type } = req.body;
    if (!title) return res.status(400).json({ success: false, error: 'Title is required.' });
    const notification = await Notification.create({ contest_id: req.params.contestId, title, content, type: type || 'alert' });
    logAdminAction(req, `Sent notification "${title}"`, 'notification', notification._id);
    await cacheDel(makeCacheKey(`/api/contests/${req.params.contestId}/notifications*`));
    res.status(201).json({ success: true, message: 'Notification sent!', notification });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.delete('/notifications/:notificationId', async (req, res) => {
  try {
    const n = await Notification.findByIdAndDelete(req.params.notificationId);
    if (!n) return res.status(404).json({ success: false, error: 'Notification not found.' });
    logAdminAction(req, `Deleted notification "${n.title}"`, 'notification', n._id);
    res.json({ success: true, message: 'Notification deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

// ─── Scoreboard Export ───

router.get('/scoreboard/:id/export', async (req, res) => {
  try {
    const contest = await Contest.findById(req.params.id);
    if (!contest) return res.status(404).json({ success: false, error: 'Contest not found.' });

    const isFrozen = contest.scoreboard_freeze_time && new Date() > new Date(contest.scoreboard_freeze_time);
    const matchStage = { contest_id: contest._id };
    if (isFrozen) {
      matchStage.solved_at = { $lte: new Date(contest.scoreboard_freeze_time) };
    }

    const pipeline = [
      { $match: matchStage },
      { $lookup: { from: 'challenges', localField: 'challenge_id', foreignField: '_id', as: 'challenge' } },
      { $unwind: '$challenge' },
      { $match: { 'challenge.visibility': 1 } },
    ];

    const { bannedUserIds, bannedTeamIds } = await getContestBans(contest._id);
    const banStage = bannedMatchStage(bannedUserIds, bannedTeamIds);
    if (banStage) pipeline.push(banStage);

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

    pipeline.push({ $sort: { total_score: -1, latest_solve_time: 1 } });

    const scoreboard = await Solve.aggregate(pipeline);

    const header = 'Rank,Name,Score,Last Solve';
    const rows = scoreboard.map((entry, i) => [
      i + 1,
      entry.user_name,
      entry.total_score,
      entry.latest_solve_time ? new Date(entry.latest_solve_time).toISOString() : '',
    ]);

    const csv = [header, ...rows.map(r => r.map(v => csvValue(v)).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="scoreboard-${req.params.id}.csv"`);
    res.send(csv);
  } catch { res.status(500).json({ success: false, error: 'Server error.' }); }
});

// ─── First Blood Export ───

router.get('/first-blood/:id/export', async (req, res) => {
  try {
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

    const bloods = await Solve.aggregate(pipeline);

    const header = 'Challenge,Category,Points,First Solver,Solved At';
    const rows = bloods.map(b => [
      b.challenge_name,
      b.category,
      b.points,
      b.solver_name,
      b.solved_at ? new Date(b.solved_at).toISOString() : '',
    ]);

    const csv = [header, ...rows.map(r => r.map(v => csvValue(v)).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="first-blood-${req.params.id}.csv"`);
    res.send(csv);
  } catch { res.status(500).json({ success: false, error: 'Server error.' }); }
});

// ─── Submission Management ───

router.delete('/submissions/:id', async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission) return res.status(404).json({ success: false, error: 'Submission not found.' });

    if (submission.submission_type === 'correct') {
      await Solve.deleteOne({ submission_id: submission._id });
    }
    const subId = submission._id;
    await Submission.findByIdAndDelete(subId);

    logAdminAction(req, 'Deleted submission', 'submission', subId,
      `Challenge: ${submission.challenge_id}, User: ${submission.user_id}`);

    await cacheDel(makeCacheKey(`/api/contests/${submission.contest_id}/scoreboard*`));
    await cacheDel(makeCacheKey(`/api/admin/submissions*`));

    res.json({ success: true, message: 'Submission deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.put('/submissions/:id/toggle', async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission) return res.status(404).json({ success: false, error: 'Submission not found.' });

    if (submission.submission_type === 'correct') {
      submission.submission_type = 'incorrect';
      await Solve.deleteOne({ submission_id: submission._id });
      await submission.save();
      logAdminAction(req, 'Toggled submission to incorrect', 'submission', submission._id,
        `Challenge: ${submission.challenge_id}, User: ${submission.user_id}`);
    } else {
      submission.submission_type = 'correct';
      const solveData = {
        submission_id: submission._id,
        challenge_id: submission.challenge_id,
        contest_id: submission.contest_id,
        user_id: submission.user_id,
        solved_at: new Date(),
      };
      if (submission.team_id) solveData.team_id = submission.team_id;
      try {
        await Solve.create(solveData);
      } catch (err) {
        if (err.code === 11000) {
          return res.status(400).json({ success: false, error: 'A solve already exists for this submission.' });
        }
        throw err;
      }
      await submission.save();
      const solverName = submission.team_id
        ? (await Team.findById(submission.team_id).select('name'))?.name
        : (await User.findById(submission.user_id).select('user_name'))?.user_name;
      const contestTitle = (await Contest.findById(submission.contest_id).select('title'))?.title;
      notifyBloodIfEarned(submission.contest_id, submission.challenge_id, {
        solver_name: solverName || '—',
        contest_title: contestTitle || '—',
      });
      notifySolve(submission.contest_id, submission.challenge_id, {
        user_id: submission.user_id,
        team_id: submission.team_id || null,
      });
      logAdminAction(req, 'Toggled submission to correct', 'submission', submission._id,
        `Challenge: ${submission.challenge_id}, User: ${submission.user_id}`);
    }

    await cacheDel(makeCacheKey(`/api/contests/${submission.contest_id}/scoreboard*`));
    await cacheDel(makeCacheKey(`/api/admin/submissions*`));

    res.json({ success: true, message: 'Submission updated.', submission_type: submission.submission_type });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

export default router;
