import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ChevronUp, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useAcceptLegalPolicies, useLegalConsent, useLegalTabSync } from "@/hooks/use-legal";
import { PolicyDocument } from "./policy-document";
import {
  LEGAL_POLICY_PATHS,
  LEGAL_QUERY_KEYS,
  buildAcceptances,
  decideGate,
  formatPolicyDate,
  isConsentExemptPath,
  isPolicyStaleError,
  reconcileSelections,
  type LegalPolicy,
  type LegalSelections,
} from "@/lib/legal";
import { LEGAL_REQUIRED_EVENT, installLegalIntercept } from "@/lib/legal-intercept";
import { createLegalRecheckBatcher } from "@/lib/legal-recheck";
import { LegalCheckShell, LegalCheckStatus } from "./legal-check-status";

installLegalIntercept();

function GateShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] w-full bg-slate-100 flex items-start sm:items-center justify-center p-3 sm:p-6">
      {children}
    </div>
  );
}

function GateInitialCheck() {
  return (
    <LegalCheckShell><LegalCheckStatus /></LegalCheckShell>
  );
}

function GateError({ message, onRetry, retrying }: { message: string; onRetry: () => void; retrying: boolean }) {
  const { logoutMutation } = useAuth();
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  return (
    <GateShell>
      <div role="alert" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-lg" data-testid="legal-consent-error">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 mb-5">
          <AlertTriangle className="w-6 h-6 text-amber-600" aria-hidden="true" />
        </div>
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold text-slate-900 mb-3 outline-none">Policy review is temporarily unavailable</h1>
        <p className="text-slate-700 mb-3">You do not need to sign out. We can’t show the acknowledgement form until the current policies are confirmed.</p>
        <p className="text-sm text-slate-600 mb-6">{message} We’ll check again automatically and show the review form when it’s ready.</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={onRetry} disabled={retrying} className="sm:min-w-32" data-testid="button-retry-consent">
            {retrying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Checking...</> : "Check again"}
          </Button>
          <Link href="/copyright-notices" className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted" data-testid="link-consent-copyright-notices">
            Copyright notices and counter-notices
          </Link>
        </div>
        <button type="button" className="mt-6 text-sm text-slate-600 underline hover:text-slate-900" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending} data-testid="button-consent-logout">Sign out of this account</button>
      </div>
    </GateShell>
  );
}

function ConsentPrompt({ outstanding, onRecheck, userId }: { outstanding: LegalPolicy[]; onRecheck: () => void; userId: number | null }) {
  const { logoutMutation } = useAuth();
  const accept = useAcceptLegalPolicies(userId);
  const [selections, setSelections] = useState<LegalSelections>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const signature = outstanding.map((p) => `${p.key}:${p.versionId}`).join("|");
  const prevSignature = useRef(signature);
  useEffect(() => {
    if (prevSignature.current === signature) return;
    prevSignature.current = signature;
    setSelections((cur) => {
      const { selections: next, dropped } = reconcileSelections(cur, outstanding);
      if (dropped) setNotice("A policy was updated while you were reviewing. Please read the new version and check it again.");
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  // Focus management: move focus in, trap Tab, block Escape, restore on close.
  useEffect(() => {
    const el = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    el?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.key !== "Tab" || !el) return;
      const f = Array.from(
        el.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'),
      );
      if (f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (!el.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      previousFocus?.focus();
    };
  }, []);

  const acceptances = buildAcceptances(outstanding, selections);
  const multiple = outstanding.length > 1;

  const submit = () => {
    if (!acceptances) return;
    setNotice(null);
    accept.mutate(acceptances, {
      // Per-call callbacks do not run after this account's prompt unmounts.
      // Only a fresh GET, not the acceptance POST, can reopen the gate.
      onSuccess: onRecheck,
      onError: (err) => {
        if (isPolicyStaleError(err)) {
          setSelections({});
          setNotice("One or more policies changed before your acceptance was recorded. Nothing was saved. Please review the current versions and check each one again.");
          onRecheck();
        }
      },
    });
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/70 overflow-y-auto" data-testid="legal-consent-overlay">
      <div className="min-h-[100dvh] flex items-start sm:items-center justify-center p-3 sm:p-6">
        <div
          ref={dialogRef}
          data-legal-consent
          role="dialog"
          aria-modal="true"
          aria-labelledby="legal-consent-title"
          aria-describedby="legal-consent-desc"
          tabIndex={-1}
          className="w-full max-w-2xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] flex flex-col rounded-xl bg-white shadow-xl outline-none"
        >
          <div className="shrink-0 border-b px-5 py-4 sm:px-7">
            <div className="flex items-center gap-2 text-sky-700 mb-2">
              <ShieldCheck className="w-5 h-5" aria-hidden="true" />
              <span className="text-sm font-semibold uppercase tracking-wide">Action needed</span>
            </div>
            <h2 id="legal-consent-title" className="text-2xl">
              {multiple ? "Please review our updated policies" : "Please review our updated policy"}
            </h2>
            <p id="legal-consent-desc" className="text-gray-700 mt-2">
              Before you continue using Barefoot Bay, read and accept the current version of
              {multiple ? " each policy listed below." : " the policy below."} Check each box separately.
            </p>
          </div>

          <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7 space-y-4">
            {notice && (
              <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900" data-testid="text-consent-notice">
                {notice}
              </div>
            )}
            {outstanding.map((p) => {
              const open = expanded === p.key;
              const checked = selections[p.key] === p.versionId;
              const inputId = `consent-${p.key}`;
              return (
                <section key={p.key} className="rounded-lg border border-slate-200" data-testid={`consent-policy-${p.key}`}>
                  <div className="p-4">
                    <h3 className="text-lg">{p.title}</h3>
                    <p className="text-sm text-gray-600">
                      Version {p.versionId} &middot; Published {formatPolicyDate(p.publishedAt)}
                    </p>
                    {p.changeNotes && <p className="text-sm text-gray-800 mt-2"><span className="font-semibold">What changed:</span> {p.changeNotes}</p>}
                    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 text-sm">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-medium text-sky-700 hover:underline"
                        aria-expanded={open}
                        aria-controls={`consent-text-${p.key}`}
                        onClick={() => setExpanded(open ? null : p.key)}
                        data-testid={`button-read-${p.key}`}
                      >
                        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        {open ? "Hide full text" : "Read full text"}
                      </button>
                      <a
                        href={LEGAL_POLICY_PATHS[p.key]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sky-700 hover:underline"
                        data-testid={`link-open-${p.key}`}
                      >
                        Open in new tab <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                  {open && (
                    <div id={`consent-text-${p.key}`} className="max-h-[45vh] overflow-y-auto border-t bg-slate-50 px-4 py-4" tabIndex={0}>
                      <PolicyDocument policy={p} showHeader={false} />
                    </div>
                  )}
                  <label htmlFor={inputId} className="flex items-start gap-3 border-t px-4 py-3 cursor-pointer hover:bg-slate-50">
                    <input
                      id={inputId}
                      type="checkbox"
                      className="mt-1 h-5 w-5 accent-sky-700"
                      checked={checked}
                      onChange={(e) =>
                        setSelections((cur) => {
                          const next = { ...cur };
                          if (e.target.checked) next[p.key] = p.versionId;
                          else delete next[p.key];
                          return next;
                        })
                      }
                      data-testid={`checkbox-consent-${p.key}`}
                    />
                    <span className="text-sm text-gray-900">
                      I have read and accept the {p.title} (version {p.versionId}).
                    </span>
                  </label>
                </section>
              );
            })}

            {accept.isError && !isPolicyStaleError(accept.error) && (
              <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {accept.error.message} Your acceptance was not recorded. Please try again.
              </div>
            )}
          </div>

          <div className="shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t px-5 py-4 sm:px-7">
            <Button onClick={submit} disabled={!acceptances || accept.isPending} className="sm:order-last" data-testid="button-consent-accept">
              {accept.isPending ? (
                <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Saving...</span>
              ) : "Accept and continue"}
            </Button>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <Link href="/copyright-notices" className="text-center text-sm font-medium text-sky-700 underline py-2" data-testid="link-prompt-copyright-notices">
                Copyright notices
              </Link>
              <button type="button" className="text-sm text-slate-600 underline py-2" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending} data-testid="button-consent-signout">
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Global consent gate. For signed-in users, ordinary app children are not
 * mounted until the server confirms current acceptance. Legal reading,
 * recovery, and statutory copyright routes stay available.
 */
export function LegalConsentGate({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const rawId = (user as any)?.id;
  const userId: number | null = typeof rawId === "number" ? rawId : null;
  const signedIn = userId !== null;
  const consent = useLegalConsent(userId);
  const refetchRef = useRef(consent.refetch);
  refetchRef.current = consent.refetch;

  // Results older than this timestamp do not count as current consent.
  const [freshAfter, setFreshAfter] = useState(Infinity);
  const [authorizedUser, setAuthorizedUser] = useState<number | null>(null);

  // Mark stale synchronously during the render that sees a new location or
  // identity, so no commit shows children against an older result.
  const navKey = `${userId ?? "anon"}|${location}`;
  const [seenNavKey, setSeenNavKey] = useState(navKey);
  if (seenNavKey !== navKey) {
    if (seenNavKey.split("|")[0] !== navKey.split("|")[0]) setAuthorizedUser(null);
    setSeenNavKey(navKey);
    setFreshAfter(Infinity);
  }

  const rechecks = useMemo(() => createLegalRecheckBatcher(
    // Keep old children inert even if an earlier request completes while the
    // clustered focus/visibility signals are waiting to start their check.
    () => setFreshAfter(Infinity),
    async () => {
      // Explicit cancellation also handles an initial request without cached
      // data, where refetch's cancelRefetch alone would reuse the old promise.
      await queryClient.cancelQueries({ queryKey: LEGAL_QUERY_KEYS.consent(userId), exact: true });
      return refetchRef.current({ cancelRefetch: true });
    },
    setFreshAfter,
  ), [queryClient, userId]);
  useEffect(() => () => rechecks.dispose(), [rechecks]);
  const requireFresh = useCallback(() => rechecks.request(), [rechecks]);

  useLegalTabSync(requireFresh);

  // Navigation and identity change require a fresh check.
  useEffect(() => {
    if (signedIn) requireFresh();
  }, [location, userId, signedIn, requireFresh]);

  // Returning to the tab requires a fresh check.
  useEffect(() => {
    if (!signedIn) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") requireFresh();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [signedIn, requireFresh]);

  // Policy-required response from any caller: block until a fresh check succeeds.
  useEffect(() => {
    const onRequired = () => {
      queryClient.invalidateQueries({ queryKey: LEGAL_QUERY_KEYS.policies });
      requireFresh();
    };
    window.addEventListener(LEGAL_REQUIRED_EVENT, onRequired);
    return () => window.removeEventListener(LEGAL_REQUIRED_EVENT, onRequired);
  }, [queryClient, requireFresh]);

  const exempt = useMemo(() => isConsentExemptPath(location), [location]);
  const decision = decideGate({
    signedIn,
    exempt,
    authLoading,
    isError: consent.isError,
    status: consent.isPlaceholderData ? undefined : consent.data,
    dataUpdatedAt: consent.dataUpdatedAt,
    freshAfter,
  });

  // Only retain content that this gate has actually authorized for this
  // account. A cached acceptance from another mount is not an initial grant.
  if (decision === "children" && signedIn && !exempt && authorizedUser !== userId) {
    setAuthorizedUser(userId);
  }
  if (!signedIn && authorizedUser !== null) setAuthorizedUser(null);
  const verifying = decision === "verifying";

  if (decision === "skeleton" || (verifying && authorizedUser !== userId)) return <GateInitialCheck />;
  if (decision === "error") {
    const incomplete = !consent.isError;
    return (
      <GateError
        message={incomplete ? "Your policy status is incomplete." : (consent.error as Error)?.message || "Something went wrong."}
        onRetry={requireFresh}
        retrying={consent.isFetching}
      />
    );
  }
  if (decision === "prompt" && consent.data) {
    return <ConsentPrompt key={userId} outstanding={consent.data.outstanding} onRecheck={requireFresh} userId={userId} />;
  }

  const showBanner = signedIn && exempt && consent.data?.requiresAcceptance && !consent.isError;
  return (
    <>
      {showBanner && (
        <div className="relative z-20 bg-amber-100 text-amber-900 text-sm px-4 py-2 text-center" role="status">
          You have policies to review. Normal site features resume after you accept them.{" "}
          <Link href="/" className="font-semibold underline">Review now</Link>
        </div>
      )}
      <div key={userId ?? "anon"} inert={verifying} aria-hidden={verifying || undefined} data-testid="legal-gate-content">
        {children}
      </div>
      {verifying && (
        <LegalCheckStatus overlay />
      )}
    </>
  );
}
