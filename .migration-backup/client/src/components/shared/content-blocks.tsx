import React, { useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Bold, Italic, Underline, Heading1, Heading2, 
  Heading3, List, ListOrdered, Image as ImageIcon, Link as LinkIcon, Trash2
} from 'lucide-react';

export type BlockType = 
  | 'heading1' 
  | 'heading2' 
  | 'heading3' 
  | 'paragraph' 
  | 'image' 
  | 'bulletList' 
  | 'numberedList'
  | 'link'
  | 'quote'
  | 'divider';

export interface ContentBlock {
  id: string;
  type: BlockType;
  content: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  styles?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    color?: string;
  };
  metadata?: {
    src?: string;
    alt?: string;
    href?: string;
    linkText?: string;
  };
}

interface ContentBlockProps {
  block: ContentBlock;
  index: number;
  moveBlock: (dragIndex: number, hoverIndex: number) => void;
  updateBlock: (id: string, updatedBlock: Partial<ContentBlock>) => void;
  deleteBlock: (id: string) => void;
}

const ItemTypes = {
  BLOCK: 'block'
};

export function ContentBlockComponent({ 
  block, 
  index, 
  moveBlock, 
  updateBlock, 
  deleteBlock 
}: ContentBlockProps) {
  const [showControls, setShowControls] = useState(false);
  
  // Set up drag and drop
  const [{ isDragging }, drag] = useDrag({
    type: ItemTypes.BLOCK,
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: ItemTypes.BLOCK,
    hover(item: { index: number }, monitor) {
      if (!item) return;
      
      const dragIndex = item.index;
      const hoverIndex = index;

      // Don't replace items with themselves
      if (dragIndex === hoverIndex) return;

      moveBlock(dragIndex, hoverIndex);
      
      // Update the dragged item's index for the next hover
      item.index = hoverIndex;
    },
  });
  
  // Toggle text style
  const toggleStyle = (style: 'bold' | 'italic' | 'underline') => {
    const currentStyles = block.styles || {};
    updateBlock(block.id, { 
      styles: { 
        ...currentStyles, 
        [style]: !currentStyles[style] 
      } 
    });
  };
  
  // Set alignment
  const setAlignment = (align: 'left' | 'center' | 'right' | 'justify') => {
    updateBlock(block.id, { align });
  };
  
  // Update block content
  const handleContentChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    updateBlock(block.id, { content: e.target.value });
  };
  
  // Update image details
  const handleImageDetailChange = (field: 'src' | 'alt', value: string) => {
    const metadata = block.metadata || {};
    updateBlock(block.id, { 
      metadata: { ...metadata, [field]: value }
    });
  };
  
  // Update link details
  const handleLinkDetailChange = (field: 'href' | 'linkText', value: string) => {
    const metadata = block.metadata || {};
    updateBlock(block.id, { 
      metadata: { ...metadata, [field]: value }
    });
  };
  
  // Render the appropriate editor based on block type
  const renderBlockEditor = () => {
    const styles = block.styles || {};
    
    switch (block.type) {
      case 'heading1':
        return (
          <Input 
            value={block.content} 
            onChange={handleContentChange}
            className={`text-3xl font-bold ${styles.italic ? 'italic' : ''} ${styles.underline ? 'underline' : ''}`}
            style={{ 
              textAlign: block.align || 'left',
              color: styles.color
            }}
          />
        );
        
      case 'heading2':
        return (
          <Input 
            value={block.content} 
            onChange={handleContentChange}
            className={`text-2xl font-bold ${styles.italic ? 'italic' : ''} ${styles.underline ? 'underline' : ''}`}
            style={{ 
              textAlign: block.align || 'left',
              color: styles.color
            }}
          />
        );
        
      case 'heading3':
        return (
          <Input 
            value={block.content} 
            onChange={handleContentChange}
            className={`text-xl font-bold ${styles.italic ? 'italic' : ''} ${styles.underline ? 'underline' : ''}`}
            style={{ 
              textAlign: block.align || 'left',
              color: styles.color
            }}
          />
        );
        
      case 'paragraph':
        return (
          <Textarea 
            value={block.content} 
            onChange={handleContentChange}
            className={`min-h-[100px] ${styles.bold ? 'font-bold' : ''} ${styles.italic ? 'italic' : ''} ${styles.underline ? 'underline' : ''}`}
            style={{ 
              textAlign: block.align || 'left',
              color: styles.color
            }}
          />
        );
        
      case 'image':
        return (
          <div className="space-y-2">
            <Input 
              value={block.metadata?.src || ''} 
              onChange={(e) => handleImageDetailChange('src', e.target.value)}
              placeholder="Image URL"
              className="mb-1"
            />
            <Input 
              value={block.metadata?.alt || ''} 
              onChange={(e) => handleImageDetailChange('alt', e.target.value)}
              placeholder="Alt text"
              className="mb-1"
            />
            {block.metadata?.src && (
              <div className="flex justify-center">
                <img 
                  src={block.metadata.src} 
                  alt={block.metadata.alt || 'Preview'} 
                  className="max-w-full max-h-[300px] object-contain border"
                />
              </div>
            )}
          </div>
        );
        
      case 'link':
        return (
          <div className="space-y-2">
            <Input 
              value={block.metadata?.href || ''} 
              onChange={(e) => handleLinkDetailChange('href', e.target.value)}
              placeholder="URL (https://...)"
              className="mb-1"
            />
            <Input 
              value={block.metadata?.linkText || ''} 
              onChange={(e) => handleLinkDetailChange('linkText', e.target.value)}
              placeholder="Link text"
              className="mb-1"
            />
          </div>
        );
        
      case 'bulletList':
      case 'numberedList':
        return (
          <Textarea 
            value={block.content} 
            onChange={handleContentChange}
            className="min-h-[100px]"
            placeholder="Enter items (one per line)"
            style={{ 
              textAlign: block.align || 'left' 
            }}
          />
        );
        
      case 'quote':
        return (
          <Textarea 
            value={block.content} 
            onChange={handleContentChange}
            className="min-h-[100px] italic pl-4 border-l-4 border-gray-300"
            style={{ 
              textAlign: block.align || 'left',
              color: styles.color
            }}
          />
        );
        
      case 'divider':
        return <hr className="my-2 border-t-2" />;
        
      default:
        return <p>Unsupported block type</p>;
    }
  };
  
  return (
    <div 
      ref={(node) => drag(drop(node))}
      className={`relative border rounded-md p-3 mb-3 bg-white ${isDragging ? 'opacity-50' : ''}`}
      style={{ 
        cursor: 'move',
        opacity: isDragging ? 0.5 : 1
      }}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Block type indicator */}
      <div className="absolute top-0 left-0 bg-primary/10 text-primary text-xs px-2 py-1 rounded-br-md">
        {block.type}
      </div>
      
      {/* Delete button */}
      {showControls && (
        <Button
          type="button"
          size="sm"
          variant="destructive"
          className="absolute top-2 right-2 h-8 w-8 p-0"
          onClick={() => deleteBlock(block.id)}
        >
          <Trash2 size={16} />
        </Button>
      )}
      
      {/* Block content */}
      <div className="mt-6">
        {renderBlockEditor()}
      </div>
      
      {/* Block formatting toolbar */}
      {showControls && (block.type === 'paragraph' || block.type.startsWith('heading') || block.type === 'quote') && (
        <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t">
          {/* Text style controls */}
          <Button
            type="button"
            size="sm"
            variant={block.styles?.bold ? 'default' : 'outline'}
            className="h-7 w-7 p-0"
            onClick={() => toggleStyle('bold')}
          >
            <Bold size={14} />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={block.styles?.italic ? 'default' : 'outline'}
            className="h-7 w-7 p-0"
            onClick={() => toggleStyle('italic')}
          >
            <Italic size={14} />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={block.styles?.underline ? 'default' : 'outline'}
            className="h-7 w-7 p-0"
            onClick={() => toggleStyle('underline')}
          >
            <Underline size={14} />
          </Button>
          
          {/* Alignment controls */}
          <div className="flex gap-1 ml-2">
            <Button
              type="button"
              size="sm"
              variant={block.align === 'left' || !block.align ? 'default' : 'outline'}
              className="h-7 w-7 p-0"
              onClick={() => setAlignment('left')}
            >
              <AlignLeft size={14} />
            </Button>
            <Button
              type="button"
              size="sm"
              variant={block.align === 'center' ? 'default' : 'outline'}
              className="h-7 w-7 p-0"
              onClick={() => setAlignment('center')}
            >
              <AlignCenter size={14} />
            </Button>
            <Button
              type="button"
              size="sm"
              variant={block.align === 'right' ? 'default' : 'outline'}
              className="h-7 w-7 p-0"
              onClick={() => setAlignment('right')}
            >
              <AlignRight size={14} />
            </Button>
            <Button
              type="button"
              size="sm"
              variant={block.align === 'justify' ? 'default' : 'outline'}
              className="h-7 w-7 p-0"
              onClick={() => setAlignment('justify')}
            >
              <AlignJustify size={14} />
            </Button>
          </div>
          
          {/* Color picker */}
          <div className="flex gap-1 ml-2">
            <Button
              type="button"
              size="sm"
              variant={block.styles?.color === 'red' ? 'default' : 'outline'}
              className="h-7 p-0 px-2"
              style={{color: block.styles?.color === 'red' ? 'white' : 'red'}}
              onClick={() => {
                const currentStyles = block.styles || {};
                updateBlock(block.id, { 
                  styles: { 
                    ...currentStyles, 
                    color: currentStyles.color === 'red' ? undefined : 'red'
                  } 
                });
              }}
            >
              Red
            </Button>
            <Button
              type="button"
              size="sm"
              variant={block.styles?.color === 'blue' ? 'default' : 'outline'}
              className="h-7 p-0 px-2"
              style={{color: block.styles?.color === 'blue' ? 'white' : 'blue'}}
              onClick={() => {
                const currentStyles = block.styles || {};
                updateBlock(block.id, { 
                  styles: { 
                    ...currentStyles, 
                    color: currentStyles.color === 'blue' ? undefined : 'blue'
                  } 
                });
              }}
            >
              Blue
            </Button>
            <Button
              type="button"
              size="sm"
              variant={block.styles?.color === 'green' ? 'default' : 'outline'}
              className="h-7 p-0 px-2"
              style={{color: block.styles?.color === 'green' ? 'white' : 'green'}}
              onClick={() => {
                const currentStyles = block.styles || {};
                updateBlock(block.id, { 
                  styles: { 
                    ...currentStyles, 
                    color: currentStyles.color === 'green' ? undefined : 'green'
                  } 
                });
              }}
            >
              Green
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Render the block for display in the preview
export const renderBlockForPreview = (block: ContentBlock) => {
  const styles = block.styles || {};
  
  switch (block.type) {
    case 'heading1':
      return (
        <h1 
          className={`text-3xl font-bold ${styles.italic ? 'italic' : ''} ${styles.underline ? 'underline' : ''}`}
          style={{ 
            textAlign: block.align || 'left',
            color: styles.color
          }}
        >
          {block.content}
        </h1>
      );
      
    case 'heading2':
      return (
        <h2 
          className={`text-2xl font-bold ${styles.italic ? 'italic' : ''} ${styles.underline ? 'underline' : ''}`}
          style={{ 
            textAlign: block.align || 'left',
            color: styles.color
          }}
        >
          {block.content}
        </h2>
      );
      
    case 'heading3':
      return (
        <h3 
          className={`text-xl font-bold ${styles.italic ? 'italic' : ''} ${styles.underline ? 'underline' : ''}`}
          style={{ 
            textAlign: block.align || 'left',
            color: styles.color
          }}
        >
          {block.content}
        </h3>
      );
      
    case 'paragraph':
      return (
        <p 
          className={`mb-4 ${styles.bold ? 'font-bold' : ''} ${styles.italic ? 'italic' : ''} ${styles.underline ? 'underline' : ''}`}
          style={{ 
            textAlign: block.align || 'left',
            color: styles.color
          }}
        >
          {block.content}
        </p>
      );
      
    case 'image':
      return (
        <div className="flex justify-center my-4">
          <img 
            src={block.metadata?.src} 
            alt={block.metadata?.alt || ''} 
            className="max-w-full"
          />
        </div>
      );
      
    case 'link':
      return (
        <div className="my-2">
          <a 
            href={block.metadata?.href} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            {block.metadata?.linkText || block.metadata?.href || 'Link'}
          </a>
        </div>
      );
      
    case 'bulletList':
      return (
        <ul className="list-disc pl-5 my-4" style={{ textAlign: block.align || 'left' }}>
          {block.content.split('\n').filter(line => line.trim()).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
      
    case 'numberedList':
      return (
        <ol className="list-decimal pl-5 my-4" style={{ textAlign: block.align || 'left' }}>
          {block.content.split('\n').filter(line => line.trim()).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
      );
      
    case 'quote':
      return (
        <blockquote 
          className="pl-4 my-4 italic border-l-4 border-gray-300"
          style={{ 
            textAlign: block.align || 'left',
            color: styles.color
          }}
        >
          {block.content}
        </blockquote>
      );
      
    case 'divider':
      return <hr className="my-6 border-t-2" />;
      
    default:
      return <p>Unsupported block type</p>;
  }
};

// Convert the block to HTML
export const blockToHtml = (block: ContentBlock): string => {
  const styles = block.styles || {};
  const align = block.align ? `text-align: ${block.align};` : '';
  const color = styles.color ? `color: ${styles.color};` : '';
  const style = align || color ? ` style="${align}${color}"` : '';
  
  switch (block.type) {
    case 'heading1':
      let h1Content = block.content;
      if (styles.bold) h1Content = `<strong>${h1Content}</strong>`;
      if (styles.italic) h1Content = `<em>${h1Content}</em>`;
      if (styles.underline) h1Content = `<u>${h1Content}</u>`;
      return `<h1${style}>${h1Content}</h1>`;
      
    case 'heading2':
      let h2Content = block.content;
      if (styles.bold) h2Content = `<strong>${h2Content}</strong>`;
      if (styles.italic) h2Content = `<em>${h2Content}</em>`;
      if (styles.underline) h2Content = `<u>${h2Content}</u>`;
      return `<h2${style}>${h2Content}</h2>`;
      
    case 'heading3':
      let h3Content = block.content;
      if (styles.bold) h3Content = `<strong>${h3Content}</strong>`;
      if (styles.italic) h3Content = `<em>${h3Content}</em>`;
      if (styles.underline) h3Content = `<u>${h3Content}</u>`;
      return `<h3${style}>${h3Content}</h3>`;
      
    case 'paragraph':
      let pContent = block.content;
      if (styles.bold) pContent = `<strong>${pContent}</strong>`;
      if (styles.italic) pContent = `<em>${pContent}</em>`;
      if (styles.underline) pContent = `<u>${pContent}</u>`;
      return `<p${style}>${pContent}</p>`;
      
    case 'image':
      return `<div style="text-align: center;"><img src="${block.metadata?.src}" alt="${block.metadata?.alt || ''}" style="max-width: 100%;" /></div>`;
      
    case 'link':
      return `<a href="${block.metadata?.href}" target="_blank" rel="noopener noreferrer">${block.metadata?.linkText || block.metadata?.href || 'Link'}</a>`;
      
    case 'bulletList':
      const ulItems = block.content
        .split('\n')
        .filter(line => line.trim())
        .map(item => `  <li>${item}</li>`)
        .join('\n');
      return `<ul${style}>\n${ulItems}\n</ul>`;
      
    case 'numberedList':
      const olItems = block.content
        .split('\n')
        .filter(line => line.trim())
        .map(item => `  <li>${item}</li>`)
        .join('\n');
      return `<ol${style}>\n${olItems}\n</ol>`;
      
    case 'quote':
      return `<blockquote${style}>${block.content}</blockquote>`;
      
    case 'divider':
      return '<hr />';
      
    default:
      return '';
  }
};

// Type menu for adding new blocks
export function BlockTypeMenu({ addBlock }: { addBlock: (type: BlockType) => void }) {
  return (
    <div className="flex flex-wrap gap-2 my-3 p-3 border rounded bg-muted/10">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => addBlock('heading1')}
        className="h-9"
      >
        <Heading1 size={16} className="mr-2" />
        Heading 1
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => addBlock('heading2')}
        className="h-9"
      >
        <Heading2 size={16} className="mr-2" />
        Heading 2
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => addBlock('heading3')}
        className="h-9"
      >
        <Heading3 size={16} className="mr-2" />
        Heading 3
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => addBlock('paragraph')}
        className="h-9"
      >
        <AlignLeft size={16} className="mr-2" />
        Paragraph
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => addBlock('image')}
        className="h-9"
      >
        <ImageIcon size={16} className="mr-2" />
        Image
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => addBlock('bulletList')}
        className="h-9"
      >
        <List size={16} className="mr-2" />
        Bullet List
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => addBlock('numberedList')}
        className="h-9"
      >
        <ListOrdered size={16} className="mr-2" />
        Numbered List
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => addBlock('link')}
        className="h-9"
      >
        <LinkIcon size={16} className="mr-2" />
        Link
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => addBlock('quote')}
        className="h-9"
      >
        <AlignLeft size={16} className="mr-2" />
        Quote
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => addBlock('divider')}
        className="h-9"
      >
        —
        Divider
      </Button>
    </div>
  );
}