import { useQuery } from "@tanstack/react-query";
import { getEnvironmentAppropriateUrl } from "@/lib/media-path-utils";
import type { BannerSlide } from "@/components/home/community-showcase";

export const BANNER_QUERY_KEY = "/api/pages/banner-slides";
export const bannerQueryKey = (viewer: string) => [BANNER_QUERY_KEY, "showcase", viewer] as const;

function normalizeBannerLink(link: string) {
  let result = link;
  try {
    if (/^(https?:)?\/\//.test(link)) {
      const url = new URL(link.startsWith("//") ? `https:${link}` : link);
      if (["barefootbay.com", "www.barefootbay.com"].includes(url.hostname)) {
        result = `${url.pathname}${url.search}${url.hash}`;
      }
    }
  } catch { /* Keep existing custom links unchanged. */ }
  if (result.startsWith("/amenities#")) {
    const hash = result.split("#")[1];
    const sections: Record<string, string> = { golf: "slide1", tennis: "slide2", pools: "slide3", clubhouse: "slide4" };
    if (hash) result = `/banner#${hash.startsWith("slide") ? hash : sections[hash] ?? "slide1"}`;
  }
  return result;
}

export function parseBannerContent(data: any) {
  if (!data || typeof data.content !== "string") throw new Error("The banner response was incomplete.");
  const slides = JSON.parse(data.content);
  if (!Array.isArray(slides) || slides.some(s => !s || typeof s.src !== "string" ||
    typeof s.caption !== "string" || typeof s.link !== "string")) {
    throw new Error("The banner configuration could not be read.");
  }
  return {
    id: data.id as number,
    revision: `${data.id}-${new Date(data.updatedAt).getTime()}`,
    slides: slides.map((s: BannerSlide) => ({
      ...s, src: getEnvironmentAppropriateUrl(s.src, "banner-slides"),
      link: normalizeBannerLink(s.link),
    })) as BannerSlide[],
  };
}

export async function readBannerSlides(signal?: AbortSignal, basePath = import.meta.env?.BASE_URL ?? "/") {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const timeout = setTimeout(abort, 8000);
  try {
    const response = await fetch(`${basePath}api/pages/banner-slides`, {
      credentials: "include", signal: controller.signal, cache: "no-store",
    });
    if (response.status === 404) return { id: null, revision: "", slides: [] as BannerSlide[] };
    if (!response.ok) throw new Error(`Banner unavailable (${response.status}).`);
    return parseBannerContent(await response.json());
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted) throw new Error("The banner request timed out. Please try again.");
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

export function useBannerSlides(viewer: string) {
  return useQuery({
    queryKey: bannerQueryKey(viewer),
    queryFn: ({ signal }) => readBannerSlides(signal),
    staleTime: 30_000, gcTime: 5 * 60_000,
    // Never accept the app-wide [] placeholder as a successful configuration,
    // or retain another viewer's hidden slides across an account switch.
    placeholderData: undefined, retry: false,
    refetchOnMount: true, refetchOnWindowFocus: true, refetchOnReconnect: true,
    refetchInterval: 30_000, refetchIntervalInBackground: false,
  });
}

export function bannerImageSrcSet(src: string, revision: string) {
  // External/legacy images and videos keep their original source.
  if (!revision || !/^\/api\/storage-proxy\/BANNER\/banner-slides\/[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/i.test(src)) return undefined;
  return [480, 960, 1440, 1920].map(width =>
    `${src}?width=${width}&v=${encodeURIComponent(revision)} ${width}w`).join(", ");
}
