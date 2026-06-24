import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, History } from "lucide-react";

export function MediaBackupTools() {
  const { toast } = useToast();
  
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

  return (
    <Card className="border-emerald-500/20">
      <CardHeader>
        <CardTitle className="flex items-center text-emerald-600">
          <History className="h-5 w-5 mr-2" />
          Media Backup Tools
        </CardTitle>
        <CardDescription>
          Create backups of your media files to protect against accidental deletion or corruption
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-6">
          <p className="text-sm text-muted-foreground mt-1 mb-3">
            Backups are stored in the /uploads/backups folder with timestamps and can be restored if needed.
          </p>
          
          {/* Alert for Direct Backup Tool */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4 text-sm">
            <div className="flex gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-yellow-800">Having trouble with backups?</p>
                <p className="text-yellow-700 mt-1">
                  If you're experiencing "Body is disturbed or locked" errors, use our{' '}
                  <a 
                    href="/api-backup/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="font-medium text-yellow-800 hover:text-yellow-900 underline"
                  >
                    direct backup tool
                  </a>{' '}
                  which bypasses the Vite development server.
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="gap-2 bg-green-50 border-green-200 hover:bg-green-100">
                  <History className="h-4 w-4 text-green-600" />
                  Backup Calendar Images
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Create calendar media backup?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will create a backup of all calendar event media files.
                    The backup will be stored in the uploads/backups/calendar folder with a timestamp.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => backupMediaMutation.mutate('calendar')}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {backupMediaMutation.isPending ? "Creating Backup..." : "Create Backup"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="gap-2 bg-blue-50 border-blue-200 hover:bg-blue-100">
                  <History className="h-4 w-4 text-blue-600" />
                  Backup Real Estate Images
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Create real estate media backup?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will create a backup of all real estate listing images.
                    The backup will be stored in the uploads/backups/real-estate folder with a timestamp.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => backupMediaMutation.mutate('real-estate')}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {backupMediaMutation.isPending ? "Creating Backup..." : "Create Backup"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="gap-2 bg-purple-50 border-purple-200 hover:bg-purple-100">
                  <History className="h-4 w-4 text-purple-600" />
                  Backup Forum Images
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Create forum media backup?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will create a backup of all forum post and comment images.
                    The backup will be stored in the uploads/backups/forum folder with a timestamp.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => backupMediaMutation.mutate('forum')}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {backupMediaMutation.isPending ? "Creating Backup..." : "Create Backup"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="gap-2 bg-teal-50 border-teal-200 hover:bg-teal-100">
                  <History className="h-4 w-4 text-teal-600" />
                  Backup Community Images
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Create community pages media backup?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will create a backup of all community page images.
                    The backup will be stored in the uploads/backups/community folder with a timestamp.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => backupMediaMutation.mutate('community')}
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    {backupMediaMutation.isPending ? "Creating Backup..." : "Create Backup"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="gap-2 bg-amber-50 border-amber-200 hover:bg-amber-100">
                  <History className="h-4 w-4 text-amber-600" />
                  Backup Vendor Images
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Create vendor media backup?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will create a backup of all vendor images and logos.
                    The backup will be stored in the uploads/backups/vendors folder with a timestamp.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => backupMediaMutation.mutate('vendors')}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    {backupMediaMutation.isPending ? "Creating Backup..." : "Create Backup"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="gap-2 bg-rose-50 border-rose-200 hover:bg-rose-100">
                  <History className="h-4 w-4 text-rose-600" />
                  Backup Banner Slides
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Create banner slides backup?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will create a backup of all banner slide images from the homepage.
                    The backup will be stored in the uploads/backups/banner-slides folder with a timestamp.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => backupMediaMutation.mutate('banner-slides')}
                    className="bg-rose-600 hover:bg-rose-700"
                  >
                    {backupMediaMutation.isPending ? "Creating Backup..." : "Create Backup"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}