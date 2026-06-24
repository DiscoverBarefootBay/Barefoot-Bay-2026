import { useState, ChangeEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Upload, FileType, Check, X, LoaderCircle } from "lucide-react";

export function BulkEventUpload() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) {
        throw new Error("No file selected");
      }
      
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch("/api/events/bulk", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to upload events");
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Successfully uploaded ${data.count || 'multiple'} events`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setFile(null);
      setIsOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Upload className="h-4 w-4" />
          Bulk Upload
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Calendar Events</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file containing events to add to the calendar.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="events-file">Events File (CSV or XLSX)</Label>
            <Input
              id="events-file"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              disabled={uploadMutation.isPending}
            />
          </div>
          
          {file && (
            <div className="flex items-center gap-2 text-sm">
              <FileType className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{file.name}</span>
              <span className="text-muted-foreground">
                ({(file.size / 1024).toFixed(1)} KB)
              </span>
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-1">Required columns:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Title - Event title</li>
              <li>StartDate - Event start date and time</li>
              <li>EndDate - Event end date and time</li>
              <li>Category - Event category</li>
            </ul>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={uploadMutation.isPending}>
            Cancel
          </Button>
          <Button 
            onClick={() => uploadMutation.mutate()}
            disabled={!file || uploadMutation.isPending}
            className="gap-2"
          >
            {uploadMutation.isPending ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Upload Events
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}