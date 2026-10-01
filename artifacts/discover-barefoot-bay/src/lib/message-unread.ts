import type { QueryClient } from "@tanstack/react-query";

export const UNREAD_ENDPOINT = "/api/messages/unread/count";
export const unreadQueryKey = (userId: number | null) => [UNREAD_ENDPOINT, userId] as const;

export type UnreadCounts = { count: number; messageCount: number };

export function parseUnreadCounts(value: unknown): UnreadCounts {
  const data = value as UnreadCounts | null;
  if (!data || !Number.isSafeInteger(data.count) || data.count < 0 ||
      !Number.isSafeInteger(data.messageCount) || data.messageCount < data.count) {
    throw new Error("Invalid unread message count response");
  }
  return { count: data.count, messageCount: data.messageCount };
}

export function unreadPollingInterval(userId: number | null, visible: boolean, unauthorized: boolean) {
  return userId !== null && visible && !unauthorized ? 5000 : false;
}

export function isMessageWrite(url: string, method: string, origin: string): boolean {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())) return false;
  try {
    const parsed = new URL(url, origin);
    // Both paths mount the same router. Ignore unrelated APIs and third parties.
    return parsed.origin === origin && /^\/api\/(?:chat\/)?messages(?:\/|$)/.test(parsed.pathname);
  } catch {
    return false;
  }
}

/**
 * Legacy messaging uses raw fetch as well as apiRequest and form submissions.
 * One success interceptor covers read/thread-read/mark-all/archive/delete/send
 * without requiring every existing writer to know about the navigation badge.
 */
export function installUnreadInvalidation(client: QueryClient) {
  const previousFetch = window.fetch;
  const wrappedFetch: typeof window.fetch = async (input, init) => {
    const response = await previousFetch.call(window, input, init);
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET");
    if (response.ok && isMessageWrite(url, method, window.location.origin)) {
      void client.invalidateQueries({ queryKey: [UNREAD_ENDPOINT] });
    }
    return response;
  };
  window.fetch = wrappedFetch;
  return () => {
    if (window.fetch === wrappedFetch) window.fetch = previousFetch;
  };
}