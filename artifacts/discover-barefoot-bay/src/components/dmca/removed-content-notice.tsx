import { Copyright, EyeOff } from "lucide-react";
import { Link } from "wouter";

type Visibility = { removed?: boolean; status?: string } | null | undefined;

export function RemovedContentNotice({ contentVisibility, compact = false }: { contentVisibility: Visibility; compact?: boolean }) {
  if (!contentVisibility?.removed) return null;
  if (contentVisibility.status === "moderation_hidden") {
    return (
      <div className={`rounded-md border border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100 ${compact ? "mb-2 px-3 py-2 text-xs" : "mb-4 p-4"}`} role="status" data-testid="status-content-moderation-hidden">
        <p className="flex items-center gap-2 font-semibold"><EyeOff className="h-4 w-4 shrink-0" />Hidden by moderation — visible only to admins and moderators</p>
      </div>
    );
  }
  return (
    <div className={`rounded-md border border-red-300 bg-red-50 text-red-900 ${compact ? "mb-2 px-3 py-2 text-xs" : "mb-4 p-4"}`} role="status" data-testid="status-content-removed">
      <p className="flex items-center gap-2 font-semibold"><Copyright className="h-4 w-4 shrink-0" />Removed due to a copyright notice — only you can see this</p>
      <Link href="/copyright-notices" className="mt-1 inline-block underline" data-testid="link-removed-content-notices">View Copyright Notices</Link>
    </div>
  );
}