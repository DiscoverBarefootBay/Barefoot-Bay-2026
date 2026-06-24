# WebSocket Usage Guide for Barefoot Bay

This guide explains how to use WebSockets for real-time communication in the Barefoot Bay application.

## Basic WebSocket Integration

### Client-Side: Using the Enhanced WebSocket Helper

For the most reliable WebSocket connections (especially in deployment), use our enhanced WebSocket helper:

```typescript
// Import the enhanced WebSocket helper
import { initEnhancedWebSocket, sendMessage, isConnected } from '../utils/websocket-helper';

// Initialize WebSocket (auto-connects)
initEnhancedWebSocket();

// React component example
function MyComponent() {
  const [messages, setMessages] = useState<any[]>([]);
  
  useEffect(() => {
    // Listen for WebSocket messages
    const handleMessage = (event: CustomEvent) => {
      const message = event.detail;
      if (message.type === 'calendar_update') {
        setMessages(prev => [...prev, message.data]);
      }
    };
    
    // Listen for connection status
    const handleConnection = () => {
      console.log('WebSocket connected!');
      // You might want to request initial data here
    };
    
    // Add event listeners
    window.addEventListener('websocket-message', handleMessage as EventListener);
    window.addEventListener('websocket-connected', handleConnection);
    
    // Clean up
    return () => {
      window.removeEventListener('websocket-message', handleMessage as EventListener);
      window.removeEventListener('websocket-connected', handleConnection);
    };
  }, []);
  
  // Example function to send a message
  const sendCalendarUpdate = (eventData) => {
    sendMessage('calendar_event_update', eventData);
  };
  
  return (
    <div>
      <div className="connection-status">
        Status: {isConnected() ? 'Connected' : 'Disconnected'}
      </div>
      
      <button onClick={() => sendCalendarUpdate({ id: 1, title: 'New Event' })}>
        Update Calendar
      </button>
      
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i}>
            {msg.title} - {new Date(msg.timestamp).toLocaleString()}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Server-Side: WebSocket Events

The server broadcasts events that you can listen for:

| Event Type | Description | Data Structure |
|------------|-------------|----------------|
| `connection` | Connection confirmation | `{ status: 'connected', clientId: string, time: string }` |
| `calendar_update` | Calendar event changes | `{ action: 'create' \| 'update' \| 'delete', event: CalendarEvent, timestamp: string }` |
| `broadcast` | General broadcast messages | *Varies based on sender* |

### Sending Messages to the Server

To send a message to the server:

```typescript
// Using the enhanced helper
sendMessage('event_type', { 
  // your data here
  id: 123,
  action: 'update',
  timestamp: new Date().toISOString()
});

// Or using the raw WebSocket (not recommended)
const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
socket.onopen = () => {
  socket.send(JSON.stringify({
    type: 'event_type',
    data: {
      // your data here
    }
  }));
};
```

## Troubleshooting WebSocket Connections

### 1. Check Connection Status

```typescript
import { getConnectionInfo } from '../utils/websocket-helper';

// Get detailed connection info
const info = getConnectionInfo();
console.log(
  `Connected: ${info.connected}, ` +
  `State: ${info.readyState}, ` +
  `Reconnect attempts: ${info.reconnectAttempts}`
);
```

### 2. Listen for Connection Events

```typescript
// Listen for connection events
window.addEventListener('websocket-connected', () => {
  console.log('WebSocket connected!');
});

window.addEventListener('websocket-disconnected', (event: CustomEvent) => {
  console.log('WebSocket disconnected:', event.detail);
});

window.addEventListener('websocket-error', (event: CustomEvent) => {
  console.log('WebSocket error:', event.detail);
});
```

### 3. Common Issues

- **CORS Errors**: Make sure your server allows WebSocket connections from your client origin
- **Network Issues**: Check if firewalls are blocking WebSocket connections
- **Deployment Issues**: In Replit, make sure port 5000 is used for both HTTP and WebSocket
- **Protocol Mismatch**: Make sure you're using 'wss:' for HTTPS pages and 'ws:' for HTTP pages

## Example: Calendar Synchronization

This example shows how to synchronize calendar events:

```typescript
// In a calendar component
import { initEnhancedWebSocket, sendMessage } from '../utils/websocket-helper';
import { useState, useEffect } from 'react';

function CalendarComponent() {
  const [events, setEvents] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  
  useEffect(() => {
    // Initialize WebSocket
    initEnhancedWebSocket();
    
    // Handle calendar update events
    const handleCalendarUpdate = (event: CustomEvent) => {
      const message = event.detail;
      if (message.type === 'calendar_update') {
        const { action, event: calendarEvent } = message.data;
        
        if (action === 'create') {
          setEvents(prev => [...prev, calendarEvent]);
        } else if (action === 'update') {
          setEvents(prev => prev.map(e => 
            e.id === calendarEvent.id ? calendarEvent : e
          ));
        } else if (action === 'delete') {
          setEvents(prev => prev.filter(e => e.id !== message.data.eventId));
        }
      }
    };
    
    // Update connection status
    const handleConnection = () => setIsConnected(true);
    const handleDisconnection = () => setIsConnected(false);
    
    // Register event listeners
    window.addEventListener('websocket-message', handleCalendarUpdate as EventListener);
    window.addEventListener('websocket-connected', handleConnection);
    window.addEventListener('websocket-disconnected', handleDisconnection);
    
    // Clean up
    return () => {
      window.removeEventListener('websocket-message', handleCalendarUpdate as EventListener);
      window.removeEventListener('websocket-connected', handleConnection);
      window.removeEventListener('websocket-disconnected', handleDisconnection);
    };
  }, []);
  
  // Example function to create a new event via WebSocket
  const createEvent = (newEvent) => {
    sendMessage('calendar_event_create', newEvent);
  };
  
  return (
    <div>
      <div className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
        {isConnected ? 'Connected - Real-time updates active' : 'Disconnected - Using cached data'}
      </div>
      
      {/* Calendar UI */}
      <div className="calendar">
        {events.map(event => (
          <div key={event.id} className="event">
            {event.title} - {event.startDate}
          </div>
        ))}
      </div>
      
      <button onClick={() => createEvent({
        title: 'New Event',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 3600000).toISOString(),
        location: 'Clubhouse'
      })}>
        Add Event
      </button>
    </div>
  );
}
```