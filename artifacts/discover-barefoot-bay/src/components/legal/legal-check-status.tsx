import { type ReactNode } from "react";

/** Loading content only; the gate keeps the shared navigation mounted above it. */
export function LegalCheckShell({ children }: { children: ReactNode }) {
  return (
    <main className="container mx-auto px-4 py-4 md:py-8" data-testid="legal-check-shell">
      {children}
    </main>
  );
}

/** Silent visual feedback; preserve accessible status and the interaction blocker. */
export function LegalCheckStatus({ overlay = false }: { overlay?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid={overlay ? "legal-gate-verifying" : "legal-gate-initial-check"}
      className={overlay ? "fixed inset-0 z-[999] cursor-wait" : "min-h-12 flex justify-center"}
    >
      <span className="sr-only">Loading</span>
    </div>
  );
}