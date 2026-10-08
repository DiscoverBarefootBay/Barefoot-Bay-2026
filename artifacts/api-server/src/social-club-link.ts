import type { Request, Response, NextFunction } from "express";
import { isPubliclyVisible, sendContentUnavailable } from "./dmca/content-visibility";
import { readSocialClubIdentities } from "./social-club-summary";
import { golfCartTarget, isLegacyGolfCartPage, legacyClubTarget, LEGACY_CLUB_SLUG, ORIGINAL_GOLF_CART_SLUG, type ClubIdentity } from "./social-club-alias";

export function createSocialClubLinkHandler(readIdentities: () => Promise<ClubIdentity[]> = readSocialClubIdentities) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const slug = req.params.slug;
    // Editors must continue to reach the original record/content/history.
    if (req.user?.role === "admin" || (slug !== LEGACY_CLUB_SLUG && slug !== ORIGINAL_GOLF_CART_SLUG)) return next();
    try {
      const identities = await readIdentities();
      const source = identities.find(p => p.slug === slug);
      let target: ClubIdentity | undefined;
      if (slug === LEGACY_CLUB_SLUG) {
        // No fallback: a missing or unrelated generic record is NOT authority
        // to substitute Golf Cart Club. This differs between dev and live.
        if (!source || !isLegacyGolfCartPage(source)) return next();
        target = legacyClubTarget(source, identities);
        if (source.isHidden || !isPubliclyVisible(source) || !target) {
          res.setHeader("Cache-Control", "private, no-store");
          return sendContentUnavailable(res, "Club");
        }
      } else {
        target = golfCartTarget(identities);
        if (!target || target.slug === slug || (source && source.id !== target.id)) return next();
      }
      res.setHeader("Cache-Control", "private, no-store");
      if (target.isHidden || !isPubliclyVisible(target)) return sendContentUnavailable(res, "Club");
      return res.redirect(307, `/api/pages/${encodeURIComponent(target.slug)}`);
    } catch (error) {
      return next(error);
    }
  };
}
