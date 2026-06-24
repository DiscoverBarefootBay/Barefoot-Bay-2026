// Test the improved slug generation function
import { generateVendorSlug } from './shared/vendor-url-utils.ts';

console.log('🧪 Testing Improved Vendor Slug Generation...\n');

const testCases = [
  { title: 'Ellen JB Maxson (Medicare Insurance Agent)', category: 'insurance-financial-services' },
  { title: 'All County Pest Control', category: 'pest-control' },
  { title: 'John & Becky Boncek ReMax Crown', category: 'real-estate-senior-living' },
  { title: 'Computer Healthcare Solutions', category: 'technology-and-electronics' },
  { title: 'Professional Home Services', category: 'home-services' },
  { title: 'Air Quality Specialists', category: 'hvac-and-air-quality' }
];

testCases.forEach(({ title, category }) => {
  const slug = generateVendorSlug(title, category);
  console.log(`Title: "${title}"`);
  console.log(`Category: ${category}`);
  console.log(`Generated Slug: ${slug}`);
  console.log('---');
});