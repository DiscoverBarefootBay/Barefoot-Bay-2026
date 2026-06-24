import React, { useState, useEffect, useReducer } from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { MessageList } from './MessageList';
import { MessageDetail } from './MessageDetail';
import { MessageComposer } from './MessageComposer';
import { Message, ChatState, ChatActionType } from '../../types/chat';
import { apiRequest } from '../../lib/api-helpers';
import '../../styles/messages.css';

// Define initial state
const initialState: ChatState = {
  messages: [],
  selectedMessage: null,
  unreadCount: 0,
  loading: true,
  error: null
};

// Create reducer function
function chatReducer(state: ChatState, action: ChatActionType): ChatState {
  switch (action.type) {
    case 'FETCH_MESSAGES_REQUEST':
      return { ...state, loading: true, error: null };
    case 'FETCH_MESSAGES_SUCCESS':
      return { 
        ...state, 
        loading: false, 
        messages: action.payload || [], 
        unreadCount: Array.isArray(action.payload) 
          ? action.payload.filter(msg => msg && msg.read === false).length 
          : 0
      };
    case 'FETCH_MESSAGES_FAILURE':
      return { ...state, loading: false, error: action.payload };
    case 'SELECT_MESSAGE':
      return { ...state, selectedMessage: action.payload };
    case 'DELETE_MESSAGE':
      return { 
        ...state, 
        messages: state.messages.filter(msg => msg && msg.id !== action.payload),
        selectedMessage: state.selectedMessage?.id === action.payload ? null : state.selectedMessage
      };
    case 'MARK_AS_READ':
      return {
        ...state,
        messages: state.messages.map(msg => 
          msg && msg.id === action.payload 
            ? { ...msg, read: true } 
            : msg
        ),
        unreadCount: Math.max(0, state.unreadCount - 1)
      };
    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [action.payload, ...state.messages]
      };
    case 'UPDATE_UNREAD_COUNT':
      return { ...state, unreadCount: action.payload };
    default:
      return state;
  }
}

// Export both as default and named export for compatibility
const Chat = () => {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const { messages, selectedMessage, loading, error, unreadCount } = state;

  const [recipients, setRecipients] = useState<Array<{id: number | string, name: string}>>([]);
  const [showComposer, setShowComposer] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Fetch messages on component mount
  useEffect(() => {
    fetchMessages();
    fetchRecipients();
  }, []);

  const fetchMessages = async () => {
    try {
      dispatch({ type: 'FETCH_MESSAGES_REQUEST' });
      
      // Use improved apiRequest helper for better error handling
      const data = await apiRequest<Message[]>('/api/messages', 'GET');
      
      // Add validation to ensure we received proper data
      if (!Array.isArray(data)) {
        console.error('Invalid response format for messages:', data);
        throw new Error('Received invalid data format from server');
      }
      
      // Update messages with successful response
      dispatch({ type: 'FETCH_MESSAGES_SUCCESS', payload: data });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      dispatch({ 
        type: 'FETCH_MESSAGES_FAILURE', 
        payload: `Error fetching messages: ${errorMessage}. Please try again later.` 
      });
      console.error('Error fetching messages:', err);
      
      // Implement retry logic after a delay
      setTimeout(() => {
        console.log('Failed to check for new messages, will retry later');
        // fetchMessages(); // Uncomment to enable auto-retry
      }, 30000);
    }
  };

  const fetchRecipients = async () => {
    try {
      const data = await apiRequest<Array<{id: number | string, name: string}>>('/api/chat/recipients', 'GET');
      
      if (Array.isArray(data)) {
        setRecipients(data);
      } else {
        console.error('Invalid recipients data format:', data);
      }
    } catch (err) {
      console.error('Error fetching recipients:', err);
      // Use an empty array as fallback if recipients can't be loaded
      setRecipients([]);
    }
  };

  const handleSelectMessage = async (message: Message) => {
    try {
      dispatch({ type: 'SELECT_MESSAGE', payload: message });
      
      // If message is unread, mark it as read
      if (message && message.read === false) {
        try {
          await apiRequest(`/api/messages/${message.id}/read`, 'POST');
          
          // Update the message in state
          dispatch({ type: 'MARK_AS_READ', payload: message.id });
        } catch (readError) {
          console.error('Error marking message as read:', readError);
          // Continue with selection even if read status update fails
        }
      }
    } catch (err) {
      console.error('Error selecting message:', err);
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    try {
      // Use the improved apiRequest helper
      await apiRequest(`/api/messages/${messageId}`, 'DELETE');
      
      // Update state through reducer
      dispatch({ type: 'DELETE_MESSAGE', payload: messageId });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('Error deleting message:', err);
      
      // Set error state
      dispatch({ 
        type: 'FETCH_MESSAGES_FAILURE', 
        payload: `Failed to delete message: ${errorMessage}` 
      });
      
      // Clear error after a few seconds
      setTimeout(() => {
        dispatch({ type: 'FETCH_MESSAGES_FAILURE', payload: null });
      }, 5000);
    }
  };

  const handleSubmitMessage = async (formData: FormData) => {
    try {
      dispatch({ type: 'FETCH_MESSAGES_REQUEST' });
      
      // Validate required fields
      const recipient = formData.get('recipient') as string;
      const subject = formData.get('subject') as string;
      const content = formData.get('content') as string;
      const attachments = formData.getAll('attachments') as File[];
      
      if (!recipient || !subject || !content) {
        dispatch({ 
          type: 'FETCH_MESSAGES_FAILURE', 
          payload: 'Please fill in all required fields.' 
        });
        return;
      }
      
      // Create FormData for multipart request
      const data = new FormData();
      data.append('recipient', recipient);
      data.append('subject', subject);
      data.append('content', content);
      
      // Add each attachment to the form data
      attachments.forEach(file => {
        data.append('attachments', file);
      });
      
      // Since we're sending FormData, we need to use fetch directly
      const response = await fetch('/api/messages', {
        method: 'POST',
        body: data,
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to send message: ${response.status} ${errorText}`);
      }
      
      // Refresh messages list after sending
      await fetchMessages();
      setShowComposer(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('Error sending message:', err);
      
      // Display error via reducer
      dispatch({ 
        type: 'FETCH_MESSAGES_FAILURE', 
        payload: `Failed to send message: ${errorMessage}` 
      });
      
      // Don't close composer so user can try again
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="grid grid-cols-1 md:grid-cols-3 min-h-[600px]">
        {/* Messages List */}
        <div className={`${isMobile && selectedMessage ? 'hidden' : 'block'} border-r`}>
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="text-xl font-semibold">Messages</h2>
            <button 
              onClick={() => setShowComposer(true)}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              New Message
            </button>
          </div>
          
          {loading ? (
            <div className="p-4 text-center">
              <p>Loading messages...</p>
            </div>
          ) : error ? (
            <div className="p-4 text-center text-red-500">
              <p>{error}</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <p>No messages found.</p>
            </div>
          ) : (
            <MessageList 
              messages={messages} 
              onSelectMessage={handleSelectMessage}
              selectedMessageId={selectedMessage?.id}
            />
          )}
        </div>
        
        {/* Message Detail or Composer */}
        <div className={`${isMobile && !selectedMessage ? 'hidden' : 'block'} col-span-2`}>
          {showComposer ? (
            <MessageComposer 
              recipients={recipients}
              onSubmit={handleSubmitMessage}
              onCancel={() => setShowComposer(false)}
              loading={loading}
            />
          ) : selectedMessage ? (
            <MessageDetail 
              message={selectedMessage}
              onBack={() => dispatch({ type: 'SELECT_MESSAGE', payload: null })}
              onDelete={handleDeleteMessage}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>Select a message to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export { Chat };
export default Chat;