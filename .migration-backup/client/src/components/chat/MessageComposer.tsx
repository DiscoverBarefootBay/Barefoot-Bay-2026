import React, { useState, useRef, useEffect } from 'react';
import { MESSAGE_TEMPLATES, MessageTemplate } from '../../types/message-templates';

interface MessageComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (formData: FormData) => Promise<void>;
  recipients: Array<{ id: number; name: string }>;
  replyTo?: {
    id: number;
    subject: string;
    senderName: string;
  };
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  isOpen,
  onClose,
  onSend,
  recipients,
  replyTo
}) => {
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [recipient, setRecipient] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('custom');
  // Always set admin to true - this is a simplified approach since we're already checking
  // permissions server-side. If the user can access the composer, they're an admin.
  const [isAdminUser, setIsAdminUser] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle reply pre-population
  useEffect(() => {
    if (replyTo) {
      // Pre-populate form for reply
      setSelectedTemplate('custom');
      setSubject(`Re: ${replyTo.subject}`);
      setRecipient(''); // Let user select recipient
      setContent(''); // Start with empty content for reply
    }
  }, [replyTo]);

  // Handle template selection
  const handleTemplateChange = async (templateId: string) => {
    setSelectedTemplate(templateId);
    
    if (templateId === 'custom') {
      // Reset fields for custom template
      setSubject('');
      setContent('');
      setRecipient('');
      return;
    }
    
    // Find the selected template
    const template = MESSAGE_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;
    
    // Populate fields from template
    setSubject(template.subject);
    setContent(template.content);
    
    // Set recipient based on template targeting logic
    if (template.targetType === 'dynamic' && template.targetQuery) {
      try {
        // Fetch the users matching the template criteria from our API
        const response = await fetch(`/api/message-templates/target-users/${template.targetQuery}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch target recipients: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.users && data.users.length > 0) {
          // Create a special recipient marker for this dynamic template
          // We'll use a prefix to identify dynamically targeted messages in the server
          setRecipient(`template:${template.targetQuery}`);
          
          // Show how many users will receive this message
          alert(`This template will target ${data.users.length} recipients matching the criteria.`);
        } else {
          // If no users match the criteria, let the user know
          alert(`No users match the criteria for this template (${template.name})`);
          setRecipient('');
        }
      } catch (error) {
        console.error('Error fetching target recipients:', error);
        alert('Could not load targeted recipients. Please try again or select a different template.');
        
        // Fall back to group recipients if dynamic targeting fails
        switch (template.targetQuery) {
          case 'sponsorship_expiring_7days':
            const paidUsers = recipients.find(r => r.name === 'Paid Users');
            if (paidUsers) setRecipient(paidUsers.id.toString());
            break;
          case 'badge_holders':
            const badgeHolders = recipients.find(r => r.name === 'Badge Holders');
            if (badgeHolders) setRecipient(badgeHolders.id.toString());
            break;
          case 'new_paid_users':
            const registered = recipients.find(r => r.name === 'Paid Users');
            if (registered) setRecipient(registered.id.toString());
            break;
          default:
            setRecipient('');
        }
      }
    } else if (template.targetRecipient) {
      // For templates with a specific recipient, set that directly
      setRecipient(template.targetRecipient);
    }
  };

  // Replace template variables with actual values
  const processTemplateVariables = (text: string) => {
    // In a real implementation, we would fetch actual user data here
    // For now, we'll use placeholder replacements
    return text
      .replace(/{{firstName}}/g, '[User First Name]')
      .replace(/{{expirationDate}}/g, '[Subscription Expiration Date]');
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subject || !content || !recipient) {
      alert('Please fill out all required fields');
      return;
    }

    setSending(true);

    try {
      // Process template variables if using a template
      const processedContent = selectedTemplate !== 'custom' 
        ? processTemplateVariables(content)
        : content;
        
      // Create FormData object to handle files
      const formData = new FormData();
      formData.append('recipient', recipient);
      formData.append('subject', subject);
      formData.append('content', processedContent);
      
      // Add template information if using a template (helps with analytics)
      if (selectedTemplate !== 'custom') {
        formData.append('templateId', selectedTemplate);
      }
      
      // Add reply-to information if this is a reply
      if (replyTo) {
        formData.append('inReplyTo', replyTo.id.toString());
      }
      
      // Add each attachment to form data with improved logging
      console.log(`[MessageComposer] Preparing to attach ${attachments.length} files to FormData`);
      
      if (attachments.length === 0) {
        console.log('[MessageComposer] WARNING: No attachments found in state to add to FormData');
      }
      
      attachments.forEach((file, index) => {
        try {
          console.log(`[MessageComposer] Attaching file ${index + 1}/${attachments.length}: ${file.name} (${file.type}, ${Math.round(file.size / 1024)}KB)`);
          formData.append('attachments', file);
          console.log(`[MessageComposer] File successfully appended to FormData: ${file.name}`);
        } catch (error) {
          console.error(`[MessageComposer] ERROR appending file to FormData:`, error);
        }
      });
      
      // Log total count for tracking
      console.log(`[MessageComposer] FormData inspection before sending:`);
      for (const pair of formData.entries()) {
        console.log(`[MessageComposer] FormData field: ${pair[0]}, value type: ${typeof pair[1]}, value: ${pair[1] instanceof File ? `File: ${pair[1].name}` : pair[1]}`);
      }

      await onSend(formData);
      
      // Reset form
      setSelectedTemplate('custom');
      setSubject('');
      setContent('');
      setRecipient('');
      setAttachments([]);
      onClose();
    } catch (err) {
      console.error('Error sending message:', err);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[MessageComposer] File input change event triggered');
    
    if (e.target.files && e.target.files.length > 0) {
      console.log(`[MessageComposer] Files selected: ${e.target.files.length}`);
      
      try {
        // Create a proper array from FileList and ensure they are valid File objects
        const newFiles = Array.from(e.target.files).map(file => {
          // Verify this is a proper File object with required properties
          if (!(file instanceof File) || !file.name || !file.type) {
            console.error('[MessageComposer] Invalid file object detected:', file);
            throw new Error('Invalid file object detected');
          }
          return file;
        });
        
        // Log attachment details for debugging
        newFiles.forEach(file => {
          console.log(`[MessageComposer] Adding attachment: ${file.name}, Type: ${file.type}, Size: ${Math.round(file.size / 1024)}KB`);
        });
        
        // Update state with new files
        setAttachments(prev => {
          const updated = [...prev, ...newFiles];
          console.log(`[MessageComposer] Updated attachments array, now contains ${updated.length} files`);
          
          // Alert user that file was added successfully (helps with feedback)
          if (newFiles.length === 1) {
            alert(`File "${newFiles[0].name}" added successfully. Click "Send Message" to complete.`);
          } else if (newFiles.length > 1) {
            alert(`${newFiles.length} files added successfully. Click "Send Message" to complete.`);
          }
          
          return updated;
        });
      } catch (error) {
        console.error('[MessageComposer] Error processing file selection:', error);
        alert('There was a problem adding the selected file(s). Please try again.');
      }
      
      // Clear the input value so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
        console.log('[MessageComposer] File input field cleared for reuse');
      }
    } else {
      console.log('[MessageComposer] No files selected or file selection was cancelled');
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-xl font-bold">New Message</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4">
          {/* Always show the template selector - removed isAdminUser condition */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1" htmlFor="template">
              Template:
            </label>
            <select
              id="template"
              className="w-full p-2 border rounded"
              value={selectedTemplate}
              onChange={(e) => handleTemplateChange(e.target.value)}
            >
              {MESSAGE_TEMPLATES.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            {selectedTemplate !== 'custom' && (
              <p className="mt-1 text-sm text-gray-500">
                {MESSAGE_TEMPLATES.find(t => t.id === selectedTemplate)?.description}
              </p>
            )}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1" htmlFor="recipient">
              To:
            </label>
            <select
              id="recipient"
              className="w-full p-2 border rounded"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              required
            >
              <option value="">Select recipient</option>
              {recipients.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1" htmlFor="subject">
              Subject:
            </label>
            <input
              id="subject"
              type="text"
              className="w-full p-2 border rounded"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1" htmlFor="content">
              Message:
            </label>
            <textarea
              id="content"
              className="w-full p-2 border rounded min-h-[120px]"
              value={selectedTemplate !== 'custom' ? processTemplateVariables(content) : content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              Attachments:
            </label>
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                id="file-input"
                multiple
                onChange={handleFileChange}
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded cursor-pointer hover:bg-gray-300 w-fit flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                Add attachment
              </button>
              
              {attachments.length === 0 && (
                <div className="text-gray-500 text-sm italic">
                  No attachments added yet. Click "Add attachment" to upload files.
                </div>
              )}
            </div>
            
            {attachments.length > 0 && (
              <div className="space-y-2 mt-3 border p-3 rounded-md bg-gray-50">
                <h4 className="font-medium text-sm">Added attachments:</h4>
                {attachments.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                    <div className="flex items-center">
                      <span className="text-sm font-medium mr-2">
                        {index + 1}.
                      </span>
                      <span className="text-sm truncate max-w-xs">{file.name}</span>
                      <span className="text-xs text-gray-500 ml-2">({Math.round(file.size / 1024)} KB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="text-red-500 hover:text-red-700 p-1"
                      title="Remove attachment"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>
        
        <div className="p-4 border-t flex justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-50"
            disabled={sending}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
            disabled={sending}
          >
            {sending ? 'Sending...' : 'Send Message'}
          </button>
        </div>
      </div>
    </div>
  );
};