import { storage } from './storage';
import { renewSubscription } from './subscription-service';

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
            isApproved: false,
            updatedAt: new Date()
          });
          
          expiredCount++;
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
            isApproved: false,
            updatedAt: new Date()
          });
          
          expiredCount++;
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