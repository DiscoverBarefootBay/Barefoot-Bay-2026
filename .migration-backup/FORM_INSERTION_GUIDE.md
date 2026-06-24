# Form Insertion Integration Guide

## Overview
The form insertion feature allows users to insert interactive forms directly into content using the WYSIWYG editor. Forms appear as placeholders in the editor and render as fully functional forms when content is displayed.

## How It Works

### 1. Editor Integration
- Form insertion button (📝) is available in the WYSIWYG editor toolbar
- Uses `FormInsertDialog` component to select existing forms or create new ones
- Inserts simple, contentEditable-friendly placeholders that persist across editor modes

### 2. Placeholder System
Forms are inserted as lightweight placeholders:
```html
<div class="form-embed-placeholder" 
     contenteditable="false" 
     data-form-id="123" 
     data-form-title="Contact Form"
     style="border: 2px dashed #ccc; padding: 16px; margin: 16px 0; border-radius: 8px; background: #f9f9f9; text-align: center; display: block;">
  <div style="color: #666; font-weight: 500;">📝 Interactive Form: Contact Form</div>
  <div style="color: #888; font-size: 12px; margin-top: 4px;">Form ID: 123 • Click to interact when published</div>
</div>
```

### 3. Content Processing
When content is displayed (not edited), placeholders are replaced with interactive forms:
- `form-content-processor.tsx` handles the conversion
- `EmbeddedFormRenderer` component renders the actual form
- Supports all form field types: text, email, textarea, select, radio, checkbox, date, file

## Usage in Different Components

### Forum Posts
```tsx
import { ContentWithForms } from '@/lib/form-content-processor';

// In your forum post component
<ContentWithForms 
  htmlContent={post.content} 
  className="prose max-w-none" 
/>
```

### Event Descriptions
```tsx
import { ContentWithForms } from '@/lib/form-content-processor';

// In your event component
<ContentWithForms 
  htmlContent={event.description} 
  className="event-description" 
/>
```

### Vendor Pages
```tsx
import { ContentWithForms } from '@/lib/form-content-processor';

// In your vendor page component
<ContentWithForms 
  htmlContent={vendor.description} 
  className="vendor-content" 
/>
```

## Manual Integration (Alternative Method)
If you prefer manual control over form rendering:

```tsx
import { extractFormPlaceholders } from '@/lib/form-content-processor';
import EmbeddedFormRenderer from '@/components/forms/embedded-form-renderer';

function MyContentComponent({ htmlContent }: { htmlContent: string }) {
  const formPlaceholders = extractFormPlaceholders(htmlContent);
  
  // Process content to remove placeholders
  let processedContent = htmlContent;
  formPlaceholders.forEach(placeholder => {
    processedContent = processedContent.replace(placeholder.fullMatch, '');
  });
  
  return (
    <div>
      <div dangerouslySetInnerHTML={{ __html: processedContent }} />
      {formPlaceholders.map((placeholder, index) => (
        <EmbeddedFormRenderer
          key={`form-${placeholder.formId}-${index}`}
          formId={placeholder.formId}
          formTitle={placeholder.formTitle}
        />
      ))}
    </div>
  );
}
```

## Form Submission
- Forms submit to `/api/forms/{formId}/submissions`
- Successful submissions show a success message with option to submit again
- Failed submissions show error messages
- All submissions are stored in the database and accessible via admin panel

## Styling
Forms use Tailwind CSS classes and follow the existing design system:
- Form containers have white background with border and shadow
- Fields use consistent input styling with focus states
- Success/error states have appropriate colors (green/red)
- Loading states show spinners and disable interactions

## Error Handling
- Missing forms show red-bordered error placeholders
- Network errors display user-friendly messages
- Form validation follows HTML5 standards
- Required fields are clearly marked with red asterisks

## Technical Notes
- Placeholders use `contenteditable="false"` to prevent editing
- Inline styles ensure consistent appearance across editor modes
- Form IDs are stored as data attributes for reliable extraction
- Content processing is optimized to minimize re-renders
- Components are properly memoized for performance

## Migration from Complex HTML
The old approach generated complex form HTML that was stripped by contentEditable. The new approach:
1. ✅ Works with visual editor mode switching
2. ✅ Persists across save/load cycles
3. ✅ Allows forms to be moved within content
4. ✅ Provides better user experience
5. ✅ Easier to maintain and debug