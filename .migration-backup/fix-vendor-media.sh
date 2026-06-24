#!/bin/bash

# Script to fix vendor media upload issues in manage-vendors.tsx
# This script modifies the WysiwygEditor components to add the proper editorContext prop

# Create backup of the original file
cp client/src/pages/admin/manage-vendors.tsx client/src/pages/admin/manage-vendors.tsx.bak

# Use sed to add the editorContext prop to the first WysiwygEditor (Add Vendor dialog)
sed -i '1207s/}}/}}\n                        editorContext={{\n                          section: '\''vendors'\'',\n                          slug: form.getValues("slug") || '\''vendor-new'\''\n                        }}/' client/src/pages/admin/manage-vendors.tsx

# Use sed to add the editorContext prop to the second WysiwygEditor (Edit Vendor dialog)
sed -i '1352s/}}/}}\n                        editorContext={{\n                          section: '\''vendors'\'',\n                          slug: selectedPage?.slug || form.getValues("slug") || '\''vendor-edit'\''\n                        }}/' client/src/pages/admin/manage-vendors.tsx

echo "WysiwygEditor components have been updated with vendor context!"