/**
 * Test script for URL normalization functions
 */
import { normalizeMediaUrl, normalizeMediaUrls } from './shared/url-normalizer.js';

// Test cases with different URL formats
const testUrls = [
  // Object Storage URLs
  'https://object-storage.replit.app/CALENDAR/events/test-image.jpg',
  'https://object-storage.replit.app/FORUM/media/forum-post.png',
  
  // Legacy uploads path
  '/uploads/calendar/old-event.jpg',
  '/uploads/forum/forum-image.png',
  
  // Direct paths
  '/calendar/direct-path.jpg',
  '/forum-media/direct-forum.png',
  
  // Already normalized paths
  '/api/storage-proxy/CALENDAR/events/already-normalized.jpg',
  '/api/storage-proxy/FORUM/media/already-normalized.png',
  
  // Edge cases
  '',
  null,
  undefined,
  '/path/with/no/context.jpg',
  '/api/storage-proxy/'
];

// Test individual URL normalization
console.log('=== Testing normalizeMediaUrl ===');
testUrls.forEach(url => {
  try {
    console.log(`Original: "${url}" → Normalized: "${normalizeMediaUrl(url, 'event')}"`);
  } catch (error) {
    console.error(`Error normalizing URL "${url}":`, error);
  }
});

// Test array normalization
console.log('\n=== Testing normalizeMediaUrls ===');
console.log(`Original: ${JSON.stringify(testUrls)} → Normalized: ${JSON.stringify(normalizeMediaUrls(testUrls, 'event'))}`);

// Test with some invalid values
console.log('\n=== Testing with invalid values ===');
console.log(`null array: ${JSON.stringify(normalizeMediaUrls(null, 'event'))}`);
console.log(`undefined array: ${JSON.stringify(normalizeMediaUrls(undefined, 'event'))}`);
console.log(`empty array: ${JSON.stringify(normalizeMediaUrls([], 'event'))}`);
console.log(`array with null items: ${JSON.stringify(normalizeMediaUrls([null, undefined, ''], 'event'))}`);