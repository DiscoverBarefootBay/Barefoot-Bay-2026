#!/usr/bin/env node

/**
 * Test script to check all event search examples from the help modal
 */

import { performance } from 'perf_hooks';

// Event search examples from the help modal
const eventExamples = [
  "entertainment events this week",
  "social events with badge",
  "government meetings today",
  "events at pool pavilion",
  "no badge events this weekend",
  "Spring Festival 2025",
  "events on April 30th"
];

async function testEventSearch(query) {
  console.log(`\n🔍 Testing: "${query}"`);
  const start = performance.now();
  
  try {
    const response = await fetch(`http://localhost:5000/api/search?q=${encodeURIComponent(query)}`);
    const data = await response.json();
    
    const end = performance.now();
    const duration = Math.round(end - start);
    
    console.log(`⏱️  Time: ${duration}ms`);
    console.log(`📊 Total results: ${data.results.length}`);
    
    // Filter to only event results
    const eventResults = data.results.filter(result => result.type === 'event');
    console.log(`🎯 Event results: ${eventResults.length}`);
    
    if (eventResults.length === 0) {
      console.log(`❌ NO EVENT RESULTS FOUND`);
      
      // Check if other types of results were found
      const otherTypes = data.results.filter(result => result.type !== 'event');
      if (otherTypes.length > 0) {
        console.log(`   Found ${otherTypes.length} non-event results:`);
        otherTypes.forEach(result => {
          console.log(`   - ${result.type}: ${result.title}`);
        });
      }
      
      return false;
    }
    
    // Show found events
    console.log(`✅ Found ${eventResults.length} events:`);
    eventResults.forEach((event, index) => {
      console.log(`   ${index + 1}. ${event.title} (Score: ${event.score})`);
      if (event.metadata && event.metadata.startDate) {
        console.log(`      Date: ${event.metadata.startDate}`);
      }
      if (event.metadata && event.metadata.category) {
        console.log(`      Category: ${event.metadata.category}`);
      }
    });
    
    return true;
    
  } catch (error) {
    console.error(`❌ Error testing "${query}":`, error.message);
    return false;
  }
}

async function testAllEventExamples() {
  console.log('🧪 Testing all event search examples...\n');
  
  let passCount = 0;
  let failCount = 0;
  
  for (const query of eventExamples) {
    const passed = await testEventSearch(query);
    if (passed) {
      passCount++;
    } else {
      failCount++;
    }
    
    // Add a small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n📋 SUMMARY:');
  console.log(`✅ Passed: ${passCount}/${eventExamples.length}`);
  console.log(`❌ Failed: ${failCount}/${eventExamples.length}`);
  
  if (failCount > 0) {
    console.log('\n🔧 Event search needs fixing for these examples:');
    console.log('- Date filtering is not working correctly');
    console.log('- Events are dated 2026 but searches look for current dates');
    console.log('- Badge filtering is not implemented');
    console.log('- Location filtering is not implemented');
  }
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch('http://localhost:5000/api/auth/check');
    return response.ok;
  } catch (error) {
    console.error('❌ Server is not running on port 5000');
    console.error('   Please start the server first with: npm run dev');
    return false;
  }
}

// Run the tests
async function main() {
  if (await checkServer()) {
    await testAllEventExamples();
  }
}

main().catch(console.error);