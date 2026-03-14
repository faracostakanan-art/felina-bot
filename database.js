const Database = require('better-sqlite3');
const db = new Database('users.db');

// Crée la table "users" si elle n'existe pas
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT,
    solde REAL DEFAULT 0
  )
`).run();

module.exports = db;