import React from 'react';
import { useEffect } from 'react';

interface MediaFallbackProps {
  category?: string;
  color?: string;
  width?: number;
  height?: number;
}

/**
 * Generate a simple SVG placeholder for missing media
 */
export function MediaFallback({ 
  category = 'event', 
  color = '#3b82f6', 
  width = 800, 
  height = 450 
}: MediaFallbackProps) {
  // Create an SVG placeholder and save it to the uploads folder on mount
  useEffect(() => {
    // This is just for initial setup - will run once and create placeholder files
    const createPlaceholderFiles = async () => {
      try {
        const svgContent = generatePlaceholderSVG(category, color, width, height);
        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const formData = new FormData();
        formData.append('mediaFile', blob, 'placeholder-banner.svg');
        
        // Upload the SVG placeholder
        await fetch('/api/content/upload-media', {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });
        
        console.log('Created placeholder image');
      } catch (error) {
        console.error('Failed to create placeholder image:', error);
      }
    };
    
    // Only run this once when the component mounts
    if (typeof window !== 'undefined') {
      const placeholderCreated = localStorage.getItem('placeholder-images-created');
      if (!placeholderCreated) {
        createPlaceholderFiles().then(() => {
          localStorage.setItem('placeholder-images-created', 'true');
        });
      }
    }
  }, [category, color, width, height]);
  
  return null; // This component doesn't render anything
}

/**
 * Generate a simple SVG placeholder
 */
export function generatePlaceholderSVG(
  category: string, 
  color: string, 
  width: number, 
  height: number
): string {
  const capitalizedCategory = category.charAt(0).toUpperCase() + category.slice(1);
  
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="#f3f4f6" />
      <rect x="0" y="0" width="100%" height="100%" fill="url(#gradient)" />
      
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${color}15" />
          <stop offset="100%" stop-color="${color}30" />
        </linearGradient>
      </defs>
      
      <g fill="${color}" transform="translate(${width / 2}, ${height / 2})">
        <circle cx="0" cy="-50" r="40" opacity="0.2" />
        <rect x="-60" y="20" width="120" height="60" rx="4" opacity="0.1" />
      </g>
      
      <text x="50%" y="45%" font-family="Arial" font-size="24" text-anchor="middle" fill="${color}">
        ${capitalizedCategory} Photo
      </text>
      <text x="50%" y="55%" font-family="Arial" font-size="16" text-anchor="middle" fill="#6b7280">
        Image Unavailable
      </text>
    </svg>
  `;
}

/**
 * Export a simple in-line SVG fallback data URL to use anywhere
 */
export const getFallbackImageDataUrl = (category: string = 'event'): string => {
  const svg = generatePlaceholderSVG(category, '#3b82f6', 800, 450);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

export default MediaFallback;