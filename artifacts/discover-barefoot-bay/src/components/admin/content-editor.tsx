import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Eye, Code } from 'lucide-react';
import WysiwygEditor from '@/components/shared/wysiwyg-editor-direct';

interface ContentEditorProps {
  initialContent: string;
  onChange: (content: string) => void;
  pageSlug?: string;
  pageCategory?: string;
}

export function ContentEditor({ initialContent, onChange, pageSlug, pageCategory }: ContentEditorProps) {
  const [content, setContent] = useState(initialContent || '');
  const [activeTab, setActiveTab] = useState<'visual' | 'code'>('visual');
  const [isJsonContent, setIsJsonContent] = useState(false);

  useEffect(() => {
    // Check if the content is JSON
    try {
      if (initialContent && (
        (initialContent.startsWith('[') && initialContent.endsWith(']')) ||
        (initialContent.startsWith('{') && initialContent.endsWith('}'))
      )) {
        // Try to parse it to confirm it's valid JSON
        JSON.parse(initialContent);
        setIsJsonContent(true);
        setActiveTab('code'); // Default to code view for JSON
      }
    } catch (e) {
      // Not valid JSON, keep the default settings
      setIsJsonContent(false);
    }
    
    setContent(initialContent || '');
  }, [initialContent]);

  // Handle WYSIWYG editor content change
  const handleEditorChange = (newContent: string) => {
    setContent(newContent);
    onChange(newContent);
  };

  // Determine the correct section for media uploads
  const getEditorSection = () => {
    // Check if this is a community page based on category or slug
    if (pageCategory && pageCategory.toLowerCase().includes('community')) {
      return 'community';
    }
    
    // Check if slug indicates community content
    if (pageSlug) {
      if (pageSlug.startsWith('community-')) {
        return 'community';
      }
      
      // Extract section from slug prefix
      const slugPrefix = pageSlug.split('-')[0];
      
      // Map slug prefixes to appropriate sections
      const sectionMap: { [key: string]: string } = {
        'amenities': 'community',
        'government': 'community', 
        'safety': 'community',
        'services': 'community',
        'nature': 'community',
        'transportation': 'community',
        'religion': 'community',
        'vendors': 'vendors',
        'forum': 'forum'
      };
      
      return sectionMap[slugPrefix] || 'community';
    }
    
    // Default to community for admin page management
    return 'community';
  };

  // Handle code textarea change
  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    onChange(newContent);
  };

  // Format JSON for better readability
  const formatJSON = () => {
    try {
      const parsed = JSON.parse(content);
      const formatted = JSON.stringify(parsed, null, 2);
      setContent(formatted);
      onChange(formatted);
    } catch (e) {
      console.error('Failed to format JSON:', e);
      // Show toast or other error notification
    }
  };

  return (
    <div className="border rounded-md overflow-hidden">
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'visual' | 'code')}>
        <div className="bg-gray-50 border-b px-4 py-2 flex justify-between">
          <TabsList>
            <TabsTrigger value="visual" disabled={isJsonContent}>
              <Eye className="h-4 w-4 mr-2" /> Visual Editor
            </TabsTrigger>
            <TabsTrigger value="code">
              <Code className="h-4 w-4 mr-2" /> Code View
            </TabsTrigger>
          </TabsList>
          
          {activeTab === 'code' && isJsonContent && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={formatJSON}
              className="text-xs"
            >
              Format JSON
            </Button>
          )}
        </div>
        
        <TabsContent value="visual" className="p-0">
          {/* Use our new WYSIWYG editor component */}
          <WysiwygEditor 
            editorContent={content}
            setEditorContent={handleEditorChange}
            editorContext={{
              section: getEditorSection(),
              slug: pageSlug
            }}
          />
        </TabsContent>
        
        <TabsContent value="code" className="p-0">
          <Textarea
            value={content}
            onChange={handleCodeChange}
            className="font-mono text-sm"
            placeholder="Enter HTML or JSON content here..."
            rows={20}
            style={{ minHeight: '500px', padding: '12px', resize: 'vertical' }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}