const { getDb } = require('../db/connection');

function isoWeekStartsInMonth(week, month) {
  const match = String(week).match(/^(\d{4})-W(\d{2})$/);
  if (!match) return false;

  const [, isoYear, isoWeek] = match;
  const year = Number(isoYear);
  const weekNum = Number(isoWeek);
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const monday = new Date(year, 0, 4 - jan4Day + 1 + ((weekNum - 1) * 7));

  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}` === month;
}

/**
 * Get or create weekly post metric for a user.
 */
function getOrCreateWeeklyPost(userId, week) {
  const db = getDb();
  let row = db.prepare('SELECT * FROM weekly_post_metrics WHERE user_id = ? AND week = ?').get(userId, week);
  if (!row) {
    db.prepare('INSERT INTO weekly_post_metrics (user_id, week) VALUES (?, ?)').run(userId, week);
    row = db.prepare('SELECT * FROM weekly_post_metrics WHERE user_id = ? AND week = ?').get(userId, week);
  }
  return row;
}

/**
 * Increment submitted post count for a week.
 */
function incrementSubmittedPosts(userId, week) {
  const db = getDb();
  getOrCreateWeeklyPost(userId, week);
  db.prepare(`
    UPDATE weekly_post_metrics
    SET submitted_posts = submitted_posts + 1
    WHERE user_id = ? AND week = ?
  `).run(userId, week);
}

/**
 * Mark a post as valid and optionally high quality.
 */
function markPostValid(userId, week, { highQuality = false, qualityScore = 0, points = 0 } = {}) {
  const db = getDb();
  getOrCreateWeeklyPost(userId, week);

  const updates = ['valid_posts = valid_posts + 1'];
  if (highQuality) {
    updates.push('high_quality_posts = high_quality_posts + 1');
  }
  if (qualityScore > 0) {
    updates.push(`quality_score = MAX(quality_score, ${Math.round(qualityScore)})`);
  }
  if (points > 0) {
    updates.push(`points = points + ${Math.round(points)}`);
  }

  db.prepare(`
    UPDATE weekly_post_metrics SET ${updates.join(', ')} WHERE user_id = ? AND week = ?
  `).run(userId, week);
}

/**
 * Get monthly post summary for a user.
 */
function getMonthlyPostSummary(userId, month) {
  const db = getDb();

  const rows = db.prepare(`
    SELECT submitted_posts, valid_posts, high_quality_posts, quality_score, points, week
    FROM weekly_post_metrics
    WHERE user_id = ?
  `).all(userId).filter(row => isoWeekStartsInMonth(row.week, month));

  return {
    totalSubmitted: rows.reduce((sum, row) => sum + row.submitted_posts, 0),
    totalValid: rows.reduce((sum, row) => sum + row.valid_posts, 0),
    totalHighQuality: rows.reduce((sum, row) => sum + row.high_quality_posts, 0),
    bestQualityScore: rows.reduce((best, row) => Math.max(best, row.quality_score), 0),
    totalPoints: rows.reduce((sum, row) => sum + row.points, 0),
  };
}

/**
 * Get current week's submitted post count for a user (for weekly cap).
 */
function getWeekPostCount(userId, week) {
  const row = getDb().prepare(
    'SELECT submitted_posts FROM weekly_post_metrics WHERE user_id = ? AND week = ?'
  ).get(userId, week);
  return row?.submitted_posts || 0;
}

module.exports = {
  getOrCreateWeeklyPost,
  incrementSubmittedPosts,
  markPostValid,
  getMonthlyPostSummary,
  getWeekPostCount,
};
