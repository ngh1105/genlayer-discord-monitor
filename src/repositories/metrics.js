const { getDb } = require('../db/connection');

/**
 * Get or create today's metric row for a user.
 */
function getOrCreateDailyMetric(userId, date) {
  const db = getDb();
  let row = db.prepare('SELECT * FROM daily_user_metrics WHERE user_id = ? AND date = ?').get(userId, date);
  if (!row) {
    db.prepare(`
      INSERT INTO daily_user_metrics (user_id, date) VALUES (?, ?)
    `).run(userId, date);
    row = db.prepare('SELECT * FROM daily_user_metrics WHERE user_id = ? AND date = ?').get(userId, date);
  }
  return row;
}

/**
 * Increment daily message counters.
 */
function incrementMessages(userId, date, { meaningful = false, lowEffort = false, spam = false } = {}) {
  const db = getDb();
  getOrCreateDailyMetric(userId, date);

  if (meaningful) {
    db.prepare(`
      UPDATE daily_user_metrics
      SET valid_messages = valid_messages + 1, meaningful_messages = meaningful_messages + 1
      WHERE user_id = ? AND date = ?
    `).run(userId, date);
  } else if (lowEffort) {
    db.prepare(`
      UPDATE daily_user_metrics
      SET valid_messages = valid_messages + 1, low_effort_messages = low_effort_messages + 1
      WHERE user_id = ? AND date = ?
    `).run(userId, date);
  }

  if (spam) {
    db.prepare(`
      UPDATE daily_user_metrics
      SET spam_flags = spam_flags + 1
      WHERE user_id = ? AND date = ?
    `).run(userId, date);
  }
}

/**
 * Get monthly metrics for a user (aggregated from daily).
 */
function getMonthlyMetrics(userId, month) {
  // month is like '2026-05'
  const db = getDb();
  const row = db.prepare(`
    SELECT
      COUNT(DISTINCT date) as active_days,
      COALESCE(SUM(valid_messages), 0) as total_valid_messages,
      COALESCE(SUM(meaningful_messages), 0) as total_meaningful_messages,
      COALESCE(SUM(low_effort_messages), 0) as total_low_effort_messages,
      COALESCE(SUM(spam_flags), 0) as total_spam_flags,
      COALESCE(AVG(genlayer_focus_score), 0) as avg_genlayer_focus_score
    FROM daily_user_metrics
    WHERE user_id = ? AND date LIKE ? || '%'
  `).get(userId, month);

  return {
    activeDays: row?.active_days || 0,
    totalValidMessages: row?.total_valid_messages || 0,
    totalMeaningfulMessages: row?.total_meaningful_messages || 0,
    totalLowEffortMessages: row?.total_low_effort_messages || 0,
    totalSpamFlags: row?.total_spam_flags || 0,
    avgGenlayerFocusScore: Math.round(row?.avg_genlayer_focus_score || 0),
  };
}

/**
 * Get today's message count for a user (for daily cap).
 */
function getTodayMessageCount(userId, date) {
  const row = getDb().prepare(
    'SELECT valid_messages FROM daily_user_metrics WHERE user_id = ? AND date = ?'
  ).get(userId, date);
  return row?.valid_messages || 0;
}

/**
 * Update GenLayer focus score for a day.
 */
function updateFocusScore(userId, date, score) {
  const db = getDb();
  getOrCreateDailyMetric(userId, date);
  db.prepare(`
    UPDATE daily_user_metrics SET genlayer_focus_score = ? WHERE user_id = ? AND date = ?
  `).run(score, userId, date);
}

module.exports = {
  getOrCreateDailyMetric,
  incrementMessages,
  getMonthlyMetrics,
  getTodayMessageCount,
  updateFocusScore,
};
