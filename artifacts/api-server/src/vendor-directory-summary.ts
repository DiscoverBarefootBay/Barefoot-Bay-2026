/** Pure summary projection. Inputs MUST already have passed the viewer policy. */
export interface DirectoryCategory { slug: string; name: string; isHidden?: boolean }
export interface DirectoryPage {
  slug: string; title: string; content: string | null; isHidden?: boolean;
  createdAt?: Date | string | null; contentVisibility?: { removed?: boolean; status?: string };
}

function categoryPart(slug: string, categories: DirectoryCategory[]) {
  if (slug.includes(" ")) return slug.substring(8, slug.indexOf(" "));
  const parts = slug.split("-");
  const possible: string[] = [];
  for (let i = 2; i <= Math.min(parts.length - 1, 6); i++) possible.push(parts.slice(1, i).join("-"));
  const exact = categories.find(c => possible.includes(c.slug));
  if (exact) return exact.slug;
  for (const value of possible) {
    const alias = categories.find(c => c.slug === value.replace("-and-", "-"));
    if (alias) return alias.slug;
  }
  return parts.length >= 3 ? parts[1] : "";
}

/** Preserve the main directory's multiple-category membership and legacy names. */
export function vendorMatchesCategory(slug: string, category: string, categories: DirectoryCategory[], part = categoryPart(slug, categories)) {
  if (!slug.startsWith("vendors-") || slug === "vendors-main" ||
    categories.some(c => slug === `vendors-${c.slug}`)) return false;
  return part === category || slug.includes(`-${category}-`) || slug.startsWith(`vendors-${category}-`) ||
    (category === "home-services" && ["home-service", "homeservices"].includes(part)) ||
    (category === "food-dining" && ["food", "dining"].includes(part)) ||
    (category === "professional-services" && part === "professional");
}

/** Category pages historically have a narrower, different membership predicate. */
export function vendorMatchesCategoryPage(slug: string, category: string) {
  if (slug.split("-").length < 3 || !slug.startsWith("vendors-") || slug === `vendors-${category}`) return false;
  return slug.startsWith(`vendors-${category}-`) || slug.startsWith(`vendors-${category} `) ||
    (["home-service", "home-services"].includes(category) &&
      ["home-service", "home-services", "homeservice", "homeservices"].some(alias =>
        slug.startsWith(`vendors-${alias}-`) || slug.startsWith(`vendors-${alias} `))) ||
    slug.startsWith(`vendors-${category.replace("-", "-and-")}-`) ||
    slug.startsWith(`vendors-${category.replace("-", "-and-")} `);
}

export function directoryVendorName(slug: string, categories: DirectoryCategory[]) {
  if (slug === "vendors-landscaping-tst vendor") return "tst vendor";
  if (slug.includes(" ")) return slug.substring(slug.indexOf(" ") + 1);
  const parts = slug.split("-");
  const match = categories.find(c => parts.slice(1, 1 + c.slug.split("-").length).join("-") === c.slug);
  return parts.slice(match ? 1 + match.slug.split("-").length : 2).join("-");
}

export function projectVendorDirectory(pages: DirectoryPage[], categories: DirectoryCategory[]) {
  // Parse/normalize summary fields once per page, not per category membership.
  const summaries = pages.map(page => {
      const name = directoryVendorName(page.slug, categories);
      const html = page.content ?? "";
      const description = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
        .replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
        .replace(/\s+/g, " ").trim().substring(0, 220);
      const rawImage = html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? null;
      // No executable URLs or inline base64 detail payloads in card thumbnails.
      const image = rawImage && /^(https?:\/\/|\/(?!\/)|[a-z0-9._-][^:]*(?:$))/i.test(rawImage) ? rawImage : null;
      return { name, part: categoryPart(page.slug, categories), card: {
        slug: page.slug, title: page.title || name.split(/[-\s]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
        description, image,
        isHidden: !!page.isHidden,
        createdAt: page.createdAt ? new Date(page.createdAt).toISOString() : null,
        ...(page.contentVisibility ? { contentVisibility: {
          removed: page.contentVisibility.removed, status: page.contentVisibility.status,
        } } : {}),
      }};
  });
  const vendors = categories.flatMap(category => summaries.flatMap(({ card, name, part }) => {
    const showInDirectory = vendorMatchesCategory(card.slug, category.slug, categories, part);
    const showInCategory = vendorMatchesCategoryPage(card.slug, category.slug);
    if (!showInDirectory && !showInCategory) return [];
    return [{
      ...card, href: `/vendors/${category.slug}/${encodeURIComponent(name)}`,
      categorySlug: category.slug, categoryLabel: category.name, showInDirectory, showInCategory,
    }];
  }));
  return { vendors, categories: categories.map(c => ({ slug: c.slug, label: c.name })) };
}
