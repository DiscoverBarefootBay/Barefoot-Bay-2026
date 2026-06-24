import { DirectMapIframe } from './direct-map-iframe';

interface EventLocationMapProps {
  location: string;
  className?: string;
  compact?: boolean;
}

/**
 * Component to show a map for an event location with fallback options
 * Uses iframe embedding for maximum compatibility
 */
export function EventLocationMap({ 
  location, 
  className = '', 
  compact = false 
}: EventLocationMapProps) {
  if (!location) {
    return null;
  }

  // Dimensions for the map
  const width = compact ? 400 : 600;
  const height = compact ? 200 : 300;

  return (
    <div className={`rounded-lg overflow-hidden ${className}`}>
      <DirectMapIframe
        location={location}
        width={width}
        height={height}
        className="w-full rounded-lg"
      />
    </div>
  );
}