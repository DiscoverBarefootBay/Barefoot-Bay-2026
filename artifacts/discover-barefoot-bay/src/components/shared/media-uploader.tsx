import { useState, useRef, useEffect } from 'react';
import { Upload, Image as ImageIcon, X, Crop, Move, AlignCenter, AlignLeft, AlignRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { normalizeMediaUrl } from '@/lib/media-cache';

interface MediaUploaderProps {
  onMediaInsert: (url: string, altText?: string, styles?: MediaStyles, mediaType?: 'image' | 'video' | 'audio') => void;
  onMediaGalleryInsert?: (mediaItems: MediaItem[], styles?: MediaStyles) => void;
  editorContext?: {
    section?: string;
    slug?: string;
  };
  // Cursor position management for WYSIWYG editors
  onBeforeOpen?: () => void;
  onAfterClose?: () => void;
}

interface MediaItem {
  url: string;
  altText?: string;
  mediaType: 'image' | 'video' | 'audio';
}

interface MediaStyles {
  width?: string;
  height?: string;
  align?: 'left' | 'center' | 'right';
  marginTop?: string;
  marginBottom?: string;
  marginLeft?: string;
  marginRight?: string;
}

export function MediaUploader({ onMediaInsert, onMediaGalleryInsert, editorContext, onBeforeOpen, onAfterClose }: MediaUploaderProps) {
  // ENHANCED GALLERY FIX - Version 2025-05-31-094400
  console.log('[GALLERY DEBUG] MediaUploader initialized with gallery support:', !!onMediaGalleryInsert);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('upload');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedMediaUrl, setUploadedMediaUrl] = useState<string | null>(null);
  const [uploadedMediaItems, setUploadedMediaItems] = useState<MediaItem[]>([]);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [isMultipleUpload, setIsMultipleUpload] = useState(false);
  const [mediaAltText, setMediaAltText] = useState('');
  const [existingUrl, setExistingUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'audio'>('image');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [activeSubTab, setActiveSubTab] = useState<string>('basic');
  const { toast } = useToast();
  
  // Media style states
  const [imageStyles, setImageStyles] = useState<MediaStyles>({
    width: '100%',
    align: 'center',
  });
  const [imageSizeOption, setImageSizeOption] = useState<'custom' | 'small' | 'medium' | 'large' | 'full'>('medium');

  // Media size presets
  const sizePresets = {
    small: { width: '25%' },
    medium: { width: '50%' },
    large: { width: '75%' },
    full: { width: '100%' },
  };

  // Update image size based on preset selection
  useEffect(() => {
    if (imageSizeOption !== 'custom') {
      const preset = sizePresets[imageSizeOption];
      setImageStyles((prev: MediaStyles) => ({ ...prev, ...preset }));
    }
  }, [imageSizeOption]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) {
      return;
    }

    setIsUploading(true);
    setUploadedMediaUrl(null);
    setUploadedMediaItems([]);
    
    // Handle either single file or multiple files
    if (isMultipleUpload) {
      await handleMultipleFileUpload(event.target.files);
    } else {
      // For backward compatibility, handle single file upload as before
      const file = event.target.files[0];
      
      // Determine if the file is a video or image
      const isVideo = file.type.startsWith('video/');
      setMediaType(isVideo ? 'video' : 'image');
      
      await handleSingleFileUpload(file);
    }
  };
  
  const handleMultipleFileUpload = async (files: FileList) => {
    const formData = new FormData();
    
    // Determine section from editorContext or page path
    let section = 'content'; // Default section
    
    // If editor context provides a section, use that
    if (editorContext?.section) {
      section = editorContext.section;
    } 
    // Otherwise determine from URL path
    else {
      const pathSegments = window.location.pathname.split('/').filter(Boolean);
      if (pathSegments.length > 0) {
        const firstSegment = pathSegments[0].toLowerCase();
        // Map common URL paths to section names
        if (firstSegment === 'forum') section = 'forum';
        else if (firstSegment === 'calendar' || firstSegment === 'events') section = 'calendar';
        else if (firstSegment === 'vendors') section = 'vendors';
        else if (firstSegment === 'real-estate' || firstSegment === 'for-sale') section = 'real-estate';
        else if (firstSegment === 'community') section = 'community';
      }
    }
    
    // For forum section, use the dedicated multiple upload endpoint
    if (section === 'forum') {
      console.log('[MediaUploader] Using multiple file upload endpoint for forum');
      
      // Append all files to the form data with the field name 'files'
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }
      
      try {
        // Make the upload request to our new endpoint
        const response = await fetch('/api/forum/media/upload-multiple', {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error(`Upload failed with status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.files && result.files.length > 0) {
          const uploadedItems: MediaItem[] = result.files
            .filter((file: any) => file.success)
            .map((file: any) => ({
              url: file.url,
              altText: file.originalName?.split('.')[0] || 'Media',
              mediaType: file.mediaType || 'image'
            }));
            
          if (uploadedItems.length > 0) {
            setUploadedMediaItems(uploadedItems);
            setCurrentMediaIndex(0);
            
            // Set the first item as the current one
            const firstItem = uploadedItems[0];
            setUploadedMediaUrl(firstItem.url);
            setMediaAltText(firstItem.altText || '');
            setMediaType(firstItem.mediaType);
            
            toast({
              title: 'Upload Complete',
              description: `Successfully uploaded ${result.successfulUploads} of ${result.totalFiles} files`,
            });
            
            return;
          }
        }
        
        // If we get here, the upload failed or returned invalid data
        throw new Error('Failed to process uploaded files');
      } catch (error) {
        console.error('[MediaUploader] Multiple file upload error:', error);
        toast({
          title: 'Upload Failed',
          description: error instanceof Error ? error.message : 'Failed to upload files',
          variant: 'destructive',
        });
      } finally {
        setIsUploading(false);
      }
    } 
    else {
      // For other sections, fall back to individual uploads
      const uploadedItems: MediaItem[] = [];
      let success = 0;
      let failed = 0;
      
      // Process files one by one
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isVideo = file.type.startsWith('video/');
        const isAudio = file.type.startsWith('audio/');
        const mediaType = isVideo ? 'video' : (isAudio ? 'audio' : 'image');
        
        try {
          const uploadResult = await uploadSingleFile(file, mediaType);
          if (uploadResult) {
            // Extract file name without extension as alt text
            const fileName = file.name.split('.').slice(0, -1).join('.');
            
            uploadedItems.push({
              url: uploadResult,
              altText: fileName,
              mediaType
            });
            success++;
          } else {
            failed++;
          }
        } catch (error) {
          console.error(`Error uploading file ${file.name}:`, error);
          failed++;
        }
      }
      
      if (uploadedItems.length > 0) {
        setUploadedMediaItems(uploadedItems);
        setCurrentMediaIndex(0);
        
        // Set the first item as the current one
        const firstItem = uploadedItems[0];
        setUploadedMediaUrl(firstItem.url);
        setMediaAltText(firstItem.altText || '');
        setMediaType(firstItem.mediaType);
        
        toast({
          title: 'Upload Complete',
          description: `Successfully uploaded ${success} files${failed > 0 ? `, ${failed} failed` : ''}`,
        });
      } else if (failed > 0) {
        toast({
          title: 'Upload Failed',
          description: `Failed to upload all ${failed} files`,
          variant: 'destructive',
        });
      }
    }
  };
  
  const uploadSingleFile = async (file: File, mediaType: 'image' | 'video' | 'audio'): Promise<string | null> => {
    try {
      const formData = new FormData();
      
      // Determine section from editorContext, page path, or default
      let section = 'content'; // Default section
      let endpoint = '/api/upload';
      const fieldName = 'file'; // Default field name
      
      // If editor context provides a section, use that
      if (editorContext?.section) {
        section = editorContext.section;
      } 
      // Otherwise determine from URL path
      else {
        const pathSegments = window.location.pathname.split('/').filter(Boolean);
        if (pathSegments.length > 0) {
          const firstSegment = pathSegments[0].toLowerCase();
          // Map common URL paths to section names
          if (firstSegment === 'forum') section = 'forum';
          else if (firstSegment === 'calendar' || firstSegment === 'events') section = 'calendar';
          else if (firstSegment === 'vendors') section = 'vendors';
          else if (firstSegment === 'real-estate' || firstSegment === 'for-sale') section = 'real-estate';
          else if (firstSegment === 'community') section = 'community';
        }
      }
      
      // Use specialized upload endpoints based on section
      console.log('[MediaUploader] Determining upload endpoint for section:', section);
      
      if (section === 'forum') {
        endpoint = '/api/forum/tinymce-upload';
        console.log('[MediaUploader] Using specialized forum upload endpoint:', endpoint);
      } else if (section === 'vendors') {
        endpoint = '/api/vendor/tinymce-upload';
        console.log('[MediaUploader] Using specialized vendor upload endpoint:', endpoint);
      } else if (section === 'community') {
        endpoint = '/api/community/tinymce-upload';
        console.log('[MediaUploader] Using specialized community upload endpoint:', endpoint);
      }
      
      // Append the file to the form
      formData.append(fieldName, file);
      
      // Add section context to help the server route the file to the correct bucket
      formData.append('section', section);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Failed to upload ${mediaType === 'video' ? 'video' : 'image'}: ${response.statusText}`);
      }

      const data = await response.json();
      // Check if response has location (TinyMCE format) or url property
      const mediaUrl = data.url || data.location;
      
      if (!mediaUrl) {
        throw new Error('Server returned a successful response but no media URL was included');
      }
      
      return mediaUrl;
    } catch (error) {
      console.error('[MediaUploader] Upload error:', error);
      return null;
    }
  };
  
  const handleSingleFileUpload = async (file: File) => {
    // Determine if the file is a video, audio, or image
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');
    setMediaType(isVideo ? 'video' : (isAudio ? 'audio' : 'image'));

    try {
      const formData = new FormData();
      
      // Determine section from editorContext, page path, or default
      let section = 'content'; // Default section
      let endpoint = '/api/upload';
      const fieldName = 'file'; // Default field name
      
      // If editor context provides a section, use that
      if (editorContext?.section) {
        section = editorContext.section;
      } 
      // Otherwise determine from URL path
      else {
        const pathSegments = window.location.pathname.split('/').filter(Boolean);
        if (pathSegments.length > 0) {
          const firstSegment = pathSegments[0].toLowerCase();
          // Map common URL paths to section names
          if (firstSegment === 'forum') section = 'forum';
          else if (firstSegment === 'calendar' || firstSegment === 'events') section = 'calendar';
          else if (firstSegment === 'vendors') section = 'vendors';
          else if (firstSegment === 'real-estate' || firstSegment === 'for-sale') section = 'real-estate';
          else if (firstSegment === 'community') section = 'community';
        }
      }
      
      // Use specialized upload endpoints based on section
      console.log('[MediaUploader] Determining upload endpoint for section:', section);
      console.log('[MediaUploader] Current pathname:', window.location.pathname);
      console.log('[MediaUploader] editorContext:', editorContext);
      
      if (section === 'forum') {
        endpoint = '/api/forum/tinymce-upload';
        console.log('[MediaUploader] Using specialized forum upload endpoint:', endpoint);
      } else if (section === 'vendors') {
        endpoint = '/api/vendor/tinymce-upload';
        console.log('[MediaUploader] Using specialized vendor upload endpoint:', endpoint);
      } else if (section === 'community') {
        endpoint = '/api/community/tinymce-upload';
        console.log('[MediaUploader] Using specialized community upload endpoint:', endpoint);
      } else {
        console.log('[MediaUploader] No specialized endpoint for section:', section);
      }
      
      // Enhanced logging for uploads
      console.log(`[MediaUploader] Upload context:`, {
        section,
        editorContext,
        currentPath: window.location.pathname,
        endpoint,
        fieldName,
        fileType: file.type,
        fileSize: `${Math.round(file.size / 1024)}KB`,
        fileName: file.name
      });
      
      // Append the file to the form
      formData.append(fieldName, file);
      
      // Add section context to help the server route the file to the correct bucket
      formData.append('section', section);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      console.log(`[MediaUploader] Upload response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[MediaUploader] Upload failed with status ${response.status}:`, errorText);
        throw new Error(`Failed to upload ${isVideo ? 'video' : 'image'}: ${response.statusText}`);
      }

      const data = await response.json();
      // Check if response has location (TinyMCE format) or url property
      const mediaUrl = data.url || data.location;
      console.log(`[MediaUploader] Upload successful, received URL:`, mediaUrl);
      
      if (!mediaUrl) {
        console.error('[MediaUploader] No URL or location found in response:', data);
        throw new Error('Server returned a successful response but no media URL was included');
      }
      
      setUploadedMediaUrl(mediaUrl);
      
      // Set alt text to filename without extension as default
      const fileName = file.name.split('.').slice(0, -1).join('.');
      setMediaAltText(fileName);

      // Reset image size to medium (default)
      setImageSizeOption('medium');
      setImageStyles({
        width: '50%',
        align: 'center',
      });

      toast({
        title: 'Success',
        description: `${isVideo ? 'Video' : 'Image'} uploaded successfully to ${section} section`,
      });
    } catch (error) {
      console.error('[MediaUploader] Upload error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : `Failed to upload ${isVideo ? 'video' : 'image'}`,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleInsert = () => {
    console.log('[MediaUploader] HandleInsert called with state:', {
      activeTab,
      uploadedMediaUrl,
      uploadedMediaItems: uploadedMediaItems.length,
      hasGalleryCallback: !!onMediaGalleryInsert,
      isMultipleUpload,
      items: uploadedMediaItems
    });

    if (activeTab === 'upload' && (uploadedMediaUrl || uploadedMediaItems.length > 0)) {
      // Check if we have multiple uploaded items (gallery case)
      if (uploadedMediaItems.length > 1) {
        console.log(`[GALLERY CRITICAL] Multiple items detected! Creating gallery with ${uploadedMediaItems.length} items`);
        
        if (onMediaGalleryInsert) {
          console.log(`[GALLERY CRITICAL] Using onMediaGalleryInsert callback`);
          onMediaGalleryInsert(uploadedMediaItems, imageStyles);
        } else {
          console.log(`[GALLERY CRITICAL] No gallery callback available, creating gallery directly`);
          // Import and use the gallery generator directly
          import('@/lib/media-gallery-generator').then(({ generateMediaGallery }) => {
            const galleryHtml = generateMediaGallery(uploadedMediaItems);
            onMediaInsert(galleryHtml, `Gallery of ${uploadedMediaItems.length} items`, imageStyles, 'image');
          });
        }
        
        resetForm();
        setOpen(false);
        return;
      }
      
      // Single item insertion - use uploadedMediaUrl or first item from array
      const mediaUrl = uploadedMediaUrl || (uploadedMediaItems.length > 0 ? uploadedMediaItems[0].url : null);
      const altText = mediaAltText || (uploadedMediaItems.length > 0 ? uploadedMediaItems[0].altText : '');
      const type = mediaType || (uploadedMediaItems.length > 0 ? uploadedMediaItems[0].mediaType : 'image');
      
      if (mediaUrl) {
        const normalizedUrl = normalizeMediaUrl(mediaUrl);
        console.log(`[MediaUploader] Inserting single media: ${normalizedUrl}`);
        onMediaInsert(normalizedUrl, altText, imageStyles, type);
        resetForm();
        setOpen(false);
      } else {
        toast({
          title: 'Missing information',
          description: 'No media available to insert',
          variant: 'destructive',
        });
      }
    } else if (activeTab === 'url' && existingUrl) {
      // URLs from external sources are assumed to be images unless they end with common video extensions
      const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(existingUrl);
      // For external URLs, we don't need to normalize since they're likely already absolute
      // But for internal URLs that might be provided, we should still normalize
      const normalizedUrl = existingUrl.startsWith('http') ? existingUrl : normalizeMediaUrl(existingUrl);
      onMediaInsert(normalizedUrl, mediaAltText, imageStyles, isVideo ? 'video' : 'image');
      resetForm();
      setOpen(false);
    } else {
      toast({
        title: 'Missing information',
        description: 'Please upload media or provide a URL first',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setUploadedMediaUrl(null);
    setUploadedMediaItems([]);
    setCurrentMediaIndex(0);
    setMediaAltText('');
    setExistingUrl('');
    setMediaType('image');
    setImageSizeOption('medium');
    setImageStyles({
      width: '50%',
      align: 'center',
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle custom width change
  const handleWidthChange = (value: number) => {
    // Convert slider value (0-100) to percentage
    const widthPercentage = `${value}%`;
    setImageStyles((prev: MediaStyles) => ({ ...prev, width: widthPercentage }));
    setImageSizeOption('custom');
  };

  // Apply alignment
  const handleAlignmentChange = (alignment: 'left' | 'center' | 'right') => {
    setImageStyles((prev: MediaStyles) => ({ ...prev, align: alignment }));
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (newOpen && !open) {
        // Dialog is opening
        onBeforeOpen?.();
      } else if (!newOpen && open) {
        // Dialog is closing
        onAfterClose?.();
      }
      setOpen(newOpen);
    }}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          title="Insert media"
          className="hover:bg-gray-100 dark:hover:bg-gray-800"
          onClick={() => {
            // Save cursor position before opening dialog
            onBeforeOpen?.();
          }}
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2 pr-8">
          <DialogTitle className="text-base sm:text-lg pr-4">Insert Media</DialogTitle>
        </DialogHeader>
        
        <Tabs 
          defaultValue="upload" 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="mt-2 space-y-2"
        >
          <TabsList className="grid w-full grid-cols-2 h-8 sm:h-10">
            <TabsTrigger value="upload" className="text-xs sm:text-sm">Upload New</TabsTrigger>
            <TabsTrigger value="url" className="text-xs sm:text-sm">Use URL</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload" className="space-y-3 py-2 sm:py-4">
            <div className="space-y-2">
              <Label htmlFor="image-upload" className="text-sm">Upload image or video</Label>
              <div className="space-y-2">
                <div className="flex items-center">
                  <Label htmlFor="multiple-upload" className="mr-2 text-xs sm:text-sm">Enable multiple files</Label>
                  <input 
                    type="checkbox" 
                    id="multiple-upload" 
                    checked={isMultipleUpload}
                    onChange={(e) => setIsMultipleUpload(e.target.checked)}
                    className="mr-2"
                  />
                </div>
                <Input 
                  id="image-upload" 
                  ref={fileInputRef}
                  type="file" 
                  multiple={isMultipleUpload}
                  accept="image/*,video/*,audio/*" 
                  onChange={handleUpload} 
                  disabled={isUploading}
                />
              </div>
            </div>
            
            {isUploading && (
              <div className="flex justify-center py-8">
                <Spinner size="lg" />
              </div>
            )}
            
            {uploadedMediaUrl && !isUploading && (
              <div className="space-y-4">
                {/* Media Preview */}
                <div className="relative border rounded-md overflow-hidden">
                  {/* Gallery Navigation Controls (only show if multiple items) */}
                  {uploadedMediaItems.length > 1 && (
                    <div className="absolute top-0 left-0 right-0 flex justify-between p-2 z-10 bg-black/10">
                      <div className="text-sm text-white bg-black/50 px-2 py-1 rounded">
                        {currentMediaIndex + 1} / {uploadedMediaItems.length}
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => {
                            if (currentMediaIndex > 0) {
                              const newIndex = currentMediaIndex - 1;
                              setCurrentMediaIndex(newIndex);
                              const item = uploadedMediaItems[newIndex];
                              setUploadedMediaUrl(item.url);
                              setMediaAltText(item.altText || '');
                              setMediaType(item.mediaType);
                            }
                          }}
                          className="h-8 w-8 rounded-full bg-white/80 hover:bg-white"
                          disabled={currentMediaIndex === 0}
                        >
                          <ChevronLeft size={16} />
                        </Button>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => {
                            if (currentMediaIndex < uploadedMediaItems.length - 1) {
                              const newIndex = currentMediaIndex + 1;
                              setCurrentMediaIndex(newIndex);
                              const item = uploadedMediaItems[newIndex];
                              setUploadedMediaUrl(item.url);
                              setMediaAltText(item.altText || '');
                              setMediaType(item.mediaType);
                            }
                          }}
                          className="h-8 w-8 rounded-full bg-white/80 hover:bg-white"
                          disabled={currentMediaIndex === uploadedMediaItems.length - 1}
                        >
                          <ChevronRight size={16} />
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  <div 
                    className="p-4 flex justify-center" 
                    style={{ 
                      textAlign: imageStyles.align || 'center'
                    }}
                  >
                    {mediaType === 'image' ? (
                      <img 
                        ref={imageRef}
                        src={normalizeMediaUrl(uploadedMediaUrl)} 
                        alt="Preview" 
                        className="h-auto max-h-[200px] object-contain"
                        style={{ 
                          width: imageStyles.width || '50%',
                          marginLeft: imageStyles.align === 'center' ? 'auto' : (imageStyles.align === 'right' ? 'auto' : '0'),
                          marginRight: imageStyles.align === 'center' ? 'auto' : (imageStyles.align === 'left' ? 'auto' : '0')
                        }}
                        onError={(e) => {
                          console.log("Image preview error for:", uploadedMediaUrl);
                          // Try a direct URL format if Object Storage proxy fails
                          if (uploadedMediaUrl?.includes('api/storage-proxy/')) {
                            // Extract just the filename
                            const parts = uploadedMediaUrl.split('/');
                            const fileName = parts[parts.length - 1];
                            
                            // Determine which bucket to use based on section
                            let bucket = 'direct-forum'; // Default fallback
                            if (editorContext?.section === 'vendors') {
                              bucket = 'direct-vendors';
                              console.log("Using vendors bucket for fallback");
                            } else if (editorContext?.section === 'calendar') {
                              bucket = 'direct-calendar';
                            } else if (editorContext?.section === 'community') {
                              bucket = 'direct-community';
                              console.log("Using community bucket for fallback");
                            }
                            
                            e.currentTarget.src = `/api/storage-proxy/${bucket}/${fileName}`;
                            console.log("Trying fallback URL:", e.currentTarget.src);
                          } else {
                            // Default to a placeholder if all else fails
                            e.currentTarget.src = '/public/media-placeholder/default-image.svg';
                          }
                        }}
                      />
                    ) : mediaType === 'audio' ? (
                      <audio
                        src={normalizeMediaUrl(uploadedMediaUrl)}
                        controls
                        className="w-full"
                        style={{ 
                          width: imageStyles.width || '50%',
                          marginLeft: imageStyles.align === 'center' ? 'auto' : (imageStyles.align === 'right' ? 'auto' : '0'),
                          marginRight: imageStyles.align === 'center' ? 'auto' : (imageStyles.align === 'left' ? 'auto' : '0')
                        }}
                        onError={(e) => {
                          console.log("Audio preview error for:", uploadedMediaUrl);
                          // Try a direct URL format if Object Storage proxy fails
                          if (uploadedMediaUrl?.includes('api/storage-proxy/')) {
                            // Extract just the filename
                            const parts = uploadedMediaUrl.split('/');
                            const fileName = parts[parts.length - 1];
                            
                            // Determine which bucket to use based on section
                            let bucket = 'direct-forum'; // Default fallback
                            if (editorContext?.section === 'vendors') {
                              bucket = 'direct-vendors';
                            } else if (editorContext?.section === 'calendar') {
                              bucket = 'direct-calendar';
                            } else if (editorContext?.section === 'community') {
                              bucket = 'direct-community';
                            }
                            
                            e.currentTarget.src = `/api/storage-proxy/${bucket}/${fileName}`;
                            console.log("Trying fallback URL:", e.currentTarget.src);
                          }
                        }}
                      />
                    ) : (
                      <video 
                        src={normalizeMediaUrl(uploadedMediaUrl)} 
                        controls
                        className="h-auto max-h-[200px] object-contain"
                        style={{ 
                          width: imageStyles.width || '50%',
                          marginLeft: imageStyles.align === 'center' ? 'auto' : (imageStyles.align === 'right' ? 'auto' : '0'),
                          marginRight: imageStyles.align === 'center' ? 'auto' : (imageStyles.align === 'left' ? 'auto' : '0')
                        }}
                        onError={(e) => {
                          console.log("Video preview error for:", uploadedMediaUrl);
                          // Try a direct URL format if Object Storage proxy fails
                          if (uploadedMediaUrl?.includes('api/storage-proxy/')) {
                            // Extract just the filename
                            const parts = uploadedMediaUrl.split('/');
                            const fileName = parts[parts.length - 1];
                            
                            // Determine which bucket to use based on section
                            let bucket = 'direct-forum'; // Default fallback
                            if (editorContext?.section === 'vendors') {
                              bucket = 'direct-vendors';
                              console.log("Using vendors bucket for video fallback");
                            } else if (editorContext?.section === 'calendar') {
                              bucket = 'direct-calendar';
                            } else if (editorContext?.section === 'community') {
                              bucket = 'direct-community';
                              console.log("Using community bucket for video fallback");
                            }
                            
                            e.currentTarget.src = `/api/storage-proxy/${bucket}/${fileName}`;
                            console.log("Trying fallback URL:", e.currentTarget.src);
                          }
                        }}
                      />
                    )}
                  </div>
                  
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6 rounded-full"
                    onClick={() => {
                      setUploadedMediaUrl(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* Image settings tabs */}
                <Tabs 
                  defaultValue="basic" 
                  value={activeSubTab} 
                  onValueChange={setActiveSubTab}
                >
                  <TabsList className="grid w-full grid-cols-2 h-8 sm:h-10">
                    <TabsTrigger value="basic" className="text-xs sm:text-sm">Basic Info</TabsTrigger>
                    <TabsTrigger value="appearance" className="text-xs sm:text-sm">Size & Alignment</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="basic" className="space-y-2 sm:space-y-3 mt-2 sm:mt-3">
                    <div className="space-y-2">
                      <Label htmlFor="alt-text" className="text-sm">Alt Text</Label>
                      <Input 
                        id="alt-text" 
                        value={mediaAltText} 
                        onChange={(e) => setMediaAltText(e.target.value)} 
                        placeholder={`Describe this ${mediaType}`}
                        className="text-sm" 
                      />
                      <p className="text-xs text-gray-500">
                        Alternative text describes your media to people who can't see it. Good alt text is concise and descriptive.
                      </p>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="appearance" className="space-y-5 mt-3">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <Label>Media size</Label>
                        <Select
                          value={imageSizeOption}
                          onValueChange={(value) => setImageSizeOption(value as any)}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue placeholder="Size" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="small">Small</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="large">Large</SelectItem>
                            <SelectItem value="full">Full width</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex items-center gap-2 pt-2">
                        <Move size={18} className="text-gray-500" />
                        <Slider
                          defaultValue={[50]}
                          value={[parseInt(imageStyles.width || '50')]}
                          max={100}
                          step={1}
                          onValueChange={(values) => handleWidthChange(values[0])}
                          className="flex-grow"
                        />
                        <span className="text-sm w-12 text-right">
                          {imageStyles.width || '50%'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <Label>Alignment</Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={imageStyles.align === 'left' ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1"
                          onClick={() => handleAlignmentChange('left')}
                        >
                          <AlignLeft size={16} className="mr-1" /> Left
                        </Button>
                        <Button
                          type="button"
                          variant={imageStyles.align === 'center' ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1"
                          onClick={() => handleAlignmentChange('center')}
                        >
                          <AlignCenter size={16} className="mr-1" /> Center
                        </Button>
                        <Button
                          type="button"
                          variant={imageStyles.align === 'right' ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1"
                          onClick={() => handleAlignmentChange('right')}
                        >
                          <AlignRight size={16} className="mr-1" /> Right
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="url" className="space-y-3 py-2 sm:py-4">
            <div className="space-y-2">
              <Label htmlFor="image-url" className="text-sm">Media URL</Label>
              <Input 
                id="image-url" 
                value={existingUrl} 
                onChange={(e) => setExistingUrl(e.target.value)} 
                placeholder="https://example.com/media.jpg"
                className="text-sm"
              />
            </div>
            
            {existingUrl && (
              <>
                <div className="relative border rounded-md overflow-hidden">
                  <div 
                    className="p-4 flex justify-center" 
                    style={{ 
                      textAlign: imageStyles.align || 'center'
                    }}
                  >
                    {/\.(mp4|webm|ogg|mov)$/i.test(existingUrl) ? (
                      <video 
                        src={existingUrl.startsWith('http') ? existingUrl : normalizeMediaUrl(existingUrl)} 
                        controls
                        className="h-auto max-h-[200px] object-contain"
                        style={{ 
                          width: imageStyles.width || '50%',
                          marginLeft: imageStyles.align === 'center' ? 'auto' : (imageStyles.align === 'right' ? 'auto' : '0'),
                          marginRight: imageStyles.align === 'center' ? 'auto' : (imageStyles.align === 'left' ? 'auto' : '0')
                        }}
                        onError={(e) => {
                          console.log("Video preview error for:", existingUrl);
                          // Try a direct URL format if Object Storage proxy fails
                          if (existingUrl?.includes('api/storage-proxy/')) {
                            // Extract just the filename
                            const parts = existingUrl.split('/');
                            const fileName = parts[parts.length - 1];
                            
                            // Determine which bucket to use based on section
                            let bucket = 'direct-forum'; // Default fallback
                            if (editorContext?.section === 'vendors') {
                              bucket = 'direct-vendors';
                              console.log("Using vendors bucket for video URL fallback");
                            } else if (editorContext?.section === 'calendar') {
                              bucket = 'direct-calendar';
                            } else if (editorContext?.section === 'community') {
                              bucket = 'direct-community';
                              console.log("Using community bucket for video URL fallback");
                            }
                            
                            e.currentTarget.src = `/api/storage-proxy/${bucket}/${fileName}`;
                            console.log("Trying fallback URL:", e.currentTarget.src);
                          }
                        }}
                      />
                    ) : (
                      <img 
                        src={existingUrl.startsWith('http') ? existingUrl : normalizeMediaUrl(existingUrl)} 
                        alt="Preview" 
                        className="h-auto max-h-[200px] object-contain"
                        style={{ 
                          width: imageStyles.width || '50%',
                          marginLeft: imageStyles.align === 'center' ? 'auto' : (imageStyles.align === 'right' ? 'auto' : '0'),
                          marginRight: imageStyles.align === 'center' ? 'auto' : (imageStyles.align === 'left' ? 'auto' : '0')
                        }}
                        onError={(e) => {
                          console.log("Image preview error for:", existingUrl);
                          // Try a direct URL format if Object Storage proxy fails
                          if (existingUrl?.includes('api/storage-proxy/')) {
                            // Extract just the filename
                            const parts = existingUrl.split('/');
                            const fileName = parts[parts.length - 1];
                            
                            // Determine which bucket to use based on section
                            let bucket = 'direct-forum'; // Default fallback
                            if (editorContext?.section === 'vendors') {
                              bucket = 'direct-vendors';
                              console.log("Using vendors bucket for image fallback");
                            } else if (editorContext?.section === 'calendar') {
                              bucket = 'direct-calendar';
                            } else if (editorContext?.section === 'community') {
                              bucket = 'direct-community';
                              console.log("Using community bucket for image fallback");
                            }
                            
                            e.currentTarget.src = `/api/storage-proxy/${bucket}/${fileName}`;
                            console.log("Trying fallback URL:", e.currentTarget.src);
                          } else {
                            // Default to a placeholder if all else fails
                            e.currentTarget.src = '/public/media-placeholder/default-image.svg';
                            e.currentTarget.alt = 'Failed to load image';
                          }
                        }}
                      />
                    )}
                  </div>
                </div>
                
                <Tabs 
                  defaultValue="basic" 
                  value={activeSubTab} 
                  onValueChange={setActiveSubTab}
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="basic">Basic Info</TabsTrigger>
                    <TabsTrigger value="appearance">Size & Alignment</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="basic" className="space-y-3 mt-3">
                    <div className="space-y-2">
                      <Label htmlFor="alt-text-url">Alt text</Label>
                      <Input 
                        id="alt-text-url" 
                        value={mediaAltText} 
                        onChange={(e) => setMediaAltText(e.target.value)} 
                        placeholder="Describe this media" 
                      />
                      <p className="text-xs text-gray-500">
                        Alternative text helps people who can't see the media understand its content. Good alt text is concise and descriptive.
                      </p>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="appearance" className="space-y-5 mt-3">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <Label>Media size</Label>
                        <Select
                          value={imageSizeOption}
                          onValueChange={(value) => setImageSizeOption(value as any)}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue placeholder="Size" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="small">Small</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="large">Large</SelectItem>
                            <SelectItem value="full">Full width</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex items-center gap-2 pt-2">
                        <Move size={18} className="text-gray-500" />
                        <Slider
                          defaultValue={[50]}
                          value={[parseInt(imageStyles.width || '50')]}
                          max={100}
                          step={1}
                          onValueChange={(values) => handleWidthChange(values[0])}
                          className="flex-grow"
                        />
                        <span className="text-sm w-12 text-right">
                          {imageStyles.width || '50%'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <Label>Alignment</Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={imageStyles.align === 'left' ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1"
                          onClick={() => handleAlignmentChange('left')}
                        >
                          <AlignLeft size={16} className="mr-1" /> Left
                        </Button>
                        <Button
                          type="button"
                          variant={imageStyles.align === 'center' ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1"
                          onClick={() => handleAlignmentChange('center')}
                        >
                          <AlignCenter size={16} className="mr-1" /> Center
                        </Button>
                        <Button
                          type="button"
                          variant={imageStyles.align === 'right' ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1"
                          onClick={() => handleAlignmentChange('right')}
                        >
                          <AlignRight size={16} className="mr-1" /> Right
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </TabsContent>
        </Tabs>
        
        <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-2 pt-3 sm:pt-4 border-t border-gray-200 mt-4">
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto order-2 sm:order-1"
            onClick={() => {
              resetForm();
              setOpen(false);
            }}
          >
            Cancel
          </Button>
          <Button 
            size="sm"
            className="w-full sm:w-auto order-1 sm:order-2"
            onClick={() => {
              console.log('[MediaUploader] Button clicked! State:', {
                uploadedMediaItems: uploadedMediaItems.length,
                hasGalleryCallback: !!onMediaGalleryInsert,
                uploadedMediaUrl,
                activeTab
              });
              handleInsert();
            }} 
            disabled={(!uploadedMediaUrl && !existingUrl) || isUploading}
          >
            {uploadedMediaItems.length > 1 
              ? `Insert Gallery (${uploadedMediaItems.length} items)` 
              : 'Insert Media'
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}