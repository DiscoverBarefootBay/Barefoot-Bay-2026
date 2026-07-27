import { storage } from './storage';
import { renewSubscription } from './subscription-service';
import { logger } from './lib/logger';
import {
  dedupeRecipientsByEmail,
  sendListingExpiredAdminEmail,
  sendListingExpiredSellerEmail,
} from './sendgrid-service';
import { loadForSaleEmailConfig, type ForSaleEmailConfig } from './forsale-email-config';
import type { User } from '@workspace/db';

/**
 * Resolve the set of admin email addresses that should receive listing-related
 * admin notifications. Mirrors the calendar admin-eligibility rules: role=admin,
 * has an email, not blocked, and email notifications not disabled. Deduped by
 * mailbox so two admin accounts sharing an inbox only get one copy.
 */
export async function resolveAdminRecipientEmails(): Promise<string[]> {
  const allUsers = await storage.getUsers();
  const admins = allUsers.filter(
    (u) => u.email && !u.isBlocked && u.role === 'admin' && u.emailNotificationsEnabled !== false,
  );
  return dedupeRecipientsByEmail(admins).map((u) => u.email);
}

/**
 * Resolve the seller mailboxes for the "your listing expired" reminder while
 * honoring the global unsubscribe flag: when the owning account has flipped
 * email_notifications_enabled to false, NO seller reminder is sent at all —
 * including to the listing's contact email, which belongs to the same seller.
 * Otherwise, the contact email and account email are deduped so a seller with
 * both on the same mailbox only gets one copy.
 */
export function resolveSellerReminderEmails(
  contactEmail: string | null | undefined,
  account: Pick<User, 'email' | 'emailNotificationsEnabled'> | undefined,
): string[] {
  if (account && account.emailNotificationsEnabled === false) {
    return [];
  }
  return dedupeRecipientsByEmail([
    { email: contactEmail ?? null },
    { email: account?.email ?? null },
  ])
    .map((r) => r.email?.trim())
    .filter((e): e is string => !!e && e.includes('@'));
}

/**
 * Send the admin "listing expired" alert and the seller "your listing expired"
 * reminder for a single listing that has just transitioned to EXPIRED.
 *
 * NOTE: `listing` here is a raw row from `getExpiredListings` (a `SELECT *`),
 * so its columns are snake_case (contact_info, created_by, listing_type), not
 * the camelCase the RealEstateListing type claims. We read both forms defensively.
 *
 * Every send is wrapped in try/catch so an email failure never blocks marking
 * the listing expired or processing the remaining listings.
 */
async function sendListingExpirationEmails(
  listing: any,
  adminEmails: string[],
  config?: ForSaleEmailConfig,
): Promise<void> {
  const listingId: number = listing.id;
  const listingTitle: string = listing.title || 'Listing';
  const address: string | null = listing.address ?? null;
  const listingType: string | null = listing.listing_type ?? listing.listingType ?? null;
  const contact = (listing.contact_info ?? listing.contactInfo ?? {}) as {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  const createdBy: number | null = listing.created_by ?? listing.createdBy ?? null;

  let account: User | undefined;
  if (createdBy) {
    try {
      account = await storage.getUser(createdBy);
    } catch (err) {
      logger.warn({ err, listingId, createdBy }, '[ListingExpiration] Failed to load seller account');
    }
  }

  const sellerName = contact.name?.trim() || account?.fullName || account?.username || null;
  const sellerPhone = contact.phone?.trim() || account?.phoneNumber || null;
  const sellerPrimaryEmail = contact.email?.trim() || account?.email || null;

  // Admin alert (one per admin mailbox).
  for (const adminEmail of adminEmails) {
    try {
      await sendListingExpiredAdminEmail(
        adminEmail,
        { id: listingId, title: listingTitle, address, listingType },
        { name: sellerName, email: sellerPrimaryEmail, phone: sellerPhone },
        { config },
      );
    } catch (err) {
      logger.error({ err, listingId, adminEmail }, '[ListingExpiration] Failed to send admin expiration email');
    }
  }

  // Seller reminder — honors the seller's unsubscribe flag and dedupes the
  // listing contact email against the owning account email so a seller isn't
  // emailed twice for the same expiration.
  const sellerEmails = resolveSellerReminderEmails(contact.email, account);
  if (sellerEmails.length === 0 && account && account.emailNotificationsEnabled === false) {
    logger.info({ listingId, createdBy }, '[ListingExpiration] Seller unsubscribed from email notifications; skipping seller reminder');
  }

  for (const sellerEmail of sellerEmails) {
    try {
      await sendListingExpiredSellerEmail(
        sellerEmail,
        sellerName,
        {
          id: listingId,
          title: listingTitle,
          listingType,
        },
        { config },
      );
    } catch (err) {
      logger.error({ err, listingId, sellerEmail }, '[ListingExpiration] Failed to send seller expiration email');
    }
  }
}

/**
 * Check for expired listings and take appropriate actions
 * - For subscriptions, schedule next renewal if payment successful
 * - For non-subscription listings, automatically delete them after 30 days
 * 
 * Note: This function is safe to call even if the database schema
 * doesn't have the necessary columns yet. It will gracefully handle that case.
 */
export async function checkExpiredListings(referenceDate?: Date) {
  console.log('Checking for expired listings...');
  
  try {
    // If a reference date is provided, use it for testing purposes
    // Otherwise use the current date for production
    const now = referenceDate || new Date();
    
    // Get listings that are expired as of the reference date
    // This will return an empty array if the expiration_date column doesn't exist yet
    const expiredListings = await storage.getExpiredListings(now);
    console.log(`Found ${expiredListings.length} expired listings`);
    
    // If we don't have any expired listings, just return early
    if (expiredListings.length === 0) {
      return {
        checked: 0,
        renewed: 0,
        expired: 0,
        deleted: 0
      };
    }
    
    let renewedCount = 0;
    let expiredCount = 0;
    let deletedCount = 0;

    // Resolve admin recipients once per run (rather than per listing). Failure
    // here must not block marking listings expired, so fall back to no admins.
    let adminEmails: string[] = [];
    try {
      adminEmails = await resolveAdminRecipientEmails();
    } catch (err) {
      logger.error({ err }, '[ListingExpiration] Failed to resolve admin recipients');
    }

    // Load the admin-editable email config once per run so each send doesn't hit
    // the DB. loadForSaleEmailConfig falls back to defaults on any error.
    const emailConfig = await loadForSaleEmailConfig();

    // Process each expired listing
    for (const listing of expiredListings) {
      // Check if the listing has subscription properties
      // These might be undefined if the columns don't exist in the database yet
      if (listing.isSubscription && listing.subscriptionId) {
        // This is a subscription-based listing that has reached its expiration date
        // Renew the subscription via the payment processor
        console.log(`Attempting to renew subscription for listing ${listing.id} (${listing.title})`);
        
        try {
          // Process the subscription renewal
          const result = await renewSubscription(listing.subscriptionId);
          console.log(`Renewed subscription for listing ${listing.id}, new expiration: ${result.expirationDate}`);
          renewedCount++;
          
        } catch (error) {
          console.error(`Failed to renew subscription for listing ${listing.id}:`, error);
          
          // If renewal fails (e.g., payment failed), mark the listing as expired
          await storage.updateListing(listing.id, {
            status: 'EXPIRED',
            updatedAt: new Date()
          });
          
          expiredCount++;

          // Notify admins + the seller. Sending here (only on the ACTIVE -> EXPIRED
          // transition) fires exactly once per listing, since getExpiredListings
          // only returns still-ACTIVE rows past their expiration date.
          try {
            await sendListingExpirationEmails(listing, adminEmails, emailConfig);
          } catch (err) {
            logger.error({ err, listingId: listing.id }, '[ListingExpiration] Expiration emails failed');
          }
        }
      } else {
        // This is a standard listing (non-subscription) that has expired
        
        // Check if it's been more than 30 days since expiration
        // Default to null if expirationDate is undefined (column doesn't exist yet)
        const expirationDate = listing.expirationDate ? new Date(listing.expirationDate) : null;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        if (expirationDate && expirationDate < thirtyDaysAgo) {
          // Listing expired more than 30 days ago, delete it
          console.log(`Deleting listing ${listing.id} (${listing.title}) - expired over 30 days ago`);
          
          try {
            await storage.deleteListing(listing.id);
            deletedCount++;
          } catch (deleteError) {
            console.error(`Error deleting expired listing ${listing.id}:`, deleteError);
          }
        } else {
          // Mark it as expired and no longer approved
          console.log(`Marking listing ${listing.id} (${listing.title}) as expired`);
          
          await storage.updateListing(listing.id, {
            status: 'EXPIRED',
            updatedAt: new Date()
          });
          
          expiredCount++;

          // Notify admins + the seller. Sending here (only on the ACTIVE -> EXPIRED
          // transition) fires exactly once per listing, since getExpiredListings
          // only returns still-ACTIVE rows past their expiration date.
          try {
            await sendListingExpirationEmails(listing, adminEmails, emailConfig);
          } catch (err) {
            logger.error({ err, listingId: listing.id }, '[ListingExpiration] Expiration emails failed');
          }
        }
      }
    }
    
    return {
      checked: expiredListings.length,
      renewed: renewedCount,
      expired: expiredCount,
      deleted: deletedCount
    };
  } catch (error) {
    console.error('Error checking expired listings:', error);
    // Return a valid result even if there's an error
    return {
      checked: 0,
      renewed: 0,
      expired: 0,
      deleted: 0,
      error: String(error)
    };
  }
}

/**
 * Check for listings that will expire soon and send notifications
 * 
 * Note: This function is safe to call even if the database schema
 * doesn't have the necessary columns yet. It will gracefully handle that case.
 * 
 * @param daysUntilExpiration Number of days until expiration to check for
 */
export async function checkExpiringListings(daysUntilExpiration: number) {
  console.log(`Checking for listings expiring in ${daysUntilExpiration} days...`);
  
  try {
    // Get listings expiring in the specified number of days
    // This will return an empty array if the expiration_date column doesn't exist yet
    const expiringListings = await storage.getExpiringListings(daysUntilExpiration);
    console.log(`Found ${expiringListings.length} listings expiring in ${daysUntilExpiration} days`);
    
    // If we don't have any expiring listings, just return early
    if (expiringListings.length === 0) {
      return {
        count: 0,
        listings: []
      };
    }
    
    // If this were a production system, we would send email notifications here
    // For now, just log the information
    
    for (const listing of expiringListings) {
      // Check if expirationDate exists before trying to use it
      if (listing.expirationDate) {
        const expirationDate = new Date(listing.expirationDate);
        console.log(`Listing ${listing.id} (${listing.title}) will expire on ${expirationDate.toLocaleDateString()}`);
        
        // TODO: Send notification to the owner via email
        // This would involve getting the user details and sending an email
      } else {
        console.log(`Listing ${listing.id} (${listing.title}) doesn't have an expiration date set`);
      }
    }
    
    return {
      count: expiringListings.length,
      listings: expiringListings.map(l => ({
        id: l.id,
        title: l.title,
        expirationDate: l.expirationDate || null
      }))
    };
  } catch (error) {
    console.error(`Error checking listings expiring in ${daysUntilExpiration} days:`, error);
    // Return a valid result even if there's an error
    return {
      count: 0,
      listings: [],
      error: String(error)
    };
  }
}