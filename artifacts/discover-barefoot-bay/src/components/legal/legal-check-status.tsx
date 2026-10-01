import { useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { Loader2 } from "lucide-react";

/** Public branding only: no account, mailbox, or permission-bound queries. */
export function LegalCheckShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-white" data-testid="legal-check-shell">
      <header className="container mx-auto flex items-center justify-between gap-4 px-4 py-4">
        <img src={`${import.meta.env.BASE_URL}assets/DiscoverBFBText.png`} alt="Discover Barefoot Bay" className="h-16 md:h-24 w-auto" />
        <nav aria-label="Policy information" className="flex flex-wrap justify-end gap-x-4 gap-y-2 text-sm text-slate-600">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/copyright-notices">Copyright notices</Link>
        </nav>
      </header>
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}

/** Delays feedback, never the request or access once a check finishes. */
export function LegalCheckStatus({ overlay = false }: { overlay?: boolean }) {
  const [noticeable, setNoticeable] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setNoticeable(true), 180);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid={overlay ? "legal-gate-verifying" : "legal-gate-initial-check"}
      className={overlay ? "fixed inset-0 z-[999] cursor-wait" : "min-h-12 flex justify-center"}
    >
      <span className="sr-only">Checking your account status</span>
      {noticeable && (
        <div className={overlay
          ? "absolute left-1/2 top-24 -translate-x-1/2 flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm text-slate-600 shadow-sm"
          : "flex items-center gap-2 text-sm text-slate-600"}>
          <Loader2 aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />
          <span aria-hidden="true">Checking your account…</span>
        </div>
      )}
    </div>
  );
}