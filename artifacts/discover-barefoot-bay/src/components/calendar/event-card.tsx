import { useState } from "react";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { MapPin, Calendar, Clock, Repeat, Link2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { type Event, type EventWithChildCount } from "@shared/schema";
import { Link } from "wouter";
import { getMediaUrl } from "@/lib/media-helper";
import { usePermissions } from "@/hooks/use-permissions";
import { SeriesOccurrencesDialog } from "./series-occurrences-dialog";
import { RemovedContentNotice } from "@/components/dmca/removed-content-notice";

const categoryColors = {
  entertainment: "bg-[#7FD7C6] border border-[#5FC4B1] text-[#111827] !font-bold text-sm hover:scale-105 hover:shadow-md hover:brightness-95 transition-all duration-200 ease-in-out cursor-pointer",
  government: "bg-[#6FA8DC] border border-[#4F93D3] text-[#111827] !font-bold text-sm hover:scale-105 hover:shadow-md hover:brightness-95 transition-all duration-200 ease-in-out cursor-pointer",
  social: "bg-[#F6D8A8] border border-[#EBC28B] text-[#111827] !font-bold text-sm hover:scale-105 hover:shadow-md hover:brightness-95 transition-all duration-200 ease-in-out cursor-pointer",
  promotional: "text-[#111827] !font-bold text-sm bg-[#FFF3CD] border border-[#F1E1BA] hover:scale-105 hover:shadow-md hover:brightness-95 transition-all duration-200 ease-in-out cursor-pointer",
  bulletin: "bg-[#C9C3E6] border border-[#B3AADF] text-[#111827] !font-bold text-sm hover:scale-105 hover:shadow-md hover:brightness-95 transition-all duration-200 ease-in-out cursor-pointer",
  platinum_sponsor: "bg-gradient-to-r from-[#E5E7EB] to-[#9CA3AF] border border-[#9CA3AF] text-[#111827] !font-bold text-sm hover:scale-105 hover:shadow-md hover:brightness-95 transition-all duration-200 ease-in-out cursor-pointer",
  other: "bg-[#FDFEFE] border border-[#E7EAEE] text-[#111827] !font-bold text-sm hover:scale-105 hover:shadow-md hover:brightness-95 transition-all duration-200 ease-in-out cursor-pointer",
};

const categoryLabels = {
  entertainment: "Entertainment",
  government: "Government",
  social: "Social Clubs",
  promotional: "Promotional",
  bulletin: "Bulletin",
  platinum_sponsor: "Platinum Sponsor",
  other: "Other",
};

export function EventCard({ event, returnDate }: { event: Event; returnDate?: string }) {
  const { isAdmin } = usePermissions();
  const eventWithCount = event as EventWithChildCount;
  const [isSeriesDialogOpen, setIsSeriesDialogOpen] = useState(false);
  
  // Parse timestamps and explicitly treat them as UTC
  const startDateStr = String(event.startDate);
  const endDateStr = String(event.endDate);
  const startUTC = startDateStr.endsWith('Z') ? startDateStr : startDateStr + 'Z';
  const endUTC = endDateStr.endsWith('Z') ? endDateStr : endDateStr + 'Z';
  const startDate = new Date(startUTC);
  const endDate = new Date(endUTC);

  // Determine event type badge for admins
  const renderEventTypeBadge = () => {
    if (!isAdmin) return null;

    // Parent event: recurring and has no parent
    if (event.isRecurring && !event.parentEventId) {
      const childCount = eventWithCount.childCount || 0;
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant="default" 
                className={`gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap ${childCount > 0 ? 'cursor-pointer' : 'cursor-default'}`}
                data-testid="badge-parent-event"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (childCount > 0) {
                    setIsSeriesDialogOpen(true);
                  }
                }}
              >
                <Repeat className="h-3 w-3 flex-shrink-0" />
                <span>Series ({childCount})</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Click to view all {childCount} occurrence{childCount !== 1 ? 's' : ''}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    // Child event: has a parent event ID
    if (event.parentEventId) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href={`/events/${event.parentEventId}${returnDate ? `?returnDate=${returnDate}` : ''}`}>
                <Badge 
                  variant="secondary" 
                  className="gap-1 text-xs cursor-pointer hover:bg-secondary/80 whitespace-nowrap"
                  data-testid="badge-child-event"
                >
                  <Link2 className="h-3 w-3 flex-shrink-0" />
                  <span>#{event.parentEventId}</span>
                </Badge>
              </Link>
            </TooltipTrigger>
            <TooltipContent>
              <p>Part of recurring series - Click to view parent event #{event.parentEventId}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    // Single event: not recurring and has no parent
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className="text-xs whitespace-nowrap"
              data-testid="badge-single-event"
            >
              Single
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Standalone event (not part of a series)</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <Card className={`hover:shadow-lg transition-shadow border-2 flex flex-col h-full ${event.category === 'promotional' ? 'promotional-detail-card' : 'bg-white'}`}>
      <RemovedContentNotice contentVisibility={(event as any).contentVisibility} compact />
      <CardHeader className="pb-4">
        {/* Consistent stacked layout for all screen sizes */}
        <div className="flex flex-col space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <Link href={`/calendar?category=${event.category || 'all'}`} className="self-start">
              <Badge 
                variant="secondary" 
                className={`${categoryColors[event.category as keyof typeof categoryColors] || categoryColors.other} horizontal-only !px-5 !py-2`}
              >
                {categoryLabels[event.category as keyof typeof categoryLabels] || categoryLabels.other}
              </Badge>
            </Link>
            {renderEventTypeBadge()}
          </div>
          <CardTitle className="text-2xl font-bold break-words min-w-0 event-title whitespace-normal horizontal-only">{event.title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 flex-grow flex flex-col">
        {event.mediaUrls && event.mediaUrls.length > 0 && (
          <div className="aspect-video overflow-hidden rounded-lg">
            <img 
              src={getMediaUrl(event.mediaUrls[0], 'event')} 
              alt="Event preview" 
              className="w-full h-full object-cover"
              onError={(e) => {
                console.log(`Image failed to load: ${event.mediaUrls[0]}`);
                const filename = event.mediaUrls[0].split('/').pop();
                console.log(`Media service failed for ${filename}, trying default image`);
                (e.target as HTMLImageElement).src = getMediaUrl('', 'event'); // Use default event image
              }}
            />
          </div>
        )}

        {event.description && (
          <p className={`text-lg text-muted-foreground ${event.category === 'promotional' ? 'line-clamp-4' : 'line-clamp-2'}`}>{event.description}</p>
        )}

        <div className="space-y-4 text-base">
          {event.category !== 'promotional' && (
            <>
              <div className="flex items-center gap-3 text-muted-foreground">
                <Calendar className="h-5 w-5" />
                <span className="font-medium">{format(startDate, "MMMM d, yyyy")}</span>
              </div>

              <div className="flex items-center gap-3 text-muted-foreground">
                <Clock className="h-5 w-5" />
                <span className="font-medium">
                  {formatInTimeZone(startDate, 'America/New_York', "h:mm a")} - {formatInTimeZone(endDate, 'America/New_York', "h:mm a")}
                </span>
              </div>
            </>
          )}

          {event.location && (
            <div className="flex items-center gap-3 text-muted-foreground">
              <MapPin className="h-5 w-5" />
              <span className="line-clamp-1 font-medium">{event.location}</span>
            </div>
          )}
        </div>

        <div className="mt-auto pt-4">
          <Link href={`/events/${event.id}${returnDate ? `?returnDate=${returnDate}` : ''}`}>
            <Button variant="outline" className="w-full text-lg py-6 bg-primary hover:bg-[#ff6b6b] transition-colors text-white">
              View Details
            </Button>
          </Link>
        </div>
      </CardContent>
      
      {event.isRecurring && !event.parentEventId && (
        <SeriesOccurrencesDialog
          open={isSeriesDialogOpen}
          onOpenChange={setIsSeriesDialogOpen}
          parentEventId={event.id}
          parentEventTitle={event.title}
          returnDate={returnDate}
        />
      )}
    </Card>
  );
}