/**
 * Deep investigation into the root cause of the "All County Pest Control" duplicate issue
 * This script will test different scenarios to understand what actually caused the problem
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Let's simulate different possible slug generation scenarios
function simulateOldSlugGeneration(title, category) {
  console.log(`\n=== Testing: Title="${title}", Category="${category}" ===`);
  
  // Scenario 1: Simple concatenation (no duplicate checking)
  const simpleConcat = `vendors-${category.toLowerCase().replace(/\s+/g, '-')}-${title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`;
  console.log(`Scenario 1 (Simple concatenation): ${simpleConcat}`);
  
  // Scenario 2: Category gets processed as "pest-control" first
  const categoryAsSlug = category.toLowerCase().replace(/&/g, 'and').replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  const titleAsSlug = title.toLowerCase().replace(/&/g, 'and').replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  const scenario2 = `vendors-${categoryAsSlug}-${titleAsSlug}`;
  console.log(`Scenario 2 (Both processed): ${scenario2}`);
  
  // Scenario 3: Category mapping issue
  const possibleMappings = {
    'pest': 'pest-control',
    'Pest': 'pest-control',
    'Pest Control': 'pest-control'
  };
  const mappedCategory = possibleMappings[category] || category;
  const scenario3 = `vendors-${mappedCategory}-${titleAsSlug}`;
  console.log(`Scenario 3 (Category mapping): ${scenario3}`);
  
  // Scenario 4: Double processing bug
  const doubleProcessed = `vendors-pest-control-${titleAsSlug}`;
  console.log(`Scenario 4 (Double processing): ${doubleProcessed}`);
  
  return {
    simpleConcat,
    bothProcessed: scenario2,
    categoryMapping: scenario3,
    doubleProcessed
  };
}

// Test with the actual data
async function investigateRootCause() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Deep investigation into "All County Pest Control" slug generation...\n');
    
    // Get current state
    const { rows } = await client.query(`
      SELECT id, slug, title, content, created_at, updated_at
      FROM page_contents 
      WHERE title = 'All County Pest Control'
    `);
    
    if (rows.length > 0) {
      const page = rows[0];
      console.log('Current state:');
      console.log(`ID: ${page.id}`);
      console.log(`Title: ${page.title}`);
      console.log(`Current slug: ${page.slug}`);
      console.log(`Created: ${page.created_at}`);
      console.log(`Updated: ${page.updated_at}`);
    }
    
    // Test different scenarios
    console.log('\n📋 Testing different slug generation scenarios:');
    
    // Test 1: What if category was "Pest"
    simulateOldSlugGeneration("All County Pest Control", "Pest");
    
    // Test 2: What if category was "Pest Control" 
    simulateOldSlugGeneration("All County Pest Control", "Pest Control");
    
    // Test 3: What if category was "pest-control"
    simulateOldSlugGeneration("All County Pest Control", "pest-control");
    
    // Check vendor categories table
    console.log('\n📊 Checking vendor categories...');
    const { rows: categories } = await client.query(`
      SELECT id, name, slug FROM vendor_categories 
      WHERE name ILIKE '%pest%' OR slug ILIKE '%pest%'
    `);
    
    if (categories.length > 0) {
      console.log('Found pest-related categories:');
      categories.forEach(cat => {
        console.log(`- ID: ${cat.id}, Name: "${cat.name}", Slug: "${cat.slug}"`);
      });
    } else {
      console.log('No pest-related categories found in vendor_categories table');
    }
    
    // Check for any historical data or patterns
    console.log('\n🔍 Looking for similar patterns...');
    const { rows: similarSlugs } = await client.query(`
      SELECT id, slug, title 
      FROM page_contents 
      WHERE slug LIKE '%pest%' OR slug LIKE '%control%'
    `);
    
    console.log(`Found ${similarSlugs.length} pages with pest/control in slug:`);
    similarSlugs.forEach(page => {
      console.log(`- "${page.title}" → ${page.slug}`);
    });
    
    // Analysis of the most likely scenario
    console.log('\n🎯 ROOT CAUSE ANALYSIS:');
    console.log('Based on the investigation, the most likely cause was:');
    
    if (page.slug === 'vendors-pest-all-county-control') {
      console.log('✓ Current slug is vendors-pest-all-county-control');
      console.log('✓ This suggests the category was "pest", not "pest-control"');
      console.log('✓ The duplicate "control" was removed from the title portion');
      console.log('✓ My original analysis was INCORRECT');
      console.log('\nActual root cause: The title "All County Pest Control" contained');
      console.log('"control" which matched with the category slug "pest-control"');
      console.log('causing duplication in the original faulty slug generation.');
    }
    
  } catch (error) {
    console.error('Investigation error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

investigateRootCause();