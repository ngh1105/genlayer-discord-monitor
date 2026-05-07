process.env.DATABASE_PATH = process.env.DATABASE_PATH || './data/demo-monitor.db';
process.env.WEB_ADMIN_TOKEN = process.env.WEB_ADMIN_TOKEN || 'dev-dashboard-token';
process.env.WEB_BIND_HOST = process.env.WEB_BIND_HOST || '127.0.0.1';
process.env.WEB_PORT = process.env.WEB_PORT || '3000';

const { seedDemo } = require('../db/seed-demo');
const { closeDb } = require('../db/connection');
const { startWebDashboard } = require('./server');

const result = seedDemo({
  month: process.env.DEMO_MONTH,
  databasePath: process.env.DATABASE_PATH,
});

console.log(`Demo data ready for ${result.month}.`);
console.log(`Database: ${result.databasePath}`);
console.log(`Login token: ${process.env.WEB_ADMIN_TOKEN}`);

const server = startWebDashboard();

function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down demo dashboard...`);
  server.close(() => {
    closeDb();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
