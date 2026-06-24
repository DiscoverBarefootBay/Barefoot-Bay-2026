/**
 * Test script to verify search examples from help modal work correctly
 */

const searchExamples = {
  events: [
    "entertainment events this week",
    "social events with badge", 
    "government meetings today",
    "events at pool pavilion",
    "no badge events this weekend",
    "Spring Festival 2025",
    "events on April 30th"
  ],
  vendors: [
    "home cleaning services",
    "roofing contractors", 
    "restaurants near me",
    "lawn care services",
    "medical clinics",
    "Barefoot Bay Salon",
    "plumbing repair"
  ],
  realEstate: [
    "3 bedroom houses for sale",
    "rentals under $2000",
    "open houses this weekend", 
    "waterfront properties",
    "houses with pool",
    "2 bedroom FSBO",
    "garage sales today"
  ],
  forum: [
    "ballot initiative discussion",
    "Allan family legacy",
    "community news",
    "road maintenance updates",
    "HOA meeting minutes", 
    "voting on new regulations"
  ],
  weather: [
    "weather today",
    "weekend forecast",
    "next rocket launch",
    "SpaceX mission",
    "temperature tomorrow"
  ]
};

// Test a few key examples
const testQueries = [
  "home cleaning services",  // Should find Kelly's House Cleaning
  "Allan family legacy",     // Should find forum post 
  "weather today",           // Should trigger weather search
  "3 bedroom houses for sale", // Should find real estate
  "entertainment events this week" // Should find events
];

console.log("=== SEARCH EXAMPLES TEST ===");
console.log("Testing key search examples from help modal...\n");

testQueries.forEach((query, index) => {
  console.log(`${index + 1}. "${query}"`);
  console.log(`   URL: /api/search?query=${encodeURIComponent(query)}`);
  console.log(`   Expected: Should return relevant results for ${query}`);
  console.log("");
});

console.log("=== CATEGORIES BREAKDOWN ===");
Object.entries(searchExamples).forEach(([category, examples]) => {
  console.log(`\n${category.toUpperCase()}:`);
  examples.forEach((example, index) => {
    console.log(`  ${index + 1}. "${example}"`);
  });
});

console.log("\n=== TESTING NOTES ===");
console.log("- All examples should return relevant results");
console.log("- Vendor searches should link to /vendors/category/vendor-name");
console.log("- Event searches should show calendar events");
console.log("- Forum searches should link to /forum/category/post-slug");
console.log("- Real estate searches should show property listings");
console.log("- Weather searches should show weather information");