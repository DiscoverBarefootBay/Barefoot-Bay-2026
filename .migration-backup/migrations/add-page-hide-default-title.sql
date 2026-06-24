-- Task #88: Per-page flag that lets an admin hide the auto-rendered
-- page title on Vendor / Community / Club detail pages. Mirrors the
-- forum implementation from Task #86. Useful when the page body
-- already contains its own styled headline and the default title
-- would otherwise duplicate it.
--
-- Defaults to false so existing pages continue to render the title.
ALTER TABLE page_contents
  ADD COLUMN IF NOT EXISTS hide_default_title boolean NOT NULL DEFAULT false;
