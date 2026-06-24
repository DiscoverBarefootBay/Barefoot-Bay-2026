import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/**
 * A utility component to help users clear their browser cache
 * especially helpful for media files like banner slides
 */
export function CacheClearer() {
  const [cleared, setCleared] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [itemsCleared, setItemsCleared] = useState(0);
  const { toast } = useToast();

  // Function to clear all items from localStorage that match media cache patterns
  const clearMediaCache = () => {
    setIsClearing(true);
    let count = 0;

    try {
      // Clear localStorage items related to media cache
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('media-cache:') || 
            key.includes('-timestamp') || 
            key.includes('communityBannerSlides')) {
          localStorage.removeItem(key);
          count++;
        }
      });

      // Try to clear the Cache API if available (more modern browsers)
      if ('caches' in window) {
        caches.keys().then(cacheNames => {
          cacheNames.forEach(cacheName => {
            if (cacheName.includes('image-cache') || cacheName.includes('media-cache')) {
              caches.delete(cacheName);
              count++;
            }
          });
        });
      }

      // Clear session storage as well
      Object.keys(sessionStorage).forEach(key => {
        if (key.includes('media') || key.includes('banner') || key.includes('image')) {
          sessionStorage.removeItem(key);
          count++;
        }
      });

      // Update state with results
      setItemsCleared(count);
      setCleared(true);
      
      // Show toast notification
      toast({
        title: "Cache Cleared",
        description: `Successfully cleared ${count} cached items. Refresh the page to see updated content.`,
        variant: "default"
      });
    } catch (error) {
      console.error('Error clearing cache:', error);
      toast({
        title: "Error Clearing Cache",
        description: "There was a problem clearing your cache. Please try refreshing the page.",
        variant: "destructive"
      });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-4">
      {cleared && (
        <Alert variant="success" className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle>Cache Cleared!</AlertTitle>
          <AlertDescription>
            Cleared {itemsCleared} cached items from localStorage.
            <br />
            <span className="text-sm font-medium">
              Please refresh the page to ensure you see the latest content.
            </span>
          </AlertDescription>
        </Alert>
      )}

      <Button 
        variant={cleared ? "outline" : "default"} 
        className="flex items-center gap-2" 
        onClick={clearMediaCache}
        disabled={isClearing}
      >
        {isClearing ? (
          <>
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Clearing Cache...
          </>
        ) : (
          <>
            <Trash2 className="h-4 w-4" />
            {cleared ? "Clear Cache Again" : "Clear Media Cache"}
          </>
        )}
      </Button>
      
      <p className="text-xs text-muted-foreground mt-1">
        Click this button if you're seeing outdated images or videos.
        This will clear your local browser cache and refresh the content.
      </p>
    </div>
  );
}