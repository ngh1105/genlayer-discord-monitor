const { getDb } = require('../db/connection');

/**
 * Add a contribution proof (X post, builder proof, etc.).
 */
function addProof(userId, { source, url, messageId, channelId, month }) {
  const db = getDb();
  try {
    db.prepare(`
      INSERT INTO contribution_proofs (user_id, source, url, message_id, channel_id, month)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, source, url, messageId || null, channelId || null, month);
    return { success: true };
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return { success: false, reason: 'This URL has already been submitted.' };
    }
    throw err;
  }
}

/**
 * Review a contribution proof.
 */
function reviewProof(proofId, { status, points, reviewedBy }) {
  const db = getDb();
  db.prepare(`
    UPDATE contribution_proofs
    SET status = ?, points = ?, reviewed_by = ?, reviewed_at = datetime('now')
    WHERE id = ?
  `).run(status, points || 0, reviewedBy, proofId);
}

/**
 * Get pending proofs for review.
 */
function getPendingProofs(limit = 20) {
  return getDb().prepare(`
    SELECT cp.*, u.discord_user_id, u.display_name
    FROM contribution_proofs cp
    JOIN users u ON u.id = cp.user_id
    WHERE cp.status = 'pending'
    ORDER BY cp.created_at DESC
    LIMIT ?
  `).all(limit);
}

/**
 * Get approved X post count for a user in a month.
 */
function getApprovedXPostCount(userId, month) {
  const row = getDb().prepare(`
    SELECT COUNT(*) as c FROM contribution_proofs
    WHERE user_id = ? AND month = ? AND source = 'x' AND status = 'approved'
  `).get(userId, month);
  return row?.c || 0;
}

/**
 * Get approved builder proof count for a user in a month.
 */
function getApprovedBuilderProofCount(userId, month) {
  const row = getDb().prepare(`
    SELECT COUNT(*) as c FROM contribution_proofs
    WHERE user_id = ? AND month = ? AND source = 'builder_proof' AND status = 'approved'
  `).get(userId, month);
  return row?.c || 0;
}

/**
 * Get approved admin bonus points for a user in a month.
 */
function getApprovedAdminBonusPoints(userId, month) {
  const row = getDb().prepare(`
    SELECT COALESCE(SUM(points), 0) as total FROM contribution_proofs
    WHERE user_id = ? AND month = ? AND source = 'admin_bonus' AND status = 'approved'
  `).get(userId, month);
  return row?.total || 0;
}

/**
 * Get user's proofs for a month.
 */
function getUserProofs(userId, month) {
  return getDb().prepare(`
    SELECT * FROM contribution_proofs
    WHERE user_id = ? AND month = ?
    ORDER BY created_at DESC
  `).all(userId, month);
}

module.exports = {
  addProof,
  reviewProof,
  getPendingProofs,
  getApprovedXPostCount,
  getApprovedBuilderProofCount,
  getApprovedAdminBonusPoints,
  getUserProofs,
};
