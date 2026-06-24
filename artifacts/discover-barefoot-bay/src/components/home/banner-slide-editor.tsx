import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, ChevronUp, ChevronDown, AlertTriangle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { apiRequest } from "@/lib/queryClient";
import { getEnvironmentAppropriateUrl } from "@/lib/media-path-utils";

// Maximum banner media upload size, kept in sync with the server limits.
// Doubled from the previous 100MB so admins can save larger, higher-resolution images.
export const MAX_BANNER_UPLOAD_BYTES = 200 * 1024 * 1024; // 200MB
export const MAX_BANNER_UPLOAD_LABEL = "200MB";

interface BannerSlide {
  src: string;
  alt: string;
  caption: string;
  link: string;
  customLink?: string; // For storing custom URL when "custom" is selected
  buttonText?: string;
  bgPosition?: string; // CSS background-position value
  mediaType?: 'image' | 'video'; // Type of media - image (default) or video
  autoplay?: boolean; // Whether to autoplay videos when slide is active (default true for videos)
}

interface BannerSlideEditorProps {
  slide: BannerSlide;
  index: number;
  isOpen: boolean;
  onClose: () => void;
  onSave: (index: number, updatedSlide: BannerSlide) => void;
  onDelete?: (index: number) => void;
  onAdd?: () => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  allSlides?: BannerSlide[];
}

export function BannerSlideEditor({ slide, index, isOpen, onClose, onSave, onDelete, onAdd, onReorder, allSlides = [] }: BannerSlideEditorProps) {
  // Pre-process the slide to detect if it's a custom link and normalize URLs
  const preprocessedSlide = { ...slide };
  
  // Normalize the src URL to ensure we're using Object Storage format
  preprocessedSlide.src = getEnvironmentAppropriateUrl(slide.src, 'banner-slides');
  
  // Check if this link is one of our predefined links
  const predefinedLinks = [
    '/', '/banner', '/banner#slide1', '/banner#slide2', 
    '/banner#slide3', '/banner#slide4', '/banner#slide5',
    '/calendar', '/for-sale'
  ];
  
  if (!predefinedLinks.includes(slide.link)) {
    // If it's not in our list, it's a custom link
    preprocessedSlide.customLink = slide.link;
    preprocessedSlide.link = 'custom';
  }
  
  const [editedSlide, setEditedSlide] = useState<BannerSlide>(preprocessedSlide);
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("content");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Keep track of any blob URLs we create for proper cleanup
  const blobUrlRef = useRef<string | null>(null);
  
  // Cleanup function for blob URLs to prevent memory leaks
  useEffect(() => {
    // Cleanup function that runs when component unmounts or when blobUrlRef changes
    return () => {
      if (blobUrlRef.current && blobUrlRef.current.startsWith('blob:')) {
        console.log("Cleaning up blob URL:", blobUrlRef.current);
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  const handleChange = (field: keyof BannerSlide, value: string) => {
    setEditedSlide(prev => ({ ...prev, [field]: value }));
  };
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Reject files over the limit up front so the Save button stays usable
      // and the admin gets a clear message instead of a stuck/failed save.
      if (file.size > MAX_BANNER_UPLOAD_BYTES) {
        toast({
          title: "File too large",
          description: `That file is ${(file.size / (1024 * 1024)).toFixed(0)}MB. Please choose a file under ${MAX_BANNER_UPLOAD_LABEL}.`,
          variant: "destructive",
        });
        e.target.value = ""; // allow re-selecting after the warning
        return;
      }

      setImageFile(file);
      
      // Clean up any existing blob URL first
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
      
      // Create an object URL for preview (safer than data URLs which can be very large)
      const objectUrl = URL.createObjectURL(file);
      blobUrlRef.current = objectUrl; // Store for cleanup later
      
      // Determine if this is a video or image by checking the file type
      const isVideo = file.type.startsWith('video/');
      
      setEditedSlide(prev => ({ 
        ...prev, 
        src: objectUrl,
        mediaType: isVideo ? 'video' : 'image',
        autoplay: isVideo ? true : undefined
      }));
      
      // We'll upload the actual file when saving
      console.log(`${isVideo ? 'Video' : 'Image'} selected for upload:`, file.name);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      // Validate inputs
      if (!editedSlide.src.trim()) {
        toast({
          title: "Error",
          description: "Image URL is required",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      
      if (!editedSlide.caption.trim()) {
        toast({
          title: "Error",
          description: "Caption is required",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      
      // Final slide data preparation
      const finalSlideData = { ...editedSlide };
      
      // Handle custom link case
      if (editedSlide.link === "custom") {
        // If the user chose "custom" but didn't provide a value, use a default
        if (!editedSlide.customLink?.trim()) {
          toast({
            title: "Warning",
            description: "Custom URL is empty, using homepage as default",
          });
          finalSlideData.link = "/";
        } else {
          // If they provided a custom link, use that as the actual link
          finalSlideData.link = editedSlide.customLink;
        }
      }
      
      // If we have a new image file, upload it first
      if (imageFile) {
        try {
          const formData = new FormData();
          formData.append("bannerImage", imageFile);
          
          console.log("Uploading banner image...", imageFile.name, imageFile.type, imageFile.size);
          
          const response = await apiRequest("POST", "/api/banner-slides/upload", formData);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error("Banner upload error response:", errorText);
            throw new Error(`Failed to upload image: ${errorText}`);
          }
          
          const data = await response.json();
          console.log("Banner upload success response:", data);
          
          // Get the environment-appropriate path for this URL
          finalSlideData.src = getEnvironmentAppropriateUrl(data.url, 'banner-slides');
          console.log("Using environment-appropriate URL format:", finalSlideData.src);
          
          // Clean up the blob URL if it exists
          if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
            blobUrlRef.current = null;
          }
          
          // Reset the file state
          setImageFile(null);
          
          // Show a confirmation message to the user
          toast({
            title: "Success",
            description: "Banner image uploaded successfully!",
          });
        } catch (uploadError) {
          console.error("Image upload error:", uploadError);
          toast({
            title: "Error",
            description: `Failed to upload image: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`,
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
      }
      
      // Save changes
      onSave(index, finalSlideData);
      
      toast({
        title: "Success",
        description: "Banner slide updated successfully",
      });
      
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update banner slide",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Clean up on dialog close without submission
  const handleDialogClose = () => {
    // Clean up any blob URLs
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-[700px] w-[95vw] max-w-[95vw] max-h-[85vh] sm:max-h-[90vh] overflow-y-auto p-3 sm:p-6 pb-4 sm:pb-6 mx-auto my-4 sm:fixed sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2">
        <DialogHeader className="pb-3 sm:pb-4 mb-2 border-b">
          <DialogTitle className="text-lg sm:text-xl lg:text-2xl text-center font-bold">Edit Banner Slide</DialogTitle>
          <DialogDescription className="text-center mt-1 sm:mt-2 text-sm sm:text-base">
            Edit the content of this banner slide
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-3 mb-3 sm:mb-4 h-auto bg-gray-100 p-1 rounded-md">
            <TabsTrigger 
              value="content" 
              className="flex-1 py-3 px-2 text-sm sm:text-base font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all duration-200"
            >
              Content
            </TabsTrigger>
            <TabsTrigger 
              value="image" 
              className="flex-1 py-3 px-2 text-sm sm:text-base font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all duration-200"
            >
              Image
            </TabsTrigger>
            <TabsTrigger 
              value="settings" 
              className="flex-1 py-3 px-2 text-sm sm:text-base font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all duration-200"
            >
              Settings
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="content" className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
            <div className="grid gap-3 sm:gap-4">
              <div className="grid gap-2">
                <Label htmlFor="caption">Caption</Label>
                <Textarea
                  id="caption"
                  value={editedSlide.caption}
                  onChange={(e) => handleChange("caption", e.target.value)}
                  placeholder="Banner caption text"
                  rows={2}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="alt">Image Alt Text</Label>
                <Input
                  id="alt"
                  value={editedSlide.alt}
                  onChange={(e) => handleChange("alt", e.target.value)}
                  placeholder="Descriptive text for the image"
                />
              </div>
              
              <div className="grid gap-4">
                <Label htmlFor="linkSelector">Page Link</Label>
                <select
                  id="linkSelector"
                  className="w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-base bg-white h-12"
                  value={editedSlide.link || "/"}
                  onChange={(e) => handleChange("link", e.target.value)}
                >
                  {/* Main Sections */}
                  <option value="/">Home Page</option>
                  <option value="/calendar">Calendar & Events</option>
                  <option value="/forum">Community Forum</option>
                  <option value="/real-estate">Real Estate</option>
                  <option value="/vendors">Local Vendors</option>
                  <option value="/listings">Community Listings</option>
                  <option value="/for-sale">For Sale & Marketplace</option>
                  
                  {/* Banner Pages */}
                  <option disabled>──────────────</option>
                  <option value="/banner">Banner Pages</option>
                  <option value="/banner#slide1">— Slide 1 Page</option>
                  <option value="/banner#slide2">— Slide 2 Page</option>
                  <option value="/banner#slide3">— Slide 3 Page</option>
                  <option value="/banner#slide4">— Slide 4 Page</option>
                  <option value="/banner#slide5">— Slide 5 Page</option>
                  
                  {/* More Section */}
                  <option disabled>──────────────</option>
                  <option value="/more/amenities">Amenities</option>
                  <option value="/more/government">Government & HOA</option>
                  <option value="/more/community-info">Community Information</option>
                  <option value="/more/news">Local News</option>
                  <option value="/more/weather">Weather</option>
                  <option value="/more/history">History</option>
                  
                  {/* Other Pages */}
                  <option disabled>──────────────</option>
                  <option value="/account">My Account</option>
                  <option value="/help">Help & Support</option>
                  <option value="custom">Custom URL...</option>
                </select>
                
                {editedSlide.link === "custom" && (
                  <div className="mt-2 p-3 border rounded-md bg-primary/5">
                    <Label htmlFor="customLink" className="text-sm mb-1 block">
                      Enter Custom URL:
                    </Label>
                    <Input
                      id="customLink"
                      value={editedSlide.customLink || ""}
                      onChange={(e) => {
                        // Only update the customLink field, not the link field
                        // The link field needs to stay as "custom" until final save
                        setEditedSlide(prev => ({ 
                          ...prev, 
                          customLink: e.target.value
                        }));
                      }}
                      placeholder="/custom-page-path or https://external-site.com"
                      className="h-12 text-base bg-white"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      <span className="block mb-1">Internal links (same tab):</span>
                      <span className="block pl-2">• /more/community-info</span>
                      <span className="block pl-2">• /forum/sports</span>
                      <span className="block mt-1">External links (new tab):</span>
                      <span className="block pl-2">• https://example.com</span>
                      <span className="block pl-2">• https://weather.gov</span>
                    </p>
                  </div>
                )}
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="buttonText" className="font-medium">Button Text</Label>
                <Input
                  id="buttonText"
                  value={editedSlide.buttonText || "Explore Amenities"}
                  onChange={(e) => handleChange("buttonText", e.target.value)}
                  placeholder="Button text (e.g. 'Explore Amenities')"
                  className="h-12 text-base bg-white"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Text that appears on the button linked to this URL
                </p>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="image" className="space-y-4 mt-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label 
                  htmlFor="imageUpload" 
                  className="font-medium mb-1 text-base"
                >
                  Upload New Media
                </Label>
                <div className="bg-muted/30 rounded-md p-3 border">
                  <p className="text-sm mb-2">Choose an image or video file:</p>
                  <Input
                    id="imageUpload"
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleImageChange}
                    className="cursor-pointer bg-white h-12"
                  />
                  <div className="mt-2 text-xs text-muted-foreground space-y-1">
                    <p><span className="font-medium">Images:</span> 1200×400px (recommended); larger high-resolution images are supported</p>
                    <p><span className="font-medium">Videos:</span> MP4 format</p>
                    <p><span className="font-medium">Max size:</span> {MAX_BANNER_UPLOAD_LABEL}</p>
                  </div>
                </div>
              </div>
              
              <div className="grid gap-2">
                <div className="flex justify-between items-center">
                  <Label>Media Preview</Label>
                  <button 
                    type="button"
                    className="px-2 py-1 text-xs bg-muted hover:bg-muted/90 rounded"
                    onClick={() => {
                      // Clear localStorage cache entries
                      const keysToRemove = [];
                      for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key && 
                            (key.includes('media-cache:') || 
                             key.includes('communityBannerSlides') || 
                             key.includes('banner-slide'))) {
                          keysToRemove.push(key);
                        }
                      }
                      
                      // Remove all identified keys
                      keysToRemove.forEach(key => {
                        localStorage.removeItem(key);
                      });
                      
                      // Set a flag to force reload content on next visit
                      localStorage.setItem('force-banner-reload', Date.now().toString());
                      
                      // Reset the slide path to force refresh
                      const currentSrc = editedSlide.src;
                      setEditedSlide(prev => ({ ...prev, src: '' }));
                      
                      // Wait a short time and then restore it
                      setTimeout(() => {
                        setEditedSlide(prev => ({ ...prev, src: currentSrc }));
                      }, 100);
                      
                      toast({
                        title: "Cache Cleared",
                        description: "Media cache has been cleared. Preview should update shortly.",
                      });
                    }}
                  >
                    Clear Media Cache
                  </button>
                </div>
                {editedSlide.mediaType === 'video' ? (
                  <div className="w-full aspect-[3/2] sm:aspect-[3/1] rounded-md mt-2 bg-black flex items-center justify-center overflow-hidden">
                    <video 
                      className="w-full h-full object-contain"
                      src={getEnvironmentAppropriateUrl(editedSlide.src, 'banner-slides')} 
                      controls
                      loop
                      muted
                      autoPlay
                      poster="/banner-placeholder.jpg"
                      onError={(e) => {
                        console.error("Video preview error:", e);
                        
                        // Try different URL formats for video
                        const videoElement = e.target as HTMLVideoElement;
                        const currentSrc = videoElement.src;
                        const parts = currentSrc.split('/');
                        const filename = parts[parts.length - 1];
                        
                        // Log detailed error information
                        if (videoElement.error) {
                          console.error(`Video error details: Code ${videoElement.error.code}`, videoElement.error.message);
                        }
                        
                        // Try series of alternate paths, in priority order:
                        
                        // 1. First try Object Storage proxy with BANNER bucket
                        if (!currentSrc.includes('/api/storage-proxy/BANNER/')) {
                          const bannerProxyUrl = `/api/storage-proxy/BANNER/banner-slides/${filename}`;
                          console.log("Trying BANNER proxy for video:", bannerProxyUrl);
                          videoElement.src = bannerProxyUrl;
                          return; // Exit and let this attempt process
                        }
                        
                        // 2. Then try Object Storage proxy with DEFAULT bucket
                        if (!currentSrc.includes('/api/storage-proxy/DEFAULT/')) {
                          const defaultProxyUrl = `/api/storage-proxy/DEFAULT/banner-slides/${filename}`;
                          console.log("Trying DEFAULT proxy for video:", defaultProxyUrl);
                          videoElement.src = defaultProxyUrl;
                          return; // Exit and let this attempt process
                        }
                        
                        // 3. Try direct static folder
                        if (!currentSrc.includes('/static/videos/')) {
                          const staticUrl = `/static/videos/${filename}`;
                          console.log("Trying static folder for video:", staticUrl);
                          videoElement.src = staticUrl;
                          return; // Exit and let this attempt process
                        }
                        
                        // 4. If all else fails, try a reliable fallback video
                        if (!currentSrc.includes('BackgroundVideo.mp4')) {
                          const fallbackUrl = `/static/videos/BackgroundVideo.mp4`;
                          console.log("Trying fallback video:", fallbackUrl);
                          videoElement.src = fallbackUrl;
                          return; // Exit and let this attempt process
                        }
                        
                        // If we get here, all attempts have failed
                        console.error("Could not load video from any source");
                        
                        // Show a visual indicator within the video container
                        const container = videoElement.parentElement;
                        if (container) {
                          const errorDiv = document.createElement('div');
                          errorDiv.className = 'absolute inset-0 flex items-center justify-center bg-black/50 text-white text-center p-4';
                          errorDiv.innerHTML = '<p>Video Unavailable</p><p class="text-sm opacity-80 mt-1">Unable to load video content</p>';
                          container.appendChild(errorDiv);
                        }
                      }}
                    ></video>
                  </div>
                ) : (
                  <div 
                    className="w-full aspect-[3/2] sm:aspect-[3/1] rounded-md mt-2 border flex items-center justify-center bg-muted/20 overflow-hidden"
                    style={{
                      backgroundPosition: editedSlide.bgPosition || 'center',
                    }}
                  >
                    {/* Use an actual img tag instead of background-image for better error handling */}
                    <img 
                      src={getEnvironmentAppropriateUrl(editedSlide.src, 'banner-slides')} 
                      alt={editedSlide.alt || "Banner preview"}
                      className="w-full h-full object-cover"
                      style={{
                        objectPosition: editedSlide.bgPosition || 'center',
                      }}
                      onError={(e) => {
                        console.log("Image preview error, trying alternative formats");
                        
                        // Try different URL formats
                        const imgElement = e.target as HTMLImageElement;
                        const currentSrc = imgElement.src;
                        const parts = currentSrc.split('/');
                        const filename = parts[parts.length - 1];
                        
                        // Try series of alternate paths, in priority order:
                        
                        // 1. First try Object Storage proxy with BANNER bucket
                        if (!currentSrc.includes('/api/storage-proxy/BANNER/')) {
                          const bannerProxyUrl = `/api/storage-proxy/BANNER/banner-slides/${filename}`;
                          console.log("Trying BANNER proxy for image:", bannerProxyUrl);
                          imgElement.src = bannerProxyUrl;
                          return; // Exit and let this attempt process
                        }
                        
                        // 2. Then try Object Storage proxy with DEFAULT bucket
                        if (!currentSrc.includes('/api/storage-proxy/DEFAULT/')) {
                          const defaultProxyUrl = `/api/storage-proxy/DEFAULT/banner-slides/${filename}`;
                          console.log("Trying DEFAULT proxy for image:", defaultProxyUrl);
                          imgElement.src = defaultProxyUrl;
                          return; // Exit and let this attempt process
                        }
                        
                        // 3. Try direct uploads folder
                        if (!currentSrc.includes('/uploads/banner-slides/')) {
                          const uploadsUrl = `/uploads/banner-slides/${filename}`;
                          console.log("Trying uploads folder for image:", uploadsUrl);
                          imgElement.src = uploadsUrl;
                          return; // Exit and let this attempt process
                        }
                        
                        // If all else fails, use a placeholder
                        console.error("Could not load image from any source");
                        imgElement.src = '/banner-placeholder.jpg';
                        
                        // Show a visual indicator overlaid on the image
                        const container = imgElement.parentElement;
                        if (container) {
                          const errorDiv = document.createElement('div');
                          errorDiv.className = 'absolute inset-0 flex items-center justify-center bg-black/30 text-white text-center p-4';
                          errorDiv.innerHTML = '<p>Image Unavailable</p>';
                          container.appendChild(errorDiv);
                        }
                      }}
                    />
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {imageFile ? `New file selected: ${imageFile.name}` : (
                    editedSlide.src.includes('object-storage.replit.app') ? 
                    `Using Object Storage: ${editedSlide.src.split('/').pop()}` : 
                    editedSlide.src.includes('/uploads/banner-slides/') ?
                    `Using Object Storage: ${editedSlide.src.split('/').pop()} (from local path)` :
                    `Media URL: ${editedSlide.src}`
                  )}
                  {editedSlide.mediaType === 'video' && ' (Video)'}
                </p>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="bgPosition" className="font-medium">Background Position</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {['top left', 'top center', 'top right',
                    'center left', 'center', 'center right',
                    'bottom left', 'bottom center', 'bottom right'].map((position) => (
                    <button
                      key={position}
                      type="button"
                      className={`border rounded-md p-3 sm:p-3 text-base transition-colors hover:bg-primary/10 min-h-[44px] ${
                        editedSlide.bgPosition === position ? 'bg-primary text-primary-foreground font-medium' : 'bg-background'
                      }`}
                      onClick={() => handleChange('bgPosition', position)}
                    >
                      {position}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="settings" className="space-y-4 mt-4">
            <div className="grid gap-4">
              {editedSlide.mediaType === 'video' && (
                <div className="grid gap-2 border p-4 rounded-md bg-primary/5">
                  <Label className="text-base font-medium">Video Settings</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      id="autoplay"
                      checked={editedSlide.autoplay !== false}
                      onChange={(e) => {
                        setEditedSlide(prev => ({
                          ...prev,
                          autoplay: e.target.checked
                        }));
                      }}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="autoplay" className="cursor-pointer">
                      Autoplay video
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Note: Videos will always be muted when autoplaying to comply with browser policies.
                  </p>
                </div>
              )}
              
              <div className="grid gap-2">
                <Label>Slide Order</Label>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium min-w-[100px]">Current Position:</span>
                  <span className="text-sm font-semibold">{index + 1} of {allSlides.length}</span>
                </div>
                
                <div className="flex flex-wrap gap-2 mt-2">
                  {onReorder && (
                    <>
                      <Button 
                        type="button" 
                        size="sm" 
                        variant="outline"
                        onClick={() => onReorder(index, Math.max(0, index - 1))}
                        disabled={index === 0}
                        className="flex items-center gap-1"
                      >
                        <ChevronUp className="h-4 w-4" />
                        Move Up
                      </Button>
                      
                      <Button 
                        type="button" 
                        size="sm" 
                        variant="outline"
                        onClick={() => onReorder(index, Math.min(allSlides.length - 1, index + 1))}
                        disabled={index === allSlides.length - 1}
                        className="flex items-center gap-1"
                      >
                        <ChevronDown className="h-4 w-4" />
                        Move Down
                      </Button>
                    </>
                  )}
                </div>
              </div>
              
              <div className="grid gap-2 pt-4 border-t">
                <Label>Banner Management</Label>
                
                {onAdd && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onAdd}
                    className="flex items-center gap-2 bg-primary/5 hover:bg-primary/10 mt-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add New Banner Slide
                  </Button>
                )}
                
                {onDelete && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log("Delete button clicked, opening confirmation dialog immediately");
                      
                      // Directly delete the slide if there's more than one
                      if (allSlides.length > 1) {
                        if (confirm("Are you sure you want to delete this banner slide? This action cannot be undone.")) {
                          console.log("User confirmed delete for slide index:", index);
                          onDelete(index);
                          onClose();
                        }
                      } else {
                        alert("Cannot delete the last banner slide. At least one slide must exist.");
                      }
                    }}
                    className="flex items-center gap-2 mt-2"
                    disabled={allSlides.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete This Slide
                  </Button>
                )}
                
                {allSlides.length <= 1 && onDelete && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Cannot delete the last remaining slide. At least one slide must exist.
                  </p>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Banner Slide</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this banner slide? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  console.log("Delete confirmation clicked, triggering delete for slide index:", index);
                  setDeleteDialogOpen(false);
                  if (onDelete) {
                    // Call the delete function with the current slide index
                    onDelete(index);
                    // Close the dialog
                    onClose();
                  }
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-2 mt-4 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={handleDialogClose} 
            className="w-full sm:w-auto h-12 sm:h-10 text-base"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting} 
            className="w-full sm:w-auto h-12 sm:h-10 text-base font-medium"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}