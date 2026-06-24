import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { normalizeMediaUrl } from "@/lib/media-cache";

export default function ProductImageTestPage() {
  const { isAdmin } = usePermissions();
  const { toast } = useToast();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadType, setUploadType] = useState<string>("normal");
  
  // History of uploaded images for comparison
  const [uploadHistory, setUploadHistory] = useState<Array<{
    url: string;
    normalizedUrl: string;
    type: string;
    timestamp: number;
  }>>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const handleNormalUpload = async () => {
    if (!imageFile) {
      toast({
        title: "No file selected",
        description: "Please select an image file to upload.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", imageFile);

      // Show loading toast
      toast({
        title: "Uploading image...",
        description: "Please wait while we upload your image.",
      });

      // Upload the image through the normal product image upload endpoint
      const response = await fetch('/api/products/upload/product-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      setUploadedImageUrl(data.imageUrl);

      // Add to history
      setUploadHistory(prev => [
        {
          url: data.imageUrl,
          normalizedUrl: normalizeMediaUrl(data.imageUrl),
          type: "normal",
          timestamp: Date.now()
        },
        ...prev
      ]);

      // Show success toast
      toast({
        title: "Image uploaded",
        description: "Your image has been uploaded successfully via normal endpoint.",
      });

      setImageUrl(data.imageUrl);
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleEmergencyUpload = async () => {
    if (!imageFile) {
      toast({
        title: "No file selected",
        description: "Please select an image file to upload.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", imageFile);

      // Show loading toast
      toast({
        title: "Uploading image...",
        description: "Please wait while we upload your image via emergency endpoint.",
      });

      // Upload the image through the emergency product image upload endpoint
      const response = await fetch('/api/emergency-product-upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      setUploadedImageUrl(data.imageUrl);

      // Add to history
      setUploadHistory(prev => [
        {
          url: data.imageUrl,
          normalizedUrl: normalizeMediaUrl(data.imageUrl),
          type: "emergency",
          timestamp: Date.now()
        },
        ...prev
      ]);

      // Show success toast
      toast({
        title: "Image uploaded",
        description: "Your image has been uploaded successfully via emergency endpoint.",
      });

      setImageUrl(data.imageUrl);
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
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
    <div className="container max-w-7xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Product Image Test</h1>
        <Button variant="outline" onClick={() => window.location.href = "/admin/product-management"}>
          Back to Product Management
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Upload Product Image</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="image-upload">Select Image</Label>
              <Input 
                id="image-upload" 
                type="file" 
                accept="image/*" 
                onChange={handleFileChange} 
              />
              <p className="text-sm text-muted-foreground">
                Select an image file to upload (JPEG, PNG, etc.)
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                onClick={handleNormalUpload}
                disabled={isUploading || !imageFile}
                className="flex-1"
              >
                Upload via Normal Endpoint
              </Button>
              <Button
                onClick={handleEmergencyUpload}
                disabled={isUploading || !imageFile}
                className="flex-1"
                variant="secondary"
              >
                Upload via Emergency Endpoint
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Image Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {uploadedImageUrl ? (
              <div className="space-y-4">
                <div className="border rounded-lg overflow-hidden">
                  <img 
                    src={uploadedImageUrl} 
                    alt="Uploaded product" 
                    className="max-h-64 w-auto mx-auto"
                    onError={(e) => {
                      console.error("Error loading image");
                      e.currentTarget.src = "/uploads/banner-slides/placeholder-banner.png";
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Image URL</Label>
                  <Input value={uploadedImageUrl} readOnly />
                  <p className="text-sm text-muted-foreground">
                    This is the URL that will be stored in the database.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Normalized URL</Label>
                  <Input value={normalizeMediaUrl(uploadedImageUrl)} readOnly />
                  <p className="text-sm text-muted-foreground">
                    This is how the URL is normalized by the media cache system.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                No image uploaded yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upload History */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Upload History</CardTitle>
        </CardHeader>
        <CardContent>
          {uploadHistory.length > 0 ? (
            <div className="space-y-4">
              {uploadHistory.map((item, index) => (
                <div key={index} className="border rounded-lg p-4 flex flex-col md:flex-row gap-4">
                  <div className="flex-shrink-0">
                    <img 
                      src={item.url} 
                      alt={`History item ${index}`}
                      className="w-32 h-32 object-cover rounded-lg border"
                      onError={(e) => {
                        e.currentTarget.src = "/uploads/banner-slides/placeholder-banner.png";
                      }}
                    />
                  </div>
                  <div className="flex-grow space-y-2">
                    <div className="grid grid-cols-1 gap-2">
                      <p><strong>Upload Type:</strong> {item.type}</p>
                      <p><strong>Upload Time:</strong> {formatTimestamp(item.timestamp)}</p>
                      <p><strong>URL:</strong> <code className="text-xs break-all">{item.url}</code></p>
                      <p><strong>Normalized URL:</strong> <code className="text-xs break-all">{item.normalizedUrl}</code></p>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => window.open(item.url, '_blank')}
                      >
                        Open Original
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => window.open(item.normalizedUrl, '_blank')}
                      >
                        Open Normalized
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No uploads in history yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}