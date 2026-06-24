// Test BBRD similarity calculation
function calculateSimilarity(queryText, targetText) {
  const query = queryText.toLowerCase().trim();
  const target = targetText.toLowerCase().trim();
  
  // Exact match gets 100%
  if (query === target) return 100;
  
  // Check if query is completely contained in target
  if (target.includes(query)) {
    const coverage = query.length / target.length;
    return Math.min(98, 80 + (coverage * 18));
  }
  
  // Check if target is completely contained in query
  if (query.includes(target)) {
    return 95;
  }
  
  // Word-based matching
  const queryWords = query.split(/\s+/).filter(word => word.length > 2);
  const targetWords = target.split(/\s+/).filter(word => word.length > 2);
  
  if (queryWords.length === 0 || targetWords.length === 0) return 0;
  
  let matchingWords = 0;
  let totalWeight = 0;
  
  for (const queryWord of queryWords) {
    let bestMatch = 0;
    for (const targetWord of targetWords) {
      if (targetWord.includes(queryWord) || queryWord.includes(targetWord)) {
        const similarity = Math.min(queryWord.length, targetWord.length) / 
                          Math.max(queryWord.length, targetWord.length);
        bestMatch = Math.max(bestMatch, similarity);
      }
    }
    
    if (bestMatch > 0.5) {
      matchingWords++;
      totalWeight += bestMatch;
    }
  }
  
  if (matchingWords === 0) return 0;
  
  const coverage = matchingWords / queryWords.length;
  const avgWeight = totalWeight / matchingWords;
  
  return Math.round(coverage * avgWeight * 70);
}

// Test with BBRD data
const query = "BBRD";
const title = "Barefoot Bay Recreation District (BBRD)";
const content = `<div><h2>🏢 Barefoot Bay Recreation District (BBRD)</h2><div><br></div><div>Address:</div><div>625 Barefoot Blvd</div><div>Barefoot Bay, FL 32976</div><div>Main Phone: (772) 664-3141</div><div>Website: www.bbrd.org&nbsp;</div><div><br></div><div><br></div><div>👤 <b>Community Manager</b></div><div><b><br></b></div><div><b>Kent Cichon</b></div><div>Phone: (772) 664-3141</div><div>Email: kcichon@bbrd.org</div><div>Office Address: 625 Barefoot Blvd, Barefoot Bay, FL 32976</div><div><br></div><div>Overview: Oversees daily operations, strategic planning, and community engagement for BBRD.&nbsp;&nbsp;</div><div><br></div><div><b><br></b></div><div><b>📋 Office of the District Clerk</b></div><div><b><br></b></div><div><b>Cindy Mihalick</b> – District Clerk</div><div>Phone: (772) 664-3141</div><div>Email: cindy.mihalick@bbrd.org</div><div>Responsibilities: Maintains official records, meeting agendas, minutes, and oversees election information.&nbsp;&nbsp;</div><div><br></div><div><b><br></b></div><div><b>💼 Finance Office</b></div><div><b><br></b></div><div><b>Charles Henley</b> – Finance Manager</div><div>Phone: (772) 664-3141</div><div>Email: CharlesHenley@bbrd.org</div><div>Duties: Manages budgeting, financial reporting, and fiscal planning for the district.&nbsp;&nbsp;</div><div><br></div><div><br></div><div><b><br></b></div><div><b>🏠 Resident Relations</b></div><div><br></div><div>Phone: (772) 664-3141 ext. 203</div><div>Office Hours: Monday – Friday, 8:00 AM – 4:30 PM</div><div><br></div><div>Services:</div><div><ul><li>Deed of Restrictions (DOR) enforcement</li><li>Customer service inquiries</li><li>Badge renewals and guest passes</li><li>Address updates</li><li>Vehicle storage leasing</li><li>Job recruitment&nbsp;&nbsp;</li></ul></div></div><div><br></div><div>Website:</div><div><a href="https://www.bbrd.org">www.bbrd.org</a></div>`;

const titleScore = calculateSimilarity(query, title);
const contentScore = calculateSimilarity(query, content) * 0.7;
const maxScore = Math.max(titleScore, contentScore);

console.log("=== BBRD Similarity Test ===");
console.log(`Query: "${query}"`);
console.log(`Title: "${title}"`);
console.log(`Title Score: ${titleScore}`);
console.log(`Content Score: ${contentScore}`);
console.log(`Max Score: ${maxScore}`);
console.log(`Above threshold (15): ${maxScore > 15}`);
console.log(`Above threshold (30): ${maxScore > 30}`);