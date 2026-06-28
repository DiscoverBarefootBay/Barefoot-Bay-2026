import { pgTable, serial, integer, text, timestamp, json, boolean, decimal, jsonb, index } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { users } from './schema';

/**
 * Analytics Session Table
 * Stores data about visitor sessions
 */
export const analyticsSessions = pgTable('analytics_sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  sessionId: text('session_id'),
  ip: text('ip'), // Using existing 'ip' column
  userAgent: text('user_agent'),
  browser: text('browser'),
  device: text('device'), // Using existing 'device' column
  os: text('os'),
  country: text('country'),
  region: text('region'),
  city: text('city'),
  latitude: decimal('latitude', { precision: 10, scale: 6 }),
  longitude: decimal('longitude', { precision: 10, scale: 6 }),
  startTimestamp: timestamp('start_timestamp').defaultNow().notNull(), // Using existing column names
  endTimestamp: timestamp('end_timestamp'),
  duration: integer('duration'),
  pagesViewed: integer('pages_viewed'),
  isActive: boolean('is_active').default(true),
  // New field for proper returning visitor tracking
  visitorFingerprint: text('visitor_fingerprint'), // Combination of IP + User-Agent hash for visitor identification
  isReturningVisitor: boolean('is_returning_visitor').default(false), // True if this visitor has been seen before
}, (table) => ({
  // Index for fast returning-visitor lookups (isReturningVisitor filters by visitor_fingerprint)
  visitorFingerprintIdx: index('analytics_sessions_visitor_fingerprint_idx').on(table.visitorFingerprint),
}));

/**
 * Analytics Page Views Table
 * Stores data about individual page views
 */
export const analyticsPageViews = pgTable('analytics_page_views', {
  id: serial('id').primaryKey(),
  sessionId: text('session_id'), // Text type to match existing schema
  userId: integer('user_id'),
  ip: text('ip'),
  userAgent: text('user_agent'),
  path: text('path'), // Uses 'path' instead of 'url'
  referrer: text('referrer'),
  pageType: text('page_type'),
  pageCategory: text('page_category'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  exitTimestamp: timestamp('exit_timestamp'),
  duration: integer('duration'),
  pageHeight: integer('page_height'),
  maxScrollDepth: integer('max_scroll_depth'),
  maxScrollPercentage: decimal('max_scroll_percentage', { precision: 5, scale: 2 }),
  customDimensions: jsonb('custom_dimensions').$type<Record<string, any>>(),
});

/**
 * Analytics Events Table
 * Stores data about user interactions and events
 */
export const analyticsEvents = pgTable('analytics_events', {
  id: serial('id').primaryKey(),
  sessionId: text('session_id'), // Text type to match existing schema
  userId: integer('user_id'),
  eventType: text('event_type').notNull(),
  category: text('category'),
  action: text('action'),
  label: text('label'),
  value: decimal('value', { precision: 10, scale: 2 }),
  path: text('path'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  eventData: jsonb('event_data').$type<Record<string, any>>(),
  positionData: jsonb('position_data').$type<Record<string, any>>(),
});

// Analytics table relationships

// Sessions relationships with both users and child tables
export const analyticsSessionsRelations = relations(analyticsSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [analyticsSessions.userId],
    references: [users.id],
    relationName: 'analytics_session_user'
  }),
  pageViews: many(analyticsPageViews, {
    relationName: 'session_page_views'
  }),
  events: many(analyticsEvents, {
    relationName: 'session_events'
  })
}));

// Page Views relationships
export const analyticsPageViewsRelations = relations(analyticsPageViews, ({ one }) => ({
  session: one(analyticsSessions, {
    fields: [analyticsPageViews.sessionId],
    references: [analyticsSessions.sessionId], // Using sessionId text field as reference
    relationName: 'session_page_views'
  }),
  user: one(users, {
    fields: [analyticsPageViews.userId],
    references: [users.id],
    relationName: 'page_view_user'
  })
}));

// Events relationships
export const analyticsEventsRelations = relations(analyticsEvents, ({ one }) => ({
  session: one(analyticsSessions, {
    fields: [analyticsEvents.sessionId],
    references: [analyticsSessions.sessionId], // Using sessionId text field as reference
    relationName: 'session_events'
  }),
  user: one(users, {
    fields: [analyticsEvents.userId],
    references: [users.id],
    relationName: 'event_user'
  })
}));

// Create indexes for faster queries
export const analyticsSessionsIndexes = {
  userIdIdx: sql`CREATE INDEX IF NOT EXISTS analytics_sessions_user_id_idx ON analytics_sessions (user_id)`,
  startTimestampIdx: sql`CREATE INDEX IF NOT EXISTS analytics_sessions_start_timestamp_idx ON analytics_sessions (start_timestamp)`,
  isActiveIdx: sql`CREATE INDEX IF NOT EXISTS analytics_sessions_is_active_idx ON analytics_sessions (is_active)`,
  sessionIdIdx: sql`CREATE INDEX IF NOT EXISTS analytics_sessions_session_id_idx ON analytics_sessions (session_id)`,
};

export const analyticsPageViewsIndexes = {
  sessionIdIdx: sql`CREATE INDEX IF NOT EXISTS analytics_page_views_session_id_idx ON analytics_page_views (session_id)`,
  pathIdx: sql`CREATE INDEX IF NOT EXISTS analytics_page_views_path_idx ON analytics_page_views (path)`,
  timestampIdx: sql`CREATE INDEX IF NOT EXISTS analytics_page_views_timestamp_idx ON analytics_page_views (timestamp)`,
  userIdIdx: sql`CREATE INDEX IF NOT EXISTS analytics_page_views_user_id_idx ON analytics_page_views (user_id)`,
};

export const analyticsEventsIndexes = {
  sessionIdIdx: sql`CREATE INDEX IF NOT EXISTS analytics_events_session_id_idx ON analytics_events (session_id)`,
  eventTypeIdx: sql`CREATE INDEX IF NOT EXISTS analytics_events_event_type_idx ON analytics_events (event_type)`,
  timestampIdx: sql`CREATE INDEX IF NOT EXISTS analytics_events_timestamp_idx ON analytics_events (timestamp)`,
  pathIdx: sql`CREATE INDEX IF NOT EXISTS analytics_events_path_idx ON analytics_events (path)`,
  userIdIdx: sql`CREATE INDEX IF NOT EXISTS analytics_events_user_id_idx ON analytics_events (user_id)`,
};