/**
 * Shared client helpers for the admin Legal / Compliance (DMCA) screens.
 * API contract: /api/admin/dmca (routes/dmca-admin.ts on the API server).
 *
 * Uses plain fetch (not apiRequest) so field-level validation errors
 * (`errors: {field: message}`) and 423 legal-hold messages reach the UI.
 */
import { useQuery } from "@tanstack/react-query";

export const DMCA_ADMIN_API = "/api/admin/dmca";

export const DmcaPerm = {
  FLAG: "dmca.flag",
  VIEW: "dmca.view",
  CREATE: "dmca.create",
  REVIEW: "dmca.review",
  TAKEDOWN: "dmca.takedown",
  RESTORE: "dmca.restore",
  MANAGE_HOLDS: "dmca.manage_holds",
  MANAGE_REPEAT_INFRINGER: "dmca.manage_repeat_infringer",
  VIEW_PRIVATE_FILES: "dmca.view_private_files",
  PERMANENT_DELETE: "dmca.permanent_delete",
  MANAGE_PERMISSIONS: "dmca.manage_permissions",
} as const;
export type DmcaPerm = typeof DmcaPerm[keyof typeof DmcaPerm];

export const DMCA_PERMISSION_LABELS: Record<string, string> = {
  "dmca.flag": "Flag content for DMCA review",
  "dmca.view": "View DMCA cases",
  "dmca.create": "Create cases (manual entry)",
  "dmca.review": "Review cases & counter-notices",
  "dmca.takedown": "Approve takedowns",
  "dmca.restore": "Restore content",
  "dmca.manage_holds": "Manage legal holds & court actions",
  "dmca.manage_repeat_infringer": "Repeat-infringer decisions",
  "dmca.view_private_files": "View quarantined / private files",
  "dmca.permanent_delete": "Permanently delete content",
  "dmca.manage_permissions": "Manage DMCA permissions & settings",
};

export const DMCA_FILTERS = [
  { key: "new", label: "New" },
  { key: "needs_info", label: "Needs Information" },
  { key: "awaiting_review", label: "Awaiting Review" },
  { key: "takedown_approved", label: "Takedown Approved" },
  { key: "content_disabled", label: "Content Disabled" },
  { key: "counter_notice", label: "Counter-Notice Received" },
  { key: "restoration_waiting", label: "Restoration Waiting Period" },
  { key: "court_hold", label: "Court Action / Hold" },
  { key: "restored", label: "Restored" },
  { key: "closed", label: "Closed" },
] as const;
export type DmcaFilterKey = typeof DMCA_FILTERS[number]["key"];

/** Admin-facing labels for internal case statuses. */
export const DMCA_STATUS_LABELS: Record<string, string> = {
  RECEIVED: "New",
  INCOMPLETE: "Awaiting Claimant Information",
  UNDER_REVIEW: "Awaiting Review",
  REJECTED: "Rejected",
  ACCEPTED: "Takedown Approved",
  CONTENT_REMOVED: "Content Disabled",
  UPLOADER_NOTIFIED: "Content Disabled — Uploader Notified",
  COUNTER_NOTICE_RECEIVED: "Counter-Notice Received",
  COUNTER_NOTICE_INCOMPLETE: "Counter-Notice Rejected / Incomplete",
  COUNTER_NOTICE_ACCEPTED: "Counter-Notice Accepted",
  CLAIMANT_NOTIFIED_OF_COUNTER: "Claimant Notified of Counter-Notice",
  WAITING_FOR_RESTORATION_WINDOW: "Restoration Waiting Period",
  RESTORATION_ELIGIBLE: "Eligible for Restoration",
  RESTORED: "Restored",
  COURT_ACTION_RECEIVED: "Court Action / Hold",
  CLOSED: "Closed",
};

export const TARGET_STATE_LABELS: Record<string, string> = {
  published: "Published",
  dmca_hidden: "DMCA hidden",
  moderation_hidden: "Moderation hidden",
  deleted: "Deleted",
  legal_hold: "Legal hold",
};

export const CONTENT_TYPE_LABELS: Record<string, string> = {
  forum_post: "Forum post",
  forum_comment: "Forum comment",
  listing: "Listing",
  event: "Event",
  event_comment: "Event comment",
  page: "Page",
  vendor_comment: "Vendor/page comment",
  avatar: "Avatar",
  url: "URL",
};

export class DmcaApiError extends Error {
  constructor(message: string, readonly status: number, readonly errors: Record<string, string> = {}, readonly code?: string) {
    super(message);
  }
}

/** fetch wrapper: JSON in/out, credentials included, throws DmcaApiError with server message + field errors. */
export async function dmcaFetch<T = any>(path: string, init: { method?: string; body?: unknown; formData?: FormData } = {}): Promise<T> {
  const url = path.startsWith("/api/") ? path : `${DMCA_ADMIN_API}${path}`;
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;
  if (init.formData) body = init.formData;
  else if (init.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.body);
  }
  const res = await fetch(url, { method: init.method ?? (body ? "POST" : "GET"), headers, body, credentials: "include" });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  if (!res.ok) {
    throw new DmcaApiError(data?.message || data?.error || `Request failed (${res.status})`, res.status, data?.errors ?? {}, data?.error);
  }
  return data as T;
}

export interface DmcaMe {
  permissions: string[];
  bundles: Record<"moderator" | "dmca_admin" | "legal_admin", string[]>;
  allPermissions: string[];
  isSiteAdmin: boolean;
  isModerator: boolean;
}

/** Current user's DMCA permissions. `can(p)` is false while loading or on error. */
export function useDmcaMe() {
  const q = useQuery<DmcaMe>({
    queryKey: [DMCA_ADMIN_API, "me"],
    queryFn: () => dmcaFetch<DmcaMe>("/me"),
    staleTime: 60_000,
    retry: false,
    // Override the app-wide placeholderData fallback: never treat [] / null as permissions.
    placeholderData: undefined,
  });
  const perms = !q.isPlaceholderData && Array.isArray(q.data?.permissions) ? q.data!.permissions : [];
  return { ...q, permissions: perms, can: (p: string) => perms.includes(p) };
}
