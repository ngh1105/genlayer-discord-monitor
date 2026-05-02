const config = require('../config');
const metricsRepo = require('../repositories/metrics');
const postsRepo = require('../repositories/posts');
const proofsRepo = require('../repositories/proofs');
const contestsRepo = require('../repositories/contests');
const healthRepo = require('../repositories/health');
const usersRepo = require('../repositories/users');

/**
 * Calculate role health for all tracked users.
 * Called daily by the scheduled job.
 */
function calculateAllRoleHealth(month) {
  const allUsers = usersRepo.getAllUsers();
  const results = [];

  for (const user of allUsers) {
    const roles = usersRepo.getLatestRoles(user.id);

    for (const role of roles) {
      const health = calculateRoleHealth(user.id, role, month);
      if (health) {
        healthRepo.saveReport(user.id, {
          roleName: role,
          month,
          riskLevel: health.riskLevel,
          reason: health.reason,
          metricsJson: health.metrics,
        });
        results.push({
          userId: user.id,
          discordUserId: user.discord_user_id,
          displayName: user.display_name,
          role,
          ...health,
        });
      }
    }
  }

  return results;
}

/**
 * Calculate health for a specific user and role.
 */
function calculateRoleHealth(userId, roleName, month) {
  switch (roleName) {
    case 'Brain':
      return calculateBrainHealth(userId, month);
    case 'Neurocreative':
      return calculateNeurocreativeHealth(userId, month);
    case 'Singularity':
      return calculateSingularityHealth(userId, month);
    default:
      return null;
  }
}

/**
 * Brain role health calculation.
 *
 * Healthy: meaningful_messages >= 150, low spam, active during month
 * Watch:   projected month-end meaningful messages below 150
 * Warning: 100 <= meaningful_messages < 150 after most of month
 * Purge Risk: meaningful_messages < 100, near 30 days inactive, or high spam
 */
function calculateBrainHealth(userId, month) {
  const metrics = metricsRepo.getMonthlyMetrics(userId, month);
  const dayOfMonth = getCurrentDayOfMonth(month);
  const daysInMonth = getDaysInMonth(month);
  const daysRemaining = daysInMonth - dayOfMonth;

  const { totalMeaningfulMessages, activeDays, totalSpamFlags, avgGenlayerFocusScore } = metrics;

  // Project end-of-month messages based on current rate
  const dailyRate = dayOfMonth > 0 ? totalMeaningfulMessages / dayOfMonth : 0;
  const projectedTotal = totalMeaningfulMessages + (dailyRate * daysRemaining);

  const spamRatio = metrics.totalValidMessages > 0
    ? totalSpamFlags / metrics.totalValidMessages
    : 0;

  const metricsObj = {
    meaningful_messages: totalMeaningfulMessages,
    active_days: activeDays,
    spam_flags: totalSpamFlags,
    genlayer_focus_score: avgGenlayerFocusScore,
    projected_total: Math.round(projectedTotal),
    spam_ratio: Math.round(spamRatio * 100),
    day_of_month: dayOfMonth,
  };

  // Critical: completely inactive
  if (activeDays === 0 && dayOfMonth > 10) {
    return {
      riskLevel: 'Critical',
      reason: 'User has been completely inactive this month.',
      metrics: metricsObj,
    };
  }

  // Purge Risk
  if (totalMeaningfulMessages < config.BRAIN_MIN_MESSAGES && dayOfMonth > 25) {
    return {
      riskLevel: 'Purge Risk',
      reason: `Only ${totalMeaningfulMessages} meaningful messages with ${daysRemaining} days remaining. Below ${config.BRAIN_MIN_MESSAGES} minimum.`,
      metrics: metricsObj,
    };
  }

  if (spamRatio > 0.3) {
    return {
      riskLevel: 'Purge Risk',
      reason: `High spam ratio (${Math.round(spamRatio * 100)}%). Activity may not be genuine.`,
      metrics: metricsObj,
    };
  }

  // Warning
  if (totalMeaningfulMessages < config.BRAIN_HEALTHY_MESSAGES && dayOfMonth > 20) {
    return {
      riskLevel: 'Warning',
      reason: `${totalMeaningfulMessages} meaningful messages after day ${dayOfMonth}. May not reach ${config.BRAIN_HEALTHY_MESSAGES} target.`,
      metrics: metricsObj,
    };
  }

  // Watch
  if (projectedTotal < config.BRAIN_HEALTHY_MESSAGES && dayOfMonth > 10) {
    return {
      riskLevel: 'Watch',
      reason: `Projected ${Math.round(projectedTotal)} messages by month end. Below ${config.BRAIN_HEALTHY_MESSAGES} target.`,
      metrics: metricsObj,
    };
  }

  // Healthy
  return {
    riskLevel: 'Healthy',
    reason: `On track with ${totalMeaningfulMessages} meaningful messages and ${activeDays} active days.`,
    metrics: metricsObj,
  };
}

/**
 * Neurocreative role health.
 *
 * Healthy: at least 1 approved high-quality post
 * Watch:   no post yet, month is early
 * Warning: no post after week 3
 * Purge Risk: no high-quality post by end of month
 */
function calculateNeurocreativeHealth(userId, month) {
  const postSummary = postsRepo.getMonthlyPostSummary(userId, month);
  const dayOfMonth = getCurrentDayOfMonth(month);

  const metricsObj = {
    total_submitted: postSummary.totalSubmitted,
    total_valid: postSummary.totalValid,
    high_quality_posts: postSummary.totalHighQuality,
    best_quality_score: postSummary.bestQualityScore,
    day_of_month: dayOfMonth,
  };

  if (postSummary.totalHighQuality >= 1) {
    return {
      riskLevel: 'Healthy',
      reason: `Has ${postSummary.totalHighQuality} high-quality post(s) this month.`,
      metrics: metricsObj,
    };
  }

  if (dayOfMonth <= 10) {
    return {
      riskLevel: 'Watch',
      reason: 'No approved high-quality post yet, but month is still early.',
      metrics: metricsObj,
    };
  }

  if (dayOfMonth <= 21) {
    return {
      riskLevel: 'Warning',
      reason: `No approved high-quality post after day ${dayOfMonth}. Should submit soon.`,
      metrics: metricsObj,
    };
  }

  return {
    riskLevel: 'Purge Risk',
    reason: `No high-quality post by day ${dayOfMonth}. Neurocreative role at risk.`,
    metrics: metricsObj,
  };
}

/**
 * Singularity role health.
 *
 * Evaluates GenLayer focus + Discord activity + X contribution.
 */
function calculateSingularityHealth(userId, month) {
  const metrics = metricsRepo.getMonthlyMetrics(userId, month);
  const xPosts = proofsRepo.getApprovedXPostCount(userId, month);
  const builderProofs = proofsRepo.getApprovedBuilderProofCount(userId, month);
  const contestPoints = contestsRepo.getMonthlyContestPoints(userId, month);
  const dayOfMonth = getCurrentDayOfMonth(month);

  const focusScore = metrics.avgGenlayerFocusScore;
  const hasDiscordActivity = metrics.totalMeaningfulMessages >= 50;
  const hasXContribution = xPosts > 0;
  const hasBuilderProof = builderProofs > 0;

  const metricsObj = {
    meaningful_messages: metrics.totalMeaningfulMessages,
    active_days: metrics.activeDays,
    genlayer_focus_score: focusScore,
    x_approved_posts: xPosts,
    builder_proofs: builderProofs,
    contest_points: contestPoints,
    day_of_month: dayOfMonth,
  };

  // Strong all-around
  if (hasDiscordActivity && (hasXContribution || hasBuilderProof) && focusScore >= 50) {
    return {
      riskLevel: 'Healthy',
      reason: 'Strong GenLayer focus, Discord activity, and verified external contribution.',
      metrics: metricsObj,
    };
  }

  // One source weak
  if (hasDiscordActivity && !hasXContribution && !hasBuilderProof && dayOfMonth <= 20) {
    return {
      riskLevel: 'Watch',
      reason: 'Discord active but no X proof or builder proof submitted yet.',
      metrics: metricsObj,
    };
  }

  // Weak GenLayer focus or missing contributions late in month
  if (dayOfMonth > 20 && (focusScore < 30 || (!hasXContribution && !hasBuilderProof))) {
    return {
      riskLevel: 'Warning',
      reason: `Weak GenLayer focus (${focusScore}) or missing external contributions late in month.`,
      metrics: metricsObj,
    };
  }

  // Very weak
  if (!hasDiscordActivity && !hasXContribution && !hasBuilderProof) {
    return {
      riskLevel: dayOfMonth > 25 ? 'Purge Risk' : 'Watch',
      reason: 'No clear GenLayer alignment and weak activity across both Discord and X.',
      metrics: metricsObj,
    };
  }

  return {
    riskLevel: 'Watch',
    reason: 'Some activity present but contribution profile is incomplete.',
    metrics: metricsObj,
  };
}

/**
 * Get current day of month, or return day count based on date.
 */
function getCurrentDayOfMonth(month) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  if (month === currentMonth) {
    return now.getDate();
  }
  // If asking about a past month, return the full month length
  return getDaysInMonth(month);
}

function getDaysInMonth(month) {
  const [year, mon] = month.split('-').map(Number);
  return new Date(year, mon, 0).getDate();
}

module.exports = {
  calculateAllRoleHealth,
  calculateRoleHealth,
};
