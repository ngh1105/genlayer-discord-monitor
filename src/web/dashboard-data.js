const { getDb } = require('../db/connection');
const { getMonthlyLeaderboard } = require('../services/contribution-summary');
const config = require('../config');

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function normalizeMonth(month) {
  return /^\d{4}-\d{2}$/.test(String(month || '')) ? month : getCurrentMonth();
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value || '');
  } catch {
    return fallback;
  }
}

function getLeaderboard({ month, role = 'Brain' }) {
  const safeMonth = normalizeMonth(month);
  return getMonthlyLeaderboard({ month: safeMonth, role });
}

function getSummary(month) {
  const safeMonth = normalizeMonth(month);
  const db = getDb();
  const metrics = db.prepare(`
    SELECT
      COALESCE(SUM(valid_messages), 0) AS valid_messages,
      COALESCE(SUM(meaningful_messages), 0) AS meaningful_messages,
      COALESCE(SUM(low_effort_messages), 0) AS low_effort_messages,
      COALESCE(SUM(spam_flags), 0) AS spam_flags,
      COUNT(DISTINCT user_id) AS active_users
    FROM daily_user_metrics
    WHERE date LIKE ? || '%'
  `).get(safeMonth);

  const totalUsers = db.prepare('SELECT COUNT(*) AS total FROM users').get();
  const pendingProofs = db.prepare(`
    SELECT COUNT(*) AS total FROM contribution_proofs
    WHERE status = 'pending' AND month = ?
  `).get(safeMonth);
  const criticalHealth = db.prepare(`
    SELECT COUNT(*) AS total FROM role_health_reports
    WHERE month = ? AND risk_level IN ('Purge Risk', 'Critical')
  `).get(safeMonth);
  const latestEvaluation = getLatestEvaluation(safeMonth);

  return {
    month: safeMonth,
    total_users: totalUsers?.total || 0,
    active_users: metrics?.active_users || 0,
    valid_messages: metrics?.valid_messages || 0,
    meaningful_messages: metrics?.meaningful_messages || 0,
    low_effort_messages: metrics?.low_effort_messages || 0,
    spam_flags: metrics?.spam_flags || 0,
    pending_proofs: pendingProofs?.total || 0,
    critical_health_reports: criticalHealth?.total || 0,
    latest_evaluation: latestEvaluation,
    genlayer_health: getGenLayerHealth(safeMonth),
  };
}

function getLatestEvaluation(month) {
  const row = getDb().prepare(`
    SELECT * FROM genlayer_evaluations
    WHERE month = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(month);

  return row ? hydrateEvaluation(row) : null;
}

function hydrateEvaluation(row) {
  return {
    ...row,
    input_summary: parseJson(row.input_summary_json, {}),
    result: parseJson(row.result_json, {}),
  };
}

function getMessageLogs(limit = 100) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));
  return getDb().prepare(`
    SELECT ml.*, u.discord_user_id, u.display_name
    FROM message_log ml
    JOIN users u ON u.id = ml.user_id
    ORDER BY ml.created_at DESC
    LIMIT ?
  `).all(safeLimit);
}

function getProofs({ month, status = 'pending' }) {
  const safeMonth = normalizeMonth(month);
  const allowedStatus = ['pending', 'approved', 'rejected', 'all'].includes(status) ? status : 'pending';
  const db = getDb();
  const params = [safeMonth];
  let statusFilter = '';

  if (allowedStatus !== 'all') {
    statusFilter = 'AND cp.status = ?';
    params.push(allowedStatus);
  }

  return db.prepare(`
    SELECT cp.*, u.discord_user_id, u.display_name
    FROM contribution_proofs cp
    JOIN users u ON u.id = cp.user_id
    WHERE cp.month = ? ${statusFilter}
    ORDER BY cp.created_at DESC
    LIMIT 300
  `).all(...params);
}

function getRoleHealth({ month, role = 'Brain' }) {
  const safeMonth = normalizeMonth(month);
  return getDb().prepare(`
    SELECT rhr.*, u.discord_user_id, u.display_name
    FROM role_health_reports rhr
    JOIN users u ON u.id = rhr.user_id
    WHERE rhr.month = ? AND rhr.role_name = ?
    AND rhr.id = (
      SELECT MAX(rhr2.id) FROM role_health_reports rhr2
      WHERE rhr2.user_id = rhr.user_id
      AND rhr2.role_name = rhr.role_name
      AND rhr2.month = rhr.month
    )
    ORDER BY
      CASE rhr.risk_level
        WHEN 'Critical' THEN 1
        WHEN 'Purge Risk' THEN 2
        WHEN 'Warning' THEN 3
        WHEN 'Watch' THEN 4
        WHEN 'Healthy' THEN 5
        ELSE 6
      END,
      u.display_name
  `).all(safeMonth, role).map(row => ({
    ...row,
    metrics: parseJson(row.metrics_json, {}),
  }));
}

function getGenLayerEvaluations(month) {
  const safeMonth = normalizeMonth(month);
  return getDb().prepare(`
    SELECT * FROM genlayer_evaluations
    WHERE month = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).all(safeMonth).map(hydrateEvaluation);
}

function getGenLayerHealth(month) {
  const latest = getLatestEvaluation(month);
  return {
    configured: Boolean(config.GENLAYER_RPC_URL && config.NOMI_SINGULARITY_CONTRACT_ADDRESS),
    network: config.GENLAYER_NETWORK || '',
    rpc_url: config.GENLAYER_RPC_URL,
    contract_address: config.NOMI_SINGULARITY_CONTRACT_ADDRESS,
    latest_evaluation_id: latest?.evaluation_id || '',
    latest_source: latest?.source || '',
    latest_error: latest?.error_message || '',
  };
}

module.exports = {
  getCurrentMonth,
  getSummary,
  getLeaderboard,
  getMessageLogs,
  getProofs,
  getRoleHealth,
  getGenLayerEvaluations,
  getGenLayerHealth,
};
