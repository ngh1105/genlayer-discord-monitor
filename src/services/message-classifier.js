const crypto = require('crypto');
const config = require('../config');
const { getDb } = require('../db/connection');

// Low-effort patterns
const LOW_EFFORT_PATTERNS = [
  /^(gm|gn|lfg|nice|thanks|ty|thx|lol|lmao|wtf|wow|fr|bruh|nah|yes|no|ok|yep|yea|yeah|sure|same|true|facts|based|cope|slay|vibes|lesgo|wagmi)\s*[.!?]*$/i,
  /^[\p{Emoji}\s]+$/u,
  /^.{1,5}$/,
];

// GenLayer-related keywords for focus scoring
const GENLAYER_KEYWORDS = [
  'genlayer', 'genvm', 'intelligent contract', 'equivalence principle',
  'validator', 'leader node', 'consensus', 'nondet', 'gl.', 'treemap',
  'nomi singularity', 'nomi', 'singularity', 'gen_', 'genlayer.com',
];

/**
 * Classify a message and update metrics.
 * Returns { meaningful, lowEffort, spam, blocked }
 */
function classifyMessage(userId, channelId, messageId, content, timestamp) {
  const db = getDb();
  const dateStr = timestamp.toISOString().split('T')[0];

  // Check daily cap
  const metricsRepo = require('../repositories/metrics');
  const todayCount = metricsRepo.getTodayMessageCount(userId, dateStr);
  if (todayCount >= config.DAILY_MESSAGE_CAP) {
    return { meaningful: false, lowEffort: false, spam: false, blocked: true, reason: 'daily_cap' };
  }

  // Content hash for duplicate detection
  const contentHash = crypto.createHash('md5').update(content.trim().toLowerCase()).digest('hex');

  // Check for exact duplicate in recent messages
  const duplicate = db.prepare(`
    SELECT id FROM message_log
    WHERE user_id = ? AND content_hash = ? AND created_at > datetime('now', '-1 hour')
  `).get(userId, contentHash);

  if (duplicate) {
    logMessage(db, userId, channelId, messageId, contentHash, content.length, false, true);
    metricsRepo.incrementMessages(userId, dateStr, { spam: true });
    return { meaningful: false, lowEffort: false, spam: true, blocked: false, reason: 'duplicate' };
  }

  // Check burst spam (many messages in short window)
  const recentCount = db.prepare(`
    SELECT COUNT(*) as c FROM message_log
    WHERE user_id = ? AND created_at > datetime('now', '-${config.SPAM_BURST_WINDOW_SECONDS} seconds')
  `).get(userId);

  if (recentCount && recentCount.c >= config.SPAM_BURST_MAX_MESSAGES) {
    logMessage(db, userId, channelId, messageId, contentHash, content.length, false, true);
    metricsRepo.incrementMessages(userId, dateStr, { spam: true });
    return { meaningful: false, lowEffort: false, spam: true, blocked: false, reason: 'burst_spam' };
  }

  // Check low-effort
  const trimmed = content.trim();
  const isLowEffort = trimmed.length < config.MEANINGFUL_MESSAGE_MIN_LENGTH ||
    LOW_EFFORT_PATTERNS.some(p => p.test(trimmed));

  if (isLowEffort) {
    logMessage(db, userId, channelId, messageId, contentHash, content.length, false, false);
    metricsRepo.incrementMessages(userId, dateStr, { lowEffort: true });
    return { meaningful: false, lowEffort: true, spam: false, blocked: false };
  }

  // It's meaningful
  logMessage(db, userId, channelId, messageId, contentHash, content.length, true, false);
  metricsRepo.incrementMessages(userId, dateStr, { meaningful: true });

  // Calculate GenLayer focus score contribution
  const focusHit = GENLAYER_KEYWORDS.some(kw =>
    content.toLowerCase().includes(kw.toLowerCase())
  );
  if (focusHit) {
    // Boost today's focus score
    const currentMetric = metricsRepo.getOrCreateDailyMetric(userId, dateStr);
    const newScore = Math.min(100, (currentMetric.genlayer_focus_score || 0) + 5);
    metricsRepo.updateFocusScore(userId, dateStr, newScore);
  }

  return { meaningful: true, lowEffort: false, spam: false, blocked: false };
}

/**
 * Log a message for tracking.
 */
function logMessage(db, userId, channelId, messageId, contentHash, contentLength, isMeaningful, isSpam) {
  try {
    db.prepare(`
      INSERT OR IGNORE INTO message_log
        (user_id, channel_id, message_id, content_hash, content_length, is_meaningful, is_spam)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, channelId, messageId, contentHash, contentLength, isMeaningful ? 1 : 0, isSpam ? 1 : 0);
  } catch (err) {
    // Ignore duplicate message_id
  }
}

/**
 * Prune old message logs (keep only last 48 hours).
 */
function pruneMessageLogs() {
  const db = getDb();
  const result = db.prepare(`
    DELETE FROM message_log WHERE created_at < datetime('now', '-2 days')
  `).run();
  return result.changes;
}

module.exports = {
  classifyMessage,
  pruneMessageLogs,
  GENLAYER_KEYWORDS,
};
