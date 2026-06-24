import { useQuery } from "@tanstack/react-query";

export interface PlatinumSponsorSettings {
  randomizeOnLoad: boolean;
  rotationEnabled: boolean;
  rotationSeconds: number;
  manualOrderEnabled: boolean;
  manualOrder: number[];
}

export const PLATINUM_SPONSOR_DEFAULT_SETTINGS: PlatinumSponsorSettings = {
  randomizeOnLoad: true,
  rotationEnabled: true,
  rotationSeconds: 30,
  manualOrderEnabled: false,
  manualOrder: [],
};

export const PLATINUM_SPONSOR_MIN_INTERVAL_SECONDS = 5;

export function usePlatinumSponsorSettings() {
  return useQuery<PlatinumSponsorSettings>({
    queryKey: ["/api/platinum-sponsor-settings"],
    refetchInterval: 60000,
    staleTime: 30000,
    placeholderData: PLATINUM_SPONSOR_DEFAULT_SETTINGS,
  });
}
