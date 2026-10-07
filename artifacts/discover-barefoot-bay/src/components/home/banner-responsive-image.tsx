import { useCallback, useEffect, useRef, useState } from "react";

interface BannerResponsiveImageProps {
  src: string;
  srcSet?: string;
  sizes?: string;
  alt: string;
  bgPosition?: string;
  priority: boolean;
  active: boolean;
  onReady?: () => void;
}

type Status = "loading" | "ready" | "error";

const TIMEOUT_MS = 12000;
const MAX_ATTEMPTS = 3;

function withAttempt(url: string, attempt: number): string {
  if (attempt <= 0) return url;
  const hashIdx = url.indexOf("#");
  const hash = hashIdx >= 0 ? url.slice(hashIdx) : "";
  const base = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
  const clean = base.replace(/([?&])_retry=\d+&?/, "$1").replace(/[?&]$/, "");
  return `${clean}${clean.includes("?") ? "&" : "?"}_retry=${attempt}${hash}`;
}

export function BannerResponsiveImage({
  src,
  srcSet,
  sizes,
  alt,
  bgPosition,
  priority,
  active,
  onReady,
}: BannerResponsiveImageProps) {
  const [status, setStatus] = useState<Status>("loading");
  const [attempt, setAttempt] = useState(0);
  const [useOriginal, setUseOriginal] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const readyRef = useRef(false);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  // Reset on source change
  useEffect(() => {
    readyRef.current = false;
    setStatus("loading");
    setAttempt(0);
    setUseOriginal(false);
    setTimedOut(false);
  }, [src, srcSet]);

  const markReady = useCallback(() => {
    if (!readyRef.current) {
      readyRef.current = true;
      onReadyRef.current?.();
    }
    setStatus("ready");
    setTimedOut(false);
  }, []);

  const fail = useCallback(() => {
    if (srcSet && !useOriginal) {
      setUseOriginal(true);
      setStatus("loading");
      return;
    }
    setStatus("error");
  }, [srcSet, useOriginal]);

  // A preloaded neighbor can become active without receiving another load
  // event. Notify the carousel when that already-ready image is selected.
  useEffect(() => {
    if (active && status === "ready") onReadyRef.current?.();
  }, [active, status]);

  // Cached/complete images + timeout
  useEffect(() => {
    if (status !== "loading") return;
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) {
      markReady();
      return;
    }
    const t = window.setTimeout(() => {
      setTimedOut(true);
      setStatus("error");
    }, TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [status, src, srcSet, attempt, useOriginal, markReady]);

  const retry = () => {
    setAttempt((a) => Math.min(a + 1, MAX_ATTEMPTS));
    setUseOriginal(true);
    setTimedOut(false);
    setStatus("loading");
  };

  const effSrc = withAttempt(src, attempt);
  const effSrcSet = useOriginal ? undefined : srcSet;

  return (
    <>
      <img
        key={`${attempt}-${useOriginal ? "o" : "d"}`}
        ref={imgRef}
        src={effSrc}
        srcSet={effSrcSet}
        sizes={effSrcSet ? sizes : undefined}
        alt={alt}
        className="w-full h-full object-cover"
        style={{ objectPosition: bgPosition || "center" }}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        data-banner-image=""
        fetchPriority={priority ? "high" : "low"}
        onLoad={markReady}
        onError={fail}
      />
      {active && status === "loading" && (
        <div
          role="status"
          aria-live="polite"
          className="absolute top-3 left-3 z-20 flex items-center gap-2 rounded-md bg-black/55 px-2.5 py-1 text-xs text-white"
        >
          <span
            aria-hidden="true"
            className="h-3 w-3 rounded-full border-2 border-white/40 border-t-white motion-safe:animate-spin motion-reduce:animate-none"
          />
          <span>Loading image…</span>
        </div>
      )}
      {active && status === "error" && (
        <div
          role="alert"
          className="absolute top-3 left-3 z-20 flex max-w-[80%] flex-wrap items-center gap-2 rounded-md bg-black/70 px-2.5 py-1.5 text-xs text-white"
        >
          <span>{timedOut ? "Image is taking too long." : "Image failed to load."}</span>
          <button
            type="button"
            onClick={retry}
            disabled={attempt >= MAX_ATTEMPTS}
            className="rounded bg-white/90 px-2 py-0.5 font-semibold text-[#47759a] hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {attempt >= MAX_ATTEMPTS ? "Reload page to retry" : "Retry"}
          </button>
        </div>
      )}
    </>
  );
}

export default BannerResponsiveImage;
