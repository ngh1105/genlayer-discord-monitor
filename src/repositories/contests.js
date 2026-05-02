const { getDb } = require('../db/connection');
const config = require('../config');

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
 * Add a contest recognition record.
 */
function addRecognition(userId, { eventType, week, rank, externalXp, sourceMessageId, proofUrls }) {
  const internalPoints = config.CONTEST_RANK_POINTS[rank] || 0;
  const db = getDb();

  db.prepare(`
    INSERT INTO contest_recognitions
      (user_id, event_type, week, rank, external_xp, internal_points, source_message_id, proof_urls_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    eventType,
    week,
    rank,
    externalXp,
    internalPoints,
    sourceMessageId || null,
    JSON.stringify(proofUrls || [])
  );
}

/**
 * Get total contest points for a user in a month.
 */
function getMonthlyContestPoints(userId, month) {
  const rows = getDb().prepare(`
    SELECT internal_points, week
    FROM contest_recognitions
    WHERE user_id = ?
  `).all(userId).filter(row => isoWeekStartsInMonth(row.week, month));
  return rows.reduce((sum, row) => sum + row.internal_points, 0);
}

/**
 * Get all recognitions for a user in a week.
 */
function getWeekRecognitions(userId, week) {
  return getDb().prepare(`
    SELECT * FROM contest_recognitions WHERE user_id = ? AND week = ?
  `).all(userId, week);
}

module.exports = {
  addRecognition,
  getMonthlyContestPoints,
  getWeekRecognitions,
};
