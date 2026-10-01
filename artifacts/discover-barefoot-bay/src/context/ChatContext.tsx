import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import type { ChatRecipient } from '../components/chat/recipient-options';
import { submitMessageForm } from '../components/chat/message-submission';
import { appendThreadReply, normalizeConversationResponse, refreshedSelection, sortConversations } from '../components/chat/thread-state';

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
  lastActivityAt?: string | Date;
  threadRoot?: boolean;
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
  replyToMessage: (originalMessageId: number, content: string, attachments?: any[], sendEmail?: boolean) => Promise<any>;
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
  const messageRequest = useRef(0);
  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;

  // Fetch recipients
  const fetchRecipients = async () => {
    const requestingUser = user?.id;
    try {
      const response = await fetch('/api/chat/recipients');
      
      if (!response.ok) {
        console.warn('Could not fetch recipients, using admin as fallback');
        setRecipients([{ id: 'admin', name: 'Administrator' }]);
        return;
      }
      
      const data = await response.json();
      if (requestingUser !== userIdRef.current) return;
      
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
  const fetchMessages = useCallback(async (background = false) => {
    if (!user || user.id !== userIdRef.current) return;
    
    // Skip message fetching on admin pages to avoid conflicts
    if (window.location.pathname.includes('/admin/')) {
      return;
    }
    
    const request = ++messageRequest.current;
    const requestingUser = user.id;
    if (!background) setLoading(true);
    
    try {
      console.log('📩 Fetching messages...');
      const response = await fetch('/api/messages');
      
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }
      
      const sortedMessages = normalizeConversationResponse<Message>(await response.json());
      if (request !== messageRequest.current || requestingUser !== userIdRef.current) return;
      setMessages(sortedMessages);
      setError(null);
      
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
      if (request !== messageRequest.current || requestingUser !== userIdRef.current) return;
      console.error('Error fetching messages:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch messages');
    } finally {
      if (request === messageRequest.current && requestingUser === userIdRef.current) setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    ++messageRequest.current;
    setMessages([]);
    setSelectedMessage(null);
    setUnreadCount(0);
    setError(null);
    setRecipients([]);
    setLoading(false);
    if (user) {
      void fetchMessages();
      void fetchRecipients();
    }
    return () => { ++messageRequest.current; };
  }, [user?.id, fetchMessages]);

  useEffect(() => {
    setSelectedMessage(current => refreshedSelection(messages, current));
  }, [messages]);

  // Another participant can reply while this page stays open.
  useEffect(() => {
    if (!user) return;
    const refresh = () => {
      if (document.visibilityState === 'visible' && window.location.pathname.endsWith('/messages')) {
        void fetchMessages(true);
      }
    };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [user?.id, fetchMessages]);

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
      if (message.templateId) formData.append('templateId', message.templateId);
      
      if (message.attachments && message.attachments.length > 0) {
        for (const file of message.attachments) {
          formData.append('attachments', file);
        }
      }
      
      const data = await submitMessageForm('/api/messages', formData, user.id);
      if (user.id !== userIdRef.current) return null;
      ++messageRequest.current;
      // Legacy servers return a success string in message and the record in data.
      data.message = typeof data.message === "object" ? data.message : data.data;
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
      throw error;
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
      setSelectedMessage(current => current?.id === messageId ? { ...current, read: true } : current);
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
      const markedIds = Array.isArray(result.markedMessageIds) ? new Set<number>(result.markedMessageIds) : null;
      
      // Update local state - mark both the main message and all replies as read
      setMessages(prev => 
        prev.map(msg => {
          if (msg.id === messageId) {
            // Mark main message and all its replies as read
            return {
              ...msg,
              read: markedIds ? markedIds.has(msg.id) || msg.read : true,
              replies: msg.replies.map(reply => ({
                ...reply,
                read: markedIds ? markedIds.has(reply.id) || reply.read : true
              }))
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
      // Select immediately: a slow read receipt must not undo a later click.
      setSelectedMessage(message);
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
      
    } else {
      setSelectedMessage(null);
    }
  };
  
  // Clear error
  const clearError = () => {
    setError(null);
  };

  // Reply to a message
  const replyToMessage = async (originalMessageId: number, content: string, attachments: any[] = [], sendEmail = false) => {
    if (!user) return null;
    
    // Find the original message
    const originalMessage = messages.flatMap(msg => [msg, ...msg.replies]).find(msg => msg.id === originalMessageId);
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
      formData.append('sendEmail', sendEmail ? 'true' : 'false');
      
      // Add attachments if any
      if (attachments.length > 0) {
        for (const file of attachments) {
          formData.append('attachments', file);
        }
      }
      
      // Send the reply to the correct endpoint (/:id/reply)
      const data = await submitMessageForm(`/api/messages/${originalMessageId}/reply`, formData, user.id);
      if (user.id !== userIdRef.current) return null;
      ++messageRequest.current;
      data.message = typeof data.message === 'object' ? data.message : data.data;
      
      // Handle the reply message from the server
      if (data.message) {
        console.log('Reply successfully sent:', data.message);
        
        // Add inReplyTo property explicitly to ensure the reply is linked to its parent
        const replyMessage = {
          ...data.message,
          inReplyTo: originalMessageId,
          senderName: data.message.senderName || user.fullName || user.username,
          read: true,
          replies: data.message.replies || []
        };
        
        // First add the reply to the parent message in our local state
        setMessages(prev => {
          return sortConversations(prev.map(msg => {
            if (msg.id === originalMessageId || msg.replies.some(reply => reply.id === originalMessageId)) {
              return appendThreadReply(msg, replyMessage);
            }
            return msg;
          }));
        });
        
        // Force a complete refresh from the server to update all messages
        setTimeout(() => {
          console.log('Refreshing messages to get updated threads...');
          void fetchMessages(true);
        }, 300);
        
        // Do another refresh after a delay as a fallback
        setTimeout(() => {
          void fetchMessages(true);
        }, 1500);
      }
      
      if (!data.message?.id) throw new Error('Reply response was incomplete. Refresh before trying again.');
      return data.message;
    } catch (error) {
      console.error('Error sending reply:', error);
      setError(error instanceof Error ? error.message : 'Failed to send reply');
      throw error;
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