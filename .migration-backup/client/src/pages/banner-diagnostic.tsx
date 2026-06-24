import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { clearMediaCache, addCacheBustingParam } from '../utils/banner-cache-manager';

interface BannerSlide {
  src: string;
  alt: string;
  caption: string;
  link: string;
  customLink?: string;
  buttonText?: string;
  bgPosition?: string;
  mediaType?: 'image' | 'video';
  autoplay?: boolean;
}

export default function BannerDiagnostic() {
  const [bannerContent, setBannerContent] = useState<BannerSlide[]>([]);
  const [diagResults, setDiagResults] = useState<Record<string, any>>({});
  const [cacheCleared, setCacheCleared] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    async function fetchBannerData() {
      try {
        setLoading(true);
        
        // Fetch banner slides data
        const response = await fetch('/api/page-content/banner-slides');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch banner data: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        if (data && data.content) {
          setBannerContent(data.content);
        } else {
          throw new Error('Invalid banner data format');
        }
      } catch (err) {
        console.error("Error fetching banner data:", err);
        setError(err instanceof Error ? err.message : 'Unknown error fetching banner data');
      } finally {
        setLoading(false);
      }
    }
    
    fetchBannerData();
  }, []);
  
  // Run diagnostic on banner content
  useEffect(() => {
    async function runDiagnostics() {
      if (bannerContent.length === 0 || loading) return;
      
      const results: Record<string, any> = {
        totalSlides: bannerContent.length,
        images: 0,
        videos: 0,
        objectStorageUrls: 0,
        filesystemUrls: 0,
        proxyUrls: 0,
        accessibilityCheck: {
          missingAlt: 0,
          missingCaption: 0
        },
        pathAnalysis: {},
        urlFormats: {}
      };
      
      // Analyze each slide
      for (const slide of bannerContent) {
        // Count media types
        if (slide.mediaType === 'video' || slide.src.match(/\.(mp4|webm|mov|avi)$/i)) {
          results.videos++;
        } else {
          results.images++;
        }
        
        // Check URL format
        if (slide.src.includes('object-storage.replit.app')) {
          results.objectStorageUrls++;
          results.urlFormats.objectStorage = (results.urlFormats.objectStorage || 0) + 1;
        } else if (slide.src.startsWith('/api/storage-proxy/') || slide.src.startsWith('/direct-banner/')) {
          results.proxyUrls++;
          results.urlFormats.proxy = (results.urlFormats.proxy || 0) + 1;
        } else if (slide.src.startsWith('/uploads/') || slide.src.startsWith('/banner-slides/')) {
          results.filesystemUrls++;
          results.urlFormats.filesystem = (results.urlFormats.filesystem || 0) + 1;
        } else {
          results.urlFormats.other = (results.urlFormats.other || 0) + 1;
        }
        
        // Check accessibility
        if (!slide.alt || slide.alt.trim() === '') {
          results.accessibilityCheck.missingAlt++;
        }
        if (!slide.caption || slide.caption.trim() === '') {
          results.accessibilityCheck.missingCaption++;
        }
        
        // Track path patterns
        const pathPattern = slide.src.split('/').slice(0, -1).join('/');
        results.pathAnalysis[pathPattern] = (results.pathAnalysis[pathPattern] || 0) + 1;
      }
      
      // Check browser storage usage
      results.storageUsage = {
        localStorage: Object.keys(localStorage).filter(key => 
          key.includes('banner') || 
          key.includes('media') || 
          key.includes('image')).length,
        sessionStorage: Object.keys(sessionStorage).filter(key => 
          key.includes('banner') || 
          key.includes('media') || 
          key.includes('image')).length
      };
      
      setDiagResults(results);
    }
    
    runDiagnostics();
  }, [bannerContent, loading]);
  
  const handleClearCache = () => {
    const results = clearMediaCache();
    console.log('Cache clearing results:', results);
    setCacheCleared(true);
    
    // Reset after 3 seconds
    setTimeout(() => {
      setCacheCleared(false);
    }, 3000);
  };
  
  const formatPath = (path: string): string => {
    // If it's an Object Storage URL, show a cleaner version
    if (path.includes('object-storage.replit.app')) {
      const parts = path.split('object-storage.replit.app/');
      if (parts.length > 1) {
        return `[Object Storage] ${parts[1]}`;
      }
    }
    
    // For proxy paths, highlight them
    if (path.startsWith('/api/storage-proxy/')) {
      return `[Proxy] ${path.substring(17)}`;
    }
    
    if (path.startsWith('/direct-banner/')) {
      return `[Direct Banner] ${path.substring(15)}`;
    }
    
    return path;
  };
  
  const checkPath = async (path: string): Promise<string> => {
    try {
      const response = await fetch(addCacheBustingParam(path), { method: 'HEAD' });
      return response.ok ? 'Available ✓' : `Error ${response.status}`;
    } catch (err) {
      return 'Network Error';
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <Helmet>
        <title>Banner Diagnostic Tool | Barefoot Bay</title>
      </Helmet>
      
      <h1 className="text-3xl font-bold mb-4">Banner Slides Diagnostic</h1>
      
      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-2">Tools</h2>
        <div className="flex gap-3">
          <button 
            onClick={handleClearCache}
            className={`px-4 py-2 rounded ${cacheCleared ? 'bg-green-500' : 'bg-blue-500'} text-white hover:opacity-90`}
          >
            {cacheCleared ? 'Cache Cleared! ✓' : 'Clear Media Cache'}
          </button>
          
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded bg-gray-700 text-white hover:opacity-90"
          >
            Reload Page
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="animate-pulse flex space-x-4 p-6 bg-gray-50 rounded-lg">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p>{error}</p>
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white shadow rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-2">Media Count</h3>
              <div className="flex justify-between items-center">
                <div>
                  <p>Total Slides: {diagResults.totalSlides || 0}</p>
                  <p>Images: {diagResults.images || 0}</p>
                  <p>Videos: {diagResults.videos || 0}</p>
                </div>
                <div className="text-4xl text-blue-500">
                  {diagResults.totalSlides || 0}
                </div>
              </div>
            </div>
            
            <div className="bg-white shadow rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-2">URL Types</h3>
              <div className="space-y-1">
                <p>Object Storage URLs: {diagResults.objectStorageUrls || 0}</p>
                <p>Proxy URLs: {diagResults.proxyUrls || 0}</p>
                <p>Filesystem URLs: {diagResults.filesystemUrls || 0}</p>
                <p>Other: {(diagResults.totalSlides || 0) - 
                  ((diagResults.objectStorageUrls || 0) + 
                   (diagResults.proxyUrls || 0) + 
                   (diagResults.filesystemUrls || 0))}</p>
              </div>
            </div>
            
            <div className="bg-white shadow rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-2">Cache Status</h3>
              <div className="space-y-1">
                <p>localStorage items: {diagResults.storageUsage?.localStorage || 0}</p>
                <p>sessionStorage items: {diagResults.storageUsage?.sessionStorage || 0}</p>
                <p className="text-sm text-gray-500 mt-2">
                  Last cache clear: {window.__lastCacheClear || 'Never'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white shadow rounded-lg overflow-hidden mb-8">
            <div className="p-4 bg-gray-50 border-b">
              <h3 className="font-semibold text-lg">Banner Slides Content</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Source
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Path Format
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {bannerContent.map((slide, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {idx + 1}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <div className="max-w-xs truncate">{formatPath(slide.src)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {slide.mediaType || (slide.src.match(/\.(mp4|webm|mov|avi)$/i) ? 'video' : 'image')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {slide.src.includes('object-storage.replit.app') 
                          ? 'Object Storage' 
                          : slide.src.startsWith('/api/storage-proxy/') 
                            ? 'Proxy' 
                            : slide.src.startsWith('/direct-banner/')
                              ? 'Direct Banner'
                              : 'Filesystem'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button 
                          onClick={async () => {
                            const status = await checkPath(slide.src);
                            const newResults = {...diagResults};
                            if (!newResults.pathStatus) newResults.pathStatus = {};
                            newResults.pathStatus[slide.src] = status;
                            setDiagResults(newResults);
                          }}
                          className="underline text-blue-500 hover:text-blue-700"
                        >
                          {diagResults.pathStatus?.[slide.src] || 'Check'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="p-4 bg-gray-50 border-b">
              <h3 className="font-semibold text-lg">Raw Data</h3>
            </div>
            <div className="p-4">
              <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96 text-xs">
                {JSON.stringify(bannerContent, null, 2)}
              </pre>
            </div>
          </div>
        </>
      )}
    </div>
  );
}