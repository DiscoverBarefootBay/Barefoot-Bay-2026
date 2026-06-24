import React, { useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { MediaUploader } from './media-uploader';
import { 
  ArrowLeftRight, 
  Copy, 
  Clipboard, 
  Check, 
  Bold, 
  Italic, 
  Underline, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Heading1, 
  Heading2, 
  Heading3, 
  List, 
  ListOrdered, 
  Quote, 
  Link, 
  Image, 
  Minus,
  Code,
  Palette
} from 'lucide-react';

interface EditorContextData {
  section?: string;
  slug?: string;
}

interface WysiwygEditorProps {
  editorContent: string;
  setEditorContent: (content: string) => void;
  editorContext?: EditorContextData;
}

export default function WysiwygEditor({ 
  editorContent, 
  setEditorContent,
  editorContext
}: WysiwygEditorProps) {
  const [activeTab, setActiveTab] = useState<string>('visual');
  const [rawHtml, setRawHtml] = useState(editorContent);
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const [customColor, setCustomColor] = useState('#000000');
  const [recentColors, setRecentColors] = useState<string[]>(['#FF0000', '#0000FF', '#008000']);
  const editorRef = useRef<HTMLDivElement>(null);
  
  // Initialize editor content on mount and when editorContent changes externally
  useEffect(() => {
    if (editorRef.current) {
      // Only update innerHTML if the current content is different
      // to avoid cursor position resets during normal typing
      if (editorRef.current.innerHTML !== editorContent) {
        let savedCursorInfo = null;
        
        // Try to save the current selection position if it exists
        try {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const cursorPosition = range.startOffset;
            const anchorNode = selection.anchorNode;
            
            if (anchorNode && editorRef.current.contains(anchorNode)) {
              savedCursorInfo = {
                position: cursorPosition,
                node: anchorNode
              };
            }
          }
        } catch (e) {
          console.log('Error when saving selection:', e);
        }

        // Update the content
        editorRef.current.innerHTML = editorContent || '';
        
        // Try to restore cursor position if we have saved info
        if (savedCursorInfo && editorRef.current.contains(savedCursorInfo.node)) {
          try {
            const selection = window.getSelection();
            const newRange = document.createRange();
            const maxPos = savedCursorInfo.node.textContent?.length || 0;
            const safePosition = Math.min(savedCursorInfo.position, maxPos);
            
            newRange.setStart(savedCursorInfo.node, safePosition);
            newRange.collapse(true);
            
            selection?.removeAllRanges();
            selection?.addRange(newRange);
          } catch (e) {
            console.log('Could not restore cursor position after content update:', e);
          }
        }
      }
    }
  }, [editorContent]);
  
  // Update the HTML content when raw HTML changes
  const applyRawHtmlChanges = () => {
    setEditorContent(rawHtml);
    // The useEffect will handle updating the editor with the new content
    setActiveTab('visual'); // Switch back to visual editor
  };
  
  // Sync HTML to editor when editing raw HTML
  const handleRawHtmlChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setRawHtml(e.target.value);
  };
  
  // Update content state when visual editor changes
  const handleEditorInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setEditorContent(html);
      setRawHtml(html);
    }
  };
  
  // Copy raw HTML to clipboard
  const copyHtml = async () => {
    try {
      await navigator.clipboard.writeText(rawHtml);
      setShowCopySuccess(true);
      setTimeout(() => setShowCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy HTML:', error);
    }
  };
  
  // Paste HTML from clipboard
  const pasteHtml = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      setRawHtml(clipboardText);
      setEditorContent(clipboardText);
      // The useEffect will handle updating the editor with the new content
    } catch (error) {
      console.error('Failed to paste HTML:', error);
    }
  };
  
  // Formatting commands
  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value ?? '');
    handleEditorInput(); // Make sure to update state after command
    editorRef.current?.focus(); // Keep focus in the editor
  };
  
  // Add heading
  const addHeading = (level: 1 | 2 | 3) => {
    execCommand('formatBlock', `<h${level}>`);
  };
  
  // Create link
  const createLink = () => {
    const url = prompt('Enter URL:', 'https://');
    if (url) {
      execCommand('createLink', url);
    }
  };
  
  // Insert image
  const insertImage = () => {
    const url = prompt('Enter image URL:', 'https://');
    if (url) {
      execCommand('insertImage', url);
    }
  };
  
  // Insert horizontal rule
  const insertHorizontalRule = () => {
    execCommand('insertHorizontalRule');
  };
  
  // Insert unordered list
  const insertUnorderedList = () => {
    execCommand('insertUnorderedList');
  };
  
  // Insert ordered list
  const insertOrderedList = () => {
    execCommand('insertOrderedList');
  };
  
  // Insert quote
  const formatBlockQuote = () => {
    execCommand('formatBlock', '<blockquote>');
  };
  
  // Check if a string is a valid hex color
  const isValidHexColor = (hex: string): boolean => {
    return /^#([0-9A-F]{3}){1,2}$/i.test(hex);
  };

  // Apply text color - works with both named colors and hex values
  const applyColor = (color: string) => {
    // Use the color directly (could be a named color or a hex value)
    execCommand('foreColor', color);
    
    // Add to recent colors if it's not already there
    if (!recentColors.includes(color)) {
      // Convert named colors to hex
      let hexColor = color;
      if (color === 'red') hexColor = '#FF0000';
      if (color === 'blue') hexColor = '#0000FF';
      if (color === 'green') hexColor = '#008000';
      
      // Add to the beginning and keep only the last 5 colors
      setRecentColors(prev => [hexColor, ...prev.filter(c => c !== hexColor)].slice(0, 5));
    }
    
    // Focus back to editor after color applied
    editorRef.current?.focus();
  };
  
  return (
    <div className="border rounded-md overflow-hidden">
      <Tabs defaultValue="visual" value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between border-b px-3 py-2 bg-gray-50">
          <TabsList>
            <TabsTrigger value="visual">Visual Editor</TabsTrigger>
            <TabsTrigger value="html">HTML</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          
          <div className="flex items-center space-x-2">
            {activeTab === 'html' && (
              <>
                <Button 
                  type="button" 
                  size="sm" 
                  variant="outline" 
                  className="h-8" 
                  onClick={copyHtml}
                >
                  {showCopySuccess ? <Check size={16} className="mr-1" /> : <Copy size={16} className="mr-1" />}
                  {showCopySuccess ? 'Copied!' : 'Copy HTML'}
                </Button>
                <Button 
                  type="button" 
                  size="sm" 
                  variant="outline" 
                  className="h-8" 
                  onClick={pasteHtml}
                >
                  <Clipboard size={16} className="mr-1" /> Paste HTML
                </Button>
              </>
            )}
          </div>
        </div>
        
        <TabsContent value="visual">
          {/* Word-like formatting toolbar */}
          <div className="border-b">
            <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-50">
              {/* Text style buttons */}
              <div className="flex items-center gap-1 pr-2 border-r">
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 w-8 p-0" 
                  title="Bold"
                  onClick={() => execCommand('bold')}
                >
                  <Bold size={16} />
                </Button>
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 w-8 p-0" 
                  title="Italic"
                  onClick={() => execCommand('italic')}
                >
                  <Italic size={16} />
                </Button>
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 w-8 p-0" 
                  title="Underline"
                  onClick={() => execCommand('underline')}
                >
                  <Underline size={16} />
                </Button>
              </div>
              
              {/* Alignment buttons */}
              <div className="flex items-center gap-1 px-2 border-r">
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 w-8 p-0" 
                  title="Align Left"
                  onClick={() => execCommand('justifyLeft')}
                >
                  <AlignLeft size={16} />
                </Button>
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 w-8 p-0" 
                  title="Align Center"
                  onClick={() => execCommand('justifyCenter')}
                >
                  <AlignCenter size={16} />
                </Button>
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 w-8 p-0" 
                  title="Align Right"
                  onClick={() => execCommand('justifyRight')}
                >
                  <AlignRight size={16} />
                </Button>
              </div>
              
              {/* Headings */}
              <div className="flex items-center gap-1 px-2 border-r">
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 px-2" 
                  title="Heading 1"
                  onClick={() => addHeading(1)}
                >
                  <Heading1 size={16} />
                </Button>
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 px-2" 
                  title="Heading 2"
                  onClick={() => addHeading(2)}
                >
                  <Heading2 size={16} />
                </Button>
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 px-2" 
                  title="Heading 3"
                  onClick={() => addHeading(3)}
                >
                  <Heading3 size={16} />
                </Button>
              </div>
              
              {/* Lists */}
              <div className="flex items-center gap-1 px-2 border-r">
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 w-8 p-0" 
                  title="Bulleted List"
                  onClick={insertUnorderedList}
                >
                  <List size={16} />
                </Button>
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 w-8 p-0" 
                  title="Numbered List"
                  onClick={insertOrderedList}
                >
                  <ListOrdered size={16} />
                </Button>
              </div>
              
              {/* Special elements */}
              <div className="flex items-center gap-1 px-2 border-r">
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 w-8 p-0" 
                  title="Link"
                  onClick={createLink}
                >
                  <Link size={16} />
                </Button>
                <MediaUploader 
                  editorContext={editorContext}
                  onMediaInsert={(url, altText, styles, mediaType = 'image') => {
                    // Fix any malformed URLs before inserting them
                    let processedUrl = url;
                    
                    // If URL is in the format /uploads/api/storage-proxy/BUCKET/path - fix it
                    if (url && url.startsWith('/uploads/api/storage-proxy/')) {
                      processedUrl = url.replace('/uploads/api/storage-proxy/', '/api/storage-proxy/');
                      console.log(`[WysiwygEditor] Fixed malformed URL: ${url} → ${processedUrl}`);
                    }
                    
                    // Insert the media (image or video) with styling
                    let mediaHtml = '';
                    
                    // Build the style string from the style object
                    const styleStr = styles ? Object.entries(styles)
                      .map(([key, value]) => {
                        // Skip align as it's handled separately (using class or float)
                        if (key === 'align') return null;
                        // Convert camelCase to kebab-case for CSS
                        const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
                        return `${cssKey}: ${value}`;
                      })
                      .filter(Boolean)
                      .join('; ') : '';
                    
                    // Build alignment styles
                    const alignClass = styles?.align ? `align-${styles.align}` : '';
                    const alignStyle = styles?.align === 'left' ? 'float: left; margin-right: 10px;' : 
                                      (styles?.align === 'right' ? 'float: right; margin-left: 10px;' : 
                                      'display: block; margin-left: auto; margin-right: auto;');
                    
                    if (mediaType === 'video') {
                      // Create video element with controls
                      mediaHtml = `<video src="${processedUrl}" controls style="${styleStr}; ${alignStyle}" class="${alignClass}"></video>`;
                    } else {
                      // Create image element
                      if (styles) {
                        mediaHtml = `<img src="${processedUrl}" alt="${altText || ''}" style="${styleStr}; ${alignStyle}" class="${alignClass}" />`;
                      } else if (altText) {
                        // Just alt text, no styles
                        mediaHtml = `<img src="${processedUrl}" alt="${altText}" />`;
                      } else {
                        // Use execCommand for simple image insertion
                        execCommand('insertImage', processedUrl);
                        handleEditorInput();
                        return;
                      }
                    }
                    
                    // Insert the HTML
                    document.execCommand('insertHTML', false, mediaHtml);
                    handleEditorInput();
                  }}
                />
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 w-8 p-0" 
                  title="Quote"
                  onClick={formatBlockQuote}
                >
                  <Quote size={16} />
                </Button>
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 w-8 p-0" 
                  title="Horizontal Rule"
                  onClick={insertHorizontalRule}
                >
                  <Minus size={16} />
                </Button>
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 w-8 p-0" 
                  title="Code Block"
                  onClick={() => execCommand('formatBlock', '<pre>')}
                >
                  <Code size={16} />
                </Button>
              </div>
              
              {/* Color picker */}
              <div className="flex flex-wrap items-center gap-1 px-2">
                <input 
                  type="color" 
                  value={customColor}
                  onChange={e => setCustomColor(e.target.value)}
                  className="h-8 w-8 cursor-pointer border rounded"
                  title="Select Text Color"
                />
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 px-2 ml-1 flex items-center" 
                  title="Apply Custom Color"
                  onClick={() => applyColor(customColor)}
                  style={{ color: customColor }}
                >
                  <Palette size={14} className="mr-1" />
                  Apply
                </Button>
              </div>
              <div className="flex items-center gap-1 border-l pl-2">
                <span className="text-xs text-gray-500 mr-1">Recent:</span>
                {recentColors.map((color, index) => (
                  <button
                    key={`${color}-${index}`}
                    type="button"
                    className="w-6 h-6 border rounded-full shadow-sm overflow-hidden"
                    style={{ backgroundColor: color }}
                    title={`Use ${color}`}
                    onClick={() => applyColor(color)}
                  />
                ))}
              </div>
            </div>
          </div>
          
          {/* Main content editor */}
          <div className="p-4 bg-white">
            <div 
              ref={editorRef}
              className="max-w-4xl mx-auto bg-white p-6 min-h-[500px] shadow-sm rounded-sm border outline-none prose prose-sm"
              contentEditable={true}
              dir="ltr"
              style={{direction: 'ltr', unicodeBidi: 'embed', textAlign: 'left'}}
              onInput={handleEditorInput}
              onKeyDown={(e) => {
                // Intercept character input and handle it directly to prevent cursor jumping
                const isCharacterKey = e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey;
                
                if (isCharacterKey) {
                  e.preventDefault(); // Prevent default browser behavior
                  
                  // Get current selection
                  const selection = window.getSelection();
                  if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    
                    // Insert the character at cursor position
                    const textNode = document.createTextNode(e.key);
                    range.insertNode(textNode);
                    
                    // Move the cursor after the inserted character
                    range.setStartAfter(textNode);
                    range.setEndAfter(textNode);
                    selection.removeAllRanges();
                    selection.addRange(range);
                    
                    // Update content manually
                    if (editorRef.current) {
                      const html = editorRef.current.innerHTML;
                      setEditorContent(html);
                      setRawHtml(html);
                    }
                  }
                }
              }}
            />
          </div>
        </TabsContent>
        
        <TabsContent value="html">
          <div className="p-4 space-y-4">
            <textarea
              className="w-full h-[300px] font-mono text-sm p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={rawHtml}
              onChange={handleRawHtmlChange}
              placeholder="Edit HTML here..."
            />
            <div className="flex justify-end">
              <Button 
                type="button" 
                onClick={applyRawHtmlChanges}
              >
                <ArrowLeftRight size={16} className="mr-2" /> Apply Changes
              </Button>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="preview">
          <div className="p-4">
            <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: editorContent }} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}