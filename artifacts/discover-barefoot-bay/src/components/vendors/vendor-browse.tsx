import { useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowUpDown,
  Columns2,
  EyeOff,
  LayoutGrid,
  Rows2,
  Search,
  Store,
  Tag,
  X,
} from "lucide-react";
import bfbLogo from "@assets/image_1784954979351.png";

export interface VendorItem {
  slug: string;
  /** Display name */
  title: string;
  /** Plain-text description snippet (HTML already stripped) */
  description: string;
  /** Detail-page URL */
  href: string;
  /** First image found in the vendor's content, if any */
  image: string | null;
  categorySlug: string;
  categoryLabel: string;
  isUnvisited: boolean;
  isHidden: boolean;
  createdAt: string | Date | null;
}

export interface VendorBrowseCategory {
  slug: string;
  label: string;
}

type VendorView = "grid" | "dual" | "single";

const VENDOR_VIEW_STORAGE_KEY = "vendors-view";

const VENDOR_VIEW_CLASSES: Record<VendorView, string> = {
  grid: "grid grid-cols-1 md:grid-cols-3 gap-6",
  dual: "grid grid-cols-1 md:grid-cols-2 gap-6",
  single: "grid grid-cols-1 gap-4",
};

function loadStoredVendorView(): VendorView {
  try {
    const stored = window.localStorage.getItem(VENDOR_VIEW_STORAGE_KEY);
    if (stored === "grid" || stored === "dual" || stored === "single") return stored;
  } catch {
    // localStorage unavailable — fall back to default
  }
  return "single";
}

type VendorSort = "name_asc" | "name_desc" | "newest_added" | "oldest_added";

function vendorTime(v: VendorItem): number {
  if (!v.createdAt) return 0;
  const t = new Date(v.createdAt).getTime();
  return Number.isFinite(t) ? t : 0;
}

function VendorImage({ vendor, className }: { vendor: VendorItem; className?: string }) {
  return vendor.image ? (
    <img
      src={vendor.image}
      alt=""
      loading="lazy"
      className={className ?? "absolute inset-0 h-full w-full object-cover"}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  ) : (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-ocean/20 to-navy/10">
      <img
        src={bfbLogo}
        alt="Discover Barefoot Bay"
        loading="lazy"
        className="max-h-[70%] max-w-[70%] object-contain opacity-90"
      />
    </div>
  );
}

function VendorBadges({ vendor, showAdminBadge }: { vendor: VendorItem; showAdminBadge: boolean }) {
  if (!vendor.isHidden || !showAdminBadge) return null;
  return (
    <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-300 w-fit">
      <EyeOff className="h-3 w-3 mr-1" />
      Admin Only
    </Badge>
  );
}

function VendorCard({ vendor, showAdminBadge }: { vendor: VendorItem; showAdminBadge: boolean }) {
  return (
    <Link href={vendor.href}>
      <Card
        className={`h-full flex flex-col cursor-pointer transition-all hover:shadow-lg bg-white relative ${
          vendor.isUnvisited
            ? "border-red-500 border-[3px] shadow-lg ring-2 ring-red-300"
            : "border-navy/10"
        }`}
        data-testid={`vendor-card-${vendor.slug}`}
      >
        {vendor.isUnvisited && (
          <div className="absolute -top-2 -right-2 z-10 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
            New
          </div>
        )}
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-navy/5 rounded-t-lg">
          <VendorImage vendor={vendor} className="h-full w-full object-cover transition-transform duration-300 hover:scale-105" />
        </div>
        <CardContent className="flex flex-col flex-1 p-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-coral mb-1.5">
            {vendor.categoryLabel}
          </span>
          <h3 className="text-lg font-bold text-navy leading-snug line-clamp-2 mb-2">{vendor.title}</h3>
          {vendor.description ? (
            <p className="text-sm text-navy/70 line-clamp-3 mb-3">{vendor.description}</p>
          ) : (
            <p className="text-sm text-navy/40 italic mb-3">No description available</p>
          )}
          <div className="mt-auto flex items-center justify-between pt-2 border-t border-navy/5">
            <VendorBadges vendor={vendor} showAdminBadge={showAdminBadge} />
            <span className="ml-auto text-xs font-semibold text-ocean">View Details →</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function HorizontalVendorCard({
  vendor,
  index,
  showAdminBadge,
}: {
  vendor: VendorItem;
  index: number;
  showAdminBadge: boolean;
}) {
  return (
    <Link href={vendor.href}>
      <div
        className="story-banner-enter group"
        style={{ "--story-index": Math.min(index, 8) } as CSSProperties}
      >
        <div
          className={`story-banner-card relative overflow-hidden rounded-xl bg-white cursor-pointer transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-0.5 border ${
            vendor.isUnvisited
              ? "border-red-500 border-2 ring-2 ring-red-300 shadow-lg"
              : "border-navy/10 hover:border-ocean/40"
          }`}
          data-testid={`vendor-banner-${vendor.slug}`}
        >
          {vendor.isUnvisited && (
            <div className="absolute top-2 right-2 z-20 bg-red-500 text-white text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full shadow-md">
              New
            </div>
          )}
          <div className="flex items-stretch min-h-[110px] sm:min-h-[128px]">
            <div className="story-banner-shine relative w-[110px] sm:w-[180px] md:w-[220px] flex-shrink-0 overflow-hidden bg-navy/5">
              <VendorImage vendor={vendor} />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20 pointer-events-none" />
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center px-3.5 sm:px-5 py-2.5 sm:py-3">
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-coral">
                  {vendor.categoryLabel}
                </span>
                <VendorBadges vendor={vendor} showAdminBadge={showAdminBadge} />
              </div>
              <h3 className="text-base sm:text-xl font-extrabold text-navy leading-snug line-clamp-2 group-hover:text-ocean transition-colors break-words [overflow-wrap:anywhere]">
                {vendor.title}
              </h3>
              {vendor.description && (
                <p className="text-xs sm:text-sm text-navy/70 line-clamp-2 mt-1">
                  {vendor.description}
                </p>
              )}
              <div className="mt-1.5 text-[11px] sm:text-xs font-semibold text-ocean">
                View Details →
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

interface VendorBrowseProps {
  vendors: VendorItem[];
  categories: VendorBrowseCategory[];
  /** null = "All Categories" */
  selectedCategorySlug: string | null;
  onCategoryChange: (slug: string | null) => void;
  /** Show "Admin Only" badges on hidden vendors (admins only) */
  showAdminBadge: boolean;
}

export function VendorBrowse({
  vendors,
  categories,
  selectedCategorySlug,
  onCategoryChange,
  showAdminBadge,
}: VendorBrowseProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<VendorView>(() => loadStoredVendorView());
  const [sortBy, setSortBy] = useState<VendorSort>("name_asc");

  const handleViewChange = (next: VendorView) => {
    setView(next);
    try {
      window.localStorage.setItem(VENDOR_VIEW_STORAGE_KEY, next);
    } catch {
      // localStorage unavailable — preference just won't persist
    }
  };

  const filteredVendors = useMemo(() => {
    let list = vendors;
    if (selectedCategorySlug) {
      list = list.filter((v) => v.categorySlug === selectedCategorySlug);
    }
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.slug.toLowerCase().includes(q) ||
          v.categoryLabel.toLowerCase().includes(q),
      );
    }
    const sorted = [...list];
    switch (sortBy) {
      case "name_desc":
        sorted.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case "newest_added":
        sorted.sort((a, b) => vendorTime(b) - vendorTime(a));
        break;
      case "oldest_added":
        sorted.sort((a, b) => vendorTime(a) - vendorTime(b));
        break;
      default:
        sorted.sort((a, b) => a.title.localeCompare(b.title));
    }
    return sorted;
  }, [vendors, selectedCategorySlug, searchQuery, sortBy]);

  return (
    <div>
      {/* Search + View toggle + Category + Sort — mirrors the Extra!! toolbar */}
      <div className="mb-6 flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
        <div className="relative w-full sm:flex-1 sm:mr-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy/40 pointer-events-none" />
          <Input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search vendors…"
            aria-label="Search vendors"
            data-testid="input-vendor-search"
            className="pl-9 pr-8 border-navy/20 bg-white"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              data-testid="button-clear-vendor-search"
              onClick={() => {
                setSearchQuery("");
                searchInputRef.current?.focus();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-navy/50 hover:text-navy hover:bg-navy/5"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-sm text-navy/70 font-medium">View as:</span>
          <div
            role="group"
            aria-label="View as"
            className="inline-flex rounded-md border border-navy/20 bg-white overflow-hidden"
          >
            <button
              type="button"
              aria-label="Grid view (3 per row)"
              aria-pressed={view === "grid"}
              title="Grid view"
              onClick={() => handleViewChange("grid")}
              data-testid="vendor-view-grid"
              className={`p-2 transition-colors ${
                view === "grid" ? "bg-navy text-white" : "text-navy/70 hover:bg-navy/5"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Dual column view"
              aria-pressed={view === "dual"}
              title="Dual column view"
              onClick={() => handleViewChange("dual")}
              data-testid="vendor-view-dual"
              className={`p-2 border-l border-navy/20 transition-colors ${
                view === "dual" ? "bg-navy text-white" : "text-navy/70 hover:bg-navy/5"
              }`}
            >
              <Columns2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Single column view"
              aria-pressed={view === "single"}
              title="Single column view"
              onClick={() => handleViewChange("single")}
              data-testid="vendor-view-single"
              className={`p-2 border-l border-navy/20 transition-colors ${
                view === "single" ? "bg-navy text-white" : "text-navy/70 hover:bg-navy/5"
              }`}
            >
              <Rows2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex flex-row gap-2 w-full sm:contents">
          <div className="flex items-center gap-2 flex-1 sm:flex-none min-w-0">
            <Tag className="h-4 w-4 text-navy/70 shrink-0" />
            <span className="text-sm text-navy/70 font-medium shrink-0">Category:</span>
            <Select
              value={selectedCategorySlug ?? "all"}
              onValueChange={(val) => onCategoryChange(val === "all" ? null : val)}
            >
              <SelectTrigger
                className="flex-1 sm:w-[200px] sm:flex-none border-navy/20 bg-white min-w-0 [&>span]:min-w-0 [&>span]:truncate [&>span]:text-left"
                data-testid="select-vendor-category"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem
                    key={category.slug}
                    value={category.slug}
                    data-testid={`vendor-category-option-${category.slug}`}
                  >
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 flex-1 sm:flex-none min-w-0">
            <ArrowUpDown className="h-4 w-4 text-navy/70 shrink-0" />
            <span className="text-sm text-navy/70 font-medium shrink-0">Sort by:</span>
            <Select value={sortBy} onValueChange={(val) => setSortBy(val as VendorSort)}>
              <SelectTrigger
                className="flex-1 sm:w-[180px] sm:flex-none border-navy/20 bg-white min-w-0 [&>span]:min-w-0 [&>span]:flex-1 [&>span]:truncate [&>span]:text-left"
                data-testid="select-vendor-sort"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name_asc" data-testid="vendor-sort-name-asc">Name A–Z</SelectItem>
                <SelectItem value="name_desc" data-testid="vendor-sort-name-desc">Name Z–A</SelectItem>
                <SelectItem value="newest_added" data-testid="vendor-sort-newest">Newest Added</SelectItem>
                <SelectItem value="oldest_added" data-testid="vendor-sort-oldest">Oldest Added</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {filteredVendors.length === 0 ? (
        <div className="text-center py-16">
          <Store className="h-12 w-12 text-navy/20 mx-auto mb-4" />
          {searchQuery.trim() ? (
            <>
              <h2 className="text-xl font-bold text-navy mb-1">No vendors match your search</h2>
              <p className="text-navy/60">Try a different word or clear the search to see all vendors.</p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-navy mb-1">No vendors found</h2>
              <p className="text-navy/60">Please check back later.</p>
            </>
          )}
        </div>
      ) : (
        <div className={VENDOR_VIEW_CLASSES[view]} data-testid="vendor-grid">
          {filteredVendors.map((vendor, index) =>
            view === "single" ? (
              <HorizontalVendorCard
                key={`${vendor.slug}:${vendor.categorySlug}`}
                vendor={vendor}
                index={index}
                showAdminBadge={showAdminBadge}
              />
            ) : (
              <VendorCard
                key={`${vendor.slug}:${vendor.categorySlug}`}
                vendor={vendor}
                showAdminBadge={showAdminBadge}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

/** Strip HTML tags and collapse whitespace into a plain-text snippet. */
export function vendorDescriptionSnippet(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 220);
}

/** Extract the first image URL from vendor page HTML content, if any. */
export function vendorFirstImage(html: string | null | undefined): string | null {
  if (!html) return null;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}
