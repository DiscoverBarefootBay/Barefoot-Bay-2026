import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePermissions } from "@/hooks/use-permissions";

export default function ProductImageUploadTest() {
  const { toast } = useToast();
  const { isAdmin } = usePermissions();
  
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      toast({
        title: "No file selected",
        description: "Please select an image file to upload",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append("image", files[0]);
      
      const response = await fetch("/api/products/upload/product-image", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed with status: ${response.status}`);
      }
      
      const data = await response.json();
      
      setUploadedImageUrls([...uploadedImageUrls, data.imageUrl]);
      toast({
        title: "Upload successful",
        description: "The image was uploaded successfully",
      });
    } catch (err) {
      console.error("Error uploading image:", err);
      setError(err instanceof Error ? err.message : "Failed to upload image");
      toast({
        title: "Upload failed",
        description: "There was an error uploading the image",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="container max-w-7xl mx-auto p-8">
        <h1 className="text-3xl font-bold">Access Denied</h1>
        <p className="mt-4">You do not have permission to access this page.</p>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Product Image Upload Test</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Upload Product Image</CardTitle>
          <CardDescription>
            Test the image upload functionality for product images
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="product-image">Product Image</Label>
              <Input 
                id="product-image" 
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
              <p className="text-sm text-muted-foreground">
                Maximum file size: 5MB. Supported formats: JPEG, PNG, GIF, WebP
              </p>
            </div>
            
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {isUploading && (
              <div className="text-center py-4">
                <p>Uploading...</p>
              </div>
            )}
            
            {uploadedImageUrls.length > 0 && (
              <div className="space-y-4 mt-4">
                <h3 className="font-medium">Uploaded Images:</h3>
                <div className="grid grid-cols-2 gap-4">
                  {uploadedImageUrls.map((url, index) => (
                    <div key={index} className="space-y-2">
                      <div className="border rounded-md p-2">
                        <img 
                          src={url} 
                          alt={`Uploaded product ${index + 1}`}
                          className="max-w-full h-auto"
                        />
                      </div>
                      <p className="text-sm break-all">
                        <span className="font-semibold">URL:</span> {url}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => setUploadedImageUrls([])}>
            Clear Results
          </Button>
          <Button onClick={() => window.history.back()}>
            Back to Admin
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}