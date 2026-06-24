import React from 'react';
import { Chat } from '../components/chat/Chat';
import { Helmet } from 'react-helmet';

export default function MessagesPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <Helmet>
        <title>Messages - Barefoot Bay Community</title>
      </Helmet>
      
      {/* Desktop header */}
      <div className="hidden md:flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-navy">Messages</h1>
      </div>
      
      <Chat />
    </div>
  );
}