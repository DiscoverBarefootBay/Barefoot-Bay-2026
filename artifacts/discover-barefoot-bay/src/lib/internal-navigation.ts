/**
 * App routes that can safely be handled by the client-side router.
 *
 * Keep this list in sync with the route declarations in App.tsx. This is
 * intentionally an allowlist: arbitrary same-origin URLs may be server
 * endpoints, downloads, or static files and should retain native navigation.
 * Dynamic segments use Wouter's `:parameter` notation.
 */
export const INTERNAL_ROUTE_PATTERNS = [
  "/",
  "/launch",
  "/auth",
  "/forgot-password",
  "/reset-password",
  "/unsubscribe",
  "/calendar",
  "/events/:id",
  "/for-sale",
  "/my-listings",
  "/for-sale/payment-complete",
  "/payment-complete",
  "/for-sale/:id",
  "/real-estate",
  "/real-estate/:id",
  "/store",
  "/product/:id",
  "/store/pay/:orderId",
  "/store/order-complete/:orderId",
  "/store/track-order",
  "/store/my-returns",
  "/forum",
  "/forum/category/:categoryId",
  "/forum/post/:postId",
  "/forum/new-post",
  "/forum/edit-post/:postId",
  "/amenities",
  "/banner",
  "/weather",
  "/profile",
  "/subscriptions",
  "/copyright-notices",
  "/copyright-notices/:caseNumber",
  "/copyright-notices/:caseNumber/counter-notice",
  "/subscription-test",
  "/subscription/success",
  "/subscription/error",
  "/subscription/cancelled",
  "/community-settings",
  "/advanced-settings",
  "/messaging",
  "/messages",
  "/chat",
  "/contact-us",
  "/forms/:slug",
  "/admin",
  "/admin/moderated-posts",
  "/admin/dmca",
  "/admin/dmca/new",
  "/admin/dmca/cases/:id",
  "/admin/dmca/holds",
  "/admin/dmca/repeat-infringers",
  "/admin/dmca/settings",
  "/admin/dmca/permissions",
  "/admin/version-fix",
  "/admin/products",
  "/admin/orders",
  "/admin/returns",
  "/admin/product-image-test",
  "/admin/form-submissions",
  "/admin/legal-history",
  "/admin/manage-pages",
  "/admin/manage-vendors",
  "/admin/manage-forum",
  "/admin/community-categories",
  "/admin/messages",
  "/admin/analytics",
  "/admin/email-activity",
  "/admin/on-the-market-emails",
  "/admin/manage-listings",
  "/admin/calendar-management",
  "/admin/feature-management",
  "/admin/platinum-sponsor-settings",
  "/admin/membership-management",
  "/analytics-dashboard",
  "/enhanced-analytics",
  "/admin/enhanced-analytics",
  "/admin/enhanced-analytics-dashboard",
  "/direct-analytics",
  "/community/community",
  "/community/community/:page",
  "/community/government",
  "/community/government/:page",
  "/community/transportation",
  "/community/transportation/:page",
  "/community/religion",
  "/community/religion/:page",
  "/community/vendors",
  "/community/vendors/:page",
  "/community/:category",
  "/community/:category/:page",
  "/more/:category",
  "/more/:category/:page",
  "/terms",
  "/privacy",
  "/dmca",
  "/dmca/notice",
  "/dmca/status/:token",
  "/vendors",
  "/vendors/home/services-:vendor",
  "/vendors/home-services/services-:vendor",
  "/vendors/home/services/:vendor",
  "/vendors/technology/and-electronics-:vendor",
  "/vendors/technology/and-electronics/:vendor",
  "/vendors/:category/undefined",
  "/vendors/:category/:vendor",
  "/vendors/:part1/and-:part2-:vendor",
  "/vendors/:part1/and-:part2/:vendor",
  "/vendors/:part1/services-:vendor",
  "/vendors/:part1/:part2-:vendor",
  "/vendors/:page",
  "/testing/track",
  "/testing/maps",
  "/testing/map",
  "/testing/avatar",
  "/testing/vendor-url",
  "/admin/payment-diagnostics",
  "/admin/auth-debug",
  "/admin/fix-production-auth",
  "/emergency-auth-fix",
  "/deployment-diagnostic",
  "/analytics-access",
  "/banner-diagnostic",
  "/admin/object-storage-debug",
] as const;

function normalizeBasePath(basePath: string): string {
  const trimmed = basePath.trim();
  if (!trimmed || trimmed === "/") return "/";
  const leadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return leadingSlash.replace(/\/+$/, "");
}

function stripBasePath(pathname: string, basePath: string): string | null {
  const base = normalizeBasePath(basePath);
  if (base === "/") return pathname || "/";
  if (pathname === base) return "/";
  if (pathname.startsWith(`${base}/`)) return pathname.slice(base.length) || "/";
  return null;
}

function routePatternMatches(pattern: string, pathname: string): boolean {
  if (pattern === "/") return pathname === "/";

  const patternSegments = pattern.split("/").filter(Boolean);
  const pathSegments = pathname.split("/").filter(Boolean);
  if (patternSegments.length !== pathSegments.length) return false;

  return patternSegments.every((patternSegment, index) => {
    if (patternSegment.startsWith(":")) return pathSegments[index].length > 0;
    const expression = patternSegment
      .split(/(:[A-Za-z0-9_]+)/g)
      .map((part) => (part.startsWith(":") ? "[^/]+" : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
      .join("");
    return new RegExp(`^${expression}$`).test(pathSegments[index]);
  });
}

function isNonRouteResource(pathname: string): boolean {
  if (/^\/(?:api|assets|static|uploads|media|storage|server|download|downloads)(?:\/|$)/i.test(pathname)) {
    return true;
  }
  // App routes are page paths, not files. This also avoids accidentally
  // treating a file-like CMS slug as an app route.
  return /\/[^/]+\.[a-z0-9]{1,10}$/i.test(pathname);
}

/** Return whether a path (with an optional deployment base prefix) is a known app route. */
export function isInternalAppRoute(pathname: string, basePath = "/"): boolean {
  const appPath = stripBasePath(pathname, basePath);
  if (appPath === null || isNonRouteResource(appPath)) return false;
  const normalizedPath = appPath.length > 1 ? appPath.replace(/\/+$/, "") : appPath;
  return INTERNAL_ROUTE_PATTERNS.some((pattern) => routePatternMatches(pattern, normalizedPath));
}

export type InternalNavigate = (to: string) => void;

/**
 * Attach a bubbling click handler for eligible same-origin app anchors.
 * Returns an unsubscribe function; native browser behavior is left untouched
 * for every link outside the explicit route allowlist.
 */
export function installInternalNavigation(
  document: Document,
  navigate: InternalNavigate,
  basePath = "/",
): () => void {
  const handleClick = (event: MouseEvent) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const target = event.target as (Element & { parentElement?: Element | null }) | null;
    const clickedElement =
      target?.nodeType === 1 ? target : (target?.parentElement as Element | null | undefined);
    const anchor = clickedElement?.closest("a[href]") as HTMLAnchorElement | null;
    if (!anchor || anchor.closest("[data-native-navigation]")) return;
    if (anchor.hasAttribute("download")) return;

    const targetAttribute =
      anchor.getAttribute("target") ?? document.querySelector("base[target]")?.getAttribute("target");
    if (targetAttribute && targetAttribute.toLowerCase() !== "_self") return;
    if (anchor.rel.split(/\s+/).some((relToken) => relToken.toLowerCase() === "external")) return;

    const view = document.defaultView;
    if (!view) return;

    let destination: URL;
    try {
      destination = new URL(anchor.href, view.location.href);
    } catch {
      return;
    }
    if (
      (destination.protocol !== "http:" && destination.protocol !== "https:") ||
      destination.origin !== view.location.origin
    ) {
      return;
    }

    const currentUrl = new URL(view.location.href);
    if (!isInternalAppRoute(destination.pathname, basePath)) return;

    if (
      destination.pathname === currentUrl.pathname &&
      destination.search === currentUrl.search &&
      destination.hash !== currentUrl.hash
    ) {
      // A fragment-only change in the same document should retain native
      // scrolling. A changed query is a route change and is handled below.
      return;
    }

    // Cancel an eligible self-link without re-navigating the current location.
    if (
      destination.pathname === currentUrl.pathname &&
      destination.search === currentUrl.search &&
      destination.hash === currentUrl.hash
    ) {
      // A known app self-link should not trigger a full document load, but
      // navigating to the current location again would be redundant.
      event.preventDefault();
      return;
    }

    const appPath = stripBasePath(destination.pathname, basePath);
    if (appPath === null) return;

    event.preventDefault();
    navigate(`${appPath}${destination.search}${destination.hash}`);
  };

  document.addEventListener("click", handleClick);
  return () => document.removeEventListener("click", handleClick);
}