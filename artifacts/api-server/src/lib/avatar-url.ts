/**
 * Helper for canonicalizing avatar URLs before they are persisted to
 * `users.avatar_url`.
 *
 * Background: avatars have historically been written in several shapes:
 *   - `/avatars/<file>`                              (legacy filesystem)
 *   - `/uploads/avatars/<file>`                      (legacy uploads dir)
 *   - `/api/storage-proxy/AVATARS/<file>`            (proxy, bucket-name path)
 *   - `/api/storage-proxy/AVATARS/avatars/<file>`    (proxy w/ nested prefix)
 *   - `https://object-storage.replit.app/AVATARS/<file>`
 *   - `/api/storage-proxy/direct-avatars/<file>`     (canonical)
 *
 * Task #104 backfilled existing rows to the canonical
 * `/api/storage-proxy/direct-avatars/<filename>` shape. This helper exists so
 * that every code path that writes to `users.avatar_url` going forward also
 * normalizes to that shape — preventing the inconsistency from
 * re-accumulating.
 *
 * External URLs that are not avatar-bucket URLs (for example, an OAuth
 * provider photo such as `https://lh3.googleusercontent.com/...`) and `null`
 * / empty / `undefined` inputs are returned unchanged (with empty strings
 * coerced to `null` so we don't store junk).
 */

const CANONICAL_PREFIX = '/api/storage-proxy/direct-avatars/';

/**
 * Patterns whose match groups capture the avatar filename (no leading path).
 * Ordered from most-specific to least-specific.
 */
const AVATAR_PATH_PATTERNS: RegExp[] = [
  // Already canonical — match so we still normalize away nested segments.
  /^\/api\/storage-proxy\/direct-avatars\/(.+)$/i,
  // Proxy route via bucket name, optionally with a nested `avatars/` prefix.
  /^\/api\/storage-proxy\/AVATARS\/(?:avatars\/)?(.+)$/i,
  // Direct Object Storage URL.
  /^https?:\/\/object-storage\.replit\.app\/AVATARS\/(?:avatars\/)?(.+)$/i,
  // Legacy filesystem paths.
  /^\/uploads\/avatars\/(.+)$/i,
  /^\/avatars\/(.+)$/i,
];

export function canonicalizeAvatarUrl(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (trimmed === '') return null;

  for (const pattern of AVATAR_PATH_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      // Strip any further nested directory components — the canonical form is
      // always a single filename under direct-avatars/.
      const filename = match[1].split('/').pop();
      if (filename) {
        return `${CANONICAL_PREFIX}${filename}`;
      }
    }
  }

  // Not an avatar-bucket URL we recognize (e.g. external OAuth photo URL).
  // Leave it untouched.
  return trimmed;
}
