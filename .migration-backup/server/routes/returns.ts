import { Router } from 'express';
import { storage } from '../storage';
import { ReturnStatus, insertOrderReturnSchema, insertReturnItemSchema } from '@shared/schema';
import { z } from 'zod';
import { requireAdmin as isAdmin, requireAuth as isAuthenticated } from '../auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Configure storage for return image uploads
const uploadDir = './uploads/returns';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage_config = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'return-' + uniqueSuffix + ext);
  }
});

const upload = multer({ storage: storage_config });

/**
 * @route GET /api/returns
 * @desc Get all returns (admin only)
 * @access Private (Admin)
 */
router.get('/', isAdmin, async (req, res) => {
  try {
    const returns = await storage.getOrderReturns();
    res.json(returns);
  } catch (error) {
    console.error('Error fetching returns:', error);
    res.status(500).json({ error: 'Failed to fetch returns' });
  }
});

/**
 * @route GET /api/returns/status/:status
 * @desc Get returns by status (admin only)
 * @access Private (Admin)
 */
router.get('/status/:status', isAdmin, async (req, res) => {
  try {
    const { status } = req.params;
    const validStatus = Object.values(ReturnStatus).includes(status as ReturnStatus);
    
    if (!validStatus) {
      return res.status(400).json({ error: 'Invalid return status' });
    }
    
    const returns = await storage.getOrderReturnsByStatus([status]);
    res.json(returns);
  } catch (error) {
    console.error('Error fetching returns by status:', error);
    res.status(500).json({ error: 'Failed to fetch returns' });
  }
});

/**
 * @route GET /api/returns/order/:orderId
 * @desc Get returns for a specific order
 * @access Private (User must be authenticated and own the order, or admin)
 */
router.get('/order/:orderId', isAuthenticated, async (req, res) => {
  try {
    const { orderId } = req.params;
    const orderIdNum = parseInt(orderId, 10);
    
    if (isNaN(orderIdNum)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }
    
    // First get the order to check ownership
    const order = await storage.getOrder(orderIdNum);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Check if user is admin or order owner
    const isUserAdmin = req.user?.role === 'admin';
    const isOrderOwner = req.user?.id === order.userId;
    
    if (!isUserAdmin && !isOrderOwner) {
      return res.status(403).json({ error: 'Unauthorized access to order returns' });
    }
    
    const returns = await storage.getOrderReturnsByOrder(orderIdNum);
    res.json(returns);
  } catch (error) {
    console.error('Error fetching returns for order:', error);
    res.status(500).json({ error: 'Failed to fetch returns' });
  }
});

/**
 * @route GET /api/returns/user
 * @desc Get returns for logged in user
 * @access Private (User must be authenticated)
 */
router.get('/user', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const returns = await storage.getOrderReturnsByUser(userId);
    res.json(returns);
  } catch (error) {
    console.error('Error fetching user returns:', error);
    res.status(500).json({ error: 'Failed to fetch returns' });
  }
});

/**
 * @route GET /api/returns/:id
 * @desc Get a specific return by ID
 * @access Private (User must be authenticated and own the return, or admin)
 */
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const returnId = parseInt(id, 10);
    
    if (isNaN(returnId)) {
      return res.status(400).json({ error: 'Invalid return ID' });
    }
    
    const returnData = await storage.getOrderReturn(returnId);
    
    if (!returnData) {
      return res.status(404).json({ error: 'Return not found' });
    }
    
    // Get the order to check ownership
    const order = await storage.getOrder(returnData.orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Associated order not found' });
    }
    
    // Check if user is admin or order owner
    const isUserAdmin = req.user?.role === 'admin';
    const isOrderOwner = req.user?.id === order.userId;
    
    if (!isUserAdmin && !isOrderOwner) {
      return res.status(403).json({ error: 'Unauthorized access to return' });
    }
    
    // Include return items
    const returnItems = await storage.getReturnItems(returnId);
    
    res.json({
      ...returnData,
      items: returnItems
    });
  } catch (error) {
    console.error('Error fetching return:', error);
    res.status(500).json({ error: 'Failed to fetch return' });
  }
});

/**
 * @route POST /api/returns
 * @desc Create a new return request
 * @access Private (User must be authenticated and own the order)
 */
router.post('/', isAuthenticated, upload.array('images', 5), async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Validate the return data
    const returnData = req.body;
    
    // Parse orderId as a number
    returnData.orderId = parseInt(returnData.orderId, 10);
    
    if (isNaN(returnData.orderId)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }
    
    // Get the order to check ownership
    const order = await storage.getOrder(returnData.orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Verify user owns the order
    if (order.userId !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized access to order' });
    }
    
    // Process uploaded files if any
    const files = req.files as Express.Multer.File[];
    const imageUrls = files.map(file => `/uploads/returns/${file.filename}`);
    
    // Validate with zod schema
    try {
      const validatedData = insertOrderReturnSchema.parse({
        ...returnData,
        imageUrls,
        status: ReturnStatus.REQUESTED
      });
      
      // Create the return
      const createdReturn = await storage.createOrderReturn(validatedData);
      
      // If there are return items, create them as well
      if (returnData.items && Array.isArray(returnData.items)) {
        const items = returnData.items.map(item => ({
          ...item,
          returnId: createdReturn.id,
          quantity: parseInt(item.quantity, 10)
        }));
        
        // Create each return item
        for (const item of items) {
          try {
            const validatedItem = insertReturnItemSchema.parse(item);
            await storage.createReturnItem(validatedItem);
          } catch (itemError) {
            console.error('Error validating return item:', itemError);
            // Continue with other items even if one fails
          }
        }
      }
      
      // Get all items associated with this return
      const returnItems = await storage.getReturnItems(createdReturn.id);
      
      res.status(201).json({
        ...createdReturn,
        items: returnItems
      });
    } catch (validationError: any) {
      console.error('Validation error:', validationError);
      
      // Clean up any uploaded files on validation error
      if (imageUrls.length > 0) {
        imageUrls.forEach(url => {
          const filePath = path.join(__dirname, '../../', url);
          fs.unlink(filePath, err => {
            if (err) console.error('Error deleting file after validation error:', err);
          });
        });
      }
      
      return res.status(400).json({ 
        error: 'Invalid return data', 
        details: validationError.errors || validationError.message 
      });
    }
  } catch (error) {
    console.error('Error creating return:', error);
    res.status(500).json({ error: 'Failed to create return request' });
  }
});

/**
 * @route PATCH /api/returns/:id
 * @desc Update a return request (different permissions for admin vs user)
 * @access Private (Users can only update their own returns in certain statuses)
 */
router.patch('/:id', isAuthenticated, upload.array('images', 5), async (req, res) => {
  try {
    const { id } = req.params;
    const returnId = parseInt(id, 10);
    const userId = req.user?.id;
    const isUserAdmin = req.user?.role === 'admin';
    
    if (isNaN(returnId)) {
      return res.status(400).json({ error: 'Invalid return ID' });
    }
    
    // Get the existing return
    const existingReturn = await storage.getOrderReturn(returnId);
    
    if (!existingReturn) {
      return res.status(404).json({ error: 'Return not found' });
    }
    
    // Get the order to check ownership
    const order = await storage.getOrder(existingReturn.orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Associated order not found' });
    }
    
    // Check if user is admin or order owner
    const isOrderOwner = req.user?.id === order.userId;
    
    if (!isUserAdmin && !isOrderOwner) {
      return res.status(403).json({ error: 'Unauthorized access to return' });
    }
    
    // Process uploaded files if any
    const files = req.files as Express.Multer.File[];
    const newImageUrls = files.map(file => `/uploads/returns/${file.filename}`);
    
    // Combine with existing images if not replacing all images
    let imageUrls = existingReturn.imageUrls || [];
    if (newImageUrls.length > 0) {
      if (req.body.replaceImages === 'true') {
        // Remove old images if replacing
        imageUrls = newImageUrls;
      } else {
        // Append new images
        imageUrls = [...imageUrls, ...newImageUrls];
      }
    }
    
    let updateData = { ...req.body };
    
    // Different handling for admin vs user updates
    if (isUserAdmin) {
      // Admins can update any field
      updateData = {
        ...updateData,
        imageUrls
      };
      
      // Parse numeric fields
      if (updateData.refundAmount) {
        updateData.refundAmount = parseFloat(updateData.refundAmount);
      }
    } else {
      // Regular users can only update certain fields and only if the return is in certain statuses
      const allowedUserUpdateStatuses = [
        ReturnStatus.REQUESTED,
        ReturnStatus.APPROVED
      ];
      
      if (!allowedUserUpdateStatuses.includes(existingReturn.status as ReturnStatus)) {
        return res.status(403).json({ 
          error: 'Cannot update return in current status',
          status: existingReturn.status
        });
      }
      
      // Regular users can only update notes, reason, reasonDetails, and add images
      const allowedUserFields = ['notes', 'reason', 'reasonDetails'];
      
      // Filter to only allowed fields
      const filteredUpdateData: Record<string, any> = {};
      
      allowedUserFields.forEach(field => {
        if (updateData[field] !== undefined) {
          filteredUpdateData[field] = updateData[field];
        }
      });
      
      // Always include images
      filteredUpdateData.imageUrls = imageUrls;
      
      updateData = filteredUpdateData;
    }
    
    // Update the return
    const updatedReturn = await storage.updateOrderReturn(returnId, updateData);
    
    // Get the updated return items
    const returnItems = await storage.getReturnItems(returnId);
    
    res.json({
      ...updatedReturn,
      items: returnItems
    });
  } catch (error) {
    console.error('Error updating return:', error);
    res.status(500).json({ error: 'Failed to update return request' });
  }
});

/**
 * @route DELETE /api/returns/:id
 * @desc Delete a return request
 * @access Private (Admin only, or user who created it if still in REQUESTED state)
 */
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const returnId = parseInt(id, 10);
    
    if (isNaN(returnId)) {
      return res.status(400).json({ error: 'Invalid return ID' });
    }
    
    const returnData = await storage.getOrderReturn(returnId);
    
    if (!returnData) {
      return res.status(404).json({ error: 'Return not found' });
    }
    
    // Get the order to check ownership
    const order = await storage.getOrder(returnData.orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Associated order not found' });
    }
    
    // Check if user is admin or order owner
    const isUserAdmin = req.user?.role === 'admin';
    const isOrderOwner = req.user?.id === order.userId;
    
    // Users can only delete if return is in REQUESTED state
    if (isOrderOwner && !isUserAdmin && returnData.status !== ReturnStatus.REQUESTED) {
      return res.status(403).json({ 
        error: 'Cannot delete return in current status',
        status: returnData.status 
      });
    }
    
    if (!isUserAdmin && !isOrderOwner) {
      return res.status(403).json({ error: 'Unauthorized access to return' });
    }
    
    // Delete all return items first, then the return itself
    await storage.deleteOrderReturn(returnId);
    
    // Remove any images associated with the return
    if (returnData.imageUrls && returnData.imageUrls.length > 0) {
      returnData.imageUrls.forEach(url => {
        const filePath = path.join(__dirname, '../../', url);
        fs.unlink(filePath, err => {
          if (err) console.error('Error deleting file after return deletion:', err);
        });
      });
    }
    
    res.status(200).json({ message: 'Return deleted successfully' });
  } catch (error) {
    console.error('Error deleting return:', error);
    res.status(500).json({ error: 'Failed to delete return request' });
  }
});

/**
 * @route POST /api/returns/:id/items
 * @desc Add an item to a return request
 * @access Private (User must be authenticated and own the return, or admin)
 */
router.post('/:id/items', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const returnId = parseInt(id, 10);
    
    if (isNaN(returnId)) {
      return res.status(400).json({ error: 'Invalid return ID' });
    }
    
    const returnData = await storage.getOrderReturn(returnId);
    
    if (!returnData) {
      return res.status(404).json({ error: 'Return not found' });
    }
    
    // Get the order to check ownership
    const order = await storage.getOrder(returnData.orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Associated order not found' });
    }
    
    // Check if user is admin or order owner
    const isUserAdmin = req.user?.role === 'admin';
    const isOrderOwner = req.user?.id === order.userId;
    
    if (!isUserAdmin && !isOrderOwner) {
      return res.status(403).json({ error: 'Unauthorized access to return' });
    }
    
    // Users can only add items in certain statuses
    if (isOrderOwner && !isUserAdmin) {
      const allowedStatuses = [ReturnStatus.REQUESTED];
      if (!allowedStatuses.includes(returnData.status as ReturnStatus)) {
        return res.status(403).json({ 
          error: 'Cannot add items to return in current status',
          status: returnData.status 
        });
      }
    }
    
    // Validate and create the return item
    try {
      const itemData = {
        ...req.body,
        returnId,
        quantity: parseInt(req.body.quantity, 10)
      };
      
      const validatedItem = insertReturnItemSchema.parse(itemData);
      const createdItem = await storage.createReturnItem(validatedItem);
      
      res.status(201).json(createdItem);
    } catch (validationError: any) {
      console.error('Validation error:', validationError);
      return res.status(400).json({ 
        error: 'Invalid return item data', 
        details: validationError.errors || validationError.message 
      });
    }
  } catch (error) {
    console.error('Error adding return item:', error);
    res.status(500).json({ error: 'Failed to add return item' });
  }
});

/**
 * @route PATCH /api/returns/:returnId/items/:itemId
 * @desc Update a return item
 * @access Private (User must be authenticated and own the return, or admin)
 */
router.patch('/:returnId/items/:itemId', isAuthenticated, async (req, res) => {
  try {
    const { returnId, itemId } = req.params;
    const returnIdNum = parseInt(returnId, 10);
    const itemIdNum = parseInt(itemId, 10);
    
    if (isNaN(returnIdNum) || isNaN(itemIdNum)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const returnData = await storage.getOrderReturn(returnIdNum);
    
    if (!returnData) {
      return res.status(404).json({ error: 'Return not found' });
    }
    
    // Get the order to check ownership
    const order = await storage.getOrder(returnData.orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Associated order not found' });
    }
    
    // Get the item
    const returnItem = await storage.getReturnItem(itemIdNum);
    
    if (!returnItem) {
      return res.status(404).json({ error: 'Return item not found' });
    }
    
    // Verify item belongs to this return
    if (returnItem.returnId !== returnIdNum) {
      return res.status(400).json({ error: 'Item does not belong to this return' });
    }
    
    // Check if user is admin or order owner
    const isUserAdmin = req.user?.role === 'admin';
    const isOrderOwner = req.user?.id === order.userId;
    
    if (!isUserAdmin && !isOrderOwner) {
      return res.status(403).json({ error: 'Unauthorized access to return item' });
    }
    
    // Users can only update in certain statuses
    if (isOrderOwner && !isUserAdmin) {
      const allowedStatuses = [ReturnStatus.REQUESTED];
      if (!allowedStatuses.includes(returnData.status as ReturnStatus)) {
        return res.status(403).json({ 
          error: 'Cannot update items in return with current status',
          status: returnData.status 
        });
      }
    }
    
    // Process update data
    let updateData = { ...req.body };
    
    // Parse numeric fields
    if (updateData.quantity) {
      updateData.quantity = parseInt(updateData.quantity, 10);
    }
    
    // Update the item
    const updatedItem = await storage.updateReturnItem(itemIdNum, updateData);
    
    res.json(updatedItem);
  } catch (error) {
    console.error('Error updating return item:', error);
    res.status(500).json({ error: 'Failed to update return item' });
  }
});

/**
 * @route DELETE /api/returns/:returnId/items/:itemId
 * @desc Delete a return item
 * @access Private (User must be authenticated and own the return, or admin)
 */
router.delete('/:returnId/items/:itemId', isAuthenticated, async (req, res) => {
  try {
    const { returnId, itemId } = req.params;
    const returnIdNum = parseInt(returnId, 10);
    const itemIdNum = parseInt(itemId, 10);
    
    if (isNaN(returnIdNum) || isNaN(itemIdNum)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const returnData = await storage.getOrderReturn(returnIdNum);
    
    if (!returnData) {
      return res.status(404).json({ error: 'Return not found' });
    }
    
    // Get the order to check ownership
    const order = await storage.getOrder(returnData.orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Associated order not found' });
    }
    
    // Get the item
    const returnItem = await storage.getReturnItem(itemIdNum);
    
    if (!returnItem) {
      return res.status(404).json({ error: 'Return item not found' });
    }
    
    // Verify item belongs to this return
    if (returnItem.returnId !== returnIdNum) {
      return res.status(400).json({ error: 'Item does not belong to this return' });
    }
    
    // Check if user is admin or order owner
    const isUserAdmin = req.user?.role === 'admin';
    const isOrderOwner = req.user?.id === order.userId;
    
    if (!isUserAdmin && !isOrderOwner) {
      return res.status(403).json({ error: 'Unauthorized access to return item' });
    }
    
    // Users can only delete in certain statuses
    if (isOrderOwner && !isUserAdmin) {
      const allowedStatuses = [ReturnStatus.REQUESTED];
      if (!allowedStatuses.includes(returnData.status as ReturnStatus)) {
        return res.status(403).json({ 
          error: 'Cannot delete items from return in current status',
          status: returnData.status 
        });
      }
    }
    
    // Delete the item
    await storage.deleteReturnItem(itemIdNum);
    
    res.status(200).json({ message: 'Return item deleted successfully' });
  } catch (error) {
    console.error('Error deleting return item:', error);
    res.status(500).json({ error: 'Failed to delete return item' });
  }
});

export default router;