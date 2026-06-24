/**
 * Custom logger utility that can disable console output in production environments
 * while preserving it during development for debugging purposes.
 */

const isDevelopment = import.meta.env.MODE === 'development';

// Store original console methods
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
};

// Create a logger object with methods that check environment before logging
export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      originalConsole.log(...args);
    }
  },
  error: (...args: any[]) => {
    // Always show errors, even in production
    originalConsole.error(...args);
  },
  warn: (...args: any[]) => {
    // Always show warnings, even in production
    originalConsole.warn(...args);
  },
  info: (...args: any[]) => {
    if (isDevelopment) {
      originalConsole.info(...args);
    }
  },
  debug: (...args: any[]) => {
    if (isDevelopment) {
      originalConsole.debug(...args);
    }
  }
};

// Optional: Replace console methods globally (uncomment to use)
// if (!isDevelopment) {
//   console.log = () => {};
//   console.info = () => {};
//   console.debug = () => {};
//   // Keep console.error and console.warn functional for critical issues
// }

export default logger;