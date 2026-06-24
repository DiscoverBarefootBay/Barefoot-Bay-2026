# Vendor Page Media Deletion Issue

## Problem Description

Users are unable to delete media on vendor pages like `/vendors/landscaping/timber-creek-grounds`. When attempting to delete an image through the TinyMCE editor, the image automatically reappears as if something on the backend is repopulating the deleted content.

## Investigation Results

### Root Cause

After a thorough investigation of the codebase, I've identified several interconnected issues that are causing the media deletion problem:

1. **Client-Side Caching and Persistence**: The application implements an aggressive client-side caching and persistence mechanism specifically for vendor pages.

2. **LocalStorage Persistence**: The `generic-content-page.tsx` component stores vendor content in localStorage to improve loading performance.

3. **Content Versions Restoration**: The content version management system has special handling for vendor pages that attempts to recover/restore previous content.

4. **Multiple Slug Format Support**: The application supports multiple slug formats for vendor pages and tries different variations to ensure content is found.

5. **Content Overwriting**: When a user edits a vendor page and deletes media, the client-side cache might be overwriting the edited version with a persisted version.

## Code Analysis

### Client-Side Persistence

In `client/src/pages/generic-content-page.tsx`, vendor content is specifically persisted to localStorage:

```javascript
// Store content in persisted storage when it changes
useEffect(() => {
  if (!content || !derivedSlug || !derivedSlug.startsWith('vendors-')) return;
  
  console.log(`📦 [GenericContentPage] Storing vendor content for "${derivedSlug}" in persistent storage`);
  setPersistedVendorContent(prev => {
    const updated = { ...prev, [derivedSlug]: content };
    
    // Save to localStorage
    try {
      localStorage.setItem('persistedVendorContent', JSON.stringify(updated));
    } catch (e) {
      console.error("Error saving persisted vendor content:", e)
    }
    
    return updated;
  });
}, [content, derivedSlug]);
```

### Content Recovery Mechanism

When editing a vendor page, there's a recovery mechanism that attempts to restore content from different sources:

```javascript
// Check if we need to pre-populate content from persisted storage
useEffect(() => {
  if (!derivedSlug || !derivedSlug.startsWith('vendors-')) return;
  
  // Check if we have persisted content for this vendor
  const persistedContent = persistedVendorContent[derivedSlug];
  if (persistedContent) {
    console.log(`🔄 [GenericContentPage] Using persisted content for "${derivedSlug}":`, persistedContent);
    
    // Prime the React Query cache with the persisted content
    queryClient.setQueryData(["/api/pages", derivedSlug], persistedContent);
  }
}, [derivedSlug, persistedVendorContent, queryClient]);
```

### Vendor Content Refresh Events

The application has a custom event system for refreshing vendor content that might be overriding user edits:

```javascript
// Dispatch a custom event to notify the vendor page of the content update
const vendorRefreshEvent = new CustomEvent('vendor-content-refreshed', {
  detail: { slug: freshContent.slug }
});
window.dispatchEvent(vendorRefreshEvent);
```

### Multiple Data Sources Override Each Other

There are multiple mechanisms trying to ensure vendor content is always available, but they conflict when trying to delete content:

1. **TinyMCE Editor**: Allows deleting images
2. **localStorage Cache**: Restores old content with images
3. **React Query Cache**: May contain outdated content
4. **Server-Side Storage**: The authoritative source 

## The Specific Issue with Image Deletion

When a user deletes an image in the TinyMCE editor and saves the vendor page:

1. The user removes the image in the editor
2. The editor content is updated without the image
3. The user clicks save
4. The save operation updates the database correctly (without the image)
5. **BUT**: The client-side cache or localStorage persistence mechanism immediately restores a previous version of the content that still contains the image
6. When the page rerenders, it pulls from the localStorage/cache instead of the freshly saved server data

## Solution Plan

1. **Disable LocalStorage Persistence for Edit Sessions**:
   - Modify the persistence mechanism to not restore content during active editing sessions
   - Clear localStorage cache after successful saves

2. **Fix TinyMCE Editor Content Handling**:
   - Ensure the TinyMCE editor always respects the latest saved content
   - Prevent automatic content restoration during editing

3. **Improve Cache Invalidation**:
   - Properly invalidate React Query cache after content is saved
   - Force a fresh fetch from the server after saving changes

4. **Add Debug Logging**:
   - Add more detailed logging around content saving and retrieval
   - Track when and where content is being restored from cache vs server

## Implementation Steps

### 1. Fix LocalStorage Handling

Modify `client/src/pages/generic-content-page.tsx` to clear the localStorage cache after a save:

```javascript
// After successful content save
const handleSuccessfulSave = (savedContent) => {
  // Clear the localStorage cache for this vendor
  setPersistedVendorContent(prev => {
    const updated = { ...prev };
    delete updated[derivedSlug];
    
    // Update localStorage
    try {
      localStorage.setItem('persistedVendorContent', JSON.stringify(updated));
    } catch (e) {
      console.error("Error updating persisted vendor content:", e);
    }
    
    return updated;
  });
  
  // Force a fresh fetch from the server
  queryClient.invalidateQueries({ queryKey: ["/api/pages", derivedSlug] });
};
```

### 2. Modify EditableContent Component

Update `client/src/components/shared/editable-content.tsx` to ignore cached content during editing:

```javascript
// In the save content function
const saveContent = async () => {
  // ... existing code
  
  try {
    const result = await apiRequest(`/api/pages/${content.id}`, {
      method: "PUT",
      data: contentToSave,
    });
    
    // After successful save, clear any cached versions
    queryClient.invalidateQueries({ queryKey: ["/api/pages", pageSlug] });
    
    // If this is a vendor page, also clear localStorage cache
    if (pageSlug?.startsWith('vendors-')) {
      try {
        const persistedContent = JSON.parse(localStorage.getItem('persistedVendorContent') || '{}');
        delete persistedContent[pageSlug];
        localStorage.setItem('persistedVendorContent', JSON.stringify(persistedContent));
      } catch (e) {
        console.error("Error clearing persisted vendor content:", e);
      }
    }
    
    // ... rest of existing code
  }
};
```

### 3. Update Content Version Handling

Modify `client/src/hooks/use-content-versions.tsx` to prevent overriding edited content:

```javascript
// Add a flag to track when content is being edited
const [isEditing, setIsEditing] = useState(false);

// Modify content restoration to respect editing state
const restoreVersion = async (versionId: number) => {
  // ... existing code
  
  // Mark as editing to prevent auto-refresh
  setIsEditing(true);
  
  // Add cleanup function to reset editing state
  return () => {
    setIsEditing(false);
  };
};

// Update the vendor refresh event listener
useEffect(() => {
  const handleVendorRefresh = (event) => {
    // Skip if we're currently editing
    if (isEditing) {
      console.log('Ignoring vendor refresh event during editing');
      return;
    }
    
    // ... existing refresh handling
  };
  
  // ... event registration and cleanup
}, [isEditing]);
```

### 4. Verify TinyMCE Editor Context

Ensure the TinyMCE editor correctly handles image URLs for vendor pages:

```javascript
<WysiwygEditor 
  editorContent={editorContent}
  setEditorContent={setEditorContent}
  editorContext={{
    section: 'vendors',
    slug: pageSlug || slug
  }}
/>
```

## Testing the Solution

After implementing these changes, testing should include:

1. Loading a vendor page and verifying initial content is correct
2. Editing the page to delete an image and saving changes
3. Refreshing the page to ensure the image remains deleted
4. Testing across different browsers to ensure localStorage is properly cleared
5. Verifying that content versions are correctly maintained

## Conclusion

The issue stems from the application's robust content persistence mechanisms that were designed to ensure vendor content is always available, even in edge cases. While these mechanisms improve reliability in most scenarios, they create a conflict when intentionally deleting content.

The proposed solution maintains the benefits of content persistence while fixing the specific issue with media deletion by ensuring that freshly saved content always takes precedence over cached or persisted content.