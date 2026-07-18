import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Save the SQLite DB file in the root folder so it's easy to inspect and persistent
const DB_PATH = path.resolve(__dirname, '../../../traffic.db');

console.log('Connecting to SQLite Database at:', DB_PATH);
export const db = new Database(DB_PATH);

// Enable foreign key support and WAL mode for reliable concurrency
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// Helper functions for easy querying
export function query(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    return stmt.all(params);
  } catch (error) {
    console.error(`Database Query Error: ${sql}`, error);
    throw error;
  }
}

export function queryOne(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    return stmt.get(params);
  } catch (error) {
    console.error(`Database QueryOne Error: ${sql}`, error);
    throw error;
  }
}

export function run(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    return stmt.run(params);
  } catch (error) {
    console.error(`Database Run Error: ${sql}`, error);
    throw error;
  }
}

// Transaction runner
export function transaction(fn) {
  const trans = db.transaction(fn);
  return trans();
}
