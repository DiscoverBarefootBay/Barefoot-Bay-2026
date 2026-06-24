// EMERGENCY FIX for content version history
// Run this script with 'node server/emergency-fix.js'

const { drizzle } = require('drizzle-orm/neon-serverless');
const { neon } = require('@neondatabase/serverless');
const { eq, desc, sql } = require('drizzle-orm');
const fs = require('fs');

// Define our schema structure inline for the emergency fix
const pageContents = {
  id: { name: 'id' },
  slug: { name: 'slug' },
  title: { name: 'title' },
  content: { name: 'content' }, 
  mediaUrls: { name: 'media_urls' },
  updatedAt: { name: 'updated_at' },
  updatedBy: { name: 'updated_by' },
  createdAt: { name: 'created_at' },
  createdBy: { name: 'created_by' }
};

const contentVersions = {
  id: { name: 'id' },
  contentId: { name: 'content_id' },
  slug: { name: 'slug' },
  title: { name: 'title' },
  content: { name: 'content' },
  mediaUrls: { name: 'media_urls' },
  versionNumber: { name: 'version_number' },
  notes: { name: 'notes' },
  createdAt: { name: 'created_at' },
  createdBy: { name: 'created_by' }
};

// Helper function to log to both console and file
function log(message) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `${timestamp} - ${message}`;
  console.log(formattedMessage);
  fs.appendFileSync('emergency-fix-log.txt', formattedMessage + '\n');
}

async function main() {
  try {
    log('=========== EMERGENCY VERSION HISTORY FIX ===========');
    
    // Connect to DB
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL is not defined!');
    }
    
    log(`Connecting to database: ${dbUrl.split('@')[1]}`);
    const client = neon(dbUrl);
    const db = drizzle(client);
    log('Connected to database');
    
    // Start a transaction
    let allResults = [];
    
    // 1. First, get all content from the page_contents table
    log('Getting all content from page_contents table...');
    const allContent = await db.execute(sql`SELECT * FROM page_contents ORDER BY updated_at DESC`);
    log(`Found ${allContent.length} content items`);
    
    // 2. For each content, check if any versions exist, if not, create an initial version
    for (const content of allContent) {
      log(`\nProcessing content: ID=${content.id}, slug="${content.slug}", title="${content.title}"`);
      
      // Get versions for this content
      const versions = await db.execute(
        sql`SELECT * FROM content_versions WHERE content_id = ${content.id} ORDER BY created_at ASC`
      );
      
      if (versions.length === 0) {
        log(`  No versions found for content ID ${content.id}, creating initial version`);
        
        // Create an initial version
        const result = await db.execute(
          sql`INSERT INTO content_versions 
              (content_id, slug, title, content, media_urls, version_number, notes, created_at, created_by)
              VALUES (
                ${content.id}, 
                ${content.slug}, 
                ${content.title}, 
                ${content.content}, 
                ${JSON.stringify(content.media_urls || [])}, 
                1, 
                'Initial version created by emergency fix', 
                NOW(), 
                ${content.created_by || null}
              ) RETURNING id`
        );
        
        log(`  Created initial version with ID ${result[0]?.id} for content ID ${content.id}`);
        allResults.push({
          contentId: content.id,
          slug: content.slug,
          action: 'create-initial-version',
          result: result[0]?.id
        });
      } else {
        log(`  Found ${versions.length} existing versions for content ID ${content.id}`);
        
        // Fix version numbers (should be sequential starting from 1)
        for (let i = 0; i < versions.length; i++) {
          const version = versions[i];
          const correctVersionNumber = i + 1;
          
          if (version.version_number !== correctVersionNumber) {
            log(`  Fixing version ID ${version.id} number from ${version.version_number} to ${correctVersionNumber}`);
            
            await db.execute(
              sql`UPDATE content_versions 
                  SET version_number = ${correctVersionNumber}
                  WHERE id = ${version.id}`
            );
            
            allResults.push({
              contentId: content.id,
              versionId: version.id,
              action: 'fix-version-number',
              oldNum: version.version_number,
              newNum: correctVersionNumber
            });
          }
        }
        
        // Create a latest "checkpoint" version if the latest version is older than the content
        const latestVersion = versions[versions.length - 1];
        const contentUpdateTime = new Date(content.updated_at).getTime();
        const versionCreateTime = new Date(latestVersion.created_at).getTime();
        
        if (contentUpdateTime > versionCreateTime) {
          log(`  Content was updated after the latest version. Creating new checkpoint version`);
          
          const result = await db.execute(
            sql`INSERT INTO content_versions 
                (content_id, slug, title, content, media_urls, version_number, notes, created_at, created_by)
                VALUES (
                  ${content.id}, 
                  ${content.slug}, 
                  ${content.title}, 
                  ${content.content}, 
                  ${JSON.stringify(content.media_urls || [])}, 
                  ${versions.length + 1}, 
                  'Checkpoint version created by emergency fix', 
                  NOW(), 
                  ${content.updated_by || content.created_by || null}
                ) RETURNING id`
          );
          
          log(`  Created checkpoint version with ID ${result[0]?.id} for content ID ${content.id}`);
          allResults.push({
            contentId: content.id,
            slug: content.slug,
            action: 'create-checkpoint-version',
            result: result[0]?.id
          });
        }
      }
    }
    
    // 3. Fix any orphaned versions (if any)
    log('\nChecking for orphaned versions...');
    const orphanedVersions = await db.execute(
      sql`SELECT v.* FROM content_versions v 
          LEFT JOIN page_contents p ON v.content_id = p.id 
          WHERE p.id IS NULL`
    );
    
    if (orphanedVersions.length > 0) {
      log(`Found ${orphanedVersions.length} orphaned versions`);
      
      for (const version of orphanedVersions) {
        log(`  Orphaned version ID ${version.id}, content_id ${version.content_id}, slug "${version.slug}"`);
        
        // Check if we can find content with the same slug
        const matchingContent = await db.execute(
          sql`SELECT * FROM page_contents WHERE slug = ${version.slug} LIMIT 1`
        );
        
        if (matchingContent.length > 0) {
          log(`  Found matching content ID ${matchingContent[0].id} with same slug "${version.slug}"`);
          
          // Update the orphaned version to point to the matching content
          await db.execute(
            sql`UPDATE content_versions 
                SET content_id = ${matchingContent[0].id}
                WHERE id = ${version.id}`
          );
          
          log(`  Updated orphaned version ID ${version.id} to point to content ID ${matchingContent[0].id}`);
          allResults.push({
            versionId: version.id,
            action: 'fix-orphaned-version',
            oldContentId: version.content_id,
            newContentId: matchingContent[0].id
          });
        } else {
          log(`  No matching content found for orphaned version ID ${version.id}, slug "${version.slug}"`);
          
          // Create new content from the orphaned version
          const result = await db.execute(
            sql`INSERT INTO page_contents 
                (slug, title, content, media_urls, created_at, created_by, updated_at, updated_by)
                VALUES (
                  ${version.slug}, 
                  ${version.title}, 
                  ${version.content}, 
                  ${JSON.stringify(version.media_urls || [])}, 
                  NOW(), 
                  ${version.created_by || null},
                  NOW(),
                  ${version.created_by || null}
                ) RETURNING id`
          );
          
          const newContentId = result[0]?.id;
          log(`  Created new content ID ${newContentId} from orphaned version ID ${version.id}`);
          
          // Update the orphaned version to point to the new content
          await db.execute(
            sql`UPDATE content_versions 
                SET content_id = ${newContentId}
                WHERE id = ${version.id}`
          );
          
          log(`  Updated orphaned version ID ${version.id} to point to new content ID ${newContentId}`);
          allResults.push({
            versionId: version.id,
            action: 'create-content-from-orphaned-version',
            newContentId: newContentId
          });
        }
      }
    } else {
      log('No orphaned versions found');
    }
    
    // 4. Verify all is well by checking for any remaining issues
    log('\nVerifying fix results...');
    
    // Check for content without versions
    const contentWithoutVersions = await db.execute(
      sql`SELECT p.* FROM page_contents p 
          LEFT JOIN (SELECT DISTINCT content_id FROM content_versions) v ON p.id = v.content_id 
          WHERE v.content_id IS NULL`
    );
    
    if (contentWithoutVersions.length > 0) {
      log(`WARNING: Found ${contentWithoutVersions.length} content items still without versions after fixes`);
      for (const content of contentWithoutVersions) {
        log(`  Content ID ${content.id}, slug "${content.slug}" has no versions`);
      }
    } else {
      log('All content has at least one version - Good!');
    }
    
    // Check for versions with missing or invalid contentId
    const invalidVersions = await db.execute(
      sql`SELECT v.* FROM content_versions v 
          LEFT JOIN page_contents p ON v.content_id = p.id 
          WHERE p.id IS NULL`
    );
    
    if (invalidVersions.length > 0) {
      log(`WARNING: Found ${invalidVersions.length} versions with invalid content_id after fixes`);
      for (const version of invalidVersions) {
        log(`  Version ID ${version.id}, content_id ${version.content_id}, slug "${version.slug}" has invalid content_id`);
      }
    } else {
      log('All versions have valid content_id references - Good!');
    }
    
    // Output summary of all actions taken
    log('\n========== EMERGENCY FIX SUMMARY ==========');
    log(`Total content items processed: ${allContent.length}`);
    log(`Total actions taken: ${allResults.length}`);
    
    const actionCounts = allResults.reduce((acc, curr) => {
      acc[curr.action] = (acc[curr.action] || 0) + 1;
      return acc;
    }, {});
    
    for (const [action, count] of Object.entries(actionCounts)) {
      log(`  ${action}: ${count}`);
    }
    
    log('\n===== EMERGENCY FIX COMPLETED SUCCESSFULLY =====');
    
  } catch (error) {
    log(`ERROR: ${error.message}`);
    log(error.stack);
    process.exit(1);
  }
}

// Run the emergency fix
main().then(() => {
  log('Emergency fix script completed');
  process.exit(0);
}).catch(err => {
  log(`Fatal error: ${err.message}`);
  log(err.stack);
  process.exit(1);
});