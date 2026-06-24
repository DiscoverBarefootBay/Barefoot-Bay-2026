import React from 'react';
import parse, { HTMLReactParserOptions, domToReact, Element, attributesToProps } from 'html-react-parser';
import { SmartImage } from '../shared/smart-image';
import { ContentWithForms } from '@/lib/form-content-processor';

/**
 * ForumContent component for rendering HTML content with smart image handling
 * 
 * This component parses HTML content (from TinyMCE or similar editors) and 
 * replaces standard <img> tags with our SmartImage component to handle 
 * multiple path formats and fallbacks in production.
 */
interface ForumContentProps {
  content: string;
  className?: string;
  allowCache?: boolean;
}

export const ForumContent: React.FC<ForumContentProps> = ({ 
  content, 
  className = 'prose max-w-none',
  allowCache = false,
  ...props
}) => {
  // Always contain floated children (e.g. right/left aligned images) so they
  // can't burst out of the post card and overlap surrounding UI.
  const containerClassName = `${className} forum-content-container`.trim();
  // Skip processing if content is empty
  if (!content || content.trim() === '') {
    return null;
  }

  // First, check if content contains form placeholders
  if (content.includes('form-embed-placeholder')) {
    // Use ContentWithForms for content with forms
    return (
      <ContentWithForms 
        htmlContent={content} 
        className={className}
        {...props}
      />
    );
  }

  // Configure HTML parser options for regular content
  const options: HTMLReactParserOptions = {
    replace: (domNode) => {
      // Only process Element nodes (not text nodes)
      if (domNode instanceof Element && domNode.name === 'img') {
        // Extract image attributes
        const props = attributesToProps(domNode.attribs);
        const src = props.src as string;
        const alt = props.alt as string || 'Forum image';
        
        // Custom class for forum content images
        const imgClass = `forum-content-image ${props.className || ''}`;

        // Return SmartImage component with production fallbacks
        return (
          <SmartImage
            src={src}
            alt={alt}
            className={imgClass}
            cacheBust={!allowCache}
            {...props}
          />
        );
      }

      // Process link elements to handle forum-media URLs
      if (domNode instanceof Element && domNode.name === 'a') {
        const props = attributesToProps(domNode.attribs);
        const href = props.href as string || '';
        
        // If link is to an image, wrap it with SmartImage
        if (href && 
            (href.includes('/forum-media/') || 
             href.includes('/uploads/forum-media/') ||
             href.endsWith('.jpg') || 
             href.endsWith('.jpeg') || 
             href.endsWith('.png') || 
             href.endsWith('.gif'))) {
          return (
            <a 
              {...props} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="block my-4"
            >
              <SmartImage
                src={href}
                alt="Forum attachment"
                className="max-w-full h-auto rounded-md"
                cacheBust={!allowCache}
              />
            </a>
          );
        }
      }

      return undefined;
    }
  };

  // Process the HTML content
  const processedContent = parse(content, options);

  return (
    <div className={containerClassName}>
      {processedContent}
    </div>
  );
};

export default ForumContent;