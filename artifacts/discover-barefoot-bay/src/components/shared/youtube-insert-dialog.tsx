import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Youtube } from 'lucide-react';

interface YouTubeInsertDialogProps {
  onInsert: (embedHtml: string) => void;
  children?: React.ReactNode;
}

interface YouTubeSettings {
  url: string;
  width: string;
  height: string;
  showControls: boolean;
  muted: boolean;
  autoplay: boolean;
}

export function YouTubeInsertDialog({ onInsert, children }: YouTubeInsertDialogProps) {
  const [open, setOpen] = useState(false);
  
  // Initialize with proper default values to prevent undefined errors
  const defaultSettings: YouTubeSettings = {
    url: '',
    width: '560',
    height: '315',
    showControls: true,
    muted: false,
    autoplay: false
  };
  
  const [settings, setSettings] = useState<YouTubeSettings>(defaultSettings);

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
      if (match) {
        return match[1];
      }
    }
    return null;
  };

  const generateEmbedUrl = (videoId: string): string => {
    if (!videoId) return '';
    
    const params = new URLSearchParams();
    
    if (!settings?.showControls) {
      params.append('controls', '0');
    }
    
    if (settings?.muted) {
      params.append('mute', '1');
    }
    
    if (settings?.autoplay) {
      params.append('autoplay', '1');
    }
    
    // Add additional YouTube embed parameters for better integration
    params.append('rel', '0'); // Don't show related videos
    params.append('modestbranding', '1'); // Reduce YouTube branding
    
    const paramString = params.toString();
    return `https://www.youtube.com/embed/${videoId}${paramString ? '?' + paramString : ''}`;
  };

  const handleInsert = () => {
    const currentUrl = settings.url?.trim() || '';
    if (!currentUrl) {
      alert('Please enter a YouTube URL');
      return;
    }

    const videoId = extractVideoId(currentUrl);
    if (!videoId) {
      alert('Please enter a valid YouTube URL');
      return;
    }

    const embedUrl = generateEmbedUrl(videoId);
    if (!embedUrl) {
      alert('Failed to generate embed URL');
      return;
    }

    const width = String(settings.width || '560');
    const height = String(settings.height || '315');

    // Determine if this is likely a vertical video (Shorts) based on dimensions
    const isVertical = parseInt(height) > parseInt(width);
    
    // Create iframe element programmatically to preserve allowfullscreen as proper boolean
    // This prevents YouTube Error 153 caused by allowfullscreen=""
    const iframe = document.createElement('iframe');
    iframe.setAttribute('width', width);
    iframe.setAttribute('height', height);
    iframe.setAttribute('src', embedUrl);
    iframe.setAttribute('title', 'YouTube video player');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
    
    // Set allowfullscreen as a boolean property (not attribute string)
    iframe.allowFullscreen = true;
    
    // Set styles
    const styleValue = isVertical 
      ? 'max-width: 100%; height: auto;'
      : 'max-width: 100%; height: auto; aspect-ratio: 16/9;';
    iframe.setAttribute('style', styleValue);
    
    // Create wrapper div
    const wrapper = document.createElement('div');
    wrapper.setAttribute('style', `position: relative; width: 100%; max-width: ${width}px; margin: 10px 0;`);
    wrapper.appendChild(iframe);
    
    // Convert to HTML string for insertion
    const embedHtml = wrapper.outerHTML;

    if (onInsert) {
      onInsert(embedHtml);
    }
    setOpen(false);
    
    // Reset form to default settings
    setSettings(defaultSettings);
  };

  const presetSizes = [
    { label: 'Small (420x315)', width: '420', height: '315' },
    { label: 'Medium (560x315)', width: '560', height: '315' },
    { label: 'Large (720x405)', width: '720', height: '405' },
    { label: 'Extra Large (1024x576)', width: '1024', height: '576' },
    // Vertical presets for Shorts
    { label: 'Shorts Small (270x480)', width: '270', height: '480' },
    { label: 'Shorts Medium (360x640)', width: '360', height: '640' },
    { label: 'Shorts Large (450x800)', width: '450', height: '800' },
    { label: 'Shorts Full (720x1280)', width: '720', height: '1280' }
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button 
            type="button" 
            size="sm" 
            variant="ghost" 
            className="h-8 w-8 p-0" 
            title="Insert YouTube Video"
          >
            <Youtube size={16} />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Insert YouTube Video</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* YouTube URL Input */}
          <div className="space-y-2">
            <Label htmlFor="youtube-url">YouTube URL</Label>
            <Input
              id="youtube-url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={settings.url}
              onChange={(e) => setSettings(prev => ({ ...prev, url: e.target.value }))}
            />
          </div>

          {/* Size Presets */}
          <div className="space-y-2">
            <Label>Video Size</Label>
            <Select 
              value={`${settings?.width || '560'}x${settings?.height || '315'}`}
              onValueChange={(value) => {
                const preset = presetSizes.find(p => `${p.width}x${p.height}` === value);
                if (preset) {
                  setSettings(prev => ({ 
                    ...prev, 
                    width: preset.width, 
                    height: preset.height 
                  }));
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {presetSizes.map((preset) => (
                  <SelectItem key={preset.label} value={`${preset.width}x${preset.height}`}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom Dimensions */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="width">Width (px)</Label>
              <Input
                id="width"
                type="number"
                value={settings?.width || '560'}
                onChange={(e) => setSettings(prev => ({ ...prev, width: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="height">Height (px)</Label>
              <Input
                id="height"
                type="number"
                value={settings?.height || '315'}
                onChange={(e) => setSettings(prev => ({ ...prev, height: e.target.value }))}
              />
            </div>
          </div>

          {/* Playback Settings */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="show-controls">Show Player Controls</Label>
              <Switch
                id="show-controls"
                checked={settings?.showControls || true}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, showControls: checked }))}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="muted">Mute Audio by Default</Label>
              <Switch
                id="muted"
                checked={settings?.muted || false}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, muted: checked }))}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="autoplay">Autoplay Video</Label>
              <Switch
                id="autoplay"
                checked={settings?.autoplay || false}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, autoplay: checked }))}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
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
              disabled={!settings?.url || !settings.url.trim()}
            >
              Insert Video
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}