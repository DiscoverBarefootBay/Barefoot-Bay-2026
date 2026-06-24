import React, { useState, useEffect } from 'react';
import { useChat, Message } from '../../context/ChatContext';
import { MessageList } from './MessageList';
import { MessageDetail } from './MessageDetail';
import { EnhancedMessageComposer } from './EnhancedMessageComposer';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import '../../styles/messages.css';

// Single message in a thread
const ThreadMessage: React.FC<{
  message: Message;
  isOriginal?: boolean;
}> = ({ message, isOriginal = false }) => {
  const formatDate = (dateString?: string) => {
    try {
      // If dateString is undefined or null, use createdAt as fallback
      const actualDateString = dateString || message.createdAt;

      if (!actualDateString) {
        // Use native JS date formatting instead of date-fns format
        return new Date().toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          hour12: true
        });
      }

      const date = new Date(actualDateString);

      // Check if date is valid before formatting
      if (isNaN(date.getTime())) {
        console.warn('Invalid date:', actualDateString);
        // Use native JS date formatting instead of date-fns format
        return new Date().toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          hour12: true
        });
      }

      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      });
    } catch (error) {
      console.error('Date parsing error:', error, dateString);
      // Use native JS date formatting instead of date-fns format
      return new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      });
    }
  };

  return (
    <div className={`border-l-4 ${isOriginal ? 'border-blue-500' : 'border-gray-300'} pl-3 mb-6`}>
      <div className="flex justify-between items-start mb-1">
        <div className="font-medium">{message.senderName || message.sender?.name || message.sender?.fullName || message.sender?.username || 'Unknown'}</div>
        <div className="text-xs text-gray-500">
          {formatDate(message.timestamp)}
        </div>
      </div>

      <div className="bg-gray-50 p-3 rounded-lg mb-2">
        <div className="prose max-w-none">
          {message.content && typeof message.content === 'string' 
            ? message.content.split('\n').map((paragraph, index) => (
                <p key={index} className="text-sm">{paragraph}</p>
              ))
            : <p className="text-sm text-gray-500">No content</p>
          }
        </div>
      </div>

      {/* Attachments if any */}
      {message.attachments && message.attachments.length > 0 && (
        <div className="mt-2 mb-2">
          <div className="text-sm text-gray-600 mb-2">Attachments:</div>
          <div className="grid grid-cols-2 gap-2">
            {message.attachments.map(attachment => {
              // Check if attachment is an image based on filename or contentType
              const isImage = 
                attachment.contentType?.startsWith('image/') || 
                /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(attachment.filename);

              // Check if attachment is a video based on filename or contentType
              const isVideo = 
                attachment.contentType?.startsWith('video/') || 
                /\.(mp4|webm|ogg|mov|avi)$/i.test(attachment.filename);

              // Include a timestamp parameter to avoid caching issues
              const urlWithTimestamp = `${attachment.url}?t=${new Date().getTime()}`;

              return (
                <div key={attachment.id} className="border rounded-lg overflow-hidden bg-white flex flex-col">
                  {/* Preview for images */}
                  {isImage && (
                    <div className="relative h-32 bg-gray-100 overflow-hidden">
                      <img 
                        src={urlWithTimestamp}
                        alt={attachment.filename}
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => {
                          // Add fallback for broken images
                          e.currentTarget.src = '/media-placeholder/image-placeholder.png';
                        }}
                      />
                    </div>
                  )}

                  {/* Preview for videos */}
                  {isVideo && (
                    <div className="relative h-32 bg-gray-100 overflow-hidden">
                      <video 
                        controls
                        className="absolute inset-0 w-full h-full object-cover"
                      >
                        <source src={urlWithTimestamp} type={attachment.contentType} />
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  )}

                  {/* For non-image/video files, show icon */}
                  {!isImage && !isVideo && (
                    <div className="h-32 flex items-center justify-center bg-gray-100">
                      <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  )}

                  {/* Filename and download link */}
                  <div className="p-2">
                    <a 
                      href={urlWithTimestamp} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-blue-500 hover:underline block truncate"
                      title={attachment.filename}
                    >
                      {attachment.filename}
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// Message detail component with thread view
const MessageDetail: React.FC<{
  message: Message;
  onBack: () => void;
  onDelete: (id: number) => void;
}> = ({ message, onBack, onDelete }) => {
  const { replyToMessage, loading, fetchMessages } = useChat();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [replySent, setReplySent] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleReply = async () => {
    if (!replyContent.trim()) return;

    try {
      const result = await replyToMessage(message.id, replyContent, attachments);
      setReplyContent('');
      setAttachments([]);
      setShowReplyForm(false);
      setReplySent(true);

      // Force a refresh to get the latest messages
      fetchMessages();

      // If the message wasn't immediately added to state, try again after a delay
      if (result) {
        setTimeout(() => {
          fetchMessages();
        }, 1000);
      }

      // Auto-hide the success message after 3 seconds
      setTimeout(() => {
        setReplySent(false);
      }, 3000);
    } catch (error) {
      console.error("Error sending reply:", error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const fileList = Array.from(e.target.files);
      setAttachments(prev => [...prev, ...fileList]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleDeleteConfirm = () => {
    onDelete(message.id);
    setShowDeleteConfirm(false);
  };

  return (
    <div className="p-4">
      {/* Header with back button - desktop only, mobile uses top back button */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <button 
          onClick={onBack}
          className="text-blue-500 flex items-center min-w-0 hidden sm:flex"
        >
          <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back</span>
        </button>

        <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0 sm:ml-auto">
          <button
            onClick={() => setShowReplyForm(!showReplyForm)}
            className="text-blue-500 hover:text-blue-700 flex items-center px-3 py-2 rounded-md hover:bg-blue-50 border border-blue-200"
            title="Reply to message"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            <span className="sm:inline">Reply</span>
          </button>

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50"
            title="Delete message"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Reply success notification */}
      {replySent && (
        <div className="mb-4 p-3 bg-green-100 text-green-800 rounded flex justify-between items-center">
          <p>Your reply has been sent successfully!</p>
          <button onClick={() => setReplySent(false)} className="text-green-600 hover:text-green-800">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Message subject */}
      <h1 className="text-2xl font-bold mb-4">{message.subject}</h1>

      {/* Thread view - all messages in reverse chronological order */}
      <div className="mb-6">
        {(() => {
          // Combine original message and replies
          const allMessages = [
            {...message, isOriginal: false},
            ...(message.replies || []).map(reply => ({...reply, isOriginal: false}))
          ];

          // More detailed debugging to check replies
          console.log(`Message ID ${message.id} has ${message.replies?.length || 0} replies:`, message.replies);

          if (!message.replies || message.replies.length === 0) {
            console.log(`No replies for message ${message.id} - this could indicate a threading issue`);
          } else {
            message.replies.forEach(reply => {
              console.log(`Reply ID ${reply.id} to message ${message.id}, content: ${reply.content.substring(0, 20)}...`);
            });
          }

          // Sort all messages by date (newest first)
          const sortedMessages = [...allMessages].sort((a, b) => {
            const dateA = a.timestamp ? new Date(a.timestamp).getTime() : new Date(a.createdAt).getTime();
            const dateB = b.timestamp ? new Date(b.timestamp).getTime() : new Date(b.createdAt).getTime();
            return dateB - dateA; // Newest first
          });

          // Mark the first (newest) message with isOriginal=true to get the blue highlight
          if (sortedMessages.length > 0) {
            sortedMessages[0] = {...sortedMessages[0], isOriginal: true};
          }

          // Return the sorted messages with the newest highlighted
          return sortedMessages.map(msg => (
            <ThreadMessage 
                key={msg.id} 
                message={msg} 
                isOriginal={msg.isOriginal} 
              />
            ));
        })()}
      </div>

      {/* Reply form */}
      {showReplyForm && (
        <div className="mt-6 border-t pt-4">
          <h3 className="text-lg font-semibold mb-2">Reply</h3>

          <div className="mb-4">
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Type your reply here..."
              className="w-full border rounded-md p-3 focus:ring-blue-500 focus:border-blue-500"
              rows={5}
            />
          </div>

          {/* Attachments */}
          <div className="mb-4">
            {/* List of selected attachments */}
            {attachments.length > 0 && (
              <div className="mb-3 space-y-2">
                {attachments.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      <span className="text-sm truncate max-w-xs">{file.name}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* File input */}
            <label className="cursor-pointer inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none mr-2">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              Attach
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          <div className="flex justify-end space-x-2">
            <button 
              type="button"
              onClick={() => setShowReplyForm(false)}
              className="px-3 py-1.5 border rounded-md"
            >
              Cancel
            </button>

            <button 
              type="button"
              onClick={handleReply}
              disabled={(replyContent.trim() === '' && attachments.length === 0) || loading}
              className="px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Reply'}
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold mb-4">Delete Message</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this message? This action cannot be undone.
            </p>
            <div className="flex space-x-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Message composer component
const MessageComposer: React.FC<{
  recipients: Array<{id: number | string, name: string}>;
  onSubmit: (formData: FormData) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}> = ({ recipients, onSubmit, onCancel, loading }) => {
  const [selectedRecipient, setSelectedRecipient] = useState<string | number>('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);

  useEffect(() => {
    // Set default recipient if only one is available
    if (recipients.length === 1) {
      setSelectedRecipient(recipients[0].id);
    }
  }, [recipients]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Create form data
    const formData = new FormData();
    formData.append('recipient', String(selectedRecipient));
    formData.append('subject', subject);
    formData.append('content', content);

    // Add attachments if any
    attachments.forEach(file => {
      formData.append('attachments', file);
    });

    // Submit form
    await onSubmit(formData);

    // Reset form
    setSelectedRecipient('');
    setSubject('');
    setContent('');
    setAttachments([]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const fileList = Array.from(e.target.files);
      setAttachments(prev => [...prev, ...fileList]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">New Message</h2>
        <button 
          onClick={onCancel}
          className="text-gray-500"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Recipient selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            To:
          </label>
          <select
            value={String(selectedRecipient)}
            onChange={(e) => setSelectedRecipient(e.target.value)}
            className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
          >
            <option value="">Select recipient</option>
            {recipients.map(recipient => (
              <option key={recipient.id} value={String(recipient.id)}>
                {recipient.name}
              </option>
            ))}
          </select>
        </div>

        {/* Subject */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Subject:
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
        </div>

        {/* Message content */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Message:
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="block w-full border border-gray-300 rounded-md px-3 py-2 h-32 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
        </div>

        {/* Attachments */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Attachments:
          </label>

          {/* List of selected attachments */}
          {attachments.length > 0 && (
            <div className="mb-3 space-y-2">
              {attachments.map((file, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <span className="text-sm truncate max-w-xs">{file.name}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* File input */}
          <label className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none">
            <svg className="w-5 h-5 mr-2 -ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            Add attachment
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>

        {/* Form actions */}
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send Message'}
          </button>
        </div>
      </form>
    </div>
  );
};

// Main Chat component
const Chat = () => {
  const { 
    messages, 
    selectedMessage,
    unreadCount,
    loading, 
    error,
    recipients,
    sendMessage,
    deleteMessage,
    selectMessage,
    fetchMessages,
    clearError
  } = useChat();

  const [showComposer, setShowComposer] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Clear success message after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Handle message submission
  const handleSubmitMessage = async (formData: FormData) => {
    try {
      console.log('Sending message...');

      // Send the message and get the response
      const newMessage = await sendMessage({
        recipient: formData.get('recipient'),
        subject: formData.get('subject'),
        content: formData.get('content'),
        sendEmail: formData.get('sendEmail'),
        attachments: formData.getAll('attachments')
      });

      console.log('Message sent successfully, new message object:', newMessage);

      // Close composer and show success message
      setShowComposer(false);
      setSuccessMessage('Message sent successfully!');

      // Important: Ensure we have the latest messages, including the one we just sent
      await fetchMessages();

      // Add a delay to ensure state updates are processed
      // This is critical for ensuring the new message appears in the messages list
      setTimeout(async () => {
        // Get the latest message ID from the server response
        const newMessageId = newMessage?.id;
        console.log('New message ID from response:', newMessageId);

        // First approach: Find the message directly by its ID if available
        if (newMessageId) {
          // Find this message in our updated messages list
          const sentMessage = messages.find(msg => msg.id === newMessageId);
          if (sentMessage) {
            console.log('Found sent message by ID, opening it:', sentMessage);
            selectMessage(sentMessage);
            return;
          }
        }

        // Second approach: Get the top message by timestamp
        if (messages && messages.length > 0) {
          // Make a copy and sort by timestamp (newest first)
          const sortedMessages = [...messages].sort((a, b) => {
            const dateA = new Date(a.timestamp || a.createdAt || Date.now());
            const dateB = new Date(b.timestamp || b.createdAt || Date.now());
            return dateB.getTime() - dateA.getTime();
          });

          // Get the newest message
          const latestMessage = sortedMessages[0];
          if (latestMessage) {
            console.log('Opening latest message by timestamp:', latestMessage);
            selectMessage(latestMessage);
          } else {
            console.error('No messages found after sorting');
          }
        } else {
          console.error('No messages available in state');

          // Last resort - fetch messages again and try one more time
          await fetchMessages();
          if (messages.length > 0) {
            const newestMessage = [...messages].sort((a, b) => {
              return new Date(b.timestamp || b.createdAt || Date.now()).getTime() - 
                     new Date(a.timestamp || a.createdAt || Date.now()).getTime();
            })[0];

            if (newestMessage) {
              selectMessage(newestMessage);
            }
          }
        }
      }, 500); // Longer delay to ensure state is fully updated

    } catch (err) {
      console.error('Error sending message:', err);
      alert(`Failed to send message: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Handle message deletion
  const handleDeleteMessage = async () => {
    if (!selectedMessage) return;

    if (window.confirm('Are you sure you want to delete this message?')) {
      try {
        console.log(`Attempting to delete message with ID: ${selectedMessage.id} (${typeof selectedMessage.id})`);

        // Simplified approach - Direct API call
        const response = await fetch(`/api/messages/${selectedMessage.id}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        // Always try to parse the response body
        let responseBody;
        try {
          responseBody = await response.json();
        } catch (jsonError) {
          console.warn('Could not parse response as JSON:', jsonError);
          responseBody = {};
        }

        console.log('Delete response status:', response.status, responseBody);

        if (response.ok) {
          console.log(`Message successfully deleted`);
          setSuccessMessage('Message deleted successfully!');
          fetchMessages(); // Refresh the messages list
          selectMessage(null); // Go back to the message list
        } else {
          // Extract the error message from the response
          const errorMessage = responseBody?.error || responseBody?.message || 'Failed to delete message';
          console.error(`Server returned error: ${response.status} ${errorMessage}`);
          throw new Error(errorMessage);
        }
      } catch (error) {
        console.error('Error during message deletion:', error);

        // Clear any previous success messages
        setSuccessMessage(null);

        // Display error to user
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        alert(`Could not delete message: ${errorMessage}`);

        // Auto-refresh messages list to ensure UI is in sync with server
        fetchMessages();
      }
    }
  };

  // Handle message reply
  const handleReplyToMessage = (message: Message) => {
    // Pre-populate the composer with reply information
    const replyFormData = new FormData();
    replyFormData.append('recipient', message.senderId.toString());
    replyFormData.append('subject', `Re: ${message.subject}`);
    replyFormData.append('content', '');
    replyFormData.append('inReplyTo', message.id.toString());
    
    // Open the composer with pre-filled data
    setShowComposer(true);
    
    // Clear current selection to show composer
    selectMessage(null);
  };

  // Refresh messages
  const handleRefresh = () => {
    fetchMessages();
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
        // Remove deleted messages from the list and refresh
        setSelectedMessageIds(new Set());
        setSelectionMode(false);
        setSuccessMessage(`Successfully deleted ${messageIdsArray.length} message(s)`);
        fetchMessages(); // Refresh the entire message list

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
      setSuccessMessage(null);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      alert(`Could not delete messages: ${errorMessage}`);
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Error and success notifications */}
      {error && (
        <div className="p-4 bg-red-100 text-red-800 rounded-t-lg flex justify-between items-center">
          <p>{error}</p>
          <button onClick={clearError} className="text-red-600 hover:text-red-800">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-green-100 text-green-800 rounded-t-lg flex justify-between items-center">
          <p>{successMessage}</p>
          <button onClick={() => setSuccessMessage(null)} className="text-green-600 hover:text-green-800">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 min-h-[600px]">
        {/* Messages List - hide on mobile when viewing a message */}
        <div className={`${isMobile && selectedMessage ? 'hidden' : 'block'} border-r`}>
          <div className="p-4 border-b flex justify-between items-center">
            {selectionMode ? (
              // Selection mode header
              <>
                <div className="flex items-center">
                  <button
                    onClick={handleToggleSelectionMode}
                    className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100 mr-3"
                    title="Exit selection mode"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <span className="text-lg font-medium">
                    {selectedMessageIds.size} selected
                  </span>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={handleBulkDelete}
                    disabled={selectedMessageIds.size === 0 || bulkDeleting}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete selected messages"
                  >
                    <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    {bulkDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </>
            ) : (
              // Normal header
              <>
                <h2 className="text-xl font-semibold">
                  Messages
                  {unreadCount > 0 && (
                    <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                      {unreadCount} new
                    </span>
                  )}
                </h2>
                <div className="flex space-x-2">
                  <button 
                    onClick={handleToggleSelectionMode}
                    className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
                    title="Select messages"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                  
                  <button 
                    onClick={() => setShowComposer(true)}
                    className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600"
                    title="New message"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Loading state */}
          {loading && !messages.length ? (
            <div className="p-8 text-center text-gray-500">
              <svg className="animate-spin w-6 h-6 mx-auto mb-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <p>Loading messages...</p>
            </div>
          ) : (
            <MessageList 
              messages={messages} 
              onSelectMessage={(message) => selectMessage(message)}
              selectedMessageId={selectedMessage?.id}
              selectionMode={selectionMode}
              selectedMessageIds={selectedMessageIds}
              onToggleSelection={handleToggleSelection}
              onSelectAll={handleSelectAll}
            />
          )}
        </div>

        {/* Message Detail or Composer - show on larger screens or when selected on mobile */}
        <div className={`${isMobile && !selectedMessage && !showComposer ? 'hidden' : 'block'} col-span-2 bg-white`}>
          {showComposer ? (
            <EnhancedMessageComposer 
              recipients={recipients}
              onSend={handleSubmitMessage}
              onCancel={() => setShowComposer(false)}
            />
          ) : selectedMessage ? (
            <MessageDetail 
              message={selectedMessage}
              onBack={() => selectMessage(null)}
              onDelete={handleDeleteMessage}
              onReply={handleReplyToMessage}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center text-gray-500">
              <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg font-medium mb-2">No message selected</h3>
              <p className="mb-4">Select a message from the list to view its contents or start a new conversation.</p>
              <button 
                onClick={() => setShowComposer(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 inline-flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                New Message
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Export both as default and named export for compatibility
export { Chat };
export default Chat;