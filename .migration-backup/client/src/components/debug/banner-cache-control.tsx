/**
 * Banner Cache Control Component
 * A debugging component for developers to manage banner slide caching
 * Only visible in development mode
 */

import React, { useState, useEffect } from 'react';
import { clearBannerCache, forceReloadBannerImages, testBannerImages } from '../../utils/banner-cache-manager';

interface BannerCacheControlProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export default function BannerCacheControl({ position = 'bottom-right' }: BannerCacheControlProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean, message: string} | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [recentClears, setRecentClears] = useState(0);

  // Only show in development mode
  useEffect(() => {
    const isDev = process.env.NODE_ENV === 'development' || 
                  window.location.hostname.includes('localhost') ||
                  window.location.hostname.includes('replit');
    setIsVisible(isDev);
  }, []);
  
  if (!isVisible) return null;
  
  // Position styling
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4'
  };
  
  const handleClearCache = () => {
    const cleared = clearBannerCache();
    setRecentClears(cleared);
    setTestResult(null);
  };
  
  const handleForceReload = () => {
    forceReloadBannerImages();
    setTestResult({ success: true, message: 'Banner reload initiated. Refresh the page to see changes.' });
  };
  
  const handleTestImages = async () => {
    const result = await testBannerImages();
    setTestResult(result);
  };
  
  return (
    <div className={`fixed ${positionClasses[position]} z-50`}>
      {isExpanded ? (
        <div className="bg-black/80 text-white rounded-lg p-3 shadow-lg w-64 backdrop-blur-sm">
          <div className="flex justify-between items-center mb-2 border-b border-white/20 pb-1">
            <h3 className="text-sm font-medium">Banner Cache Controls</h3>
            <button 
              onClick={() => setIsExpanded(false)}
              className="text-white/70 hover:text-white"
            >
              ×
            </button>
          </div>
          
          <div className="flex flex-col gap-2">
            <button 
              onClick={handleClearCache}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded"
            >
              Clear Banner Cache
            </button>
            
            <button 
              onClick={handleForceReload}
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-2 py-1 rounded"
            >
              Force Banner Reload
            </button>
            
            <button 
              onClick={handleTestImages}
              className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 rounded"
            >
              Test Banner Images
            </button>
          </div>
          
          {(recentClears > 0 || testResult) && (
            <div className="mt-2 text-xs border-t border-white/20 pt-1">
              {recentClears > 0 && (
                <p className="text-blue-300">Cleared {recentClears} cached items</p>
              )}
              {testResult && (
                <p className={testResult.success ? "text-green-300" : "text-red-300"}>
                  {testResult.message}
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <button 
          onClick={() => setIsExpanded(true)}
          className="bg-black/60 hover:bg-black/80 text-white rounded-full p-2 shadow-lg backdrop-blur-sm"
          title="Banner Cache Controls"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      )}
    </div>
  );
}