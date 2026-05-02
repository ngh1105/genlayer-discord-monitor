const usersRepo = require('../repositories/users');
const metricsRepo = require('../repositories/metrics');
const postsRepo = require('../repositories/posts');
const proofsRepo = require('../repositories/proofs');
const contestsRepo = require('../repositories/contests');
const healthRepo = require('../repositories/health');
const { calculateRoleHealth } = require('../services/role-health');
const { runNomiSingularity } = require('../services/nomi-singularity');

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Handle slash command interactions.
 */
async function handleInteraction(interaction) {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  try {
    switch (commandName) {
      case 'role_health': return await cmdRoleHealth(interaction);
      case 'purge_risk': return await cmdPurgeRisk(interaction);
      case 'nomi_singularity': return await cmdNomiSingularity(interaction);
      case 'review_x_post': return await cmdReviewXPost(interaction);
      case 'admin_bonus': return await cmdAdminBonus(interaction);
      case 'weekly_posts': return await cmdWeeklyPosts(interaction);
      case 'submit_x_post': return await cmdSubmitXPost(interaction);
      case 'submit_builder_proof': return await cmdSubmitBuilderProof(interaction);
      case 'my_contribution': return await cmdMyContribution(interaction);
      default:
        await interaction.reply({ content: 'Unknown command.', ephemeral: true });
    }
  } catch (err) {
    console.error(`[Command] ${commandName} error:`, err);
    const msg = { content: `Error: ${err.message}`, ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(msg);
    } else {
      await interaction.reply(msg);
    }
  }
}

// ─── Admin Commands ───

async function cmdRoleHealth(interaction) {
  const target = interaction.options.getUser('user');
  const month = interaction.options.getString('month') || getCurrentMonth();
  const user = usersRepo.getUserByDiscordId(target.id);
  if (!user) return interaction.reply({ content: 'User not found in database.', ephemeral: true });

  const roles = usersRepo.getLatestRoles(user.id);
  const results = [];
  for (const role of roles) {
    const h = calculateRoleHealth(user.id, role, month);
    if (h) results.push({ role, ...h });
  }

  if (results.length === 0) {
    return interaction.reply({ content: 'No tracked roles found for this user.', ephemeral: true });
  }

  const embeds = results.map(r => ({
    title: `${getStatusEmoji(r.riskLevel)} ${r.role} — ${r.riskLevel}`,
    description: r.reason,
    color: getColor(r.riskLevel),
    fields: Object.entries(r.metrics || {}).map(([k, v]) => ({
      name: k.replace(/_/g, ' '),
      value: String(v),
      inline: true,
    })),
    footer: { text: `Month: ${month}` },
  }));

  await interaction.reply({ content: `Role health for <@${target.id}>:`, embeds, ephemeral: true });
}

async function cmdPurgeRisk(interaction) {
  const role = interaction.options.getString('role');
  const month = interaction.options.getString('month') || getCurrentMonth();
  const users = healthRepo.getPurgeRiskUsers(role, month);

  if (users.length === 0) {
    return interaction.reply({ content: `No purge risk users for ${role} in ${month}.`, ephemeral: true });
  }

  const lines = users.map(u =>
    `• <@${u.discord_user_id}> — **${u.risk_level}**: ${u.reason}`
  );

  await interaction.reply({
    content: `**${role} Purge Risk — ${month}**\n\n${lines.join('\n')}`,
    ephemeral: true,
  });
}

async function cmdNomiSingularity(interaction) {
  const month = interaction.options.getString('month') || getCurrentMonth();
  await interaction.deferReply();

  const { result, source, candidates, error } = await runNomiSingularity(month);
  if (error) return interaction.editReply({ content: `Error: ${error}` });

  const embed = {
    title: '🏆 Nomi Singularity Result',
    color: 0xFFD700,
    fields: [
      { name: 'Month', value: month, inline: true },
      { name: 'Source', value: source, inline: true },
      { name: 'Decision', value: result.decision || 'N/A', inline: true },
      { name: 'Winner', value: result.winner_user_id ? `<@${result.winner_user_id}>` : 'None', inline: true },
      { name: 'Confidence', value: `${result.confidence || 0}%`, inline: true },
      { name: 'Reason', value: result.reason || 'N/A' },
    ],
    footer: { text: `Candidates evaluated: ${candidates?.length || 0}` },
  };

  if (result.risk_notes?.length > 0) {
    embed.fields.push({ name: 'Risk Notes', value: result.risk_notes.join('\n') });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function cmdReviewXPost(interaction) {
  const proofId = interaction.options.getInteger('proof_id');
  const action = interaction.options.getString('action');
  const points = interaction.options.getInteger('points') || (action === 'approve' ? 30 : 0);

  proofsRepo.reviewProof(proofId, {
    status: action === 'approve' ? 'approved' : 'rejected',
    points,
    reviewedBy: interaction.user.id,
  });

  await interaction.reply({
    content: `Proof #${proofId} ${action === 'approve' ? '✅ approved' : '❌ rejected'} (${points} points).`,
    ephemeral: true,
  });
}

async function cmdAdminBonus(interaction) {
  const target = interaction.options.getUser('user');
  const points = interaction.options.getInteger('points');
  const reason = interaction.options.getString('reason');

  const user = usersRepo.upsertUser(target.id, target.username);
  const month = getCurrentMonth();

  proofsRepo.addProof(user.id, {
    source: 'admin_bonus',
    url: `admin-bonus-${Date.now()}`,
    month,
  });
  proofsRepo.reviewProof(
    // Get the last inserted proof id
    require('../db/connection').getDb().prepare(
      'SELECT id FROM contribution_proofs WHERE user_id = ? ORDER BY id DESC LIMIT 1'
    ).get(user.id).id,
    { status: 'approved', points, reviewedBy: interaction.user.id }
  );

  await interaction.reply({
    content: `✅ Awarded ${points} bonus points to <@${target.id}>. Reason: ${reason}`,
    ephemeral: true,
  });
}

async function cmdWeeklyPosts(interaction) {
  const target = interaction.options.getUser('user');
  const user = usersRepo.getUserByDiscordId(target.id);
  if (!user) return interaction.reply({ content: 'User not found.', ephemeral: true });

  const month = getCurrentMonth();
  const summary = postsRepo.getMonthlyPostSummary(user.id, month);

  await interaction.reply({
    embeds: [{
      title: `📝 Weekly Posts — <@${target.id}>`,
      color: 0x5865F2,
      fields: [
        { name: 'Submitted', value: String(summary.totalSubmitted), inline: true },
        { name: 'Valid', value: String(summary.totalValid), inline: true },
        { name: 'High Quality', value: String(summary.totalHighQuality), inline: true },
        { name: 'Best Score', value: String(summary.bestQualityScore), inline: true },
        { name: 'Total Points', value: String(summary.totalPoints), inline: true },
      ],
    }],
    ephemeral: true,
  });
}

// ─── Member Commands ───

async function cmdSubmitXPost(interaction) {
  const url = interaction.options.getString('url');

  // Validate URL
  if (!url.match(/^https?:\/\/(x\.com|twitter\.com)\/\w+\/status\/\d+/)) {
    return interaction.reply({
      content: '❌ Invalid URL. Please submit a valid X/Twitter status URL.',
      ephemeral: true,
    });
  }

  const user = usersRepo.upsertUser(interaction.user.id, interaction.user.username);
  const month = getCurrentMonth();
  const result = proofsRepo.addProof(user.id, { source: 'x', url, month });

  if (!result.success) {
    return interaction.reply({ content: `❌ ${result.reason}`, ephemeral: true });
  }

  await interaction.reply({
    content: '✅ X post submitted for review. An admin will review it soon.',
    ephemeral: true,
  });
}

async function cmdSubmitBuilderProof(interaction) {
  const url = interaction.options.getString('url');
  const user = usersRepo.upsertUser(interaction.user.id, interaction.user.username);
  const month = getCurrentMonth();
  const result = proofsRepo.addProof(user.id, { source: 'builder_proof', url, month });

  if (!result.success) {
    return interaction.reply({ content: `❌ ${result.reason}`, ephemeral: true });
  }

  await interaction.reply({
    content: '✅ Builder proof submitted for review.',
    ephemeral: true,
  });
}

async function cmdMyContribution(interaction) {
  const month = interaction.options.getString('month') || getCurrentMonth();
  const user = usersRepo.getUserByDiscordId(interaction.user.id);
  if (!user) {
    return interaction.reply({ content: 'No data found for you yet. Start contributing!', ephemeral: true });
  }

  const metrics = metricsRepo.getMonthlyMetrics(user.id, month);
  const posts = postsRepo.getMonthlyPostSummary(user.id, month);
  const xPosts = proofsRepo.getApprovedXPostCount(user.id, month);
  const builderProofs = proofsRepo.getApprovedBuilderProofCount(user.id, month);
  const contestPts = contestsRepo.getMonthlyContestPoints(user.id, month);

  await interaction.reply({
    embeds: [{
      title: `📊 Your Contribution — ${month}`,
      color: 0x57F287,
      fields: [
        { name: 'Meaningful Messages', value: String(metrics.totalMeaningfulMessages), inline: true },
        { name: 'Active Days', value: String(metrics.activeDays), inline: true },
        { name: 'GenLayer Focus', value: String(metrics.avgGenlayerFocusScore), inline: true },
        { name: 'High Quality Posts', value: String(posts.totalHighQuality), inline: true },
        { name: 'Contest Points', value: String(contestPts), inline: true },
        { name: 'X Posts (Approved)', value: String(xPosts), inline: true },
        { name: 'Builder Proofs', value: String(builderProofs), inline: true },
        { name: 'Spam Flags', value: String(metrics.totalSpamFlags), inline: true },
      ],
    }],
    ephemeral: true,
  });
}

// ─── Helpers ───

function getStatusEmoji(level) {
  const map = { Healthy: '🟢', Watch: '🟡', Warning: '🟠', 'Purge Risk': '🔴', Critical: '⛔' };
  return map[level] || '⚪';
}

function getColor(level) {
  const map = { Healthy: 0x57F287, Watch: 0xFEE75C, Warning: 0xFFA500, 'Purge Risk': 0xED4245, Critical: 0xFF0000 };
  return map[level] || 0x5865F2;
}

module.exports = { handleInteraction };
