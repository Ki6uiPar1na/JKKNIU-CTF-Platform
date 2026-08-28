import ContestBan from '../models/ContestBan.js';
import Team from '../models/Team.js';

export async function getContestBan(contestId, userId) {
  const userBan = await ContestBan.findOne({ contest_id: contestId, user_id: userId }).lean();
  if (userBan) return userBan;

  const team = await Team.findOne({ contest_id: contestId, members: userId }).select('_id').lean();
  if (!team) return null;

  return ContestBan.findOne({ contest_id: contestId, team_id: team._id }).lean();
}

export async function getContestBans(contestId) {
  const bans = await ContestBan.find({ contest_id: contestId }).select('user_id team_id').lean();
  return {
    bannedUserIds: bans.filter(b => b.user_id).map(b => b.user_id),
    bannedTeamIds: bans.filter(b => b.team_id).map(b => b.team_id),
  };
}

// $match stage that removes solves made by banned users or banned teams.
export function bannedMatchStage(bannedUserIds, bannedTeamIds) {
  if (bannedUserIds.length === 0 && bannedTeamIds.length === 0) return null;
  return {
    $match: {
      $nor: [
        ...(bannedUserIds.length ? [{ user_id: { $in: bannedUserIds } }] : []),
        ...(bannedTeamIds.length ? [{ team_id: { $in: bannedTeamIds } }] : []),
      ],
    },
  };
}