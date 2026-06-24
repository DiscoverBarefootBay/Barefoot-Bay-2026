/**
 * This is a patch file to fix vendor media upload issues
 * 
 * To apply this fix, copy the editorContext props to both WysiwygEditor components:
 * 
 * 1. In the "Add New Vendor Page" dialog (around line 1201):
 * 
 * <WysiwygEditor 
 *   editorContent={field.value}
 *   setEditorContent={(value) => {
 *     field.onChange(value);
 *     setEditorContent(value);
 *     form.setValue("content", value, { shouldValidate: true });
 *   }}
 *   editorContext={{
 *     section: 'vendors',
 *     slug: form.getValues("slug") || 'vendor-new'
 *   }}
 * />
 * 
 * 2. In the "Edit Vendor Page" dialog (around line 1346):
 * 
 * <WysiwygEditor 
 *   editorContent={field.value}
 *   setEditorContent={(value) => {
 *     field.onChange(value);
 *     setEditorContent(value);
 *     form.setValue("content", value, { shouldValidate: true });
 *   }}
 *   editorContext={{
 *     section: 'vendors',
 *     slug: form.getValues("slug") || selectedPage?.slug || 'vendor-edit'
 *   }}
 * />
 */