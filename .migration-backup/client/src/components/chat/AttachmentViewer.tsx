import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getMediaUrl } from '../../lib/media-helper';

interface Attachment {
  id: string;
  url: string;
  filename: string;
  contentType?: string;
}

interface AttachmentViewerProps {
  attachments: Attachment[];
  initialIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AttachmentViewer: React.FC<AttachmentViewerProps> = ({
  attachments,
  initialIndex,
  open,
  onOpenChange
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  
  // Reset index when attachments change
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [attachments, initialIndex]);

  // Debug logs to track component state
  useEffect(() => {
    if (open) {
      console.log("AttachmentViewer OPENED with:", { 
        attachmentsCount: attachments.length,
        initialIndex,
        currentIndex 
      });
      
      if (attachments && attachments.length > 0) {
        console.log("First attachment:", attachments[0]);
      }
    }
  }, [open, attachments, initialIndex, currentIndex]);

  // Enhanced debugging for component state
  useEffect(() => {
    console.log(`AttachmentViewer state changed - open: ${open}, attachments: ${attachments?.length || 0}`);
  }, [open, attachments]);

  // No need to render if not open
  if (!open) return null;
  
  // Safety check for empty attachments
  if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
    console.warn("AttachmentViewer opened with no attachments:", attachments);
    
    return createPortal(
      <div className="fixed inset-0 z-[9999] bg-black bg-opacity-80 flex items-center justify-center"
           onClick={() => onOpenChange(false)}>
        <div className="bg-white p-8 rounded-lg text-center">
          <p>No attachments available to display</p>
          <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenChange(false);
                  }}>
            Close
          </button>
        </div>
      </div>,
      document.body
    );
  }
  
  // Safely get the current attachment with bounds checking
  const currentAttachment = attachments[Math.min(currentIndex, attachments.length - 1)];
  
  // Handle navigation
  const goToPrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : attachments.length - 1));
  };
  
  const goToNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev < attachments.length - 1 ? prev + 1 : 0));
  };
  
  // Determine file type with enhanced logging
  const fileExt = currentAttachment?.filename.split('.').pop()?.toLowerCase() || '';
  console.log(`[AttachmentViewer] File extension detected: "${fileExt}" for file: ${currentAttachment?.filename}`);
  
  // Use more inclusive file type detection with better logging
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(fileExt);
  const isVideo = ['mp4', 'webm', 'mov', 'avi', 'wmv', 'mkv', 'm4v'].includes(fileExt);
  const isPDF = fileExt === 'pdf';
  
  console.log(`[AttachmentViewer] File type detection: isImage=${isImage}, isVideo=${isVideo}, isPDF=${isPDF}`);
  
  // Also log the transformed URL for debugging
  const transformedUrl = getMediaUrl(currentAttachment.url, 'attachment');
  console.log(`[AttachmentViewer] Attachment details:`, {
    originalUrl: currentAttachment.url,
    transformedUrl,
    filename: currentAttachment.filename,
    fileType: isImage ? 'image' : isVideo ? 'video' : isPDF ? 'pdf' : 'other'
  });
  
  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] bg-black bg-opacity-80 flex items-center justify-center"
      onClick={() => onOpenChange(false)}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {/* Close button */}
      <button 
        className="absolute top-4 right-4 text-white p-2 hover:bg-gray-700 rounded-full"
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange(false);
        }}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      
      {/* Navigation buttons */}
      {attachments.length > 1 && (
        <>
          <button 
            className="absolute left-4 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70"
            onClick={(e) => {
              e.stopPropagation();
              goToPrevious(e);
            }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button 
            className="absolute right-4 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70"
            onClick={(e) => {
              e.stopPropagation();
              goToNext(e);
            }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}
      
      {/* Attachment display */}
      <div className="max-w-4xl max-h-[90vh] w-full h-full p-4 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {/* Use the media helper to ensure consistent URL handling */}
        {isImage ? (
          <img 
            src={getMediaUrl(currentAttachment.url, 'attachment')} 
            alt={currentAttachment.filename}
            className="max-w-full max-h-full object-contain"
            data-fallback-index="0"
            onLoad={(e) => {
              console.log(`[AttachmentViewer] Successfully loaded image: ${e.currentTarget.src}`);
            }}
            onError={(e) => {
              console.error(`[AttachmentViewer] Failed to load image: ${getMediaUrl(currentAttachment.url, 'attachment')}`);
              
              // Enhanced fallback system - try multiple paths in sequence
              const filename = currentAttachment.filename.split('/').pop() || '';
              const fallbackUrls = [
                `/attachments/${filename}`,
                `/uploads/attachments/${filename}`,
                `/api/storage-proxy/MESSAGES/attachments/${filename}`,
                `/api/attachments/${filename}`
              ];
              
              const imgElement = e.currentTarget;
              const fallbackIndex = parseInt(imgElement.getAttribute('data-fallback-index') || '0', 10);
              
              console.log(`[AttachmentViewer] Trying fallback URL ${fallbackIndex + 1}/${fallbackUrls.length}`);
              
              if (fallbackIndex < fallbackUrls.length) {
                // Try the next fallback URL
                const nextUrl = fallbackUrls[fallbackIndex];
                console.log(`[AttachmentViewer] Trying alternative URL: ${nextUrl}`);
                imgElement.setAttribute('data-fallback-index', (fallbackIndex + 1).toString());
                imgElement.src = nextUrl;
              } else {
                // We've exhausted all fallbacks, use placeholder
                console.log(`[AttachmentViewer] All fallbacks failed, using placeholder`);
                imgElement.src = '/public/media-placeholder/image-placeholder.png';
                
                // Show error message on screen
                const parent = imgElement.parentElement;
                if (parent && parent.parentElement) {
                  const errorMessage = document.createElement('div');
                  errorMessage.className = 'absolute bottom-4 left-0 right-0 bg-red-600 text-white text-center py-2';
                  errorMessage.textContent = 'Could not load attachment';
                  parent.parentElement.appendChild(errorMessage);
                }
              }
            }}
          />
        ) : isVideo ? (
          <video 
            src={getMediaUrl(currentAttachment.url, 'attachment')}
            controls
            autoPlay
            className="max-w-full max-h-full"
            onError={(e) => {
              console.error(`Failed to load video: ${getMediaUrl(currentAttachment.url, 'attachment')}`);
            }}
          />
        ) : isPDF ? (
          <iframe 
            src={getMediaUrl(currentAttachment.url, 'attachment')}
            title={currentAttachment.filename}
            className="w-full h-full bg-white"
            onError={(e) => {
              console.error(`Failed to load PDF: ${getMediaUrl(currentAttachment.url, 'attachment')}`);
            }}
          />
        ) : (
          <div className="bg-white p-8 rounded-lg text-center">
            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-xl font-medium mb-2">{currentAttachment.filename}</h3>
            <p className="mb-4 text-gray-500">This file type cannot be previewed</p>
            <a 
              href={getMediaUrl(currentAttachment.url, 'attachment')} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={(e) => e.stopPropagation()}
            >
              Download File
            </a>
          </div>
        )}
      </div>
      
      {/* Pagination indicator */}
      {attachments.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center">
          <div className="bg-black bg-opacity-50 px-4 py-2 rounded-full text-white text-sm">
            {currentIndex + 1} / {attachments.length}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

export default AttachmentViewer;