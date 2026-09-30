export const SEND_PROGRESS_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isRecentSend(createdAt: string, now: number): boolean {
  const created = Date.parse(createdAt);
  return Number.isFinite(created) && created <= now && created > now - SEND_PROGRESS_WINDOW_MS;
}

export function millisecondsUntilNextExpiry(
  jobs: ReadonlyArray<{ createdAt: string }>,
  now: number,
): number | null {
  const remaining = jobs
    .filter(job => isRecentSend(job.createdAt, now))
    .map(job => Date.parse(job.createdAt) + SEND_PROGRESS_WINDOW_MS - now);
  return remaining.length ? Math.min(...remaining) : null;
}