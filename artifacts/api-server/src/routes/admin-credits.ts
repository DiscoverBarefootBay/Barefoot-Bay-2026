import { Router } from 'express';
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../storage';
import { users, userCredits, creditTransactions } from '@workspace/db';
import { requireAuth, requireAdmin } from '../auth';

const router = Router();

// Get all users with their credit balances
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const usersWithCredits = await db
      .select({
        userId: users.id,
        username: users.username,
        fullName: users.fullName,
        email: users.email,
        avatarUrl: users.avatarUrl,
        credits: sql<number>`COALESCE(${userCredits.credits}, 0)`.as('credits')
      })
      .from(users)
      .leftJoin(userCredits, eq(users.id, userCredits.userId))
      .orderBy(users.fullName);

    res.json({
      success: true,
      users: usersWithCredits
    });
  } catch (error) {
    console.error('Error fetching users with credits:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user credits'
    });
  }
});

// Get credit transaction history
router.get('/transactions', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.query;
    
    let query = db
      .select({
        id: creditTransactions.id,
        userId: creditTransactions.userId,
        username: users.username,
        fullName: users.fullName,
        transactionType: creditTransactions.transactionType,
        credits: creditTransactions.credits,
        description: creditTransactions.description,
        amount: creditTransactions.amount,
        paymentStatus: creditTransactions.paymentStatus,
        createdAt: creditTransactions.createdAt
      })
      .from(creditTransactions)
      .innerJoin(users, eq(creditTransactions.userId, users.id))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(100);

    if (userId && !isNaN(parseInt(userId as string))) {
      query = query.where(eq(creditTransactions.userId, parseInt(userId as string)));
    }

    const transactions = await query;

    res.json({
      success: true,
      transactions
    });
  } catch (error) {
    console.error('Error fetching credit transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch credit transactions'
    });
  }
});

// Add credits manually to all users
router.post('/add-all', requireAdmin, async (req, res) => {
  try {
    const { credits, description } = req.body;
    const adminUserId = req.user?.id;

    if (!credits || credits <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Credits must be a positive number'
      });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Description is required'
      });
    }

    // Get all users
    const allUsers = await db
      .select({ 
        id: users.id, 
        username: users.username, 
        fullName: users.fullName 
      })
      .from(users);

    if (allUsers.length === 0) {
      return res.json({
        success: true,
        message: 'No users found to add credits to',
        usersUpdated: 0
      });
    }

    let usersUpdated = 0;
    const errors: string[] = [];

    // Process each user in a transaction
    for (const user of allUsers) {
      try {
        await db.transaction(async (tx) => {
          // Update or insert user credits
          const existingCredits = await tx
            .select({ credits: userCredits.credits })
            .from(userCredits)
            .where(eq(userCredits.userId, user.id))
            .limit(1);

          if (existingCredits.length > 0) {
            // Update existing credits
            await tx
              .update(userCredits)
              .set({ 
                credits: existingCredits[0].credits + credits,
                updatedAt: new Date()
              })
              .where(eq(userCredits.userId, user.id));
          } else {
            // Insert new credit record
            await tx.insert(userCredits).values({
              userId: user.id,
              credits: credits
            });
          }

          // Record transaction
          await tx.insert(creditTransactions).values({
            userId: user.id,
            transactionType: 'manual_add',
            credits: credits,
            description: `${description} (Bulk addition by admin)`,
            paymentStatus: 'completed'
          });
        });

        usersUpdated++;
      } catch (error) {
        console.error(`Error adding credits to user ${user.username}:`, error);
        errors.push(`Failed to add credits to ${user.username}`);
      }
    }

    console.log(`Admin ${adminUserId} added ${credits} credits to ${usersUpdated} users (bulk operation)`);

    res.json({
      success: true,
      message: `Successfully added ${credits} credits to ${usersUpdated} users`,
      usersUpdated,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error adding credits to all users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add credits to all users'
    });
  }
});

// Add credits manually to a user
router.post('/add', requireAdmin, async (req, res) => {
  try {
    const { userId, credits, description } = req.body;
    const adminUserId = req.user?.id;

    // Validate input
    if (!userId || !credits || credits <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID or credit amount'
      });
    }

    if (!description || description.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Description is required'
      });
    }

    // Verify user exists
    const targetUser = await db
      .select({ id: users.id, username: users.username, fullName: users.fullName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (targetUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await db.transaction(async (tx) => {
      // Initialize user credits if not exists
      const existingCredits = await tx
        .select()
        .from(userCredits)
        .where(eq(userCredits.userId, userId))
        .limit(1);

      if (existingCredits.length === 0) {
        await tx.insert(userCredits).values({
          userId,
          credits: 0
        });
      }

      // Add credits to user account
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
        transactionType: 'manual_add',
        credits: credits,
        description: `${description} (Added by admin)`,
        paymentStatus: 'completed'
      });
    });

    // Get updated user credit balance
    const updatedCredits = await db
      .select({ credits: userCredits.credits })
      .from(userCredits)
      .where(eq(userCredits.userId, userId))
      .limit(1);

    console.log(`Admin ${adminUserId} added ${credits} credits to user ${userId} (${targetUser[0].username})`);

    res.json({
      success: true,
      message: `Successfully added ${credits} credits to ${targetUser[0].fullName}`,
      newBalance: updatedCredits[0]?.credits || credits
    });
  } catch (error) {
    console.error('Error adding credits:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add credits'
    });
  }
});

// Get credit statistics for dashboard
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    // Get total users
    const totalUsersResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(users);
    
    // Get total credits distributed
    const totalCreditsResult = await db
      .select({ totalCredits: sql<number>`COALESCE(SUM(${userCredits.credits}), 0)` })
      .from(userCredits);
    
    // Get recent transactions count (last 30 days)
    const recentTransactionsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(creditTransactions)
      .where(sql`${creditTransactions.createdAt} >= NOW() - INTERVAL '30 days'`);

    // Get transactions by type for analytics
    const transactionsByType = await db
      .select({
        transactionType: creditTransactions.transactionType,
        count: sql<number>`count(*)`,
        totalCredits: sql<number>`SUM(${creditTransactions.credits})`
      })
      .from(creditTransactions)
      .groupBy(creditTransactions.transactionType);

    res.json({
      success: true,
      stats: {
        totalUsers: totalUsersResult[0]?.count || 0,
        totalCreditsDistributed: totalCreditsResult[0]?.totalCredits || 0,
        recentTransactions: recentTransactionsResult[0]?.count || 0,
        transactionsByType
      }
    });
  } catch (error) {
    console.error('Error fetching credit statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch credit statistics'
    });
  }
});

export default router;