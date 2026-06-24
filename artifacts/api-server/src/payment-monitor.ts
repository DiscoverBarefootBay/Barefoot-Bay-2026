/**
 * Payment Monitoring and Notification System
 * Logs payment events and notifies admins of issues
 */

export interface PaymentEvent {
  type: 'success' | 'pending' | 'failed' | 'webhook_received' | 'reconciliation' | 'double_credit_prevented';
  userId: number;
  orderId?: string;
  credits?: number;
  source: 'webhook' | 'redirect' | 'reconciliation' | 'manual';
  details?: any;
  timestamp: Date;
}

export interface PaymentIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'pending_too_long' | 'webhook_missing' | 'redirect_failed' | 'duplicate_attempt' | 'unknown_error';
  userId: number;
  orderId?: string;
  description: string;
  details?: any;
  timestamp: Date;
}

class PaymentMonitor {
  private events: PaymentEvent[] = [];
  private issues: PaymentIssue[] = [];
  private maxEventsInMemory = 1000;
  private maxIssuesInMemory = 500;

  /**
   * Log a payment event
   */
  logEvent(event: Omit<PaymentEvent, 'timestamp'>): void {
    const fullEvent: PaymentEvent = {
      ...event,
      timestamp: new Date()
    };

    this.events.push(fullEvent);

    // Keep only recent events in memory
    if (this.events.length > this.maxEventsInMemory) {
      this.events = this.events.slice(-this.maxEventsInMemory);
    }

    // Log to console with appropriate formatting
    const emoji = this.getEventEmoji(event.type);
    console.log(`${emoji} PAYMENT EVENT [${event.source}]:`, {
      type: event.type,
      userId: event.userId,
      orderId: event.orderId,
      credits: event.credits,
      details: event.details
    });

    // Store in database for persistence (async, don't wait)
    this.persistEvent(fullEvent).catch(err => 
      console.error('Failed to persist payment event:', err)
    );
  }

  /**
   * Log a payment issue that needs admin attention
   */
  logIssue(issue: Omit<PaymentIssue, 'timestamp'>): void {
    const fullIssue: PaymentIssue = {
      ...issue,
      timestamp: new Date()
    };

    this.issues.push(fullIssue);

    // Keep only recent issues in memory
    if (this.issues.length > this.maxIssuesInMemory) {
      this.issues = this.issues.slice(-this.maxIssuesInMemory);
    }

    // Log to console with severity
    const prefix = this.getSeverityPrefix(issue.severity);
    console.error(`${prefix} PAYMENT ISSUE:`, {
      severity: issue.severity,
      type: issue.type,
      userId: issue.userId,
      orderId: issue.orderId,
      description: issue.description,
      details: issue.details
    });

    // For critical issues, also notify admins immediately
    if (issue.severity === 'critical' || issue.severity === 'high') {
      this.notifyAdmins(fullIssue).catch(err =>
        console.error('Failed to notify admins:', err)
      );
    }

    // Store in database
    this.persistIssue(fullIssue).catch(err =>
      console.error('Failed to persist payment issue:', err)
    );
  }

  /**
   * Get recent events (for debugging/admin dashboard)
   */
  getRecentEvents(limit: number = 100): PaymentEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Get recent issues (for debugging/admin dashboard)
   */
  getRecentIssues(limit: number = 100): PaymentIssue[] {
    return this.issues.slice(-limit);
  }

  /**
   * Get events for a specific user
   */
  getUserEvents(userId: number, limit: number = 50): PaymentEvent[] {
    return this.events
      .filter(e => e.userId === userId)
      .slice(-limit);
  }

  /**
   * Persist event to database
   */
  private async persistEvent(event: PaymentEvent): Promise<void> {
    try {
      const { db } = await import('./storage');
      const { sql } = await import('drizzle-orm');

      await db.execute(sql`
        INSERT INTO payment_events (
          event_type, user_id, order_id, credits, source, 
          details, created_at
        ) VALUES (
          ${event.type}, ${event.userId}, ${event.orderId || null}, 
          ${event.credits || null}, ${event.source}, 
          ${JSON.stringify(event.details || {})}, ${event.timestamp}
        )
      `);
    } catch (error) {
      // Silent fail - don't let logging errors break payment flow
      console.error('Failed to persist event to database:', error);
    }
  }

  /**
   * Persist issue to database
   */
  private async persistIssue(issue: PaymentIssue): Promise<void> {
    try {
      const { db } = await import('./storage');
      const { sql } = await import('drizzle-orm');

      await db.execute(sql`
        INSERT INTO payment_issues (
          severity, issue_type, user_id, order_id, 
          description, details, created_at
        ) VALUES (
          ${issue.severity}, ${issue.type}, ${issue.userId}, 
          ${issue.orderId || null}, ${issue.description}, 
          ${JSON.stringify(issue.details || {})}, ${issue.timestamp}
        )
      `);
    } catch (error) {
      console.error('Failed to persist issue to database:', error);
    }
  }

  /**
   * Notify admins of critical payment issues.
   * Logs prominently to the console (existing behaviour) AND sends an email
   * alert to active admins so they're notified out-of-band. Admin lookup
   * mirrors the uptime-monitor pattern (active, role === 'admin',
   * emailNotificationsEnabled !== false, valid email). Email-send errors are
   * swallowed here so they never break the payment flow.
   */
  private async notifyAdmins(issue: PaymentIssue): Promise<void> {
    // Console log (existing prominent block - kept for log-tail visibility)
    console.error('═══════════════════════════════════════════════════');
    console.error('🚨 ADMIN NOTIFICATION - PAYMENT ISSUE');
    console.error('═══════════════════════════════════════════════════');
    console.error('Severity:', issue.severity.toUpperCase());
    console.error('Type:', issue.type);
    console.error('User ID:', issue.userId);
    console.error('Order ID:', issue.orderId);
    console.error('Description:', issue.description);
    console.error('Time:', issue.timestamp.toISOString());
    console.error('Details:', JSON.stringify(issue.details, null, 2));
    console.error('═══════════════════════════════════════════════════');

    // Email alert. Wrapped in try/catch so failures never bubble up to
    // the payment flow (the outer caller also has .catch()).
    try {
      const { storage } = await import('./storage');
      const { sendPaymentIssueAdminAlert } = await import('./sendgrid-service');

      const allUsers = await storage.getUsers();
      const adminUsers = (allUsers || []).filter(
        (user: any) =>
          user &&
          user.email &&
          !user.isBlocked &&
          user.role === 'admin' &&
          user.emailNotificationsEnabled !== false
      );

      if (adminUsers.length === 0) {
        console.warn('[PaymentAlert] No eligible admin recipients found for payment-issue alert');
        return;
      }

      const adminEmails = adminUsers
        .map((u: any) => (typeof u.email === 'string' ? u.email : ''))
        .filter((e: string) => e.length > 0);

      console.log(
        `[PaymentAlert] Dispatching ${issue.severity}-severity payment-issue alert (${issue.type}) to ${adminEmails.length} admin record(s)`
      );

      const report = await sendPaymentIssueAdminAlert(issue, adminEmails);
      console.log(
        `[PaymentAlert] Result: success=${report.success}, emailsSent=${report.emailsSent}, errors=${report.errors.length}`
      );
      if (report.errors.length > 0) {
        report.errors.forEach(err => console.error(`[PaymentAlert]   - ${err}`));
      }
    } catch (alertErr) {
      console.error('[PaymentAlert] Failed to send payment-issue admin alert email:', alertErr);
    }
  }

  /**
   * Get emoji for event type
   */
  private getEventEmoji(type: PaymentEvent['type']): string {
    const emojiMap: Record<PaymentEvent['type'], string> = {
      success: '✅',
      pending: '⏳',
      failed: '❌',
      webhook_received: '📥',
      reconciliation: '🔧',
      double_credit_prevented: '🛡️'
    };
    return emojiMap[type] || '📝';
  }

  /**
   * Get severity prefix for logging
   */
  private getSeverityPrefix(severity: PaymentIssue['severity']): string {
    const prefixMap: Record<PaymentIssue['severity'], string> = {
      low: '📌',
      medium: '⚠️',
      high: '🔴',
      critical: '🚨'
    };
    return prefixMap[severity] || '⚠️';
  }
}

// Singleton instance
export const paymentMonitor = new PaymentMonitor();
