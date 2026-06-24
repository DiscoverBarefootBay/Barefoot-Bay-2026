import { useState } from 'react';
import { MapPin } from 'lucide-react';

interface DirectMapIframeProps {
  location: string;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * A component that displays a static Google Map as an iframe
 * This is a workaround for image loading issues in production
 */
export function DirectMapIframe({
  location,
  width = 600,
  height = 300,
  className = '',
}: DirectMapIframeProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Create a sandboxed iframe URL to Google Maps
  const escapedLocation = encodeURIComponent(location);
  const mapUrl = `https://www.google.com/maps/embed/v1/place?key=AIzaSyAcmmNAcRcRox1faiPlOIsJjKgPpxIYmRk&q=${escapedLocation}&zoom=15`;
  
  // Add content preview in case embed fails
  return (
    <div className={`relative rounded-lg overflow-hidden border border-muted ${className}`} style={{ minHeight: '200px' }}>
      <iframe
        title={`Map of ${location}`}
        src={mapUrl}
        width={width}
        height={height}
        style={{ border: 0, width: '100%', height: '100%', minHeight: '200px', background: '#f0f2f5' }}
        allowFullScreen={false}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        onLoad={() => setIsLoaded(true)}
        onError={() => setIsLoaded(false)}
      ></iframe>
      
      {/* Fallback if iframe doesn't load */}
      {!isLoaded && (
        <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center bg-gray-100 p-4">
          <div className="bg-primary/10 p-4 rounded-full mb-2">
            <MapPin size={24} className="text-primary" />
          </div>
          <p className="text-sm font-medium mb-1 text-center">{location}</p>
        </div>
      )}
    </div>
  );
}