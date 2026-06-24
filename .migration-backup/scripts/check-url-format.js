/**
 * Check URL Formats
 * 
 * This script helps identify various URL patterns in the database and display
 * statistics about how many records are using Object Storage URLs vs. legacy URLs.
 * 
 * Usage: node scripts/check-url-format.js
 */

require('dotenv').config();
const { pool } = require('../dist/server/db');

// Configure which tables and columns to check
const tableConfig = [
  { table: 'events', column: 'mediaUrl' },
  { table: 'forum_posts', column: 'mediaUrl' },
  { table: 'forum_comments', column: 'mediaUrl' },
  { table: 'vendors', column: 'logoUrl' },
  { table: 'vendors', column: 'bannerUrl' },
  { table: 'vendor_images', column: 'imageUrl' },
  { table: 'real_estate_listings', column: 'mainImageUrl' },
  { table: 'real_estate_images', column: 'imageUrl' },
  { table: 'banner_slides', column: 'imageUrl' },
  { table: 'content_pages', column: 'featuredImageUrl' },
  { table: 'users', column: 'avatarUrl' }
];

// URL pattern categories
const URL_PATTERNS = {
  objectStorage: /^\/api\/storage-proxy\/[A-Z_]+\//,
  uploads: /^\/uploads\//,
  direct: /^\/[a-z-]+\//,
  media: /^\/media\//,
  external: /^https?:\/\//,
  empty: /^$/,
  other: /.*/
};

// Function to analyze URLs in a specific table column
async function analyzeTableColumn(table, column) {
  const client = await pool.connect();
  
  try {
    // Get total count of records
    const countResult = await client.query(`SELECT COUNT(*) FROM "${table}"`);
    const totalRecords = parseInt(countResult.rows[0].count, 10);
    
    // Get records with non-null values in the column
    const nonNullResult = await client.query(
      `SELECT COUNT(*) FROM "${table}" WHERE "${column}" IS NOT NULL AND "${column}" != ''`
    );
    const nonNullCount = parseInt(nonNullResult.rows[0].count, 10);
    
    // Get sample of URLs for each pattern
    const results = await client.query(
      `SELECT "${column}" FROM "${table}" WHERE "${column}" IS NOT NULL AND "${column}" != '' LIMIT 1000`
    );
    
    // Analyze the URL patterns
    const urlStats = {
      objectStorage: 0,
      uploads: 0,
      direct: 0,
      media: 0,
      external: 0,
      empty: 0,
      other: 0
    };
    
    // Sample URLs for display
    const urlSamples = {
      objectStorage: [],
      uploads: [],
      direct: [],
      media: [],
      external: [],
      empty: [],
      other: []
    };
    
    // Analyze each URL
    results.rows.forEach(row => {
      const url = row[column];
      let matched = false;
      
      for (const [pattern, regex] of Object.entries(URL_PATTERNS)) {
        if (regex.test(url)) {
          urlStats[pattern]++;
          
          // Store sample URL if we don't have enough yet
          if (urlSamples[pattern].length < 3) {
            urlSamples[pattern].push(url);
          }
          
          matched = true;
          break;
        }
      }
      
      if (!matched) {
        urlStats.other++;
        if (urlSamples.other.length < 3) {
          urlSamples.other.push(url);
        }
      }
    });
    
    return {
      table,
      column,
      totalRecords,
      nonNullCount,
      urlStats,
      urlSamples
    };
  } catch (error) {
    console.error(`Error analyzing ${table}.${column}:`, error);
    return {
      table,
      column,
      error: error.message
    };
  } finally {
    client.release();
  }
}

// Main function to run the analysis
async function analyzeUrlFormats() {
  try {
    const results = [];
    
    for (const { table, column } of tableConfig) {
      console.log(`Analyzing ${table}.${column}...`);
      const result = await analyzeTableColumn(table, column);
      results.push(result);
      
      // Display the individual table results
      displayTableAnalysis(result);
    }
    
    // Summarize overall stats
    displaySummary(results);
  } catch (error) {
    console.error('Error during analysis:', error);
  } finally {
    await pool.end();
  }
}

// Function to display results for a single table column
function displayTableAnalysis(result) {
  if (result.error) {
    console.log(`\n⚠️ Error analyzing ${result.table}.${result.column}: ${result.error}`);
    return;
  }
  
  console.log(`\n=== ${result.table}.${result.column} ===`);
  console.log(`Total records: ${result.totalRecords}`);
  console.log(`Records with non-null ${result.column}: ${result.nonNullCount} (${Math.round(result.nonNullCount / result.totalRecords * 100)}%)`);
  
  if (result.nonNullCount === 0) {
    console.log('No data to analyze.');
    return;
  }
  
  // Display URL pattern stats
  console.log('\nURL Pattern Distribution:');
  
  for (const [pattern, count] of Object.entries(result.urlStats)) {
    if (count > 0) {
      const percentage = Math.round(count / result.nonNullCount * 100);
      const samples = result.urlSamples[pattern].map(s => `"${s}"`).join(', ');
      
      // Highlight Object Storage URLs as the "new" format
      const prefix = pattern === 'objectStorage' ? '✅' : '  ';
      console.log(`${prefix} ${pattern}: ${count} (${percentage}%) - Samples: ${samples}`);
    }
  }
  
  // Migration status
  const objectStoragePercentage = Math.round(result.urlStats.objectStorage / result.nonNullCount * 100);
  if (objectStoragePercentage === 100) {
    console.log('\n✅ All URLs are using Object Storage format.');
  } else if (objectStoragePercentage > 0) {
    console.log(`\n⚠️ Partial migration: ${objectStoragePercentage}% of URLs are using Object Storage format.`);
  } else {
    console.log('\n❌ No URLs are using Object Storage format yet. Migration needed.');
  }
}

// Function to display overall summary
function displaySummary(results) {
  // Filter out results with errors
  const validResults = results.filter(r => !r.error);
  
  // Calculate totals
  const totalRecordsWithUrls = validResults.reduce((sum, r) => sum + r.nonNullCount, 0);
  const totalObjectStorageUrls = validResults.reduce((sum, r) => sum + r.urlStats.objectStorage, 0);
  const totalNonObjectStorageUrls = totalRecordsWithUrls - totalObjectStorageUrls;
  
  // Display summary
  console.log('\n============ OVERALL SUMMARY ============');
  console.log(`Total records with URLs: ${totalRecordsWithUrls}`);
  console.log(`URLs using Object Storage format: ${totalObjectStorageUrls} (${Math.round(totalObjectStorageUrls / totalRecordsWithUrls * 100)}%)`);
  console.log(`URLs using legacy formats: ${totalNonObjectStorageUrls} (${Math.round(totalNonObjectStorageUrls / totalRecordsWithUrls * 100)}%)`);
  
  // Migration status
  console.log('\nMigration Status by Table:');
  
  for (const result of validResults) {
    if (!result.error && result.nonNullCount > 0) {
      const objectStoragePercentage = Math.round(result.urlStats.objectStorage / result.nonNullCount * 100);
      let status;
      
      if (objectStoragePercentage === 100) {
        status = '✅ 100% Migrated';
      } else if (objectStoragePercentage > 0) {
        status = `⚠️ ${objectStoragePercentage}% Migrated`;
      } else {
        status = '❌ 0% Migrated';
      }
      
      console.log(`${result.table}.${result.column}: ${status}`);
    }
  }
  
  console.log('=========================================');
}

// Run the analysis
analyzeUrlFormats().catch(console.error);