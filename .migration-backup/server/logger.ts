/**
 * Shared logger module
 * This provides consistent logging across the application
 */

// Define log levels
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

// Configure the minimum log level (can be overridden by environment)
const MIN_LOG_LEVEL = process.env.LOG_LEVEL ? 
  (LogLevel[process.env.LOG_LEVEL as keyof typeof LogLevel] || LogLevel.INFO) : 
  LogLevel.INFO;

class Logger {
  private prefix: string;

  constructor(prefix: string = '') {
    this.prefix = prefix ? `[${prefix}] ` : '';
  }

  /**
   * Log a debug message
   */
  debug(message: string, ...args: any[]) {
    if (MIN_LOG_LEVEL <= LogLevel.DEBUG) {
      console.debug(`${this.prefix}${message}`, ...args);
    }
  }

  /**
   * Log an info message
   */
  info(message: string, ...args: any[]) {
    if (MIN_LOG_LEVEL <= LogLevel.INFO) {
      console.info(`${this.prefix}${message}`, ...args);
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string, ...args: any[]) {
    if (MIN_LOG_LEVEL <= LogLevel.WARN) {
      console.warn(`${this.prefix}${message}`, ...args);
    }
  }

  /**
   * Log an error message
   */
  error(message: string, ...args: any[]) {
    if (MIN_LOG_LEVEL <= LogLevel.ERROR) {
      console.error(`${this.prefix}${message}`, ...args);
    }
  }

  /**
   * Create a child logger with additional prefix
   */
  child(prefix: string): Logger {
    return new Logger(`${this.prefix.replace(/[\[\]]/g, '')}:${prefix}`);
  }
}

// Create the default logger
const logger = new Logger('Server');

export default logger;