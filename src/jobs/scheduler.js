const cron = require('node-cron');
const { calculateAllRoleHealth } = require('../services/role-health');
const { pruneMessageLogs } = require('../services/message-classifier');

let client = null;

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Initialize all scheduled jobs.
 */
function initJobs(discordClient) {
  client = discordClient;

  // Daily at 00:05 UTC: calculate role health for all users
  cron.schedule('5 0 * * *', async () => {
    console.log('[Job] Running daily role health calculation...');
    try {
      const month = getCurrentMonth();
      const results = calculateAllRoleHealth(month);

      // Send alerts for Warning, Purge Risk, Critical
      const alerts = results.filter(r =>
        ['Warning', 'Purge Risk', 'Critical'].includes(r.riskLevel)
      );

      if (alerts.length > 0 && client) {
        await sendRoleAlerts(alerts);
      }

      console.log(`[Job] Role health done: ${results.length} reports, ${alerts.length} alerts.`);
    } catch (err) {
      console.error('[Job] Role health error:', err.message);
    }
  });

  // Daily at 01:00 UTC: prune old message logs
  cron.schedule('0 1 * * *', () => {
    console.log('[Job] Pruning old message logs...');
    try {
      const pruned = pruneMessageLogs();
      console.log(`[Job] Pruned ${pruned} old message log entries.`);
    } catch (err) {
      console.error('[Job] Prune error:', err.message);
    }
  });

  console.log('[Jobs] Scheduled jobs initialized.');
}

/**
 * Send role risk alerts to admin channel.
 */
async function sendRoleAlerts(alerts) {
  const config = require('../config');
  if (!config.ADMIN_ALERT_CHANNEL_ID || !client) return;

  try {
    const channel = await client.channels.fetch(config.ADMIN_ALERT_CHANNEL_ID);
    if (!channel) return;

    for (const alert of alerts.slice(0, 10)) {
      const metrics = alert.metrics || {};
      const embed = {
        title: '⚠️ Role Risk Alert',
        color: getAlertColor(alert.riskLevel),
        fields: [
          { name: 'User', value: `<@${alert.discordUserId}>`, inline: true },
          { name: 'Role', value: alert.role, inline: true },
          { name: 'Status', value: alert.riskLevel, inline: true },
          { name: 'Reason', value: alert.reason || 'N/A' },
          {
            name: 'Current Metrics',
            value: [
              `Meaningful messages: ${metrics.meaningful_messages || 0}`,
              `Active days: ${metrics.active_days || 0}`,
              `Spam flags: ${metrics.spam_flags || 0}`,
              `GenLayer focus: ${metrics.genlayer_focus_score || 0}`,
            ].join('\n'),
          },
        ],
        timestamp: new Date().toISOString(),
      };

      await channel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error('[Alert] Failed to send:', err.message);
  }
}

function getAlertColor(level) {
  switch (level) {
    case 'Critical': return 0xFF0000;
    case 'Purge Risk': return 0xFF4500;
    case 'Warning': return 0xFFA500;
    case 'Watch': return 0xFFFF00;
    default: return 0x00FF00;
  }
}

module.exports = { initJobs };
