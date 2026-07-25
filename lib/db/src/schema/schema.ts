import { pgTable, text, serial, integer, bigint, boolean, timestamp, date, time, jsonb, decimal, varchar, doublePrecision, unique, index, type AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
// Analytics tables are used below for insert-schema/type helpers. They are
// re-exported for consumers ONLY from the barrel (index.ts) via
// `export * from "./analytics-schema"`. Do NOT re-export them here as well:
// the barrel also does `export * from "./schema"`, and a name exported by two
// `export *` sources is ambiguous in ESM and silently resolves to `undefined`,
// which previously broke every analytics DB query (analyticsSessions et al.).
import {
  analyticsSessions, analyticsPageViews, analyticsEvents,
} from './analytics-schema';

// Define user roles - expanded structure
export const UserRole = {
  GUEST: 'guest',
  REGISTERED: 'registered',
  BADGE_HOLDER: 'badge_holder',
  PAID: 'paid',
  MODERATOR: 'moderator',
  ADMIN: 'admin'
} as const;

// Define listing types
export const ListingType = {
  FSBO: 'FSBO',
  AGENT: 'Agent',
  RENT: 'Rent',
  OPEN_HOUSE: 'OpenHouse',
  WANTED: 'Wanted',
  CLASSIFIED: 'Classified',
  GARAGE_SALE: 'GarageSale'
} as const;

export type ListingType = typeof ListingType[keyof typeof ListingType];

// Define listing status types
export const ListingStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED'
} as const;

export type ListingStatus = typeof ListingStatus[keyof typeof ListingStatus];

// Define listing duration types with their day counts
export const ListingDurationType = {
  THREE_DAY: '3_day',
  SEVEN_DAY: '7_day',
  THIRTY_DAY: '30_day'
} as const;

export type ListingDurationType = typeof ListingDurationType[keyof typeof ListingDurationType];

// Pricing constants for different listing durations and types
export const ListingPrices = {
  // Real Property (FSBO, FSBA, FOR RENT, WANTED)
  REAL_PROPERTY: {
    [ListingDurationType.THREE_DAY]: null, // Not available
    [ListingDurationType.SEVEN_DAY]: null, // Not available
    [ListingDurationType.THIRTY_DAY]: 5000, // $50.00 (stored in cents)
  },
  // Open houses/Garage sales
  OPEN_HOUSE: {
    [ListingDurationType.THREE_DAY]: 1000, // $10.00
    [ListingDurationType.SEVEN_DAY]: 2500, // $25.00
    [ListingDurationType.THIRTY_DAY]: 5000, // $50.00
  },
  // Classified ads
  CLASSIFIED: {
    [ListingDurationType.THREE_DAY]: 1000, // $10.00
    [ListingDurationType.SEVEN_DAY]: 2500, // $25.00
    [ListingDurationType.THIRTY_DAY]: 5000, // $50.00
  },
  // Default pricing fallback
  DEFAULT: {
    [ListingDurationType.THREE_DAY]: 1000, // $10.00
    [ListingDurationType.SEVEN_DAY]: 2500, // $25.00
    [ListingDurationType.THIRTY_DAY]: 5000, // $50.00
  }
} as const;

// Update users table definition
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isResident: boolean("is_resident").notNull().default(false),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  phoneNumber: text("phone_number"),
  avatarUrl: text("avatar_url"),
  residentTags: text("resident_tags").array(),
  role: text("role").notNull().default(UserRole.REGISTERED),
  // isApproved field has been removed as it's no longer needed
  isBlocked: boolean("is_blocked").notNull().default(false), // Added to track blocked users separately
  blockReason: text("block_reason"), // Optional reason for blocking
  // Password reset fields
  resetToken: text("reset_token"),
  resetTokenExpires: timestamp("reset_token_expires"),
  // Barefoot Bay survey questions
  // Resident section
  isLocalResident: boolean("is_local_resident").default(false),
  ownsHomeInBB: boolean("owns_home_in_bb").default(false),
  rentsHomeInBB: boolean("rents_home_in_bb").default(false),
  isFullTimeResident: boolean("is_full_time_resident").default(false),
  isSnowbird: boolean("is_snowbird").default(false),
  hasMembershipBadge: boolean("has_membership_badge").default(false),
  membershipBadgeNumber: text("membership_badge_number"),
  buysDayPasses: boolean("buys_day_passes").default(false),
  // Non-resident section
  hasLivedInBB: boolean("has_lived_in_bb").default(false),
  hasVisitedBB: boolean("has_visited_bb").default(false),
  neverVisitedBB: boolean("never_visited_bb").default(false),
  hasFriendsInBB: boolean("has_friends_in_bb").default(false),
  consideringMovingToBB: boolean("considering_moving_to_bb").default(false),
  wantToDiscoverBB: boolean("want_to_discover_bb").default(false),
  neverHeardOfBB: boolean("never_heard_of_bb").default(false),
  // Square integration fields
  squareCustomerId: text("square_customer_id"), // Square customer profile ID
  
  // Subscription information
  subscriptionId: text("subscription_id"), // Square subscription ID
  subscriptionType: text("subscription_type"), // 'monthly' or 'annual'
  subscriptionStatus: text("subscription_status"), // 'active', 'cancelled', 'past_due'
  subscriptionStartDate: timestamp("subscription_start_date"),
  subscriptionEndDate: timestamp("subscription_end_date"),
  previousRole: text("previous_role"), // Store role before upgrading to paid sponsor
  // Email notification preferences
  emailNotificationsEnabled: boolean("email_notifications_enabled").notNull().default(true),
  // Club memberships - stores slugs of social clubs the user belongs to
  clubMemberships: text("club_memberships").array(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Update real estate listings table with new fields
export const realEstateListings = pgTable("real_estate_listings", {
  id: serial("id").primaryKey(),
  listingType: text("listing_type").notNull(), // 'FSBO', 'Agent', 'Rent', 'OpenHouse', 'Wanted', 'Classified'
  category: text("category"), // For classifieds: 'Garage Sale', 'Furniture', etc.
  title: text("title").notNull(),
  price: integer("price"),
  address: text("address"),
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  squareFeet: integer("square_feet"),
  yearBuilt: integer("year_built"),
  description: text("description"),
  photos: text("photos").array(),
  cashOnly: boolean("cash_only").default(false),
  openHouseDate: timestamp("open_house_date"),
  openHouseStartTime: text("open_house_start_time"),
  openHouseEndTime: text("open_house_end_time"),
  contactInfo: jsonb("contact_info").notNull(),
  // isApproved field has been removed as it's no longer needed
  
  // Listing status field (DRAFT, ACTIVE, EXPIRED)
  status: text("status").default(ListingStatus.DRAFT).notNull(),
  
  // Fields for subscription and expiration
  expirationDate: timestamp("expiration_date"),
  listingDuration: text("listing_duration"), // '3_day', '7_day', '30_day'
  isSubscription: boolean("is_subscription").default(false),
  subscriptionId: text("subscription_id"), // Square subscription ID
  
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Add this type definition after the existing imports

export type DaySchedule = {
  isOpen: boolean;
  openTime: string;
  closeTime: string;
};

export type OperatingHours = Record<string, DaySchedule>;

// Define recurrence frequency types
export const RecurrenceFrequency = {
  DAILY: "daily",
  WEEKLY: "weekly",
  BIWEEKLY: "biweekly",
  MONTHLY: "monthly",
  YEARLY: "yearly",
} as const;

// Update the events table definition to support recurring events and hours of operation
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  
  // Legacy columns for backward compatibility (database has both old and new date/time columns)
  // These are still required by the database NOT NULL constraint
  eventDate: date("event_date").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  
  location: text("location"),
  mapLink: text("map_link"),
  websiteUrl: text("website_url"),
  hoursOfOperation: jsonb("hours_of_operation"), // JSONB type for hours of operation
  category: text("category").notNull(),
  contactInfo: jsonb("contact_info"),
  mediaUrls: text("media_urls").array(),
  
  // Badge requirement field
  badgeRequired: boolean("badge_required").default(false), // Whether a membership badge is required
  
  // Recurring event fields
  isRecurring: boolean("is_recurring").default(false),
  recurrenceFrequency: text("recurrence_frequency"), // daily, weekly, biweekly, monthly, yearly
  recurrenceEndDate: timestamp("recurrence_end_date"), // When the recurring event series ends
  parentEventId: integer("parent_event_id").references((): AnyPgColumn => events.id, { onDelete: "cascade" }), // For child events in a recurring series
  
  // Platinum sponsor fields
  sponsorTagline: text("sponsor_tagline"),
  sponsorPhone: text("sponsor_phone"),
  sponsorWebsiteUrl: text("sponsor_website_url"),
  sponsorVendorPageSlug: text("sponsor_vendor_page_slug"),
  sponsorIsPoliticalAd: boolean("sponsor_is_political_ad").default(false),
  sponsorPoliticalAdText: text("sponsor_political_ad_text"),
  
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// New table for event interactions
export const eventInteractions = pgTable("event_interactions", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  interactionType: text("interaction_type").notNull(), // 'like', 'going', 'interested'
  createdAt: timestamp("created_at").defaultNow(),
});

// New table for event comments
export const eventComments = pgTable("event_comments", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Add after the existing table definitions
export const pageContents = pgTable("page_contents", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull(), // e.g. "amenities#golf"
  title: text("title").notNull(),
  content: text("content").notNull(),
  mediaUrls: text("media_urls").array(),
  isHidden: boolean("is_hidden").notNull().default(false), // To hide pages like vendor pages
  hideDefaultTitle: boolean("hide_default_title").notNull().default(false), // When true, the detail page hides the auto-rendered title (used when the body already contains its own styled headline)
  order: integer("order").default(0), // Added for controlling display order
  updatedBy: integer("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Content versions table stores revision history
export const contentVersions = pgTable("content_versions", {
  id: serial("id").primaryKey(),
  contentId: integer("content_id").notNull().references(() => pageContents.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  mediaUrls: text("media_urls").array(),
  createdBy: integer("created_by").references(() => users.id),
  versionNumber: integer("version_number").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  notes: text("notes").default(""),
});

// Credit and payment tracking tables
export const userCredits = pgTable("user_credits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  credits: integer("credits").notNull().default(0), // Number of listing credits
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const creditTransactions = pgTable("credit_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  transactionType: text("transaction_type").notNull(), // 'purchase', 'use', 'refund'
  credits: integer("credits").notNull(), // Positive for purchases, negative for usage
  description: text("description"),
  squarePaymentId: text("square_payment_id"), // Reference to Square payment
  orderId: text("order_id"), // Square order ID
  checkoutId: text("checkout_id"), // Square checkout ID
  amount: decimal("amount", { precision: 10, scale: 2 }), // Payment amount in dollars
  currency: text("currency").default("USD"),
  paymentStatus: text("payment_status").default("pending"), // 'pending', 'completed', 'failed'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const squarePayments = pgTable("square_payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  squarePaymentId: text("square_payment_id").notNull(),
  orderId: text("order_id"),
  checkoutId: text("checkout_id"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("USD"),
  status: text("status").notNull(), // 'pending', 'completed', 'failed', 'cancelled'
  listingType: text("listing_type"), // What type of listing this payment is for
  listingDuration: text("listing_duration"), // Duration of the listing
  creditsAwarded: integer("credits_awarded").default(0),
  webhookData: jsonb("webhook_data"), // Store Square webhook data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Create base schemas
const baseUserSchema = createInsertSchema(users);
const baseEventSchema = createInsertSchema(events);
const baseListingSchema = createInsertSchema(realEstateListings);
const baseEventInteractionSchema = createInsertSchema(eventInteractions);
const baseEventCommentSchema = createInsertSchema(eventComments);
const basePageContentSchema = createInsertSchema(pageContents);
const baseContentVersionSchema = createInsertSchema(contentVersions);
const baseUserCreditsSchema = createInsertSchema(userCredits);
const baseCreditTransactionSchema = createInsertSchema(creditTransactions);
const baseSquarePaymentSchema = createInsertSchema(squarePayments);

// Note: Analytics tables are now defined in analytics-schema.ts and re-exported above

// Export the schemas with additional validation
export const insertUserSchema = baseUserSchema
  .omit({ id: true })
  .extend({
    // Square integration fields
    squareCustomerId: z.string().optional(),
    // Add subscription field validations
    subscriptionId: z.string().optional(),
    subscriptionType: z.enum(['monthly', 'annual']).optional(),
    subscriptionStatus: z.enum(['active', 'cancelled', 'past_due']).optional(),
    subscriptionStartDate: z.coerce.date().optional(),
    subscriptionEndDate: z.coerce.date().optional(),
    // Phone number validation (optional field)
    phoneNumber: z.string()
      .optional()
      .refine((val) => !val || phoneRegex.test(val), {
        message: "Phone number must be in format (xxx) xxx-xxxx"
      }),
    // Additional survey fields
    rentsHomeInBB: z.boolean().optional().default(false),
    buysDayPasses: z.boolean().optional().default(false),
    hasVisitedBB: z.boolean().optional().default(false),
    neverVisitedBB: z.boolean().optional().default(false),
    hasFriendsInBB: z.boolean().optional().default(false),
    wantToDiscoverBB: z.boolean().optional().default(false),
    neverHeardOfBB: z.boolean().optional().default(false),
    // Bot detection fields (not stored in database)
    honeypot: z.string().optional().default(''),
    acceptedTerms: z.boolean(),
    recaptchaToken: z.string().optional(),
    // Club memberships - array of social club slugs
    clubMemberships: z.array(z.string()).optional().default([]),
  });

const phoneRegex = /^\(\d{3}\) \d{3}-\d{4}$/;

// Update the insertEventSchema with recurring event fields
export const insertEventSchema = baseEventSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    // Required fields
    title: z.string().min(1, "Event title is required"),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    location: z.string().min(1, "Location is required"),
    category: z.enum(["entertainment", "government", "social", "promotional", "bulletin", "platinum_sponsor"]),

    // Legacy fields for backward compatibility (generated on backend)
    eventDate: z.string().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),

    // Optional fields - use preprocess to ensure null is accepted even if base schema overrides
    description: z.preprocess((val) => val === null ? undefined : val, z.string().optional()),
    businessName: z.string().optional().nullable(),
    badgeRequired: z.boolean().optional().default(false), // Whether a membership badge is required
    contactInfo: z.object({
      name: z.string().optional().nullable(),
      phone: z.string().optional().nullable(),
      email: z.string().optional().nullable(),
      website: z.string().optional().nullable()
    }).optional().default({}),
    hoursOfOperation: z.record(z.string(), z.object({
      isOpen: z.boolean(),
      openTime: z.string(),
      closeTime: z.string(),
    })).nullable().optional(),
    mediaUrls: z.array(z.string()).optional(),
    
    // Recurring event fields
    isRecurring: z.boolean().optional().default(false),
    recurrenceFrequency: z.enum([
      RecurrenceFrequency.DAILY,
      RecurrenceFrequency.WEEKLY,
      RecurrenceFrequency.BIWEEKLY,
      RecurrenceFrequency.MONTHLY,
      RecurrenceFrequency.YEARLY
    ]).nullable().optional(),
    recurrenceEndDate: z.coerce.date().nullable().optional(),
    parentEventId: z.number().optional(),
    
    // Platinum sponsor fields - use preprocess to coerce null to undefined for robust validation
    sponsorTagline: z.preprocess((val) => val === null ? undefined : val, z.string().optional()),
    sponsorPhone: z.preprocess((val) => val === null ? undefined : val, z.string().optional()),
    sponsorWebsiteUrl: z.preprocess((val) => val === null ? undefined : val, z.string().optional()),
    sponsorVendorPageSlug: z.preprocess((val) => val === null ? undefined : val, z.string().optional()),
    sponsorIsPoliticalAd: z.preprocess((val) => val === null ? undefined : val, z.boolean().optional()),
    sponsorPoliticalAdText: z.preprocess((val) => val === null ? undefined : val, z.string().optional()),
  })
  .refine((data) => {
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    return endDate > startDate;
  }, {
    message: "End date must be after start date",
    path: ["endDate"],
  })
  .refine((data) => {
    // If it's a recurring event, recurrence fields are required
    if (data.isRecurring) {
      return !!data.recurrenceFrequency && !!data.recurrenceEndDate;
    }
    return true;
  }, {
    message: "Recurring events must have a frequency and end date",
    path: ["recurrenceEndDate"],
  });

export const insertEventInteractionSchema = baseEventInteractionSchema.omit({ id: true, createdAt: true });
export const insertEventCommentSchema = baseEventCommentSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const insertListingSchema = baseListingSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    listingType: z.enum(['FSBO', 'Agent', 'Rent', 'OpenHouse', 'Wanted', 'Classified', 'GarageSale']),
    category: z.string().optional(),
    price: z.number().min(0).optional(),
    address: z.string().optional(),
    bedrooms: z.number().min(0).optional(),
    bathrooms: z.number().min(0).optional(),
    squareFeet: z.number().min(0).optional(),
    yearBuilt: z.number().optional(),
    photos: z.array(z.string()).optional(),
    contactInfo: z.object({
      name: z.string().min(1, "Name is required"),
      phone: z.string().regex(phoneRegex, "Phone number must be in format (555) 555-5555"),
      email: z.string().email("Invalid email address"),
    }),
    
    // Status field (DRAFT, ACTIVE, EXPIRED)
    status: z.enum([
      ListingStatus.DRAFT, 
      ListingStatus.ACTIVE, 
      ListingStatus.EXPIRED
    ]).default(ListingStatus.DRAFT),
    
    // Subscription and expiration fields
    expirationDate: z.date().nullable().optional(),
    // More flexible listingDuration field that accepts multiple formats and normalizes them
    listingDuration: z.union([
      z.enum([
        ListingDurationType.THREE_DAY,
        ListingDurationType.SEVEN_DAY,
        ListingDurationType.THIRTY_DAY
      ]), 
      // Also allow just the number part
      z.enum(['3', '7', '30']),
      // Also allow format without underscore
      z.enum(['3day', '7day', '30day'])
    ]).transform(val => {
      // Normalize to the proper format with underscore
      if (val === '3' || val === '3day') return ListingDurationType.THREE_DAY;
      if (val === '7' || val === '7day') return ListingDurationType.SEVEN_DAY;
      if (val === '30' || val === '30day') return ListingDurationType.THIRTY_DAY;
      return val;
    }).optional(),
    isSubscription: z.boolean().optional().default(false),
    subscriptionId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Only enforce property requirements when actively publishing. Drafts
    // (and any other status like EXPIRED) skip this check so they aren't
    // blocked by missing details.
    if (data.status !== ListingStatus.ACTIVE) {
      return;
    }

    // Active property listings (FSBO, Agent, Rent, OpenHouse) must have an
    // address and a price. Bedrooms/bathrooms/square feet/year built are
    // optional so lots and land (with no home) can be published.
    if (['FSBO', 'Agent', 'Rent', 'OpenHouse'].includes(data.listingType)) {
      if (!data.address) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Address is required for property listings",
          path: ["address"],
        });
      }
      if (data.price === undefined || data.price === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Price is required for property listings",
          path: ["price"],
        });
      }
    }
  });

// Add after the existing schema definitions
/**
 * Migration schema for tracking the migration status of media files
 * This helps track which files have been migrated to Object Storage
 */
export const migrationRecords = pgTable("migration_records", {
  id: serial("id").primaryKey(),
  sourceType: text("source_type").notNull(), // 'filesystem' or 'postgresql'
  sourceLocation: text("source_location").notNull(), // Original file path or database reference
  mediaBucket: text("media_bucket").notNull(), // Target bucket in object storage
  mediaType: text("media_type").notNull(), // Media type (calendar, forum, etc.)
  storageKey: text("storage_key").notNull(), // Object storage key
  migrationStatus: text("migration_status").notNull(), // 'pending', 'migrated', 'failed'
  errorMessage: text("error_message"), // Error message if failed
  migratedAt: timestamp("migrated_at"), // When the file was migrated
  verificationStatus: boolean("verification_status").default(false), // Whether file was verified in object storage
  verifiedAt: timestamp("verified_at"), // When the file was verified
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Export migration record types
export type MigrationRecord = typeof migrationRecords.$inferSelect;
export type InsertMigrationRecord = typeof migrationRecords.$inferInsert;

export const insertPageContentSchema = basePageContentSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    title: z.string().min(1, "Title is required"),
    content: z.string().min(1, "Content is required"),
    mediaUrls: z.array(z.string()).optional().default([]),
    isHidden: z.boolean().optional().default(false),
    hideDefaultTitle: z.boolean().optional().default(false),
    order: z.number().optional().default(0),
    category: z.string().optional(), // Accept vendor category from form submission
  });

export const insertContentVersionSchema = baseContentVersionSchema
  .omit({ id: true, createdAt: true })
  .extend({
    contentId: z.number(),
    slug: z.string(),
    title: z.string().min(1, "Title is required"),
    content: z.string().min(1, "Content is required"),
    mediaUrls: z.array(z.string()).optional().default([]),
    versionNumber: z.number(),
    notes: z.string().optional(),
  });


// Export types
export type User = typeof users.$inferSelect;
export type Event = typeof events.$inferSelect;
export type EventInteraction = typeof eventInteractions.$inferSelect;
export type EventComment = typeof eventComments.$inferSelect;
export type RealEstateListing = typeof realEstateListings.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type InsertEventInteraction = z.infer<typeof insertEventInteractionSchema>;
export type InsertEventComment = z.infer<typeof insertEventCommentSchema>;
export type InsertListing = z.infer<typeof insertListingSchema>;
export type PageContent = typeof pageContents.$inferSelect;
export type InsertPageContent = z.infer<typeof insertPageContentSchema>;
export type ContentVersion = typeof contentVersions.$inferSelect;
export type InsertContentVersion = z.infer<typeof insertContentVersionSchema>;

// Add these type definitions after the existing types
export type InteractionWithUser = EventInteraction & {
  user?: {
    id: number;
    username: string;
    avatarUrl: string | null;
    isResident?: boolean;
  };
};

export type CommentWithUser = EventComment & {
  user?: {
    id: number;
    username: string;
    avatarUrl: string | null;
    isResident?: boolean;
  };
};

export type VendorCommentWithUser = VendorComment & {
  user?: {
    id: number;
    username: string;
    avatarUrl: string | null;
    isResident?: boolean;
  };
};

export type VendorInteractionWithUser = VendorInteraction & {
  user?: {
    id: number;
    username: string;
    avatarUrl: string | null;
    isResident?: boolean;
  };
};

export type ForumReactionWithUser = ForumReaction & {
  user?: {
    id: number;
    username: string;
    avatarUrl: string | null;
    isResident?: boolean;
    role?: string;
    subscriptionStatus?: string;
    hasMembershipBadge?: boolean;
    createdAt?: Date | null;
  };
};

// Extended Event type with child count for recurring events
export type EventWithChildCount = Event & {
  childCount?: number; // Number of child events for parent events
};

// New table for listing payments
export const listingPayments = pgTable("listing_payments", {
  id: serial("id").primaryKey(),
  userId: integer("userid").references(() => users.id).notNull(), // Match the actual database column name
  listingId: integer("listingid").references(() => realEstateListings.id),
  amount: integer("amount").notNull(), // Amount in cents
  currency: text("currency").notNull().default("usd"),
  status: text("status").notNull(), // 'pending', 'completed', 'failed'
  paymentIntentId: text("paymentintentid"), // Stripe/Square payment intent ID
  discountCode: text("discountcode"),
  listingType: text("listing_type"), // Type of listing (FSBO, CLASSIFIED, etc.)
  listingDuration: text("listing_duration"), // Duration of listing (3_day, 7_day, 30_day)
  isSubscription: boolean("is_subscription").default(false), // Whether this payment is for a subscription
  subscriptionId: text("subscription_id"), // Square subscription ID
  subscriptionPlan: text("subscription_plan"), // MONTHLY, QUARTERLY, etc.
  createdAt: timestamp("createdat").defaultNow(),
  updatedAt: timestamp("updatedat").defaultNow(),
});

// Create base schema for listing payments
const baseListingPaymentSchema = createInsertSchema(listingPayments);

// Export the schema with additional validation
export const insertListingPaymentSchema = baseListingPaymentSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    amount: z.number().min(0),
    currency: z.string().default("usd"),
    status: z.enum(["pending", "completed", "failed"]),
    paymentIntentId: z.string().optional(),
    discountCode: z.string().optional(),
    listingType: z.enum([
      ListingType.FSBO, 
      ListingType.AGENT, 
      ListingType.RENT, 
      ListingType.OPEN_HOUSE, 
      ListingType.WANTED, 
      ListingType.CLASSIFIED,
      ListingType.GARAGE_SALE
    ]).optional(),
    listingDuration: z.enum([
      ListingDurationType.THREE_DAY,
      ListingDurationType.SEVEN_DAY,
      ListingDurationType.THIRTY_DAY
    ]).optional(),
    isSubscription: z.boolean().default(false),
    subscriptionId: z.string().optional(),
    subscriptionPlan: z.string().optional(),
  });

export type ListingPayment = typeof listingPayments.$inferSelect;
export type InsertListingPayment = z.infer<typeof insertListingPaymentSchema>;

// Define product-related constants
export const ProductCategory = {
  APPAREL: 'apparel',
  HOME: 'home',
  ACCESSORIES: 'accessories',
  SPONSORSHIP: 'sponsorship',
  MEMBERSHIPS: 'memberships',
  ALL: 'all',
} as const;

export const ProductStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DRAFT: 'draft',
} as const;

export const PrintProvider = {
  PRINTFUL: 'printful',
  PRINTIFY: 'printify',
  GOOTEN: 'gooten',
} as const;

// Store products table
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  category: text("category").notNull(),
  imageUrls: text("image_urls").array(),
  status: text("status").notNull().default(ProductStatus.DRAFT),
  featured: boolean("featured").default(false), // Flag for featured products
  
  // Print-on-demand specific fields
  printProviderId: text("print_provider_id"), // External ID from the print provider
  printProvider: text("print_provider"), // 'printful', 'printify', etc.
  variantData: jsonb("variant_data"), // Store color, size, and other variant info
  designUrls: text("design_urls").array(), // URLs to design files
  mockupUrls: text("mockup_urls").array(), // URLs to mockup images

  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Create base schema for products
const baseProductSchema = createInsertSchema(products);

// Export the schema with additional validation
export const insertProductSchema = baseProductSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    name: z.string().min(1, "Product name is required"),
    description: z.string().optional(),
    price: z.number().min(0, "Price cannot be negative"),
    category: z.enum([ProductCategory.APPAREL, ProductCategory.HOME, ProductCategory.ACCESSORIES, ProductCategory.SPONSORSHIP, ProductCategory.MEMBERSHIPS, ProductCategory.ALL]),
    imageUrls: z.array(z.string()).default([]),
    status: z.enum([ProductStatus.ACTIVE, ProductStatus.INACTIVE, ProductStatus.DRAFT]).default(ProductStatus.DRAFT),
    featured: z.boolean().default(false), // Flag for featured products
    
    // Print-on-demand fields
    printProviderId: z.string().optional(),
    printProvider: z.enum([PrintProvider.PRINTFUL, PrintProvider.PRINTIFY, PrintProvider.GOOTEN]).optional(),
    variantData: z.record(z.string(), z.any()).optional(),
    designUrls: z.array(z.string()).default([]),
    mockupUrls: z.array(z.string()).default([]),
  });

// Order status enum
export const OrderStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  RETURNED: "returned",
  RETURN_REQUESTED: "return_requested",
  RETURN_APPROVED: "return_approved",
  RETURN_SHIPPED: "return_shipped",
  RETURN_RECEIVED: "return_received",
  REFUNDED: "refunded",
} as const;

// Order table for product purchases
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  status: text("status").notNull(), // 'pending', 'processing', 'shipped', 'delivered', 'cancelled'
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  shippingAddress: jsonb("shipping_address"),
  paymentIntentId: text("payment_intent_id"), // For external payment service reference
  discountCode: text("discount_code"), // Store the applied discount code
  squareOrderId: text("square_order_id"), // Square order ID for tracking
  printProviderOrderId: text("print_provider_order_id"), // External order ID from print provider
  trackingNumber: text("tracking_number"),
  trackingUrl: text("tracking_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Order item table
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id).notNull(),
  productId: bigint("product_id", { mode: "number" }).notNull(), // Changed to bigint for large Printful IDs
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  variantInfo: jsonb("variant_info"), // Store selected size, color, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// Create base schemas for orders and order items
const baseOrderSchema = createInsertSchema(orders);
const baseOrderItemSchema = createInsertSchema(orderItems);

// Export the schemas with additional validation
// Return reason enum
export const ReturnReason = {
  WRONG_SIZE: "wrong_size",
  WRONG_ITEM: "wrong_item",
  DEFECTIVE: "defective",
  NOT_AS_DESCRIBED: "not_as_described",
  CHANGED_MIND: "changed_mind",
  OTHER: "other",
} as const;

// Return status enum
export const ReturnStatus = {
  REQUESTED: "requested",
  APPROVED: "approved",
  DENIED: "denied",
  LABEL_CREATED: "label_created",
  SHIPPED: "shipped",
  RECEIVED: "received",
  REFUNDED: "refunded",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

// Returns table for tracking product returns
export const orderReturns = pgTable("order_returns", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id).notNull(),
  userId: integer("user_id").references(() => users.id),
  status: text("status").notNull().default(ReturnStatus.REQUESTED),
  reason: text("reason").notNull(),
  notes: text("notes"),
  reasonDetails: text("reason_details"),
  imageUrls: text("image_urls").array(), // Photos of the issue if applicable
  returnLabelUrl: text("return_label_url"),
  trackingNumber: text("tracking_number"),
  refundAmount: decimal("refund_amount", { precision: 10, scale: 2 }),
  refundId: text("refund_id"), // Reference to Square refund ID
  printfulReturnId: text("printful_return_id"), // Printful return reference
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Return items table to track which items are being returned
export const returnItems = pgTable("return_items", {
  id: serial("id").primaryKey(),
  returnId: integer("return_id").references(() => orderReturns.id).notNull(),
  orderItemId: integer("order_item_id").references(() => orderItems.id).notNull(),
  quantity: integer("quantity").notNull(),
  reason: text("reason").notNull(),
  reasonDetails: text("reason_details"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Create base schemas for returns and return items
const baseOrderReturnSchema = createInsertSchema(orderReturns);
const baseReturnItemSchema = createInsertSchema(returnItems);

export const insertOrderSchema = baseOrderSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    status: z.enum([
      'pending', 'processing', 'shipped', 'delivered', 'cancelled',
      'return_requested', 'return_approved', 'return_shipped', 'return_received', 'refunded', 'returned'
    ]).default('pending'),
    total: z.number().min(0),
    shippingAddress: z.object({
      fullName: z.string().min(1, "Full name is required"),
      streetAddress: z.string().min(1, "Street address is required"),
      city: z.string().min(1, "City is required"),
      state: z.string().min(1, "State is required"),
      zipCode: z.string().min(5, "Zip code is required"),
      country: z.string().min(1, "Country is required"),
      phone: z.string().optional(),
    }),
    paymentIntentId: z.string().optional(),
    discountCode: z.string().optional(),
    squareOrderId: z.string().optional(),
    printProviderOrderId: z.string().optional(),
    trackingNumber: z.string().optional(),
    trackingUrl: z.string().optional(),
  });

export const insertOrderItemSchema = baseOrderItemSchema
  .omit({ id: true, createdAt: true })
  .extend({
    quantity: z.number().min(1, "Quantity must be at least 1"),
    price: z.number().min(0, "Price cannot be negative"),
    variantInfo: z.record(z.string(), z.any()).optional(),
  });

// Form field types enum
export const FormFieldType = {
  TEXT: "text",
  EMAIL: "email",
  PHONE: "phone",
  TEXTAREA: "textarea",
  CHECKBOX: "checkbox",
  SELECT: "select",
  RADIO: "radio",
  FILE: "file",
} as const;

// Custom forms table - used to define form structures
// Custom forms table for embedded forms
// Note on form deletion: When a form is deleted through deleteCustomForm(),
// a shadow copy with a negative ID (e.g., -11 for form 11) is created, 
// and all submissions are updated to reference this negative ID before
// the original form is deleted. This preserves form submissions for reporting
// while removing the form itself from the website.
export const customForms = pgTable("custom_forms", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  formFields: jsonb("form_fields").notNull(), // Array of field definitions
  termsAndConditions: text("terms_and_conditions"), // Optional T&C text
  requiresTermsAcceptance: boolean("requires_terms_acceptance").default(false),
  slug: text("slug").notNull().unique(), // Unique identifier for the form
  pageContentId: integer("page_content_id").references(() => pageContents.id),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Form submissions table - stores user responses to custom forms
// Note: When a form is deleted, submissions are preserved by updating their
// formId to reference a "shadow copy" of the form with a negative ID.
// For example, if form ID 11 is deleted, its submissions will reference
// form ID -11, and a shadow record will be created in the custom_forms table
// with ID -11 to maintain the foreign key constraint.
export const formSubmissions = pgTable("form_submissions", {
  id: serial("id").primaryKey(),
  formId: integer("form_id").references(() => customForms.id).notNull(),
  userId: integer("user_id").references(() => users.id), // Optional, for authenticated users
  submitterEmail: text("submitter_email"), // For collecting email from non-authenticated users
  formData: jsonb("form_data").notNull(), // JSON object with the form responses
  fileUploads: text("file_uploads").array(), // Array of file upload paths
  termsAccepted: boolean("terms_accepted").default(false),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Create base schemas for forms and submissions
const baseCustomFormSchema = createInsertSchema(customForms);
const baseFormSubmissionSchema = createInsertSchema(formSubmissions);

// Export the schemas with additional validation
export const insertCustomFormSchema = baseCustomFormSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    title: z.string().min(1, "Form title is required"),
    description: z.string().optional(),
    formFields: z.array(z.object({
      id: z.string(), // Unique ID for the field
      type: z.enum([
        FormFieldType.TEXT, 
        FormFieldType.EMAIL, 
        FormFieldType.PHONE, 
        FormFieldType.TEXTAREA,
        FormFieldType.CHECKBOX,
        FormFieldType.SELECT,
        FormFieldType.RADIO,
        FormFieldType.FILE
      ]),
      label: z.string().min(1, "Field label is required"),
      placeholder: z.string().optional(),
      required: z.boolean().default(false),
      order: z.number().int().nonnegative(),
      options: z.array(z.string()).optional(), // For select/radio/checkbox fields
      maxLength: z.number().int().positive().optional(),
      helperText: z.string().optional(),
      validationRegex: z.string().optional(),
      validationMessage: z.string().optional(),
    })),
    termsAndConditions: z.string().optional(),
    requiresTermsAcceptance: z.boolean().default(false),
    slug: z.string().min(1, "Form slug is required"),
  });

export const insertFormSubmissionSchema = baseFormSubmissionSchema
  .omit({ id: true, createdAt: true })
  .extend({
    formId: z.number().int().positive(),
    userId: z.number().int().positive().optional(),
    submitterEmail: z.string().email().optional(),
    formData: z.record(z.string(), z.any()),
    fileUploads: z.array(z.string()).optional(),
    termsAccepted: z.boolean().default(false),
    ipAddress: z.string().optional(),
  });

// Export the types
export type CustomForm = typeof customForms.$inferSelect;
export type InsertCustomForm = z.infer<typeof insertCustomFormSchema>;

/**
 * FormSubmission type augmented with metadata for tracking deleted forms
 * 
 * When a form is deleted, we create a shadow copy with a negative ID and update 
 * all form submissions to point to that negative ID. This allows us to:
 * 
 * 1. Preserve all user submission data for reporting and compliance
 * 2. Remove the form from the website to prevent new submissions
 * 3. Show a visual indicator in the admin UI for submissions from deleted forms
 * 
 * The _deletedForm flag is set by the getAllFormSubmissions() and getFormSubmission()
 * methods in storage.ts when they detect a negative formId.
 */
export type FormSubmission = typeof formSubmissions.$inferSelect & {
  _deletedForm?: boolean; // Flag to indicate if the form was deleted (has negative formId)
};

export type InsertFormSubmission = z.infer<typeof insertFormSubmissionSchema>;
export type FormField = z.infer<typeof insertCustomFormSchema>["formFields"][0];

// Add return-related schemas
export const insertOrderReturnSchema = baseOrderReturnSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    status: z.enum([
      ReturnStatus.REQUESTED,
      ReturnStatus.APPROVED,
      ReturnStatus.DENIED,
      ReturnStatus.LABEL_CREATED,
      ReturnStatus.SHIPPED,
      ReturnStatus.RECEIVED,
      ReturnStatus.REFUNDED,
      ReturnStatus.COMPLETED,
      ReturnStatus.CANCELLED,
    ]).default(ReturnStatus.REQUESTED),
    reason: z.enum([
      ReturnReason.WRONG_SIZE,
      ReturnReason.WRONG_ITEM,
      ReturnReason.DEFECTIVE,
      ReturnReason.NOT_AS_DESCRIBED,
      ReturnReason.CHANGED_MIND,
      ReturnReason.OTHER,
    ]),
    notes: z.string().optional(),
    reasonDetails: z.string().optional(),
    imageUrls: z.array(z.string()).optional(),
    returnLabelUrl: z.string().optional(),
    trackingNumber: z.string().optional(),
    refundAmount: z.number().min(0).optional(),
    refundId: z.string().optional(),
    printfulReturnId: z.string().optional(),
    adminNotes: z.string().optional(),
  });

export const insertReturnItemSchema = baseReturnItemSchema
  .omit({ id: true, createdAt: true })
  .extend({
    quantity: z.number().min(1, "Quantity must be at least 1"),
    reason: z.enum([
      ReturnReason.WRONG_SIZE,
      ReturnReason.WRONG_ITEM,
      ReturnReason.DEFECTIVE,
      ReturnReason.NOT_AS_DESCRIBED,
      ReturnReason.CHANGED_MIND,
      ReturnReason.OTHER,
    ]),
    reasonDetails: z.string().optional(),
  });

// Forum tables

// Forum header description 
export const forumDescription = pgTable("forum_description", {
  id: serial("id").primaryKey(),
  content: text("content").notNull().default(''),
  updatedBy: integer("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Forum categories
export const forumCategories = pgTable("forum_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  slug: text("slug").notNull().unique(),
  icon: text("icon"), // Icon name for the category
  order: integer("order").default(0), // For controlling display order
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Forum posts
export const forumPosts = pgTable("forum_posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  categoryId: integer("category_id").references(() => forumCategories.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  isPinned: boolean("is_pinned").default(false),
  isLocked: boolean("is_locked").default(false),
  views: integer("views").default(0),
  mediaUrls: text("media_urls").array(),
  customPreview: text("custom_preview"), // Admin-editable preview text override
  notifyPreference: text("notify_preference"), // Email notification preference: 'all_admins' or 'none'
  hideDefaultTitle: boolean("hide_default_title").default(false), // When true, the post detail page hides the auto-rendered title (used when authors style their own headline inside the body)
  featuredImage: text("featured_image"), // Admin-set featured image URL for the news-card feed
  isEditoriallyUpdated: boolean("is_editorially_updated").default(false), // Admin-set "Updated" badge for the news feed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Forum comments/replies
export const forumComments = pgTable("forum_comments", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  postId: integer("post_id").references(() => forumPosts.id).notNull(),
  authorId: integer("author_id").references(() => users.id).notNull(), // Using authorId instead of userId to match database
  mediaUrls: text("media_urls").array(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Forum reactions (likes, etc.)
export const forumReactions = pgTable("forum_reactions", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => forumPosts.id),
  commentId: integer("comment_id").references(() => forumComments.id),
  userId: integer("user_id").references(() => users.id).notNull(),
  reactionType: text("reaction_type").notNull(), // 'like', 'thumbsup', etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// Forum read states - tracks per-user read status for threads
export const forumReadStates = pgTable("forum_read_states", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  postId: integer("post_id").references(() => forumPosts.id).notNull(),
  lastReadCommentId: integer("last_read_comment_id").references(() => forumComments.id),
  lastReadAt: timestamp("last_read_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Unique constraint to prevent duplicate entries
  userPostUnique: unique().on(table.userId, table.postId),
  // Indexes for efficient lookups
  userIdIdx: index("forum_read_states_user_id_idx").on(table.userId),
  postIdIdx: index("forum_read_states_post_id_idx").on(table.postId),
  userPostIdx: index("forum_read_states_user_post_idx").on(table.userId, table.postId),
}));

// Forum subscriptions - tracks which users are subscribed to receive email notifications for posts
export const forumSubscriptions = pgTable("forum_subscriptions", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => forumPosts.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  subscribedAt: timestamp("subscribed_at").defaultNow().notNull(),
  unsubscribedAt: timestamp("unsubscribed_at"),
  emailOptOut: boolean("email_opt_out").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Unique constraint to prevent duplicate subscriptions
  postUserUnique: unique().on(table.postId, table.userId),
  // Indexes for efficient lookups
  userIdIdx: index("forum_subscriptions_user_id_idx").on(table.userId),
  postIdIdx: index("forum_subscriptions_post_id_idx").on(table.postId),
  // Index for active subscriptions (most common query)
  activeSubscriptionsIdx: index("forum_subscriptions_active_idx").on(table.postId, table.unsubscribedAt, table.emailOptOut),
}));

// Create base schemas for forum tables
const baseForumCategorySchema = createInsertSchema(forumCategories);
const baseForumPostSchema = createInsertSchema(forumPosts);
const baseForumCommentSchema = createInsertSchema(forumComments);
const baseForumReactionSchema = createInsertSchema(forumReactions);
const baseForumDescriptionSchema = createInsertSchema(forumDescription);
const baseForumReadStateSchema = createInsertSchema(forumReadStates);
const baseForumSubscriptionSchema = createInsertSchema(forumSubscriptions);

// Export the schemas with additional validation
export const insertForumCategorySchema = baseForumCategorySchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    name: z.string().min(2, "Category name is required and must be at least 2 characters"),
    description: z.string().optional(),
    slug: z.string().min(2, "Slug is required"),
    icon: z.string().optional(),
    order: z.number().optional(),
  });

export const insertForumPostSchema = baseForumPostSchema
  .omit({ id: true, createdAt: true, updatedAt: true, views: true })
  .extend({
    title: z.string().min(3, "Post title is required and must be at least 3 characters"),
    content: z.string().min(10, "Post content is required and must be at least 10 characters"),
    categoryId: z.number(),
    isPinned: z.boolean().optional().default(false),
    isLocked: z.boolean().optional().default(false),
    mediaUrls: z.array(z.string()).optional().default([]),
    notifyPreference: z.string().optional(),
    hideDefaultTitle: z.boolean().optional().default(false),
    featuredImage: z.string().nullable().optional(),
    isEditoriallyUpdated: z.boolean().optional(),
  });

export const insertForumCommentSchema = baseForumCommentSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    content: z.string().min(1, "Comment content is required"),
    postId: z.number(),
    authorId: z.number(), // Changed from userId to authorId to match the database column
    parentCommentId: z.number().optional(),
    mediaUrls: z.array(z.string()).optional().default([]),
  });

export const insertForumReactionSchema = baseForumReactionSchema
  .omit({ id: true, createdAt: true })
  .extend({
    postId: z.number().optional(),
    commentId: z.number().optional(),
    reactionType: z.string(),
  })
  .refine((data) => {
    // Either postId or commentId must be provided, but not both
    return (data.postId && !data.commentId) || (!data.postId && data.commentId);
  }, {
    message: "Either postId or commentId must be provided, but not both",
  });

export const insertForumDescriptionSchema = baseForumDescriptionSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    content: z.string(),
  });

export const insertForumReadStateSchema = baseForumReadStateSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    userId: z.number(),
    postId: z.number(),
    lastReadCommentId: z.number().optional(),
  });

export const insertForumSubscriptionSchema = baseForumSubscriptionSchema
  .omit({ id: true, createdAt: true, subscribedAt: true })
  .extend({
    postId: z.number(),
    userId: z.number(),
    emailOptOut: z.boolean().optional().default(false),
  });

// Export the types
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderReturn = typeof orderReturns.$inferSelect;
export type InsertOrderReturn = z.infer<typeof insertOrderReturnSchema>;
export type ReturnItem = typeof returnItems.$inferSelect;
export type InsertReturnItem = z.infer<typeof insertReturnItemSchema>;
export type ForumCategory = typeof forumCategories.$inferSelect;
export type InsertForumCategory = z.infer<typeof insertForumCategorySchema>;
export type ForumPost = typeof forumPosts.$inferSelect;
export type InsertForumPost = z.infer<typeof insertForumPostSchema>;
export type ForumComment = typeof forumComments.$inferSelect;
export type InsertForumComment = z.infer<typeof insertForumCommentSchema>;
export type ForumReaction = typeof forumReactions.$inferSelect;
export type InsertForumReaction = z.infer<typeof insertForumReactionSchema>;
export type ForumDescription = typeof forumDescription.$inferSelect;
export type InsertForumDescription = z.infer<typeof insertForumDescriptionSchema>;
export type ForumReadState = typeof forumReadStates.$inferSelect;
export type InsertForumReadState = z.infer<typeof insertForumReadStateSchema>;
export type ForumSubscription = typeof forumSubscriptions.$inferSelect;
export type InsertForumSubscription = z.infer<typeof insertForumSubscriptionSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type MessageRecipient = typeof messageRecipients.$inferSelect;
export type InsertMessageRecipient = z.infer<typeof insertMessageRecipientSchema>;

// Vendor comments table for vendors pages
export const vendorComments = pgTable("vendor_comments", {
  id: serial("id").primaryKey(),
  pageSlug: text("page_slug").notNull(), // Vendor page slug
  userId: integer("user_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Vendor interactions table (likes, etc.)
export const vendorInteractions = pgTable("vendor_interactions", {
  id: serial("id").primaryKey(),
  pageSlug: text("page_slug").notNull(), // Vendor page slug
  userId: integer("user_id").references(() => users.id).notNull(),
  interactionType: text("interaction_type").notNull(), // 'like', 'recommend', etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// Vendor categories table
export const vendorCategories = pgTable("vendor_categories", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(), // e.g., "home-services"
  name: text("name").notNull().unique(), // e.g., "Home Services"
  icon: text("icon"), // Icon identifier for the category
  order: integer("order").notNull().default(0),
  isHidden: boolean("is_hidden").notNull().default(false), // To hide categories from nav and listings
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Community categories table for organizing community pages
export const communityCategories = pgTable("community_categories", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(), // e.g., "government"
  name: text("name").notNull().unique(), // e.g., "Government & Regulations"
  icon: text("icon"), // Optional icon name for the category (e.g., "Building")
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Create base schemas for vendor comments, interactions, categories and visits
const baseVendorCommentSchema = createInsertSchema(vendorComments);
const baseVendorInteractionSchema = createInsertSchema(vendorInteractions);
const baseVendorCategorySchema = createInsertSchema(vendorCategories);
const baseCommunityCategory = createInsertSchema(communityCategories);

// Export the schemas with additional validation
export const insertVendorCommentSchema = baseVendorCommentSchema
  .omit({ id: true, createdAt: true, updatedAt: true });

export const insertVendorInteractionSchema = baseVendorInteractionSchema
  .omit({ id: true, createdAt: true });

export const insertVendorCategorySchema = baseVendorCategorySchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    slug: z.string().min(1, "Slug is required"),
    name: z.string().min(1, "Name is required"),
    icon: z.string().optional(),
    order: z.number().optional().default(0),
    isHidden: z.boolean().optional().default(false),
  });

export const insertCommunityCategorySchema = baseCommunityCategory
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    slug: z.string().min(1, "Slug is required"),
    name: z.string().min(1, "Name is required"),
    icon: z.string().optional(),
    order: z.number().optional().default(0),
  });

export type VendorComment = typeof vendorComments.$inferSelect;
export type InsertVendorComment = z.infer<typeof insertVendorCommentSchema>;
export type VendorInteraction = typeof vendorInteractions.$inferSelect;
export type InsertVendorInteraction = z.infer<typeof insertVendorInteractionSchema>;
export type VendorCategory = typeof vendorCategories.$inferSelect;
export type InsertVendorCategory = z.infer<typeof insertVendorCategorySchema>;
export type CommunityCategory = typeof communityCategories.$inferSelect;
export type InsertCommunityCategory = z.infer<typeof insertCommunityCategorySchema>;

// Define available feature flag names
export const FeatureFlagName = {
  CALENDAR: 'calendar',
  FORUM: 'forum',
  FOR_SALE: 'for_sale',
  STORE: 'store',
  VENDORS: 'vendors',
  COMMUNITY: 'community',
  LAUNCH_SCREEN: 'launch_screen',
  ADMIN: 'admin_access', // Admin feature flag
  WEATHER_ROCKET_ICONS: 'weather_rocket_icons', // Weather and rocket icons in navigation
  MESSAGES: 'messages', // Private messaging between users
  LIVE_CHAT: 'live_chat', // Live chat bubble in navigation
} as const;

// Feature flags table to control visibility of features based on user roles
export const featureFlags = pgTable("feature_flags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // Name of the feature flag (e.g., 'calendar', 'forum')
  displayName: text("display_name").notNull(), // Display name shown in UI (e.g., 'Calendar', 'Forum')
  enabledForRoles: text("enabled_for_roles").array().notNull().default([]), // Array of roles that can access this feature
  description: text("description"), // Description of what this feature does
  isActive: boolean("is_active").notNull().default(true), // Global switch to toggle feature on/off regardless of roles
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Create base schema for feature flags
const baseFeatureFlagSchema = createInsertSchema(featureFlags);

// Export the schema with additional validation
export const insertFeatureFlagSchema = baseFeatureFlagSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    name: z.enum([
      FeatureFlagName.CALENDAR,
      FeatureFlagName.FORUM,
      FeatureFlagName.FOR_SALE,
      FeatureFlagName.STORE,
      FeatureFlagName.VENDORS,
      FeatureFlagName.COMMUNITY,
      FeatureFlagName.LAUNCH_SCREEN,
      FeatureFlagName.ADMIN,
      FeatureFlagName.WEATHER_ROCKET_ICONS,
      FeatureFlagName.MESSAGES,
    ]),
    displayName: z.string().min(1, "Display name is required"),
    enabledForRoles: z.array(z.enum([
      UserRole.GUEST,
      UserRole.REGISTERED, 
      UserRole.BADGE_HOLDER,
      UserRole.PAID, 
      UserRole.MODERATOR,
      UserRole.ADMIN
    ])),
    description: z.string().optional(),
    isActive: z.boolean().default(true),
  });

export type FeatureFlag = typeof featureFlags.$inferSelect;
export type InsertFeatureFlag = z.infer<typeof insertFeatureFlagSchema>;

// Site settings table for global site configuration
export const siteSettings = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(), // Unique setting key (e.g., 'rocket_icon')
  value: text("value").notNull(), // Setting value (e.g., URL or JSON string)
  description: text("description"), // Optional description
  updatedBy: integer("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Create base schema for site settings
const baseSiteSettingSchema = createInsertSchema(siteSettings);

// Export the schema with additional validation
export const insertSiteSettingSchema = baseSiteSettingSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    key: z.string().min(1, "Setting key is required"),
    value: z.string().min(1, "Setting value is required"),
    description: z.string().optional(),
  });

export type SiteSetting = typeof siteSettings.$inferSelect;
export type InsertSiteSetting = z.infer<typeof insertSiteSettingSchema>;

// Analytics tables are defined earlier in this file (see above)

// Create base schemas for analytics
const baseAnalyticsPageViewSchema = createInsertSchema(analyticsPageViews);
const baseAnalyticsEventSchema = createInsertSchema(analyticsEvents);
const baseAnalyticsSessionSchema = createInsertSchema(analyticsSessions);

// Export the schemas with additional validation
export const insertAnalyticsPageViewSchema = baseAnalyticsPageViewSchema
  .omit({ id: true })
  .extend({
    timestamp: z.coerce.date().optional().default(() => new Date()),
  });

export const insertAnalyticsEventSchema = baseAnalyticsEventSchema
  .omit({ id: true })
  .extend({
    timestamp: z.coerce.date().optional().default(() => new Date()),
    eventData: z.any().optional(),
  });

export const insertAnalyticsSessionSchema = baseAnalyticsSessionSchema
  .omit({ id: true })
  .extend({
    startTimestamp: z.coerce.date().optional().default(() => new Date()),
    // Add validation for geolocation fields
    country: z.string().optional(),
    region: z.string().optional(),
    city: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  });

export type AnalyticsPageView = typeof analyticsPageViews.$inferSelect;
export type InsertAnalyticsPageView = z.infer<typeof insertAnalyticsPageViewSchema>;

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;

export type AnalyticsSession = typeof analyticsSessions.$inferSelect;
export type InsertAnalyticsSession = z.infer<typeof insertAnalyticsSessionSchema>;

// Define message type constants
export const MessageType = {
  DIRECT: 'direct',
  BROADCAST: 'broadcast'
} as const;

export type MessageType = typeof MessageType[keyof typeof MessageType];

// Define message status constants
export const MessageStatus = {
  UNREAD: 'unread',
  READ: 'read',
  ARCHIVED: 'archived'
} as const;

export type MessageStatus = typeof MessageStatus[keyof typeof MessageStatus];

// Messages table for the messaging system
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").references(() => users.id).notNull(),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  messageType: text("message_type").notNull().default(MessageType.DIRECT), // 'direct' or 'broadcast'
  deletedAt: timestamp("deleted_at"), // Soft delete for senders
  deletedBySender: boolean("deleted_by_sender").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  inReplyTo: integer("in_reply_to").references((): AnyPgColumn => messages.id), // For message threading
});

// Message recipients table to track message delivery and read status
export const messageRecipients = pgTable("message_recipients", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").references(() => messages.id, { onDelete: 'cascade' }).notNull(),
  recipientId: integer("recipient_id").references(() => users.id).notNull(),
  status: text("status").notNull().default(MessageStatus.UNREAD), // 'unread', 'read', 'archived'
  readAt: timestamp("read_at"),
  targetRole: text("target_role"), // Only used for broadcast messages, can be null for direct messages
  deletedAt: timestamp("deleted_at"), // Soft delete for recipients
  deletedByRecipient: boolean("deleted_by_recipient").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Analytics User Segments Table - stores user segment definitions for analytics filtering
export const analyticsUserSegments = pgTable("analytics_user_segments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  isActive: boolean("is_active").default(true),
  filters: jsonb("filters").notNull(), // JSON object with segment filter criteria
  userCount: integer("user_count"), // Cache of the number of users matching this segment
  lastCalculated: timestamp("last_calculated"), // When the user count was last calculated
});

// Analytics User Segment Filters Table - stores the actual filter rules for user segments
export const analyticsSegmentFilters = pgTable("analytics_segment_filters", {
  id: serial("id").primaryKey(),
  segmentId: integer("segment_id").references(() => analyticsUserSegments.id).notNull(),
  field: text("field").notNull(), // Field to filter on (device, browser, page_category, etc.)
  operator: text("operator").notNull(), // Operator (equals, contains, greaterThan, lessThan, etc.)
  value: text("value").notNull(), // Value to compare against
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Create base schemas for the messaging system
const baseMessageSchema = createInsertSchema(messages);
const baseMessageRecipientSchema = createInsertSchema(messageRecipients);

// Create base schemas for analytics segments
const baseAnalyticsUserSegmentSchema = createInsertSchema(analyticsUserSegments);
const baseAnalyticsSegmentFilterSchema = createInsertSchema(analyticsSegmentFilters);

// Export the schemas with additional validation
export const insertAnalyticsUserSegmentSchema = baseAnalyticsUserSegmentSchema
  .omit({ id: true, userCount: true, lastCalculated: true })
  .extend({
    filters: z.any().refine(val => {
      // Ensure filters is an array of valid filter objects
      return Array.isArray(val) && val.every(filter => 
        typeof filter === 'object' && 
        filter.field && 
        filter.operator && 
        filter.value !== undefined
      );
    }, {
      message: "Filters must be an array of objects with field, operator, and value properties",
    }),
  });

// Export the messaging schemas with validation
export const insertMessageSchema = baseMessageSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    subject: z.string().min(1, "Subject is required"),
    content: z.string().min(1, "Message content is required"),
    messageType: z.enum([MessageType.DIRECT, MessageType.BROADCAST]),
  });

export const insertMessageRecipientSchema = baseMessageRecipientSchema
  .omit({ id: true, createdAt: true, updatedAt: true, readAt: true })
  .extend({
    status: z.enum([MessageStatus.UNREAD, MessageStatus.READ, MessageStatus.ARCHIVED]).default(MessageStatus.UNREAD),
    targetRole: z.enum([
      UserRole.GUEST,
      UserRole.REGISTERED,
      UserRole.BADGE_HOLDER,
      UserRole.PAID,
      UserRole.MODERATOR,
      UserRole.ADMIN
    ]).optional(),
  });

export const insertAnalyticsSegmentFilterSchema = baseAnalyticsSegmentFilterSchema
  .omit({ id: true });

export type AnalyticsUserSegment = typeof analyticsUserSegments.$inferSelect;
export type InsertAnalyticsUserSegment = z.infer<typeof insertAnalyticsUserSegmentSchema>;

export type AnalyticsSegmentFilter = typeof analyticsSegmentFilters.$inferSelect;
export type InsertAnalyticsSegmentFilter = z.infer<typeof insertAnalyticsSegmentFilterSchema>;

// Store visits tracking table - tracks when users last visited the store page
export const storeVisits = pgTable("store_visits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  lastVisitAt: timestamp("last_visit_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Unique constraint to ensure one record per user
  userUniqueIdx: unique().on(table.userId),
  // Index for efficient lookups
  userIdIdx: index("store_visits_user_id_idx").on(table.userId),
}));

// Create base schema for store visits
const baseStoreVisitSchema = createInsertSchema(storeVisits);

// Export the schema with additional validation
export const insertStoreVisitSchema = baseStoreVisitSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    userId: z.number().min(1, "User ID is required"),
    lastVisitAt: z.date().default(() => new Date()),
  });

export type StoreVisit = typeof storeVisits.$inferSelect;
export type InsertStoreVisit = z.infer<typeof insertStoreVisitSchema>;

// For Sale page visits tracking table - tracks when users last visited the for-sale page
export const forSaleVisits = pgTable("for_sale_visits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  lastVisitAt: timestamp("last_visit_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Unique constraint to ensure one record per user
  userUniqueIdx: unique().on(table.userId),
  // Index for efficient lookups
  userIdIdx: index("for_sale_visits_user_id_idx").on(table.userId),
}));

// Create base schema for for sale visits
const baseForSaleVisitSchema = createInsertSchema(forSaleVisits);

// Export the schema with additional validation
export const insertForSaleVisitSchema = baseForSaleVisitSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    userId: z.number().min(1, "User ID is required"),
    lastVisitAt: z.date().default(() => new Date()),
  });

export type ForSaleVisit = typeof forSaleVisits.$inferSelect;
export type InsertForSaleVisit = z.infer<typeof insertForSaleVisitSchema>;

// Vendor page visits tracking table - tracks when users last visited the vendors page
export const vendorVisits = pgTable("vendor_visits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  lastVisitAt: timestamp("last_visit_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Unique constraint to ensure one record per user
  userUniqueIdx: unique().on(table.userId),
  // Index for efficient lookups
  userIdIdx: index("vendor_visits_user_id_idx").on(table.userId),
}));

// Create base schema for vendor visits
const baseVendorVisitSchema = createInsertSchema(vendorVisits);

// Export the schema with additional validation
export const insertVendorVisitSchema = baseVendorVisitSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    userId: z.number().min(1, "User ID is required"),
    lastVisitAt: z.date().default(() => new Date()),
  });

export type VendorVisit = typeof vendorVisits.$inferSelect;
export type InsertVendorVisit = z.infer<typeof insertVendorVisitSchema>;

// Individual vendor page visits tracking - tracks which specific vendor pages a user has visited
export const vendorPageVisits = pgTable("vendor_page_visits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  vendorSlug: text("vendor_slug").notNull(),
  visitedAt: timestamp("visited_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Unique constraint to ensure one record per user per vendor page
  userVendorUniqueIdx: unique().on(table.userId, table.vendorSlug),
  // Index for efficient lookups by user
  userIdIdx: index("vendor_page_visits_user_id_idx").on(table.userId),
  // Index for efficient lookups by vendor slug
  vendorSlugIdx: index("vendor_page_visits_vendor_slug_idx").on(table.vendorSlug),
}));

// Create base schema for vendor page visits
const baseVendorPageVisitSchema = createInsertSchema(vendorPageVisits);

// Export the schema with additional validation
export const insertVendorPageVisitSchema = baseVendorPageVisitSchema
  .omit({ id: true, createdAt: true })
  .extend({
    userId: z.number().min(1, "User ID is required"),
    vendorSlug: z.string().min(1, "Vendor slug is required"),
    visitedAt: z.date().default(() => new Date()),
  });

export type VendorPageVisit = typeof vendorPageVisits.$inferSelect;
export type InsertVendorPageVisit = z.infer<typeof insertVendorPageVisitSchema>;

// Calendar Email Schedule table — persists auto-send configuration
export const calendarEmailSchedule = pgTable("calendar_email_schedule", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  sendTime: text("send_time").notNull().default("08:00"), // HH:MM in 24hr, always in Florida ET
  notifyPreference: text("notify_preference").notNull().default("everyone"), // none|justme|admins|everyone
  adminUserId: integer("admin_user_id").references(() => users.id, { onDelete: "set null" }), // Admin who configured schedule; used for "justme" in scheduler
  customEventOrder: jsonb("custom_event_order"), // JSON array of event IDs — overrides default order for next send only
  attachImageEventIds: jsonb("attach_image_event_ids"), // JSON array of event IDs whose images to embed
  lastSentAt: timestamp("last_sent_at"), // When the scheduler last successfully sent
  // Run/outcome tracking for the automatic scheduler (so the admin page can show
  // what happened on the most recent due run, and so failed/missed runs escalate).
  lastRunAt: timestamp("last_run_at"), // When the scheduler last evaluated a due run (sent OR skipped)
  lastRunStatus: text("last_run_status"), // sent|partial_failure|failed|no_events|no_recipients|just_me_ineligible|missed_window|pref_none|waiting_no_events|waiting_no_recipients
  lastRunDetail: text("last_run_detail"), // Human-readable explanation of the last run outcome
  // Rolling log of recent finalized run outcomes (newest first, capped server-side).
  // Each entry is { status, detail, at } so the admin page can show a short history.
  recentRuns: jsonb("recent_runs"),
  lastEscalationAt: timestamp("last_escalation_at"), // When the last admin escalation email was sent (once-per-day dedup)
  // Watchdog dedup: when the external/catch-up watchdog last alerted admins that
  // an expected send day fully elapsed with NO recorded run (server was down
  // through the whole send+grace window). Keyed per-expected-day so each missed
  // day alerts at most once.
  lastWatchdogAt: timestamp("last_watchdog_at"),
  // Opt-in once-daily "all healthy" heartbeat: when enabled, a confirmation
  // email goes out after a successful send so admins can tell "no alert because
  // healthy" from "no alert because the alerting path is broken." Off by default.
  heartbeatEnabled: boolean("heartbeat_enabled").notNull().default(false),
  // Dedup for the heartbeat: when the last heartbeat confirmation was sent
  // (once per ET day, CAS-guarded like the escalation/watchdog claims).
  lastHeartbeatAt: timestamp("last_heartbeat_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

const baseCalendarEmailScheduleSchema = createInsertSchema(calendarEmailSchedule);

export const insertCalendarEmailScheduleSchema = baseCalendarEmailScheduleSchema
  .omit({ id: true, updatedAt: true })
  .extend({
    enabled: z.boolean().default(false),
    sendTime: z.string().regex(/^\d{2}:\d{2}$/, "Send time must be HH:MM format").default("08:00"),
    notifyPreference: z.enum(["none", "justme", "admins", "everyone"]).default("everyone"),
    adminUserId: z.number().nullable().optional(),
    customEventOrder: z.array(z.number()).nullable().optional(),
    attachImageEventIds: z.array(z.number()).nullable().optional(),
    recentRuns: z
      .array(z.object({ status: z.string(), detail: z.string(), at: z.string() }))
      .nullable()
      .optional(),
  });

export type CalendarEmailSchedule = typeof calendarEmailSchedule.$inferSelect;
export type InsertCalendarEmailSchedule = z.infer<typeof insertCalendarEmailScheduleSchema>;

// One finalized run outcome in the rolling history stored on `recentRuns`.
export type CalendarEmailRunHistoryEntry = { status: string; detail: string; at: string };

// Migration Records Table is defined above around line 389