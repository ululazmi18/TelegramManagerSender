// Use sql.js for Termux compatibility (pure JavaScript, no native compilation)
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, '../db/telegram_app.db');

// Wrapper class to make sql.js compatible with sqlite3 API
class SqlJsWrapper {
  constructor() {
    this.db = null;
    this.initPromise = this.init();
  }

  async init() {
    const SQL = await initSqlJs();
    try {
      if (fs.existsSync(dbPath)) {
        const buffer = fs.readFileSync(dbPath);
        this.db = new SQL.Database(buffer);
      } else {
        this.db = new SQL.Database();
        // Ensure directory exists
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }
    } catch (err) {
      this.db = new SQL.Database();
    }
  }

  saveToFile() {
    if (this.db) {
      try {
        const data = this.db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(dbPath, buffer);
      } catch (err) {
        console.error('Error saving database:', err);
      }
    }
  }

  serialize(callback) {
    // Wait for init to complete, then run callback synchronously
    this.initPromise.then(() => {
      callback();
      this.saveToFile();
    }).catch(console.error);
  }

  run(sql, params, callback) {
    // Execute immediately if already initialized
    const execute = () => {
      try {
        if (typeof params === 'function') {
          callback = params;
          params = [];
        }
        
        console.log('DB run starting:', sql.substring(0, 50) + '...', 'params:', params?.length || 0);
        const startTime = Date.now();
        
        let changes = 0;
        let lastID = 0;
        
        // sql.js uses prepare() and bind() for parameterized queries
        if (params && params.length > 0) {
          const stmt = this.db.prepare(sql);
          stmt.bind(params);
          const result = stmt.step();
          changes = this.db.getRowsModified();
          stmt.free();
          console.log('DB run with params completed, changes:', changes);
        } else {
          const result = this.db.exec(sql);
          changes = this.db.getRowsModified();
          console.log('DB exec result:', result?.length || 0, 'statements, changes:', changes);
        }
        
        // Force save to file immediately with timeout protection
        const saveStartTime = Date.now();
        try {
          this.saveToFile();
          console.log('DB file save completed in', Date.now() - saveStartTime, 'ms');
        } catch (saveErr) {
          console.error('DB file save error:', saveErr);
        }
        
        const totalTime = Date.now() - startTime;
        console.log('DB run total time:', totalTime, 'ms');
        
        // Immediate callback with operation stats
        if (callback) {
          // Mimic sqlite3 callback signature
          const context = { changes, lastID };
          callback.call(context, null);
        }
        
      } catch (err) {
        // Ignore "no such table" errors during initialization
        const errorMessage = err.message || err.toString() || 'Unknown error';
        if (!errorMessage.includes('no such table')) {
          console.error('DB run error:', errorMessage);
        }
        if (callback) callback(err);
      }
    };
    
    if (this.db) {
      execute();
    } else {
      this.initPromise.then(execute).catch(err => {
        if (callback) callback(err);
      });
    }
  }

  get(sql, params, callback) {
    this.initPromise.then(() => {
      try {
        if (typeof params === 'function') {
          callback = params;
          params = [];
        }
        
        let result;
        if (params && params.length > 0) {
          const stmt = this.db.prepare(sql);
          result = stmt.getAsObject(params);
          stmt.free();
          if (callback) callback(null, result);
          return;
        } else {
          result = this.db.exec(sql);
        }
        
        if (result.length > 0 && result[0].values.length > 0) {
          const columns = result[0].columns;
          const values = result[0].values[0];
          const row = {};
          columns.forEach((col, i) => {
            row[col] = values[i];
          });
          if (callback) callback(null, row);
        } else {
          if (callback) callback(null, null);
        }
      } catch (err) {
        const errorMessage = err.message || err.toString() || 'Unknown error';
        console.error('DB get error:', errorMessage);
        if (callback) callback(err, null);
      }
    }).catch(err => {
      if (callback) callback(err, null);
    });
  }

  all(sql, params, callback) {
    this.initPromise.then(() => {
      try {
        if (typeof params === 'function') {
          callback = params;
          params = [];
        }
        
        console.log('DB all query:', sql, 'params:', params);
        let result;
        if (params && params.length > 0) {
          const stmt = this.db.prepare(sql);
          stmt.bind(params);
          const rows = [];
          while (stmt.step()) {
            rows.push(stmt.getAsObject());
          }
          stmt.free();
          console.log('DB all result (parameterized):', rows.length, 'rows');
          if (callback) callback(null, rows);
          return;
        } else {
          result = this.db.exec(sql);
        }
        
        if (result.length > 0) {
          const columns = result[0].columns;
          const rows = result[0].values.map(values => {
            const row = {};
            columns.forEach((col, i) => {
              row[col] = values[i];
            });
            return row;
          });
          if (callback) callback(null, rows);
        } else {
          if (callback) callback(null, []);
        }
      } catch (err) {
        const errorMessage = err.message || err.toString() || 'Unknown error';
        console.error('DB all error:', errorMessage);
        if (callback) callback(err, []);
      }
    }).catch(err => {
      if (callback) callback(err, []);
    });
  }

  close(callback) {
    this.initPromise.then(() => {
      this.saveToFile();
      if (this.db) {
        this.db.close();
      }
      if (callback) callback(null);
    }).catch(err => {
      if (callback) callback(err);
    });
  }
}

const db = new SqlJsWrapper();

const initDB = () => {
  // Create all tables as defined in QWEN.md
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

    // API Credentials table
    db.run(`CREATE TABLE IF NOT EXISTS api_credentials (
      id TEXT PRIMARY KEY,
      name TEXT,
      api_id INTEGER,
      api_hash TEXT,
      owner TEXT,
      is_active INTEGER DEFAULT 1
    )`);

    // Channels table
    db.run(`CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      name TEXT,
      chat_id TEXT,
      username TEXT,
      created_at DATETIME DEFAULT (datetime('now'))
    )`);

    // Categories table
    db.run(`CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now'))
    )`);

    // Category Channels junction table
    db.run(`CREATE TABLE IF NOT EXISTS category_channels (
      id TEXT PRIMARY KEY,
      category_id TEXT,
      channel_id TEXT,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
      FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
      UNIQUE(category_id, channel_id)
    )`);

    // Files table
    db.run(`CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      filename TEXT,
      file_type TEXT CHECK (file_type IN ('text','photo','video','other')),
      path TEXT,
      size INTEGER,
      owner TEXT,
      created_at DATETIME DEFAULT (datetime('now'))
    )`);

    // Projects table
    db.run(`CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      owner TEXT,
      status TEXT CHECK (status IN ('stopped','running','paused','failed')),
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now')),
      config TEXT
    )`);

    // Project Targets table
    db.run(`CREATE TABLE IF NOT EXISTS project_targets (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      channel_id TEXT,
      priority INTEGER,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
    )`);

    // Project Sessions table
    db.run(`CREATE TABLE IF NOT EXISTS project_sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      session_id TEXT,
      selection_mode TEXT CHECK(selection_mode IN ('manual','random'))
    )`);

    // Project Messages table
    db.run(`CREATE TABLE IF NOT EXISTS project_messages (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      message_type TEXT,
      content_ref TEXT,
      caption TEXT
    )`);

    // Process Runs table
    db.run(`CREATE TABLE IF NOT EXISTS process_runs (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      started_by TEXT,
      status TEXT CHECK (status IN ('queued','running','completed','failed','stopped')),
      stats TEXT,
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now'))
    )`);

    // Delays table
    db.run(`CREATE TABLE IF NOT EXISTS delays (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      delay_between_channels_ms INTEGER,
      delay_between_sessions_ms INTEGER,
      jitter_max_ms INTEGER
    )`);

    // Logs table
    db.run(`CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT,
      level TEXT,
      message TEXT,
      meta TEXT,
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )`);
  });

  // Best-effort migrations: add columns if they don't exist
  const ensureColumn = (table, column, type) => {
    // PRAGMA read not used; we will try add column and ignore errors if exists
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`, [], () => {});
  };

  ensureColumn('sessions', 'tg_id', 'INTEGER');
  ensureColumn('sessions', 'first_name', 'TEXT');
  ensureColumn('sessions', 'last_name', 'TEXT');
  ensureColumn('sessions', 'username', 'TEXT');
  ensureColumn('sessions', 'phone_number', 'TEXT');
  ensureColumn('sessions', 'login_at', "DATETIME DEFAULT (datetime('now'))");
  
  // Ensure channels table has required columns
  ensureColumn('channels', 'name', 'TEXT');
  ensureColumn('channels', 'chat_id', 'TEXT');
  
  // Add missing id column to logs if needed
  ensureColumn('logs', 'id', 'TEXT');

  console.log('Database initialized successfully');
};

module.exports = { db, initDB };