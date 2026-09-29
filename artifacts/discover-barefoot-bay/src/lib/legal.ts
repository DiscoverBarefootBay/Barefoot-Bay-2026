/**
 * Versioned legal policy client. The server is the only authority on which
 * policy versions are current and whether a signed-in account has accepted
 * them. Everything here validates response shape strictly so that fallback
 * values injected elsewhere (for example `[]` or `null`) can never be
 * mistaken for a consent grant.
 */

import type {
  LegalPolicy,
  LegalPolicyKey,
  LegalConsentStatus,
  LegalAcceptance,
} from "@workspace/api-client-react";

export type { LegalPolicy, LegalPolicyKey, LegalConsentStatus, LegalAcceptance };

export const LEGAL_POLICY_KEYS: LegalPolicyKey[] = ["terms", "privacy", "dmca"];

export const LEGAL_POLICY_LABELS: Record<LegalPolicyKey, string> = {
  terms: "Terms and Agreements",
  privacy: "Privacy Policy",
  dmca: "Copyright / DMCA Policy",
};

export const LEGAL_POLICY_PATHS: Record<LegalPolicyKey, string> = {
  terms: "/terms",
  privacy: "/privacy",
  dmca: "/dmca",
};

export interface LegalAcceptanceRecord {
  userId: number;
  policyKey: LegalPolicyKey;
  versionId: number;
  acceptedAt: string;
  source: string;
}

export interface LegalHistory {
  versions: LegalPolicy[];
  acceptances: LegalAcceptanceRecord[];
  total?: number;
  page?: number;
  pageSize?: number;
}

export const LEGAL_QUERY_KEYS = {
  policies: ["legal", "policies"] as const,
  consentRoot: ["legal", "consent"] as const,
  consent: (userId: number | null) => ["legal", "consent", userId ?? "anon"] as const,
  history: (page: number, filter: string) => ["legal", "history", page, filter] as const,
};

/** Check more often while unavailable so an existing session can recover in place. */
export function consentCheckInterval(queryStatus: string): number {
  return queryStatus === "error" ? 15_000 : 90_000;
}

export class LegalApiError extends Error {
  status: number;
  code: string | null;
  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = "LegalApiError";
    this.status = status;
    this.code = code;
  }
}

export function isPolicyKey(v: unknown): v is LegalPolicyKey {
  return v === "terms" || v === "privacy" || v === "dmca";
}

export function isLegalPolicy(v: unknown): v is LegalPolicy {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return (
    isPolicyKey(p.key) &&
    typeof p.versionId === "number" &&
    Number.isFinite(p.versionId) &&
    typeof p.title === "string" &&
    typeof p.url === "string" &&
    typeof p.publishedAt === "string" &&
    typeof p.contentHtml === "string" &&
    (p.changeNotes === null || p.changeNotes === undefined || typeof p.changeNotes === "string")
  );
}

function normalizePolicy(p: LegalPolicy): LegalPolicy {
  return { ...p, changeNotes: p.changeNotes ?? null };
}

/** Parses the public policy manifest. Requires all three policies. */
export function parsePolicies(raw: unknown): LegalPolicy[] {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as any).policies)) {
    throw new LegalApiError("Policy information was not in the expected format.", 0, "BAD_SHAPE");
  }
  const list = (raw as any).policies as unknown[];
  if (!list.every(isLegalPolicy)) {
    throw new LegalApiError("Policy information was not in the expected format.", 0, "BAD_SHAPE");
  }
  const policies = (list as LegalPolicy[]).map(normalizePolicy);
  for (const key of LEGAL_POLICY_KEYS) {
    if (!policies.some((p) => p.key === key)) {
      throw new LegalApiError("A required policy is not currently published.", 0, "MISSING_POLICY");
    }
  }
  return policies;
}

/**
 * Parses consent status. Throws on anything malformed. The result only
 * permits normal use when requiresAcceptance is literally false AND the
 * outstanding list is empty.
 */
export function parseConsentStatus(raw: unknown): LegalConsentStatus {
  if (!raw || typeof raw !== "object") {
    throw new LegalApiError("Consent status was not in the expected format.", 0, "BAD_SHAPE");
  }
  const r = raw as Record<string, unknown>;
  if (
    !Array.isArray(r.policies) ||
    !Array.isArray(r.outstanding) ||
    typeof r.requiresAcceptance !== "boolean" ||
    !r.policies.every(isLegalPolicy) ||
    !r.outstanding.every(isLegalPolicy)
  ) {
    throw new LegalApiError("Consent status was not in the expected format.", 0, "BAD_SHAPE");
  }
  const outstanding = (r.outstanding as LegalPolicy[]).map(normalizePolicy);
  return {
    policies: (r.policies as LegalPolicy[]).map(normalizePolicy),
    outstanding,
    // Defensive: any outstanding entry forces acceptance regardless of the flag.
    requiresAcceptance: r.requiresAcceptance === true || outstanding.length > 0,
  };
}

export function parseHistory(raw: unknown): LegalHistory {
  if (!raw || typeof raw !== "object") {
    throw new LegalApiError("History was not in the expected format.", 0, "BAD_SHAPE");
  }
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.versions) || !Array.isArray(r.acceptances)) {
    throw new LegalApiError("History was not in the expected format.", 0, "BAD_SHAPE");
  }
  const versions = (r.versions as unknown[]).filter(isLegalPolicy).map(normalizePolicy);
  const acceptances = (r.acceptances as unknown[]).filter((a): a is LegalAcceptanceRecord => {
    if (!a || typeof a !== "object") return false;
    const x = a as Record<string, unknown>;
    return (
      typeof x.userId === "number" &&
      isPolicyKey(x.policyKey) &&
      typeof x.versionId === "number" &&
      typeof x.acceptedAt === "string" &&
      typeof x.source === "string"
    );
  });
  return {
    versions,
    acceptances,
    total: typeof r.total === "number" ? r.total : undefined,
    page: typeof r.page === "number" ? r.page : undefined,
    pageSize: typeof r.pageSize === "number" ? r.pageSize : undefined,
  };
}

async function legalFetch(url: string, init?: RequestInit): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      credentials: "include",
      cache: "no-store",
      ...init,
      headers: {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers || {}),
      },
    });
  } catch {
    throw new LegalApiError("We could not reach the server. Check your connection and try again.", 0, "NETWORK");
  }
  let body: any = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  if (!res.ok) {
    const code = typeof body?.code === "string" ? body.code : null;
    const message =
      (typeof body?.message === "string" && body.message) ||
      (res.status === 503
        ? "Policy services are temporarily unavailable. Please try again shortly."
        : `Request failed (status ${res.status}).`);
    throw new LegalApiError(message, res.status, code);
  }
  return body;
}

export async function fetchLegalPolicies(): Promise<LegalPolicy[]> {
  return parsePolicies(await legalFetch("/api/legal/policies"));
}

export async function fetchLegalConsent(): Promise<LegalConsentStatus> {
  return parseConsentStatus(await legalFetch("/api/legal/consent"));
}

export async function submitLegalConsent(acceptances: LegalAcceptance[]): Promise<LegalConsentStatus> {
  return parseConsentStatus(
    await legalFetch("/api/legal/consent", {
      method: "POST",
      body: JSON.stringify({ acceptances }),
    }),
  );
}

export async function fetchLegalHistory(page: number, policyKey: string): Promise<LegalHistory> {
  const params = new URLSearchParams({ page: String(page), pageSize: "50" });
  if (policyKey && policyKey !== "all") params.set("policyKey", policyKey);
  return parseHistory(await legalFetch(`/api/legal/history?${params.toString()}`));
}

/** Selections: map of policy key -> version id the user explicitly checked. */
export type LegalSelections = Partial<Record<LegalPolicyKey, number>>;

/**
 * Drops any selection whose version no longer matches the current list.
 * Returns the reconciled selections and whether anything was dropped.
 */
export function reconcileSelections(
  selections: LegalSelections,
  current: LegalPolicy[],
): { selections: LegalSelections; dropped: boolean } {
  const next: LegalSelections = {};
  let dropped = false;
  for (const key of Object.keys(selections) as LegalPolicyKey[]) {
    const v = selections[key];
    const match = current.find((p) => p.key === key);
    if (match && match.versionId === v) next[key] = v;
    else dropped = true;
  }
  return { selections: next, dropped };
}

/** Builds acceptances only for the given policies, all must be selected. */
export function buildAcceptances(
  required: LegalPolicy[],
  selections: LegalSelections,
): LegalAcceptance[] | null {
  if (required.length === 0) return null;
  const out: LegalAcceptance[] = [];
  for (const p of required) {
    if (selections[p.key] !== p.versionId) return null;
    out.push({ key: p.key, versionId: p.versionId, accepted: true });
  }
  return out;
}

export function isPolicyStaleError(err: unknown): boolean {
  const e = err as { status?: number; code?: string | null; message?: string } | null;
  if (!e) return false;
  if (e.code === "POLICY_VERSION_CHANGED" || e.code === "POLICY_ACCEPTANCE_REQUIRED") return true;
  if (e.status === 409 || e.status === 428) return true;
  return typeof e.message === "string" && /^(409|428):/.test(e.message);
}

export function isPolicyRequiredError(err: unknown): boolean {
  const e = err as { status?: number; code?: string | null; message?: string } | null;
  if (!e) return false;
  return (
    e.status === 428 ||
    e.code === "POLICY_ACCEPTANCE_REQUIRED" ||
    (typeof e.message === "string" && e.message.startsWith("428:"))
  );
}

/**
 * Routes a signed-in user may use while acceptance is outstanding. Kept
 * deliberately narrow: legal reading, sign out, account recovery, the public
 * statutory copyright notice/status procedure, and the uploader's
 * counter-notice path for a specific case. Nothing else.
 */
export function isConsentExemptPath(rawPath: string): boolean {
  const path = (rawPath.split(/[?#]/)[0] || "/").replace(/\/+$/, "") || "/";
  if (path === "/terms" || path === "/privacy" || path === "/dmca") return true;
  if (path === "/dmca/notice") return true;
  if (/^\/dmca\/status\/[^/]+$/.test(path)) return true;
  if (path === "/forgot-password" || path === "/reset-password") return true;
  // Uploader's own copyright notices (list, case detail, counter-notice).
  // Server enforces ownership; these mirror the API consent exceptions.
  if (path === "/copyright-notices") return true;
  if (/^\/copyright-notices\/[^/]+$/.test(path)) return true;
  if (/^\/copyright-notices\/[^/]+\/counter-notice$/.test(path)) return true;
  return false;
}

export function formatPolicyDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export const LEGAL_SYNC_CHANNEL = "bb-legal-consent";
export const LEGAL_SYNC_STORAGE_KEY = "bb-legal-consent-sync";

export type GateDecision = "children" | "skeleton" | "error" | "prompt" | "verifying";

/**
 * Pure gate decision. "verifying" means a previously accepted status exists
 * but a fresh check (navigation, focus, policy-required response) has not
 * yet succeeded: children stay mounted but inert and non-interactive.
 */
export function decideGate(s: {
  signedIn: boolean;
  exempt: boolean;
  authLoading: boolean;
  isError: boolean;
  status: LegalConsentStatus | undefined;
  dataUpdatedAt: number;
  freshAfter: number;
}): GateDecision {
  if (s.exempt) return "children";
  if (s.authLoading) return "skeleton";
  if (!s.signedIn) return "children";
  if (s.isError) return "error";
  if (!s.status) return "skeleton";
  if (s.status.requiresAcceptance) return s.status.outstanding.length > 0 ? "prompt" : "error";
  if (s.dataUpdatedAt < s.freshAfter) return "verifying";
  return "children";
}
