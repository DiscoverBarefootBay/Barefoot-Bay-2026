-- Task #86: Per-post flag that lets the author or an admin hide the
-- auto-rendered title on the forum post detail page. Useful when the
-- post body already contains its own styled HTML headline and the
-- default title would otherwise duplicate it.
--
-- Defaults to false so existing posts continue to render the title.
ALTER TABLE forum_posts
  ADD COLUMN IF NOT EXISTS hide_default_title boolean NOT NULL DEFAULT false;
