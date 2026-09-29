import { formatPolicyDate, type LegalPolicy } from "@/lib/legal";

/**
 * Renders one immutable published policy snapshot. The same component is
 * used by public pages, signup dialogs, and the returning-user prompt so the
 * text is identical everywhere.
 */
export function PolicyVersionMeta({ policy }: { policy: LegalPolicy }) {
  return (
    <p className="text-sm text-gray-600" data-testid={`text-policy-version-${policy.key}`}>
      Version {policy.versionId} &middot; Published {formatPolicyDate(policy.publishedAt)}
    </p>
  );
}

export function PolicyDocument({ policy, showHeader = true }: { policy: LegalPolicy; showHeader?: boolean }) {
  return (
    <article className="max-w-none" data-testid={`policy-document-${policy.key}`}>
      {showHeader && (
        <header className="mb-6 border-b pb-4">
          <h1 className="text-3xl sm:text-4xl mb-2">{policy.title}</h1>
          <PolicyVersionMeta policy={policy} />
        </header>
      )}
      {policy.changeNotes && (
        <div className="mb-6 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <span className="font-semibold">What changed: </span>
          {policy.changeNotes}
        </div>
      )}
      <div
        className="prose prose-sm sm:prose-base max-w-none rich-text"
        dangerouslySetInnerHTML={{ __html: policy.contentHtml }}
      />
    </article>
  );
}

export function PolicySkeleton() {
  return (
    <div className="space-y-3 animate-pulse" aria-busy="true" aria-label="Loading policy">
      <div className="h-8 w-2/3 rounded bg-slate-200" />
      <div className="h-4 w-1/3 rounded bg-slate-200" />
      <div className="h-4 w-full rounded bg-slate-100 mt-6" />
      <div className="h-4 w-full rounded bg-slate-100" />
      <div className="h-4 w-5/6 rounded bg-slate-100" />
      <div className="h-4 w-4/6 rounded bg-slate-100" />
    </div>
  );
}
