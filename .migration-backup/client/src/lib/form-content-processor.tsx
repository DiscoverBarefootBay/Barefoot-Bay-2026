import React from 'react';
import EmbeddedFormRenderer from '@/components/forms/embedded-form-renderer';

/**
 * Content processor that replaces form placeholders with interactive forms
 * This is similar to how media processing works in the content pipeline
 */

interface FormPlaceholderMatch {
  fullMatch: string;
  formId: number;
  formTitle?: string;
}

/**
 * Extract form placeholders from HTML content
 */
export function extractFormPlaceholders(htmlContent: string): FormPlaceholderMatch[] {
  const formPlaceholders: FormPlaceholderMatch[] = [];
  console.log('[extractFormPlaceholders] Processing HTML content');
  
  // Create a temporary div to parse HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  
  // Find all form placeholder elements
  const placeholderElements = tempDiv.querySelectorAll('.form-embed-placeholder[data-form-id]');
  console.log(`[extractFormPlaceholders] Found ${placeholderElements.length} placeholder elements`);
  
  placeholderElements.forEach((element, index) => {
    const formId = parseInt(element.getAttribute('data-form-id') || '0', 10);
    const formTitle = element.getAttribute('data-form-title') || undefined;
    console.log(`[extractFormPlaceholders] Element ${index}: formId=${formId}, formTitle=${formTitle}`);
    
    if (formId > 0) {
      formPlaceholders.push({
        fullMatch: element.outerHTML,
        formId,
        formTitle
      });
    }
  });
  
  console.log(`[extractFormPlaceholders] Extracted ${formPlaceholders.length} valid form placeholders`);
  return formPlaceholders;
}

/**
 * Process HTML content to replace form placeholders with React components
 * Returns both the processed HTML and the form components to render
 */
export function processFormContent(htmlContent: string) {
  const formPlaceholders = extractFormPlaceholders(htmlContent);
  const formComponents: JSX.Element[] = [];
  let processedContent = htmlContent;
  
  formPlaceholders.forEach((placeholder, index) => {
    // Create a unique marker for this form
    const formMarker = `__FORM_PLACEHOLDER_${index}__`;
    
    // Replace the placeholder HTML with the marker
    processedContent = processedContent.replace(placeholder.fullMatch, formMarker);
    
    // Create the form component
    const formComponent = (
      <EmbeddedFormRenderer
        key={`form-${placeholder.formId}-${index}`}
        formId={placeholder.formId}
        formTitle={placeholder.formTitle}
      />
    );
    
    formComponents.push(formComponent);
  });
  
  return {
    processedContent,
    formComponents,
    formPlaceholders
  };
}

/**
 * Split content by form markers and create an array of content chunks and form components
 * This allows proper React rendering with embedded forms
 */
export function createContentWithForms(htmlContent: string): (string | JSX.Element)[] {
  const { processedContent, formComponents, formPlaceholders } = processFormContent(htmlContent);
  
  if (formPlaceholders.length === 0) {
    return [htmlContent];
  }
  
  const contentParts: (string | JSX.Element)[] = [];
  let remainingContent = processedContent;
  
  formComponents.forEach((formComponent, index) => {
    const marker = `__FORM_PLACEHOLDER_${index}__`;
    const markerIndex = remainingContent.indexOf(marker);
    
    if (markerIndex !== -1) {
      // Add content before the form
      const beforeForm = remainingContent.substring(0, markerIndex);
      if (beforeForm.trim()) {
        contentParts.push(beforeForm);
      }
      
      // Add the form component
      contentParts.push(formComponent);
      
      // Update remaining content
      remainingContent = remainingContent.substring(markerIndex + marker.length);
    }
  });
  
  // Add any remaining content
  if (remainingContent.trim()) {
    contentParts.push(remainingContent);
  }
  
  return contentParts;
}

/**
 * React component that renders content with embedded forms
 */
interface ContentWithFormsProps {
  htmlContent: string;
  className?: string;
}

export function ContentWithForms({ htmlContent, className = '' }: ContentWithFormsProps) {
  console.log('[ContentWithForms] Received content:', htmlContent.substring(0, 200) + '...');
  console.log('[ContentWithForms] Contains form placeholder:', htmlContent.includes('form-embed-placeholder'));
  
  const contentParts = createContentWithForms(htmlContent);
  console.log('[ContentWithForms] Generated content parts:', contentParts.length);
  
  return (
    <div className={className}>
      {contentParts.map((part, index) => {
        if (typeof part === 'string') {
          return (
            <div
              key={`content-${index}`}
              dangerouslySetInnerHTML={{ __html: part }}
            />
          );
        } else {
          // It's a React component (form)
          console.log(`[ContentWithForms] Rendering form component at index ${index}`);
          return <div key={`form-${index}`}>{part}</div>;
        }
      })}
    </div>
  );
}