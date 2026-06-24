import { sql, eq } from 'drizzle-orm';
import { db } from './db';
import { pageContents, contentVersions } from '../shared/schema';

/**
 * Diagnostic function to analyze the version history system
 * This will print out existing content and versions
 */
export async function analyzeVersionHistory() {
  console.log('Analyzing version history system...');
  
  // Get all page contents
  const allContent = await db.query.pageContents.findMany({
    orderBy: [pageContents.updatedAt]
  });
  
  console.log(`Found ${allContent.length} content items`);
  
  for (const content of allContent) {
    console.log(`\nContent ID: ${content.id}, Slug: ${content.slug}, Title: ${content.title}`);
    console.log(`  Updated: ${content.updatedAt}`);
    
    // Get versions for this content
    const versions = await db.query.contentVersions.findMany({
      where: eq(contentVersions.contentId, content.id),
      orderBy: [contentVersions.versionNumber]
    });
    
    if (versions.length === 0) {
      console.log('  NO VERSIONS FOUND FOR THIS CONTENT');
    } else {
      console.log(`  ${versions.length} versions found:`);
      for (const version of versions) {
        console.log(`    ID: ${version.id}, Number: ${version.versionNumber}, Created: ${version.createdAt}`);
      }
    }
  }
  
  // Check for orphaned versions
  const result = await db.execute(sql`
    SELECT v.* FROM content_versions v
    LEFT JOIN page_contents p ON v.content_id = p.id
    WHERE p.id IS NULL
  `);
  
  const orphanedVersions = result as any[];
  
  if (orphanedVersions.length > 0) {
    console.log(`\nWARNING: Found ${orphanedVersions.length} orphaned versions:`);
    for (const version of orphanedVersions) {
      console.log(`  ID: ${version.id}, Content ID: ${version.content_id}, Slug: ${version.slug}`);
    }
  } else {
    console.log('\nNo orphaned versions found.');
  }
  
  return true;
}

/**
 * Fixes missing version numbers in content_versions table
 */
export async function fixVersionNumbers() {
  console.log('Fixing version numbers...');
  
  // Get all content IDs
  const contentIds = await db.execute(sql`
    SELECT DISTINCT content_id FROM content_versions
  `);
  
  for (const row of contentIds as any[]) {
    const contentId = row.content_id;
    
    // Get versions for this content_id
    const versions = await db.query.contentVersions.findMany({
      where: eq(contentVersions.contentId, contentId),
      orderBy: [contentVersions.createdAt]
    });
    
    if (versions.length === 0) continue;
    
    console.log(`Processing ${versions.length} versions for content ID ${contentId}`);
    
    // Fix version numbers to be sequential
    for (let i = 0; i < versions.length; i++) {
      const version = versions[i];
      const correctNumber = i + 1;
      
      if (version.versionNumber !== correctNumber) {
        console.log(`  Updating version ID ${version.id} from ${version.versionNumber} to ${correctNumber}`);
        
        await db.execute(sql`
          UPDATE content_versions
          SET version_number = ${correctNumber}
          WHERE id = ${version.id}
        `);
      }
    }
  }
  
  return true;
}

/**
 * Creates versions for content items that don't have any
 */
export async function createMissingVersions() {
  console.log('Creating missing versions...');
  
  // Find content without versions
  const result = await db.execute(sql`
    SELECT p.* FROM page_contents p
    LEFT JOIN (SELECT DISTINCT content_id FROM content_versions) v ON p.id = v.content_id
    WHERE v.content_id IS NULL
  `);
  
  const contentWithoutVersions = result as any[];
  console.log(`Found ${contentWithoutVersions.length} content items without versions`);
  
  for (const content of contentWithoutVersions) {
    console.log(`  Creating initial version for content ID ${content.id}, "${content.title}"`);
    
    // Create initial version for this content
    await db.execute(sql`
      INSERT INTO content_versions
        (content_id, slug, title, content, media_urls, version_number, notes, created_at, created_by)
      VALUES (
        ${content.id},
        ${content.slug},
        ${content.title},
        ${content.content},
        ${JSON.stringify(content.media_urls || [])},
        1,
        'Initial version created by system fix',
        NOW(),
        ${content.created_by || null}
      )
    `);
  }
  
  // Also create checkpoint versions for content that has been updated since last version
  const allContent = await db.query.pageContents.findMany();
  
  for (const content of allContent) {
    // Get latest version for this content
    const latestVersion = await db.query.contentVersions.findFirst({
      where: eq(contentVersions.contentId, content.id),
      orderBy: [sql`version_number DESC`]
    });
    
    if (!latestVersion) continue;
    
    // Check if content was updated after the latest version
    const contentUpdateTime = new Date(content.updatedAt).getTime();
    const versionCreateTime = new Date(latestVersion.createdAt).getTime();
    
    if (contentUpdateTime > versionCreateTime) {
      console.log(`  Creating checkpoint version for content ID ${content.id}, "${content.title}"`);
      
      // Get latest version number
      const maxResult = await db.execute(sql`
        SELECT MAX(version_number) as max_version FROM content_versions WHERE content_id = ${content.id}
      `);
      const maxVersion = (maxResult as any[])[0]?.max_version || 0;
      const nextVersion = maxVersion + 1;
      
      // Create checkpoint version
      await db.execute(sql`
        INSERT INTO content_versions
          (content_id, slug, title, content, media_urls, version_number, notes, created_at, created_by)
        VALUES (
          ${content.id},
          ${content.slug},
          ${content.title},
          ${content.content},
          ${JSON.stringify(content.media_urls || [])},
          ${nextVersion},
          'Checkpoint version created by system fix',
          NOW(),
          ${content.updated_by || content.created_by || null}
        )
      `);
    }
  }
  
  return true;
}

/**
 * Fix orphaned versions by connecting them to contents with matching slugs
 * or creating new contents if no matching slug is found
 */
export async function fixOrphanedVersions() {
  console.log('Fixing orphaned versions...');
  
  // Find orphaned versions
  const result = await db.execute(sql`
    SELECT v.* FROM content_versions v
    LEFT JOIN page_contents p ON v.content_id = p.id
    WHERE p.id IS NULL
  `);
  
  const orphanedVersions = result as any[];
  console.log(`Found ${orphanedVersions.length} orphaned versions`);
  
  for (const version of orphanedVersions) {
    console.log(`  Fixing orphaned version ID ${version.id}, content_id ${version.content_id}, slug "${version.slug}"`);
    
    // Try to find content with matching slug
    const matchingContent = await db.query.pageContents.findFirst({
      where: eq(pageContents.slug, version.slug)
    });
    
    if (matchingContent) {
      console.log(`    Found matching content ID ${matchingContent.id} with slug "${version.slug}"`);
      
      // Update version to point to matching content
      await db.execute(sql`
        UPDATE content_versions
        SET content_id = ${matchingContent.id}
        WHERE id = ${version.id}
      `);
      
      // Fix version numbers for this content
      await fixVersionNumbersForContent(matchingContent.id);
    } else {
      console.log(`    No matching content found for slug "${version.slug}", creating new content`);
      
      // Create new content from orphaned version
      const insertResult = await db.execute(sql`
        INSERT INTO page_contents
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
        )
        RETURNING id
      `);
      
      const newContentId = (insertResult as any[])[0]?.id;
      
      if (newContentId) {
        console.log(`    Created new content ID ${newContentId}`);
        
        // Update version to point to new content
        await db.execute(sql`
          UPDATE content_versions
          SET content_id = ${newContentId}
          WHERE id = ${version.id}
        `);
      }
    }
  }
  
  return true;
}

/**
 * Helper function to fix version numbers for a specific content
 */
async function fixVersionNumbersForContent(contentId: number) {
  // Get versions for this content_id
  const versions = await db.query.contentVersions.findMany({
    where: eq(contentVersions.contentId, contentId),
    orderBy: [contentVersions.createdAt]
  });
  
  if (versions.length === 0) return;
  
  // Fix version numbers to be sequential
  for (let i = 0; i < versions.length; i++) {
    const version = versions[i];
    const correctNumber = i + 1;
    
    if (version.versionNumber !== correctNumber) {
      await db.execute(sql`
        UPDATE content_versions
        SET version_number = ${correctNumber}
        WHERE id = ${version.id}
      `);
    }
  }
}

/**
 * Main function to run all fixes
 */
export async function fixAllVersionHistoryIssues() {
  try {
    console.log('Running comprehensive version history fix...');
    
    await analyzeVersionHistory();
    await fixVersionNumbers();
    await createMissingVersions();
    await fixOrphanedVersions();
    
    // Final verification
    console.log('\nVerifying fixes...');
    await analyzeVersionHistory();
    
    console.log('Version history fix completed successfully');
    return true;
  } catch (error) {
    console.error('Error fixing version history:', error);
    return false;
  }
}