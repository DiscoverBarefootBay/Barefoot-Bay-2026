import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { 
  Trash2, AlertTriangle, Settings, Upload, Home, FileX, History, 
  CreditCard, ShoppingBag, Package, Map, Search, Globe, Store,
  MessageSquare, File, ToggleLeft, FileSearch, RefreshCw, Check, Search as SearchIcon,
  X, Save
} from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { BulkEventUpload } from "@/components/calendar/bulk-event-upload";
import { BulkListingUpload } from "@/components/for-sale/bulk-listing-upload";
import SquareStatusChecker from "@/components/for-sale/square-status-checker";
import SquareApiEditor from "@/components/for-sale/square-api-editor";
import PrintfulApiEditor from "@/components/print-service/printful-api-editor";
import PrintfulStatusChecker from "@/components/print-service/printful-status-checker";
import GoogleApiEditor from "@/components/maps/google-api-editor";
import GoogleStatusChecker from "@/components/maps/google-status-checker";


import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export default function AdvancedSettings() {
  const { isAdmin } = usePermissions();
  const { toast } = useToast();
  
  // State for media preview
  const [previewFiles, setPreviewFiles] = useState<string[]>([]);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  
  // Delete all events mutation
  const deleteAllEventsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/events', {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete all events');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({
        title: "Success",
        description: "All calendar events have been deleted"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Delete all store products mutation
  const deleteAllProductsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/products/', {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete all store products');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Success",
        description: "All store products have been deleted"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Delete all forum content mutation
  const deleteAllForumContentMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/forum/all', {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete all forum content');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/forum"] });
      toast({
        title: "Success",
        description: `All forum content deleted: ${data.deletedCounts.deletedPosts} posts, ${data.deletedCounts.deletedComments} comments, ${data.deletedCounts.deletedReactions} reactions`
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Delete all forum comments mutation
  const deleteAllForumCommentsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/forum/comments/all', {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete all forum comments');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/forum"] });
      toast({
        title: "Success",
        description: `All forum comments deleted: ${data.deletedCounts.deletedComments} comments, ${data.deletedCounts.deletedReactions} comment reactions`
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Delete all property listings mutation
  const deleteAllListingsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/listings', {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete all property listings');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      toast({
        title: "Success",
        description: "All property listings have been deleted"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Check for missing media files mutation
  const checkMissingMediaMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/check/missing-media', {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to check for missing media files');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      if (data.missingCount === 0) {
        toast({
          title: "Success",
          description: "No missing media files found!"
        });
      } else {
        toast({
          title: "Found Missing Media",
          description: `Found ${data.missingCount} missing media files referenced in the database`,
          variant: "destructive"
        });
        
        // Open a dialog showing details or console log them
        console.log("Missing media details:", data.missingFiles);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Preview unused media files mutation
  const previewUnusedMediaMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/preview/media', {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to preview unused media files');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      if (data.fileCount === 0) {
        toast({
          title: "No Files to Clean",
          description: "No unused media files were found. Everything is already clean!"
        });
      } else {
        toast({
          title: "Preview Generated",
          description: `Found ${data.fileCount} unused media files that could be deleted`
        });
        
        // Store preview data in state
        setPreviewFiles(data.filesToDelete);
        setShowPreviewDialog(true);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Clean up unused media files mutation
  const deleteUnusedMediaMutation = useMutation({
    mutationFn: async (files?: string[]) => {
      const response = await fetch('/api/admin/cleanup/media', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          confirmFiles: files // Send the list of files to confirm
        }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        // If we get a conflict error (409), the files have changed since preview
        if (response.status === 409) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Files have changed since preview. Please refresh the preview.');
        }
        throw new Error('Failed to clean up unused media files');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Successfully deleted ${data.deletedCount} unused media files`
      });
      setShowPreviewDialog(false); // Close the preview dialog
      setPreviewFiles([]); // Clear preview files
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Clean up unused media files and fix database references mutation
  const fixMissingMediaRefsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/cleanup/media', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fixMissingRefs: true }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to clean up and fix media references');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      let message = `Successfully deleted ${data.deletedCount} unused media files`;
      if (data.fixedReferences) {
        message += ` and fixed ${data.fixedReferences.count} database references to missing files`;
      }
      
      toast({
        title: "Success",
        description: message
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Backup media files mutation
  const backupMediaMutation = useMutation({
    mutationFn: async (folder: string) => {
      try {
        console.log(`Initiating backup for folder: ${folder}`);
        
        // Import the special API helper function
        const { backupMedia } = await import('@/lib/api-helpers');
        
        // Use the specialized backup function
        return await backupMedia(folder);
      } catch (error) {
        console.error(`Error in backup operation for ${folder}:`, error);
        throw error;
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Successfully backed up ${data.backupCount} media files to ${data.backupPath}`
      });
    },
    onError: (error) => {
      console.error("Backup error:", error);
      toast({
        title: "Backup failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    }
  });
  
  // Restore media from backup mutation
  const restoreMediaMutation = useMutation({
    mutationFn: async ({ backupFolder, targetFolder }: { backupFolder: string, targetFolder: string }) => {
      try {
        console.log(`Initiating restore from ${backupFolder} to ${targetFolder}`);
        
        // Import the special API helper function
        const { restoreMedia } = await import('@/lib/api-helpers');
        
        // Use the specialized restore function
        return await restoreMedia(backupFolder, targetFolder);
      } catch (error) {
        console.error(`Error in restore operation from ${backupFolder} to ${targetFolder}:`, error);
        throw error;
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Successfully restored ${data.restoredCount} media files`
      });
    },
    onError: (error) => {
      console.error("Restore error:", error);
      toast({
        title: "Restore failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    }
  });
  
  // Clean up old content versions mutation
  const deleteOldContentVersionsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/cleanup/content-versions', {
        method: 'POST',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to clean up old content versions');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Successfully deleted ${data.deletedCount} old content versions`
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Delete all vendors mutation
  const deleteAllVendorsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/vendors', {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete all vendors');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      toast({
        title: "Success",
        description: "All vendors have been deleted"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Delete specific community pages mutation
  const deleteCommunityPagesMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/pages/community', {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete community pages');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      toast({
        title: "Success",
        description: `Successfully deleted ${data.count} community pages`
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Delete ALL community pages (from the More section) mutation
  const deleteAllCommunityPagesMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/pages/all-community', {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete all community pages');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      toast({
        title: "Success",
        description: `Successfully deleted ${data.count} community pages from all categories`
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  if (!isAdmin) {
    return (
      <div className="container max-w-4xl mx-auto py-10">
        <h1 className="text-3xl font-bold mb-6">Advanced Settings</h1>
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You need administrator privileges to access this page
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Helper function to handle file selection
  const toggleFileSelection = (file: string) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(file)) {
      newSelection.delete(file);
    } else {
      newSelection.add(file);
    }
    setSelectedFiles(newSelection);
  };
  
  // Helper function to toggle all files
  const toggleAllFiles = () => {
    if (selectedFiles.size === filteredFiles.length) {
      // If all are selected, deselect all
      setSelectedFiles(new Set());
    } else {
      // Otherwise select all filtered files
      setSelectedFiles(new Set(filteredFiles));
    }
  };
  
  // Filter files based on search text
  const filteredFiles = previewFiles.filter(file => 
    !filterText || file.toLowerCase().includes(filterText.toLowerCase())
  );
  
  // Proceed with deletion of selected files
  const handleConfirmDeletion = () => {
    if (selectedFiles.size === 0) {
      toast({
        title: "No Files Selected",
        description: "Please select at least one file to delete.",
        variant: "destructive"
      });
      return;
    }
    
    deleteUnusedMediaMutation.mutate(Array.from(selectedFiles));
  };

  return (
    <div className="container max-w-4xl mx-auto py-10">
      <div className="flex items-center mb-6">
        <Settings className="h-8 w-8 mr-3" />
        <h1 className="text-3xl font-bold">Advanced Settings</h1>
      </div>
      
      <p className="text-muted-foreground mb-8">
        This page contains advanced administrative functions for the Barefoot Bay community platform.
        Please use caution when performing these actions, as most of them cannot be undone.
      </p>
      
      {/* Media Files Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <FileSearch className="mr-2 h-5 w-5" />
              Media Files Preview
            </DialogTitle>
            <DialogDescription>
              {previewFiles.length} files were found that are not referenced in the database. 
              Select the files you want to delete and click "Confirm Deletion".
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex items-center space-x-2 my-4">
            <Input 
              placeholder="Filter files..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="flex-1"
              autoFocus
            />
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setFilterText("")}
              disabled={!filterText}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <input 
                type="checkbox" 
                id="select-all"
                className="w-4 h-4 rounded"
                checked={filteredFiles.length > 0 && selectedFiles.size === filteredFiles.length}
                onChange={toggleAllFiles}
              />
              <label htmlFor="select-all" className="text-sm">
                Select All ({selectedFiles.size}/{filteredFiles.length})
              </label>
            </div>
            <div className="text-sm text-muted-foreground">
              {filteredFiles.length} of {previewFiles.length} files shown
            </div>
          </div>
          
          <ScrollArea className="flex-1 border rounded-md">
            {filteredFiles.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                No files match your filter criteria
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredFiles.map((file, index) => (
                  <div 
                    key={index} 
                    className={`flex items-center p-2 rounded-md hover:bg-muted ${selectedFiles.has(file) ? 'bg-muted/50' : ''}`}
                  >
                    <input 
                      type="checkbox" 
                      id={`file-${index}`}
                      className="w-4 h-4 mr-3 rounded"
                      checked={selectedFiles.has(file)}
                      onChange={() => toggleFileSelection(file)}
                    />
                    <label 
                      htmlFor={`file-${index}`} 
                      className="flex-1 text-sm cursor-pointer truncate"
                      title={file}
                    >
                      {file}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          
          <DialogFooter className="mt-6 space-x-2">
            <Button 
              variant="ghost" 
              onClick={() => setShowPreviewDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmDeletion}
              disabled={selectedFiles.size === 0 || deleteUnusedMediaMutation.isPending}
            >
              {deleteUnusedMediaMutation.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Confirm Deletion ({selectedFiles.size} files)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <div className="space-y-8">
        {/* Feature Flag Management has been moved to the Admin Dashboard */}

        {/* Calendar Management Card */}
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="flex items-center text-destructive">
              <Trash2 className="h-5 w-5 mr-2" />
              Calendar Management
            </CardTitle>
            <CardDescription>
              Operations related to the community calendar and events
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6">
              {/* Bulk Event Upload Section */}
              <div className="flex items-start gap-4 pb-6 border-b border-border">
                <Upload className="h-10 w-10 text-blue-500 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-medium">Bulk Upload Events</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-3">
                    Upload multiple events at once using a CSV or JSON file with the proper format.
                    Use this feature to quickly populate the community calendar with recurring events.
                  </p>
                  <BulkEventUpload />
                </div>
              </div>
              
              {/* Delete All Events Section */}
              <div className="flex items-start gap-4">
                <AlertTriangle className="h-10 w-10 text-amber-500 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-medium">Delete All Calendar Events</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-3">
                    This will permanently delete all events from the community calendar.
                    This action cannot be undone and will remove all event comments, 
                    interactions, and related data.
                  </p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="gap-2">
                        <Trash2 className="h-4 w-4" />
                        Delete All Events
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete ALL events
                          and remove them from the calendar.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={(e) => deleteAllEventsMutation.mutate()}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {deleteAllEventsMutation.isPending ? "Deleting..." : "Delete All Events"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* For Sale Management Card */}
        <Card className="border-info/20">
          <CardHeader>
            <CardTitle className="flex items-center text-blue-600">
              <Home className="h-5 w-5 mr-2" />
              For Sale Management
            </CardTitle>
            <CardDescription>
              Operations related to property listings and items for sale
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6">
              {/* Bulk Listing Upload Section */}
              <div className="flex items-start gap-4 pb-6 border-b border-border">
                <Upload className="h-10 w-10 text-blue-500 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-medium">Bulk Upload Listings</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-3">
                    Upload multiple property listings at once using a CSV file with the proper format.
                    Use this feature to quickly populate the for sale listings database.
                  </p>
                  <BulkListingUpload />
                </div>
              </div>
              
              {/* Delete All Listings Section */}
              <div className="flex items-start gap-4">
                <AlertTriangle className="h-10 w-10 text-amber-500 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-medium">Delete All For Sale Listings</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-3">
                    This will permanently delete all property listings from the database.
                    This action cannot be undone and will remove all related property data.
                  </p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="gap-2">
                        <Trash2 className="h-4 w-4" />
                        Delete All Listings
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete ALL for sale 
                          listings and remove them from the database.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={(e) => deleteAllListingsMutation.mutate()}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {deleteAllListingsMutation.isPending ? "Deleting..." : "Delete All Listings"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Community Forum Management Card */}
        <Card className="border-orange-500/20">
          <CardHeader>
            <CardTitle className="flex items-center text-orange-600">
              <MessageSquare className="h-5 w-5 mr-2" />
              Community Forum Management
            </CardTitle>
            <CardDescription>
              Operations related to forum posts, comments, and reactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6">
              {/* Delete All Forum Content Section */}
              <div className="flex items-start gap-4 pb-6 border-b border-border">
                <AlertTriangle className="h-10 w-10 text-amber-500 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-medium">Delete All Forum Content</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-3">
                    This will permanently delete all forum posts, comments, and reactions from the database.
                    This action cannot be undone and will remove all community forum content.
                  </p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="gap-2">
                        <Trash2 className="h-4 w-4" />
                        Delete All Forum Content
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete ALL forum posts, 
                          comments, and reactions from the community forum.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={(e) => deleteAllForumContentMutation.mutate()}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {deleteAllForumContentMutation.isPending ? "Deleting..." : "Delete All Forum Content"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              
              {/* Delete All Forum Comments Section */}
              <div className="flex items-start gap-4">
                <AlertTriangle className="h-10 w-10 text-amber-500 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-medium">Delete All Forum Comments</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-3">
                    This will permanently delete all forum comments and their reactions, but will keep all forum posts.
                    This action cannot be undone.
                  </p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="gap-2">
                        <Trash2 className="h-4 w-4" />
                        Delete All Forum Comments
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete ALL forum
                          comments and their reactions, but will preserve the forum posts.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={(e) => deleteAllForumCommentsMutation.mutate()}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {deleteAllForumCommentsMutation.isPending ? "Deleting..." : "Delete All Forum Comments"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Payment System Management Card */}
        <Card className="border-green-500/20">
          <CardHeader>
            <CardTitle className="flex items-center text-green-600">
              <CreditCard className="h-5 w-5 mr-2" />
              Payment System
            </CardTitle>
            <CardDescription>
              Square payment integration settings and diagnostics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6">
              {/* Square Status Checker */}
              <div className="flex items-start gap-4 pb-6 border-b border-border">
                <CreditCard className="h-10 w-10 text-green-500 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-medium">Payment System Diagnostics</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-3">
                    Diagnose issues with the Square payment integration. This tool will check the connection
                    to the Square API and verify that the necessary credentials are configured correctly.
                  </p>
                  <SquareStatusChecker />
                </div>
              </div>
              
              {/* Square API Credentials Editor */}
              <div className="flex items-start gap-4">
                <CreditCard className="h-10 w-10 text-green-500 flex-shrink-0 mt-1" />
                <div className="w-full">
                  <h3 className="font-medium">Square API Credentials</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-3">
                    Update your Square API credentials to connect the website to your Square account.
                    You can find these credentials in the Square Developer Dashboard.
                  </p>
                  <SquareApiEditor />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Print-on-Demand Service Card */}
        <Card className="border-purple-500/20">
          <CardHeader>
            <CardTitle className="flex items-center text-purple-600">
              <ShoppingBag className="h-5 w-5 mr-2" />
              Print-on-Demand Service
            </CardTitle>
            <CardDescription>
              Printful integration settings and diagnostics for the community merchandise store
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6">
              {/* Printful Status Checker */}
              <div className="flex items-start gap-4 pb-6 border-b border-border">
                <Package className="h-10 w-10 text-purple-500 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-medium">Print-on-Demand Status</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-3">
                    Check the status of the Printful print-on-demand service integration. This tool will verify the
                    connection to the Printful API and display information about your store.
                  </p>
                  <PrintfulStatusChecker />
                </div>
              </div>
              
              {/* Printful API Credentials Editor */}
              <div className="flex items-start gap-4 pb-6 border-b border-border">
                <ShoppingBag className="h-10 w-10 text-purple-500 flex-shrink-0 mt-1" />
                <div className="w-full">
                  <h3 className="font-medium">Printful API Configuration</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-3">
                    Update your Printful API credentials to connect the website to your Printful store.
                    These settings are used for the community merchandise store.
                  </p>
                  <PrintfulApiEditor />
                </div>
              </div>
              
              {/* Delete All Store Products Section */}
              <div className="flex items-start gap-4">
                <Store className="h-10 w-10 text-amber-500 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-medium">Delete All Store Products</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-3">
                    This will permanently delete all products from the community store.
                    This action cannot be undone and will remove all product descriptions, 
                    images, and uploaded media.
                  </p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="gap-2">
                        <Trash2 className="h-4 w-4" />
                        Delete All Store Products
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete ALL products
                          from the community store, including descriptions and uploaded media.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={(e) => deleteAllProductsMutation.mutate()}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {deleteAllProductsMutation.isPending ? "Deleting..." : "Delete All Products"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Google APIs Card */}
        <Card className="border-blue-500/20">
          <CardHeader>
            <CardTitle className="flex items-center text-blue-600">
              <Globe className="h-5 w-5 mr-2" />
              Google APIs
            </CardTitle>
            <CardDescription>
              Google services integration settings for maps, AI search, and other features
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6">
              {/* Google API Status Checker */}
              <div className="flex items-start gap-4 pb-6 border-b border-border">
                <Map className="h-10 w-10 text-blue-500 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-medium">Google Services Status</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-3">
                    Check the status of Google API integrations. This tool will verify the connection
                    to Google Maps, Gemini AI, and other Google services used by the website.
                  </p>
                  <GoogleStatusChecker />
                </div>
              </div>
              
              {/* Google API Credentials Editor */}
              <div className="flex items-start gap-4">
                <Search className="h-10 w-10 text-blue-500 flex-shrink-0 mt-1" />
                <div className="w-full">
                  <h3 className="font-medium">Google API Configuration</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-3">
                    Update your Google API credentials to enable maps, AI-powered search, and other
                    Google services on the website. You can find these credentials in the Google Cloud Console.
                  </p>
                  <GoogleApiEditor />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Data Management Card */}
        <Card className="border-warning/20">
          <CardHeader>
            <CardTitle className="flex items-center text-amber-600">
              <FileX className="h-5 w-5 mr-2" />
              Data Management
            </CardTitle>
            <CardDescription>
              Operations related to system data cleanup and maintenance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6">
              {/* Media Checking Section */}
              <div className="flex items-start gap-4 pb-6 border-b border-border">
                <FileSearch className="h-10 w-10 text-blue-500 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-medium">Check for Missing Media Files</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-3">
                    This will scan your database for references to media files that don't exist in the filesystem. 
                    These missing files can cause "image failed to load" errors in the application.
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="gap-2 bg-blue-50 border-blue-200 hover:bg-blue-100"
                      onClick={(e) => checkMissingMediaMutation.mutate()}
                      disabled={checkMissingMediaMutation.isPending}
                    >
                      <FileSearch className="h-4 w-4 text-blue-600" />
                      {checkMissingMediaMutation.isPending ? "Checking..." : "Check for Missing Media"}
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Media Cleanup Section */}
              <div className="flex items-start gap-4 pb-6 border-b border-border">
                <FileX className="h-10 w-10 text-amber-500 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-medium">Media Cleanup Tools</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-3">
                    These tools help maintain your media files by removing unused files and fixing database references.
                    Always preview files first to ensure you don't delete important files.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button 
                      variant="outline" 
                      className="gap-2 bg-blue-50 border-blue-200 hover:bg-blue-100"
                      onClick={(e) => previewUnusedMediaMutation.mutate()}
                      disabled={previewUnusedMediaMutation.isPending}
                    >
                      {previewUnusedMediaMutation.isPending ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin mr-1" />
                          Scanning Media...
                        </>
                      ) : (
                        <>
                          <FileSearch className="h-4 w-4 text-blue-600" />
                          Preview & Select Files
                        </>
                      )}
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" className="gap-2 bg-amber-50 border-amber-200 hover:bg-amber-100">
                          <FileX className="h-4 w-4 text-amber-600" />
                          Delete Unused Media
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            It's recommended to use the "Preview Unused Files" button first to see which 
                            files will be deleted. If you continue without preview, all unused media files 
                            will be permanently deleted. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={(e) => deleteUnusedMediaMutation.mutate()}
                            className="bg-amber-600 hover:bg-amber-700"
                          >
                            {deleteUnusedMediaMutation.isPending ? "Cleaning up..." : "Delete Unused Files"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" className="gap-2 bg-green-50 border-green-200 hover:bg-green-100">
                          <RefreshCw className="h-4 w-4 text-green-600" />
                          Fix Missing References
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Fix missing media references?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove database references to media files that don't exist and also clean up unused 
                            media files. This helps resolve "image failed to load" errors. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={(e) => fixMissingMediaRefsMutation.mutate()}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            {fixMissingMediaRefsMutation.isPending ? "Fixing..." : "Fix References"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
              {/* Media Backup Tools has been moved to the Admin Dashboard */}
              
              {/* Content Version Cleanup Section */}
              <div className="flex items-start gap-4 pb-6 border-b border-border">
                <History className="h-10 w-10 text-amber-500 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-medium">Delete Old Content Versions</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-3">
                    This will delete old content versions while keeping the latest version of each page.
                    This can help reduce database size and improve performance.
                  </p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="gap-2 bg-amber-50 border-amber-200 hover:bg-amber-100">
                        <History className="h-4 w-4 text-amber-600" />
                        Cleanup Content Versions
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will delete all old content versions while keeping only the latest version of each page.
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteOldContentVersionsMutation.mutate()}
                          className="bg-amber-600 hover:bg-amber-700"
                        >
                          {deleteOldContentVersionsMutation.isPending ? "Cleaning up..." : "Delete Old Versions"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              
              {/* Delete Community Pages Section (from main navigation) */}
              <div className="flex items-start gap-4 pb-6 border-b border-border">
                <File className="h-10 w-10 text-amber-500 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-medium">Delete Community Nav Pages</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-3">
                    This will permanently delete all Community pages found under the Community navigation menu,
                    including their headers, titles, descriptions, and uploaded media. This action will not affect
                    other website content.
                  </p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="gap-2">
                        <Trash2 className="h-4 w-4" />
                        Delete Community Nav Pages
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete ALL Community pages
                          from the main navigation menu and their associated content. Other website content will not be affected.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteCommunityPagesMutation.mutate()}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {deleteCommunityPagesMutation.isPending ? "Deleting..." : "Delete Community Nav Pages"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              
              {/* Delete All Vendors Section */}
              <div className="flex items-start gap-4 pb-6 border-b border-border">
                <Store className="h-10 w-10 text-amber-500 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-medium">Delete All Vendors</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-3">
                    This will permanently delete all vendors from the /vendors page.
                    This action cannot be undone and will remove all vendor comments, 
                    interactions, and related data.
                  </p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="gap-2">
                        <Trash2 className="h-4 w-4" />
                        Delete All Vendors
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete ALL vendors
                          and remove them from the vendors directory.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteAllVendorsMutation.mutate()}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {deleteAllVendorsMutation.isPending ? "Deleting..." : "Delete All Vendors"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              
              {/* Delete All Community Pages Section */}
              <div className="flex items-start gap-4">
                <File className="h-10 w-10 text-amber-500 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-medium">Delete All Community Pages</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-3">
                    This will permanently delete all community pages from the /more section.
                    This includes pages in Community Information, Government, Transportation, and other sections.
                    This action cannot be undone.
                  </p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="gap-2">
                        <Trash2 className="h-4 w-4" />
                        Delete All Community Pages
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete ALL community pages
                          from all categories in the /more section, including Community Information, 
                          Government, Transportation, and other sections.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteAllCommunityPagesMutation.mutate()}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {deleteAllCommunityPagesMutation.isPending ? "Deleting..." : "Delete All Community Pages"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Media Files Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Media Files to Delete ({previewFiles.length})</DialogTitle>
            <DialogDescription>
              These files are not referenced in the database and will be deleted. 
              You can deselect any files you want to keep.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex items-center gap-2 mt-4 mb-2">
            <div className="relative grow">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter files..."
                className="pl-8"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              />
              {filterText && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1 h-7 w-7 p-0"
                  onClick={() => setFilterText('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (selectedFiles.size === previewFiles.length) {
                  setSelectedFiles(new Set());
                } else {
                  setSelectedFiles(new Set(previewFiles));
                }
              }}
            >
              {selectedFiles.size === previewFiles.length 
                ? "Deselect All" 
                : selectedFiles.size === 0 
                  ? "Select All" 
                  : "Select All"}
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto border rounded-md">
            {previewFiles.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                No files to display
              </div>
            ) : (
              <ScrollArea className="h-[50vh]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-2">
                  {previewFiles
                    .filter(file => file.toLowerCase().includes(filterText.toLowerCase()))
                    .map((file, index) => {
                      const isImage = /\.(jpg|jpeg|png|gif|svg)$/i.test(file);
                      const isSelected = selectedFiles.has(file);
                      
                      return (
                        <div 
                          key={index} 
                          className={`border rounded-md flex items-start p-2 gap-2 ${isSelected ? 'bg-blue-50 border-blue-200' : ''}`}
                          onClick={() => {
                            const newSelected = new Set(selectedFiles);
                            if (isSelected) {
                              newSelected.delete(file);
                            } else {
                              newSelected.add(file);
                            }
                            setSelectedFiles(newSelected);
                          }}
                        >
                          <div className="flex-shrink-0">
                            {isSelected ? (
                              <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center">
                                <Check className="h-4 w-4 text-white" />
                              </div>
                            ) : (
                              <div className="h-6 w-6 rounded-full border-2 border-gray-300" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            {isImage && (
                              <div className="h-24 w-full mb-2 relative rounded overflow-hidden bg-gray-100">
                                <img 
                                  src={file} 
                                  alt="Preview" 
                                  className="h-full w-full object-contain absolute inset-0"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).onerror = null;
                                    (e.target as HTMLImageElement).src = '/placeholder-image.svg';
                                  }}
                                />
                              </div>
                            )}
                            <div className="text-sm truncate">
                              {file.split('/').pop()}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {file}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </ScrollArea>
            )}
          </div>
          
          <DialogFooter className="mt-4">
            <div className="mr-auto text-sm text-muted-foreground">
              {selectedFiles.size} of {previewFiles.length} files selected
            </div>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => deleteUnusedMediaMutation.mutate(Array.from(selectedFiles))}
              disabled={selectedFiles.size === 0 || deleteUnusedMediaMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {deleteUnusedMediaMutation.isPending ? "Deleting..." : `Delete ${selectedFiles.size} Files`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}