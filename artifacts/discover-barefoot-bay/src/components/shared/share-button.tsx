import { useState } from "react";
import { Share2, Facebook, Mail, Copy, Check, Calendar, FileText, Printer, Download } from "lucide-react";
import { SiX } from "react-icons/si";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { generateICSFile, downloadICSFile } from "@/lib/calendar-utils";

interface ShareButtonProps {
  title: string;
  text: string;
  url: string;
  imageUrl?: string;
  className?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  startDate?: Date;
  endDate?: Date;
  description?: string;
  location?: string;
  buttonText?: string;
  dialogTitle?: string;
  dialogDescription?: string;
  isEvent?: boolean;
}

export function ShareButton({
  title,
  text,
  url,
  imageUrl,
  className = "",
  variant = "outline",
  size = "default",
  startDate,
  endDate,
  description,
  location,
  buttonText = "Share",
  dialogTitle = "Share",
  dialogDescription = "Share with your friends and community",
  isEvent = false,
}: ShareButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const { toast } = useToast();

  // Detect if device is mobile (phone or tablet)
  const isMobileDevice = () => {
    if (typeof window === "undefined") return false;
    
    // Check user agent for mobile devices
    const userAgent = navigator.userAgent.toLowerCase();
    const mobileKeywords = ['android', 'webos', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone'];
    const isMobileUA = mobileKeywords.some(keyword => userAgent.includes(keyword));
    
    // Also check for touch capability and small screen as additional indicator
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isSmallScreen = window.innerWidth <= 768;
    
    return isMobileUA || (isTouchDevice && isSmallScreen);
  };

  // Only use Web Share API on actual mobile devices
  const isMobile = isMobileDevice();
  const canUseWebShare = typeof navigator !== "undefined" && 'share' in navigator && isMobile;

  const handleShare = async () => {
    // On mobile devices with Web Share API, use native sharing
    if (canUseWebShare) {
      try {
        await navigator.share({
          title,
          text,
          url,
        });
      } catch (error) {
        // User cancelled or error occurred
        if ((error as Error).name !== "AbortError") {
          console.error("Error sharing:", error);
          // Fall back to dialog
          setIsDialogOpen(true);
        }
      }
    } else {
      // On desktop or devices without Web Share API, show custom dialog with all features
      setIsDialogOpen(true);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({
        title: "Link copied!",
        description: "Share link has been copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const shareToFacebook = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    window.open(facebookUrl, "_blank", "width=600,height=400");
  };

  const shareToTwitter = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, "_blank", "width=600,height=400");
  };

  const shareToEmail = () => {
    const emailSubject = encodeURIComponent(title);
    const emailBody = encodeURIComponent(`${text}\n\n${url}`);
    window.location.href = `mailto:?subject=${emailSubject}&body=${emailBody}`;
  };

  const handlePrint = () => {
    setIsDialogOpen(false);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const handleDownload = async () => {
    setIsDialogOpen(false);
    
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).jsPDF;
      
      setTimeout(async () => {
        try {
          const element = document.body;
          
          const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            logging: false,
            windowWidth: element.scrollWidth,
            windowHeight: element.scrollHeight,
          });
          
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
          });
          
          const imgWidth = 210;
          const pageHeight = 297;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          let heightLeft = imgHeight;
          let position = 0;
          
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
          
          while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
          }
          
          const filename = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
          pdf.save(filename);
          
          toast({
            title: "Download complete!",
            description: "PDF has been saved to your downloads",
          });
        } catch (error) {
          console.error("Failed to generate PDF:", error);
          toast({
            title: "Download failed",
            description: "Please try the Print button instead",
            variant: "destructive",
          });
        }
      }, 300);
    } catch (error) {
      console.error("Failed to load PDF libraries:", error);
      toast({
        title: "Download failed",
        description: "Please try the Print button instead",
        variant: "destructive",
      });
    }
  };

  const handleAddToCalendar = () => {
    if (!startDate || !endDate) {
      toast({
        title: "Calendar unavailable",
        description: "This event doesn't have date information",
        variant: "destructive",
      });
      return;
    }

    try {
      const icsContent = generateICSFile({
        title,
        description: description || text,
        location: location || undefined,
        startDate,
        endDate,
        url,
      });
      
      const filename = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`;
      downloadICSFile(icsContent, filename);
      
      toast({
        title: "Calendar file downloaded!",
        description: "Open the file to add this event to your calendar",
      });
    } catch (error) {
      console.error("Failed to generate calendar file:", error);
      toast({
        title: "Failed to create calendar file",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleCopyFormattedText = async () => {
    const formattedText = `📅 ${title}
${location ? `📍 ${location}\n` : ''}${startDate ? `🕐 ${startDate.toLocaleDateString()} at ${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n` : ''}
${description ? `${description}\n\n` : ''}${url}`;

    try {
      await navigator.clipboard.writeText(formattedText);
      setCopiedText(true);
      toast({
        title: "Event details copied!",
        description: "Formatted text has been copied to clipboard",
      });
      setTimeout(() => setCopiedText(false), 2000);
    } catch (error) {
      console.error("Failed to copy formatted text:", error);
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleShare}
        className={className}
        data-testid="button-share"
      >
        <Share2 className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">{buttonText}</span>
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              {dialogDescription}
            </DialogDescription>
          </DialogHeader>

          {/* Event Preview Card */}
          <Card className="p-4 mb-4 bg-muted/50">
            <div className="flex gap-3">
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt={title}
                  className="w-20 h-20 object-cover rounded flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm line-clamp-2 mb-1">{title}</h4>
                <p className="text-xs text-muted-foreground line-clamp-2">{text}</p>
              </div>
            </div>
          </Card>

          {/* Share Buttons Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Button
              variant="outline"
              onClick={shareToEmail}
              className="w-full gap-2 h-auto py-3"
              data-testid="button-share-email"
            >
              <Mail className="h-5 w-5" />
              <span>Email</span>
            </Button>

            <Button
              variant="outline"
              onClick={shareToFacebook}
              className="w-full gap-2 h-auto py-3"
              data-testid="button-share-facebook"
            >
              <Facebook className="h-5 w-5 text-blue-600" />
              <span>Facebook</span>
            </Button>

            <Button
              variant="outline"
              onClick={shareToTwitter}
              className="w-full gap-2 h-auto py-3"
              data-testid="button-share-twitter"
            >
              <SiX className="h-4 w-4" />
              <span>Twitter</span>
            </Button>

            <Button
              variant="outline"
              onClick={handlePrint}
              className="w-full gap-2 h-auto py-3"
              data-testid="button-share-print"
            >
              <Printer className="h-5 w-5" />
              <span>Print</span>
            </Button>

            {isEvent ? (
              <Button
                variant="outline"
                onClick={handleAddToCalendar}
                className="w-full gap-2 h-auto py-3"
                data-testid="button-share-calendar"
                disabled={!startDate || !endDate}
              >
                <Calendar className="h-5 w-5 text-purple-600" />
                <span>Add to Calendar</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={handleDownload}
                className="w-full gap-2 h-auto py-3"
                data-testid="button-share-download"
              >
                <Download className="h-5 w-5 text-green-600" />
                <span>Download</span>
              </Button>
            )}

            <Button
              variant="outline"
              onClick={handleCopyFormattedText}
              className="w-full gap-2 h-auto py-3"
              data-testid="button-share-copy-formatted"
            >
              {copiedText ? (
                <>
                  <Check className="h-5 w-5 text-green-600" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <FileText className="h-5 w-5" />
                  <span>Copy Details</span>
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={handleCopyLink}
              className="w-full gap-2 h-auto py-3 col-span-2 sm:col-span-3"
              data-testid="button-share-copy"
            >
              {copied ? (
                <>
                  <Check className="h-5 w-5 text-green-600" />
                  <span>Link Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-5 w-5" />
                  <span>Copy Link</span>
                </>
              )}
            </Button>
          </div>

          {/* Direct Link Display */}
          <div className="mt-4 p-3 bg-muted rounded-md">
            <p className="text-xs text-muted-foreground mb-1">Direct link:</p>
            <p className="text-sm font-mono break-all">{url}</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
