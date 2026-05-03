const { Client, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./config');
const { getDb, closeDb } = require('./db/connection');
const { handleMessage } = require('./events/message-handler');
const { handleInteraction } = require('./commands/handler');
const { initJobs } = require('./jobs/scheduler');
const { startWebDashboard } = require('./web/server');

// ─── Validate Config ───
if (!config.DISCORD_TOKEN) {
  console.error('ERROR: DISCORD_TOKEN is required in .env');
  console.error('Copy .env.example to .env and fill in your values.');
  process.exit(1);
}

// ─── Initialize Database ───
console.log('Initializing database...');
const db = getDb();
console.log('Database ready.');

let webServer = null;
if (config.WEB_DASHBOARD_ENABLED) {
  webServer = startWebDashboard();
}

// ─── Create Discord Client ───
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Message, Partials.Channel],
});

// ─── Events ───
client.once('ready', () => {
  console.log(`Bot logged in as ${client.user.tag}`);
  console.log(`Guilds: ${client.guilds.cache.size}`);
  console.log(`GenLayer: ${config.NOMI_SINGULARITY_CONTRACT_ADDRESS ? 'configured' : 'not configured'}`);

  // Start scheduled jobs
  initJobs(client);
});

client.on('messageCreate', (message) => {
  try {
    handleMessage(message);
  } catch (err) {
    console.error('[MessageCreate] Error:', err.message);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    await handleInteraction(interaction);
  } catch (err) {
    console.error('[InteractionCreate] Error:', err.message);
  }
});

// ─── Graceful Shutdown ───
function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down...`);
  if (webServer) webServer.close();
  client.destroy();
  closeDb();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ─── Start ───
console.log('Connecting to Discord...');
client.login(config.DISCORD_TOKEN);
