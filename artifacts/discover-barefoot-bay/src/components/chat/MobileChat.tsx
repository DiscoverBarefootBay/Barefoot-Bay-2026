import React, { useState, useEffect } from 'react';
import { Message } from '../../types/chat';
import { Button } from '../ui/button';
import { PlusIcon, RefreshCw, ArrowLeft, Trash2, CheckSquare, X } from 'lucide-react';
import { MessageList } from './MessageList';
import { MessageDetail } from './MessageDetail';
import { EnhancedMessageComposer } from './EnhancedMessageComposer';
import { queryClient } from '@/lib/queryClient';

const MobileChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<Array<{id: string, name: string}>>([]);
  const [showComposer, setShowComposer] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Fetch messages on component mount
  useEffect(() => {
    fetchMessages();
    fetchRecipients();
  }, []);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      setRefreshing(true);
      
      const response = await fetch('/api/messages');
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }
      const data = await response.json();
      setMessages(data);
      
      // Count unread messages
      const unread = data.filter((msg: Message) => !msg.read).length;
      setUnreadCount(unread);
      
      setLoading(false);
      setRefreshing(false);
    } catch (err) {
      setError('Error fetching messages. Please try again later.');
      setLoading(false);
      setRefreshing(false);
      console.error('Error fetching messages:', err);
    }
  };

  const fetchRecipients = async () => {
    try {
      const response = await fetch('/api/chat/recipients');
      if (!response.ok) {
        throw new Error('Failed to fetch recipients');
      }
      const data = await response.json();
      setRecipients(data);
    } catch (err) {
      console.error('Error fetching recipients:', err);
    }
  };

  const handleSelectMessage = async (message: Message) => {
    try {
      // Mark as read if it's unread
      if (!message.read) {
        const response = await fetch(`/api/messages/${message.id}/read`, {
          method: 'PUT',
        });
        
        if (response.ok) {
          // Update the message in the list
          setMessages(messages.map(msg => 
            msg.id === message.id ? { ...msg, read: true } : msg
          ));
          
          // Update unread count
          setUnreadCount(prev => Math.max(0, prev - 1));
          
          // Invalidate React Query cache to update navbar badge on mobile
          queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
        }
      }
      
      setSelectedMessage(message);
      setView('detail');
    } catch (err) {
      console.error('Error marking message as read:', err);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        // Remove from messages list
        setMessages(messages.filter(msg => msg.id !== messageId));
        
        // If this was the selected message, clear selection and go back to list
        if (selectedMessage && selectedMessage.id === messageId) {
          setSelectedMessage(null);
          setView('list');
        }
      }
    } catch (err) {
      console.error('Error deleting message:', err);
    }
  };

  const handleBackToList = () => {
    setView('list');
  };

  const handleReplyToMessage = (message: Message) => {
    // Open the composer with reply information
    setShowComposer(true);
    
    // You could also pre-populate reply fields here if needed
    // For now, just open the composer
  };

  const handleNewMessage = () => {
    setShowComposer(true);
  };

  const handleSubmitMessage = async (formData: FormData) => {
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        // Refresh messages list
        fetchMessages();
        setShowComposer(false);
      } else {
        throw new Error('Failed to send message');
      }
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  // Bulk selection handlers
  const handleToggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedMessageIds(new Set());
  };

  const handleToggleSelection = (messageId: number) => {
    const newSelected = new Set(selectedMessageIds);
    if (newSelected.has(messageId)) {
      newSelected.delete(messageId);
    } else {
      newSelected.add(messageId);
    }
    setSelectedMessageIds(newSelected);
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      const rootMessages = messages.filter(message => !message.inReplyTo);
      const allIds = new Set(rootMessages.map(msg => msg.id));
      setSelectedMessageIds(allIds);
    } else {
      setSelectedMessageIds(new Set());
    }
  };

  const handleBulkDelete = async () => {
    if (selectedMessageIds.size === 0) return;

    setBulkDeleting(true);
    try {
      const messageIdsArray = Array.from(selectedMessageIds);
      const response = await fetch('/api/messages/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messageIds: messageIdsArray }),
      });

      if (response.ok) {
        const result = await response.json();
        // Reset selection state and refresh message list
        setSelectedMessageIds(new Set());
        setSelectionMode(false);
        
        // Refresh the entire message list to show current state
        await fetchMessages();
        
        // Show success message if there were any errors
        if (result.errors && result.errors.length > 0) {
          console.warn('Some messages could not be deleted:', result.errors);
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete messages');
      }
    } catch (err) {
      console.error('Error deleting messages:', err);
      setError('Failed to delete selected messages');
    } finally {
      setBulkDeleting(false);
    }
  };

  // Detail view
  if (view === 'detail' && selectedMessage) {
    return (
      <div className="flex flex-col h-full">
        <div className="sticky top-0 bg-white p-4 border-b z-10">
          <Button 
            variant="ghost"
            size="sm"
            onClick={handleBackToList}
            className="flex items-center justify-center"
          >
            <ArrowLeft size={18} className="mr-2" />
            Back to messages
          </Button>
        </div>
        
        <div className="flex-1 overflow-hidden">
          <MessageDetail
            message={selectedMessage}
            onBack={handleBackToList}
            onDelete={() => handleDeleteMessage(selectedMessage.id)}
          />
        </div>
        
        {showComposer && (
          <EnhancedMessageComposer
            onCancel={() => setShowComposer(false)}
            onSend={handleSubmitMessage}
            recipients={recipients}
          />
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4 sticky top-0 bg-white p-4 border-b z-10">
        {selectionMode ? (
          // Selection mode header
          <>
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleSelectionMode}
                className="mr-3"
              >
                <X size={18} />
              </Button>
              <span className="text-lg font-medium">
                {selectedMessageIds.size} selected
              </span>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={selectedMessageIds.size === 0 || bulkDeleting}
                className="bg-red-600 hover:bg-red-700"
              >
                <Trash2 size={16} className="mr-1" />
                {bulkDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </>
        ) : (
          // Normal header
          <>
            <h1 className="text-xl font-bold">Messages</h1>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleSelectionMode}
                title="Select messages"
                className="h-9 w-9 p-0"
              >
                <CheckSquare size={16} />
                <span className="sr-only">Select</span>
              </Button>
              
              <Button 
                onClick={handleNewMessage}
                size="sm"
                className="bg-purple-600 hover:bg-purple-700"
              >
                <PlusIcon size={16} className="mr-1" />
                New
              </Button>
            </div>
          </>
        )}
      </div>
      
      <div className="flex-1 overflow-auto px-4">
        {loading ? (
          <div className="p-4 text-center text-gray-500">Loading messages...</div>
        ) : error ? (
          <div className="p-4 text-center text-red-500">{error}</div>
        ) : messages.length === 0 ? (
          <div className="p-4 text-center text-gray-500">No messages yet</div>
        ) : (
          <MessageList
            messages={messages}
            onSelectMessage={handleSelectMessage}
            selectedMessageId={selectedMessage?.id}
            selectionMode={selectionMode}
            selectedMessageIds={selectedMessageIds}
            onToggleSelection={handleToggleSelection}
            onSelectAll={handleSelectAll}
          />
        )}
      </div>
      
      {showComposer && (
        <EnhancedMessageComposer
          onCancel={() => setShowComposer(false)}
          onSend={handleSubmitMessage}
          recipients={recipients}
        />
      )}
    </div>
  );
};

export default MobileChat;