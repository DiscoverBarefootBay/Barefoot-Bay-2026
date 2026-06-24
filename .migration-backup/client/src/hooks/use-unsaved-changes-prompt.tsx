import { useCallback, useEffect, useRef, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface UnsavedChangesPromptOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

const DEFAULTS = {
  title: "Unsaved changes",
  description:
    "You have unsaved changes. Are you sure you want to leave this page?",
  confirmLabel: "Discard & Leave",
  cancelLabel: "Cancel",
};

type PendingNavigation = {
  replay: () => void;
};

/**
 * Warns the user before they navigate away from the current page when
 * `enabled` is true. Covers three cases:
 *
 *   1. Browser unload (tab close, refresh, navigating to an external URL)
 *      via the standard `beforeunload` event. Browsers don't allow custom UI
 *      here, so a native unsaved-changes warning is still shown.
 *   2. In-app navigation triggered by Wouter, which performs route changes by
 *      calling `history.pushState` / `history.replaceState` directly. We layer
 *      an intercept-then-replay wrapper on top of those methods so router
 *      transitions, `<Link>` clicks, and programmatic `setLocation` calls all
 *      get a styled in-app confirmation dialog. Pending navigations are
 *      queued and only committed after the admin confirms.
 *   3. Browser back / forward navigation, which fires `popstate` *after* the
 *      URL has already changed. We push the previous URL back so the admin
 *      keeps seeing the page they're trying to leave while the dialog is
 *      open, then replay the original target via `pushState` on confirm.
 *
 * The hook is a no-op while `enabled` is false, even though the wrappers stay
 * installed for the lifetime of the mounted component, so toggling between
 * dirty and clean form states is cheap.
 *
 * Returns a JSX element the caller must render in their tree to show the
 * confirmation dialog.
 */
export function useUnsavedChangesPrompt(
  enabled: boolean,
  options: UnsavedChangesPromptOptions = {},
) {
  // Refs let the long-lived listeners read the latest values without having
  // to re-install themselves every time `enabled` changes.
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // Tracks the navigation we've queued behind the dialog. `null` means no
  // pending navigation, which also drives the dialog's open state.
  const [pending, setPending] = useState<PendingNavigation | null>(null);

  // While true, the wrapped history methods bypass the prompt and pass
  // straight through to the originals. Used during replay so the confirmed
  // navigation isn't intercepted again.
  const navigationApprovedRef = useRef(false);

  useEffect(() => {
    const getCurrentUrl = () =>
      window.location.pathname + window.location.search + window.location.hash;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!enabledRef.current) return;
      event.preventDefault();
      // Required by some browsers (Chrome) to actually display the prompt;
      // the string itself is ignored in favor of a generic browser message.
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    // Capture whatever pushState / replaceState exist *now* (Wouter has
    // already monkey-patched these at module load to dispatch synthetic
    // events). Our wrapper delegates to these so Wouter's behavior is
    // preserved when the navigation is allowed to proceed.
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    type HistoryStateMethod = typeof window.history.pushState;

    const wrap = (orig: HistoryStateMethod): HistoryStateMethod =>
      function (this: History, ...args: Parameters<HistoryStateMethod>) {
        if (enabledRef.current && !navigationApprovedRef.current) {
          const targetUrl = args[2];
          const currentUrl = getCurrentUrl();
          // Only prompt when the URL is actually changing — Wouter and a few
          // other libraries call replaceState with the current URL for state
          // bookkeeping, and we don't want to nag in those cases.
          if (
            typeof targetUrl === "string" &&
            targetUrl !== "" &&
            targetUrl !== currentUrl
          ) {
            const history = this;
            // Snapshot the args so the replay performs the exact same
            // navigation (same state object, same title, same target URL).
            const snapshot = [...args] as Parameters<HistoryStateMethod>;
            setPending({
              replay: () => orig.apply(history, snapshot),
            });
            return;
          }
        }
        return orig.apply(this, args);
      } as HistoryStateMethod;

    window.history.pushState = wrap(originalPushState);
    window.history.replaceState = wrap(originalReplaceState);

    let lastUrl = getCurrentUrl();

    const trackUrl = () => {
      lastUrl = getCurrentUrl();
    };

    // Wouter dispatches these synthetic events after each successful
    // pushState / replaceState, which we use to keep `lastUrl` in sync so the
    // popstate handler can revert correctly.
    window.addEventListener("pushState", trackUrl);
    window.addEventListener("replaceState", trackUrl);

    const handlePopState = () => {
      const currentUrl = getCurrentUrl();
      if (
        enabledRef.current &&
        !navigationApprovedRef.current &&
        currentUrl !== lastUrl
      ) {
        const targetUrl = currentUrl;
        const previousUrl = lastUrl;
        // Restore the previous URL while the dialog is open so the admin
        // continues to see (and can keep editing) the page they're trying
        // to leave. Use the captured originalPushState (Wouter's wrapped
        // version, not ours) so the revert doesn't re-trigger our intercept.
        originalPushState.call(window.history, null, "", previousUrl);
        lastUrl = previousUrl;
        // On confirm, navigate to the originally-popped URL via pushState.
        // We can't reliably reproduce the exact direction of a back/forward
        // navigation asynchronously, so we add a fresh history entry; the
        // resulting URL is the same one the browser was about to land on.
        setPending({
          replay: () => {
            window.history.pushState(null, "", targetUrl);
          },
        });
        return;
      }
      lastUrl = currentUrl;
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("pushState", trackUrl);
      window.removeEventListener("replaceState", trackUrl);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  const confirmNavigation = useCallback(() => {
    setPending((current) => {
      if (!current) return null;
      navigationApprovedRef.current = true;
      try {
        current.replay();
      } finally {
        navigationApprovedRef.current = false;
      }
      return null;
    });
  }, []);

  const cancelNavigation = useCallback(() => {
    setPending(null);
  }, []);

  const title = options.title ?? DEFAULTS.title;
  const description = options.description ?? DEFAULTS.description;
  const confirmLabel = options.confirmLabel ?? DEFAULTS.confirmLabel;
  const cancelLabel = options.cancelLabel ?? DEFAULTS.cancelLabel;

  return (
    <AlertDialog
      open={pending !== null}
      onOpenChange={(open) => {
        // Treat any close (Escape key, overlay click, Cancel button) as a
        // cancellation so the queued navigation is dropped.
        if (!open) cancelNavigation();
      }}
    >
      <AlertDialogContent data-testid="dialog-unsaved-changes">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-unsaved-changes-cancel">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmNavigation}
            data-testid="button-unsaved-changes-confirm"
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
