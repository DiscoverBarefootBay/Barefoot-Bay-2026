import React from 'react';
import { FormDescription } from "@/components/ui/form";

interface PageUrlPreviewProps {
  slug: string;
  categoryPrefix: string;
  getFormattedPageUrl: (slug: string, categoryPrefix: string) => string;
}

export function PageUrlPreview({ 
  slug, 
  categoryPrefix,
  getFormattedPageUrl 
}: PageUrlPreviewProps) {
  return (
    <FormDescription>
      {slug 
        ? `This will be used in the URL: ${getFormattedPageUrl(slug, categoryPrefix)}`
        : "Select a category to automatically generate the page URL"}
    </FormDescription>
  );
}