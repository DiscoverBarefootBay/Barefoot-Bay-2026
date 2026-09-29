import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LEGAL_QUERY_KEYS,
  consentCheckInterval,
  LEGAL_SYNC_CHANNEL,
  LEGAL_SYNC_STORAGE_KEY,
  fetchLegalConsent,
  fetchLegalHistory,
  fetchLegalPolicies,
  submitLegalConsent,
  type LegalAcceptance,
  type LegalConsentStatus,
} from "@/lib/legal";

/** Active published policies (public). */
export function useLegalPolicies() {
  return useQuery({
    queryKey: LEGAL_QUERY_KEYS.policies,
    queryFn: fetchLegalPolicies,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
    placeholderData: undefined,
    retry: 1,
  });
}

/** Consent status for the signed-in account. Polls moderately. */
export function useLegalConsent(userId: number | null) {
  const enabled = userId !== null;
  return useQuery({
    queryKey: LEGAL_QUERY_KEYS.consent(userId),
    queryFn: fetchLegalConsent,
    enabled,
    staleTime: 0,
    refetchInterval: enabled ? (query) => consentCheckInterval(query.state.status) : false,
    refetchIntervalInBackground: false,
    // Focus refetch is driven by the gate so it can require freshness.
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: undefined,
    retry: 1,
  });
}

export function broadcastLegalChange() {
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const ch = new BroadcastChannel(LEGAL_SYNC_CHANNEL);
      ch.postMessage({ type: "consent-changed", at: Date.now() });
      ch.close();
    }
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(LEGAL_SYNC_STORAGE_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/** Listens for consent/policy changes from other tabs and refetches. */
export function useLegalTabSync() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ["legal"] });
    };
    let ch: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        ch = new BroadcastChannel(LEGAL_SYNC_CHANNEL);
        ch.onmessage = refresh;
      }
    } catch {
      ch = null;
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === LEGAL_SYNC_STORAGE_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      ch?.close();
    };
  }, [queryClient]);
}

export function useAcceptLegalPolicies(userId: number | null) {
  const queryClient = useQueryClient();
  return useMutation<LegalConsentStatus, Error, LegalAcceptance[]>({
    mutationFn: submitLegalConsent,
    onSuccess: (status) => {
      queryClient.setQueryData(LEGAL_QUERY_KEYS.consent(userId), status);
      queryClient.invalidateQueries({ queryKey: LEGAL_QUERY_KEYS.policies });
      broadcastLegalChange();
    },
  });
}

export function useLegalHistory(page: number, policyKey: string) {
  return useQuery({
    queryKey: LEGAL_QUERY_KEYS.history(page, policyKey),
    queryFn: () => fetchLegalHistory(page, policyKey),
    placeholderData: undefined,
    retry: false,
  });
}
