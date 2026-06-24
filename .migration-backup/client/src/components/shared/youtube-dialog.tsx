import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from '@/components/ui/switch';
import { Youtube } from 'lucide-react';

interface YouTubeDialogProps {
  onInsert: (embedHtml: string) => void;
  onBeforeOpen?: () => void;
}

export function YouTubeDialog({ onInsert, onBeforeOpen }: YouTubeDialogProps) {
  const [open, setOpen] = useState(false);
  
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && onBeforeOpen) {
      onBeforeOpen();
    }
    setOpen(newOpen);
  };
  const [url, setUrl] = useState('');
  const [width, setWidth] = useState('560');
  const [height, setHeight] = useState('315');
  const [showControls, setShowControls] = useState(true);
  const [muted, setMuted] = useState(false);
  const [autoplay, setAutoplay] = useState(false);

  const sizePresets = [
    { label: 'Small (480x270)', width: '480', height: '270' },
    { label: 'Medium (560x315)', width: '560', height: '315' },
    { label: 'Large (720x405)', width: '720', height: '405' },
    { label: 'Extra Large (1280x720)', width: '1280', height: '720' },
    // Vertical presets for Shorts
    { label: 'Shorts Small (270x480)', width: '270', height: '480' },
    { label: 'Shorts Medium (360x640)', width: '360', height: '640' },
    { label: 'Shorts Large (450x800)', width: '450', height: '800' },
    { label: 'Shorts Full (720x1280)', width: '720', height: '1280' }
  ];

  const extractVideoId = (url: string): string | null => {
    const patterns = [
      // Regular YouTube videos
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
      // YouTube Shorts
      /youtube\.com\/shorts\/([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const generateEmbedUrl = (videoId: string): string => {
    const params = new URLSearchParams();
    
    if (!showControls) params.append('controls', '0');
    if (muted) params.append('mute', '1');
    if (autoplay) params.append('autoplay', '1');
    
    params.append('rel', '0');
    params.append('modestbranding', '1');
    
    const paramString = params.toString();
    return `https://www.youtube.com/embed/${videoId}${paramString ? '?' + paramString : ''}`;
  };

  const handleInsert = () => {
    if (!url.trim()) {
      alert('Please enter a YouTube URL');
      return;
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      alert('Please enter a valid YouTube URL');
      return;
    }

    const embedUrl = generateEmbedUrl(videoId);
    
    // Determine if this is likely a vertical video (Shorts) based on dimensions
    const isVertical = parseInt(height) > parseInt(width);
    
    // Build the iframe HTML manually to ensure proper allowfullscreen attribute
    // This prevents YouTube Error 153 caused by allowfullscreen=""
    const styleValue = isVertical 
      ? 'max-width: 100%; height: auto;'
      : 'max-width: 100%; height: auto; aspect-ratio: 16/9;';
    
    // Build iframe HTML string with required YouTube 2024 attributes
    // YouTube now requires referrerpolicy to prevent Error 153
    const embedHtml = `<div style="position: relative; width: 100%; max-width: ${width}px; margin: 10px 0;">
  <iframe 
    width="${width}" 
    height="${height}" 
    src="${embedUrl}" 
    title="YouTube video player" 
    frameborder="0" 
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
    referrerpolicy="strict-origin-when-cross-origin"
    allowfullscreen
    style="${styleValue}">
  </iframe>
</div>`;

    onInsert(embedHtml);
    handleOpenChange(false);
    
    // Reset form
    setUrl('');
    setWidth('560');
    setHeight('315');
    setShowControls(true);
    setMuted(false);
    setAutoplay(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button 
          type="button" 
          size="sm" 
          variant="ghost" 
          className="h-8 w-8 p-0" 
          title="Insert YouTube Video"
        >
          <Youtube size={16} />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Insert YouTube Video</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="youtube-url">YouTube URL</Label>
            <Input
              id="youtube-url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Video Size</Label>
            <Select 
              value={`${width}x${height}`}
              onValueChange={(value) => {
                const preset = sizePresets.find(p => `${p.width}x${p.height}` === value);
                if (preset) {
                  setWidth(preset.width);
                  setHeight(preset.height);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sizePresets.map((preset) => (
                  <SelectItem key={preset.label} value={`${preset.width}x${preset.height}`}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="width">Width (px)</Label>
              <Input
                id="width"
                type="number"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="height">Height (px)</Label>
              <Input
                id="height"
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="show-controls">Show Player Controls</Label>
              <Switch
                id="show-controls"
                checked={showControls}
                onCheckedChange={setShowControls}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="muted">Mute Audio by Default</Label>
              <Switch
                id="muted"
                checked={muted}
                onCheckedChange={setMuted}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="autoplay">Autoplay Video</Label>
              <Switch
                id="autoplay"
                checked={autoplay}
                onCheckedChange={setAutoplay}
              />
            </div>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mt-6">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button 
            type="button" 
            onClick={handleInsert}
            disabled={!url.trim()}
          >
            Insert Video
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}