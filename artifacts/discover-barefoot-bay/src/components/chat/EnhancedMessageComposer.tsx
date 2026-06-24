import React, { useState, useRef, useEffect } from 'react';
import { MESSAGE_TEMPLATES } from '../../types/message-templates';
import { useAuth } from '../../hooks/use-auth';

interface EnhancedMessageComposerProps {
  recipients: Array<{ id: string | number; name: string }>;
  onSend: (formData: FormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export const EnhancedMessageComposer: React.FC<EnhancedMessageComposerProps> = ({
  recipients,
  onSend,
  onCancel,
  loading = false
}) => {
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [recipient, setRecipient] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('custom');
  const [sendEmail, setSendEmail] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get user authentication info to determine admin status
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // State to track the targeted users info
  const [targetedUsers, setTargetedUsers] = useState<{ count: number, sample: string[] }>({ count: 0, sample: [] });
  
  // Handle template selection
  const handleTemplateChange = async (templateId: string) => {
    setSelectedTemplate(templateId);
    
    // Reset targeted users when changing templates
    setTargetedUsers({ count: 0, sample: [] });
    
    if (templateId === 'custom') {
      // Reset form for custom template
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
        const response = await fetch(`/api/message-templates/target-users/${template.targetQuery}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch target recipients: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.users && data.users.length > 0) {
          // Create a special recipient marker for this dynamic template
          setRecipient(`template:${template.targetQuery}`);
          
          // Store information about targeted users
          const userSample = data.users
            .slice(0, 5)
            .map((user: any) => user.fullName || user.username || 'Unknown User');
          
          setTargetedUsers({
            count: data.users.length,
            sample: userSample
          });
        } else {
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
            if (paidUsers) setRecipient(String(paidUsers.id));
            break;
          case 'badge_holders':
            const badgeHolders = recipients.find(r => r.name === 'Badge Holders');
            if (badgeHolders) setRecipient(String(badgeHolders.id));
            break;
          case 'new_paid_users':
            const registeredUsers = recipients.find(r => r.name === 'Paid Users');
            if (registeredUsers) setRecipient(String(registeredUsers.id));
            break;
          default:
            setRecipient('');
        }
      }
    } else if (template.targetRecipient) {
      setRecipient(template.targetRecipient);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subject || !content || !recipient) {
      alert('Please fill out all required fields');
      return;
    }
    
    try {
      // Create FormData object
      const formData = new FormData();
      formData.append('recipient', recipient);
      formData.append('subject', subject);
      formData.append('content', content);
      
      // Add template information if using a template
      if (selectedTemplate !== 'custom') {
        formData.append('templateId', selectedTemplate);
      }
      
      // Add sendEmail flag
      formData.append('sendEmail', sendEmail.toString());
      
      // Add attachments
      for (const file of attachments) {
        formData.append('attachments', file);
      }
      
      // Submit the form
      await onSend(formData);
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  // Handle file selection with enhanced error handling and feedback
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[EnhancedMessageComposer] File input change detected');
    
    if (e.target.files && e.target.files.length > 0) {
      try {
        console.log(`[EnhancedMessageComposer] Processing ${e.target.files.length} selected files`);
        
        // Create a proper array from FileList
        const newFiles = Array.from(e.target.files).map(file => {
          console.log(`[EnhancedMessageComposer] Processing file: ${file.name} (${file.type}, ${Math.round(file.size / 1024)}KB)`);
          return file;
        });
        
        // Update attachments state with new files
        setAttachments(prev => {
          const updated = [...prev, ...newFiles];
          console.log(`[EnhancedMessageComposer] Updated attachments array, now contains ${updated.length} files`);
          return updated;
        });
        
        // Show feedback to the user
        if (newFiles.length === 1) {
          alert(`File "${newFiles[0].name}" added successfully. Click "Send Message" to complete.`);
        } else if (newFiles.length > 1) {
          alert(`${newFiles.length} files added successfully. Click "Send Message" to complete.`);
        }
      } catch (error) {
        console.error('[EnhancedMessageComposer] Error processing file selection:', error);
        alert('There was a problem adding the selected file(s). Please try again.');
      }
      
      // Reset file input to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } else {
      console.log('[EnhancedMessageComposer] No files selected or file selection canceled');
    }
  };

  // Remove an attachment
  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-lg sm:rounded-lg shadow-xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col">
        <div className="p-4 border-b flex-shrink-0">
          <h2 className="text-xl font-bold">New Message</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4">
          {/* Template selector - only show for admin users */}
          {isAdmin && (
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
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1" htmlFor="recipient">
              To:
            </label>
            
            {/* Show targeted users info when applicable */}
            {targetedUsers.count > 0 && selectedTemplate !== 'custom' && (
              <div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm font-medium mb-1 text-blue-700">
                  <span className="font-bold">{targetedUsers.count}</span> users will receive this message
                </p>
                {targetedUsers.sample.length > 0 && (
                  <div className="text-xs text-blue-600">
                    <p className="mb-1">Including:</p>
                    <ul className="list-disc pl-5">
                      {targetedUsers.sample.map((user, index) => (
                        <li key={index}>{user}</li>
                      ))}
                    </ul>
                    {targetedUsers.count > targetedUsers.sample.length && (
                      <p className="mt-1 italic">...and {targetedUsers.count - targetedUsers.sample.length} more</p>
                    )}
                  </div>
                )}
              </div>
            )}
            
            <select
              id="recipient"
              className="w-full p-2 border rounded"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              required
              disabled={targetedUsers.count > 0}
            >
              <option value="">Select recipient</option>
              {/* Add "Admins" option for non-admin users */}
              {!isAdmin && (
                <option value="admins">Admins</option>
              )}
              {recipients.map((r) => (
                <option key={String(r.id)} value={String(r.id)}>
                  {r.name}
                </option>
              ))}
            </select>
            
            {targetedUsers.count > 0 && (
              <p className="mt-1 text-xs text-gray-500">
                Recipients are automatically selected based on the template criteria.
              </p>
            )}
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
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
            {selectedTemplate !== 'custom' && (
              <p className="mt-1 text-xs text-gray-500">
                Template variables like {'{{firstName}}'} will be replaced with actual values when the message is sent.
              </p>
            )}
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              Attachments:
            </label>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              id="file-input"
              multiple
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 border border-gray-300 rounded text-sm"
            >
              Add attachment
            </button>
            
            {attachments.length > 0 && (
              <div className="mt-2 space-y-2">
                {attachments.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm truncate max-w-xs">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          </div>
          
          <div className="flex-shrink-0 border-t p-4 bg-white">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              {isAdmin && (
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="send-email"
                    checked={sendEmail}
                    onChange={(e) => setSendEmail(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="send-email" className="ml-2 text-sm font-medium text-gray-700">
                    Send Email
                  </label>
                </div>
              )}
              
              <div className="flex space-x-3 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 border border-gray-300 rounded text-sm"
                  disabled={loading}
                >
                  Cancel
                </button>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};