import React, { useState, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ContentBlock, 
  BlockType, 
  ContentBlockComponent, 
  BlockTypeMenu 
} from './content-blocks';
import { Button } from '@/components/ui/button';
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
  Minus 
} from 'lucide-react';

// Generate a unique ID for blocks
const generateId = () => `block-${Math.random().toString(36).substring(2, 9)}`;

// Parse HTML content to blocks
const parseHtmlToBlocks = (htmlContent: string): ContentBlock[] => {
  // If empty or invalid, return a default paragraph block
  if (!htmlContent || htmlContent.trim() === '') {
    return [{
      id: generateId(),
      type: 'paragraph',
      content: '',
    }];
  }
  
  try {
    // Create a temporary div to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    const blocks: ContentBlock[] = [];
    
    // Process child nodes
    Array.from(tempDiv.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        // If it's just text, create a paragraph
        if (node.textContent?.trim()) {
          blocks.push({
            id: generateId(),
            type: 'paragraph',
            content: node.textContent,
          });
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        let block: ContentBlock | null = null;
        
        // Get inline styles
        const inlineStyles: ContentBlock['styles'] = {};
        const align = element.style.textAlign as any;
        
        // Check for text color
        if (element.style.color) {
          // Simplify colors to basic names if possible
          const color = element.style.color;
          if (color.includes('rgb(255, 0, 0)') || color === 'red') {
            inlineStyles.color = 'red';
          } else if (color.includes('rgb(0, 0, 255)') || color === 'blue') {
            inlineStyles.color = 'blue';
          } else if (color.includes('rgb(0, 128, 0)') || color === 'green') {
            inlineStyles.color = 'green';
          } else {
            inlineStyles.color = color;
          }
        }
        
        // Create block based on element tag
        switch (element.tagName.toLowerCase()) {
          case 'h1':
            block = {
              id: generateId(),
              type: 'heading1',
              content: element.textContent || '',
              align,
              styles: inlineStyles,
            };
            break;
            
          case 'h2':
            block = {
              id: generateId(),
              type: 'heading2',
              content: element.textContent || '',
              align,
              styles: inlineStyles,
            };
            break;
            
          case 'h3':
            block = {
              id: generateId(),
              type: 'heading3',
              content: element.textContent || '',
              align,
              styles: inlineStyles,
            };
            break;
            
          case 'p':
            // Check for nested formatting
            inlineStyles.bold = !!element.querySelector('strong, b');
            inlineStyles.italic = !!element.querySelector('em, i');
            inlineStyles.underline = !!element.querySelector('u');
            
            block = {
              id: generateId(),
              type: 'paragraph',
              content: element.textContent || '',
              align,
              styles: inlineStyles,
            };
            break;
            
          case 'blockquote':
            block = {
              id: generateId(),
              type: 'quote',
              content: element.textContent || '',
              align,
              styles: inlineStyles,
            };
            break;
            
          case 'ul':
            block = {
              id: generateId(),
              type: 'bulletList',
              content: Array.from(element.querySelectorAll('li'))
                .map(li => li.textContent)
                .filter(Boolean)
                .join('\n'),
              align,
            };
            break;
            
          case 'ol':
            block = {
              id: generateId(),
              type: 'numberedList',
              content: Array.from(element.querySelectorAll('li'))
                .map(li => li.textContent)
                .filter(Boolean)
                .join('\n'),
              align,
            };
            break;
            
          case 'img':
            block = {
              id: generateId(),
              type: 'image',
              content: '',
              metadata: {
                src: element.getAttribute('src') || '',
                alt: element.getAttribute('alt') || '',
              },
            };
            break;
            
          case 'a':
            block = {
              id: generateId(),
              type: 'link',
              content: '',
              metadata: {
                href: element.getAttribute('href') || '',
                linkText: element.textContent || '',
              },
            };
            break;
            
          case 'hr':
            block = {
              id: generateId(),
              type: 'divider',
              content: '',
            };
            break;
            
          case 'div':
            // Check if it's a container with alignment
            if (element.style.textAlign) {
              // For a div with just text content, create a paragraph
              if (element.children.length === 0) {
                block = {
                  id: generateId(),
                  type: 'paragraph',
                  content: element.textContent || '',
                  align: element.style.textAlign as any,
                  styles: inlineStyles,
                };
              } 
              // Otherwise, recursively parse its children
              else {
                // Process inner content recursively
                Array.from(element.childNodes).forEach((childNode) => {
                  if (childNode.nodeType === Node.ELEMENT_NODE) {
                    const innerBlocks = parseHtmlToBlocks((childNode as HTMLElement).outerHTML);
                    innerBlocks.forEach(innerBlock => {
                      innerBlock.align = element.style.textAlign as any;
                      blocks.push(innerBlock);
                    });
                  } else if (childNode.nodeType === Node.TEXT_NODE && childNode.textContent?.trim()) {
                    blocks.push({
                      id: generateId(),
                      type: 'paragraph',
                      content: childNode.textContent,
                      align: element.style.textAlign as any,
                    });
                  }
                });
                
                // Skip adding this div as a block since we processed its children
                block = null;
              }
            } 
            // Process div with background color as regular paragraph
            else if (element.style.backgroundColor) {
              block = {
                id: generateId(),
                type: 'paragraph',
                content: element.textContent || '',
                styles: {
                  ...inlineStyles,
                  // We don't currently support background color in our model,
                  // but we can add it if needed in the future
                },
              };
            }
            // Process other divs if they have text content but no special styling
            else if (element.children.length === 0 && element.textContent?.trim()) {
              block = {
                id: generateId(),
                type: 'paragraph',
                content: element.textContent,
              };
            }
            // For complex divs, recursively process children
            else if (element.children.length > 0) {
              Array.from(element.childNodes).forEach((childNode) => {
                if (childNode.nodeType === Node.ELEMENT_NODE) {
                  const innerBlocks = parseHtmlToBlocks((childNode as HTMLElement).outerHTML);
                  blocks.push(...innerBlocks);
                } else if (childNode.nodeType === Node.TEXT_NODE && childNode.textContent?.trim()) {
                  blocks.push({
                    id: generateId(),
                    type: 'paragraph',
                    content: childNode.textContent,
                  });
                }
              });
            }
            break;
            
          default:
            // For unsupported elements, try to create a paragraph
            if (element.textContent?.trim()) {
              block = {
                id: generateId(),
                type: 'paragraph',
                content: element.textContent,
              };
            }
        }
        
        if (block) {
          blocks.push(block);
        }
      }
    });
    
    // If no blocks were created, return a default paragraph
    if (blocks.length === 0) {
      return [{
        id: generateId(),
        type: 'paragraph',
        content: htmlContent.trim(),
      }];
    }
    
    return blocks;
  } catch (error) {
    console.error('Error parsing HTML:', error);
    // Fallback: create a simple paragraph with the raw content
    return [{
      id: generateId(),
      type: 'paragraph',
      content: htmlContent,
    }];
  }
};

// Function to convert block to HTML
const blockToHtml = (block: ContentBlock): string => {
  switch (block.type) {
    case 'heading1':
      return `<h1${block.align ? ` style="text-align: ${block.align};"` : ''}>${block.content}</h1>`;
    case 'heading2':
      return `<h2${block.align ? ` style="text-align: ${block.align};"` : ''}>${block.content}</h2>`;
    case 'heading3':
      return `<h3${block.align ? ` style="text-align: ${block.align};"` : ''}>${block.content}</h3>`;
    case 'paragraph':
      let content = block.content;
      // Apply text formatting if specified
      if (block.styles) {
        if (block.styles.bold) content = `<strong>${content}</strong>`;
        if (block.styles.italic) content = `<em>${content}</em>`;
        if (block.styles.underline) content = `<u>${content}</u>`;
        if (block.styles.color) content = `<span style="color: ${block.styles.color};">${content}</span>`;
      }
      return `<p${block.align ? ` style="text-align: ${block.align};"` : ''}>${content}</p>`;
    case 'quote':
      return `<blockquote${block.align ? ` style="text-align: ${block.align};"` : ''}>${block.content}</blockquote>`;
    case 'bulletList':
      return `<ul>\n  ${block.content.split('\n').map(item => `<li>${item}</li>`).join('\n  ')}\n</ul>`;
    case 'numberedList':
      return `<ol>\n  ${block.content.split('\n').map(item => `<li>${item}</li>`).join('\n  ')}\n</ol>`;
    case 'image':
      if (block.metadata?.src) {
        return `<img src="${block.metadata.src}" alt="${block.metadata.alt || ''}" />`;
      }
      return '';
    case 'link':
      if (block.metadata?.href) {
        return `<a href="${block.metadata.href}">${block.metadata.linkText || block.metadata.href}</a>`;
      }
      return '';
    case 'divider':
      return '<hr />';
    default:
      return '';
  }
};

// Convert blocks to HTML
const blocksToHtml = (blocks: ContentBlock[]): string => {
  return blocks.map(block => blockToHtml(block)).join('\n');
};

interface WysiwygEditorProps {
  editorContent: string;
  setEditorContent: (content: string) => void;
}

export default function WysiwygEditor({ 
  editorContent, 
  setEditorContent 
}: WysiwygEditorProps) {
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [activeTab, setActiveTab] = useState<string>('visual');
  const [rawHtml, setRawHtml] = useState(editorContent);
  const [rawMode, setRawMode] = useState(false);
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  
  // Initialize blocks from HTML on mount
  useEffect(() => {
    if (editorContent) {
      const parsedBlocks = parseHtmlToBlocks(editorContent);
      setBlocks(parsedBlocks);
      setRawHtml(editorContent);
    } else {
      // Start with a blank paragraph if no content
      setBlocks([{
        id: generateId(),
        type: 'paragraph',
        content: '',
      }]);
    }
  }, []);
  
  // Sync blocks to HTML when blocks change
  useEffect(() => {
    if (!rawMode) {
      const html = blocksToHtml(blocks);
      setEditorContent(html);
      setRawHtml(html);
    }
  }, [blocks, setEditorContent, rawMode]);
  
  // Sync HTML to editor when editing raw HTML
  const handleRawHtmlChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setRawHtml(e.target.value);
  };
  
  // Update HTML content from raw editor when finished editing
  const applyRawHtmlChanges = () => {
    setEditorContent(rawHtml);
    const parsedBlocks = parseHtmlToBlocks(rawHtml);
    setBlocks(parsedBlocks);
    setRawMode(false);
    setActiveTab('visual'); // Switch back to visual editor
  };
  
  // Add a new block of the specified type
  const addBlock = (type: BlockType) => {
    const newBlock: ContentBlock = {
      id: generateId(),
      type,
      content: '',
    };
    
    // Initialize specific block types with default content
    switch (type) {
      case 'bulletList':
      case 'numberedList':
        newBlock.content = 'Item 1\nItem 2';
        break;
    }
    
    setBlocks([...blocks, newBlock]);
  };
  
  // Update a block's properties
  const updateBlock = (id: string, updatedProps: Partial<ContentBlock>) => {
    setBlocks(blocks.map(block => 
      block.id === id ? { ...block, ...updatedProps } : block
    ));
  };
  
  // Delete a block
  const deleteBlock = (id: string) => {
    setBlocks(blocks.filter(block => block.id !== id));
  };
  
  // Reorder blocks with drag-and-drop
  const moveBlock = (dragIndex: number, hoverIndex: number) => {
    const newBlocks = [...blocks];
    const draggedBlock = newBlocks[dragIndex];
    
    // Remove the dragged block
    newBlocks.splice(dragIndex, 1);
    
    // Insert it at the new position
    newBlocks.splice(hoverIndex, 0, draggedBlock);
    
    setBlocks(newBlocks);
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
      const parsedBlocks = parseHtmlToBlocks(clipboardText);
      setBlocks(parsedBlocks);
    } catch (error) {
      console.error('Failed to paste HTML:', error);
    }
  };
  
  // Render a block for preview (simplified version)
  const renderBlockPreview = (block: ContentBlock) => {
    switch (block.type) {
      case 'heading1':
        return <h1 style={block.align ? { textAlign: block.align as any } : {}}>{block.content}</h1>;
      case 'heading2':
        return <h2 style={block.align ? { textAlign: block.align as any } : {}}>{block.content}</h2>;
      case 'heading3':
        return <h3 style={block.align ? { textAlign: block.align as any } : {}}>{block.content}</h3>;
      case 'paragraph':
        return <p style={block.align ? { textAlign: block.align as any } : {}}>{block.content}</p>;
      case 'quote':
        return <blockquote style={block.align ? { textAlign: block.align as any } : {}}>{block.content}</blockquote>;
      case 'bulletList':
        return (
          <ul>
            {block.content.split('\n').map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        );
      case 'numberedList':
        return (
          <ol>
            {block.content.split('\n').map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ol>
        );
      case 'image':
        if (block.metadata?.src) {
          return <img src={block.metadata.src} alt={block.metadata.alt || ''} />;
        }
        return null;
      case 'link':
        if (block.metadata?.href) {
          return <a href={block.metadata.href}>{block.metadata.linkText || block.metadata.href}</a>;
        }
        return null;
      case 'divider':
        return <hr />;
      default:
        return <p>(Unknown block type: {block.type})</p>;
    }
  };

  // Render the preview of all blocks
  const renderBlocksPreview = () => {
    return blocks.map((block, index) => (
      <div key={block.id} className="mb-4">
        {renderBlockPreview(block)}
      </div>
    ));
  };
  
  return (
    <div className="border rounded-md bg-white">
      <Tabs defaultValue="visual" value={activeTab} onValueChange={setActiveTab}>
        <div className="flex justify-between items-center border-b px-4">
          <TabsList className="my-2">
            <TabsTrigger value="visual">Visual Editor</TabsTrigger>
            <TabsTrigger value="html">HTML</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          
          {/* HTML actions */}
          {activeTab === 'html' && (
            <div className="flex gap-2">
              <Button 
                type="button" 
                size="sm" 
                variant="outline"
                className="flex gap-1 items-center"
                onClick={copyHtml}
              >
                {showCopySuccess ? <Check size={14} /> : <Copy size={14} />}
                {showCopySuccess ? 'Copied!' : 'Copy HTML'}
              </Button>
              <Button 
                type="button" 
                size="sm" 
                variant="outline"
                className="flex gap-1 items-center"
                onClick={pasteHtml}
              >
                <Clipboard size={14} />
                Paste HTML
              </Button>
              {rawMode && (
                <Button 
                  type="button" 
                  size="sm" 
                  variant="default"
                  className="flex gap-1 items-center"
                  onClick={applyRawHtmlChanges}
                >
                  <ArrowLeftRight size={14} />
                  Apply Changes
                </Button>
              )}
            </div>
          )}
        </div>
        
        <TabsContent value="visual" className="p-0">
          <DndProvider backend={HTML5Backend}>
            {/* Word-like formatting toolbar */}
            <div className="border-b p-2 bg-gray-50 flex flex-wrap gap-1 items-center">
              {/* Text formatting */}
              <div className="flex items-center border-r pr-2 mr-2">
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 w-8 p-0" 
                  title="Bold"
                  onClick={() => {
                    // Apply bold to selected block if it's a paragraph
                    const activeBlock = blocks.find(b => document.activeElement?.closest(`[data-block-id="${b.id}"]`));
                    if (activeBlock && activeBlock.type === 'paragraph') {
                      updateBlock(activeBlock.id, {
                        styles: {
                          ...activeBlock.styles,
                          bold: !(activeBlock.styles?.bold)
                        }
                      });
                    }
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
                  onClick={() => {
                    // Apply italic to selected block if it's a paragraph
                    const activeBlock = blocks.find(b => document.activeElement?.closest(`[data-block-id="${b.id}"]`));
                    if (activeBlock && activeBlock.type === 'paragraph') {
                      updateBlock(activeBlock.id, {
                        styles: {
                          ...activeBlock.styles,
                          italic: !(activeBlock.styles?.italic)
                        }
                      });
                    }
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
                  onClick={() => {
                    // Apply underline to selected block if it's a paragraph
                    const activeBlock = blocks.find(b => document.activeElement?.closest(`[data-block-id="${b.id}"]`));
                    if (activeBlock && activeBlock.type === 'paragraph') {
                      updateBlock(activeBlock.id, {
                        styles: {
                          ...activeBlock.styles,
                          underline: !(activeBlock.styles?.underline)
                        }
                      });
                    }
                  }}
                >
                  <Underline size={16} />
                </Button>
              </div>
              
              {/* Alignment options */}
              <div className="flex items-center border-r pr-2 mr-2">
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 w-8 p-0" 
                  title="Align Left"
                  onClick={() => {
                    // Apply alignment to selected block
                    const activeBlock = blocks.find(b => document.activeElement?.closest(`[data-block-id="${b.id}"]`));
                    if (activeBlock) {
                      updateBlock(activeBlock.id, { align: 'left' });
                    }
                  }}
                >
                  <AlignLeft size={16} />
                </Button>
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 w-8 p-0" 
                  title="Align Center"
                  onClick={() => {
                    // Apply alignment to selected block
                    const activeBlock = blocks.find(b => document.activeElement?.closest(`[data-block-id="${b.id}"]`));
                    if (activeBlock) {
                      updateBlock(activeBlock.id, { align: 'center' });
                    }
                  }}
                >
                  <AlignCenter size={16} />
                </Button>
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 w-8 p-0" 
                  title="Align Right"
                  onClick={() => {
                    // Apply alignment to selected block
                    const activeBlock = blocks.find(b => document.activeElement?.closest(`[data-block-id="${b.id}"]`));
                    if (activeBlock) {
                      updateBlock(activeBlock.id, { align: 'right' });
                    }
                  }}
                >
                  <AlignRight size={16} />
                </Button>
              </div>
              
              {/* Heading options */}
              <div className="flex items-center border-r pr-2 mr-2">
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 px-2" 
                  title="Heading 1"
                  onClick={() => {
                    // Convert selected block to heading 1
                    const activeBlock = blocks.find(b => document.activeElement?.closest(`[data-block-id="${b.id}"]`));
                    if (activeBlock) {
                      updateBlock(activeBlock.id, { type: 'heading1' });
                    } else {
                      addBlock('heading1');
                    }
                  }}
                >
                  <Heading1 size={16} className="mr-1" /> H1
                </Button>
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 px-2" 
                  title="Heading 2"
                  onClick={() => {
                    // Convert selected block to heading 2
                    const activeBlock = blocks.find(b => document.activeElement?.closest(`[data-block-id="${b.id}"]`));
                    if (activeBlock) {
                      updateBlock(activeBlock.id, { type: 'heading2' });
                    } else {
                      addBlock('heading2');
                    }
                  }}
                >
                  <Heading2 size={16} className="mr-1" /> H2
                </Button>
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 px-2" 
                  title="Heading 3"
                  onClick={() => {
                    // Convert selected block to heading 3
                    const activeBlock = blocks.find(b => document.activeElement?.closest(`[data-block-id="${b.id}"]`));
                    if (activeBlock) {
                      updateBlock(activeBlock.id, { type: 'heading3' });
                    } else {
                      addBlock('heading3');
                    }
                  }}
                >
                  <Heading3 size={16} className="mr-1" /> H3
                </Button>
              </div>
              
              {/* Insert special elements */}
              <div className="flex items-center gap-1">
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 px-2" 
                  title="Insert Link"
                  onClick={() => addBlock('link')}
                >
                  <Link size={16} className="mr-1" /> Link
                </Button>
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 px-2" 
                  title="Insert Image"
                  onClick={() => addBlock('image')}
                >
                  <Image size={16} className="mr-1" /> Image
                </Button>
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 px-2" 
                  title="Bullet List"
                  onClick={() => addBlock('bulletList')}
                >
                  <List size={16} className="mr-1" /> List
                </Button>
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 px-2" 
                  title="Numbered List"
                  onClick={() => addBlock('numberedList')}
                >
                  <ListOrdered size={16} className="mr-1" /> Numbered
                </Button>
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 px-2" 
                  title="Quote Block"
                  onClick={() => addBlock('quote')}
                >
                  <Quote size={16} className="mr-1" /> Quote
                </Button>
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 px-2" 
                  title="Divider"
                  onClick={() => addBlock('divider')}
                >
                  <Minus size={16} className="mr-1" /> Divider
                </Button>
              </div>
            </div>
            
            {/* Document content area */}
            <div className="p-4 bg-white border-b">
              <div className="max-w-4xl mx-auto bg-white p-6 min-h-[500px] shadow-sm rounded-sm border">
                {blocks.map((block, index) => (
                  <div 
                    key={block.id} 
                    data-block-id={block.id}
                    className="relative hover:outline hover:outline-1 hover:outline-blue-200 hover:bg-blue-50/20 focus-within:outline focus-within:outline-2 focus-within:outline-blue-500/50 rounded px-2 py-1 my-2"
                  >
                    <ContentBlockComponent 
                      block={block}
                      index={index}
                      moveBlock={moveBlock}
                      updateBlock={updateBlock}
                      deleteBlock={deleteBlock}
                    />
                  </div>
                ))}
                
                {/* Add paragraph button at the end */}
                <button 
                  className="w-full text-center mt-4 py-2 text-gray-400 hover:text-gray-600 text-sm hover:bg-gray-50 rounded-md border border-dashed"
                  onClick={() => addBlock('paragraph')}
                >
                  + Add paragraph
                </button>
              </div>
            </div>
          </DndProvider>
        </TabsContent>
        
        <TabsContent value="html" className="p-4">
          <div className="space-y-2">
            <textarea
              className="w-full h-[500px] p-3 font-mono text-sm border rounded-md"
              value={rawHtml}
              onChange={handleRawHtmlChange}
              onFocus={() => setRawMode(true)}
            />
            
            {rawMode && (
              <div className="flex justify-end">
                <Button 
                  type="button"
                  variant="default"
                  onClick={applyRawHtmlChanges}
                >
                  Apply HTML Changes
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="preview" className="border-t">
          <div className="p-6 prose max-w-none">
            {renderBlocksPreview()}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}