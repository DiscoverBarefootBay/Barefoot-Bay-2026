import { sql } from "drizzle-orm";
import { db } from "./db";
import { publicClubChoices, type ClubIdentity } from "./social-club-alias";

/** Menu/profile choices need titles, not every site's full CMS HTML/media. */
export async function readSocialClubIdentities(executor: Pick<typeof db, "execute"> = db) {
  const result = await executor.execute(sql`
    SELECT DISTINCT ON (slug) id, slug, title, is_hidden AS "isHidden", visibility_status AS "visibilityStatus"
    FROM page_contents
    WHERE slug LIKE 'social-%'
    ORDER BY slug, "order", updated_at DESC, id DESC
  `);
  return result.rows as unknown as ClubIdentity[];
}

export async function readSocialClubSummaries(executor: Pick<typeof db, "execute"> = db) {
  // Choose the authoritative row before visibility filtering. Neither hidden
  // versions nor a legacy address may resurrect a removed named club.
  return publicClubChoices(await readSocialClubIdentities(executor));
}
