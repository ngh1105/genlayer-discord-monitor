const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const config = require('../config');

let db = null;

/**
 * Get or create the database connection.
 * Creates the data directory and initializes schema if needed.
 */
function getDb() {
  if (db) return db;

  const dbDir = path.dirname(path.resolve(config.DATABASE_PATH));
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(path.resolve(config.DATABASE_PATH));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Initialize schema
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  applyMigrations(db);

  return db;
}

function applyMigrations(database) {
  ensureColumn(database, 'genlayer_evaluations', 'source', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, 'genlayer_evaluations', 'error_message', "TEXT NOT NULL DEFAULT ''");
}

function ensureColumn(database, tableName, columnName, definition) {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all();
  if (!columns.some(column => column.name === columnName)) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

/**
 * Close the database connection.
 */
function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, closeDb };
