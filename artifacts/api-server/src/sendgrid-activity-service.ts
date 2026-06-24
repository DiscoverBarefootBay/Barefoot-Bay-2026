import fetch from 'node-fetch';
import { getSendGridApiKey } from './lib/sendgrid-credentials';

const SENDGRID_API_BASE = 'https://api.sendgrid.com/v3';

interface EmailMessage {
  msg_id: string;
  from_email: string;
  to_email: string;
  subject: string;
  status: string;
  opens_count: number;
  clicks_count: number;
  last_event_time: string;
}

interface EmailStats {
  date: string;
  stats: Array<{
    metrics: {
      blocks?: number;
      bounce_drops?: number;
      bounces?: number;
      clicks?: number;
      deferred?: number;
      delivered?: number;
      invalid_emails?: number;
      opens?: number;
      processed?: number;
      requests?: number;
      spam_report_drops?: number;
      spam_reports?: number;
      unique_clicks?: number;
      unique_opens?: number;
      unsubscribe_drops?: number;
      unsubscribes?: number;
    };
  }>;
}

export interface AggregatedStats {
  requests: number;
  delivered: number;
  opens: number;
  unique_opens: number;
  clicks: number;
  unique_clicks: number;
  bounces: number;
  spam_reports: number;
  unsubscribes: number;
  open_rate: number;
  click_rate: number;
  bounce_rate: number;
}

export interface EmailActivityQuery {
  limit?: number;
  query?: string;
  email?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Fetch aggregated email statistics from SendGrid Stats API
 * This works on all SendGrid plans
 */
export async function getEmailStats(
  startDate: string,
  endDate: string,
  aggregatedBy: 'day' | 'week' | 'month' = 'day'
): Promise<{ stats: EmailStats[]; aggregated: AggregatedStats }> {
  try {
    const apiKey = await getSendGridApiKey();
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      aggregated_by: aggregatedBy,
    });

    const response = await fetch(`${SENDGRID_API_BASE}/stats?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SendGrid Stats API] Error:', response.status, errorText);
      throw new Error(`SendGrid Stats API error: ${response.status} - ${errorText}`);
    }

    const stats: EmailStats[] = await response.json() as EmailStats[];

    // Calculate aggregated totals
    const totals: AggregatedStats = {
      requests: 0,
      delivered: 0,
      opens: 0,
      unique_opens: 0,
      clicks: 0,
      unique_clicks: 0,
      bounces: 0,
      spam_reports: 0,
      unsubscribes: 0,
      open_rate: 0,
      click_rate: 0,
      bounce_rate: 0,
    };

    stats.forEach((day) => {
      day.stats.forEach((stat) => {
        const m = stat.metrics;
        // Use requests if available, otherwise fall back to processed, then delivered
        // This ensures compatibility across all SendGrid plans
        totals.requests += m.requests ?? m.processed ?? m.delivered ?? 0;
        totals.delivered += m.delivered || 0;
        totals.opens += m.opens || 0;
        totals.unique_opens += m.unique_opens || 0;
        totals.clicks += m.clicks || 0;
        totals.unique_clicks += m.unique_clicks || 0;
        totals.bounces += m.bounces || 0;
        totals.spam_reports += m.spam_reports || 0;
        totals.unsubscribes += m.unsubscribes || 0;
      });
    });

    // Calculate rates
    if (totals.delivered > 0) {
      totals.open_rate = (totals.unique_opens / totals.delivered) * 100;
      totals.click_rate = (totals.unique_clicks / totals.delivered) * 100;
      totals.bounce_rate = (totals.bounces / totals.delivered) * 100;
    }

    console.log('[SendGrid Stats API] Retrieved stats:', {
      dateRange: `${startDate} to ${endDate}`,
      totalDays: stats.length,
      aggregated: totals,
    });

    return { stats, aggregated: totals };
  } catch (error) {
    console.error('[SendGrid Stats API] Error fetching stats:', error);
    throw error;
  }
}

/**
 * Fetch individual email messages from SendGrid Email Activity API
 * Note: This requires the "Email Activity Feed" add-on (30-day history)
 * Free tier includes 3-7 days of data
 */
export async function getEmailActivity(
  queryParams: EmailActivityQuery = {}
): Promise<{ messages: EmailMessage[]; hasActivityApi: boolean }> {
  try {
    const apiKey = await getSendGridApiKey();
    const { limit = 100, email, status, startDate, endDate } = queryParams;

    // Build query string
    const queryParts: string[] = [];
    
    if (email) {
      queryParts.push(`to_email="${email}"`);
    }
    
    if (status) {
      queryParts.push(`status="${status}"`);
    }
    
    if (startDate && endDate) {
      queryParts.push(`last_event_time BETWEEN TIMESTAMP "${startDate}" AND TIMESTAMP "${endDate}"`);
    }

    const params = new URLSearchParams({
      limit: limit.toString(),
    });

    if (queryParts.length > 0) {
      params.set('query', queryParts.join(' AND '));
    }

    const response = await fetch(`${SENDGRID_API_BASE}/messages?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // Check if this is a 403 error (API not enabled)
      if (response.status === 403) {
        console.warn('[SendGrid Activity API] Email Activity API not enabled (requires add-on)');
        return { messages: [], hasActivityApi: false };
      }
      
      console.error('[SendGrid Activity API] Error:', response.status, errorText);
      throw new Error(`SendGrid Activity API error: ${response.status} - ${errorText}`);
    }

    const data: { messages: EmailMessage[] } = await response.json() as { messages: EmailMessage[] };

    console.log('[SendGrid Activity API] Retrieved messages:', {
      count: data.messages?.length || 0,
      query: params.toString(),
    });

    return { messages: data.messages || [], hasActivityApi: true };
  } catch (error) {
    console.error('[SendGrid Activity API] Error fetching activity:', error);
    // Return empty array instead of throwing, with flag indicating API availability
    return { messages: [], hasActivityApi: false };
  }
}

/**
 * Get email activity with enhanced details
 * Combines stats and individual message data when available
 */
export async function getEnhancedEmailActivity(
  startDate: string,
  endDate: string,
  email?: string,
  status?: string,
  limit: number = 100
): Promise<{
  stats: AggregatedStats;
  messages: EmailMessage[];
  hasActivityApi: boolean;
  dailyStats: EmailStats[];
}> {
  try {
    // Fetch aggregated stats (always available)
    const { stats: dailyStats, aggregated } = await getEmailStats(startDate, endDate);

    // Try to fetch individual messages (may not be available)
    const { messages, hasActivityApi } = await getEmailActivity({
      limit,
      email,
      status,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
    });

    return {
      stats: aggregated,
      messages,
      hasActivityApi,
      dailyStats,
    };
  } catch (error) {
    console.error('[SendGrid Enhanced Activity] Error:', error);
    throw error;
  }
}

export interface BillingAddOn {
  name: string;
  price: number;
}

export interface BillingStats {
  monthlyLimit: number;
  emailsSent: number;
  emailsRemaining: number;
  percentageUsed: number;
  currentMonth: string;
  planName: string;
  planPrice: number;
  currency: string;
  addOns: BillingAddOn[];
  estimatedInvoice: number;
}

// Default add-ons match the user's current SendGrid account. Override with the
// SENDGRID_ADDONS env var (JSON array of { name, price }).
const DEFAULT_SENDGRID_ADDONS: BillingAddOn[] = [
  { name: 'Extended Email Activity History', price: 5 },
];

/**
 * Admin-editable billing config. Persisted in the site_settings store and
 * passed into getBillingStats(), where it overrides the env-var defaults.
 * Every field is optional so partial saves still work.
 */
export interface BillingConfigOverride {
  planName?: string;
  planPrice?: number;
  currency?: string;
  monthlyLimit?: number;
  addOns?: BillingAddOn[];
}

function sanitizeAddOns(value: unknown): BillingAddOn[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value
    .filter((a) => a && typeof a.name === 'string')
    .map((a) => ({ name: String(a.name), price: Number(a.price) || 0 }));
}

function getConfiguredAddOns(): BillingAddOn[] {
  const raw = process.env.SENDGRID_ADDONS;
  if (!raw) {
    return DEFAULT_SENDGRID_ADDONS;
  }
  try {
    const parsed = JSON.parse(raw);
    const sanitized = sanitizeAddOns(parsed);
    if (sanitized) {
      return sanitized;
    }
  } catch {
    // Malformed config — fall back to defaults below.
  }
  return DEFAULT_SENDGRID_ADDONS;
}

/**
 * Get billing/usage statistics for the current month
 * Calculates remaining quota based on configured monthly limit
 */
export async function getBillingStats(override?: BillingConfigOverride): Promise<BillingStats> {
  try {
    // Monthly limit: saved admin override wins, then env var, then default of
    // 50000 (also used when either source is non-finite/non-positive).
    const overrideLimit =
      typeof override?.monthlyLimit === 'number' && Number.isFinite(override.monthlyLimit) && override.monthlyLimit > 0
        ? override.monthlyLimit
        : undefined;
    const parsedLimit = parseInt(process.env.SENDGRID_MONTHLY_LIMIT || '50000', 10);
    const envLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 50000;
    const monthlyLimit = overrideLimit ?? envLimit;
    
    // Calculate current month's date range
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];
    
    console.log('[SendGrid Billing] Fetching billing stats for:', {
      startDate,
      endDate,
      monthlyLimit
    });
    
    // Fetch stats for current month
    const { aggregated } = await getEmailStats(startDate, endDate);
    
    // Use 'requests' for quota calculation (includes delivered, bounced, dropped, etc.)
    // Note: aggregated.requests uses fallback strategy (requests -> processed -> delivered)
    // to ensure compatibility across all SendGrid plans
    const emailsSent = aggregated.requests || 0;
    const emailsRemaining = Math.max(0, monthlyLimit - emailsSent);
    const percentageUsed = monthlyLimit > 0 ? (emailsSent / monthlyLimit) * 100 : 0;
    
    const currentMonth = now.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long' 
    });

    // Plan metadata mirrors the user's SendGrid account. SendGrid has no public
    // plan/subscription/invoice API, so these are env-configurable with defaults
    // matching the current plan (Essentials 50K, $19.95/mo + add-ons).
    const planName =
      typeof override?.planName === 'string' && override.planName.trim()
        ? override.planName.trim()
        : process.env.SENDGRID_PLAN_NAME || 'Essentials 50K';
    const overridePrice =
      typeof override?.planPrice === 'number' && Number.isFinite(override.planPrice) && override.planPrice >= 0
        ? override.planPrice
        : undefined;
    const parsedPrice = parseFloat(process.env.SENDGRID_PLAN_PRICE || '19.95');
    const envPrice = Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : 19.95;
    const planPrice = overridePrice ?? envPrice;
    const currency =
      typeof override?.currency === 'string' && override.currency.trim()
        ? override.currency.trim()
        : process.env.SENDGRID_CURRENCY || 'USD';
    const overrideAddOns = sanitizeAddOns(override?.addOns);
    const addOns = overrideAddOns ?? getConfiguredAddOns();
    const addOnsTotal = addOns.reduce((sum, addOn) => sum + addOn.price, 0);
    const estimatedInvoice = Math.round((planPrice + addOnsTotal) * 100) / 100;

    console.log('[SendGrid Billing] Billing stats calculated:', {
      monthlyLimit,
      emailsSent,
      emailsRemaining,
      percentageUsed: percentageUsed.toFixed(2) + '%',
      currentMonth
    });
    
    return {
      monthlyLimit,
      emailsSent,
      emailsRemaining,
      percentageUsed: Math.round(percentageUsed * 100) / 100, // Round to 2 decimal places
      currentMonth,
      planName,
      planPrice,
      currency,
      addOns,
      estimatedInvoice
    };
  } catch (error) {
    console.error('[SendGrid Billing] Error fetching billing stats:', error);
    throw error;
  }
}
