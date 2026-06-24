/**
 * Shared vendor URL utilities for both client and server
 * This ensures consistent URL generation across the application
 */

// Known compound categories that need special handling
// This list MUST match the actual vendor category slugs from the database
export const COMPOUND_CATEGORIES = [
  // Multi-word categories with hyphens from the database
  'anchor-and-vapor-barrier',
  'automotive-golf-carts', 
  'beauty-personal-care',
  'food-dining',
  'funeral-and-religious-services',
  'health-and-medical',
  'home-improvement',
  'home-services',
  'hvac-and-air-quality',
  'insurance-financial-services',
  'moving-and-transportation',
  'new-homes-installation',
  'pest-control',
  'pressure-washing',
  'real-estate-senior-living',
  'retail-shops',
  'technology-and-electronics',
  // Single-word categories (for completeness)
  'landscaping',
  'plumbing', 
  'roofing'
];

/**
 * Detects if a page is a vendor page based on slug or other criteria
 */
export function isVendorPage(slug: string, title?: string): boolean {
  if (!slug) return false;
  
  // Direct slug check
  if (slug.startsWith('vendors-')) return true;
  
  // Check for vendor-related patterns in title if provided
  if (title && slug.includes('vendor')) return true;
  
  return false;
}

/**
 * Extracts vendor category from an existing vendor slug
 */
export function extractVendorCategory(vendorSlug: string): string | null {
  if (!vendorSlug.startsWith('vendors-')) return null;
  
  const withoutPrefix = vendorSlug.substring(8); // Remove 'vendors-'
  
  // Check compound categories first
  for (const compound of COMPOUND_CATEGORIES) {
    if (withoutPrefix.startsWith(`${compound}-`)) {
      return compound;
    }
  }
  
  // For simple categories, take the first part
  const parts = withoutPrefix.split('-');
  return parts.length > 0 ? parts[0] : null;
}

/**
 * Generates a slug from the title and category - preserves full descriptive titles
 */
export function generateVendorSlug(title: string, category: string): string {
  if (!title || !category) return '';
  
  // Check if category is already a valid slug format (lowercase with hyphens)
  const isAlreadySlug = category === category.toLowerCase() && 
                       !category.includes(' ') && 
                       !category.includes('&');
  
  let categorySlug: string;
  
  if (isAlreadySlug) {
    // Category is already in database slug format, use it directly
    categorySlug = category;
  } else {
    // Category is a display name, transform it to slug format
    categorySlug = category.toLowerCase()
      .replace(/&/g, 'and')     // Replace & with and
      .replace(/[^\w\s-]/g, '') // Remove special chars except hyphens
      .replace(/\s+/g, '-')     // Replace spaces with hyphens
      .replace(/-+/g, '-')      // Replace multiple hyphens with single hyphen
      .trim();                  // Trim leading/trailing spaces
  }
  
  // Format title to slug - preserve full descriptive information
  let titleSlug = title.toLowerCase()
    .replace(/\([^)]*\)/g, (match) => {
      // Extract content from parentheses and include descriptive parts
      const content = match.slice(1, -1).toLowerCase();
      if (content.includes('medicare') || content.includes('specialist') || 
          content.includes('expert') || content.includes('agent') || 
          content.includes('consultant') || content.includes('service')) {
        return ' ' + content;
      }
      return '';
    })
    .replace(/&/g, 'and')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  
  // Don't remove descriptive words - preserve full title for better URL readability
  // Only remove exact sequential duplicates at the beginning of title that match category
  const categoryWords = categorySlug.split('-').filter(word => word.length > 0);
  const titleWords = titleSlug.split('-').filter(word => word.length > 0);
  
  // Only remove category words if they appear at the start of title in exact sequence
  let cleanedTitleWords = titleWords;
  let categoryIndex = 0;
  
  for (let i = 0; i < titleWords.length && categoryIndex < categoryWords.length; i++) {
    if (titleWords[i] === categoryWords[categoryIndex]) {
      categoryIndex++;
    } else {
      break;
    }
  }
  
  // Only remove if we matched the entire category sequence at the start
  if (categoryIndex === categoryWords.length) {
    cleanedTitleWords = titleWords.slice(categoryIndex);
  }
  
  // If no words remain, keep the original title
  titleSlug = cleanedTitleWords.length > 0 ? cleanedTitleWords.join('-') : titleWords.join('-');
  
  // Ensure category is tracked for URL conversion
  if (categorySlug.includes('-') && !COMPOUND_CATEGORIES.includes(categorySlug)) {
    console.log(`📌 Adding new compound category to known list: ${categorySlug}`);
    COMPOUND_CATEGORIES.push(categorySlug);
  }
  
  return `vendors-${categorySlug}-${titleSlug}`;
}

/**
 * Auto-generates a vendor slug based on title and determines category from context
 */
export function autoGenerateVendorSlug(title: string, existingSlug?: string, categoryHint?: string): string | null {
  if (!title) return null;
  
  let category: string | null = null;
  
  // Try to get category from various sources in order of preference
  if (categoryHint) {
    category = categoryHint;
  } else if (existingSlug) {
    category = extractVendorCategory(existingSlug);
  }
  
  if (!category) {
    console.warn(`Cannot auto-generate vendor slug for "${title}" - no category information available`);
    return null;
  }
  
  return generateVendorSlug(title, category);
}

/**
 * Converts a database slug to a public URL format
 * @param slug Database slug format (eg: vendors-category-name)
 * @returns Public URL format (/vendors/category/name)
 */
export function dbSlugToPublicUrl(slug: string): string {
  if (!slug.startsWith('vendors-')) return slug;
  
  const withoutPrefix = slug.substring(8); // Remove 'vendors-'
  
  // Check compound categories first
  for (const compound of COMPOUND_CATEGORIES) {
    if (withoutPrefix.startsWith(`${compound}-`)) {
      const remainder = withoutPrefix.substring(compound.length + 1);
      return `/vendors/${compound}/${remainder}`;
    }
  }
  
  // For simple categories, split at first hyphen
  const firstHyphen = withoutPrefix.indexOf('-');
  if (firstHyphen === -1) return `/vendors/${withoutPrefix}`;
  
  const category = withoutPrefix.substring(0, firstHyphen);
  const name = withoutPrefix.substring(firstHyphen + 1);
  
  return `/vendors/${category}/${name}`;
}

/**
 * Converts a public URL to a database slug format
 * @param url Public URL format (/vendors/category/name)
 * @returns Database slug format (vendors-category-name)
 */
export function publicUrlToDbSlug(url: string): string {
  if (!url.startsWith('/vendors/')) return url;
  
  const pathParts = url.split('/').filter(Boolean);
  if (pathParts.length < 3) return url;
  
  const category = pathParts[1];
  const name = pathParts[2];
  
  return `vendors-${category}-${name}`;
}

/**
 * Determines if a slug needs to be repaired for consistency
 */
export function needsSlugRepair(slug: string): boolean {
  if (!slug.startsWith('vendors-')) return false;
  
  // Check for duplicate "vendors-" prefixes
  if (slug.includes('vendors-vendors-')) return true;
  
  // Check for malformed patterns like repeated category names
  const withoutPrefix = slug.substring(8);
  const parts = withoutPrefix.split('-');
  
  // Look for repeated patterns that suggest malformed slugs
  for (let i = 0; i < parts.length - 1; i++) {
    if (parts[i] === parts[i + 1] && parts[i].length > 2) {
      return true;
    }
  }
  
  return false;
}

/**
 * Repairs a malformed vendor slug
 */
export function repairVendorSlug(slug: string, category: string, title?: string): string {
  if (!slug.startsWith('vendors-')) return slug;
  
  // If we have title and category, just regenerate the slug properly
  if (title && category) {
    return generateVendorSlug(title, category);
  }
  
  // Otherwise, try to clean up the existing slug
  let cleanedSlug = slug;
  
  // Remove duplicate vendors- prefixes
  cleanedSlug = cleanedSlug.replace(/vendors-vendors-/g, 'vendors-');
  
  // Remove duplicate category patterns
  const withoutPrefix = cleanedSlug.substring(8);
  const parts = withoutPrefix.split('-');
  const dedupedParts = [];
  
  for (let i = 0; i < parts.length; i++) {
    if (i === 0 || parts[i] !== parts[i - 1]) {
      dedupedParts.push(parts[i]);
    }
  }
  
  return `vendors-${dedupedParts.join('-')}`;
}