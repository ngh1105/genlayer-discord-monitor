const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

/** All slash command definitions */
const commands = [
  // ─── Admin Commands ───
  new SlashCommandBuilder()
    .setName('role_health')
    .setDescription('Check role health for a user')
    .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
    .addStringOption(o => o.setName('month').setDescription('Month (YYYY-MM)').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('purge_risk')
    .setDescription('List users at purge risk for a role')
    .addStringOption(o =>
      o.setName('role').setDescription('Role name')
        .setRequired(true)
        .addChoices(
          { name: 'Brain', value: 'Brain' },
          { name: 'Neurocreative', value: 'Neurocreative' },
          { name: 'Singularity', value: 'Singularity' },
        ))
    .addStringOption(o => o.setName('month').setDescription('Month (YYYY-MM)').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('nomi_singularity')
    .setDescription('Select Nomi Singularity winner for the month')
    .addStringOption(o => o.setName('month').setDescription('Month (YYYY-MM)').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('review_x_post')
    .setDescription('Review a pending X post submission')
    .addIntegerOption(o => o.setName('proof_id').setDescription('Proof ID').setRequired(true))
    .addStringOption(o =>
      o.setName('action').setDescription('Action')
        .setRequired(true)
        .addChoices(
          { name: 'Approve', value: 'approve' },
          { name: 'Reject', value: 'reject' },
        ))
    .addIntegerOption(o => o.setName('points').setDescription('Points to award').setRequired(false))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('admin_bonus')
    .setDescription('Award admin bonus points to a user')
    .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
    .addIntegerOption(o => o.setName('points').setDescription('Bonus points').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('weekly_posts')
    .setDescription('Show weekly post summary for a user')
    .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  // ─── Member Commands ───
  new SlashCommandBuilder()
    .setName('submit_x_post')
    .setDescription('Submit an X post for contribution tracking')
    .addStringOption(o => o.setName('url').setDescription('X/Twitter status URL').setRequired(true)),

  new SlashCommandBuilder()
    .setName('submit_builder_proof')
    .setDescription('Submit a builder proof (contract, GitHub, demo)')
    .addStringOption(o => o.setName('url').setDescription('Proof URL').setRequired(true)),

  new SlashCommandBuilder()
    .setName('my_contribution')
    .setDescription('View your contribution summary')
    .addStringOption(o => o.setName('month').setDescription('Month (YYYY-MM)').setRequired(false)),
];

module.exports = commands;
