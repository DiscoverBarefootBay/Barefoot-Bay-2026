/**
 * Comprehensive Vendor Categorization Fix
 * 
 * This script fixes ALL vendor categorization issues by properly mapping
 * existing vendor pages to their correct categories using slug patterns.
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixAllVendorCategorization() {
  try {
    console.log('🔧 Starting comprehensive vendor categorization fix...\n');
    
    // Get all vendor categories
    const { rows: categories } = await pool.query(`
      SELECT id, name, slug FROM vendor_categories ORDER BY name
    `);
    
    // Get all vendor pages
    const { rows: vendorPages } = await pool.query(`
      SELECT id, title, slug, content, media_urls, is_hidden, updated_by, created_at
      FROM page_contents 
      WHERE slug LIKE 'vendors-%' 
      AND slug != 'vendors-main' 
      AND slug != 'vendors'
      ORDER BY slug
    `);
    
    console.log(`Found ${vendorPages.length} vendor pages to process...\n`);
    
    // Category mapping logic - defines how to detect and fix each category
    const categoryMappings = [
      {
        category: 'anchor-and-vapor-barrier',
        patterns: ['vendors-anchor-', 'anchor', 'vapor', 'barrier'],
        titleKeywords: ['anchor', 'vapor', 'barrier', 'underhome']
      },
      {
        category: 'automotive-golf-carts',
        patterns: ['vendors-automotive-', 'golf-cart', 'golf cart'],
        titleKeywords: ['golf cart', 'automotive', 'cart', 'battery']
      },
      {
        category: 'beauty-personal-care',
        patterns: ['vendors-beauty-', 'salon', 'barber', 'hair', 'nails'],
        titleKeywords: ['beauty', 'salon', 'barber', 'hair', 'nails', 'spa', 'wigs']
      },
      {
        category: 'food-dining',
        patterns: ['vendors-food-', 'restaurant', 'pizza', 'cafe', 'bakery'],
        titleKeywords: ['pizza', 'restaurant', 'cafe', 'bakery', 'food', 'dining']
      },
      {
        category: 'funeral-and-religious-services',
        patterns: ['vendors-funeral-', 'church', 'religious'],
        titleKeywords: ['funeral', 'church', 'religious', 'crematory', 'methodist']
      },
      {
        category: 'hvac-and-air-quality',
        patterns: ['vendors-hvac-', 'air-conditioning', 'heating'],
        titleKeywords: ['hvac', 'air conditioning', 'heating', 'cooling', 'air quality']
      },
      {
        category: 'health-and-medical',
        patterns: ['vendors-health-', 'medical', 'dental', 'doctor'],
        titleKeywords: ['health', 'medical', 'dental', 'doctor', 'clinic', 'therapy']
      },
      {
        category: 'home-improvement',
        patterns: ['vendors-home-improvement-', 'improvement', 'renovation'],
        titleKeywords: ['improvement', 'renovation', 'remodeling', 'construction']
      },
      {
        category: 'home-services',
        patterns: ['vendors-home-services-', 'cleaning', 'maintenance'],
        titleKeywords: ['cleaning', 'maintenance', 'handyman', 'repair']
      },
      {
        category: 'insurance-financial-services',
        patterns: ['vendors-insurance-', 'financial', 'medicare'],
        titleKeywords: ['insurance', 'financial', 'medicare', 'agent']
      },
      {
        category: 'landscaping',
        patterns: ['vendors-landscaping-', 'lawn', 'tree', 'garden'],
        titleKeywords: ['landscaping', 'lawn', 'tree', 'garden', 'irrigation']
      },
      {
        category: 'moving-and-transportation',
        patterns: ['vendors-moving-', 'transportation', 'storage'],
        titleKeywords: ['moving', 'transportation', 'storage', 'shipping']
      },
      {
        category: 'new-homes-installation',
        patterns: ['vendors-new-', 'mobile home', 'installation'],
        titleKeywords: ['new homes', 'mobile home', 'installation', 'homes']
      },
      {
        category: 'pest-control',
        patterns: ['vendors-pest-', 'pest control', 'exterminator'],
        titleKeywords: ['pest', 'control', 'exterminator', 'bug', 'termite']
      },
      {
        category: 'plumbing',
        patterns: ['vendors-plumbing-', 'plumber', 'water'],
        titleKeywords: ['plumbing', 'plumber', 'water', 'drain', 'pipe']
      },
      {
        category: 'pressure-washing',
        patterns: ['vendors-pressure-', 'pressure wash', 'power wash'],
        titleKeywords: ['pressure wash', 'power wash', 'cleaning', 'wash']
      },
      {
        category: 'real-estate-senior-living',
        patterns: ['vendors-real-estate-', 'realty', 'senior living'],
        titleKeywords: ['real estate', 'realty', 'senior living', 'rentals', 'sales']
      },
      {
        category: 'retail-shops',
        patterns: ['vendors-retail-', 'shop', 'store'],
        titleKeywords: ['retail', 'shop', 'store', 'boutique']
      },
      {
        category: 'roofing',
        patterns: ['vendors-roofing-', 'roof', 'roofer'],
        titleKeywords: ['roofing', 'roof', 'roofer', 'shingle']
      },
      {
        category: 'technology-and-electronics',
        patterns: ['vendors-technology-', 'electronics', 'computer'],
        titleKeywords: ['technology', 'electronics', 'computer', 'tech', 'IT']
      }
    ];
    
    let fixedCount = 0;
    let copiedCount = 0;
    
    // Process each vendor page
    for (const page of vendorPages) {
      console.log(`\nProcessing: "${page.title}" (${page.slug})`);
      
      // Check if page is already properly categorized
      let isAlreadyCategorized = false;
      let currentCategory = null;
      
      for (const category of categories) {
        if (page.slug.startsWith(`vendors-${category.slug}-`)) {
          isAlreadyCategorized = true;
          currentCategory = category.slug;
          break;
        }
      }
      
      if (isAlreadyCategorized) {
        console.log(`  ✅ Already properly categorized under: ${currentCategory}`);
        continue;
      }
      
      // Find the best matching category
      let bestMatch = null;
      let bestScore = 0;
      
      for (const mapping of categoryMappings) {
        let score = 0;
        
        // Check slug patterns
        for (const pattern of mapping.patterns) {
          if (page.slug.includes(pattern.replace('vendors-', '').replace('-', ''))) {
            score += 2;
          }
        }
        
        // Check title keywords
        const titleLower = page.title.toLowerCase();
        for (const keyword of mapping.titleKeywords) {
          if (titleLower.includes(keyword.toLowerCase())) {
            score += 3;
          }
        }
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = mapping;
        }
      }
      
      if (bestMatch && bestScore > 0) {
        console.log(`  🎯 Best match: ${bestMatch.category} (score: ${bestScore})`);
        
        // Generate the correct slug
        const titleSlug = page.title.toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim();
        
        // Remove category keywords from title to avoid duplication
        const categoryWords = bestMatch.category.split('-');
        const titleWords = titleSlug.split('-');
        const filteredWords = titleWords.filter(word => 
          !categoryWords.includes(word) && 
          !bestMatch.titleKeywords.some(keyword => 
            keyword.toLowerCase().split(' ').includes(word)
          )
        );
        
        const cleanTitleSlug = filteredWords.join('-');
        const newSlug = `vendors-${bestMatch.category}-${cleanTitleSlug}`;
        
        console.log(`  📝 Proposed new slug: ${newSlug}`);
        
        // Check if new slug already exists
        const { rows: existingPages } = await pool.query(
          'SELECT id FROM page_contents WHERE slug = $1 AND id != $2',
          [newSlug, page.id]
        );
        
        if (existingPages.length > 0) {
          console.log(`  ⚠️ Slug ${newSlug} already exists, copying content...`);
          
          // Copy content to the existing properly named page
          await pool.query(`
            UPDATE page_contents 
            SET content = COALESCE($1, content),
                media_urls = COALESCE($2, media_urls),
                updated_at = NOW()
            WHERE slug = $3
          `, [page.content, page.media_urls, newSlug]);
          
          console.log(`  ✅ Content copied to existing page: ${newSlug}`);
          copiedCount++;
          
        } else {
          // Update the slug of the current page
          await pool.query(
            'UPDATE page_contents SET slug = $1, updated_at = NOW() WHERE id = $2',
            [newSlug, page.id]
          );
          
          console.log(`  ✅ Updated slug from ${page.slug} to ${newSlug}`);
          fixedCount++;
        }
        
      } else {
        console.log(`  ❓ No clear category match found (score: ${bestScore})`);
      }
    }
    
    console.log(`\n🎉 Categorization fix completed!`);
    console.log(`   📝 Fixed slugs: ${fixedCount}`);
    console.log(`   📋 Copied content: ${copiedCount}`);
    console.log(`   📊 Total processed: ${fixedCount + copiedCount}`);
    
  } catch (error) {
    console.error('❌ Error fixing categorization:', error);
    throw error;
  }
}

async function main() {
  try {
    await fixAllVendorCategorization();
    console.log('\n✅ All vendor categorization issues have been resolved!');
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { fixAllVendorCategorization };