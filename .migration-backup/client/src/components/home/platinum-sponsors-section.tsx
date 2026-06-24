import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type Event } from "@shared/schema";
import { useLocation } from "wouter";
import { Phone, Globe, Store } from "lucide-react";
import { getMediaUrl } from "@/lib/media-helper";
import { dbSlugToPublicUrl } from "@shared/vendor-url-utils";
import { useRotatingList } from "@/hooks/use-rotating-list";
import { usePlatinumSponsorSettings, PLATINUM_SPONSOR_DEFAULT_SETTINGS } from "@/hooks/use-platinum-sponsor-settings";

export function PlatinumSponsorBanner({
  event,
  buttonLayout = "stacked",
  showImage = true,
  edgeToEdge = false,
  previewMode,
  layoutRef,
}: {
  event: Event;
  buttonLayout?: "horizontal" | "stacked";
  showImage?: boolean;
  edgeToEdge?: boolean;
  /**
   * Force a specific breakpoint layout regardless of the surrounding viewport
   * width. Used by the admin Live Preview toggle so admins can verify the
   * phone / tablet / desktop layouts without resizing their browser window.
   * "tablet" represents the in-between state where Tailwind's `sm:` variants
   * are active but `md:` variants are not (i.e. buttons grow into pill-shaped
   * labelled buttons but the desktop-only image column is still hidden).
   * When omitted, the banner falls back to its normal viewport-driven
   * `sm:`/`md:` responsive behavior, matching production usage on the
   * homepage and calendar.
   */
  previewMode?: "mobile" | "tablet" | "desktop";
  /**
   * Optional ref callback for the inner layout element. Used by parent
   * sections that render multiple banners side by side and want to equalize
   * their heights — the parent measures each banner's natural height and
   * applies a shared min-height back to the same element. Standalone
   * banners (calendar, etc.) can omit this and the banner sizes itself
   * naturally to its baseline `min-h-[…]` and content.
   */
  layoutRef?: (el: HTMLDivElement | null) => void;
}) {
  const [, setLocation] = useLocation();
  const imageUrl = showImage && event.mediaUrls && event.mediaUrls.length > 0
    ? getMediaUrl(event.mediaUrls[0])
    : null;

  const hasPhone = !!event.sponsorPhone;
  const hasWebsite = !!event.sponsorWebsiteUrl;
  const hasVendorPage = !!event.sponsorVendorPageSlug;
  const hasButtons = hasPhone || hasWebsite || hasVendorPage;

  const forceMobile = previewMode === "mobile";
  const forceTablet = previewMode === "tablet";
  const forceDesktop = previewMode === "desktop";

  // Picks between mobile / tablet / desktop class lists and the full
  // viewport-responsive class list. The `tablet` argument captures the
  // sm-active-but-md-inactive state (e.g. labelled pill buttons but the
  // desktop image column / larger text sizes still off). The `desktop`
  // argument lists the desktop variants WITHOUT their `sm:` / `md:` prefixes
  // so we can apply them unconditionally when previewMode forces desktop.
  // The `responsivePrefixed` argument is the original prefixed string used
  // when no preview mode is forced, kept verbatim to avoid regressing the
  // homepage / calendar rendering.
  const cls = (
    mobile: string,
    tablet: string,
    desktop: string,
    responsivePrefixed: string,
  ) => {
    if (forceMobile) return mobile;
    if (forceTablet) return tablet;
    if (forceDesktop) return desktop;
    return responsivePrefixed;
  };

  const handleBannerClick = () => {
    setLocation(`/events/${event.id}`);
  };

  // The image column is hidden on mobile in the responsive layout (md:block);
  // mirror that explicitly so the forced mobile / tablet previews also skip
  // the column and the forced desktop preview always shows it (rather than
  // relying on the admin's actual viewport being wide enough to trigger md:).
  // Tablet is intentionally column-less because the desktop image column only
  // appears at the `md:` breakpoint (768px), and tablet represents the
  // sm-active-but-md-inactive band just below it.
  const showImageColumn = !!imageUrl && !forceMobile && !forceTablet;
  const imageColumnClassName = forceDesktop
    ? "block w-[150px] flex-shrink-0 overflow-hidden relative rounded-l-xl"
    : "hidden md:block w-[150px] flex-shrink-0 overflow-hidden relative rounded-l-xl";

  const cornerRounding = edgeToEdge
    ? cls("rounded-none", "rounded-xl", "rounded-xl", "rounded-none sm:rounded-xl")
    : "rounded-xl";

  // Each banner has a baseline minimum height per breakpoint so stacked lists
  // line up cleanly when titles are short. Stacked button layout (calendar)
  // needs taller minimums on tablet/desktop to fit the vertical button
  // column. Political-ad disclaimer banners use their own minimum since the
  // task spec allows them to expand. We use `min-h-[…]` (instead of fixed
  // `h-[…]`) so a long title can wrap to a second line and grow the banner;
  // parent sections that render multiple banners can equalize heights via
  // the `layoutRef` callback.
  const hasPoliticalAdDisclaimer = !!(
    event.sponsorIsPoliticalAd && event.sponsorPoliticalAdText
  );
  const bannerHeightClasses = hasPoliticalAdDisclaimer
    ? "min-h-[110px]"
    : buttonLayout === "horizontal"
      ? cls(
          "min-h-[150px]",
          "min-h-[150px]",
          "min-h-[120px]",
          "min-h-[150px] md:min-h-[120px]",
        )
      : cls(
          "min-h-[150px]",
          "min-h-[210px]",
          "min-h-[170px]",
          "min-h-[150px] sm:min-h-[210px] md:min-h-[170px]",
        );

  // Forward the inner layout element to the parent (if it asked for one) so
  // a section rendering multiple banners can equalize their heights.
  const setInnerLayoutEl = (el: HTMLDivElement | null) => {
    if (layoutRef) layoutRef(el);
  };

  return (
    <div
      onClick={handleBannerClick}
      className={`group relative overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer ${cornerRounding}`}
      style={{
        background: 'linear-gradient(135deg, #F9FAFB 0%, #F5F5F4 30%, #F9FAFB 60%, #F5F5F4 100%)',
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleBannerClick(); }}
    >
      <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-[#9CA3AF] via-[#D1D5DB] to-[#9CA3AF] z-20 pointer-events-none" />

      <div ref={setInnerLayoutEl} className={`flex items-stretch ${bannerHeightClasses}`}>
        {showImageColumn && (
          <div className={imageColumnClassName}>
            <img
              src={imageUrl!}
              alt={event.title}
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#F9FAFB]/30" />
          </div>
        )}

        <div
          className={`flex-1 flex ${cls(
            'flex-col items-start px-4 py-3 gap-2',
            'flex-col items-start px-4 py-3 gap-2',
            'flex-row items-center px-6 py-3 gap-4',
            'flex-col md:flex-row items-start md:items-center px-4 md:px-6 py-3 gap-2 md:gap-4',
          )} justify-between min-w-0`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span
                className={`${cls(
                  'text-[10px]',
                  'text-[10px]',
                  'text-xs',
                  'text-[10px] md:text-xs',
                )} font-bold text-[#9CA3AF] uppercase tracking-widest`}
              >
                Platinum Sponsor
              </span>
            </div>
            <h3
              className={`${cls(
                'text-xl',
                'text-xl',
                'text-2xl',
                'text-xl md:text-2xl',
              )} font-extrabold text-[#1a1a2e] leading-tight group-hover:text-[#6B7280] transition-colors line-clamp-2 break-words [overflow-wrap:anywhere]`}
            >
              {event.title}
            </h3>
            {event.sponsorTagline ? (
              <p
                className={`${cls(
                  'text-sm',
                  'text-sm',
                  'text-base',
                  'text-sm md:text-base',
                )} text-[#6B7280] italic mt-1 truncate`}
              >
                {event.sponsorTagline}
              </p>
            ) : (
              <p
                aria-hidden="true"
                className={`${cls(
                  'text-sm',
                  'text-sm',
                  'text-base',
                  'text-sm md:text-base',
                )} italic mt-1 invisible select-none pointer-events-none truncate`}
              >
                &nbsp;
              </p>
            )}
            {event.sponsorIsPoliticalAd && event.sponsorPoliticalAdText && (
              <p className="text-xs text-[#888] italic mt-1">
                *{event.sponsorPoliticalAdText}
              </p>
            )}
          </div>

          {hasButtons && (
            <div
              className={`flex gap-2 flex-shrink-0 ${
                buttonLayout === 'horizontal'
                  ? 'flex-row items-center'
                  : cls(
                      'flex-row items-center',
                      'flex-col items-stretch w-full',
                      'flex-col items-stretch w-auto',
                      'flex-row sm:flex-col items-center sm:items-stretch sm:w-full md:w-auto',
                    )
              }`}
            >
              {hasPhone && (
                <a
                  href={`tel:${event.sponsorPhone}`}
                  onClick={(e) => e.stopPropagation()}
                  className={`flex items-center justify-center gap-1.5 ${cls(
                    'w-9 h-9 rounded-full text-xs',
                    'w-auto h-auto px-3 py-2 rounded-lg text-xs',
                    'w-auto h-auto px-3 py-2 rounded-lg text-sm',
                    'w-9 h-9 sm:w-auto sm:h-auto sm:px-3 sm:py-2 rounded-full sm:rounded-lg text-xs md:text-sm',
                  )} bg-[#9CA3AF] text-white hover:bg-[#7B8494] transition-colors shadow-sm font-semibold`}
                  title="Call"
                >
                  <Phone className="w-4 h-4" />
                  <span className={cls('hidden', 'inline', 'inline', 'hidden sm:inline')}>Call</span>
                </a>
              )}
              {hasWebsite && (
                <a
                  href={event.sponsorWebsiteUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className={`flex items-center justify-center gap-1.5 ${cls(
                    'w-9 h-9 rounded-full text-xs',
                    'w-auto h-auto px-3 py-2 rounded-lg text-xs',
                    'w-auto h-auto px-3 py-2 rounded-lg text-sm',
                    'w-9 h-9 sm:w-auto sm:h-auto sm:px-3 sm:py-2 rounded-full sm:rounded-lg text-xs md:text-sm',
                  )} bg-[#9CA3AF] text-white hover:bg-[#7B8494] transition-colors shadow-sm font-semibold`}
                  title="Website"
                >
                  <Globe className="w-4 h-4" />
                  <span className={cls('hidden', 'inline', 'inline', 'hidden sm:inline')}>Website</span>
                </a>
              )}
              {hasVendorPage && (
                <a
                  href={dbSlugToPublicUrl(event.sponsorVendorPageSlug!)}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setLocation(dbSlugToPublicUrl(event.sponsorVendorPageSlug!));
                  }}
                  className={`flex items-center justify-center gap-1.5 ${cls(
                    'w-9 h-9 rounded-full text-xs',
                    'w-auto h-auto px-3 py-2 rounded-lg text-xs',
                    'w-auto h-auto px-3 py-2 rounded-lg text-sm',
                    'w-9 h-9 sm:w-auto sm:h-auto sm:px-3 sm:py-2 rounded-full sm:rounded-lg text-xs md:text-sm',
                  )} bg-[#6B7280] text-white hover:bg-[#4B5563] transition-colors shadow-sm font-semibold`}
                  title="Vendor Page"
                >
                  <Store className="w-4 h-4" />
                  <span className={cls('hidden', 'inline', 'inline', 'hidden sm:inline')}>Vendor Page</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 w-full h-[3px] bg-gradient-to-r from-[#9CA3AF] via-[#D1D5DB] to-[#9CA3AF] z-20 pointer-events-none" />

      <div
        aria-hidden="true"
        className={`absolute inset-0 pointer-events-none border-2 border-[#9CA3AF] z-10 ${cornerRounding}`}
      />
    </div>
  );
}

export function PlatinumSponsorsSection({ fullWidth = false, buttonLayout = "stacked" }: { fullWidth?: boolean; buttonLayout?: "horizontal" | "stacked" }) {
  const { data: sponsors = [] } = useQuery<Event[]>({
    queryKey: ["/api/events/platinum-sponsors"],
    refetchInterval: 60000,
  });

  const { data: platinumSettings } = usePlatinumSponsorSettings();
  const settings = platinumSettings ?? PLATINUM_SPONSOR_DEFAULT_SETTINGS;
  const [sectionEl, setSectionEl] = useState<HTMLElement | null>(null);
  const rotatedSponsors = useRotatingList(sponsors, {
    randomizeOnLoad: settings.randomizeOnLoad,
    rotationEnabled: settings.rotationEnabled,
    intervalMs: Math.max(5, settings.rotationSeconds) * 1000,
    manualOrderEnabled: settings.manualOrderEnabled,
    manualOrderIds: settings.manualOrder,
    target: sectionEl,
  });

  // Track each banner's inner layout element so we can equalize their heights
  // when one banner's title wraps to a second line. The Tailwind config sets
  // `important: true`, so the per-breakpoint `min-h-[…]` baseline classes
  // generate `!important` rules — we have to apply our equalizing min-height
  // via setProperty(..., 'important') for it to win.
  const layoutElsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const isUpdatingRef = useRef<boolean>(false);

  const equalizeHeights = () => {
    if (isUpdatingRef.current) return;
    const els = Array.from(layoutElsRef.current.values());
    if (els.length === 0) return;

    isUpdatingRef.current = true;
    try {
      // Reset each banner to its natural (baseline + content) height before
      // measuring so a previously-applied larger min-height doesn't lock in.
      for (const el of els) {
        el.style.removeProperty("min-height");
      }
      // Force a layout flush so offsetHeight reflects the natural sizes.
      let max = 0;
      for (const el of els) {
        const h = el.getBoundingClientRect().height;
        if (h > max) max = h;
      }
      if (max > 0) {
        for (const el of els) {
          el.style.setProperty("min-height", `${max}px`, "important");
        }
      }
    } finally {
      // Wait two animation frames so any ResizeObserver callbacks triggered
      // by our own writes can drain before we accept new measurements.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          isUpdatingRef.current = false;
        });
      });
    }
  };

  const setLayoutEl = (id: number) => (el: HTMLDivElement | null) => {
    if (el) {
      layoutElsRef.current.set(id, el);
    } else {
      layoutElsRef.current.delete(id);
    }
  };

  // Re-equalize whenever the visible sponsor list changes (rotation, refetch,
  // manual reorder). useLayoutEffect runs before paint so users never see the
  // mismatched-heights frame.
  useLayoutEffect(() => {
    equalizeHeights();
  }, [rotatedSponsors]);

  // Re-equalize on viewport changes (breakpoint crossings change the layout)
  // and after fonts finish loading (font swap can shift line heights).
  useEffect(() => {
    if (rotatedSponsors.length === 0) return;

    const handleResize = () => equalizeHeights();
    window.addEventListener("resize", handleResize);

    if (typeof document !== "undefined" && (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready) {
      (document as Document & { fonts: { ready: Promise<unknown> } }).fonts.ready
        .then(() => equalizeHeights())
        .catch(() => {});
    }

    // Watch each banner's content for size changes (image load, late
    // re-renders) and re-equalize. The isUpdatingRef guard prevents loops
    // caused by our own min-height writes.
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => {
      if (isUpdatingRef.current) return;
      equalizeHeights();
    }) : null;
    if (observer) {
      for (const el of Array.from(layoutElsRef.current.values())) {
        observer.observe(el);
      }
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      observer?.disconnect();
    };
  }, [rotatedSponsors]);

  if (rotatedSponsors.length === 0) return null;

  return (
    <section ref={setSectionEl} className={fullWidth ? "" : "max-w-6xl mx-auto px-8"}>
      <div className="flex flex-col gap-3">
        {rotatedSponsors.map((sponsor) => (
          <PlatinumSponsorBanner
            key={sponsor.id}
            event={sponsor}
            buttonLayout={buttonLayout}
            layoutRef={setLayoutEl(sponsor.id)}
          />
        ))}
      </div>
    </section>
  );
}
