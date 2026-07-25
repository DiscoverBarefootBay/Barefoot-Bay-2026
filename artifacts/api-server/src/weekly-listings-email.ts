/**
 * Weekly "Currently, On The Market" promotional email.
 *
 * Pure logic module: campaign week calculation (America/New_York, Monday–
 * Sunday), listing selection (ACTIVE listings first published in the week,
 * newest first), recipient resolution (marketing opt-in users), and the
 * responsive HTML + plain-text render. The scheduler and admin routes both
 * consume these helpers so preview/test/manual/automatic sends always match.
 */

import { formatInTimeZone } from 'date-fns-tz';
import { storage } from './storage';
import { logger } from './lib/logger';
import { dedupeRecipientsByEmail } from './sendgrid-service';
import type { RealEstateListing, User } from '@workspace/db';

export const EASTERN_TZ = 'America/New_York';

export const WEEKLY_LISTINGS_CONFIG_KEY = 'weekly_listings_email_config';

/** Admin-editable subject + HTML body with {{token}} placeholders. */
export interface WeeklyEmailTemplate {
  subject: string;
  html: string;
}

export interface WeeklyListingsEmailConfig {
  /** Master switch for the automatic weekly send. Ships disabled. */
  enabled: boolean;
  /** Day of week to send, 0 = Sunday … 6 = Saturday (ET). */
  sendDay: number;
  /** HH:mm 24-hour send time in ET. */
  sendTime: string;
  /** When true, the email still goes out on weeks with zero new listings. */
  sendWhenEmpty: boolean;
  /** Admin-editable email template (subject + HTML body with {{tokens}}). */
  template: WeeklyEmailTemplate;
}

export function getDefaultWeeklyListingsEmailConfig(): WeeklyListingsEmailConfig {
  return {
    enabled: false, // ships disabled by default
    sendDay: 1, // Monday
    sendTime: '09:00',
    sendWhenEmpty: false,
    template: getDefaultWeeklyEmailTemplate(),
  };
}

/** Merge a (possibly partial) saved config over the defaults. */
export function mergeWeeklyListingsEmailConfig(saved: unknown): WeeklyListingsEmailConfig {
  const defaults = getDefaultWeeklyListingsEmailConfig();
  if (!saved || typeof saved !== 'object') return defaults;
  const s = saved as Partial<WeeklyListingsEmailConfig>;
  const sendDay = Number(s.sendDay);
  const tpl = (s.template && typeof s.template === 'object' ? s.template : {}) as Partial<WeeklyEmailTemplate>;
  return {
    enabled: typeof s.enabled === 'boolean' ? s.enabled : defaults.enabled,
    sendDay: Number.isInteger(sendDay) && sendDay >= 0 && sendDay <= 6 ? sendDay : defaults.sendDay,
    sendTime:
      typeof s.sendTime === 'string' && /^\d{2}:\d{2}$/.test(s.sendTime)
        ? s.sendTime
        : defaults.sendTime,
    sendWhenEmpty: typeof s.sendWhenEmpty === 'boolean' ? s.sendWhenEmpty : defaults.sendWhenEmpty,
    template: {
      subject:
        typeof tpl.subject === 'string' && tpl.subject.trim()
          ? tpl.subject
          : defaults.template.subject,
      html:
        typeof tpl.html === 'string' && tpl.html.trim() ? tpl.html : defaults.template.html,
    },
  };
}

export async function loadWeeklyListingsEmailConfig(): Promise<WeeklyListingsEmailConfig> {
  try {
    const setting = await storage.getSiteSettingByKey(WEEKLY_LISTINGS_CONFIG_KEY);
    if (setting?.value) {
      return mergeWeeklyListingsEmailConfig(JSON.parse(setting.value));
    }
  } catch (err) {
    logger.warn({ err }, '[WeeklyListingsEmail] Failed to load saved config; using defaults');
  }
  return getDefaultWeeklyListingsEmailConfig();
}

// ---------------------------------------------------------------------------
// Campaign week calculation
// ---------------------------------------------------------------------------

export interface WeekRange {
  /** yyyy-MM-dd of the first ET day of the rolling 7-day campaign window. */
  weekStart: string;
  /** yyyy-MM-dd of the last ET day of the window (today at send time). */
  weekEnd: string;
  /** Human label, e.g. "July 20–26, 2026" or "December 28, 2026–January 3, 2027". */
  label: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function parseYmd(ymd: string): { y: number; m: number; d: number } {
  const [y, m, d] = ymd.split('-').map(Number);
  return { y: y!, m: m!, d: d! };
}

function ymdAddDays(ymd: string, days: number): string {
  const { y, m, d } = parseYmd(ymd);
  // Noon UTC avoids any DST edge cases in pure date arithmetic.
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Format a campaign week range naturally, spanning month/year boundaries:
 *  - same month:  "July 20–26, 2026"
 *  - cross month: "November 30–December 6, 2026"
 *  - cross year:  "December 28, 2026–January 3, 2027"
 */
export function formatWeekRangeLabel(weekStart: string, weekEnd: string): string {
  const s = parseYmd(weekStart);
  const e = parseYmd(weekEnd);
  const sMonth = MONTH_NAMES[s.m - 1];
  const eMonth = MONTH_NAMES[e.m - 1];
  if (s.y !== e.y) {
    return `${sMonth} ${s.d}, ${s.y}\u2013${eMonth} ${e.d}, ${e.y}`;
  }
  if (s.m !== e.m) {
    return `${sMonth} ${s.d}\u2013${eMonth} ${e.d}, ${s.y}`;
  }
  return `${sMonth} ${s.d}\u2013${e.d}, ${s.y}`;
}

/**
 * The campaign window for a send happening at `now`: a ROLLING 7-day window of
 * Eastern calendar days ending today. E.g. a send on Saturday July 25, 2026
 * promotes everything posted July 19–25, 2026 — so mid-week previews, tests,
 * and manual sends always feel current.
 */
export function getCampaignWeekRange(now: Date = new Date()): WeekRange {
  const weekEnd = formatInTimeZone(now, EASTERN_TZ, 'yyyy-MM-dd');
  const weekStart = ymdAddDays(weekEnd, -6);
  return { weekStart, weekEnd, label: formatWeekRangeLabel(weekStart, weekEnd) };
}

// ---------------------------------------------------------------------------
// Listing selection
// ---------------------------------------------------------------------------

/** The subset of listing fields the email actually renders (no private info). */
export interface WeeklyEmailListing {
  id: number;
  title: string;
  price: number | null;
  listingType: string;
  description: string | null;
  photo: string | null;
  createdAt: string | null;
  /** True when the listing was first published inside the campaign week. */
  isNew: boolean;
}

const LISTING_TYPE_LABELS: Record<string, string> = {
  FSBO: 'For Sale By Owner',
  Agent: 'For Sale By Agent',
  Rent: 'For Rent',
  OpenHouse: 'Open House',
  Wanted: 'Wanted',
  Classified: 'Classified',
  GarageSale: 'Garage Sale',
};

export function listingTypeLabel(type: string): string {
  return LISTING_TYPE_LABELS[type] ?? type;
}

/**
 * Select the listings featured in a campaign email: EVERY listing that is
 * currently ACTIVE and not past its expiration date at selection time.
 * Listings first published (createdAt, ET) within [weekStart, weekEnd] are
 * flagged `isNew` so the render can highlight them in a "New This Week"
 * section; the rest appear under "Still On The Market". New listings sort
 * first, each group newest first. Only public fields are carried forward —
 * seller contact info is deliberately dropped.
 */
export function selectListingsForWeek(
  listings: Array<Pick<RealEstateListing, 'id' | 'title' | 'price' | 'listingType' | 'description' | 'photos' | 'status' | 'createdAt' | 'expirationDate'>>,
  range: Pick<WeekRange, 'weekStart' | 'weekEnd'>,
  now: Date = new Date(),
): WeeklyEmailListing[] {
  const nowMs = now.getTime();
  return listings
    .filter((l) => {
      if (l.status !== 'ACTIVE') return false;
      if (l.expirationDate && new Date(l.expirationDate).getTime() <= nowMs) return false;
      return true;
    })
    .map((l) => {
      const createdEt = l.createdAt
        ? formatInTimeZone(new Date(l.createdAt), EASTERN_TZ, 'yyyy-MM-dd')
        : null;
      return {
        id: l.id,
        title: l.title,
        price: l.price ?? null,
        listingType: l.listingType,
        description: l.description ?? null,
        photo: Array.isArray(l.photos) && l.photos.length > 0 ? l.photos[0] ?? null : null,
        createdAt: l.createdAt ? new Date(l.createdAt).toISOString() : null,
        isNew: createdEt !== null && createdEt >= range.weekStart && createdEt <= range.weekEnd,
      };
    })
    .sort((a, b) => {
      if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bt - at;
    });
}

// ---------------------------------------------------------------------------
// Recipient resolution
// ---------------------------------------------------------------------------

/**
 * Marketing-opt-in recipients: users with a valid email who have NOT opted out
 * of marketing emails, have NOT unsubscribed from all email notifications, and
 * are not blocked. De-duped by mailbox.
 */
export function resolveWeeklyEmailRecipients(
  allUsers: Array<Pick<User, 'email' | 'isBlocked' | 'emailNotificationsEnabled' | 'marketingEmailsEnabled'>>,
): string[] {
  const eligible = allUsers.filter((u) => {
    const email = u.email?.trim();
    if (!email || !email.includes('@')) return false;
    if (u.isBlocked) return false;
    if (u.emailNotificationsEnabled === false) return false; // unsubscribed from all email
    if (u.marketingEmailsEnabled === false) return false; // opted out of marketing
    return true;
  });
  return dedupeRecipientsByEmail(eligible).map((u) => (u.email as string).trim());
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const BRAND = {
  ocean: '#90C9D4',
  coral: '#E15A4F',
  navy: '#434054',
  charcoal: '#27272A',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPrice(price: number | null): string {
  if (price === null || price === undefined || Number.isNaN(price)) return '';
  return `$${Number(price).toLocaleString('en-US')}`;
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}\u2026`;
}

export interface RenderedWeeklyEmail {
  subject: string;
  html: string;
  text: string;
}

/** Placeholder tokens the admin can use in the weekly email template. */
export const WEEKLY_EMAIL_PLACEHOLDERS: Array<{ token: string; description: string }> = [
  { token: '{{weekRange}}', description: 'The campaign week, e.g. "July 20–26, 2026"' },
  { token: '{{intro}}', description: 'The standard intro sentence (changes automatically based on how many listings are new this week)' },
  { token: '{{listings}}', description: 'The "New This Week" / "Still On The Market" sections with the listing cards — required for listings to appear' },
  { token: '{{listingCount}}', description: 'Total number of active listings featured in the email' },
  { token: '{{forSaleUrl}}', description: 'Link to the On The Market page' },
  { token: '{{baseUrl}}', description: 'The site address, e.g. https://barefootbay.com' },
  { token: '{{subject}}', description: 'The rendered subject line (HTML body only)' },
];

/**
 * Turn a possibly-relative asset path (e.g. "/api/storage-proxy/…") into an
 * absolute URL email clients can load. Already-absolute URLs pass through.
 */
export function toAbsoluteUrl(baseUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = baseUrl.replace(/\/+$/, '');
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`;
}

/** The built-in template. `{{tokens}}` are substituted at render time. */
export function getDefaultWeeklyEmailTemplate(): WeeklyEmailTemplate {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{subject}}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:${BRAND.charcoal};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background-color:${BRAND.ocean};background:linear-gradient(135deg, #90C9D4 0%, #6BB5C1 100%);padding:30px 20px;text-align:center;">
              <p style="margin:0 0 5px 0;font-size:28px;font-weight:bold;letter-spacing:1px;color:#ffffff;">Barefoot Bay</p>
              <p style="margin:0 0 14px 0;font-size:12px;letter-spacing:0.5px;color:#ffffff;">Community Platform</p>
              <h1 style="margin:0;font-size:24px;line-height:32px;color:#ffffff;">{{subject}}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 24px 8px 24px;">
              <p style="margin:0 0 16px 0;font-size:15px;line-height:22px;">{{intro}}</p>
            </td>
          </tr>
          {{listings}}
          <tr>
            <td style="padding:0 24px 24px 24px;text-align:center;">
              <a href="{{forSaleUrl}}" style="background-color:${BRAND.ocean};color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:8px;display:inline-block;font-size:15px;font-weight:600;">View All Listings</a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 24px 24px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:24px 0 12px 0;font-size:15px;line-height:22px;">Have something to sell? Post it on On The Market today.</p>
              <a href="{{forSaleUrl}}" style="background-color:${BRAND.coral};color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:8px;display:inline-block;font-size:15px;font-weight:600;">Post a Listing</a>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:20px 24px;text-align:center;">
              <p style="margin:0 0 6px 0;font-size:12px;color:#6b7280;">Barefoot Bay Community Platform &bull; Barefoot Bay, FL 32976</p>
              <p style="margin:0;font-size:12px;color:#6b7280;">
                You're receiving this because you're a member of the Barefoot Bay community site.
                <a href="{{baseUrl}}/unsubscribe" style="color:#6b7280;text-decoration:underline;">Unsubscribe from email notifications</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return {
    subject: 'Currently, On The Market | {{weekRange}}',
    html,
  };
}

/** Replace every occurrence of each {{token}} in a template string. */
function applyTokens(template: string, tokens: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(tokens, name) ? tokens[name]! : match,
  );
}

/**
 * Render the responsive HTML + plain-text weekly email. Email-safe: table
 * layout, inline styles, alt text on every image, readable with images
 * blocked. `baseUrl` is the public site origin (no trailing slash).
 * An admin-edited `template` (subject + HTML with {{tokens}}) may be passed;
 * the built-in default is used otherwise. The plain-text version is always
 * generated automatically.
 */
export function renderWeeklyListingsEmail(
  listings: WeeklyEmailListing[],
  range: WeekRange,
  baseUrl: string,
  template: WeeklyEmailTemplate = getDefaultWeeklyEmailTemplate(),
): RenderedWeeklyEmail {
  const forSaleUrl = `${baseUrl}/for-sale`;
  const placeholderImg = toAbsoluteUrl(baseUrl, '/logo.png');

  const newListings = listings.filter((l) => l.isNew);
  const otherListings = listings.filter((l) => !l.isNew);

  const intro =
    listings.length === 0
      ? `There are no active listings On The Market right now (${range.label}) \u2014 check back soon, or be the first to post one!`
      : newListings.length > 0
        ? `Here's what's On The Market in Barefoot Bay this week (${range.label}). Take a look at what your neighbors are selling!`
        : `No new listings were posted this week (${range.label}) \u2014 but these homes and items are still On The Market. Take a look!`;

  const cardHtml = (l: WeeklyEmailListing): string => {
    const url = `${forSaleUrl}/${l.id}`;
    const img = l.photo ? toAbsoluteUrl(baseUrl, l.photo) : placeholderImg;
    const alt = l.photo
      ? `Photo of ${escapeHtml(l.title)}`
      : `No photo available for ${escapeHtml(l.title)}`;
    const price = formatPrice(l.price);
    const desc = l.description ? escapeHtml(truncate(l.description, 160)) : '';
    return `
        <tr>
          <td style="padding:0 24px 24px 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;background:#ffffff;">
              <tr>
                <td>
                  <img src="${img}" alt="${alt}" width="552" style="width:100%;max-width:552px;height:auto;display:block;background:#f1f5f9;" />
                </td>
              </tr>
              <tr>
                <td style="padding:16px 20px;">
                  <h3 style="margin:0 0 4px 0;font-size:18px;line-height:24px;color:${BRAND.navy};">${escapeHtml(l.title)}</h3>
                  ${price ? `<p style="margin:0 0 4px 0;font-size:16px;font-weight:bold;color:${BRAND.coral};">${price}</p>` : ''}
                  <p style="margin:0 0 8px 0;font-size:13px;color:#6b7280;">${escapeHtml(listingTypeLabel(l.listingType))}</p>
                  ${desc ? `<p style="margin:0 0 12px 0;font-size:14px;line-height:20px;color:${BRAND.charcoal};">${desc}</p>` : ''}
                  <a href="${url}" style="background-color:${BRAND.ocean};color:#ffffff;padding:10px 24px;text-decoration:none;border-radius:8px;display:inline-block;font-size:14px;font-weight:600;">View Listing</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
  };

  const sectionHeading = (label: string): string => `<tr>
            <td style="padding:0 24px 16px 24px;">
              <h2 style="margin:0;font-size:20px;color:${BRAND.navy};border-left:4px solid ${BRAND.ocean};padding-left:12px;">${label}</h2>
            </td>
          </tr>`;

  // The {{listings}} token expands to the "New This Week" and "Still On The
  // Market" sections with their listing cards (nothing at all when there are
  // no active listings).
  const parts: string[] = [];
  if (newListings.length > 0) {
    parts.push(sectionHeading('New This Week'), ...newListings.map(cardHtml));
  }
  if (otherListings.length > 0) {
    parts.push(sectionHeading('Still On The Market'), ...otherListings.map(cardHtml));
  }
  const listingsBlock = parts.join('\n');

  const subject = applyTokens(template.subject, {
    weekRange: range.label,
    listingCount: String(listings.length),
  }).trim();

  const html = applyTokens(template.html, {
    subject: escapeHtml(subject),
    weekRange: escapeHtml(range.label),
    intro: escapeHtml(intro),
    listings: listingsBlock,
    listingCount: String(listings.length),
    forSaleUrl,
    baseUrl,
  });

  const textLines: string[] = [
    subject,
    '',
    intro,
    '',
  ];
  const pushTextSection = (heading: string, group: WeeklyEmailListing[]) => {
    if (group.length === 0) return;
    textLines.push(heading, '');
    for (const l of group) {
      textLines.push(`- ${l.title}`);
      const price = formatPrice(l.price);
      if (price) textLines.push(`  Price: ${price}`);
      textLines.push(`  Type: ${listingTypeLabel(l.listingType)}`);
      if (l.description) textLines.push(`  ${truncate(l.description, 160)}`);
      textLines.push(`  View listing: ${forSaleUrl}/${l.id}`, '');
    }
  };
  pushTextSection('NEW THIS WEEK', newListings);
  pushTextSection('STILL ON THE MARKET', otherListings);
  textLines.push(
    `View all listings: ${forSaleUrl}`,
    '',
    'Have something to sell? Post it on On The Market today.',
    `Post a listing: ${forSaleUrl}`,
    '',
    'Barefoot Bay Community Platform - Barefoot Bay, FL 32976',
    `To stop receiving email notifications, visit: ${baseUrl}/unsubscribe`,
  );

  return { subject, html, text: textLines.join('\n') };
}
