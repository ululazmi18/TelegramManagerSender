// Frontend Logger Utility
class Logger {
  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.isProduction = process.env.NODE_ENV === 'production';
    this.logLevel = process.env.REACT_APP_LOG_LEVEL || process.env.FRONTEND_LOG_LEVEL || 'info';
    
    // Log levels hierarchy
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    
    this.currentLevel = this.levels[this.logLevel] || this.levels.info;
  }

  // Format log message with timestamp and context
  formatMessage(level, message, context = {}) {
    const timestamp = new Date().toISOString();
    const formattedContext = Object.keys(context).length > 0 ? JSON.stringify(context, null, 2) : '';
    
    return {
      timestamp,
      level: level.toUpperCase(),
      message,
      context,
      url: window.location.href,
      userAgent: navigator.userAgent,
      sessionId: this.getSessionId()
    };
  }

  // Get or create session ID for tracking
  getSessionId() {
    let sessionId = sessionStorage.getItem('logging_session_id');
    if (!sessionId) {
      sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('logging_session_id', sessionId);
    }
    return sessionId;
  }

  // Check if log level should be output
  shouldLog(level) {
    return this.levels[level] <= this.currentLevel;
  }

  // Send logs to backend in production
  async sendToBackend(logData) {
    if (!this.isProduction) return;
    
    try {
      await fetch('/api/logs/frontend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logData)
      });
    } catch (error) {
      // Silently fail to avoid infinite logging loops
      console.error('Failed to send log to backend:', error);
    }
  }

  // Error logging
  error(message, context = {}) {
    if (!this.shouldLog('error')) return;
    
    const logData = this.formatMessage('error', message, context);
    
    if (this.isDevelopment) {
      console.error(`🔴 [ERROR] ${message}`, context);
      console.trace();
    }
    
    this.sendToBackend(logData);
    
    // Store in localStorage for debugging
    this.storeLog('error', logData);
  }

  // Warning logging
  warn(message, context = {}) {
    if (!this.shouldLog('warn')) return;
    
    const logData = this.formatMessage('warn', message, context);
    
    if (this.isDevelopment) {
      console.warn(`🟡 [WARN] ${message}`, context);
    }
    
    this.sendToBackend(logData);
    this.storeLog('warn', logData);
  }

  // Info logging
  info(message, context = {}) {
    if (!this.shouldLog('info')) return;
    
    const logData = this.formatMessage('info', message, context);
    
    if (this.isDevelopment) {
      console.info(`🔵 [INFO] ${message}`, context);
    }
    
    this.sendToBackend(logData);
    this.storeLog('info', logData);
  }

  // Debug logging
  debug(message, context = {}) {
    if (!this.shouldLog('debug')) return;
    
    const logData = this.formatMessage('debug', message, context);
    
    if (this.isDevelopment) {
      console.debug(`🟢 [DEBUG] ${message}`, context);
    }
    
    this.sendToBackend(logData);
    this.storeLog('debug', logData);
  }

  // Store logs in localStorage for debugging
  storeLog(level, logData) {
    try {
      const logs = JSON.parse(localStorage.getItem('frontend_logs') || '[]');
      logs.push(logData);
      
      // Keep only last 100 logs
      if (logs.length > 100) {
        logs.splice(0, logs.length - 100);
      }
      
      localStorage.setItem('frontend_logs', JSON.stringify(logs));
    } catch (error) {
      // Ignore localStorage errors
    }
  }

  // Get stored logs for debugging
  getLogs() {
    try {
      return JSON.parse(localStorage.getItem('frontend_logs') || '[]');
    } catch (error) {
      return [];
    }
  }

  // Clear stored logs
  clearLogs() {
    localStorage.removeItem('frontend_logs');
  }

  // Log API requests
  logApiRequest(method, url, data = null, duration = null) {
    this.debug('API Request', {
      operation: 'api_request',
      method,
      url,
      hasData: !!data,
      dataKeys: data ? Object.keys(data) : [],
      duration: duration ? `${duration}ms` : null
    });
  }

  // Log API responses
  logApiResponse(method, url, status, data = null, duration = null) {
    const level = status >= 400 ? 'error' : status >= 300 ? 'warn' : 'debug';
    
    this[level]('API Response', {
      operation: 'api_response',
      method,
      url,
      status,
      hasData: !!data,
      duration: duration ? `${duration}ms` : null,
      error: status >= 400 ? data : null
    });
  }

  // Log user actions
  logUserAction(action, context = {}) {
    this.info('User Action', {
      operation: 'user_action',
      action,
      ...context
    });
  }

  // Log component lifecycle
  logComponentLifecycle(component, event, context = {}) {
    this.debug('Component Lifecycle', {
      operation: 'component_lifecycle',
      component,
      event,
      ...context
    });
  }

  // Log errors with stack trace
  logError(error, context = {}) {
    this.error('JavaScript Error', {
      operation: 'javascript_error',
      message: error.message,
      stack: error.stack,
      name: error.name,
      ...context
    });
  }

  // Log performance metrics
  logPerformance(operation, duration, context = {}) {
    this.info('Performance Metric', {
      operation: 'performance',
      metric: operation,
      duration: `${duration}ms`,
      ...context
    });
  }
}

// Create singleton instance
const logger = new Logger();

// Global error handler
window.addEventListener('error', (event) => {
  logger.logError(event.error, {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    type: 'global_error'
  });
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled Promise Rejection', {
    operation: 'unhandled_rejection',
    reason: event.reason,
    stack: event.reason?.stack
  });
});

export default logger;
