/** Keep every slide's layout, but load media only near the current slide. */
export function shouldLoadBannerMedia(index: number, current: number, count: number) {
  return count > 0 && (
    index === current ||
    index === (current + 1) % count ||
    index === (current - 1 + count) % count
  );
}