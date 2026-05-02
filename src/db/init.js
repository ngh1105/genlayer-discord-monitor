/**
 * Database initialization script.
 * Run with: npm run db:init
 */
const { getDb, closeDb } = require('./connection');

console.log('Initializing database...');

try {
  const db = getDb();
  console.log('Database initialized successfully.');

  // Show table info
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  ).all();

  console.log(`\nCreated ${tables.length} tables:`);
  for (const t of tables) {
    const count = db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get();
    console.log(`  - ${t.name} (${count.c} rows)`);
  }
} catch (err) {
  console.error('Failed to initialize database:', err.message);
  process.exit(1);
} finally {
  closeDb();
}
