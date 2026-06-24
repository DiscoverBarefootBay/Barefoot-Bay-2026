/**
 * Base64 Image Processor
 * 
 * This utility handles extracting Base64 images from HTML content,
 * converting them to files, uploading them to Replit Object Storage,
 * and replacing the Base64 data with the URL to the file.
 */

import { Buffer } from 'buffer';
import { objectStorageService, BUCKETS, type BucketType } from './object-storage-service';
import { migrationService, SOURCE_TYPE, MIGRATION_STATUS } from './migration-service';
import { randomUUID } from 'crypto';

// Regular expressions to match Base64 images in HTML content
// This pattern catches various common Base64 image formats
// First pattern: standard src attribute with double or single quotes
const SRC_BASE64_REGEX = /src=["']data:image\/(png|jpeg|jpg|gif|webp|svg\+xml|bmp|tiff);base64,([^"']+)["']/g;

// Second pattern: data URLs in CSS background-image
const CSS_BASE64_REGEX = /background-image:\s*url\(["']?data:image\/(png|jpeg|jpg|gif|webp|svg\+xml|bmp|tiff);base64,([^"')]+)["']?\)/g;

// Third pattern: img tags with base64 sources - more permissive
const PERMISSIVE_BASE64_REGEX = /<img[^>]*src=["']data:image\/([^;]+);base64,([^"']+)["'][^>]*>/g;

// Fourth pattern: TinyMCE specific format with data-mce attributes
const TINYMCE_BASE64_REGEX = /data-mce-src=["']data:image\/([^;]+);base64,([^"']+)["']/g;

// Fifth pattern: TinyMCE generates these patterns when pasting images with data-mce-selected
const TINYMCE_PASTE_BASE64_REGEX = /<img[^>]*src=["']data:image\/([^;]+);base64,([^"']+)["'][^>]*data-mce-selected/g;

// Sixth pattern: More general TinyMCE pattern for newly pasted images (data-mce-* attributes)
const TINYMCE_GENERAL_BASE64_REGEX = /<img[^>]*src=["']data:image\/([^;]+);base64,([^"']+)["'][^>]*data-mce-[^>]*>/g;

/**
 * Process content with Base64 images
 * @param content HTML content with potential Base64 images
 * @param section Section identifier (community, calendar, etc.)
 * @returns Processed content with Base64 images replaced with Object Storage URLs
 */
export async function processBase64Images(content: string, section: string): Promise<string> {
  if (!content) return content;
  
  // Skip processing if no Base64 images found
  if (!content.includes('data:image')) return content;
  
  console.log(`[Base64Processor] Processing content for section: ${section}`);
  
  let matches;
  let processedContent = content;
  
  // Determine the appropriate bucket based on section
  let bucket: BucketType = BUCKETS.DEFAULT;
  let mediaType = 'content-media';
  
  // Normalize the section string for more reliable matching
  const normalizedSection = section.toLowerCase().trim();
  
  // Use more specific pattern matching to determine the section
  if (normalizedSection.includes('community') || normalizedSection.startsWith('nature') || normalizedSection.includes('wildlife')) {
    bucket = BUCKETS.COMMUNITY;
    mediaType = 'community';
  } else if (normalizedSection.includes('calendar') || normalizedSection.includes('event') || normalizedSection.includes('activities')) {
    bucket = BUCKETS.CALENDAR;
    mediaType = 'calendar';
  } else if (normalizedSection.includes('forum') || normalizedSection.includes('discussion')) {
    bucket = BUCKETS.FORUM;
    mediaType = 'forum';
  } else if (normalizedSection.includes('vendor') || normalizedSection.includes('service') || normalizedSection.includes('business')) {
    bucket = BUCKETS.VENDORS;
    mediaType = 'vendor';
  } else if (normalizedSection.includes('real-estate') || normalizedSection.includes('for-sale') || normalizedSection.includes('property') || normalizedSection.includes('home')) {
    bucket = BUCKETS.SALE;
    mediaType = 'real_estate';
  }
  
  console.log(`[Base64Processor] Normalized section "${normalizedSection}" mapped to bucket: ${bucket}`)
  
  console.log(`[Base64Processor] Using bucket: ${bucket}, mediaType: ${mediaType}`);

  // Helper function to process a base64 match
  const processMatch = async (format: string, base64Data: string, imgMatch: string, isCSS = false, isTinyMCE = false): Promise<string> => {
    try {
      // Validate inputs
      if (!format || !base64Data || !imgMatch) {
        console.error('[Base64Processor] Invalid match data:', { format, dataLength: base64Data?.length, matchLength: imgMatch?.length });
        return imgMatch; // Return original if invalid
      }
      
      // Normalize format (sometimes format might have additional parameters)
      const normalizedFormat = format.split(';')[0].trim();
      
      // Validate base64 data (checking for common issues)
      if (base64Data.length < 10 || base64Data.match(/[^A-Za-z0-9+/=]/)) {
        console.error('[Base64Processor] Invalid Base64 data detected:', { format, length: base64Data.length, sample: base64Data.substring(0, 20) });
        return imgMatch; // Return original if invalid
      }
      
      // Generate a unique filename
      const filename = `${mediaType}-${Date.now()}-${randomUUID().substring(0, 8)}.${normalizedFormat}`;
      
      // Convert Base64 to buffer
      let buffer: Buffer;
      try {
        buffer = Buffer.from(base64Data, 'base64');
        // Check if buffer is valid (more than just a few bytes)
        if (buffer.length < 10) {
          console.error(`[Base64Processor] Decoded buffer too small: ${buffer.length} bytes`);
          return imgMatch;
        }
      } catch (decodeError) {
        console.error('[Base64Processor] Error decoding Base64 data:', decodeError);
        return imgMatch;
      }
      
      console.log(`[Base64Processor] Converting Base64 image to file: ${filename} (${buffer.length} bytes)`);
      
      // Create migration record
      const sourceLocation = `base64-inline-content`;
      const storageKey = `${mediaType}/${filename}`;
      
      let migrationRecord;
      try {
        migrationRecord = await migrationService.createMigrationRecord({
          sourceType: SOURCE_TYPE.FILESYSTEM,
          sourceLocation,
          mediaBucket: bucket,
          mediaType,
          storageKey,
          migrationStatus: MIGRATION_STATUS.PENDING
        });
      } catch (migrationError) {
        console.error('[Base64Processor] Error creating migration record:', migrationError);
        // Continue without migration record
      }
      
      // Upload to object storage
      let url: string;
      try {
        url = await objectStorageService.uploadData(buffer, mediaType, filename, `image/${normalizedFormat}`);
      } catch (uploadError) {
        console.error('[Base64Processor] Error uploading image to storage:', uploadError);
        // Return a placeholder URL instead
        return isCSS 
          ? `background-image: url('/media-placeholder/${mediaType}.svg')`
          : isTinyMCE 
            ? `data-mce-src="/media-placeholder/${mediaType}.svg"`
            : `src="/media-placeholder/${mediaType}.svg"`;
      }
      
      // Update migration record if we created one
      if (migrationRecord) {
        try {
          await migrationService.updateMigrationStatus(
            migrationRecord.id,
            MIGRATION_STATUS.MIGRATED
          );
        } catch (updateError) {
          console.error('[Base64Processor] Error updating migration status:', updateError);
          // Continue anyway since the image was uploaded
        }
      }
      
      console.log(`[Base64Processor] Image uploaded to: ${url}`);
      
      // Return the appropriate replacement based on the match type
      if (isCSS) {
        return `background-image: url('${url}')`;
      } else if (isTinyMCE) {
        return `data-mce-src="${url}"`;
      } else {
        return `src="${url}"`;
      }
    } catch (error) {
      console.error(`[Base64Processor] Error processing Base64 image:`, error);
      return imgMatch; // Return original content on error
    }
  };
  
  // Process regular src attributes
  // Reusing matches variable declared above
  while ((matches = SRC_BASE64_REGEX.exec(content)) !== null) {
    const format = matches[1];
    const base64Data = matches[2];
    const imgMatch = matches[0];
    
    // Get the replacement URL
    const replacement = await processMatch(format, base64Data, imgMatch);
    
    // Replace Base64 data with Object Storage URL
    // Use a more targeted replacement to avoid replacing other identical matches
    const startPos = matches.index;
    const endPos = startPos + imgMatch.length;
    const before = processedContent.substring(0, startPos);
    const after = processedContent.substring(endPos);
    processedContent = before + replacement + after;
    
    // Reset the regex last index to continue from the current position
    SRC_BASE64_REGEX.lastIndex = startPos + replacement.length;
  }
  
  // Process CSS background-image URLs
  while ((matches = CSS_BASE64_REGEX.exec(processedContent)) !== null) {
    const format = matches[1];
    const base64Data = matches[2];
    const imgMatch = matches[0];
    
    // Get the replacement URL
    const replacement = await processMatch(format, base64Data, imgMatch, true);
    
    // Replace in the content
    const startPos = matches.index;
    const endPos = startPos + imgMatch.length;
    const before = processedContent.substring(0, startPos);
    const after = processedContent.substring(endPos);
    processedContent = before + replacement + after;
    
    // Reset the regex last index
    CSS_BASE64_REGEX.lastIndex = startPos + replacement.length;
  }
  
  // Process TinyMCE specific data-mce attributes
  while ((matches = TINYMCE_BASE64_REGEX.exec(processedContent)) !== null) {
    const format = matches[1];
    const base64Data = matches[2];
    const imgMatch = matches[0];
    
    // Get the replacement URL
    const replacement = await processMatch(format, base64Data, imgMatch, false, true);
    
    // Replace in the content
    const startPos = matches.index;
    const endPos = startPos + imgMatch.length;
    const before = processedContent.substring(0, startPos);
    const after = processedContent.substring(endPos);
    processedContent = before + replacement + after;
    
    // Reset the regex last index
    TINYMCE_BASE64_REGEX.lastIndex = startPos + replacement.length;
  }
  
  // Process TinyMCE newly pasted images with data-mce-selected attribute
  while ((matches = TINYMCE_PASTE_BASE64_REGEX.exec(processedContent)) !== null) {
    const format = matches[1];
    const base64Data = matches[2];
    const fullImgTag = matches[0];
    
    try {
      console.log(`[Base64Processor] Processing newly pasted TinyMCE image with format: ${format}`);
      
      // Create a URL for the image
      const replacement = await processMatch(format, base64Data, fullImgTag);
      
      // Replace only the src attribute within the img tag
      let updatedTag = fullImgTag.replace(/src=["']data:image\/[^"']+["']/, replacement);
      
      // Replace in the content
      const startPos = matches.index;
      const endPos = startPos + fullImgTag.length;
      const before = processedContent.substring(0, startPos);
      const after = processedContent.substring(endPos);
      processedContent = before + updatedTag + after;
      
      // Reset the regex last index
      TINYMCE_PASTE_BASE64_REGEX.lastIndex = startPos + updatedTag.length;
    } catch (error) {
      console.error(`[Base64Processor] Error processing newly pasted TinyMCE image:`, error);
      // Continue with the next match
      TINYMCE_PASTE_BASE64_REGEX.lastIndex = matches.index + fullImgTag.length;
    }
  }
  
  // Process TinyMCE more general images with data-mce-* attributes
  while ((matches = TINYMCE_GENERAL_BASE64_REGEX.exec(processedContent)) !== null) {
    const format = matches[1];
    const base64Data = matches[2];
    const fullImgTag = matches[0];
    
    try {
      console.log(`[Base64Processor] Processing general TinyMCE image with format: ${format}`);
      
      // Create a URL for the image
      const replacement = await processMatch(format, base64Data, fullImgTag);
      
      // Replace only the src attribute within the img tag
      let updatedTag = fullImgTag.replace(/src=["']data:image\/[^"']+["']/, replacement);
      
      // Replace in the content
      const startPos = matches.index;
      const endPos = startPos + fullImgTag.length;
      const before = processedContent.substring(0, startPos);
      const after = processedContent.substring(endPos);
      processedContent = before + updatedTag + after;
      
      // Reset the regex last index
      TINYMCE_GENERAL_BASE64_REGEX.lastIndex = startPos + updatedTag.length;
    } catch (error) {
      console.error(`[Base64Processor] Error processing general TinyMCE image:`, error);
      // Continue with the next match
      TINYMCE_GENERAL_BASE64_REGEX.lastIndex = matches.index + fullImgTag.length;
    }
  }
  
  // Process full img tags that contain base64 data as a last resort
  // This is more aggressive and should be used last
  while ((matches = PERMISSIVE_BASE64_REGEX.exec(processedContent)) !== null) {
    const format = matches[1];
    const base64Data = matches[2];
    const fullImgTag = matches[0];
    
    try {
      // Create a URL for the image
      const replacement = await processMatch(format, base64Data, fullImgTag);
      
      // Replace only the src attribute within the img tag
      let updatedTag = fullImgTag.replace(/src=["']data:image\/[^"']+["']/, replacement);
      
      // Replace in the content
      const startPos = matches.index;
      const endPos = startPos + fullImgTag.length;
      const before = processedContent.substring(0, startPos);
      const after = processedContent.substring(endPos);
      processedContent = before + updatedTag + after;
      
      // Reset the regex last index
      PERMISSIVE_BASE64_REGEX.lastIndex = startPos + updatedTag.length;
    } catch (error) {
      console.error(`[Base64Processor] Error processing img tag:`, error);
      // Continue with the next match
      PERMISSIVE_BASE64_REGEX.lastIndex = matches.index + fullImgTag.length;
    }
  }
  
  return processedContent;
}