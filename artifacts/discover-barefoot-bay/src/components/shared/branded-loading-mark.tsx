import "./branded-loading-mark.css";

/** Decorative coastal wave mark: sun, ripple and drifting waves. */
export function BrandedLoadingMark({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-testid="branded-loading-mark"
      className={`bbl-mark ${className}`}
      viewBox="0 0 44 24"
    >
      <circle className="bbl-sun" cx="22" cy="6" r="3.2" />
      <ellipse className="bbl-ripple" cx="22" cy="6" rx="10" ry="4" />
      <g className="bbl-drift">
        <path className="bbl-wave" d="M6 13 Q11 9 16 13 T26 13 T36 13 T46 13" />
      </g>
      <g className="bbl-drift bbl-d2">
        <path className="bbl-wave bbl-w2" d="M2 18 Q7 14 12 18 T22 18 T32 18 T42 18" />
      </g>
      <path className="bbl-wave bbl-w3" d="M10 22 Q15 20 20 22 T30 22 T40 22" />
    </svg>
  );
}
