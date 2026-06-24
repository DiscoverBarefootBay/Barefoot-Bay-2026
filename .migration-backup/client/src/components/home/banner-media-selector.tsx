import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, UploadCloud } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface BannerMediaSelectorProps {
  onSelect: (url: string) => void;
  initialUrl?: string;
}

export function BannerMediaSelector({ onSelect, initialUrl = "" }: BannerMediaSelectorProps) {
  const [activeTab, setActiveTab] = useState<string>("upload");
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string>(initialUrl);
  const [imageUrl, setImageUrl] = useState<string>(initialUrl);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isVideoUrlChecked, setIsVideoUrlChecked] = useState<boolean>(false);
  const { toast } = useToast();

  // Fetch existing banner slide images
  useEffect(() => {
    const fetchExistingImages = async () => {
      setIsLoading(true);
      try {
        // First try to get from the banner-slides folder
        try {
          const response = await apiRequest("GET", "/api/banner-slides/images");
          const data = await response.json();
          
          if (data && data.images && Array.isArray(data.images)) {
            setExistingImages(data.images);
            setIsLoading(false);
            return;
          }
        } catch (err) {
          console.log("Could not fetch banner slide images, will use default images:", err);
        }
        
        // Fallback: use some general images from uploads folder
        const fallbackImages = [
          "https://images.unsplash.com/photo-1572521492772-65a307abdcfb?q=80&w=1200&h=400&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1532947974358-a218d18d8d14?q=80&w=1200&h=400&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1531761535209-180857e963d5?q=80&w=1200&h=400&auto=format&fit=crop"
        ];
        setExistingImages(fallbackImages);
      } catch (error) {
        console.error("Failed to fetch banner images:", error);
        toast({
          title: "Error",
          description: "Failed to load existing banner images",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchExistingImages();
  }, [toast]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setImageFile(file);
      
      // Determine if it's a video or image file
      const isVideo = file.type.startsWith('video/');
      
      // For video files, we just use a placeholder image for preview
      if (isVideo) {
        setSelectedImage("/static/images/video-placeholder.png");
      } else {
        // Show image preview
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") {
            setSelectedImage(reader.result);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Handle URL input
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageUrl(e.target.value);
    if (e.target.value) {
      setSelectedImage(e.target.value);
    }
  };

  // Handle upload of new banner image
  const handleUpload = async () => {
    if (!imageFile) {
      toast({
        title: "Error",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append("bannerImage", imageFile);
      
      // Determine if it's a video or image file
      const isVideo = imageFile.type.startsWith('video/');
      
      // Add the media type to the formData
      formData.append("mediaType", isVideo ? 'video' : 'image');
      
      const response = await apiRequest("POST", "/api/banner-slides/upload", formData);
      
      const data = await response.json();
      
      if (data.success && data.url) {
        toast({
          title: "Success",
          description: isVideo ? "Video uploaded successfully" : "Image uploaded successfully",
        });
        
        // Select the newly uploaded media
        setSelectedImage(data.url);
        
        // Pass the URL along with media type information
        if (typeof onSelect === 'function') {
          // Check if onSelect can handle additional parameters (for enhanced implementations)
          if (onSelect.length > 1) {
            // @ts-ignore - Some implementations may accept extra parameters
            onSelect(data.url, { mediaType: isVideo ? 'video' : 'image', autoplay: isVideo });
          } else {
            // Standard implementation with just the URL
            onSelect(data.url);
          }
        }
        
        // Add the new media to the existing images list
        setExistingImages(prev => [...prev, data.url]);
        
        // Switch to the existing tab
        setActiveTab("existing");
      } else {
        throw new Error("Upload failed");
      }
    } catch (error) {
      console.error("Error uploading media:", error);
      toast({
        title: "Error",
        description: "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Handle selection of an existing image or video
  const handleSelectExisting = (url: string) => {
    setSelectedImage(url);
    
    // Check if it's a video URL by looking at common video extensions
    const isVideoUrl = /\.(mp4|mov|webm|avi|wmv|flv|mkv)$/i.test(url);
    
    if (isVideoUrl) {
      if (typeof onSelect === 'function') {
        // Check if onSelect can handle additional parameters (for enhanced implementations)
        if (onSelect.length > 1) {
          // @ts-ignore - Some implementations may accept extra parameters
          onSelect(url, { mediaType: 'video', autoplay: true });
        } else {
          // Standard implementation with just the URL
          onSelect(url);
        }
      }
    } else {
      // Regular image URL
      onSelect(url);
    }
  };

  // Handle selection of a URL input
  const handleSelectUrl = () => {
    if (!imageUrl) {
      toast({
        title: "Error",
        description: "Please enter a media URL",
        variant: "destructive",
      });
      return;
    }
    
    setSelectedImage(imageUrl);
    
    // If the user has indicated this is a video URL, pass that information
    if (isVideoUrlChecked) {
      if (typeof onSelect === 'function') {
        // Check if onSelect can handle additional parameters (for enhanced implementations)
        if (onSelect.length > 1) {
          // @ts-ignore - Some implementations may accept extra parameters
          onSelect(imageUrl, { mediaType: 'video', autoplay: true });
        } else {
          // Standard implementation with just the URL
          onSelect(imageUrl);
        }
      }
    } else {
      // Regular image URL
      onSelect(imageUrl);
    }
  };

  return (
    <div className="space-y-4 w-full max-w-full">
      <div className="mb-4">
        {/* Dynamically determine if it's a video based on URL or user selection */}
        {selectedImage && (isVideoUrlChecked || /\.(mp4|mov|webm|avi|wmv|flv|mkv)$/i.test(selectedImage)) ? (
          // Video preview
          <div className="w-full aspect-[3/1] mb-2 rounded-md overflow-hidden">
            <video 
              src={selectedImage}
              className="w-full h-full object-cover"
              controls
              muted
            />
          </div>
        ) : (
          // Image preview
          <div 
            className="w-full aspect-[3/1] bg-cover bg-center rounded-md mb-2"
            style={{ 
              backgroundImage: `url(${selectedImage || "https://placehold.co/1200x400?text=Select+Image"})`,
              backgroundPosition: 'center',
            }}
          />
        )}
        {selectedImage && (
          <p className="text-sm text-center text-muted-foreground truncate">
            {selectedImage}
            {isVideoUrlChecked || /\.(mp4|mov|webm|avi|wmv|flv|mkv)$/i.test(selectedImage) ? " (Video)" : " (Image)"}
          </p>
        )}
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="existing">Existing</TabsTrigger>
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="url">URL</TabsTrigger>
        </TabsList>
        
        <TabsContent value="existing" className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : existingImages.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto p-1">
              {existingImages.map((url, index) => {
                const isVideo = /\.(mp4|mov|webm|avi|wmv|flv|mkv)$/i.test(url);
                return (
                  <div 
                    key={index}
                    onClick={() => handleSelectExisting(url)}
                    className={`cursor-pointer border rounded-md overflow-hidden transition-all relative ${
                      selectedImage === url ? 'ring-2 ring-primary scale-[0.98]' : 'hover:scale-[0.98]'
                    }`}
                  >
                    {isVideo ? (
                      <div className="w-full h-20 bg-gray-200 flex items-center justify-center">
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          {/* Video play icon */}
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                          </svg>
                        </div>
                        <span className="text-xs text-muted-foreground z-10">Video</span>
                      </div>
                    ) : (
                      <img 
                        src={url} 
                        alt="Banner" 
                        className="w-full h-20 object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = "https://placehold.co/600x300?text=Error";
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              No banner images available yet. Upload a new one or enter a URL.
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="upload" className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="bannerImage">Select Media (Image or Video)</Label>
            <Input 
              id="bannerImage" 
              type="file" 
              accept="image/*,video/*" 
              onChange={handleFileChange}
              disabled={isUploading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Images: Recommended dimensions 1200×400 pixels (3:1 ratio). Larger images will be center-cropped to fit.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Videos: Recommended format MP4, maximum size 100MB. Videos will autoplay when the slide is active.
            </p>
            <Button 
              type="button" 
              onClick={handleUpload} 
              disabled={!imageFile || isUploading}
              className="mt-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <UploadCloud className="mr-2 h-4 w-4" />
                  Upload
                </>
              )}
            </Button>
          </div>
        </TabsContent>
        
        <TabsContent value="url" className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="imageUrl">Media URL (Image or Video)</Label>
            <Input 
              id="imageUrl" 
              type="text" 
              placeholder="https://example.com/media.jpg or https://example.com/video.mp4" 
              value={imageUrl}
              onChange={handleUrlChange}
            />
            <div className="flex items-center gap-2 mt-1">
              <input
                type="checkbox"
                id="isVideoUrl"
                className="rounded"
                onChange={(e) => {
                  // This allows users to manually mark a URL as a video
                  // Will be used when selecting from the URL tab
                  setIsVideoUrlChecked(e.target.checked);
                }}
                checked={isVideoUrlChecked}
              />
              <Label htmlFor="isVideoUrl" className="text-sm">This is a video URL</Label>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              For videos, please check the box above so the system can handle it correctly.
            </p>
            <Button 
              type="button" 
              onClick={handleSelectUrl} 
              disabled={!imageUrl}
              className="mt-2"
            >
              Use URL
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}