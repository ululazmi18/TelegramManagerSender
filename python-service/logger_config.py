"""
Centralized Python Logger Configuration
Compatible with Node.js winston logger format
"""
import logging
import json
import os
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path

# Load environment variables (optional)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # dotenv not available, use system environment variables
    pass

class JSONFormatter(logging.Formatter):
    """Custom JSON formatter to match winston format"""
    
    def format(self, record):
        # Create log entry
        log_entry = {
            'timestamp': datetime.fromtimestamp(record.created).strftime('%Y-%m-%d %H:%M:%S'),
            'level': record.levelname.lower(),
            'message': record.getMessage(),
            'service': 'python-service',
            'pid': os.getpid(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno
        }
        
        # Add exception info if present
        if record.exc_info:
            log_entry['exception'] = self.formatException(record.exc_info)
        
        # Add extra fields from record
        for key, value in record.__dict__.items():
            if key not in ['name', 'msg', 'args', 'levelname', 'levelno', 'pathname', 
                          'filename', 'module', 'lineno', 'funcName', 'created', 
                          'msecs', 'relativeCreated', 'thread', 'threadName', 
                          'processName', 'process', 'getMessage', 'exc_info', 'exc_text', 'stack_info']:
                log_entry[key] = value
        
        return json.dumps(log_entry)

class ConsoleFormatter(logging.Formatter):
    """Human-readable console formatter"""
    
    COLORS = {
        'DEBUG': '\033[36m',    # Cyan
        'INFO': '\033[32m',     # Green
        'WARNING': '\033[33m',  # Yellow
        'ERROR': '\033[31m',    # Red
        'CRITICAL': '\033[35m', # Magenta
        'RESET': '\033[0m'      # Reset
    }
    
    def format(self, record):
        color = self.COLORS.get(record.levelname, self.COLORS['RESET'])
        reset = self.COLORS['RESET']
        
        timestamp = datetime.fromtimestamp(record.created).strftime('%H:%M:%S')
        service_tag = '[python-service]'
        
        formatted = f"{timestamp} {color}{record.levelname}{reset} {service_tag} {record.getMessage()}"
        
        # Add exception info if present
        if record.exc_info:
            formatted += '\n' + self.formatException(record.exc_info)
            
        return formatted

def setup_logger(name='python-service'):
    """Setup centralized logger for Python service"""
    
    # Configuration from environment
    LOG_LEVEL = os.getenv('PYTHON_LOG_LEVEL', os.getenv('LOG_LEVEL', 'info')).upper()
    LOG_TO_FILE = os.getenv('LOG_TO_FILE', 'true').lower() == 'true'
    LOG_TO_CONSOLE = os.getenv('LOG_TO_CONSOLE', 'true').lower() == 'true'
    LOG_DIR = os.getenv('LOG_DIR', '../logs')
    CENTRALIZED_LOG_FILE = os.getenv('CENTRALIZED_LOG_FILE', 'application.log')
    MAX_LOG_FILE_SIZE = os.getenv('MAX_LOG_FILE_SIZE', '10MB')
    MAX_LOG_FILES = int(os.getenv('MAX_LOG_FILES', '5'))
    
    # Convert size string to bytes
    size_multipliers = {'KB': 1024, 'MB': 1024*1024, 'GB': 1024*1024*1024}
    max_bytes = 10 * 1024 * 1024  # Default 10MB
    
    if MAX_LOG_FILE_SIZE.upper().endswith(('KB', 'MB', 'GB')):
        size_value = int(MAX_LOG_FILE_SIZE[:-2])
        size_unit = MAX_LOG_FILE_SIZE[-2:].upper()
        max_bytes = size_value * size_multipliers.get(size_unit, 1024*1024)
    
    # Ensure logs directory exists
    log_dir_path = Path(LOG_DIR)
    if not log_dir_path.is_absolute():
        # Use parent directory (project root) for centralized logging
        log_dir_path = Path(__file__).parent.parent / log_dir_path
    log_dir_path.mkdir(parents=True, exist_ok=True)
    
    # Create logger
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))
    
    # Clear existing handlers
    logger.handlers.clear()
    
    # Console handler
    if LOG_TO_CONSOLE:
        console_handler = logging.StreamHandler()
        console_handler.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))
        console_handler.setFormatter(ConsoleFormatter())
        logger.addHandler(console_handler)
    
    # File handlers
    if LOG_TO_FILE:
        # Service-specific log file
        service_log_file = log_dir_path / 'python-service.log'
        service_handler = RotatingFileHandler(
            service_log_file,
            maxBytes=max_bytes,
            backupCount=MAX_LOG_FILES
        )
        service_handler.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))
        service_handler.setFormatter(JSONFormatter())
        logger.addHandler(service_handler)
        
        # Centralized log file
        centralized_log_file = log_dir_path / CENTRALIZED_LOG_FILE
        centralized_handler = RotatingFileHandler(
            centralized_log_file,
            maxBytes=max_bytes,
            backupCount=MAX_LOG_FILES
        )
        centralized_handler.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))
        centralized_handler.setFormatter(JSONFormatter())
        logger.addHandler(centralized_handler)
        
        # Error-only log file
        error_log_file = log_dir_path / 'errors.log'
        error_handler = RotatingFileHandler(
            error_log_file,
            maxBytes=max_bytes,
            backupCount=MAX_LOG_FILES
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(JSONFormatter())
        logger.addHandler(error_handler)
    
    # Log initialization
    logger.info('Python logger initialized', extra={
        'logLevel': LOG_LEVEL,
        'logToFile': LOG_TO_FILE,
        'logToConsole': LOG_TO_CONSOLE,
        'logDir': str(log_dir_path),
        'centralizedLogFile': CENTRALIZED_LOG_FILE,
        'maxLogFileSize': MAX_LOG_FILE_SIZE,
        'maxLogFiles': MAX_LOG_FILES
    })
    
    return logger

# Create default logger instance
logger = setup_logger()

# Helper functions for structured logging
def log_request(method, url, **kwargs):
    """Log HTTP request"""
    logger.info(f'📨 {method} REQUEST - {url}', extra={
        'operation': 'http_request',
        'method': method,
        'url': url,
        **kwargs
    })

def log_response(method, url, status_code, duration=None, **kwargs):
    """Log HTTP response"""
    status_emoji = '✅' if status_code < 400 else '❌'
    logger.info(f'{status_emoji} {method} RESPONSE - {url} ({status_code})', extra={
        'operation': 'http_response',
        'method': method,
        'url': url,
        'statusCode': status_code,
        'duration': f'{duration}ms' if duration else None,
        **kwargs
    })

def log_telegram_operation(operation, **kwargs):
    """Log Telegram API operation"""
    logger.info(f'📱 TELEGRAM - {operation}', extra={
        'operation': 'telegram_api',
        'telegramOperation': operation,
        **kwargs
    })

def log_database_operation(operation, **kwargs):
    """Log database operation"""
    logger.debug(f'🗄️ DATABASE - {operation}', extra={
        'operation': 'database',
        'databaseOperation': operation,
        **kwargs
    })

def log_error(operation, error, **kwargs):
    """Log error with context"""
    logger.error(f'❌ ERROR - {operation}', extra={
        'operation': 'error',
        'errorOperation': operation,
        'error': str(error),
        'errorType': type(error).__name__,
        **kwargs
    }, exc_info=True)
