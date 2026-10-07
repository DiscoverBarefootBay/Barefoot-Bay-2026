import { sql } from "drizzle-orm";

// Match the legacy badge's comment-ID rule, not the story card's timestamp
// rule. A read timestamp without a comment marker still leaves comments unread.
export const badgeUnreadSql = sql`(
  rs.last_read_at IS NULL OR p.created_at > rs.last_read_at OR
  (COALESCE(rs.last_read_comment_id, 0) = 0 AND COALESCE(cs.comment_count, 0) > 0) OR
  cs.latest_id > rs.last_read_comment_id
)`;

const commentStats = sql`
  SELECT post_id, COUNT(*)::int AS comment_count, MAX(id) AS latest_id
  FROM forum_comments GROUP BY post_id
`;

export function forumCountsQuery(userId?: number) {
  return sql`
    SELECT p.category_id AS "categoryId", COUNT(*)::int AS "postCount",
      COUNT(*) FILTER (WHERE ${badgeUnreadSql})::int AS "unreadCount"
    FROM forum_posts p
    LEFT JOIN (${commentStats}) cs ON cs.post_id = p.id
    LEFT JOIN forum_read_states rs ON rs.post_id = p.id AND rs.user_id = ${userId ?? -1}
    WHERE p.visibility_status = 'published'
    GROUP BY p.category_id
  `;
}

export function forumUnreadStatusesQuery(userId: number, categoryId: number) {
  return sql`
    SELECT p.id AS "postId", COALESCE(${badgeUnreadSql}, false) AS "isUnread"
    FROM forum_posts p
    LEFT JOIN (${commentStats}) cs ON cs.post_id = p.id
    LEFT JOIN forum_read_states rs ON rs.post_id = p.id AND rs.user_id = ${userId}
    WHERE p.category_id = ${categoryId} AND p.visibility_status = 'published'
  `;
}
