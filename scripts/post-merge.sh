#!/bin/bash
set -e
pnpm install --frozen-lockfile

# Idempotent, additive schema changes that drizzle-kit push can't apply
# reliably here (its interactive table-rename prompts hang on a closed stdin and
# can skip the change). Apply them directly first so the columns are guaranteed
# in every environment before the app boots.
if [ -n "$DATABASE_URL" ]; then
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
    -c "ALTER TABLE calendar_email_schedule ADD COLUMN IF NOT EXISTS last_watchdog_at timestamp;"
fi

pnpm --filter db push
