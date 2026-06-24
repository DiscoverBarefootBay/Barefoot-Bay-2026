import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { type Event } from "@shared/schema";
import { Calendar, Clock, MapPin, ExternalLink } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

const FLORIDA_TIMEZONE = 'America/New_York';

interface SeriesOccurrencesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentEventId: number;
  parentEventTitle: string;
  returnDate?: string;
}

export function SeriesOccurrencesDialog({
  open,
  onOpenChange,
  parentEventId,
  parentEventTitle,
  returnDate,
}: SeriesOccurrencesDialogProps) {
  const { data: occurrences, isLoading } = useQuery<Event[]>({
    queryKey: [`/api/events/${parentEventId}/occurrences`],
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {parentEventTitle}
          </DialogTitle>
          <DialogDescription>
            All occurrences in this recurring series
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 max-h-[60vh] overflow-y-auto pr-2">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-3 p-3 border rounded-lg">
                  <Skeleton className="h-12 w-12 rounded flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : occurrences && occurrences.length > 0 ? (
            <div className="space-y-2">
              {occurrences.map((occurrence, index) => {
                const startDate = new Date(occurrence.startDate);
                const endDate = new Date(occurrence.endDate);
                
                return (
                  <Link
                    key={occurrence.id}
                    href={`/events/${occurrence.id}${returnDate ? `?returnDate=${returnDate}` : ''}`}
                    data-testid={`occurrence-link-${occurrence.id}`}
                  >
                    <div className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent transition-colors cursor-pointer group">
                      <div className="flex-shrink-0 w-12 h-12 bg-primary/10 dark:bg-primary/20 rounded-lg flex flex-col items-center justify-center">
                        <span className="text-xs font-medium text-muted-foreground">
                          {formatInTimeZone(startDate, FLORIDA_TIMEZONE, 'MMM')}
                        </span>
                        <span className="text-lg font-bold text-primary">
                          {formatInTimeZone(startDate, FLORIDA_TIMEZONE, 'd')}
                        </span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm group-hover:text-primary transition-colors">
                              Occurrence {index + 1}
                            </h4>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Calendar className="h-3 w-3 flex-shrink-0" />
                              <span>{formatInTimeZone(startDate, FLORIDA_TIMEZONE, 'EEEE, MMMM d, yyyy')}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                              <Clock className="h-3 w-3 flex-shrink-0" />
                              <span>
                                {formatInTimeZone(startDate, FLORIDA_TIMEZONE, 'h:mm a')} - {formatInTimeZone(endDate, FLORIDA_TIMEZONE, 'h:mm a')}
                              </span>
                            </div>
                            {occurrence.location && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                <MapPin className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{occurrence.location}</span>
                              </div>
                            )}
                          </div>
                          <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No occurrences found for this series.</p>
            </div>
          )}
        </div>

        {occurrences && occurrences.length > 0 && (
          <div className="mt-4 pt-4 border-t text-sm text-muted-foreground text-center">
            Showing {occurrences.length} occurrence{occurrences.length !== 1 ? 's' : ''}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
