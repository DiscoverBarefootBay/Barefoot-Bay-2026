/**
 * Utility functions for subscription management
 */

export interface SubscriptionInfo {
  daysRemaining: number;
  isExpired: boolean;
  isExpiringSoon: boolean; // Less than 7 days
  subscriptionType: 'monthly' | 'annual' | null;
  subscriptionStatus: 'active' | 'cancelled' | 'past_due' | 'expired' | null;
}

/**
 * Calculate subscription days remaining and status
 */
export function calculateSubscriptionInfo(
  subscriptionEndDate: string | Date | null,
  subscriptionType?: string | null,
  subscriptionStatus?: string | null
): SubscriptionInfo {
  if (!subscriptionEndDate) {
    return {
      daysRemaining: 0,
      isExpired: true,
      isExpiringSoon: false,
      subscriptionType: null,
      subscriptionStatus: null,
    };
  }

  const endDate = new Date(subscriptionEndDate);
  const currentDate = new Date();
  
  // Calculate the difference in milliseconds
  const timeDifference = endDate.getTime() - currentDate.getTime();
  
  // Convert to days (round down)
  const daysRemaining = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
  
  const isExpired = daysRemaining <= 0;
  const isExpiringSoon = daysRemaining <= 7 && daysRemaining > 0;

  return {
    daysRemaining: Math.max(0, daysRemaining),
    isExpired,
    isExpiringSoon,
    subscriptionType: subscriptionType as 'monthly' | 'annual' | null,
    subscriptionStatus: subscriptionStatus as 'active' | 'cancelled' | 'past_due' | 'expired' | null,
  };
}

/**
 * Get badge variant based on subscription status
 */
export function getSubscriptionBadgeVariant(subscriptionInfo: SubscriptionInfo): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (subscriptionInfo.isExpired) {
    return 'destructive';
  }
  if (subscriptionInfo.isExpiringSoon) {
    return 'outline';
  }
  return 'secondary';
}

/**
 * Get badge text for subscription status
 */
export function getSubscriptionBadgeText(subscriptionInfo: SubscriptionInfo): string {
  if (subscriptionInfo.isExpired) {
    return 'Expired';
  }
  if (subscriptionInfo.daysRemaining === 1) {
    return '1 day left';
  }
  return `${subscriptionInfo.daysRemaining} days left`;
}