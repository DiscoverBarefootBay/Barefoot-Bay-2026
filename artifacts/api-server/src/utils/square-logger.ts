/**
 * Utility for logging Square API interactions and webhooks
 */
import fs from 'fs';
import path from 'path';

// Constants
const LOG_DIR = path.join(process.cwd(), 'server', 'logs');
const TRANSACTION_LOG_FILE = path.join(LOG_DIR, 'square-transactions.log');
const WEBHOOK_LOG_FILE = path.join(LOG_DIR, 'square-webhooks.log');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create log directory:', err);
  }
}

// Create log files if they don't exist
[TRANSACTION_LOG_FILE, WEBHOOK_LOG_FILE].forEach(file => {
  if (!fs.existsSync(file)) {
    try {
      fs.writeFileSync(file, `${path.basename(file)} - Created ${new Date().toISOString()}\n=====================\n\n`);
    } catch (err) {
      console.error(`Failed to create log file ${file}:`, err);
    }
  }
});

/**
 * Log a Square transaction
 * @param action The action or event type
 * @param data The data to log
 */
export function logTransaction(action: string, data: any): void {
  try {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${action}\n${JSON.stringify(data, null, 2)}\n${'='.repeat(50)}\n\n`;
    
    fs.appendFileSync(TRANSACTION_LOG_FILE, logMessage);
  } catch (err) {
    console.error('Failed to write transaction log:', err);
  }
}

/**
 * Log a Square webhook event
 * @param eventType The webhook event type
 * @param data The webhook data
 */
export function logWebhook(eventType: string, data: any): void {
  try {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] WEBHOOK: ${eventType}\n${JSON.stringify(data, null, 2)}\n${'='.repeat(50)}\n\n`;
    
    fs.appendFileSync(WEBHOOK_LOG_FILE, logMessage);
  } catch (err) {
    console.error('Failed to write webhook log:', err);
  }
}