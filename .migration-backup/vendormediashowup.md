# TinyMCE Media Insert Issue in Vendor Pages

## Problem Analysis

After analyzing the codebase, I've identified the root cause of the issue with TinyMCE image insertion on vendor pages:

When editing a vendor page (specifically `/vendors/landscaping/timber-creek-grounds`), the TinyMCE editor's "Insert Media" functionality is not working correctly - uploaded images appear in the media selection popup but do not get inserted into the editor content, and are also not visible after saving.

### Current Implementation Issues

1. **Missing Editor Context**: The WysiwygEditor component used in the vendor management page does not receive the `editorContext` prop, which is needed to properly route media uploads to the correct Object Storage bucket.

2. **Default Upload Endpoint**: Without the proper context, the TinyMCE editor falls back to using the forum media upload endpoint (`/api/forum/tinymce-upload`), which stores files in the FORUM bucket instead of the VENDORS bucket.

3. **Inconsistent Media URL Handling**: The vendor editor doesn't apply the same URL normalization that's present in other parts of the application, like the forum post editor.

4. **Media Insertion Process**: There appears to be an issue with how the media is inserted into the editor content after upload, possibly related to event handling in the TinyMCE editor.

## Solution

To fix this issue, several improvements are needed:

### 1. Pass the Correct Editor Context in Vendor Management

Update the `manage-vendors.tsx` file to pass the `editorContext` prop to the WysiwygEditor component:

```tsx
<FormField
  control={form.control}
  name="content"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Content</FormLabel>
      <FormControl>
        <WysiwygEditor 
          editorContent={field.value}
          setEditorContent={(value) => {
            field.onChange(value);
            setEditorContent(value);
            form.setValue("content", value, { shouldValidate: true });
          }}
          editorContext={{
            section: 'vendors',
            slug: form.getValues('slug') || 'vendor-new'
          }}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

This change ensures that the editor knows it's operating in the "vendors" context and will use the correct media upload endpoint.

### 2. Update Add Vendor Form with Context

Similarly, update the Add Vendor dialog's WysiwygEditor with the proper context:

```tsx
<FormField
  control={form.control}
  name="content"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Content</FormLabel>
      <FormControl>
        <WysiwygEditor 
          editorContent={field.value}
          setEditorContent={(value) => {
            field.onChange(value);
            setEditorContent(value);
            form.setValue("content", value, { shouldValidate: true });
          }}
          editorContext={{
            section: 'vendors',
            slug: 'vendor-new'
          }}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

### 3. Add Media URL Normalization to Vendor Editor

Ensure that any media URLs are properly normalized before insertion, similar to how it's done in the forum post editor:

```tsx
<MediaUploader 
  editorContext={{
    section: 'vendors',
    slug: form.getValues('slug') || 'vendor-new'
  }}
  onMediaInsert={(url, altText, styles, mediaType) => {
    // Fix any malformed URLs before inserting them
    let processedUrl = url;
    
    // If URL is in the format /uploads/api/storage-proxy/BUCKET/path - fix it
    if (url && url.startsWith('/uploads/api/storage-proxy/')) {
      processedUrl = url.replace('/uploads/api/storage-proxy/', '/api/storage-proxy/');
      console.log(`[MediaInsert] Fixed malformed URL: ${url} → ${processedUrl}`);
    }
    
    // Create the HTML for the media
    let mediaHtml = '';
    const styleAttr = styles 
      ? `style="width:${styles.width || '100%'};${styles.align ? `display:block;margin-left:${styles.align === 'center' || styles.align === 'right' ? 'auto' : '0'};margin-right:${styles.align === 'center' || styles.align === 'left' ? 'auto' : '0'};` : ''}"` 
      : '';
    
    if (mediaType === 'video') {
      mediaHtml = `<video src="${processedUrl}" controls ${styleAttr}></video>`;
    } else {
      mediaHtml = `<img src="${processedUrl}" alt="${altText || ''}" ${styleAttr} />`;
    }
    
    // Insert the media HTML into the editor
    const currentContent = editorContent || '';
    setEditorContent(currentContent + mediaHtml);
  }}
/>
```

### 4. Verify API Routes and Storage Proxy Configuration

Ensure that the `/api/vendor/tinymce-upload` endpoint is properly configured in the server routes:

```typescript
// Special endpoint for TinyMCE editor image uploads in vendor pages
app.post("/api/vendor/tinymce-upload", requireAuth, vendorUpload.single('file'), handleVendorMediaUpload);
```

And make sure the storage proxy is properly configured to handle vendor media URLs.

## Technical Implementation Steps

1. **Update manage-vendors.tsx**: Add editorContext to both the Add and Edit WysiwygEditor components
2. **Enhance WysiwygEditor**: Ensure it properly handles the vendor context 
3. **Add Media Uploader Component**: Add a dedicated media uploader to vendor forms if needed
4. **Test URL Normalization**: Verify that media URLs are properly formatted when inserted
5. **Verify Storage Bucket**: Confirm that media is being stored in the VENDORS bucket

## Expected Behavior After Fix

After implementing these changes:

1. When editing a vendor page, uploaded media should be stored in the VENDORS bucket
2. Uploaded images should appear in the TinyMCE editor immediately after selection
3. Media should be properly displayed on the vendor page after saving
4. The URL structure should consistently use `/api/storage-proxy/vendors/...` format

## Additional Considerations

- Consider adding debug logging to track the media upload and insertion process
- Implement error handling specifically for vendor media uploads
- Add validation to ensure the content has been properly updated with media
- Consider adding a media library specific to vendors for reusing images across vendor pages