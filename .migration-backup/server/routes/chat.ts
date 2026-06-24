import express from 'express';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq, and, ne, asc, desc } from 'drizzle-orm';
import { authenticateUser } from '../middleware/auth';
import { isAdmin } from '../utils/role-utils';
import messagesRouter from './messages';

const router = express.Router();

// Add messages routes to the chat router
router.use('/messages', messagesRouter);

// Get available recipients for messages
// Normal users can only message admins
// Admins can message any user or user groups
router.get('/recipients', authenticateUser, async (req, res) => {
  try {
    const currentUserId = req.user?.id.toString();
    const isUserAdmin = isAdmin(req.user?.role);
    
    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // For admins, return all users plus special recipient types
    if (isUserAdmin) {
      // Get all users except the current admin
      const allUsers = await db.select({
        id: users.id,
        fullName: users.fullName,
        username: users.username
      })
      .from(users)
      .where(ne(users.id, parseInt(currentUserId)))
      .orderBy(asc(users.fullName));
      
      // Format user IDs as strings for consistency and format display name
      const formattedUsers = allUsers.map(user => ({
        id: user.id.toString(),
        name: `${user.fullName || `User ${user.id}`} (${user.username})`
      }));
      
      // Add special recipient types
      const specialRecipients = [
        { id: 'all', name: 'All Users' },
        { id: 'admin', name: 'All Admins' },
        { id: 'registered', name: 'Paid Users' },
        { id: 'badge_holders', name: 'All Badge Holders' }
      ];
      
      return res.json([...specialRecipients, ...formattedUsers]);
    } else {
      // For regular users, they can message all individual users (but not special groups)
      const allUsers = await db.select({
        id: users.id,
        fullName: users.fullName,
        username: users.username
      })
      .from(users)
      .where(ne(users.id, parseInt(currentUserId)))
      .orderBy(asc(users.fullName));
      
      // Format user IDs as strings for consistency and format display name
      const formattedUsers = allUsers.map(user => ({
        id: user.id.toString(),
        name: `${user.fullName || `User ${user.id}`} (${user.username})`
      }));
      
      return res.json(formattedUsers);
    }
  } catch (error) {
    console.error('Error fetching recipients:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;