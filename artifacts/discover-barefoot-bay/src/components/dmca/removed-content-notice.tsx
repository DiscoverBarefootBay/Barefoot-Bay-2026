import { Copyright } from "lucide-react";
import { Link } from "wouter";

type Visibility = { removed?: boolean; status?: string } | null | undefined;

export function RemovedContentNotice({ contentVisibility, compact = false }: { contentVisibility: Visibility; compact?: boolean }) {
  if (!contentVisibility?.removed) return null;
  return (
    <div className={`rounded-md border border-red-300 bg-red-50 text-red-900 ${compact ? "mb-2 px-3 py-2 text-xs" : "mb-4 p-4"}`} role="status" data-testid="status-content-removed">
      <p className="flex items-center gap-2 font-semibold"><Copyright className="h-4 w-4 shrink-0" />Removed due to a copyright notice — only you can see this</p>
      <Link href="/copyright-notices" className="mt-1 inline-block underline" data-testid="link-removed-content-notices">View Copyright Notices</Link>
    </div>
  );
}