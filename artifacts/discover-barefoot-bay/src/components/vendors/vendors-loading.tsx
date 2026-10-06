import { Skeleton } from "@/components/ui/skeleton";

export function VendorsLoading() {
  return <div role="status" aria-label="Loading vendors" data-testid="status-vendors-loading" className="space-y-6">
    <span className="sr-only">Loading vendors…</span>
    <div className="flex gap-3">
      <Skeleton className="h-10 flex-1" /><Skeleton className="h-10 w-24" />
      <Skeleton className="h-10 w-44 hidden sm:block" />
    </div>
    {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-[130px] rounded-xl" />)}
  </div>;
}
