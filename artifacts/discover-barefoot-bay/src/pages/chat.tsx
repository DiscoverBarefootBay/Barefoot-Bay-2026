import React from 'react';
import { Helmet } from 'react-helmet';
import { ChatProvider } from '../context/ChatContext';
import Chat from '../components/chat/Chat';
import { useMediaQuery } from '../hooks/useMediaQuery';
import MobileChat from '../components/chat/MobileChat';

const ChatPage: React.FC = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <>
      <Helmet>
        <title>Barefoot Bay Community Chat</title>
        <meta name="description" content="Chat with our community support team" />
      </Helmet>

      <div className="min-h-screen bg-gray-100 pt-4 pb-8 px-4 md:px-0">
        <div className="max-w-5xl mx-auto">
          <ChatProvider>
            {isMobile ? <MobileChat /> : <Chat />}
          </ChatProvider>
        </div>
      </div>
    </>
  );
};

export default ChatPage;