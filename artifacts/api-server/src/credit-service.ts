/**
 * Credit Management Service for Square Payment Integration
 * 
 * This service manages user credits, payment verification, and Square payment processing
 * with proper credit allocation when payments are successful.
 */

import { db } from './db';
import { userCredits, creditTransactions, squarePayments } from '@workspace/db';
import { eq, sql } from 'drizzle-orm';

export interface CreditTransaction {
  id?: number;
  userId: number;
  transactionType: 'purchase' | 'use' | 'refund';
  credits: number;
  description?: string;
  squarePaymentId?: string;
  orderId?: string;
  checkoutId?: string;
  amount?: string;
  currency?: string;
  paymentStatus?: 'pending' | 'completed' | 'failed';
}

export interface SquarePayment {
  id?: number;
  userId: number;
  squarePaymentId: string;
  orderId?: string;
  checkoutId?: string;
  amount: string;
  currency?: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  listingType?: string;
  listingDuration?: string;
  creditsAwarded?: number;
  webhookData?: any;
}

export class CreditService {
  /**
   * Get user's current credit balance
   */
  async getUserCredits(userId: number): Promise<number> {
    try {
      const result = await db
        .select({ credits: userCredits.credits })
        .from(userCredits)
        .where(eq(userCredits.userId, userId))
        .limit(1);

      return result.length > 0 ? result[0].credits : 0;
    } catch (error) {
      console.error('Error fetching user credits:', error);
      return 0;
    }
  }

  /**
   * Initialize user credits record if it doesn't exist
   */
  async initializeUserCredits(userId: number): Promise<void> {
    try {
      const existing = await db
        .select()
        .from(userCredits)
        .where(eq(userCredits.userId, userId))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(userCredits).values({
          userId,
          credits: 0
        });
      }
    } catch (error) {
      console.error('Error initializing user credits:', error);
    }
  }

  /**
   * Add credits to user account (when payment is successful)
   */
  async addCredits(userId: number, credits: number, description: string, paymentData?: Partial<CreditTransaction>): Promise<boolean> {
    try {
      // Initialize credits if not exists
      await this.initializeUserCredits(userId);

      // Start transaction
      await db.transaction(async (tx) => {
        // Update user credits
        await tx
          .update(userCredits)
          .set({
            credits: sql`${userCredits.credits} + ${credits}`,
            updatedAt: new Date()
          })
          .where(eq(userCredits.userId, userId));

        // Record transaction
        await tx.insert(creditTransactions).values({
          userId,
          transactionType: 'purchase',
          credits,
          description,
          squarePaymentId: paymentData?.squarePaymentId,
          orderId: paymentData?.orderId,
          checkoutId: paymentData?.checkoutId,
          amount: paymentData?.amount,
          currency: paymentData?.currency || 'USD',
          paymentStatus: 'completed'
        });
      });

      console.log(`Successfully added ${credits} credits to user ${userId}`);
      return true;
    } catch (error) {
      console.error('Error adding credits:', error);
      return false;
    }
  }

  /**
   * Use credits (when publishing a listing)
   */
  async useCredits(userId: number, credits: number, description: string): Promise<boolean> {
    try {
      const currentCredits = await this.getUserCredits(userId);
      
      if (currentCredits < credits) {
        console.log(`User ${userId} has insufficient credits: ${currentCredits} < ${credits}`);
        return false;
      }

      // Start transaction
      await db.transaction(async (tx) => {
        // Update user credits
        await tx
          .update(userCredits)
          .set({
            credits: sql`${userCredits.credits} - ${credits}`,
            updatedAt: new Date()
          })
          .where(eq(userCredits.userId, userId));

        // Record transaction
        await tx.insert(creditTransactions).values({
          userId,
          transactionType: 'use',
          credits: -credits, // Negative for usage
          description,
          paymentStatus: 'completed'
        });
      });

      console.log(`Successfully used ${credits} credits for user ${userId}`);
      return true;
    } catch (error) {
      console.error('Error using credits:', error);
      return false;
    }
  }

  /**
   * Record Square payment and award credits when payment is successful
   */
  async processSquarePayment(paymentData: SquarePayment): Promise<boolean> {
    try {
      // Check if payment already exists
      const existing = await db
        .select()
        .from(squarePayments)
        .where(eq(squarePayments.squarePaymentId, paymentData.squarePaymentId))
        .limit(1);

      if (existing.length > 0) {
        console.log(`Payment ${paymentData.squarePaymentId} already processed`);
        return true;
      }

      // Calculate credits based on actual payment amount
      const creditsToAward = this.calculateCreditsFromAmount(paymentData.amount);

      // Record payment
      const insertResult = await db.insert(squarePayments).values({
        ...paymentData,
        creditsAwarded: creditsToAward
      }).returning();

      console.log('Square payment recorded:', insertResult[0]);

      // If payment is completed, award credits
      if (paymentData.status === 'completed' && creditsToAward > 0) {
        const success = await this.addCredits(
          paymentData.userId,
          creditsToAward,
          `Credits for ${paymentData.listingType} listing (${paymentData.listingDuration})`,
          {
            squarePaymentId: paymentData.squarePaymentId,
            orderId: paymentData.orderId,
            checkoutId: paymentData.checkoutId,
            amount: paymentData.amount,
            currency: paymentData.currency
          }
        );

        if (success) {
          console.log(`Awarded ${creditsToAward} credits to user ${paymentData.userId} for payment ${paymentData.squarePaymentId}`);
        }
      }

      return true;
    } catch (error) {
      console.error('Error processing Square payment:', error);
      return false;
    }
  }

  /**
   * Calculate credits based on actual payment amount
   * Credits are awarded at a rate of 1 credit per $5 of verified payment
   */
  private calculateCreditsFromAmount(paymentAmount: string): number {
    try {
      const amount = parseFloat(paymentAmount);
      if (isNaN(amount) || amount <= 0) {
        return 0;
      }
      
      // Award 1 credit per $5 of payment (so $50 payment = 10 credits)
      const credits = Math.floor(amount / 5);
      console.log(`Calculating credits: $${amount} payment = ${credits} credits`);
      return credits;
    } catch (error) {
      console.error('Error calculating credits from amount:', error);
      return 0;
    }
  }

  /**
   * Calculate credits based on listing type and duration (legacy method)
   */
  private calculateCreditsForPayment(listingType?: string, listingDuration?: string): number {
    // Legacy fallback: 1 credit per listing
    // This should be replaced by calculateCreditsFromAmount when payment amount is available
    return 1;
  }

  /**
   * Verify Square payment status and update if completed
   */
  async verifySquarePayment(paymentId: string, checkoutId?: string, orderId?: string): Promise<{ success: boolean; payment?: any; credits?: number }> {
    try {
      console.log(`Verifying Square payment: ${paymentId}, checkout: ${checkoutId}, order: ${orderId}`);

      // Look for payment in our database first
      let payment = await db
        .select()
        .from(squarePayments)
        .where(eq(squarePayments.squarePaymentId, paymentId))
        .limit(1);

      // Also try searching by checkout ID or order ID
      if (payment.length === 0 && checkoutId) {
        payment = await db
          .select()
          .from(squarePayments)
          .where(eq(squarePayments.checkoutId, checkoutId))
          .limit(1);
      }

      if (payment.length === 0 && orderId) {
        payment = await db
          .select()
          .from(squarePayments)
          .where(eq(squarePayments.orderId, orderId))
          .limit(1);
      }

      if (payment.length > 0) {
        const existingPayment = payment[0];
        console.log('Found existing payment:', existingPayment);

        // Get user's current credits
        const currentCredits = await this.getUserCredits(existingPayment.userId);

        return {
          success: true,
          payment: existingPayment,
          credits: currentCredits
        };
      }

      // If payment not found in our database, it might be a new payment
      // In a real implementation, you would call Square API here to verify the payment
      console.log('Payment not found in database, this might be a new payment or verification issue');
      
      return {
        success: false,
        payment: null,
        credits: 0
      };
    } catch (error) {
      console.error('Error verifying Square payment:', error);
      return {
        success: false,
        payment: null,
        credits: 0
      };
    }
  }

  /**
   * Get user's credit transaction history
   */
  async getCreditHistory(userId: number): Promise<CreditTransaction[]> {
    try {
      const transactions = await db
        .select()
        .from(creditTransactions)
        .where(eq(creditTransactions.userId, userId))
        .orderBy(sql`${creditTransactions.createdAt} DESC`)
        .limit(50);

      return transactions;
    } catch (error) {
      console.error('Error fetching credit history:', error);
      return [];
    }
  }

  /**
   * Check if user has enough credits to publish a listing
   */
  async canPublishListing(userId: number, creditsRequired: number = 1): Promise<boolean> {
    const currentCredits = await this.getUserCredits(userId);
    return currentCredits >= creditsRequired;
  }
}

export const creditService = new CreditService();