const config = require('../config');

/**
 * Parse official contest winner messages.
 *
 * Expected format:
 *   🥇 <@885076515929333823> & <@1193873947247267900> 5,000 XP
 *   https://x.com/...
 *
 * Returns array of { userId, rank, xp, proofUrls }
 */
function parseWinnerMessage(content) {
  const results = [];
  const lines = content.split('\n');

  // Rank emoji mapping
  const rankMap = {
    '🥇': 1,
    '🥈': 2,
    '🥉': 3,
  };

  let currentRank = 0;
  let currentXp = 0;
  let currentUsers = [];
  let currentProofUrls = [];
  let honorableCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check for rank emoji at the start
    const firstChar = [...trimmed][0];
    if (rankMap[firstChar]) {
      // Save previous entry if exists
      if (currentUsers.length > 0) {
        flushEntry(results, currentUsers, currentRank, currentXp, currentProofUrls);
      }

      currentRank = rankMap[firstChar];
      currentUsers = extractMentions(trimmed);
      currentXp = extractXp(trimmed);
      currentProofUrls = extractUrls(trimmed);
    } else if (trimmed.match(/^(honorable|🏅|⭐|🌟)/i)) {
      // Save previous
      if (currentUsers.length > 0) {
        flushEntry(results, currentUsers, currentRank, currentXp, currentProofUrls);
      }

      honorableCount++;
      currentRank = 3 + honorableCount; // 4, 5, etc.
      currentUsers = extractMentions(trimmed);
      currentXp = extractXp(trimmed);
      currentProofUrls = extractUrls(trimmed);
    } else if (trimmed.startsWith('http')) {
      // Proof URL line
      currentProofUrls.push(trimmed);
    } else {
      // Could be a continuation with more mentions
      const mentions = extractMentions(trimmed);
      if (mentions.length > 0) {
        currentUsers.push(...mentions);
      }
      const urls = extractUrls(trimmed);
      currentProofUrls.push(...urls);
    }
  }

  // Flush last entry
  if (currentUsers.length > 0) {
    flushEntry(results, currentUsers, currentRank, currentXp, currentProofUrls);
  }

  return results;
}

function flushEntry(results, users, rank, xp, proofUrls) {
  for (const userId of users) {
    results.push({
      userId,
      rank,
      xp,
      internalPoints: config.CONTEST_RANK_POINTS[rank] || 0,
      proofUrls: [...proofUrls],
    });
  }
}

function extractMentions(text) {
  const matches = text.matchAll(/<@!?(\d+)>/g);
  return [...matches].map(m => m[1]);
}

function extractXp(text) {
  const match = text.match(/([\d,]+)\s*XP/i);
  if (match) {
    return parseInt(match[1].replace(/,/g, ''), 10);
  }
  return 0;
}

function extractUrls(text) {
  const matches = text.matchAll(/(https?:\/\/[^\s>]+)/g);
  return [...matches].map(m => m[1]);
}

/**
 * Check if a message author is an official announcer.
 */
function isOfficialAnnouncer(member) {
  if (!member || !member.roles) return false;
  const announcerRoles = config.OFFICIAL_ANNOUNCER_ROLE_IDS;
  if (announcerRoles.length === 0) return true; // If not configured, accept all

  return member.roles.cache.some(role => announcerRoles.includes(role.id));
}

module.exports = {
  parseWinnerMessage,
  isOfficialAnnouncer,
};
