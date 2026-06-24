import React, { useState, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MediaUploader } from './media-uploader';
import { 
  ArrowLeftRight, 
  Copy, 
  Clipboard, 
  Check,
  Bold, 
  Italic, 
  Underline, 
  Link, 
  Image
} from 'lucide-react';

interface EditorContextData {
  section?: string;
  slug?: string;
}

interface WysiwygEditorTextProps {
  editorContent: string;
  setEditorContent: (content: string) => void;
  editorContext?: EditorContextData;
}

/**
 * Simplified text editor with basic formatting options
 * Uses a textarea instead of contentEditable div to avoid cursor issues
 */
export default function WysiwygEditorText({ 
  editorContent, 
  setEditorContent,
  editorContext = { section: 'forum' } // Default to forum section
}: WysiwygEditorTextProps) {
  const [activeTab, setActiveTab] = useState<string>('editor');
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Handle text insertion at cursor position
  const insertAtCursor = (textToInsert: string) => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    
    // Combine the text before cursor, the insertion, and the text after cursor
    const newContent = 
      editorContent.substring(0, startPos) + 
      textToInsert + 
      editorContent.substring(endPos);
    
    // Update the content state
    setEditorContent(newContent);
    
    // Set cursor position after the inserted text
    // We need to do this after React updates the DOM
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = startPos + textToInsert.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };
  
  // Text formatting commands
  const formatText = (tag: string) => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const selectedText = editorContent.substring(startPos, endPos);
    
    // Different behavior based on tag
    let formattedText = '';
    let cursorOffset = 0;
    
    switch (tag) {
      case 'b':
        formattedText = `<b>${selectedText}</b>`;
        cursorOffset = selectedText ? 0 : 3; // If text selected, place cursor after tag, else inside tag
        break;
      case 'i':
        formattedText = `<i>${selectedText}</i>`;
        cursorOffset = selectedText ? 0 : 3;
        break;
      case 'u':
        formattedText = `<u>${selectedText}</u>`;
        cursorOffset = selectedText ? 0 : 3;
        break;
      case 'a':
        const url = prompt('Enter URL:', 'https://');
        if (!url) return; // User cancelled
        formattedText = `<a href="${url}">${selectedText || url}</a>`;
        cursorOffset = selectedText ? 0 : 4;
        break;
      default:
        return;
    }
    
    // Insert the formatted text
    const newContent = 
      editorContent.substring(0, startPos) + 
      formattedText + 
      editorContent.substring(endPos);
    
    // Update the content state
    setEditorContent(newContent);
    
    // Set cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = selectedText 
          ? startPos + formattedText.length // After the closing tag if text was selected
          : startPos + formattedText.length - cursorOffset; // Inside the tag if no text was selected
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  // Copy content to clipboard
  const copyContent = async () => {
    try {
      await navigator.clipboard.writeText(editorContent);
      setShowCopySuccess(true);
      setTimeout(() => setShowCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };
  
  // Paste content from clipboard
  const pasteContent = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      setEditorContent(clipboardText);
    } catch (error) {
      console.error('Failed to paste:', error);
    }
  };
  
  return (
    <div className="border rounded-md overflow-hidden">
      <Tabs defaultValue="editor" value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between border-b px-3 py-2 bg-gray-50">
          <TabsList>
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          
          <div className="flex items-center space-x-2">
            <Button 
              type="button" 
              size="sm" 
              variant="outline" 
              className="h-8" 
              onClick={copyContent}
            >
              {showCopySuccess ? <Check size={16} className="mr-1" /> : <Copy size={16} className="mr-1" />}
              {showCopySuccess ? 'Copied!' : 'Copy'}
            </Button>
            <Button 
              type="button" 
              size="sm" 
              variant="outline" 
              className="h-8" 
              onClick={pasteContent}
            >
              <Clipboard size={16} className="mr-1" /> Paste
            </Button>
          </div>
        </div>
        
        <TabsContent value="editor" className="p-0">
          <div className="border-b bg-gray-50 p-2 flex flex-wrap gap-1">
            <Button 
              type="button" 
              size="sm" 
              variant="ghost" 
              className="h-8 w-8 p-0" 
              title="Bold"
              onClick={() => formatText('b')}
            >
              <Bold size={16} />
            </Button>
            <Button 
              type="button" 
              size="sm" 
              variant="ghost" 
              className="h-8 w-8 p-0" 
              title="Italic"
              onClick={() => formatText('i')}
            >
              <Italic size={16} />
            </Button>
            <Button 
              type="button" 
              size="sm" 
              variant="ghost" 
              className="h-8 w-8 p-0" 
              title="Underline"
              onClick={() => formatText('u')}
            >
              <Underline size={16} />
            </Button>
            <Button 
              type="button" 
              size="sm" 
              variant="ghost" 
              className="h-8 w-8 p-0" 
              title="Link"
              onClick={() => formatText('a')}
            >
              <Link size={16} />
            </Button>
            <div className="flex-1"></div>
            <MediaUploader 
              editorContext={editorContext}
              onMediaInsert={(url, altText, styles, mediaType = 'image') => {
                // Create the HTML for the media
                let mediaHtml = '';
                const styleAttr = styles 
                  ? `style="width:${styles.width || '100%'};${styles.align ? `display:block;margin-left:${styles.align === 'center' || styles.align === 'right' ? 'auto' : '0'};margin-right:${styles.align === 'center' || styles.align === 'left' ? 'auto' : '0'};` : ''}"` 
                  : '';
                
                if (mediaType === 'video') {
                  mediaHtml = `<video src="${url}" controls ${styleAttr}></video>`;
                } else {
                  mediaHtml = `<img src="${url}" alt="${altText || 'Image'}" ${styleAttr}>`;
                }
                
                // Insert at cursor position
                insertAtCursor(mediaHtml);
              }}
            />
          </div>
          
          <Textarea
            ref={textareaRef}
            value={editorContent}
            onChange={(e) => setEditorContent(e.target.value)}
            className="min-h-[400px] border-0 focus:ring-0 rounded-none resize-y"
            placeholder="Write your content here..."
          />
        </TabsContent>
        
        <TabsContent value="preview" className="p-4">
          <div 
            className="prose max-w-none" 
            dangerouslySetInnerHTML={{ __html: editorContent }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}