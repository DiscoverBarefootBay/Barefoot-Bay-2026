import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
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
import { Slider } from "@/components/ui/slider";
import { Loader2, Upload, Trash2, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ASPECT = 16 / 9;
const MAX_OUTPUT_WIDTH = 1600;

interface FeaturedImageEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUrl: string | null;
  postTitle: string;
  postImages: string[];
  saving: boolean;
  onSave: (url: string | null) => void;
}

function isSameOrigin(url: string): boolean {
  try {
    const u = new URL(url, window.location.origin);
    return u.origin === window.location.origin;
  } catch {
    return false;
  }
}

function loadImage(src: string, useCrossOrigin: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (useCrossOrigin) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

async function cropToBlob(src: string, area: Area): Promise<Blob> {
  // Always use crossOrigin="anonymous" so the canvas isn't tainted by a
  // cached CORS-flagged response (the storage proxy sets ACAO:* on all
  // forum images, so same-origin images served with that header must also
  // be loaded with the attribute to stay consistent with the browser cache).
  const img = await loadImage(src, true);
  const scale = area.width > MAX_OUTPUT_WIDTH ? MAX_OUTPUT_WIDTH / area.width : 1;
  const outW = Math.round(area.width * scale);
  const outH = Math.round(area.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, outW, outH);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not create image"))),
      "image/jpeg",
      0.9,
    );
  });
}

async function uploadCroppedImage(blob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append("files", new File([blob], `featured-${Date.now()}.jpg`, { type: "image/jpeg" }));
  const response = await fetch("/api/forum/media/upload-multiple", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  if (!response.ok) throw new Error(`Upload failed with status ${response.status}`);
  const result = await response.json();
  const uploaded = result?.files?.find((f: any) => f.success && f.url);
  if (!uploaded) throw new Error("Upload did not return a file URL");
  return uploaded.url as string;
}

export function FeaturedImageEditorDialog({
  open,
  onOpenChange,
  currentUrl,
  postTitle,
  postImages,
  saving,
  onSave,
}: FeaturedImageEditorDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [sourceIsUpload, setSourceIsUpload] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [cropUnavailable, setCropUnavailable] = useState(false);

  const releaseObjectUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  const clearPreviewUrl = () => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  // Reset state each time the dialog opens
  useEffect(() => {
    if (open) {
      releaseObjectUrl();
      setImageSrc(currentUrl || null);
      setSourceIsUpload(false);
      setUrlInput(currentUrl || "");
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      clearPreviewUrl();
      setCropUnavailable(false);
    } else {
      releaseObjectUrl();
      clearPreviewUrl();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => releaseObjectUrl(), []);

  const selectImage = (src: string, isUpload: boolean) => {
    if (!isUpload) releaseObjectUrl();
    setImageSrc(src);
    setSourceIsUpload(isUpload);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    clearPreviewUrl();
    setCropUnavailable(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Not an image", description: "Please choose an image file.", variant: "destructive" });
      return;
    }
    releaseObjectUrl();
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    selectImage(url, true);
    e.target.value = "";
  };

  const onCropComplete = useCallback((_croppedArea: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  // Debounced live preview of the crop
  useEffect(() => {
    if (!imageSrc || !croppedAreaPixels || cropUnavailable) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const blob = await cropToBlob(imageSrc, croppedAreaPixels);
        if (cancelled) return;
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
      } catch {
        if (!cancelled) {
          // Only mark as unavailable for genuinely cross-origin images.
          // Same-origin images should never taint the canvas; if they do it
          // is transient (e.g. a sidecar restart) and should not permanently
          // hide the cropper or prevent saving.
          if (!isSameOrigin(imageSrc)) {
            setCropUnavailable(true);
          }
          clearPreviewUrl();
        }
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [imageSrc, croppedAreaPixels, cropUnavailable]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Same-origin images are always croppable — canvas tainting can't occur for
  // resources on the same origin, so never hide the cropper for them.
  const canCrop = !!imageSrc && (!cropUnavailable || isSameOrigin(imageSrc));
  const previewSrc = previewUrl || imageSrc;

  const handleSave = async () => {
    // Pasted a URL but never blurred/pressed Enter — apply it now
    if (!imageSrc && urlInput.trim()) {
      selectImage(urlInput.trim(), false);
      onSave(urlInput.trim());
      return;
    }
    if (!imageSrc) return;
    // External (cross-origin) image we couldn't crop: save the URL as-is.
    // Skip this shortcut for same-origin images — they can always be cropped
    // via canvas and should never silently fall back to the original URL.
    if (cropUnavailable && !sourceIsUpload && !isSameOrigin(imageSrc)) {
      onSave(urlInput.trim() || imageSrc);
      return;
    }
    if (!croppedAreaPixels) {
      // No crop measured yet; for non-uploaded images keep the URL as-is
      if (!sourceIsUpload) {
        onSave(imageSrc);
      } else {
        toast({
          title: "Almost there",
          description: "Adjust the image position first, then save.",
        });
      }
      return;
    }
    setProcessing(true);
    try {
      const blob = await cropToBlob(imageSrc, croppedAreaPixels!);
      const url = await uploadCroppedImage(blob);
      onSave(url);
    } catch (error) {
      toast({
        title: "Could not save image",
        description: error instanceof Error ? error.message : "Something went wrong preparing the image.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const uniquePostImages = useMemo(
    () => Array.from(new Set(postImages)).slice(0, 8),
    [postImages],
  );

  const busy = processing || saving;

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Featured Image</DialogTitle>
          <DialogDescription>
            Upload an image, then drag and zoom to choose exactly what shows on this story's card in the
            Extra! feed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Source pickers */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              data-testid="input-featured-image-file"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              data-testid="button-upload-featured-image"
            >
              <Upload className="mr-2 h-4 w-4" /> Upload Image
            </Button>
            <div className="flex-1 min-w-0">
              <Input
                placeholder="…or paste an image URL"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onBlur={() => {
                  const v = urlInput.trim();
                  if (v && v !== imageSrc) selectImage(v, false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const v = urlInput.trim();
                    if (v) selectImage(v, false);
                  }
                }}
                data-testid="input-featured-image-url"
              />
            </div>
          </div>

          {/* Images already in this post */}
          {uniquePostImages.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-navy/60 mb-1.5">Images in this post</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {uniquePostImages.map((url) => (
                  <button
                    key={url}
                    type="button"
                    className={`relative h-14 w-20 flex-shrink-0 overflow-hidden rounded-md border-2 transition-colors ${
                      imageSrc === url ? "border-coral" : "border-navy/10 hover:border-ocean/50"
                    }`}
                    onClick={() => selectImage(url, false)}
                    disabled={busy}
                    data-testid={`button-post-image-${url.slice(-12)}`}
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Crop area */}
          {imageSrc ? (
            canCrop ? (
              <div className="space-y-2">
                <div className="relative h-56 sm:h-64 w-full overflow-hidden rounded-lg bg-navy/90 touch-none">
                  <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={ASPECT}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-navy/60 w-10">Zoom</span>
                  <Slider
                    value={[zoom]}
                    min={1}
                    max={4}
                    step={0.05}
                    onValueChange={([v]) => setZoom(v)}
                    className="flex-1"
                    data-testid="slider-featured-image-zoom"
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                This image is hosted on another site, so it can't be cropped here. It will be saved as-is,
                or you can download it and use Upload Image to crop it.
              </div>
            )
          ) : (
            <div className="rounded-lg border-2 border-dashed border-navy/15 p-8 text-center text-sm text-navy/50">
              Upload an image or pick one from this post to get started.
            </div>
          )}

          {/* Feed preview */}
          {previewSrc && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-navy/60 mb-1.5">Single-column view</p>
                <div className="rounded-xl border border-navy/10 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-stretch min-h-[96px]">
                    <div className="relative w-[148px] flex-shrink-0 overflow-hidden bg-navy/5">
                      <img src={previewSrc} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center px-3.5 py-2.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-coral">Preview</span>
                      <h3 className="text-sm font-extrabold text-navy leading-snug line-clamp-2">
                        {postTitle || "Story title"}
                      </h3>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-navy/60">
                        <span>Today</span>
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" /> 0
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-navy/60 mb-1.5">Grid view</p>
                <div className="rounded-xl border border-navy/10 bg-white shadow-sm overflow-hidden">
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-navy/5">
                    <img src={previewSrc} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="px-3 py-2">
                    <h3 className="text-sm font-bold text-navy leading-snug line-clamp-1">
                      {postTitle || "Story title"}
                    </h3>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {currentUrl && (
            <Button
              type="button"
              variant="outline"
              className="mr-auto border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              disabled={busy}
              onClick={() => onSave(null)}
              data-testid="button-remove-featured-image"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Remove
            </Button>
          )}
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-coral hover:bg-coral/90 text-white"
            disabled={busy || (!imageSrc && !urlInput.trim())}
            onClick={handleSave}
            data-testid="button-save-featured-image"
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
