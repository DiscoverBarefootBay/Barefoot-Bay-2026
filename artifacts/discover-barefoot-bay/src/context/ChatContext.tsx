import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import type { ChatRecipient } from '../components/chat/recipient-options';

// Message type
export type Message = {
  id: number;
  senderId: number;
  recipientId: number;
  subject: string;
  content: string;
  read: boolean;
  timestamp: string;
  createdAt?: string | Date; // Added createdAt field which might exist in some responses
  senderName?: string;
  recipientName?: string;
  inReplyTo?: number;  // Foreign key to parent message
  in_reply_to?: number; // Database column name (snake_case version)
  attachments?: Array<{
    id: string;
    url: string;
    filename: string;
    contentType?: string;
  }>;
  replies: Message[]; // Making this non-optional and ensuring it's initialized
};

// Enhanced context type
type ChatContextType = {
  messages: Message[];
  selectedMessage: Message | null;
  unreadCount: number;
  loading: boolean;
  error: string | null;
  sendMessage: (message: any) => Promise<any>;
  replyToMessage: (originalMessageId: number, content: string, attachments?: any[]) => Promise<any>;
  deleteMessage: (messageId: number) => Promise<void>;
  markAsRead: (messageId: number) => Promise<void>;
  selectMessage: (message: Message | null) => void;
  fetchMessages: () => Promise<void>;
  clearError: () => void;
  recipients: ChatRecipient[];
};

// Create context
const ChatContext = createContext<ChatContextType | undefined>(undefined);

// Enhanced provider component
export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<ChatRecipient[]>([]);
  const { user } = useAuth();

  // Fetch messages when component mounts
  useEffect(() => {
    if (user) {
      fetchMessages();
      fetchRecipients();
    }
  }, [user]);

  // Fetch recipients
  const fetchRecipients = async () => {
    try {
      const response = await fetch('/api/chat/recipients');
      
      if (!response.ok) {
        console.warn('Could not fetch recipients, using admin as fallback');
        setRecipients([{ id: 'admin', name: 'Administrator' }]);
        return;
      }
      
      const data = await response.json();
      
      if (Array.isArray(data)) {
        setRecipients(data);
      } else {
        // Fallback
        setRecipients([{ id: 'admin', name: 'Administrator' }]);
      }
    } catch (error) {
      console.error('Error fetching recipients:', error);
      // Fallback
      setRecipients([{ id: 'admin', name: 'Administrator' }]);
    }
  };

  // Fetch all messages
  const fetchMessages = async () => {
    if (!user) return;
    
    // Skip message fetching on admin pages to avoid conflicts
    if (window.location.pathname.includes('/admin/')) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('📩 Fetching messages...');
      const response = await fetch('/api/messages');
      
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }
      
      const data = await response.json();
      let rawMessages = [];
      
      // Ensure we have a messages array
      if (Array.isArray(data)) {
        rawMessages = data;
        console.log(`📩 Received ${rawMessages.length} messages from API`);
      } else if (data.messages && Array.isArray(data.messages)) {
        rawMessages = data.messages;
        console.log(`📩 Received ${rawMessages.length} messages from API (in messages property)`);
      } else {
        console.warn('Invalid messages format received:', data);
        setMessages([]);
        setUnreadCount(0);
        return;
      }
      
      // Server already processes threads, just use the data directly
      console.log('Using server-processed messages, total count:', rawMessages.length);
      
      // Ensure each message has replies array initialized and log what we received
      const processedMessages = rawMessages.map(message => ({
        ...message,
        replies: message.replies || []
      }));
      
      // Log the threading info for debugging
      processedMessages.forEach(message => {
        if (message.replies && message.replies.length > 0) {
          console.log(`✅ Message ${message.id} has ${message.replies.length} replies from server:`, message.replies.map(r => r.id));
        }
      });
      
      // Sort messages by creation date (newest first)
      const sortedMessages = processedMessages.sort((a, b) => {
        const dateA = new Date(a.timestamp || a.createdAt || '');
        const dateB = new Date(b.timestamp || b.createdAt || '');
        
        if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
        if (isNaN(dateA.getTime())) return 1;
        if (isNaN(dateB.getTime())) return -1;
        
        return dateB.getTime() - dateA.getTime();
      });
      
      setMessages(sortedMessages);
      
      // Count unread messages including replies
      let unreadCount = 0;
      sortedMessages.forEach(message => {
        // Count the main message if unread
        if (message.read === false) {
          unreadCount++;
        }
        // Count unread replies
        if (message.replies && message.replies.length > 0) {
          const unreadReplies = message.replies.filter(reply => reply.read === false).length;
          unreadCount += unreadReplies;
        }
      });
      
      console.log(`📧 Calculated unread count: ${unreadCount} (including replies)`);
      setUnreadCount(unreadCount);
      
      // Debug logging to verify threading is working
      console.log('Processed message threads:', sortedMessages.length, 'root messages');
    } catch (error) {
      console.error('Error fetching messages:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch messages');
    } finally {
      setLoading(false);
    }
  };

  // Send a message
  const sendMessage = async (message: any) => {
    if (!user) return null;
    
    setLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('recipient', message.recipient);
      formData.append('subject', message.subject);
      formData.append('content', message.content);
      
      // Add sendEmail flag if provided
      if (message.sendEmail !== undefined) {
        formData.append('sendEmail', message.sendEmail);
      }
      
      if (message.attachments && message.attachments.length > 0) {
        for (const file of message.attachments) {
          formData.append('attachments', file);
        }
      }
      
      const response = await fetch('/api/messages', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to send message');
      }
      
      const data = await response.json();
      console.log('Message sent successfully, API response:', data);
      
      // Add the new message to our state and select it
      if (data.message) {
        // Create a complete message object with all necessary properties
        const newMessage = {
          ...data.message,
          replies: [],  // Initialize with empty replies array
          read: true    // Mark as read since we're opening it
        };
        
        // Update messages list with new message at the top
        setMessages(prev => [newMessage, ...prev]);
        
        // Important: Set this as the selected message directly
        setSelectedMessage(newMessage);
        console.log('Auto-selected newly sent message:', newMessage);
        
        // Add auto-refresh after sending a message (with small delay to let backend process)
        setTimeout(() => {
          console.log('Auto-refreshing messages after send...');
          fetchMessages();
        }, 1000);
      }
      
      return data.message;
    } catch (error) {
      console.error('Error sending message:', error);
      setError(error instanceof Error ? error.message : 'Failed to send message');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Delete a message
  const deleteMessage = async (messageId: number) => {
    setLoading(true);
    
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete message');
      }
      
      // Update local state
      const deletedMessage = messages.find(msg => msg.id === messageId);
      
      // Remove from messages array
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      
      // Update unread count if needed
      if (deletedMessage && !deletedMessage.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      
      // Clear selection if this message was selected
      if (selectedMessage && selectedMessage.id === messageId) {
        setSelectedMessage(null);
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete message');
    } finally {
      setLoading(false);
    }
  };

  // Mark message as read
  const markAsRead = async (messageId: number) => {
    try {
      const response = await fetch(`/api/messages/${messageId}/read`, {
        method: 'POST', 
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark message as read');
      }
      
      // Update local state
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId ? { ...msg, read: true } : msg
        )
      );
      
      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      // Update selected message if needed
      if (selectedMessage && selectedMessage.id === messageId) {
        setSelectedMessage({ ...selectedMessage, read: true });
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
      // Don't show this error to user since it's not critical
    }
  };

  // Mark entire thread as read (including all replies)
  const markThreadAsRead = async (messageId: number) => {
    try {
      const response = await fetch(`/api/messages/${messageId}/read-thread`, {
        method: 'POST', 
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark thread as read');
      }
      
      const result = await response.json();
      console.log(`Marked ${result.markedCount} messages as read in thread ${messageId}`);
      
      // Update local state - mark both the main message and all replies as read
      setMessages(prev => 
        prev.map(msg => {
          if (msg.id === messageId) {
            // Mark main message and all its replies as read
            return {
              ...msg,
              read: true,
              replies: msg.replies.map(reply => ({ ...reply, read: true }))
            };
          }
          return msg;
        })
      );
      
      // Update unread count based on how many messages were marked
      if (result.markedCount > 0) {
        setUnreadCount(prev => Math.max(0, prev - result.markedCount));
      }
      
      return result;
    } catch (error) {
      console.error('Error marking thread as read:', error);
      // Don't show this error to user since it's not critical
    }
  };

  // Select a message
  const selectMessage = async (message: Message | null) => {
    if (message) {
      console.log('Selecting message:', message.id);
      console.log('Message data structure:', message);
      console.log('Message already has replies:', message.replies?.length || 0);
      console.log('Message replies array:', message.replies);
      
      // Mark entire thread as read (including all replies)
      try {
        const hasUnreadInThread = !message.read || (message.replies && message.replies.some(reply => !reply.read));
        if (hasUnreadInThread) {
          console.log('Marking entire thread as read...');
          await markThreadAsRead(message.id);
        }
      } catch (readError) {
        console.warn('Error marking thread as read:', readError);
      }
      
      // Use the message data we already have - replies are included from the main fetch
      setSelectedMessage(message);
    } else {
      setSelectedMessage(null);
    }
  };
  
  // Clear error
  const clearError = () => {
    setError(null);
  };

  // Reply to a message
  const replyToMessage = async (originalMessageId: number, content: string, attachments: any[] = []) => {
    if (!user) return null;
    
    // Find the original message
    const originalMessage = messages.find(msg => msg.id === originalMessageId);
    if (!originalMessage) {
      setError('Cannot reply: original message not found');
      return null;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Create reply subject with "Re:" prefix if not already present
      const subject = originalMessage.subject.startsWith('Re:') 
        ? originalMessage.subject 
        : `Re: ${originalMessage.subject}`;
      
      // Create a form data object for the reply
      const formData = new FormData();
      formData.append('recipient', String(originalMessage.senderId));
      formData.append('subject', subject);
      formData.append('content', content);
      formData.append('inReplyTo', String(originalMessageId));
      
      // Add attachments if any
      if (attachments.length > 0) {
        for (const file of attachments) {
          formData.append('attachments', file);
        }
      }
      
      // Send the reply to the correct endpoint (/:id/reply)
      const response = await fetch(`/api/messages/${originalMessageId}/reply`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to send reply');
      }
      
      const data = await response.json();
      
      // Handle the reply message from the server
      if (data.message) {
        console.log('Reply successfully sent:', data.message);
        
        // Add inReplyTo property explicitly to ensure the reply is linked to its parent
        const replyMessage = {
          ...data.message,
          inReplyTo: originalMessageId
        };
        
        // First add the reply to the parent message in our local state
        setMessages(prev => {
          return prev.map(msg => {
            if (msg.id === originalMessageId) {
              console.log(`Adding reply to message ${msg.id}`);
              return {
                ...msg,
                replies: [...(msg.replies || []), replyMessage]
              };
            }
            return msg;
          });
        });
        
        // Force a complete refresh from the server to update all messages
        setTimeout(() => {
          console.log('Refreshing messages to get updated threads...');
          fetchMessages();
        }, 300);
        
        // Do another refresh after a delay as a fallback
        setTimeout(() => {
          fetchMessages();
        }, 1500);
      }
      
      return data.message;
    } catch (error) {
      console.error('Error sending reply:', error);
      setError(error instanceof Error ? error.message : 'Failed to send reply');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Provide context value
  const contextValue: ChatContextType = {
    messages,
    selectedMessage,
    unreadCount,
    loading,
    error,
    sendMessage,
    replyToMessage,
    deleteMessage,
    markAsRead,
    selectMessage,
    fetchMessages,
    clearError,
    recipients
  };

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
};

// Custom hook to use the chat context
export const useChat = () => {
  const context = useContext(ChatContext);
  
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  
  return context;
};