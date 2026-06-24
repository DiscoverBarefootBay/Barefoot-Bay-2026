import { useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered, 
  Quote, 
  Link, 
  Image, 
  Heading1, 
  Heading2, 
  Code,
  AlignLeft,
  Eye,
  FileCode,
  RefreshCw
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface MarkdownEditorProps {
  initialValue: string;
  onChange: (value: string) => void;
}

export function MarkdownEditor({ initialValue, onChange }: MarkdownEditorProps) {
  const [content, setContent] = useState(initialValue || '');
  const [activeTab, setActiveTab] = useState<string>('write');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialValue !== content) {
      setContent(initialValue || '');
    }
  }, [initialValue]);

  useEffect(() => {
    onChange(content);
  }, [content, onChange]);

  const insertMarkdown = (markdownBefore: string, markdownAfter: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const newText = textarea.value.substring(0, start) + 
                   markdownBefore + selectedText + markdownAfter + 
                   textarea.value.substring(end);
    
    setContent(newText);
    
    // Wait for state update and then focus and set selection
    setTimeout(() => {
      const newCursorPos = start + markdownBefore.length;
      textarea.focus();
      textarea.setSelectionRange(
        selectedText ? newCursorPos : newCursorPos + selectedText.length,
        newCursorPos + selectedText.length
      );
    }, 10);
  };

  const handleImageInsert = () => {
    const imageUrl = prompt('Enter image URL:', 'https://');
    if (imageUrl) {
      insertMarkdown(`![Image](${imageUrl})`);
    }
  };

  const handleLinkInsert = () => {
    const linkUrl = prompt('Enter link URL:', 'https://');
    const linkText = prompt('Enter link text:', 'Link text');
    if (linkUrl && linkText) {
      insertMarkdown(`[${linkText}](${linkUrl})`);
    }
  };

  return (
    <div className="border rounded-md">
      <Tabs defaultValue="write" value={activeTab} onValueChange={setActiveTab}>
        <div className="border-b px-4 py-2 bg-slate-50">
          <div className="flex justify-between items-center">
            <TabsList className="grid grid-cols-2 w-[200px]">
              <TabsTrigger value="write" className="flex items-center gap-1">
                <FileCode className="h-4 w-4" />
                Write
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                Preview
              </TabsTrigger>
            </TabsList>

            {activeTab === 'write' && (
              <div className="flex gap-1 flex-wrap">
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => insertMarkdown('**', '**')}
                  title="Bold"
                >
                  <Bold className="h-4 w-4" />
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => insertMarkdown('*', '*')}
                  title="Italic"
                >
                  <Italic className="h-4 w-4" />
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => insertMarkdown('### ')}
                  title="Heading"
                >
                  <Heading1 className="h-4 w-4" />
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => insertMarkdown('#### ')}
                  title="Subheading"
                >
                  <Heading2 className="h-4 w-4" />
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => insertMarkdown('- ')}
                  title="Bullet List"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => insertMarkdown('1. ')}
                  title="Numbered List"
                >
                  <ListOrdered className="h-4 w-4" />
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => insertMarkdown('> ')}
                  title="Quote"
                >
                  <Quote className="h-4 w-4" />
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleLinkInsert}
                  title="Link"
                >
                  <Link className="h-4 w-4" />
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleImageInsert}
                  title="Image"
                >
                  <Image className="h-4 w-4" />
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => insertMarkdown('```\n', '\n```')}
                  title="Code Block"
                >
                  <Code className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
        
        <TabsContent value="write" className="p-0">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your markdown content here..."
            className="min-h-[400px] border-0 focus-visible:ring-0 rounded-none font-mono text-sm resize-y p-4"
          />
        </TabsContent>
        
        <TabsContent value="preview" className="p-4 min-h-[400px]">
          {content ? (
            <div 
              className="prose max-w-none" 
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
          ) : (
            <div className="text-gray-400 italic">Nothing to preview</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Simple markdown to HTML parser (this is a basic implementation)
function renderMarkdown(markdown: string): string {
  // This is a very basic implementation
  // For a real app, you would use a proper markdown library like marked.js
  
  let html = markdown
    // Convert heading syntax
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    
    // Convert bold and italic
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    
    // Convert links
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    
    // Convert images
    .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" class="my-3 rounded-md">')
    
    // Convert lists
    .replace(/^\s*\n\*/gm, '<ul>\n*')
    .replace(/^(\*.+)\s*\n([^\*])/gm, '$1\n</ul>\n\n$2')
    .replace(/^\*(.+)/gm, '<li>$1</li>')
    
    // Convert numbered lists
    .replace(/^\s*\n\d\./gm, '<ol>\n1.')
    .replace(/^(\d\..+)\s*\n([^\d\.])/gm, '$1\n</ol>\n\n$2')
    .replace(/^\d\.(.+)/gm, '<li>$1</li>')
    
    // Convert blockquotes
    .replace(/^\>(.+)/gm, '<blockquote>$1</blockquote>')
    
    // Convert code blocks
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    
    // Convert inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    
    // Convert horizontal rule
    .replace(/^\-\-\-(\s*)?$/gm, '<hr>')
    
    // Convert paragraphs
    .replace(/\n\s*\n/g, '\n<br/>\n');
  
  // Wrap non-tagged text in p tags
  const lines = html.split('\n');
  let inBlock = false;
  
  html = lines.map(line => {
    // Skip empty lines or lines that are already HTML tags
    if (!line.trim() || line.trim().startsWith('<')) {
      return line;
    }
    
    // If not in a block element, wrap in paragraph
    if (!inBlock) {
      return `<p>${line}</p>`;
    }
    
    return line;
  }).join('\n');
  
  return html;
}