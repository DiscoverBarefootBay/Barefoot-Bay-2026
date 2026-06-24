/**
 * Test script for AI backup search functionality
 */

// Simple test to check if AI search module loads
console.log('Testing if GEMINI_API_KEY is available:', process.env.GEMINI_API_KEY ? 'YES' : 'NO');

import('./server/ai-backup-search.ts')
  .then(module => {
    console.log('Module loaded successfully');
    return module.performAIBackupSearch('Big Romans Pizza');
  })
  .then(results => {
    console.log('AI search results:', JSON.stringify(results, null, 2));
  })
  .catch(error => {
    console.error('Error:', error);
  });

async function testAISearch() {
  try {
    console.log('Testing AI backup search with "Big Romans Pizza"...');
    const results = await performAIBackupSearch('Big Romans Pizza');
    console.log('AI search results:', JSON.stringify(results, null, 2));
  } catch (error) {
    console.error('AI search test failed:', error);
  }
}

testAISearch();