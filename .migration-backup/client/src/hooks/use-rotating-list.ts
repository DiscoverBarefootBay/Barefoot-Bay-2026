import { useState, useEffect, useRef, useCallback } from "react";

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export interface UseRotatingListOptions {
  intervalMs?: number;
  randomizeOnLoad?: boolean;
  rotationEnabled?: boolean;
  manualOrderEnabled?: boolean;
  manualOrderIds?: number[];
  target?: Element | null;
  pauseWhenHidden?: boolean;
}

export function useRotatingList<T extends { id: number }>(
  items: T[],
  optionsOrIntervalMs: number | UseRotatingListOptions = 30000,
): T[] {
  const options: UseRotatingListOptions =
    typeof optionsOrIntervalMs === "number"
      ? { intervalMs: optionsOrIntervalMs }
      : optionsOrIntervalMs;

  const {
    intervalMs = 30000,
    randomizeOnLoad = true,
    rotationEnabled = true,
    manualOrderEnabled = false,
    manualOrderIds = [],
    target = null,
    pauseWhenHidden = true,
  } = options;

  // When the caller explicitly passes the `target` option (even if it is
  // currently `null`), treat target tracking as opted-in. A null target then
  // means "the element isn't mounted" and we should pause until it appears.
  const trackTarget = "target" in options;

  const [orderIds, setOrderIds] = useState<number[]>([]);
  const prevSignatureRef = useRef<string>("");

  const getIdsKey = useCallback((list: T[]) => {
    return list
      .map((item) => item.id)
      .sort((a, b) => a - b)
      .join(",");
  }, []);

  const buildDeterministicOrder = useCallback((list: T[]): T[] => {
    return [...list].sort((a, b) => a.id - b.id);
  }, []);

  const buildManualOrder = useCallback(
    (list: T[], orderIds: number[]): T[] => {
      const itemsMap = new Map(list.map((item) => [item.id, item]));
      const ordered: T[] = [];
      const seen = new Set<number>();
      for (const id of orderIds) {
        const item = itemsMap.get(id);
        if (item && !seen.has(id)) {
          ordered.push(item);
          seen.add(id);
        }
      }
      const remaining = list
        .filter((item) => !seen.has(item.id))
        .sort((a, b) => a.id - b.id);
      return [...ordered, ...remaining];
    },
    [],
  );

  useEffect(() => {
    const signature = [
      manualOrderEnabled ? "manual" : randomizeOnLoad ? "rand" : "stable",
      getIdsKey(items),
      manualOrderEnabled ? manualOrderIds.join(",") : "",
    ].join("|");

    if (signature === prevSignatureRef.current) return;
    prevSignatureRef.current = signature;

    let next: T[];
    if (manualOrderEnabled) {
      next = buildManualOrder(items, manualOrderIds);
    } else if (randomizeOnLoad && items.length > 1) {
      next = shuffleArray(items);
    } else {
      next = buildDeterministicOrder(items);
    }
    setOrderIds(next.map((item) => item.id));
  }, [
    items,
    manualOrderEnabled,
    manualOrderIds,
    randomizeOnLoad,
    getIdsKey,
    buildManualOrder,
    buildDeterministicOrder,
  ]);

  // Pause when the document/tab is hidden (Page Visibility API).
  const [isDocumentHidden, setIsDocumentHidden] = useState<boolean>(() =>
    typeof document !== "undefined" ? document.hidden : false,
  );
  useEffect(() => {
    if (!pauseWhenHidden) {
      setIsDocumentHidden(false);
      return;
    }
    if (typeof document === "undefined") return;
    const handler = () => setIsDocumentHidden(document.hidden);
    setIsDocumentHidden(document.hidden);
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [pauseWhenHidden]);

  // Pause when the target element scrolls out of the viewport. If the caller
  // opted into target tracking but the element isn't mounted yet, treat it as
  // offscreen so rotation does not advance while the banner isn't on screen.
  const [isTargetOffscreen, setIsTargetOffscreen] = useState<boolean>(false);
  useEffect(() => {
    if (!trackTarget) {
      setIsTargetOffscreen(false);
      return;
    }
    if (!target) {
      setIsTargetOffscreen(true);
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      setIsTargetOffscreen(false);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setIsTargetOffscreen(!entry.isIntersecting);
      },
      { threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [trackTarget, target]);

  const isPaused = isDocumentHidden || isTargetOffscreen;

  useEffect(() => {
    if (!rotationEnabled || manualOrderEnabled) return;
    if (orderIds.length <= 1) return;
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) return;
    if (isPaused) return;

    const timer = setInterval(() => {
      setOrderIds((prev) => {
        if (prev.length <= 1) return prev;
        const [first, ...rest] = prev;
        return [...rest, first];
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [orderIds.length, intervalMs, rotationEnabled, manualOrderEnabled, isPaused]);

  const itemsMap = new Map(items.map((item) => [item.id, item]));
  return orderIds
    .map((id) => itemsMap.get(id))
    .filter((item): item is T => item !== undefined);
}
