import fs from 'fs';
const filePath = 'client/src/pages/admin/manage-pages.tsx';

let content = fs.readFileSync(filePath, 'utf8');

// Replace all occurrences of SECTION_CATEGORIES.map
content = content.replace(/SECTION_CATEGORIES\.map/g, 'communityCategories.map');

fs.writeFileSync(filePath, content);
console.log('Replacements completed.');
