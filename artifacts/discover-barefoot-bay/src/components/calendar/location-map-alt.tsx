import { DirectMapIframe } from "./direct-map-iframe";

interface LocationMapAltProps {
  location: string;
  className?: string;
}

/**
 * A simpler location map component that uses the DirectMapIframe component
 * This provides better compatibility with Google Maps API restrictions and browser caching
 */
export function LocationMapAlt({ location, className }: LocationMapAltProps) {
  if (!location) {
    return null;
  }

  return (
    <DirectMapIframe
      location={location}
      width={600}
      height={300}
      className={className}
    />
  );
}