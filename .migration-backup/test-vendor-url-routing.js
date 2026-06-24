/**
 * Test vendor URL routing and conversion between database slugs and public URLs
 */

import { generateVendorSlug, dbSlugToPublicUrl, publicUrlToDbSlug, extractVendorCategory } from './shared/vendor-url-utils.ts';

console.log('🧪 Testing Vendor URL Routing and Conversion...\n');

// Test cases based on the updated database slugs
const testCases = [
  {
    title: 'Ellen JB Maxson (Medicare Insurance Agent)',
    category: 'insurance-financial-services',
    expectedDbSlug: 'vendors-insurance-financial-services-ellen-jb-maxson-medicare-insurance-agent',
    expectedPublicUrl: '/vendors/insurance-financial-services/ellen-jb-maxson-medicare-insurance-agent'
  },
  {
    title: 'Barefoot Bay Beauty Salon & Barber - Patty Crockett',
    category: 'beauty-personal-care',
    expectedDbSlug: 'vendors-beauty-personal-care-barefoot-bay-beauty-salon-and-barber-patty-crockett',
    expectedPublicUrl: '/vendors/beauty-personal-care/barefoot-bay-beauty-salon-and-barber-patty-crockett'
  },
  {
    title: 'Aunt Louise\'s Pizzeria',
    category: 'food-and-dining',
    expectedDbSlug: 'vendors-food-aunt-louises-pizzeria',
    expectedPublicUrl: '/vendors/food/aunt-louises-pizzeria'
  },
  {
    title: 'Cleveland Clinic Indian River Hospital',
    category: 'health-and-wellness',
    expectedDbSlug: 'vendors-health-cleveland-clinic-indian-river-hospital',
    expectedPublicUrl: '/vendors/health/cleveland-clinic-indian-river-hospital'
  },
  {
    title: 'John & Becky Boncek - Re/Max Crown Realty',
    category: 'real-estate-senior-living',
    expectedDbSlug: 'vendors-real-estate-senior-living-john-and-becky-boncek-remax-crown-realty',
    expectedPublicUrl: '/vendors/real-estate-senior-living/john-and-becky-boncek-remax-crown-realty'
  }
];

console.log('=== Testing Slug Generation ===');
testCases.forEach(({ title, category, expectedDbSlug }, index) => {
  const generatedSlug = generateVendorSlug(title, category);
  const matches = generatedSlug === expectedDbSlug;
  
  console.log(`Test ${index + 1}: ${matches ? '✅' : '❌'}`);
  console.log(`  Title: "${title}"`);
  console.log(`  Category: ${category}`);
  console.log(`  Generated: ${generatedSlug}`);
  console.log(`  Expected:  ${expectedDbSlug}`);
  if (!matches) {
    console.log(`  ⚠️  MISMATCH!`);
  }
  console.log('');
});

console.log('=== Testing URL Conversion ===');
testCases.forEach(({ expectedDbSlug, expectedPublicUrl }, index) => {
  const publicUrl = dbSlugToPublicUrl(expectedDbSlug);
  const backToDbSlug = publicUrlToDbSlug(expectedPublicUrl);
  
  const urlMatches = publicUrl === expectedPublicUrl;
  const roundTripMatches = backToDbSlug === expectedDbSlug;
  
  console.log(`Test ${index + 1}: ${urlMatches && roundTripMatches ? '✅' : '❌'}`);
  console.log(`  DB Slug: ${expectedDbSlug}`);
  console.log(`  To Public URL: ${publicUrl}`);
  console.log(`  Expected URL:  ${expectedPublicUrl}`);
  console.log(`  Back to DB:    ${backToDbSlug}`);
  
  if (!urlMatches) {
    console.log(`  ⚠️  URL conversion mismatch!`);
  }
  if (!roundTripMatches) {
    console.log(`  ⚠️  Round-trip conversion failed!`);
  }
  console.log('');
});

console.log('=== Testing Category Extraction ===');
testCases.forEach(({ expectedDbSlug, category }, index) => {
  const extractedCategory = extractVendorCategory(expectedDbSlug);
  const matches = extractedCategory === category;
  
  console.log(`Test ${index + 1}: ${matches ? '✅' : '❌'}`);
  console.log(`  DB Slug: ${expectedDbSlug}`);
  console.log(`  Extracted: ${extractedCategory}`);
  console.log(`  Expected:  ${category}`);
  if (!matches) {
    console.log(`  ⚠️  Category extraction failed!`);
  }
  console.log('');
});

console.log('🎯 URL Routing Test Complete!');