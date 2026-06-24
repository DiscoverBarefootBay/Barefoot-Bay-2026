/**
 * Vendor URL Converter Utility
 * 
 * This utility provides functions to convert between database slug format (with hyphens)
 * and public URL format (with slashes).
 * 
 * Key principles:
 * 1. The unique-identifier portion ALWAYS matches the vendor's TITLE field.
 * 2. When either TITLE or CATEGORY changes, the slug automatically updates.
 * 3. URL format is always /vendors/[category]/[unique-identifier] (with slashes)
 * 4. Database slug format is always vendors-[category]-[unique-identifier] (with hyphens)
 */

// Import shared utilities
import { 
  isVendorPage, 
  extractVendorCategory, 
  generateVendorSlug, 
  autoGenerateVendorSlug, 
  needsSlugRepair as sharedNeedsSlugRepair, 
  repairVendorSlug as sharedRepairVendorSlug,
  COMPOUND_CATEGORIES 
} from "@shared/vendor-url-utils";

/**
 * Converts a database slug to a public URL format
 * @param slug Database slug format (eg: vendors-category-name)
 * @returns Public URL format (/vendors/category/name)
 */
export function dbSlugToPublicUrl(slug: string): string {
  if (!slug) return 'vendors';
  if (!slug.startsWith('vendors-')) return `vendors/${slug}`;
  
  // All vendor URL conversions now use the universal approach
  // No special case handling for specific vendors is required
  
  // Handle all Technology-and-Electronics vendors consistently
  if (slug.startsWith('vendors-technology-and-electronics-')) {
    console.log('🔄 URL Converter: Standard handling for Technology vendor');
    const uniqueId = slug.substring('vendors-technology-and-electronics-'.length);
    return `vendors/technology-and-electronics/${uniqueId}`;
  }
  
  // Handle all Landscaping vendors consistently
  if (slug.startsWith('vendors-landscaping-')) {
    console.log('🔄 URL Converter: Standard handling for Landscaping vendor');
    const uniqueId = slug.substring('vendors-landscaping-'.length);
    return `vendors/landscaping/${uniqueId}`;
  }
  
  // Remove the 'vendors-' prefix
  const withoutPrefix = slug.substring(8);
  
  // Check for compound categories first - this is critical for correct URL formatting
  for (const compound of COMPOUND_CATEGORIES) {
    if (withoutPrefix.startsWith(`${compound}-`)) {
      // Get everything after the compound category as the unique identifier
      const uniqueIdentifier = withoutPrefix.substring(compound.length + 1);
      
      // Special handling for compound categories with detailed logging
      if (compound === 'technology-and-electronics') {
        console.log(`Technology vendor: ${slug} → vendors/technology-and-electronics/${uniqueIdentifier}`);
      }
      
      // Return without leading slash to prevent double-slash issues
      return `vendors/${compound}/${uniqueIdentifier}`;
    }
  }
  
  // If no compound category was found, split by first hyphen to separate category/identifier
  const parts = withoutPrefix.split('-');
  
  // Handle special case where there's only one part
  if (parts.length === 1) {
    return `vendors/${parts[0]}`;
  }
  
  // For non-compound categories, the first element is the category
  const category = parts[0];
  
  // Everything else is part of the unique identifier
  const uniqueIdentifier = parts.slice(1).join('-');
  
  // Do extra logging for debugging in case of common categories
  console.log(`Standard vendor: ${slug} → vendors/${category}/${uniqueIdentifier}`);
  
  // Return without leading slash to prevent double-slash issues
  return `vendors/${category}/${uniqueIdentifier}`;
}

/**
 * Converts a public URL to a database slug format
 * @param url Public URL format (/vendors/category/name)
 * @returns Database slug format (vendors-category-name)
 */
export function publicUrlToDbSlug(url: string): string {
  if (!url) return '';
  if (!url.startsWith('/vendors/')) return '';
  
  // Remove leading slash and split by remaining slashes
  const parts = url.substring(1).split('/');
  if (parts.length < 3) return '';
  
  // All vendor URL conversions now use the universal approach
  // No special case handling for specific vendors is required
  
  // Handle all technology vendors consistently, even when URL is broken into incorrect segments
  if ((parts[1] === 'technology' && parts[2] === 'and-electronics' && parts.length > 3) || 
      (parts[1] === 'technology' && parts[2] === 'and' && parts[3] === 'electronics' && parts.length > 4)) {
    
    // Get the proper uniqueIdentifier depending on URL format
    let uniqueIdentifier;
    if (parts[2] === 'and-electronics') {
      uniqueIdentifier = parts[3];
      console.log(`🛠️ URL to DB slug: Handling hyphenated technology URL format: ${uniqueIdentifier}`);
    } else {
      uniqueIdentifier = parts[4];
      console.log(`🛠️ URL to DB slug: Handling split technology URL format: ${uniqueIdentifier}`);
    }
    
    return `vendors-technology-and-electronics-${uniqueIdentifier}`;
  }
  
  // Handle technology-and-electronics as a compound category
  if (parts[1] === 'technology-and-electronics' && parts.length > 2) {
    console.log(`🛠️ URL to DB slug: Standard technology vendor conversion: ${parts[2]}`);
    return `vendors-technology-and-electronics-${parts[2]}`;
  }
  
  // Handle landscaping vendors specifically
  if (parts[1] === 'landscaping' && parts.length > 2) {
    console.log(`🛠️ URL to DB slug: Standard landscaping vendor conversion: ${parts[2]}`);
    return `vendors-landscaping-${parts[2]}`;
  }
  
  // The category is the middle part
  const category = parts[1];
  
  // The unique identifier is the last part
  const uniqueIdentifier = parts[2];
  
  // Check for compound categories with "and" that might be split incorrectly
  if (parts.length > 3 && parts[2] === 'and') {
    // This is likely a case like /vendors/category/and/name which should be 
    // vendors-category-and-name in the database
    return `vendors-${category}-and-${parts[3]}-${parts.slice(4).join('-')}`;
  }
  
  // Add extra logging for debugging all vendor URL conversions
  console.log(`🛠️ URL to DB slug: Converting standard URL: ${url} to vendors-${category}-${uniqueIdentifier}`);
  
  // Format as vendors-category-uniqueIdentifier
  return `vendors-${category}-${uniqueIdentifier}`;
}



// Re-export shared utilities for client-side compatibility
export { 
  isVendorPage, 
  extractVendorCategory, 
  generateVendorSlug, 
  autoGenerateVendorSlug, 
  needsSlugRepair, 
  repairVendorSlug,
  COMPOUND_CATEGORIES 
} from "@shared/vendor-url-utils";

