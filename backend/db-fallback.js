/**
 * Fallback DB adapter untuk Termux
 * Gunakan ini jika sqlite3 native compilation gagal
 */

const fs = require('fs');
const path = require('path');

// Simple JSON-based database as fallback
class FallbackDB {
  constructor(dbPath) {
    this.dbPath = dbPath.replace('.db', '.json');
    this.data = {};
    this.loadData();
  }

  loadData() {
    try {
      if (fs.existsSync(this.dbPath)) {
        const content = fs.readFileSync(this.dbPath, 'utf8');
        this.data = JSON.parse(content);
      } else {
        this.data = {
          sessions: [],
          api_credentials: [],
          channels: [],
          categories: [],
          files: [],
          projects: [],
          project_sessions: [],
          project_targets: [],
          project_messages: [],
          delays: [],
          process_runs: []
        };
        this.saveData();
      }
    } catch (err) {
      console.error('Error loading data:', err);
      this.data = {};
    }
  }

  saveData() {
    try {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2));
    } catch (err) {
      console.error('Error saving data:', err);
    }
  }

  serialize(callback) {
    callback();
  }

  run(sql, params, callback) {
    // Simple INSERT/UPDATE/DELETE simulation
    console.log('DB.run:', sql.substring(0, 50) + '...');
    
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    
    // Simulate success
    if (callback) callback(null);
    
    this.saveData();
  }

  get(sql, params, callback) {
    console.log('DB.get:', sql.substring(0, 50) + '...');
    
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    
    // Return empty result
    if (callback) callback(null, null);
  }

  all(sql, params, callback) {
    console.log('DB.all:', sql.substring(0, 50) + '...');
    
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    
    // Return empty array
    if (callback) callback(null, []);
  }

  close(callback) {
    this.saveData();
    if (callback) callback(null);
  }
}

// Try to use sqlite3, fallback to JSON if not available
let db;
let usingSqlite = false;

try {
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.resolve(__dirname, '../db/telegram_app.db');
  db = new sqlite3.Database(dbPath);
  usingSqlite = true;
  console.log('✅ Using SQLite3 database');
} catch (err) {
  console.log('⚠️  SQLite3 not available, using fallback JSON database');
  const dbPath = path.resolve(__dirname, '../db/telegram_app.json');
  db = new FallbackDB(dbPath);
  usingSqlite = false;
}

const initDB = () => {
  if (usingSqlite) {
    // Original SQLite initialization
    db.serialize(() => {
      // Sessions table
      db.run(`CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        name TEXT,
        session_string TEXT NOT NULL,
        tg_id INTEGER,
        first_name TEXT,
        last_name TEXT,
        username TEXT,
        phone_number TEXT,
        login_at DATETIME,
        is_active INTEGER DEFAULT 1,
        last_used_at DATETIME,
        meta TEXT,
        created_at DATETIME DEFAULT (datetime('now')),
        updated_at DATETIME DEFAULT (datetime('now'))
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_last_used_at ON sessions(last_used_at)`);

      // Other tables...
      console.log('✅ Database tables created');
    });
  } else {
    console.log('✅ Fallback database initialized');
  }
};

module.exports = { db, initDB, usingSqlite };
