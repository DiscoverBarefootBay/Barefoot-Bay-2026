import { Router } from 'express';
import { storage } from '../storage';
import { authenticateUser } from '../middleware/auth';
import { isAdmin } from '../utils/role-utils';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq, and, lt, gt } from 'drizzle-orm';

const router = Router();

// Get users with sponsorships expiring in the next 7 days
async function getUsersWithExpiringSponsorship() {
  const today = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(today.getDate() + 7);
  
  return await db.select()
    .from(users)
    .where(
      and(
        eq(users.role, 'paid'),
        eq(users.subscriptionStatus, 'active'),
        gt(users.subscriptionEndDate, today),
        lt(users.subscriptionEndDate, sevenDaysFromNow)
      )
    );
}

// Get badge holders who aren't paid users
async function getBadgeHolders() {
  return await db.select()
    .from(users)
    .where(
      and(
        eq(users.hasMembershipBadge, true),
        eq(users.role, 'badge_holder')
      )
    );
}

// Get new paid users (subscribed in the last 30 days)
async function getNewPaidUsers() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  return await db.select()
    .from(users)
    .where(
      and(
        eq(users.role, 'paid'),
        gt(users.subscriptionStartDate, thirtyDaysAgo)
      )
    );
}

// Get newly registered users (registered in the last 7 days)
async function getNewlyRegisteredUsers() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  return await db.select()
    .from(users)
    .where(
      gt(users.createdAt, sevenDaysAgo)
    );
}

// Get recipients based on template criteria
router.get('/target-users/:targetQuery', authenticateUser, async (req, res) => {
  try {
    // Check if user is admin
    if (!isAdmin(req.user?.role)) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }
    
    const { targetQuery } = req.params;
    let targetUsers = [];
    
    switch (targetQuery) {
      case 'sponsorship_expiring_7days':
        targetUsers = await getUsersWithExpiringSponsorship();
        break;
        
      case 'badge_holders':
        targetUsers = await getBadgeHolders();
        break;
        
      case 'new_paid_users':
        targetUsers = await getNewPaidUsers();
        break;
        
      case 'newly_registered_users':
        targetUsers = await getNewlyRegisteredUsers();
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid target query' });
    }
    
    // Return basic user info
    const userInfo = targetUsers.map(user => ({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      subscriptionEndDate: user.subscriptionEndDate
    }));
    
    return res.json({
      query: targetQuery,
      count: userInfo.length,
      users: userInfo
    });
    
  } catch (error) {
    console.error('Error fetching target users:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;