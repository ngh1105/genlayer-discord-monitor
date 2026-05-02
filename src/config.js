require('dotenv').config();

function commaSplit(envValue) {
  if (!envValue) return [];
  return envValue.split(',').map(s => s.trim()).filter(Boolean);
}

module.exports = {
  // Discord
  DISCORD_TOKEN: process.env.DISCORD_TOKEN || '',
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || '',
  DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID || '',

  // Database
  DATABASE_PATH: process.env.DATABASE_PATH || './data/monitor.db',

  // GenLayer
  GENLAYER_RPC_URL: process.env.GENLAYER_RPC_URL || 'http://localhost:4000/api',
  NOMI_SINGULARITY_CONTRACT_ADDRESS: process.env.NOMI_SINGULARITY_CONTRACT_ADDRESS || '',

  // Channel IDs
  ADMIN_ALERT_CHANNEL_ID: process.env.ADMIN_ALERT_CHANNEL_ID || '',
  PROJECT_POST_CHANNEL_IDS: commaSplit(process.env.PROJECT_POST_CHANNEL_IDS),
  WINNER_ANNOUNCEMENT_CHANNEL_IDS: commaSplit(process.env.WINNER_ANNOUNCEMENT_CHANNEL_IDS),

  // Role IDs
  OFFICIAL_ANNOUNCER_ROLE_IDS: commaSplit(process.env.OFFICIAL_ANNOUNCER_ROLE_IDS),

  // Thresholds
  MEANINGFUL_MESSAGE_MIN_LENGTH: parseInt(process.env.MEANINGFUL_MESSAGE_MIN_LENGTH || '30', 10),
  DAILY_MESSAGE_CAP: parseInt(process.env.DAILY_MESSAGE_CAP || '50', 10),
  WEEKLY_POST_CAP: parseInt(process.env.WEEKLY_POST_CAP || '3', 10),
  SPAM_BURST_WINDOW_SECONDS: parseInt(process.env.SPAM_BURST_WINDOW_SECONDS || '10', 10),
  SPAM_BURST_MAX_MESSAGES: parseInt(process.env.SPAM_BURST_MAX_MESSAGES || '5', 10),

  // Role thresholds
  BRAIN_HEALTHY_MESSAGES: 150,
  BRAIN_WARNING_MESSAGES: 100,
  BRAIN_MIN_MESSAGES: 100,

  // Contest XP mapping
  CONTEST_RANK_POINTS: {
    1: 120,
    2: 100,
    3: 80,
    4: 60,
    5: 50,
  },
};
