import React from 'react';
import { Message } from '../../context/ChatContext';
import { threadActivityDate } from './thread-state';

interface MessageListProps {
  messages: Message[];
  onSelectMessage: (message: Message) => void;
  selectedMessageId?: number;
  selectionMode?: boolean;
  selectedMessageIds?: Set<number>;
  onToggleSelection?: (messageId: number) => void;
  onSelectAll?: (selected: boolean) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  onSelectMessage,
  selectedMessageId,
  selectionMode = false,
  selectedMessageIds = new Set(),
  onToggleSelection,
  onSelectAll
}) => {
  // Simplified date formatting function using native JS
  const formatDateSafe = (dateString: string | Date | undefined) => {
    try {
      // Handle undefined case first
      if (!dateString) {
        return 'Unknown date';
      }
      
      // Handle both string and Date objects
      const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
      
      // Check if date is valid before formatting
      if (isNaN(date.getTime())) {
        console.warn('Invalid date value:', dateString);
        return 'Unknown date';
      }
      
      // Use native JavaScript date formatting
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      });
    } catch (error) {
      console.error('Date parsing error:', error);
      return 'Unknown date';
    }
  };

  if (!messages || messages.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>No messages found.</p>
      </div>
    );
  }

   // API rows are display heads, including visible replies with a hidden parent.
   const rootMessages = messages;

  // Calculate selection state for "select all" checkbox
  const allSelected = rootMessages.length > 0 && rootMessages.every(msg => selectedMessageIds.has(msg.id));
  const someSelected = rootMessages.some(msg => selectedMessageIds.has(msg.id));

  const handleSelectAllChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onSelectAll) {
      onSelectAll(e.target.checked);
    }
  };

  const handleMessageClick = (message: Message, e: React.MouseEvent) => {
    if (selectionMode) {
      e.preventDefault();
      if (onToggleSelection) {
        onToggleSelection(message.id);
      }
    } else {
      onSelectMessage(message);
    }
  };

  const handleCheckboxClick = (messageId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleSelection) {
      onToggleSelection(messageId);
    }
  };

  return (
    <div className="divide-y divide-gray-100">
      {/* Select All Header (only shown in selection mode) */}
      {selectionMode && rootMessages.length > 0 && (
        <div className="p-4 bg-gray-50 border-b flex items-center">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(input) => {
              if (input) input.indeterminate = someSelected && !allSelected;
            }}
            onChange={handleSelectAllChange}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-3"
          />
          <span className="text-sm text-gray-700">
            {allSelected ? 'Deselect all' : 'Select all'} ({rootMessages.length} messages)
          </span>
        </div>
      )}
      
      {rootMessages.map((message) => {
        const hasReplies = message.replies && Array.isArray(message.replies) && message.replies.length > 0;
        
        // Check if thread has any unread messages (main message or any replies)
        const hasUnreadInThread = !message.read || (hasReplies && message.replies.some(reply => !reply.read));
        
        const isSelected = selectedMessageIds.has(message.id);
        
        return (
          <div
            key={message.id}
            onClick={(e) => handleMessageClick(message, e)}
            className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
              selectedMessageId === message.id ? 'bg-blue-50' : ''
            } ${isSelected ? 'bg-blue-100' : ''} ${hasUnreadInThread ? 'font-semibold' : ''} ${
              selectionMode ? 'select-none' : ''
            }`}
          >
            {/* Checkbox for selection mode */}
            {selectionMode && (
              <div className="flex items-start mb-2">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  onClick={(e) => handleCheckboxClick(message.id, e)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-3 mt-1"
                />
              </div>
            )}
            <div className="flex justify-between items-start mb-1">
              <h3 className="text-base font-medium truncate">{message.subject || 'No Subject'}</h3>
              <span className="text-xs text-gray-500 whitespace-nowrap ml-2" title="Latest conversation activity">
                {hasReplies ? 'Latest: ' : ''}{formatDateSafe(threadActivityDate(message))}
              </span>
            </div>
            
            <div className="flex justify-between items-start">
              <p className="text-sm text-gray-600 truncate">{message.senderName || 'Unknown Sender'}</p>
              {hasUnreadInThread && (
                <span className="inline-block w-2 h-2 bg-blue-600 rounded-full ml-2" 
                  title="Unread messages in thread"></span>
              )}
            </div>
            
            <div className="flex items-center">
              <p className="text-sm text-gray-500 mt-1 truncate flex-grow">
                {message.content ? message.content.substring(0, 60) + (message.content.length > 60 ? '...' : '') : 'No content'}
              </p>
              
              {/* Show attachment icon if message has attachments */}
              {message.attachments && message.attachments.length > 0 && (
                <span className="ml-2 flex items-center text-gray-500">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <span className="text-xs">{message.attachments.length}</span>
                </span>
              )}
              
              {/* Show reply count if there are replies */}
              {hasReplies && message.replies && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 rounded-full text-gray-600">
                  {message.replies.length} {message.replies.length === 1 ? 'reply' : 'replies'}
                </span>
              )}
            </div>
            
            {/* Show attachment thumbnails if message has attachments */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="flex mt-2 space-x-2 overflow-x-auto pb-2">
                {message.attachments.map((attachment, index) => {
                  const isImage = attachment.filename.match(/\.(jpeg|jpg|gif|png)$/i);
                  
                  return (
                    <div key={index} className="flex-shrink-0">
                      {isImage ? (
                        <img 
                          src={attachment.url} 
                          alt={attachment.filename}
                          className="h-16 w-16 object-cover rounded border border-gray-200" 
                        />
                      ) : (
                        <div className="h-16 w-16 flex items-center justify-center bg-gray-100 rounded border border-gray-200">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};