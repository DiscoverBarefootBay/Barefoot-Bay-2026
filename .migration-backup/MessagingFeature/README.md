# Messaging Feature

A complete and modular chat/messaging system with real-time capabilities.

## Features

- Real-time messaging using WebSockets
- Persistent message storage in PostgreSQL
- Responsive UI for desktop and mobile
- Typing indicators
- Quick replies
- Support for authenticated users

## Installation

### Prerequisites

- Node.js & npm
- PostgreSQL database
- React application

### Dependencies

This package requires the following dependencies:

```bash
npm install ws uuid drizzle-orm drizzle-zod zod react
```

## Usage

### Database Setup

First, set up the required database tables:

```sql
-- Chat sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
  id VARCHAR PRIMARY KEY,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  contact_info JSONB
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role VARCHAR NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS session_idx ON messages(session_id);

-- Support messages table (optional)
CREATE TABLE IF NOT EXISTS support_messages (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  thread_id VARCHAR NOT NULL
);
CREATE INDEX IF NOT EXISTS user_msg_idx ON support_messages(user_id);
CREATE INDEX IF NOT EXISTS thread_idx ON support_messages(thread_id);
```

### Server-Side Integration

```typescript
import express from 'express';
import { createServer } from 'http';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { 
  MessagingStorage, 
  configureMessagingRoutes 
} from './MessagingFeature/server';

// Create Express app and HTTP server
const app = express();
const httpServer = createServer(app);

// Set up database connection
const connectionString = process.env.DATABASE_URL || '';
const client = postgres(connectionString);
const db = drizzle(client);

// Create storage instance
const messagingStorage = new MessagingStorage(db);

// Configure routes
configureMessagingRoutes(app, httpServer, messagingStorage);

// Start server
httpServer.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### Client-Side Integration

#### Basic Chat Integration

```tsx
import React from 'react';
import { 
  ChatProvider, 
  Chat, 
  ChatButton,
  MobileChat 
} from './MessagingFeature/client';

function App() {
  return (
    <ChatProvider>
      <div className="app">
        {/* Your app content */}
        
        {/* Desktop chat widget */}
        <div className="fixed bottom-4 right-4 w-96">
          <Chat 
            showHeader={true}
            headerTitle="Customer Support"
            placeholder="Type your message..."
          />
        </div>
        
        {/* Mobile chat button and modal */}
        <ChatButton 
          label="Chat"
          position="bottom-right"
        />
        <MobileChat 
          headerTitle="Customer Support"
        />
      </div>
    </ChatProvider>
  );
}

export default App;
```

#### Custom Styling

The components support custom styling through className props:

```tsx
<Chat className="my-custom-chat border-primary" />
<ChatButton className="bg-custom-color" />
```

#### Using Chat Context Directly

```tsx
import React from 'react';
import { useChatContext } from './MessagingFeature/client';

function CustomChatComponent() {
  const { 
    messages, 
    sendMessage, 
    isLoading 
  } = useChatContext();
  
  return (
    <div>
      {/* Custom chat implementation */}
    </div>
  );
}
```

## API Reference

### Client Components

- `Chat` - Main chat interface component
- `ChatButton` - Floating action button for toggling chat
- `MobileChat` - Full-screen chat interface for mobile
- `MessageBubble` - Individual message bubble component
- `QuickReply` - Quick reply buttons component
- `TypingIndicator` - Typing animation component

### Client Hooks

- `useChat` - Hook for managing chat state
- `useWebSocket` - Hook for WebSocket connection

### Client Context

- `ChatProvider` - Context provider for chat state
- `useChatContext` - Hook for accessing chat context

### Server Components

- `MessagingStorage` - Database interface for messages
- `configureMessagingRoutes` - Function to set up API routes

## License

MIT