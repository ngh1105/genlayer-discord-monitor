const config = require('../config');
const { getDb, closeDb } = require('../db/connection');
const { startWebDashboard } = require('./server');

if (!config.WEB_ADMIN_TOKEN) {
  config.WEB_ADMIN_TOKEN = 'dev-dashboard-token';
  console.log('WEB_ADMIN_TOKEN not set; using dev-dashboard-token for this process.');
}

getDb();
const server = startWebDashboard();

function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down dashboard...`);
  server.close(() => {
    closeDb();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
