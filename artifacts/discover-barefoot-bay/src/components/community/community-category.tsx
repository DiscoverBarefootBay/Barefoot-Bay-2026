import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Skeleton } from '@/components/ui/skeleton';
import type { CommunityCard } from '@workspace/api-client-react';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import {
  VendorBrowse,
  type VendorBrowseCategory,
  type VendorBrowseLabels,
  type VendorItem,
} from '@/components/vendors/vendor-browse';

interface CommunityCategoryPageProps {
  category: string;
}

interface CommunityCategory {
  id: number;
  slug: string;
  name: string;
}

const COMMUNITY_VIEW_STORAGE_KEY = 'community-view';

const COMMUNITY_LABELS: VendorBrowseLabels = {
  searchPlaceholder: 'Search pages…',
  searchAriaLabel: 'Search pages',
  emptySearchTitle: 'No pages match your search',
  emptySearchBody: 'Try a different word or clear the search to see all pages.',
  emptyTitle: 'No pages found in this category',
  emptyBody: 'Please check back later.',
};

function titleCaseSlug(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** The URL segment used for a community category (matches nav-bar/mobile-menu). */
function categoryRouteSegment(slug: string): string {
  return slug.split('-')[0];
}

export const CommunityCategoryPage: React.FC<CommunityCategoryPageProps> = ({ category }) => {
  const { isAdmin } = usePermissions();
  const { user, effectiveRole } = useAuth();
  const [, navigate] = useLocation();

  const { data: cards, isLoading, error, refetch } = useQuery<CommunityCard[]>({
    queryKey: ['/api/community-directory', { category, userId: user?.id ?? null, role: effectiveRole }],
    placeholderData: undefined,
    queryFn: async ({ signal }) => {
      const url = `/api/community-directory?category=${encodeURIComponent(category)}&includeHidden=${isAdmin}`;
      const res = await fetch(url, { credentials: 'include', signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) });
      if (!res.ok) throw new Error('Failed to fetch pages');
      const result = await res.json();
      if (!Array.isArray(result)) throw new Error('Invalid Community directory response');
      return result;
    },
  });

  // Community categories drive the category dropdown
  const { data: communityCategories } = useQuery<CommunityCategory[]>({
    queryKey: ['/api/community-categories', { userId: user?.id ?? null, role: effectiveRole }],
    placeholderData: undefined,
  });

  // Dropdown options: one per community category, keyed by its URL segment
  // (nav-bar and mobile-menu build /community/<segment> links the same way)
  const dropdownCategories = useMemo<VendorBrowseCategory[]>(() => {
    if (!Array.isArray(communityCategories)) return [];
    const seen = new Set<string>();
    const options: VendorBrowseCategory[] = [];
    communityCategories.forEach(cat => {
      const segment = categoryRouteSegment(cat.slug);
      if (seen.has(segment)) return;
      seen.add(segment);
      options.push({ slug: segment, label: cat.name });
    });
    // Make sure the current category is always selectable even if it isn't in
    // the managed category list (legacy/ad-hoc categories)
    if (!seen.has(category)) {
      options.push({ slug: category, label: titleCaseSlug(category) });
    }
    return options;
  }, [communityCategories, category]);

  const categoryLabel = useMemo(() => {
    const match = dropdownCategories.find(c => c.slug === category);
    return match?.label ?? titleCaseSlug(category);
  }, [dropdownCategories, category]);

  // Map this category's pages to browse items
  const items = useMemo<VendorItem[]>(() => {
    return (cards ?? []).map(page => ({
      ...page, categorySlug: category, categoryLabel, isUnvisited: false,
    }));
  }, [cards, category, categoryLabel]);

  if (error) return (
    <div role="alert" className="py-8 text-center">
      <p>We couldn't load Community pages.</p>
      <button onClick={() => void refetch()} className="mt-3 underline text-ocean">Try again</button>
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          <Skeleton className="h-10 flex-1 sm:mr-auto" />
          <Skeleton className="h-10 w-24 sm:hidden" />
          <Skeleton className="h-10 w-[130px] hidden sm:block" />
          <Skeleton className="h-10 w-[200px] hidden sm:block" />
          <Skeleton className="h-10 w-[180px] hidden sm:block" />
        </div>
        <Skeleton className="h-[128px] rounded-xl" />
        <Skeleton className="h-[128px] rounded-xl" />
        <Skeleton className="h-[128px] rounded-xl" />
      </div>
    );
  }

  return (
    <VendorBrowse
      vendors={items}
      categories={dropdownCategories}
      selectedCategorySlug={category}
      onCategoryChange={slug => {
        if (slug && slug !== category) navigate(`/community/${slug}`);
      }}
      showAdminBadge={isAdmin}
      storageKey={COMMUNITY_VIEW_STORAGE_KEY}
      labels={COMMUNITY_LABELS}
      // No bare /community landing exists, so the dropdown only navigates
      // between real category routes
      includeAllCategories={false}
    />
  );
};
