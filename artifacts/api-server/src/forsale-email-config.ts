import { storage } from './storage';
import { logger } from './lib/logger';

/**
 * Admin-editable configuration for the automated For Sale listing-expiration
 * emails. Persisted as JSON in `site_settings` under FORSALE_EMAIL_CONFIG_KEY,
 * mirroring the SendGrid billing-config pattern. Saved values override the
 * built-in defaults field-by-field, so anything an admin hasn't touched keeps
 * the original hard-coded behavior.
 */
export const FORSALE_EMAIL_CONFIG_KEY = 'forsale_email_config';

/** The three automated email types this feature covers. */
export type ForSaleEmailType = 'adminExpired' | 'sellerExpired' | 'noActiveListings';

export interface ForSaleEmailTemplate {
  /** When false, the automated scheduler/expiration path skips this email. */
  enabled: boolean;
  /** Subject line. Supports {{placeholder}} tokens. */
  subject: string;
  /** HTML body. Supports {{placeholder}} tokens. Plain text is derived from this. */
  html: string;
}

export interface ForSaleEmailTimingConfig {
  /** Days the public For Sale page must be empty before the first reminder. */
  emptyThresholdDays: number;
  /** How often (in days) to re-send the empty-page reminder while still empty. */
  resendIntervalDays: number;
}

export interface ForSaleEmailConfig {
  adminExpired: ForSaleEmailTemplate;
  sellerExpired: ForSaleEmailTemplate;
  noActiveListings: ForSaleEmailTemplate;
  timing: ForSaleEmailTimingConfig;
}

/**
 * Human-readable list of the placeholders available in each email type's
 * subject/body, surfaced to admins in the editor UI.
 */
export const FORSALE_EMAIL_PLACEHOLDERS: Record<ForSaleEmailType, Array<{ token: string; description: string }>> = {
  adminExpired: [
    { token: '{{listingTitle}}', description: 'Listing title' },
    { token: '{{listingType}}', description: 'Listing type (e.g. For Sale, For Rent)' },
    { token: '{{address}}', description: 'Listing address' },
    { token: '{{listingUrl}}', description: 'Link to the listing' },
    { token: '{{sellerName}}', description: "Seller's name" },
    { token: '{{sellerEmail}}', description: "Seller's email" },
    { token: '{{sellerPhone}}', description: "Seller's phone" },
  ],
  sellerExpired: [
    { token: '{{sellerName}}', description: "Seller's name (greeting)" },
    { token: '{{listingTitle}}', description: 'Listing title' },
    { token: '{{baseUrl}}', description: 'Site home URL' },
    { token: '{{myListingsUrl}}', description: 'Link to the seller\'s "My Listings" page' },
  ],
  noActiveListings: [
    { token: '{{daysEmpty}}', description: 'Number of days the For Sale page has been empty' },
    { token: '{{forSaleUrl}}', description: 'Link to the For Sale page' },
    { token: '{{baseUrl}}', description: 'Site home URL' },
  ],
};

const EMAIL_SHELL_OPEN = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">';
const EMAIL_FOOTER =
  '<hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">' +
  '<p style="font-size: 12px; color: #6b7280;">This is an automated message from the Barefoot Bay community platform.</p>';

/**
 * Built-in defaults. These mirror the original hard-coded templates so behavior
 * is unchanged when nothing is saved. Returned fresh each call so callers can't
 * mutate the shared object.
 */
export function getDefaultForSaleEmailConfig(): ForSaleEmailConfig {
  return {
    adminExpired: {
      enabled: true,
      subject: 'Listing expired: {{listingTitle}}',
      html: `${EMAIL_SHELL_OPEN}
  <h2 style="color: #2563eb;">Listing Expired</h2>
  <p>A Barefoot Bay listing has just expired and may need follow-up.</p>

  <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <h3 style="margin-top: 0;">{{listingTitle}}</h3>
    <p style="margin: 8px 0;"><strong>Type:</strong> {{listingType}}</p>
    <p style="margin: 8px 0;"><strong>Address:</strong> {{address}}</p>
  </div>

  <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
    <h3 style="margin-top: 0; color: #1e40af;">Seller Contact Information:</h3>
    <p style="margin: 8px 0;"><strong>Name:</strong> {{sellerName}}</p>
    <p style="margin: 8px 0;"><strong>Email:</strong> {{sellerEmail}}</p>
    <p style="margin: 8px 0;"><strong>Phone:</strong> {{sellerPhone}}</p>
  </div>

  <p><a href="{{listingUrl}}" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Listing</a></p>

  ${EMAIL_FOOTER}
</div>`,
    },
    sellerExpired: {
      enabled: true,
      subject: 'Your Barefoot Bay listing has expired: {{listingTitle}}',
      html: `${EMAIL_SHELL_OPEN}
  <h2 style="color: #2563eb;">Your Listing Has Expired</h2>
  <p>Hi {{sellerName}},</p>
  <p>Your Barefoot Bay listing <strong>"{{listingTitle}}"</strong> has expired and is no longer shown on the For Sale page.</p>

  <div style="background: #fffbeb; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
    <p style="margin: 0;"><strong>Already sold or rented?</strong> You can ignore this email — no action is needed.</p>
  </div>

  <p>If it's still available and you'd like to keep it listed, you can renew it in a few steps:</p>
  <ol style="line-height: 1.6;">
    <li>Log in at <a href="{{baseUrl}}">barefootbay.com</a></li>
    <li>Go to <strong>For Sale</strong>, then open <strong>My Listings</strong></li>
    <li>Open this listing, choose a new listing duration, and republish it.</li>
  </ol>

  <p><a href="{{myListingsUrl}}" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Renew Your Listing</a></p>

  ${EMAIL_FOOTER}
</div>`,
    },
    noActiveListings: {
      enabled: true,
      subject: 'For Sale page has had no active listings for {{daysEmpty}} days',
      html: `${EMAIL_SHELL_OPEN}
  <h2 style="color: #2563eb;">No Active For Sale Listings</h2>
  <p>The Barefoot Bay For Sale page has had <strong>no active listings for {{daysEmpty}} days</strong>.</p>
  <p>This may be a good time to follow up with sellers whose listings recently expired and encourage them to renew.</p>

  <p><a href="{{forSaleUrl}}" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View For Sale Page</a></p>

  ${EMAIL_FOOTER}
</div>`,
    },
    timing: {
      emptyThresholdDays: 7,
      resendIntervalDays: 7,
    },
  };
}

function mergeTemplate(
  base: ForSaleEmailTemplate,
  saved: Partial<ForSaleEmailTemplate> | undefined,
): ForSaleEmailTemplate {
  if (!saved || typeof saved !== 'object') return base;
  return {
    enabled: typeof saved.enabled === 'boolean' ? saved.enabled : base.enabled,
    subject:
      typeof saved.subject === 'string' && saved.subject.trim() ? saved.subject : base.subject,
    html: typeof saved.html === 'string' && saved.html.trim() ? saved.html : base.html,
  };
}

function mergeTiming(
  base: ForSaleEmailTimingConfig,
  saved: Partial<ForSaleEmailTimingConfig> | undefined,
): ForSaleEmailTimingConfig {
  if (!saved || typeof saved !== 'object') return base;
  // Normalize to a positive whole number of days. Floor first, then require the
  // result be >= 1 so malformed persisted values (e.g. 0.5 → 0, or 0) can never
  // collapse the threshold/interval to zero days and cause a reminder storm.
  const normalizeDays = (value: unknown, fallback: number): number => {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    const floored = Math.floor(num);
    return floored >= 1 ? floored : fallback;
  };
  return {
    emptyThresholdDays: normalizeDays(saved.emptyThresholdDays, base.emptyThresholdDays),
    resendIntervalDays: normalizeDays(saved.resendIntervalDays, base.resendIntervalDays),
  };
}

/** Merge a (possibly partial) saved config over the built-in defaults. */
export function mergeForSaleEmailConfig(saved: unknown): ForSaleEmailConfig {
  const defaults = getDefaultForSaleEmailConfig();
  if (!saved || typeof saved !== 'object') return defaults;
  const s = saved as Partial<Record<ForSaleEmailType, Partial<ForSaleEmailTemplate>>> & {
    timing?: Partial<ForSaleEmailTimingConfig>;
  };
  return {
    adminExpired: mergeTemplate(defaults.adminExpired, s.adminExpired),
    sellerExpired: mergeTemplate(defaults.sellerExpired, s.sellerExpired),
    noActiveListings: mergeTemplate(defaults.noActiveListings, s.noActiveListings),
    timing: mergeTiming(defaults.timing, s.timing),
  };
}

/**
 * Load the saved For Sale email config merged over the defaults. Falls back to
 * the defaults on any read/parse error so the email pipeline never breaks.
 */
export async function loadForSaleEmailConfig(): Promise<ForSaleEmailConfig> {
  try {
    const setting = await storage.getSiteSettingByKey(FORSALE_EMAIL_CONFIG_KEY);
    if (setting?.value) {
      return mergeForSaleEmailConfig(JSON.parse(setting.value));
    }
  } catch (err) {
    logger.warn({ err }, '[ForSaleEmailConfig] Failed to load saved config; using defaults');
  }
  return getDefaultForSaleEmailConfig();
}

/**
 * Substitute {{token}} placeholders in a template string. Unknown tokens are
 * left untouched. Values are inserted as plain strings (no nested templating).
 */
export function renderTemplate(template: string, data: Record<string, string | number>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    const value = data[key];
    return value === undefined || value === null ? match : String(value);
  });
}

/**
 * Best-effort conversion of an HTML email body into a plain-text fallback. The
 * editable templates only expose the HTML body, so the text part is derived
 * from whatever HTML is current (saved or default) to keep the two in sync.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|h[1-6]|li|ol|ul|tr)\s*>/gi, '\n')
    .replace(/<\s*li\s*>/gi, ' - ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}
