/**
 * Batch clustered freshness signals (visibility + focus, navigation + 428).
 * Invalidation is immediate; no cached grant is usable while waiting. A signal
 * arriving after a request starts schedules a NEW check, never reuses that
 * earlier request as proof of freshness.
 */
export function createLegalRecheckBatcher(
  invalidate: () => void,
  check: () => Promise<unknown>,
  complete: (startedAt: number) => void,
  delay = 50,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  let disposed = false;
  return {
    request() {
      // Also permits React's effect cleanup/setup replay in development.
      disposed = false;
      const current = ++generation;
      invalidate();
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(async () => {
        timer = undefined;
        const startedAt = Date.now();
        try {
          await check();
        } catch {
          // Query errors are rendered by the gate. Do not restore a cached
          // grant if the freshness request itself failed.
          return;
        }
        if (!disposed && generation === current) complete(startedAt);
      }, delay);
    },
    dispose() {
      disposed = true;
      generation++;
      if (timer !== undefined) clearTimeout(timer);
    },
  };
}