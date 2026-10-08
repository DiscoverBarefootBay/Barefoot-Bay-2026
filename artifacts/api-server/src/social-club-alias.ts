import { isPubliclyVisible } from "./dmca/content-visibility";

export interface ClubIdentity {
  id: number;
  slug: string;
  title: string;
  isHidden?: boolean;
  visibilityStatus?: string;
}

// The imported placeholder address was reused by several different clubs.
// Never merge ordinary named club slugs merely because their titles coincide.
export const LEGACY_CLUB_SLUG = "social-page";
export const ORIGINAL_GOLF_CART_SLUG = "social-golf-cart-club";
// Confirmed by read-only live record/version/reference inspection. Stable IDs
// retain this relationship through title/slug edits without merging other clubs.
const LEGACY_GOLF_CART_ID = 397;
const GOLF_CART_CLUB_ID = 447;

export function isLegacyGolfCartPage(page: ClubIdentity) {
  return page.id === LEGACY_GOLF_CART_ID && page.slug === LEGACY_CLUB_SLUG;
}

export function golfCartTarget<T extends ClubIdentity>(identities: readonly T[]): T | undefined {
  return identities.find(p => p.id === GOLF_CART_CLUB_ID && p.slug.startsWith("social-") && p.slug !== LEGACY_CLUB_SLUG);
}

export function legacyClubTarget<T extends ClubIdentity>(legacy: ClubIdentity, identities: readonly T[]): T | undefined {
  return isLegacyGolfCartPage(legacy) ? golfCartTarget(identities) : undefined;
}

export function withoutLegacyClubAlias<T extends ClubIdentity>(pages: readonly T[], identities: readonly ClubIdentity[] = pages): T[] {
  // Identities include hidden/taken-down targets: hiding the real club must
  // not resurrect the old placeholder as a public copy of that club.
  const reservedAlias = identities.some(isLegacyGolfCartPage);
  return pages.filter(p => !isLegacyGolfCartPage(p) && !(reservedAlias && p.slug === LEGACY_CLUB_SLUG));
}

export function publicClubChoices(identities: readonly ClubIdentity[]) {
  const legacy = identities.find(p => p.slug === LEGACY_CLUB_SLUG);
  const target = golfCartTarget(identities);
  return withoutLegacyClubAlias(identities)
    .filter(p => !p.isHidden && isPubliclyVisible(p))
    .map(({ id, slug, title }) => {
      const aliases = target?.id === id ? [
        ...(slug !== ORIGINAL_GOLF_CART_SLUG ? [ORIGINAL_GOLF_CART_SLUG] : []),
        // These are saved preference values, not extra visible clubs. Retain
        // compatibility even if staff later hide/delete the legacy record.
        ...(!legacy || isLegacyGolfCartPage(legacy) ? [LEGACY_CLUB_SLUG] : []),
      ] : [];
      return { id, slug, title, ...(aliases.length ? { aliases } : {}) };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}
