import { useState } from "react";
import { Button } from "@/components/ui/button";
import { VendorBrowse } from "./vendor-browse";
import { VendorsLoading } from "./vendors-loading";
import { useVendorDirectory } from "./use-vendor-directory";

export function AllVendorsPage() {
  const [category, setCategory] = useState<string | null>(null);
  const directory = useVendorDirectory();
  if (!directory.data && !directory.isError) return <VendorsLoading />;
  const error = directory.isError && <div role="alert" data-testid="status-vendors-error" className="mb-4 rounded-lg border p-4">
    <p>{directory.data ? "Unable to refresh vendors. The last loaded directory is still shown." : directory.error?.message ?? "Unable to load vendors. Please try again."}</p>
    <Button data-testid="button-retry-vendors" disabled={directory.isFetching} onClick={() => directory.refetch()}>Try again</Button>
  </div>;
  return <div>
    {error}
    {directory.badgeError && <p className="text-sm text-navy/70 mb-2">New-vendor badges are temporarily unavailable.</p>}
    {directory.data && <VendorBrowse
      deferOffscreenLayout
      vendors={directory.items} categories={directory.data.categories}
      selectedCategorySlug={directory.data.categories.some(c => c.slug === category) ? category : null}
      onCategoryChange={setCategory} showAdminBadge={directory.isAdmin}
    />}
  </div>;
}
