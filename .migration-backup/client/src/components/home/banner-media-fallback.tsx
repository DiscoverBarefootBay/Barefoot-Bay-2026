import React from 'react';
import { AlertCircle } from 'lucide-react';

interface BannerMediaFallbackProps {
  error?: Error | string;
  className?: string;
  onRetry?: () => void;
}

/**
 * Banner Media Fallback Component
 * 
 * Displays a fallback UI when banner media (images or videos) fail to load
 * Ensures the application doesn't crash when media fails to load
 */
export const BannerMediaFallback = ({ 
  error, 
  className = '',
  onRetry 
}: BannerMediaFallbackProps) => {
  const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to load media';
  
  return (
    <div 
      className={`flex flex-col items-center justify-center bg-gray-100 rounded-md border border-gray-200 p-4 ${className}`}
      style={{ minHeight: '200px' }}
    >
      <div className="flex flex-col items-center text-center max-w-md">
        <AlertCircle className="w-10 h-10 text-amber-500 mb-2" />
        <h3 className="text-lg font-semibold text-gray-800">Media Unavailable</h3>
        <p className="text-sm text-gray-600 mt-1 mb-3">{errorMessage}</p>
        
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
          >
            Retry Loading
          </button>
        )}
      </div>
    </div>
  );
};

export default BannerMediaFallback;