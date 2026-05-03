const usersRepo = require('../repositories/users');
const metricsRepo = require('../repositories/metrics');
const postsRepo = require('../repositories/posts');
const proofsRepo = require('../repositories/proofs');
const contestsRepo = require('../repositories/contests');
const healthRepo = require('../repositories/health');

function buildContributionSummary(user, month, role = 'Brain') {
  const metrics = metricsRepo.getMonthlyMetrics(user.id, month);
  const postSummary = postsRepo.getMonthlyPostSummary(user.id, month);
  const xPosts = proofsRepo.getApprovedXPostCount(user.id, month);
  const builderProofs = proofsRepo.getApprovedBuilderProofCount(user.id, month);
  const adminBonus = proofsRepo.getApprovedAdminBonusPoints(user.id, month);
  const contestPoints = contestsRepo.getMonthlyContestPoints(user.id, month);
  const report = healthRepo.getLatestReport(user.id, role, month);
  const roles = usersRepo.getLatestRoles(user.id);

  const score = metrics.totalMeaningfulMessages
    + (postSummary.totalHighQuality * 50)
    + contestPoints
    + adminBonus
    + (xPosts * 30)
    + (builderProofs * 40)
    + metrics.avgGenlayerFocusScore;

  return {
    user_id: user.id,
    discord_user_id: user.discord_user_id,
    display_name: user.display_name,
    roles,
    score,
    active_days: metrics.activeDays,
    valid_messages: metrics.totalValidMessages,
    meaningful_messages: metrics.totalMeaningfulMessages,
    low_effort_messages: metrics.totalLowEffortMessages,
    spam_flags: metrics.totalSpamFlags,
    genlayer_focus_score: metrics.avgGenlayerFocusScore,
    submitted_posts: postSummary.totalSubmitted,
    valid_posts: postSummary.totalValid,
    high_quality_posts: postSummary.totalHighQuality,
    best_quality_score: postSummary.bestQualityScore,
    post_points: postSummary.totalPoints,
    weekly_contest_points: contestPoints,
    x_approved_posts: xPosts,
    builder_proofs: builderProofs,
    admin_bonus: adminBonus,
    risk_level: report?.risk_level || 'Healthy',
    risk_reason: report?.reason || '',
    summary: buildHumanSummary(metrics, postSummary, xPosts, builderProofs, contestPoints, adminBonus),
  };
}

function getMonthlyLeaderboard({ month, role = 'Brain' }) {
  const users = role === 'All' ? usersRepo.getAllUsers() : usersRepo.getUsersWithRole(role);
  const healthRole = role === 'All' ? 'Brain' : role;

  return users
    .map(user => buildContributionSummary(user, month, healthRole))
    .sort((a, b) => b.score - a.score || b.meaningful_messages - a.meaningful_messages)
    .map((row, index) => ({ rank: index + 1, ...row }));
}

function buildNomiCandidatePayload({
  month,
  role = 'Brain',
  minimumMeaningfulMessages = 50,
  excludeRiskLevels = ['Purge Risk', 'Critical'],
  limit = 5,
} = {}) {
  const leaderboard = getMonthlyLeaderboard({ month, role });
  const candidates = leaderboard
    .filter(row => row.meaningful_messages >= minimumMeaningfulMessages)
    .filter(row => !excludeRiskLevels.includes(row.risk_level))
    .slice(0, limit)
    .map(row => ({
      user_id: row.discord_user_id,
      roles: row.roles,
      active_days: row.active_days,
      meaningful_messages: row.meaningful_messages,
      high_quality_posts: row.high_quality_posts,
      weekly_contest_points: row.weekly_contest_points,
      x_approved_posts: row.x_approved_posts,
      builder_proofs: row.builder_proofs,
      admin_bonus: row.admin_bonus,
      genlayer_focus_score: row.genlayer_focus_score,
      spam_flags: row.spam_flags,
      risk_level: row.risk_level,
      summary: row.summary,
    }));

  return {
    month,
    eligible_role: role,
    candidates,
  };
}

function buildHumanSummary(metrics, posts, xPosts, builderProofs, contestPoints, adminBonus) {
  const parts = [];
  parts.push(`${metrics.totalMeaningfulMessages} meaningful messages over ${metrics.activeDays} days`);
  if (posts.totalHighQuality > 0) parts.push(`${posts.totalHighQuality} high-quality posts`);
  if (contestPoints > 0) parts.push(`${contestPoints} contest points`);
  if (adminBonus > 0) parts.push(`${adminBonus} admin bonus points`);
  if (xPosts > 0) parts.push(`${xPosts} approved X posts`);
  if (builderProofs > 0) parts.push(`${builderProofs} builder proofs`);
  if (metrics.avgGenlayerFocusScore > 60) parts.push('strong GenLayer focus');
  return `${parts.join(', ')}.`;
}

module.exports = {
  buildContributionSummary,
  getMonthlyLeaderboard,
  buildNomiCandidatePayload,
};
