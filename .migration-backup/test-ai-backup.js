#!/usr/bin/env node

/**
 * Quick test script to verify AI backup search functionality
 */

import { performAIBackupSearch } from './server/ai-backup-search.js';

async function testAIBackupSearch() {
  console.log('Testing AI backup search...');
  
  try {
    console.log('1. Testing with "big romans pizza" query...');
    const results = await performAIBackupSearch("big romans pizza");
    console.log(`Results found: ${results.length}`);
    console.log('Results:', JSON.stringify(results, null, 2));
    
    if (results.length > 0) {
      console.log('✅ AI backup search is working!');
    } else {
      console.log('⚠️ AI backup search returned no results');
    }
    
  } catch (error) {
    console.error('❌ AI backup search failed:', error);
    console.error('Error details:', error.message);
  }
}

testAIBackupSearch().then(() => {
  console.log('Test completed');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});