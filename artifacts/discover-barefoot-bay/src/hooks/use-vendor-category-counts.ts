import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

interface VendorCategory {
  id: number;
  name: string;
  slug: string;
  order: number;
  isHidden?: boolean;
}

interface VendorCategoryCountsResult {
  countsByCategory: Record<string, number>;
  totalUnvisited: number;
  isLoading: boolean;
}

export function useVendorCategoryCounts(): VendorCategoryCountsResult {
  const { user } = useAuth();

  const { data: unvisitedVendorsData, isLoading: unvisitedLoading } = useQuery<{ unvisitedSlugs: string[] }>({
    queryKey: ['/api/vendors/unvisited'],
    queryFn: async () => {
      const response = await fetch("/api/vendors/unvisited", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch unvisited vendors");
      }
      return response.json();
    },
    enabled: !!user,
    refetchInterval: 30000,
    staleTime: 10000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 2,
  });

  const { data: vendorCategories, isLoading: categoriesLoading } = useQuery<VendorCategory[]>({
    queryKey: ['/api/vendor-categories'],
    staleTime: 1000 * 60,
  });

  const countsByCategory: Record<string, number> = {};
  const unvisitedSlugs = unvisitedVendorsData?.unvisitedSlugs || [];
  const categorySlugs = (vendorCategories || []).map(c => c.slug).sort((a, b) => b.length - a.length);

  for (const slug of unvisitedSlugs) {
    const categorySlug = extractCategoryFromVendorSlug(slug, categorySlugs);
    if (categorySlug) {
      countsByCategory[categorySlug] = (countsByCategory[categorySlug] || 0) + 1;
    }
  }

  return {
    countsByCategory,
    totalUnvisited: unvisitedSlugs.length,
    isLoading: unvisitedLoading || categoriesLoading,
  };
}

function extractCategoryFromVendorSlug(slug: string, categorySlugs: string[]): string | null {
  if (!slug.startsWith('vendors-')) {
    return null;
  }

  const withoutPrefix = slug.substring('vendors-'.length);

  for (const categorySlug of categorySlugs) {
    if (withoutPrefix.startsWith(categorySlug + '-') || withoutPrefix.startsWith(categorySlug + ' ')) {
      return categorySlug;
    }
    if (withoutPrefix === categorySlug) {
      return null;
    }
  }

  return null;
}
