console.log("🚨🚨🚨 MODULE LEVEL: server/routes.ts IS BEING LOADED! 🚨🚨🚨");

import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth, requireAuth, requireAdmin, hashPassword } from "./auth";
import { storage, db } from "./storage";
import { parseEventReadOptions } from "./event-read-model";
import { sql } from "drizzle-orm";
import { LegalHoldError } from "./dmca/legal-hold";
import { assertCanPermanentDelete, PermanentDeletePermissionError } from "./dmca/permanent-delete";
import { verifyUnsubscribeToken } from "./unsubscribe-token";
// Import WebSocket for chat functionality
import { WebSocketServer, WebSocket } from "ws";
import { processBase64Images } from "./base64-image-processor";
import { objectStorageService } from "./object-storage-service";
import objectStorageProxyRouter from "./object-storage-proxy";
import Stripe from "stripe";
// Import Square service which handles all Square API interactions
import * as squareService from './square-service';
import squareAppInfoRouter from './square-app-info';
// Import credit service for Square payment integration
import { creditService } from './credit-service';
import {
  getFeaturedListingCreditCost,
  validateFeatureUpgrade,
  resolveFeaturedListingCreditCost,
  parseFeaturedListingCreditCost,
  MIN_FEATURED_LISTING_CREDIT_COST,
  MAX_FEATURED_LISTING_CREDIT_COST,
  FEATURED_LISTING_COST_SETTING_KEY,
} from './featured-listing';
import { isFeaturedListingsEnabled } from './featured-listings-flag';
import { 
  createCreditPurchaseLink, 
  verifyCreditPurchase, 
  getUserCreditBalance, 
  CREDIT_PACKAGES 
} from './credit-purchase-service';
// Import chat router with named WebSocket configurator
import chatRouter, { configureChatWebSockets } from "./routes/chat";
import { validateAndSanitizeCommunityPage } from "./community-page-validator";
import { handleStandardForumFormat } from "./forum-standard-format-handler";
import forumMediaTestRouter from "./routes/forum-media-test";
import testPagesRouter from "./serve-test-pages";
import { sendEmail, sendListingContactEmail, sendListingContactConfirmationEmail, sendCalendarEventNotificationEmail, sendPlatinumSponsorRequestEmail, sendListingExpiredAdminEmail, sendListingExpiredSellerEmail, sendNoActiveListingsAdminEmail } from "./sendgrid-service";
import {
  FORSALE_EMAIL_CONFIG_KEY,
  FORSALE_EMAIL_PLACEHOLDERS,
  loadForSaleEmailConfig,
  getDefaultForSaleEmailConfig,
  mergeForSaleEmailConfig,
  type ForSaleEmailConfig,
  type ForSaleEmailType,
} from "./forsale-email-config";
import {
  WEEKLY_LISTINGS_CONFIG_KEY,
  loadWeeklyListingsEmailConfig,
  mergeWeeklyListingsEmailConfig,
  WEEKLY_EMAIL_PLACEHOLDERS,
  getDefaultWeeklyEmailTemplate,
  getCampaignWeekRange,
  selectListingsForWeek,
  resolveWeeklyEmailRecipients,
  renderWeeklyListingsEmail,
} from "./weekly-listings-email";
import {
  executeWeeklySend,
  getWeeklySendHistory,
  getWeeklyEmailBaseUrl,
  getNextScheduledSend,
  getNextSendBlocker,
  getWeeklyEmailActivity,
  logWeeklyEmailActivity,
} from "./weekly-listings-scheduler";
import { getSendGridCredentials } from "./lib/sendgrid-credentials";
import {
  resolveCalendarNotificationRecipients,
  buildCalendarNonePreferenceResponse,
  buildCalendarNoRecipientsResponse,
  buildCalendarPartialFailureResponse,
  buildCalendarSuccessResponse,
} from "./calendar-notification-helpers";
import { runCalendarEmailWatchdog, computeCalendarEmailHealth, MAX_RUN_HISTORY } from "./calendar-email-scheduler";
import type { CalendarEmailRunHistoryEntry } from "@workspace/db";
import { pool } from "./db";
import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { startOfDay, endOfDay, addDays } from 'date-fns';
// Import new unified storage service and middleware
import { unifiedStorageService, STORAGE_BUCKETS } from "./unified-storage-service";
import { Client } from "@replit/object-storage";
import { createObjectStorageClient } from "./lib/object-storage-client";
import { canonicalizeAvatarUrl } from "./lib/avatar-url";
import { 
  uploadToObjectStorage, 
  processObjectStorageUploadResult,
  createStandardUploadHandler
} from "./object-storage-upload-middleware";
import { forumUpload, handleForumMediaUpload, handleMultipleForumMediaUpload } from "./forum-media-upload-handler";
import { vendorUpload, handleVendorMediaUpload } from "./vendor-media-upload-handler";
import { communityUpload, handleCommunityMediaUpload } from "./community-media-upload-handler";

// WebSocket interface for real-time messaging
interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
  userId?: string;
}
import { insertEventSchema, insertListingSchema, insertPageContentSchema, contentVersions, insertFeatureFlagSchema, UserRole, type PageContent, insertListingPaymentSchema, type User, type FeatureFlag, users, messages, messageAttachments, messageRecipients } from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";
import logger from "./logger";
import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import express from "express";
import { fileURLToPath } from 'url';
import printfulRoutes from './routes/printful';
import adminMessagesRouter from './routes/admin-messages';
import { dirname } from 'path';
import { normalizeMediaUrl } from './shared-compat/url-normalizer';
import { isVendorPage } from './shared-compat/vendor-url-utils';
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { eq, sql } from "drizzle-orm";
import { sendPasswordResetEmail, generateResetToken } from "./password-reset";
import { 
  testEmailDelivery, 
  testPasswordResetEmail, 
  checkEmailConfiguration, 
  generateDiagnosticReport 
} from "./email-diagnostics";
// Import Square service for payment API endpoints
import * as squareService from "./square-service";
// Import Google service for Maps API proxying
import * as googleService from "./google-service";
// Import analytics router for tracking user behavior
import analyticsRouter from "./routes/analytics";
import sitemapRouter from "./routes/sitemap";
// Import analytics middleware
import { analyticsMiddleware } from "./analytics-service";
// Import subscription service for recurring payments
import fetch from "node-fetch";
import * as subscriptionService from "./subscription-service";
// Import for Gemini API proxy
import { URLSearchParams } from "url";
// Import XLSX for Excel export functionality
import * as XLSX from "xlsx";
// Import rocket launch service
import { getUpcomingRocketLaunches } from "./rocket-launch-service";
import productsRouter from "./routes/products";
import realEstateRouter from "./routes/real-estate";
import { Square } from "./square-client";
import testMediaRouter from "./routes/test-media";
import printServiceRouter from "./routes/print-service";
import ordersRouter from "./routes/orders";
import testRouter from "./routes/test-routes";
import returnsRouter from "./routes/returns"; 
import { createForumRouter } from "./routes/forum";
import calendarMediaDiagnosticsRouter from "./calendar-media-diagnostics";
import debugRouter from "./debug-routes";
import { createVendorRouter } from "./routes/vendors";
import { createVendorCategoryRouter } from "./routes/vendor-categories";
// Import user membership subscription routes
import userSubscriptionsRouter from "./routes/subscriptions";
// Import sponsorship proxy for routing
import sponsorshipProxyRouter from "./routes/sponsorship-proxy";
// Import contact form router for handling contact form submissions
import contactRouter from "./routes/contact";
// Import setup memberships utility for creating membership products
import setupMembershipsRouter from "./routes/setup-memberships";
// Import membership processing admin tools
import membershipProcessingRouter from "./routes/membership-processing";
// Import admin manual upgrade tools
import adminManualUpgradeRouter from "./routes/admin-manual-upgrade";
// Import deployment diagnostic tools
import deploymentDiagnosticRouter from "./deployment-diagnostic";
// Import calendar media diagnostics
import calendarMediaDiagnostics from './calendar-media-diagnostics';
import calendarMediaMigration from './calendar-media-migration';
import { calendarDiagnosticsRouter } from './routes/calendar-diagnostics';
import { productionSyncRouter } from "./production-sync";
import { createCommunityCategoryRouter } from "./routes/community-categories";
import { productionAuthRouter } from "./fix-production-auth";
import storageBrowserRouter from './routes/storage-browser';
import bannerSlideHelpersRouter from './routes/banner-slide-helpers';
import messagesRouter from './routes/messages-updated';
import dmcaUploaderRouter from './routes/dmca-uploader';
// Import message diagnostics router for troubleshooting message visibility issues
import messageDiagnosticsRouter from './routes/message-diagnostics';
// Import new message debug router for analyzing message read status
import messageDebugRouter from './routes/message-debug';
// Import active users tracking router
import activeUsersRouter from './routes/active-users';
// Import unified search router
import searchRouter from './routes/search';
// Import media path utilities
import { MEDIA_TYPES, ensureDirectoryExists, copyFileToProductionLocation, saveMediaFile, findMediaFile, fixMediaUrl, fixRealEstateMediaUrl, fixContentMediaUrl, normalizeEventMediaUrl } from "./media-path-utils";
import { mediaSyncMiddleware } from "./media-sync-middleware";
import { realEstateObjectStorageMiddleware } from "./real-estate-object-storage-middleware";
import { handleCalendarMediaUpload } from "./calendar-media-upload-handler";
import { processUploadedFiles, processUploadedFile, VALID_SECTIONS } from "./media-upload-middleware";
import { assertUserDeletable, assertMessageDeletable } from "./dmca/legal-hold";
import { isPubliclyVisible, canViewerSee, filterForViewer, getViewerContext, publicOnly, resolveDetailForViewer, sendContentUnavailable, enforceVisibilityOnJson } from "./dmca/content-visibility";
// WebSocket already imported at the top

const scryptAsync = promisify(scrypt);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create specialized uploader configuration for real estate media
const realEstateMediaType = MEDIA_TYPES.REAL_ESTATE_MEDIA;
const realEstateFileSize = 20 * 1024 * 1024; // 20MB

// Reusable configuration function for real estate uploads
function handleRealEstateUpload(req: Request, res: Response, next: NextFunction) {
  // Set up an in-memory storage multer instance for temporary files
  // These will later be uploaded to Object Storage exclusively (no filesystem storage)
  const upload = multer({
    limits: { fileSize: realEstateFileSize },
    storage: multer.memoryStorage(), // Use memory storage instead of disk storage
    fileFilter: (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'image/svg+xml',
        'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
        'text/csv',
        'application/octet-stream' // Allow octet-stream for file uploads that might not have proper mimetype detection
      ];
      
      // Also check file extension as a fallback
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.mp4', '.webm', '.ogg', '.mov', '.csv'];
      const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
      
      if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
        console.log(`Accepted file: ${file.originalname} with mimetype: ${file.mimetype}`);
        cb(null, true);
      } else {
        console.log(`Rejected file: ${file.originalname} with mimetype: ${file.mimetype} and extension: ${fileExtension}`);
        cb(new Error('Invalid file type'));
      }
    }
  });
  
  // Always set the media type for real estate
  req.mediaType = MEDIA_TYPES.REAL_ESTATE_MEDIA;
  console.log(`Real estate upload middleware - Using memory storage for Object Storage exclusive upload`);
  
  // Use multer's array method to handle multiple file uploads
  const handler = upload.array('media');
  return handler(req, res, next);
}

// Configure multer for standard file uploads with enhanced media path support for production
const upload = multer({
  storage: multer.diskStorage({
    destination: function (req: any, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) {
      // Determine media type from the request based on field name or explicit setting
      let mediaType;
      
      if (req.mediaType) {
        // Use explicitly set media type
        mediaType = req.mediaType;
      } else if (file.fieldname === 'bannerImage') {
        mediaType = MEDIA_TYPES.BANNER_SLIDES;
      } else if (file.fieldname === 'media') {
        mediaType = MEDIA_TYPES.CALENDAR;
      } else if (file.fieldname === 'avatar') {
        mediaType = MEDIA_TYPES.AVATARS;
      } else if (file.fieldname === 'iconFile') {
        mediaType = MEDIA_TYPES.ICONS;
      } else if (file.fieldname === 'mediaFile') {
        // Check if this is a forum-related upload by examining the request URL or headers
        if (req.originalUrl && req.originalUrl.includes('/forum/')) {
          mediaType = MEDIA_TYPES.FORUM;
          console.log(`Detected forum media upload from URL: ${req.originalUrl}`);
        } else if (req.headers && req.headers.referer && req.headers.referer.includes('/forum/')) {
          mediaType = MEDIA_TYPES.FORUM;
          console.log(`Detected forum media upload from referer: ${req.headers.referer}`);
        } else {
          mediaType = MEDIA_TYPES.CONTENT;
        }
      } else if (file.fieldname === 'forumMedia') {
        mediaType = MEDIA_TYPES.FORUM;
      } else if (file.fieldname === 'vendorMedia') {
        mediaType = MEDIA_TYPES.VENDOR;
      } else if (file.fieldname === 'communityMedia') {
        mediaType = MEDIA_TYPES.COMMUNITY;
      } else if (file.fieldname === 'realEstateMedia') {
        mediaType = MEDIA_TYPES.REAL_ESTATE_MEDIA; // Use the new dedicated folder
      } else if (file.fieldname === 'attachedAsset') {
        mediaType = MEDIA_TYPES.ATTACHED_ASSETS;
      }
      
      // Store the media type on the request object for later use in the endpoint handlers
      req.mediaType = mediaType;
      
      let uploadDir;
      
      if (mediaType) {
        // Get the appropriate uploads directory
        uploadDir = path.join(__dirname, '../uploads', mediaType);
        
        // Also ensure the production directory exists for later copying
        const prodDir = path.join(__dirname, '..', mediaType);
        ensureDirectoryExists(prodDir);
        
        console.log(`Media upload detected - type: ${mediaType}, directory: ${uploadDir}`);
      } else {
        // Default uploads directory if media type not determined
        uploadDir = path.join(__dirname, '../uploads');
        console.log(`Generic upload - using default directory: ${uploadDir}`);
      }
      
      // Ensure the directory exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      cb(null, uploadDir);
    },
    filename: function (_req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  fileFilter: (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = [
      // Images
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      // SVG
      'image/svg+xml',
      // Videos
      'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
      // Other
      'text/csv'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      console.log(`Rejected file with mimetype: ${file.mimetype}`);
      cb(new Error('Invalid file type'));
    }
  },
  limits: {
    fileSize: 350 * 1024 * 1024 // 350MB limit for videos
  }
});

// Password hashing function
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Helper functions for media paths
function getMediaUrl(mediaType: string, filename: string, useUploads: boolean = true): string {
  if (useUploads) {
    return `/uploads/${mediaType}/${filename}`;
  } else {
    return `/${mediaType}/${filename}`;
  }
}

function processUploadedFile(req: any, file: Express.Multer.File): { success: boolean, url: string, developmentUrl: string, message?: string } {
  console.log(`[ProcessFile] Processing uploaded file with media type: ${req.mediaType || 'uploads'}`);
  
  if (!file) {
    console.error('[ProcessFile] No file provided in request');
    return { 
      success: false, 
      url: '', 
      developmentUrl: '',
      message: 'No file provided' 
    };
  }
  
  // Get media type
  const mediaType = req.mediaType || 'uploads';
  console.log(`[ProcessFile] Using media type: ${mediaType}`);
  
  // Generate URLs
  const developmentUrl = `/uploads/${mediaType}/${file.filename}`;
  const url = `/${mediaType}/${file.filename}`;
  
  console.log(`[ProcessFile] Generated URLs:`, {
    developmentUrl,
    productionUrl: url
  });
  
  // Copy file to production location if needed
  const uploadsPath = path.join(__dirname, '..', developmentUrl);
  const prodPath = path.join(__dirname, '..', url);
  
  console.log(`[ProcessFile] File paths:`, {
    uploadsPath,
    productionPath: prodPath
  });
  
  // Check if uploads file exists
  if (!fs.existsSync(uploadsPath)) {
    console.error(`[ProcessFile] Source file does not exist at expected path: ${uploadsPath}`);
    
    // Enhanced error recovery - check if file exists in temporary location
    const tempPath = path.join(os.tmpdir(), file.filename);
    const tempExists = fs.existsSync(tempPath);
    console.log(`[ProcessFile] Checking temporary location: ${tempPath}, exists: ${tempExists}`);
    
    if (tempExists) {
      // Create the uploads directory if it doesn't exist
      const uploadsDir = path.dirname(uploadsPath);
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        console.log(`[ProcessFile] Created uploads directory: ${uploadsDir}`);
      }
      
      // Copy from temp directory to uploads directory
      try {
        fs.copyFileSync(tempPath, uploadsPath);
        console.log(`[ProcessFile] Successfully copied file from temp location to uploads: ${uploadsPath}`);
      } catch (err) {
        console.error(`[ProcessFile] Failed to copy from temp location: ${err}`);
        // Continue to check other potential locations
      }
    }
    
    // After recovery attempt, check again if the file exists
    if (!fs.existsSync(uploadsPath)) {
      console.error(`[ProcessFile] Recovery failed, file not found in any location`);
      return {
        success: false,
        url: '',
        developmentUrl: '',
        message: 'Source file missing after upload - recovery failed'
      };
    }
  }
  
  // For calendar and vendor media, ensure files exist in both paths
  if (mediaType === MEDIA_TYPES.CALENDAR || mediaType === MEDIA_TYPES.VENDOR) {
    // Create the production directory if it doesn't exist
    const prodDir = path.dirname(prodPath);
    if (!fs.existsSync(prodDir)) {
      console.log(`[ProcessFile] Creating production directory: ${prodDir}`);
      fs.mkdirSync(prodDir, { recursive: true });
    }
    
    // Copy the file to production location
    try {
      fs.copyFileSync(uploadsPath, prodPath);
      console.log(`[ProcessFile] Successfully copied file:`, {
        from: uploadsPath,
        to: prodPath,
        fileSize: `${Math.round(fs.statSync(prodPath).size / 1024)}KB`
      });
    } catch (err) {
      console.error(`[ProcessFile] Error copying file to production location:`, err);
      // Still return success as the file is at least in the uploads directory
    }
    
    // Verify both files exist
    const uploadsExists = fs.existsSync(uploadsPath);
    const prodExists = fs.existsSync(prodPath);
    
    console.log(`[ProcessFile] File existence check:`, {
      uploadsPath: uploadsExists ? 'Exists' : 'Missing',
      productionPath: prodExists ? 'Exists' : 'Missing'
    });
  } else {
    // For other media types, use the standard approach
    // Create the production directory if it doesn't exist
    const prodDir = path.dirname(prodPath);
    if (!fs.existsSync(prodDir)) {
      console.log(`[ProcessFile] Creating production directory: ${prodDir}`);
      fs.mkdirSync(prodDir, { recursive: true });
    }
    
    // Copy the file to production location
    try {
      fs.copyFileSync(uploadsPath, prodPath);
      console.log(`[ProcessFile] Successfully copied file:`, {
        from: uploadsPath,
        to: prodPath,
        fileSize: `${Math.round(fs.statSync(prodPath).size / 1024)}KB`
      });
    } catch (err) {
      console.error(`[ProcessFile] Error copying file to production location:`, err);
      // Still return success as the file is at least in the uploads directory
    }
  }
  
  return {
    success: true,
    url,
    developmentUrl
  };
}

// Define comprehensive table mapping for user deletion
const USER_DEPENDENT_TABLES = {
  // Critical tables that must be deleted
  critical: [
    'forum_reactions',
    'forum_comments',
    'forum_posts',
    'event_comments',
    'event_interactions',
    'vendor_comments',
    'vendor_interactions',
    'form_submissions',
    'order_items',
    'orders',
    'order_returns',
    'listing_payments',
    'messages',
    'message_recipients',
    'credit_transactions',
    'square_payments',
    'user_credits',
    'sponsorships'
  ],
  // Analytics and auxiliary data
  analytics: [
    'analytics_events',
    'analytics_page_views',
    'analytics_sessions'
  ],
  // Nullable references - can be nullified
  nullable: [
    'content',
    'page_content',
    'page_contents',
    'content_versions',
    'products',
    'events',
    'forum_description',
    'real_estate_listings',
    'custom_forms',
    'site_settings'
  ]
};

export async function registerRoutes(app: Express): Promise<Server> {
  console.log("🔥🔥🔥 registerRoutes() FUNCTION CALLED - SERVER STARTUP BEGINNING! 🔥🔥🔥");
  // Create HTTP server
  const server = createServer(app);
  
  // Authentication and global legal gate are installed once by app.ts.

  // User deletion helper function - defined before endpoints that use it
  async function deleteUserData(userId: number) {
    console.log(`Starting enhanced deletion for user ID: ${userId}`);
    // Legal hold: refuse before touching anything (the cascade below would
    // otherwise destroy held content/messages).
    await assertUserDeletable(userId);
    
    return await db.transaction(async (tx) => {
      try {
        // First, manually delete records from tables with NO ACTION constraints
        // These need to be deleted first before the CASCADE DELETE can work
        
        console.log(`Manually deleting NO ACTION constraint records for user ${userId}...`);
        
        // First, clear last_read_comment_id references to comments created by this user
        // This prevents foreign key violations when we later delete the user's comments
        const clearedReadStatesResult = await tx.execute(sql`
          UPDATE forum_read_states 
          SET last_read_comment_id = NULL 
          WHERE last_read_comment_id IN (
            SELECT id FROM forum_comments WHERE author_id = ${userId}
          )
        `);
        console.log(`Cleared ${clearedReadStatesResult.rowCount} forum read state references to user's comments`);
        
        // Delete forum read states (NO ACTION constraint)
        const forumReadStatesResult = await tx.execute(sql`DELETE FROM forum_read_states WHERE user_id = ${userId}`);
        console.log(`Deleted ${forumReadStatesResult.rowCount} forum read state records`);
        
        // Delete store visits (NO ACTION constraint)  
        const storeVisitsResult = await tx.execute(sql`DELETE FROM store_visits WHERE user_id = ${userId}`);
        console.log(`Deleted ${storeVisitsResult.rowCount} store visit records`);
        
        // Delete for sale visits (NO ACTION constraint)
        const forSaleVisitsResult = await tx.execute(sql`DELETE FROM for_sale_visits WHERE user_id = ${userId}`);
        console.log(`Deleted ${forSaleVisitsResult.rowCount} for sale visit records`);
        
        // Delete vendor page visits (NO ACTION constraint)
        const vendorPageVisitsResult = await tx.execute(sql`DELETE FROM vendor_page_visits WHERE user_id = ${userId}`);
        console.log(`Deleted ${vendorPageVisitsResult.rowCount} vendor page visit records`);
        
        // Delete event interactions for events created by this user (NO ACTION constraint on event_id)
        // This handles the case where user created events that others interacted with
        const eventInteractionsResult = await tx.execute(sql`
          DELETE FROM event_interactions 
          WHERE event_id IN (SELECT id FROM events WHERE created_by = ${userId})
        `);
        console.log(`Deleted ${eventInteractionsResult.rowCount} event interaction records for user's events`);
        
        // Delete event comments for events created by this user (NO ACTION constraint on event_id)
        // This handles the case where user created events that others commented on
        const eventCommentsResult = await tx.execute(sql`
          DELETE FROM event_comments 
          WHERE event_id IN (SELECT id FROM events WHERE created_by = ${userId})
        `);
        console.log(`Deleted ${eventCommentsResult.rowCount} event comment records for user's events`);
        
        // Now delete the user record - CASCADE DELETE will handle all remaining dependencies
        console.log(`Executing CASCADE DELETE for user ${userId}...`);
        const userResult = await tx.execute(sql`DELETE FROM users WHERE id = ${userId}`);
        
        if (userResult.rowCount === 0) {
          throw new Error('User record could not be deleted - user may not exist');
        }
        
        const totalRecords = clearedReadStatesResult.rowCount + forumReadStatesResult.rowCount + storeVisitsResult.rowCount + forSaleVisitsResult.rowCount + vendorPageVisitsResult.rowCount + eventInteractionsResult.rowCount + eventCommentsResult.rowCount + userResult.rowCount;
        console.log(`Successfully deleted user ${userId} and ${totalRecords} total records`);
        
        return { 
          success: true, 
          totalDeleted: totalRecords,
          message: 'User and all associated data deleted successfully' 
        };
      } catch (error) {
        console.error(`Enhanced deletion failed for user ${userId}:`, error);
        throw error;
      }
    });
  }

  // Debug endpoint to test routing
  app.get("/api/user/delete-test", (req, res) => {
    console.log("🧪 DELETE TEST ENDPOINT CALLED");
    res.json({ message: "Delete test endpoint is working", authenticated: req.isAuthenticated() });
  });

  // Get user dependencies endpoint (for pre-deletion analysis)
  app.get("/api/users/:id/dependencies", async (req, res) => {
    console.log("🔍 USER DEPENDENCIES CHECK ENDPOINT CALLED", {
      authenticated: req.isAuthenticated(),
      user: req.user ? { id: req.user.id, role: req.user.role } : null,
      targetUserId: req.params.id
    });

    // Auth checks
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        message: "Not authenticated", 
        code: "AUTH_REQUIRED"
      });
    }

    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({
        message: "Invalid user ID",
        code: "INVALID_USER_ID"
      });
    }

    // Admin can check any user, users can only check themselves
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ 
        message: "Insufficient permissions",
        details: "You can only check dependencies for your own account",
        code: "INSUFFICIENT_PERMISSIONS"
      });
    }

    try {
      // Check if user exists
      const currentUser = await storage.getUser(userId);
      
      if (!currentUser) {
        return res.status(404).json({ 
          message: "User not found",
          code: "USER_NOT_FOUND"
        });
      }

      console.log(`Analyzing dependencies for user ${currentUser.username} (${userId})`);

      // Query all tables that reference the user
      const dependencies = await db.transaction(async (tx) => {
        const results = {
          // Tables with CASCADE DELETE (will be automatically handled)
          cascadeTables: {
            analytics_events: await tx.execute(sql`SELECT COUNT(*) as count FROM analytics_events WHERE user_id = ${userId}`),
            analytics_page_views: await tx.execute(sql`SELECT COUNT(*) as count FROM analytics_page_views WHERE user_id = ${userId}`),
            analytics_sessions: await tx.execute(sql`SELECT COUNT(*) as count FROM analytics_sessions WHERE user_id = ${userId}`),
            content_updated: await tx.execute(sql`SELECT COUNT(*) as count FROM content WHERE updated_by = ${userId}`),
            content_versions: await tx.execute(sql`SELECT COUNT(*) as count FROM content_versions WHERE created_by = ${userId}`),
            credit_transactions: await tx.execute(sql`SELECT COUNT(*) as count FROM credit_transactions WHERE user_id = ${userId}`),
            custom_forms: await tx.execute(sql`SELECT COUNT(*) as count FROM custom_forms WHERE created_by = ${userId}`),
            event_comments: await tx.execute(sql`SELECT COUNT(*) as count FROM event_comments WHERE user_id = ${userId}`),
            event_interactions: await tx.execute(sql`SELECT COUNT(*) as count FROM event_interactions WHERE user_id = ${userId}`),
            events_created: await tx.execute(sql`SELECT COUNT(*) as count FROM events WHERE created_by = ${userId}`),
            form_submissions: await tx.execute(sql`SELECT COUNT(*) as count FROM form_submissions WHERE user_id = ${userId}`),
            forum_comments: await tx.execute(sql`SELECT COUNT(*) as count FROM forum_comments WHERE author_id = ${userId}`),
            forum_description: await tx.execute(sql`SELECT COUNT(*) as count FROM forum_description WHERE updated_by = ${userId}`),
            forum_likes: await tx.execute(sql`SELECT COUNT(*) as count FROM forum_likes WHERE user_id = ${userId}`),
            forum_posts: await tx.execute(sql`SELECT COUNT(*) as count FROM forum_posts WHERE user_id = ${userId}`),
            forum_reactions: await tx.execute(sql`SELECT COUNT(*) as count FROM forum_reactions WHERE user_id = ${userId}`),
            message_recipients: await tx.execute(sql`SELECT COUNT(*) as count FROM message_recipients WHERE recipient_id = ${userId}`),
            messages_sent: await tx.execute(sql`SELECT COUNT(*) as count FROM messages WHERE sender_id = ${userId}`),
            orders: await tx.execute(sql`SELECT COUNT(*) as count FROM orders WHERE user_id = ${userId}`),
            page_content: await tx.execute(sql`SELECT COUNT(*) as count FROM page_content WHERE created_by = ${userId}`),
            page_contents: await tx.execute(sql`SELECT COUNT(*) as count FROM page_contents WHERE updated_by = ${userId}`),
            products: await tx.execute(sql`SELECT COUNT(*) as count FROM products WHERE created_by = ${userId}`),
            real_estate_listings: await tx.execute(sql`SELECT COUNT(*) as count FROM real_estate_listings WHERE created_by = ${userId}`),
            site_settings: await tx.execute(sql`SELECT COUNT(*) as count FROM site_settings WHERE updated_by = ${userId}`),
            sponsorships: await tx.execute(sql`SELECT COUNT(*) as count FROM sponsorships WHERE user_id = ${userId}`),
            square_payments: await tx.execute(sql`SELECT COUNT(*) as count FROM square_payments WHERE user_id = ${userId}`),
            user_credits: await tx.execute(sql`SELECT COUNT(*) as count FROM user_credits WHERE user_id = ${userId}`),
            vendor_comments: await tx.execute(sql`SELECT COUNT(*) as count FROM vendor_comments WHERE user_id = ${userId}`),
            vendor_interactions: await tx.execute(sql`SELECT COUNT(*) as count FROM vendor_interactions WHERE user_id = ${userId}`),
            vendor_visits: await tx.execute(sql`SELECT COUNT(*) as count FROM vendor_visits WHERE user_id = ${userId}`)
          },
          
          // Tables with NO ACTION constraints (need manual deletion)
          noActionTables: {
            forum_read_states: await tx.execute(sql`SELECT COUNT(*) as count FROM forum_read_states WHERE user_id = ${userId}`),
            store_visits: await tx.execute(sql`SELECT COUNT(*) as count FROM store_visits WHERE user_id = ${userId}`),
            for_sale_visits: await tx.execute(sql`SELECT COUNT(*) as count FROM for_sale_visits WHERE user_id = ${userId}`)
          }
        };
        
        return results;
      });

      // Calculate totals
      const cascadeTotal = Object.values(dependencies.cascadeTables).reduce((sum, result: any) => 
        sum + parseInt(result.rows[0].count), 0);
      const noActionTotal = Object.values(dependencies.noActionTables).reduce((sum, result: any) => 
        sum + parseInt(result.rows[0].count), 0);
      const grandTotal = cascadeTotal + noActionTotal;

      // Format the response
      const formattedDependencies = {
        user: {
          id: userId,
          username: currentUser.username,
          fullName: currentUser.fullName
        },
        summary: {
          totalRecords: grandTotal,
          cascadeRecords: cascadeTotal,
          noActionRecords: noActionTotal,
          canDelete: true, // Our enhanced deletion handles both types
          requiresManualCleanup: noActionTotal > 0
        },
        details: {
          cascadeTables: Object.entries(dependencies.cascadeTables).map(([table, result]: [string, any]) => ({
            table,
            count: parseInt(result.rows[0].count),
            deletionType: 'CASCADE'
          })).filter(item => item.count > 0),
          noActionTables: Object.entries(dependencies.noActionTables).map(([table, result]: [string, any]) => ({
            table,
            count: parseInt(result.rows[0].count),
            deletionType: 'MANUAL'
          })).filter(item => item.count > 0)
        }
      };

      console.log(`Dependencies analysis complete for user ${userId}:`, formattedDependencies.summary);

      res.json(formattedDependencies);
      
    } catch (error: any) {
      console.error(`Error checking dependencies for user ${userId}:`, error);
      res.status(500).json({ 
        message: "Failed to check user dependencies",
        details: error.message,
        code: "DEPENDENCY_CHECK_FAILED"
      });
    }
  });

  // Email notification preference endpoints.
  // Authenticated self-service: a logged-in user can only unsubscribe
  // THEMSELVES — any client-supplied userId is ignored.
  app.post("/api/user/unsubscribe-emails", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "You must be signed in to update email preferences" });
      }

      const userId = req.user.id;
      await db.execute(
        sql`UPDATE users SET email_notifications_enabled = false WHERE id = ${userId}`
      );

      res.json({ 
        success: true, 
        message: "You have been unsubscribed from email notifications" 
      });
    } catch (error) {
      console.error("Error unsubscribing from emails:", error);
      res.status(500).json({ message: "Failed to unsubscribe from email notifications" });
    }
  });

  // Public tokenized unsubscribe: the token is a signed (HMAC) value embedded
  // in every email's unsubscribe link, so recipients can unsubscribe without
  // logging in. Idempotent. Also serves RFC 8058 one-click POSTs from mail
  // clients (List-Unsubscribe-Post: List-Unsubscribe=One-Click), which arrive
  // as form posts with the token in the query string.
  app.post("/api/unsubscribe", async (req, res) => {
    try {
      const token = (req.body && req.body.token) || req.query.token;
      const verified = verifyUnsubscribeToken(token);
      if (!verified) {
        return res.status(400).json({
          success: false,
          message: "This unsubscribe link is invalid or has been tampered with. Please sign in to manage your email preferences.",
        });
      }

      const user = await storage.getUser(verified.userId);
      if (!user) {
        // Account no longer exists — nothing to unsubscribe; treat as success.
        return res.json({ success: true, message: "You have been unsubscribed from email notifications" });
      }

      await db.execute(
        sql`UPDATE users SET email_notifications_enabled = false WHERE id = ${verified.userId}`
      );
      console.log(`[Unsubscribe] User ${verified.userId} unsubscribed via tokenized link`);

      res.json({
        success: true,
        message: "You have been unsubscribed from email notifications",
        email: user.email ?? undefined,
      });
    } catch (error) {
      console.error("Error processing tokenized unsubscribe:", error);
      res.status(500).json({ success: false, message: "Failed to unsubscribe from email notifications" });
    }
  });

  // Public tokenized resubscribe: lets a recipient who unsubscribed by mistake
  // undo it in one click from the unsubscribe success screen, reusing the same
  // signed token. Idempotent — the token only ever affects its own user.
  app.post("/api/resubscribe", async (req, res) => {
    try {
      const token = (req.body && req.body.token) || req.query.token;
      const verified = verifyUnsubscribeToken(token);
      if (!verified) {
        return res.status(400).json({
          success: false,
          message: "This link is invalid or has been tampered with. Please sign in to manage your email preferences.",
        });
      }

      const user = await storage.getUser(verified.userId);
      if (!user) {
        return res.status(400).json({
          success: false,
          message: "This account no longer exists. Please sign in to manage your email preferences.",
        });
      }

      await db.execute(
        sql`UPDATE users SET email_notifications_enabled = true WHERE id = ${verified.userId}`
      );
      console.log(`[Resubscribe] User ${verified.userId} resubscribed via tokenized link`);

      res.json({
        success: true,
        message: "You have been resubscribed to email notifications",
        email: user.email ?? undefined,
      });
    } catch (error) {
      console.error("Error processing tokenized resubscribe:", error);
      res.status(500).json({ success: false, message: "Failed to resubscribe to email notifications" });
    }
  });

  // PRIORITY ENDPOINT: Self-deletion endpoint - must be registered early to avoid conflicts
  app.delete("/api/user/delete-account", async (req, res) => {
    console.log("🚨 SELF-DELETION ENDPOINT CALLED 🚨", {
      authenticated: req.isAuthenticated(),
      user: req.user ? { id: req.user.id, username: req.user.username, role: req.user.role } : null,
      headers: {
        origin: req.headers.origin,
        host: req.headers.host,
        referer: req.headers.referer,
        cookie: req.headers.cookie ? "Present" : "None"
      }
    });

    // Auth check
    if (!req.isAuthenticated()) {
      console.warn("Self-deletion request failed: not authenticated");
      return res.status(401).json({ 
        message: "Not authenticated", 
        details: "You need to be logged in to delete your account",
        code: "AUTH_REQUIRED"
      });
    }

    const userId = req.user.id;
    const username = req.user.username;
    
    console.log(`Processing self-deletion for user ${username} (${userId})`);

    try {
      // Execute deletion using simplified approach
      const deletionResult = await deleteUserData(userId);
      
      console.log(`Self-deletion completed for ${username} (${userId}):`, {
        success: deletionResult.success,
        totalDeleted: deletionResult.totalDeleted
      });

      if (deletionResult.success) {
        // Destroy session after successful deletion
        req.session.destroy((err) => {
          if (err) {
            console.error("Error destroying session after self-deletion:", err);
          }
        });
        
        res.json({ 
          message: "Account successfully deleted",
          details: `User ${username} has been permanently removed from the system along with all associated data.`,
          code: "DELETION_SUCCESS",
          totalRecordsDeleted: deletionResult.totalDeleted
        });
      } else {
        res.status(500).json({ 
          message: "Account deletion failed",
          details: "There was an error deleting your account. Please try again or contact support.",
          code: "DELETION_FAILED"
        });
      }
    } catch (error) {
      console.error(`Self-deletion failed for ${username} (${userId}):`, error);
      
      // Handle foreign key constraint errors
      if ((error as any).code === '23503' || ((error as any).message && (error as any).message.includes('foreign key'))) {
        let tableName = 'unknown table';
        let constraintDetail = '';
        
        if ((error as any).detail) {
          const tableMatch = (error as any).detail.match(/table "([^"]+)"/);
          if (tableMatch && tableMatch[1]) {
            tableName = tableMatch[1];
          }
          constraintDetail = (error as any).detail;
        } else if ((error as any).table) {
          tableName = (error as any).table;
        }
        
        return res.status(409).json({ 
          message: "Cannot delete account due to remaining references",
          details: `Your account still has content in ${tableName} that could not be automatically deleted. Please contact support for assistance.`,
          code: "FOREIGN_KEY_VIOLATION",
          constraint: (error as any).constraint || constraintDetail,
          table: tableName
        });
      }
      
      // Handle database connection errors
      if ((error as any).message && ((error as any).message.includes('connection') || (error as any).message.includes('timeout'))) {
        return res.status(503).json({
          message: "Database connection error",
          details: "Could not connect to the database to complete this operation. Please try again later.",
          code: "DB_CONNECTION_ERROR"
        });
      }
      
      // Generic server error
      res.status(500).json({ 
        message: "Failed to delete account",
        details: error instanceof Error ? error.message : "Unknown error occurred",
        code: "SERVER_ERROR"
      });
    }
  });
  
  // Apply analytics middleware to capture page views and user behavior
  if (typeof analyticsMiddleware === 'function') {
    app.use(analyticsMiddleware);
  }
  
  // API endpoint for real estate media files
  app.get('/api/real-estate-media/:filename', async (req: Request, res: Response) => {
    try {
      const { filename } = req.params;
      
      console.log(`[RealEstateMedia] Received request for: ${filename}`);
      
      // Try multiple sources in sequence
      
      // 1. Check Object Storage with real-estate-media prefix
      try {
        const storageKey = `real-estate-media/${filename}`;
        console.log(`[RealEstateMedia] Trying Object Storage: ${storageKey}`);
        
        const buffer = await objectStorageService.getFile(storageKey, 'REAL_ESTATE');
        if (buffer && buffer.length > 0) {
          console.log(`[RealEstateMedia] Found in Object Storage: ${storageKey}`);
          const ext = path.extname(filename).toLowerCase();
          const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 
                             ext === '.png' ? 'image/png' : 
                             ext === '.gif' ? 'image/gif' : 
                             ext === '.webp' ? 'image/webp' : 'application/octet-stream';
          
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.send(buffer);
        }
      } catch (err) {
        console.log(`[RealEstateMedia] Object storage check failed: ${err.message}`);
      }
      
      // 2. Check filesystem paths as fallback
      const possiblePaths = [
        path.join(__dirname, '..', 'uploads', 'real-estate-media', filename),
        path.join(__dirname, '..', 'real-estate-media', filename)
      ];
      
      console.log(`[RealEstateMedia] Checking filesystem paths`);
      for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
          console.log(`[RealEstateMedia] Found in filesystem: ${filePath}`);
          return res.sendFile(filePath);
        }
      }
      
      // 3. Redirect to storage proxy as final attempt
      console.log(`[RealEstateMedia] Trying storage proxy fallback`);
      return res.redirect(`/api/storage-proxy/REAL_ESTATE/${filename}`);
      
    } catch (error) {
      console.error('[RealEstateMedia] Error serving real estate media:', error);
      // Fallback to default property image
      return res.redirect('/default-property-image.svg');
    }
  });
  
  // Configure WebSockets for chat
  // Setup WebSockets for real-time messaging feature
  // This legacy unauthenticated broadcaster is disabled. Express session/consent
  // middleware does not cover upgrade requests; never accept them implicitly.
  const wss = new WebSocketServer({ server, verifyClient: () => false });
  
  wss.on('connection', (ws) => {
    console.log('New WebSocket connection established');
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Received message:', data);
        
        // Handle message types for the chat system
        if (data.type === 'chat-message') {
          console.log('Processing chat message:', data.data);
          // Broadcast the chat message to all clients
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'chat-message',
                data: data.data,
                timestamp: new Date().toISOString()
              }));
            }
          });
        } else if (data.type === 'read-message') {
          console.log('Processing read status update:', data.data);
          // Broadcast read status to all clients
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'read-message',
                data: data.data,
                timestamp: new Date().toISOString()
              }));
            }
          });
        } else {
          // Default broadcast for other message types
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(data));
            }
          });
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    ws.on('close', () => {
      console.log('WebSocket connection closed');
    });
  });
  
  // Message routes - register at both paths for compatibility
  app.use('/api/chat', chatRouter);
  // Also mount the routes at /api directly for the new interface
  app.use('/api', chatRouter);
  
  // Google Maps API key proxy to fix hardcoded key issue
  app.get('/google-maps-proxy', async (req, res) => {
    try {
      logger.info(`Google Maps proxy request received with params: ${JSON.stringify(req.query)}`);
      
      // Get client domain for CORS
      const origin = req.headers.origin || '*';
      
      // Allow browsers to call this endpoint by setting proper CORS headers
      res.set('Access-Control-Allow-Origin', origin);
      
      // Preconnect to Google's domains to speed up subsequent requests
      res.set('Link', '<https://maps.googleapis.com>; rel=preconnect; crossorigin, <https://maps.gstatic.com>; rel=preconnect; crossorigin');
      
      // Set appropriate content type for JavaScript
      res.set('Content-Type', 'application/javascript');
      
      // Cache for 24 hours to improve performance
      res.set('Cache-Control', 'public, max-age=86400');
      
      // Use the GoogleService to proxy the Google Maps script
      const scriptContent = await googleService.proxyGoogleMapsScript(req.query as Record<string, string>);
      
      // Send the proxied script content
      res.send(scriptContent);
      
      logger.info('Successfully served Google Maps script via proxy');
    } catch (error) {
      logger.error('Error proxying Google Maps script:', error);
      
      // Send a more helpful error response
      res.status(500).send(`
        // Google Maps API loading error
        console.error("Server failed to proxy Google Maps API:", ${JSON.stringify(String(error))});
        
        // Try to notify any waiting callbacks
        if (window.gm_authFailure) {
          window.gm_authFailure();
        }
        
        // Dispatch a custom event that the app can listen for
        window.dispatchEvent(new CustomEvent('google-maps-load-error'));
      `);
    }
  });

  // Debug endpoint to check email configuration in production
  app.get("/api/test-email-config", (req, res) => {
    try {
      const config = {
        hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
        hasGoogleRefreshToken: !!process.env.GOOGLE_REFRESH_TOKEN,
        hasGoogleUserEmail: !!process.env.GOOGLE_USER_EMAIL,
        hasGoogleAccessToken: !!process.env.GOOGLE_ACCESS_TOKEN,
        googleUserEmail: process.env.GOOGLE_USER_EMAIL,
        nodeEnv: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
      };
      
      console.log("Email configuration check:", config);
      res.json(config);
    } catch (error) {
      console.error("Email config check error:", error);
      res.status(500).json({ error: "Configuration check failed" });
    }
  });

  // Password Reset Request Route
  app.post("/api/password-reset/request", async (req, res) => {
    try {
      console.log("===== Password reset request received =====");
      const { email } = req.body;
      
      console.log("Request body:", req.body);
      
      if (!email) {
        console.log("Email is required but was not provided");
        return res.status(400).json({ message: "Email is required" });
      }
      
      console.log(`Attempting to find user with email: ${email}`);
      
      // Find user by email (case-insensitive)
      const user = await storage.getUserByEmailCaseInsensitive(email);
      
      if (!user) {
        console.log(`No user found with email (case-insensitive): ${email}`);
        // Include emailExists: false flag to show appropriate message on frontend, but wording still doesn't reveal too much
        return res.status(200).json({ 
          message: "If a user with that email exists, a password reset link has been sent", 
          emailExists: false 
        });
      }
      
      console.log(`User found: ID ${user.id}, Username: ${user.username}, Email: ${user.email}`);
      
      // Clear any expired tokens from the database first
      console.log("Cleaning up expired reset tokens...");
      const db = storage.getDb();
      await db.execute(sql`
        UPDATE users 
        SET reset_token = NULL, reset_token_expires = NULL 
        WHERE reset_token_expires < NOW()
      `);
      
      // Generate a reset token
      const resetToken = generateResetToken();
      // Ensure we use UTC time consistently - add 1 hour (3600000ms) to current UTC time
      const now = new Date();
      const resetTokenExpires = new Date(now.getTime() + 3600000); // Token expires in 1 hour
      
      console.log(`Generated reset token for user ${user.id}: ${resetToken.substring(0, 8)}...`);
      console.log(`Current UTC time: ${now.toISOString()}`);
      console.log(`Token will expire at: ${resetTokenExpires.toISOString()}`);
      
      // Clear any existing reset token first, then set the new one
      console.log(`Updating user ${user.id} with reset token`);
      try {
        await storage.updateUser(user.id, {
          resetToken,
          resetTokenExpires,
          updatedAt: new Date()
        });
        console.log("Database update successful for reset token");
        
        // Verify the update by checking what was actually saved
        const updatedUser = await storage.getUserByEmailCaseInsensitive(email);
        console.log(`Verification - Token saved: ${updatedUser?.resetToken?.substring(0, 8)}...`);
        console.log(`Verification - Expires saved: ${updatedUser?.resetTokenExpires}`);
      } catch (dbError) {
        console.error("Failed to update user in database:", dbError);
        return res.status(500).json({ message: "Failed to save reset token" });
      }

      // Send password reset email
      console.log(`Attempting to send password reset email to: ${user.email}`);
      try {
        const emailSent = await sendPasswordResetEmail(user, resetToken, resetTokenExpires);
        console.log(`Password reset email sending result: ${emailSent ? 'SUCCESS' : 'FAILED'}`);
        
        // Check email configuration if sending failed
        if (!emailSent) {
          console.log("Email sending failed. Checking environment variables:");
          console.log(`- GMAIL_APP_PASSWORD: ${process.env.GMAIL_APP_PASSWORD ? 'Set' : 'Not set'}`);
          console.log(`- GOOGLE_USER_EMAIL: ${process.env.GOOGLE_USER_EMAIL ? 'Set' : 'Not set'}`);
        }
      } catch (emailError) {
        console.error("Email sending threw an exception:", emailError);
        // Don't return error to client for security - we still created the token
      }
      
      return res.status(200).json({ 
        message: "A password reset link has been sent to your email",
        emailExists: true, 
        email: user.email 
      });
    } catch (error) {
      console.error("Password reset request error:", error);
      // Enhanced error logging
      if (error instanceof Error) {
        console.error("Error details:", error.message);
        console.error("Stack trace:", error.stack);
      }
      return res.status(500).json({ message: "An error occurred while processing your request" });
    }
  });
  
  // Validate Reset Token Route
  app.post("/api/password-reset/validate", async (req, res) => {
    try {
      console.log("===== Password reset token validation =====");
      const { email, token } = req.body;
      
      console.log(`Validating token for email: ${email}`);
      console.log(`Token provided: ${token?.substring(0, 8)}...`);
      
      if (!email || !token) {
        console.log("Missing email or token in request");
        return res.status(400).json({ message: "Email and token are required" });
      }
      
      // Find user by email (case-insensitive)
      const user = await storage.getUserByEmailCaseInsensitive(email);
      
      if (!user) {
        console.log(`No user found for email: ${email}`);
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }
      
      console.log(`User found: ID ${user.id}`);
      console.log(`Stored token: ${user.resetToken?.substring(0, 8)}...`);
      console.log(`Stored expiration: ${user.resetTokenExpires}`);
      
      if (!user.resetToken || user.resetToken !== token) {
        console.log("Token mismatch or missing stored token");
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }
      
      // Check if token has expired with detailed logging
      const now = new Date();
      const expiresAt = new Date(user.resetTokenExpires!);
      
      console.log(`Current UTC time: ${now.toISOString()}`);
      console.log(`Token expires at: ${expiresAt.toISOString()}`);
      console.log(`Time difference (minutes): ${(expiresAt.getTime() - now.getTime()) / (1000 * 60)}`);
      
      if (!user.resetTokenExpires || now > expiresAt) {
        console.log("Token has expired");
        return res.status(400).json({ message: "Reset token has expired" });
      }
      
      console.log("Token validation successful");
      return res.status(200).json({ message: "Token is valid", valid: true });
    } catch (error) {
      console.error("Token validation error:", error);
      return res.status(500).json({ message: "An error occurred while validating the token" });
    }
  });
  
  // Reset Password Route
  app.post("/api/password-reset/reset", async (req, res) => {
    try {
      const { email, token, newPassword } = req.body;
      
      if (!email || !token || !newPassword) {
        return res.status(400).json({ message: "Email, token, and new password are required" });
      }
      
      // Find user by email (case-insensitive)
      const user = await storage.getUserByEmailCaseInsensitive(email);
      
      if (!user || !user.resetToken || user.resetToken !== token) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }
      
      // Check if token has expired
      if (!user.resetTokenExpires || new Date() > new Date(user.resetTokenExpires)) {
        return res.status(400).json({ message: "Reset token has expired" });
      }
      
      // Hash the new password
      const hashedPassword = await hashPassword(newPassword);
      
      // Update user with new password and clear reset token
      await storage.updateUser(user.id, {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpires: null,
        updatedAt: new Date()
      });
      
      return res.status(200).json({ message: "Password has been reset successfully" });
    } catch (error) {
      console.error("Password reset error:", error);
      return res.status(500).json({ message: "An error occurred while resetting your password" });
    }
  });

  // Email Diagnostic Routes (Admin only)
  app.get("/api/email-diagnostics/config", requireAdmin, async (req, res) => {
    try {
      const result = await checkEmailConfiguration();
      res.json(result);
    } catch (error) {
      console.error("Email config check error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to check email configuration",
        timestamp: new Date()
      });
    }
  });

  app.post("/api/email-diagnostics/test-delivery", requireAdmin, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email address is required" });
      }
      
      const result = await testEmailDelivery(email);
      res.json(result);
    } catch (error) {
      console.error("Email delivery test error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to test email delivery",
        timestamp: new Date()
      });
    }
  });

  app.post("/api/email-diagnostics/test-password-reset", requireAdmin, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email address is required" });
      }
      
      const result = await testPasswordResetEmail(email);
      res.json(result);
    } catch (error) {
      console.error("Password reset test error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to test password reset email",
        timestamp: new Date()
      });
    }
  });

  app.post("/api/email-diagnostics/full-report", requireAdmin, async (req, res) => {
    try {
      const { email } = req.body;
      const result = await generateDiagnosticReport(email);
      res.json(result);
    } catch (error) {
      console.error("Email diagnostic report error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to generate diagnostic report",
        timestamp: new Date()
      });
    }
  });

  // Note: Static file middleware for uploads directory is now configured in server/index.ts
  // to ensure it runs before authentication middleware
  
  // Production data sync and debugging endpoints (admin only)
  app.use('/api/production-sync', productionSyncRouter);
  
  // Production authentication troubleshooting endpoints
  app.use('/api/production-auth', productionAuthRouter);
  
  // Deployment diagnostic endpoints
  app.use('/api/deployment-diagnostic', deploymentDiagnosticRouter);
  
  // Calendar media diagnostics for fixing event media issues
  app.use('/api/calendar-media', calendarMediaDiagnosticsRouter);
  
  // Calendar event diagnostics for production/dev database issues
  app.use('/api/calendar-diagnostics', calendarDiagnosticsRouter);
  
  // Storage browser for diagnostic purposes
  app.use('/api', storageBrowserRouter);
  
  // Banner slide helpers for fixing banner display issues
  app.use('/api', bannerSlideHelpersRouter);
  
  // We'll add the message diagnostics routes in a different way
  
  // Analytics routes for tracking user behavior
  app.use('/api/analytics', analyticsRouter);
  // Sitemap index + per-section sitemaps. The router declares its own absolute paths
  // (e.g. /sitemap.xml, /sitemap-events.xml, /sitemap-events-2.xml), so mount at root.
  app.use('/', sitemapRouter);
  app.use('/api', sitemapRouter);
  
  // Add direct routes for our test event API HTML files
  app.get('/test-event-api.html', (req, res) => {
    const htmlPath = path.join(__dirname, '..', 'public', 'test-event-api.html');
    if (fs.existsSync(htmlPath)) {
      res.sendFile(htmlPath);
    } else {
      res.status(404).send('Test event API page not found');
    }
  });
  
  // Add direct route for event media test page
  app.get('/event-media-test.html', (req, res) => {
    const htmlPath = path.join(__dirname, '..', 'public', 'event-media-test.html');
    if (fs.existsSync(htmlPath)) {
      res.sendFile(htmlPath);
    } else {
      res.status(404).send('Event Media Test page not found');
    }
  });
  
  // Add direct route for forum media test page
  app.get('/forum-media-test.html', (req, res) => {
    const htmlPath = path.join(__dirname, '..', 'public', 'forum-media-test.html');
    if (fs.existsSync(htmlPath)) {
      res.sendFile(htmlPath);
    } else {
      res.status(404).send('Forum Media Test page not found');
    }
  });
  
  // Add direct route for tmp_debug files
  app.get('/tmp_debug/:filename', (req, res) => {
    const filepath = path.join(__dirname, '..', 'tmp_debug', req.params.filename);
    console.log(`Request for tmp_debug file: ${filepath}`);
    if (fs.existsSync(filepath)) {
      res.sendFile(filepath);
    } else {
      res.status(404).send(`Debug file not found: ${req.params.filename}`);
    }
  });
  
  // Also serve the test page directly at the root URL
  app.get('/', (req, res) => {
    const htmlPath = path.join(__dirname, '..', 'public', 'test-event-api.html');
    if (fs.existsSync(htmlPath)) {
      res.sendFile(htmlPath);
    } else {
      res.status(404).send('Test event API page not found');
    }
  });
  
  // Admin debug routes for diagnostics and troubleshooting
  app.use('/api/admin/debug', requireAdmin, debugRouter);
  
  // User subscriptions router for membership management
  app.use('/api/subscriptions', userSubscriptionsRouter);
  
  // Square diagnostic endpoint for troubleshooting credentials
  app.use('/api/square-app-info', squareAppInfoRouter);
  
  // Add sponsorship proxy to forward /api/sponsorship/* to /api/subscriptions/*
  // This maintains backwards compatibility while using more appropriate terminology
  app.use('/api/sponsorship', sponsorshipProxyRouter);
  
  // Special route to handle subscription confirmation redirect
  // This is needed because Square redirects to /subscriptions/confirm instead of /api/subscriptions/confirm
  app.get('/subscriptions/confirm', (req, res) => {
    console.log('Subscription confirmation redirect received at /subscriptions/confirm:', req.query);
    // Forward the request to the API endpoint with the same query parameters
    res.redirect(`/api/subscriptions/confirm${req.url.substring(req.path.length)}`);
  });
  
  // Add sponsorship confirmation redirect handler (for consistency with the new naming)
  app.get('/sponsorship/confirm', (req, res) => {
    console.log('Sponsorship confirmation redirect received at /sponsorship/confirm:', req.query);
    // Forward to the subscriptions API endpoint
    res.redirect(`/api/subscriptions/confirm${req.url.substring(req.path.length)}`);
  });
  
  // Setup memberships utility for creating membership products (admin only)
  app.use('/api/setup-memberships', setupMembershipsRouter);
  
  // Membership processing tools for admins
  app.use('/api/membership-processing', membershipProcessingRouter);
  
  // Admin manual upgrade tools for manually upgrading users to paid status
  app.use('/api/admin', adminManualUpgradeRouter);
  
  // User search endpoints (admin only)
  const { default: usersSearchRouter } = await import('./routes/users-search');
  app.use('/api/users', usersSearchRouter);
  
  // Chat system endpoints (new WebSocket-based implementation)
  app.use('/api/chat', chatRouter);
  
  // Development-only endpoint to access the last generated password reset link
  // This is useful when email delivery is unreliable in development
  app.get("/api/dev/last-reset-link", (req, res) => {
    // Only available in development mode
    if (process.env.NODE_ENV !== 'production') {
      if (global.lastPasswordResetLink) {
        return res.json({
          message: "Last password reset link information",
          data: global.lastPasswordResetLink,
          resetUrl: `${req.protocol}://${req.get('host')}/reset-password?token=${global.lastPasswordResetLink.token}&email=${encodeURIComponent(global.lastPasswordResetLink.email)}`
        });
      } else {
        return res.status(404).json({ message: "No password reset link has been generated yet" });
      }
    } else {
      return res.status(403).json({ message: "This endpoint is not available in production" });
    }
  });
  
  // Development-only endpoint to access the last sent email preview URLs
  app.get("/api/dev/email-previews", (req, res) => {
    // Only available in development mode
    if (process.env.NODE_ENV !== 'production') {
      if (global.lastEmailPreviewUrl && global.lastEmailPreviewUrl.length > 0) {
        return res.json({
          message: "Last email preview URLs",
          emailPreviews: global.lastEmailPreviewUrl
        });
      } else {
        return res.status(404).json({ message: "No email previews are available" });
      }
    } else {
      return res.status(403).json({ message: "This endpoint is not available in production" });
    }
  });
  
  // Feature Flags API Routes
  
  // Get all feature flags (for authorized users)
  app.get("/api/feature-flags", async (req, res) => {
    try {
      // Get all feature flags
      const flags = await storage.getFeatureFlags();
      
      // If no user is authenticated, return all active flags
      // This allows public pages to respect feature flags without requiring authentication
      if (!req.isAuthenticated()) {
        return res.json(flags);
      }
      
      // If the user is an admin, return all flags (active and inactive)
      // Otherwise, return only flags relevant to the user's role
      const userRole = req.user?.role || '';
      if (userRole === 'admin') {
        return res.json(flags);
      } else {
        // Filter flags that apply to the user's role
        const relevantFlags = flags.filter((flag: FeatureFlag) => 
          flag.enabledForRoles.includes(userRole.toLowerCase() as "registered" | "paid" | "admin")
        );
        return res.json(relevantFlags);
      }
    } catch (error) {
      console.error("Error fetching feature flags:", error);
      return res.status(500).json({ message: "Failed to fetch feature flags" });
    }
  });
  
  // Create a new feature flag (admin only)
  app.post("/api/feature-flags", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertFeatureFlagSchema.parse(req.body);
      const newFlag = await storage.createFeatureFlag(validatedData);
      return res.status(201).json(newFlag);
    } catch (error: any) {
      console.error("Error creating feature flag:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid feature flag data", errors: error.errors });
      }
      return res.status(500).json({ message: "Failed to create feature flag" });
    }
  });
  
  // Update an existing feature flag (admin only)
  app.patch("/api/feature-flags/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid feature flag ID" });
      }
      
      const existingFlag = await storage.getFeatureFlag(id);
      if (!existingFlag) {
        return res.status(404).json({ message: "Feature flag not found" });
      }
      
      const updatedFlag = await storage.updateFeatureFlag(id, req.body);
      return res.json(updatedFlag);
    } catch (error: any) {
      console.error("Error updating feature flag:", error);
      return res.status(500).json({ message: "Failed to update feature flag" });
    }
  });
  
  // Get feature flags for admin view (admin only)
  app.get("/api/feature-flags/admin", requireAdmin, async (req, res) => {
    try {
      // Get all feature flags for admin dashboard
      const flags = await storage.getFeatureFlags();
      return res.json(flags);
    } catch (error) {
      console.error("Error fetching feature flags for admin:", error);
      return res.status(500).json({ message: "Failed to fetch feature flags" });
    }
  });
  
  // Bulk update feature flags (admin only)
  app.put("/api/feature-flags", requireAdmin, async (req, res) => {
    try {
      const { flags } = req.body;
      
      if (!Array.isArray(flags)) {
        return res.status(400).json({ message: "Invalid data format. Expected an array of flags." });
      }
      
      const updatedFlags = [];
      
      // Update each flag in the array
      for (const flag of flags) {
        if (!flag.id) continue;
        
        const updatedFlag = await storage.updateFeatureFlag(flag.id, {
          enabledForRoles: flag.enabledForRoles,
          isActive: flag.isActive
        });
        
        updatedFlags.push(updatedFlag);
      }
      
      return res.json({ 
        success: true, 
        message: `Successfully updated ${updatedFlags.length} feature flags`,
        flags: updatedFlags
      });
    } catch (error) {
      console.error("Error updating feature flags:", error);
      return res.status(500).json({ message: "Failed to update feature flags" });
    }
  });

  // Delete a feature flag (admin only)
  app.delete("/api/feature-flags/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid feature flag ID" });
      }
      
      const existingFlag = await storage.getFeatureFlag(id);
      if (!existingFlag) {
        return res.status(404).json({ message: "Feature flag not found" });
      }
      
      await storage.deleteFeatureFlag(id);
      return res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting feature flag:", error);
      return res.status(500).json({ message: "Failed to delete feature flag" });
    }
  });
  
  // Initialize default feature flags if needed (admin only)
  app.post("/api/feature-flags/initialize", requireAdmin, async (req, res) => {
    try {
      const flags = await storage.initializeDefaultFeatureFlags();
      return res.status(201).json(flags);
    } catch (error: any) {
      console.error("Error initializing default feature flags:", error);
      return res.status(500).json({ message: "Failed to initialize default feature flags" });
    }
  });
  
  // Endpoint to create the weather_rocket_icons feature flag specifically
  app.post("/api/feature-flags/create-weather-rocket", requireAdmin, async (req, res) => {
    try {
      console.log("Creating weather_rocket_icons feature flag");
      
      // Check if the flag already exists
      const existingFlag = await storage.getFeatureFlagByName(FeatureFlagName.WEATHER_ROCKET_ICONS);
      if (existingFlag) {
        console.log("Weather & Rocket Icons feature flag already exists:", existingFlag);
        return res.status(200).json(existingFlag);
      }
      
      // Create the new feature flag with all roles enabled by default
      const newFlag = {
        name: FeatureFlagName.WEATHER_ROCKET_ICONS,
        displayName: 'Weather & Rocket Icons',
        enabledForRoles: [
          UserRole.GUEST,
          UserRole.REGISTERED,
          UserRole.BADGE_HOLDER,
          UserRole.PAID,
          UserRole.MODERATOR,
          UserRole.ADMIN
        ],
        description: 'Show weather temperature and rocket icon in the navigation bar',
        isActive: true
      };
      
      const result = await storage.createFeatureFlag(newFlag);
      console.log("Weather & Rocket Icons feature flag created successfully:", result);
      return res.status(201).json(result);
    } catch (error: any) {
      console.error("Error creating weather_rocket_icons feature flag:", error);
      return res.status(500).json({ message: "Failed to create weather_rocket_icons feature flag" });
    }
  });
  
  // Update a specific role permission for a feature flag (admin only)
  app.patch("/api/feature-flags/:id/role/:role", requireAdmin, async (req, res) => {
    try {
      const flagId = req.params.id;
      const roleName = req.params.role;
      const { enabled } = req.body;
      
      console.log(`Updating permission for flag: ${flagId}, role: ${roleName}, enabled: ${enabled}`);
      
      // List of permission controls - make sure to match the IDs in the client
      const permissionControls = [
        { name: "comments", displayName: "Comments", description: "Allow commenting throughout the site (forum, calendar, etc.)" },
        { name: "reactions", displayName: "Like/Going/Interested", description: "Allow clicking reaction buttons throughout the site" },
        { name: "calendar_post", displayName: "Post Event on Calendar", description: "Allow creating new calendar events" },
        { name: "forum_post", displayName: "Create Forum Topic", description: "Allow creating new forum topics" },
        { name: "for_sale_post", displayName: "Create On The Market Listing", description: "Allow posting items for sale" },
        { name: "vendor_page", displayName: "Create Vendor/Community Page", description: "Allow creating vendor or community pages" },
        { name: "admin_access", displayName: "Access Admin Dashboard", description: "Allow access to the admin dashboard" },
        { name: "admin_forum", displayName: "Access Admin-only Forums", description: "Allow access to admin-only forum categories" },
      ];
      
      // List of navigation items - match the IDs in the client
      const navigationItems = [
        { name: "nav-forum", displayName: "Forum", description: "Access to community forum" },
        { name: "nav-store", displayName: "Store", description: "Access to community store" },
        { name: "nav-calendar", displayName: "Calendar", description: "Access to community calendar features" },
        { name: "nav-community", displayName: "Community", description: "Access to community information pages" },
        { name: "nav-for-sale", displayName: "On The Market", description: "Access to marketplace listings" },
        { name: "nav-vendors", displayName: "Vendors", description: "Access to preferred vendors" }
      ];
      
      // Get the current flag data
      let existingFlag = await storage.getFeatureFlagByName(flagId);
      
      // If flag doesn't exist, create it first
      if (!existingFlag) {
        // Check if it's a permission control
        const permissionControl = permissionControls.find(control => control.name === flagId);
        // Check if it's a navigation item
        const navigationItem = navigationItems.find(item => item.name === flagId);
        
        // If it's either a permission control or navigation item, we can create it
        if (permissionControl || navigationItem) {
          const control = permissionControl || navigationItem;
          console.log(`Creating new feature flag: ${flagId}`);
          
          // Setup default roles - all features enabled for admin
          let defaultRoles = ['admin', 'moderator', 'paid', 'badge_holder', 'registered'];
          
          // For navigation items, make almost everything available by default (except guest for some)
          if (navigationItem) {
            // For navigation items, most are available to all users including guests
            defaultRoles.push('guest');
          }
          // For permission controls, set more restrictive defaults
          else if (permissionControl) {
            // Reset to just admin, then add others as needed
            defaultRoles = ['admin'];
            
            // Set reasonable defaults based on permission type
            if (flagId === 'comments' || flagId === 'reactions') {
              defaultRoles.push('badge_holder', 'paid', 'moderator');
            } else if (flagId === 'for_sale_post') {
              defaultRoles.push('registered', 'badge_holder', 'paid', 'moderator'); 
            } else if (flagId === 'calendar_post' || flagId === 'forum_post') {
              defaultRoles.push('paid', 'moderator');
            } else if (flagId === 'admin_access' || flagId === 'admin_forum') {
              // Only for admin and moderator
              defaultRoles.push('moderator');
            }
          }
          
          // Create the feature flag
          const newFlag = await storage.createFeatureFlag({
            name: control.name,
            displayName: control.displayName,
            description: control.description,
            enabledForRoles: defaultRoles,
            isActive: true
          });
          
          existingFlag = newFlag;
          console.log(`Created new feature flag: ${existingFlag.name}`);
        } else {
          return res.status(404).json({ message: `Feature flag '${flagId}' not found` });
        }
      }
      
      // Get the current role permissions
      const currentRoles = existingFlag.enabledForRoles || [];
      
      // Update the role permissions based on the enabled flag
      let updatedRoles = [...currentRoles];
      if (enabled === true) {
        // Add the role if it's not already in the array
        if (!updatedRoles.includes(roleName)) {
          updatedRoles.push(roleName);
        }
      } else {
        // Remove the role if it exists in the array
        updatedRoles = updatedRoles.filter(role => role !== roleName);
      }
      
      // Update the flag with the new role permissions
      const updatedFlag = await storage.updateFeatureFlag(existingFlag.id, {
        enabledForRoles: updatedRoles
      });
      
      return res.json({
        success: true,
        message: `Successfully updated '${roleName}' permission for feature flag '${flagId}'`,
        flag: updatedFlag
      });
    } catch (error: any) {
      console.error(`Error updating role permission for feature flag:`, error);
      return res.status(500).json({ message: "Failed to update feature flag role permission" });
    }
  });

  // Password Update Route
  app.post("/api/user/password", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { currentPassword, newPassword } = req.body;

    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const isValid = await comparePasswords(currentPassword, user.password);
      if (!isValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      // Hash and update new password
      const hashedPassword = await hashPassword(newPassword);
      const updatedUser = await storage.updateUser(req.user.id, {
        password: hashedPassword,
        updatedAt: new Date()
      });

      if (!updatedUser) {
        throw new Error("Failed to update password");
      }

      res.json({ success: true, message: "Password updated successfully" });
    } catch (err) {
      console.error("Error updating password:", err);
      res.status(500).json({ message: "Failed to update password" });
    }
  });

  // User Profile Update Route (updated to handle role changes)
  app.patch("/api/user", async (req, res) => {
    console.log("****** PROFILE UPDATE ROUTE CALLED ******");
    
    if (!req.isAuthenticated()) {
      console.log("User not authenticated");
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      console.log("Update profile request:", {
        body: req.body,
        userId: req.user.id,
        currentUser: req.user,
        session: req.session,
        isAuthenticated: req.isAuthenticated()
      });

      // Ensure required fields
      if (!req.body.fullName) {
        console.log("Missing required field: fullName");
        return res.status(400).json({
          success: false,
          message: "Full name is required"
        });
      }

      // Check if role update is attempted and if user is admin
      if (req.body.role && req.user.role !== 'admin') {
        console.log("Non-admin attempting to update role");
        return res.status(403).json({
          success: false,
          message: "Only administrators can update user roles"
        });
      }

      // Check if username update is attempted and if user is admin
      if (req.body.username && req.body.username !== req.user.username && req.user.role !== 'admin') {
        console.log("Non-admin attempting to update username");
        return res.status(403).json({
          success: false,
          message: "Only administrators can update usernames"
        });
      }

      const updateData = {
        fullName: req.body.fullName,
        username: req.body.username || req.user.username,
        email: req.body.email || req.user.email,
        phoneNumber: req.body.phoneNumber !== undefined ? req.body.phoneNumber : req.user.phoneNumber,
        isResident: req.body.isResident === true,
        role: req.body.role || req.user.role,
        updatedAt: new Date(),
        residentTags: Array.isArray(req.body.residentTags) ? req.body.residentTags : req.user.residentTags || [],
        clubMemberships: Array.isArray(req.body.clubMemberships) ? req.body.clubMemberships : req.user.clubMemberships || []
      };

      console.log("Attempting to update user with data:", updateData);
      console.log("Current user ID:", req.user.id, "Type:", typeof req.user.id);
      
      try {
        const updatedUser = await storage.updateUser(req.user.id, updateData);

        if (!updatedUser) {
          console.error("Update failed - no user returned");
          return res.status(404).json({
            success: false,
            message: "User not found"
          });
        }
        
        console.log("User updated successfully:", updatedUser);

        // Update session with new user data
        req.user = updatedUser;

        // Force session save
        await new Promise<void>((resolve, reject) => {
          req.session.save((err) => {
            if (err) {
              console.error("Session save error:", err);
              reject(err);
            } else {
              console.log("Session saved successfully with updated user:", updatedUser);
              resolve();
            }
          });
        });
        
        // Send response after successful update
        return res.json({
          success: true,
          message: "Profile updated successfully",
          user: updatedUser
        });
        
      } catch (updateError) {
        console.error("Error in storage.updateUser:", updateError);
        return res.status(500).json({
          success: false,
          message: "Database error when updating user"
        });
      }
    } catch (err) {
      console.error("Error updating user profile:", err);
      res.status(500).json({
        success: false,
        message: "Failed to update user profile"
      });
    }
  });

  // Test endpoint to verify route registration
  app.get("/api/user/delete-account-test", (req, res) => {
    console.log("Delete account test endpoint reached");
    res.json({ message: "Delete endpoint route is registered", authenticated: req.isAuthenticated() });
  });


  // User Avatar Upload - using generic processUploadedFile function with Object Storage backup
  app.post("/api/upload/avatar", upload.single('avatar'), async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Set the media type explicitly for avatar uploads
      req.mediaType = 'avatars';
      
      // Use our generic file processing function to handle uploads and copying to production paths
      const result = processUploadedFile(req, req.file);
      
      if (!result.success) {
        console.error("Avatar upload failed:", result.message);
        return res.status(400).json({ 
          success: false,
          message: result.message 
        });
      }
      
      console.log(`Avatar uploaded and processed successfully: ${result.url}`);

      // CREATE PRIMARY COPY IN OBJECT STORAGE (AVATARS bucket)
      // We require this upload to succeed AND be verifiable before updating the
      // user's avatar_url. Previously the route would happily write a
      // /api/storage-proxy/direct-avatars/<filename> URL into the DB even when
      // the underlying object-storage upload silently failed and returned a
      // fallback URL — leaving the user's avatar pointing at a file that does
      // not exist (see task #103).
      let objectStorageUrl: string | null = null;

      try {
        console.log(`[Avatar Upload] Creating Object Storage copy for user ${req.user.id} in dedicated AVATARS bucket`);

        // Use the file buffer directly from Multer (in-memory storage)
        if (req.file.buffer) {
          console.log(`[Avatar Upload] Uploading to AVATARS bucket with filename: ${req.file.filename}`);

          objectStorageUrl = await objectStorageService.uploadData(
            req.file.buffer,
            'avatar',
            req.file.filename,
            req.file.mimetype,
            'AVATARS'
          );
        } else {
          console.warn(`[Avatar Upload] No file buffer available, trying file path method`);
          const uploadedFilePath = req.file.path;
          if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
            objectStorageUrl = await objectStorageService.uploadFile(
              uploadedFilePath,
              '',
              req.file.filename,
              'AVATARS'
            );
          } else {
            console.warn(`[Avatar Upload] Source file not found at ${uploadedFilePath}, Object Storage upload failed`);
          }
        }
      } catch (uploadError) {
        console.error(`[Avatar Upload] Failed to upload to Object Storage:`, uploadError);
        objectStorageUrl = null;
      }

      // uploadData / uploadFile throw ObjectStorageUploadError on failure
      // (the try/catch above turns that into objectStorageUrl=null). A
      // successful return is always a real AVATARS-bucket URL, so the only
      // thing left to guard against here is the null case.
      if (!objectStorageUrl) {
        console.error(`[Avatar Upload] Object Storage upload failed; refusing to update user record.`);
        return res.status(502).json({
          success: false,
          message: "Failed to persist avatar to object storage. Please try again."
        });
      }

      // Post-upload verification: confirm the file actually exists in the
      // bucket before we point the user record at it.
      let avatarExists = false;
      try {
        avatarExists = await objectStorageService.fileExists(req.file.filename, 'AVATARS');
      } catch (verifyError) {
        console.error(`[Avatar Upload] Error verifying uploaded avatar:`, verifyError);
        avatarExists = false;
      }

      if (!avatarExists) {
        console.error(`[Avatar Upload] Verification failed: ${req.file.filename} not found in AVATARS bucket after upload; refusing to update user record.`);
        return res.status(502).json({
          success: false,
          message: "Uploaded avatar could not be verified in object storage. Please try again."
        });
      }

      // Verified — use the Object Storage proxy URL as the primary avatar URL.
      // Run it through the canonicalizer so this code path can never drift
      // from the single source of truth for avatar URL shape.
      const finalAvatarUrl = canonicalizeAvatarUrl(
        `/api/storage-proxy/direct-avatars/${req.file.filename}`
      )!;
      console.log(`[Avatar Upload] Verified ${req.file.filename} in AVATARS bucket. Using proxy URL: ${finalAvatarUrl}`);

      // Update user's avatar URL in the database - USE OBJECT STORAGE URL AS PRIMARY
      const updatedUser = await storage.updateUser(req.user.id, {
        avatarUrl: finalAvatarUrl, // Use Object Storage proxy URL (persists through deployments)
        updatedAt: new Date()
      });

      if (!updatedUser) {
        throw new Error("Failed to update user");
      }

      // Update session with new user data
      req.user = updatedUser;

      // Force session save
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      res.json({
        success: true,
        message: "Profile photo updated successfully",
        url: finalAvatarUrl, // PRIMARY: Object Storage proxy URL (persists through deployments)
        backupUrl: result.url, // Backup filesystem URL
        objectStorageUrl, // Direct Object Storage URL from AVATARS bucket
        user: updatedUser
      });
    } catch (err) {
      console.error("Error uploading avatar:", err);
      res.status(500).json({
        success: false,
        message: "Failed to upload avatar"
      });
    }
  });


  // Real estate media upload endpoint using Object Storage exclusively
  app.post("/api/upload/real-estate-media", handleRealEstateUpload, async (req, res) => {
    // Import the object storage utilities
    const objectStorage = await import('./object-storage');
    
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const files = req.files as Express.Multer.File[];
      
      // Always use real-estate-media type for this endpoint
      req.mediaType = MEDIA_TYPES.REAL_ESTATE_MEDIA;
      
      console.log(`Processing ${files.length} real estate media files using Object Storage exclusively`);
      
      // Process the uploaded files and upload directly to Object Storage
      const mediaUrls = await Promise.all(
        files.map(async (file) => {
          try {
            // Generate a unique filename with timestamp
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const extension = path.extname(file.originalname);
            const filename = uniqueSuffix + extension;
            
            // Upload directly to Object Storage from memory buffer
            const buffer = file.buffer;
            if (!buffer) {
              throw new Error("File buffer is undefined");
            }
            
            // Upload to Object Storage exclusively
            const storageKey = await objectStorage.uploadRealEstateMediaFromBuffer(
              buffer,
              filename
            );
            
            console.log(`Uploaded real estate media to Object Storage: ${storageKey}`);
            
            // We use Object Storage exclusively, no filesystem copies are created
            return storageKey;
          } catch (error) {
            console.error("Error processing upload:", error);
            throw error;
          }
        })
      );
      
      console.log(`Successfully uploaded ${mediaUrls.length} real estate media files to Object Storage exclusively`);
      res.json({ mediaUrls });
    } catch (error) {
      console.error("Error uploading real estate media:", error);
      res.status(500).json({ 
        message: "Error uploading files", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * General media upload endpoint with section-aware routing
   * This is the new primary endpoint for all uploads, supporting multi-bucket storage
   * Uses Object Storage exclusively instead of filesystem
   */
  app.post('/api/upload', 
    // Authentication middleware
    (req: Request, res: Response, next: NextFunction) => {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }
      next();
    },
    // First use multer to capture the uploaded file
    // Using disk storage for large files to prevent memory issues
    multer({ 
      storage: multer.diskStorage({
        destination: function (req, file, cb) {
          const tmpdir = path.join(os.tmpdir(), 'uploads');
          fs.mkdirSync(tmpdir, { recursive: true });
          cb(null, tmpdir);
        },
        filename: function (req, file, cb) {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          cb(null, 'upload-' + uniqueSuffix + path.extname(file.originalname));
        }
      }),
      limits: {
        fileSize: 350 * 1024 * 1024 // 350MB limit for videos
      }
    }).single('file'),
    // Then determine media type/section (must come after multer)
    (req: Request, res: Response, next: NextFunction) => {
      // Get section from request body or query parameter
      // Log the request details to debug the form data
      console.log('[Upload] Request body:', req.body);
      console.log('[Upload] Request query:', req.query);
      
      let section = 'content';
      
      // Look for section parameter from body first
      if (req.body && req.body.section) {
        section = req.body.section.toLowerCase();
      } 
      // Then try query parameter
      else if (req.query && req.query.section) {
        section = (req.query.section as string).toLowerCase();
      }
      // If we're in the forum module, set section to forum
      else if (req.headers.referer && req.headers.referer.includes('/forum')) {
        section = 'forum';
      }
      
      console.log(`[Upload] Processing file for section: ${section}`);
      
      // Map section to standardized media type for bucket organization
      let mediaType = 'general';
      
      if (section === 'forum') {
        mediaType = 'forum';
        console.log(`[Upload] Detected forum upload, using FORUM bucket`);
      } else if (section === 'calendar' || section === 'events') {
        mediaType = 'calendar';
        console.log(`[Upload] Detected calendar/events upload, using CALENDAR bucket`);
      } else if (section === 'vendors') {
        mediaType = 'vendor';
      } else if (section === 'community') {
        mediaType = 'community';
      } else if (section === 'real-estate') {
        mediaType = 'real-estate';
      } else if (section === 'avatar' || section === 'profile') {
        mediaType = 'avatar';
      } else if (section === 'banner' || section === 'banner-slides') {
        mediaType = 'banner';
      }
      
      // Store the media type for later use
      (req as any).mediaType = mediaType;
      next();
    },
    // Handle the Object Storage upload with our custom function
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.file) {
          return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        
        // Get the media type from the request
        const mediaType = (req as any).mediaType || 'general';
        
        // Process file details
        const { path: filePath, originalname, mimetype } = req.file;
        
        console.log(`[Upload] CRITICAL DEBUG: Processing upload for forum with mediaType=${mediaType}`);
        console.log(`[Upload] CRITICAL DEBUG: File details: originalname=${originalname}, mimetype=${mimetype}, path=${filePath}`);
        
        // For large files like videos, use uploadFile instead of uploadBuffer
        // to avoid loading the entire file into memory
        const uploadResult = await unifiedStorageService.uploadFile(
          filePath,
          mediaType,
          {
            contentType: mimetype,
            generateUniqueName: true
          }
        );
        
        // Enhanced logging for debugging
        console.log(`[Upload] CRITICAL DEBUG: Upload Result:
          - Success: ${uploadResult.success}
          - URL: ${uploadResult.url || 'N/A'}
          - DirectURL: ${uploadResult.directUrl || 'N/A'}
          - Key: ${uploadResult.key || 'N/A'}
          - Bucket: ${uploadResult.bucket || 'N/A'}
          - Error: ${uploadResult.error || 'None'}
        `);
        
        // Store result in request for later middleware/handlers
        req.objectStorageResult = uploadResult;
        
        if (!uploadResult.success) {
          return res.status(uploadResult.statusCode || 500).json({
            success: false,
            message: `File upload failed: ${uploadResult.error}`
          });
        }
        
        // Verify the file was actually uploaded by checking if it exists
        if (uploadResult.success && uploadResult.key && uploadResult.bucket) {
          try {
            console.log(`[Upload] Verifying upload by checking if file exists: ${uploadResult.bucket}/${uploadResult.key}`);
            const fileExists = await objectStorageService.checkFileExists(uploadResult.key, uploadResult.bucket);
            console.log(`[Upload] File exists check result: ${fileExists}`);
            
            if (!fileExists) {
              console.error(`[Upload] WARNING: File reported as successfully uploaded but cannot be found in Object Storage`);
            }
          } catch (verifyError) {
            console.error(`[Upload] Error verifying file exists:`, verifyError);
            // Don't fail the request just because verification failed
          }
        }
        
        next();
      } catch (error) {
        console.error('[Upload] Error handling upload:', error);
        return res.status(500).json({
          success: false,
          message: 'Internal server error during file upload'
        });
      }
    },
    // Final handler after successful upload
    (req: Request, res: Response) => {
      // If no upload result is available, something went wrong
      if (!req.objectStorageResult) {
        return res.status(500).json({ 
          success: false, 
          message: 'Upload failed - no storage result available' 
        });
      }
      
      // Return success response with the URL
      return res.status(200).json({
        success: true,
        url: req.objectStorageResult.url,
        message: 'File uploaded to Object Storage successfully',
        section: (req as any).mediaType,
        bucket: req.objectStorageResult.bucket
      });
    }
  );

  /**
   * Legacy upload URL support - now uses Object Storage directly
   */
  app.post("/api/content/upload-media", 
    // Authentication check
    (req: Request, res: Response, next: NextFunction) => {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      next();
    },
    // Use multer for disk storage to handle large files
    multer({ 
      storage: multer.diskStorage({
        destination: (req, file, cb) => {
          cb(null, './tmp')
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          cb(null, 'legacy-upload-' + uniqueSuffix + path.extname(file.originalname));
        }
      }),
      limits: {
        fileSize: 350 * 1024 * 1024 // 350MB limit for videos
      }
    }).single('mediaFile'),
    // Custom middleware to upload to Object Storage
    async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }
        
        // Legacy endpoint always uses content media
        const mediaType = 'general';
        console.log('[LegacyUpload] Content media upload requested - using Object Storage');
        
        // Get file details from multer
        const { path: filePath, originalname, mimetype } = req.file;
        
        // For large files like videos, use uploadFile instead of uploadBuffer
        // to avoid loading the entire file into memory
        const uploadResult = await unifiedStorageService.uploadFile(
          filePath,
          mediaType,
          {
            contentType: mimetype,
            generateUniqueName: true
          }
        );
        
        if (!uploadResult.success) {
          console.error(`[LegacyUpload] Upload failed: ${uploadResult.error}`);
          return res.status(uploadResult.statusCode || 500).json({
            success: false,
            message: `File upload failed: ${uploadResult.error}`
          });
        }
        
        // Return the URL in the expected format
        return res.json({
          success: true,
          message: "File uploaded to Object Storage successfully",
          url: uploadResult.url
        });
      } catch (error) {
        console.error("[LegacyUpload] Error in content upload:", error);
        return res.status(500).json({ 
          success: false,
          message: "Error uploading file", 
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }
  );

  // Add media upload endpoint to handle multiple files - using generic processUploadedFile function
  app.post("/api/upload/media", upload.array('media'), mediaSyncMiddleware, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const files = req.files as Express.Multer.File[];
      
      // Determine the appropriate media type based on the request
      // This will be used for all files in this batch upload
      let mediaType = '';
      
      // Check if this is for an event (based on request referer or query param)
      const isEventUpload = req.query.type === 'event' || 
                           (req.headers.referer && req.headers.referer.includes('/events/'));
      
      // Check for specific upload types based on query params or headers
      const uploadType = req.query.type as string || '';
      const referer = req.headers.referer as string || '';
      
      // If this is an event upload, handle it with our special calendar handler
      if (isEventUpload || uploadType === 'event' || referer.includes('/events/')) {
        console.log('[MediaUpload] Event media detected, using specialized handler');
        req.mediaType = 'calendar';
        
        // Since we can't easily intercept this route during array upload,
        // we'll process each file manually through our calendar handler
        const files = req.files as Express.Multer.File[];
        
        // Process all files using our specialized calendar handler
        const successfulUploads = [];
        const failedUploads = [];
        
        for (const file of files) {
          try {
            // Create a mock request with this single file for our handler
            const singleFileReq = {...req, file: file} as any;
            
            // Call our calendar handler directly
            await handleCalendarMediaUpload(singleFileReq, res, () => {});
            
            // If we have an object storage URL, consider it successful
            if (singleFileReq.objectStorageUrl) {
              console.log(`[MediaUpload] Successfully processed event file with Object Storage: ${singleFileReq.objectStorageUrl}`);
              successfulUploads.push({
                success: true,
                url: singleFileReq.objectStorageUrl,
                originalname: file.originalname,
                mimetype: file.mimetype,
                size: file.size
              });
            } else {
              console.error(`[MediaUpload] Error processing event file ${file.originalname}: No Object Storage URL returned`);
              failedUploads.push({
                success: false,
                message: "No Object Storage URL returned",
                originalname: file.originalname
              });
            }
          } catch (error) {
            console.error(`[MediaUpload] Exception processing event file ${file.originalname}:`, error);
            failedUploads.push({
              success: false,
              message: error instanceof Error ? error.message : String(error),
              originalname: file.originalname
            });
          }
        }
        
        // Extract the URLs from successful uploads
        const urls = successfulUploads.map(r => r.url);
        
        console.log(`[MediaUpload] Event media upload complete. Successfully processed ${successfulUploads.length} of ${files.length} files`);
        console.log(`[MediaUpload] URLs returned to client: ${urls.join(', ')}`);
        
        return res.json({
          success: true,
          urls: urls,
          details: [...successfulUploads, ...failedUploads],
          message: `Files uploaded successfully (${successfulUploads.length} of ${files.length})`
        });
      } else if (uploadType === 'banner' || referer.includes('/banner-slides')) {
        console.log('Banner slide detected');
        mediaType = 'banner-slides';
      } else if (uploadType === 'forum' || referer.includes('/forum')) {
        console.log('Forum media detected');
        mediaType = 'forum-media';
      } else if (uploadType === 'vendor' || referer.includes('/vendors')) {
        console.log('Vendor media detected');
        mediaType = 'vendor-media';
      } else if (uploadType === 'community' || referer.includes('/community')) {
        console.log('Community media detected');
        mediaType = 'community-media';
      } else if (uploadType === 'real-estate' || referer.includes('/real-estate') || referer.includes('/for-sale')) {
        console.log('Real estate media detected');
        mediaType = 'real-estate-media';
      } else {
        // Default to content-media if no specific type is detected
        console.log('No specific media type detected, using content-media');
        mediaType = 'content-media';
      }
      
      // Set the media type on the request for our processing function
      req.mediaType = mediaType;
      
      // Process each file using our utility function
      const results = [];
      
      for (const file of files) {
        try {
          const result = await processUploadedFile(req, file);
          
          if (result.success) {
            console.log(`File processed successfully: ${result.url}`);
            results.push({
              success: true,
              url: result.url,
              developmentUrl: result.developmentUrl,
              filename: file.filename,
              originalname: file.originalname,
              mimetype: file.mimetype,
              size: file.size
            });
          } else {
            console.error(`Error processing file ${file.originalname}: ${result.message}`);
            results.push({
              success: false,
              message: result.message,
              filename: file.filename,
              originalname: file.originalname
            });
          }
        } catch (error) {
          console.error(`Exception processing file ${file.originalname}:`, error);
          results.push({
            success: false,
            message: error instanceof Error ? error.message : String(error),
            filename: file.filename,
            originalname: file.originalname
          });
        }
      }
      
      // Check if any files were successfully processed
      const successfulUploads = results.filter(r => r.success);
      if (successfulUploads.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No files were successfully processed",
          details: results
        });
      }
      
      // Extract the URLs from successful uploads
      const urls = successfulUploads.map(r => r.url);
      
      console.log(`Media upload complete. Successfully processed ${successfulUploads.length} of ${files.length} files`);
      console.log(`URLs returned to client: ${urls.join(', ')}`);

      res.json({
        success: true,
        urls: urls,
        details: results,
        message: `Files uploaded successfully (${successfulUploads.length} of ${files.length})`
      });
    } catch (err) {
      console.error("Error uploading media:", err);
      res.status(500).json({
        success: false,
        message: "Failed to upload media"
      });
    }
  });

  // Get all users (admin only)
  // Get users for messaging (available to all authenticated users)
  app.get("/api/messages/users", async (req, res) => {
    console.log(`GET /api/messages/users - Auth debug:`, {
      isAuthenticated: req.isAuthenticated(),
      userExists: !!req.user,
      userRole: req.user?.role,
      sessionID: req.sessionID
    });
    
    if (!req.isAuthenticated()) {
      console.log("GET /api/messages/users - Authentication check failed");
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      // Get all users but only return the necessary fields for messaging
      const allUsers = await storage.getUsers();
      // Add debug output for the first user to understand the structure
      if (allUsers.length > 0) {
        const userSample = allUsers[0];
        console.log("DEBUG User object structure sample:", {
          id: userSample.id,
          username: userSample.username,
          // Log both possible field naming conventions
          fullName: userSample.fullName, 
          full_name: (userSample as any).full_name,
          // Log role which is critical for UI
          role: userSample.role,
          // Log both possible avatar field naming conventions
          avatarUrl: userSample.avatarUrl,
          avatar_url: (userSample as any).avatar_url
        });
      }
      
      // Transform users safely, checking all possible property name formats
      const messagingUsers = allUsers.map(user => ({
        id: user.id,
        username: user.username,
        // Use the camelCase version which is returned by Drizzle ORM
        fullName: user.fullName || (user as any).full_name || user.username,
        role: user.role,
        avatarUrl: user.avatarUrl || (user as any).avatar_url
      }));
      
      console.log(`GET /api/messages/users - Successfully fetched ${messagingUsers.length} users for messaging`);
      res.json({ 
        success: true,
        data: messagingUsers
      });
    } catch (err) {
      console.error("Error fetching users for messaging:", err);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch users", 
        details: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // Note: GET /api/users is now handled by users-search router
  
  // Export all users as CSV (admin only)
  app.get("/api/users/export", async (req, res) => {
    console.log("GET /api/users/export - Exporting users as CSV");
    
    if (!req.isAuthenticated()) {
      console.log("GET /api/users/export - Authentication check failed");
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (req.user.role !== 'admin') {
      console.log(`GET /api/users/export - Admin check failed: User role is ${req.user.role}`);
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      // Import stringify from csv-stringify
      const { stringify } = await import('csv-stringify/sync');
      
      // Get all users
      const users = await storage.getUsers();
      console.log(`GET /api/users/export - Exporting ${users.length} users`);
      
      // Define the columns to include in the export
      const columns = [
        { key: 'id', header: 'ID' },
        { key: 'username', header: 'Username' },
        { key: 'email', header: 'Email' },
        { key: 'fullName', header: 'Full Name' },
        { key: 'role', header: 'Role' },
        { key: 'isApproved', header: 'Approved' },
        { key: 'isResident', header: 'Resident' },
        { key: 'isBlocked', header: 'Blocked' },
        { key: 'blockReason', header: 'Block Reason' },
        { key: 'isLocalResident', header: 'Local Resident' },
        { key: 'ownsHomeInBB', header: 'Owns Home' },
        { key: 'isFullTimeResident', header: 'Full Time Resident' },
        { key: 'isSnowbird', header: 'Snowbird' },
        { key: 'hasMembershipBadge', header: 'Has Badge' },
        { key: 'membershipBadgeNumber', header: 'Badge Number' },
        { key: 'hasLivedInBB', header: 'Has Lived In BB' },
        { key: 'consideringMovingToBB', header: 'Considering Moving' },
        { key: 'createdAt', header: 'Created At' },
        { key: 'updatedAt', header: 'Updated At' }
      ];
      
      // Format dates and boolean values for better readability
      const formattedUsers = users.map(user => {
        // Create a new object to avoid modifying the original user
        const formattedUser = { ...user };
        
        // Format dates to be more readable in CSV
        if (formattedUser.createdAt) {
          formattedUser.createdAt = new Date(formattedUser.createdAt).toISOString().split('T')[0];
        }
        if (formattedUser.updatedAt) {
          formattedUser.updatedAt = new Date(formattedUser.updatedAt).toISOString().split('T')[0];
        }
        
        // Format boolean values as 'Yes' or 'No'
        ['isApproved', 'isResident', 'isBlocked', 'isLocalResident', 'ownsHomeInBB', 
         'isFullTimeResident', 'isSnowbird', 'hasMembershipBadge', 'hasLivedInBB', 
         'consideringMovingToBB'].forEach(key => {
          if (key in formattedUser) {
            formattedUser[key] = formattedUser[key] ? 'Yes' : 'No';
          }
        });
        
        // Format array values as comma-separated strings
        if (formattedUser.residentTags && Array.isArray(formattedUser.residentTags)) {
          formattedUser.residentTags = formattedUser.residentTags.join(', ');
        }
        
        return formattedUser;
      });
      
      // Generate CSV
      const csvContent = stringify(formattedUsers, { 
        header: true,
        columns: columns
      });
      
      // Set appropriate headers for file download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
      
      // Send the CSV content
      res.send(csvContent);
      console.log("GET /api/users/export - CSV export completed successfully");
    } catch (err) {
      console.error("Error exporting users:", err);
      res.status(500).json({ 
        message: "Failed to export users", 
        details: err instanceof Error ? err.message : "Unknown error" 
      });
    }
  });

  // Update user role (admin only)
  app.patch("/api/users/:id/role", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }

    const userId = parseInt(req.params.id);
    const { role } = req.body;

    try {
      // Update the user's role
      const updatedUser = await storage.updateUser(userId, {
        role,
        updatedAt: new Date()
      });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      console.log(`Role updated for user ${userId} to ${role}`);
      // The permissions will be automatically applied based on the feature flags system
      // When a user has their role updated to "moderator", they'll get exactly the permissions
      // defined for moderators in the Feature Management grid

      res.json({ success: true, user: updatedUser }); // Corrected to updatedUser
    } catch (err) {
      console.error("Error updating user role:", err);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });
  
  // Update user approval status (admin only)


  // Delete user endpoint (admin and self-deletion)
  app.delete("/api/users/:id", async (req, res) => {
    console.log("🚨 USER DELETE ENDPOINT CALLED 🚨", {
      authenticated: req.isAuthenticated(),
      user: req.user ? { id: req.user.id, role: req.user.role, username: req.user.username } : null,
      params: req.params,
      targetUserId: req.params.id,
      headers: {
        origin: req.headers.origin,
        host: req.headers.host,
        referer: req.headers.referer,
        cookie: req.headers.cookie ? "Present" : "None"
      }
    });

    // Auth checks
    if (!req.isAuthenticated()) {
      console.warn("User delete request failed: not authenticated");
      return res.status(401).json({ 
        message: "Not authenticated", 
        details: "You need to be logged in to delete users",
        code: "AUTH_REQUIRED"
      });
    }

    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({
        message: "Invalid user ID",
        details: "User ID must be a valid number",
        code: "INVALID_USER_ID"
      });
    }

    // Allow users to delete their own accounts OR admin to delete any account
    const isAdmin = req.user.role === 'admin';
    const isSelfDeletion = userId === req.user.id;
    
    if (!isAdmin && !isSelfDeletion) {
      console.warn(`User delete request rejected: non-admin user (${req.user.role}) attempted to delete user ${userId}`);
      return res.status(403).json({ 
        message: "Access denied", 
        details: "You can only delete your own account unless you are an administrator",
        code: "ACCESS_DENIED"
      });
    }

    // Deleting another user's account permanently removes their content: needs the explicit grant.
    if (!isSelfDeletion) {
      try {
        await assertCanPermanentDelete(req, null);
      } catch (e) {
        if (e instanceof PermanentDeletePermissionError) return res.status(403).json({ message: e.message, code: "ACCESS_DENIED" });
        throw e;
      }
    }

    // Log the type of deletion being performed
    if (isSelfDeletion) {
      console.log(`Self-deletion request for user ${userId} (${req.user.username})`);
    } else {
      console.log(`Admin deletion request for user ${userId} by admin ${req.user.id} (${req.user.username})`);
    }
    
    // Special handling for self-deletion vs admin deletion
    if (isSelfDeletion && isAdmin) {
      console.warn(`Admin self-delete attempt prevented for user ${userId}`);
      return res.status(400).json({
        message: "Cannot delete your own account",
        details: "Admins cannot delete their own accounts",
        code: "SELF_DELETE_PREVENTED"
      });
    }

    try {
      // Get the current user to verify they exist
      const currentUser = await storage.getUser(userId);
      
      if (!currentUser) {
        console.warn(`User deletion failed: User ID ${userId} not found`);
        return res.status(404).json({ 
          message: "User not found",
          details: "The specified user ID does not exist",
          code: "USER_NOT_FOUND"
        });
      }
      
      console.log(`Processing deletion for user ${currentUser.username} (${userId})`);
      
      // Execute deletion using simplified approach
      const deletionResult = await deleteUserData(userId);
      
      console.log(`User deletion completed for ${currentUser.username} (${userId}):`, {
        success: deletionResult.success,
        totalDeleted: deletionResult.totalDeleted
      });

      res.json({ 
        success: true,
        user: {
          id: userId,
          username: currentUser.username,
          fullName: currentUser.fullName || currentUser.username
        },
        message: 'User and all associated content deleted successfully',
        deletionSummary: {
          totalDeleted: deletionResult.totalDeleted,
          success: deletionResult.success
        }
      });
      
    } catch (error: any) {
      console.error(`Error deleting user ${userId}:`, error);
      
      // Check for foreign key constraint violations
      if (error.code === '23503' || 
          (error.message && error.message.includes('foreign key constraint')) || 
          (error.detail && error.detail.includes('is still referenced'))) {
          
        // Extract table information from error
        let tableName = 'unknown table';
        let constraintDetail = '';
        
        if (error.detail) {
          const tableMatch = error.detail.match(/table "([^"]+)"/);
          if (tableMatch && tableMatch[1]) {
            tableName = tableMatch[1];
          }
          constraintDetail = error.detail;
        } else if (error.table) {
          tableName = error.table;
        }
        
        return res.status(409).json({ 
          message: "Cannot delete user due to remaining references",
          details: `This user still has content in ${tableName} that could not be automatically deleted. This may indicate a missing table in our deletion process.`,
          code: "FOREIGN_KEY_VIOLATION",
          constraint: error.constraint || constraintDetail,
          table: tableName,
          suggestion: "Please contact system administrator to resolve this constraint manually."
        });
      }
      
      // Handle database connection errors
      if (error.message && (error.message.includes('connection') || error.message.includes('timeout'))) {
        return res.status(503).json({
          message: "Database connection error",
          details: "Could not connect to the database to complete this operation. Please try again later.",
          code: "DB_CONNECTION_ERROR"
        });
      }
      
      // Generic server error
      res.status(500).json({ 
        message: "Failed to delete user",
        details: error instanceof Error ? error.message : "Unknown error occurred",
        code: "SERVER_ERROR"
      });
    }
  });


  // User approval endpoint has been removed as the isApproved function is no longer needed
  
  // Cross-domain user approval endpoint has been removed as the isApproved function is no longer needed

  // Emergency endpoint to update michael to admin role
  app.post("/api/admin/update-michael-to-admin", requireAdmin, async (req, res) => {
    try {
      console.log("Updating michael to admin role");
      const updatedUser = await storage.updateUserToAdmin("michael");
      
      if (!updatedUser) {
        return res.status(404).json({ 
          success: false,
          message: "User michael not found" 
        });
      }
      
      return res.json({
        success: true,
        message: "Successfully updated michael to admin role",
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          role: updatedUser.role
        }
      });
    } catch (error) {
      console.error("Error updating michael to admin:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update user role",
        error: error.message
      });
    }
  });

  // Emergency endpoint to update Rob Allan to admin role
  app.post("/api/admin/update-rob-allan-to-admin", requireAdmin, async (req, res) => {
    try {
      console.log("Updating Rob Allan to admin role");
      const updatedUser = await storage.updateRobAllanToAdmin();
      
      if (!updatedUser) {
        return res.status(404).json({ 
          success: false,
          message: "User Rob Allan not found" 
        });
      }
      
      return res.json({
        success: true,
        message: "Successfully updated Rob Allan to admin role",
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          fullName: updatedUser.fullName,
          role: updatedUser.role
        }
      });
    } catch (error) {
      console.error("Error updating Rob Allan to admin:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update user role",
        error: error.message
      });
    }
  });

  // Update user block status (admin only)
  app.patch("/api/users/:id/block", async (req, res) => {
    console.log("User block endpoint called", {
      authenticated: req.isAuthenticated(),
      user: req.user ? { id: req.user.id, role: req.user.role } : null,
      params: req.params,
      body: req.body,
      headers: {
        origin: req.headers.origin,
        host: req.headers.host,
        referer: req.headers.referer,
        cookie: req.headers.cookie ? "Present" : "None"
      }
    });

    // Auth checks
    if (!req.isAuthenticated()) {
      console.warn("User block request failed: not authenticated");
      return res.status(401).json({ 
        message: "Not authenticated", 
        details: "You need to be logged in to block users",
        code: "AUTH_REQUIRED"
      });
    }

    if (req.user.role !== 'admin') {
      console.warn(`User block request rejected: non-admin user (${req.user.role}) attempted to block`);
      return res.status(403).json({ 
        message: "Admin access required", 
        details: "Only administrators can block user accounts",
        code: "ADMIN_REQUIRED"
      });
    }

    const userId = parseInt(req.params.id);
    const { isBlocked, blockReason } = req.body;
    
    if (typeof isBlocked !== 'boolean') {
      console.warn("User block request rejected: invalid isBlocked value", isBlocked);
      return res.status(400).json({ 
        message: "isBlocked must be a boolean value",
        details: "Please provide a valid block status (true or false)",
        code: "INVALID_PARAMETER"
      });
    }

    try {
      // Get the current user
      const currentUser = await storage.getUser(userId);
      
      if (!currentUser) {
        console.warn(`User block failed: User ID ${userId} not found`);
        return res.status(404).json({ 
          message: "User not found",
          details: "The specified user ID does not exist",
          code: "USER_NOT_FOUND"
        });
      }
      
      // Don't allow blocking admins
      if (currentUser.role === 'admin' && isBlocked) {
        console.warn(`Attempted to block an admin user: ${currentUser.username} (${userId})`);
        return res.status(403).json({ 
          message: "Cannot block admin users",
          details: "Administrator accounts cannot be blocked",
          code: "ADMIN_BLOCK_DENIED"
        });
      }
      
      console.log(`Processing block for user ${currentUser.username} (${userId}): setting isBlocked=${isBlocked}`);
      
      // Update the block status
      const updateData: any = {
        isBlocked,
        updatedAt: new Date()
      };
      
      // Only set blockReason when blocking a user
      if (isBlocked && blockReason) {
        updateData.blockReason = blockReason;
      } else if (!isBlocked) {
        // Clear the block reason when unblocking
        updateData.blockReason = null;
      }

      const updatedUser = await storage.updateUser(userId, updateData);

      if (!updatedUser) {
        console.error(`User block failed: User ID ${userId} not found after update attempt`);
        return res.status(404).json({ 
          message: "User not found",
          details: "The user could not be updated",
          code: "UPDATE_FAILED"
        });
      }

      console.log(`User block status changed: User ${updatedUser.username} (${userId}) is now ${isBlocked ? 'blocked' : 'unblocked'}`);

      res.json({ 
        success: true, 
        user: updatedUser,
        message: isBlocked ? 'User blocked successfully' : 'User unblocked successfully'
      });
    } catch (err) {
      console.error("Error updating user block status:", err);
      res.status(500).json({ 
        message: "Failed to update user block status",
        details: err.message,
        code: "SERVER_ERROR"
      });
    }
  });

  // Cross-domain compatible user block endpoint (admin only)
  app.patch("/api/auth/users/:id/block", async (req, res) => {
    console.log("Cross-domain user block endpoint called", {
      authenticated: req.isAuthenticated(),
      user: req.user ? { id: req.user.id, role: req.user.role } : null,
      params: req.params,
      body: req.body,
      headers: {
        origin: req.headers.origin,
        host: req.headers.host,
        referer: req.headers.referer,
        cookie: req.headers.cookie ? "Present" : "None"
      }
    });

    // Set CORS headers for cross-domain requests
    if (req.headers.origin) {
      console.log(`Cross-domain user block: Setting CORS headers for origin: ${req.headers.origin}`);
      // Allow credentials for cross-origin requests
      res.header('Access-Control-Allow-Credentials', 'true');
      
      // Set origin based on the request's origin header
      res.header('Access-Control-Allow-Origin', req.headers.origin);
    }

    // Auth checks
    if (!req.isAuthenticated()) {
      console.warn("Cross-domain user block request failed: not authenticated");
      return res.status(401).json({ 
        success: false,
        message: "Not authenticated",
        details: "You need to be logged in to block users",
        code: "AUTH_REQUIRED"
      });
    }

    if (req.user.role !== 'admin') {
      console.warn(`Cross-domain user block rejected: non-admin user (${req.user.role}) attempted operation`);
      return res.status(403).json({ 
        success: false,
        message: "Admin access required",
        details: "Only administrators can block user accounts",
        code: "ADMIN_REQUIRED"
      });
    }

    const userId = parseInt(req.params.id);
    const { isBlocked, blockReason } = req.body;
    
    if (typeof isBlocked !== 'boolean') {
      console.warn("Cross-domain user block request rejected: invalid isBlocked value", isBlocked);
      return res.status(400).json({ 
        success: false,
        message: "isBlocked must be a boolean value",
        details: "Please provide a valid block status (true or false)",
        code: "INVALID_PARAMETER"
      });
    }

    try {
      // Use a force refresh to ensure we're getting the latest user data
      const allUsers = await storage.getUsers(true);
      const currentUser = allUsers.find(u => u.id === userId);
      
      if (!currentUser) {
        console.warn(`Cross-domain user block failed: User ID ${userId} not found`);
        return res.status(404).json({ 
          success: false,
          message: "User not found",
          details: "The specified user ID does not exist",
          code: "USER_NOT_FOUND"
        });
      }
      
      // Don't allow blocking admins
      if (currentUser.role === 'admin' && isBlocked) {
        console.warn(`Cross-domain attempted to block an admin user: ${currentUser.username} (${userId})`);
        return res.status(403).json({ 
          success: false,
          message: "Cannot block admin users",
          details: "Administrator accounts cannot be blocked",
          code: "ADMIN_BLOCK_DENIED"
        });
      }
      
      console.log(`Cross-domain processing block for user ${currentUser.username} (${userId}): setting isBlocked=${isBlocked}`);
      
      // Update the block status
      const updateData: any = {
        isBlocked,
        updatedAt: new Date()
      };
      
      // Only set blockReason when blocking a user
      if (isBlocked && blockReason) {
        updateData.blockReason = blockReason;
      } else if (!isBlocked) {
        // Clear the block reason when unblocking
        updateData.blockReason = null;
      }

      const updatedUser = await storage.updateUser(userId, updateData);

      if (!updatedUser) {
        console.error(`Cross-domain user block failed: User ID ${userId} not found after update attempt`);
        return res.status(404).json({ 
          success: false,
          message: "User not found",
          details: "The user could not be updated",
          code: "UPDATE_FAILED"
        });
      }

      console.log(`Cross-domain user block successful: User ${updatedUser.username} (${userId}) is now ${isBlocked ? 'blocked' : 'unblocked'}`);

      // If this was a cross-domain request, ensure CORS headers are set
      if (req.headers.origin) {
        console.log(`Cross-domain user block: Setting CORS headers for response to origin: ${req.headers.origin}`);
        // Allow credentials for cross-origin requests
        res.header('Access-Control-Allow-Credentials', 'true');
        
        // Set origin based on the request's origin header
        if (req.headers.origin) {
          res.header('Access-Control-Allow-Origin', req.headers.origin);
        }
      }

      res.json({ 
        success: true, 
        user: updatedUser,
        message: isBlocked ? 'User blocked successfully' : 'User unblocked successfully'
      });
    } catch (err) {
      console.error("Error in cross-domain user block:", err);
      res.status(500).json({ 
        success: false,
        message: "Failed to update user block status",
        details: err.message,
        code: "SERVER_ERROR"
      });
    }
  });

  // Object Storage Debug Endpoint
  app.get("/api/debug/object-storage", async (req, res) => {
    try {
      const { key } = req.query;
      
      if (!key) {
        return res.status(400).json({ 
          success: false, 
          message: "Object key parameter is required" 
        });
      }
      
      console.log(`[DEBUG] Checking if object exists in storage: ${key}`);
      
      // Dynamically import the object-storage module
      const objectStorage = await import('./object-storage');
      
      // Check if the object exists
      const exists = await objectStorage.default.objectExists(key as string);
      
      console.log(`[DEBUG] Object exists check result: ${exists}`);
      
      let url = null;
      if (exists) {
        // Get a signed URL for the object
        url = await objectStorage.default.getPresignedUrl(key as string, 3600);
        console.log(`[DEBUG] Generated presigned URL: ${url}`);
      }
      
      return res.json({ 
        success: true,
        exists,
        url,
        key,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("[DEBUG] Error checking object storage:", error);
      return res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Events API
  // Debug endpoint to check event media URLs in the database
  app.get("/api/debug/event-media/{id}", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    console.log('[EventMediaDebug] Checking event media URLs in database');
    
    try {
      let events;
      if (req.params.id) {
        // Get a specific event
        const event = await storage.getEvent(parseInt(req.params.id));
        if (!event) {
          return res.status(404).json({ message: "Event not found" });
        }
        events = [event];
      } else {
        // Get recent events with media
        events = await db.query(`
          SELECT id, title, mediaUrls
          FROM events
          WHERE mediaUrls IS NOT NULL AND jsonb_array_length(mediaUrls) > 0
          ORDER BY "createdAt" DESC
          LIMIT 10
        `);
      }
      
      // Process each event to normalize URLs
      const processedEvents = events.map(event => {
        // Skip events without media
        if (!event.mediaUrls || !Array.isArray(event.mediaUrls) || event.mediaUrls.length === 0) {
          return {
            ...event,
            mediaUrlsInfo: [{ message: "No media URLs" }]
          };
        }
        
        // Process each URL
        const mediaUrlsInfo = event.mediaUrls.map(url => {
          let category = 'unknown';
          
          if (url.includes('object-storage.replit.app')) {
            category = 'direct-object-storage';
          } else if (url.includes('/api/storage-proxy/')) {
            category = 'storage-proxy';
          } else if (url.startsWith('/uploads/')) {
            category = 'legacy-uploads';
          } else if (url.startsWith('/')) {
            category = 'root-relative';
          }
          
          // Generate corrected URL if needed
          let correctedUrl = url;
          if (category !== 'storage-proxy') {
            try {
              correctedUrl = normalizeMediaUrl(url, 'event');
            } catch (error) {
              correctedUrl = `Error normalizing URL: ${error.message}`;
            }
          }
          
          return {
            original: url,
            category,
            correctedUrl: correctedUrl !== url ? correctedUrl : null,
            filename: extractFilename(url)
          };
        });
        
        return {
          ...event,
          mediaUrlsInfo: mediaUrlsInfo
        };
      });
      
      return res.json({
        count: events.length,
        events: processedEvents
      });
    } catch (error) {
      console.error('[EventMediaDebug] Error:', error);
      return res.status(500).json({ message: `Error: ${error.message}` });
    }
  });
  
  // Test endpoint to fix event media URLs in the database
  app.post("/api/debug/fix-event-media/{id}", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    console.log('[EventMediaFix] Fixing event media URLs in database');
    
    try {
      let events;
      if (req.params.id) {
        // Get a specific event
        const event = await storage.getEvent(parseInt(req.params.id));
        if (!event) {
          return res.status(404).json({ message: "Event not found" });
        }
        events = [event];
      } else {
        // Get events with media
        events = await db.query(`
          SELECT id, title, mediaUrls
          FROM events
          WHERE mediaUrls IS NOT NULL AND jsonb_array_length(mediaUrls) > 0
        `);
      }
      
      const fixResults = [];
      
      // Process each event to fix URLs
      for (const event of events) {
        // Skip events without media
        if (!event.mediaUrls || !Array.isArray(event.mediaUrls) || event.mediaUrls.length === 0) {
          fixResults.push({
            id: event.id,
            title: event.title,
            status: 'skipped',
            message: 'No media URLs'
          });
          continue;
        }
        
        // Normalize all URLs
        const normalizedUrls = event.mediaUrls.map(url => {
          try {
            // Always return a storage proxy URL format for consistency
            return normalizeMediaUrl(url, 'event');
          } catch (error) {
            console.error(`[EventMediaFix] Error normalizing URL for event ${event.id}:`, error);
            // Keep the original URL if normalization fails
            return url;
          }
        });
        
        // Check if URLs were changed
        const hasChanges = JSON.stringify(normalizedUrls) !== JSON.stringify(event.mediaUrls);
        
        if (hasChanges) {
          // Update the event with normalized URLs
          await db.query(
            `UPDATE events SET "mediaUrls" = $1 WHERE id = $2`,
            [JSON.stringify(normalizedUrls), event.id]
          );
          
          fixResults.push({
            id: event.id,
            title: event.title,
            status: 'fixed',
            original: event.mediaUrls,
            normalized: normalizedUrls
          });
        } else {
          fixResults.push({
            id: event.id,
            title: event.title,
            status: 'unchanged',
            urls: event.mediaUrls
          });
        }
      }
      
      return res.json({
        count: events.length,
        fixedCount: fixResults.filter(r => r.status === 'fixed').length,
        unchangedCount: fixResults.filter(r => r.status === 'unchanged').length,
        skippedCount: fixResults.filter(r => r.status === 'skipped').length,
        results: fixResults
      });
    } catch (error) {
      console.error('[EventMediaFix] Error:', error);
      return res.status(500).json({ message: `Error: ${error.message}` });
    }
  });
  
  // Test endpoint for calendar event media upload
  app.post("/api/test-calendar-upload", upload.single('media'), async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    
    console.log('[TestCalendarUpload] Processing test calendar media upload...');
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    
    // Set media type explicitly for calendar
    req.mediaType = MEDIA_TYPES.CALENDAR;
    
    try {
      // Call our calendar media upload handler directly
      await handleCalendarMediaUpload(req, res, () => {});
      
      // Get the object storage URL assigned by the handler
      const objectStorageUrl = req.objectStorageUrl;
      
      if (!objectStorageUrl) {
        return res.status(500).json({ 
          success: false, 
          message: "Upload handler did not return a valid URL"
        });
      }
      
      console.log('[TestCalendarUpload] Upload successful with URL:', objectStorageUrl);
      
      // List the current mappings for this file
      const mappingFilePath = path.join(process.cwd(), 'server', 'calendar-media-mapping.json');
      let mappings = {};
      if (fs.existsSync(mappingFilePath)) {
        mappings = JSON.parse(fs.readFileSync(mappingFilePath, 'utf8'));
      }
      
      // Filter mappings for this file only
      const filename = req.file.filename;
      const relevantMappings = Object.entries(mappings)
        .filter(([key, value]) => key.includes(filename) || (value as string).includes(filename))
        .reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {});
      
      return res.json({ 
        success: true, 
        url: objectStorageUrl,
        filename: req.file.filename,
        originalname: req.file.originalname,
        filesize: req.file.size,
        path: req.file.path,
        mappings: relevantMappings,
        message: "Test upload successful - verify URL in event detail page"
      });
    } catch (error) {
      console.error('[TestCalendarUpload] Error:', error);
      return res.status(500).json({ 
        success: false, 
        message: `Upload error: ${error.message || "Unknown error"}` 
      });
    }
  });
  
  app.get("/api/events", async (req, res) => {
    let options;
    try {
      options = parseEventReadOptions(req.query);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
      return;
    }
    const events = await storage.getEvents(options);
    // DMCA/moderation visibility: public sees published only; owners see their own hidden events flagged.
    const viewer = await getViewerContext(req);
    res.set("Cache-Control", "private, no-store");
    res.json(filterForViewer(events, viewer, (e: any) => e.createdBy));
  });

  app.get("/api/events/platinum-sponsors", async (_req, res) => {
    try {
      const activePlatinumSponsors = publicOnly(await storage.getActivePlatinumSponsors());
      res.json(activePlatinumSponsors);
    } catch (error) {
      console.error("Error fetching platinum sponsors:", error);
      res.status(500).json({ message: "Failed to fetch platinum sponsors" });
    }
  });

  app.get("/api/events/:id/occurrences", async (req, res) => {
    const parentId = parseInt(req.params.id);
    
    if (isNaN(parentId)) {
      return res.status(400).json({ message: "Invalid parent event ID" });
    }
    
    try {
      const viewer = await getViewerContext(req);
      const allEvents = filterForViewer(await storage.getEvents(), viewer, (e: any) => e.createdBy);
      const childEvents = allEvents
        .filter(e => e.parentEventId === parentId)
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      
      res.json(childEvents);
    } catch (error) {
      console.error("Error fetching child events:", error);
      res.status(500).json({ message: "Failed to fetch child events" });
    }
  });

  app.get("/api/events/export/excel", requireAdmin, async (_req, res) => {
    try {
      const events = await storage.getEvents();
      
      // Sort events: parent events first, then their children
      const sortedEvents = [];
      const processedIds = new Set();
      
      // First pass: add all parent events and their children
      for (const event of events) {
        if (!processedIds.has(event.id)) {
          // If this is a parent event (recurring and no parentEventId)
          if (event.isRecurring && !event.parentEventId) {
            sortedEvents.push(event);
            processedIds.add(event.id);
            
            // Find and add all children of this parent
            const children = events
              .filter(e => e.parentEventId === event.id)
              .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
            
            children.forEach(child => {
              sortedEvents.push(child);
              processedIds.add(child.id);
            });
          }
        }
      }
      
      // Second pass: add remaining events (single events and orphaned children)
      for (const event of events) {
        if (!processedIds.has(event.id)) {
          sortedEvents.push(event);
          processedIds.add(event.id);
        }
      }
      
      // Format events for Excel
      const excelData = sortedEvents.map((event, index) => {
        const isParent = event.isRecurring && !event.parentEventId;
        const isChild = !!event.parentEventId;
        
        // Determine event type
        let eventType = 'Single';
        if (isParent) eventType = 'Recurring Parent';
        if (isChild) eventType = `Child of #${event.parentEventId}`;
        
        // Format dates
        const formatDate = (dateStr: string) => {
          try {
            const date = new Date(dateStr);
            return date.toLocaleString('en-US', { 
              month: '2-digit',
              day: '2-digit', 
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            });
          } catch {
            return dateStr;
          }
        };
        
        // Add indentation for child events
        const titlePrefix = isChild ? '  └─ ' : '';
        
        return {
          'Row': index + 1,
          'Event ID': event.id,
          'Type': eventType,
          'Title': titlePrefix + event.title,
          'Description': event.description || '',
          'Category': event.category,
          'Start Date': formatDate(event.startDate),
          'End Date': formatDate(event.endDate),
          'Location': event.location || '',
          'Website URL': event.websiteUrl || '',
          'Map Link': event.mapLink || '',
          'Created At': formatDate(event.createdAt),
          'Created By': event.createdBy || 'N/A',
          'Media Files': event.mediaUrls?.length || 0
        };
      });
      
      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Create main events worksheet
      const ws = XLSX.utils.json_to_sheet(excelData);
      
      // Set column widths
      ws['!cols'] = [
        { wch: 6 },  // Row
        { wch: 10 }, // Event ID
        { wch: 20 }, // Type
        { wch: 35 }, // Title
        { wch: 50 }, // Description
        { wch: 12 }, // Category
        { wch: 20 }, // Start Date
        { wch: 20 }, // End Date
        { wch: 30 }, // Location
        { wch: 40 }, // Website URL
        { wch: 40 }, // Map Link
        { wch: 20 }, // Created At
        { wch: 12 }, // Created By
        { wch: 12 }  // Media Files
      ];
      
      XLSX.utils.book_append_sheet(wb, ws, 'Events');
      
      // Create summary worksheet
      const totalEvents = events.length;
      const parentEvents = events.filter(e => e.isRecurring && !e.parentEventId).length;
      const childEvents = events.filter(e => e.parentEventId).length;
      const singleEvents = events.filter(e => !e.isRecurring && !e.parentEventId).length;
      const categories = [...new Set(events.map(e => e.category))];
      
      const summaryData = [
        { 'Metric': 'Total Events', 'Value': totalEvents },
        { 'Metric': 'Recurring Parent Events', 'Value': parentEvents },
        { 'Metric': 'Child Events (in series)', 'Value': childEvents },
        { 'Metric': 'Single Events', 'Value': singleEvents },
        { 'Metric': 'Unique Categories', 'Value': categories.length },
        { 'Metric': 'Export Date', 'Value': new Date().toLocaleString('en-US') }
      ];
      
      const summaryWs = XLSX.utils.json_to_sheet(summaryData);
      summaryWs['!cols'] = [
        { wch: 30 }, // Metric
        { wch: 40 }  // Value
      ];
      
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
      
      // Generate Excel file buffer
      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      
      // Set headers for file download
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `barefoot-bay-events-${timestamp}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', excelBuffer.length);
      
      res.send(excelBuffer);
    } catch (error) {
      console.error('Error exporting events:', error);
      res.status(500).json({ message: 'Failed to export events' });
    }
  });

  app.get("/api/events/:id", async (req, res) => {
    try {
      const event = await storage.getEvent(parseInt(req.params.id));
      if (!event) return res.status(404).json({ message: "Event not found" });
      const visible = await resolveDetailForViewer(req, res, event, (event as any).createdBy, "Event");
      if (!visible) return;
      res.json(visible);
    } catch (err) {
      console.error("Error fetching event:", err);
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  app.post("/api/events", upload.array('media'), (req: any, res, next) => {
    // Set the mediaType explicitly for calendar events to ensure proper sync
    req.mediaType = MEDIA_TYPES.CALENDAR;
    
    // Log for debugging purpose
    console.log('[EventCreate] Processing event media upload request');
    if (req.files && req.files.length > 0) {
      console.log(`[EventCreate] Event has ${req.files.length} media files attached`);
      req.files.forEach((file: Express.Multer.File, index: number) => {
        console.log(`[EventCreate] Media file ${index + 1}:
          - Filename: ${file.originalname}
          - Size: ${file.size} bytes
          - Path: ${file.path}
          - Mimetype: ${file.mimetype}
        `);
      });
    } else {
      console.log('[EventCreate] No media files attached to this event creation request');
    }
    
    next();
  }, mediaSyncMiddleware, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    
    // Check if user is approved or admin
    const isAdmin = req.user.role === 'admin';
    const isApproved = !!req.user.isApproved;
    
    // User must be approved to create events (admins are automatically considered approved)
    if (!isApproved && !isAdmin) {
      return res.status(403).json({ message: "Your account must be approved before you can create events" });
    }

    try {
      const files = req.files as Express.Multer.File[];
      let eventData;

      try {
        eventData = JSON.parse(req.body.eventData);
      } catch (error) {
        console.error("Error parsing event data:", error);
        return res.status(400).json({ message: "Invalid event data format" });
      }

      const result = insertEventSchema.safeParse(eventData);
      if (!result.success) {
        return res.status(400).json({
          message: "Invalid event data",
          errors: result.error.errors
        });
      }

      if (result.data.category === 'platinum_sponsor') {
        const start = new Date(result.data.startDate);
        const end = new Date(result.data.endDate);
        const maxEnd = new Date(start);
        maxEnd.setMonth(maxEnd.getMonth() + 12);
        if (end > maxEnd) {
          return res.status(400).json({
            message: "Platinum sponsor events cannot exceed 12 months in duration"
          });
        }
      }

      // Process media files through Object Storage middleware
      let mediaUrls = [];
      
      // Handle new file uploads
      if (files && files.length > 0) {
        try {
          // Use processUploadedFiles to handle Object Storage integration
          req.mediaType = MEDIA_TYPES.CALENDAR;
          const result = await processUploadedFiles(req, files);
          
          if (result.success && result.urls) {
            mediaUrls = result.urls;
            console.log(`[EventCreate] Processed ${mediaUrls.length} files through Object Storage middleware`);
            console.log(`[EventCreate] Media URLs: ${JSON.stringify(mediaUrls)}`);
          } else {
            console.error(`[EventCreate] Failed to process media files through middleware:`, result.message);
            return res.status(500).json({ message: `Error processing media files: ${result.message}` });
          }
        } catch (mediaError) {
          console.error(`[EventCreate] Error processing media files:`, mediaError);
          return res.status(500).json({ message: 'Error processing media files' });
        }
      }
      
      // Handle existing media URLs for event duplication
      if (eventData.mediaUrls && Array.isArray(eventData.mediaUrls) && eventData.mediaUrls.length > 0) {
        console.log(`[EventCreate] Processing existing media URLs for duplication:`, eventData.mediaUrls);
        
        // For event duplication, we can safely reuse existing media URLs since they point to Object Storage
        // The URLs are already properly formatted storage proxy URLs that will continue to work
        const existingMediaUrls = eventData.mediaUrls.filter(url => 
          url && typeof url === 'string' && url.trim().length > 0
        );
        
        if (existingMediaUrls.length > 0) {
          mediaUrls = [...mediaUrls, ...existingMediaUrls];
          console.log(`[EventCreate] Added ${existingMediaUrls.length} existing media URLs to new event`);
          console.log(`[EventCreate] Final media URLs:`, mediaUrls);
        }
      }
      
      if (mediaUrls.length === 0) {
        console.log(`[EventCreate] No media files or URLs to process`);
      }

      // Extract date and time components for backward compatibility with old database columns
      // The database has both old columns (event_date, start_time, end_time) and new columns (start_date, end_date)
      // We populate both to maintain compatibility with existing data
      // IMPORTANT: Use America/New_York timezone to avoid UTC conversion issues
      const startDateTime = new Date(result.data.startDate);
      const endDateTime = new Date(result.data.endDate);
      
      // Extract date in YYYY-MM-DD format for event_date column using Florida timezone
      const eventDate = startDateTime.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // en-CA gives YYYY-MM-DD format
      
      // Extract time in HH:MM:SS format for start_time and end_time columns using Florida timezone
      const startTime = startDateTime.toLocaleTimeString('en-US', { 
        timeZone: 'America/New_York', 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
      const endTime = endDateTime.toLocaleTimeString('en-US', { 
        timeZone: 'America/New_York', 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });

      const event = await storage.createEvent({
        ...result.data,
        eventDate,
        startTime,
        endTime,
        mediaUrls,
        createdBy: req.user.id,
      });
      
      // Broadcast event creation to all connected clients
      broadcastWebSocketMessage('calendar_update', {
        action: 'create',
        event: event,
        timestamp: new Date().toISOString(),
        userId: req.user.id
      });
      
      // WebSocket disabled
      console.log(`Calendar event created: ID=${event.id}, Title="${event.title}"`);

      res.status(201).json(event);
    } catch (err) {
      console.error("=== ERROR CREATING EVENT ===");
      console.error("Error details:", err);
      console.error("Error message:", err instanceof Error ? err.message : String(err));
      console.error("Error stack:", err instanceof Error ? err.stack : 'No stack trace');
      res.status(500).json({ 
        message: "Failed to create event",
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });

  app.patch("/api/events/:id", upload.array('media'), (req: any, res, next) => {
    // Set the mediaType explicitly for calendar events to ensure proper sync
    req.mediaType = MEDIA_TYPES.CALENDAR;
    next();
  }, mediaSyncMiddleware, async (req, res) => {
    // Enhanced authentication debugging
    console.log("Event PATCH authentication debug:", {
      isAuthenticated: req.isAuthenticated(),
      session: req.session ? {
        id: req.sessionID,
        cookie: req.session.cookie ? {
          originalMaxAge: req.session.cookie.originalMaxAge,
          expires: req.session.cookie.expires,
          secure: req.session.cookie.secure,
          httpOnly: req.session.cookie.httpOnly,
          sameSite: req.session.cookie.sameSite
        } : 'No cookie'
      } : 'No session',
      user: req.user ? {
        id: req.user.id,
        username: req.user.username,
        role: req.user.role
      } : 'No user',
      headers: {
        cookie: req.headers.cookie ? 'Present' : 'Missing',
        origin: req.headers.origin,
        host: req.headers.host,
        referer: req.headers.referer,
        'content-type': req.headers['content-type']
      }
    });

    if (!req.isAuthenticated()) {
      console.error(`Authentication failed for PATCH /api/events/${req.params.id}`);
      return res.status(401).json({ 
        message: "Not authenticated",
        details: "Session validation failed. Try logging in again."
      });
    }

    // Check if user is admin OR is the creator of the event and is approved
    const eventId = parseInt(req.params.id);
    const event = await storage.getEvent(eventId);
    
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }
    
    const isAdmin = req.user.role === 'admin';
    const isCreator = event.createdBy === req.user.id;
    const isApproved = !!req.user.isApproved;
    
    console.log(`User permission check for event ${eventId}:`, {
      userId: req.user.id,
      username: req.user.username,
      isAdmin,
      isCreator,
      isApproved,
      eventCreator: event.createdBy
    });
    
    if (!isAdmin && (!isCreator || !isApproved)) {
      return res.status(403).json({ message: "You don't have permission to edit this event" });
    }

    try {
      const eventId = parseInt(req.params.id);
      console.log(`Processing PATCH request for event ${eventId}`);

      const event = await storage.getEvent(eventId);
      if (!event) {
        console.log(`Event ${eventId} not found`);
        return res.status(404).json({ message: "Event not found" });
      }

      if (!req.body.eventData) {
        console.error('Missing eventData in request body');
        return res.status(400).json({ message: "Event data is required" });
      }

      let eventData;
      let editMode = null;
      
      try {
        eventData = JSON.parse(req.body.eventData);
        console.log('Parsed event data:', eventData);
        
        // DEBUG: Track contactInfo specifically
        console.log('CONTACT_INFO_DEBUG - Received contactInfo:', JSON.stringify(eventData.contactInfo, null, 2));
        console.log('CONTACT_INFO_DEBUG - websiteUrl in contactInfo:', eventData.contactInfo?.website);
        console.log('CONTACT_INFO_DEBUG - contactInfo type:', typeof eventData.contactInfo);
        
        // Check if this is a recurring event edit and extract the edit mode
        if (event.isRecurring && eventData.editMode) {
          editMode = eventData.editMode;
          console.log(`Recurring event edit mode: ${editMode}`);
          // Remove editMode from the data as it's not part of the schema
          delete eventData.editMode;
        }
      } catch (error) {
        console.error("Error parsing event data:", error);
        return res.status(400).json({ message: "Invalid event data format" });
      }

      // Add media URLs if new files were uploaded (with calendar folder path)
      const files = req.files as Express.Multer.File[];
      console.log('Uploaded files:', files); // Log all files that were uploaded
      
      // Log the actual file paths
      if (files && files.length > 0) {
        console.log('Uploaded file details:');
        files.forEach(file => {
          console.log(`- Filename: ${file.filename}`);
          console.log(`  Path: ${file.path}`);
          console.log(`  Destination: ${file.destination}`);
        });
      }
      
      // Process each file using our enhanced media upload middleware
      let newMediaUrls = [];
      if (files && files.length > 0) {
        // Set media type for calendar events
        req.mediaType = MEDIA_TYPES.CALENDAR;
        
        try {
          // Process files through our enhanced middleware that uses Object Storage
          const result = await processUploadedFiles(req, files);
          
          if (result.success) {
            try {
              console.log(`[EventUpdate] DEBUG - Raw result object:`, JSON.stringify(result));
              
              // IMPORTANT FIX: Check for objectStorageUrls first, as these will be the most reliable
              // Then fall back to urls array if no object storage URLs available
              if (result.objectStorageUrls && result.objectStorageUrls.length > 0) {
                // Use Object Storage URLs and normalize them with our utility
                console.log(`[EventUpdate] Found ${result.objectStorageUrls.length} Object Storage URLs to normalize`);
                newMediaUrls = result.objectStorageUrls.map(url => {
                  try {
                    const normalizedUrl = normalizeMediaUrl(url, 'event');
                    console.log(`[EventUpdate] Normalized URL: ${url} -> ${normalizedUrl}`);
                    return normalizedUrl;
                  } catch (normalizeError) {
                    console.error(`[EventUpdate] Error normalizing URL: ${url}`, normalizeError);
                    // Return original URL as fallback
                    return url;
                  }
                });
                console.log(`[EventUpdate] Using Object Storage URLs (normalized): ${JSON.stringify(newMediaUrls)}`);
              } else if (result.urls && result.urls.length > 0) {
                // Fall back to regular URLs and normalize them
                console.log(`[EventUpdate] Found ${result.urls.length} regular URLs to normalize`);
                newMediaUrls = result.urls.map(url => {
                  try {
                    const normalizedUrl = normalizeMediaUrl(url, 'event');
                    console.log(`[EventUpdate] Normalized URL: ${url} -> ${normalizedUrl}`);
                    return normalizedUrl;
                  } catch (normalizeError) {
                    console.error(`[EventUpdate] Error normalizing URL: ${url}`, normalizeError);
                    // Return original URL as fallback
                    return url;
                  }
                });
                console.log(`[EventUpdate] Using regular URLs (normalized): ${JSON.stringify(newMediaUrls)}`);
              } else {
                console.warn(`[EventUpdate] No URLs returned from upload processor, but success was indicated`);
              }
              
              console.log(`[EventUpdate] Processed ${newMediaUrls.length} files through Object Storage middleware`);
              console.log(`[EventUpdate] Final Media URLs: ${JSON.stringify(newMediaUrls)}`);
            } catch (processingError) {
              console.error(`[EventUpdate] CRITICAL ERROR during media URL processing:`, processingError);
              // Set empty array as fallback to prevent the update from failing entirely
              newMediaUrls = [];
            }
          } else {
            console.error(`[EventUpdate] Failed to process media files through middleware:`, result.message);
            return res.status(500).json({ message: `Error processing media files: ${result.message}` });
          }
        } catch (mediaError) {
          console.error(`[EventUpdate] Error processing media files:`, mediaError);
          return res.status(500).json({ message: 'Error processing media files' });
        }
      } else {
        console.log(`[EventUpdate] No new media files to process`);
      }

      // Get current media URLs excluding the ones marked for removal
      const currentMediaUrls = event.mediaUrls || [];
      
      // Check both the regular eventData and the separate FormData field for URLs to remove
      let mediaToRemove = [];
      
      // First check if there's a separate field in the FormData
      if (req.body.existingMediaToRemove) {
        try {
          const parsedMediaToRemove = JSON.parse(req.body.existingMediaToRemove);
          console.log('Media removal - Detected separate FormData field with media to remove:', parsedMediaToRemove);
          if (Array.isArray(parsedMediaToRemove)) {
            mediaToRemove = parsedMediaToRemove;
          } else if (parsedMediaToRemove && typeof parsedMediaToRemove === 'string') {
            mediaToRemove = [parsedMediaToRemove];
          } else if (parsedMediaToRemove) {
            console.log('Media removal - Non-array value received:', parsedMediaToRemove);
            mediaToRemove = [parsedMediaToRemove.toString()];
          }
        } catch (e) {
          console.error('Media removal - Error parsing existingMediaToRemove from FormData:', e);
          console.error('Raw existingMediaToRemove value:', req.body.existingMediaToRemove);
          // If parsing fails but we have a string, try using it directly
          if (typeof req.body.existingMediaToRemove === 'string' && req.body.existingMediaToRemove.trim()) {
            mediaToRemove = [req.body.existingMediaToRemove];
          }
        }
      }
      
      // If not found in separate field, use the one in eventData
      if (mediaToRemove.length === 0 && eventData.existingMediaToRemove) {
        console.log('Media removal - Using existingMediaToRemove from eventData:', eventData.existingMediaToRemove);
        if (Array.isArray(eventData.existingMediaToRemove)) {
          mediaToRemove = eventData.existingMediaToRemove;
        } else if (eventData.existingMediaToRemove && typeof eventData.existingMediaToRemove === 'string') {
          mediaToRemove = [eventData.existingMediaToRemove];
        } else if (eventData.existingMediaToRemove) {
          mediaToRemove = [eventData.existingMediaToRemove.toString()];
        }
      }
      
      // Log media removal information for debugging
      console.log('Media removal - Request ID:', req.params.id);
      console.log('Media removal - Current media URLs:', currentMediaUrls);
      console.log('Media removal - Media to remove (raw):', mediaToRemove);
      
      // Ensure currentMediaUrls is always an array
      let normalizedCurrentUrls = [];
      if (Array.isArray(currentMediaUrls)) {
        normalizedCurrentUrls = currentMediaUrls.filter(url => typeof url === 'string' && url.trim() !== '');
      } else if (typeof currentMediaUrls === 'string' && currentMediaUrls.trim()) {
        normalizedCurrentUrls = [currentMediaUrls];
      } else if (currentMediaUrls) {
        try {
          if (typeof currentMediaUrls === 'string') {
            const parsed = JSON.parse(currentMediaUrls);
            if (Array.isArray(parsed)) {
              normalizedCurrentUrls = parsed.filter(url => typeof url === 'string' && url.trim() !== '');
            } else if (parsed && typeof parsed === 'string') {
              normalizedCurrentUrls = [parsed];
            }
          }
        } catch (e) {
          console.error('Media removal - Error parsing currentMediaUrls:', e);
          // If it's not parseable JSON but still has a value, use it directly
          if (currentMediaUrls && typeof currentMediaUrls === 'string') {
            normalizedCurrentUrls = [currentMediaUrls];
          }
        }
      }
      
      // Ensure mediaToRemove is always an array of strings
      let normalizedMediaToRemove = [];
      
      // Filter out any non-string or empty values
      if (Array.isArray(mediaToRemove)) {
        normalizedMediaToRemove = mediaToRemove
          .filter(url => url !== null && url !== undefined)
          .map(url => url.toString().trim())
          .filter(url => url !== '');
      } else if (mediaToRemove && typeof mediaToRemove === 'string' && mediaToRemove.trim()) {
        normalizedMediaToRemove = [mediaToRemove];
      }
      
      console.log('Media removal - Normalized current URLs:', normalizedCurrentUrls);
      console.log('Media removal - Normalized URLs to remove:', normalizedMediaToRemove);
      
      // Special debug for this broken event
      if (req.params.id === '4217') {
        console.log('CRITICAL DEBUG - Special handling for event 4217');
        console.log('Current URLs before filtering:', JSON.stringify(normalizedCurrentUrls));
        console.log('URLs to remove before filtering:', JSON.stringify(normalizedMediaToRemove));
      }
      
      const mediaUrlsToKeep = normalizedCurrentUrls.filter(
        url => {
          // Make sure we're dealing with strings
          const urlStr = String(url).trim();
          
          // Check if this URL should be removed
          const shouldRemove = normalizedMediaToRemove.some(removeUrl => {
            // First try direct string matching
            if (urlStr === removeUrl) return true;
            
            // Then try matching just the filename part
            const urlFilename = urlStr.split('/').pop();
            const removeFilename = removeUrl.split('/').pop();
            return urlFilename === removeFilename;
          });
          
          const shouldKeep = !shouldRemove;
          
          if (!shouldKeep) {
            console.log(`Media removal - Removing URL: ${urlStr}`);
            
            // Log all path variants to help with debugging
            const filenamePart = urlStr.split('/').pop();
            console.log(`Media removal - File basename: ${filenamePart}`);
            console.log(`Media removal - Possible paths: 
              - /uploads/calendar/${filenamePart}
              - /calendar/${filenamePart}
              - ${urlStr}
            `);
          }
          
          return shouldKeep;
        }
      );
      
      console.log('Media removal - URLs to keep:', mediaUrlsToKeep);

      // Normalize existing media URLs to ensure they use proxy format for client access
      // Import the normalizeMediaUrl function from our centralized utility
      const normalizedMediaUrlsToKeep = mediaUrlsToKeep.map(url => 
        normalizeMediaUrl(url, 'event')
      );
      
      console.log('Media removal - Normalized URLs to keep:', normalizedMediaUrlsToKeep);
      
      // Combine existing media (not marked for removal) with new media
      const mediaUrls = [...normalizedMediaUrlsToKeep, ...newMediaUrls];
      console.log('Media removal - Final media URLs list:', mediaUrls);

      // Convert ISO date strings to Date objects
      try {
        eventData.startDate = new Date(eventData.startDate);
        eventData.endDate = new Date(eventData.endDate);

        // Validate that dates are valid
        if (isNaN(eventData.startDate.getTime()) || isNaN(eventData.endDate.getTime())) {
          throw new Error("Invalid date format");
        }
      } catch (error) {
        console.error("Date parsing error:", error);
        return res.status(400).json({ message: "Invalid date format in event data" });
      }

      // Extract legacy date/time fields for backward compatibility with Florida timezone
      const startDateTime = new Date(eventData.startDate);
      const endDateTime = new Date(eventData.endDate);
      
      const eventDate = startDateTime.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      const startTime = startDateTime.toLocaleTimeString('en-US', { 
        timeZone: 'America/New_York', 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
      const endTime = endDateTime.toLocaleTimeString('en-US', { 
        timeZone: 'America/New_York', 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });

      // Pre-validation cleanup: strip null sponsor fields for non-platinum events
      // so validation doesn't reject nulls for fields irrelevant to the event type
      // Use existing event's category as fallback when category isn't in the payload
      const effectiveCategory = eventData.category || event.category;
      const sponsorFields = ['sponsorTagline', 'sponsorPhone', 'sponsorWebsiteUrl', 'sponsorVendorPageSlug', 'sponsorIsPoliticalAd', 'sponsorPoliticalAdText'] as const;
      if (effectiveCategory !== 'platinum_sponsor') {
        for (const field of sponsorFields) {
          if (eventData[field] === null || eventData[field] === undefined) {
            delete eventData[field];
          }
        }
      }

      // Description null handling is done by schema preprocess (null -> undefined)

      // Prepare the final update data
      const updatedEventData = {
        ...eventData,
        eventDate,
        startTime,
        endTime,
        mediaUrls,
        updatedAt: new Date()
      };

      // Special debug logging for the hoursOfOperation field to track null values
      console.log('HOURS OF OPERATION data:', { 
        raw: eventData.hoursOfOperation,
        type: typeof eventData.hoursOfOperation,
        isNull: eventData.hoursOfOperation === null,
        keys: eventData.hoursOfOperation ? Object.keys(eventData.hoursOfOperation) : 'no keys' 
      });

      const result = insertEventSchema.safeParse(updatedEventData);
      if (!result.success) {
        console.error('Validation errors:', result.error.errors);
        return res.status(400).json({
          message: "Invalid event data",
          errors: result.error.errors
        });
      }

      if (updatedEventData.category === 'platinum_sponsor') {
        const start = new Date(updatedEventData.startDate);
        const end = new Date(updatedEventData.endDate);
        const maxEnd = new Date(start);
        maxEnd.setMonth(maxEnd.getMonth() + 12);
        if (end > maxEnd) {
          return res.status(400).json({
            message: "Platinum sponsor events cannot exceed 12 months in duration"
          });
        }
      }

      console.log('Final update data:', updatedEventData);
      
      // DEBUG: Track contactInfo just before storage update
      console.log('CONTACT_INFO_DEBUG - Final contactInfo before storage update:', JSON.stringify(updatedEventData.contactInfo, null, 2));

      // Pass the edit mode to the storage method if this is a recurring event
      const updatedEvent = await storage.updateEvent(eventId, updatedEventData, editMode);
      console.log('Event updated successfully:', updatedEvent);
      
      // Broadcast event update to all connected clients
      broadcastWebSocketMessage('calendar_update', {
        action: 'update',
        event: updatedEvent,
        timestamp: new Date().toISOString(),
        userId: req.user.id,
        editMode: editMode // This includes the recurrence edit mode info
      });
      
      // WebSocket disabled
      console.log(`Calendar event updated: ID=${updatedEvent.id}, Title="${updatedEvent.title}"`);
      
      res.json(updatedEvent);
    } catch (err) {
      console.error("Error updating event:", err);
      res.status(500).json({ message: "Failed to update event" });
    }
  });

  // Add delete event endpoint
  app.delete("/api/events/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const eventId = parseInt(req.params.id);
      
      // Get the event before deleting it so we can include its info in the WebSocket message
      const eventToDelete = await storage.getEvent(eventId);
      
      if (!eventToDelete) {
        return res.status(404).json({ message: "Event not found" });
      }
      await assertCanPermanentDelete(req, Number((eventToDelete as any).createdBy ?? (eventToDelete as any).created_by));
      
      await storage.deleteEvent(eventId);
      
      // Broadcast event deletion to all connected clients
      broadcastWebSocketMessage('calendar_update', {
        action: 'delete',
        eventId: eventId,
        event: eventToDelete,
        timestamp: new Date().toISOString(),
        userId: req.user.id
      });
      
      // WebSocket disabled
      console.log(`Calendar event deleted: ID=${eventId}, Title="${eventToDelete.title}"`);
      
      res.sendStatus(200);
    } catch (err) {
      if (err instanceof PermanentDeletePermissionError) return res.status(403).json({ message: err.message });
      if (err instanceof LegalHoldError) return res.status(423).json({ error: "legal_hold", message: err.message });
      console.error("Error deleting event:", err);
      res.status(500).json({ message: "Failed to delete event" });
    }
  });
  
  // Add endpoint to delete an entire recurring event series
  app.delete("/api/events/:id/series", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      await assertCanPermanentDelete(req);
      const eventId = parseInt(req.params.id);
      
      // Get the parent event before deleting the series
      const parentEvent = await storage.getEvent(eventId);
      
      if (!parentEvent) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      await storage.deleteEventSeries(eventId);
      
      // Broadcast event series deletion to all connected clients
      broadcastWebSocketMessage('calendar_update', {
        action: 'delete_series',
        eventId: eventId,
        parentEvent: parentEvent
      });
      
      res.sendStatus(200);
    } catch (err) {
      if (err instanceof PermanentDeletePermissionError) return res.status(403).json({ message: err.message });
      if (err instanceof LegalHoldError) return res.status(423).json({ error: "legal_hold", message: err.message });
      console.error("Error deleting event series:", err);
      res.status(500).json({ message: "Failed to delete event series" });
    }
  });
  
  // Add endpoint to delete all events (admin only)
  app.delete("/api/events", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      await assertCanPermanentDelete(req);
      await storage.deleteAllEvents();
      
      // Broadcast a message to all clients that all events have been deleted
      broadcastWebSocketMessage('calendar_update', {
        action: 'delete_all'
      });
      
      res.status(200).json({ message: "All events have been deleted successfully" });
    } catch (err) {
      if (err instanceof PermanentDeletePermissionError) return res.status(403).json({ message: err.message });
      if (err instanceof LegalHoldError) return res.status(423).json({ error: "legal_hold", message: err.message });
      console.error("Error deleting all events:", err);
      res.status(500).json({ message: "Failed to delete all events" });
    }
  });

  // Analyze events for timezone migration (admin only)
  app.get("/api/admin/events/timezone-migration/analyze", requireAdmin, async (req, res) => {
    try {
      const { formatInTimeZone } = await import('date-fns-tz');
      const allEvents = await storage.getEvents();
      
      // Identify events that need fixing:
      // - Events created during EDT months (March-November) with incorrect UTC timestamps
      // - These events were stored with EST offset (UTC-5) instead of EDT offset (UTC-4)
      const eventsNeedingFix: any[] = [];
      
      for (const event of allEvents) {
        const startDate = new Date(event.startDate);
        const month = startDate.getUTCMonth(); // 0-based: 0=Jan, 11=Dec
        
        // EDT is typically March (2) through November (10)
        // Check if the event is in EDT months (March-November) 
        if (month >= 2 && month <= 10) {
          // Get the hour in Florida timezone
          const floridaTime = formatInTimeZone(startDate, 'America/New_York', 'HH:mm');
          const utcTime = formatInTimeZone(startDate, 'UTC', 'HH:mm');
          
          // If this event was created with EST offset during EDT months,
          // the UTC time will be 1 hour later than it should be
          // We can detect this by checking if subtracting 1 hour makes it align correctly
          
          eventsNeedingFix.push({
            id: event.id,
            title: event.title,
            startDate: event.startDate,
            endDate: event.endDate,
            currentFloridaTime: floridaTime,
            currentUTC: utcTime,
            wouldBeCorrected: new Date(startDate.getTime() - 3600000).toISOString(), // Subtract 1 hour
          });
        }
      }
      
      res.json({
        totalEvents: allEvents.length,
        eventsNeedingFix: eventsNeedingFix.length,
        events: eventsNeedingFix
      });
    } catch (err) {
      console.error("Error analyzing events for timezone migration:", err);
      res.status(500).json({ message: "Failed to analyze events" });
    }
  });

  // Apply timezone migration fix (admin only)
  app.post("/api/admin/events/timezone-migration/apply", requireAdmin, async (req, res) => {
    try {
      const { eventIds } = req.body;
      
      if (!Array.isArray(eventIds) || eventIds.length === 0) {
        return res.status(400).json({ message: "No event IDs provided" });
      }
      
      let fixedCount = 0;
      const errors: string[] = [];
      
      for (const eventId of eventIds) {
        try {
          const event = await storage.getEvent(eventId);
          if (!event) {
            errors.push(`Event ${eventId} not found`);
            continue;
          }
          
          // Subtract 1 hour from start and end dates to fix EDT offset issue
          const fixedStartDate = new Date(new Date(event.startDate).getTime() - 3600000);
          const fixedEndDate = new Date(new Date(event.endDate).getTime() - 3600000);
          
          await storage.updateEvent(eventId, {
            ...event,
            startDate: fixedStartDate.toISOString(),
            endDate: fixedEndDate.toISOString(),
          });
          
          fixedCount++;
        } catch (error) {
          errors.push(`Failed to fix event ${eventId}: ${error.message}`);
        }
      }
      
      res.json({
        message: `Successfully fixed ${fixedCount} events`,
        fixedCount,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (err) {
      console.error("Error applying timezone migration:", err);
      res.status(500).json({ message: "Failed to apply timezone migration" });
    }
  });

  // Send calendar event notifications for events within 3 days (admin only)
  app.post("/api/admin/send-calendar-events/week", requireAdmin, async (req, res) => {
    try {
      const { notifyPreference = "everyone" } = req.body;
      const allEvents = publicOnly(await storage.getEvents());
      const allUsers = await storage.getAllUsers();
      
      // Use Florida/Eastern Time for all date calculations
      const FLORIDA_TZ = 'America/New_York';
      const now = new Date();
      
      // Get current time in Florida timezone for logging
      const nowInFlorida = formatInTimeZone(now, FLORIDA_TZ, 'yyyy-MM-dd HH:mm:ss');
      console.log(`[Calendar 3-Day Email] Current server time: ${now.toISOString()}`);
      console.log(`[Calendar 3-Day Email] Current time in Florida: ${nowInFlorida}`);
      
      // Calculate the date range for the next 3 days in Florida timezone
      // Get today's date in Florida (as a string)
      const todayDateFL = formatInTimeZone(now, FLORIDA_TZ, 'yyyy-MM-dd');
      
      // Calculate the date 3 days from today by parsing as UTC and adding 3 days
      const todayDate = new Date(todayDateFL + 'T12:00:00Z'); // Parse as UTC (noon to avoid DST issues)
      const threeDaysFromNowDate = addDays(todayDate, 3);
      const threeDaysFromNowDateFL = threeDaysFromNowDate.toISOString().split('T')[0]; // Extract yyyy-MM-dd
      
      // Create the end boundary at 11:59 PM on the third day from now in Florida timezone using fromZonedTime
      const rangeEndUTC = fromZonedTime(threeDaysFromNowDateFL + 'T23:59:59.999', FLORIDA_TZ);
      
      console.log(`[Calendar 3-Day Email] Range end date in Florida: ${threeDaysFromNowDateFL}`);
      console.log(`[Calendar 3-Day Email] Range: now to ${formatInTimeZone(rangeEndUTC, FLORIDA_TZ, 'yyyy-MM-dd HH:mm:ss')} ET`);
      console.log(`[Calendar 3-Day Email] Range in UTC: ${now.toISOString()} to ${rangeEndUTC.toISOString()}`);
      
      const upcomingEvents = allEvents.filter(event => {
        const eventStartDate = new Date(event.startDate);
        const eventEndDate = new Date(event.endDate);
        
        // Event is included if:
        // 1. It starts within the next 3 days (eventStart >= now AND eventStart <= rangeEnd)
        // OR
        // 2. It's ongoing (started before now but ends after now)
        const isWithinRange = (eventStartDate >= now && eventStartDate <= rangeEndUTC) || 
                              (eventStartDate < now && eventEndDate >= now);
        
        // Log for debugging
        const eventStartInFlorida = formatInTimeZone(eventStartDate, FLORIDA_TZ, 'yyyy-MM-dd HH:mm:ss');
        const eventEndInFlorida = formatInTimeZone(eventEndDate, FLORIDA_TZ, 'yyyy-MM-dd HH:mm:ss');
        
        if (isWithinRange) {
          console.log(`[Calendar 3-Day Email] ✓ Including event #${event.id}: "${event.title}" from ${eventStartInFlorida} to ${eventEndInFlorida} ET`);
        } else {
          console.log(`[Calendar 3-Day Email] ✗ Excluding event #${event.id}: "${event.title}" at ${eventStartInFlorida} ET (outside 3-day range)`);
        }
        
        return isWithinRange;
      });

      if (upcomingEvents.length === 0) {
        return res.status(200).json({ 
          message: "No events found within the next 3 days",
          sentCount: 0,
          totalCount: 0,
          eventCount: 0,
          recipientEmails: [],
          warning: true
        });
      }

      // Resolve recipients (shared with /today and /day handlers)
      const resolution = resolveCalendarNotificationRecipients(
        notifyPreference,
        allUsers,
        req.user,
      );

      if (resolution.kind === "none") {
        return res.status(200).json(buildCalendarNonePreferenceResponse(upcomingEvents.length));
      }
      if (resolution.kind === "noRecipients") {
        return res.status(200).json(buildCalendarNoRecipientsResponse(upcomingEvents.length));
      }

      const { recipientEmails, uniqueNotifiedUsers, uniqueRecipientEmails } = resolution;

      const result = await sendCalendarEventNotificationEmail(
        upcomingEvents,
        recipientEmails,
        3
      );

      if (result.sentCount === 0 && result.totalCount > 0) {
        return res.status(200).json(
          buildCalendarPartialFailureResponse(
            result.totalCount,
            upcomingEvents.length,
            uniqueRecipientEmails,
          ),
        );
      }

      res.status(200).json(
        buildCalendarSuccessResponse({
          message: `Sent calendar notifications to ${result.sentCount} of ${result.totalCount} users`,
          sentCount: result.sentCount,
          totalCount: result.totalCount,
          eventCount: upcomingEvents.length,
          uniqueRecipientEmails,
          uniqueNotifiedUsers,
          success: result.success,
        }),
      );
    } catch (err) {
      console.error("Error sending 3-day calendar notifications:", err);
      res.status(500).json({ 
        message: "Failed to send calendar notifications",
        recipientEmails: []
      });
    }
  });

  // Send calendar event notifications for events happening today (admin only)
  app.post("/api/admin/send-calendar-events/today", requireAdmin, async (req, res) => {
    try {
      const { notifyPreference = "everyone" } = req.body;
      const allEvents = publicOnly(await storage.getEvents());
      const allUsers = await storage.getUsers();

      const FLORIDA_TZ = 'America/New_York';
      const now = new Date();

      const nowInFlorida = formatInTimeZone(now, FLORIDA_TZ, 'yyyy-MM-dd HH:mm:ss');
      console.log(`[Calendar Today Email] Current server time: ${now.toISOString()}`);
      console.log(`[Calendar Today Email] Current time in Florida: ${nowInFlorida}`);

      const todayDateFL = formatInTimeZone(now, FLORIDA_TZ, 'yyyy-MM-dd');
      const todayStartUTC = fromZonedTime(todayDateFL + 'T00:00:00', FLORIDA_TZ);
      const todayEndUTC = fromZonedTime(todayDateFL + 'T23:59:59.999', FLORIDA_TZ);

      console.log(`[Calendar Today Email] Today in Florida: ${todayDateFL}`);
      console.log(`[Calendar Today Email] Today range in UTC: ${todayStartUTC.toISOString()} to ${todayEndUTC.toISOString()}`);

      const rawTodayEvents = allEvents.filter(event => {
        const eventStartDate = new Date(event.startDate);
        const eventEndDate = new Date(event.endDate);
        const eventDateInFlorida = formatInTimeZone(eventStartDate, FLORIDA_TZ, 'yyyy-MM-dd');
        const isToday = eventDateInFlorida === todayDateFL;
        const isPlatinumSponsor = event.category === 'platinum_sponsor';
        const isActiveSponsor = isPlatinumSponsor &&
          eventStartDate <= todayEndUTC && eventEndDate >= todayStartUTC;
        const eventTimeInFlorida = formatInTimeZone(eventStartDate, FLORIDA_TZ, 'yyyy-MM-dd HH:mm:ss');
        if (isToday || isActiveSponsor) {
          console.log(`[Calendar Today Email] ✓ Including event #${event.id}: "${event.title}" (date: ${eventDateInFlorida})${isActiveSponsor && !isToday ? ' [active platinum sponsor]' : ''} at ${eventTimeInFlorida} ET`);
        } else {
          console.log(`[Calendar Today Email] ✗ Excluding event #${event.id}: "${event.title}" (date: ${eventDateInFlorida} ≠ ${todayDateFL}) at ${eventTimeInFlorida} ET`);
        }
        return isToday || isActiveSponsor;
      });

      // Deduplicate platinum sponsors by parentEventId — same logic as the preview endpoint.
      const seenSponsorKeysTodayEmail = new Set<number>();
      const todayEvents = rawTodayEvents.filter(event => {
        if (event.category !== 'platinum_sponsor') return true;
        const key = event.parentEventId ?? event.id;
        if (seenSponsorKeysTodayEmail.has(key)) return false;
        seenSponsorKeysTodayEmail.add(key);
        return true;
      });

      if (todayEvents.length === 0) {
        return res.status(200).json({
          message: "No events today",
          sentCount: 0,
          totalCount: 0,
          eventCount: 0,
          recipientEmails: [],
          warning: true
        });
      }

      // Resolve recipients (shared with /week and /day handlers)
      const resolution = resolveCalendarNotificationRecipients(
        notifyPreference,
        allUsers,
        req.user,
      );

      if (resolution.kind === "none") {
        return res.status(200).json(buildCalendarNonePreferenceResponse(todayEvents.length));
      }
      if (resolution.kind === "noRecipients") {
        return res.status(200).json(buildCalendarNoRecipientsResponse(todayEvents.length));
      }

      const { recipientEmails, uniqueNotifiedUsers, uniqueRecipientEmails } = resolution;

      const emailSchedule = await storage.getCalendarEmailSchedule();
      const savedCustomOrder = emailSchedule?.customEventOrder as number[] | null | undefined;
      const savedAttachImages = emailSchedule?.attachImageEventIds as number[] | null | undefined;

      const result = await sendCalendarEventNotificationEmail(
        todayEvents,
        recipientEmails,
        0,
        {
          customEventOrder: savedCustomOrder ?? undefined,
          attachImageEventIds: savedAttachImages ?? undefined,
        }
      );

      // NOTE: Do NOT clear the one-shot fields (customEventOrder / attachImageEventIds)
      // here. Those selections are prepared for the next *scheduled* (tomorrow's)
      // send; the "Same-Day" send is an ad-hoc catch-up and must not consume them.
      // Only the /day endpoint and the automatic scheduler clear the one-shots.

      if (result.sentCount === 0 && result.totalCount > 0) {
        return res.status(200).json(
          buildCalendarPartialFailureResponse(
            result.totalCount,
            todayEvents.length,
            uniqueRecipientEmails,
          ),
        );
      }

      res.status(200).json(
        buildCalendarSuccessResponse({
          message: `Sent today's calendar notifications to ${result.sentCount} of ${result.totalCount} users`,
          sentCount: result.sentCount,
          totalCount: result.totalCount,
          eventCount: todayEvents.length,
          uniqueRecipientEmails,
          uniqueNotifiedUsers,
          success: result.success,
        }),
      );
    } catch (err) {
      console.error("Error sending today's calendar notifications:", err);
      res.status(500).json({
        message: "Failed to send today's calendar notifications",
        recipientEmails: []
      });
    }
  });

  // Send calendar event notifications for events within 1 day (admin only)
  app.post("/api/admin/send-calendar-events/day", requireAdmin, async (req, res) => {
    try {
      const { notifyPreference = "everyone" } = req.body;
      const allEvents = publicOnly(await storage.getEvents());
      const allUsers = await storage.getUsers();
      
      // Use Florida/Eastern Time for all date calculations
      const FLORIDA_TZ = 'America/New_York';
      const now = new Date();
      
      // Get current time in Florida timezone for logging
      const nowInFlorida = formatInTimeZone(now, FLORIDA_TZ, 'yyyy-MM-dd HH:mm:ss');
      console.log(`[Calendar Daily Email] Current server time: ${now.toISOString()}`);
      console.log(`[Calendar Daily Email] Current time in Florida: ${nowInFlorida}`);
      
      // Calculate tomorrow's date in Florida timezone
      // Get today's date in Florida (as a string)
      const todayDateFL = formatInTimeZone(now, FLORIDA_TZ, 'yyyy-MM-dd');
      
      // Calculate tomorrow's date by parsing as UTC and adding 1 day
      const todayDate = new Date(todayDateFL + 'T12:00:00Z'); // Parse as UTC (noon to avoid DST issues)
      const tomorrowDate = addDays(todayDate, 1);
      const tomorrowDateFL = tomorrowDate.toISOString().split('T')[0]; // Extract yyyy-MM-dd
      
      // Create explicit start and end times in Florida timezone using fromZonedTime
      // fromZonedTime interprets the string as Florida "wall clock" time and converts to UTC
      const tomorrowStartUTC = fromZonedTime(tomorrowDateFL + 'T00:00:00', FLORIDA_TZ);
      const tomorrowEndUTC = fromZonedTime(tomorrowDateFL + 'T23:59:59.999', FLORIDA_TZ);
      
      console.log(`[Calendar Daily Email] Tomorrow in Florida: ${tomorrowDateFL}`);
      console.log(`[Calendar Daily Email] Tomorrow range in Florida: ${formatInTimeZone(tomorrowStartUTC, FLORIDA_TZ, 'yyyy-MM-dd HH:mm:ss')} to ${formatInTimeZone(tomorrowEndUTC, FLORIDA_TZ, 'yyyy-MM-dd HH:mm:ss')}`);
      console.log(`[Calendar Daily Email] Tomorrow range in UTC: ${tomorrowStartUTC.toISOString()} to ${tomorrowEndUTC.toISOString()}`);
      
      const rawUpcomingEvents = allEvents.filter(event => {
        const eventStartDate = new Date(event.startDate);
        const eventEndDate = new Date(event.endDate);
        
        // Get the event's date in Florida timezone (just the date portion)
        // This ensures we compare dates in Florida time, not UTC
        const eventDateInFlorida = formatInTimeZone(eventStartDate, FLORIDA_TZ, 'yyyy-MM-dd');
        
        // Check if the event's Florida date matches tomorrow's Florida date
        // This is more reliable than timestamp comparison for edge cases
        const isTomorrow = eventDateInFlorida === tomorrowDateFL;
        
        // Also include active platinum sponsors (ongoing even if they didn't start tomorrow)
        const isPlatinumSponsor = event.category === 'platinum_sponsor';
        const isActiveSponsor = isPlatinumSponsor && 
          eventStartDate <= tomorrowEndUTC && eventEndDate >= tomorrowStartUTC;
        
        // Log for debugging
        const eventTimeInFlorida = formatInTimeZone(eventStartDate, FLORIDA_TZ, 'yyyy-MM-dd HH:mm:ss');
        if (isTomorrow || isActiveSponsor) {
          console.log(`[Calendar Daily Email] ✓ Including event #${event.id}: "${event.title}" (date: ${eventDateInFlorida})${isActiveSponsor && !isTomorrow ? ' [active platinum sponsor]' : ''} at ${eventTimeInFlorida} ET`);
        } else {
          console.log(`[Calendar Daily Email] ✗ Excluding event #${event.id}: "${event.title}" (date: ${eventDateInFlorida} ≠ ${tomorrowDateFL}) at ${eventTimeInFlorida} ET`);
        }
        
        return isTomorrow || isActiveSponsor;
      });

      // Deduplicate platinum sponsors by parentEventId — same logic as the preview endpoint.
      const seenSponsorKeysDayEmail = new Set<number>();
      const upcomingEvents = rawUpcomingEvents.filter(event => {
        if (event.category !== 'platinum_sponsor') return true;
        const key = event.parentEventId ?? event.id;
        if (seenSponsorKeysDayEmail.has(key)) return false;
        seenSponsorKeysDayEmail.add(key);
        return true;
      });

      if (upcomingEvents.length === 0) {
        return res.status(200).json({ 
          message: "No events found within the next day",
          sentCount: 0,
          totalCount: 0,
          eventCount: 0,
          recipientEmails: [],
          warning: true
        });
      }

      // Resolve recipients (shared with /week and /today handlers)
      const resolution = resolveCalendarNotificationRecipients(
        notifyPreference,
        allUsers,
        req.user,
      );

      if (resolution.kind === "none") {
        return res.status(200).json(buildCalendarNonePreferenceResponse(upcomingEvents.length));
      }
      if (resolution.kind === "noRecipients") {
        return res.status(200).json(buildCalendarNoRecipientsResponse(upcomingEvents.length));
      }

      const { recipientEmails, uniqueNotifiedUsers, uniqueRecipientEmails } = resolution;

      // Pull saved custom event order from the schedule config (if any)
      const emailSchedule = await storage.getCalendarEmailSchedule();
      const savedCustomOrder = emailSchedule?.customEventOrder as number[] | null | undefined;
      const savedAttachImages = emailSchedule?.attachImageEventIds as number[] | null | undefined;

      const result = await sendCalendarEventNotificationEmail(
        upcomingEvents,
        recipientEmails,
        1,
        {
          customEventOrder: savedCustomOrder ?? undefined,
          attachImageEventIds: savedAttachImages ?? undefined,
        }
      );

      const manualSendFailed = result.sentCount === 0 && result.totalCount > 0;

      // Only a manual send to the SAME audience the automatic scheduler targets
      // counts as the canonical daily run. A NARROWER send (e.g. a "justme" test
      // send) must NOT stamp lastSentAt — doing so would wrongly suppress the
      // real broadcast scheduled later that day. A zero-delivery outcome
      // (recipients existed but none received it) is recorded as a failure.
      const scheduledPreference = emailSchedule?.notifyPreference ?? "everyone";
      const isCanonicalDailyRun = notifyPreference === scheduledPreference;

      if (isCanonicalDailyRun) {
        const manualRunStatus = manualSendFailed ? "partial_failure" : "sent";
        const manualRunDetail = manualSendFailed
          ? `Manual send: delivered to 0 of ${result.totalCount} recipient(s) for ${upcomingEvents.length} event(s).`
          : `Manually sent to ${result.sentCount} of ${result.totalCount} recipient(s) covering ${upcomingEvents.length} event(s).`;
        const priorRuns = Array.isArray(emailSchedule?.recentRuns)
          ? (emailSchedule!.recentRuns as CalendarEmailRunHistoryEntry[])
          : [];
        const manualRunEntry: CalendarEmailRunHistoryEntry = {
          status: manualRunStatus,
          detail: manualRunDetail,
          at: now.toISOString(),
        };
        const nextRecentRuns = [manualRunEntry, ...priorRuns].slice(0, MAX_RUN_HISTORY);
        // Upsert (creates the row if absent) so the run is tracked for the
        // watchdog/health, and clear the one-shot fields the send consumed.
        await storage.upsertCalendarEmailSchedule({
          lastSentAt: now,
          lastRunAt: now,
          lastRunStatus: manualRunStatus,
          lastRunDetail: manualRunDetail,
          recentRuns: nextRecentRuns,
          customEventOrder: null,
          attachImageEventIds: null,
        });
      } else if (emailSchedule) {
        // Narrow/ad-hoc send: still clear the one-shot fields it consumed, but do
        // NOT record it as the daily run or stamp lastSentAt.
        await storage.upsertCalendarEmailSchedule({ customEventOrder: null, attachImageEventIds: null });
      }

      if (manualSendFailed) {
        return res.status(200).json(
          buildCalendarPartialFailureResponse(
            result.totalCount,
            upcomingEvents.length,
            uniqueRecipientEmails,
          ),
        );
      }

      res.status(200).json(
        buildCalendarSuccessResponse({
          message: `Sent calendar notifications to ${result.sentCount} of ${result.totalCount} users`,
          sentCount: result.sentCount,
          totalCount: result.totalCount,
          eventCount: upcomingEvents.length,
          uniqueRecipientEmails,
          uniqueNotifiedUsers,
          success: result.success,
        }),
      );
    } catch (err) {
      console.error("Error sending daily calendar notifications:", err);
      res.status(500).json({ 
        message: "Failed to send calendar notifications",
        recipientEmails: []
      });
    }
  });

  // Calendar email recipients preview — GET
  // Returns list of users who would receive the email for a given notify preference.
  // For "justme": uses the current session user (or the stored adminUserId if context=schedule).
  app.get("/api/admin/calendar-email-recipients", requireAdmin, async (req, res) => {
    try {
      const notifyPreference = req.query.notifyPreference as string;
      const context = req.query.context as string | undefined; // "schedule" | "manual"
      const validPrefs = ['none', 'justme', 'admins', 'everyone'];
      if (!validPrefs.includes(notifyPreference)) {
        return res.status(400).json({ message: "Invalid notifyPreference" });
      }

      if (notifyPreference === 'none') {
        return res.json({ users: [], count: 0 });
      }

      const allUsers = await storage.getUsers();

      if (notifyPreference === 'justme') {
        if (context === 'schedule') {
          // Mirror scheduler logic exactly (resolveScheduledCalendarRecipients):
          // resolve via the stored adminUserId with the same eligibility checks.
          // If that admin is missing/ineligible we DO NOT fall back to all admins —
          // we return an empty list so the preview matches what the scheduler does
          // (skip + escalate) instead of implying the digest will go to everyone.
          const schedule = await storage.getCalendarEmailSchedule();
          const adminUserId = (schedule as { adminUserId?: number | null })?.adminUserId;
          if (adminUserId) {
            const adminUser = allUsers.find(u => u.id === adminUserId);
            if (adminUser?.email && !adminUser.isBlocked && adminUser.emailNotificationsEnabled !== false) {
              return res.json({
                users: [{ username: adminUser.username, email: adminUser.email }],
                count: 1,
              });
            }
          }
          // No eligible stored admin → no recipients (scheduler will skip + escalate)
          return res.json({ users: [], count: 0 });
        }
        // Manual context: use current session user
        if (req.user?.email) {
          return res.json({
            users: [{ username: req.user.username, email: req.user.email }],
            count: 1,
          });
        }
        return res.json({ users: [], count: 0 });
      }

      if (notifyPreference === 'admins') {
        const adminUsers = allUsers.filter(
          u => u.email && !u.isBlocked && u.role === 'admin' && u.emailNotificationsEnabled !== false
        );
        return res.json({
          users: adminUsers.map(u => ({ username: u.username, email: u.email })),
          count: adminUsers.length,
        });
      }

      // "everyone"
      const eligibleUsers = allUsers.filter(
        u => u.email && !u.isBlocked && u.emailNotificationsEnabled !== false
      );
      return res.json({
        users: eligibleUsers.map(u => ({ username: u.username, email: u.email })),
        count: eligibleUsers.length,
      });
    } catch (err) {
      console.error("Error fetching calendar email recipients:", err);
      res.status(500).json({ message: "Failed to fetch recipients" });
    }
  });

  // Calendar email schedule config — GET
  app.get("/api/admin/calendar-email-schedule", requireAdmin, async (req, res) => {
    try {
      const schedule = await storage.getCalendarEmailSchedule();
      // Read-only health verdict (no side effects) so the admin panel can show a
      // healthy / attention-needed indicator without waiting for an escalation email.
      const health = computeCalendarEmailHealth(schedule);
      res.json(schedule ? { ...schedule, health } : {
        enabled: false,
        sendTime: "08:00",
        notifyPreference: "everyone",
        customEventOrder: null,
        attachImageEventIds: null,
        lastSentAt: null,
        lastRunAt: null,
        lastRunStatus: null,
        lastRunDetail: null,
        recentRuns: null,
        lastEscalationAt: null,
        lastWatchdogAt: null,
        health,
        heartbeatEnabled: false,
        lastHeartbeatAt: null,
      });
    } catch (err) {
      console.error("Error fetching calendar email schedule:", err);
      res.status(500).json({ message: "Failed to fetch calendar email schedule" });
    }
  });

  // Calendar email schedule config — PUT
  app.put("/api/admin/calendar-email-schedule", requireAdmin, async (req, res) => {
    try {
      const { enabled, sendTime, notifyPreference, customEventOrder, attachImageEventIds, heartbeatEnabled } = req.body;

      // Basic server-side validation
      const validNotifyPrefs = ['none', 'justme', 'admins', 'everyone'];
      if (notifyPreference !== undefined && !validNotifyPrefs.includes(notifyPreference)) {
        return res.status(400).json({ message: "Invalid notifyPreference value" });
      }
      if (sendTime !== undefined && (typeof sendTime !== 'string' || !/^\d{2}:\d{2}$/.test(sendTime))) {
        return res.status(400).json({ message: "sendTime must be HH:MM format" });
      }
      if (customEventOrder !== null && customEventOrder !== undefined) {
        if (!Array.isArray(customEventOrder) || customEventOrder.some((id: unknown) => typeof id !== 'number')) {
          return res.status(400).json({ message: "customEventOrder must be an array of numbers" });
        }
      }
      if (attachImageEventIds !== null && attachImageEventIds !== undefined) {
        if (!Array.isArray(attachImageEventIds) || attachImageEventIds.some((id: unknown) => typeof id !== 'number')) {
          return res.status(400).json({ message: "attachImageEventIds must be an array of numbers" });
        }
      }

      const updated = await storage.upsertCalendarEmailSchedule({
        ...(enabled !== undefined && { enabled: Boolean(enabled) }),
        ...(sendTime !== undefined && { sendTime }),
        ...(notifyPreference !== undefined && { notifyPreference }),
        // Always store the current admin's user ID for "justme" resolution in the scheduler
        ...(req.user?.id !== undefined && { adminUserId: req.user.id }),
        ...(customEventOrder !== undefined && { customEventOrder }),
        ...(attachImageEventIds !== undefined && { attachImageEventIds }),
        ...(heartbeatEnabled !== undefined && { heartbeatEnabled: Boolean(heartbeatEnabled) }),
      });
      res.json(updated);
    } catch (err) {
      console.error("Error updating calendar email schedule:", err);
      res.status(500).json({ message: "Failed to update calendar email schedule" });
    }
  });

  // External calendar-email watchdog verifier — GET (no admin session required)
  //
  // This is the INDEPENDENT, out-of-process check for "did the daily calendar
  // email stop going out?". An external uptime monitor or scheduled job (e.g. a
  // Replit Scheduled Deployment / cron that curls this URL once a day, or
  // UptimeRobot) polls it on its OWN clock — completely outside the API server's
  // in-process timers. On each poll it re-runs the missed-day check and, if a
  // fully-elapsed expected-send day has no recorded run, fires the SAME admin
  // escalation email the scheduler uses. It returns:
  //   - 200 when healthy (a run was recorded, or nothing to watch)
  //   - 503 when a missed day is detected (so an HTTP-status uptime monitor also
  //     alerts independently of email), having just triggered the admin alert
  //   - 500 on an internal error during the check
  // If the whole app is down, the monitor's request simply fails — which is the
  // out-of-band signal of a total outage that no in-process check could catch.
  //
  // Optionally lock down with the CALENDAR_WATCHDOG_TOKEN env var; when set, the
  // request must present it via `?token=` or the `x-watchdog-token` header.
  // Re-alerting is de-duped per missed day (lastWatchdogAt CAS), so frequent
  // polling cannot spam admins.
  app.get("/api/system/calendar-email-watchdog", async (req, res) => {
    try {
      const requiredToken = process.env.CALENDAR_WATCHDOG_TOKEN;
      if (requiredToken) {
        const provided =
          (typeof req.query.token === "string" ? req.query.token : undefined) ??
          (typeof req.headers["x-watchdog-token"] === "string"
            ? (req.headers["x-watchdog-token"] as string)
            : undefined);
        if (provided !== requiredToken) {
          return res.status(401).json({ status: "unauthorized" });
        }
      }

      const result = await runCalendarEmailWatchdog();
      const body = {
        status: result.reason === "error" ? "error" : result.healthy ? "ok" : "missed",
        healthy: result.healthy,
        missed: result.missed,
        alerted: result.alerted,
        expectedDay: result.expectedDay ?? null,
        reason: result.reason,
        checkedAt: new Date().toISOString(),
      };

      if (result.reason === "error") {
        return res.status(500).json(body);
      }
      // A detected miss returns 503 so an external HTTP monitor flags it too.
      return res.status(result.healthy ? 200 : 503).json(body);
    } catch (err) {
      req.log?.error?.(
        { err: err instanceof Error ? err.message : String(err) },
        "Calendar email watchdog endpoint failed",
      );
      return res.status(500).json({ status: "error" });
    }
  });

  // Calendar email preview — GET
  // Returns the rendered email HTML (no send) using tomorrow's events and optional params
  app.get("/api/admin/calendar-email-preview", requireAdmin, async (req, res) => {
    try {
      const { buildCalendarEmailPreview } = await import('./sendgrid-service');
      const { formatInTimeZone, fromZonedTime } = await import("date-fns-tz");
      const { addDays } = await import("date-fns");

      const FLORIDA_TZ = 'America/New_York';
      const now = new Date();
      const todayDateFL = formatInTimeZone(now, FLORIDA_TZ, 'yyyy-MM-dd');
      const todayDate = new Date(todayDateFL + 'T12:00:00Z');
      const tomorrowDate = addDays(todayDate, 1);
      const tomorrowDateFL = tomorrowDate.toISOString().split('T')[0];
      const tomorrowStartUTC = fromZonedTime(tomorrowDateFL + 'T00:00:00', FLORIDA_TZ);
      const tomorrowEndUTC = fromZonedTime(tomorrowDateFL + 'T23:59:59.999', FLORIDA_TZ);

      const allEvents = publicOnly(await storage.getEvents());
      const rawUpcomingEvents = allEvents.filter(event => {
        const eventStartDate = new Date(event.startDate);
        const eventEndDate = new Date(event.endDate);
        const eventDateInFlorida = formatInTimeZone(eventStartDate, FLORIDA_TZ, 'yyyy-MM-dd');
        const isTomorrow = eventDateInFlorida === tomorrowDateFL;
        const isPlatinumSponsor = event.category === 'platinum_sponsor';
        const isActiveSponsor = isPlatinumSponsor && eventStartDate <= tomorrowEndUTC && eventEndDate >= tomorrowStartUTC;
        return isTomorrow || isActiveSponsor;
      });

      // Deduplicate platinum sponsors by parentEventId (same logic as sendgrid-service.ts).
      // A recurring platinum sponsor can produce both a parent row and a child row that both
      // pass the filter above; keep only the first (canonical) entry per sponsor family.
      const seenSponsorKeys = new Set<number>();
      const upcomingEvents = rawUpcomingEvents.filter(event => {
        if (event.category !== 'platinum_sponsor') return true;
        const key = event.parentEventId ?? event.id;
        if (seenSponsorKeys.has(key)) return false;
        seenSponsorKeys.add(key);
        return true;
      });

      // Parse and validate query params
      let customEventOrder: number[] | undefined;
      let attachImageEventIds: number[] | undefined;
      if (req.query.eventOrder) {
        try {
          const parsed = JSON.parse(req.query.eventOrder as string);
          if (Array.isArray(parsed) && parsed.every((id: unknown) => typeof id === 'number')) {
            customEventOrder = parsed;
          }
        } catch {}
      }
      if (req.query.attachImages) {
        try {
          const parsed = JSON.parse(req.query.attachImages as string);
          if (Array.isArray(parsed) && parsed.every((id: unknown) => typeof id === 'number')) {
            attachImageEventIds = parsed;
          }
        } catch {}
      }

      const { subject, html } = await buildCalendarEmailPreview(
        upcomingEvents,
        1,
        { customEventOrder, attachImageEventIds }
      );

      // Sort events to match the actual rendered order for the drag list.
      // When a custom order is provided, use that sequence (all events unified).
      // Otherwise use the default: platinum sponsors first, then promotional, then regular — all chronologically.
      const sortedForResponse = (() => {
        if (customEventOrder && customEventOrder.length > 0) {
          const orderedIds = new Set(customEventOrder);
          const orderedPart = customEventOrder
            .map((id: number) => upcomingEvents.find(e => e.id === id))
            .filter(Boolean) as typeof upcomingEvents;
          const remaining = upcomingEvents.filter(e => !orderedIds.has(e.id));
          return [...orderedPart, ...remaining];
        }
        const platinumEvents = upcomingEvents.filter(e => e.category === 'platinum_sponsor');
        const nonPlatinum = upcomingEvents.filter(e => e.category !== 'platinum_sponsor');
        const promotionalEvents = nonPlatinum.filter(e => e.category === 'promotional');
        const regularEvents = nonPlatinum.filter(e => e.category !== 'promotional');
        const byDate = (a: typeof upcomingEvents[0], b: typeof upcomingEvents[0]) =>
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        return [
          ...platinumEvents.sort(byDate),
          ...promotionalEvents.sort(byDate),
          ...regularEvents.sort(byDate),
        ];
      })();

      res.json({
        subject,
        html,
        events: sortedForResponse.map(e => ({
          id: e.id,
          title: e.title,
          category: e.category,
          startDate: e.startDate,
          mediaUrls: e.mediaUrls,
        })),
      });
    } catch (err) {
      console.error("Error generating calendar email preview:", err);
      res.status(500).json({ message: "Failed to generate email preview" });
    }
  });

  // Simple auth check endpoint to verify authentication status
  app.get("/api/auth/check", (req, res) => {
    const authInfo = {
      isAuthenticated: req.isAuthenticated(),
      user: req.user ? {
        id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        isApproved: req.user.isApproved,
        isBlocked: req.user.isBlocked
      } : null
    };
    
    // Log the auth check for debugging
    console.log("Auth check requested", {
      isAuthenticated: authInfo.isAuthenticated,
      user: authInfo.user,
      sessionID: req.sessionID,
      cookies: req.headers.cookie,
      origin: req.headers.origin,
      host: req.hostname
    });
    
    res.json(authInfo);
  });
  
  // Debug route to check cookies and authentication settings
  app.get("/api/debug/auth", (req, res) => {
    // Safe to log these details for debugging - no sensitive data exposed
    const cookies = req.headers.cookie || 'No cookies';
    const authHeader = req.headers.authorization || 'No Authorization header';
    const hasSession = !!req.session;
    const sessionID = req.sessionID || 'No session ID';
    const isAuth = req.isAuthenticated();
    const userInfo = req.user ? {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      isApproved: req.user.isApproved,
      isBlocked: req.user.isBlocked
    } : null;
    
    // Information about the request
    const requestInfo = {
      protocol: req.protocol,
      secure: req.secure,
      hostname: req.hostname,
      originalUrl: req.originalUrl,
      ip: req.ip,
      method: req.method,
      path: req.path,
      userAgent: req.headers['user-agent'],
      referrer: req.headers.referer || req.headers.referrer || 'None'
    };
    
    // App-level configuration
    const configInfo = {
      nodeEnv: process.env.NODE_ENV,
      cookieSecure: process.env.COOKIE_SECURE,
      cookieDomain: process.env.COOKIE_DOMAIN,
      trustProxy: process.env.TRUST_PROXY || 'Not set',
      port: process.env.PORT || 5000
    };
    
    // Return all debug information
    res.json({
      hasSession,
      sessionID,
      isAuthenticated: isAuth,
      user: userInfo,
      requestInfo,
      configInfo
    });
  });
  
  // Debug endpoint to check event media status
  app.get("/api/debug/check-event-media", async (req, res) => {
    try {
      // Get all events (public: published only)
      const events = publicOnly(await storage.getEvents());
      
      // Count events with media
      const eventsWithMedia = events.filter(event => 
        event.mediaUrls && event.mediaUrls.length > 0
      ).length;
      
      // Process events to add media status
      const processedEvents = events.map(event => {
        // Add media status information
        let mediaStatus = 'No Media';
        
        if (event.mediaUrls && event.mediaUrls.length > 0) {
          const mediaUrl = event.mediaUrls[0];
          
          if (mediaUrl.includes('/api/storage-proxy/CALENDAR/events/')) {
            mediaStatus = 'Proxy Format';
          } else if (mediaUrl.includes('object-storage.replit.app')) {
            mediaStatus = 'Direct Object Storage URL';
          } else if (mediaUrl.startsWith('/uploads/') || mediaUrl.startsWith('/calendar/')) {
            mediaStatus = 'Legacy File Path';
          } else {
            mediaStatus = 'Unknown Format';
          }
        }
        
        return {
          ...event,
          mediaStatus
        };
      });
      
      return res.json({
        count: events.length,
        eventsWithMedia,
        events: processedEvents
      });
    } catch (error) {
      console.error('[CheckEventMedia] Error:', error);
      return res.status(500).json({ message: `Error: ${error.message}` });
    }
  });
  
  // Special memory storage for test uploads
  const memoryStorage = multer.memoryStorage();
  const memoryUpload = multer({
    storage: memoryStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (_req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`File type ${file.mimetype} not allowed. Only ${allowedTypes.join(', ')} are supported.`));
      }
    }
  });

  // Debug endpoint for testing event media uploads
  app.post("/api/debug/test-event-media-upload", memoryUpload.single('testImage'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false,
          message: 'No file uploaded' 
        });
      }
      
      const file = req.file;
      console.log(`[TestEventMediaUpload] Received file: ${file.originalname}, size: ${file.size} bytes`);
      
      // Create a unique filename
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 8);
      const filename = `media-${timestamp}-${randomString}${path.extname(file.originalname)}`;
      
      // Storage key and proxy URL
      const storageKey = `events/${filename}`;
      const proxyUrl = `/api/storage-proxy/CALENDAR/events/${filename}`;
      
      try {
        // Get bucket name for CALENDAR
        const calendarBucket = objectStorageService.getBucketForMediaType('calendar');
        
        // Save the file temporarily to disk
        const tempPath = path.join('uploads', 'temp', filename);
        const tempDir = path.dirname(tempPath);
        
        // Create temp directory if it doesn't exist
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Write the file buffer to disk
        fs.writeFileSync(tempPath, file.buffer);
        
        console.log(`[TestEventMediaUpload] Saved temp file to ${tempPath}, size: ${file.size} bytes`);
        
        try {
          if (!file.buffer) {
            throw new Error('File buffer is missing or empty');
          }
            
          console.log(`[TestEventMediaUpload] Uploading file buffer (size: ${file.buffer.length} bytes) to bucket: ${calendarBucket}`);
            
          // Upload to Object Storage using uploadData method
          const objectStorageUrl = await objectStorageService.uploadData(
            file.buffer,
            'events',  // use events as the media type for calendar events
            filename,
            file.mimetype,
            calendarBucket
          );
          
          console.log(`[TestEventMediaUpload] Successfully uploaded file to Object Storage: ${objectStorageUrl}`);
          
          // Clean up temp file
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }
          
          // Return success with the proxy URL
          return res.status(200).json({
            success: true,
            message: 'File uploaded successfully',
            url: proxyUrl,
            directUrl: objectStorageUrl,
            filename,
            size: file.size,
            mimetype: file.mimetype,
            bucket: calendarBucket
          });
        } catch (uploadError) {
          console.error('[TestEventMediaUpload] Error uploading to Object Storage:', uploadError);
          return res.status(500).json({
            success: false, 
            message: 'Upload failed', 
            error: uploadError.message
          });
        }
      } catch (error) {
        console.error('[TestEventMediaUpload] Error handling file upload:', error);
        return res.status(500).json({
          success: false, 
          message: 'Upload failed', 
          error: error.message
        });
      }
    } catch (error) {
      console.error('[TestEventMediaUpload] Error:', error);
      return res.status(500).json({ message: `Error: ${error.message}` });
    }
  });

  // Debug endpoint to check bucket contents
  app.get('/api/debug/check-bucket-contents', async (req, res) => {
    try {
      // Get the bucket name for calendar
      const calendarBucket = objectStorageService.getBucketForMediaType('calendar');
      
      console.log(`[BucketContents] Getting files from bucket: ${calendarBucket}, prefix: events/`);
      
      try {
        // Get files directly from object storage client to see raw list
        let result = null;
        
        try {
          console.log('[BucketContents] Attempting listWithPrefix with bucket header:', calendarBucket);
          result = await objectStorageService.client.listWithPrefix('events/', {
            bucketName: calendarBucket,
            headers: {
              'X-Obj-Bucket': calendarBucket
            }
          });
        } catch (listError) {
          console.error('[BucketContents] Error from listWithPrefix:', listError);
          result = null;
        }
        
        if (!result || !result.ok) {
          console.log('[BucketContents] No results from listWithPrefix, trying direct listFiles');
          // Fallback to standard listFiles
          console.log('[BucketContents] Calling listFiles with prefix events/');
          result = { ok: true, value: await objectStorageService.listFiles('events/', calendarBucket) || [] };
        }
        
        // Get the files from the result
        const files = result && result.ok ? result.value : [];
        
        console.log(`[BucketContents] Found ${files.length} files in ${calendarBucket} bucket with events/ prefix`);
        
        return res.status(200).json({
          success: true,
          bucket: calendarBucket,
          prefix: 'events/',
          files: Array.isArray(files) ? files.map(item => {
            // Handle both string array and object array formats
            if (typeof item === 'string') {
              return { key: item, size: 0, lastModified: new Date() };
            } else {
              return {
                key: item.key || 'unknown',
                size: item.size || 0,
                lastModified: item.lastModified || new Date()
              };
            }
          }) : []
        });
      } catch (listError) {
        console.error('[BucketContents] Final error from list operations:', listError);
        return res.status(500).json({
          success: false,
          message: 'Failed to list bucket contents',
          error: listError.message
        });
      }
    } catch (error) {
      console.error('[BucketContents] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to check bucket contents',
        error: error.message
      });
    }
  });

  // Event interaction routes
  app.post("/api/events/:id/interactions", async (req, res) => {
    try {
      console.log("Event interaction request:", {
        session: !!req.session,
        sessionID: req.sessionID,
        isAuthenticated: req.isAuthenticated(),
        hasUser: !!req.user,
        user: req.user ? { id: req.user.id, username: req.user.username, role: req.user.role } : null,
        cookies: req.headers.cookie,
        eventId: req.params.id,
        body: req.body
      });

      if (!req.isAuthenticated()) {
        console.log("Authentication failed for event interaction");
        return res.status(401).json({ message: "Not authenticated" });
      }

      const eventId = parseInt(req.params.id);
      const { type } = req.body;

      if (!type || !['like', 'going', 'interested'].includes(type)) {
        return res.status(400).json({ message: "Invalid interaction type" });
      }
      
      // Check if user is not blocked or is admin
      const isAdmin = req.user.role === 'admin';
      const isBlocked = !!req.user.isBlocked;
      
      // User can interact if they are not blocked (admin users bypass all restrictions)
      const canInteract = !isBlocked || isAdmin;
      
      if (!canInteract) {
        // Check why the user can't interact
        if (isBlocked) {
          return res.status(403).json({ 
            message: "Your account has been blocked from interacting with events" 
          });
        } else {
          return res.status(403).json({ 
            message: "You don't have permission to interact with events" 
          });
        }
      }

      // Check if interaction already exists
      const existingInteraction = await storage.getEventInteraction(eventId, req.user.id, type);

      if (existingInteraction) {
        // If interaction exists, delete it (toggle behavior)
        await storage.deleteEventInteraction(eventId, req.user.id, type);
        res.json({ message: "Interaction removed" });
      } else {
        // Create new interaction
        const interaction = await storage.createEventInteraction({
          eventId,
          userId: req.user.id,
          interactionType: type
        });
        res.json(interaction);
      }
    } catch (err) {
      console.error("Error handling event interaction:", err);
      res.status(500).json({ message: "Failed to process interaction" });
    }
  });

  // Get event interactions
  app.get("/api/events/:id/interactions", async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const interactions = await storage.getEventInteractions(eventId);
      res.json(interactions);
    } catch (err) {
      console.error("Error fetching event interactions:", err);
      res.status(500).json({ message: "Failed to fetch interactions" });
    }
  });

  // Payment endpoints for real estate listings
  app.post("/api/payments/create-link", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const { discountCode, redirectUrl, listingType, listingDuration, amount } = req.body;
      
      // Enhanced logging
      console.log("Create payment link request received:");
      console.log("- User ID:", req.user.id);
      console.log("- Discount code:", discountCode || 'None');
      console.log("- Custom redirect URL:", redirectUrl || "Not provided (will use default)");
      console.log("- Listing type:", listingType || 'Not provided (will use FSBO)');
      console.log("- Listing duration:", listingDuration || 'Not provided (will use 30_day)');
      console.log("- Custom amount:", amount || 'Not provided (will use standard pricing)');
      console.log("- Square environment variables present:");
      console.log("  - SQUARE_ACCESS_TOKEN:", process.env.SQUARE_ACCESS_TOKEN ? "Set" : "Not set");
      console.log("  - SQUARE_APPLICATION_ID:", process.env.SQUARE_APPLICATION_ID ? "Set" : "Not set");
      console.log("  - SQUARE_LOCATION_ID:", process.env.SQUARE_LOCATION_ID ? "Set" : "Not set");
      
      // Create a payment with Square
      const { createPaymentLink } = await import('./square-service');
      
      console.log("Calling createPaymentLink function...");
      console.log("User email:", req.user.email);
      
      // Make sure redirectUrl is a string to avoid any potential null/undefined issues
      const customRedirectUrl = redirectUrl || null;
      console.log("Final custom redirect URL:", customRedirectUrl);
      
      const result = await createPaymentLink(
        req.user.id, 
        discountCode, 
        req.user.email, 
        customRedirectUrl,
        listingType,
        listingDuration,
        amount
      );
      console.log("Payment link creation successful:", result);
      
      res.json({
        success: true,
        paymentId: result.paymentId,
        paymentLinkUrl: result.paymentLinkUrl,
        paymentLinkId: result.paymentLinkId,
        isFree: result.isFree
      });
    } catch (err) {
      console.error("Error creating payment link:", err);
      // More detailed error response
      let errorMessage = "Failed to create payment link";
      if (err instanceof Error) {
        errorMessage += ": " + err.message;
        console.error("Error stack:", err.stack);
      }
      
      res.status(500).json({ 
        success: false,
        message: errorMessage
      });
    }
  });

  app.post("/api/payments/validate-discount", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const { code } = req.body;
      
      if (!code) {
        return res.status(400).json({ 
          success: false, 
          message: "Discount code is required" 
        });
      }
      
      // Import Square service functions
      const { validateDiscountCode, getPaymentAmount } = await import('./square-service');
      
      // Validate the discount code
      const discountAmount = await validateDiscountCode(code);
      const { amount } = await getPaymentAmount(code);
      
      res.json({
        success: true,
        valid: discountAmount > 0,
        discountAmount,
        finalAmount: amount
      });
    } catch (err) {
      console.error("Error validating discount code:", err);
      res.status(500).json({ 
        success: false, 
        message: "Failed to validate discount code" 
      });
    }
  });

  app.post("/api/payments/success", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const { paymentIntentId } = req.body;
      
      if (!paymentIntentId) {
        return res.status(400).json({ 
          success: false, 
          message: "Payment intent ID is required" 
        });
      }
      
      // Import Square service function
      const { handlePaymentSuccess } = await import('./square-service');
      
      // Mark the payment as successful
      const paymentId = await handlePaymentSuccess(paymentIntentId);
      
      res.json({
        success: true,
        paymentId
      });
    } catch (err) {
      console.error("Error handling payment success:", err);
      res.status(500).json({ 
        success: false, 
        message: "Failed to process successful payment" 
      });
    }
  });

  app.post("/api/payments/failure", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const { paymentIntentId } = req.body;
      
      if (!paymentIntentId) {
        return res.status(400).json({ 
          success: false, 
          message: "Payment intent ID is required" 
        });
      }
      
      // Get payment from database and update status
      const payment = await storage.getListingPaymentByIntent(paymentIntentId);
      
      if (!payment) {
        return res.status(404).json({ 
          success: false, 
          message: "Payment not found" 
        });
      }
      
      // Check if the payment belongs to the user
      if (payment.userId !== req.user.id) {
        return res.status(403).json({ 
          success: false, 
          message: "You do not have permission to access this payment" 
        });
      }
      
      // Update payment status to failed
      await storage.updateListingPayment(payment.id, {
        status: 'failed',
        updatedAt: new Date()
      });
      
      res.json({
        success: true,
        paymentId: payment.id
      });
    } catch (err) {
      console.error("Error handling payment failure:", err);
      res.status(500).json({ 
        success: false, 
        message: "Failed to process failed payment" 
      });
    }
  });
  
  // Enhanced payment verification with credit system integration
  app.post("/api/payments/verify", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const { paymentIntentId, transactionId, orderId, checkoutId, rawPaymentLinkUrl } = req.body;
      
      // Use the first non-empty ID from the provided parameters
      const paymentIdentifier = paymentIntentId || transactionId || orderId || checkoutId;
      
      console.log("Payment verification request received:");
      console.log("- User ID:", req.user.id);
      console.log("- Payment identifiers:", { paymentIntentId, transactionId, orderId, checkoutId });
      console.log("- Using identifier:", paymentIdentifier);
      console.log("- Raw payment link URL:", rawPaymentLinkUrl);
      console.log("- Full request body:", JSON.stringify(req.body, null, 2));
      
      if (!paymentIdentifier) {
        return res.status(400).json({ 
          success: false, 
          message: "Payment identifier is required" 
        });
      }
      
      // Handle special case for free payments with the FREE- prefix
      if (paymentIdentifier.startsWith('FREE-')) {
        // Extract the payment ID from the FREE- format
        const freePaymentId = parseInt(paymentIdentifier.substring(5), 10);
        if (isNaN(freePaymentId)) {
          return res.status(400).json({
            success: false,
            message: "Invalid free payment identifier format"
          });
        }
        
        // Get the payment record directly by ID
        const payment = await storage.getListingPayment(freePaymentId);
        
        if (!payment) {
          return res.status(404).json({ 
            success: false, 
            message: "Free payment not found" 
          });
        }
        
        // Check if the payment belongs to the user
        if (payment.userId !== req.user.id) {
          return res.status(403).json({ 
            success: false, 
            message: "You do not have permission to access this payment" 
          });
        }
        
        // Free payments should already be marked as completed
        // Also get user's current credit balance
        const currentCredits = await creditService.getUserCredits(req.user.id);
        
        return res.json({
          success: true,
          paymentId: payment.id,
          status: 'completed',
          credits: currentCredits
        });
      }
      
      // First check if this payment already exists in our credit system
      console.log("Checking Square payment in credit system...");
      const creditVerification = await creditService.verifySquarePayment(
        paymentIdentifier, 
        checkoutId, 
        orderId
      );
      
      if (creditVerification.success && creditVerification.payment) {
        console.log("Payment found in credit system:", creditVerification.payment);
        
        return res.json({
          success: true,
          paymentId: creditVerification.payment.id,
          status: creditVerification.payment.status,
          credits: creditVerification.credits,
          message: "Payment verified through credit system"
        });
      }
      
      // If not found in credit system, try Square API verification
      console.log("Payment not found in credit system, checking Square API...");
      
      // Import the Square verification service to handle various payment ID formats
      const { verifyPaymentStatus } = await import('./square-service');
      
      try {
        // This will handle various ID formats including Square transaction IDs
        const verificationResult = await verifyPaymentStatus(paymentIdentifier);
        
        // Log the verification result for debugging
        console.log("Square API verification result:", JSON.stringify(verificationResult, null, 2));
        
        // If this is a completed payment from Square, process it through the credit system
        if (verificationResult.isCompleted && verificationResult.paymentId) {
          console.log("Processing Square payment through credit system...");
          
          // Create Square payment record and award credits with actual payment amount
          const squarePaymentData = {
            userId: req.user.id,
            squarePaymentId: paymentIdentifier,
            orderId: orderId || paymentIdentifier,
            checkoutId: checkoutId || paymentIdentifier,
            amount: verificationResult.amount || "50.00", // Use actual payment amount from Square
            currency: "USD",
            status: 'completed' as const,
            listingType: req.body.listingType || 'standard',
            listingDuration: req.body.listingDuration || '30days'
          };
          
          const processResult = await creditService.processSquarePayment(squarePaymentData);
          
          if (processResult) {
            console.log("Square payment successfully processed through credit system");
            
            // Get updated credit balance and calculate credits added
            const currentCredits = await creditService.getUserCredits(req.user.id);
            
            // Calculate credits added based on payment amount (1 credit = $5)
            const paymentAmount = parseFloat(verificationResult.amount || "50.00");
            const creditsAdded = Math.floor(paymentAmount / 5);
            
            return res.json({
              success: true,
              paymentId: verificationResult.paymentId,
              status: 'completed',
              credits: currentCredits,
              creditsAdded: creditsAdded,
              message: "Payment verified and credits awarded"
            });
          } else {
            console.error("Failed to process Square payment through credit system");
            
            // Fall back to legacy behavior but still report success
            const currentCredits = await creditService.getUserCredits(req.user.id);
            
            return res.json({
              success: true,
              paymentId: verificationResult.paymentId,
              status: 'completed',
              credits: currentCredits,
              message: "Payment verified but credit processing failed - contact support"
            });
          }
        }
        
        // If payment is pending
        if (verificationResult.paymentId && !verificationResult.isCompleted) {
          const currentCredits = await creditService.getUserCredits(req.user.id);
          
          return res.json({
            success: true,
            paymentId: verificationResult.paymentId,
            status: 'pending',
            credits: currentCredits
          });
        }
        
        // SECURITY FIX: Do not allow users to proceed without verified payment
        console.log("Payment not found in Square API - verification failed");
        const currentCredits = await creditService.getUserCredits(req.user.id);
        
        return res.json({
          success: false,
          paymentId: 0,
          status: 'failed',
          credits: currentCredits,
          message: "Payment verification failed - payment not found in Square API"
        });
        
      } catch (verificationError) {
        console.error("Square verification error:", verificationError);
        // Fall back to legacy payment lookup
      }
      
      // Legacy flow: look up payment by intent ID in our database
      const payment = await storage.getListingPaymentByIntent(paymentIdentifier);
      
      if (!payment) {
        // SECURITY FIX: Do not allow users to proceed without valid payment record
        const currentCredits = await creditService.getUserCredits(req.user.id);
        
        return res.status(404).json({
          success: false,
          paymentId: 0,
          status: 'failed',
          credits: currentCredits,
          message: "Payment not found in database - verification failed"
        });
      }
      
      // Check if the payment belongs to the user
      if (payment.userId !== req.user.id) {
        return res.status(403).json({ 
          success: false, 
          message: "You do not have permission to access this payment" 
        });
      }
      
      // Get user's current credits
      const currentCredits = await creditService.getUserCredits(req.user.id);
      
      // If payment is already marked as completed in our database
      if (payment.status === 'completed') {
        return res.json({
          success: true,
          paymentId: payment.id,
          status: 'completed',
          credits: currentCredits
        });
      } else {
        return res.json({
          success: true,
          paymentId: payment.id,
          status: 'pending',
          credits: currentCredits
        });
      }
    } catch (err) {
      console.error("Error verifying payment:", err);
      
      // SECURITY FIX: Do not allow users to proceed when payment verification fails
      try {
        const currentCredits = await creditService.getUserCredits(req.user.id);
        res.status(500).json({
          success: false,
          paymentId: 0,
          status: 'failed',
          credits: currentCredits,
          message: "Payment verification error - cannot proceed without valid payment"
        });
      } catch (creditError) {
        console.error("Error getting user credits:", creditError);
        res.status(500).json({ 
          success: false, 
          message: "Payment verification failed and could not fetch credits" 
        });
      }
    }
  });

  // Credit Management API Endpoints
  
  // Get user's current credit balance
  app.get("/api/credits/balance", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const credits = await creditService.getUserCredits(req.user.id);
      res.json({
        success: true,
        credits,
        userId: req.user.id
      });
    } catch (error) {
      console.error("Error fetching user credits:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch credit balance"
      });
    }
  });

  // Get user's credit transaction history
  app.get("/api/credits/history", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const history = await creditService.getCreditHistory(req.user.id);
      res.json({
        success: true,
        history,
        userId: req.user.id
      });
    } catch (error) {
      console.error("Error fetching credit history:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch credit history"
      });
    }
  });

  // Check if user can publish a listing (has enough credits)
  app.get("/api/credits/can-publish", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const creditsRequired = parseInt(req.query.credits as string) || 1;
      const canPublish = await creditService.canPublishListing(req.user.id, creditsRequired);
      const currentCredits = await creditService.getUserCredits(req.user.id);
      
      res.json({
        success: true,
        canPublish,
        currentCredits,
        creditsRequired,
        userId: req.user.id
      });
    } catch (error) {
      console.error("Error checking publish eligibility:", error);
      res.status(500).json({
        success: false,
        message: "Failed to check publish eligibility"
      });
    }
  });

  // NEW Credit Purchase API Endpoints

  // Get available credit packages
  app.get("/api/credits/packages", async (req, res) => {
    try {
      res.json({
        success: true,
        packages: CREDIT_PACKAGES
      });
    } catch (error) {
      console.error("Error fetching credit packages:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch credit packages"
      });
    }
  });

  // Create payment link for purchasing credits
  app.post("/api/credits/purchase", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const { packageId } = req.body;
      
      if (!packageId) {
        return res.status(400).json({
          success: false,
          message: "Package ID is required"
        });
      }

      const result = await createCreditPurchaseLink(req, packageId, req.user.id);
      
      if (result.success) {
        res.json({
          success: true,
          paymentUrl: result.paymentUrl,
          orderId: result.orderId,
          message: "Credit purchase link created successfully"
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error || "Failed to create credit purchase link"
        });
      }
    } catch (error) {
      console.error("Error creating credit purchase link:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create credit purchase link"
      });
    }
  });

  // Create purchase link for credits (alternative endpoint name)
  app.post("/api/credits/create-purchase-link", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const { packageId, promoCode, redirectPath } = req.body;
      
      if (!packageId) {
        return res.status(400).json({
          success: false,
          message: "Package ID is required"
        });
      }

      const result = await createCreditPurchaseLink(req, packageId, req.user.id, promoCode, redirectPath);
      
      if (result.success) {
        res.json({
          success: true,
          paymentUrl: result.paymentUrl,
          orderId: result.orderId,
          message: "Credit purchase link created successfully"
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error || "Failed to create credit purchase link"
        });
      }
    } catch (error) {
      console.error("Error creating credit purchase link:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create credit purchase link"
      });
    }
  });

  // Manual credit addition for testing
  app.post("/api/credits/add-manual", async (req, res) => {
    console.log("=== MANUAL CREDIT ADDITION ===");
    
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const { credits = 5 } = req.body;
      const userId = req.user.id;
      
      // Add credits directly using the credit service
      const { creditService } = await import('./credit-service');
      const { db } = await import('./storage');
      const { sql } = await import('drizzle-orm');
      
      // Update user's credit balance (simple update since user already exists)
      await db.execute(sql`
        UPDATE user_credits 
        SET credits = credits + ${credits}, updated_at = NOW() 
        WHERE user_id = ${userId}
      `);
      
      // Record the transaction
      await db.execute(sql`
        INSERT INTO credit_transactions (user_id, transaction_type, credits, description, created_at)
        VALUES (${userId}, 'purchase', ${credits}, 'Manual credit addition for testing', NOW())
      `);
      
      const newBalance = await creditService.getUserCredits(userId);
      
      console.log(`Added ${credits} credits to user ${userId}. New balance: ${newBalance}`);
      
      res.json({
        success: true,
        creditsAdded: credits,
        newBalance: newBalance,
        message: `Successfully added ${credits} credits`
      });
    } catch (error) {
      console.error("Error adding manual credits:", error);
      res.status(500).json({
        success: false,
        message: "Failed to add credits"
      });
    }
  });

  // Verify and process completed credit purchase
  app.post("/api/credits/verify-purchase", async (req, res) => {
    console.log("=== CREDIT VERIFICATION ENDPOINT HIT ===");
    console.log("Request method:", req.method);
    console.log("Request URL:", req.url);
    console.log("Request headers:", JSON.stringify(req.headers, null, 2));
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    console.log("Request query:", JSON.stringify(req.query, null, 2));
    console.log("Authentication status:", req.isAuthenticated());
    
    if (!req.isAuthenticated()) {
      console.log("Authentication failed - returning 401");
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      console.log("Credit verification request received:", {
        userId: req.user.id,
        body: req.body,
        bodyType: typeof req.body,
        bodyKeys: Object.keys(req.body || {}),
        query: req.query,
        queryType: typeof req.query,
        queryKeys: Object.keys(req.query || {})
      });
      
      console.log("About to call verifyCreditPurchase function...");

      const { orderId, packageId, squareOrderId } = req.body;
      
      console.log("Extracted parameters from request body:", {
        orderId,
        packageId,
        squareOrderId,
        orderIdType: typeof orderId,
        packageIdType: typeof packageId,
        userId: req.user.id
      });
      
      if (!orderId || !packageId) {
        console.log("Missing required parameters:", { orderId, packageId });
        return res.status(400).json({
          success: false,
          message: "Order ID and package ID are required"
        });
      }

      console.log("Calling verifyCreditPurchase with:", { orderId, packageId, userId: req.user.id, squareOrderId });
      const result = await verifyCreditPurchase(orderId, packageId, req.user.id, squareOrderId);
      console.log("verifyCreditPurchase result:", result);
      
      if (result.success) {
        res.json({
          success: true,
          credits: result.credits,
          transactionId: result.transactionId,
          message: "Credits purchased successfully"
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error || "Failed to verify credit purchase"
        });
      }
    } catch (error) {
      console.error("Error verifying credit purchase:", error);
      res.status(500).json({
        success: false,
        message: "Failed to verify credit purchase"
      });
    }
  });

  // PUBLIC credit verification endpoint - doesn't require session authentication
  // This is used when the user's session is lost during Square redirect
  // It verifies the orderId against pending transactions and uses the same
  // verification logic as the authenticated endpoint
  app.post("/api/credits/verify-purchase-public", async (req, res) => {
    console.log("=== PUBLIC CREDIT VERIFICATION ENDPOINT HIT ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    
    try {
      const { orderId, packageId, squareOrderId } = req.body;
      
      if (!orderId || !packageId) {
        console.log("Missing required parameters for public verification");
        return res.status(400).json({
          success: false,
          message: "Order ID and package ID are required"
        });
      }
      
      console.log("Public verification with squareOrderId:", { orderId, packageId, squareOrderId });
      
      // Look up the pending transaction by orderId to get the userId
      const { db } = await import('./storage');
      const { sql } = await import('drizzle-orm');
      
      const pendingTransaction = await db.execute(sql`
        SELECT * FROM credit_transactions 
        WHERE order_id = ${orderId}
        AND transaction_type = 'purchase'
        LIMIT 1
      `);
      
      if (pendingTransaction.rows.length === 0) {
        console.log("No transaction found for orderId:", orderId);
        return res.status(404).json({
          success: false,
          message: "Transaction not found - the order ID may be invalid or expired"
        });
      }
      
      const transaction = pendingTransaction.rows[0];
      const userId = transaction.user_id as number;
      
      console.log("Found transaction for public verification:", {
        transactionId: transaction.id,
        userId,
        credits: transaction.credits,
        currentStatus: transaction.payment_status
      });
      
      // Now call the same verification function used by the authenticated endpoint
      // This ensures proper Square verification and double-credit protection
      const result = await verifyCreditPurchase(orderId, packageId, userId, squareOrderId);
      
      console.log("verifyCreditPurchase result for public endpoint:", result);
      
      if (result.success) {
        // Get current credit balance
        const balanceResult = await db.execute(sql`
          SELECT credits FROM user_credits WHERE user_id = ${userId}
        `);
        const currentBalance = balanceResult.rows[0]?.credits as number || 0;
        
        res.json({
          success: true,
          credits: result.credits,
          transactionId: result.transactionId,
          currentCredits: currentBalance,
          message: "Credits purchased successfully"
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error || "Failed to verify credit purchase"
        });
      }
      
    } catch (error) {
      console.error("Error in public credit verification:", error);
      res.status(500).json({
        success: false,
        message: "Failed to verify credit purchase"
      });
    }
  });

  // TEMPORARY: Manual credit award endpoint for testing
  app.post("/api/credits/manual-award", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const { credits = 10 } = req.body;
      
      console.log("Manual credit award requested:", {
        userId: req.user.id,
        credits: credits
      });

      // Manually award credits to the user
      const { db } = await import('./storage');
      const { sql } = await import('drizzle-orm');
      
      // Create transaction record
      const transactionResult = await db.execute(sql`
        INSERT INTO credit_transactions (
          user_id, transaction_type, credits, description, 
          square_payment_id, order_id, checkout_id, 
          amount, currency, payment_status, created_at
        ) VALUES (
          ${req.user.id}, 'purchase', ${credits}, 
          'Manual credit award for testing',
          'manual_' + ${Date.now()}, 'manual_' + ${Date.now()}, 'manual_' + ${Date.now()},
          ${credits * 5}, 'USD', 'completed', NOW()
        ) RETURNING id
      `);
      
      const transactionId = transactionResult.rows[0]?.id;

      // Update user's credit balance
      await db.execute(sql`
        INSERT INTO user_credits (user_id, credits, created_at, updated_at)
        VALUES (${req.user.id}, ${credits}, NOW(), NOW())
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          credits = user_credits.credits + ${credits},
          updated_at = NOW()
      `);

      console.log("Manual credit award completed:", {
        transactionId,
        userId: req.user.id,
        credits: credits
      });

      res.json({
        success: true,
        credits: credits,
        transactionId: transactionId,
        message: "Credits awarded successfully"
      });

    } catch (error) {
      console.error("Error awarding manual credits:", error);
      res.status(500).json({
        success: false,
        message: "Failed to award credits"
      });
    }
  });

  // Reconciliation endpoint to fix missed credit payments (admin only)
  app.post("/api/credits/reconcile", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: "Admin access required" 
      });
    }

    try {
      console.log("=== CREDIT RECONCILIATION STARTED ===");
      console.log("Initiated by admin:", req.user.id);
      
      const { userId, orderId, autoFix = false } = req.body;
      
      const { db } = await import('./storage');
      const { sql } = await import('drizzle-orm');
      
      let pendingTransactions;
      
      // If specific user or order ID provided, check that one
      if (userId || orderId) {
        let query = sql`
          SELECT * FROM credit_transactions 
          WHERE payment_status = 'pending' 
          AND transaction_type = 'purchase'
        `;
        
        if (userId) {
          query = sql`${query} AND user_id = ${userId}`;
        }
        if (orderId) {
          query = sql`${query} AND order_id = ${orderId}`;
        }
        
        query = sql`${query} ORDER BY created_at DESC`;
        pendingTransactions = await db.execute(query);
      } else {
        // Check all pending transactions
        pendingTransactions = await db.execute(sql`
          SELECT * FROM credit_transactions 
          WHERE payment_status = 'pending' 
          AND transaction_type = 'purchase'
          ORDER BY created_at DESC
        `);
      }
      
      console.log(`Found ${pendingTransactions.rows.length} pending credit transactions`);
      
      const results = {
        checked: pendingTransactions.rows.length,
        fixed: 0,
        skipped: 0,
        errors: 0,
        details: [] as any[]
      };
      
      // Process each pending transaction
      for (const transaction of pendingTransactions.rows) {
        try {
          const txUserId = transaction.user_id as number;
          const txOrderId = transaction.order_id as string;
          const txCredits = transaction.credits as number;
          const txCreatedAt = transaction.created_at as Date;
          
          // Calculate how long it's been pending
          const ageHours = (Date.now() - new Date(txCreatedAt).getTime()) / (1000 * 60 * 60);
          
          console.log(`Checking pending transaction:`, {
            id: transaction.id,
            userId: txUserId,
            orderId: txOrderId,
            credits: txCredits,
            ageHours: ageHours.toFixed(2)
          });
          
          // If autoFix is enabled and transaction is old enough (>1 hour), complete it
          if (autoFix && ageHours > 1) {
            // Use atomic update to prevent double-credit
            const updateResult = await db.execute(sql`
              UPDATE credit_transactions 
              SET payment_status = 'completed',
                  description = ${'Reconciliation: ' + (transaction.description || 'Credit purchase')}
              WHERE id = ${transaction.id}
                AND payment_status = 'pending'
              RETURNING id
            `);
            
            if (updateResult.rows.length > 0) {
              // Award credits
              await db.execute(sql`
                INSERT INTO user_credits (user_id, credits, created_at, updated_at)
                VALUES (${txUserId}, ${txCredits}, NOW(), NOW())
                ON CONFLICT (user_id) 
                DO UPDATE SET 
                  credits = user_credits.credits + ${txCredits},
                  updated_at = NOW()
              `);
              
              results.fixed++;
              results.details.push({
                transactionId: transaction.id,
                userId: txUserId,
                orderId: txOrderId,
                credits: txCredits,
                status: 'fixed',
                ageHours: ageHours.toFixed(2)
              });
              
              console.log(`✅ Fixed transaction ${transaction.id}: awarded ${txCredits} credits to user ${txUserId}`);
            } else {
              results.skipped++;
              results.details.push({
                transactionId: transaction.id,
                userId: txUserId,
                orderId: txOrderId,
                status: 'already_completed',
                ageHours: ageHours.toFixed(2)
              });
            }
          } else {
            results.skipped++;
            results.details.push({
              transactionId: transaction.id,
              userId: txUserId,
              orderId: txOrderId,
              credits: txCredits,
              status: autoFix ? 'too_recent' : 'needs_manual_review',
              ageHours: ageHours.toFixed(2)
            });
          }
        } catch (txError) {
          console.error(`Error processing transaction ${transaction.id}:`, txError);
          results.errors++;
          results.details.push({
            transactionId: transaction.id,
            status: 'error',
            error: txError instanceof Error ? txError.message : 'Unknown error'
          });
        }
      }
      
      console.log("=== RECONCILIATION COMPLETE ===");
      console.log("Results:", results);
      
      res.json({
        success: true,
        message: `Reconciliation complete: ${results.fixed} fixed, ${results.skipped} skipped, ${results.errors} errors`,
        ...results
      });
      
    } catch (error) {
      console.error("Error in credit reconciliation:", error);
      res.status(500).json({
        success: false,
        message: "Reconciliation failed",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get Square payment history for a customer (admin only)
  app.get("/api/square/payment-history/:customerId", requireAdmin, async (req, res) => {
    try {
      const { customerId } = req.params;
      
      if (!customerId) {
        return res.status(400).json({
          success: false,
          message: "Customer ID is required"
        });
      }

      console.log("Fetching payment history for Square customer:", customerId);

      // Get Square credentials
      const { accessToken } = squareService.getSquareCredentials();
      
      if (!accessToken) {
        return res.status(500).json({
          success: false,
          message: "Square credentials not configured"
        });
      }

      // Make API call to Square to get payment history
      const response = await fetch('https://connect.squareup.com/v2/payments', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Square-Version': '2023-09-25',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error('Square API error:', response.status, response.statusText);
        return res.status(500).json({
          success: false,
          message: `Square API error: ${response.status} ${response.statusText}`
        });
      }

      const data = await response.json();
      
      // Filter payments for the specific customer
      const customerPayments = (data.payments || []).filter(payment => 
        payment.buyer_email_address || payment.customer_id === customerId
      );

      // Transform payment data to match our interface
      const transactions = customerPayments.map(payment => ({
        id: payment.id,
        amount: payment.amount_money?.amount || 0,
        status: payment.status,
        createdAt: payment.created_at,
        description: payment.note || payment.reference_id || 'Square payment'
      }));

      console.log(`Found ${transactions.length} payments for customer ${customerId}`);

      res.json({
        success: true,
        transactions: transactions
      });

    } catch (error) {
      console.error("Error fetching Square payment history:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch payment history",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Publish draft listing after payment verification
  app.post("/api/listings/publish-draft", requireAuth, async (req, res) => {
    try {
      const { paymentId, listingType, listingDuration } = req.body;
      
      console.log("Draft publish request:", {
        userId: req.user.id,
        paymentId,
        listingType,
        listingDuration
      });

      if (!paymentId) {
        return res.status(400).json({
          success: false,
          message: "Payment ID is required"
        });
      }

      // First, verify the payment was successful
      const verifyResponse = await squareService.verifyPaymentStatus(paymentId);
      
      if (!verifyResponse.success || !verifyResponse.completed) {
        return res.status(400).json({
          success: false,
          message: "Payment not completed or verification failed"
        });
      }

      // Find the draft listing associated with this payment
      // We need to get the listing ID from the payment record
      const paymentRecord = await storage.getListingPaymentByIntent(paymentId);
      
      if (!paymentRecord || !paymentRecord.listingId) {
        return res.status(404).json({
          success: false,
          message: "No listing found for this payment"
        });
      }

      const listingId = paymentRecord.listingId;
      const listing = await storage.getListing(listingId);
      
      if (!listing) {
        return res.status(404).json({
          success: false,
          message: "Listing not found"
        });
      }

      // Check ownership
      if (listing.createdBy !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to publish this listing"
        });
      }

      // Check if listing is in DRAFT or EXPIRED status
      if (listing.status !== 'DRAFT' && listing.status !== 'EXPIRED') {
        return res.status(400).json({
          success: false,
          message: "Only draft or expired listings can be published"
        });
      }

      // Calculate expiration date based on duration
      const now = new Date();
      let expiresAt = new Date(now);
      
      switch (listingDuration) {
        case 'THREE_DAY':
        case '3_day':
          expiresAt.setDate(now.getDate() + 3);
          break;
        case 'SEVEN_DAY':
        case '7_day':
          expiresAt.setDate(now.getDate() + 7);
          break;
        case 'THIRTY_DAY':
        case '30_day':
        default:
          expiresAt.setDate(now.getDate() + 30);
          break;
      }

      // Update the listing to published status
      const updatedListing = await storage.updateListing(listingId, {
        status: 'ACTIVE',
        expiresAt: expiresAt.toISOString()
      });

      console.log(`Successfully published draft listing ${listingId} for user ${req.user.id}`);

      // Update the publisher's for-sale visit timestamp so they don't see their own listing as "new"
      try {
        await storage.updateForSaleVisit(req.user.id);
        console.log(`Updated for-sale visit for listing publisher (user ${req.user.id})`);
      } catch (visitError) {
        console.error("Error updating for-sale visit after listing publish:", visitError);
      }

      res.json({
        success: true,
        message: "Listing published successfully",
        listing: updatedListing
      });
    } catch (error) {
      console.error("Error publishing draft listing:", error);
      res.status(500).json({
        success: false,
        message: "Failed to publish listing"
      });
    }
  });

  // Manual payment verification endpoint (Verify Payment Status button)
  app.post("/api/payments/verify-status", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const { paymentId, checkoutId, orderId } = req.body;
      
      console.log("Manual payment status verification requested:");
      console.log("- User ID:", req.user.id);
      console.log("- Payment identifiers:", { paymentId, checkoutId, orderId });
      
      if (!paymentId && !checkoutId && !orderId) {
        return res.status(400).json({
          success: false,
          message: "Payment identifier is required"
        });
      }

      const identifier = paymentId || checkoutId || orderId;
      
      // Check credit system first
      const creditVerification = await creditService.verifySquarePayment(
        identifier,
        checkoutId,
        orderId
      );

      if (creditVerification.success && creditVerification.payment) {
        return res.json({
          success: true,
          payment: creditVerification.payment,
          credits: creditVerification.credits,
          message: "Payment found and verified in credit system"
        });
      }

      // If not found in credit system, check Square API
      const { verifyPaymentStatus } = await import('./square-service');
      const verificationResult = await verifyPaymentStatus(identifier);

      if (verificationResult.isCompleted && verificationResult.paymentId) {
        // Process through credit system if it's a new completed payment
        const squarePaymentData = {
          userId: req.user.id,
          squarePaymentId: identifier,
          orderId: orderId || identifier,
          checkoutId: checkoutId || identifier,
          amount: "5.00", // Standard listing fee
          currency: "USD",
          status: 'completed' as const,
          listingType: 'standard',
          listingDuration: '30days'
        };

        await creditService.processSquarePayment(squarePaymentData);
        const currentCredits = await creditService.getUserCredits(req.user.id);

        return res.json({
          success: true,
          payment: {
            id: verificationResult.paymentId,
            status: 'completed',
            squarePaymentId: identifier
          },
          credits: currentCredits,
          message: "Payment verified through Square API and credits awarded"
        });
      }

      // Payment not found or not completed
      const currentCredits = await creditService.getUserCredits(req.user.id);
      
      return res.json({
        success: false,
        payment: null,
        credits: currentCredits,
        message: "Payment not found or not yet completed"
      });

    } catch (error) {
      console.error("Error in manual payment verification:", error);
      
      try {
        const currentCredits = await creditService.getUserCredits(req.user.id);
        res.status(500).json({
          success: false,
          message: "Payment verification failed",
          credits: currentCredits
        });
      } catch (creditError) {
        res.status(500).json({
          success: false,
          message: "Payment verification failed and could not fetch credits"
        });
      }
    }
  });

  // Webhook endpoint for Square payment notifications
  // SECURITY NOTE: In production, you should verify Square webhook signatures
  // using the X-Square-Signature header to ensure webhooks are from Square.
  // See: https://developer.squareup.com/docs/webhooks/verify-signatures
  app.post("/api/webhooks/square-payment", async (req, res) => {
    try {
      console.log("=== SQUARE WEBHOOK RECEIVED ===");
      console.log("Timestamp:", new Date().toISOString());
      console.log("Webhook data:", JSON.stringify(req.body, null, 2));
      
      const webhookData = req.body;
      
      // TODO: Verify webhook signature in production
      // const signature = req.headers['x-square-signature'];
      // if (!verifySquareSignature(signature, req.body)) {
      //   console.error('Invalid webhook signature');
      //   return res.status(401).json({ error: 'Invalid signature' });
      // }
      
      // Respond immediately to acknowledge receipt (Square expects fast response)
      res.status(200).json({ received: true });
      
      // Import payment monitor
      const { paymentMonitor } = await import('./payment-monitor');
      
      // Process payment in background (don't block webhook response)
      setImmediate(async () => {
        try {
          // Handle order.updated events (when payment completes)
          if (webhookData.type === 'order.updated') {
            const order = webhookData.data?.object?.order;
            
            if (order && order.state === 'COMPLETED') {
              console.log("Processing completed order from webhook:", order.id);
              console.log("Order details:", {
                orderId: order.id,
                referenceId: order.reference_id,
                totalMoney: order.total_money,
                state: order.state
              });
              
              // Extract user ID and our orderId from reference_id (format: cr_{userId}_{orderId.substring(0,20)})
              const referenceId = order.reference_id;
              if (referenceId && referenceId.startsWith('cr_')) {
                const parts = referenceId.split('_');
                if (parts.length >= 3) {
                  const userId = parseInt(parts[1]);
                  // The orderId is everything after the second underscore (first 20 chars of our UUID)
                  const partialOrderId = parts.slice(2).join('_');
                  
                  if (!isNaN(userId) && partialOrderId) {
                    console.log("Extracted from reference_id:", { userId, partialOrderId });
                    
                    // Look up the pending credit transaction using our local orderId (partial match)
                    // We stored our UUID in order_id, and the reference_id contains the first 20 chars
                    const { db } = await import('./storage');
                    const { sql } = await import('drizzle-orm');
                    
                    // Match by user_id and order_id starting with the partial ID from reference
                    const existingTransaction = await db.execute(sql`
                      SELECT * FROM credit_transactions 
                      WHERE user_id = ${userId}
                      AND order_id LIKE ${partialOrderId + '%'}
                      AND transaction_type = 'purchase'
                      ORDER BY created_at DESC
                      LIMIT 1
                    `);
                    
                    console.log("Webhook transaction lookup result:", {
                      foundRows: existingTransaction.rows.length,
                      partialOrderId,
                      userId,
                      squareOrderId: order.id
                    });
                    
                    if (existingTransaction.rows.length > 0) {
                      const transaction = existingTransaction.rows[0];
                      const credits = transaction.credits as number;
                      
                      // Check if already completed (idempotency)
                      if (transaction.payment_status === 'completed') {
                        console.log("Transaction already completed, skipping:", transaction.id);
                        paymentMonitor.logEvent({
                          type: 'double_credit_prevented',
                          userId,
                          orderId: order.id,
                          credits,
                          source: 'webhook',
                          details: { reason: 'already_completed', transactionId: transaction.id }
                        });
                        return;
                      }
                      
                      // Atomic update: only update if still pending (prevents race with redirect)
                      const updateResult = await db.execute(sql`
                        UPDATE credit_transactions 
                        SET payment_status = 'completed',
                            description = ${`Webhook: ${transaction.description}`}
                        WHERE id = ${transaction.id}
                          AND payment_status = 'pending'
                        RETURNING id
                      `);
                      
                      // Check if we actually updated (won the race)
                      if (updateResult.rows.length === 0) {
                        console.log("Transaction was already completed by another process (redirect?), skipping credit award");
                        paymentMonitor.logEvent({
                          type: 'double_credit_prevented',
                          userId,
                          orderId: order.id,
                          credits,
                          source: 'webhook',
                          details: { reason: 'race_lost_to_redirect', transactionId: transaction.id }
                        });
                        return;
                      }
                      
                      // We won the race, award credits
                      await db.execute(sql`
                        INSERT INTO user_credits (user_id, credits, created_at, updated_at)
                        VALUES (${userId}, ${credits}, NOW(), NOW())
                        ON CONFLICT (user_id) 
                        DO UPDATE SET 
                          credits = user_credits.credits + ${credits},
                          updated_at = NOW()
                      `);
                      
                      console.log("✅ WEBHOOK: Credits awarded successfully!", {
                        userId,
                        credits,
                        orderId: order.id,
                        transactionId: transaction.id
                      });
                      
                      // Log success event
                      paymentMonitor.logEvent({
                        type: 'success',
                        userId,
                        orderId: order.id,
                        credits,
                        source: 'webhook',
                        details: { transactionId: transaction.id, orderState: order.state }
                      });
                    } else {
                      console.log("⚠️ No pending transaction found for order:", order.id);
                      console.log("This is a webhook for an order without a pending transaction.");
                      console.log("User should use the reconciliation endpoint or verify payment manually.");
                      
                      // Log the issue for admin review
                      paymentMonitor.logIssue({
                        severity: 'medium',
                        type: 'webhook_missing',
                        userId,
                        orderId: order.id,
                        description: 'Webhook received for completed order but no pending transaction found',
                        details: {
                          referenceId: order.reference_id,
                          orderState: order.state,
                          totalMoney: order.total_money
                        }
                      });
                    }
                  } else {
                    console.log("Invalid user ID in reference:", referenceId);
                  }
                } else {
                  console.log("Reference ID format unexpected:", referenceId);
                }
              } else {
                console.log("No reference_id or not a credit purchase:", referenceId);
              }
            }
          }
          
          // Handle payment.updated events (legacy support)
          else if (webhookData.type === 'payment.created' || webhookData.type === 'payment.updated') {
            const payment = webhookData.data?.object?.payment;
            
            if (payment && payment.status === 'COMPLETED') {
              console.log("Payment event received:", {
                paymentId: payment.id,
                amount: payment.amount_money?.amount,
                currency: payment.amount_money?.currency,
                orderId: payment.order_id
              });
              console.log("Note: order.updated events are preferred for credit assignment");
            }
          }
        } catch (bgError) {
          console.error("❌ Error processing webhook in background:", bgError);
        }
      });
      
    } catch (error) {
      console.error("❌ Error in webhook handler:", error);
      res.status(200).json({ received: true });
    }
  });

  // UptimeRobot webhook for downtime alerts
  // Requires API key in query param or header for security
  app.post("/api/webhooks/uptimerobot", async (req, res) => {
    try {
      console.log("=== UPTIMEROBOT WEBHOOK RECEIVED ===");
      console.log("Timestamp:", new Date().toISOString());
      
      // Verify API key for security - check query param, header, or body
      const expectedApiKey = process.env.UPTIMEROBOT_API_KEY;
      const providedApiKey = req.query.api_key || req.headers['x-uptimerobot-key'] || req.body.api_key;
      
      if (!expectedApiKey) {
        console.error("[UptimeRobot] ❌ UPTIMEROBOT_API_KEY not configured");
        return res.status(500).json({ error: "Webhook not configured" });
      }
      
      if (!providedApiKey || providedApiKey !== expectedApiKey) {
        console.error("[UptimeRobot] ❌ Invalid or missing API key in webhook request");
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      console.log("[UptimeRobot] ✅ API key validated");
      console.log("Webhook data:", JSON.stringify(req.body, null, 2));
      
      const { parseUptimeRobotWebhook, sendDowntimeAlertToAdmins } = await import('./uptime-monitor-service');
      
      const alertData = parseUptimeRobotWebhook(req.body);
      
      res.status(200).json({ received: true, message: "Processing alert" });
      
      setImmediate(async () => {
        try {
          const result = await sendDowntimeAlertToAdmins(alertData);
          console.log("[UptimeRobot] Alert processing result:", result);
        } catch (bgError) {
          console.error("[UptimeRobot] Error processing alert:", bgError);
        }
      });
      
    } catch (error) {
      console.error("❌ Error in UptimeRobot webhook handler:", error);
      res.status(200).json({ received: true, error: "Processing failed" });
    }
  });

  // Test endpoint for uptime monitoring alerts (admin only)
  app.post("/api/admin/test-downtime-alert", requireAdmin, async (req, res) => {
    try {
      console.log("[UptimeRobot] Admin testing downtime alert");
      
      const { sendDowntimeAlertToAdmins } = await import('./uptime-monitor-service');
      
      const testAlert = {
        monitorID: "test-123",
        monitorURL: "https://barefootbay.com",
        monitorFriendlyName: "Barefoot Bay Website (TEST)",
        alertType: "1",
        alertTypeFriendlyName: "Down",
        alertDetails: "This is a TEST alert - no actual downtime detected",
        alertDateTime: new Date().toISOString()
      };
      
      const result = await sendDowntimeAlertToAdmins(testAlert);
      
      res.json({
        success: result.success,
        message: result.success 
          ? `Test alert sent to ${result.emailsSent} admin(s)` 
          : "Failed to send test alert",
        emailsSent: result.emailsSent,
        errors: result.errors
      });
      
    } catch (error: any) {
      console.error("[UptimeRobot] Error sending test alert:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to send test alert",
        error: error.message 
      });
    }
  });
  
  // Create subscription for a listing
  app.post("/api/subscriptions/create", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const { listingId, planType } = req.body;
      
      // Validate required fields
      if (!listingId) {
        return res.status(400).json({
          success: false,
          message: "Listing ID is required"
        });
      }
      
      if (!planType) {
        return res.status(400).json({
          success: false,
          message: "Plan type is required"
        });
      }
      
      // Import subscription service
      const { createSubscription, SUBSCRIPTION_PLANS } = await import('./subscription-service');
      
      // Validate plan type
      if (!Object.keys(SUBSCRIPTION_PLANS).includes(planType)) {
        return res.status(400).json({
          success: false,
          message: `Invalid plan type. Must be one of: ${Object.keys(SUBSCRIPTION_PLANS).join(', ')}`
        });
      }
      
      // Verify the listing exists and belongs to the user
      const listing = await storage.getListing(listingId);
      if (!listing) {
        return res.status(404).json({
          success: false,
          message: "Listing not found"
        });
      }
      
      if (listing.createdBy !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to modify this listing"
        });
      }
      
      console.log(`Creating subscription for listing ${listingId} with plan ${planType}`);
      const result = await createSubscription(
        req.user.id,
        listingId,
        planType as keyof typeof SUBSCRIPTION_PLANS,
        req.user.email
      );
      
      res.json({
        success: true,
        checkoutUrl: result.checkoutUrl,
        paymentLinkId: result.paymentLinkId
      });
    } catch (err) {
      console.error("Error creating subscription:", err);
      let errorMessage = "Failed to create subscription";
      if (err instanceof Error) {
        errorMessage += ": " + err.message;
        console.error("Error stack:", err.stack);
      }
      
      res.status(500).json({ 
        success: false,
        message: errorMessage
      });
    }
  });
  
  // Verify subscription payment status
  app.post("/api/subscriptions/verify", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const { paymentLinkId } = req.body;
      
      if (!paymentLinkId) {
        return res.status(400).json({
          success: false,
          message: "Payment link ID is required"
        });
      }
      
      // Import subscription service
      const { verifySubscriptionPayment } = await import('./subscription-service');
      
      console.log(`Verifying subscription payment status for link ID: ${paymentLinkId}`);
      const result = await verifySubscriptionPayment(paymentLinkId);
      
      res.json({
        success: true,
        isCompleted: result.isCompleted,
        listingId: result.listingId,
        subscriptionId: result.subscriptionId,
        message: result.message
      });
    } catch (err) {
      console.error("Error verifying subscription payment:", err);
      let errorMessage = "Failed to verify subscription payment";
      if (err instanceof Error) {
        errorMessage += ": " + err.message;
        console.error("Error stack:", err.stack);
      }
      
      res.status(500).json({ 
        success: false,
        message: errorMessage
      });
    }
  });
  
  // Cancel a subscription
  app.post("/api/subscriptions/cancel", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const { listingId } = req.body;
      
      if (!listingId) {
        return res.status(400).json({
          success: false,
          message: "Listing ID is required"
        });
      }
      
      // Import subscription service
      const { cancelSubscription } = await import('./subscription-service');
      
      // Verify the listing exists and belongs to the user
      const listing = await storage.getListing(listingId);
      if (!listing) {
        return res.status(404).json({
          success: false,
          message: "Listing not found"
        });
      }
      
      if (listing.createdBy !== req.user.id && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to modify this listing"
        });
      }
      
      // Verify the listing has an active subscription
      if (!listing.isSubscription || !listing.subscriptionId) {
        return res.status(400).json({
          success: false,
          message: "This listing does not have an active subscription"
        });
      }
      
      console.log(`Cancelling subscription for listing ${listingId}`);
      await cancelSubscription(listingId);
      
      res.json({
        success: true,
        message: "Subscription cancelled successfully"
      });
    } catch (err) {
      console.error("Error cancelling subscription:", err);
      let errorMessage = "Failed to cancel subscription";
      if (err instanceof Error) {
        errorMessage += ": " + err.message;
        console.error("Error stack:", err.stack);
      }
      
      res.status(500).json({ 
        success: false,
        message: errorMessage
      });
    }
  });
  
  // Diagnostic endpoint for Square integration
  app.get("/api/payments/square-status", requireAdmin, async (req, res) => {
    try {
      // Get Square client status
      const status = squareService.getSquareClientStatus();
      
      // Test API connection with a simple request
      let apiConnectionStatus = {
        connected: false,
        error: null,
        message: 'API connection test not performed'
      };
      
      // Get fresh credentials to ensure we use current values
      const { accessToken, locationId } = squareService.getSquareCredentials();
      
      // Only test connection if we have credentials
      if (accessToken && locationId) {
        try {
          // Always use production URL with production credentials
          const baseUrl = 'https://connect.squareup.com';
          
          // Perform a lightweight API call to check credentials using fresh credentials
          const response = await fetch(`${baseUrl}/v2/locations`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Square-Version': '2023-09-25'
            }
          });
          
          if (response.ok) {
            apiConnectionStatus = {
              connected: true,
              error: null,
              message: 'Successfully connected to Square API'
            };
          } else {
            const errorText = await response.text();
            apiConnectionStatus = {
              connected: false,
              error: `${response.status} ${response.statusText}`,
              message: `API connection failed: ${errorText}`,
            };
          }
        } catch (apiError) {
          apiConnectionStatus = {
            connected: false,
            error: apiError instanceof Error ? apiError.message : String(apiError),
            message: 'API connection failed with exception'
          };
        }
      }
      
      const environmentInfo = {
        nodeEnv: process.env.NODE_ENV || 'Not set',
        publicUrl: process.env.PUBLIC_URL || 'Not set',
        hasSquareAccessToken: !!process.env.SQUARE_ACCESS_TOKEN,
        hasSquareApplicationId: !!process.env.SQUARE_APPLICATION_ID,
        hasSquareLocationId: !!process.env.SQUARE_LOCATION_ID,
      };
      
      res.json({
        status: 'ok',
        squareStatus: status,
        environmentInfo,
        apiConnectionStatus
      });
    } catch (err) {
      console.error('Error in Square status check:', err);
      res.status(500).json({
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });

  // Endpoint to get Square API credential status (masked, admin only)
  app.get("/api/payments/square-env", async (req, res) => {
    // Only allow admin access to this endpoint
    if (!req.isAuthenticated() || req.user.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    try {
      // Get fresh credentials
      const { accessToken, applicationId, locationId } = squareService.getSquareCredentials();
      
      // Return masked values or indicators if credentials exist
      const maskedLength = 6; // Show only this many characters at the end
      
      // Log current environment settings for debugging
      console.log('GET /api/payments/square-env - Current Square credentials:');
      console.log(`- ACCESS_TOKEN: ${accessToken ? 'Set (masked)' : 'Not set'}`);
      console.log(`- APPLICATION_ID: ${applicationId || 'Not set'}`);
      console.log(`- LOCATION_ID: ${locationId || 'Not set'}`);
      console.log(`- NODE_ENV: ${process.env.NODE_ENV}`);
      
      // Helper to mask sensitive data
      const maskCredential = (value: string | undefined) => {
        if (!value) return '';
        if (value.length <= maskedLength) {
          return '•'.repeat(value.length);
        }
        return '•'.repeat(value.length - maskedLength) + value.slice(-maskedLength);
      };
      
      res.json({
        squareAccessToken: accessToken ? maskCredential(accessToken) : '',
        squareApplicationId: applicationId || '',
        squareLocationId: locationId || '',
      });
    } catch (err) {
      console.error('Error getting Square API credentials:', err);
      res.status(500).json({
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });
  
  // Endpoint to update Square API credentials (admin only)
  app.post("/api/payments/square-env", async (req, res) => {
    // Only allow admin access to this endpoint
    if (!req.isAuthenticated() || req.user.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    try {
      // Get credentials from request body
      const { squareAccessToken, squareApplicationId, squareLocationId } = req.body;
      
      if (!squareAccessToken || !squareApplicationId || !squareLocationId) {
        return res.status(400).json({
          status: 'error',
          message: 'All Square API credentials are required',
        });
      }
      
      // In a production environment, we would update environment variables
      // but in the Replit environment, we'll update the current process.env values
      // Note: This is temporary for this session, a real implementation would
      // store these values in a proper configuration system or environment variables
      process.env.SQUARE_ACCESS_TOKEN = squareAccessToken;
      process.env.SQUARE_APPLICATION_ID = squareApplicationId;
      process.env.SQUARE_LOCATION_ID = squareLocationId;
      
      // IMPORTANT: Remove any older credentials from memory
      try {
        const squareService = await import('./square-service');
        await squareService.reinitializeSquareClient();
        console.log('Successfully reinitialized Square client with new credentials');
      } catch (error) {
        console.error('Error reinitializing Square client:', error);
        // Continue anyway since we've updated the environment variables
      }
      
      res.json({
        status: 'success',
        message: 'Square API credentials updated successfully',
      });
    } catch (err) {
      console.error('Error updating Square API credentials:', err);
      res.status(500).json({
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });


  // Endpoint to check for expired listings (admin only)
  app.post("/api/listings/check-expired", requireAdmin, async (req, res) => {
    try {
      const { checkExpiredListings } = await import('./listing-expiration-service');
      const result = await checkExpiredListings();
      
      res.json({
        success: true,
        ...result
      });
    } catch (err) {
      console.error("Error checking expired listings:", err);
      res.status(500).json({ 
        success: false, 
        message: "Failed to check expired listings"
      });
    }
  });
  
  // Test endpoint for listing expiration (open access for testing)
  app.get("/__test__/expiration", async (req, res) => {
    try {
      console.log("Testing listing expiration service without auth");
      const { checkExpiredListings, checkExpiringListings } = await import('./listing-expiration-service');
      
      // Run both checks
      const expiredResult = await checkExpiredListings();
      const expiringResult = await checkExpiringListings(3); // Check listings expiring in 3 days
      
      // Log the service behavior
      console.log("Listing expiration test results:", {
        expired: expiredResult,
        expiring: expiringResult
      });
      
      res.json({
        success: true,
        message: "Listing expiration service test completed",
        expired: expiredResult,
        expiring: expiringResult
      });
    } catch (err) {
      console.error("Error testing listing expiration service:", err);
      res.status(500).json({ 
        success: false, 
        message: err instanceof Error ? err.message : "Failed to test listing expiration service",
        error: String(err)
      });
    }
  });
  
  // Endpoint to renew a listing for another 30 days (non-subscription)
  app.post("/api/listings/:id/renew", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const listingId = parseInt(req.params.id);
      const listing = await storage.getListing(listingId);
      
      if (!listing) {
        return res.status(404).json({ message: "Listing not found" });
      }
      
      // Check if user owns the listing or is an admin
      const isAdmin = req.user.role === 'admin';
      if (listing.createdBy !== req.user.id && !isAdmin) {
        return res.status(403).json({ message: "Not authorized to renew this listing" });
      }
      
      // Calculate new expiration date (+30 days from now)
      const newExpirationDate = new Date();
      newExpirationDate.setDate(newExpirationDate.getDate() + 30);
      
      // TODO: Process payment here (actual payment processing would be implemented based on your payment provider)
      // For now, assuming payment is successful and just updating the listing
      
      // Update the listing with new expiration date
      const updatedListing = await storage.updateListing(listingId, {
        expirationDate: newExpirationDate,
        isApproved: true, // Re-approve if it was expired
        updatedAt: new Date()
      });
      
      // Create a payment record
      await storage.createListingPayment({
        userId: req.user.id,
        amount: 5000, // $50.00
        currency: "USD",
        status: "completed",
        paymentMethod: "square", // or whatever method was used
        listingId: listingId,
        subscriptionId: null,
        subscriptionPlan: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      res.json({
        success: true, 
        message: "Listing renewed successfully",
        listing: updatedListing
      });
    } catch (err) {
      console.error("Error renewing listing:", err);
      res.status(500).json({ 
        success: false, 
        message: "Failed to renew listing"
      });
    }
  });
  
  // Endpoint to convert a one-time listing to a subscription
  app.post("/api/listings/:id/convert-to-subscription", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const listingId = parseInt(req.params.id);
      const { planType } = req.body;
      
      if (!planType || !['MONTHLY', 'QUARTERLY'].includes(planType)) {
        return res.status(400).json({ message: "Invalid subscription plan type" });
      }
      
      // Use the subscription service to handle the conversion
      const { createSubscription } = await import('./subscription-service');
      const result = await createSubscription(listingId, req.user.id, planType);
      
      res.json({
        success: true, 
        message: "Listing converted to subscription successfully",
        ...result
      });
    } catch (err) {
      console.error("Error converting listing to subscription:", err);
      res.status(500).json({ 
        success: false, 
        message: err instanceof Error ? err.message : "Failed to convert listing to subscription"
      });
    }
  });
  
  // Endpoint to manage (retrieve) subscription details
  app.get("/api/subscriptions/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const subscriptionId = req.params.id;
      
      // Use the subscription service to handle retrieving subscription details
      const { getSubscription } = await import('./subscription-service');
      const subscriptionDetails = await getSubscription(subscriptionId);
      
      // Make sure user is authorized to view this subscription
      const listing = subscriptionDetails.listing;
      const isAdmin = req.user.role === 'admin';
      if (listing.createdBy !== req.user.id && !isAdmin) {
        return res.status(403).json({ message: "Not authorized to view this subscription" });
      }
      
      res.json(subscriptionDetails);
    } catch (err) {
      console.error("Error fetching subscription:", err);
      res.status(500).json({ 
        success: false,
        message: err instanceof Error ? err.message : "Failed to fetch subscription details" 
      });
    }
  });
  
  // Endpoint to cancel a subscription
  app.delete("/api/subscriptions/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const subscriptionId = req.params.id;
      
      // Check if this is a user membership subscription (sponsored, mock, or local)
      // These have the user's subscription ID format and should use the user-subscriptions service
      const isSponsoredSubscription = subscriptionId.startsWith('sponsored_');
      const isMockSubscription = subscriptionId.startsWith('mock_');
      const isLocalSubscription = subscriptionId.startsWith('local_subscription');
      
      // Check if the user has this subscription ID
      const user = await storage.getUser(req.user.id);
      const isUserSubscription = user && user.subscriptionId === subscriptionId;
      
      if (isSponsoredSubscription || isMockSubscription || isLocalSubscription || isUserSubscription) {
        // Use the user membership subscription service
        const { cancelMembershipSubscription } = await import('./user-subscriptions');
        const result = await cancelMembershipSubscription(req.user.id);
        
        res.json({
          success: result.success,
          message: result.message || "Subscription cancelled successfully",
          subscriptionId: result.subscriptionId,
          subscriptionType: result.subscriptionType,
          subscriptionStartDate: result.subscriptionStartDate,
          subscriptionEndDate: result.subscriptionEndDate
        });
      } else {
        // Use the real estate listing subscription service
        const { cancelSubscription } = await import('./subscription-service');
        const result = await cancelSubscription(subscriptionId, req.user.id);
        
        res.json({
          success: true,
          message: "Subscription cancelled successfully",
          ...result
        });
      }
    } catch (err) {
      console.error("Error cancelling subscription:", err);
      res.status(500).json({ 
        success: false, 
        message: err instanceof Error ? err.message : "Failed to cancel subscription"
      });
    }
  });
  
  // Endpoint to provide Square configuration for client-side payment implementation
  app.get("/api/square/config", requireAuth, (req, res) => {
    // Return Square configuration information
    if (!process.env.SQUARE_APPLICATION_ID || !process.env.SQUARE_LOCATION_ID) {
      return res.status(500).json({
        success: false,
        message: "Square payment integration is not properly configured"
      });
    }

    res.json({
      applicationId: process.env.SQUARE_APPLICATION_ID,
      locationId: process.env.SQUARE_LOCATION_ID,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
    });
  });

  // Create payment intent for publishing a draft listing
  app.post("/api/listings/:id/create-publish-payment", requireAuth, async (req, res) => {
    try {
      const listingId = parseInt(req.params.id);
      const { listingDuration } = req.body;
      
      if (!listingDuration || !['3_day', '7_day', '30_day'].includes(listingDuration)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid listing duration. Must be '3_day', '7_day', or '30_day'." 
        });
      }
      
      // Get the listing
      const listing = await storage.getListing(listingId);
      
      if (!listing) {
        return res.status(404).json({ success: false, message: "Listing not found" });
      }
      
      // Check if user owns the listing
      if (listing.createdBy !== req.user.id) {
        return res.status(403).json({ 
          success: false, 
          message: "You do not have permission to publish this listing" 
        });
      }
      
      // Check if listing is in DRAFT or EXPIRED status
      if (listing.status !== 'DRAFT' && listing.status !== 'EXPIRED') {
        return res.status(400).json({ 
          success: false, 
          message: "Only draft or expired listings can be published" 
        });
      }
      
      // Calculate price based on duration (in cents)
      let amount = 0;
      switch (listingDuration) {
        case '3_day':
          amount = 500; // $5
          break;
        case '7_day':
          amount = 1000; // $10
          break;
        case '30_day':
          amount = 2500; // $25
          break;
      }
      
      // Ensure Stripe is initialized
      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(500).json({ 
          success: false, 
          message: "Payment processing is not configured" 
        });
      }
      
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2023-10-16",
      });
      
      // Create a payment intent with Stripe
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "usd",
        metadata: {
          listingId: listingId.toString(),
          userId: req.user.id.toString(),
          listingDuration
        },
      });
      
      res.json({
        success: true,
        clientSecret: paymentIntent.client_secret,
        amount,
        listingDuration
      });
    } catch (error) {
      console.error("Error creating payment intent for publishing:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to create payment for publishing" 
      });
    }
  });
  
  // Square payment processing endpoint for publishing a listing
  app.post("/api/listings/:id/publish-with-square", requireAuth, async (req, res) => {
    try {
      const listingId = parseInt(req.params.id);
      const { sourceId, listingDuration, amount } = req.body;
      
      if (!sourceId) {
        return res.status(400).json({ 
          success: false, 
          message: "Payment source ID is required" 
        });
      }
      
      if (!listingDuration || !['3_day', '7_day', '30_day'].includes(listingDuration)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid listing duration" 
        });
      }
      
      if (!amount) {
        return res.status(400).json({ 
          success: false, 
          message: "Payment amount is required" 
        });
      }
      
      // Get the listing
      const listing = await storage.getListing(listingId);
      
      if (!listing) {
        return res.status(404).json({ 
          success: false, 
          message: "Listing not found" 
        });
      }
      
      // Check if user owns the listing
      if (listing.createdBy !== req.user.id) {
        return res.status(403).json({ 
          success: false, 
          message: "You do not have permission to publish this listing" 
        });
      }
      
      // Check if listing is in DRAFT or EXPIRED status
      if (listing.status !== "DRAFT" && listing.status !== "EXPIRED") {
        return res.status(400).json({ 
          success: false, 
          message: "Only draft or expired listings can be published" 
        });
      }
      
      if (!squareClient) {
        return res.status(500).json({ 
          success: false, 
          message: "Square payment processing is not available" 
        });
      }
      
      // Process the payment with Square
      try {
        const idempotencyKey = `listing-pub-${listingId}-${Date.now()}`;
        
        const payment = await squareClient.paymentsApi.createPayment({
          sourceId: sourceId,
          idempotencyKey,
          amountMoney: {
            amount: amount,
            currency: 'USD'
          },
          locationId: process.env.SQUARE_LOCATION_ID,
          note: `Listing publication payment for listing #${listingId}`,
          referenceId: `listing-${listingId}`
        });
        
        if (!payment.result || !payment.result.payment) {
          throw new Error('Payment processing failed');
        }
        
        // Save the payment details
        await storage.createListingPayment({
          listingId,
          userId: req.user.id,
          paymentIntentId: payment.result.payment.id,
          amount: amount / 100, // Convert from cents to dollars
          status: 'completed',
          paymentMethod: 'square',
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        // Publish the listing
        const duration = listingDuration === '3_day' ? 3 : 
                         listingDuration === '7_day' ? 7 : 30;
        
        const publishedListing = await storage.publishListing(listingId, duration);
        
        res.json({
          success: true,
          listing: publishedListing,
          message: "Listing published successfully"
        });
        
      } catch (error) {
        console.error("Error processing Square payment:", error);
        return res.status(500).json({ 
          success: false, 
          message: error instanceof Error ? error.message : "Payment processing failed" 
        });
      }
    } catch (error) {
      console.error("Error in publish-with-square endpoint:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to process payment and publish listing" 
      });
    }
  });

  // Credit-based publishing endpoint for listings
  app.post("/api/listings/:id/publish-with-credits", requireAuth, async (req, res) => {
    try {
      const listingId = parseInt(req.params.id);
      const { listingDuration, creditsToUse } = req.body;
      
      console.log("Credit-based publishing request:", {
        listingId,
        userId: req.user.id,
        listingDuration,
        creditsToUse,
        requestBody: req.body
      });

      // Validate input
      if (!listingDuration) {
        return res.status(400).json({ 
          success: false, 
          message: "Listing duration is required" 
        });
      }

      if (!creditsToUse || creditsToUse < 1) {
        return res.status(400).json({ 
          success: false, 
          message: "Credits to use must be at least 1" 
        });
      }

      // Get the listing and verify ownership
      const listing = await storage.getListing(listingId);
      if (!listing) {
        return res.status(404).json({ 
          success: false, 
          message: "Listing not found" 
        });
      }

      // Check authorization
      const isAdmin = req.user.role === 'admin';
      if (listing.createdBy !== req.user.id && !isAdmin) {
        return res.status(403).json({ 
          success: false, 
          message: "You do not have permission to publish this listing" 
        });
      }

      // Check if listing is already published
      if (listing.status === "ACTIVE") {
        return res.status(400).json({ 
          success: false, 
          message: "Listing is already published" 
        });
      }

      // Check if user has enough credits
      const userCredits = await creditService.getUserCredits(req.user.id);
      if (userCredits < creditsToUse) {
        return res.status(400).json({ 
          success: false, 
          message: `Insufficient credits. You have ${userCredits} credits but need ${creditsToUse}.`
        });
      }

      // Use credits and publish the listing
      const creditTransaction = await creditService.useCredits(
        req.user.id, 
        creditsToUse, 
        `Published listing: ${listing.title}`
      );

      if (!creditTransaction) {
        return res.status(500).json({ 
          success: false, 
          message: "Failed to process credit transaction" 
        });
      }

      // Publish the listing
      const publishedListing = await storage.publishListing(listingId, listingDuration);

      // Get updated credit balance
      const updatedCredits = await creditService.getUserCredits(req.user.id);

      console.log("Credit-based publishing successful:", {
        listingId,
        userId: req.user.id,
        creditsUsed: creditsToUse,
        remainingCredits: updatedCredits
      });

      res.json({
        success: true,
        listing: publishedListing,
        creditsUsed: creditsToUse,
        remainingCredits: updatedCredits,
        message: "Listing published successfully using credits"
      });

    } catch (error) {
      console.error("Error in publish-with-credits endpoint:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to publish listing with credits" 
      });
    }
  });

  // Featured upgrade pricing for the seller UI
  app.get("/api/featured-listings/config", async (_req, res) => {
    res.json({
      creditCost: await resolveFeaturedListingCreditCost((key) => storage.getSettingValue(key)),
      minCreditCost: MIN_FEATURED_LISTING_CREDIT_COST,
      maxCreditCost: MAX_FEATURED_LISTING_CREDIT_COST,
    });
  });

  // Admin: set the Featured upgrade price (whole credits, floor enforced).
  app.put("/api/featured-listings/config", requireAdmin, async (req, res) => {
    try {
      const creditCost = parseFeaturedListingCreditCost(req.body?.creditCost);
      if (creditCost === null) {
        return res.status(400).json({
          success: false,
          message: `Price must be a whole number of at least ${MIN_FEATURED_LISTING_CREDIT_COST} credit (up to ${MAX_FEATURED_LISTING_CREDIT_COST.toLocaleString('en-US')}).`,
        });
      }
      await storage.setSiteSetting(
        FEATURED_LISTING_COST_SETTING_KEY,
        String(creditCost),
        'Credit price of the Featured listing upgrade on On The Market',
        req.user.id,
      );
      console.log(`[FeaturedListing] Admin ${req.user.id} set featured price to ${creditCost} credits`);
      res.json({ success: true, creditCost, minCreditCost: MIN_FEATURED_LISTING_CREDIT_COST });
    } catch (error) {
      console.error('Error updating featured listing price:', error);
      res.status(500).json({ success: false, message: 'Failed to update featured listing price' });
    }
  });

  // Upgrade an ACTIVE listing to Featured by spending credits. Featured
  // status follows the listing's own expiration (no separate timer) and is
  // reset whenever the listing is (re)published.
  app.post("/api/listings/:id/feature-with-credits", requireAuth, async (req, res) => {
    try {
      if (!(await isFeaturedListingsEnabled())) {
        return res.status(403).json({ success: false, message: "Featured listings are currently disabled." });
      }
      const listingId = parseInt(req.params.id);
      if (!Number.isInteger(listingId)) {
        return res.status(400).json({ success: false, message: "Invalid listing id" });
      }

      const listing = await storage.getListing(listingId);
      const isAdmin = req.user.role === 'admin';
      const rejection = validateFeatureUpgrade(listing, req.user.id, isAdmin);
      if (rejection) {
        return res.status(rejection.httpStatus).json({ success: false, message: rejection.message });
      }

      const creditCost = await resolveFeaturedListingCreditCost((key) => storage.getSettingValue(key));
      const userCredits = await creditService.getUserCredits(req.user.id);
      if (userCredits < creditCost) {
        return res.status(400).json({
          success: false,
          code: "insufficient_credits",
          message: `Insufficient credits. You have ${userCredits} credits but need ${creditCost}.`,
          creditCost,
          credits: userCredits,
        });
      }

      // Claim the flag atomically FIRST — a concurrent double-click loses the
      // claim and is never charged.
      const claimed = await storage.claimFeaturedListing(listingId);
      if (!claimed) {
        return res.status(409).json({ success: false, message: "This listing is already featured" });
      }

      const charged = await creditService.useCredits(
        req.user.id,
        creditCost,
        `Featured upgrade for listing: ${listing!.title}`,
      );
      if (!charged) {
        // Credit deduction failed (e.g. balance changed) — release the claim.
        await storage.revertFeaturedListing(listingId);
        const balance = await creditService.getUserCredits(req.user.id);
        return res.status(400).json({
          success: false,
          code: "insufficient_credits",
          message: `Insufficient credits. You have ${balance} credits but need ${creditCost}.`,
          creditCost,
          credits: balance,
        });
      }

      const remainingCredits = await creditService.getUserCredits(req.user.id);
      console.log("Featured upgrade successful:", { listingId, userId: req.user.id, creditCost, remainingCredits });
      res.json({
        success: true,
        listing: claimed,
        creditsUsed: creditCost,
        remainingCredits,
        message: "Your listing is now featured!",
      });
    } catch (error) {
      console.error("Error in feature-with-credits endpoint:", error);
      res.status(500).json({ success: false, message: "Failed to feature listing" });
    }
  });

  // Admin-only: comp-feature a listing (no credits charged). Restricted to ACTIVE
  // non-featured listings via claimFeaturedListing's atomic guard.
  app.post("/api/admin/listings/:id/feature", requireAuth, requireAdmin, async (req, res) => {
    try {
      if (!(await isFeaturedListingsEnabled())) {
        return res.status(403).json({ success: false, message: "Featured listings are currently disabled." });
      }
      const listingId = parseInt(req.params.id);
      if (!Number.isInteger(listingId)) {
        return res.status(400).json({ success: false, message: "Invalid listing id" });
      }

      // Fetch first to distinguish 404 / already-featured / not-active
      const listing = await storage.getListing(listingId);
      if (!listing) {
        return res.status(404).json({ success: false, message: "Listing not found" });
      }
      if (listing.featured) {
        return res.status(409).json({ success: false, message: "This listing is already featured" });
      }
      if (listing.status !== "ACTIVE") {
        return res.status(409).json({
          success: false,
          message: `Only ACTIVE listings can be featured (current status: ${listing.status})`,
        });
      }

      const claimed = await storage.claimFeaturedListing(listingId);
      if (!claimed) {
        // Race condition: another request changed the listing between our fetch and the claim
        return res.status(409).json({ success: false, message: "Listing could not be featured — it may have just changed status" });
      }

      console.log(`[ADMIN] Admin ${req.user.username} (ID: ${req.user.id}) comp-featured listing ${listingId} ("${listing.title}")`);
      res.json({ success: true, listing: claimed });
    } catch (error) {
      console.error("[ADMIN] Error in admin feature listing endpoint:", error);
      res.status(500).json({ success: false, message: "Failed to feature listing" });
    }
  });

  // Remove Featured status from a listing. Allowed for the listing owner or
  // an admin. No credits are refunded — featuring is a consumable purchase.
  app.post("/api/listings/:id/unfeature", requireAuth, async (req, res) => {
    try {
      const listingId = parseInt(req.params.id);
      if (!Number.isInteger(listingId)) {
        return res.status(400).json({ success: false, message: "Invalid listing id" });
      }

      const listing = await storage.getListing(listingId);
      if (!listing) {
        return res.status(404).json({ success: false, message: "Listing not found" });
      }

      const isAdmin = req.user.role === 'admin';
      if (listing.createdBy !== req.user.id && !isAdmin) {
        return res.status(403).json({ success: false, message: "You do not have permission to unfeature this listing" });
      }
      if (!listing.featured) {
        return res.status(400).json({ success: false, message: "This listing is not featured" });
      }

      await storage.revertFeaturedListing(listingId);
      const updated = await storage.getListing(listingId);

      console.log(`Listing ${listingId} ("${listing.title}") unfeatured by user ${req.user.id}${isAdmin && listing.createdBy !== req.user.id ? " (admin)" : ""}`);
      res.json({ success: true, listing: updated });
    } catch (error) {
      console.error("Error in unfeature listing endpoint:", error);
      res.status(500).json({ success: false, message: "Failed to unfeature listing" });
    }
  });

  // Admin-only: remove Featured status from a listing (no credits refunded).
  // Works regardless of listing status — unfeature is always valid.
  app.post("/api/admin/listings/:id/unfeature", requireAuth, requireAdmin, async (req, res) => {
    try {
      const listingId = parseInt(req.params.id);
      if (!Number.isInteger(listingId)) {
        return res.status(400).json({ success: false, message: "Invalid listing id" });
      }

      const listing = await storage.getListing(listingId);
      if (!listing) {
        return res.status(404).json({ success: false, message: "Listing not found" });
      }

      await storage.revertFeaturedListing(listingId);
      const updated = await storage.getListing(listingId);

      console.log(`[ADMIN] Admin ${req.user.username} (ID: ${req.user.id}) unfeatured listing ${listingId} ("${listing.title}")`);
      res.json({ success: true, listing: updated });
    } catch (error) {
      console.error("[ADMIN] Error in admin unfeature listing endpoint:", error);
      res.status(500).json({ success: false, message: "Failed to unfeature listing" });
    }
  });

  // Endpoint to publish a draft listing after payment
  app.post("/api/listings/:id/publish", requireAuth, async (req, res) => {
    try {
      const listingId = parseInt(req.params.id);
      const { paymentIntentId, listingDuration } = req.body;
      
      if (!paymentIntentId) {
        return res.status(400).json({ 
          success: false, 
          message: "Payment information is required" 
        });
      }
      
      // Get the listing
      const listing = await storage.getListing(listingId);
      
      if (!listing) {
        return res.status(404).json({ success: false, message: "Listing not found" });
      }
      
      // Check if user owns the listing
      if (listing.createdBy !== req.user.id) {
        return res.status(403).json({ 
          success: false, 
          message: "You do not have permission to publish this listing" 
        });
      }
      
      // Check if listing is in DRAFT or EXPIRED status
      if (listing.status !== 'DRAFT' && listing.status !== 'EXPIRED') {
        return res.status(400).json({ 
          success: false, 
          message: "Only draft or expired listings can be published" 
        });
      }
      
      // Verify the payment with Stripe
      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(500).json({ 
          success: false, 
          message: "Payment processing is not configured" 
        });
      }
      
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2023-10-16",
      });
      
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({ 
          success: false, 
          message: "Payment has not been completed" 
        });
      }
      
      // Verify that the payment is for this listing
      if (paymentIntent.metadata.listingId !== listingId.toString()) {
        return res.status(400).json({ 
          success: false, 
          message: "Payment does not match this listing" 
        });
      }
      
      // Calculate expiration date based on duration
      const now = new Date();
      let expirationDate = new Date(now);
      
      switch (listingDuration || paymentIntent.metadata.listingDuration) {
        case '3_day':
          expirationDate.setDate(now.getDate() + 3);
          break;
        case '7_day':
          expirationDate.setDate(now.getDate() + 7);
          break;
        case '30_day':
          expirationDate.setDate(now.getDate() + 30);
          break;
        default:
          // Default to 7 days if something goes wrong
          expirationDate.setDate(now.getDate() + 7);
      }
      
      // Update the listing to active status with expiration date
      const updatedListing = await storage.updateListing(listingId, {
        status: 'ACTIVE',
        expirationDate,
        listingDuration: listingDuration || paymentIntent.metadata.listingDuration,
        updatedAt: now
      });
      
      res.json({
        success: true,
        message: "Listing published successfully",
        listing: updatedListing
      });
    } catch (error) {
      console.error("Error publishing listing:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to publish listing" 
      });
    }
  });
  
  // For Sale Listings API
  app.get("/api/listings", async (req, res) => {
    // Make listings available to all users, even if not authenticated
    // This allows the real estate page to load for everyone
    try {
      console.log("[DEBUG: Listings API] Received request for listings", {
        hasAuth: !!req.isAuthenticated(),
        userId: req.query.userId,
        excludeDrafts: req.query.excludeDrafts,
        includeNewStatus: req.query.includeNewStatus
      });
      
      // Check if we need to filter by user ID or exclude drafts
      const userId = req.query.userId;
      const excludeDrafts = req.query.excludeDrafts === 'true';
      const includeNewStatus = req.query.includeNewStatus === 'true';
      const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'newest';
      
      // Detailed timing and execution logs
      console.time("[DEBUG: Listings API] Database fetch time");
      let listings;
      
      try {
        if (userId && !isNaN(Number(userId))) {
          // Filter listings by user ID
          console.log(`[DEBUG: Listings API] Fetching listings for user ID: ${userId}`);
          listings = await storage.getListingsByUser(Number(userId));
        } else if (includeNewStatus && req.isAuthenticated() && req.user?.id) {
          // Get listings with new status for authenticated users
          console.log(`🏠 [FOR SALE NEW STATUS] Fetching listings with new status for authenticated user: ${req.user.id}`);
          listings = await storage.getListingsWithNewStatus(req.user.id);
        } else {
          // Get all listings
          console.log("[DEBUG: Listings API] Fetching all listings");
          listings = await storage.getListings();
        }
        console.log(`[DEBUG: Listings API] Retrieved ${listings ? listings.length : 0} listings`);
        // DMCA/moderation visibility: hidden listings only reach their owner (flagged).
        listings = filterForViewer(listings, await getViewerContext(req), (l: any) => l.createdBy);
        
        // Log the data structure of the first listing to help diagnose issues
        if (listings && listings.length > 0) {
          console.log("[DEBUG: Listings API] First listing structure:", JSON.stringify({
            id: listings[0].id,
            title: listings[0].title,
            status: listings[0].status,
            createdBy: listings[0].createdBy,
            photosCount: listings[0].photos ? listings[0].photos.length : 0,
            photosType: listings[0].photos ? typeof listings[0].photos : 'undefined',
            isPhotosArray: listings[0].photos ? Array.isArray(listings[0].photos) : false
          }, null, 2));
        }
        
        // Apply appropriate filtering based on the request context
        if (listings && Array.isArray(listings)) {
          console.log("[DEBUG: Listings API] Filtering listings. User authenticated:", req.isAuthenticated());
          const authenticatedUserId = req.isAuthenticated() ? req.user.id : null;
          
          // If viewing specific user's listings ("My Listings" view)
          if (userId && !isNaN(Number(userId))) {
            // For "My Listings", show all of the user's own listings (including drafts and expired)
            // Check if the requesting user is an admin - admins can see all draft listings
            const isAdmin = req.isAuthenticated() && req.user.role === 'admin';
            
            // If the requesting user is not the owner of these listings AND is not an admin,
            // filter out draft listings that don't belong to them
            if (req.isAuthenticated() && Number(userId) !== req.user.id && !isAdmin) {
              console.log(`[DEBUG: Listings API] User ${req.user.id} is viewing listings for user ${userId} - filtering out other user's drafts`);
              
              // Filter out drafts that don't belong to the current user
              listings = listings.filter(listing => {
                const isDraft = listing.status === 'DRAFT';
                return !isDraft; // Only show non-draft listings when viewing someone else's listings
              });
            } else {
              console.log(`[DEBUG: Listings API] Showing all listings for user ${userId} without status filtering (admin=${isAdmin})`);
            }
          } else {
            // For "All Listings" view, apply filtering based on excludeDrafts parameter.
            // Only admins may opt in to seeing drafts (excludeDrafts=false); for
            // everyone else the parameter is ignored so public users cannot use
            // status/draft parameters to expose unpublished listings.
            const requesterIsAdmin = req.isAuthenticated() && req.user.role === 'admin';
            const shouldExcludeDrafts = requesterIsAdmin ? req.query.excludeDrafts !== 'false' : true;
            
            const filteredListings = listings.filter(listing => {
              // Check if the authenticated user is an admin
              const isAdmin = req.isAuthenticated() && req.user.role === 'admin';
              
              // Check draft status and expired status
              const isDraft = listing.status === 'DRAFT';
              const isExpired = listing.status === 'EXPIRED';
              
              // Check if listing is actually expired by comparing expiration date with current time
              const now = new Date();
              const isActuallyExpired = listing.expirationDate && new Date(listing.expirationDate) < now;
              
              // For public view: always exclude listings with EXPIRED status (these should never appear publicly)
              if (isExpired) {
                console.log(`[DEBUG: Listings API] Filtering out EXPIRED status listing ${listing.id} from public view`);
                return false;
              }
              
              // For public view: exclude listings that are actually expired (past their expiration date)
              // This applies to ALL users including admins - expired listings should only appear in My Listings
              if (isActuallyExpired) {
                console.log(`[DEBUG: Listings API] Filtering out date-expired listing ${listing.id} (expired: ${listing.expirationDate}) from public view`);
                return false;
              }
              
              // If we should exclude drafts and this is a draft, filter it out
              if (shouldExcludeDrafts && isDraft) {
                console.log(`[DEBUG: Listings API] Excluding draft listing ${listing.id} from public view`);
                return false;
              }
              
              // Admins can see all non-expired listings including drafts (if not excluded)
              if (isAdmin) {
                console.log(`[DEBUG: Listings API] Admin can see listing ${listing.id} with status ${listing.status}, expiration: ${listing.expirationDate}`);
                return true;
              }
              
              // Include active listings that haven't expired yet
              return true;
            });
            
            console.log(`[DEBUG: Listings API] Filtered from ${listings.length} to ${filteredListings.length} listings for public view (excludeDrafts: ${shouldExcludeDrafts})`);
            listings = filteredListings;
          }
          
          console.log(`[DEBUG: Listings API] After draft filtering: ${listings.length} listings`);
        }
      } catch (dbError) {
        console.error("[DEBUG: Listings API] Database operation failed:", dbError);
        // Try to provide more detailed error information
        const errorDetails = {
          name: dbError.name,
          message: dbError.message,
          stack: dbError.stack,
          isSQLError: dbError.name === 'PostgresError',
          isTypeError: dbError instanceof TypeError,
        };
        console.error("[DEBUG: Listings API] Error details:", errorDetails);
        throw dbError; // Re-throw to be caught by the outer try-catch
      }
      console.timeEnd("[DEBUG: Listings API] Database fetch time");
      
      console.time("[DEBUG: Listings API] URL processing time");
      // Fix any real estate media URLs, with error handling for each item
      if (listings && Array.isArray(listings)) {
        // Log before URL processing
        console.log(`[DEBUG: Listings API] Processing URLs for ${listings.length} listings`);
        
        listings = listings.map(listing => {
          try {
            if (listing.photos && Array.isArray(listing.photos)) {
              // Log before processing photos
              if (listing.photos.length > 0) {
                console.log(`[DEBUG: Listings API] Processing ${listing.photos.length} photos for listing ID ${listing.id}`);
                console.log("[DEBUG: Listings API] First photo URL before processing:", listing.photos[0]);
              }
              
              listing.photos = listing.photos.map(photoUrl => {
                try {
                  const processedUrl = fixRealEstateMediaUrl(photoUrl);
                  // Log every 20th URL transformation to avoid excessive logging
                  if (Math.random() < 0.05) { // ~5% chance of logging
                    console.log(`[DEBUG: Listings API] URL transformation: ${photoUrl} -> ${processedUrl}`);
                  }
                  return processedUrl;
                } catch (photoErr) {
                  console.error('[DEBUG: Listings API] Error fixing photo URL:', photoErr, 'Original URL:', photoUrl);
                  return photoUrl; // Return original on error
                }
              });
            }
            return listing;
          } catch (listingErr) {
            console.error('[DEBUG: Listings API] Error processing listing:', listingErr, 'Listing ID:', listing.id);
            return listing; // Return original on error
          }
        });
      }
      console.timeEnd("[DEBUG: Listings API] URL processing time");

      // Apply server-side sorting so the public listings page order is
      // controlled by the API. Default: newest first.
      if (listings && Array.isArray(listings)) {
        const time = (value: any) => (value ? new Date(value).getTime() : 0);
        const num = (value: any) => (typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0);
        switch (sortBy) {
          case 'oldest':
            listings.sort((a, b) => time(a.createdAt) - time(b.createdAt));
            break;
          case 'price_asc':
            listings.sort((a, b) => num(a.price) - num(b.price));
            break;
          case 'price_desc':
            listings.sort((a, b) => num(b.price) - num(a.price));
            break;
          case 'recently_updated':
            listings.sort((a, b) => time(b.updatedAt ?? b.createdAt) - time(a.updatedAt ?? a.createdAt));
            break;
          case 'title_az':
            listings.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), undefined, { sensitivity: 'base' }));
            break;
          case 'newest':
          default:
            listings.sort((a, b) => time(b.createdAt) - time(a.createdAt));
            break;
        }
        // Featured listings always float to the top, keeping the chosen sort
        // order within each group (Array.prototype.sort is stable).
        listings.sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
      }

      console.log(`[DEBUG: Listings API] Sending response with ${listings ? listings.length : 0} listings`);
      if (includeNewStatus) {
        const newListingsCount = listings?.filter(listing => listing.isNew).length || 0;
        console.log(`🏠 [FOR SALE NEW STATUS] Response includes ${newListingsCount} new listings out of ${listings?.length || 0} total`);
      }
      res.json(listings);
    } catch (err) {
      console.error("[DEBUG: Listings API] Fatal error in listings endpoint:", err);
      // Add more detailed error logging
      const errorDetails = {
        name: err.name,
        message: err.message,
        stack: err.stack,
        type: typeof err
      };
      console.error("[DEBUG: Listings API] Error details:", errorDetails);
      
      res.status(500).json({ 
        message: "Failed to fetch listings", 
        error: String(err),
        details: process.env.NODE_ENV === 'production' ? undefined : errorDetails
      });
    }
  });

  // Admin endpoint to get all listings with user information
  app.get("/api/admin/all-listings", requireAuth, requireAdmin, async (req, res) => {
    try {
      console.log(`[ADMIN] Admin user ${req.user.username} (ID: ${req.user.id}) requesting all listings`);
      
      // Fetch all listings with user information for admin
      const listings = await storage.getAllListingsForAdmin();
      
      console.log(`[ADMIN] Retrieved ${listings.length} listings for admin view`);
      
      // Fix any real estate media URLs
      if (listings && Array.isArray(listings)) {
        listings.forEach(listing => {
          if (listing.photos && Array.isArray(listing.photos)) {
            listing.photos = listing.photos.map(photoUrl => {
              try {
                return fixRealEstateMediaUrl(photoUrl);
              } catch (photoErr) {
                console.error('Error fixing photo URL:', photoErr);
                return photoUrl;
              }
            });
          }
        });
      }
      
      res.json(listings);
    } catch (err) {
      console.error("[ADMIN] Error fetching all listings:", err);
      res.status(500).json({ 
        message: "Failed to fetch listings",
        error: String(err)
      });
    }
  });

  app.get("/api/listings/:id", async (req, res) => {
    // Make individual listings available with security restrictions for drafts
    try {
      const found = await storage.getListing(parseInt(req.params.id));
      if (!found) return res.status(404).json({ message: "Listing not found" });
      // DMCA/moderation visibility (generic 404 for the public; flagged copy for owner/dmca.view).
      const listing = await resolveDetailForViewer(req, res, found, found.createdBy, "Listing");
      if (!listing) return;
      
      // Check if the listing is a draft - if so, only creator can view it
      if (listing.status === 'DRAFT') {
        // If user is not authenticated, they definitely can't see a draft
        if (!req.isAuthenticated()) {
          return res.status(403).json({ 
            message: "This listing is currently a draft and not available for public viewing",
            status: "DRAFT"
          });
        }
        
        // If authenticated, check if user is the creator or an admin
        const isAdmin = req.user.role === 'admin';
        if (listing.createdBy !== req.user.id && !isAdmin) {
          return res.status(403).json({ 
            message: "You don't have permission to view this draft listing",
            status: "DRAFT"
          });
        }
        
        // If we're here, the user is either the creator or an admin, allow access
        if (isAdmin && listing.createdBy !== req.user.id) {
          console.log(`[ADMIN ACCESS] Admin user ${req.user.id} viewed draft listing ${listing.id} created by user ${listing.createdBy}`);
        } else {
          console.log(`Draft listing ${listing.id} accessed by creator (user ID: ${req.user.id})`);
        }
      }
      
      // Fix any real estate media URLs in calendar folder to use the dedicated folder
      if (listing.photos && Array.isArray(listing.photos)) {
        listing.photos = listing.photos.map(photoUrl => fixRealEstateMediaUrl(photoUrl));
      }
      
      res.json(listing);
    } catch (err) {
      console.error("Error fetching listing:", err);
      res.status(500).json({ message: "Failed to fetch listing" });
    }
  });

  // Custom multer configuration for real estate listings with increased size limit
  // Using memory storage instead of disk storage for Object Storage
  const realEstateUpload = multer({
    storage: multer.memoryStorage(), // Use memory storage for direct Object Storage uploads
    fileFilter: function (req: any, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) {
      // Only allow image formats for real estate
      const allowedImageTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'
      ];
      
      if (allowedImageTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        console.log(`Rejected real estate image with mimetype: ${file.mimetype}`);
        cb(new Error('Only image files are allowed for real estate listings'), false);
      }
    },
    limits: {
      fileSize: 20 * 1024 * 1024 // 20MB limit specifically for real estate images
    }
  });

  // Helper function to calculate required credits based on listing duration
  const calculateRequiredCredits = (listingDuration: string): number => {
    // Duration can be in formats like "3_day", "7_day", "30_day" or "3", "7", "30"
    const normalizedDuration = listingDuration.replace('_day', '');
    
    switch (normalizedDuration) {
      case '3':
        return 2;  // 3 days = 2 credits
      case '7':
        return 5;  // 7 days = 5 credits
      case '30':
        return 10; // 30 days = 10 credits
      default:
        return 2;  // Default to 3-day pricing
    }
  };

  app.post("/api/listings", handleRealEstateUpload, realEstateObjectStorageMiddleware, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    // Only check if user is blocked - allow non-residents and non-approved users
    if (req.user.isBlocked) {
      return res.status(403).json({ 
        message: "Your account has been blocked. You cannot create listings.", 
        blocked: true 
      });
    }

    try {
      const { listingData, paymentId, useCredits } = req.body;
      
      // Parse the JSON data from the form data if needed
      let parsedData;
      try {
        parsedData = typeof listingData === 'string' ? JSON.parse(listingData) : listingData;
        console.log("Successfully parsed listing data");
      } catch (error) {
        console.error("Error parsing listing data string:", error);
        parsedData = listingData;
      }
      
      // Check if this is intended to be a draft listing
      const isDraft = parsedData.status === "DRAFT";
      console.log("Creating listing with status:", isDraft ? "DRAFT" : "ACTIVE");
      
      // Only require payment for non-draft listings (unless using credits)
      if (!isDraft && !paymentId && !useCredits) {
        return res.status(400).json({ 
          success: false, 
          message: "Payment is required to publish a listing. Please complete payment first or save as draft."
        });
      }
      
      // Set up variables for payment verification
      let paymentVerificationOk = true;
      let paymentVerificationWarning = null;
      let paymentIdNumber: number | null = null;
      let payment = null;
      
      // Only verify payment for non-draft listings
      if (!isDraft && paymentId) {
        // Enhanced payment verification with better logging
        console.log("Payment verification for listing creation:");
        console.log("- Payment ID:", paymentId);
        console.log("- Payment ID type:", typeof paymentId);
        console.log("- User ID:", req.user.id);
        
        // Enhanced payment ID validation with better error reporting
        try {
          console.log("Raw payment ID before processing:", paymentId, typeof paymentId);
          
          // Handle different possible formats of paymentId
          if (typeof paymentId === 'string') {
            // If it's a string, try to parse it as a number
            paymentIdNumber = parseInt(paymentId.trim(), 10);
          } else if (typeof paymentId === 'number') {
            // If it's already a number, use it directly
            paymentIdNumber = paymentId;
          } else if (paymentId === null || paymentId === undefined) {
            // If it's null or undefined, handle that case
            console.error("Payment ID is null or undefined");
            return res.status(400).json({ 
              success: false, 
              message: "Payment ID is missing. Please complete payment before creating a listing.",
              errors: [{ path: "paymentId", message: "Payment ID is required" }]
            });
          } else {
            // If it's some other type, try to convert it
            console.error("Unexpected payment ID type:", typeof paymentId);
            paymentIdNumber = Number(paymentId);
          }
          
          // Check if the parsed value is valid
          if (isNaN(paymentIdNumber) || paymentIdNumber <= 0) {
            console.error("Invalid payment ID after parsing:", paymentIdNumber);
            return res.status(400).json({ 
              success: false, 
              message: "Invalid payment ID format. Please complete payment before creating a listing.",
              errors: [{ path: "paymentId", message: "Payment ID must be a positive number" }]
            });
          }
          
          console.log("- Parsed payment ID:", paymentIdNumber);
        } catch (parseError) {
          console.error("Error parsing payment ID:", parseError);
          return res.status(400).json({ 
            success: false, 
            message: "Could not process payment ID. Please complete payment before creating a listing.",
            errors: [{ path: "paymentId", message: "Payment ID parsing error" }]
          });
        }
        
        // Verify the payment status
        try {
          payment = await storage.getListingPayment(paymentIdNumber);
          console.log("- Payment record found:", payment ? "Yes" : "No");
          
          if (payment) {
            console.log("- Payment details:", JSON.stringify(payment, null, 2));
          }
        } catch (dbError) {
          console.error("Database error retrieving payment:", dbError);
          return res.status(500).json({ 
            success: false, 
            message: "Error retrieving payment information"
          });
        }
        
        // If there's no payment record, log it but allow the user to continue
        if (!payment) {
          console.log("- Payment record not found, but allowing user to continue");
          paymentVerificationOk = false;
          paymentVerificationWarning = "We couldn't verify your payment, but we're letting you create your listing.";
        } 
        // If payment exists, verify ownership
        else if (payment.userId !== req.user.id) {
          console.log("- Payment user ID mismatch. Payment user:", payment.userId, "Current user:", req.user.id);
          paymentVerificationOk = false;
          paymentVerificationWarning = "The payment record doesn't match your account, but we're letting you create your listing.";
        }
        // Verify payment status
        else if (payment.status !== 'completed') {
          console.log("- Payment status check failed. Current status:", payment.status);
          paymentVerificationOk = false;
          paymentVerificationWarning = "Your payment status is not showing as complete, but we're letting you create your listing.";
        }
        // Check if payment was already used
        else if (payment.listingId) {
          console.log("- Payment already used for listing:", payment.listingId);
          paymentVerificationOk = false;
          paymentVerificationWarning = "This payment appears to have been used already, but we're letting you create your listing.";
        }
      }
      
      // Credit-based publishing for non-draft listings when useCredits is true OR paymentId is 999999 (fake payment ID for credits)
      const isCreditBasedPublishing = (!isDraft && useCredits) || (!isDraft && paymentId === 999999) || (!isDraft && paymentId === "999999");
      
      if (isCreditBasedPublishing) {
        console.log("Credit-based publishing detected for non-draft listing", { useCredits, paymentId, isDraft });
        
        // Calculate required credits based on listing duration
        const requiredCredits = calculateRequiredCredits(parsedData.listingDuration || '30_day');
        
        // Check if user has enough credits
        const userCredits = await creditService.getUserCredits(req.user.id);
        
        console.log(`Credit validation: User has ${userCredits} credits, needs ${requiredCredits} for ${parsedData.listingDuration || '30_day'} listing`);
        
        if (userCredits < requiredCredits) {
          return res.status(400).json({
            success: false,
            message: `Insufficient credits. You have ${userCredits} credits but need ${requiredCredits} to publish this listing.`,
            creditsNeeded: requiredCredits,
            currentCredits: userCredits
          });
        }
        
        // Deduct credits from user's account
        const creditTransaction = await creditService.useCredits(
          req.user.id,
          requiredCredits,
          `Published listing: ${parsedData.title || 'Untitled Listing'}`
        );
        
        if (!creditTransaction) {
          return res.status(500).json({
            success: false,
            message: "Failed to process credit transaction. Please try again."
          });
        }
        
        console.log(`Successfully deducted ${requiredCredits} credits from user ${req.user.id}. Transaction ID: ${creditTransaction.id}`);
      }
      
      console.log("Proceeding with listing creation", isDraft ? "as draft" : "as active listing");
      
      // Normalize listingDuration if it exists but has an unexpected format
      if (parsedData.listingDuration) {
        const duration = String(parsedData.listingDuration);
        if (!duration.includes('_day')) {
          // Try to normalize to the expected format (e.g., "3" -> "3_day", "3 day" -> "3_day")
          const durationMatch = duration.match(/(\d+)/);
          if (durationMatch) {
            const days = durationMatch[1];
            parsedData.listingDuration = `${days}_day`;
            console.log(`Normalized listing duration from "${duration}" to "${parsedData.listingDuration}"`);
          }
        }
      }
      
      // Process files uploaded to Object Storage via realEstateObjectStorageMiddleware
      // The middleware should've already uploaded files and stored their URLs in req.uploadedMediaUrls
      const mediaUrls = (req as any).uploadedMediaUrls || [];
      console.log(`Using ${mediaUrls.length} real estate media files from Object Storage`, mediaUrls);
      
      // Combine existing photos with new uploads
      const existingPhotos = Array.isArray(parsedData.photos) ? parsedData.photos : [];
      const allPhotos = [...existingPhotos, ...mediaUrls];
      
      // Validate and transform the data
      const processedListingData = {
        ...parsedData,
        // Ensure numeric fields are properly typed
        price: Number(parsedData.price) || 0,
        bedrooms: Number(parsedData.bedrooms) || 0,
        bathrooms: Number(parsedData.bathrooms) || 0,
        squareFeet: Number(parsedData.squareFeet) || 0,
        yearBuilt: Number(parsedData.yearBuilt) || 0,
        // Use combined photos array
        photos: allPhotos,
        // Ensure contact info is properly formatted with enhanced validation
        contactInfo: {
          name: parsedData.contactInfo?.name?.trim() || 'Anonymous',
          // Format phone number to match required format if possible, otherwise use a placeholder
          phone: parsedData.contactInfo?.phone?.trim()
            ? /^\(\d{3}\) \d{3}-\d{4}$/.test(parsedData.contactInfo.phone.trim())
              ? parsedData.contactInfo.phone.trim()
              : parsedData.contactInfo.phone.trim().replace(/\D/g, '').match(/^(\d{3})(\d{3})(\d{4})$/)
                ? `(${parsedData.contactInfo.phone.trim().replace(/\D/g, '').match(/^(\d{3})(\d{3})(\d{4})$/)[1]}) ${parsedData.contactInfo.phone.trim().replace(/\D/g, '').match(/^(\d{3})(\d{3})(\d{4})$/)[2]}-${parsedData.contactInfo.phone.trim().replace(/\D/g, '').match(/^(\d{3})(\d{3})(\d{4})$/)[3]}`
                : '(555) 555-5555'
            : '(555) 555-5555',
          // Ensure valid email format
          email: parsedData.contactInfo?.email?.trim()
            ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsedData.contactInfo.email.trim())
              ? parsedData.contactInfo.email.trim()
              : parsedData.contactInfo?.email?.includes('@')
                ? parsedData.contactInfo.email.trim()
                : 'user@example.com'
            : 'user@example.com',
        },
        // Set status based on draft flag
        status: isDraft ? "DRAFT" : "ACTIVE",
        // Properly handle expirationDate conversion
        expirationDate: parsedData.expirationDate
          ? (typeof parsedData.expirationDate === 'string' 
             ? new Date(parsedData.expirationDate) 
             : parsedData.expirationDate instanceof Date 
               ? parsedData.expirationDate 
               : undefined)
          : undefined
      };
      
      // Only set expiration date for active listings, not drafts
      if (!isDraft) {
        // Fix: If expirationDate is an invalid date after conversion, calculate a default one based on listingDuration
        if (!processedListingData.expirationDate || isNaN(processedListingData.expirationDate.getTime())) {
          console.log("Invalid or missing expirationDate, calculating from listingDuration");
          const defaultExpiration = new Date();
          
          if (processedListingData.listingDuration === '3_day') {
            defaultExpiration.setDate(defaultExpiration.getDate() + 3);
          } else if (processedListingData.listingDuration === '7_day') {
            defaultExpiration.setDate(defaultExpiration.getDate() + 7);
          } else {
            // Default to 30 days for all other cases
            defaultExpiration.setDate(defaultExpiration.getDate() + 30);
          }
          
          processedListingData.expirationDate = defaultExpiration;
          console.log(`Set default expirationDate to ${defaultExpiration.toISOString()}`);
        }
      } else {
        // For draft listings, set expirationDate to null
        processedListingData.expirationDate = null;
        console.log("Draft listing - setting expirationDate to null");
      }

      // Featured status can only be granted through the guarded feature
      // endpoints (credits / admin comp) — never from client create payloads.
      delete processedListingData.featured;
      delete processedListingData.featuredAt;

      // Enhanced debugging before validation
      console.log("=== LISTING VALIDATION DEBUG ===");
      console.log("Raw listing data being validated:");
      console.log(JSON.stringify(processedListingData, null, 2));
      console.log("=== END VALIDATION DEBUG ===");

      const result = insertListingSchema.safeParse(processedListingData);

      if (!result.success) {
        const formattedErrors = result.error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code,
          received: JSON.stringify(err.received),
          expected: err.code === 'invalid_type' ? err.expected : undefined
        }));

        console.error("=== VALIDATION ERRORS ===");
        console.error("Validation errors:", JSON.stringify(formattedErrors, null, 2));
        console.error("=== END VALIDATION ERRORS ===");

        return res.status(400).json({
          message: "Invalid listing data",
          errors: formattedErrors
        });
      }

      // Now all fields exist in the database, no need to filter
      const validatedListingData = result.data;
      
      console.log("Creating listing with status:", isDraft ? "DRAFT" : "ACTIVE");
      
      const listing = await storage.createListing({
        ...validatedListingData,
        createdBy: req.user.id,
        // Ensure the status is set correctly based on isDraft
        status: isDraft ? "DRAFT" : "ACTIVE",
        // For non-draft listings, make sure expirationDate is set
        expirationDate: isDraft ? null : (validatedListingData.expirationDate || defaultExpirationDate),
        isSubscription: validatedListingData.isSubscription || false,
        subscriptionId: validatedListingData.subscriptionId || null,
        // Let storage.ts handle createdAt and updatedAt
      });

      // Update the payment record with the new listing ID, but only if payment exists
      if (payment && payment.id) {
        try {
          await storage.updateListingPayment(payment.id, {
            listingId: listing.id,
            updatedAt: new Date()
          });
          console.log(`Updated payment record ${payment.id} with listing ID ${listing.id}`);
        } catch (paymentUpdateError) {
          // Just log the error but don't fail the whole operation
          console.error("Error updating payment record with listing ID:", paymentUpdateError);
        }
      } else {
        console.log("No valid payment record to update with listing ID.");
      }

      // Update the creator's for-sale visit timestamp so they don't see their own listing as "new"
      try {
        await storage.updateForSaleVisit(req.user.id);
        console.log(`Updated for-sale visit for listing creator (user ${req.user.id})`);
      } catch (visitError) {
        console.error("Error updating for-sale visit after listing creation:", visitError);
      }

      console.log("Successfully created listing:", JSON.stringify(listing, null, 2));
      res.status(201).json(listing);
    } catch (err) {
      console.error("Error creating listing:", err);
      // Enhanced error logging for debugging
      if (err instanceof Error) {
        console.error("Error message:", err.message);
        console.error("Error stack:", err.stack);
      }
      // For PostgreSQL errors
      if (err && typeof err === 'object' && 'code' in err) {
        console.error("Database error code:", (err as any).code);
        console.error("Database error detail:", (err as any).detail);
        console.error("Database error constraint:", (err as any).constraint);
      }
      res.status(500).json({
        message: "Failed to create listing",
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // Update listing endpoint - using the same larger upload size limit
  app.patch("/api/listings/:id", handleRealEstateUpload, realEstateObjectStorageMiddleware, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    // Check if user is blocked (only for non-admin users)
    if (req.user.isBlocked && req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: "Your account has been blocked. You cannot update listings.", 
        blocked: true 
      });
    }

    try {
      const listingId = parseInt(req.params.id);
      const listing = await storage.getListing(listingId);

      if (!listing) {
        return res.status(404).json({ message: "Listing not found" });
      }

      // Check if user owns the listing or is an admin
      const isAdmin = req.user.role === 'admin';
      if (listing.createdBy !== req.user.id && !isAdmin) {
        return res.status(403).json({ message: "Not authorized to update this listing" });
      }

      // Parse the JSON data from the form
      let listingData;
      try {
        listingData = JSON.parse(req.body.data);
        console.log("[UpdateListing] Parsed listing data from request:", JSON.stringify(listingData, null, 2));
      } catch (error) {
        console.error("Error parsing listing data:", error);
        return res.status(400).json({ message: "Invalid listing data format" });
      }

      // Process files uploaded to Object Storage via realEstateObjectStorageMiddleware
      const newMediaUrls = (req as any).uploadedMediaUrls || [];
      console.log(`[UpdateListing] Using ${newMediaUrls.length} real estate media files from Object Storage`, newMediaUrls);

      // Log the existing photos vs incoming photos for debugging
      console.log("[UpdateListing] Existing listing photos count:", listing.photos?.length || 0);
      console.log("[UpdateListing] Incoming photos from client:", listingData.photos);
      console.log("[UpdateListing] Incoming photos count:", listingData.photos?.length);

      // Use photos from the client if they're provided (which includes deletions)
      let photos;
      if (listingData.photos !== undefined) {
        photos = listingData.photos;
        if (newMediaUrls.length > 0) {
          photos = [...photos, ...newMediaUrls];
        }
        console.log("[UpdateListing] Using client-provided photos (with deletions applied)");
      } else {
        photos = newMediaUrls.length > 0 ?
          [...(listing.photos || []), ...newMediaUrls] :
          listing.photos || [];
        console.log("[UpdateListing] No photos in request, keeping existing photos");
      }
      
      console.log("[UpdateListing] Final photos to save:", photos);
      console.log("[UpdateListing] Final photos count:", photos?.length);

      // Validate and transform the data
      const updatedData = {
        ...listingData,
        photos,
        // Preserve existing status if no status is provided in the update
        status: listingData.status || listing.status,
        // Featured status can only change through the guarded feature/unfeature
        // endpoints — ignore any client-supplied values and keep the DB state.
        featured: listing.featured,
        featuredAt: listing.featuredAt,
        updatedAt: new Date()
      };

      console.log("Updating listing with data:", JSON.stringify(updatedData, null, 2));

      const result = insertListingSchema.safeParse(updatedData);

      if (!result.success) {
        console.error("Validation errors:", JSON.stringify(result.error.errors, null, 2));
        return res.status(400).json({
          message: "Invalid listing data",
          errors: result.error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message,
            received: JSON.stringify(err.received),
            expected: err.code === 'invalid_type' ? err.expected : undefined
          }))
        });
      }
      
      // Now including all fields for the update operation
      const validatedListingData = result.data;
      
      console.log("Updating listing with all fields including expiration and subscription data");

      const updatedListing = await storage.updateListing(listingId, {
        ...validatedListingData,
        // Ensure we keep the update time
        updatedAt: new Date()
      });

      console.log("Successfully updated listing:", JSON.stringify(updatedListing, null, 2));

      // Update the editor's for-sale visit timestamp so they don't see their own edit as "new"
      try {
        await storage.updateForSaleVisit(req.user.id);
        console.log(`Updated for-sale visit for listing editor (user ${req.user.id})`);
      } catch (visitError) {
        console.error("Failed to update for-sale visit after listing edit:", visitError);
      }

      res.json(updatedListing);
    } catch (err) {
      console.error("Error updating listing:", err);
      res.status(500).json({
        message: "Failed to update listing",
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // Delete listing endpoint
  app.delete("/api/listings/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    // Check if user is blocked (only for non-admin users)
    if (req.user.isBlocked && req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: "Your account has been blocked. You cannot delete listings.", 
        blocked: true 
      });
    }

    try {
      const listingId = parseInt(req.params.id);
      const listing = await storage.getListing(listingId);

      if (!listing) {
        return res.status(404).json({ message: "Listing not found" });
      }

      // Check if user owns the listing or is an admin
      const isAdmin = req.user.role === 'admin';
      if (listing.createdBy !== req.user.id && !isAdmin) {
        return res.status(403).json({ message: "Not authorized to delete this listing" });
      }
      await assertCanPermanentDelete(req, listing.createdBy);

      await storage.deleteListing(listingId);
      res.sendStatus(200);
    } catch (err) {
      if (err instanceof PermanentDeletePermissionError) return res.status(403).json({ message: err.message });
      if (err instanceof LegalHoldError) return res.status(423).json({ error: "legal_hold", message: err.message });
      console.error("Error deleting listing:", err);
      res.status(500).json({ message: "Failed to delete listing" });
    }
  });
  
  // Delete all listings endpoint (admin only)
  app.delete("/api/listings", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      await assertCanPermanentDelete(req);
      await storage.deleteAllListings();
      res.status(200).json({ message: "All listings have been deleted successfully" });
    } catch (err) {
      if (err instanceof PermanentDeletePermissionError) return res.status(403).json({ message: err.message });
      if (err instanceof LegalHoldError) return res.status(423).json({ error: "legal_hold", message: err.message });
      console.error("Error deleting all listings:", err);
      res.status(500).json({ message: "Failed to delete all listings" });
    }
  });
  
  // Contact form for listings - send email
  app.post("/api/listings/:id/contact", async (req, res) => {
    // Enhanced authentication debugging for production
    console.log("[Listing Contact] Authentication debug:", {
      isAuthenticated: req.isAuthenticated(),
      hasUser: !!req.user,
      sessionID: req.sessionID,
      cookies: req.headers.cookie ? "Present" : "None",
      host: req.headers.host,
      origin: req.headers.origin,
      userAgent: req.headers['user-agent']?.substring(0, 50) + "...",
      isProduction: process.env.NODE_ENV === 'production',
      deploymentFlag: process.env.REPLIT_DEPLOYMENT
    });
    
    if (!req.isAuthenticated()) {
      console.log("[Listing Contact] Authentication failed - user not authenticated");
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    // Check if user is blocked (no exceptions for admins to maintain community standards)
    if (req.user.isBlocked) {
      return res.status(403).json({ 
        message: "Your account has been blocked. You cannot contact listing owners.", 
        blocked: true 
      });
    }
    
    try {
      const listingId = parseInt(req.params.id);
      const { message } = req.body;
      
      console.log("[Listing Contact] Processing contact form:", {
        listingId,
        messageLength: message?.length || 0,
        userId: req.user.id,
        username: req.user.username
      });
      
      if (!message || message.trim().length < 10) {
        console.log("[Listing Contact] Message validation failed - too short");
        return res.status(400).json({ message: "Message is required and must be at least 10 characters" });
      }
      
      // Get the listing
      console.log("[Listing Contact] Fetching listing from database...");
      const listing = await storage.getListing(listingId);
      if (!listing) {
        console.log("[Listing Contact] Listing not found:", listingId);
        return res.status(404).json({ message: "Listing not found" });
      }
      
      console.log("[Listing Contact] Listing found:", {
        id: listing.id,
        title: listing.title,
        hasContactInfo: !!listing.contactInfo
      });
      
      // Get the contact info
      const contactInfo = listing.contactInfo as { name?: string; email?: string; phone?: string };
      if (!contactInfo?.email) {
        console.log("[Listing Contact] No contact email found in listing");
        return res.status(400).json({ message: "This listing does not have an email address to contact" });
      }
      
      console.log("[Listing Contact] Contact info validated:", {
        hasEmail: !!contactInfo.email,
        hasName: !!contactInfo.name,
        email: contactInfo.email
      });
      
      // Check if SendGrid is configured — resolves from the Replit connector
      // first, then falls back to the SENDGRID_API_KEY env var.
      let sendGridConfigured = false;
      try {
        await getSendGridCredentials();
        sendGridConfigured = true;
      } catch {
        sendGridConfigured = false;
      }

      console.log("[Listing Contact] Environment check:", {
        nodeEnv: process.env.NODE_ENV,
        sendGridConfigured
      });

      if (!sendGridConfigured) {
        console.error("[Listing Contact] SendGrid not configured (no connector or SENDGRID_API_KEY)");
        return res.status(503).json({ 
          message: "Email service is currently unavailable. Please try again later or contact support.",
          debug: process.env.NODE_ENV !== 'production' ? 'SendGrid not configured' : undefined
        });
      }
      
      // Send the email with enhanced error handling
      console.log("[Listing Contact] Calling sendListingContactEmail with SendGrid...");
      console.log("[Listing Contact] Email parameters:", {
        listingId,
        listingTitle: listing.title,
        toEmail: contactInfo.email,
        senderInfo: {
          username: req.user.username,
          email: req.user.email,
          fullName: req.user.fullName,
          phoneNumber: req.user.phoneNumber
        },
        messageLength: message.length
      });
      
      let emailResult;
      let confirmationResult;
      try {
        emailResult = await sendListingContactEmail(
          listingId,
          listing.title,
          contactInfo.email,
          {
            username: req.user.username,
            email: req.user.email,
            fullName: req.user.fullName,
            phoneNumber: req.user.phoneNumber
          },
          message
        );
      } catch (emailError) {
        console.error("[Listing Contact] Email service threw exception:", emailError);
        console.error("[Listing Contact] Email error stack:", emailError instanceof Error ? emailError.stack : 'No stack');
        
        // Provide specific error responses based on the type of failure
        if (emailError instanceof Error && emailError.message.includes('invalid_grant')) {
          return res.status(503).json({
            message: "Email service configuration issue. Please contact support.",
            debug: process.env.NODE_ENV !== 'production' ? "OAuth2 refresh token expired" : undefined
          });
        }
        
        return res.status(500).json({
          message: "Failed to send message due to email service error.",
          debug: process.env.NODE_ENV !== 'production' ? emailError.message : undefined
        });
      }
      
      console.log("[Listing Contact] Email service result:", emailResult);
      
      if (!emailResult) {
        console.log("[Listing Contact] Email service returned false");
        return res.status(500).json({ 
          message: "Failed to send message. The email service did not complete successfully.",
          debug: process.env.NODE_ENV !== 'production' ? "Email service returned false" : undefined
        });
      }
      
      // Send confirmation email to the sender
      try {
        console.log("[Listing Contact] Sending confirmation email to sender...");
        confirmationResult = await sendListingContactConfirmationEmail(
          listingId,
          listing.title,
          {
            name: contactInfo.name,
            email: contactInfo.email,
            phone: contactInfo.phone
          },
          {
            username: req.user.username,
            email: req.user.email,
            fullName: req.user.fullName,
            phoneNumber: req.user.phoneNumber
          },
          message
        );
        
        if (!confirmationResult) {
          console.warn("[Listing Contact] Confirmation email failed to send, but main email succeeded");
        } else {
          console.log("[Listing Contact] Confirmation email sent successfully");
        }
      } catch (confirmationError) {
        console.error("[Listing Contact] Confirmation email threw exception (non-critical):", confirmationError);
      }
      
      console.log("[Listing Contact] Success - message sent");
      res.json({ success: true, message: "Message sent successfully" });
    } catch (err) {
      console.error("=== CRITICAL LISTING CONTACT ERROR ===");
      console.error("[Listing Contact] Caught error during contact form processing");
      console.error("[Listing Contact] Error type:", typeof err);
      console.error("[Listing Contact] Error constructor:", err?.constructor?.name);
      console.error("[Listing Contact] Error message:", err instanceof Error ? err.message : String(err));
      console.error("[Listing Contact] Error stack:", err instanceof Error ? err.stack : 'No stack trace');
      console.error("[Listing Contact] Request body:", JSON.stringify(req.body, null, 2));
      console.error("[Listing Contact] Request user:", req.user ? { id: req.user.id, username: req.user.username } : 'Not authenticated');
      console.error("[Listing Contact] Listing ID:", listingId);
      console.error("[Listing Contact] Environment variables status:", {
        hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
        hasGoogleRefreshToken: !!process.env.GOOGLE_REFRESH_TOKEN,
        hasGoogleUserEmail: !!process.env.GOOGLE_USER_EMAIL
      });
      console.error("=== END CRITICAL ERROR ===");
      
      // Enhanced error response for debugging
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred during contact form processing';
      const debugInfo = process.env.NODE_ENV !== 'production' ? {
        error: errorMessage,
        errorType: typeof err,
        constructor: err?.constructor?.name,
        stack: err instanceof Error ? err.stack : undefined
      } : undefined;
      
      // Ensure we don't crash the server by handling response errors
      try {
        res.status(500).json({ 
          message: "Failed to send message. Please try again or contact support.",
          debug: debugInfo
        });
      } catch (responseError) {
        console.error("[Listing Contact] Failed to send error response:", responseError);
        // Last resort - try to send minimal response
        try {
          res.status(500).end();
        } catch (finalError) {
          console.error("[Listing Contact] Complete response failure:", finalError);
        }
      }
    }
  });
  
  // Publish a draft listing
  app.put("/api/listings/:id/publish", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    // Check if user is blocked
    if (req.user.isBlocked) {
      return res.status(403).json({ 
        message: "Your account has been blocked. You cannot publish listings.", 
        blocked: true 
      });
    }
    
    const listingId = parseInt(req.params.id);
    const { duration, paymentIntentId, subscriptionId } = req.body;
    
    try {
      // Get the listing
      const listing = await storage.getListing(listingId);
      if (!listing) {
        return res.status(404).json({ message: "Listing not found" });
      }
      
      // Check if user owns the listing or is an admin
      const isAdmin = req.user.role === 'admin';
      if (listing.createdBy !== req.user.id && !isAdmin) {
        return res.status(403).json({ message: "Not authorized to publish this listing" });
      }
      
      // Check if listing is already published
      if (listing.status === "ACTIVE") {
        return res.status(400).json({ message: "Listing is already published" });
      }
      
      // Validate required payment info for publishing
      if (!duration) {
        return res.status(400).json({ message: "Listing duration is required" });
      }
      
      if (!paymentIntentId && !subscriptionId && req.user.role !== 'admin') {
        return res.status(400).json({ message: "Payment information is required" });
      }
      
      // Create a payment record if payment was provided
      if (paymentIntentId) {
        await storage.createListingPayment({
          listingId,
          userId: req.user.id,
          paymentIntentId,
          amount: listing.price || 0,
          status: "completed",
          paymentMethod: "stripe",
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      
      // Publish the listing
      const publishedListing = await storage.publishListing(
        listingId, 
        duration, 
        subscriptionId
      );
      
      res.json({
        success: true,
        listing: publishedListing,
        message: "Listing published successfully"
      });
    } catch (err) {
      console.error("Error publishing listing:", err);
      res.status(500).json({ 
        message: "Failed to publish listing", 
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // Bulk listings upload endpoint - with custom handler for bulk CSV uploads
  app.post("/api/listings/bulk", (req, res, next) => {
    // Create multer instance for CSV files using memory storage for Object Storage
    const upload = multer({
      limits: { fileSize: realEstateFileSize },
      storage: multer.memoryStorage(), // Use memory storage instead of disk storage
    });
    
    // Always set the media type for real estate
    req.mediaType = MEDIA_TYPES.REAL_ESTATE_MEDIA;
    console.log(`Real estate bulk upload using memory storage for CSV file`);
    
    // Use multer's single method for this case
    const handler = upload.single('listings');
    return handler(req, res, next);
  }, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      if (req.file.mimetype !== 'text/csv') {
        return res.status(400).json({ message: "Please upload a CSV file" });
      }

      // We're using memory storage, so the file is in buffer instead of on disk
      const csvData = req.file.buffer.toString('utf-8');
      const rows = csvData.split('\n').map(row => row.split(','));
      const headers = rows[0].map(header => header.trim());

      const listings = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length === headers.length) {
          const listing = {};
          headers.forEach((header, index) => {
            let value = row[index].trim();
            // Convert numeric fields
            if (['price', 'bedrooms', 'bathrooms', 'squareFeet'].includes(header)) {
              value = parseFloat(value);
            }
            listing[header] = value;
          });

          const result = insertListingSchema.safeParse(listing);
          if (result.success) {
            // Create default expiration date (30 days from now)
            const defaultExpirationDate = new Date();
            defaultExpirationDate.setDate(defaultExpirationDate.getDate() + 30);
            
            // Now all fields are supported in the database
            listings.push({
              ...result.data,
              createdBy: req.user.id,
              // Set default values for new fields if not provided
              expirationDate: result.data.expirationDate || defaultExpirationDate,
              isSubscription: result.data.isSubscription || false,
              subscriptionId: result.data.subscriptionId || null
            });
          }
        }
      }

      // Create all listings
      const createdListings = await Promise.all(
        listings.map(listing => storage.createListing(listing))
      );

      // No need to clean up file since we're using memory storage
      
      res.status(201).json({
        message: `Successfully created ${createdListings.length} listings`,
        listings: createdListings,
      });
    } catch (err) {
      console.error("Error uploading listings:", err);
      res.status(500).json({ message: "Failed to upload listings" });
    }
  });

  // Add bulk upload endpoint
  // Bulk Event Upload via direct JSON POST
  app.post("/api/events/bulk-json", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      if (!Array.isArray(req.body)) {
        return res.status(400).json({ message: "Request body must be an array of events" });
      }
      
      const events = [];
      
      for (const eventData of req.body) {
        try {
          // Process each event
          const event = { ...eventData };
          
          // Validate the event with insertEventSchema
          console.log('Processing event:', event.title);
          const result = insertEventSchema.safeParse(event);
          if (result.success) {
            events.push({
              ...result.data,
              createdBy: req.user.id,
            });
          } else {
            console.warn('Event validation failed:', result.error);
          }
        } catch (error) {
          console.error('Error processing event:', error);
        }
      }
      
      // Create all events
      const createdEvents = await Promise.all(
        events.map(event => storage.createEvent(event))
      );
      
      // Broadcast event creation to all connected clients if any events were created
      if (createdEvents.length > 0) {
        broadcastWebSocketMessage('calendar_update', {
          action: 'bulk_create',
          count: createdEvents.length
        });
      }
      
      res.status(201).json({
        message: `Successfully created ${createdEvents.length} events`,
        events: createdEvents,
      });
    } catch (err) {
      console.error("Error uploading events via JSON:", err);
      res.status(500).json({ message: "Failed to upload events" });
    }
  });

  // Original bulk upload endpoint through file upload
  app.post("/api/events/bulk", upload.single('events'), mediaSyncMiddleware, async (req, res) => {
    console.log("DEBUG: Bulk upload endpoint called");
    
    if (!req.isAuthenticated()) {
      console.log("DEBUG: Not authenticated");
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (req.user.role !== 'admin') {
      console.log("DEBUG: Not admin, role is:", req.user.role);
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      if (!req.file) {
        console.log("DEBUG: No file uploaded");
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      console.log("DEBUG: File uploaded:", req.file.originalname, "Mimetype:", req.file.mimetype);

      // Allow both CSV and JSON files
      const isCSV = req.file.mimetype === 'text/csv' || req.file.originalname.endsWith('.csv');
      const isJSON = req.file.mimetype === 'application/json' || req.file.originalname.endsWith('.json');
      
      console.log("DEBUG: File type detection - isCSV:", isCSV, "isJSON:", isJSON);
      
      if (!isCSV && !isJSON) {
        console.log("DEBUG: Invalid file type");
        return res.status(400).json({ message: "Please upload a CSV or JSON file" });
      }

      const events = [];
      
      if (isCSV) {
        // Process CSV file
        // Process CSV file - use simpler parsing approach that works in ESM
        const csvData = fs.readFileSync(req.file.path, 'utf-8');
        
        // Remove BOM character if present
        const dataWithoutBOM = csvData.replace(/^\uFEFF/, '');
        
        // More robust CSV parsing approach that doesn't rely on require()
        // First, split into lines and get headers
        const lines = dataWithoutBOM.split('\n').filter(line => line.trim());
        const headers = parseCSVLine(lines[0]);
        
        // Parse each line into records
        const records = [];
        for (let i = 1; i < lines.length; i++) {
          if (lines[i].trim()) {
            const values = parseCSVLine(lines[i]);
            if (values.length === headers.length) {
              const record = {};
              headers.forEach((header, index) => {
                record[header.trim()] = values[index];
              });
              records.push(record);
            }
          }
        }
        
        // Helper function to parse CSV line respecting quotes
        function parseCSVLine(line) {
          const values = [];
          let inQuotes = false;
          let currentValue = '';
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
              // Toggle quote state
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              // End of field
              values.push(currentValue);
              currentValue = '';
            } else {
              currentValue += char;
            }
          }
          
          // Add the last field
          values.push(currentValue);
          return values;
        }
        
        for (const record of records) {
          try {
            const event = { ...record };
            
            // Convert date strings to proper Date objects
            if (event.startDate) {
              event.startDate = new Date(event.startDate);
            }
            if (event.endDate) {
              event.endDate = new Date(event.endDate);
            }
            if (event.recurrenceEndDate) {
              event.recurrenceEndDate = new Date(event.recurrenceEndDate);
            }
            
            // Convert boolean strings to actual booleans
            if (event.isRecurring !== undefined) {
              // Handle cases where isRecurring might be a string like "true" or a boolean
              if (typeof event.isRecurring === 'string') {
                event.isRecurring = event.isRecurring.toLowerCase() === 'true';
                console.log('Converted isRecurring string to boolean:', event.isRecurring);
              }
            }
            
            // Parse JSON structures if they are strings
            if (event.contactInfo && typeof event.contactInfo === 'string') {
              try {
                // Remove any escaped quotes or extra formatting from JSON string
                const cleanedJson = event.contactInfo.replace(/\\"/g, '"');
                console.log('Parsing contactInfo:', cleanedJson);
                event.contactInfo = JSON.parse(cleanedJson);
              } catch (err) {
                console.warn('Failed to parse contactInfo JSON:', err, event.contactInfo);
              }
            }
            
            if (event.hoursOfOperation && typeof event.hoursOfOperation === 'string') {
              try {
                // Remove any escaped quotes or extra formatting from JSON string
                const cleanedJson = event.hoursOfOperation.replace(/\\"/g, '"');
                console.log('Parsing hoursOfOperation:', cleanedJson);
                event.hoursOfOperation = JSON.parse(cleanedJson);
              } catch (err) {
                console.warn('Failed to parse hoursOfOperation JSON:', err, event.hoursOfOperation);
              }
            }
            
            if (event.mediaUrls && typeof event.mediaUrls === 'string') {
              try {
                // Remove any escaped quotes or extra formatting from JSON string
                const cleanedJson = event.mediaUrls.replace(/\\"/g, '"');
                console.log('Parsing mediaUrls:', cleanedJson);
                event.mediaUrls = JSON.parse(cleanedJson);
              } catch (err) {
                // If it's not JSON, check for pipe-separated values first (our template format)
                if (event.mediaUrls.includes('|')) {
                  event.mediaUrls = event.mediaUrls.split('|').map(url => url.trim()).filter(Boolean);
                  console.log('Parsed mediaUrls as pipe-separated list:', event.mediaUrls);
                } else {
                  // Fall back to comma-separated for backwards compatibility 
                  event.mediaUrls = event.mediaUrls.split(',').map(url => url.trim()).filter(Boolean);
                  console.log('Parsed mediaUrls as comma-separated list:', event.mediaUrls);
                }
              }
            }
            
            console.log('Parsing event:', event.title);
            // Debug log the event data before validation
            console.log('Debug - event data:', JSON.stringify({
              title: event.title,
              location: event.location,
              startDate: event.startDate,
              endDate: event.endDate,
              category: event.category,
              isRecurring: event.isRecurring,
              recurrenceFrequency: event.recurrenceFrequency,
              recurrenceEndDate: event.recurrenceEndDate
            }));
            
            const result = insertEventSchema.safeParse(event);
            if (result.success) {
              events.push({
                ...result.data,
                createdBy: req.user.id,
              });
            } else {
              console.warn('Event validation failed:', result.error);
              // Log more details about the validation error
              console.log('Validation error issues:', JSON.stringify(result.error.format(), null, 2));
            }
          } catch (error) {
            console.error('Error processing event record:', error);
          }
        }
      } else {
        // Process JSON file
        const jsonData = fs.readFileSync(req.file.path, 'utf-8');
        let jsonEvents;
        
        try {
          jsonEvents = JSON.parse(jsonData);
        } catch (err) {
          return res.status(400).json({ message: "Invalid JSON format" });
        }
        
        if (!Array.isArray(jsonEvents)) {
          return res.status(400).json({ message: "JSON file must contain an array of events" });
        }
        
        for (const eventData of jsonEvents) {
          try {
            // Process the event data 
            const event = { ...eventData };
            
            // Convert date strings to proper Date objects
            if (event.startDate && typeof event.startDate === 'string') {
              event.startDate = new Date(event.startDate);
            }
            if (event.endDate && typeof event.endDate === 'string') {
              event.endDate = new Date(event.endDate);
            }
            if (event.recurrenceEndDate && typeof event.recurrenceEndDate === 'string') {
              event.recurrenceEndDate = new Date(event.recurrenceEndDate);
            }
            
            // Convert boolean strings to actual booleans
            if (event.isRecurring !== undefined && typeof event.isRecurring === 'string') {
              event.isRecurring = event.isRecurring.toLowerCase() === 'true';
            }
            
            // Parse any JSON strings that might be in the data
            if (event.contactInfo && typeof event.contactInfo === 'string') {
              try {
                event.contactInfo = JSON.parse(event.contactInfo);
              } catch (err) {
                console.warn('Failed to parse contactInfo JSON in JSON file:', err);
              }
            }
            
            if (event.hoursOfOperation && typeof event.hoursOfOperation === 'string') {
              try {
                event.hoursOfOperation = JSON.parse(event.hoursOfOperation);
              } catch (err) {
                console.warn('Failed to parse hoursOfOperation JSON in JSON file:', err);
              }
            }
            
            if (event.mediaUrls && typeof event.mediaUrls === 'string') {
              try {
                event.mediaUrls = JSON.parse(event.mediaUrls);
              } catch (err) {
                // For JSON upload, also check for pipe-separated mediaUrls
                if (event.mediaUrls.includes('|')) {
                  event.mediaUrls = event.mediaUrls.split('|').map(url => url.trim()).filter(Boolean);
                  console.log('Parsed mediaUrls as pipe-separated list in JSON file:', event.mediaUrls);
                } else {
                  // Fall back to comma-separated for backwards compatibility
                  event.mediaUrls = event.mediaUrls.split(',').map(url => url.trim()).filter(Boolean);
                  console.log('Parsed mediaUrls as comma-separated list in JSON file:', event.mediaUrls);
                }
              }
            }
            
            // Validate the event
            console.log('Parsing JSON event:', event.title);
            const result = insertEventSchema.safeParse(event);
            if (result.success) {
              events.push({
                ...result.data,
                createdBy: req.user.id,
              });
            } else {
              console.warn('JSON event validation failed:', result.error);
            }
          } catch (error) {
            console.error('Error processing JSON event:', error);
          }
        }
      }

      // Log how many events we have to create
      console.log(`DEBUG: Attempting to create ${events.length} events`);
      
      if (events.length === 0) {
        console.log("DEBUG: No valid events to create - validation must have failed for all records");
        return res.status(400).json({ 
          message: "No valid events found in the uploaded file. Please check the file format and required fields." 
        });
      }
      
      try {
        // Create all events
        console.log("DEBUG: Creating events in database");
        const createdEvents = await Promise.all(
          events.map(event => storage.createEvent(event))
        );
        
        console.log(`DEBUG: Successfully created ${createdEvents.length} events`);
        
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
  
        res.status(201).json({
          message: `Successfully created ${createdEvents.length} events`,
          events: createdEvents,
        });
      } catch (createError) {
        console.error("DEBUG: Error creating events:", createError);
        throw createError; // Re-throw to be caught by the outer catch block
      }
    } catch (err) {
      console.error("Error uploading events:", err);
      res.status(500).json({ message: "Failed to upload events" });
    }
  });

  // Event comments routes
  app.post("/api/events/:id/comments", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const eventId = parseInt(req.params.id);
      const { content } = req.body;

      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ message: "Comment content is required" });
      }
      
      // Check only if user is blocked
      if (req.user.isBlocked) {
        return res.status(403).json({ 
          message: "Your account has been blocked. You cannot leave comments.",
          blockReason: req.user.blockReason || "Contact an administrator for more information."
        });
      }
      
      // We no longer check isApproved flag - only role-based permissions matter now

      const comment = await storage.createEventComment({
        eventId,
        userId: req.user.id,
        content: content.trim()
      });

      // Get the complete user data for the response
      const user = await storage.getUser(req.user.id);
      const commentWithUser = {
        ...comment,
        user: user ? {
          id: user.id,
          username: user.username,
          avatarUrl: user.avatarUrl,
          isResident: user.isResident,
          role: user.role,
          subscriptionStatus: user.subscriptionStatus,
          subscriptionType: user.subscriptionType,
          hasMembershipBadge: user.hasMembershipBadge,
          membershipBadgeNumber: user.membershipBadgeNumber,
          createdAt: user.createdAt,
          fullName: user.fullName,
          email: user.email,
          residentTags: user.residentTags
        } : undefined
      };

      res.json(commentWithUser);
    } catch (err) {
      console.error("Error creating comment:", err);
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  app.get("/api/events/:id/comments", async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      // Comments on a hidden event are hidden with it.
      const viewer = await getViewerContext(req);
      const parent = await storage.getEvent(eventId);
      if (parent && !canViewerSee(parent, viewer, (parent as any).createdBy)) return sendContentUnavailable(res, "Event");
      const comments = await storage.getEventComments(eventId);
      res.json(filterForViewer(comments, viewer, (c: any) => c.userId));
    } catch (err) {
      console.error("Error fetching comments:", err);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });
  
  // Delete a comment by ID
  app.delete("/api/events/comments/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const commentId = parseInt(req.params.id);
      const isAdmin = req.user.role === 'admin';
      const commentOwner = (await db.execute(sql`SELECT user_id FROM event_comments WHERE id=${commentId}`)).rows[0] as any;
      if (isAdmin) {
        try {
          await assertCanPermanentDelete(req, commentOwner?.user_id ?? null);
        } catch (e) {
          if (e instanceof PermanentDeletePermissionError) return res.status(403).json({ message: e.message });
          throw e;
        }
      }
      
      // If user is admin, they can delete any comment
      // Otherwise users can only delete their own comments
      if (isAdmin) {
        // Admin can delete any comment
        await storage.deleteEventComment(commentId, 0); // Pass 0 as userId for admin override
      } else {
        // Non-admin users can only delete their own comments
        await storage.deleteEventComment(commentId, req.user.id);
      }
      
      res.sendStatus(200);
    } catch (err) {
      if (err instanceof LegalHoldError) return res.status(423).json({ error: "legal_hold", message: err.message });
      console.error("Error deleting comment:", err);
      res.status(500).json({ message: "Failed to delete comment" });
    }
  });

  // Page content routes
  app.get("/api/pages", async (req, res) => {
    try {
      // Check if the user is an admin
      const isAdmin = req.user && req.user.role === 'admin';
      
      // Include hidden pages if explicitly requested OR if the user is an admin
      let includeHidden = req.query.includeHidden === 'true';
      
      // If user is admin and not specifically requesting non-hidden pages
      if (isAdmin && req.query.includeHidden !== 'false') {
        // For admin users, always include hidden pages by default
        includeHidden = true;
        console.log('Admin user accessing page contents, including hidden items');
      }
      
      let contents = await storage.getAllPageContents(includeHidden);
      contents = filterForViewer(contents, await getViewerContext(req), (p: any) => p.updatedBy ?? p.updated_by);
      
      // Handle type filtering for vendor pages
      const typeFilter = req.query.type as string;
      if (typeFilter === 'vendors') {
        console.log(`[API] Filtering pages for type: vendors`);
        console.log(`[API] Total pages before filtering: ${contents.length}`);
        
        // Filter only vendor pages using the isVendorPage function
        contents = contents.filter(page => isVendorPage(page.slug, page.title));
        
        console.log(`[API] Vendor pages found: ${contents.length}`);
        console.log(`[API] Vendor page slugs:`, contents.map(p => p.slug));
      }
      
      // Fix content media URLs in the content HTML
      const fixedContents = contents.map(content => {
        if (content.content) {
          content.content = fixContentMediaUrl(content.content);
        }
        return content;
      });
      
      res.json(fixedContents);
    } catch (err) {
      console.error("Error fetching all page contents:", err);
      res.status(500).json({ message: "Failed to fetch page contents" });
    }
  });
  
  app.delete("/api/pages/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const id = parseInt(req.params.id);
      // page_contents has no immutable creator column (updated_by changes on every edit),
      // so there is no owner exception: every admin page delete needs dmca.permanent_delete.
      await assertCanPermanentDelete(req, null);
      const success = await storage.deletePageContent(id);
      
      if (!success) {
        return res.status(404).json({ message: "Page content not found" });
      }
      
      res.json({ success: true, message: "Page content deleted successfully" });
    } catch (err) {
      if (err instanceof PermanentDeletePermissionError) return res.status(403).json({ message: err.message });
      if (err instanceof LegalHoldError) return res.status(423).json({ error: "legal_hold", message: err.message });
      console.error("Error deleting page content:", err);
      res.status(500).json({ 
        message: "Failed to delete page content",
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });
  
  // Delete all community pages endpoint (specific to "community" category)
  app.delete("/api/pages/community", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      await assertCanPermanentDelete(req);
      const result = await storage.deleteCommunityPages();
      
      res.json({ 
        success: true, 
        message: `${result.count} community pages deleted successfully`,
        count: result.count,
        deletedIds: result.deletedIds
      });
    } catch (err) {
      if (err instanceof PermanentDeletePermissionError) return res.status(403).json({ message: err.message });
      if (err instanceof LegalHoldError) return res.status(423).json({ error: "legal_hold", message: err.message });
      console.error("Error deleting community pages:", err);
      res.status(500).json({ 
        message: "Failed to delete community pages",
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });
  
  // Delete all community-related pages endpoint (all 'More' section content)
  app.delete("/api/pages/all-community", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      await assertCanPermanentDelete(req);
      const result = await storage.deleteAllCommunityPages();
      
      res.json({ 
        success: true, 
        message: `${result.count} community pages deleted successfully`,
        count: result.count,
        deletedIds: result.deletedIds
      });
    } catch (err) {
      if (err instanceof PermanentDeletePermissionError) return res.status(403).json({ message: err.message });
      if (err instanceof LegalHoldError) return res.status(423).json({ error: "legal_hold", message: err.message });
      console.error("Error deleting all community pages:", err);
      res.status(500).json({ 
        message: "Failed to delete all community pages",
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });
  
  // Public endpoint to get all social clubs for registration/profile selection
  app.get("/api/social-clubs", async (req, res) => {
    try {
      const allPages = publicOnly(await storage.getAllPageContents(false));
      const socialClubs = allPages
        .filter(page => page.slug.startsWith('social-') && !page.isHidden)
        .map(page => ({
          id: page.id,
          slug: page.slug,
          title: page.title
        }))
        .sort((a, b) => a.title.localeCompare(b.title));
      
      res.json(socialClubs);
    } catch (err) {
      console.error("Error fetching social clubs:", err);
      res.status(500).json({ message: "Failed to fetch social clubs" });
    }
  });
  
  // Special endpoint for banner slides - Modified to avoid conflicts with vendor pages 
  // by ensuring the URL ends with exactly "banner-slides" with no extra characters
  app.get("/api/pages/banner-slides", async (req, res) => {
    // Parse the URL to get just the pathname without query parameters
    const url = new URL(req.originalUrl, `http://${req.get('host')}`);
    const pathname = url.pathname;
    
    // Strict matching: Must be exactly "/api/pages/banner-slides"
    // This excludes query parameters like cache-busting _cb parameters
    if (pathname !== '/api/pages/banner-slides') {
      // This is a vendor page or other content type request - not the banner slides endpoint
      console.log(`⛔ Rejecting incorrect banner-slides request pathname: ${pathname} (original: ${req.originalUrl})`);
      return res.status(404).json({ message: "Not the banner-slides endpoint" });
    }
    
    try {
      console.log(`🎯 Serving banner slides endpoint for exact path match: ${pathname}`);
      const bannerRow = await storage.getPageContent("banner-slides");
      // DMCA/moderation: a hidden banner page is treated as absent.
      const content = bannerRow && isPubliclyVisible(bannerRow) ? bannerRow : undefined;
      if (!content) {
        return res.status(404).json({ message: "Page content not found for banner-slides" });
      }
      res.json(content);
    } catch (err) {
      console.error("Error fetching banner slides content:", err);
      res.status(500).json({ message: "Failed to fetch banner slides content" });
    }
  });
  
  app.get("/api/pages/:slug", async (req, res) => {
    try {
      // DMCA/moderation visibility applies to every response path below.
      await enforceVisibilityOnJson(req, res, (p: any) => p.updatedBy ?? p.updated_by, "Page");
      // Extract the full slug from the request
      const fullSlug = req.params.slug;
      
      // Check if the user is an admin
      const isAdmin = req.user && req.user.role === 'admin';
      
      // Include hidden content if explicitly requested OR if the user is an admin
      let includeHidden = req.query.includeHidden === 'true';
      
      // If user is admin and not specifically requesting non-hidden content
      if (isAdmin && req.query.includeHidden !== 'false') {
        // For admin users, always include hidden content by default
        includeHidden = true;
        console.log('Admin user accessing specific page content, including hidden items');
      }
      
      console.log(`----------------------`);
      console.log(`🔍 Page content request for slug: "${fullSlug}" (includeHidden: ${includeHidden})`);
      console.log(`Request URL: ${req.originalUrl}`);
      console.log(`Request path: ${req.path}`);
      console.log(`Request IP: ${req.ip}`);
      console.log(`User agent: ${req.get('User-Agent')}`);
      
      // Universal handling for all vendor pages
      if (fullSlug.startsWith('vendors-') && fullSlug.split('-').length >= 3) {
        console.log(`⚡ [API] Universal handling for vendor page: ${fullSlug}`);
        
        try {
          // Direct database lookup for the vendor
          const vendorContent = await storage.getPageContent(fullSlug, true);
          
          if (vendorContent) {
            console.log(`✅ [API] Found vendor content with ID: ${vendorContent.id}`);
            
            // Fix content media URLs if needed
            if (vendorContent.content) {
              vendorContent.content = fixContentMediaUrl(vendorContent.content);
            }
            
            return res.json(vendorContent);
          } else {
            console.log(`❌ [API] Vendor content not found in database for slug: ${fullSlug}`);
            
            // Try to find similar vendor pages to help fix the slug
            console.log(`🔍 [API] Searching for similar vendor pages...`);
            const allPages = await storage.getAllPageContents(true);
            const vendorPages = allPages.filter(p => p.slug.startsWith('vendors-'));
            
            // Extract category and vendor name from the requested slug
            const slugParts = fullSlug.split('-');
            const requestedCategory = slugParts[1]; // e.g., "food"
            const vendorNameParts = slugParts.slice(2); // e.g., ["dining", "riverwalk", "cafe"]
            
            console.log(`🔍 [API] Looking for category "${requestedCategory}" with vendor parts:`, vendorNameParts);
            
            // Enhanced matching logic to handle "and" variations
            const matchingVendors = vendorPages.filter(page => {
              const pageSlugParts = page.slug.split('-');
              const pageCategory = pageSlugParts[1];
              
              // Universal enhanced category matching: handle all "and" pattern mismatches
              let categoryMatches = false;
              
              if (pageCategory === requestedCategory) {
                // Direct match (e.g., "food" === "food")
                categoryMatches = true;
              } else if (pageSlugParts.length >= 4 && pageSlugParts[2] === 'and') {
                // Universal handling for ANY category with "and" pattern
                // Database format: vendors-category-and-subcategory-vendor-name
                // URL format: vendors-category-subcategory-vendor-name (missing "and")
                
                const dbCategoryFull = pageSlugParts.slice(1, 4).join('-'); // e.g., "food-and-dining"
                const requestCategoryFull = `${requestedCategory}-${vendorNameParts[0]}`; // e.g., "food-dining"
                
                // Check if removing "and" from database category matches the request
                if (dbCategoryFull.replace('-and-', '-') === requestCategoryFull) {
                  categoryMatches = true;
                  console.log(`🔍 [API] Universal "and" pattern match: ${requestCategoryFull} → ${dbCategoryFull}`);
                }
                
                // Also check for exact category match (first part only)
                if (pageCategory === requestedCategory) {
                  categoryMatches = true;
                  console.log(`🔍 [API] Category first-part match: ${requestedCategory} → ${pageCategory}`);
                }
              }
              
              if (!categoryMatches) return false;
              
              // Extract vendor name parts from the database page
              // For "vendors-food-and-dining-riverwalk-cafe", vendor parts are ["riverwalk", "cafe"]
              let pageVendorParts;
              if (pageSlugParts.length >= 4 && pageSlugParts[2] === 'and') {
                // Skip the "and" part: vendors-food-and-dining-vendor-name
                pageVendorParts = pageSlugParts.slice(4);
              } else {
                // Normal format: vendors-category-vendor-name
                pageVendorParts = pageSlugParts.slice(2);
              }
              
              // Universal extraction of vendor name from request (skip category parts)
              let requestVendorParts = vendorNameParts;
              
              // Enhanced subcategory detection for any compound category request
              // This ensures proper vendor name extraction across all categories
              if (vendorNameParts.length > 1) {
                // Check if first part might be a subcategory by detecting common subcategory patterns
                const potentialSubcategory = vendorNameParts[0];
                const commonSubcategories = [
                  'dining', 'services', 'medical', 'electronics', 'care', 'living', 'financial', 
                  'quality', 'control', 'washing', 'barrier', 'transportation', 'installation',
                  'management', 'sales', 'supply', 'senior', 'personal', 'insurance', 'real',
                  'estate', 'home', 'technology', 'air', 'pest', 'pressure', 'moving', 'new',
                  'homes', 'plumbing', 'roofing', 'beauty', 'health', 'hvac', 'landscaping',
                  'funeral', 'automotive', 'golf', 'carts', 'anchor', 'vapor'
                ];
                
                if (commonSubcategories.includes(potentialSubcategory)) {
                  requestVendorParts = vendorNameParts.slice(1);
                  console.log(`🔍 [API] Enhanced subcategory detection: "${potentialSubcategory}" → vendor parts: [${requestVendorParts.join(',')}]`);
                }
              }
              
              console.log(`🔍 [API] Comparing vendor names: request=[${requestVendorParts.join(',')}] vs page=[${pageVendorParts.join(',')}]`);
              
              // Check if vendor name parts match exactly
              if (requestVendorParts.length === pageVendorParts.length) {
                const exactMatch = requestVendorParts.every((part, index) => part === pageVendorParts[index]);
                if (exactMatch) {
                  console.log(`🎯 [API] EXACT vendor name match found: ${page.slug}`);
                  return true;
                }
              }
              
              // FUZZY MATCHING DISABLED: Only allow exact vendor name matches
              console.log(`🚫 [API] FALLBACK FUZZY MATCHING DISABLED - preventing wrong matches`);
              return false; // No fuzzy matching allowed
            });
            
            console.log(`🔍 [API] Found ${matchingVendors.length} potential matches:`, matchingVendors.map(v => v.slug));
            
            if (matchingVendors.length > 0) {
              // Sort matches to prioritize exact vendor name matches
              const sortedMatches = matchingVendors.sort((a, b) => {
                // Extract vendor parts for both matches
                const aSlugParts = a.slug.split('-');
                const bSlugParts = b.slug.split('-');
                
                let aVendorParts, bVendorParts;
                
                // Handle "and" pattern for match A
                if (aSlugParts.length >= 4 && aSlugParts[2] === 'and') {
                  aVendorParts = aSlugParts.slice(4);
                } else {
                  aVendorParts = aSlugParts.slice(2);
                }
                
                // Handle "and" pattern for match B
                if (bSlugParts.length >= 4 && bSlugParts[2] === 'and') {
                  bVendorParts = bSlugParts.slice(4);
                } else {
                  bVendorParts = bSlugParts.slice(2);
                }
                
                // Get request vendor parts (skip subcategories universally)
                let requestVendorParts = vendorNameParts;
                if (vendorNameParts.length > 1) {
                  const potentialSubcategory = vendorNameParts[0];
                  const commonSubcategories = ['dining', 'services', 'medical', 'electronics', 'care', 'living', 'financial', 'quality', 'control', 'washing', 'barrier', 'transportation'];
                  
                  if (commonSubcategories.includes(potentialSubcategory)) {
                    requestVendorParts = vendorNameParts.slice(1);
                  }
                }
                
                // Check exact match for A
                const aExactMatch = requestVendorParts.length === aVendorParts.length && 
                  requestVendorParts.every((part, index) => part === aVendorParts[index]);
                
                // Check exact match for B
                const bExactMatch = requestVendorParts.length === bVendorParts.length && 
                  requestVendorParts.every((part, index) => part === bVendorParts[index]);
                
                // Prioritize exact matches
                if (aExactMatch && !bExactMatch) return -1;
                if (!aExactMatch && bExactMatch) return 1;
                
                // If both or neither are exact matches, sort alphabetically for consistency
                return a.slug.localeCompare(b.slug);
              });
              
              const bestMatch = sortedMatches[0];
              console.log(`✅ [API] Using best vendor match: ${bestMatch.slug} (ID: ${bestMatch.id})`);
              console.log(`🔍 [API] Match ranking: ${sortedMatches.map((m, i) => `${i+1}. ${m.slug}`).join(', ')}`);
              
              // Fix content media URLs if needed
              if (bestMatch.content) {
                bestMatch.content = fixContentMediaUrl(bestMatch.content);
              }
              
              return res.json(bestMatch);
            }
          }
        } catch (err) {
          console.error(`❌ [API] Error fetching vendor content for ${fullSlug}:`, err);
        }
      }
      
      // SPECIAL CASE: Check if this is a vendor page request that might conflict with banner-slides
      if (fullSlug.startsWith('vendors-') && (fullSlug.includes('services') || fullSlug.includes('antiques'))) {
        console.log(`⚠️ Detected potential vendor/banner conflict for: "${fullSlug}"`);
        console.log(`Checking database for correct vendor page...`);
        
        try {
          // Get all vendor pages and search for the one that most closely matches our slug
          const allPages = await storage.getAllPageContents(includeHidden);
          
          console.log(`Retrieved ${allPages.length} total pages to search for matching vendor`);
          
          // First try to find exact match
          const exactMatch = allPages.find(p => p.slug === fullSlug);
          if (exactMatch) {
            console.log(`✅ Found exact vendor page match with ID ${exactMatch.id}, title "${exactMatch.title}"`);
            
            // Fix content media URLs in the content HTML if available
            if (exactMatch.content) {
              exactMatch.content = fixContentMediaUrl(exactMatch.content);
            }
            
            return res.json(exactMatch);
          }
          
          // FUZZY MATCHING DISABLED: Return 404 instead of serving wrong vendor content
          console.log(`❌ [API] FUZZY MATCHING DISABLED - No exact match found for vendor slug: ${fullSlug}`);
          console.log(`🚫 [API] This prevents serving wrong vendor content like "Blues Clues 2" for "Blues Clues 3000"`);
          
          // Extract vendor parts for debugging
          const vendorName = fullSlug.split('-').slice(3).join('-');
          console.log(`🔍 [API] Requested vendor name: "${vendorName}"`);
          
          // Show available vendor pages for debugging
          const vendorPages = allPages.filter(p => p.slug.startsWith('vendors-'));
          console.log(`🔍 [API] Available vendor pages (first 10):`, vendorPages.slice(0, 10).map(p => p.slug));
          
          // Return 404 - better than wrong content
          console.log(`❌ [API] Returning 404 instead of potentially wrong vendor content`);
          return res.status(404).json({ 
            error: 'Vendor page not found',
            message: `No exact match found for vendor: ${fullSlug}`,
            suggestion: 'Please check the URL spelling or contact administrator'
          });
        } catch (vendorMatchErr) {
          console.error("Error during vendor page resolution:", vendorMatchErr);
          // Continue with normal search below if vendor-specific search fails
        }
      }
      
      // Initialize variables
      let content = null;
      let baseSlug = '';
      let section = '';
      let dashSlug = '';
      let hashSlug = '';
      
      // Parse the slug to determine format and extract base/section components
      if (fullSlug.includes('-')) {
        // Dash format (preferred): amenities-golf
        const parts = fullSlug.split('-');
        baseSlug = parts[0];
        section = parts.slice(1).join('-'); // Handle multiple dashes
        dashSlug = fullSlug; // Already in dash format
        hashSlug = `${baseSlug}#${section}`; // For fallback
        
        console.log(`Dash format detected: baseSlug="${baseSlug}", section="${section}"`);
      } else if (fullSlug.includes('#')) {
        // Hash format (legacy): amenities#golf
        // This shouldn't happen in URLs but might be in database or direct API calls
        const parts = fullSlug.split('#');
        baseSlug = parts[0];
        section = parts[1] || '';
        dashSlug = section ? `${baseSlug}-${section}` : baseSlug;
        hashSlug = fullSlug; // Already in hash format
        
        console.log(`Hash format detected: baseSlug="${baseSlug}", section="${section}"`);
        console.log(`Converted to preferred dash format: "${dashSlug}"`);
      } else {
        // No section specified: just amenities
        baseSlug = fullSlug;
        dashSlug = fullSlug;
        hashSlug = fullSlug;
        
        console.log(`No section format detected: baseSlug="${baseSlug}"`);
      }
      
      // Search strategy:
      // 1. First try exact slug as provided (direct match)
      console.log(`1. Trying exact slug match: "${fullSlug}"`);
      content = await storage.getPageContent(fullSlug, includeHidden);
      
      // Enhanced special handling for vendor slugs which might have various formats
      if (!content && fullSlug.startsWith('vendors-')) {
        console.log(`🔍 Enhanced vendor slug handling for: "${fullSlug}"`);
        
        // Try all possible variations for vendors
        // For example: vendors-home-services-services-barefoot-bay-homeservices
        // Might need to be: vendors-home-services-barefoot-bay-homeservices
        
        const parts = fullSlug.split('-');
        if (parts.length >= 4) { // vendors-category-vendorname format
          // Check if we have a duplicate category name in the vendor part
          const category = parts[1]; // e.g. "home-services"
          
          // Try removing duplicate category names if present
          if (parts.length >= 5 && parts[2] === parts[1]) {
            // vendors-home-services-home-services-something → vendors-home-services-something
            const simplifiedSlug = `vendors-${category}-${parts.slice(3).join('-')}`;
            console.log(`1.1a. Trying simplified vendor slug (duplicate category removed): "${simplifiedSlug}"`);
            content = await storage.getPageContent(simplifiedSlug, includeHidden);
          }
          
          // Try removing "services-" prefix from vendor name if present
          if (!content && parts.length >= 5 && parts[2] === 'services') {
            // vendors-home-services-services-something → vendors-home-services-something
            const simplifiedSlug = `vendors-${category}-${parts.slice(3).join('-')}`;
            console.log(`1.1b. Trying simplified vendor slug (services prefix removed): "${simplifiedSlug}"`);
            content = await storage.getPageContent(simplifiedSlug, includeHidden);
          }
          
          // Check for case with "barefoot-bay-homeservices" variations
          if (!content && parts.includes('barefoot') && parts.includes('bay')) {
            // Try different combinations of barefoot-bay-homeservices
            
            // Try with just barefoot-bay-homeservices
            if (parts.length >= 5) {
              const simplifiedSlug = `vendors-${category}-barefoot-bay-homeservices`;
              console.log(`1.1c. Trying barefoot bay vendor slug: "${simplifiedSlug}"`);
              content = await storage.getPageContent(simplifiedSlug, includeHidden);
            }
            
            // Try with HOME-SERVICES-barefoot-bay-homeservices
            if (!content) {
              const simplifiedSlug = `vendors-HOME-SERVICES-barefoot-bay-homeservices`;
              console.log(`1.1d. Trying uppercase version: "${simplifiedSlug}"`);
              content = await storage.getPageContent(simplifiedSlug, includeHidden);
            }
            
            // Try looking up by substring match if we still can't find it
            if (!content) {
              const contentsList = await storage.getAllPageContents();
              console.log(`1.1e. Trying substring search among ${contentsList.length} contents`);
              
              // Try to find any content with barefoot-bay-homeservices in the slug
              const matchingContent = contentsList.find(c => 
                c.slug.includes('barefoot-bay-homeservices') || 
                c.slug.includes('home-services-barefoot-bay') ||
                c.slug.toLowerCase().includes('barefoot-bay-homeservices')
              );
              
              if (matchingContent) {
                console.log(`1.1f. Found matching content via substring: "${matchingContent.slug}"`);
                content = matchingContent;
              }
            }
          }
        }
        
        // LAST RESORT FUZZY MATCHING DISABLED: Prevent wrong vendor content from being served
        if (!content) {
          console.log(`🚫 [API] LAST RESORT FUZZY MATCHING DISABLED - no fallback to similar content allowed`);
        }
      }
      
      // For vendor pages, enforce strict exact matching only - no fallback attempts
      if (fullSlug.startsWith('vendors-')) {
        console.log(`🚫 [API] VENDOR PAGE - Fallback attempts disabled for strict exact matching only`);
      } else {
        // 2. If not found and we have a section, try dash format (preferred format)
        if (!content && section) {
          console.log(`2. Trying dash format: "${dashSlug}"`);
          content = await storage.getPageContent(dashSlug, includeHidden);
        }
        
        // 3. If still not found and we have a section, try hash format (legacy format)
        if (!content && section && dashSlug !== hashSlug) {
          console.log(`3. Trying hash format: "${hashSlug}"`);
          content = await storage.getPageContent(hashSlug, includeHidden);
        }
        
        // 4. Last resort, try just the base slug (no section)
        if (!content && baseSlug !== fullSlug) {
          console.log(`4. Trying base slug: "${baseSlug}"`);
          content = await storage.getPageContent(baseSlug, includeHidden);
        }
      }
      
      // Return 404 if content not found after all attempts
      if (!content) {
        console.log(`No content found for any variation of slug: "${fullSlug}"`);
        return res.status(404).json({ 
          message: "Page content not found",
          requestedSlug: fullSlug
        });
      }
      
      console.log(`Content found for slug request "${fullSlug}", returning ID: ${content.id}`);
      
      // Fix content media URLs in the content HTML if available
      if (content.content) {
        content.content = fixContentMediaUrl(content.content);
      }
      
      res.json(content);
    } catch (err) {
      console.error("Error fetching page content:", err);
      res.status(500).json({ message: "Failed to fetch page content" });
    }
  });

  app.post("/api/pages", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      // Check and standardize slug format (convert hash to dash format)
      const requestData = { ...req.body };
      
      if (requestData.slug && requestData.slug.includes('#')) {
        const oldSlug = requestData.slug;
        const parts = oldSlug.split('#');
        const baseSlug = parts[0];
        const section = parts[1] || '';
        
        if (section) {
          // Convert hash format to dash format
          const newSlug = `${baseSlug}-${section}`;
          console.log(`Converting hash slug format "${oldSlug}" to dash format "${newSlug}"`);
          requestData.slug = newSlug;
        }
      }
      
      console.log("Creating page content with data:", {
        slug: requestData.slug,
        title: requestData.title,
        hasEmbeddedForm: requestData.content?.includes('Need a quote?')
      });

      // Log additional details for debugging
      console.log(`POST /api/pages DEBUGGING`);
      console.log(`Content length: ${requestData.content ? requestData.content.length : 0} characters`);
      console.log(`Has data:image? ${requestData.content && requestData.content.includes('data:image')}`);

      // Process any Base64 images in the content
      if (requestData.content && requestData.content.includes('data:image')) {
        console.log("Detected Base64 images in content, processing...");
        try {
          const section = requestData.slug || 'content';

          // Check for potential issues with embedded forms
          if (requestData.content.includes('<form') || requestData.content.includes('Need a quote?')) {
            console.log("WARNING: Content contains a form which may interfere with image processing!");
            
            // Special handling for forms - use regex to extract Base64 specifically
            const base64Regex = /src=["']data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,([^"']+)["']/g;
            let matches;
            let modifiedContent = requestData.content;
            const bucket = section.includes('community') ? 'COMMUNITY' : 'DEFAULT';
            
            // Log info about the embedded form content
            console.log(`Processing form-embedded content for section: ${section}, using bucket: ${bucket}`);
            
            while ((matches = base64Regex.exec(requestData.content)) !== null) {
              try {
                const format = matches[1];
                const base64Data = matches[2];
                const imgMatch = matches[0];
                const mediaType = section.includes('community') ? 'community' : 'content-media';
                
                console.log(`Found Base64 image in form content: ${format} format, ${base64Data.length} characters`);
                
                // Generate a unique filename
                const filename = `${mediaType}-${Date.now()}-${Math.round(Math.random() * 1E9)}.${format}`;
                
                // Convert Base64 to buffer
                const buffer = Buffer.from(base64Data, 'base64');
                
                // Manual upload to object storage
                console.log(`Uploading Base64 image (${buffer.length} bytes) to Object Storage: ${filename}`);
                const url = await objectStorageService.uploadData(buffer, mediaType, filename, `image/${format}`);
                
                console.log(`Image uploaded to: ${url}`);
                
                // Replace Base64 data with Object Storage URL
                modifiedContent = modifiedContent.replace(imgMatch, `src="${url}"`);
              } catch (err) {
                console.error("Failed processing image in form:", err);
              }
            }
            
            requestData.content = modifiedContent;
          } else {
            // Use the regular processor for non-form content
            requestData.content = await processBase64Images(requestData.content, section);
          }
          
          console.log("Base64 images processed successfully");
        } catch (e) {
          console.error("Error processing Base64 images:", e);
          // Continue with the original content if processing fails
        }
      }

      const result = insertPageContentSchema.safeParse({
        ...requestData,
        updatedBy: req.user.id,
      });

      if (!result.success) {
        console.error("Validation errors:", result.error.errors);
        return res.status(400).json({
          message: "Invalid page content data",
          errors: result.error.errors,
        });
      }

      // Create the content first
      const content = await storage.createPageContent(result.data);
      
      // Check if version creation was requested (default to true for consistency)
      const createVersion = req.body.createVersion !== false;
      const versionNotes = req.body.versionNotes || "Initial version";
      
      if (createVersion) {
        console.log(`Creating initial version for new content ${content.id} with notes: "${versionNotes}"`);
        // Create initial version if requested
        try {
          console.log(`Creating initial version for content ID ${content.id}`);
          
          // Use storage interface to handle version creation
          const versionData = {
            contentId: content.id,
            slug: content.slug,
            title: content.title,
            content: content.content,
            mediaUrls: content.mediaUrls || [],
            notes: versionNotes,
            createdBy: req.user.id,
            // The storage interface will determine the appropriate version number
            versionNumber: 1 // Default to 1, storage will handle proper numbering
          };
          
          await storage.createContentVersion(versionData);
          console.log(`Successfully created initial version for content ${content.id}`);
        } catch (versionErr) {
          console.error(`Error creating initial version for content ${content.id}:`, versionErr);
          // Continue even if version creation fails - we still have the content
        }
      }
      
      res.status(201).json(content);
    } catch (err: any) {
      console.error("Error creating page content:", err);
      
      // Return 400 for duplicate slug errors (user-fixable validation error)
      if (err.isDuplicateSlug) {
        return res.status(400).json({ 
          message: err.message,
          isDuplicateSlug: true
        });
      }
      
      res.status(500).json({ 
        message: "Failed to create page content",
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });

  app.patch("/api/pages/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      // Standardize slug format if it exists in the update request
      const requestData = { ...req.body };
      
      // Log the full content for debugging
      console.log(`PATCH /api/pages/${req.params.id} DEBUGGING`);
      console.log(`Content length: ${requestData.content ? requestData.content.length : 0} characters`);
      console.log(`Has data:image? ${requestData.content && requestData.content.includes('data:image')}`);
      
      // Enhanced debugging for community pages - this helps us diagnose the 400 error issue
      const isCommunityPage = requestData.slug && (
        requestData.slug.startsWith('safety-') || 
        requestData.slug.startsWith('nature-') || 
        requestData.slug.startsWith('amenities-') || 
        requestData.slug.startsWith('community-')
      );
      
      if (isCommunityPage) {
        console.log(`[Community Page Debug] Processing update for community page: ${requestData.slug}`);
        console.log(`[Community Page Debug] Content starts with: ${requestData.content?.substring(0, 100)}...`);
        
        // Check for potentially problematic content patterns
        if (requestData.content) {
          const hasIncompleteImg = requestData.content.includes('<img') && !requestData.content.includes('</img>') && !requestData.content.includes('/>');
          const hasInvalidAttributes = requestData.content.includes('=""') || requestData.content.includes('= "');
          const hasMalformedTags = requestData.content.includes('<<') || requestData.content.includes('>>');
          const hasEmptyDataImage = requestData.content.includes('data:image/;base64,') || requestData.content.includes('data:image/jpeg;base64,""');
          
          console.log(`[Community Page Debug] Content analysis:
            - Has incomplete img tags: ${hasIncompleteImg}
            - Has invalid attributes: ${hasInvalidAttributes}
            - Has malformed tags: ${hasMalformedTags}
            - Has empty data images: ${hasEmptyDataImage}
          `);
        }
      }
      
      // Extract optional versioning parameters
      const createVersion = requestData.createVersion === true;
      const versionNotes = requestData.versionNotes || "Manual update";
      
      // Remove these from the data that will be validated and sent to storage
      delete requestData.createVersion;
      delete requestData.versionNotes;
      
      if (requestData.slug && requestData.slug.includes('#')) {
        const oldSlug = requestData.slug;
        const parts = oldSlug.split('#');
        const baseSlug = parts[0];
        const section = parts[1] || '';
        
        if (section) {
          // Convert hash format to dash format
          const newSlug = `${baseSlug}-${section}`;
          console.log(`Converting hash slug format "${oldSlug}" to dash format "${newSlug}" in update`);
          requestData.slug = newSlug;
        }
      }
      
      console.log("Updating page content:", { 
        id: req.params.id, 
        slug: requestData.slug,
        title: requestData.title,
        hasEmbeddedForm: requestData.content?.includes('Need a quote?'),
        createVersion,
        versionNotes
      });
      
      // Sanitize storage-proxy URLs that have erroneous /uploads prefix
      if (requestData.content && requestData.content.includes('/uploads/api/storage-proxy/')) {
        console.log('[URL Sanitization] Detected /uploads prefix on storage-proxy URLs, fixing...');
        const beforeSanitization = requestData.content;
        requestData.content = requestData.content.replace(/\/uploads\/api\/storage-proxy\//g, '/api/storage-proxy/');
        const urlsFixed = (beforeSanitization.match(/\/uploads\/api\/storage-proxy\//g) || []).length;
        console.log(`[URL Sanitization] Fixed ${urlsFixed} storage-proxy URL(s) by removing /uploads prefix`);
      }
      
      // Process any Base64 images in the content
      if (requestData.content && requestData.content.includes('data:image')) {
        console.log("Detected Base64 images in content update, processing...");
        try {
          // Use the existing content's slug to determine section, or fall back to the updated slug
          const existingContent = await storage.getPageContent(parseInt(req.params.id));
          const section = (existingContent?.slug || requestData.slug || 'content');
          
          // Check for potential issues - in some cases TinyMCE creates nested content 
          if (requestData.content.includes('<form') || requestData.content.includes('Need a quote?')) {
            console.log("WARNING: Content contains a form which may interfere with image processing!");
            
            // Special handling for forms - use regex to extract Base64 specifically
            const base64Regex = /src=["']data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,([^"']+)["']/g;
            let matches;
            let modifiedContent = requestData.content;
            const bucket = section.includes('community') ? 'COMMUNITY' : 'DEFAULT';
            
            // Log info about the embedded form content
            console.log(`Processing form-embedded content for section: ${section}, using bucket: ${bucket}`);
            
            while ((matches = base64Regex.exec(requestData.content)) !== null) {
              try {
                const format = matches[1];
                const base64Data = matches[2];
                const imgMatch = matches[0];
                const mediaType = section.includes('community') ? 'community' : 'content-media';
                
                console.log(`Found Base64 image in form content: ${format} format, ${base64Data.length} characters`);
                
                // Generate a unique filename
                const filename = `${mediaType}-${Date.now()}-${Math.round(Math.random() * 1E9)}.${format}`;
                
                // Convert Base64 to buffer
                const buffer = Buffer.from(base64Data, 'base64');
                
                // Manual upload to object storage
                console.log(`Uploading Base64 image (${buffer.length} bytes) to Object Storage: ${filename}`);
                const url = await objectStorageService.uploadData(buffer, mediaType, filename, `image/${format}`);
                
                console.log(`Image uploaded to: ${url}`);
                
                // Replace Base64 data with Object Storage URL
                modifiedContent = modifiedContent.replace(imgMatch, `src="${url}"`);
              } catch (err) {
                console.error("Failed processing image in form:", err);
              }
            }
            
            requestData.content = modifiedContent;
          } else {
            // Standard processing for regular content
            requestData.content = await processBase64Images(requestData.content, section);
          }
          
          console.log("Base64 images processed successfully in content update");
        } catch (e) {
          console.error("Error processing Base64 images in update:", e);
          // Continue with the original content if processing fails
        }
      }

      // For community pages, use the specialized validator
      if (isCommunityPage) {
        const pageId = parseInt(req.params.id);
        console.log(`[Community Page] Using enhanced validator for page ID ${pageId} with slug ${requestData.slug}`);
        
        // Pass the pageId to the validator for special handling of known problematic pages
        const validationResult = validateAndSanitizeCommunityPage(requestData, req.user.id, pageId);
        
        // Add additional logging when validation is bypassed for specific pages
        if (validationResult.bypassedValidation) {
          console.log(`[Community Page] VALIDATION BYPASSED for page ID ${pageId} - Direct database update`);
        } else if (validationResult.emergencyBypass) {
          console.log(`[Community Page] EMERGENCY BYPASS for slug ${requestData.slug} - Last resort validation override`);
        }
        
        if (validationResult.success) {
          // If validation succeeded (with or without sanitization)
          console.log(`[Community Page] Validation ${validationResult.sanitized ? 'succeeded after sanitization' : 'succeeded'}`);
          
          // Pass the versioning options to storage method
          const content = await storage.updatePageContent(
            pageId, 
            validationResult.data,
            { createVersion, versionNotes }
          );
          
          if (!content) {
            return res.status(404).json({ message: "Page content not found" });
          }
          
          return res.json(content);
        } else {
          // If validation failed even after sanitization attempts
          console.error("[Community Page] Validation failed even after sanitization attempts");
          return res.status(400).json({
            message: "Invalid page content data",
            errors: validationResult.error.errors,
          });
        }
      } else {
        // For non-community pages, use the standard validation
        console.log(`[Vendor Page] Using standard validator for page ID ${req.params.id} with slug ${requestData.slug}`);
        
        const result = insertPageContentSchema.partial().safeParse({
          ...requestData,
          updatedBy: req.user.id,
        });

        if (!result.success) {
          console.error("Validation errors:", result.error.errors);
          return res.status(400).json({
            message: "Invalid page content data",
            errors: result.error.errors,
          });
        }
        
        // Process non-community page within this else block
        try {
          // Handle specifically for vendor pages as needed
          const isVendorPage = requestData.slug && (requestData.slug.startsWith('vendors-') || requestData.slug.includes('vendor'));
          
          if (isVendorPage) {
            console.log(`[Vendor Page] Processing vendor page with slug: ${requestData.slug}`);
          }
          
          // Pass the versioning options to storage method for non-community pages
          const content = await storage.updatePageContent(
            parseInt(req.params.id), 
            result.data,
            { createVersion, versionNotes }
          );
          
          if (!content) {
            return res.status(404).json({ message: "Page content not found" });
          }
          
          return res.json(content);
        } catch (innerErr) {
          console.error(`[Vendor Page Error] Failed to update page content for ${requestData.slug}:`, innerErr);
          return res.status(500).json({ 
            message: "Failed to update page content",
            error: innerErr instanceof Error ? innerErr.message : String(innerErr),
            details: "Error occurred while updating non-community page"
          });
        }
      }

      // This line should never be reached, as both branches above return a response
      // But we'll add this as a fallback just in case
      return res.status(500).json({ message: "Unexpected flow - please report this error" });
    } catch (err) {
      console.error("Error updating page content:", err);
      res.status(500).json({ 
        message: "Failed to update page content",
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });
  
  // Content Version History API Routes
  
  // Get all versions for a content
  app.get("/api/content-versions/:contentId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    try {
      const contentId = parseInt(req.params.contentId);
      const versions = await storage.getContentVersions(contentId);
      res.json(versions);
    } catch (err) {
      console.error("Error retrieving content versions:", err);
      res.status(500).json({ 
        message: "Failed to retrieve content versions",
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });
  
  // Get all versions for a slug
  app.get("/api/content-versions/by-slug/:slug", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    try {
      const { slug } = req.params;
      const versions = await storage.getContentVersionsBySlug(slug);
      res.json(versions);
    } catch (err) {
      console.error("Error retrieving content versions by slug:", err);
      res.status(500).json({ 
        message: "Failed to retrieve content versions by slug",
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });
  
  // Restore a content to a specific version
  app.post("/api/content-versions/:versionId/restore", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    try {
      const versionId = parseInt(req.params.versionId);
      console.log(`Routes: Processing restore request for version ID ${versionId} from user ${req.user.id}`);
      
      // Perform the restoration directly through the storage interface
      // This avoids potential issues with database access in the route handler
      const restoredContent = await storage.restoreContentVersion(versionId);
      
      // Make sure we have valid content returned
      if (!restoredContent || !restoredContent.id) {
        throw new Error("Failed to restore content - no content returned from restoration");
      }
      
      console.log(`Routes: Content successfully restored. Content ID: ${restoredContent.id}, Title: "${restoredContent.title}"`); 
      
      // Return the restored content
      res.json(restoredContent);
    } catch (err) {
      console.error("Error restoring content version:", err);
      res.status(500).json({ 
        message: "Failed to restore content version",
        error: err instanceof Error ? err.message : String(err),
        stackTrace: err instanceof Error ? err.stack : undefined
      });
    }
  });
  
  // Custom Forms API Routes
  
  // Get all custom forms
  app.get("/api/forms", async (req, res) => {
    try {
      const forms = await storage.getCustomForms();
      return res.json(forms);
    } catch (error) {
      console.error("Error retrieving custom forms:", error);
      return res.status(500).json({ 
        message: "Error retrieving custom forms",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get a specific custom form by slug
  app.get("/api/forms/by-slug/:slug", async (req, res) => {
    try {
      const slug = req.params.slug;
      const form = await storage.getCustomFormBySlug(slug);
      
      if (!form) {
        return res.status(404).json({ message: "Custom form not found" });
      }
      
      return res.json(form);
    } catch (error) {
      console.error("Error retrieving custom form by slug:", error);
      return res.status(500).json({ 
        message: "Error retrieving custom form",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get a specific custom form by ID
  app.get("/api/forms/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const form = await storage.getCustomForm(id);
      
      if (!form) {
        return res.status(404).json({ message: "Custom form not found" });
      }
      
      return res.json(form);
    } catch (error) {
      console.error("Error retrieving custom form:", error);
      return res.status(500).json({ 
        message: "Error retrieving custom form",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Create a new custom form (admin only)
  app.post("/api/forms", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    // Only allow admins to create forms
    const user = req.user as User;
    if (user.role !== 'admin') {
      return res.status(403).json({ message: "Not authorized to create forms" });
    }
    
    try {
      const newForm = req.body;
      
      // Create a unique slug if not provided
      if (!newForm.slug) {
        const timestamp = new Date().getTime();
        newForm.slug = `${newForm.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${timestamp}`;
      }
      
      const createdForm = await storage.createCustomForm(newForm);
      return res.status(201).json(createdForm);
    } catch (error) {
      console.error("Error creating custom form:", error);
      return res.status(500).json({ 
        message: "Error creating custom form",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Update an existing custom form (admin only)
  app.patch("/api/forms/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    // Only allow admins to update forms
    const user = req.user as User;
    if (user.role !== 'admin') {
      return res.status(403).json({ message: "Not authorized to update forms" });
    }
    
    try {
      const id = parseInt(req.params.id);
      const formData = req.body;
      
      // Check if the form exists
      const existingForm = await storage.getCustomForm(id);
      if (!existingForm) {
        return res.status(404).json({ message: "Custom form not found" });
      }
      
      const updatedForm = await storage.updateCustomForm(id, formData);
      return res.json(updatedForm);
    } catch (error) {
      console.error("Error updating custom form:", error);
      return res.status(500).json({ 
        message: "Error updating custom form",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Delete a custom form (admin only)
  app.delete("/api/forms/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    // Only allow admins to delete forms
    const user = req.user as User;
    if (user.role !== 'admin') {
      return res.status(403).json({ message: "Not authorized to delete forms" });
    }
    
    try {
      const id = parseInt(req.params.id);
      
      // Check if the form exists
      const existingForm = await storage.getCustomForm(id);
      if (!existingForm) {
        return res.status(404).json({ message: "Custom form not found" });
      }
      
      // Delete the form (preserving submissions)
      const success = await storage.deleteCustomForm(id);
      
      return res.json({ 
        success, 
        message: success ? "Form deleted successfully" : "Failed to delete form" 
      });
    } catch (error) {
      console.error("Error deleting custom form:", error);
      return res.status(500).json({ 
        message: "Error deleting custom form",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Permanently delete a custom form and all its data (admin only) - This completely removes everything
  app.delete("/api/forms/:id/permanent-delete", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    // Only allow admins to permanently delete forms
    const user = req.user as User;
    if (user.role !== 'admin') {
      return res.status(403).json({ message: "Not authorized to permanently delete forms" });
    }
    
    try {
      const id = parseInt(req.params.id);
      
      // Check if the form exists (including negative IDs for deleted forms)
      const existingForm = await storage.getCustomForm(id);
      if (!existingForm) {
        return res.status(404).json({ message: "Custom form not found" });
      }
      
      // Permanently delete the form and all its data
      const success = await storage.permanentlyDeleteCustomForm(id);
      
      return res.json({ 
        success, 
        message: success ? "Form and all its data permanently deleted from database" : "Failed to permanently delete form" 
      });
    } catch (error) {
      console.error("Error permanently deleting custom form:", error);
      return res.status(500).json({ 
        message: "Error permanently deleting custom form",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Form Submissions API Routes
  
  // Get all form submissions across all forms (admin only)
  app.get("/api/admin/form-submissions", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    // Only allow admins to view all submissions
    const user = req.user as User;
    if (user.role !== 'admin') {
      return res.status(403).json({ message: "Not authorized to view submissions" });
    }
    
    try {
      const submissions = await storage.getAllFormSubmissions();
      return res.json(submissions);
    } catch (error) {
      console.error("Error retrieving all form submissions:", error);
      return res.status(500).json({ 
        message: "Error retrieving all form submissions",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get all submissions for a form (admin only)
  app.get("/api/forms/:id/submissions", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    // Only allow admins to view all submissions
    const user = req.user as User;
    if (user.role !== 'admin') {
      return res.status(403).json({ message: "Not authorized to view submissions" });
    }
    
    try {
      const formId = parseInt(req.params.id);
      
      // Check if the form exists
      const existingForm = await storage.getCustomForm(formId);
      if (!existingForm) {
        return res.status(404).json({ message: "Custom form not found" });
      }
      
      const submissions = await storage.getFormSubmissions(formId);
      return res.json(submissions);
    } catch (error) {
      console.error("Error retrieving form submissions:", error);
      return res.status(500).json({ 
        message: "Error retrieving form submissions",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get a specific submission (admin or owner only)
  app.get("/api/submissions/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const id = parseInt(req.params.id);
      const submission = await storage.getFormSubmission(id);
      
      if (!submission) {
        return res.status(404).json({ message: "Form submission not found" });
      }
      
      // Check if user has permission to view this submission
      const user = req.user as User;
      if (user.role !== 'admin' && submission.userId !== user.id) {
        return res.status(403).json({ message: "Not authorized to view this submission" });
      }
      
      return res.json(submission);
    } catch (error) {
      console.error("Error retrieving form submission:", error);
      return res.status(500).json({ 
        message: "Error retrieving form submission",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Submit a form (authenticated users only)
  app.post("/api/forms/:id/submit", upload.array('files'), async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const formId = parseInt(req.params.id);
      const user = req.user as User;
      
      // Check if the form exists
      const existingForm = await storage.getCustomForm(formId);
      if (!existingForm) {
        return res.status(404).json({ message: "Custom form not found" });
      }
      
      // Extract form data
      const formData = typeof req.body.formData === 'string' 
        ? JSON.parse(req.body.formData) 
        : req.body.formData || req.body;
      
      // Process uploaded files if any
      const files = req.files as Express.Multer.File[];
      const fileUploads = files ? files.map(file => file.path) : [];
      
      // Create the submission
      const submission = await storage.createFormSubmission({
        formId,
        userId: user.id,
        formData,
        termsAccepted: req.body.termsAccepted === 'true' || req.body.termsAccepted === true,
        fileUploads
      });

      // Send notifications for platinum sponsor forms
      const isPlatinumForm = existingForm.slug?.includes('platinum');
      if (isPlatinumForm) {
        const businessName = formData.business_name || formData.businessName || 'Unknown Business';
        console.log(`[Forms API] Platinum form detected (slug: ${existingForm.slug}), sending notifications for submission ${submission.id}`);

        try {
          const adminResult = await pool.query(
            `SELECT id FROM users WHERE role = 'admin' ORDER BY id`
          );

          if (adminResult.rows.length === 0) {
            console.warn('[Forms API] No admin users found, skipping in-app message for platinum request');
          } else {
            const adminIds = adminResult.rows.map((r: { id: number }) => r.id);
            const senderId = adminIds[0];

            const messageContent = `A new Platinum Sponsorship request has been submitted.\n\nForm: ${existingForm.title}\nBusiness: ${businessName}\nContact: ${formData.contact_name || formData.contactName || 'N/A'}\nEmail: ${formData.email || 'N/A'}\nPhone: ${formData.phone || 'N/A'}\nWebsite: ${formData.website || 'N/A'}\nNotes: ${formData.notes || 'None'}\n\nView this submission in the Forms Management section.`;

            const msgResult = await pool.query(
              `INSERT INTO messages (subject, content, sender_id, message_type, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id`,
              [`Platinum Sponsor Request: ${businessName}`, messageContent, senderId, 'system']
            );
            const messageId = msgResult.rows[0].id;

            for (const adminId of adminIds) {
              await pool.query(
                `INSERT INTO message_recipients (message_id, recipient_id, status, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())`,
                [messageId, adminId, 'sent']
              );
            }

            console.log(`[Forms API] In-app message ${messageId} sent to ${adminIds.length} admin user(s): [${adminIds.join(', ')}]`);
          }
        } catch (msgErr) {
          console.error('[Forms API] ERROR: Failed to send in-app message for platinum request:', msgErr instanceof Error ? msgErr.stack : msgErr);
        }

        try {
          const emailSent = await sendPlatinumSponsorRequestEmail(existingForm.title, formData);
          if (emailSent) {
            console.log('[Forms API] Platinum sponsor request email successfully sent to team@barefootbay.com');
          } else {
            console.error('[Forms API] ERROR: sendPlatinumSponsorRequestEmail returned false — email may not have been delivered');
          }
        } catch (emailErr) {
          console.error('[Forms API] ERROR: Failed to send platinum request email:', emailErr instanceof Error ? emailErr.stack : emailErr);
        }
      }
      
      return res.status(201).json(submission);
    } catch (error) {
      console.error("Error submitting form:", error);
      return res.status(500).json({ 
        message: "Error submitting form",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Contact form submission endpoint
  app.post("/api/contact", async (req, res) => {
    try {
      const data = req.body;
      const userId = req.isAuthenticated() ? (req.user as User).id : null;
      
      // Determine which form to use based on inquiry type
      let formSlug;
      if (data.inquiryType === "bug-report") {
        formSlug = "contact-bug-report";
      } else if (data.inquiryType === "feature-request") {
        formSlug = "contact-feature-request";
      } else if (data.inquiryType === "feedback") {
        formSlug = "contact-feedback";
      } else {
        return res.status(400).json({ message: "Invalid inquiry type" });
      }
      
      // Check if the form exists, if not, create it
      let form = await storage.getCustomFormBySlug(formSlug);
      
      if (!form) {
        // Create appropriate form based on type
        if (formSlug === "contact-bug-report") {
          form = await storage.createCustomForm({
            title: "Bug Report Form",
            description: "Form for submitting bug reports",
            slug: formSlug,
            formFields: [
              {
                id: "name",
                type: "text",
                label: "Name",
                required: true,
                order: 0,
              },
              {
                id: "email",
                type: "email",
                label: "Email",
                required: true,
                order: 1,
              },
              {
                id: "subject",
                type: "text",
                label: "Subject",
                required: true,
                order: 2,
              },
              {
                id: "pageUrl",
                type: "text",
                label: "Page URL",
                required: false,
                order: 3,
              },
              {
                id: "browserInfo",
                type: "text",
                label: "Browser & Device",
                required: false,
                order: 4,
              },
              {
                id: "description",
                type: "textarea",
                label: "Bug Description",
                required: true,
                order: 5,
              },
              {
                id: "stepsToReproduce",
                type: "textarea",
                label: "Steps to Reproduce",
                required: true,
                order: 6,
              },
              {
                id: "expectedBehavior",
                type: "textarea",
                label: "Expected Behavior",
                required: false,
                order: 7,
              }
            ],
            requiresTermsAcceptance: false,
          });
        } else if (formSlug === "contact-feature-request") {
          form = await storage.createCustomForm({
            title: "Feature Request Form",
            description: "Form for submitting feature requests",
            slug: formSlug,
            formFields: [
              {
                id: "name",
                type: "text",
                label: "Name",
                required: true,
                order: 0,
              },
              {
                id: "email",
                type: "email",
                label: "Email",
                required: true,
                order: 1,
              },
              {
                id: "subject",
                type: "text",
                label: "Subject",
                required: true,
                order: 2,
              },
              {
                id: "featureDescription",
                type: "textarea",
                label: "Feature Description",
                required: true,
                order: 3,
              },
              {
                id: "useCase",
                type: "textarea",
                label: "Use Case",
                required: true,
                order: 4,
              },
              {
                id: "priority",
                type: "select",
                label: "Priority",
                required: false,
                order: 5,
                options: ["low", "medium", "high", "critical"],
              }
            ],
            requiresTermsAcceptance: false,
          });
        } else if (formSlug === "contact-feedback") {
          form = await storage.createCustomForm({
            title: "Feedback Form",
            description: "Form for submitting general feedback",
            slug: formSlug,
            formFields: [
              {
                id: "name",
                type: "text",
                label: "Name",
                required: true,
                order: 0,
              },
              {
                id: "email",
                type: "email",
                label: "Email",
                required: true,
                order: 1,
              },
              {
                id: "subject",
                type: "text",
                label: "Subject",
                required: true,
                order: 2,
              },
              {
                id: "feedbackType",
                type: "select",
                label: "Feedback Type",
                required: true,
                order: 3,
                options: ["compliment", "suggestion", "general"],
              },
              {
                id: "message",
                type: "textarea",
                label: "Your Feedback",
                required: true,
                order: 4,
              }
            ],
            requiresTermsAcceptance: false,
          });
        }
      }
      
      if (!form) {
        return res.status(500).json({ message: "Failed to create or retrieve form" });
      }
      
      // Save the form submission
      const submission = await storage.createFormSubmission({
        formId: form.id,
        userId: userId,
        submitterEmail: data.email,
        formData: data,
        termsAccepted: false,
        fileUploads: [],
      });
      
      // Import the utility function to create a message from the contact form
      const { createMessageFromContactForm } = await import('./utils/contact-message-utils');
      
      try {
        // Debug logging to understand what data we're receiving
        console.log('[Contact Form Debug] Inquiry type:', data.inquiryType);
        console.log('[Contact Form Debug] Available fields:', Object.keys(data));
        console.log('[Contact Form Debug] Description field:', data.description);
        console.log('[Contact Form Debug] Message field:', data.message);
        
        // Determine the message content based on inquiry type
        let messageContent = '';
        
        // For bug reports, combine all the bug-related fields with proper formatting
        if (data.inquiryType === 'bug-report') {
          messageContent = `**Bug Description:**\n${data.description || ''}\n\n`;
          
          if (data.stepsToReproduce) {
            messageContent += `**Steps to Reproduce:**\n${data.stepsToReproduce}\n\n`;
          }
          
          if (data.expectedBehavior) {
            messageContent += `**Expected Behavior:**\n${data.expectedBehavior}\n\n`;
          }
          
          if (data.pageUrl) {
            messageContent += `**Page URL:** ${data.pageUrl}\n\n`;
          }
          
          if (data.browserInfo) {
            messageContent += `**Browser & Device:** ${data.browserInfo}`;
          }
        } else if (data.inquiryType === 'feature-request') {
          // Feature requests send the main description in the 'description' field
          messageContent = `**Feature Description:**\n${data.description || ''}\n\n`;
          
          if (data.useCase) {
            messageContent += `**Use Case:**\n${data.useCase}\n\n`;
          }
          
          if (data.benefitToUsers) {
            messageContent += `**Benefits to Users:**\n${data.benefitToUsers}`;
          }
        } else {
          // For general feedback, use the message field
          messageContent = `**Feedback:**\n${data.message || ''}`;
        }
        
        // Fallback: if messageContent is empty or just whitespace, try other fields
        if (!messageContent || messageContent.trim() === '') {
          console.log('[Contact Form Debug] Main content is empty, trying fallbacks...');
          messageContent = data.message || data.description || data.featureDescription || 'No content provided';
        }
        
        console.log('[Contact Form Debug] Final message content length:', messageContent.length);
        console.log('[Contact Form Debug] Final message content preview:', messageContent.substring(0, 100) + '...');
        
        // Create a message in the messaging system
        const messageId = await createMessageFromContactForm(
          data.inquiryType,
          userId,
          data.name,
          data.email,
          data.subject,
          messageContent
        );
        
        if (messageId > 0) {
          console.log(`Created message #${messageId} from contact form submission #${submission.id}`);
        }
      } catch (messageError) {
        // Log the error but don't fail the whole request
        console.error('Error creating message from contact form:', messageError);
      }
      
      return res.status(200).json({ 
        message: "Form submitted successfully", 
        id: submission.id 
      });
    } catch (error) {
      console.error("Error submitting contact form:", error);
      return res.status(500).json({ 
        message: "An error occurred while processing your request",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Custom icon upload endpoint - using generic processUploadedFile function
  app.post("/api/icons/upload", upload.single('iconFile'), mediaSyncMiddleware, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Check if this is an SVG file
      if (!req.file.mimetype.includes('svg')) {
        return res.status(400).json({ 
          success: false, 
          message: "Only SVG files are allowed for icons" 
        });
      }

      // Set the media type explicitly
      req.mediaType = 'icons';
      
      // Use our generic file processing function
      const result = processUploadedFile(req, req.file);
      
      if (!result.success) {
        console.error("Icon upload failed:", result.message);
        return res.status(400).json({ 
          success: false,
          message: result.message 
        });
      }
      
      console.log(`Icon uploaded successfully: ${result.url}`);

      res.json({
        success: true,
        url: result.url,
        developmentUrl: result.developmentUrl,
        message: "Icon uploaded successfully"
      });
    } catch (err) {
      console.error("Error uploading icon:", err);
      res.status(500).json({
        success: false,
        message: "Failed to upload icon"
      });
    }
  });
  
  // Shared banner slide upload handler.
  // Both POST /api/banner-slides/upload and POST /api/direct-banner-upload route
  // through this single handler so file-handling, object-storage, and URL logic
  // stay in one place (consolidates the previously duplicated upload endpoints).
  const handleBannerSlideUpload = async (req: any, res: any) => {
    console.log('Banner upload request received:', {
      isAuthenticated: req.isAuthenticated(),
      userRole: req.user?.role,
      fileName: req.file?.originalname,
      fileSize: req.file?.size,
      mimeType: req.file?.mimetype
    });
    
    if (!req.isAuthenticated()) {
      console.log('Banner upload failed: Not authenticated');
      return res.status(401).json({ 
        success: false,
        message: "Not authenticated" 
      });
    }

    if (req.user.role !== 'admin') {
      console.log('Banner upload failed: Not an admin. User role:', req.user.role);
      return res.status(403).json({ 
        success: false,
        message: "Admin access required" 
      });
    }

    if (!req.file) {
      console.log('Banner upload failed: No file provided');
      return res.status(400).json({ 
        success: false,
        message: "No file was uploaded" 
      });
    }

    try {
      // Import the media path utilities with enhanced features
      const { 
        MEDIA_TYPES, 
        createMediaFilename, 
        saveMediaFile,
        verifyBannerSlideExists,
        syncBannerSlide
      } = await import('./media-path-utils');
      
      console.log('Processing banner slide upload: File:', req.file.originalname);
      
      // Generate a unique filename for the banner image
      const fileExt = path.extname(req.file.originalname);
      const newFilename = createMediaFilename('bannerImage', fileExt);
      
      // Get the file data with better error handling
      let fileData;
      try {
        if (req.file.buffer) {
          fileData = req.file.buffer;
          console.log('Using file buffer for upload');
        } else if (req.file.path) {
          fileData = fs.readFileSync(req.file.path);
          console.log('Using file from disk for upload');
        } else {
          throw new Error("No file buffer or path available");
        }
      } catch (fileReadError) {
        console.error("Failed to read upload file:", fileReadError);
        return res.status(500).json({
          success: false,
          message: "Could not read uploaded file"
        });
      }
      
      // Upload directly to Object Storage
      console.log('Uploading banner slide to Object Storage...');
      const BANNER_BUCKET = 'BANNER'; // Use dedicated BANNER bucket for banner slides
      
      // Create a temporary file if we only have the buffer
      let tempFilePath;
      if (!req.file.path && fileData) {
        tempFilePath = path.join(os.tmpdir(), `temp-banner-${Date.now()}-${newFilename}`);
        fs.writeFileSync(tempFilePath, fileData);
        console.log(`Created temporary file for upload: ${tempFilePath}`);
        req.file.path = tempFilePath;
      }
      
      // Upload to Object Storage first, then verify the object actually exists
      // in the bucket before treating it as the durable copy. uploadFile()
      // throws ObjectStorageUploadError on failure (the try/catch below turns
      // that into objectStorageUrl=null). A successful return is always a
      // real BANNER-bucket URL, so we only need to guard the null case; the
      // existence probe remains as defense in depth (see task #103/#109).
      let objectStorageUrl: string | null = null;
      const { objectStorageService } = await import('./object-storage-service');
      try {
        objectStorageUrl = await objectStorageService.uploadFile(
          req.file.path,
          'banner-slides',
          newFilename,
          BANNER_BUCKET
        );

        console.log(`Successfully uploaded to Object Storage: ${objectStorageUrl}`);
      } catch (uploadError) {
        console.error("Error uploading to Object Storage:", uploadError);
        objectStorageUrl = null;
      }

      if (!objectStorageUrl) {
        console.error(`[Banner Upload] Object Storage upload failed; rejecting upload.`);
        return res.status(502).json({
          success: false,
          message: "Failed to persist banner image to object storage. Please try again."
        });
      }

      const bannerStorageKey = `banner-slides/${newFilename}`;
      let bannerExists = false;
      try {
        bannerExists = await objectStorageService.fileExists(bannerStorageKey, BANNER_BUCKET);
      } catch (verifyError) {
        console.error(`[Banner Upload] Error verifying uploaded banner:`, verifyError);
        bannerExists = false;
      }
      if (!bannerExists) {
        console.error(`[Banner Upload] Verification failed: ${bannerStorageKey} not found in ${BANNER_BUCKET} bucket after upload.`);
        return res.status(502).json({
          success: false,
          message: "Uploaded banner image could not be verified in object storage. Please try again."
        });
      }
      
      // Also maintain backwards compatibility by saving to filesystem
      const urls = saveMediaFile(fileData, MEDIA_TYPES.BANNER_SLIDES, newFilename);
      
      // Clean up the temporary file if we created one
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          console.log(`Deleted temporary file: ${tempFilePath}`);
        } catch (unlinkError) {
          console.warn("Failed to delete temporary file:", tempFilePath, unlinkError);
        }
      }
      
      if (!urls) {
        console.error("Banner slide upload failed: saveMediaFile returned null");
        return res.status(500).json({ 
          success: false,
          message: "Failed to save banner image to required locations" 
        });
      }
      
      // Verify the file was saved correctly in both locations
      const fileExists = verifyBannerSlideExists(newFilename);
      if (!fileExists) {
        console.error(`Banner slide verification failed for ${newFilename}`);
        return res.status(500).json({
          success: false,
          message: "Banner image was not saved correctly in both locations"
        });
      }
      
      // If multer created a temporary file, delete it as we've saved our own copies
      if (req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
          console.log(`Deleted temporary file: ${req.file.path}`);
        } catch (unlinkError) {
          console.warn("Failed to delete temporary file:", req.file.path, unlinkError);
          // Non-fatal error, continue
        }
      }
      
      // Try to sync any other banner slides that might have issues
      try {
        // Get a list of all banner slides in uploads directory
        const uploadsDir = path.join(__dirname, '../uploads', MEDIA_TYPES.BANNER_SLIDES);
        if (fs.existsSync(uploadsDir)) {
          const files = fs.readdirSync(uploadsDir);
          console.log(`Found ${files.length} existing banner slides to verify`);
          
          // Verify each file exists in both locations
          let syncCount = 0;
          for (const filename of files) {
            if (filename !== newFilename) { // Skip the one we just uploaded
              if (syncBannerSlide(filename)) {
                syncCount++;
              }
            }
          }
          if (syncCount > 0) {
            console.log(`Synchronized ${syncCount} existing banner slides`);
          }
        }
      } catch (syncError) {
        console.warn("Non-fatal error syncing other banner slides:", syncError);
        // Continue with the upload response
      }
      
      console.log(`Banner slide uploaded successfully. Dev URL: ${urls.devUrl}, Prod URL: ${urls.prodUrl}, Object Storage URL: ${objectStorageUrl || 'not available'}`);
      
      // Return all URLs to the client including Object Storage URL
      res.json({
        success: true,
        url: urls.devUrl,  // Use the uploads/dev URL as primary for consistent handling with client expectations
        developmentUrl: urls.devUrl,
        productionUrl: urls.prodUrl, // Still provide this for reference
        objectStorageUrl: objectStorageUrl, // Add Object Storage URL if available
        message: "Banner image uploaded successfully"
      });
    } catch (err) {
      console.error("Error uploading banner image:", err);
      res.status(500).json({
        success: false,
        message: `Failed to upload banner image: ${err instanceof Error ? err.message : String(err)}`
      });
    }
  };

  // Banner slide image upload endpoint - enhanced error handling and verification.
  // /api/direct-banner-upload is kept as a backwards-compatible alias for any
  // legacy callers; both share the single handler above.
  app.post("/api/banner-slides/upload", upload.single('bannerImage'), mediaSyncMiddleware, handleBannerSlideUpload);
  app.post("/api/direct-banner-upload", upload.single('bannerImage'), mediaSyncMiddleware, handleBannerSlideUpload);

  // Get all icon files - enhanced for production
  app.get("/api/icons", async (req, res) => {
    try {
      const mediaType = 'icons';
      
      // Both directories since files could be in either place
      const uploadsIconsDir = path.join(__dirname, '../uploads', mediaType);
      const prodIconsDir = path.join(__dirname, '..', mediaType);
      
      // Create the directories if they don't exist
      if (!fs.existsSync(uploadsIconsDir)) {
        fs.mkdirSync(uploadsIconsDir, { recursive: true });
      }
      
      if (!fs.existsSync(prodIconsDir)) {
        fs.mkdirSync(prodIconsDir, { recursive: true });
      }
      
      // Read all files from both directories
      let files = [];
      
      try {
        const uploadFiles = fs.readdirSync(uploadsIconsDir);
        files = [...uploadFiles];
      } catch (err) {
        console.error(`Error reading uploads/${mediaType} directory:`, err);
      }
      
      try {
        const prodFiles = fs.readdirSync(prodIconsDir);
        // Combine but remove duplicates
        files = [...new Set([...files, ...prodFiles])];
      } catch (err) {
        console.error(`Error reading ${mediaType} directory:`, err);
      }
      
      // Get the URLs for all icon files (SVGs only)
      const iconUrls = files
        .filter(file => {
          const ext = path.extname(file).toLowerCase();
          return ext === '.svg';
        })
        .map(file => ({
          url: getMediaUrl(mediaType, file, false), // false = don't use /uploads/ prefix
          name: file.replace(/iconFile-\d+-\d+\.svg/, '').replace(/-/g, ' '),
          id: file.split('-')[1] // extract the timestamp as a unique ID
        }));
      
      res.json({ icons: iconUrls });
    } catch (err) {
      console.error("Error retrieving icon files:", err);
      res.status(500).json({ 
        message: "Failed to retrieve icon files",
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });
  
  // Get all banner slide images - enhanced for production using utilities
  app.get("/api/banner-slides/images", async (req, res) => {
    try {
      const mediaType = 'banner-slides';
      
      // Both directories since files could be in either place
      const uploadsDir = path.join(__dirname, '../uploads', mediaType);
      const prodDir = path.join(__dirname, '..', mediaType);
      
      // Create the directories if they don't exist using our utility functions
      ensureDirectoryExists(uploadsDir);
      ensureDirectoryExists(prodDir);
      
      // Read all files from both directories
      let files = [];
      
      try {
        const uploadFiles = fs.readdirSync(uploadsDir);
        files = [...uploadFiles];
      } catch (err) {
        console.error(`Error reading uploads/${mediaType} directory:`, err);
      }
      
      try {
        const prodFiles = fs.readdirSync(prodDir);
        // Combine but remove duplicates
        files = [...new Set([...files, ...prodFiles])];
      } catch (err) {
        console.error(`Error reading ${mediaType} directory:`, err);
      }
      
      // Get the URLs for all banner slide images, using production path format
      const imageUrls = files
        .filter(file => {
          const ext = path.extname(file).toLowerCase();
          return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm'].includes(ext);
        })
        .map(file => getMediaUrl(mediaType, file, false)); // false = don't use /uploads/ prefix
      
      res.json({ images: imageUrls });
      
      // Verify that the reported images actually exist
      const missingImages = [];
      for (const file of files) {
        const uploadsFilePath = path.join(uploadsDir, file);
        const prodFilePath = path.join(prodDir, file);
        
        if (!fs.existsSync(uploadsFilePath) && !fs.existsSync(prodFilePath)) {
          missingImages.push(file);
        }
      }
      
      if (missingImages.length > 0) {
        console.log(`Warning: ${missingImages.length} banner slide images reported but not found in file system:`, missingImages);
      }
    } catch (err) {
      console.error("Error retrieving banner images:", err);
      res.status(500).json({ 
        message: "Failed to retrieve banner images",
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });
  
  // Content media upload endpoint for WYSIWYG editor - using generic processUploadedFile function
  app.post("/api/content/upload-media", upload.single('mediaFile'), mediaSyncMiddleware, async (req: any, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Only allow approved users to upload media
    if (!req.user.isApproved && req.user.role !== 'admin') {
      return res.status(403).json({ message: "Your account must be approved to upload media" });
    }

    try {
      // Set media type to content-media
      req.mediaType = 'content-media';
      console.log('Processing content media upload with type:', req.mediaType, 'File:', req.file?.originalname);
      
      // Use our generic file processing function
      const result = processUploadedFile(req, req.file);
      
      if (!result.success) {
        console.error("Media upload failed:", result.message);
        return res.status(400).json({ 
          success: false,
          message: result.message 
        });
      }
      
      console.log(`Media uploaded successfully: ${result.url}`);

      res.json({
        success: true,
        url: result.url,
        developmentUrl: result.developmentUrl,
        message: "Media uploaded successfully"
      });
    } catch (err) {
      console.error("Error uploading content media:", err);
      res.status(500).json({
        success: false,
        message: "Failed to upload media"
      });
    }
  });
  
  // Forum media upload endpoint - exclusively for Replit Object Storage
  app.post("/api/forum/upload-media", upload.single('mediaFile'), async (req: any, res) => {
    console.log("[ForumUpload] Starting upload process focused exclusively on Replit Object Storage");
    
    // Check authentication first
    if (!req.isAuthenticated()) {
      console.log("[ForumUpload] Authentication failed");
      return res.status(401).json({ message: "Not authenticated" });
    }

    console.log(`[ForumUpload] User: ${req.user.username} (${req.user.id})`);

    // Check if user is blocked
    if (req.user.isBlocked && req.user.role !== 'admin') {
      console.log(`[ForumUpload] User is blocked: ${req.user.username}`);
      return res.status(403).json({ 
        message: "Your account has been blocked. You cannot upload media.",
        blockReason: req.user.blockReason || "Contact an administrator for more information."
      });
    }
    
    try {
      // Check if file is present
      if (!req.file) {
        console.error("[ForumUpload] No file received");
        return res.status(400).json({ 
          success: false,
          message: "No file uploaded"
        });
      }
      
      // Log file details
      console.log("[ForumUpload] File:", {
        name: req.file.originalname,
        size: `${Math.round(req.file.size / 1024)}KB`,
        type: req.file.mimetype,
        path: req.file.path
      });
      
      // Generate filename - simpler format
      const fileExtension = path.extname(req.file.originalname);
      const timestamp = Date.now();
      const randomId = Math.round(Math.random() * 1000000);
      const filename = `forum-${timestamp}-${randomId}${fileExtension}`;
      
      console.log(`[ForumUpload] Generated filename: ${filename}`);
      
      // Create temporary debug file to ensure we can write to disk
      const debugFilePath = path.join(process.cwd(), 'tmp_debug', `debug-${timestamp}.txt`);
      try {
        fs.writeFileSync(debugFilePath, 'Debug test file');
        console.log(`[ForumUpload] Debug file created at ${debugFilePath}`);
      } catch (debugError) {
        console.error(`[ForumUpload] Error creating debug file:`, debugError);
      }
      
      // Get the Replit Object Storage client directly - we need full control
      const client = createObjectStorageClient();
      
      // Storage key for forum media - consistent format
      const storageKey = `forum/${filename}`;
      const bucket = "FORUM";
      
      console.log(`[ForumUpload] Uploading directly to Object Storage: ${bucket}/${storageKey}`);
      
      // Upload directly from the file on disk
      // This matches exactly how the test script works which definitely succeeds
      const result = await client.uploadFromFilename(
        storageKey,
        req.file.path,
        {
          bucketName: bucket,
          contentType: req.file.mimetype || 'application/octet-stream',
          headers: {
            'X-Obj-Bucket': bucket
          }
        }
      );
      
      if (!result.ok) {
        console.error(`[ForumUpload] Upload failed: ${result.error?.message}`);
        return res.status(500).json({
          success: false,
          message: `Failed to upload to Object Storage: ${result.error?.message}`
        });
      }
      
      // Successfully uploaded to Object Storage
      console.log(`[ForumUpload] Upload succeeded!`);
      
      // Verify upload by checking if object exists
      console.log(`[ForumUpload] Verifying upload...`);
      const verifyResult = await client.exists(storageKey, {
        bucketName: bucket,
        headers: { 'X-Obj-Bucket': bucket }
      });
      
      if (!verifyResult.ok || !verifyResult.value) {
        console.error(`[ForumUpload] Verification failed: file not found in bucket`);
        return res.status(500).json({
          success: false,
          message: "Upload verification failed: file not found in bucket"
        });
      }
      
      console.log(`[ForumUpload] Verification successful! File exists in bucket`);
      
      // Try downloading to confirm it's really there
      console.log(`[ForumUpload] Trying to download to verify content...`);
      const downloadResult = await client.downloadAsBytes(storageKey, {
        bucketName: bucket,
        headers: { 'X-Obj-Bucket': bucket }
      });
      
      if (downloadResult.ok) {
        console.log(`[ForumUpload] Download verification successful! Downloaded ${downloadResult.value.length} bytes`);
      } else {
        console.warn(`[ForumUpload] Download verification failed: ${downloadResult.error?.message}`);
      }
      
      // Construct URLs - multiple formats for maximum compatibility
      const directUrl = `https://object-storage.replit.app/${bucket}/${storageKey}`;
      const proxyUrl = `/api/storage-proxy/${bucket}/${storageKey}`;
      const directForumUrl = `/api/storage-proxy/direct-forum/${filename}`; // Special direct forum access point
      const simpleForumUrl = `/api/storage-proxy/forum/${filename}`; // Simplified format
      
      // Return success response with all URL formats
      console.log(`[ForumUpload] Returning success with multiple URL formats for maximum compatibility`);
      console.log(`[ForumUpload] - Primary URL: ${proxyUrl}`);
      console.log(`[ForumUpload] - Direct forum URL: ${directForumUrl}`);
      console.log(`[ForumUpload] - Simple forum URL: ${simpleForumUrl}`);
      
      return res.json({
        success: true,
        url: proxyUrl, // Primary URL to use (recommended)
        directUrl: directUrl, // Direct Object Storage URL (for debugging)
        directForumUrl: directForumUrl, // Direct forum access endpoint
        simpleForumUrl: simpleForumUrl, // Simplified format for compatibility
        storageKey: storageKey, // The storage key used
        bucket: bucket // The bucket used
      });
    } catch (err) {
      console.error("[ForumUpload] Fatal error:", err);
      return res.status(500).json({
        success: false,
        message: "Fatal error: " + (err.message || "Unknown error")
      });
    }
  });
  
  // Forum multiple media upload endpoint - for gallery uploads
  app.post("/api/forum/media/upload-multiple", forumUpload.array('files'), async (req: any, res) => {
    console.log("[ForumUpload] Starting multiple file upload process");
    
    // Check authentication first
    if (!req.isAuthenticated()) {
      console.log("[ForumUpload] Authentication failed");
      return res.status(401).json({ message: "Not authenticated" });
    }

    console.log(`[ForumUpload] User: ${req.user.username} (${req.user.id})`);

    // Check if user is blocked
    if (req.user.isBlocked && req.user.role !== 'admin') {
      console.log(`[ForumUpload] User is blocked: ${req.user.username}`);
      return res.status(403).json({ 
        message: "Your account has been blocked. You cannot upload media.",
        blockReason: req.user.blockReason || "Contact an administrator for more information."
      });
    }
    
    // Call the handler function
    return handleMultipleForumMediaUpload(req, res);
  });
  
  // Get all content media images - enhanced for production
  app.get("/api/content/media", async (req, res) => {
    try {
      const mediaType = 'content-media';
      
      // Both directories since files could be in either place
      const uploadsContentMediaDir = path.join(__dirname, '../uploads', mediaType);
      const prodContentMediaDir = path.join(__dirname, '..', mediaType);
      
      // Create the directories if they don't exist
      if (!fs.existsSync(uploadsContentMediaDir)) {
        fs.mkdirSync(uploadsContentMediaDir, { recursive: true });
      }
      
      if (!fs.existsSync(prodContentMediaDir)) {
        fs.mkdirSync(prodContentMediaDir, { recursive: true });
      }
      
      // Read all files from both directories
      let files = [];
      
      try {
        const uploadFiles = fs.readdirSync(uploadsContentMediaDir);
        files = [...uploadFiles];
      } catch (err) {
        console.error(`Error reading uploads/${mediaType} directory:`, err);
      }
      
      try {
        const prodFiles = fs.readdirSync(prodContentMediaDir);
        // Combine but remove duplicates
        files = [...new Set([...files, ...prodFiles])];
      } catch (err) {
        console.error(`Error reading ${mediaType} directory:`, err);
      }
      
      // Get the URLs for all content media images, using production path format
      const imageUrls = files
        .filter(file => {
          const ext = path.extname(file).toLowerCase();
          return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.svg'].includes(ext);
        })
        .map(file => getMediaUrl(mediaType, file, false)); // false = don't use /uploads/ prefix
      
      res.json({ images: imageUrls });
    } catch (err) {
      console.error("Error retrieving content media:", err);
      res.status(500).json({ 
        message: "Failed to retrieve content media",
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });
  
  // Emergency version history fix route (admin only)

  app.post("/api/admin/fix-version-history", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    try {
      console.log("Running emergency version history fix");
      
      // Import the fix function
      const { fixAllVersionHistoryIssues } = await import('./fix-version-history');
      const success = await fixAllVersionHistoryIssues();
      
      if (success) {
        res.json({ 
          success: true, 
          message: "Version history system has been fixed" 
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Failed to fix version history system"
        });
      }
    } catch (err) {
      console.error("Error in version history fix:", err);
      res.status(500).json({ 
        success: false,
        message: "Error in version history fix",
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // Register product routes
  app.use("/api/products", productsRouter);
  
  // Register real estate routes for for-sale badge functionality
  app.use("/api/real-estate", realEstateRouter);
  
  // Object Storage proxy for serving files from Replit Object Storage
  // This bypasses CORS issues with direct Object Storage URLs
  // Special middleware to handle the FORUM/forum format before it reaches the regular router
  app.use("/api/storage-proxy/FORUM/forum", async (req, res, next) => {
    console.log(`[StandardForumMiddleware] Intercepting: ${req.path}`);
    try {
      // Attempt to handle with our specialized handler
      const handled = await handleStandardForumFormat(req, res);
      if (!handled) {
        // If our handler didn't handle it, continue to the next middleware
        next();
      }
      // If it was handled, the response has already been sent
    } catch (error) {
      console.error(`[StandardForumMiddleware] Error in handler: ${error}`);
      next();
    }
  });
  
  // Mount the general storage proxy router for all other routes
  app.use("/api/storage-proxy", objectStorageProxyRouter);
  
  // Add a direct route for handling Object Storage URLs directly
  // This helps when direct Object Storage URLs are stored in the database
  app.get("/object-storage.replit.app/:bucket/*path", (req, res) => {
    const bucket = req.params.bucket;
    const pathParam = Array.isArray(req.params.path) ? req.params.path.join('/') : (req.params.path as string);
    console.log(`Redirecting direct Object Storage URL request: ${bucket}/${pathParam}`);
    res.redirect(`/api/storage-proxy/${bucket}/${pathParam}`);
  });
  
  // Specific handler for /CALENDAR/events/ paths
  // This handles direct database references to events media
  app.get("/CALENDAR/events/:filename", (req, res) => {
    const { filename } = req.params;
    console.log(`Intercepting direct CALENDAR/events URL: ${filename}`);
    res.redirect(`/api/storage-proxy/CALENDAR/events/${filename}`);
  });
  
  // Specific handler for /FORUM/forum/ paths
  // This handles direct database references to forum media
  app.get("/FORUM/forum/:filename", (req, res) => {
    const { filename } = req.params;
    console.log(`Intercepting direct FORUM/forum URL: ${filename}`);
    // Use direct-forum endpoint instead of redirecting to prevent infinite loops
    res.redirect(`/api/storage-proxy/direct-forum/${filename}`);
  });
  
  // Register print service routes
  app.use("/api/print-service", printServiceRouter);
  app.use("/api/printful", printfulRoutes);
  
  // Mount test pages router for real estate media upload testing
  app.use("/test", testPagesRouter);
  
  // Register order management routes
  app.use("/api/orders", ordersRouter);
  app.use("/api/returns", returnsRouter);
  console.log("⚡⚡⚡ ABOUT TO CALL createForumRouter() - LINE 10815 REACHED! ⚡⚡⚡");
  const forumRouter = createForumRouter(storage);
  console.log("⚡⚡⚡ createForumRouter() returned:", forumRouter ? "Router object exists" : "NULL/undefined");
  app.use("/api/forum", forumRouter);
  app.use("/api/vendors", createVendorRouter(storage));
  app.use("/api/vendor-categories", createVendorCategoryRouter(storage));
  app.use("/api/community-categories", createCommunityCategoryRouter(storage));
  app.use("/api/messages", messagesRouter);
  app.use("/api/dmca", dmcaUploaderRouter);
  
  // Forms API routes for custom form management
  const { default: formsRouter } = await import('./routes/forms');
  app.use("/api/forms", formsRouter);
  
  // Active users tracking for real-time user presence
  app.use("/api/active-users", activeUsersRouter);
  
  // Unified search endpoint for all content types
  app.use("/api/search", searchRouter);
  
  // Mount message diagnostics router for troubleshooting message visibility issues
  app.use("/api/message-diagnostics", messageDiagnosticsRouter);
  
  // Mount message debug router for analyzing unread message status issues
  app.use("/api/debug", messageDebugRouter);
  
  app.use("/api/test-media", testMediaRouter);
  app.use("/api/test", testRouter);
  app.use("/api/forum-media-test", forumMediaTestRouter);
  
  // Special endpoint for TinyMCE editor image uploads in forum
  app.post("/api/forum/tinymce-upload", requireAuth, forumUpload.single('file'), handleForumMediaUpload);
  
  // Multiple file upload endpoint for forum media gallery
  app.post("/api/forum/media/upload-multiple", requireAuth, forumUpload.array('files', 10), handleMultipleForumMediaUpload);

  // Specialized vendor upload endpoint for TinyMCE editor
  app.post("/api/vendor/tinymce-upload", requireAuth, vendorUpload.single('file'), handleVendorMediaUpload);
  
  // Specialized community upload endpoint for TinyMCE editor
  app.post("/api/community/tinymce-upload", requireAuth, communityUpload.single('file'), handleCommunityMediaUpload);
  
  // Direct upload endpoint for Object Storage
  app.post("/api/direct-upload", upload.single('file'), async (req, res) => {
    try {
      console.log('[DirectUpload] Processing direct upload request');
      
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          message: 'No file uploaded' 
        });
      }

      // Get the upload parameters from the form
      const token = req.body.token;
      const bucket = req.body.bucket || 'FORUM';
      const key = req.body.key || `forum/${req.file.originalname}`;
      
      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Missing token for authentication'
        });
      }
      
      console.log(`[DirectUpload] Uploading to bucket: ${bucket}, key: ${key}`);
      
      // Read the file buffer
      const fileBuffer = fs.readFileSync(req.file.path);
      
      // Decode the token to verify it's valid
      let tokenData;
      try {
        const tokenStr = Buffer.from(token, 'base64').toString('utf-8');
        tokenData = JSON.parse(tokenStr);
        
        // Verify token is valid and not expired
        if (!tokenData || !tokenData.bucket || !tokenData.expiresAt) {
          throw new Error('Invalid token format');
        }
        
        if (tokenData.expiresAt < Date.now()) {
          throw new Error('Token expired');
        }
        
        if (tokenData.bucket !== bucket) {
          console.warn(`[DirectUpload] Token bucket ${tokenData.bucket} doesn't match request bucket ${bucket}`);
        }
      } catch (tokenError) {
        console.error(`[DirectUpload] Token validation error:`, tokenError);
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired token',
          error: tokenError.message
        });
      }
      
      // Create a client for uploading
      const client = createObjectStorageClient();
      
      console.log(`[DirectUpload] Uploading directly to Object Storage: ${bucket}/${key}`);
      
      // Create a temporary file for uploading since we need to use uploadFromFilename
      const tempFilePath = path.join(os.tmpdir(), `upload-${Date.now()}-${path.basename(key)}`);
      fs.writeFileSync(tempFilePath, fileBuffer);
      
      let uploadSuccess = false;
      
      try {
        // Upload using the Object Storage client with uploadFromFilename
        const uploadResult = await client.uploadFromFilename(key, tempFilePath, {
          bucketName: bucket,
          contentType: req.file.mimetype,
          headers: {
            'X-Obj-Bucket': bucket,
            'Content-Type': req.file.mimetype
          }
        });
        
        // Clean up temporary file
        fs.unlinkSync(tempFilePath);
        
        // Check if upload was successful
        if (!uploadResult.ok) {
          console.error(`[DirectUpload] Upload failed:`, uploadResult.error);
          throw new Error(`Upload failed: ${uploadResult.error.message || 'Unknown error'}`);
        }
        
        uploadSuccess = true;
        console.log(`[DirectUpload] Upload successful for ${bucket}/${key}`);
      } catch (uploadError) {
        // Clean up temporary file in case of error
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        
        // Return an error response
        return res.status(500).json({
          success: false,
          message: `Upload failed: ${uploadError.message}`,
          error: uploadError.message
        });
      }
      
      // If we got here, the upload was successful
      
      // Clean up temporary file
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanError) {
        console.warn(`[DirectUpload] Failed to clean up temporary file: ${cleanError.message}`);
      }
      
      // Generate URL formats for the uploaded file
      const filename = path.basename(key);
      const directUrl = `https://object-storage.replit.app/${bucket}/${key}`;
      const proxyUrl = `/api/storage-proxy/${bucket}/${key}`;
      const directForumUrl = `/api/storage-proxy/direct-forum/${filename}`;
      
      // Return success with the URLs
      return res.json({
        success: true,
        file: {
          originalName: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype
        },
        urls: {
          direct: directUrl,
          proxy: proxyUrl,
          directForum: directForumUrl,
          key: key,
          bucket: bucket
        }
      });
      
    } catch (error) {
      console.error(`[DirectUpload] Error processing upload: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Error processing upload',
        error: error.message
      });
    }
  });
  
  // Register user membership subscription routes
  app.use("/api/subscriptions", userSubscriptionsRouter);
  
  // Register setup-memberships utility endpoint
  app.use("/api/setup-memberships", setupMembershipsRouter);
  
  // Membership processing admin tools
  app.use("/api/admin/membership-processing", membershipProcessingRouter);
  
  // Admin credits management
  const adminCreditsModule = await import('./routes/admin-credits');
  const adminCreditsRouter = adminCreditsModule.default;
  app.use("/api/admin/credits", adminCreditsRouter);

  // SendGrid email activity tracking routes (admin only)
  const sendgridActivityModule = await import('./sendgrid-activity-service');
  
  app.get("/api/admin/email-activity/stats", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { startDate, endDate, aggregatedBy } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ 
          message: "startDate and endDate query parameters are required" 
        });
      }

      const result = await sendgridActivityModule.getEmailStats(
        startDate as string,
        endDate as string,
        (aggregatedBy as 'day' | 'week' | 'month') || 'day'
      );

      res.json(result);
    } catch (error: any) {
      console.error('[Email Activity Stats] Error:', error);
      res.status(500).json({ 
        message: "Failed to fetch email statistics",
        error: error.message 
      });
    }
  });

  app.get("/api/admin/email-activity/messages", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { limit, email, status, startDate, endDate } = req.query;

      const result = await sendgridActivityModule.getEmailActivity({
        limit: limit ? parseInt(limit as string) : 100,
        email: email as string,
        status: status as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });

      res.json(result);
    } catch (error: any) {
      console.error('[Email Activity Messages] Error:', error);
      res.status(500).json({ 
        message: "Failed to fetch email activity",
        error: error.message 
      });
    }
  });

  app.get("/api/admin/email-activity/enhanced", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { startDate, endDate, email, status, limit } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ 
          message: "startDate and endDate query parameters are required" 
        });
      }

      const result = await sendgridActivityModule.getEnhancedEmailActivity(
        startDate as string,
        endDate as string,
        email as string,
        status as string,
        limit ? parseInt(limit as string) : 100
      );

      // Enrich messages with user data from the database
      if (result.messages && result.messages.length > 0) {
        // Extract unique email addresses, filtering out any undefined/null values
        const emailAddresses = [...new Set(
          result.messages
            .map(m => m.to_email)
            .filter(email => email != null && email.trim() !== '')
        )];
        
        // Only query if we have valid email addresses
        if (emailAddresses.length > 0) {
          // Query database for user info using inArray for proper parameterization
          const usersData = await db.select({
            email: users.email,
            username: users.username,
            fullName: users.fullName,
          })
          .from(users)
          .where(inArray(users.email, emailAddresses))
          .execute();
          
          // Create a map for quick lookup
          const userMap = new Map(usersData.map(u => [u.email, u]));
          
          // Enrich messages with user data
          const enrichedMessages = result.messages.map(msg => {
            const userData = userMap.get(msg.to_email);
            return {
              ...msg,
              username: userData?.username || null,
              fullName: userData?.fullName || null,
            };
          });
          
          result.messages = enrichedMessages;
        } else {
          // No valid emails, just add null values
          result.messages = result.messages.map(msg => ({
            ...msg,
            username: null,
            fullName: null,
          }));
        }
      }

      res.json(result);
    } catch (error: any) {
      console.error('[Enhanced Email Activity] Error:', error);
      res.status(500).json({ 
        message: "Failed to fetch enhanced email activity",
        error: error.message 
      });
    }
  });

  // Site-settings key holding the admin-editable SendGrid billing config (JSON).
  // Overrides the SENDGRID_* env-var defaults when present.
  const SENDGRID_BILLING_CONFIG_KEY = 'sendgrid_billing_config';

  async function loadSavedBillingConfig() {
    try {
      const setting = await storage.getSiteSettingByKey(SENDGRID_BILLING_CONFIG_KEY);
      if (!setting?.value) {
        return undefined;
      }
      const parsed = JSON.parse(setting.value);
      return parsed && typeof parsed === 'object' ? parsed : undefined;
    } catch (error) {
      console.error('[SendGrid Billing] Failed to load saved config:', error);
      return undefined;
    }
  }

  // SendGrid billing/usage statistics
  app.get("/api/admin/email-activity/billing", requireAuth, requireAdmin, async (req, res) => {
    try {
      const savedConfig = await loadSavedBillingConfig();
      const billingStats = await sendgridActivityModule.getBillingStats(savedConfig);
      res.json(billingStats);
    } catch (error: any) {
      console.error('[SendGrid Billing] Error:', error);
      res.status(500).json({ 
        message: "Failed to fetch billing statistics",
        error: error.message 
      });
    }
  });

  // Save admin-editable SendGrid billing config (plan name, price, currency,
  // monthly limit, add-ons). Persisted in site_settings; overrides env defaults.
  app.put("/api/admin/email-activity/billing/config", requireAuth, requireAdmin, async (req, res) => {
    try {
      const body = req.body ?? {};

      const config: {
        planName?: string;
        planPrice?: number;
        currency?: string;
        monthlyLimit?: number;
        addOns?: Array<{ name: string; price: number }>;
      } = {};

      if (typeof body.planName === 'string' && body.planName.trim()) {
        config.planName = body.planName.trim();
      }

      if (body.planPrice !== undefined && body.planPrice !== null && body.planPrice !== '') {
        const price = Number(body.planPrice);
        if (!Number.isFinite(price) || price < 0) {
          return res.status(400).json({ message: "Plan price must be a number >= 0" });
        }
        config.planPrice = Math.round(price * 100) / 100;
      }

      if (typeof body.currency === 'string' && body.currency.trim()) {
        config.currency = body.currency.trim().toUpperCase();
      }

      if (body.monthlyLimit !== undefined && body.monthlyLimit !== null && body.monthlyLimit !== '') {
        const limit = Number(body.monthlyLimit);
        if (!Number.isFinite(limit) || limit <= 0 || !Number.isInteger(limit)) {
          return res.status(400).json({ message: "Monthly limit must be a positive whole number" });
        }
        config.monthlyLimit = limit;
      }

      if (body.addOns !== undefined) {
        if (!Array.isArray(body.addOns)) {
          return res.status(400).json({ message: "Add-ons must be a list" });
        }
        const addOns: Array<{ name: string; price: number }> = [];
        for (const addOn of body.addOns) {
          const name = typeof addOn?.name === 'string' ? addOn.name.trim() : '';
          if (!name) {
            return res.status(400).json({ message: "Each add-on needs a name" });
          }
          const price = Number(addOn?.price);
          if (!Number.isFinite(price) || price < 0) {
            return res.status(400).json({ message: `Add-on "${name}" price must be a number >= 0` });
          }
          addOns.push({ name, price: Math.round(price * 100) / 100 });
        }
        config.addOns = addOns;
      }

      const userId = req.user?.id;
      await storage.setSiteSetting(
        SENDGRID_BILLING_CONFIG_KEY,
        JSON.stringify(config),
        'Admin-editable SendGrid plan & add-ons (overrides SENDGRID_* env defaults)',
        userId,
      );

      // Return the recomputed billing stats so the UI can refresh immediately.
      const billingStats = await sendgridActivityModule.getBillingStats(config);
      return res.json(billingStats);
    } catch (error: any) {
      console.error('[SendGrid Billing] Error saving config:', error);
      return res.status(500).json({
        message: "Failed to save billing configuration",
        error: error.message,
      });
    }
  });

  // Reset the SendGrid billing config back to the SENDGRID_* env-var defaults
  // by removing the saved override from site_settings.
  app.delete("/api/admin/email-activity/billing/config", requireAuth, requireAdmin, async (req, res) => {
    try {
      const setting = await storage.getSiteSettingByKey(SENDGRID_BILLING_CONFIG_KEY);
      if (setting) {
        await storage.deleteSiteSetting(setting.id);
      }

      // Return the env-default billing stats so the UI can refresh immediately.
      const billingStats = await sendgridActivityModule.getBillingStats();
      return res.json(billingStats);
    } catch (error: any) {
      console.error('[SendGrid Billing] Error resetting config:', error);
      return res.status(500).json({
        message: "Failed to reset billing configuration",
        error: error.message,
      });
    }
  });
  
  // ---------------------------------------------------------------------------
  // For Sale automated-email config (admin-editable templates + timing + test).
  // Mirrors the SendGrid billing-config pattern: JSON persisted in site_settings
  // under FORSALE_EMAIL_CONFIG_KEY, admin-only GET/PUT/DELETE + POST test.
  // ---------------------------------------------------------------------------

  // Return the merged config (saved over defaults) plus the placeholder reference
  // so the editor can show admins which {{tokens}} each email supports.
  app.get("/api/admin/email-activity/forsale-emails", requireAuth, requireAdmin, async (req, res) => {
    try {
      const config = await loadForSaleEmailConfig();
      return res.json({ config, placeholders: FORSALE_EMAIL_PLACEHOLDERS });
    } catch (error: any) {
      req.log.error({ err: error }, "[ForSaleEmails] Failed to load config");
      return res.status(500).json({ message: "Failed to load For Sale email configuration" });
    }
  });

  // Save the admin-edited config. Validates each template (non-empty subject &
  // body, boolean enabled) and timing (positive whole-number days), then merges
  // over defaults so partial payloads keep the built-in values.
  app.put("/api/admin/email-activity/forsale-emails", requireAuth, requireAdmin, async (req, res) => {
    try {
      const body = req.body ?? {};
      const types: ForSaleEmailType[] = ['adminExpired', 'sellerExpired', 'noActiveListings'];

      for (const type of types) {
        const tpl = body[type];
        if (tpl === undefined) continue;
        if (typeof tpl !== 'object' || tpl === null) {
          return res.status(400).json({ message: `"${type}" must be an object` });
        }
        if (tpl.enabled !== undefined && typeof tpl.enabled !== 'boolean') {
          return res.status(400).json({ message: `"${type}.enabled" must be true or false` });
        }
        if (tpl.subject !== undefined && (typeof tpl.subject !== 'string' || !tpl.subject.trim())) {
          return res.status(400).json({ message: `"${type}" subject cannot be empty` });
        }
        if (tpl.html !== undefined && (typeof tpl.html !== 'string' || !tpl.html.trim())) {
          return res.status(400).json({ message: `"${type}" body cannot be empty` });
        }
      }

      if (body.timing !== undefined) {
        if (typeof body.timing !== 'object' || body.timing === null) {
          return res.status(400).json({ message: '"timing" must be an object' });
        }
        for (const key of ['emptyThresholdDays', 'resendIntervalDays'] as const) {
          const value = body.timing[key];
          if (value === undefined) continue;
          const num = Number(value);
          if (!Number.isFinite(num) || num <= 0 || !Number.isInteger(num)) {
            return res.status(400).json({ message: `"timing.${key}" must be a positive whole number of days` });
          }
        }
      }

      // Merge over defaults and persist the normalized result so site_settings
      // always holds a complete, valid config.
      const merged = mergeForSaleEmailConfig(body);
      await storage.setSiteSetting(
        FORSALE_EMAIL_CONFIG_KEY,
        JSON.stringify(merged),
        'Admin-editable For Sale automated email templates, enable flags, and reminder timing',
        req.user?.id,
      );

      return res.json({ config: merged, placeholders: FORSALE_EMAIL_PLACEHOLDERS });
    } catch (error: any) {
      req.log.error({ err: error }, "[ForSaleEmails] Failed to save config");
      return res.status(500).json({ message: "Failed to save For Sale email configuration" });
    }
  });

  // Reset to built-in defaults by removing the saved override.
  app.delete("/api/admin/email-activity/forsale-emails", requireAuth, requireAdmin, async (req, res) => {
    try {
      const setting = await storage.getSiteSettingByKey(FORSALE_EMAIL_CONFIG_KEY);
      if (setting) {
        await storage.deleteSiteSetting(setting.id);
      }
      return res.json({ config: getDefaultForSaleEmailConfig(), placeholders: FORSALE_EMAIL_PLACEHOLDERS });
    } catch (error: any) {
      req.log.error({ err: error }, "[ForSaleEmails] Failed to reset config");
      return res.status(500).json({ message: "Failed to reset For Sale email configuration" });
    }
  });

  // Send sample copies of one or more email types to the LOGGED-IN ADMIN'S OWN
  // account email only — never an arbitrary address. Uses the current (possibly
  // unsaved-on-server but saved) config and ignores the enabled flag so an admin
  // can preview a disabled template before turning it on.
  app.post("/api/admin/email-activity/forsale-emails/test", requireAuth, requireAdmin, async (req, res) => {
    try {
      const adminEmail = req.user?.email?.trim();
      if (!adminEmail || !adminEmail.includes('@')) {
        return res.status(400).json({ message: "Your account doesn't have a valid email address to send the test to." });
      }

      const allTypes: ForSaleEmailType[] = ['adminExpired', 'sellerExpired', 'noActiveListings'];
      const requested: ForSaleEmailType[] = Array.isArray(req.body?.types) && req.body.types.length > 0
        ? allTypes.filter((t) => req.body.types.includes(t))
        : allTypes;

      if (requested.length === 0) {
        return res.status(400).json({ message: "No valid email types requested" });
      }

      const config: ForSaleEmailConfig = await loadForSaleEmailConfig();

      // Sample data — the seller fields are filled with the admin's own info so
      // the test is realistic but never reaches anyone else.
      const sampleListing = {
        id: 0,
        title: 'Sample Kayak for Sale',
        address: '123 Barefoot Blvd, Barefoot Bay, FL',
        listingType: 'For Sale',
      };
      const sampleSellerName = req.user?.fullName || req.user?.username || 'Sample Seller';

      const results: Record<string, boolean> = {};
      for (const type of requested) {
        try {
          if (type === 'adminExpired') {
            results[type] = await sendListingExpiredAdminEmail(
              adminEmail,
              sampleListing,
              { name: sampleSellerName, email: adminEmail, phone: '(555) 123-4567' },
              { config, ignoreEnabled: true },
            );
          } else if (type === 'sellerExpired') {
            results[type] = await sendListingExpiredSellerEmail(
              adminEmail,
              sampleSellerName,
              { id: sampleListing.id, title: sampleListing.title, listingType: sampleListing.listingType },
              { config, ignoreEnabled: true },
            );
          } else {
            results[type] = await sendNoActiveListingsAdminEmail(
              adminEmail,
              config.timing.emptyThresholdDays,
              { config, ignoreEnabled: true },
            );
          }
        } catch (err) {
          req.log.error({ err, type }, "[ForSaleEmails] Test send threw");
          results[type] = false;
        }
      }

      const sent = Object.values(results).filter(Boolean).length;
      const allOk = sent === requested.length;
      return res.status(allOk ? 200 : 502).json({
        sentTo: adminEmail,
        results,
        message: allOk
          ? `Sent ${sent} test email${sent === 1 ? '' : 's'} to ${adminEmail}`
          : `Sent ${sent} of ${requested.length} test emails. Some failed — check the email logs.`,
      });
    } catch (error: any) {
      req.log.error({ err: error }, "[ForSaleEmails] Failed to send test emails");
      return res.status(500).json({ message: "Failed to send test emails" });
    }
  });

  // --------------------------------------------------------------------------
  // Weekly "Currently, On The Market" promotional email — admin controls
  // --------------------------------------------------------------------------

  // Load config + send history + a preview of the current campaign week.
  app.get("/api/admin/email-activity/weekly-listings", requireAuth, requireAdmin, async (req, res) => {
    try {
      const config = await loadWeeklyListingsEmailConfig();
      const [history, activity, nextSendBlocker] = await Promise.all([
        getWeeklySendHistory(),
        getWeeklyEmailActivity(),
        getNextSendBlocker(config),
      ]);
      return res.json({
        config,
        history,
        activity,
        nextScheduledSend: getNextScheduledSend(config),
        // Set when the next configured automatic send would be skipped because
        // an overlapping campaign already went out under the current schedule.
        nextSendBlocker,
        placeholders: WEEKLY_EMAIL_PLACEHOLDERS,
        defaultTemplate: getDefaultWeeklyEmailTemplate(),
      });
    } catch (error: any) {
      req.log.error({ err: error }, "[WeeklyListingsEmail] Failed to load config");
      return res.status(500).json({ message: "Failed to load weekly email configuration" });
    }
  });

  // Save config (enabled, sendDay 0-6, sendTime HH:mm, sendWhenEmpty).
  app.put("/api/admin/email-activity/weekly-listings", requireAuth, requireAdmin, async (req, res) => {
    try {
      const body = req.body ?? {};
      if (body.enabled !== undefined && typeof body.enabled !== "boolean") {
        return res.status(400).json({ message: '"enabled" must be true or false' });
      }
      if (body.sendWhenEmpty !== undefined && typeof body.sendWhenEmpty !== "boolean") {
        return res.status(400).json({ message: '"sendWhenEmpty" must be true or false' });
      }
      if (body.sendDay !== undefined) {
        const day = Number(body.sendDay);
        if (!Number.isInteger(day) || day < 0 || day > 6) {
          return res.status(400).json({ message: '"sendDay" must be a day of the week (0-6)' });
        }
      }
      if (body.sendTime !== undefined && !(typeof body.sendTime === "string" && /^\d{2}:\d{2}$/.test(body.sendTime))) {
        return res.status(400).json({ message: '"sendTime" must be in HH:MM format' });
      }
      if (body.template !== undefined) {
        if (typeof body.template !== "object" || body.template === null) {
          return res.status(400).json({ message: '"template" must be an object' });
        }
        if (body.template.subject !== undefined && (typeof body.template.subject !== "string" || !body.template.subject.trim())) {
          return res.status(400).json({ message: "The email subject cannot be empty" });
        }
        if (body.template.html !== undefined && (typeof body.template.html !== "string" || !body.template.html.trim())) {
          return res.status(400).json({ message: "The email HTML body cannot be empty" });
        }
      }

      const saved = await loadWeeklyListingsEmailConfig();
      const merged = mergeWeeklyListingsEmailConfig({
        ...saved,
        ...body,
        ...(body.template !== undefined
          ? { template: { ...saved.template, ...body.template } }
          : {}),
      });
      await storage.setSiteSetting(
        WEEKLY_LISTINGS_CONFIG_KEY,
        JSON.stringify(merged),
        'Weekly "Currently, On The Market" promotional email schedule and options',
        req.user?.id,
      );

      // Record schedule/automation changes in the admin activity log. A
      // schedule change also re-arms the current cycle: the next configured
      // send fires even if a campaign already went out this week.
      const scheduleChanged =
        saved.enabled !== merged.enabled ||
        saved.sendDay !== merged.sendDay ||
        saved.sendTime !== merged.sendTime;
      if (scheduleChanged) {
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const describe = (c: typeof merged) =>
          c.enabled ? `${dayNames[c.sendDay]} at ${c.sendTime} ET` : "off";
        await logWeeklyEmailActivity({
          event: "schedule_changed",
          detail: `Schedule changed from ${describe(saved)} to ${describe(merged)}. The next configured send will go out even if a campaign already went out this week under the old schedule.`,
          actor: req.user?.username || req.user?.email || null,
        });
      }

      return res.json({
        config: merged,
        nextScheduledSend: getNextScheduledSend(merged),
        nextSendBlocker: await getNextSendBlocker(merged),
        placeholders: WEEKLY_EMAIL_PLACEHOLDERS,
        defaultTemplate: getDefaultWeeklyEmailTemplate(),
      });
    } catch (error: any) {
      req.log.error({ err: error }, "[WeeklyListingsEmail] Failed to save config");
      return res.status(500).json({ message: "Failed to save weekly email configuration" });
    }
  });

  // Preview: the current campaign week's range, the listings that qualify,
  // recipient count, and the rendered HTML.
  // GET renders the saved template. POST may include a draft template
  // ({ template: { subject?, html? } }) to render unsaved edits without
  // touching the saved config.
  const buildWeeklyListingsPreview = async (draftTemplate?: { subject?: unknown; html?: unknown }) => {
    const now = new Date();
    const config = await loadWeeklyListingsEmailConfig();
    let template = config.template;
    let source: "saved" | "draft" = "saved";
    if (draftTemplate) {
      template = {
        subject:
          typeof draftTemplate.subject === "string" && draftTemplate.subject.trim()
            ? draftTemplate.subject
            : config.template.subject,
        html:
          typeof draftTemplate.html === "string" && draftTemplate.html.trim()
            ? draftTemplate.html
            : config.template.html,
      };
      source = "draft";
    }
    const range = getCampaignWeekRange(now);
    const listings = selectListingsForWeek(publicOnly(await storage.getListings()), range, now);
    const recipients = resolveWeeklyEmailRecipients(await storage.getUsers());
    const rendered = renderWeeklyListingsEmail(listings, range, getWeeklyEmailBaseUrl(), template, {
      featuredEnabled: await isFeaturedListingsEnabled(),
    });
    return {
      source,
      range,
      listings,
      recipientCount: recipients.length,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    };
  };

  app.get("/api/admin/email-activity/weekly-listings/preview", requireAuth, requireAdmin, async (req, res) => {
    try {
      return res.json(await buildWeeklyListingsPreview());
    } catch (error: any) {
      req.log.error({ err: error }, "[WeeklyListingsEmail] Failed to build preview");
      return res.status(500).json({ message: "Failed to build weekly email preview" });
    }
  });

  app.post("/api/admin/email-activity/weekly-listings/preview", requireAuth, requireAdmin, async (req, res) => {
    try {
      const rawTemplate = req.body?.template;
      if (rawTemplate !== undefined && (typeof rawTemplate !== "object" || rawTemplate === null || Array.isArray(rawTemplate))) {
        return res.status(400).json({ message: '"template" must be an object with "subject" and/or "html" strings' });
      }
      return res.json(await buildWeeklyListingsPreview(rawTemplate ?? undefined));
    } catch (error: any) {
      req.log.error({ err: error }, "[WeeklyListingsEmail] Failed to build draft preview");
      return res.status(500).json({ message: "Failed to build weekly email preview" });
    }
  });

  // Send a test copy of the current campaign week's email to a specified
  // address (defaults to the logged-in admin's own address). Never touches
  // the campaign record or the real subscriber list.
  app.post("/api/admin/email-activity/weekly-listings/test", requireAuth, requireAdmin, async (req, res) => {
    try {
      const rawAddress = typeof req.body?.email === "string" ? req.body.email.trim() : "";
      const adminEmail = rawAddress || req.user?.email?.trim() || "";
      if (rawAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawAddress)) {
        return res.status(400).json({ message: `"${rawAddress}" is not a valid email address.` });
      }
      if (!adminEmail || !adminEmail.includes("@")) {
        return res.status(400).json({ message: "Enter a test email address — your account doesn't have a valid one." });
      }
      const now = new Date();
      const config = await loadWeeklyListingsEmailConfig();
      const range = getCampaignWeekRange(now);
      const listings = selectListingsForWeek(publicOnly(await storage.getListings()), range, now);
      const rendered = renderWeeklyListingsEmail(listings, range, getWeeklyEmailBaseUrl(), config.template, {
        featuredEnabled: await isFeaturedListingsEnabled(),
      });
      const ok = await sendEmail({
        to: adminEmail,
        subject: `[TEST] ${rendered.subject}`,
        html: rendered.html,
        text: rendered.text,
      });
      if (!ok) {
        return res.status(502).json({ message: "Test email failed to send — check the email logs." });
      }
      await logWeeklyEmailActivity({
        event: "test_sent",
        weekStart: range.weekStart,
        weekEnd: range.weekEnd,
        detail: `Test email sent to ${adminEmail} (${listings.length} listing(s)). Test sends never count as the real campaign.`,
        actor: req.user?.username || req.user?.email || null,
      });
      return res.json({ message: `Test email sent to ${adminEmail}`, sentTo: adminEmail, listingCount: listings.length });
    } catch (error: any) {
      req.log.error({ err: error }, "[WeeklyListingsEmail] Failed to send test email");
      return res.status(500).json({ message: "Failed to send test email" });
    }
  });

  // Manually trigger the current campaign send (rolling last-7-days window).
  // Idempotent per weekly cycle — if an overlapping campaign already went
  // out, this reports that instead of re-sending.
  app.post("/api/admin/email-activity/weekly-listings/send", requireAuth, requireAdmin, async (req, res) => {
    try {
      const now = new Date();
      const config = await loadWeeklyListingsEmailConfig();
      const range = getCampaignWeekRange(now);
      // Manual trigger may send an empty week only when the admin explicitly
      // opted in via config OR passes force=true for a one-off.
      const effectiveConfig = req.body?.forceWhenEmpty === true
        ? { ...config, sendWhenEmpty: true }
        : config;
      const triggeredByUser = req.user?.username || req.user?.email || `user #${req.user?.id}`;
      const result = await executeWeeklySend(range, effectiveConfig, "manual", undefined, now, triggeredByUser);
      if (result.status === "already_sent") {
        return res.status(409).json({
          message: `A campaign covering ${range.label} already went out — only one campaign can send per weekly cycle.`,
          result,
        });
      }
      if (result.status === "claim_lost") {
        return res.status(409).json({ message: "Another campaign send is already in progress.", result });
      }
      if (result.status === "failed") {
        return res.status(502).json({ message: result.error || "Send failed", result });
      }
      const message = result.status === "skipped_no_listings"
        ? `No active listings for ${range.label} — campaign skipped.`
        : result.status === "partially_failed"
          ? `Campaign sent to ${result.sentCount} of ${result.recipientCount} recipient(s) — ${result.recipientCount - result.sentCount} failed. Covering ${result.listingCount} listing(s).`
          : `Campaign sent to ${result.sentCount} of ${result.recipientCount} recipient(s), covering ${result.listingCount} listing(s).`;
      return res.json({ message, result });
    } catch (error: any) {
      req.log.error({ err: error }, "[WeeklyListingsEmail] Manual send failed");
      return res.status(500).json({ message: "Failed to trigger the weekly send" });
    }
  });

  // Calendar media diagnostics are imported at the top of the file

  // Calendar media diagnostic and management endpoints
  // Using direct route handlers instead of calendarMediaDiagnostics handlers
  app.get("/api/admin/calendar-media-status", requireAuth, requireAdmin, async (req, res) => {
    // Forward to the media check endpoint with admin privilege
    try {
      const events = await storage.getAllEvents();
      const stats = {
        totalEvents: events.length,
        eventsWithMedia: 0,
        eventsWithoutMedia: 0,
        eventsWithProxyFormat: 0,
        eventsWithDirectUrls: 0,
        eventsWithLocalUrls: 0
      };
      
      for (const event of events) {
        if (!event.mediaUrls || event.mediaUrls.length === 0) {
          stats.eventsWithoutMedia++;
          continue;
        }
        
        stats.eventsWithMedia++;
        
        // Flag if any event has incorrect URL format
        let hasProxyFormat = false;
        let hasDirectUrls = false;
        let hasLocalUrls = false;
        
        for (const url of event.mediaUrls) {
          if (!url) continue;
          
          if (url.startsWith('/api/storage-proxy/')) {
            hasProxyFormat = true;
          } else if (url.includes('object-storage.replit.app')) {
            hasDirectUrls = true;
          } else if (url.startsWith('/uploads/')) {
            hasLocalUrls = true;
          }
        }
        
        if (hasProxyFormat) stats.eventsWithProxyFormat++;
        if (hasDirectUrls) stats.eventsWithDirectUrls++;
        if (hasLocalUrls) stats.eventsWithLocalUrls++;
      }
      
      return res.status(200).json({
        message: 'Event media status report',
        stats
      });
    } catch (error) {
      console.error('Error generating calendar media status:', error);
      return res.status(500).json({
        message: 'Error generating calendar media status',
        error: error.message
      });
    }
  });
  
  // Endpoint to check for events with direct Object Storage URLs
  app.get("/api/admin/calendar-media/direct-storage-urls", requireAuth, requireAdmin, async (req, res) => {
    try {
      // Query the database for events with direct Object Storage URLs
      const eventsWithDirectUrls = await db.select({
        id: events.id,
        title: events.title,
        mediaUrls: events.mediaUrls
      })
      .from(events)
      .where(sql`media_urls IS NOT NULL AND media_urls::text LIKE '%object-storage.replit.app%'`);
      
      console.log(`Found ${eventsWithDirectUrls.length} events with direct Object Storage URLs`);
      
      res.json({
        success: true,
        count: eventsWithDirectUrls.length,
        events: eventsWithDirectUrls
      });
    } catch (error) {
      console.error("Error checking for direct Object Storage URLs:", error);
      res.status(500).json({
        success: false,
        message: "Error checking for direct Object Storage URLs",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Endpoint to normalize event media URLs for proxy access
  app.post("/api/admin/normalize-event-media-urls", requireAuth, requireAdmin, async (req, res) => {
    try {
      console.log("[Admin] Starting comprehensive event media URL normalization, requested by:", req.user.username);
      
      // Import the normalization functions dynamically to avoid circular dependencies
      const { runAllNormalizations } = await import('./normalize-event-media-urls');
      
      // Run all normalization routines for maximum coverage
      const results = await runAllNormalizations();
      
      console.log("[Admin] Event media URL normalization completed successfully");
      console.log(`[Admin] Results: ${results.directUrlsUpdated} direct URLs, ${results.legacyUrlsUpdated} legacy URLs, and ${results.allUrlsUpdated} other URLs updated`);
      
      res.json({ 
        success: true, 
        message: "Event media URLs normalized successfully",
        results: {
          directUrlsUpdated: results.directUrlsUpdated,
          legacyUrlsUpdated: results.legacyUrlsUpdated,
          allUrlsUpdated: results.allUrlsUpdated,
          unchanged: results.unchanged,
          total: results.total
        }
      });
    } catch (error) {
      console.error("[Admin] Error normalizing event media URLs:", error);
      res.status(500).json({ 
        success: false, 
        message: "Error normalizing event media URLs",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Calendar media migration endpoints
  app.post("/api/admin/migrate-calendar-media", requireAuth, requireAdmin, async (req, res) => {
    try {
      console.log("[CalendarMediaMigration] Migration requested by admin", {
        userId: req.user.id,
        username: req.user.username
      });
      
      // Start the migration process
      await calendarMediaMigration.migrateCalendarMedia();
      
      res.json({
        success: true,
        message: "Calendar media migration completed successfully"
      });
    } catch (error) {
      console.error("[CalendarMediaMigration] Migration failed:", error);
      res.status(500).json({
        success: false,
        message: "Calendar media migration failed",
        error: error.message
      });
    }
  });
  
  // Endpoints to check the status of media URLs
  app.get("/api/admin/calendar-media/filesystem-urls", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const events = await calendarMediaMigration.findEventsWithFilesystemMedia();
      res.json({
        success: true,
        count: events.length,
        events: events.map(event => ({
          id: event.id,
          title: event.title,
          mediaUrls: event.mediaUrls
        }))
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to find events with filesystem media",
        error: error.message
      });
    }
  });
  
  app.get("/api/admin/calendar-media/migration-direct-urls", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const events = await calendarMediaMigration.findEventsWithDirectObjectStorageUrls();
      res.json({
        success: true,
        count: events.length,
        events: events.map(event => ({
          id: event.id,
          title: event.title,
          mediaUrls: event.mediaUrls
        }))
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to find events with direct Object Storage URLs",
        error: error.message
      });
    }
  });
  
  // Rocket Launch API endpoint
  app.get("/api/rocket-launches", async (_req, res) => {
    try {
      const launches = await getUpcomingRocketLaunches();
      res.json(launches);
    } catch (error) {
      console.error("Error fetching rocket launches:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to fetch rocket launch data",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Simple in-memory cache for weather data
  const weatherCache = {
    current: {
      data: null,
      timestamp: 0
    },
    forecast: {
      data: null,
      timestamp: 0
    }
  };
  
  // Cache duration in milliseconds (30 minutes)
  const CACHE_DURATION = 30 * 60 * 1000;
  
  // API route to proxy weather data requests (to avoid CORS issues)
  app.get("/api/weather", async (req, res) => {
    try {
      // Get lat and lon from query parameters or use Barefoot Bay defaults
      const lat = req.query.lat || 27.9589;
      const lon = req.query.lon || -80.5603;
      // Get units from query parameter or use imperial as default
      const units = req.query.units || 'imperial';
      
      // Use the API key from environment variables
      const apiKey = process.env.VITE_OPENWEATHER_API_KEY;
      
      if (!apiKey) {
        console.error('OpenWeather API key is missing');
        return res.status(500).json({ error: 'Weather API key is not configured' });
      }
      
      // Check if we have cached data that's still valid
      const now = Date.now();
      if (weatherCache.current.data && (now - weatherCache.current.timestamp) < CACHE_DURATION) {
        console.log('Returning cached weather data');
        return res.json(weatherCache.current.data);
      }
      
      console.log(`Fetching weather data for coordinates: ${lat}, ${lon}`);
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${units}&appid=${apiKey}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Weather API error response:', errorText);
        
        // If we have cached data, return it even if it's expired
        if (weatherCache.current.data) {
          console.log('Returning expired cached data due to API error');
          return res.json(weatherCache.current.data);
        }
        
        return res.status(response.status).json({ 
          error: `Weather API error: ${response.status} ${response.statusText}`,
          details: errorText
        });
      }
      
      const weatherData = await response.json();
      
      // Update cache
      weatherCache.current = {
        data: weatherData,
        timestamp: now
      };
      
      res.json(weatherData);
    } catch (error) {
      console.error('Error proxying weather data:', error);
      
      // Return cached data if available, even if expired
      if (weatherCache.current.data) {
        console.log('Returning cached data due to error');
        return res.json(weatherCache.current.data);
      }
      
      res.status(500).json({ error: 'Failed to fetch weather data' });
    }
  });
  
  // API route to proxy weather forecast data requests (to avoid CORS issues)
  app.get("/api/weather/forecast", async (req, res) => {
    try {
      // Get lat and lon from query parameters or use Barefoot Bay defaults
      const lat = req.query.lat || 27.9589;
      const lon = req.query.lon || -80.5603;
      // Get units from query parameter or use imperial as default
      const units = req.query.units || 'imperial';
      
      // Use the API key from environment variables
      const apiKey = process.env.VITE_OPENWEATHER_API_KEY;
      
      if (!apiKey) {
        console.error('OpenWeather API key is missing');
        return res.status(500).json({ error: 'Weather API key is not configured' });
      }
      
      // Check if we have cached forecast data that's still valid
      const now = Date.now();
      if (weatherCache.forecast.data && (now - weatherCache.forecast.timestamp) < CACHE_DURATION) {
        console.log('Returning cached forecast data');
        return res.json(weatherCache.forecast.data);
      }
      
      console.log(`Fetching weather forecast for coordinates: ${lat}, ${lon}`);
      const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${units}&appid=${apiKey}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Weather forecast API error response:', errorText);
        
        // If we have cached data, return it even if it's expired
        if (weatherCache.forecast.data) {
          console.log('Returning expired cached forecast data due to API error');
          return res.json(weatherCache.forecast.data);
        }
        
        return res.status(response.status).json({ 
          error: `Weather forecast API error: ${response.status} ${response.statusText}`,
          details: errorText
        });
      }
      
      const forecastData = await response.json();
      
      // Update cache
      weatherCache.forecast = {
        data: forecastData,
        timestamp: now
      };
      
      res.json(forecastData);
    } catch (error) {
      console.error('Error proxying weather forecast data:', error);
      
      // Return cached data if available, even if expired
      if (weatherCache.forecast.data) {
        console.log('Returning cached forecast data due to error');
        return res.json(weatherCache.forecast.data);
      }
      
      res.status(500).json({ error: 'Failed to fetch weather forecast data' });
    }
  });

  // Printful sync route
  app.post("/api/printful/sync", requireAuth, requireAdmin, async (req, res) => {
    try {
      console.log("Starting Printful sync process");
      const { syncAllPrintfulProducts } = await import('./printful-sync');
      const syncedCount = await syncAllPrintfulProducts();
      
      res.json({ 
        success: true, 
        message: `Successfully synced ${syncedCount} products from Printful to the local database`,
        syncedCount
      });
    } catch (error) {
      console.error("Error in Printful sync:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to sync products from Printful",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Google API Endpoints
  app.get("/api/google/config", requireAuth, requireAdmin, (req, res) => {
    try {
      const config = googleService.getGoogleApiConfig();
      res.json(config);
    } catch (error) {
      console.error('Error fetching Google API config:', error);
      res.status(500).json({ message: "Failed to fetch Google API config" });
    }
  });

  app.post("/api/google/config", requireAuth, requireAdmin, (req, res) => {
    try {
      const { mapsApiKey, placesApiKey, geminiApiKey } = req.body;
      
      if (!mapsApiKey || !placesApiKey || !geminiApiKey) {
        return res.status(400).json({ message: "All API keys are required" });
      }
      
      googleService.updateGoogleApiConfig({
        mapsApiKey,
        placesApiKey,
        geminiApiKey
      });
      
      res.json({ success: true, message: "Google API configuration updated successfully" });
    } catch (error) {
      console.error('Error updating Google API config:', error);
      res.status(500).json({ message: "Failed to update Google API config" });
    }
  });

  app.get("/api/google/status", requireAuth, requireAdmin, async (req, res) => {
    try {
      const status = await googleService.checkGoogleApiStatus();
      res.json(status);
    } catch (error) {
      console.error('Error checking Google API status:', error);
      res.status(500).json({ message: "Failed to check Google API status" });
    }
  });
  
  // Public Location Service Status endpoint - No auth required
  app.get("/api/location/service-status", async (req, res) => {
    try {
      // Check Google API status using our service
      const apiStatus = await googleService.checkGoogleApiStatus();
      
      // Determine overall availability based on Maps and Places API status
      const available = 
        apiStatus.maps.status === 'working' || 
        apiStatus.places.status === 'working';
      
      res.json({
        available,
        services: {
          maps: apiStatus.maps.status === 'working',
          places: apiStatus.places.status === 'working'
        },
        message: available 
          ? 'Location services are available' 
          : 'Location services are currently unavailable'
      });
    } catch (error) {
      console.error('Error checking location service status:', error);
      // Default to available=true to avoid unnecessary error messages in the UI
      res.json({
        available: true,
        services: {
          maps: true,
          places: true
        },
        message: 'Location services status check failed, assuming available'
      });
    }
  });

  // Geocode address endpoint - available to public (needed for property listings on public pages)
  app.get("/api/google/geocode", async (req, res) => {
    try {
      const { address } = req.query;
      
      // Get client origin for CORS
      const origin = req.headers.origin || '*';
      
      // Set CORS headers to allow cross-origin requests
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        return res.status(204).end();
      }
      
      if (!address || typeof address !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Address parameter is required'
        });
      }
      
      logger.info(`Geocoding address: ${address}`);
      
      // Create URL for the Google Maps Geocoding API
      const geocodeUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json');
      geocodeUrl.searchParams.set('address', address);
      
      // Let the proxy service handle API key
      const response = await googleService.proxyGoogleMapsRequest(geocodeUrl.toString());
      
      // Check response
      if (!response.ok) {
        logger.error(`Geocoding failed with status: ${response.status}`);
        return res.status(response.status).json({
          success: false,
          message: `Geocoding request failed with status: ${response.status}`
        });
      }
      
      // Pass through the API response
      const data = await response.json();
      
      // Cache control - allow caching of geocoding results for 24 hours (86400 seconds)
      res.set('Cache-Control', 'public, max-age=86400');
      
      // Set appropriate content type
      res.set('Content-Type', 'application/json');
      
      // Add ETag for better cache validation
      const etag = require('crypto').createHash('md5').update(JSON.stringify(data)).digest('hex');
      res.set('ETag', `"${etag}"`);
      
      // Preconnect to Google's domains to speed up subsequent requests
      res.set('Link', '<https://maps.googleapis.com>; rel=preconnect; crossorigin, <https://maps.gstatic.com>; rel=preconnect; crossorigin');
      
      return res.json(data);
    } catch (error) {
      logger.error('Error geocoding address:', error);
      return res.status(500).json({
        success: false,
        message: 'Error geocoding address'
      });
    }
  });
  
  // Places Autocomplete API - Server-side implementation to avoid client-side API issues
  app.get("/api/google/places/autocomplete", async (req, res) => {
    try {
      const { input, types = 'address', components = 'country:us' } = req.query;
      
      // Get client origin for CORS
      const origin = req.headers.origin || '*';
      
      // Set CORS headers to allow cross-origin requests
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        return res.status(204).end();
      }
      
      if (!input || typeof input !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Input parameter is required'
        });
      }
      
      logger.info(`Places Autocomplete for input: ${input}`);
      
      // Create URL for the Google Places Autocomplete API
      const autocompleteUrl = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
      autocompleteUrl.searchParams.set('input', input);
      
      // Add optional parameters
      if (types) {
        autocompleteUrl.searchParams.set('types', String(types));
      }
      
      if (components) {
        autocompleteUrl.searchParams.set('components', String(components));
      }
      
      // Let the proxy service handle API key
      const response = await googleService.proxyGoogleMapsRequest(autocompleteUrl.toString());
      
      // Check response
      if (!response.ok) {
        logger.error(`Places Autocomplete failed with status: ${response.status}`);
        return res.status(response.status).json({
          success: false,
          message: `Places Autocomplete request failed with status: ${response.status}`
        });
      }
      
      // Pass through the API response
      const data = await response.json();
      
      // Cache for a short time (5 minutes) since autocomplete results change frequently
      res.set('Cache-Control', 'public, max-age=300');
      
      // Set appropriate content type
      res.set('Content-Type', 'application/json');
      
      // Preconnect to Google's domains to speed up subsequent requests
      res.set('Link', '<https://maps.googleapis.com>; rel=preconnect; crossorigin, <https://maps.gstatic.com>; rel=preconnect; crossorigin');
      
      return res.json(data);
    } catch (error) {
      logger.error('Error fetching place autocomplete:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get place autocomplete suggestions',
        error: String(error)
      });
    }
  });
  
  // Static Maps API endpoint - for showing maps without using the JS API
  app.get("/api/google/staticmap", async (req, res) => {
    try {
      const { center, zoom = 15, size = '600x300', markers, maptype = 'roadmap' } = req.query;
      
      // Get client origin for CORS
      const origin = req.headers.origin || '*';
      
      // Set CORS headers to allow cross-origin requests
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        return res.status(204).end();
      }
      
      if (!center) {
        return res.status(400).json({
          success: false,
          message: 'Center parameter is required'
        });
      }
      
      logger.info(`Static Map request for center: ${center}`);
      
      // Create URL for the Google Static Maps API
      const staticMapUrl = new URL('https://maps.googleapis.com/maps/api/staticmap');
      
      // Center can be either coordinates or an address
      staticMapUrl.searchParams.set('center', String(center));
      staticMapUrl.searchParams.set('zoom', String(zoom));
      staticMapUrl.searchParams.set('size', String(size));
      staticMapUrl.searchParams.set('maptype', String(maptype));
      
      // Add markers if provided, or use the center location if not
      if (markers) {
        staticMapUrl.searchParams.set('markers', String(markers));
      } else {
        // If no markers are provided, add a marker at the center
        staticMapUrl.searchParams.set('markers', `color:red|${String(center)}`);
      }
      
      logger.info(`Fetching static map with URL: ${staticMapUrl.toString().replace(/key=([^&]*)/, 'key=REDACTED')}`);
      
      // Let the proxy service handle API key and make the request
      const response = await googleService.proxyGoogleMapsRequest(staticMapUrl.toString());
      
      // Check response
      if (!response.ok) {
        logger.error(`Static Map failed with status: ${response.status}`);
        
        // Instead of returning error JSON, serve a placeholder image
        res.set('Content-Type', 'image/png');
        return res.sendFile(path.join(__dirname, '../public/media-placeholder/map-placeholder.png'));
      }
      
      logger.info(`Successfully fetched static map for ${center}`);
      
      // Get the image buffer
      const imageBuffer = await response.buffer?.();
      
      if (!imageBuffer) {
        logger.error('Failed to get image buffer from response');
        
        // Instead of returning error JSON, serve a placeholder image
        res.set('Content-Type', 'image/png');
        return res.sendFile(path.join(__dirname, '../public/media-placeholder/map-placeholder.png'));
      }
      
      // Set appropriate cache headers (cache for 24 hours)
      res.set('Cache-Control', 'public, max-age=86400');
      
      // Set content type based on response content type
      const contentType = response.headers.get('content-type') || 'image/png';
      res.set('Content-Type', contentType);
      
      // Send the image data
      return res.send(imageBuffer);
    } catch (error) {
      logger.error('Error fetching static map:', error);
      
      // Instead of returning error JSON, serve a placeholder image
      res.set('Content-Type', 'image/png');
      return res.sendFile(path.join(__dirname, '../public/media-placeholder/map-placeholder.png'));
    }
  });
  
  // Add an endpoint to provide the Maps API key for client-side testing
  app.get('/api/google/mapkey', (req, res) => {
    // Get client origin for CORS
    const origin = req.headers.origin || '*';
    
    // Set CORS headers to allow cross-origin requests
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    
    // The Google Maps API key from environment
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || 
                  process.env.VITE_GOOGLE_MAPS_API_KEY || 
                  'AIzaSyAcmmNAcRcRox1faiPlOIsJjKgPpxIYmRk'; // Fallback key
                  
    res.send(apiKey);
  });
  
  // Geocoding API endpoint - translates addresses to coordinates
  app.get("/api/google/geocode", async (req, res) => {
    try {
      const { address } = req.query;
      
      // Get client origin for CORS
      const origin = req.headers.origin || '*';
      
      // Set CORS headers to allow cross-origin requests
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        return res.status(204).end();
      }
      
      if (!address || typeof address !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Address parameter is required'
        });
      }
      
      logger.info(`Geocoding request for address: ${address}`);
      
      // Create URL for the Google Geocoding API
      const geocodingUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json');
      geocodingUrl.searchParams.set('address', address);
      
      // Let the proxy service handle API key and make the request
      const response = await googleService.proxyGoogleMapsRequest(geocodingUrl.toString());
      
      // Check response
      if (!response.ok) {
        logger.error(`Geocoding failed with status: ${response.status}`);
        return res.status(response.status).json({
          success: false,
          message: `Geocoding request failed with status: ${response.status}`
        });
      }
      
      // Parse the response
      const data = await response.json();
      
      // Set appropriate cache headers (cache for 1 week since addresses rarely change)
      res.set('Cache-Control', 'public, max-age=604800');
      
      // Set appropriate content type
      res.set('Content-Type', 'application/json');
      
      return res.json(data);
    } catch (error) {
      logger.error('Error geocoding address:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to geocode address',
        error: String(error)
      });
    }
  });

  // Admin cleanup routes
  // Preview unused media files (safe, non-destructive operation)
  app.get("/api/admin/preview/media", requireAuth, requireAdmin, async (req, res) => {
    console.log("Admin media preview requested by:", req.user.username);
    
    // Media preview has been disabled to prevent accidental deletion of event media
    return res.json({
      success: false,
      message: "Media preview has been disabled to prevent accidental deletion of event media. This feature was causing uploaded event images to disappear.",
      fileCount: 0,
      filesToDelete: [],
      disabled: true
    });
  });

  // Delete unused media files
  app.post("/api/admin/cleanup/media", requireAuth, requireAdmin, async (req, res) => {
    console.log("Admin media cleanup requested by:", req.user.username);
    
    // Media cleanup has been disabled to prevent accidental deletion of event media
    return res.json({
      success: false,
      message: "Media cleanup has been disabled to prevent accidental deletion of event media. This feature was causing uploaded event images to disappear.",
      disabled: true
    });
  });
  
  // Check for missing media files
  app.get("/api/admin/check/missing-media", requireAuth, requireAdmin, async (req, res) => {
    console.log("Admin check for missing media requested by:", req.user.username);
    try {
      const result = await storage.checkMissingMedia();
      
      console.log(`Found ${result.missingCount} missing media files`);
      
      res.json({ 
        success: true, 
        message: `Found ${result.missingCount} missing media files`,
        ...result
      });
    } catch (error) {
      console.error("Error checking for missing media:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to check for missing media files",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // User endpoint to delete their own message
  app.delete("/api/messages/:messageId", requireAuth, async (req, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }
    console.log("Message deletion requested by:", user.username, "for message:", req.params.messageId);
    try {
      const rawMessageId = Array.isArray(req.params.messageId) ? req.params.messageId[0] : req.params.messageId;
      const messageId = /^[1-9]\d*$/.test(rawMessageId) ? Number(rawMessageId) : NaN;
      
      if (isNaN(messageId)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid message ID" 
        });
      }

      // First, verify that the user is the sender of this message
      const messageToDelete = await db
        .select()
        .from(messages)
        .where(eq(messages.id, messageId))
        .limit(1);
      
      if (messageToDelete.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: "Message not found" 
        });
      }

      // Check if the user is the sender
      if (messageToDelete[0].senderId !== user.id) {
        return res.status(403).json({ 
          success: false, 
          message: "You can only delete messages you sent" 
        });
      }

      // Legal hold: refuse before deleting attachments/recipients.
      await assertMessageDeletable(messageId);

      // Delete message attachments first
      await db.delete(messageAttachments).where(eq(messageAttachments.messageId, messageId));
      
      // Delete message recipients
      await db.delete(messageRecipients).where(eq(messageRecipients.messageId, messageId));
      
      // Delete the message
      const deletedMessage = await db.delete(messages).where(eq(messages.id, messageId)).returning();
      
      console.log(`User ${user.username} deleted their message ${messageId}`);
      
      res.json({ 
        success: true, 
        message: "Message deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting message:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to delete message",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.use("/api/admin/messages", adminMessagesRouter);
  
  // Create a custom middleware to ensure JSON response 
  const ensureJsonResponse = (req, res, next) => {
    // Capture the original res.send method
    const originalSend = res.send;
    
    res.send = function(body) {
      // Always set content type to application/json
      res.setHeader('Content-Type', 'application/json');
      
      // Check if body is already a JSON string
      if (typeof body === 'string' && (body.startsWith('{') || body.startsWith('['))) {
        return originalSend.call(this, body);
      }
      
      // If it's not a string or not already JSON, stringify it
      if (typeof body !== 'string') {
        return originalSend.call(this, JSON.stringify(body));
      }
      
      // If it's a string but not JSON, convert to JSON error response
      try {
        // Try parsing it as JSON first
        JSON.parse(body);
        return originalSend.call(this, body);
      } catch (e) {
        // Not valid JSON, create a JSON error response
        console.error("Prevented non-JSON response:", body.substring(0, 100) + "...");
        return originalSend.call(this, JSON.stringify({
          success: false,
          message: "Internal server error - response was not valid JSON",
          error: "Invalid response format"
        }));
      }
    };
    
    next();
  };
  
  // Create a direct backup endpoint for calendar media files
  app.get("/api/admin/backup/calendar-media", requireAuth, requireAdmin, async (req, res) => {
    console.log("Admin calendar media backup requested by:", req.user.username);
    
    try {
      console.log(`Creating backup of calendar media folder`);
      const folder = "calendar";
      const result = await storage.createMediaBackup(folder);
      
      if (!result.success) {
        console.log(`Backup failed for calendar folder`);
        return res.status(500).json({ 
          success: false, 
          message: "Failed to create backup of calendar media" 
        });
      }
      
      console.log(`Successfully backed up ${result.backupCount} files from calendar`);
      
      // Set appropriate headers to force JSON content type
      res.setHeader('Content-Type', 'application/json');
      return res.json({ 
        success: true, 
        message: `Successfully backed up ${result.backupCount} files from calendar`,
        backupCount: result.backupCount,
        backupPath: result.backupPath
      });
    } catch (error) {
      console.error("Error creating calendar media backup:", error);
      // Make sure we're sending JSON content type even for errors
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({ 
        success: false, 
        message: "Failed to create calendar media backup",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Create a direct backup endpoint for forum media files
  app.get("/api/admin/backup/forum-media", requireAuth, requireAdmin, async (req, res) => {
    console.log("Admin forum media backup requested by:", req.user.username);
    
    try {
      console.log(`Creating backup of forum media folder`);
      const folder = "forum";
      const result = await storage.createMediaBackup(folder);
      
      if (!result.success) {
        console.log(`Backup failed for forum folder`);
        return res.status(500).json({ 
          success: false, 
          message: "Failed to create backup of forum media" 
        });
      }
      
      console.log(`Successfully backed up ${result.backupCount} files from forum`);
      
      // Set appropriate headers to force JSON content type
      res.setHeader('Content-Type', 'application/json');
      return res.json({ 
        success: true, 
        message: `Successfully backed up ${result.backupCount} files from forum`,
        backupCount: result.backupCount,
        backupPath: result.backupPath
      });
    } catch (error) {
      console.error("Error creating forum media backup:", error);
      // Make sure we're sending JSON content type even for errors
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({ 
        success: false, 
        message: "Failed to create forum media backup",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Create a direct backup endpoint for community media files
  app.get("/api/admin/backup/community-media", requireAuth, requireAdmin, async (req, res) => {
    console.log("Admin community media backup requested by:", req.user.username);
    
    try {
      console.log(`Creating backup of community media folder`);
      const folder = "community";
      const result = await storage.createMediaBackup(folder);
      
      if (!result.success) {
        console.log(`Backup failed for community folder`);
        return res.status(500).json({ 
          success: false, 
          message: "Failed to create backup of community media" 
        });
      }
      
      console.log(`Successfully backed up ${result.backupCount} files from community`);
      
      // Set appropriate headers to force JSON content type
      res.setHeader('Content-Type', 'application/json');
      return res.json({ 
        success: true, 
        message: `Successfully backed up ${result.backupCount} files from community`,
        backupCount: result.backupCount,
        backupPath: result.backupPath
      });
    } catch (error) {
      console.error("Error creating community media backup:", error);
      // Make sure we're sending JSON content type even for errors
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({ 
        success: false, 
        message: "Failed to create community media backup",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Create a direct backup endpoint for vendors media files
  app.get("/api/admin/backup/vendors-media", requireAuth, requireAdmin, async (req, res) => {
    console.log("Admin vendors media backup requested by:", req.user.username);
    
    try {
      console.log(`Creating backup of vendors media folder`);
      const folder = "vendors";
      const result = await storage.createMediaBackup(folder);
      
      if (!result.success) {
        console.log(`Backup failed for vendors folder`);
        return res.status(500).json({ 
          success: false, 
          message: "Failed to create backup of vendors media" 
        });
      }
      
      console.log(`Successfully backed up ${result.backupCount} files from vendors`);
      
      // Set appropriate headers to force JSON content type
      res.setHeader('Content-Type', 'application/json');
      return res.json({ 
        success: true, 
        message: `Successfully backed up ${result.backupCount} files from vendors`,
        backupCount: result.backupCount,
        backupPath: result.backupPath
      });
    } catch (error) {
      console.error("Error creating vendors media backup:", error);
      // Make sure we're sending JSON content type even for errors
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({ 
        success: false, 
        message: "Failed to create vendors media backup",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Create a direct backup endpoint for banner slides media files
  app.get("/api/admin/backup/banner-slides-media", requireAuth, requireAdmin, async (req, res) => {
    console.log("Admin banner-slides media backup requested by:", req.user.username);
    
    try {
      console.log(`Creating backup of banner-slides media folder`);
      const folder = "banner-slides";
      const result = await storage.createMediaBackup(folder);
      
      if (!result.success) {
        console.log(`Backup failed for banner-slides folder`);
        return res.status(500).json({ 
          success: false, 
          message: "Failed to create backup of banner-slides media" 
        });
      }
      
      console.log(`Successfully backed up ${result.backupCount} files from banner-slides`);
      
      // Set appropriate headers to force JSON content type
      res.setHeader('Content-Type', 'application/json');
      return res.json({ 
        success: true, 
        message: `Successfully backed up ${result.backupCount} files from banner-slides`,
        backupCount: result.backupCount,
        backupPath: result.backupPath
      });
    } catch (error) {
      console.error("Error creating banner-slides media backup:", error);
      // Make sure we're sending JSON content type even for errors
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({ 
        success: false, 
        message: "Failed to create banner-slides media backup",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Create a direct backup endpoint for real-estate media files
  app.get("/api/admin/backup/real-estate-media", requireAuth, requireAdmin, async (req, res) => {
    console.log("Admin real-estate media backup requested by:", req.user.username);
    
    try {
      console.log(`Creating backup of Real Estate media folder`);
      // Using the folder name with space to match the actual directory structure
      const folder = "real-estate"; // We'll handle the translation to "Real Estate" in the createMediaBackup function
      const result = await storage.createMediaBackup(folder);
      
      if (!result.success) {
        console.log(`Backup failed for real-estate folder`);
        return res.status(500).json({ 
          success: false, 
          message: "Failed to create backup of real-estate media" 
        });
      }
      
      console.log(`Successfully backed up ${result.backupCount} files from real-estate`);
      
      // Set appropriate headers to force JSON content type
      res.setHeader('Content-Type', 'application/json');
      return res.json({ 
        success: true, 
        message: `Successfully backed up ${result.backupCount} files from real-estate`,
        backupCount: result.backupCount,
        backupPath: result.backupPath
      });
    } catch (error) {
      console.error("Error creating real-estate media backup:", error);
      // Make sure we're sending JSON content type even for errors
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({ 
        success: false, 
        message: "Failed to create real-estate media backup",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Create a backup of media files (original endpoint, keeping for compatibility)
  app.post("/api/admin/backup/media", requireAuth, requireAdmin, ensureJsonResponse, async (req, res) => {
    console.log("Admin media backup requested by:", req.user.username);
    console.log("Request body:", req.body);
    try {
      const { folder } = req.body;
      
      if (!folder) {
        console.log("Missing folder parameter in request");
        return res.status(400).json({ 
          success: false, 
          message: "Folder parameter is required"
        });
      }
      
      console.log(`Creating backup of media folder: ${folder}`);
      const result = await storage.createMediaBackup(folder);
      
      if (!result.success) {
        console.log(`Backup failed for folder: ${folder}`);
        return res.status(500).json({ 
          success: false, 
          message: `Failed to create backup of ${folder}`
        });
      }
      
      console.log(`Successfully backed up ${result.backupCount} files from ${folder}`);
      
      res.json({ 
        success: true, 
        message: `Successfully backed up ${result.backupCount} files from ${folder}`,
        ...result
      });
    } catch (error) {
      console.error("Error creating media backup:", error);
      // Make sure we're sending JSON content type even for errors
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({ 
        success: false, 
        message: "Failed to create media backup",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Force refresh Square credentials endpoint
  app.post("/api/admin/square-refresh", async (req, res) => {
    console.log("Square credentials refresh requested");
    try {
      // Force reinitialize the Square client with fresh credentials
      await squareService.reinitializeSquareClient();
      
      // Test the connection to verify credentials are working
      const { accessToken, locationId } = squareService.getSquareCredentials();
      
      if (accessToken && locationId) {
        const testResponse = await fetch('https://connect.squareup.com/v2/locations', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Square-Version': '2024-12-18',
            'Content-Type': 'application/json'
          }
        });

        if (testResponse.ok) {
          const data = await testResponse.json();
          const currentLocation = data.locations?.find(loc => loc.id === locationId);
          
          console.log("Square credentials refresh successful");
          res.json({
            success: true,
            message: "Square credentials refreshed successfully",
            locationName: currentLocation?.name || "Unknown",
            locationsCount: data.locations?.length || 0
          });
        } else {
          console.error("Square API test failed after refresh");
          res.status(500).json({
            success: false,
            message: "Square credentials refresh failed - API test unsuccessful"
          });
        }
      } else {
        console.error("Missing Square credentials after refresh");
        res.status(500).json({
          success: false,
          message: "Square credentials not available after refresh"
        });
      }
    } catch (error) {
      console.error("Error refreshing Square credentials:", error);
      res.status(500).json({
        success: false,
        message: "Failed to refresh Square credentials",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Restore media from backup
  app.post("/api/admin/restore/media", requireAuth, requireAdmin, ensureJsonResponse, async (req, res) => {
    console.log("Admin media restore requested by:", req.user.username);
    try {
      const { backupFolder, targetFolder } = req.body;
      
      if (!backupFolder || !targetFolder) {
        return res.status(400).json({ 
          success: false, 
          message: "Both backupFolder and targetFolder parameters are required"
        });
      }
      
      console.log(`Restoring media from backup ${backupFolder} to ${targetFolder}`);
      const result = await storage.restoreMediaFromBackup(backupFolder, targetFolder);
      
      if (!result.success) {
        return res.status(500).json({ 
          success: false, 
          message: `Failed to restore media from ${backupFolder} to ${targetFolder}`
        });
      }
      
      console.log(`Successfully restored ${result.restoredCount} files to ${targetFolder}`);
      
      res.json({ 
        success: true, 
        message: `Successfully restored ${result.restoredCount} files to ${targetFolder}`,
        ...result
      });
    } catch (error) {
      console.error("Error restoring media:", error);
      // Make sure we're sending JSON content type even for errors
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({ 
        success: false, 
        message: "Failed to restore media",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Delete old content versions
  app.post("/api/admin/cleanup/content-versions", requireAuth, requireAdmin, async (req, res) => {
    console.log("Admin content version cleanup requested by:", req.user.username);
    try {
      const result = await storage.deleteOldContentVersions();
      
      console.log(`Deleted ${result.deletedCount} old content versions`);
      
      res.json({ 
        success: true, 
        message: `Successfully deleted ${result.deletedCount} old content versions`,
        ...result
      });
    } catch (error) {
      console.error("Error in content version cleanup:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to clean up old content versions",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Set expiration dates for real estate listings that don't have them
  app.post("/api/admin/set-missing-expiration-dates", requireAuth, requireAdmin, async (req, res) => {
    console.log("Admin request to set missing expiration dates by:", req.user.username);
    try {
      // Get listings without expiration dates
      const listings = await storage.getListingsWithoutExpiration();
      
      if (listings.length === 0) {
        return res.json({
          success: true,
          message: "No listings found without expiration dates",
          count: 0,
          updatedIds: []
        });
      }
      
      const updatedIds: number[] = [];
      let count = 0;
      
      // Set expiration date to 30 days from now for each listing
      for (const listing of listings) {
        try {
          // Set expiration date to 30 days from now
          const expirationDate = new Date();
          expirationDate.setDate(expirationDate.getDate() + 30);
          
          await storage.updateListing(listing.id, {
            expirationDate,
            updatedAt: new Date()
          });
          
          console.log(`Set expiration date for listing ID ${listing.id} to ${expirationDate.toISOString()}`);
          count++;
          updatedIds.push(listing.id);
        } catch (updateError) {
          console.error(`Error updating listing ID ${listing.id}:`, updateError);
          // Continue with other listings even if one fails
        }
      }
      
      res.json({
        success: true,
        message: `Successfully set expiration dates for ${count} listings`,
        count,
        updatedIds
      });
    } catch (error) {
      console.error("Error setting missing expiration dates:", error);
      res.status(500).json({
        success: false,
        message: "Failed to set missing expiration dates",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // API endpoints for Square API credentials management
  // These duplicate endpoints have been disabled because they were causing conflicts
  // The primary endpoints for Square API settings are at lines 4636 (GET) and 4670 (POST)
  
  /* DISABLED DUPLICATE ENDPOINT - START
  app.get('/api/payments/square-env', requireAdmin, (req, res) => {
    try {
      // Return the environment variables without the actual values
      // for security reasons, we'll just indicate if they are set or not
      res.json({
        squareAccessToken: process.env.SQUARE_ACCESS_TOKEN ? '********' : '',
        squareApplicationId: process.env.SQUARE_APPLICATION_ID || '',
        squareLocationId: process.env.SQUARE_LOCATION_ID || '',
      });
    } catch (error) {
      console.error('Error retrieving Square API credentials:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve Square API credentials',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  app.post('/api/payments/square-env', requireAdmin, async (req, res) => {
    try {
      const { squareAccessToken, squareApplicationId, squareLocationId } = req.body;
      
      // Validate input
      if (!squareAccessToken || !squareApplicationId || !squareLocationId) {
        return res.status(400).json({
          success: false,
          message: 'All fields are required'
        });
      }
      
      // Update environment variables
      process.env.SQUARE_ACCESS_TOKEN = squareAccessToken;
      process.env.SQUARE_APPLICATION_ID = squareApplicationId;
      process.env.SQUARE_LOCATION_ID = squareLocationId;
      
      // Reinitialize the Square client with the new credentials
      try {
        await squareService.reinitializeSquareClient();
        
        res.json({
          success: true,
          message: 'Square API credentials updated successfully'
        });
      } catch (error) {
        console.error('Error reinitializing Square client:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to reinitialize Square client with new credentials',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    } catch (error) {
      console.error('Error updating Square API credentials:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update Square API credentials',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  DISABLED DUPLICATE ENDPOINT - END */
  
  // Endpoint to check for expired listings (admin only)
  app.post("/api/admin/check-expired-listings", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    try {
      // Import the service
      const { checkExpiredListings } = await import('./listing-expiration-service');
      
      // Optional reference date for testing (if provided)
      let referenceDate = undefined;
      
      if (req.body.referenceDate) {
        referenceDate = new Date(req.body.referenceDate);
        console.log(`Using reference date: ${referenceDate.toISOString()}`);
      }
      
      // Run the check
      const result = await checkExpiredListings(referenceDate);
      
      res.json({
        success: true,
        message: `Processed ${result.checked} listings: ${result.renewed} renewed, ${result.expired} expired`,
        ...result
      });
    } catch (err) {
      console.error("Error checking expired listings:", err);
      res.status(500).json({ 
        success: false, 
        message: err instanceof Error ? err.message : "Failed to check expired listings"
      });
    }
  });
  
  // Endpoint to check for listings expiring soon (admin only)
  app.post("/api/admin/check-expiring-listings", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    try {
      const { daysUntilExpiration = 3 } = req.body;
      
      // Import the service
      const { checkExpiringListings } = await import('./listing-expiration-service');
      
      // Run the check
      const result = await checkExpiringListings(Number(daysUntilExpiration));
      
      res.json({
        success: true,
        message: `Found ${result.count} listings expiring in ${daysUntilExpiration} days`,
        ...result
      });
    } catch (err) {
      console.error("Error checking expiring listings:", err);
      res.status(500).json({ 
        success: false, 
        message: err instanceof Error ? err.message : "Failed to check expiring listings"
      });
    }
  });
  
  // Endpoint to set expiration date for listings without one (admin only)
  app.post("/api/admin/set-listing-expirations", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    try {
      // Get all listings without an expiration date
      const listings = await storage.getListingsWithoutExpiration();
      console.log(`Found ${listings.length} listings without expiration dates`);
      
      const updated = [];
      
      // For each listing, set an expiration date 30 days from creation
      for (const listing of listings) {
        const creationDate = new Date(listing.createdAt);
        const expirationDate = new Date(creationDate);
        expirationDate.setDate(expirationDate.getDate() + 30);
        
        console.log(`Setting expiration date for listing ${listing.id} to ${expirationDate.toISOString()}`);
        
        const updatedListing = await storage.updateListing(listing.id, {
          expirationDate,
          updatedAt: new Date()
        });
        
        updated.push({
          id: updatedListing.id,
          title: updatedListing.title,
          expirationDate: updatedListing.expirationDate
        });
      }
      
      res.json({
        success: true,
        message: `Updated ${updated.length} listings with expiration dates`,
        listings: updated
      });
    } catch (err) {
      console.error("Error setting listing expirations:", err);
      res.status(500).json({ 
        success: false, 
        message: err instanceof Error ? err.message : "Failed to set listing expirations"
      });
    }
  });

  // Square API credentials endpoint for client-side initialization
  app.get("/api/square/app-info", (req, res) => {
    const appInfo = getSquareAppInfo();
    res.json(appInfo);
  });
  
  // System health and monitoring endpoint
  app.get("/api/system/health", async (req, res) => {
    try {
      const startTime = Date.now();
      
      // Check database connection
      let dbStatus = 'error';
      let dbResponse = null;
      let dbLatency = 0;
      
      try {
        const dbStart = Date.now();
        await db.execute(sql`SELECT 1 as ping`);
        dbLatency = Date.now() - dbStart;
        dbStatus = 'connected';
      } catch (dbError) {
        dbResponse = dbError.message;
      }
      
      // Check memory usage
      const memoryUsage = process.memoryUsage();
      
      // Check session store
      let sessionStatus = 'error';
      try {
        if (storage.sessionStore) {
          sessionStatus = 'connected';
        }
      } catch (sessionError) {
        sessionStatus = 'error';
      }
      
      // Calculate response time
      const responseTime = Date.now() - startTime;
      
      // Return comprehensive health data
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        database: {
          status: dbStatus,
          latency: dbLatency,
          error: dbResponse
        },
        sessions: {
          status: sessionStatus
        },
        memory: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
          external: Math.round(memoryUsage.external / 1024 / 1024) + 'MB',
        },
        environment: process.env.NODE_ENV || 'development',
        responseTime: responseTime + 'ms'
      });
    } catch (error) {
      console.error('Health check error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Health check failed',
        error: error.message
      });
    }
  });
  
  /**
   * API endpoint to get a presigned URL for Object Storage media
   * This enables client-side access to private Object Storage files
   */
  app.get('/api/media/presigned', requireAdmin, async (req, res) => {
    try {
      // Import the object storage module
      const objectStorage = await import('./object-storage');
      
      const { key } = req.query;
      
      if (!key || typeof key !== 'string') {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing or invalid key parameter' 
        });
      }
      
      // Get a presigned URL with a short expiration (10 minutes)
      const presignedUrl = await objectStorage.getPresignedUrl(key, 600);
      
      res.json({ 
        success: true, 
        url: presignedUrl 
      });
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to generate presigned URL',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Google Maps proxy routes are already defined at the top of the file

  // Gemini API proxy to avoid CORS issues
  app.post("/api/gemini-proxy", async (req, res) => {
    try {
      const { model, contents, generationConfig } = req.body;
      
      if (!model || !contents) {
        return res.status(400).json({ error: "Missing required parameters" });
      }
      
      // Try both environment variable formats
      const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
      
      console.log("Using Gemini API Key:", apiKey ? "Present (masked)" : "Not found");
      
      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API key not configured" });
      }

      // Check if this is a search query related to rentals
      if (contents[0]?.parts?.[0]?.text) {
        const promptText = contents[0].parts[0].text;
        const userQuery = promptText.match(/User query: "(.*?)"/)?.[1] || "";
        
        // Check if the query is related to rentals
        const rentalKeywords = ['rent', 'rental', 'lease', 'apartment', 'tenant'];
        const isRentalQuery = rentalKeywords.some(keyword => 
          userQuery.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (isRentalQuery) {
          console.log("Rental query detected:", userQuery);
          // Add a prefetch instruction to prioritize rental listings
          contents[0].parts[0].text = promptText.replace(
            "IMPORTANT FILTERING INSTRUCTIONS FOR REAL ESTATE AND FOR-SALE LISTINGS:",
            "!!!RENTAL QUERY DETECTED!!! - This is definitely a rental query!\n\nIMPORTANT FILTERING INSTRUCTIONS FOR REAL ESTATE AND FOR-SALE LISTINGS:"
          );
        }
      }
      
      // Log the request for debugging
      console.log("Gemini API request payload:", JSON.stringify({ model, contents, generationConfig }, null, 2));
      
      // Build the URL with the model name and API key
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
      // Make the request to Gemini API
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          generationConfig
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Gemini API error:', errorData);
        return res.status(response.status).json(errorData);
      }
      
      const data = await response.json();
      return res.json(data);
    } catch (error) {
      console.error('Error proxying Gemini API request:', error);
      return res.status(500).json({ error: "Failed to proxy request to Gemini API", message: error.message });
    }
  });
  
  // Site Settings API Routes
  app.get('/api/site-settings', async (req, res) => {
    try {
      const settings = await storage.getSiteSettings();
      return res.json(settings);
    } catch (error) {
      console.error('Error retrieving site settings:', error);
      return res.status(500).json({ error: "Failed to retrieve site settings", message: error.message });
    }
  });
  
  app.get('/api/site-settings/:key', async (req, res) => {
    try {
      const key = req.params.key;
      const setting = await storage.getSiteSettingByKey(key);
      
      if (!setting) {
        return res.status(404).json({ error: `Setting with key "${key}" not found` });
      }
      
      return res.json(setting);
    } catch (error) {
      console.error(`Error retrieving site setting:`, error);
      return res.status(500).json({ error: "Failed to retrieve site setting", message: error.message });
    }
  });
  
  app.get('/api/site-settings/value/:key', async (req, res) => {
    try {
      const key = req.params.key;
      console.log(`Getting site setting value for key: ${key}`);
      console.log(`User authenticated: ${req.isAuthenticated ? 'Yes' : 'No'}`);
      console.log(`User role: ${req.user?.role || 'Not logged in'}`);
      
      // First check if the setting exists in the database
      const setting = await storage.getSiteSettingByKey(key);
      console.log(`Direct DB query for setting: ${JSON.stringify(setting)}`);
      
      // Then get just the value using the getSettingValue helper
      const value = await storage.getSettingValue(key);
      console.log(`Retrieved value from storage: ${value}`);
      
      if (value === null) {
        console.log(`Setting with key "${key}" not found, returning 404`);
        return res.status(404).json({ error: `Setting with key "${key}" not found` });
      }
      
      console.log(`Returning site setting: { key: ${key}, value: ${value} }`);
      return res.json({ key, value });
    } catch (error) {
      console.error(`Error retrieving site setting value:`, error);
      return res.status(500).json({ error: "Failed to retrieve setting value", message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });
  
  app.post('/api/site-settings', async (req, res) => {
    // Check if user is authenticated and is admin
    if (!req.isAuthenticated || !req.user || req.user.role !== 'admin') {
      // For non-admin users, check if the request is for specific non-sensitive site settings
      // that we want to allow guests to update (like custom rocket icons)
      const { key } = req.body;
      const publicSettingKeys = ['custom-icon-rocket'];
      
      if (!publicSettingKeys.includes(key)) {
        return res.status(403).json({ error: "Not authorized to update this site setting" });
      }
    }
    
    try {
      const { key, value, description } = req.body;
      
      if (!key || value === undefined) {
        return res.status(400).json({ error: "Key and value are required" });
      }
      
      const userId = req.user?.id || null; // Allow null userId for guest updates to whitelisted settings
      const setting = await storage.setSiteSetting(key, value, description, userId);
      
      return res.json(setting);
    } catch (error) {
      console.error('Error setting site setting:', error);
      return res.status(500).json({ error: "Failed to set site setting", message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });
  
  app.delete('/api/site-settings/:id', async (req, res) => {
    // Check if user is authenticated and is admin
    if (!req.isAuthenticated || !req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: "Not authorized to delete site settings" });
    }
    try {
      const id = parseInt(req.params.id, 10);
      
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID" });
      }
      
      const success = await storage.deleteSiteSetting(id);
      
      if (!success) {
        return res.status(404).json({ error: `Setting with ID ${id} not found` });
      }
      
      return res.json({ success: true, message: `Setting with ID ${id} deleted successfully` });
    } catch (error) {
      console.error(`Error deleting site setting:`, error);
      return res.status(500).json({ error: "Failed to delete site setting", message: error.message });
    }
  });

  // ----- Platinum Sponsor Settings -----
  // These settings control how the platinum sponsor banners are ordered and
  // rotated on the calendar page and home sponsors section. They are stored as
  // individual rows in the existing site_settings table (no schema migration
  // required) under the keys defined below.
  const PLATINUM_SETTING_KEYS = {
    randomizeOnLoad: "platinum_sponsor_randomize_on_load",
    rotationEnabled: "platinum_sponsor_rotation_enabled",
    rotationSeconds: "platinum_sponsor_rotation_seconds",
    manualOrderEnabled: "platinum_sponsor_manual_order_enabled",
    manualOrder: "platinum_sponsor_manual_order",
  } as const;

  const PLATINUM_SETTING_DEFAULTS = {
    randomizeOnLoad: true,
    rotationEnabled: true,
    rotationSeconds: 30,
    manualOrderEnabled: false,
    manualOrder: [] as number[],
  };

  const PLATINUM_MIN_INTERVAL_SECONDS = 5;

  async function loadPlatinumSponsorSettings() {
    const [randVal, rotEnVal, rotSecVal, manEnVal, manOrderVal] = await Promise.all([
      storage.getSettingValue(PLATINUM_SETTING_KEYS.randomizeOnLoad),
      storage.getSettingValue(PLATINUM_SETTING_KEYS.rotationEnabled),
      storage.getSettingValue(PLATINUM_SETTING_KEYS.rotationSeconds),
      storage.getSettingValue(PLATINUM_SETTING_KEYS.manualOrderEnabled),
      storage.getSettingValue(PLATINUM_SETTING_KEYS.manualOrder),
    ]);

    let manualOrder: number[] = PLATINUM_SETTING_DEFAULTS.manualOrder;
    if (manOrderVal) {
      try {
        const parsed = JSON.parse(manOrderVal);
        if (Array.isArray(parsed)) {
          manualOrder = parsed
            .map((n: unknown) => Number(n))
            .filter((n: number) => Number.isInteger(n) && n > 0);
        }
      } catch {
        // Ignore corrupted JSON and fall back to default
      }
    }

    const parsedSeconds = rotSecVal !== null ? parseInt(rotSecVal, 10) : NaN;
    const rotationSeconds = Number.isFinite(parsedSeconds) && parsedSeconds >= PLATINUM_MIN_INTERVAL_SECONDS
      ? parsedSeconds
      : PLATINUM_SETTING_DEFAULTS.rotationSeconds;

    return {
      randomizeOnLoad: randVal === null ? PLATINUM_SETTING_DEFAULTS.randomizeOnLoad : randVal === "true",
      rotationEnabled: rotEnVal === null ? PLATINUM_SETTING_DEFAULTS.rotationEnabled : rotEnVal === "true",
      rotationSeconds,
      manualOrderEnabled: manEnVal === null ? PLATINUM_SETTING_DEFAULTS.manualOrderEnabled : manEnVal === "true",
      manualOrder,
    };
  }

  // Public read-only endpoint exposing only the values needed by the frontend
  // renderer (booleans, interval seconds, manual order array). Available to all
  // visitors so the sponsor section/calendar can render correctly.
  app.get("/api/platinum-sponsor-settings", async (_req, res) => {
    try {
      const settings = await loadPlatinumSponsorSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error retrieving platinum sponsor settings:", error);
      res.status(500).json({
        error: "Failed to retrieve platinum sponsor settings",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Admin endpoint to read the full settings object together with the list of
  // platinum sponsor events available for manual ordering.
  app.get("/api/admin/platinum-sponsor-settings", requireAdmin, async (_req, res) => {
    try {
      const [settings, allEvents] = await Promise.all([
        loadPlatinumSponsorSettings(),
        storage.getEvents(),
      ]);
      const sponsors = allEvents
        .filter((event) => event.category === "platinum_sponsor" && !event.parentEventId)
        .map((event) => ({
          id: event.id,
          title: event.title,
          startDate: event.startDate,
          endDate: event.endDate,
        }))
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      res.json({ settings, sponsors });
    } catch (error) {
      console.error("Error retrieving admin platinum sponsor settings:", error);
      res.status(500).json({
        error: "Failed to retrieve platinum sponsor settings",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Admin endpoint to update the settings. All five values are persisted
  // together as separate site_settings rows.
  app.put("/api/admin/platinum-sponsor-settings", requireAdmin, async (req, res) => {
    try {
      const {
        randomizeOnLoad,
        rotationEnabled,
        rotationSeconds,
        manualOrderEnabled,
        manualOrder,
      } = req.body ?? {};

      if (typeof randomizeOnLoad !== "boolean") {
        return res.status(400).json({ error: "randomizeOnLoad must be a boolean" });
      }
      if (typeof rotationEnabled !== "boolean") {
        return res.status(400).json({ error: "rotationEnabled must be a boolean" });
      }
      if (typeof manualOrderEnabled !== "boolean") {
        return res.status(400).json({ error: "manualOrderEnabled must be a boolean" });
      }
      if (
        !Number.isInteger(rotationSeconds) ||
        rotationSeconds < PLATINUM_MIN_INTERVAL_SECONDS
      ) {
        return res.status(400).json({
          error: `rotationSeconds must be an integer >= ${PLATINUM_MIN_INTERVAL_SECONDS}`,
        });
      }
      if (!Array.isArray(manualOrder) || !manualOrder.every((n) => Number.isInteger(n) && n > 0)) {
        return res.status(400).json({ error: "manualOrder must be an array of positive integers" });
      }

      // Validate that manualOrder ids correspond to real platinum sponsor events
      // (parents only). Unknown ids are silently dropped to keep the UI tolerant
      // of sponsors that have been deleted between admin edits.
      const allEvents = await storage.getEvents();
      const validSponsorIds = new Set(
        allEvents
          .filter((event) => event.category === "platinum_sponsor" && !event.parentEventId)
          .map((event) => event.id),
      );
      const sanitizedOrder = manualOrder.filter((id: number) => validSponsorIds.has(id));

      const userId = req.user?.id;
      await Promise.all([
        storage.setSiteSetting(
          PLATINUM_SETTING_KEYS.randomizeOnLoad,
          randomizeOnLoad ? "true" : "false",
          "Whether to shuffle platinum sponsors on each page load",
          userId,
        ),
        storage.setSiteSetting(
          PLATINUM_SETTING_KEYS.rotationEnabled,
          rotationEnabled ? "true" : "false",
          "Whether the platinum sponsor rotation timer is enabled",
          userId,
        ),
        storage.setSiteSetting(
          PLATINUM_SETTING_KEYS.rotationSeconds,
          String(rotationSeconds),
          "Seconds between platinum sponsor rotations",
          userId,
        ),
        storage.setSiteSetting(
          PLATINUM_SETTING_KEYS.manualOrderEnabled,
          manualOrderEnabled ? "true" : "false",
          "Whether the admin-defined manual order overrides shuffle/rotation",
          userId,
        ),
        storage.setSiteSetting(
          PLATINUM_SETTING_KEYS.manualOrder,
          JSON.stringify(sanitizedOrder),
          "Admin-defined platinum sponsor display order (event ids)",
          userId,
        ),
      ]);

      const updated = await loadPlatinumSponsorSettings();
      res.json(updated);
    } catch (error) {
      console.error("Error updating platinum sponsor settings:", error);
      res.status(500).json({
        error: "Failed to update platinum sponsor settings",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Launch page settings API endpoints
  app.get("/api/launch/settings", async (req, res) => {
    try {
      const settings = {
        launchDate: await storage.getSettingValue("launch_date") || new Date(Date.now() + 86400000).toISOString(), // Default to tomorrow
        rocketIcon: await storage.getSettingValue("rocket_icon") || "",
        launchMessage: await storage.getSettingValue("launch_message") || "Get ready for takeoff!",
        soundEnabled: await storage.getSettingValue("launch_sound_enabled") === "true",
        isActive: await storage.getSettingValue("launch_is_active") === "true"
      };
      
      // Log for debugging
      console.log("Retrieved launch settings:", settings);
      
      res.json({
        success: true,
        settings
      });
    } catch (error) {
      console.error("Error retrieving launch settings:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve launch settings",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Update launch settings (admin only)
  app.post("/api/launch/settings", requireAdmin, async (req, res) => {
    try {
      const { launchDate, rocketIcon, launchMessage, soundEnabled, isActive } = req.body;
      
      // Validate input
      if (!launchDate) {
        return res.status(400).json({
          success: false,
          message: "Launch date is required"
        });
      }
      
      // Save settings
      const userId = req.user?.id;
      await storage.setSiteSetting("launch_date", launchDate, "Scheduled launch date", userId);
      await storage.setSiteSetting("rocket_icon", rocketIcon || "", "Custom rocket icon URL", userId);
      await storage.setSiteSetting("launch_message", launchMessage || "Get ready for takeoff!", "Pre-launch message", userId);
      await storage.setSiteSetting("launch_sound_enabled", soundEnabled ? "true" : "false", "Whether sound effects are enabled", userId);
      await storage.setSiteSetting("launch_is_active", isActive ? "true" : "false", "Whether launch page is active", userId);
      
      // Return updated settings
      res.json({
        success: true,
        message: "Launch settings updated successfully"
      });
    } catch (error) {
      console.error("Error updating launch settings:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update launch settings",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Trigger immediate launch (admin only)
  app.post("/api/launch/trigger", requireAdmin, async (req, res) => {
    try {
      const now = new Date().toISOString();
      const userId = req.user?.id;
      
      // Update launch date to now (triggers immediate launch)
      await storage.setSiteSetting("launch_date", now, "Manually triggered launch date", userId);
      await storage.setSiteSetting("launch_manually_triggered", "true", "Flag indicating manual launch", userId);
      
      res.json({
        success: true,
        message: "Launch triggered successfully",
        launchDate: now
      });
    } catch (error) {
      console.error("Error triggering launch:", error);
      res.status(500).json({
        success: false,
        message: "Failed to trigger launch",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  const httpServer = createServer(app);
  
  // WebSocket functionality disabled to avoid interference with Object Storage
  /*
  // Set up WebSocket server on a distinct path to avoid conflicts with Vite HMR
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Helper function to broadcast messages to all connected WebSocket clients
  const broadcastWebSocketMessage = (type: string, data: any) => {
    if (!wss || !wss.clients || wss.clients.size === 0) {
      console.log(`No WebSocket clients connected, skipping ${type} broadcast`);
      return;
    }
    
    console.log(`Broadcasting ${type} event to ${wss.clients.size} clients`);
    
    // Apply media synchronization before broadcasting
    const message = {
      type,
      data
    };

    // Synchronize media paths if needed
    const processedMessage = syncWebSocketMediaUrls(message);
    
    wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(processedMessage));
      }
    });
  };
  */
  
  // Real broadcast function for WebSocket messages
  let broadcastWebSocketMessage = (type: string, data: any) => {
    console.log(`WebSocket message: broadcasting ${type} event`);
    wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type,
          data,
          timestamp: new Date().toISOString()
        }));
      }
    });
  };

  // WebSocket functionality completely disabled to avoid interference with Object Storage
  /*
  // WebSocket connection handling
  wss.on('connection', (socket: WebSocket, req) => {
    const extSocket = socket as ExtendedWebSocket;
    
    // Get client information for better debugging
    const clientIp = req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const origin = req.headers.origin || 'unknown';
    const clientId = Math.random().toString(36).substring(2, 15);
    
    console.log(`WebSocket client connected [${clientId}] from ${clientIp}`);
    console.log(`Client details: Origin=${origin}, UA=${userAgent}`);
    console.log(`Active WebSocket connections: ${wss.clients.size}`);
    
    // Add ping/pong for connection keepalive
    extSocket.isAlive = true;
    extSocket.on('pong', () => {
      extSocket.isAlive = true;
    });
    
    // Handle incoming messages
    extSocket.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log(`Received message from client [${clientId}]:`, data);
        
        // Special handling for video status messages
        if (data.type === 'video-status' && data.data?.url) {
          // This prevents unnecessary broadcast of video error states
          if (data.data.status === 'error') {
            console.log(`Client [${clientId}] reported video error for ${data.data.url} - not broadcasting`);
            return;
          }

          // Extended logging for video playback events
          console.log(`Client [${clientId}] video ${data.data.status} at ${data.data.timestamp} for ${data.data.url}`);
        }
        
        // Broadcast message to all connected clients
        broadcastWebSocketMessage('broadcast', data);
      } catch (err) {
        console.error(`Error processing WebSocket message from client [${clientId}]:`, err);
      }
    });
    
    // Handle errors
    extSocket.on('error', (error) => {
      console.error(`WebSocket error from client [${clientId}]:`, error);
    });
    
    // Handle disconnection
    extSocket.on('close', (code, reason) => {
      console.log(`WebSocket client [${clientId}] disconnected. Code: ${code}, Reason: ${reason || 'No reason provided'}`);
      // The clients.size is automatically updated after the close event is handled
      // so we need to log the current size, not size-1
      console.log(`Remaining WebSocket connections: ${wss.clients.size}`);
    });
    
    // Send initial connection confirmation
    try {
      extSocket.send(JSON.stringify({
        type: 'connection',
        status: 'connected',
        clientId: clientId,
        message: 'Successfully connected to Barefoot Bay WebSocket server',
        time: new Date().toISOString()
      }));
    } catch (error) {
      console.error(`Failed to send welcome message to client [${clientId}]:`, error);
    }
  });
  
  // Set up a heartbeat interval to detect dead connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((socket: WebSocket) => {
      const extSocket = socket as ExtendedWebSocket;
      
      if (extSocket.isAlive === false) {
        console.log('Terminating inactive WebSocket connection');
        return extSocket.terminate();
      }
      
      extSocket.isAlive = false;
      extSocket.ping();
    });
  }, 30000); // Check every 30 seconds
  
  // Clean up interval on server close
  wss.on('close', () => {
    clearInterval(heartbeatInterval);
    console.log('WebSocket server closed, heartbeat interval cleared');
  });
  */
  
  // Forms API endpoints
  // Get all forms for form insertion dialog
  app.get("/api/forms", requireAuth, async (req, res) => {
    try {
      console.log('📋 Fetching forms for user:', req.user?.id);
      const forms = await storage.getForms();
      
      // Filter out deleted forms and only return necessary fields for the dialog
      const activeForms = forms
        .filter(form => !form.isDeleted)
        .map(form => ({
          id: form.id,
          title: form.title,
          description: form.description,
          fields: form.fields,
          createdAt: form.createdAt,
          updatedAt: form.updatedAt,
          isActive: form.isActive
        }));
      
      console.log(`📋 Returning ${activeForms.length} active forms`);
      res.json(activeForms);
    } catch (error) {
      console.error('📋 Error fetching forms:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch forms',
        error: error.message 
      });
    }
  });

  // Create new form
  app.post("/api/forms", requireAuth, async (req, res) => {
    try {
      console.log('📋 Creating new form for user:', req.user?.id);
      const { title, description, fields } = req.body;
      
      if (!title || !fields || !Array.isArray(fields)) {
        return res.status(400).json({
          success: false,
          message: 'Title and fields array are required'
        });
      }
      
      const newForm = await storage.createForm({
        title,
        description: description || '',
        fields,
        createdBy: req.user.id,
        isActive: true,
        isDeleted: false
      });
      
      console.log('📋 Form created successfully:', newForm.id);
      res.json({
        success: true,
        form: newForm
      });
    } catch (error) {
      console.error('📋 Error creating form:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create form',
        error: error.message
      });
    }
  });

  // Update existing form
  app.put("/api/forms/:id", requireAuth, async (req, res) => {
    try {
      const formId = parseInt(req.params.id);
      console.log('📋 Updating form:', formId, 'for user:', req.user?.id);
      
      const { title, description, fields, isActive } = req.body;
      
      const updatedForm = await storage.updateForm(formId, {
        title,
        description,
        fields,
        isActive,
        updatedAt: new Date()
      });
      
      if (!updatedForm) {
        return res.status(404).json({
          success: false,
          message: 'Form not found'
        });
      }
      
      console.log('📋 Form updated successfully:', formId);
      res.json({
        success: true,
        form: updatedForm
      });
    } catch (error) {
      console.error('📋 Error updating form:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update form',
        error: error.message
      });
    }
  });

  // Delete form (soft delete)
  app.delete("/api/forms/:id", requireAuth, async (req, res) => {
    try {
      const formId = parseInt(req.params.id);
      console.log('📋 Soft deleting form:', formId, 'for user:', req.user?.id);
      
      const updatedForm = await storage.updateForm(formId, {
        isDeleted: true,
        updatedAt: new Date()
      });
      
      if (!updatedForm) {
        return res.status(404).json({
          success: false,
          message: 'Form not found'
        });
      }
      
      console.log('📋 Form soft deleted successfully:', formId);
      res.json({
        success: true,
        message: 'Form deleted successfully'
      });
    } catch (error) {
      console.error('📋 Error deleting form:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete form',
        error: error.message
      });
    }
  });

  // Add Square service test endpoint
  app.get("/api/test/square-init", async (req, res) => {
    console.log("🔧 SQUARE TEST ENDPOINT: Starting Square service test");
    try {
      console.log("🔧 SQUARE TEST: Attempting dynamic import of square-service");
      const squareModule = await import('./square-service');
      console.log("🔧 SQUARE TEST: Square service module loaded successfully");
      
      console.log("🔧 SQUARE TEST: Calling reinitializeSquareClient");
      await squareModule.reinitializeSquareClient();
      console.log("🔧 SQUARE TEST: Square client initialization completed");
      
      res.json({
        success: true,
        message: "Square service test completed successfully",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("🔧 SQUARE TEST ERROR:", error);
      res.status(500).json({
        success: false,
        error: error.message,
        stack: error.stack
      });
    }
  });

  // Test SendGrid email sending
  app.post("/api/test/sendgrid", requireAuth, async (req, res) => {
    console.log("📧 SENDGRID TEST: Starting email test for user:", req.user.id);
    try {
      const { sendEmail, FROM_EMAIL } = await import('./sendgrid-service');
      
      console.log("📧 SENDGRID TEST: Attempting to send test email to:", req.user.email);
      const result = await sendEmail({
        to: req.user.email,
        from: FROM_EMAIL,
        subject: 'SendGrid Test Email',
        text: 'This is a test email to verify SendGrid configuration.',
        html: '<p>This is a test email to verify SendGrid configuration.</p>'
      });
      
      console.log("📧 SENDGRID TEST: Email send result:", result);
      
      res.json({
        success: result,
        message: result ? "Test email sent successfully!" : "Failed to send test email - check server logs for details",
        recipient: req.user.email,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("📧 SENDGRID TEST ERROR:", {
        message: error.message,
        code: error.code,
        response: error.response?.body || error.response || "No response body"
      });
      res.status(500).json({
        success: false,
        error: error.message,
        code: error.code,
        details: error.response?.body || "No detailed error available"
      });
    }
  });

  // WebSocket is already configured earlier in the code
  console.log('WebSocket server configuration already includes chat support');
  
  return httpServer;
}
