import { sql } from "drizzle-orm";
import { db } from "./db";

/** Filter BEFORE de-duplication, exactly like getAllPageContents; no unrelated HTML. */
export async function readVendorDirectoryPages(includeHidden: boolean, executor: Pick<typeof db, "execute"> = db) {
  const result = await executor.execute(sql`
    SELECT DISTINCT ON (slug) id, slug, title, content, is_hidden AS "isHidden",
      created_at AS "createdAt", updated_by AS "updatedBy",
      visibility_status AS "visibilityStatus", hidden_at AS "hiddenAt",
      hidden_reason AS "hiddenReason", dmca_case_id AS "dmcaCaseId", legal_hold AS "legalHold"
    FROM page_contents
    WHERE slug LIKE 'vendors-%' AND (${includeHidden} OR is_hidden = false)
    ORDER BY slug, "order", updated_at DESC, id DESC
  `);
  return result.rows as any[];
}
