import { useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { VendorBrowse } from "./vendor-browse";
import { VendorsLoading } from "./vendors-loading";
import { useVendorDirectory } from "./use-vendor-directory";
import { vendorCategoryHref } from "@/lib/vendor-category-url";

export function VendorCategoryPage({ category }: { category: string }) {
  const [location, navigate] = useLocation();
  const actualCategory = category?.trim() || location.split("/").filter(Boolean)[1] || "";
  const directory = useVendorDirectory();
  const label = directory.data?.categories.find(c => c.slug === actualCategory)?.label ??
    actualCategory.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const items = useMemo(() => directory.allItems.filter(v => v.categorySlug === actualCategory && v.showInCategory)
    .map(v => ({ ...v, href: vendorCategoryHref(v.slug, actualCategory),
      title: v.slug === "vendors-technology-and-electronics-computer-healthcare" ? "Computer Healthcare" : v.title })),
  [directory.allItems, actualCategory]);
  if (!directory.data && !directory.isError) return <VendorsLoading />;
  return <div className="space-y-4">
    <h2 className="text-lg font-bold text-navy capitalize">{label} Vendors</h2>
    {directory.isError && <div role="alert" data-testid="status-vendors-error">
      <p>{directory.data ? "Unable to refresh vendors. The last loaded directory is still shown." : directory.error?.message ?? "Unable to load vendors. Please try again."}</p>
      <Button data-testid="button-retry-vendors" onClick={() => directory.refetch()} disabled={directory.isFetching}>Try again</Button>
    </div>}
    {directory.data && <VendorBrowse deferOffscreenLayout vendors={items} categories={directory.data.categories}
      selectedCategorySlug={actualCategory} onCategoryChange={slug => navigate(slug ? `/vendors/${slug}` : "/vendors")}
      showAdminBadge={directory.isAdmin} />}
  </div>;
}
