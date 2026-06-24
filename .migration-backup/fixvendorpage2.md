# Computer Healthcare Vendor Page Fix Analysis

## Issue Summary
The vendor page located at `/vendors/technology-and-electronics/computer-healthcare` loads successfully (URL is correctly parsed), but the content of the vendor is not displayed. The page shows a blank area where the vendor content should appear.

## Investigation Findings

### What Works
- URL construction and routing for the Computer Healthcare vendor is set up correctly
- URL slug formatting logic has been implemented to prevent URL issues
- Special case handling exists in both `vendor-url-converter.ts` and `generic-content-page.tsx`
- The vendor data exists in the database as confirmed with:
  - Slug: `vendors-technology-and-electronics-computer-healthcare`
  - Title: `Computer Healthcare`
  - Content: `<div>Computer Healthcare</div>\n772-581-0368`
  - Media URLs: `{/content-media/mediaFile-1745354565910-202837224.png}`

### What's Broken
The investigation revealed several potential issues that could prevent the vendor content from displaying:

1. **Data Fetching Issues**: The API request for the specific vendor page may be failing or returning incorrect data.
2. **Content Rendering Issues**: The content may be fetched correctly but not rendering properly in the `EditableContent` component.
3. **Database-to-Component Connection**: There could be a disconnect between the data in the database and how it's processed by the frontend.
4. **Caching Issues**: Stale or incorrect data may be cached in React Query's cache.
5. **Special Character Handling**: The slug contains hyphens that might not be properly processed when determining which content to display.

## Root Cause Analysis

The most likely issue is that the React Query cache for this vendor page isn't being properly populated or updated. When the page loads, the system fetches the slug `vendors-technology-and-electronics-computer-healthcare` from the server, but there may be issues with:

1. The slug transformation logic in `vendor-url-converter.ts` where special handling for compound categories occurs
2. Cache entry naming mismatch between what the app expects and what's actually stored
3. The query potentially returning empty data despite the database record existing

## Solution Plan

### 1. Fix Special Case Handling for Computer Healthcare

Create direct handling for the Computer Healthcare vendor in `generic-content-page.tsx` to explicitly fetch its content:

```typescript
// When Computer Healthcare is detected, ensure we use the exact slug
if (location === '/vendors/technology-and-electronics/computer-healthcare') {
  console.log('✅ Direct handling for Computer Healthcare vendor page');
  const exactSlug = 'vendors-technology-and-electronics-computer-healthcare';
  
  // Force fetch the content directly
  useEffect(() => {
    if (isFirstLoad.current) {
      console.log('🔄 Forcing direct content fetch for Computer Healthcare');
      fetch(`/api/pages/${exactSlug}`)
        .then(res => res.json())
        .then(content => {
          queryClient.setQueryData(["/api/pages", exactSlug], content);
          setIsFirstLoad(false);
        })
        .catch(err => {
          console.error('Failed to fetch Computer Healthcare content:', err);
        });
    }
  }, [exactSlug, queryClient]);
}
```

### 2. Add Debug Logging in API Endpoint

Enhance server-side logging to capture exactly what's happening with this specific vendor:

```typescript
// In server/routes.ts
if (fullSlug === 'vendors-technology-and-electronics-computer-healthcare') {
  console.log('🛑 DEBUGGING Computer Healthcare vendor request');
  console.log('Headers:', req.headers);
  console.log('Query params:', req.query);
  
  // Force direct database lookup for this specific vendor
  try {
    const vendorResult = await db.select()
      .from(pageContents)
      .where(eq(pageContents.slug, 'vendors-technology-and-electronics-computer-healthcare'))
      .limit(1);
      
    console.log('Direct DB query result:', vendorResult);
    
    if (vendorResult.length > 0) {
      return res.json(vendorResult[0]);
    }
  } catch (err) {
    console.error('Direct query for Computer Healthcare failed:', err);
  }
}
```

### 3. Add Cache Debugging and Clearing Code

Create a specific cache management system for this vendor:

```typescript
// In client/src/components/vendors/cache-manager.ts
export function clearVendorCache(queryClient, slug) {
  console.log(`🧹 Clearing cache for vendor: ${slug}`);
  queryClient.removeQueries({ queryKey: ["/api/pages", slug] });
  
  // Also clear any related caches
  queryClient.removeQueries({ queryKey: ["/api/pages"] });
  localStorage.removeItem(`vendor_cache_${slug}`);
}

// In vendor detail page component
useEffect(() => {
  if (location === '/vendors/technology-and-electronics/computer-healthcare') {
    clearVendorCache(queryClient, 'vendors-technology-and-electronics-computer-healthcare');
    // Immediately refetch after clearing
    refetch();
  }
}, [location]);
```

### 4. Create a Dedicated Component for Computer Healthcare

When special cases like this become problematic, sometimes it's most effective to create a dedicated component:

```typescript
// Add to client/src/components/vendors/computer-healthcare.tsx
import React, { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export function ComputerHealthcareVendor() {
  const queryClient = useQueryClient();
  const slug = 'vendors-technology-and-electronics-computer-healthcare';
  
  // Direct query with special handling
  const { data, isLoading } = useQuery({
    queryKey: ["/api/direct-vendor", slug],
    queryFn: async () => {
      const res = await fetch(`/api/pages/${slug}?debug=true`);
      if (!res.ok) throw new Error('Failed to fetch Computer Healthcare vendor');
      return res.json();
    },
    staleTime: 0,
    cacheTime: 0
  });
  
  if (isLoading) return <div>Loading Computer Healthcare vendor information...</div>;
  
  return (
    <div className="vendor-details">
      <h1 className="text-2xl font-bold">{data?.title || 'Computer Healthcare'}</h1>
      <div dangerouslySetInnerHTML={{ __html: data?.content || '<div>Computer Healthcare<br/>772-581-0368</div>' }} />
    </div>
  );
}

// Then use this component in generic-content-page.tsx for this specific vendor
{location === '/vendors/technology-and-electronics/computer-healthcare' ? (
  <ComputerHealthcareVendor />
) : (
  <EditableContent 
    slug={derivedSlug}
    content={content}
    defaultTitle={generateDefaultTitle()}
    defaultContent={``}
    titleReset={titleReset}
  />
)}
```

### 5. Direct Database Access API Endpoint

Create a special endpoint just for the troublesome vendor:

```typescript
// In server/routes.ts
app.get("/api/direct-vendor/computer-healthcare", async (req, res) => {
  try {
    console.log("Direct Computer Healthcare vendor access requested");
    const result = await db.select()
      .from(pageContents)
      .where(eq(pageContents.slug, 'vendors-technology-and-electronics-computer-healthcare'))
      .limit(1);
      
    if (result.length > 0) {
      return res.json(result[0]);
    } else {
      return res.status(404).json({ error: 'Vendor not found' });
    }
  } catch (err) {
    console.error("Error accessing Computer Healthcare vendor:", err);
    return res.status(500).json({ error: 'Database error' });
  }
});
```

## Implementation Strategy

1. First, implement the changes in **Solution 1** to add special case handling
2. Add the extended debugging in **Solution 2** 
3. Monitor the logs to pinpoint exactly where the breakdown is occurring
4. Based on findings, implement either **Solution 3**, **4**, or **5**

If the issue persists after these steps, consider:
- Recreating the vendor entry in the database
- Checking for potential data corruption
- Verifying that all frontend code paths correctly handle compound categories like "technology-and-electronics"

## Additional Recommendations

1. **Improve Error Handling**: Add more explicit error states in the EditableContent component to show when content fails to load
2. **Add Data Validation**: Validate the structure of content received from the API to ensure it matches what the component expects
3. **Implement Retry Logic**: Add a retry mechanism for API requests that might fail occasionally
4. **Create Content Fallbacks**: For important vendor pages, create fallback content that can be displayed if the database content fails to load
5. **Optimize Caching Strategy**: Review the React Query caching strategy to ensure it works correctly with compound slugs