// Use centralized logger
const { createLogger } = require('../shared/logger');

// Create backend-specific logger
const logger = createLogger('backend', {
  // Backend can override default config here if needed
});

// Log uncaught exceptions
logger.exceptions.handle(
  new (require('winston')).transports.File({ 
    filename: require('path').join(process.env.LOG_DIR || './logs', 'exceptions.log'),
    maxsize: process.env.MAX_LOG_FILE_SIZE || '10MB',
    maxFiles: parseInt(process.env.MAX_LOG_FILES) || 3
  })
);

// Log unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', {
    promise: promise,
    reason: reason
  });
});

// Helper functions for structured logging
logger.logRequest = (req, res, next) => {
  const start = Date.now();
  
  logger.info('API Request Started', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length')
  });

  // Log request body for POST/PUT requests (excluding sensitive data)
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const sanitizedBody = { ...req.body };
    // Remove sensitive fields
    delete sanitizedBody.session_string;
    delete sanitizedBody.api_hash;
    delete sanitizedBody.password;
    
    logger.debug('Request Body', {
      method: req.method,
      url: req.originalUrl,
      body: sanitizedBody
    });
  }

  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - start;
    
    logger.info('API Request Completed', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: data ? data.length : 0
    });

    if (res.statusCode >= 400) {
      logger.warn('API Request Error Response', {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        response: data ? JSON.parse(data) : null
      });
    }

    originalSend.call(this, data);
  };

  next();
};

logger.logError = (operation, error, context = {}) => {
  logger.error(`${operation} failed`, {
    error: error.message,
    stack: error.stack,
    ...context
  });
};

logger.logDatabase = (operation, sql, params = [], duration = null) => {
  logger.debug('Database Operation', {
    operation,
    sql: sql.replace(/\s+/g, ' ').trim(),
    params,
    duration: duration ? `${duration}ms` : null
  });
};

logger.logDatabaseError = (operation, error, sql, params = []) => {
  logger.error('Database Operation Failed', {
    operation,
    error: error.message,
    sql: sql.replace(/\s+/g, ' ').trim(),
    params
  });
};

module.exports = logger;
