import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UNREAD_ENDPOINT, parseUnreadCounts, unreadPollingInterval, unreadQueryKey } from "../lib/message-unread";

class UnreadRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export function useUnreadMessages(userId: number | null) {
  const [visible, setVisible] = useState(() => document.visibilityState === "visible");
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const query = useQuery({
    queryKey: unreadQueryKey(userId),
    queryFn: async ({ signal }) => {
      const response = await fetch(UNREAD_ENDPOINT, { credentials: "include", signal, cache: "no-store" });
      if (!response.ok) throw new UnreadRequestError("Failed to fetch unread message count", response.status);
      return parseUnreadCounts(await response.json());
    },
    enabled: userId !== null && visible,
    refetchInterval: (query) => unreadPollingInterval(
      userId, visible, query.state.error instanceof UnreadRequestError && query.state.error.status === 401,
    ),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    staleTime: 0,
    gcTime: 0,
    placeholderData: undefined,
    retry: (failures, error) => !(error instanceof UnreadRequestError && error.status === 401) && failures < 2,
  });
  return { ...query, data: userId === null ? undefined : query.data };
}