import { storage } from './storage';

/**
 * Handle subscription creation with Square API
 * @param listingId The ID of the listing to create a subscription for
 * @param userId The ID of the user creating the subscription
 * @param planType The type of subscription plan (MONTHLY, QUARTERLY)
 * @returns The created subscription details
 */
export async function createSubscription(listingId: number, userId: number, planType: string) {
  console.log(`Creating ${planType} subscription for listing ${listingId} by user ${userId}`);
  
  try {
    // Verify the listing exists and belongs to the user
    const listing = await storage.getListing(listingId);
    if (!listing) {
      throw new Error("Listing not found");
    }
    
    if (listing.createdBy !== userId) {
      throw new Error("You don't own this listing");
    }
    
    // Calculate amount based on plan type
    const amount = planType === 'MONTHLY' ? 4500 : 12000; // $45 monthly or $120 quarterly
    
    // TODO: In a real implementation, integrate with Square API to create a subscription plan
    // For now, we'll just generate a fake subscription ID and update the listing
    
    const subscriptionId = `sub_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // Calculate expiration date based on subscription plan
    const expirationDate = new Date();
    if (planType === 'MONTHLY') {
      expirationDate.setMonth(expirationDate.getMonth() + 1);
    } else if (planType === 'QUARTERLY') {
      expirationDate.setMonth(expirationDate.getMonth() + 3);
    }
    
    // Update the listing with subscription details
    const updatedListing = await storage.updateListing(listingId, {
      isSubscription: true,
      subscriptionId,
      expirationDate,
      isApproved: true, // Ensure listing is active
      updatedAt: new Date()
    });
    
    // Create a payment record for this subscription
    await storage.createListingPayment({
      userId,
      amount,
      currency: "USD",
      status: "completed",
      paymentMethod: "square", // or whatever method is used
      listingId,
      subscriptionId,
      subscriptionPlan: planType,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    return {
      listing: updatedListing,
      subscriptionId,
      planType,
      expirationDate,
      amount,
      success: true
    };
  } catch (error) {
    console.error("Error creating subscription:", error);
    throw error;
  }
}

/**
 * Cancel a subscription with Square API
 * @param subscriptionId The ID of the subscription to cancel
 * @param userId The ID of the user cancelling the subscription
 * @returns The result of the cancellation
 */
export async function cancelSubscription(subscriptionId: string, userId: number) {
  console.log(`Cancelling subscription ${subscriptionId} for user ${userId}`);
  
  try {
    // Verify the subscription exists and belongs to the user
    const listings = await storage.getListingsBySubscriptionId(subscriptionId);
    if (!listings || listings.length === 0) {
      throw new Error("Subscription not found");
    }
    
    const listing = listings[0];
    if (listing.createdBy !== userId) {
      throw new Error("You don't own this subscription");
    }
    
    // TODO: In a real implementation, integrate with Square API to cancel the subscription
    // For now, we'll just update the listing
    
    // Update the listing to remove subscription flags but keep it active until expiration date
    const updatedListing = await storage.updateListing(listing.id, {
      isSubscription: false,
      subscriptionId: null,
      updatedAt: new Date()
    });
    
    return {
      listing: updatedListing,
      success: true,
      message: "Subscription cancelled successfully"
    };
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    throw error;
  }
}

/**
 * Renew a subscription with Square API
 * @param subscriptionId The ID of the subscription to renew
 * @returns The result of the renewal
 */
export async function renewSubscription(subscriptionId: string) {
  console.log(`Renewing subscription ${subscriptionId}`);
  
  try {
    // Verify the subscription exists
    const listings = await storage.getListingsBySubscriptionId(subscriptionId);
    if (!listings || listings.length === 0) {
      throw new Error("Subscription not found");
    }
    
    const listing = listings[0];
    
    // Get existing payments to determine plan type
    const payments = await storage.getListingPaymentsBySubscription(subscriptionId);
    const latestPayment = payments.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
    
    if (!latestPayment?.subscriptionPlan) {
      throw new Error("Could not determine subscription plan");
    }
    
    // Calculate new expiration date based on plan type
    const newExpirationDate = new Date(listing.expirationDate);
    if (latestPayment.subscriptionPlan === 'MONTHLY') {
      newExpirationDate.setMonth(newExpirationDate.getMonth() + 1);
    } else if (latestPayment.subscriptionPlan === 'QUARTERLY') {
      newExpirationDate.setMonth(newExpirationDate.getMonth() + 3);
    }
    
    // Calculate amount based on plan type
    const amount = latestPayment.subscriptionPlan === 'MONTHLY' ? 4500 : 12000;
    
    // TODO: In a real implementation, process payment through Square API
    // For now, just update the listing
    
    // Update the listing with new expiration date
    const updatedListing = await storage.updateListing(listing.id, {
      expirationDate: newExpirationDate,
      updatedAt: new Date()
    });
    
    // Create a payment record for this renewal
    await storage.createListingPayment({
      userId: listing.createdBy,
      amount,
      currency: "USD",
      status: "completed",
      paymentMethod: "square",
      listingId: listing.id,
      subscriptionId,
      subscriptionPlan: latestPayment.subscriptionPlan,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    return {
      listing: updatedListing,
      subscriptionId,
      planType: latestPayment.subscriptionPlan,
      expirationDate: newExpirationDate,
      amount,
      success: true
    };
  } catch (error) {
    console.error("Error renewing subscription:", error);
    throw error;
  }
}

/**
 * Retrieve subscription details from Square API
 * @param subscriptionId The ID of the subscription to retrieve
 * @returns The subscription details
 */
export async function getSubscription(subscriptionId: string) {
  console.log(`Getting subscription ${subscriptionId}`);
  
  try {
    // Look for users with this subscription ID instead of listings
    const users = await storage.getUsersBySubscriptionId(subscriptionId);
    if (!users || users.length === 0) {
      console.log(`No users found with subscription ID ${subscriptionId}`);
      throw new Error("Subscription not found");
    }
    
    const user = users[0];
    
    // The subscription details are stored directly on the user object
    const subscriptionDetails = {
      id: subscriptionId,
      status: user.subscriptionStatus || "unknown",
      planType: user.subscriptionType || "unknown",
      startDate: user.subscriptionStartDate || new Date(),
      nextBillingDate: user.subscriptionEndDate || new Date(),
      user: {
        id: user.id,
        email: user.email,
        username: user.username
      },
      success: true
    };
    
    return subscriptionDetails;
  } catch (error) {
    console.error("Error getting subscription:", error);
    throw error;
  }
}

/**
 * Verify the status of a subscription payment with Square API
 * @param paymentLinkId The payment link ID or intent ID from Square
 * @returns The verification result with completed status and associated listing ID
 */
export async function verifySubscriptionPayment(paymentLinkId: string) {
  console.log(`Verifying subscription payment status for payment link ID: ${paymentLinkId}`);
  
  try {
    // First check if we have a payment record for this intent ID
    const payment = await storage.getListingPaymentByIntent(paymentLinkId);
    
    if (!payment) {
      console.error(`No payment record found for payment link ID: ${paymentLinkId}`);
      throw new Error('Payment record not found for this payment link ID');
    }
    
    // If the payment is already marked as completed, return success
    if (payment.status === 'completed') {
      // Get the listing associated with this payment
      const listing = payment.listingId ? await storage.getListing(payment.listingId) : null;
      
      return {
        isCompleted: true,
        listingId: payment.listingId,
        subscriptionId: payment.subscriptionId,
        message: 'Payment already verified and completed'
      };
    }
    
    // Import the Square service to verify via Square API
    const { verifyPaymentStatus } = await import('./square-service');
    
    // Use the same verification logic as one-time payments
    const squareResult = await verifyPaymentStatus(paymentLinkId);
    
    if (squareResult.isCompleted) {
      // Payment is verified with Square, now update the subscription details
      
      // If this payment has a listing ID, get the listing
      const listing = payment.listingId ? await storage.getListing(payment.listingId) : null;
      
      if (listing && payment.subscriptionId) {
        // Calculate new expiration date based on plan type
        const expirationDate = new Date();
        if (payment.subscriptionPlan === 'MONTHLY') {
          expirationDate.setMonth(expirationDate.getMonth() + 1);
        } else if (payment.subscriptionPlan === 'QUARTERLY') {
          expirationDate.setMonth(expirationDate.getMonth() + 3);
        }
        
        // Update the listing with subscription details
        await storage.updateListing(listing.id, {
          isSubscription: true,
          subscriptionId: payment.subscriptionId,
          expirationDate,
          isApproved: true, // Ensure listing is active
          updatedAt: new Date()
        });
      }
      
      // Update payment status to completed
      await storage.updateListingPayment(payment.id, {
        status: 'completed',
        updatedAt: new Date()
      });
      
      return {
        isCompleted: true,
        listingId: payment.listingId,
        subscriptionId: payment.subscriptionId,
        message: 'Payment verified and completed successfully'
      };
    }
    
    // Payment is still pending with Square
    return {
      isCompleted: false,
      listingId: payment.listingId,
      subscriptionId: payment.subscriptionId,
      message: 'Payment verification is still pending'
    };
  } catch (error) {
    console.error('Error verifying subscription payment:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
  }
}