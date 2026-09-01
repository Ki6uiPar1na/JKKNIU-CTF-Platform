import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import Contest from '../models/Contest.js';
import Team from '../models/Team.js';
import { verifyToken } from '../middleware/auth.js';
import { cacheDel, makeCacheKey } from '../utils/redis.js';
import { validateObjectId } from '../middleware/validateObjectId.js';
import { getContestBan } from '../utils/contestBan.js';

const router = Router();

router.param('contestId', validateObjectId('contestId'));
router.param('userId', validateObjectId('userId'));

router.post('/:contestId/teams/create', verifyToken, async (req, res) => {
  try {
    const { name, password } = req.body;
    const contest = await Contest.findById(req.params.contestId);
    if (!contest) return res.status(404).json({ success: false, error: 'Contest not found.' });
    if (contest.participation_mode !== 'team')
      return res.status(400).json({ success: false, error: 'This contest does not support teams.' });

    if (await getContestBan(req.params.contestId, req.user.user_id)) {
      return res.status(403).json({ success: false, error: 'You are banned from this contest.' });
    }

    if (!name || !password)
      return res.status(400).json({ success: false, error: 'Team name and password are required.' });
    if (name.length > 100)
      return res.status(400).json({ success: false, error: 'Team name must be under 100 characters.' });
    if (password.length < 8)
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });

    const existing = await Team.findOne({ name, contest_id: contest._id });
    if (existing) return res.status(400).json({ success: false, error: 'A team with that name already exists in this contest.' });

    const hashed = await bcrypt.hash(password, 10);
    const team = await Team.create({
      name,
      password: hashed,
      captain: req.user.user_id,
      members: [req.user.user_id],
      contest_id: contest._id,
    });

    res.status(201).json({ success: true, message: 'Team created!', team });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.post('/:contestId/teams/join', verifyToken, async (req, res) => {
  try {
    const { name, password } = req.body;
    const contest = await Contest.findById(req.params.contestId);
    if (!contest) return res.status(404).json({ success: false, error: 'Contest not found.' });
    if (contest.participation_mode !== 'team')
      return res.status(400).json({ success: false, error: 'This contest does not support teams.' });

    if (await getContestBan(req.params.contestId, req.user.user_id)) {
      return res.status(403).json({ success: false, error: 'You are banned from this contest.' });
    }

    const team = await Team.findOne({ name, contest_id: contest._id });
    if (!team) return res.status(400).json({ success: false, error: 'Team not found.' });

    const match = await bcrypt.compare(password, team.password);
    if (!match) return res.status(400).json({ success: false, error: 'Incorrect team password.' });

    if (team.members.some(m => m.toString() === req.user.user_id))
      return res.status(400).json({ success: false, error: 'You are already in this team.' });

    const inOtherTeam = await Team.findOne({ contest_id: contest._id, members: req.user.user_id });
    if (inOtherTeam)
      return res.status(400).json({ success: false, error: 'You are already in a team for this contest. Leave it first.' });

    const updated = await Team.findOneAndUpdate(
      { _id: team._id, $expr: { $lt: [{ $size: '$members' }, contest.max_team_size] } },
      { $addToSet: { members: req.user.user_id } },
      { new: true }
    );
    if (!updated) return res.status(400).json({ success: false, error: 'Team is full.' });

    res.json({ success: true, message: `Joined ${team.name}!`, team });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.get('/:contestId/teams/my', verifyToken, async (req, res) => {
  try {
    const team = await Team.findOne({ contest_id: req.params.contestId, members: req.user.user_id })
      .populate('captain', 'user_name')
      .populate('members', 'user_name');
    res.json({ success: true, team });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.get('/:contestId/teams', verifyToken, async (req, res) => {
  try {
    const teams = await Team.find({ contest_id: req.params.contestId })
      .select('-invite_code')
      .populate('captain', 'user_name')
      .populate('members', 'user_name');
    res.json({ success: true, teams });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.post('/:contestId/teams/leave', verifyToken, async (req, res) => {
  try {
    const team = await Team.findOne({ contest_id: req.params.contestId, members: req.user.user_id });
    if (!team) return res.status(400).json({ success: false, error: 'You are not in a team for this contest.' });

    if (team.captain.toString() === req.user.user_id) {
      team.members.pull(req.user.user_id);
      if (team.members.length > 0) {
        team.captain = team.members[0];
      } else {
        await Team.deleteOne({ _id: team._id });
        return res.json({ success: true, message: 'Team disbanded.' });
      }
    } else {
      team.members.pull(req.user.user_id);
    }

    await team.save();
    res.json({ success: true, message: 'Left the team.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

// ─── Captain Management Routes ───

router.put('/:contestId/teams/password', verifyToken, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 8)
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });
    const team = await Team.findOne({ contest_id: req.params.contestId, captain: req.user.user_id });
    if (!team) return res.status(403).json({ success: false, error: 'Only the team captain can change the password.' });
    team.password = await bcrypt.hash(password, 10);
    await team.save();
    res.json({ success: true, message: 'Team password updated.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.put('/:contestId/teams/captain', verifyToken, async (req, res) => {
  try {
    const { user_id } = req.body;
    const team = await Team.findOne({ contest_id: req.params.contestId, captain: req.user.user_id });
    if (!team) return res.status(403).json({ success: false, error: 'Only the team captain can transfer captaincy.' });
    if (!team.members.some(m => m.toString() === user_id))
      return res.status(400).json({ success: false, error: 'User is not a member of this team.' });
    team.captain = user_id;
    await team.save();
    res.json({ success: true, message: 'Captain transferred.', team });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

// ─── Invite Link ───

router.post('/:contestId/teams/join-link/:inviteCode', verifyToken, async (req, res) => {
  try {
    const { inviteCode } = req.params;
    const contest = await Contest.findById(req.params.contestId);
    if (!contest) return res.status(404).json({ success: false, error: 'Contest not found.' });

    const team = await Team.findOne({ invite_code: inviteCode, contest_id: req.params.contestId });
    if (!team) return res.status(400).json({ success: false, error: 'Invalid invite link.' });

    if (await getContestBan(req.params.contestId, req.user.user_id)) {
      return res.status(403).json({ success: false, error: 'You are banned from this contest.' });
    }

    if (team.members.some(m => m.toString() === req.user.user_id))
      return res.status(400).json({ success: false, error: 'You are already in this team.' });

    const inOtherTeam = await Team.findOne({ contest_id: req.params.contestId, members: req.user.user_id });
    if (inOtherTeam)
      return res.status(400).json({ success: false, error: 'You are already in a team for this contest. Leave it first.' });

    const updated = await Team.findOneAndUpdate(
      { _id: team._id, $expr: { $lt: [{ $size: '$members' }, contest.max_team_size] } },
      { $addToSet: { members: req.user.user_id } },
      { new: true }
    );
    if (!updated) return res.status(400).json({ success: false, error: 'Team is full.' });

    res.json({ success: true, message: `Joined ${team.name}!`, team });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.post('/:contestId/teams/regenerate-invite', verifyToken, async (req, res) => {
  try {
    const team = await Team.findOne({ contest_id: req.params.contestId, captain: req.user.user_id });
    if (!team) return res.status(403).json({ success: false, error: 'Only the team captain can regenerate the invite link.' });
    team.invite_code = crypto.randomBytes(16).toString('hex');
    await team.save();
    res.json({ success: true, invite_code: team.invite_code, message: 'Invite link regenerated.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.delete('/:contestId/teams/members/:userId', verifyToken, async (req, res) => {
  try {
    const team = await Team.findOne({ contest_id: req.params.contestId, captain: req.user.user_id });
    if (!team) return res.status(403).json({ success: false, error: 'Only the team captain can remove members.' });
    if (team.captain.toString() === req.params.userId)
      return res.status(400).json({ success: false, error: 'Cannot remove the captain. Transfer captaincy first.' });
    team.members.pull(req.params.userId);
    await team.save();
    res.json({ success: true, message: 'Member removed from team.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

router.delete('/:contestId/teams/disband', verifyToken, async (req, res) => {
  try {
    const team = await Team.findOne({ contest_id: req.params.contestId, captain: req.user.user_id });
    if (!team) return res.status(403).json({ success: false, error: 'Only the team captain can disband the team.' });
    const name = team.name;
    await Team.deleteOne({ _id: team._id });
    res.json({ success: true, message: `Team "${name}" disbanded.` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

export default router;
