const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config();

// Default configuration
const DEFAULT_CONFIG = {
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_TO_FILE: process.env.LOG_TO_FILE === 'true' || true,
  LOG_TO_CONSOLE: process.env.LOG_TO_CONSOLE === 'true' || true,
  LOG_DIR: process.env.LOG_DIR || './logs',
  CENTRALIZED_LOG_FILE: process.env.CENTRALIZED_LOG_FILE || 'application.log',
  MAX_LOG_FILE_SIZE: process.env.MAX_LOG_FILE_SIZE || '10MB',
  MAX_LOG_FILES: parseInt(process.env.MAX_LOG_FILES) || 5
};

// Ensure logs directory exists
const ensureLogDir = (logDir) => {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
    console.log(`📁 Created logs directory: ${logDir}`);
  }
};

// Create centralized logger factory
const createLogger = (serviceName, options = {}) => {
  // Merge default config with service-specific options
  const config = { ...DEFAULT_CONFIG, ...options };
  
  // Service-specific log level override
  const serviceLogLevel = process.env[`${serviceName.toUpperCase()}_LOG_LEVEL`] || config.LOG_LEVEL;
  
  // Ensure log directory exists (use absolute path from project root)
  const logDir = path.isAbsolute(config.LOG_DIR) ? config.LOG_DIR : path.resolve(__dirname, '..', config.LOG_DIR);
  ensureLogDir(logDir);
  config.LOG_DIR = logDir;
  
  // Define log format
  const logFormat = winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
      const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
      return `${timestamp} [${level.toUpperCase()}] [${service || serviceName}] ${message}${metaStr ? '\n' + metaStr : ''}`;
    })
  );
  
  // Define console format (more readable)
  const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({
      format: 'HH:mm:ss'
    }),
    winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
      const serviceTag = `[${service || serviceName}]`;
      const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
      return `${timestamp} ${level} ${serviceTag} ${message}${metaStr}`;
    })
  );
  
  // Configure transports
  const transports = [];
  
  // Console transport
  if (config.LOG_TO_CONSOLE) {
    transports.push(
      new winston.transports.Console({
        level: serviceLogLevel,
        format: consoleFormat
      })
    );
  }
  
  // File transports
  if (config.LOG_TO_FILE) {
    // Service-specific log file
    const serviceLogFile = path.join(config.LOG_DIR, `${serviceName}.log`);
    transports.push(
      new winston.transports.File({
        filename: serviceLogFile,
        level: serviceLogLevel,
        format: logFormat,
        maxsize: config.MAX_LOG_FILE_SIZE,
        maxFiles: config.MAX_LOG_FILES,
        tailable: true
      })
    );
    
    // Centralized log file (all services)
    const centralizedLogFile = path.join(config.LOG_DIR, config.CENTRALIZED_LOG_FILE);
    transports.push(
      new winston.transports.File({
        filename: centralizedLogFile,
        level: serviceLogLevel,
        format: logFormat,
        maxsize: config.MAX_LOG_FILE_SIZE,
        maxFiles: config.MAX_LOG_FILES,
        tailable: true
      })
    );
    
    // Error-only log file
    const errorLogFile = path.join(config.LOG_DIR, 'errors.log');
    transports.push(
      new winston.transports.File({
        filename: errorLogFile,
        level: 'error',
        format: logFormat,
        maxsize: config.MAX_LOG_FILE_SIZE,
        maxFiles: config.MAX_LOG_FILES,
        tailable: true
      })
    );
  }
  
  // Create winston logger
  const logger = winston.createLogger({
    level: serviceLogLevel,
    format: logFormat,
    defaultMeta: { 
      service: serviceName,
      pid: process.pid,
      hostname: require('os').hostname()
    },
    transports,
    exitOnError: false
  });
  
  // Add request logging middleware for Express
  logger.logRequest = (req, res, next) => {
    const start = Date.now();
    
    // Log request start
    logger.info('API Request Started', {
      method: req.method,
      url: req.url,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });
    
    // Override res.end to log completion
    const originalEnd = res.end;
    res.end = function(...args) {
      const duration = Date.now() - start;
      
      logger.info('API Request Completed', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        contentLength: res.get('Content-Length') || 0
      });
      
      originalEnd.apply(this, args);
    };
    
    next();
  };
  
  // Add startup info
  logger.info('Logger initialized', {
    serviceName,
    logLevel: serviceLogLevel,
    logToFile: config.LOG_TO_FILE,
    logToConsole: config.LOG_TO_CONSOLE,
    logDir: config.LOG_DIR,
    centralizedLogFile: config.CENTRALIZED_LOG_FILE,
    pid: process.pid
  });
  
  return logger;
};

// Export factory function and default logger
module.exports = {
  createLogger,
  DEFAULT_CONFIG
};
