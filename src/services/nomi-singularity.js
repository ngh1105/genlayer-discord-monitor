const usersRepo = require('../repositories/users');
const metricsRepo = require('../repositories/metrics');
const postsRepo = require('../repositories/posts');
const proofsRepo = require('../repositories/proofs');
const contestsRepo = require('../repositories/contests');
const healthRepo = require('../repositories/health');
const genlayer = require('./genlayer-client');

/**
 * Build candidate list and run Nomi Singularity selection.
 */
async function runNomiSingularity(month) {
  // 1. Get Brain users
  const brainUsers = usersRepo.getUsersWithRole('Brain');
  if (brainUsers.length === 0) {
    return { error: 'No Brain users found.' };
  }

  // 2. Filter out purge risk / critical
  const candidates = [];
  for (const user of brainUsers) {
    const report = healthRepo.getLatestReport(user.id, 'Brain', month);
    if (report && (report.risk_level === 'Purge Risk' || report.risk_level === 'Critical')) {
      continue;
    }

    const metrics = metricsRepo.getMonthlyMetrics(user.id, month);
    if (metrics.totalMeaningfulMessages < 50) continue; // absolute minimum filter

    const postSummary = postsRepo.getMonthlyPostSummary(user.id, month);
    const xPosts = proofsRepo.getApprovedXPostCount(user.id, month);
    const builderProofs = proofsRepo.getApprovedBuilderProofCount(user.id, month);
    const adminBonus = proofsRepo.getApprovedAdminBonusPoints(user.id, month);
    const contestPoints = contestsRepo.getMonthlyContestPoints(user.id, month);

    // Calculate a simple score for ranking
    const score = metrics.totalMeaningfulMessages
      + (postSummary.totalHighQuality * 50)
      + contestPoints
      + adminBonus
      + (xPosts * 30)
      + (builderProofs * 40)
      + metrics.avgGenlayerFocusScore;

    const roles = usersRepo.getLatestRoles(user.id);

    candidates.push({
      user_id: user.discord_user_id,
      roles,
      active_days: metrics.activeDays,
      meaningful_messages: metrics.totalMeaningfulMessages,
      high_quality_posts: postSummary.totalHighQuality,
      weekly_contest_points: contestPoints,
      x_approved_posts: xPosts,
      builder_proofs: builderProofs,
      admin_bonus: adminBonus,
      genlayer_focus_score: metrics.avgGenlayerFocusScore,
      spam_flags: metrics.totalSpamFlags,
      risk_level: report?.risk_level || 'Healthy',
      summary: buildSummary(metrics, postSummary, xPosts, builderProofs, contestPoints, adminBonus),
      _score: score,
    });
  }

  if (candidates.length === 0) {
    return { error: 'No eligible candidates after filtering.' };
  }

  // 3. Sort by score and take top 5
  candidates.sort((a, b) => b._score - a._score);
  const topCandidates = candidates.slice(0, 5).map(c => {
    const { _score, ...rest } = c;
    return rest;
  });

  const payload = {
    month,
    eligible_role: 'Brain',
    candidates: topCandidates,
  };

  // 4. Try GenLayer first, fall back to local scoring
  const evaluationId = `${month}-nomi-singularity`;

  if (genlayer.isConfigured()) {
    try {
      const result = await genlayer.selectWinner(evaluationId, payload);
      return { result, source: 'genlayer', candidates: topCandidates };
    } catch (err) {
      console.error('GenLayer failed, using local scoring:', err.message);
    }
  }

  // Local fallback: pick the top-scored candidate
  const winner = topCandidates[0];
  const localResult = {
    winner_user_id: winner.user_id,
    confidence: 70,
    decision: 'award',
    reason: `Highest contribution score based on ${winner.meaningful_messages} meaningful messages, ${winner.high_quality_posts} high-quality posts, and focus score of ${winner.genlayer_focus_score}.`,
    risk_notes: ['GenLayer evaluation unavailable; using local scoring.'],
  };

  return { result: localResult, source: 'local', candidates: topCandidates };
}

function buildSummary(metrics, posts, xPosts, builderProofs, contestPoints, adminBonus) {
  const parts = [];
  parts.push(`${metrics.totalMeaningfulMessages} meaningful messages over ${metrics.activeDays} days`);
  if (posts.totalHighQuality > 0) parts.push(`${posts.totalHighQuality} high-quality posts`);
  if (contestPoints > 0) parts.push(`${contestPoints} contest points`);
  if (adminBonus > 0) parts.push(`${adminBonus} admin bonus points`);
  if (xPosts > 0) parts.push(`${xPosts} approved X posts`);
  if (builderProofs > 0) parts.push(`${builderProofs} builder proofs`);
  if (metrics.avgGenlayerFocusScore > 60) parts.push('strong GenLayer focus');
  return parts.join(', ') + '.';
}

module.exports = { runNomiSingularity };
