import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { useContentVersions, type ContentVersion } from '@/hooks/use-content-versions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HistoryIcon, ClockIcon, CheckIcon, ArrowLeftIcon, RefreshCwIcon, AlertCircleIcon, ShieldAlertIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/hooks/use-permissions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface ContentVersionHistoryProps {
  contentId?: number;
  slug?: string;
  onRestore?: () => void;
}

export function ContentVersionHistory({ contentId, slug, onRestore }: ContentVersionHistoryProps) {
  const { isAdmin } = usePermissions();
  const [isOpen, setIsOpen] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<ContentVersion | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const lastSlugRef = useRef<string | undefined>(slug);
  
  // Get content versions data and functions
  const { 
    versions, 
    isLoading, 
    error,
    selectedVersion, 
    setSelectedVersion, 
    restoreVersion, 
    isRestoring 
  } = useContentVersions(contentId, slug);
  
  // Handle version history reset event (shared with EditableContent)
  const handleVersionHistoryReset = useCallback((event: CustomEvent) => {
    const eventSlug = event.detail?.slug;
    console.log(`📢 [ContentVersionHistory] Received reset-version-history event for ${eventSlug}`);
    
    // Only reset if we're on the same page (match by slug)
    if (eventSlug && eventSlug === slug) {
      console.log(`🔄 [ContentVersionHistory] Resetting version history state for ${eventSlug}`);
      setSelectedVersion(null);
      setPreviewVersion(null);
      setJsonError(null);
      
      // Close dialog if open during page navigation
      if (isOpen) {
        setIsOpen(false);
      }
    }
  }, [slug, setSelectedVersion, isOpen, setPreviewVersion]);
  
  // Setup event listener for version history reset
  useEffect(() => {
    console.log(`[ContentVersionHistory] Setting up event listener for reset-version-history (slug: ${slug})`);
    
    // Add event listener
    window.addEventListener('reset-version-history', handleVersionHistoryReset as EventListener);
    
    // Clean up
    return () => {
      window.removeEventListener('reset-version-history', handleVersionHistoryReset as EventListener);
    };
  }, [handleVersionHistoryReset, slug]);
  
  // Reset state when slug changes (page navigation)
  useEffect(() => {
    if (lastSlugRef.current !== slug && lastSlugRef.current !== undefined) {
      console.log(`🔄 [ContentVersionHistory] Slug changed from ${lastSlugRef.current} to ${slug}, resetting state`);
      setSelectedVersion(null);
      setPreviewVersion(null);
      setJsonError(null);
      
      // Close dialog if open during page navigation
      if (isOpen) {
        setIsOpen(false);
      }
    }
    
    // Update ref for next comparison
    lastSlugRef.current = slug;
  }, [slug, setSelectedVersion, isOpen]);
  
  // Return null for non-admin users, but only after all hooks have run
  if (!isAdmin) {
    console.log("ContentVersionHistory: User is not admin, not rendering button");
    return null;
  }
  
  useEffect(() => {
    // Debug logging to help trace issues
    console.log(`ContentVersionHistory mounted with contentId=${contentId}, slug=${slug}, isAdmin=${isAdmin}`);
  }, [contentId, slug, isAdmin]);
  
  // Parse JSON content safely for preview
  const getFormattedContent = (content: string) => {
    if (!content) {
      setJsonError("Content is empty");
      return "No content available";
    }
    
    if (content.startsWith('[') && content.endsWith(']')) {
      try {
        // For JSON content (e.g., banner slides)
        setJsonError(null);
        return JSON.stringify(JSON.parse(content), null, 2);
      } catch (e) {
        console.error("Error parsing JSON content:", e);
        setJsonError("Invalid JSON format. This version may be corrupted.");
        // Return the raw content if parsing fails
        return content;
      }
    }
    // For HTML content
    setJsonError(null);
    return content;
  };
  
  // Reset error state when changing preview version
  useEffect(() => {
    if (previewVersion) {
      getFormattedContent(previewVersion.content);
    } else {
      setJsonError(null);
    }
  }, [previewVersion]);
  
  // Ensure either contentId or slug is provided
  if (!contentId && !slug) {
    console.log("ContentVersionHistory: No contentId or slug provided, not rendering button");
    return null;
  }
  
  const handleRestore = () => {
    if (selectedVersion) {
      if (jsonError) {
        toast({
          title: "Warning",
          description: "This version appears to be corrupted. Restoring it may cause problems.",
          variant: "destructive",
        });
        
        // Show confirmation toast asking if they really want to restore
        toast({
          title: "Confirm Restore",
          description: "Are you sure you want to restore this potentially corrupted version?",
          action: (
            <Button variant="destructive" onClick={() => {
              // Proceed with restore if confirmed
              actuallyRestore();
            }}>
              Restore Anyway
            </Button>
          ),
        });
      } else {
        // No errors, proceed with restore
        actuallyRestore();
      }
    }
  };
  
  const actuallyRestore = () => {
    if (selectedVersion) {
      console.log(`Restoring version ${selectedVersion.id}`);
      
      toast({
        title: "Restoring content",
        description: `Restoring to version ${selectedVersion.versionNumber}...`,
        duration: 5000, // Show longer toast for better feedback
      });
      
      // Close the dialog immediately to improve perceived performance
      setIsOpen(false);
      
      // Save important information before proceeding
      const currentHash = window.location.hash;
      const currentSlug = slug || (selectedVersion.slug ? selectedVersion.slug : null);
      
      console.log(`🔒 Saved current state: hash=${currentHash}, slug=${currentSlug}`);
      
      // Start the restoration process
      restoreVersion(selectedVersion.id);
      
      // Call onRestore callback if provided
      if (onRestore) {
        console.log("Calling onRestore callback after version restoration");
        onRestore();
      }
    }
  };
  
  const handlePreview = (version: ContentVersion) => {
    setPreviewVersion(version);
    setJsonError(null);
  };
  
  const handleClosePreview = () => {
    setPreviewVersion(null);
    setJsonError(null);
  };
  
  const refreshVersions = async () => {
    setIsRefreshing(true);
    
    try {
      // Force refresh of the versions
      console.log("Force refreshing version history");
      await queryClient.invalidateQueries({ queryKey: ['content-versions', contentId] });
      await queryClient.invalidateQueries({ queryKey: ['content-versions-by-slug', slug] });
      
      // Force refetch
      if (contentId) {
        await queryClient.fetchQuery({ queryKey: ['content-versions', contentId] });
      }
      
      if (slug) {
        await queryClient.fetchQuery({ queryKey: ['content-versions-by-slug', slug] });
      }
      
      toast({
        title: "Refreshed",
        description: "Version history has been refreshed",
      });
    } catch (e) {
      console.error("Error refreshing versions:", e);
      toast({
        title: "Error",
        description: "Failed to refresh version history",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Sort versions by version number descending
  const sortedVersions = versions ? [...versions].sort((a, b) => b.versionNumber - a.versionNumber) : [];
  
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1"
      >
        <HistoryIcon className="h-4 w-4" />
        <span>Version History</span>
      </Button>
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Content Version History</span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0" 
                onClick={refreshVersions}
                disabled={isRefreshing || isLoading}
              >
                <RefreshCwIcon className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="sr-only">Refresh</span>
              </Button>
            </DialogTitle>
            <DialogDescription>
              View and restore previous versions of this content.
              {slug && <span className="ml-1 font-medium">({slug})</span>}
            </DialogDescription>
          </DialogHeader>
          
          {error && (
            <Alert variant="destructive">
              <AlertCircleIcon className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                Failed to load version history. Please try refreshing.
              </AlertDescription>
            </Alert>
          )}
          
          {(isLoading || isRefreshing) ? (
            <div className="py-8 text-center">Loading version history...</div>
          ) : !versions || versions.length === 0 ? (
            <div className="py-8 text-center">No version history available for this content.</div>
          ) : (
            <Tabs defaultValue="versions">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="versions">Versions ({sortedVersions.length})</TabsTrigger>
                <TabsTrigger value="preview" disabled={!previewVersion}>Preview</TabsTrigger>
              </TabsList>
              
              <TabsContent value="versions">
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Version</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead className="w-[180px]">Created</TableHead>
                        <TableHead className="w-[150px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedVersions.map((version: ContentVersion) => (
                        <TableRow 
                          key={version.id}
                          className={selectedVersion?.id === version.id ? 'bg-primary/10' : ''}
                        >
                          <TableCell>
                            <Badge variant="outline">v{version.versionNumber}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[300px] truncate font-medium">
                              {version.title || "Untitled Version"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <ClockIcon className="h-3 w-3" />
                              {format(new Date(version.createdAt), 'MMM d, yyyy h:mm a')}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handlePreview(version)}
                              >
                                View
                              </Button>
                              <Button 
                                variant={selectedVersion?.id === version.id ? "default" : "outline"} 
                                size="sm"
                                onClick={() => setSelectedVersion(version)}
                              >
                                {selectedVersion?.id === version.id && <CheckIcon className="mr-1 h-3 w-3" />}
                                Select
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
              
              <TabsContent value="preview">
                {previewVersion && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleClosePreview}
                      >
                        <ArrowLeftIcon className="mr-1 h-3 w-3" />
                        Back to versions
                      </Button>
                      <Badge variant="outline" className="ml-auto">
                        Version {previewVersion.versionNumber}
                      </Badge>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(previewVersion.createdAt), 'MMM d, yyyy h:mm a')}
                      </div>
                    </div>
                    
                    {jsonError && (
                      <Alert variant="destructive" className="mb-4">
                        <ShieldAlertIcon className="h-4 w-4" />
                        <AlertTitle>Warning: Potential Corruption</AlertTitle>
                        <AlertDescription>
                          {jsonError} Restoring this version may cause problems.
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    <div className="border rounded-md p-4 mb-4">
                      <h3 className="text-lg font-bold mb-2">{previewVersion.title || "Untitled Version"}</h3>
                      
                      {previewVersion.content.startsWith('[') && previewVersion.content.endsWith(']') ? (
                        <div className="p-2 bg-muted rounded text-xs font-mono overflow-x-auto">
                          <pre>{getFormattedContent(previewVersion.content)}</pre>
                        </div>
                      ) : (
                        <div 
                          className="prose max-w-full"
                          dangerouslySetInnerHTML={{ __html: previewVersion.content }}
                        />
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button 
              disabled={!selectedVersion || isRestoring} 
              variant={jsonError && previewVersion?.id === selectedVersion?.id ? "destructive" : "default"}
              onClick={handleRestore}
            >
              {isRestoring ? 'Restoring...' : (
                jsonError && previewVersion?.id === selectedVersion?.id ? 
                  'Restore (With Caution)' : 
                  'Restore Selected Version'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}