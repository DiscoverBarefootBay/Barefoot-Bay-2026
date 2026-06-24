import React, { useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { MediaUploader } from './media-uploader';
import { YouTubeDialog } from './youtube-dialog';
import { FormInsertDialog } from './form-insert-dialog';
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
  Palette,
  Youtube,
  FileText
} from 'lucide-react';
import { normalizeMediaUrl } from '@/lib/media-cache';
import { generateMediaGallery, type MediaItem } from '@/lib/media-gallery-generator';

/**
 * Clean YouTube iframe allowfullscreen attributes
 * Browsers normalize allowfullscreen to allowfullscreen="" but YouTube rejects the empty string
 * This function fixes it back to just allowfullscreen
 */
const cleanYouTubeEmbeds = (html: string): string => {
  // Replace allowfullscreen="" with allowfullscreen (no value)
  return html.replace(/allowfullscreen=""/g, 'allowfullscreen');
};

interface EditorContextData {
  section?: string;
  slug?: string;
}

interface LocalMediaItem {
  url: string;
  altText?: string;
  mediaType: 'image' | 'video' | 'audio';
}

interface MediaStyles {
  width?: string;
  height?: string;
  align?: 'left' | 'center' | 'right';
  marginTop?: string;
  marginBottom?: string;
  marginLeft?: string;
  marginRight?: string;
}





interface WysiwygEditorProps {
  editorContent: string;
  setEditorContent: (content: string) => void;
  editorContext?: EditorContextData;
  onMediaGalleryInsert?: (mediaItems: MediaItem[], styles?: MediaStyles) => void;
}

/**
 * Forum-specific WYSIWYG editor with specialized handling for forum media
 * This component is based on wysiwyg-editor-direct but includes specific
 * configuration for forum content uploads
 */
export default function WysiwygEditorForum({ 
  editorContent, 
  setEditorContent,
  editorContext = { section: 'forum' }, // Default to forum section
  onMediaGalleryInsert
}: WysiwygEditorProps) {
  const [activeTab, setActiveTab] = useState<string>('visual');
  const [rawHtml, setRawHtml] = useState(editorContent);
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const [customColor, setCustomColor] = useState('#000000');
  const [recentColors, setRecentColors] = useState<string[]>(['#FF0000', '#0000FF', '#008000']);
  const [showVisualEditHint, setShowVisualEditHint] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null); // Changed from HTMLTextAreaElement to HTMLDivElement
  const contentEditableRef = editorRef; // Use same ref for both
  const [savedCursorPosition, setSavedCursorPosition] = useState<{
    startContainer: Node | null;
    startOffset: number;
    endContainer: Node | null;
    endOffset: number;
  } | null>(null);

  // Initialize editor content on mount and when editorContent changes externally
  useEffect(() => {
    // For textareas, we don't need to manually set the value or handle selection 
    // React will handle this correctly through the value prop
    // This effect is kept only for potential future enhancements
  }, [editorContent]);

  // Initialize the contentEditable div with content
  useEffect(() => {
    if (contentEditableRef.current && activeTab === 'visual') {
      // Only set innerHTML when:
      // 1. The element doesn't have focus (prevents cursor reset during typing)
      // 2. The content is actually different (prevents unnecessary updates)
      if (document.activeElement !== contentEditableRef.current && 
          contentEditableRef.current.innerHTML !== editorContent) {
        contentEditableRef.current.innerHTML = editorContent;
      }
    }
  }, [editorContent, activeTab]);

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
    if (contentEditableRef.current) {
      // Get HTML content from contentEditable div and clean YouTube embeds
      const value = cleanYouTubeEmbeds(contentEditableRef.current.innerHTML);

      // Only update state if content actually changed
      if (value !== editorContent) {
        setEditorContent(value);
        setRawHtml(value);
      }
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

  // Selection management utilities
  const saveSelection = (): Range | null => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      return selection.getRangeAt(0).cloneRange();
    }
    return null;
  };

  const restoreSelection = (range: Range): void => {
    const selection = window.getSelection();
    if (selection && range) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  };

  // State to prevent duplicate insertions during processing
  const [isInsertingMedia, setIsInsertingMedia] = useState(false);

  // Save and restore cursor position for media dialog
  const [savedSelection, setSavedSelection] = useState<{
    startContainer: Node;
    startOffset: number;
    endContainer: Node;
    endOffset: number;
  } | null>(null);

  // Save cursor position before opening media dialog
  const saveCurrentSelection = () => {
    if (!contentEditableRef.current) return;

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);

      // Verify the selection is within our editor
      const isInEditor = contentEditableRef.current.contains(range.commonAncestorContainer) ||
                        range.commonAncestorContainer === contentEditableRef.current;

      if (isInEditor) {
        setSavedSelection({
          startContainer: range.startContainer,
          startOffset: range.startOffset,
          endContainer: range.endContainer,
          endOffset: range.endOffset
        });
        console.log('Cursor position saved for media insertion');
      }
    }
  };

  // Restore cursor position after media dialog closes
  const restoreCurrentSelection = (): Range | null => {
    if (!contentEditableRef.current || !savedSelection) return null;

    try {
      const range = document.createRange();
      range.setStart(savedSelection.startContainer, savedSelection.startOffset);
      range.setEnd(savedSelection.endContainer, savedSelection.endOffset);

      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
        console.log('Cursor position restored after media insertion');
        return range;
      }
    } catch (error) {
      console.warn('Could not restore saved selection:', error);
    }

    return null;
  };

  // Enhanced cursor-based media insertion with duplicate prevention
  const insertMediaAtCursorPosition = (mediaHtml: string) => {
    console.log('insertMediaAtCursorPosition called with:', mediaHtml);

    // Prevent duplicate insertions
    if (isInsertingMedia) {
      console.log('Media insertion already in progress, skipping duplicate');
      return;
    }

    if (!contentEditableRef.current) {
      console.log('No contentEditableRef, using state concatenation fallback');
      setEditorContent(editorContent + mediaHtml);
      return;
    }

    setIsInsertingMedia(true);

    // Use a single timeout-based approach to ensure all insertion logic runs in one place
    setTimeout(() => {
      try {
        // First, try to restore the saved cursor position
        let range = restoreCurrentSelection();

        // If no saved position, ensure editor has focus and get current selection
        if (!range) {
          contentEditableRef.current?.focus();

          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            range = selection.getRangeAt(0);

            // Verify we're in the editor
            const isInEditor = contentEditableRef.current?.contains(range.commonAncestorContainer) ||
                              range.commonAncestorContainer === contentEditableRef.current;

            if (!isInEditor) {
              range = null;
            }
          }
        }

        // If still no valid range, create one at the end of content
        if (!range && contentEditableRef.current) {
          console.log('No valid selection, creating one at end of content');
          range = document.createRange();
          const editor = contentEditableRef.current;

          // Simply place at the end of the editor content
          range.selectNodeContents(editor);
          range.collapse(false); // Collapse to end

          const selection = window.getSelection();
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }

        if (range && contentEditableRef.current) {
          console.log('Inserting media at cursor position');

          // Create and insert the fragment
          const fragment = document.createRange().createContextualFragment(mediaHtml);
          range.deleteContents();
          range.insertNode(fragment);

          // Position cursor after inserted content - simplified approach
          try {
            const lastNode = fragment.lastChild;
            if (lastNode) {
              const newRange = document.createRange();
              newRange.setStartAfter(lastNode);
              newRange.collapse(true);

              const selection = window.getSelection();
              if (selection) {
                selection.removeAllRanges();
                selection.addRange(newRange);
              }
            }
          } catch (cursorError) {
            console.warn('Could not position cursor after insertion:', cursorError);
            // Don't fail the entire insertion for cursor positioning issues
          }

          // Update React state with cleaned HTML
          const newHtml = cleanYouTubeEmbeds(contentEditableRef.current.innerHTML);
          setEditorContent(newHtml);
          setRawHtml(newHtml);

          // Clear saved selection since we've used it
          setSavedSelection(null);
          console.log('Media insertion successful');
        } else {
          throw new Error('Could not establish valid range for insertion');
        }

      } catch (error) {
        console.error('Media insertion failed, using fallback:', error);

        // Fallback - append to end but still prevent duplicates
        if (contentEditableRef.current) {
          const currentHtml = contentEditableRef.current.innerHTML;
          const newHtml = cleanYouTubeEmbeds(currentHtml + mediaHtml);
          contentEditableRef.current.innerHTML = newHtml;
          setEditorContent(newHtml);
          setRawHtml(newHtml);
        }
      } finally {
        // Always reset the insertion flag
        setIsInsertingMedia(false);
      }
    }, 50); // Slightly longer delay to ensure focus is properly established
  };

  // Manual formatting fallback for when execCommand fails
  const applyFormatManually = (command: string, value?: string, range?: Range) => {
    if (!range || !contentEditableRef.current) return;

    const selectedText = range.toString();
    let formattedElement: HTMLElement;

    switch(command) {
      case 'bold':
        formattedElement = document.createElement('strong');
        break;
      case 'italic':
        formattedElement = document.createElement('em');
        break;
      case 'underline':
        formattedElement = document.createElement('u');
        break;
      case 'createLink':
        formattedElement = document.createElement('a');
        if (value) {
          (formattedElement as HTMLAnchorElement).href = value;
        }
        break;
      case 'foreColor':
        formattedElement = document.createElement('span');
        if (value) {
          formattedElement.style.color = value;
        }
        break;
      default:
        return;
    }

    if (selectedText) {
      // Replace selected text with formatted version
      formattedElement.textContent = selectedText;
      range.deleteContents();
      range.insertNode(formattedElement);

      // Position cursor after the formatted text
      range.setStartAfter(formattedElement);
      range.setEndAfter(formattedElement);
      restoreSelection(range);
    }

    // Update content
    const newHtml = contentEditableRef.current.innerHTML;
    setEditorContent(newHtml);
    setRawHtml(newHtml);
  };

  // Formatting commands with proper selection preservation
  const execCommand = (command: string, value?: string) => {
    console.log(`Executing command: ${command}, active element:`, document.activeElement);
    console.log(`Selection:`, window.getSelection()?.toString());

    // Ensure contentEditable has focus
    if (contentEditableRef.current) {
      contentEditableRef.current.focus();

      // Save current selection
      const savedRange = saveSelection();

      if (savedRange) {
        // Restore selection before applying format
        restoreSelection(savedRange);

        try {
          // Use execCommand for basic formatting
          const success = document.execCommand(command, false, value);

          if (!success) {
            // Fallback to manual formatting
            applyFormatManually(command, value, savedRange);
          } else {
            // Update content after successful formatting
            const newHtml = contentEditableRef.current.innerHTML;
            setEditorContent(newHtml);
            setRawHtml(newHtml);
          }

        } catch (error) {
          console.error(`execCommand failed for ${command}:`, error);
          // Fallback to manual formatting
          applyFormatManually(command, value, savedRange);
        }
      }
    }
  };

  // Add heading
  const addHeading = (level: 1 | 2 | 3) => {
    execCommand('formatBlock', `<h${level}>`);
  };

  // Create link with automatic blue color and underline styling
  const createLink = () => {
    const url = prompt('Enter URL:', 'https://');
    if (url) {
      // Save the current selection
      const savedRange = saveSelection();
      
      // Create the link using execCommand
      execCommand('createLink', url);
      
      // After creating the link, automatically style it with blue color and underline
      setTimeout(() => {
        if (contentEditableRef.current) {
          // Find all anchor tags in the editor
          const links = contentEditableRef.current.querySelectorAll('a[href]');
          
          // Style all links that don't already have explicit styling
          links.forEach((element) => {
            const link = element as HTMLAnchorElement;
            // Only apply styling if the link doesn't already have color or text-decoration styles
            const hasColorStyle = link.style.color || link.getAttribute('style')?.includes('color');
            const hasTextDecorationStyle = link.style.textDecoration || link.getAttribute('style')?.includes('text-decoration');
            
            if (!hasColorStyle || !hasTextDecorationStyle) {
              // Apply blue color and underline
              link.style.color = '#0066cc'; // Standard link blue
              link.style.textDecoration = 'underline';
            }
          });
          
          // Update the editor content to reflect the styling changes
          const newHtml = contentEditableRef.current.innerHTML;
          setEditorContent(newHtml);
          setRawHtml(newHtml);
        }
      }, 100); // Small delay to ensure the link is created first
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

    // Close the color picker
    setShowColorPicker(false);

    // Focus back to editor after color applied
    editorRef.current?.focus();
  };

  return (
    <div className="border rounded-md overflow-hidden">
      <Tabs defaultValue="visual" value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between border-b px-3 py-2 bg-gray-50">
          <TabsList>
            <TabsTrigger value="visual">Visual Editor</TabsTrigger>
            <TabsTrigger value="html">HTML Source</TabsTrigger>
            <TabsTrigger value="preview">Preview Mode</TabsTrigger>
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
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (contentEditableRef.current) {
                      contentEditableRef.current.focus();
                    }
                    execCommand('bold');
                  }}
                >
                  <Bold size={16} />
                </Button>
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 w-8 p-0" 
                  title="Italic"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (contentEditableRef.current) {
                      contentEditableRef.current.focus();
                    }
                    execCommand('italic');
                  }}
                >
                  <Italic size={16} />
                </Button>
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 w-8 p-0" 
                  title="Underline"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (contentEditableRef.current) {
                      contentEditableRef.current.focus();
                    }
                    execCommand('underline');
                  }}
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
                  editorContext={{ section: 'forum' }}  // Force forum context for all uploads
                  onBeforeOpen={saveCurrentSelection}
                  onAfterClose={() => {
                    // Focus the editor after dialog closes to enable proper cursor restoration
                    setTimeout(() => {
                      if (contentEditableRef.current) {
                        contentEditableRef.current.focus();
                      }
                    }, 100);
                  }}
                  onMediaGalleryInsert={(mediaItems, styles) => {
                    console.log(`[WysiwygEditor] Gallery insertion callback triggered!`, {
                      mediaItems: mediaItems.length,
                      items: mediaItems,
                      styles,
                      hasParentCallback: !!onMediaGalleryInsert
                    });

                    if (onMediaGalleryInsert) {
                      console.log(`[WysiwygEditor] Delegating to parent gallery callback`);
                      onMediaGalleryInsert(mediaItems, styles);
                      return;
                    }

                    console.log(`[WysiwygEditor] Inserting gallery with ${mediaItems.length} items`);

                    // Generate gallery HTML using the standardized function
                    const galleryHtml = generateMediaGallery(mediaItems);
                    console.log(`[WysiwygEditor] Generated gallery HTML:`, galleryHtml);

                    // Insert at cursor position
                    insertMediaAtCursorPosition(galleryHtml);
                  }}
                  onMediaInsert={(url, altText, styles, mediaType = 'image') => {
                    // Fix any malformed URLs before inserting them
                    let processedUrl = url;

                    // If URL is in the format /uploads/api/storage-proxy/BUCKET/path - fix it
                    if (url && url.startsWith('/uploads/api/storage-proxy/')) {
                      processedUrl = url.replace('/uploads/api/storage-proxy/', '/api/storage-proxy/');
                      console.log(`[WysiwygEditor] Fixed malformed URL: ${url} → ${processedUrl}`);
                    }

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

                    // Create the HTML for insertion
                    let mediaHtml = '';

                    if (mediaType === 'video') {
                      // Create video element with controls
                      mediaHtml = `<video src="${processedUrl}" controls style="${styleStr}; ${alignStyle}" class="${alignClass}"></video>`;
                    } else if (mediaType === 'audio') {
                      mediaHtml = `<audio src="${processedUrl}" controls style="${styleStr}; ${alignStyle}" class="${alignClass}"></audio>`;
                    } else {
                      // Create image element
                      if (styles) {
                        mediaHtml = `<img src="${processedUrl}" alt="${altText || ''}" style="${styleStr}; ${alignStyle}" class="${alignClass}" />`;
                      } else {
                        // Simple image with alt text
                        mediaHtml = `<img src="${processedUrl}" alt="${altText || 'Image'}" />`;
                      }
                    }

                    // NEW: Enhanced cursor-based insertion
                    insertMediaAtCursorPosition(mediaHtml);
                  }}
                />
                <YouTubeDialog
                  onBeforeOpen={saveCurrentSelection}
                  onInsert={(embedHtml) => {
                    // Insert the YouTube embed HTML at cursor position
                    insertMediaAtCursorPosition(embedHtml);
                    
                    // Focus the editor after insertion
                    setTimeout(() => {
                      if (contentEditableRef.current) {
                        contentEditableRef.current.focus();
                      }
                    }, 100);
                  }}
                />
                <FormInsertDialog
                  onBeforeOpen={saveCurrentSelection}
                  onAfterClose={() => {
                    // Focus the editor after dialog closes to enable proper cursor restoration
                    setTimeout(() => {
                      if (contentEditableRef.current) {
                        contentEditableRef.current.focus();
                      }
                    }, 100);
                  }}
                  insertAtCursor={(formHtml) => {
                    // Insert the form HTML at cursor position using the preferred method
                    insertMediaAtCursorPosition(formHtml);
                    
                    // Focus the editor after insertion
                    setTimeout(() => {
                      if (contentEditableRef.current) {
                        contentEditableRef.current.focus();
                      }
                    }, 100);
                  }}
                >
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="ghost" 
                    className="h-8 w-8 p-0" 
                    title="Insert Form"
                  >
                    <FileText size={16} />
                  </Button>
                </FormInsertDialog>
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
              </div>

              {/* Color picker */}
              <div className="flex items-center gap-1 px-2">
                <div className="relative">
                  {/* Color dropdown */}
                  <div>
                    <Button 
                      type="button" 
                      size="sm" 
                      variant="ghost" 
                      className="h-8 w-8 p-0 relative" 
                      title="Text Color"
                      onClick={() => setShowColorPicker(!showColorPicker)}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <Palette size={16} />
                      <div className="absolute w-5 h-1 rounded-sm bottom-1 left-1/2 transform -translate-x-1/2" style={{ backgroundColor: customColor }}></div>
                    </Button>

                    {/* Color dropdown panel */}
                    <div className={`${showColorPicker ? 'block' : 'hidden'} absolute z-50 mt-1 p-2 bg-white border rounded-md shadow-lg`}>
                      <div className="grid grid-cols-5 gap-1 mb-2">
                        {/* Preset colors */}
                        {['red', 'blue', 'green', 'orange', 'purple', 'black', 'gray', 'white', 'pink', 'cyan'].map((color) => (
                          <button
                            key={color}
                            type="button"
                            className="w-6 h-6 rounded-md border hover:scale-110 transition-transform"
                            style={{ backgroundColor: color }}
                            onClick={() => applyColor(color)}
                            title={color}
                          />
                        ))}
                      </div>

                      {/* Recent colors */}
                      {recentColors.length > 0 && (
                        <div className="mb-2">
                          <div className="text-xs text-gray-500 mb-1">Recent:</div>
                          <div className="flex gap-1">
                            {recentColors.map((color) => (
                              <button
                                key={color}
                                type="button"
                                className="w-6 h-6 rounded-md border hover:scale-110 transition-transform"
                                style={{ backgroundColor: color }}
                                onClick={() => applyColor(color)}
                                title={color}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Custom color picker */}
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={customColor}
                          onChange={(e) => setCustomColor(e.target.value)}
                          className="w-6 h-6"
                        />
                        <input
                          type="text"
                          value={customColor}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val.startsWith('#') && val.length <= 7) {
                              setCustomColor(val);
                            }
                          }}
                          className="w-16 h-6 text-xs border rounded"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs px-2"
                          onClick={() => isValidHexColor(customColor) && applyColor(customColor)}
                          disabled={!isValidHexColor(customColor)}
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced editor interface with side-by-side editing and preview */}
          <div className="wysiwyg-container relative">
            <div className="border-b p-2 bg-gray-50 text-xs flex justify-between items-center">
              <span className="font-medium text-blue-600">WYSIWYG Editor</span>
              <span className="text-gray-500">HTML formatting is applied automatically</span>
            </div>

            <div className="w-full">
              {/* Full-width Live Preview */}
              <div>
                <div className="p-2 bg-gray-100 text-xs text-gray-600 font-medium border-b flex justify-between">
                  <span>Visual Editor</span>
                  <span className="text-blue-500 text-[10px]">✏️ What You See Is What You Get</span>
                </div>
                <div 
                  ref={contentEditableRef}
                  className="min-h-[400px] p-4 bg-white overflow-auto prose prose-sm max-w-none border-2 border-transparent hover:border-blue-100 focus:border-blue-200 rounded"
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  // We won't use dangerouslySetInnerHTML here to prevent React from controlling the content
                  // This lets the browser handle cursor position naturally
                  onInput={(e) => {
                    const newHtml = (e.target as HTMLDivElement).innerHTML;
                    // Only update content, don't manipulate hidden textarea
                    setEditorContent(newHtml);
                    setRawHtml(newHtml);
                  }}
                  onBlur={(e) => {
                    // On blur, we can safely update all state as the cursor position
                    // no longer matters when the element loses focus
                    const newHtml = (e.target as HTMLDivElement).innerHTML;
                    setEditorContent(newHtml);
                    setRawHtml(newHtml);
                  }}
                  onFocus={(e) => {
                    // When user focuses on the preview panel, add a visual indicator
                    const target = e.target as HTMLDivElement;
                    target.classList.add('border-blue-200');

                    // Update the contentEditable div with the latest content if needed
                    if (contentEditableRef.current && 
                        contentEditableRef.current.innerHTML !== editorContent) {
                      contentEditableRef.current.innerHTML = editorContent;
                    }
                  }}
                />
              </div>


            </div>
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