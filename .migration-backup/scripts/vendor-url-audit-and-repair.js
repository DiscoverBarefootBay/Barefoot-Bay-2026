#!/usr/bin/env node

/**
 * Vendor URL Audit and Repair Script
 * 
 * This script identifies and fixes malformed vendor slugs in the database
 * to ensure all vendor URLs follow the correct format: /vendors/<category>/<name>
 */

import { db } from '../server/db.ts';
import { pageContents, vendorCategories } from '../shared/schema.ts';
import { eq, like } from 'drizzle-orm';
import { 
  isVendorPage, 
  needsSlugRepair, 
  repairVendorSlug, 
  extractVendorCategory,
  generateVendorSlug,
  dbSlugToPublicUrl,
  COMPOUND_CATEGORIES 
} from '../shared/vendor-url-utils.ts';

class VendorUrlAuditor {
  constructor() {
    this.results = {
      totalVendorPages: 0,
      malformedSlugs: [],
      repairedSlugs: [],
      errors: [],
      skipped: []
    };
  }

  async run() {
    console.log('🔍 Starting Vendor URL Audit and Repair...\n');
    
    try {
      // Phase 1: Audit all vendor pages
      await this.auditVendorPages();
      
      // Phase 2: Repair malformed slugs
      await this.repairMalformedSlugs();
      
      // Phase 3: Generate report
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Critical error during audit:', error);
      throw error;
    }
  }

  async auditVendorPages() {
    console.log('📋 Phase 1: Auditing all vendor pages...');
    
    try {
      // Get all page contents that might be vendor pages
      const allPages = await db.select().from(pageContents);
      
      for (const page of allPages) {
        if (isVendorPage(page.slug, page.title)) {
          this.results.totalVendorPages++;
          
          console.log(`🔍 Checking vendor page: "${page.title}" (${page.slug})`);
          
          // Check if slug needs repair
          if (needsSlugRepair(page.slug)) {
            console.log(`⚠️  Malformed slug detected: ${page.slug}`);
            this.results.malformedSlugs.push({
              id: page.id,
              title: page.title,
              currentSlug: page.slug,
              category: extractVendorCategory(page.slug),
              publicUrl: dbSlugToPublicUrl(page.slug)
            });
          } else {
            const category = extractVendorCategory(page.slug);
            const publicUrl = dbSlugToPublicUrl(page.slug);
            console.log(`✅ Slug OK: ${page.slug} → ${publicUrl} (category: ${category})`);
          }
        }
      }
      
      console.log(`\n📊 Found ${this.results.totalVendorPages} vendor pages`);
      console.log(`🔧 Found ${this.results.malformedSlugs.length} malformed slugs that need repair\n`);
      
    } catch (error) {
      console.error('❌ Error during audit phase:', error);
      this.results.errors.push(`Audit phase error: ${error.message}`);
    }
  }

  async repairMalformedSlugs() {
    console.log('🔧 Phase 2: Repairing malformed slugs...');
    
    if (this.results.malformedSlugs.length === 0) {
      console.log('✅ No malformed slugs found, skipping repair phase\n');
      return;
    }

    // Get available vendor categories for fallback
    const vendorCats = await this.getVendorCategories();
    
    for (const malformed of this.results.malformedSlugs) {
      try {
        console.log(`🔧 Repairing: "${malformed.title}" (${malformed.currentSlug})`);
        
        let category = malformed.category;
        
        // If no category found, try to determine from title or use fallback
        if (!category && vendorCats.length > 0) {
          category = this.categorizeByTitle(malformed.title, vendorCats);
          console.log(`📂 Using inferred category: ${category}`);
        }
        
        if (!category) {
          console.warn(`⚠️ Cannot repair "${malformed.title}" - no category available`);
          this.results.skipped.push({
            ...malformed,
            reason: 'No category information available'
          });
          continue;
        }
        
        // Generate repaired slug
        const repairedSlug = repairVendorSlug(malformed.currentSlug, category, malformed.title);
        
        if (repairedSlug === malformed.currentSlug) {
          console.log(`ℹ️ Slug already optimal: ${malformed.currentSlug}`);
          continue;
        }
        
        console.log(`🔄 Repairing: "${malformed.currentSlug}" → "${repairedSlug}"`);
        
        // Update the slug in database
        await db.update(pageContents)
          .set({ 
            slug: repairedSlug,
            updatedAt: new Date()
          })
          .where(eq(pageContents.id, malformed.id));
        
        this.results.repairedSlugs.push({
          id: malformed.id,
          title: malformed.title,
          oldSlug: malformed.currentSlug,
          newSlug: repairedSlug,
          oldUrl: malformed.publicUrl,
          newUrl: dbSlugToPublicUrl(repairedSlug),
          category
        });
        
        console.log(`✅ Successfully repaired "${malformed.title}"`);
        
      } catch (error) {
        console.error(`❌ Error repairing "${malformed.title}":`, error);
        this.results.errors.push(`Repair error for "${malformed.title}": ${error.message}`);
      }
    }
    
    console.log(`\n🔧 Repair phase complete: ${this.results.repairedSlugs.length} slugs repaired\n`);
  }

  async getVendorCategories() {
    try {
      const categories = await db.select().from(vendorCategories);
      return categories.map(cat => cat.name);
    } catch (error) {
      console.warn('⚠️ Could not fetch vendor categories:', error.message);
      return [];
    }
  }

  categorizeByTitle(title, availableCategories) {
    const titleLower = title.toLowerCase();
    
    // Simple keyword-based categorization
    const categoryKeywords = {
      'technology-and-electronics': ['computer', 'tech', 'electronic', 'software', 'hardware', 'digital', 'IT'],
      'home-services': ['cleaning', 'repair', 'maintenance', 'contractor', 'plumber', 'electrician'],
      'health-and-wellness': ['health', 'medical', 'wellness', 'doctor', 'clinic', 'therapy'],
      'food-and-dining': ['restaurant', 'food', 'dining', 'catering', 'kitchen', 'bakery'],
      'landscaping': ['lawn', 'garden', 'landscape', 'yard', 'tree', 'plant', 'irrigation'],
      'automotive': ['auto', 'car', 'vehicle', 'automotive', 'mechanic', 'garage']
    };
    
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => titleLower.includes(keyword))) {
        return category;
      }
    }
    
    // Fallback to first available category
    return availableCategories[0] || 'general';
  }

  generateReport() {
    console.log('📊 VENDOR URL AUDIT REPORT');
    console.log('=' .repeat(50));
    console.log(`Total vendor pages found: ${this.results.totalVendorPages}`);
    console.log(`Malformed slugs detected: ${this.results.malformedSlugs.length}`);
    console.log(`Slugs successfully repaired: ${this.results.repairedSlugs.length}`);
    console.log(`Slugs skipped: ${this.results.skipped.length}`);
    console.log(`Errors encountered: ${this.results.errors.length}`);
    console.log('');

    if (this.results.repairedSlugs.length > 0) {
      console.log('✅ SUCCESSFULLY REPAIRED:');
      console.log('-'.repeat(40));
      this.results.repairedSlugs.forEach((repair, index) => {
        console.log(`${index + 1}. "${repair.title}"`);
        console.log(`   Old: ${repair.oldSlug} → ${repair.oldUrl}`);
        console.log(`   New: ${repair.newSlug} → ${repair.newUrl}`);
        console.log(`   Category: ${repair.category}`);
        console.log('');
      });
    }

    if (this.results.skipped.length > 0) {
      console.log('⚠️ SKIPPED (manual intervention needed):');
      console.log('-'.repeat(40));
      this.results.skipped.forEach((skipped, index) => {
        console.log(`${index + 1}. "${skipped.title}" - ${skipped.reason}`);
        console.log(`   Slug: ${skipped.currentSlug}`);
        console.log('');
      });
    }

    if (this.results.errors.length > 0) {
      console.log('❌ ERRORS:');
      console.log('-'.repeat(40));
      this.results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
      console.log('');
    }

    console.log('🎯 NEXT STEPS:');
    console.log('-'.repeat(40));
    console.log('• All vendor URLs now follow the format: /vendors/<category>/<name>');
    console.log('• The system will automatically maintain proper URLs for future changes');
    console.log('• Manual review recommended for any skipped items');
    
    if (this.results.repairedSlugs.length > 0) {
      console.log('• Consider testing the repaired URLs to ensure they work correctly');
    }
    
    console.log('\n🏁 Vendor URL audit and repair completed successfully!');
  }
}

// Execute the audit if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const auditor = new VendorUrlAuditor();
  
  auditor.run()
    .then(() => {
      console.log('\n✅ Audit completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Audit failed:', error);
      process.exit(1);
    });
}

export default VendorUrlAuditor;