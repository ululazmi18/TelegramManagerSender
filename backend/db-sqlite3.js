const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('./logger');

const dbPath = path.join(__dirname, '..', 'db', 'telegram_app.db');

logger.info('Initializing SQLite database', { dbPath });

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    logger.error('Failed to connect to SQLite database', {
      error: err.message,
      dbPath
    });
  } else {
    logger.info('Successfully connected to SQLite database', { dbPath });
  }
});

// Wrap database methods with logging
const originalRun = db.run.bind(db);
const originalGet = db.get.bind(db);
const originalAll = db.all.bind(db);
const originalEach = db.each.bind(db);

db.run = function(sql, params, callback) {
  const start = Date.now();
  const operation = 'RUN';
  
  logger.debug('Database RUN operation started', {
    sql: sql.replace(/\s+/g, ' ').trim(),
    params: Array.isArray(params) ? params : (params ? [params] : [])
  });

  const wrappedCallback = function(err) {
    const duration = Date.now() - start;
    
    if (err) {
      logger.error('Database RUN operation failed', {
        error: err.message,
        sql: sql.replace(/\s+/g, ' ').trim(),
        params: Array.isArray(params) ? params : (params ? [params] : []),
        duration: `${duration}ms`
      });
    } else {
      logger.debug('Database RUN operation completed', {
        sql: sql.replace(/\s+/g, ' ').trim(),
        changes: this.changes,
        lastID: this.lastID,
        duration: `${duration}ms`
      });
    }
    
    if (callback) callback.call(this, err);
  };

  return originalRun(sql, params, wrappedCallback);
};

db.get = function(sql, params, callback) {
  const start = Date.now();
  
  logger.debug('Database GET operation started', {
    sql: sql.replace(/\s+/g, ' ').trim(),
    params: Array.isArray(params) ? params : (params ? [params] : [])
  });

  const wrappedCallback = function(err, row) {
    const duration = Date.now() - start;
    
    if (err) {
      logger.error('Database GET operation failed', {
        error: err.message,
        sql: sql.replace(/\s+/g, ' ').trim(),
        params: Array.isArray(params) ? params : (params ? [params] : []),
        duration: `${duration}ms`
      });
    } else {
      logger.debug('Database GET operation completed', {
        sql: sql.replace(/\s+/g, ' ').trim(),
        hasResult: !!row,
        duration: `${duration}ms`
      });
    }
    
    if (callback) callback(err, row);
  };

  return originalGet(sql, params, wrappedCallback);
};

db.all = function(sql, params, callback) {
  const start = Date.now();
  
  logger.debug('Database ALL operation started', {
    sql: sql.replace(/\s+/g, ' ').trim(),
    params: Array.isArray(params) ? params : (params ? [params] : [])
  });

  const wrappedCallback = function(err, rows) {
    const duration = Date.now() - start;
    
    if (err) {
      logger.error('Database ALL operation failed', {
        error: err.message,
        sql: sql.replace(/\s+/g, ' ').trim(),
        params: Array.isArray(params) ? params : (params ? [params] : []),
        duration: `${duration}ms`
      });
    } else {
      logger.debug('Database ALL operation completed', {
        sql: sql.replace(/\s+/g, ' ').trim(),
        rowCount: rows ? rows.length : 0,
        duration: `${duration}ms`
      });
    }
    
    if (callback) callback(err, rows);
  };

  return originalAll(sql, params, wrappedCallback);
};

// Database connection events
db.on('error', (err) => {
  logger.error('Database error event', {
    error: err.message,
    stack: err.stack
  });
});

db.on('open', () => {
  logger.info('Database connection opened');
});

db.on('close', () => {
  logger.info('Database connection closed');
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Closing database connection due to SIGINT');
  db.close((err) => {
    if (err) {
      logger.error('Error closing database', { error: err.message });
    } else {
      logger.info('Database connection closed successfully');
    }
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  logger.info('Closing database connection due to SIGTERM');
  db.close((err) => {
    if (err) {
      logger.error('Error closing database', { error: err.message });
    } else {
      logger.info('Database connection closed successfully');
    }
    process.exit(0);
  });
});

// Initialize tables
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

  console.log('Database tables initialized');
});

module.exports = { db };
