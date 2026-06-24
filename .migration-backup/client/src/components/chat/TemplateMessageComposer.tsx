import React, { useState, useRef } from 'react';
import { MESSAGE_TEMPLATES } from '../../types/message-templates';

interface TemplateMessageComposerProps {
  onCancel: () => void;
  onSend: (formData: FormData) => Promise<void>;
  recipients: Array<{ id: string | number; name: string }>;
}

export const TemplateMessageComposer: React.FC<TemplateMessageComposerProps> = ({
  onCancel,
  onSend,
  recipients
}) => {
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [recipient, setRecipient] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('custom');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle template selection
  const handleTemplateChange = async (templateId: string) => {
    setSelectedTemplate(templateId);
    
    if (templateId === 'custom') {
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
          setRecipient(`template:${template.targetQuery}`);
          
          // Show how many users will receive this message
          alert(`This template will target ${data.users.length} recipients matching the criteria.`);
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
            if (paidUsers) setRecipient(paidUsers.id.toString());
            break;
          case 'badge_holders':
            const badgeHolders = recipients.find(r => r.name === 'Badge Holders');
            if (badgeHolders) setRecipient(badgeHolders.id.toString());
            break;
          case 'new_paid_users':
            const registeredUsers = recipients.find(r => r.name === 'Paid Users');
            if (registeredUsers) setRecipient(registeredUsers.id.toString());
            break;
          default:
            setRecipient('');
        }
      }
    } else if (template.targetRecipient) {
      setRecipient(template.targetRecipient);
    }
  };

  // Replace template variables with actual values
  const processTemplateVariables = (text: string) => {
    return text
      .replace(/{{firstName}}/g, '[User First Name]')
      .replace(/{{expirationDate}}/g, '[Subscription Expiration Date]');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subject || !content || !recipient) {
      alert('Please fill out all required fields');
      return;
    }

    setLoading(true);

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
      
      // Add template information if using a template
      if (selectedTemplate !== 'custom') {
        formData.append('templateId', selectedTemplate);
      }
      
      // Add each attachment to form data
      attachments.forEach(file => {
        formData.append('attachments', file);
      });

      await onSend(formData);
    } catch (err) {
      console.error('Error sending message:', err);
      alert('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setAttachments(prev => [...prev, ...newFiles]);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">New Message</h2>
        <button 
          type="button"
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-500"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <form onSubmit={handleSubmit}>
        {/* Template Selector */}
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

        {/* Recipient field */}
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
        
        {/* Subject field */}
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
        
        {/* Message content */}
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
              Template variables like {{firstName}} will be replaced with actual values when the message is sent.
            </p>
          )}
        </div>
        
        {/* Attachments */}
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
        
        {/* Form actions */}
        <div className="flex justify-end space-x-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded text-sm"
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
      </form>
    </div>
  );
};