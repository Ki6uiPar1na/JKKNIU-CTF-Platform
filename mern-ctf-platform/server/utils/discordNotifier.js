import mongoose from 'mongoose';
import PlatformStatus from '../models/PlatformStatus.js';
import Challenge from '../models/Challenge.js';
import Contest from '../models/Contest.js';
import Solve from '../models/Solve.js';
import User from '../models/User.js';
import Team from '../models/Team.js';

export const DISCORD_EVENTS = ['new_challenge', 'blood', 'ban', 'new_contest', 'contest_end', 'solve'];

const WEBHOOK_RE = /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/[^/]+\/[^/]+$/;

export function isValidWebhookUrl(url) {
  return typeof url === 'string' && WEBHOOK_RE.test(url.trim());
}

async function getWebhookUrl(event) {
  try {
    const status = await PlatformStatus.findById('000000000000000000000001');
    const conf = status?.discord_webhooks?.[event];
    if (!conf || !conf.enabled || !isValidWebhookUrl(conf.webhook_url)) return null;
    return conf.webhook_url.trim();
  } catch {
    return null;
  }
}

async function sendWebhook(url, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err = new Error(`Discord webhook error (${res.status}): ${text.slice(0, 300)}`);
      console.error(err.message);
      err.expose = true;
      throw err;
    }
  } catch (err) {
    console.error('Discord notification failed:', err.message);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function makeEmbed({ color, title, description, fields, footer_text }) {
  const embed = { color, title };
  if (description) embed.description = description;
  if (fields && fields.length) embed.fields = fields;
  if (footer_text) embed.footer = { text: footer_text };
  embed.timestamp = new Date().toISOString();
  return embed;
}

function fmtDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toLocaleString();
}

export function buildPayload(event, body, footer) {
  switch (event) {
    case 'new_challenge': {
      const ch = body.challenge;
      const contest = body.contest;
      return makeEmbed({
        color: 0x5865F2,
        title: `🔬 New Challenge: ${ch.name}`,
        fields: [
          { name: 'Category', value: ch.category || '—', inline: true },
          { name: 'Points', value: String(ch.point ?? '—'), inline: true },
          { name: 'Contest', value: contest?.title || '—' },
          { name: 'Max Attempts', value: String(ch.max_attempts ?? '—'), inline: true },
          { name: 'Status', value: ch.submission_enabled === 0 ? 'Locked (practice only)' : 'Open for solving', inline: true },
        ],
        footer_text: footer,
      });
    }
    case 'blood': {
      const BLOOD_META = {
        1: { color: 0xFFD700, label: '🥇 First Blood' },
        2: { color: 0xC0C0C0, label: '🥈 Second Blood' },
        3: { color: 0xCD7F32, label: '🥉 Third Blood' },
      };
      const meta = BLOOD_META[body.blood_rank] || { color: 0x5865F2, label: 'Blood' };
      return makeEmbed({
        color: meta.color,
        title: `${meta.label} — ${body.challenge_name}`,
        description: `${body.solver_name} took ${meta.label} on **${body.challenge_name}** (${body.challenge_point} pts).`,
        fields: [
          { name: 'Solver', value: body.solver_name, inline: true },
          { name: 'Challenge', value: body.challenge_name, inline: true },
          { name: 'Points', value: String(body.challenge_point ?? '—'), inline: true },
          { name: 'Contest', value: body.contest_title || '—' },
        ],
        footer_text: footer,
      });
    }
    case 'solve': {
      const totalSolvers = body.total_solvers ?? '—';
      const solveCount = typeof totalSolvers === 'number' ? totalSolvers.toLocaleString() : totalSolvers;
      return makeEmbed({
        color: 0x2ECC71,
        title: '✅ Challenge Solved!',
        description: `**${body.solver_name}** solved **${body.challenge_name}** in **${body.contest_title}**`,
        fields: [
          { name: '🏆 Contest', value: body.contest_title || '—', inline: true },
          { name: '🧩 Challenge', value: body.challenge_name || '—', inline: true },
          { name: '⭐ Points', value: String(body.challenge_point ?? '—'), inline: true },
          { name: '👤 Solver', value: body.solver_name || '—', inline: true },
          { name: '📊 Total Solves', value: solveCount, inline: true },
        ],
        footer_text: footer,
      });
    }
    case 'ban': {
      return makeEmbed({
        color: 0xF87171,
        title: '🚫 Account Banned',
        description: `${body.target_type === 'team' ? 'Team' : 'User'} **${body.target_name}** was banned from **${body.contest_title}**.`,
        fields: body.reason ? [{ name: 'Reason', value: body.reason }] : undefined,
        footer_text: footer,
      });
    }
    case 'new_contest': {
      const c = body.contest;
      const contestUrl = c && c._id ? `${String(body.base_url || '').replace(/\/$/, '')}/contests/${c._id}` : null;
      const fields = [
        { name: 'Mode', value: c.participation_mode === 'team' ? 'Team' : 'Solo', inline: true },
        { name: 'Starts', value: fmtDate(c.startDate) || 'TBA', inline: true },
        { name: 'Ends', value: fmtDate(c.endDate) || 'TBA', inline: true },
      ];
      if (c.description) fields.push({ name: 'Description', value: c.description.slice(0, 1000) });
      if (contestUrl) fields.push({ name: 'Join / View', value: `<${contestUrl}>` });
      const embed = {
        color: 0x34D399,
        title: `📢 New Contest: ${c.title}`,
        fields,
        footer_text: footer,
      };
      if (contestUrl) embed.url = contestUrl;
      if (c.banner_url && /^https:\/\//i.test(c.banner_url)) embed.image = { url: c.banner_url };
      return embed;
    }
    case 'contest_end': {
      const rows = (body.scoreboard || []).map((e, i) => `${e.rank}. **${e.name}** — ${e.score} pts`).join('\n');
      return makeEmbed({
        color: 0xF59E0B,
        title: `🏁 Contest Finished: ${body.contest_title}`,
        description: body.contest_title ? `**${body.contest_title}** has ended. Final standings:` : 'A contest has ended. Final standings:',
        fields: rows ? [{ name: '🏆 Top 5', value: rows }] : [{ name: '🏆 Top 5', value: 'No scores recorded.' }],
        footer_text: footer,
      });
    }
    case 'test': {
      return makeEmbed({
        color: 0x5865F2,
        title: '✅ Discord Notification Test',
        description: 'If you can see this, your webhook is configured correctly.',
        footer_text: footer,
      });
    }
    default:
      return null;
  }
}

export async function getScoreSummary(contestId, limit = 5) {
  try {
    const contest = await Contest.findById(contestId);
    if (!contest) return [];

    const pipeline = [
      { $match: { contest_id: contest._id } },
      { $lookup: { from: 'challenges', localField: 'challenge_id', foreignField: '_id', as: 'challenge' } },
      { $unwind: '$challenge' },
      { $match: { 'challenge.visibility': 1 } },
    ];

    if (contest.participation_mode === 'team') {
      pipeline.push(
        { $match: { team_id: { $ne: null } } },
        { $lookup: { from: 'teams', localField: 'team_id', foreignField: '_id', as: 'team' } },
        { $unwind: '$team' },
        { $group: { _id: '$team_id', name: { $first: '$team.name' }, score: { $sum: '$challenge.point' } } },
      );
    } else {
      pipeline.push(
        { $lookup: { from: 'users', localField: 'user_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $match: { 'user.role': 1 } },
        { $group: { _id: '$user_id', name: { $first: '$user.user_name' }, score: { $sum: '$challenge.point' } } },
      );
    }

    pipeline.push({ $sort: { score: -1 } }, { $limit: limit });

    const top = await Solve.aggregate(pipeline);
    return top.map((e, i) => ({ rank: i + 1, name: e.name, score: e.score }));
  } catch {
    return [];
  }
}

export async function notifyDiscord(event, body = {}) {
  try {
    if (!DISCORD_EVENTS.includes(event)) return;
    const url = await getWebhookUrl(event);
    if (!url) return;

    const status = await PlatformStatus.findById('000000000000000000000001');
    const footer = (status?.platform_name || 'CTF Platform') + ' · ' + new Date().toLocaleString();
    const embed = buildPayload(event, body, footer);
    if (!embed) return;

    await sendWebhook(url, { embeds: [embed] });
  } catch (err) {
    console.error('Discord notify error:', err.message);
  }
}

function buildTestPayload(event, footer) {
  const sample = {
    new_challenge: () => ({
      color: 0x5865F2,
      title: '🔬 New Challenge: Test Challenge',
      fields: [
        { name: 'Category', value: 'Web', inline: true },
        { name: 'Points', value: '100', inline: true },
        { name: 'Contest', value: 'Test Contest' },
        { name: 'Max Attempts', value: '5', inline: true },
        { name: 'Status', value: 'Open for solving', inline: true },
      ],
      footer_text: footer,
    }),
    blood: () => ({
      color: 0xFFD700,
      title: '🥇 First Blood — Test Challenge',
      description: 'TestSolver took 🥇 First Blood on **Test Challenge** (100 pts).',
      fields: [
        { name: 'Solver', value: 'TestSolver', inline: true },
        { name: 'Challenge', value: 'Test Challenge', inline: true },
        { name: 'Points', value: '100', inline: true },
        { name: 'Contest', value: 'Test Contest' },
      ],
      footer_text: footer,
    }),
    ban: () => ({
      color: 0xF87171,
      title: '🚫 Account Banned',
      description: 'User **TestUser** was banned from **Test Contest**.',
      fields: [{ name: 'Reason', value: 'Test reason (sample)' }],
      footer_text: footer,
    }),
    new_contest: () => ({
      color: 0x34D399,
      title: '📢 New Contest: Test Contest',
      fields: [
        { name: 'Mode', value: 'Solo', inline: true },
        { name: 'Starts', value: 'Test starts', inline: true },
        { name: 'Ends', value: 'Test ends', inline: true },
        { name: 'Description', value: 'This is a sample test contest.' },
      ],
      footer_text: footer,
    }),
    contest_end: () => ({
      color: 0xF59E0B,
      title: '🏁 Contest Finished: Test Contest',
      description: '**Test Contest** has ended. Final standings:',
      fields: [
        { name: '🏆 Top 5', value: '1. **PlayerOne** — 500 pts\n2. **PlayerTwo** — 400 pts\n3. **PlayerThree** — 300 pts' },
      ],
      footer_text: footer,
    }),
    solve: () => ({
      color: 0x2ECC71,
      title: '✅ Challenge Solved!',
      description: '**TestSolver** solved **Test Challenge** in **Test Contest**',
      fields: [
        { name: '🏆 Contest', value: 'Test Contest', inline: true },
        { name: '🧩 Challenge', value: 'Test Challenge', inline: true },
        { name: '⭐ Points', value: '100', inline: true },
        { name: '👤 Solver', value: 'TestSolver', inline: true },
        { name: '📊 Total Solves', value: '12', inline: true },
      ],
      footer_text: footer,
    }),
  };
  const builder = sample[event] || (() => ({
    color: 0x5865F2,
    title: '✅ Discord Notification Test',
    description: 'If you can see this, your webhook is configured correctly.',
    footer_text: footer,
  }));
  const embed = builder();
  embed.timestamp = new Date().toISOString();
  return embed;
}

export async function sendDiscordTest(event, url) {
  const webhookUrl = (url && url.trim()) || (await getWebhookUrl(event));
  if (!webhookUrl) throw new Error('No webhook URL configured. Paste a webhook URL and try again.');
  const status = await PlatformStatus.findById('000000000000000000000001');
  const footer = (status?.platform_name || 'CTF Platform') + ' · ' + new Date().toLocaleString();
  const embed = buildTestPayload(event, footer);
  await sendWebhook(webhookUrl, { embeds: [embed] });
  return true;
}

export async function getBloodRank(contestId, challengeId) {
  if (!mongoose.Types.ObjectId.isValid(challengeId)) return 0;
  const count = await Solve.countDocuments({ contest_id: contestId, challenge_id: challengeId });
  return count;
}

export async function notifyBloodIfEarned(contestId, challengeId, { solver_name, contest_title }) {
  try {
    const rank = await getBloodRank(contestId, challengeId);
    if (rank < 1 || rank > 3) return;
    const challenge = await Challenge.findById(challengeId).select('name point');
    if (!challenge) return;
    await notifyDiscord('blood', {
      blood_rank: rank,
      solver_name,
      challenge_name: challenge.name,
      challenge_point: challenge.point,
      challenge_id: challengeId,
      contest_title,
    });
  } catch (err) {
    console.error('blood notify error:', err.message);
  }
}

export async function notifySolve(contestId, challengeId, { user_id, team_id }) {
  try {
    const challenge = await Challenge.findById(challengeId).select('name point');
    if (!challenge) return;

    let solver_name = 'Unknown';
    if (team_id) {
      const team = await Team.findById(team_id).select('name');
      const user = await User.findById(user_id).select('user_name');
      const teamName = team?.name || 'Unknown';
      const memberName = user?.user_name || 'Unknown';
      solver_name = `${teamName} (Member: ${memberName})`;
    } else {
      const user = await User.findById(user_id).select('user_name');
      solver_name = user?.user_name || 'Unknown';
    }

    const contest = await Contest.findById(contestId).select('title');
    const totalSolvers = await Solve.countDocuments({ contest_id: contestId, challenge_id: challengeId });

    await notifyDiscord('solve', {
      solver_name,
      challenge_name: challenge.name,
      challenge_point: challenge.point,
      contest_title: contest?.title || '—',
      total_solvers: totalSolvers,
    });
  } catch (err) {
    console.error('solve notify error:', err.message);
  }
}