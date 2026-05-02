const config = require('../config');
const usersRepo = require('../repositories/users');
const postsRepo = require('../repositories/posts');
const contestsRepo = require('../repositories/contests');
const { classifyMessage } = require('../services/message-classifier');
const { parseWinnerMessage, isOfficialAnnouncer } = require('../services/contest-parser');

/**
 * Get current ISO week string like "2026-W18"
 */
function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * Handle incoming Discord messages.
 */
function handleMessage(message) {
  // Ignore bots
  if (message.author.bot) return;

  const channelId = message.channel.id;

  // Upsert user
  const user = usersRepo.upsertUser(
    message.author.id,
    message.member?.displayName || message.author.username
  );

  // Snapshot roles if member is available
  if (message.member) {
    const roleNames = message.member.roles.cache
      .filter(r => r.name !== '@everyone')
      .map(r => r.name);
    if (roleNames.length > 0) {
      usersRepo.snapshotRoles(user.id, roleNames);
    }
  }

  // Check if this is a winner announcement channel
  if (config.WINNER_ANNOUNCEMENT_CHANNEL_IDS.includes(channelId)) {
    if (isOfficialAnnouncer(message.member)) {
      handleWinnerAnnouncement(message, user);
    }
  }

  // Check if this is a project post channel
  if (config.PROJECT_POST_CHANNEL_IDS.includes(channelId)) {
    handleProjectPost(message, user);
    return; // Project posts are handled separately
  }

  // Normal message classification
  const result = classifyMessage(
    user.id,
    channelId,
    message.id,
    message.content || '',
    message.createdAt
  );

  // Optional: log spam warnings
  if (result.spam) {
    console.log(`[Spam] User ${user.discord_user_id} flagged: ${result.reason}`);
  }
}

/**
 * Handle messages in project post channels.
 */
function handleProjectPost(message, user) {
  const content = message.content || '';
  const week = getISOWeek(message.createdAt);

  // Check weekly cap
  const currentCount = postsRepo.getWeekPostCount(user.id, week);
  if (currentCount >= config.WEEKLY_POST_CAP) {
    return; // Weekly cap reached
  }

  // Minimum length check for project posts (300 chars)
  if (content.length < 300) {
    return;
  }

  postsRepo.incrementSubmittedPosts(user.id, week);

  // Mark as valid by default; high quality requires GenLayer/admin review
  postsRepo.markPostValid(user.id, week, {
    highQuality: false,
    qualityScore: 0,
    points: 10, // base points for a valid post
  });
}

/**
 * Handle winner announcement messages.
 */
function handleWinnerAnnouncement(message, _user) {
  const content = message.content || '';
  const winners = parseWinnerMessage(content);
  const week = getISOWeek(message.createdAt);

  for (const winner of winners) {
    const winnerUser = usersRepo.upsertUser(winner.userId, '');

    contestsRepo.addRecognition(winnerUser.id, {
      eventType: 'neurocreative_challenge',
      week,
      rank: winner.rank,
      externalXp: winner.xp,
      sourceMessageId: message.id,
      proofUrls: winner.proofUrls,
    });

    console.log(`[Contest] Recognized user ${winner.userId} as rank ${winner.rank} (${winner.internalPoints} pts)`);
  }
}

module.exports = { handleMessage };
