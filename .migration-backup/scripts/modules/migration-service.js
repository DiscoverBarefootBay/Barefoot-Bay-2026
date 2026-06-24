"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server/migration-service.ts
var migration_service_exports = {};
__export(migration_service_exports, {
  MIGRATION_STATUS: () => MIGRATION_STATUS,
  SOURCE_TYPE: () => SOURCE_TYPE,
  migrationService: () => migrationService
});
module.exports = __toCommonJS(migration_service_exports);

// server/db.ts
var import_pg = __toESM(require("pg"), 1);
var import_node_postgres = require("drizzle-orm/node-postgres");

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  FeatureFlagName: () => FeatureFlagName,
  FormFieldType: () => FormFieldType,
  ListingDurationType: () => ListingDurationType,
  ListingPrices: () => ListingPrices,
  ListingType: () => ListingType,
  OrderStatus: () => OrderStatus,
  PrintProvider: () => PrintProvider,
  ProductCategory: () => ProductCategory,
  ProductStatus: () => ProductStatus,
  RecurrenceFrequency: () => RecurrenceFrequency,
  ReturnReason: () => ReturnReason,
  ReturnStatus: () => ReturnStatus,
  UserRole: () => UserRole,
  communityCategories: () => communityCategories,
  contentVersions: () => contentVersions,
  customForms: () => customForms,
  eventComments: () => eventComments,
  eventInteractions: () => eventInteractions,
  events: () => events,
  featureFlags: () => featureFlags,
  formSubmissions: () => formSubmissions,
  forumCategories: () => forumCategories,
  forumComments: () => forumComments,
  forumDescription: () => forumDescription,
  forumPosts: () => forumPosts,
  forumReactions: () => forumReactions,
  insertCommunityCategorySchema: () => insertCommunityCategorySchema,
  insertContentVersionSchema: () => insertContentVersionSchema,
  insertCustomFormSchema: () => insertCustomFormSchema,
  insertEventCommentSchema: () => insertEventCommentSchema,
  insertEventInteractionSchema: () => insertEventInteractionSchema,
  insertEventSchema: () => insertEventSchema,
  insertFeatureFlagSchema: () => insertFeatureFlagSchema,
  insertFormSubmissionSchema: () => insertFormSubmissionSchema,
  insertForumCategorySchema: () => insertForumCategorySchema,
  insertForumCommentSchema: () => insertForumCommentSchema,
  insertForumDescriptionSchema: () => insertForumDescriptionSchema,
  insertForumPostSchema: () => insertForumPostSchema,
  insertForumReactionSchema: () => insertForumReactionSchema,
  insertListingPaymentSchema: () => insertListingPaymentSchema,
  insertListingSchema: () => insertListingSchema,
  insertOrderItemSchema: () => insertOrderItemSchema,
  insertOrderReturnSchema: () => insertOrderReturnSchema,
  insertOrderSchema: () => insertOrderSchema,
  insertPageContentSchema: () => insertPageContentSchema,
  insertProductSchema: () => insertProductSchema,
  insertReturnItemSchema: () => insertReturnItemSchema,
  insertSiteSettingSchema: () => insertSiteSettingSchema,
  insertUserSchema: () => insertUserSchema,
  insertVendorCategorySchema: () => insertVendorCategorySchema,
  insertVendorCommentSchema: () => insertVendorCommentSchema,
  insertVendorInteractionSchema: () => insertVendorInteractionSchema,
  listingPayments: () => listingPayments,
  migrationRecords: () => migrationRecords,
  orderItems: () => orderItems,
  orderReturns: () => orderReturns,
  orders: () => orders,
  pageContents: () => pageContents,
  products: () => products,
  realEstateListings: () => realEstateListings,
  returnItems: () => returnItems,
  siteSettings: () => siteSettings,
  users: () => users,
  vendorCategories: () => vendorCategories,
  vendorComments: () => vendorComments,
  vendorInteractions: () => vendorInteractions
});
var import_pg_core = require("drizzle-orm/pg-core");
var import_drizzle_zod = require("drizzle-zod");
var import_zod = require("zod");
var UserRole = {
  GUEST: "guest",
  REGISTERED: "registered",
  BADGE_HOLDER: "badge_holder",
  PAID: "paid",
  MODERATOR: "moderator",
  ADMIN: "admin"
};
var ListingType = {
  FSBO: "FSBO",
  AGENT: "Agent",
  RENT: "Rent",
  OPEN_HOUSE: "OpenHouse",
  WANTED: "Wanted",
  CLASSIFIED: "Classified",
  GARAGE_SALE: "GarageSale"
};
var ListingDurationType = {
  THREE_DAY: "3_day",
  SEVEN_DAY: "7_day",
  THIRTY_DAY: "30_day"
};
var ListingPrices = {
  // Real Property (FSBO, FSBA, FOR RENT, WANTED)
  REAL_PROPERTY: {
    [ListingDurationType.THREE_DAY]: null,
    // Not available
    [ListingDurationType.SEVEN_DAY]: null,
    // Not available
    [ListingDurationType.THIRTY_DAY]: 5e3
    // $50.00 (stored in cents)
  },
  // Open houses/Garage sales
  OPEN_HOUSE: {
    [ListingDurationType.THREE_DAY]: 1e3,
    // $10.00
    [ListingDurationType.SEVEN_DAY]: 2500,
    // $25.00
    [ListingDurationType.THIRTY_DAY]: 5e3
    // $50.00
  },
  // Classified ads
  CLASSIFIED: {
    [ListingDurationType.THREE_DAY]: 1e3,
    // $10.00
    [ListingDurationType.SEVEN_DAY]: 2500,
    // $25.00
    [ListingDurationType.THIRTY_DAY]: 5e3
    // $50.00
  },
  // Default pricing fallback
  DEFAULT: {
    [ListingDurationType.THREE_DAY]: 1e3,
    // $10.00
    [ListingDurationType.SEVEN_DAY]: 2500,
    // $25.00
    [ListingDurationType.THIRTY_DAY]: 5e3
    // $50.00
  }
};
var users = (0, import_pg_core.pgTable)("users", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  username: (0, import_pg_core.text)("username").notNull().unique(),
  password: (0, import_pg_core.text)("password").notNull(),
  isResident: (0, import_pg_core.boolean)("is_resident").notNull().default(false),
  email: (0, import_pg_core.text)("email").notNull(),
  fullName: (0, import_pg_core.text)("full_name").notNull(),
  avatarUrl: (0, import_pg_core.text)("avatar_url"),
  residentTags: (0, import_pg_core.text)("resident_tags").array(),
  role: (0, import_pg_core.text)("role").notNull().default(UserRole.REGISTERED),
  isApproved: (0, import_pg_core.boolean)("is_approved").notNull().default(false),
  isBlocked: (0, import_pg_core.boolean)("is_blocked").notNull().default(false),
  // Added to track blocked users separately
  blockReason: (0, import_pg_core.text)("block_reason"),
  // Optional reason for blocking
  // Password reset fields
  resetToken: (0, import_pg_core.text)("reset_token"),
  resetTokenExpires: (0, import_pg_core.timestamp)("reset_token_expires"),
  // Barefoot Bay survey questions
  // Resident section
  isLocalResident: (0, import_pg_core.boolean)("is_local_resident").default(false),
  ownsHomeInBB: (0, import_pg_core.boolean)("owns_home_in_bb").default(false),
  rentsHomeInBB: (0, import_pg_core.boolean)("rents_home_in_bb").default(false),
  isFullTimeResident: (0, import_pg_core.boolean)("is_full_time_resident").default(false),
  isSnowbird: (0, import_pg_core.boolean)("is_snowbird").default(false),
  hasMembershipBadge: (0, import_pg_core.boolean)("has_membership_badge").default(false),
  membershipBadgeNumber: (0, import_pg_core.text)("membership_badge_number"),
  buysDayPasses: (0, import_pg_core.boolean)("buys_day_passes").default(false),
  // Non-resident section
  hasLivedInBB: (0, import_pg_core.boolean)("has_lived_in_bb").default(false),
  hasVisitedBB: (0, import_pg_core.boolean)("has_visited_bb").default(false),
  neverVisitedBB: (0, import_pg_core.boolean)("never_visited_bb").default(false),
  hasFriendsInBB: (0, import_pg_core.boolean)("has_friends_in_bb").default(false),
  consideringMovingToBB: (0, import_pg_core.boolean)("considering_moving_to_bb").default(false),
  wantToDiscoverBB: (0, import_pg_core.boolean)("want_to_discover_bb").default(false),
  neverHeardOfBB: (0, import_pg_core.boolean)("never_heard_of_bb").default(false),
  // Square integration fields
  squareCustomerId: (0, import_pg_core.text)("square_customer_id"),
  // Square customer profile ID
  // Subscription information
  subscriptionId: (0, import_pg_core.text)("subscription_id"),
  // Square subscription ID
  subscriptionType: (0, import_pg_core.text)("subscription_type"),
  // 'monthly' or 'annual'
  subscriptionStatus: (0, import_pg_core.text)("subscription_status"),
  // 'active', 'cancelled', 'past_due'
  subscriptionStartDate: (0, import_pg_core.timestamp)("subscription_start_date"),
  subscriptionEndDate: (0, import_pg_core.timestamp)("subscription_end_date"),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var realEstateListings = (0, import_pg_core.pgTable)("real_estate_listings", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  listingType: (0, import_pg_core.text)("listing_type").notNull(),
  // 'FSBO', 'Agent', 'Rent', 'OpenHouse', 'Wanted', 'Classified'
  category: (0, import_pg_core.text)("category"),
  // For classifieds: 'Garage Sale', 'Furniture', etc.
  title: (0, import_pg_core.text)("title").notNull(),
  price: (0, import_pg_core.integer)("price"),
  address: (0, import_pg_core.text)("address"),
  bedrooms: (0, import_pg_core.integer)("bedrooms"),
  bathrooms: (0, import_pg_core.integer)("bathrooms"),
  squareFeet: (0, import_pg_core.integer)("square_feet"),
  yearBuilt: (0, import_pg_core.integer)("year_built"),
  description: (0, import_pg_core.text)("description"),
  photos: (0, import_pg_core.text)("photos").array(),
  cashOnly: (0, import_pg_core.boolean)("cash_only").default(false),
  openHouseDate: (0, import_pg_core.timestamp)("open_house_date"),
  openHouseStartTime: (0, import_pg_core.text)("open_house_start_time"),
  openHouseEndTime: (0, import_pg_core.text)("open_house_end_time"),
  contactInfo: (0, import_pg_core.jsonb)("contact_info").notNull(),
  isApproved: (0, import_pg_core.boolean)("is_approved").default(false),
  // Fields for subscription and expiration
  expirationDate: (0, import_pg_core.timestamp)("expiration_date"),
  listingDuration: (0, import_pg_core.text)("listing_duration"),
  // '3_day', '7_day', '30_day'
  isSubscription: (0, import_pg_core.boolean)("is_subscription").default(false),
  subscriptionId: (0, import_pg_core.text)("subscription_id"),
  // Square subscription ID
  createdBy: (0, import_pg_core.integer)("created_by").references(() => users.id),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var RecurrenceFrequency = {
  DAILY: "daily",
  WEEKLY: "weekly",
  BIWEEKLY: "biweekly",
  MONTHLY: "monthly",
  YEARLY: "yearly"
};
var events = (0, import_pg_core.pgTable)("events", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  title: (0, import_pg_core.text)("title").notNull(),
  description: (0, import_pg_core.text)("description"),
  startDate: (0, import_pg_core.timestamp)("start_date").notNull(),
  endDate: (0, import_pg_core.timestamp)("end_date").notNull(),
  location: (0, import_pg_core.text)("location"),
  mapLink: (0, import_pg_core.text)("map_link"),
  hoursOfOperation: (0, import_pg_core.jsonb)("hours_of_operation"),
  // JSONB type for hours of operation
  category: (0, import_pg_core.text)("category").notNull(),
  contactInfo: (0, import_pg_core.jsonb)("contact_info"),
  mediaUrls: (0, import_pg_core.text)("media_urls").array(),
  // Badge requirement field
  badgeRequired: (0, import_pg_core.boolean)("badge_required").default(false),
  // Whether a membership badge is required
  // Recurring event fields
  isRecurring: (0, import_pg_core.boolean)("is_recurring").default(false),
  recurrenceFrequency: (0, import_pg_core.text)("recurrence_frequency"),
  // daily, weekly, biweekly, monthly, yearly
  recurrenceEndDate: (0, import_pg_core.timestamp)("recurrence_end_date"),
  // When the recurring event series ends
  parentEventId: (0, import_pg_core.integer)("parent_event_id").references(() => events.id),
  // For child events in a recurring series
  createdBy: (0, import_pg_core.integer)("created_by").references(() => users.id),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var eventInteractions = (0, import_pg_core.pgTable)("event_interactions", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  eventId: (0, import_pg_core.integer)("event_id").references(() => events.id).notNull(),
  userId: (0, import_pg_core.integer)("user_id").references(() => users.id).notNull(),
  interactionType: (0, import_pg_core.text)("interaction_type").notNull(),
  // 'like', 'going', 'interested'
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
});
var eventComments = (0, import_pg_core.pgTable)("event_comments", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  eventId: (0, import_pg_core.integer)("event_id").references(() => events.id).notNull(),
  userId: (0, import_pg_core.integer)("user_id").references(() => users.id).notNull(),
  content: (0, import_pg_core.text)("content").notNull(),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var pageContents = (0, import_pg_core.pgTable)("page_contents", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  slug: (0, import_pg_core.text)("slug").notNull(),
  // e.g. "amenities#golf"
  title: (0, import_pg_core.text)("title").notNull(),
  content: (0, import_pg_core.text)("content").notNull(),
  mediaUrls: (0, import_pg_core.text)("media_urls").array(),
  isHidden: (0, import_pg_core.boolean)("is_hidden").notNull().default(false),
  // To hide pages like vendor pages
  order: (0, import_pg_core.integer)("order").default(0),
  // Added for controlling display order
  updatedBy: (0, import_pg_core.integer)("updated_by").references(() => users.id),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var contentVersions = (0, import_pg_core.pgTable)("content_versions", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  contentId: (0, import_pg_core.integer)("content_id").notNull().references(() => pageContents.id, { onDelete: "cascade" }),
  slug: (0, import_pg_core.text)("slug").notNull(),
  title: (0, import_pg_core.text)("title").notNull(),
  content: (0, import_pg_core.text)("content").notNull(),
  mediaUrls: (0, import_pg_core.text)("media_urls").array(),
  createdBy: (0, import_pg_core.integer)("created_by").references(() => users.id),
  versionNumber: (0, import_pg_core.integer)("version_number").notNull(),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  notes: (0, import_pg_core.text)("notes").default("")
});
var baseUserSchema = (0, import_drizzle_zod.createInsertSchema)(users);
var baseEventSchema = (0, import_drizzle_zod.createInsertSchema)(events);
var baseListingSchema = (0, import_drizzle_zod.createInsertSchema)(realEstateListings);
var baseEventInteractionSchema = (0, import_drizzle_zod.createInsertSchema)(eventInteractions);
var baseEventCommentSchema = (0, import_drizzle_zod.createInsertSchema)(eventComments);
var basePageContentSchema = (0, import_drizzle_zod.createInsertSchema)(pageContents);
var baseContentVersionSchema = (0, import_drizzle_zod.createInsertSchema)(contentVersions);
var insertUserSchema = baseUserSchema.omit({ id: true }).extend({
  // Square integration fields
  squareCustomerId: import_zod.z.string().optional(),
  // Add subscription field validations
  subscriptionId: import_zod.z.string().optional(),
  subscriptionType: import_zod.z.enum(["monthly", "annual"]).optional(),
  subscriptionStatus: import_zod.z.enum(["active", "cancelled", "past_due"]).optional(),
  subscriptionStartDate: import_zod.z.coerce.date().optional(),
  subscriptionEndDate: import_zod.z.coerce.date().optional(),
  // Additional survey fields
  rentsHomeInBB: import_zod.z.boolean().optional().default(false),
  buysDayPasses: import_zod.z.boolean().optional().default(false),
  hasVisitedBB: import_zod.z.boolean().optional().default(false),
  neverVisitedBB: import_zod.z.boolean().optional().default(false),
  hasFriendsInBB: import_zod.z.boolean().optional().default(false),
  wantToDiscoverBB: import_zod.z.boolean().optional().default(false),
  neverHeardOfBB: import_zod.z.boolean().optional().default(false)
});
var phoneRegex = /^\(\d{3}\) \d{3}-\d{4}$/;
var insertEventSchema = baseEventSchema.omit({ id: true, createdAt: true, updatedAt: true }).extend({
  // Required fields
  title: import_zod.z.string().min(1, "Event title is required"),
  startDate: import_zod.z.coerce.date(),
  endDate: import_zod.z.coerce.date(),
  location: import_zod.z.string().min(1, "Location is required"),
  category: import_zod.z.enum(["entertainment", "government", "social"]),
  // Optional fields
  description: import_zod.z.string().optional().nullable(),
  businessName: import_zod.z.string().optional().nullable(),
  badgeRequired: import_zod.z.boolean().optional().default(false),
  // Whether a membership badge is required
  contactInfo: import_zod.z.object({
    name: import_zod.z.string().optional().nullable(),
    phone: import_zod.z.string().optional().nullable(),
    email: import_zod.z.string().optional().nullable(),
    website: import_zod.z.string().optional().nullable()
  }).optional().default({}),
  hoursOfOperation: import_zod.z.record(import_zod.z.object({
    isOpen: import_zod.z.boolean(),
    openTime: import_zod.z.string(),
    closeTime: import_zod.z.string()
  })).nullable().optional(),
  mediaUrls: import_zod.z.array(import_zod.z.string()).optional(),
  // Recurring event fields
  isRecurring: import_zod.z.boolean().optional().default(false),
  recurrenceFrequency: import_zod.z.enum([
    RecurrenceFrequency.DAILY,
    RecurrenceFrequency.WEEKLY,
    RecurrenceFrequency.BIWEEKLY,
    RecurrenceFrequency.MONTHLY,
    RecurrenceFrequency.YEARLY
  ]).nullable().optional(),
  recurrenceEndDate: import_zod.z.coerce.date().nullable().optional(),
  parentEventId: import_zod.z.number().optional()
}).refine((data) => {
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  return endDate > startDate;
}, {
  message: "End date must be after start date",
  path: ["endDate"]
}).refine((data) => {
  if (data.isRecurring) {
    return !!data.recurrenceFrequency && !!data.recurrenceEndDate;
  }
  return true;
}, {
  message: "Recurring events must have a frequency and end date",
  path: ["recurrenceEndDate"]
});
var insertEventInteractionSchema = baseEventInteractionSchema.omit({ id: true, createdAt: true });
var insertEventCommentSchema = baseEventCommentSchema.omit({ id: true, createdAt: true, updatedAt: true });
var insertListingSchema = baseListingSchema.omit({ id: true, createdAt: true, updatedAt: true, isApproved: true }).extend({
  listingType: import_zod.z.enum(["FSBO", "Agent", "Rent", "OpenHouse", "Wanted", "Classified", "GarageSale"]),
  category: import_zod.z.string().optional(),
  price: import_zod.z.number().min(0).optional(),
  address: import_zod.z.string().optional(),
  bedrooms: import_zod.z.number().min(0).optional(),
  bathrooms: import_zod.z.number().min(0).optional(),
  squareFeet: import_zod.z.number().min(0).optional(),
  yearBuilt: import_zod.z.number().optional(),
  photos: import_zod.z.array(import_zod.z.string()).optional(),
  contactInfo: import_zod.z.object({
    name: import_zod.z.string().min(1, "Name is required"),
    phone: import_zod.z.string().regex(phoneRegex, "Phone number must be in format (555) 555-5555"),
    email: import_zod.z.string().email("Invalid email address")
  }),
  // Subscription and expiration fields
  expirationDate: import_zod.z.date().optional(),
  // More flexible listingDuration field that accepts multiple formats and normalizes them
  listingDuration: import_zod.z.union([
    import_zod.z.enum([
      ListingDurationType.THREE_DAY,
      ListingDurationType.SEVEN_DAY,
      ListingDurationType.THIRTY_DAY
    ]),
    // Also allow just the number part
    import_zod.z.enum(["3", "7", "30"]),
    // Also allow format without underscore
    import_zod.z.enum(["3day", "7day", "30day"])
  ]).transform((val) => {
    if (val === "3" || val === "3day") return ListingDurationType.THREE_DAY;
    if (val === "7" || val === "7day") return ListingDurationType.SEVEN_DAY;
    if (val === "30" || val === "30day") return ListingDurationType.THIRTY_DAY;
    return val;
  }).optional(),
  isSubscription: import_zod.z.boolean().optional().default(false),
  subscriptionId: import_zod.z.string().optional()
}).refine((data) => {
  if (["FSBO", "Agent", "Rent", "OpenHouse"].includes(data.listingType)) {
    return data.address && data.price && data.bedrooms && data.bathrooms && data.squareFeet && data.yearBuilt;
  }
  return true;
}, {
  message: "Property listings require complete property details"
});
var migrationRecords = (0, import_pg_core.pgTable)("migration_records", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  sourceType: (0, import_pg_core.text)("source_type").notNull(),
  // 'filesystem' or 'postgresql'
  sourceLocation: (0, import_pg_core.text)("source_location").notNull(),
  // Original file path or database reference
  mediaBucket: (0, import_pg_core.text)("media_bucket").notNull(),
  // Target bucket in object storage
  mediaType: (0, import_pg_core.text)("media_type").notNull(),
  // Media type (calendar, forum, etc.)
  storageKey: (0, import_pg_core.text)("storage_key").notNull(),
  // Object storage key
  migrationStatus: (0, import_pg_core.text)("migration_status").notNull(),
  // 'pending', 'migrated', 'failed'
  errorMessage: (0, import_pg_core.text)("error_message"),
  // Error message if failed
  migratedAt: (0, import_pg_core.timestamp)("migrated_at"),
  // When the file was migrated
  verificationStatus: (0, import_pg_core.boolean)("verification_status").default(false),
  // Whether file was verified in object storage
  verifiedAt: (0, import_pg_core.timestamp)("verified_at"),
  // When the file was verified
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow().notNull(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow().notNull()
});
var insertPageContentSchema = basePageContentSchema.omit({ id: true, createdAt: true, updatedAt: true }).extend({
  title: import_zod.z.string().min(1, "Title is required"),
  content: import_zod.z.string().min(1, "Content is required"),
  mediaUrls: import_zod.z.array(import_zod.z.string()).optional().default([]),
  isHidden: import_zod.z.boolean().optional().default(false),
  order: import_zod.z.number().optional().default(0)
});
var insertContentVersionSchema = baseContentVersionSchema.omit({ id: true, createdAt: true }).extend({
  contentId: import_zod.z.number(),
  slug: import_zod.z.string(),
  title: import_zod.z.string().min(1, "Title is required"),
  content: import_zod.z.string().min(1, "Content is required"),
  mediaUrls: import_zod.z.array(import_zod.z.string()).optional().default([]),
  versionNumber: import_zod.z.number(),
  notes: import_zod.z.string().optional()
});
var listingPayments = (0, import_pg_core.pgTable)("listing_payments", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  userId: (0, import_pg_core.integer)("userid").references(() => users.id).notNull(),
  // Match the actual database column name
  listingId: (0, import_pg_core.integer)("listingid").references(() => realEstateListings.id),
  amount: (0, import_pg_core.integer)("amount").notNull(),
  // Amount in cents
  currency: (0, import_pg_core.text)("currency").notNull().default("usd"),
  status: (0, import_pg_core.text)("status").notNull(),
  // 'pending', 'completed', 'failed'
  paymentIntentId: (0, import_pg_core.text)("paymentintentid"),
  // Stripe/Square payment intent ID
  discountCode: (0, import_pg_core.text)("discountcode"),
  listingType: (0, import_pg_core.text)("listing_type"),
  // Type of listing (FSBO, CLASSIFIED, etc.)
  listingDuration: (0, import_pg_core.text)("listing_duration"),
  // Duration of listing (3_day, 7_day, 30_day)
  isSubscription: (0, import_pg_core.boolean)("is_subscription").default(false),
  // Whether this payment is for a subscription
  subscriptionId: (0, import_pg_core.text)("subscription_id"),
  // Square subscription ID
  subscriptionPlan: (0, import_pg_core.text)("subscription_plan"),
  // MONTHLY, QUARTERLY, etc.
  createdAt: (0, import_pg_core.timestamp)("createdat").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updatedat").defaultNow()
});
var baseListingPaymentSchema = (0, import_drizzle_zod.createInsertSchema)(listingPayments);
var insertListingPaymentSchema = baseListingPaymentSchema.omit({ id: true, createdAt: true, updatedAt: true }).extend({
  amount: import_zod.z.number().min(0),
  currency: import_zod.z.string().default("usd"),
  status: import_zod.z.enum(["pending", "completed", "failed"]),
  paymentIntentId: import_zod.z.string().optional(),
  discountCode: import_zod.z.string().optional(),
  listingType: import_zod.z.enum([
    ListingType.FSBO,
    ListingType.AGENT,
    ListingType.RENT,
    ListingType.OPEN_HOUSE,
    ListingType.WANTED,
    ListingType.CLASSIFIED,
    ListingType.GARAGE_SALE
  ]).optional(),
  listingDuration: import_zod.z.enum([
    ListingDurationType.THREE_DAY,
    ListingDurationType.SEVEN_DAY,
    ListingDurationType.THIRTY_DAY
  ]).optional(),
  isSubscription: import_zod.z.boolean().default(false),
  subscriptionId: import_zod.z.string().optional(),
  subscriptionPlan: import_zod.z.string().optional()
});
var ProductCategory = {
  APPAREL: "apparel",
  HOME: "home",
  ACCESSORIES: "accessories",
  SPONSORSHIP: "sponsorship",
  MEMBERSHIPS: "memberships",
  ALL: "all"
};
var ProductStatus = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  DRAFT: "draft"
};
var PrintProvider = {
  PRINTFUL: "printful",
  PRINTIFY: "printify",
  GOOTEN: "gooten"
};
var products = (0, import_pg_core.pgTable)("products", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  name: (0, import_pg_core.text)("name").notNull(),
  description: (0, import_pg_core.text)("description"),
  price: (0, import_pg_core.decimal)("price", { precision: 10, scale: 2 }).notNull(),
  category: (0, import_pg_core.text)("category").notNull(),
  imageUrls: (0, import_pg_core.text)("image_urls").array(),
  status: (0, import_pg_core.text)("status").notNull().default(ProductStatus.DRAFT),
  featured: (0, import_pg_core.boolean)("featured").default(false),
  // Flag for featured products
  // Print-on-demand specific fields
  printProviderId: (0, import_pg_core.text)("print_provider_id"),
  // External ID from the print provider
  printProvider: (0, import_pg_core.text)("print_provider"),
  // 'printful', 'printify', etc.
  variantData: (0, import_pg_core.jsonb)("variant_data"),
  // Store color, size, and other variant info
  designUrls: (0, import_pg_core.text)("design_urls").array(),
  // URLs to design files
  mockupUrls: (0, import_pg_core.text)("mockup_urls").array(),
  // URLs to mockup images
  createdBy: (0, import_pg_core.integer)("created_by").references(() => users.id),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var baseProductSchema = (0, import_drizzle_zod.createInsertSchema)(products);
var insertProductSchema = baseProductSchema.omit({ id: true, createdAt: true, updatedAt: true }).extend({
  name: import_zod.z.string().min(1, "Product name is required"),
  description: import_zod.z.string().optional(),
  price: import_zod.z.number().min(0, "Price cannot be negative"),
  category: import_zod.z.enum([ProductCategory.APPAREL, ProductCategory.HOME, ProductCategory.ACCESSORIES, ProductCategory.SPONSORSHIP, ProductCategory.MEMBERSHIPS, ProductCategory.ALL]),
  imageUrls: import_zod.z.array(import_zod.z.string()).default([]),
  status: import_zod.z.enum([ProductStatus.ACTIVE, ProductStatus.INACTIVE, ProductStatus.DRAFT]).default(ProductStatus.DRAFT),
  featured: import_zod.z.boolean().default(false),
  // Flag for featured products
  // Print-on-demand fields
  printProviderId: import_zod.z.string().optional(),
  printProvider: import_zod.z.enum([PrintProvider.PRINTFUL, PrintProvider.PRINTIFY, PrintProvider.GOOTEN]).optional(),
  variantData: import_zod.z.record(import_zod.z.any()).optional(),
  designUrls: import_zod.z.array(import_zod.z.string()).default([]),
  mockupUrls: import_zod.z.array(import_zod.z.string()).default([])
});
var OrderStatus = {
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
  REFUNDED: "refunded"
};
var orders = (0, import_pg_core.pgTable)("orders", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  userId: (0, import_pg_core.integer)("user_id").references(() => users.id),
  status: (0, import_pg_core.text)("status").notNull(),
  // 'pending', 'processing', 'shipped', 'delivered', 'cancelled'
  total: (0, import_pg_core.decimal)("total", { precision: 10, scale: 2 }).notNull(),
  shippingAddress: (0, import_pg_core.jsonb)("shipping_address").notNull(),
  paymentIntentId: (0, import_pg_core.text)("payment_intent_id"),
  // For external payment service reference
  discountCode: (0, import_pg_core.text)("discount_code"),
  // Store the applied discount code
  squareOrderId: (0, import_pg_core.text)("square_order_id"),
  // Square order ID for tracking
  printProviderOrderId: (0, import_pg_core.text)("print_provider_order_id"),
  // External order ID from print provider
  trackingNumber: (0, import_pg_core.text)("tracking_number"),
  trackingUrl: (0, import_pg_core.text)("tracking_url"),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var orderItems = (0, import_pg_core.pgTable)("order_items", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  orderId: (0, import_pg_core.integer)("order_id").references(() => orders.id).notNull(),
  productId: (0, import_pg_core.integer)("product_id").references(() => products.id).notNull(),
  quantity: (0, import_pg_core.integer)("quantity").notNull(),
  price: (0, import_pg_core.decimal)("price", { precision: 10, scale: 2 }).notNull(),
  variantInfo: (0, import_pg_core.jsonb)("variant_info"),
  // Store selected size, color, etc.
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
});
var baseOrderSchema = (0, import_drizzle_zod.createInsertSchema)(orders);
var baseOrderItemSchema = (0, import_drizzle_zod.createInsertSchema)(orderItems);
var ReturnReason = {
  WRONG_SIZE: "wrong_size",
  WRONG_ITEM: "wrong_item",
  DEFECTIVE: "defective",
  NOT_AS_DESCRIBED: "not_as_described",
  CHANGED_MIND: "changed_mind",
  OTHER: "other"
};
var ReturnStatus = {
  REQUESTED: "requested",
  APPROVED: "approved",
  DENIED: "denied",
  LABEL_CREATED: "label_created",
  SHIPPED: "shipped",
  RECEIVED: "received",
  REFUNDED: "refunded",
  COMPLETED: "completed",
  CANCELLED: "cancelled"
};
var orderReturns = (0, import_pg_core.pgTable)("order_returns", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  orderId: (0, import_pg_core.integer)("order_id").references(() => orders.id).notNull(),
  userId: (0, import_pg_core.integer)("user_id").references(() => users.id),
  status: (0, import_pg_core.text)("status").notNull().default(ReturnStatus.REQUESTED),
  reason: (0, import_pg_core.text)("reason").notNull(),
  notes: (0, import_pg_core.text)("notes"),
  reasonDetails: (0, import_pg_core.text)("reason_details"),
  imageUrls: (0, import_pg_core.text)("image_urls").array(),
  // Photos of the issue if applicable
  returnLabelUrl: (0, import_pg_core.text)("return_label_url"),
  trackingNumber: (0, import_pg_core.text)("tracking_number"),
  refundAmount: (0, import_pg_core.decimal)("refund_amount", { precision: 10, scale: 2 }),
  refundId: (0, import_pg_core.text)("refund_id"),
  // Reference to Square refund ID
  printfulReturnId: (0, import_pg_core.text)("printful_return_id"),
  // Printful return reference
  adminNotes: (0, import_pg_core.text)("admin_notes"),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var returnItems = (0, import_pg_core.pgTable)("return_items", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  returnId: (0, import_pg_core.integer)("return_id").references(() => orderReturns.id).notNull(),
  orderItemId: (0, import_pg_core.integer)("order_item_id").references(() => orderItems.id).notNull(),
  quantity: (0, import_pg_core.integer)("quantity").notNull(),
  reason: (0, import_pg_core.text)("reason").notNull(),
  reasonDetails: (0, import_pg_core.text)("reason_details"),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
});
var baseOrderReturnSchema = (0, import_drizzle_zod.createInsertSchema)(orderReturns);
var baseReturnItemSchema = (0, import_drizzle_zod.createInsertSchema)(returnItems);
var insertOrderSchema = baseOrderSchema.omit({ id: true, createdAt: true, updatedAt: true }).extend({
  status: import_zod.z.enum([
    "pending",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
    "return_requested",
    "return_approved",
    "return_shipped",
    "return_received",
    "refunded",
    "returned"
  ]).default("pending"),
  total: import_zod.z.number().min(0),
  shippingAddress: import_zod.z.object({
    fullName: import_zod.z.string().min(1, "Full name is required"),
    streetAddress: import_zod.z.string().min(1, "Street address is required"),
    city: import_zod.z.string().min(1, "City is required"),
    state: import_zod.z.string().min(1, "State is required"),
    zipCode: import_zod.z.string().min(5, "Zip code is required"),
    country: import_zod.z.string().min(1, "Country is required"),
    phone: import_zod.z.string().optional()
  }),
  paymentIntentId: import_zod.z.string().optional(),
  discountCode: import_zod.z.string().optional(),
  squareOrderId: import_zod.z.string().optional(),
  printProviderOrderId: import_zod.z.string().optional(),
  trackingNumber: import_zod.z.string().optional(),
  trackingUrl: import_zod.z.string().optional()
});
var insertOrderItemSchema = baseOrderItemSchema.omit({ id: true, createdAt: true }).extend({
  quantity: import_zod.z.number().min(1, "Quantity must be at least 1"),
  price: import_zod.z.number().min(0, "Price cannot be negative"),
  variantInfo: import_zod.z.record(import_zod.z.any()).optional()
});
var FormFieldType = {
  TEXT: "text",
  EMAIL: "email",
  PHONE: "phone",
  TEXTAREA: "textarea",
  CHECKBOX: "checkbox",
  SELECT: "select",
  RADIO: "radio",
  FILE: "file"
};
var customForms = (0, import_pg_core.pgTable)("custom_forms", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  title: (0, import_pg_core.text)("title").notNull(),
  description: (0, import_pg_core.text)("description"),
  formFields: (0, import_pg_core.jsonb)("form_fields").notNull(),
  // Array of field definitions
  termsAndConditions: (0, import_pg_core.text)("terms_and_conditions"),
  // Optional T&C text
  requiresTermsAcceptance: (0, import_pg_core.boolean)("requires_terms_acceptance").default(false),
  slug: (0, import_pg_core.text)("slug").notNull().unique(),
  // Unique identifier for the form
  pageContentId: (0, import_pg_core.integer)("page_content_id").references(() => pageContents.id),
  createdBy: (0, import_pg_core.integer)("created_by").references(() => users.id),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var formSubmissions = (0, import_pg_core.pgTable)("form_submissions", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  formId: (0, import_pg_core.integer)("form_id").references(() => customForms.id).notNull(),
  userId: (0, import_pg_core.integer)("user_id").references(() => users.id),
  // Optional, for authenticated users
  submitterEmail: (0, import_pg_core.text)("submitter_email"),
  // For collecting email from non-authenticated users
  formData: (0, import_pg_core.jsonb)("form_data").notNull(),
  // JSON object with the form responses
  fileUploads: (0, import_pg_core.text)("file_uploads").array(),
  // Array of file upload paths
  termsAccepted: (0, import_pg_core.boolean)("terms_accepted").default(false),
  ipAddress: (0, import_pg_core.text)("ip_address"),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
});
var baseCustomFormSchema = (0, import_drizzle_zod.createInsertSchema)(customForms);
var baseFormSubmissionSchema = (0, import_drizzle_zod.createInsertSchema)(formSubmissions);
var insertCustomFormSchema = baseCustomFormSchema.omit({ id: true, createdAt: true, updatedAt: true }).extend({
  title: import_zod.z.string().min(1, "Form title is required"),
  description: import_zod.z.string().optional(),
  formFields: import_zod.z.array(import_zod.z.object({
    id: import_zod.z.string(),
    // Unique ID for the field
    type: import_zod.z.enum([
      FormFieldType.TEXT,
      FormFieldType.EMAIL,
      FormFieldType.PHONE,
      FormFieldType.TEXTAREA,
      FormFieldType.CHECKBOX,
      FormFieldType.SELECT,
      FormFieldType.RADIO,
      FormFieldType.FILE
    ]),
    label: import_zod.z.string().min(1, "Field label is required"),
    placeholder: import_zod.z.string().optional(),
    required: import_zod.z.boolean().default(false),
    order: import_zod.z.number().int().nonnegative(),
    options: import_zod.z.array(import_zod.z.string()).optional(),
    // For select/radio/checkbox fields
    maxLength: import_zod.z.number().int().positive().optional(),
    helperText: import_zod.z.string().optional(),
    validationRegex: import_zod.z.string().optional(),
    validationMessage: import_zod.z.string().optional()
  })),
  termsAndConditions: import_zod.z.string().optional(),
  requiresTermsAcceptance: import_zod.z.boolean().default(false),
  slug: import_zod.z.string().min(1, "Form slug is required")
});
var insertFormSubmissionSchema = baseFormSubmissionSchema.omit({ id: true, createdAt: true }).extend({
  formId: import_zod.z.number().int().positive(),
  userId: import_zod.z.number().int().positive().optional(),
  submitterEmail: import_zod.z.string().email().optional(),
  formData: import_zod.z.record(import_zod.z.any()),
  fileUploads: import_zod.z.array(import_zod.z.string()).optional(),
  termsAccepted: import_zod.z.boolean().default(false),
  ipAddress: import_zod.z.string().optional()
});
var insertOrderReturnSchema = baseOrderReturnSchema.omit({ id: true, createdAt: true, updatedAt: true }).extend({
  status: import_zod.z.enum([
    ReturnStatus.REQUESTED,
    ReturnStatus.APPROVED,
    ReturnStatus.DENIED,
    ReturnStatus.LABEL_CREATED,
    ReturnStatus.SHIPPED,
    ReturnStatus.RECEIVED,
    ReturnStatus.REFUNDED,
    ReturnStatus.COMPLETED,
    ReturnStatus.CANCELLED
  ]).default(ReturnStatus.REQUESTED),
  reason: import_zod.z.enum([
    ReturnReason.WRONG_SIZE,
    ReturnReason.WRONG_ITEM,
    ReturnReason.DEFECTIVE,
    ReturnReason.NOT_AS_DESCRIBED,
    ReturnReason.CHANGED_MIND,
    ReturnReason.OTHER
  ]),
  notes: import_zod.z.string().optional(),
  reasonDetails: import_zod.z.string().optional(),
  imageUrls: import_zod.z.array(import_zod.z.string()).optional(),
  returnLabelUrl: import_zod.z.string().optional(),
  trackingNumber: import_zod.z.string().optional(),
  refundAmount: import_zod.z.number().min(0).optional(),
  refundId: import_zod.z.string().optional(),
  printfulReturnId: import_zod.z.string().optional(),
  adminNotes: import_zod.z.string().optional()
});
var insertReturnItemSchema = baseReturnItemSchema.omit({ id: true, createdAt: true }).extend({
  quantity: import_zod.z.number().min(1, "Quantity must be at least 1"),
  reason: import_zod.z.enum([
    ReturnReason.WRONG_SIZE,
    ReturnReason.WRONG_ITEM,
    ReturnReason.DEFECTIVE,
    ReturnReason.NOT_AS_DESCRIBED,
    ReturnReason.CHANGED_MIND,
    ReturnReason.OTHER
  ]),
  reasonDetails: import_zod.z.string().optional()
});
var forumDescription = (0, import_pg_core.pgTable)("forum_description", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  content: (0, import_pg_core.text)("content").notNull().default(""),
  updatedBy: (0, import_pg_core.integer)("updated_by").references(() => users.id),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var forumCategories = (0, import_pg_core.pgTable)("forum_categories", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  name: (0, import_pg_core.text)("name").notNull(),
  description: (0, import_pg_core.text)("description"),
  slug: (0, import_pg_core.text)("slug").notNull().unique(),
  icon: (0, import_pg_core.text)("icon"),
  // Icon name for the category
  order: (0, import_pg_core.integer)("order").default(0),
  // For controlling display order
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var forumPosts = (0, import_pg_core.pgTable)("forum_posts", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  title: (0, import_pg_core.text)("title").notNull(),
  content: (0, import_pg_core.text)("content").notNull(),
  categoryId: (0, import_pg_core.integer)("category_id").references(() => forumCategories.id).notNull(),
  userId: (0, import_pg_core.integer)("user_id").references(() => users.id).notNull(),
  isPinned: (0, import_pg_core.boolean)("is_pinned").default(false),
  isLocked: (0, import_pg_core.boolean)("is_locked").default(false),
  views: (0, import_pg_core.integer)("views").default(0),
  mediaUrls: (0, import_pg_core.text)("media_urls").array(),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var forumComments = (0, import_pg_core.pgTable)("forum_comments", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  content: (0, import_pg_core.text)("content").notNull(),
  postId: (0, import_pg_core.integer)("post_id").references(() => forumPosts.id).notNull(),
  authorId: (0, import_pg_core.integer)("author_id").references(() => users.id).notNull(),
  // Using authorId instead of userId to match database
  parentCommentId: (0, import_pg_core.integer)("parent_comment_id").references(() => forumComments.id),
  // For nested replies
  mediaUrls: (0, import_pg_core.text)("media_urls").array(),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var forumReactions = (0, import_pg_core.pgTable)("forum_reactions", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  postId: (0, import_pg_core.integer)("post_id").references(() => forumPosts.id),
  commentId: (0, import_pg_core.integer)("comment_id").references(() => forumComments.id),
  userId: (0, import_pg_core.integer)("user_id").references(() => users.id).notNull(),
  reactionType: (0, import_pg_core.text)("reaction_type").notNull(),
  // 'like', 'thumbsup', etc.
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
});
var baseForumCategorySchema = (0, import_drizzle_zod.createInsertSchema)(forumCategories);
var baseForumPostSchema = (0, import_drizzle_zod.createInsertSchema)(forumPosts);
var baseForumCommentSchema = (0, import_drizzle_zod.createInsertSchema)(forumComments);
var baseForumReactionSchema = (0, import_drizzle_zod.createInsertSchema)(forumReactions);
var baseForumDescriptionSchema = (0, import_drizzle_zod.createInsertSchema)(forumDescription);
var insertForumCategorySchema = baseForumCategorySchema.omit({ id: true, createdAt: true, updatedAt: true }).extend({
  name: import_zod.z.string().min(2, "Category name is required and must be at least 2 characters"),
  description: import_zod.z.string().optional(),
  slug: import_zod.z.string().min(2, "Slug is required"),
  icon: import_zod.z.string().optional(),
  order: import_zod.z.number().optional()
});
var insertForumPostSchema = baseForumPostSchema.omit({ id: true, createdAt: true, updatedAt: true, views: true }).extend({
  title: import_zod.z.string().min(3, "Post title is required and must be at least 3 characters"),
  content: import_zod.z.string().min(10, "Post content is required and must be at least 10 characters"),
  categoryId: import_zod.z.number(),
  isPinned: import_zod.z.boolean().optional().default(false),
  isLocked: import_zod.z.boolean().optional().default(false),
  mediaUrls: import_zod.z.array(import_zod.z.string()).optional().default([])
});
var insertForumCommentSchema = baseForumCommentSchema.omit({ id: true, createdAt: true, updatedAt: true }).extend({
  content: import_zod.z.string().min(1, "Comment content is required"),
  postId: import_zod.z.number(),
  authorId: import_zod.z.number(),
  // Changed from userId to authorId to match the database column
  parentCommentId: import_zod.z.number().optional(),
  mediaUrls: import_zod.z.array(import_zod.z.string()).optional().default([])
});
var insertForumReactionSchema = baseForumReactionSchema.omit({ id: true, createdAt: true }).extend({
  postId: import_zod.z.number().optional(),
  commentId: import_zod.z.number().optional(),
  reactionType: import_zod.z.string()
}).refine((data) => {
  return data.postId && !data.commentId || !data.postId && data.commentId;
}, {
  message: "Either postId or commentId must be provided, but not both"
});
var insertForumDescriptionSchema = baseForumDescriptionSchema.omit({ id: true, createdAt: true, updatedAt: true }).extend({
  content: import_zod.z.string()
});
var vendorComments = (0, import_pg_core.pgTable)("vendor_comments", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  pageSlug: (0, import_pg_core.text)("page_slug").notNull(),
  // Vendor page slug
  userId: (0, import_pg_core.integer)("user_id").references(() => users.id).notNull(),
  content: (0, import_pg_core.text)("content").notNull(),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var vendorInteractions = (0, import_pg_core.pgTable)("vendor_interactions", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  pageSlug: (0, import_pg_core.text)("page_slug").notNull(),
  // Vendor page slug
  userId: (0, import_pg_core.integer)("user_id").references(() => users.id).notNull(),
  interactionType: (0, import_pg_core.text)("interaction_type").notNull(),
  // 'like', 'recommend', etc.
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
});
var vendorCategories = (0, import_pg_core.pgTable)("vendor_categories", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  slug: (0, import_pg_core.text)("slug").notNull().unique(),
  // e.g., "home-services"
  name: (0, import_pg_core.text)("name").notNull().unique(),
  // e.g., "Home Services"
  icon: (0, import_pg_core.text)("icon"),
  // Icon identifier for the category
  order: (0, import_pg_core.integer)("order").notNull().default(0),
  isHidden: (0, import_pg_core.boolean)("is_hidden").notNull().default(false),
  // To hide categories from nav and listings
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var communityCategories = (0, import_pg_core.pgTable)("community_categories", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  slug: (0, import_pg_core.text)("slug").notNull().unique(),
  // e.g., "government"
  name: (0, import_pg_core.text)("name").notNull().unique(),
  // e.g., "Government & Regulations"
  icon: (0, import_pg_core.text)("icon"),
  // Optional icon name for the category (e.g., "Building")
  order: (0, import_pg_core.integer)("order").notNull().default(0),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var baseVendorCommentSchema = (0, import_drizzle_zod.createInsertSchema)(vendorComments);
var baseVendorInteractionSchema = (0, import_drizzle_zod.createInsertSchema)(vendorInteractions);
var baseVendorCategorySchema = (0, import_drizzle_zod.createInsertSchema)(vendorCategories);
var baseCommunityCategory = (0, import_drizzle_zod.createInsertSchema)(communityCategories);
var insertVendorCommentSchema = baseVendorCommentSchema.omit({ id: true, createdAt: true, updatedAt: true });
var insertVendorInteractionSchema = baseVendorInteractionSchema.omit({ id: true, createdAt: true });
var insertVendorCategorySchema = baseVendorCategorySchema.omit({ id: true, createdAt: true, updatedAt: true }).extend({
  slug: import_zod.z.string().min(1, "Slug is required"),
  name: import_zod.z.string().min(1, "Name is required"),
  icon: import_zod.z.string().optional(),
  order: import_zod.z.number().optional().default(0),
  isHidden: import_zod.z.boolean().optional().default(false)
});
var insertCommunityCategorySchema = baseCommunityCategory.omit({ id: true, createdAt: true, updatedAt: true }).extend({
  slug: import_zod.z.string().min(1, "Slug is required"),
  name: import_zod.z.string().min(1, "Name is required"),
  icon: import_zod.z.string().optional(),
  order: import_zod.z.number().optional().default(0)
});
var FeatureFlagName = {
  CALENDAR: "calendar",
  FORUM: "forum",
  FOR_SALE: "for_sale",
  STORE: "store",
  VENDORS: "vendors",
  COMMUNITY: "community",
  LAUNCH_SCREEN: "launch_screen",
  ADMIN: "admin_access",
  // Admin feature flag
  WEATHER_ROCKET_ICONS: "weather_rocket_icons"
  // Weather and rocket icons in navigation
};
var featureFlags = (0, import_pg_core.pgTable)("feature_flags", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  name: (0, import_pg_core.text)("name").notNull().unique(),
  // Name of the feature flag (e.g., 'calendar', 'forum')
  displayName: (0, import_pg_core.text)("display_name").notNull(),
  // Display name shown in UI (e.g., 'Calendar', 'Forum')
  enabledForRoles: (0, import_pg_core.text)("enabled_for_roles").array().notNull().default([]),
  // Array of roles that can access this feature
  description: (0, import_pg_core.text)("description"),
  // Description of what this feature does
  isActive: (0, import_pg_core.boolean)("is_active").notNull().default(true),
  // Global switch to toggle feature on/off regardless of roles
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var baseFeatureFlagSchema = (0, import_drizzle_zod.createInsertSchema)(featureFlags);
var insertFeatureFlagSchema = baseFeatureFlagSchema.omit({ id: true, createdAt: true, updatedAt: true }).extend({
  name: import_zod.z.enum([
    FeatureFlagName.CALENDAR,
    FeatureFlagName.FORUM,
    FeatureFlagName.FOR_SALE,
    FeatureFlagName.STORE,
    FeatureFlagName.VENDORS,
    FeatureFlagName.COMMUNITY,
    FeatureFlagName.LAUNCH_SCREEN,
    FeatureFlagName.ADMIN,
    FeatureFlagName.WEATHER_ROCKET_ICONS
  ]),
  displayName: import_zod.z.string().min(1, "Display name is required"),
  enabledForRoles: import_zod.z.array(import_zod.z.enum([
    UserRole.GUEST,
    UserRole.REGISTERED,
    UserRole.BADGE_HOLDER,
    UserRole.PAID,
    UserRole.MODERATOR,
    UserRole.ADMIN
  ])),
  description: import_zod.z.string().optional(),
  isActive: import_zod.z.boolean().default(true)
});
var siteSettings = (0, import_pg_core.pgTable)("site_settings", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  key: (0, import_pg_core.text)("key").notNull().unique(),
  // Unique setting key (e.g., 'rocket_icon')
  value: (0, import_pg_core.text)("value").notNull(),
  // Setting value (e.g., URL or JSON string)
  description: (0, import_pg_core.text)("description"),
  // Optional description
  updatedBy: (0, import_pg_core.integer)("updated_by").references(() => users.id),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var baseSiteSettingSchema = (0, import_drizzle_zod.createInsertSchema)(siteSettings);
var insertSiteSettingSchema = baseSiteSettingSchema.omit({ id: true, createdAt: true, updatedAt: true }).extend({
  key: import_zod.z.string().min(1, "Setting key is required"),
  value: import_zod.z.string().min(1, "Setting value is required"),
  description: import_zod.z.string().optional()
});

// server/db.ts
var { Pool } = import_pg.default;
var pool;
var db;
var isConnected = false;
var MAX_CONNECTION_RETRIES = 5;
var connectionRetries = 0;
var createPool = () => {
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL environment variable is not set, database features will be unavailable");
    return null;
  }
  console.log("Initializing database connection...");
  try {
    const isProduction = process.env.NODE_ENV === "production";
    const poolConfig = isProduction ? {
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
        // Allow self-signed certificates
      },
      max: 20,
      // Increased pool size for higher concurrency
      idleTimeoutMillis: 3e4,
      // 30s idle timeout
      connectionTimeoutMillis: 5e3,
      // 5s connection timeout
      allowExitOnIdle: false
      // Prevent node from exiting while pool is idle
    } : {
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      },
      max: 5,
      idleTimeoutMillis: 3e4,
      connectionTimeoutMillis: 1e4,
      allowExitOnIdle: false
    };
    console.log("PostgreSQL connection pool optimized for " + (isProduction ? "production" : "development") + " with settings:", poolConfig);
    const newPool = new Pool(poolConfig);
    newPool.on("error", (err) => {
      console.error("Unexpected error on idle database client", err);
    });
    newPool.on("connect", (client) => {
      client.on("error", (err) => {
        console.error("Database client error:", err.message);
      });
    });
    return newPool;
  } catch (err) {
    console.error("\u274C Database pool creation error:", err instanceof Error ? err.message : String(err));
    return null;
  }
};
var retryOperation = async (operation, maxRetries = 3, delayMs = 500) => {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      const currentDelay = delayMs * attempt;
      console.log(`Operation failed (attempt ${attempt}/${maxRetries}). Retrying in ${currentDelay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, currentDelay));
    }
  }
  throw lastError;
};
var initializeDatabase = async () => {
  try {
    pool = createPool();
    if (!pool) {
      console.warn("Database pool could not be created. Some features will be unavailable.");
      return;
    }
    db = (0, import_node_postgres.drizzle)(pool, {
      schema: schema_exports,
      // Add session-level connection error handling
      sessionOptions: {
        max: 5,
        // Max consecutive rejections
        backoffBase: 500,
        // Base delay between retries (ms)
        backoffExponent: 2
        // For exponential backoff
      }
    });
    try {
      await retryOperation(async () => {
        const client = await pool.connect();
        await client.query("SELECT 1");
        client.release();
        return true;
      }, 5, 1e3);
      console.log("\u2705 Database connected successfully");
      console.log("\u2713 Performance optimizations applied");
      isConnected = true;
      connectionRetries = 0;
    } catch (err) {
      console.error(`\u274C Database connection failed after multiple attempts:`, err.message);
      if (connectionRetries < MAX_CONNECTION_RETRIES) {
        connectionRetries++;
        const retryDelay = 2e3 * connectionRetries;
        console.log(`Retrying database connection in ${retryDelay}ms...`);
        setTimeout(() => {
          initializeDatabase();
        }, retryDelay);
      } else {
        console.error(`\u274C Max connection retries (${MAX_CONNECTION_RETRIES}) reached. Giving up.`);
        console.warn("Application will continue with limited database functionality.");
      }
    }
  } catch (err) {
    console.error("\u274C Database initialization error:", err instanceof Error ? err.message : String(err));
    console.warn("Continuing with limited functionality");
  }
};
initializeDatabase();

// server/migration-service.ts
var import_drizzle_orm = require("drizzle-orm");
var SOURCE_TYPE = {
  FILESYSTEM: "filesystem",
  POSTGRESQL: "postgresql"
};
var MIGRATION_STATUS = {
  PENDING: "pending",
  MIGRATED: "migrated",
  FAILED: "failed"
};
var MigrationService = class {
  // Expose schema for use in other modules
  migrationRecords = migrationRecords;
  /**
   * Create a new migration record
   * @param options Migration record details
   * @returns Created migration record
   */
  async createMigrationRecord(options) {
    try {
      const record = {
        sourceType: options.sourceType,
        sourceLocation: options.sourceLocation,
        mediaBucket: options.mediaBucket,
        mediaType: options.mediaType,
        storageKey: options.storageKey,
        migrationStatus: options.migrationStatus,
        errorMessage: options.errorMessage || null,
        migratedAt: options.migrationStatus === MIGRATION_STATUS.MIGRATED ? /* @__PURE__ */ new Date() : null,
        verificationStatus: false,
        verifiedAt: null,
        createdAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      };
      const [created] = await db.insert(migrationRecords).values(record).returning();
      return created;
    } catch (error) {
      console.error("Error creating migration record:", error);
      throw error;
    }
  }
  /**
   * Get a migration record by ID
   * @param id Migration record ID
   * @returns Migration record or undefined if not found
   */
  async getMigrationRecord(id) {
    try {
      const [record] = await db.select().from(migrationRecords).where((0, import_drizzle_orm.eq)(migrationRecords.id, id));
      return record;
    } catch (error) {
      console.error(`Error getting migration record ${id}:`, error);
      throw error;
    }
  }
  /**
   * Get migration records by source location
   * @param sourceLocation Source file location
   * @returns Array of migration records
   */
  async getMigrationsBySourceLocation(sourceLocation) {
    try {
      return await db.select().from(migrationRecords).where((0, import_drizzle_orm.eq)(migrationRecords.sourceLocation, sourceLocation));
    } catch (error) {
      console.error(`Error getting migration records for ${sourceLocation}:`, error);
      throw error;
    }
  }
  /**
   * Get migration records by status
   * @param status Migration status to filter by
   * @param limit Maximum number of records to return
   * @returns Array of migration records
   */
  async getMigrationsByStatus(status, limit = 100) {
    try {
      return await db.select().from(migrationRecords).where((0, import_drizzle_orm.eq)(migrationRecords.migrationStatus, status)).limit(limit);
    } catch (error) {
      console.error(`Error getting migration records with status ${status}:`, error);
      throw error;
    }
  }
  /**
   * Update a migration record's status
   * @param id Migration record ID
   * @param status New migration status
   * @param errorMessage Optional error message (for failed migrations)
   * @returns Updated migration record
   */
  async updateMigrationStatus(id, status, errorMessage) {
    try {
      const updateValues = {
        migrationStatus: status,
        updatedAt: /* @__PURE__ */ new Date()
      };
      if (status === MIGRATION_STATUS.MIGRATED) {
        updateValues.migratedAt = /* @__PURE__ */ new Date();
      }
      if (errorMessage !== void 0) {
        updateValues.errorMessage = errorMessage;
      }
      const [updated] = await db.update(migrationRecords).set(updateValues).where((0, import_drizzle_orm.eq)(migrationRecords.id, id)).returning();
      return updated;
    } catch (error) {
      console.error(`Error updating migration status for record ${id}:`, error);
      throw error;
    }
  }
  /**
   * Mark a migration record as verified
   * @param id Migration record ID
   * @returns Updated migration record
   */
  async markAsVerified(id) {
    try {
      const [updated] = await db.update(migrationRecords).set({
        verificationStatus: true,
        verifiedAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      }).where((0, import_drizzle_orm.eq)(migrationRecords.id, id)).returning();
      return updated;
    } catch (error) {
      console.error(`Error marking migration record ${id} as verified:`, error);
      throw error;
    }
  }
  /**
   * Delete a migration record
   * @param id Migration record ID
   * @returns Boolean indicating success
   */
  async deleteMigrationRecord(id) {
    try {
      await db.delete(migrationRecords).where((0, import_drizzle_orm.eq)(migrationRecords.id, id));
      return true;
    } catch (error) {
      console.error(`Error deleting migration record ${id}:`, error);
      throw error;
    }
  }
  /**
   * Get migration statistics
   * @returns Object with migration counts
   */
  async getMigrationStats() {
    try {
      const [totalResult] = await db.select({ count: db.count() }).from(migrationRecords);
      const pendingResult = await db.select({ count: db.count() }).from(migrationRecords).where((0, import_drizzle_orm.eq)(migrationRecords.migrationStatus, MIGRATION_STATUS.PENDING));
      const migratedResult = await db.select({ count: db.count() }).from(migrationRecords).where((0, import_drizzle_orm.eq)(migrationRecords.migrationStatus, MIGRATION_STATUS.MIGRATED));
      const failedResult = await db.select({ count: db.count() }).from(migrationRecords).where((0, import_drizzle_orm.eq)(migrationRecords.migrationStatus, MIGRATION_STATUS.FAILED));
      const verifiedResult = await db.select({ count: db.count() }).from(migrationRecords).where((0, import_drizzle_orm.eq)(migrationRecords.verificationStatus, true));
      return {
        total: Number(totalResult?.count || 0),
        pending: Number(pendingResult[0]?.count || 0),
        migrated: Number(migratedResult[0]?.count || 0),
        failed: Number(failedResult[0]?.count || 0),
        verified: Number(verifiedResult[0]?.count || 0)
      };
    } catch (error) {
      console.error("Error getting migration statistics:", error);
      throw error;
    }
  }
};
var migrationService = new MigrationService();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MIGRATION_STATUS,
  SOURCE_TYPE,
  migrationService
});
