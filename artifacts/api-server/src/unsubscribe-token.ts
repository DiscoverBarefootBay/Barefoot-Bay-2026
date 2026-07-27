/**
 * Signed, per-recipient unsubscribe tokens.
 *
 * A token embeds the user id and a scope, HMAC-signed with the server secret,
 * so an email recipient can unsubscribe in one click without being logged in —
 * and nobody can unsubscribe other users by guessing ids.
 *
 * Token format: base64url("<userId>.<scope>.<issuedAtMs>") + "." + hmacSig
 * Tokens deliberately do NOT expire: unsubscribe links in old emails must keep
 * working (RFC 8058 one-click unsubscribe is also served from these tokens).
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { storage } from './storage';

export const UNSUBSCRIBE_SCOPE = 'email-notifications';

/** Public site base URL for links inside emails (matches sendgrid-service logic). */
export function getPublicBaseUrl(): string {
  if (process.env.NODE_ENV === 'production') {
    return process.env.APP_BASE_URL || 'https://barefootbay.com';
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  return 'http://localhost:5000';
}

function getSecret(): string {
  const secret = process.env.UNSUBSCRIBE_TOKEN_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[UnsubscribeToken] SESSION_SECRET (or UNSUBSCRIBE_TOKEN_SECRET) must be set');
    }
    return 'dev-only-unsubscribe-secret';
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

/** Generate a signed unsubscribe token for a user. */
export function generateUnsubscribeToken(
  userId: number,
  scope: string = UNSUBSCRIBE_SCOPE,
): string {
  const payload = Buffer.from(`${userId}.${scope}.${Date.now()}`).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

/** Verify a token; returns the embedded user id + scope, or null when invalid. */
export function verifyUnsubscribeToken(
  token: unknown,
): { userId: number; scope: string } | null {
  if (typeof token !== 'string' || token.length === 0 || token.length > 512) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(payload);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  let decoded: string;
  try {
    decoded = Buffer.from(payload, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  const parts = decoded.split('.');
  if (parts.length < 2) return null;
  const userId = Number(parts[0]);
  if (!Number.isInteger(userId) || userId <= 0) return null;
  return { userId, scope: parts[1]! };
}

/** The tokenized unsubscribe page URL for a user. */
export function buildUnsubscribeUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/unsubscribe?token=${encodeURIComponent(token)}`;
}

/** The tokenized one-click (RFC 8058) API endpoint URL for a user. */
export function buildOneClickUnsubscribeUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/api/unsubscribe?token=${encodeURIComponent(token)}`;
}

/**
 * Rewrite every bare `/unsubscribe` link in rendered email HTML/text so it
 * carries the recipient's token. Links that already have a query string are
 * left alone.
 */
export function tokenizeUnsubscribeLinks(content: string, token: string): string {
  return content.replace(/\/unsubscribe(?![\w?/-])/g, `/unsubscribe?token=${encodeURIComponent(token)}`);
}

/** RFC 8058 List-Unsubscribe headers for a recipient. */
export function unsubscribeHeaders(baseUrl: string, token: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${buildOneClickUnsubscribeUrl(baseUrl, token)}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

/**
 * Look up the user record for a recipient email (case-insensitive) and return
 * their unsubscribe token, or null when no user matches. Never throws — email
 * sending must not fail because token personalization failed.
 */
export async function getUnsubscribeTokenForEmail(email: string): Promise<string | null> {
  try {
    const trimmed = email?.trim();
    if (!trimmed || !trimmed.includes('@')) return null;
    const user = await storage.getUserByEmailCaseInsensitive(trimmed);
    if (!user) return null;
    return generateUnsubscribeToken(user.id);
  } catch (err) {
    console.error('[UnsubscribeToken] Failed to resolve token for recipient:', err);
    return null;
  }
}
