/**
 * DMCA status links carry a bearer token in the path (/dmca/status/<token>).
 * Anything that logs or stores URLs (request logs, analytics, activity
 * tracking) must pass them through this so the token is never persisted.
 */
const DMCA_STATUS_TOKEN = /(\/dmca\/status\/)[^/?#\s"']+/gi;

export function redactSensitivePath<T>(value: T): T {
  if (typeof value !== "string") return value;
  return value.replace(DMCA_STATUS_TOKEN, "$1[redacted]") as unknown as T;
}

/** Shallow-redacts the usual URL-bearing keys of an analytics properties bag. */
export function redactSensitiveProps<T>(props: T): T {
  if (!props || typeof props !== "object" || Array.isArray(props)) return props;
  const out: Record<string, unknown> = { ...(props as Record<string, unknown>) };
  for (const key of ["url", "path", "referrer", "href", "pathname", "page"]) {
    if (typeof out[key] === "string") out[key] = redactSensitivePath(out[key]);
  }
  return out as T;
}
