import { queryOptions } from "@tanstack/react-query";
import type { getSocialClubs } from "@workspace/api-client-react";

export type ClubChoice = Awaited<ReturnType<typeof getSocialClubs>>[number];

export function socialClubOptions(userId: number | null = null, role = "guest") {
  return queryOptions({
    queryKey: ["/api/social-clubs", { userId, role }],
    queryFn: async ({ signal }): Promise<ClubChoice[]> => {
      const res = await fetch(`${import.meta.env?.BASE_URL ?? "/"}api/social-clubs`, { credentials: "include", signal });
      if (!res.ok) throw new Error("Unable to load social clubs.");
      const choices = await res.json();
      if (!Array.isArray(choices)) throw new Error("Invalid social club list.");
      return choices;
    },
    placeholderData: undefined,
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}

export function clubMembershipSelected(club: ClubChoice, selected: readonly string[]) {
  return [club.slug, ...(club.aliases ?? [])].some(slug => selected.includes(slug));
}

export function toggleClubMembership(club: ClubChoice, selected: string[], checked: boolean) {
  if (checked) return clubMembershipSelected(club, selected) ? selected : [...selected, club.slug];
  return selected.filter(slug => slug !== club.slug && !club.aliases?.includes(slug));
}
