const { getDb } = require('../db/connection');

/**
 * Save a role health report.
 */
function saveReport(userId, { roleName, month, riskLevel, reason, metricsJson }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO role_health_reports (user_id, role_name, month, risk_level, reason, metrics_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, roleName, month, riskLevel, reason, JSON.stringify(metricsJson || {}));
}

/**
 * Get the latest health report for a user and role in a month.
 */
function getLatestReport(userId, roleName, month) {
  return getDb().prepare(`
    SELECT * FROM role_health_reports
    WHERE user_id = ? AND role_name = ? AND month = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(userId, roleName, month);
}

/**
 * Get all users at a given risk level for a role and month.
 */
function getUsersByRiskLevel(roleName, month, riskLevel) {
  return getDb().prepare(`
    SELECT rhr.*, u.discord_user_id, u.display_name
    FROM role_health_reports rhr
    JOIN users u ON u.id = rhr.user_id
    WHERE rhr.role_name = ? AND rhr.month = ? AND rhr.risk_level = ?
    AND rhr.id = (
      SELECT MAX(rhr2.id) FROM role_health_reports rhr2
      WHERE rhr2.user_id = rhr.user_id AND rhr2.role_name = rhr.role_name AND rhr2.month = rhr.month
    )
    ORDER BY u.display_name
  `).all(roleName, month, riskLevel);
}

/**
 * Get all purge risk / critical users for a role and month.
 */
function getPurgeRiskUsers(roleName, month) {
  return getDb().prepare(`
    SELECT rhr.*, u.discord_user_id, u.display_name
    FROM role_health_reports rhr
    JOIN users u ON u.id = rhr.user_id
    WHERE rhr.role_name = ? AND rhr.month = ? AND rhr.risk_level IN ('Purge Risk', 'Critical')
    AND rhr.id = (
      SELECT MAX(rhr2.id) FROM role_health_reports rhr2
      WHERE rhr2.user_id = rhr.user_id AND rhr2.role_name = rhr.role_name AND rhr2.month = rhr.month
    )
    ORDER BY rhr.risk_level DESC, u.display_name
  `).all(roleName, month);
}

module.exports = {
  saveReport,
  getLatestReport,
  getUsersByRiskLevel,
  getPurgeRiskUsers,
};
