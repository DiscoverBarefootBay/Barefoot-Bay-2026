import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Skeleton } from '@/components/ui/skeleton';
import type { PageContent } from '@shared/schema';
import { usePermissions } from '@/hooks/use-permissions';
import {
  VendorBrowse,
  vendorDescriptionSnippet,
  vendorFirstImage,
  type VendorBrowseCategory,
  type VendorBrowseLabels,
  type VendorItem,
} from '@/components/vendors/vendor-browse';
import {
  communityPageHref,
  communityPageMatchesCategory,
  communityPageName,
  type CommunityPageLike,
} from '@/components/community/community-page-links';

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
  const [, navigate] = useLocation();

  // Query for all pages to find pages in this community category
  const { data: allPages, isLoading } = useQuery<PageContent[]>({
    queryKey: ['/api/pages'],
    queryFn: async () => {
      // Fetch pages with includeHidden parameter for admins
      const url = isAdmin ? '/api/pages?includeHidden=true' : '/api/pages';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch pages');
      return res.json();
    },
  });

  // Community categories drive the category dropdown
  const { data: communityCategories } = useQuery<CommunityCategory[]>({
    queryKey: ['/api/community-categories'],
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
    if (!Array.isArray(allPages)) return [];
    return allPages
      .filter(page => communityPageMatchesCategory(page as CommunityPageLike, category))
      .map(page => {
        const pageName = communityPageName(page.slug, category);
        const title = page.title || titleCaseSlug(pageName);
        return {
          slug: page.slug,
          title,
          description: vendorDescriptionSnippet(page.content),
          // Canonical community URL that round-trips GenericContentPage's
          // slug derivation (the old /more/… links just redirect here)
          href: communityPageHref(page.slug, category),
          image: vendorFirstImage(page.content),
          categorySlug: category,
          categoryLabel,
          isUnvisited: false,
          isHidden: !!page.isHidden,
          createdAt: page.createdAt ?? null,
          contentVisibility: (page as any).contentVisibility,
        };
      });
  }, [allPages, category, categoryLabel]);

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
