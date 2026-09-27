import { useQuery } from "@tanstack/react-query";

export const copyrightActivityKey = (userId: number | null) =>
  ["/api/dmca/my-activity", userId] as const;

export function useCopyrightActivity(userId: number | null): boolean {
  const query = useQuery<{ hasActivity: boolean }>({
    queryKey: copyrightActivityKey(userId),
    enabled: userId != null,
    queryFn: async () => {
      const response = await fetch("/api/dmca/my-activity", { credentials: "include" });
      if (!response.ok) throw new Error("Could not check copyright activity");
      return response.json();
    },
    placeholderData: undefined,
    staleTime: 30_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: false,
  });
  // Fail closed until the current user's own response has arrived.
  return userId != null && !query.isPlaceholderData && !query.isError && query.data?.hasActivity === true;
}