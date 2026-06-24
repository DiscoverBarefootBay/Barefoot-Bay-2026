// Test the new URL format
const COMPOUND_CATEGORIES = [
  'home-services',
  'technology-and-electronics', 
  'real-estate-senior-living',
  'insurance-financial-services',
  'hvac-and-air-quality',
  'moving-and-transportation',
  'new-homes-installation',
  'pressure-washing',
  'real-estate-and-senior-living',
  'pest-control'
];

function dbSlugToPublicUrl(slug) {
  if (!slug.startsWith('vendors-')) return slug;
  
  const withoutPrefix = slug.substring(8); // Remove 'vendors-'
  
  // Check compound categories first
  for (const compound of COMPOUND_CATEGORIES) {
    if (withoutPrefix.startsWith(`${compound}-`)) {
      const remainder = withoutPrefix.substring(compound.length + 1);
      return `/vendors/${compound}/${remainder}`;
    }
  }
  
  // For simple categories, split at first hyphen
  const firstHyphen = withoutPrefix.indexOf('-');
  if (firstHyphen === -1) return `/vendors/${withoutPrefix}`;
  
  const category = withoutPrefix.substring(0, firstHyphen);
  const name = withoutPrefix.substring(firstHyphen + 1);
  
  return `/vendors/${category}/${name}`;
}

console.log('Testing new URL formats:');
console.log('Input:', 'vendors-insurance-financial-services-ellen-jb-maxson-medicare-insurance-agent');
console.log('Output:', dbSlugToPublicUrl('vendors-insurance-financial-services-ellen-jb-maxson-medicare-insurance-agent'));
console.log('Expected: /vendors/insurance-financial-services/ellen-jb-maxson-medicare-insurance-agent');
console.log('');
console.log('Input:', 'vendors-pest-control-all-county-pest-control');
console.log('Output:', dbSlugToPublicUrl('vendors-pest-control-all-county-pest-control'));
console.log('Expected: /vendors/pest-control/all-county-pest-control');