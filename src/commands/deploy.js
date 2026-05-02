/**
 * Deploy slash commands to Discord.
 * Run with: npm run deploy:commands
 */
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const commands = require('./definitions');
const config = require('../config');

async function deploy() {
  if (!config.DISCORD_TOKEN || !config.DISCORD_CLIENT_ID) {
    console.error('Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in .env');
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);
  const body = commands.map(c => c.toJSON());

  try {
    console.log(`Deploying ${body.length} slash commands...`);

    if (config.DISCORD_GUILD_ID) {
      // Guild-specific (instant update, for development)
      await rest.put(
        Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID),
        { body }
      );
      console.log(`Deployed to guild ${config.DISCORD_GUILD_ID}.`);
    } else {
      // Global (takes up to 1 hour)
      await rest.put(
        Routes.applicationCommands(config.DISCORD_CLIENT_ID),
        { body }
      );
      console.log('Deployed globally (may take up to 1 hour to appear).');
    }
  } catch (err) {
    console.error('Deploy failed:', err);
    process.exit(1);
  }
}

deploy();
