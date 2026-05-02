const { getDb } = require('../db/connection');

/**
 * Get or create a user by Discord user ID.
 */
function upsertUser(discordUserId, displayName) {
  const db = getDb();
  db.prepare(`
    INSERT INTO users (discord_user_id, display_name)
    VALUES (?, ?)
    ON CONFLICT(discord_user_id)
    DO UPDATE SET display_name = excluded.display_name, updated_at = datetime('now')
  `).run(discordUserId, displayName || '');

  return db.prepare('SELECT * FROM users WHERE discord_user_id = ?').get(discordUserId);
}

/**
 * Get user by Discord ID.
 */
function getUserByDiscordId(discordUserId) {
  return getDb().prepare('SELECT * FROM users WHERE discord_user_id = ?').get(discordUserId);
}

/**
 * Get all users.
 */
function getAllUsers() {
  return getDb().prepare('SELECT * FROM users ORDER BY id').all();
}

/**
 * Snapshot user roles.
 */
function snapshotRoles(userId, roleNames) {
  const db = getDb();
  const insert = db.prepare(
    'INSERT INTO user_role_snapshots (user_id, role_name) VALUES (?, ?)'
  );
  const tx = db.transaction((roles) => {
    for (const role of roles) {
      insert.run(userId, role);
    }
  });
  tx(roleNames);
}

/**
 * Get latest roles for a user.
 */
function getLatestRoles(userId) {
  const rows = getDb().prepare(`
    SELECT DISTINCT role_name FROM user_role_snapshots
    WHERE user_id = ?
    ORDER BY captured_at DESC
    LIMIT 20
  `).all(userId);

  // Get only the most recent snapshot set
  const latestDate = getDb().prepare(`
    SELECT MAX(captured_at) as latest FROM user_role_snapshots WHERE user_id = ?
  `).get(userId);

  if (!latestDate?.latest) return [];

  return getDb().prepare(`
    SELECT role_name FROM user_role_snapshots
    WHERE user_id = ? AND captured_at = ?
  `).all(userId, latestDate.latest).map(r => r.role_name);
}

/**
 * Get all users with a specific role (from latest snapshot).
 */
function getUsersWithRole(roleName) {
  const db = getDb();
  // For each user, check if their most recent snapshot includes the role
  return db.prepare(`
    SELECT DISTINCT u.* FROM users u
    JOIN user_role_snapshots urs ON urs.user_id = u.id
    WHERE urs.role_name = ?
    AND urs.captured_at = (
      SELECT MAX(urs2.captured_at) FROM user_role_snapshots urs2 WHERE urs2.user_id = u.id
    )
  `).all(roleName);
}

module.exports = {
  upsertUser,
  getUserByDiscordId,
  getAllUsers,
  snapshotRoles,
  getLatestRoles,
  getUsersWithRole,
};
