import { sql } from "drizzle-orm";
import { db } from "./db";
import { publicOnly } from "./dmca/content-visibility";

/** Menu/profile choices need titles, not every site's full CMS HTML/media. */
export async function readSocialClubSummaries(executor: Pick<typeof db, "execute"> = db) {
  const result = await executor.execute(sql`
    SELECT DISTINCT ON (slug) id, slug, title, visibility_status AS "visibilityStatus"
    FROM page_contents
    WHERE slug LIKE 'social-%' AND is_hidden = false
    ORDER BY slug, "order", updated_at DESC, id DESC
  `);
  // Visibility is applied AFTER duplicate selection, just like the old loader:
  // a removed newest version must not resurrect an older published version.
  return publicOnly(result.rows as { id: number; slug: string; title: string; visibilityStatus: string }[])
    .map(({ id, slug, title }) => ({ id, slug, title }))
    .sort((a, b) => a.title.localeCompare(b.title));
}
