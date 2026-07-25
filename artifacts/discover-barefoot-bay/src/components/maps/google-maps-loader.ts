/**
 * Shared Google Maps loader configuration.
 *
 * The Google Maps JS API can only be loaded ONCE per page. If two components
 * initialize the loader with different options (different id, key, or library
 * list), @react-google-maps/api throws "Loader must not be called again with
 * different options", and whichever load wins determines which libraries are
 * actually available. To make that impossible, every map in the app must use
 * this single loader id, library list, and API-key resolution.
 */
import { useQuery } from '@tanstack/react-query';
import { useJsApiLoader } from '@react-google-maps/api';
import { apiRequest } from '@/lib/queryClient';

/** One stable loader id shared by every map on the site. */
export const GOOGLE_MAPS_LOADER_ID = 'shared-google-maps';

/**
 * One stable (module-scope) libraries array shared by every map. Includes both
 * `places` (calendar/community maps, location picker autocomplete) and
 * `visualization` (analytics heatmap) so the single script load carries every
 * capability any consumer needs, regardless of which map mounts first.
 */
export const GOOGLE_MAPS_LIBRARIES: ('places' | 'visualization')[] = [
  'places',
  'visualization',
];

/**
 * Resolve the Google Maps API key: build-time env var first, then the server
 * endpoint (which carries its own configured key) as a fallback.
 * Returns an empty string while the key is still being resolved.
 */
export function useGoogleMapsApiKey(): string {
  const envApiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || '';
  const { data: fetchedApiKey } = useQuery<string>({
    queryKey: ['google-maps-key'],
    enabled: !envApiKey,
    staleTime: Infinity,
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/google/mapkey');
      return (await response.text()).trim();
    },
  });
  return envApiKey || fetchedApiKey || '';
}

/**
 * Shared loader hook. Only call this once the API key is non-empty so the
 * loader is initialized exactly once with final, stable options.
 */
export function useSharedGoogleMapsLoader(apiKey: string) {
  return useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });
}
