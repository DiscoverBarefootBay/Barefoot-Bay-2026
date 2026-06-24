/**
 * Basic Chat Example
 * 
 * A simple example showing how to integrate the MessagingFeature.
 */

import React from 'react';
import { 
  ChatProvider, 
  Chat, 
  ChatButton,
  MobileChat 
} from '../client';

interface BasicChatExampleProps {
  apiBasePath?: string;
  enableWebSocket?: boolean;
}

export function BasicChatExample({
  apiBasePath = '/api/chat',
  enableWebSocket = true
}: BasicChatExampleProps) {
  return (
    <ChatProvider
      config={{
        apiBasePath,
        enableWebSocket,
        initialQuickReplies: [
          { emoji: "📦", text: "View Products", action: "products" },
          { emoji: "💬", text: "Contact Sales", action: "sales" },
          { emoji: "❓", text: "Help & FAQ", action: "faq" }
        ],
        defaultGreeting: "👋 Welcome! How can I help you today?"
      }}
    >
      <div className="app-wrapper">
        {/* Your main app content would go here */}
        <main className="content">
          <h1 className="text-2xl font-bold mb-4">My Application</h1>
          <p className="mb-8">
            This is an example of how to integrate the MessagingFeature into your application.
          </p>
          
          <div className="card p-4 border rounded-lg bg-card">
            <h2 className="text-xl font-semibold mb-2">Features</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Real-time messaging with WebSockets</li>
              <li>Responsive UI for all devices</li>
              <li>Typing indicators</li>
              <li>Quick replies</li>
              <li>Persistent storage</li>
            </ul>
          </div>
        </main>
        
        {/* Desktop chat widget - only shown on larger screens */}
        <div className="fixed bottom-4 right-4 w-96 hidden md:block">
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
          className="md:hidden" // Only show on mobile
        />
        <MobileChat 
          headerTitle="Customer Support"
        />
      </div>
    </ChatProvider>
  );
}

export default BasicChatExample;