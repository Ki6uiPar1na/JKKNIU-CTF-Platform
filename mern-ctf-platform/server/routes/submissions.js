import { Router } from 'express';
import mongoose from 'mongoose';
import Submission from '../models/Submission.js';
import Solve from '../models/Solve.js';
import Challenge from '../models/Challenge.js';
import Contest from '../models/Contest.js';
import Team from '../models/Team.js';
import Flag from '../models/Flag.js';
import PreRegistration from '../models/PreRegistration.js';
import { cacheDel, makeCacheKey } from '../utils/redis.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

function validId(v) {
  return mongoose.Types.ObjectId.isValid(v);
}

router.post('/submit', verifyToken, async (req, res) => {
  try {
    const { submitted_flag, challenge_id } = req.body;
    const contestId = req.body.contest_id;
    const user_id = req.user.user_id;

    if (!contestId || !validId(contestId)) {
      return res.json({ success: false, submission_type: 'blank', message: 'Invalid contest ID.' });
    }
    if (!challenge_id || !validId(challenge_id)) {
      return res.json({ success: false, submission_type: 'blank', message: 'Invalid challenge ID.' });
    }

    const contest = await Contest.findById(contestId);
    if (!contest) return res.json({ success: false, submission_type: 'blank', message: 'Contest not found.' });

    if (contest.isArchived || (contest.endDate && new Date() > new Date(contest.endDate))) {
      return res.json({ success: false, submission_type: 'blank', message: 'This contest has ended.' });
    }

    const now = new Date();
    if (contest.startDate && now < new Date(contest.startDate)) {
      return res.json({ success: false, submission_type: 'blank', message: 'The contest has not started yet.' });
    }

    if (contest.submission_status === 'closed') {
      return res.json({ success: false, submission_type: 'blank', message: 'Submissions are closed for this contest.' });
    }

    if (contest.paused) {
      return res.json({ success: false, submission_type: 'blank', message: 'Submissions are paused for this contest.' });
    }

    const preReg = await PreRegistration.findOne({ contest_id: contestId, user_id: user_id });
    if (!preReg || preReg.status !== 'accepted') {
      return res.json({ success: false, submission_type: 'blank', message: 'Your pre-registration has not been accepted yet.' });
    }

    let team_id = null;
    if (contest.participation_mode === 'team') {
      const team = await Team.findOne({ contest_id: contestId, members: user_id });
      if (!team) return res.json({ success: false, submission_type: 'blank', message: 'You must be in a team to submit in this contest.' });
      team_id = team._id;
    }

    const challenge = await Challenge.findOne({ _id: challenge_id, contest_id: contestId });
    if (!challenge) {
      return res.json({ success: false, submission_type: 'blank', message: 'Challenge not found.' });
    }

    const subFilter = { challenge_id, contest_id: contestId };
    if (team_id) subFilter.team_id = team_id;
    else subFilter.user_id = user_id;

    const userSubs = await Submission.find(subFilter);
    const totalSubmissions = userSubs.length;
    const solved = userSubs.some(s => s.submission_type === 'correct');

    if (solved) {
      return res.json({ success: false, submission_type: 'already_solved', message: 'This challenge is already solved.' });
    }

    if (totalSubmissions >= challenge.max_attempts) {
      return res.json({ success: false, submission_type: 'blank', message: 'No remaining attempts.' });
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
    });

    let responseMessage = 'Wrong Flag';

    if (submission_type === 'correct') {
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
        await cacheDel(makeCacheKey(`/api/contests/${contestId}/scoreboard*`));
        await cacheDel(makeCacheKey(`/api/contests/${contestId}/scoreboard/timeline*`));
      } catch (err) {
        if (err.code === 11000) {
          return res.json({ success: false, submission_type: 'already_solved', message: 'This challenge is already solved.' });
        }
        throw err;
      }
      responseMessage = 'Correct flag! Challenge solved.';
    }

    res.json({ success: true, submission_type, message: responseMessage });
  } catch (err) {
    res.status(500).json({ success: false, submission_type: 'blank', message: 'Server error.' });
  }
});

export default router;
