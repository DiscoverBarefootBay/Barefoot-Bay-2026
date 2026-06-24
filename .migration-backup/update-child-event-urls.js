import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

async function updateChildEventUrls() {
  console.log('Updating website URLs for all child events from their parents...\n');

  try {
    // Update all child events to inherit their parent's website_url
    const result = await sql`
      UPDATE events AS child
      SET website_url = parent.website_url
      FROM events AS parent
      WHERE child.parent_event_id = parent.id
        AND child.category = 'social'
        AND parent.website_url IS NOT NULL
        AND parent.website_url != ''
        AND (child.website_url IS NULL OR child.website_url = '' OR child.website_url != parent.website_url)
    `;

    console.log(`✓ Updated ${result.count} child events with parent URLs\n`);

    // Verify the results
    const stats = await sql`
      SELECT 
        COUNT(*) as total_children,
        COUNT(CASE WHEN website_url IS NOT NULL AND website_url != '' THEN 1 END) as children_with_urls,
        COUNT(CASE WHEN website_url IS NULL OR website_url = '' THEN 1 END) as children_without_urls
      FROM events
      WHERE category = 'social'
        AND parent_event_id IS NOT NULL
    `;

    console.log('================================================================================');
    console.log('Child Event Statistics:');
    console.log(`  Total child events: ${stats[0].total_children}`);
    console.log(`  With URLs: ${stats[0].children_with_urls}`);
    console.log(`  Without URLs: ${stats[0].children_without_urls}`);
    console.log('================================================================================\n');

    // Check specific examples
    const examples = await sql`
      SELECT 
        child.id,
        child.title,
        child.website_url,
        parent.id as parent_id,
        parent.title as parent_title,
        parent.website_url as parent_url
      FROM events child
      JOIN events parent ON child.parent_event_id = parent.id
      WHERE child.id IN (6378, 8043)
    `;

    if (examples.length > 0) {
      console.log('Verification - Specific Events:');
      examples.forEach(e => {
        console.log(`  Event ${e.id}: "${e.title}"`);
        console.log(`    Parent: ${e.parent_id} - "${e.parent_title}"`);
        console.log(`    Child URL: ${e.website_url || '(none)'}`);
        console.log(`    Parent URL: ${e.parent_url || '(none)'}`);
        console.log(`    Match: ${e.website_url === e.parent_url ? '✓' : '✗'}\n`);
      });
    }

    console.log('✓ Complete!');

  } catch (error) {
    console.error('Error updating child events:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

updateChildEventUrls();
