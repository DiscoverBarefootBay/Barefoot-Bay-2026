import React from 'react';
import { format } from 'date-fns';
import { type Event } from '@shared/schema';

interface MobileDayViewProps {
  date: Date;
  events: Event[];
}

/**
 * A dedicated component for rendering day cells in the mobile calendar view
 * This displays just the day number and a small indicator dot if the day has events
 */
export default function MobileDayView({ date, events }: MobileDayViewProps) {
  // Choose the primary color for the indicator dot based on the first event category
  const getCategoryColorHex = (category: string) => {
    switch (category) {
      case 'entertainment':
        return '#7FD7C6';
      case 'government':
        return '#6FA8DC';
      case 'social':
        return '#F6D8A8';
      case 'promotional':
        return '#FFF3CD';
      case 'bulletin':
        return '#C9C3E6';
      case 'platinum_sponsor':
        return '#E5E7EB';
      default:
        return '#FDFEFE';
    }
  };

  const getCategoryBorderHex = (category: string) => {
    switch (category) {
      case 'entertainment':
        return '#5FC4B1';
      case 'government':
        return '#4F93D3';
      case 'social':
        return '#EBC28B';
      case 'promotional':
        return '#F1E1BA';
      case 'bulletin':
        return '#B3AADF';
      case 'platinum_sponsor':
        return '#9CA3AF';
      default:
        return '#E7EAEE';
    }
  };

  return (
    <div className="h-full w-full flex flex-col relative" style={{ width: '100%', boxSizing: 'border-box' }}>
      {/* Day number - always show this */}
      <div className="text-right pr-1 font-semibold text-sm h-5">
        {format(date, "d")}
      </div>
      
      {/* Mobile indicator for events (dot only) */}
      {events.length > 0 && (
        <div className="absolute bottom-1 left-0 right-0 flex justify-center">
          <div 
            className="w-2.5 h-2.5 rounded-full" 
            style={{ 
              backgroundColor: events.length > 0 ? getCategoryColorHex(events[0].category) : 'transparent',
              border: events.length > 0 ? `1px solid ${getCategoryBorderHex(events[0].category)}` : 'none',
              opacity: 0.9
            }}
          />
        </div>
      )}
    </div>
  );
}