import express from 'express';
import { storage } from '../storage';
import { z } from 'zod/v4';
import { createOrderPaymentLink, verifyOrderPayment, validateStoreDiscountCode } from '../square-service';
import { requireAdmin } from '../auth';
import { sendOrderStatusUpdateEmail } from '../email-service';

console.log('=== ORDERS ROUTER LOADING ===');

const router = express.Router();

console.log('=== ORDERS ROUTER LOADED SUCCESSFULLY ===');

// Schema for shipping address
const ShippingAddressSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  streetAddress: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z.string().min(5, "Zip code is required"),
  country: z.string().min(1, "Country is required"),
  phone: z.string().optional(),
});

// Schema for checkout items - accepts just productId and quantity from frontend
const CheckoutItemSchema = z.object({
  productId: z.union([z.string(), z.number()]).transform(val => Number(val)),
  quantity: z.number().min(1),
  variantInfo: z.record(z.string(), z.any()).optional(),
});

// Schema for checkout request
const CheckoutRequestSchema = z.object({
  items: z.array(CheckoutItemSchema),
  shippingAddress: ShippingAddressSchema.optional(),
  discountCode: z.string().optional(),
});

// Schema for public order tracking
const TrackOrderSchema = z.object({
  orderId: z.number({ 
    required_error: "Order ID is required",
    invalid_type_error: "Order ID must be a number" 
  }),
  email: z.string().email({ message: "Valid email is required" }),
});

/**
 * Create a new order and Square payment link
 */
router.post('/checkout', async (req, res) => {
  try {
    console.log('=== CHECKOUT REQUEST DEBUG ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('User ID:', req.user?.id);
    
    // Require authentication
    if (!req.user) {
      console.error('Authentication failed - no user found');
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Validate request body
    const result = CheckoutRequestSchema.safeParse(req.body);
    if (!result.success) {
      console.error('=== CHECKOUT VALIDATION FAILED ===');
      console.error('Raw request body:', JSON.stringify(req.body, null, 2));
      console.error('Validation errors:', JSON.stringify(result.error.issues, null, 2));
      console.error('Full error object:', result.error);
      return res.status(400).json({ 
        error: 'Invalid checkout data',
        details: result.error.issues,
      });
    }
    
    const { items: requestItems, shippingAddress, discountCode } = result.data;
    
    // Fetch product details for each item
    const items = [];
    for (const requestItem of requestItems) {
      const product = await storage.getProduct(requestItem.productId);
      if (!product) {
        return res.status(400).json({ 
          error: `Product with ID ${requestItem.productId} not found` 
        });
      }
      
      items.push({
        productId: product.id,
        name: product.name,
        quantity: requestItem.quantity,
        price: parseFloat(product.price),
        variantInfo: requestItem.variantInfo,
      });
    }
    
    console.log('Fetched product details:', items);
    
    // Calculate order total
    let total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let appliedDiscountPercentage = 0;
    
    // Apply discount code if provided
    if (discountCode) {
      console.log(`Checking discount code: ${discountCode}`);
      appliedDiscountPercentage = await validateStoreDiscountCode(discountCode);
      
      if (appliedDiscountPercentage > 0) {
        const discountAmount = (total * appliedDiscountPercentage) / 100;
        total = Math.max(0, total - discountAmount);
        console.log(`Applied discount of ${appliedDiscountPercentage}%. New total: ${total}`);
      }
    }
    
    // Create order in the database
    const order = await storage.createOrder({
      userId: req.user.id,
      status: 'pending',
      total: total, // Updated to use numeric value directly since this error is fixed in the schema
      shippingAddress: shippingAddress!,
      discountCode: discountCode, // Save the discount code with the order
    });
    
    const orderId = order.id;
    console.log(`Created order ${orderId} for user ${req.user.id}`);
    
    // Create order items
    for (const item of items) {
      await storage.createOrderItem({
        orderId,
        productId: parseInt(item.productId, 10),
        quantity: item.quantity,
        price: item.price,
        variantInfo: item.variantInfo,
      });
    }
    
    console.log(`Added ${items.length} items to order ${orderId}`);
    
    // Skip SDK initialization and use REST API directly
    console.log('=== BYPASSING SDK INITIALIZATION (v42.1.0 ISSUES) ===');

    // Generate payment link with Square
    console.log('=== CALLING SQUARE SERVICE ===');
    console.log('Order ID:', orderId);
    console.log('User ID:', req.user.id);
    console.log('Total:', total);
    console.log('User email:', req.user.email);
    console.log('Items:', items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
    })));
    console.log('Discount code:', discountCode);
    
    // Create Square payment link directly via REST API
    let paymentResult;
    try {
      console.log('Creating Square payment link using direct REST API');
      
      // Get Square credentials
      const accessToken = process.env.SQUARE_ACCESS_TOKEN;
      const locationId = process.env.SQUARE_LOCATION_ID;
      
      if (!accessToken || !locationId) {
        throw new Error('Missing Square credentials');
      }
      
      const baseUrl = process.env.NODE_ENV === 'production' ? 
        'https://connect.squareup.com' : 
        'https://connect.squareupsandbox.com';
      
      // Generate unique idempotency key
      const idempotencyKey = `order_${orderId}_${Date.now()}`;
      
      // Format line items for Square
      const lineItems = items.map(item => ({
        name: item.name,
        quantity: item.quantity.toString(),
        item_type: 'ITEM',
        base_price_money: {
          amount: Math.round(item.price * 100), // Convert to cents
          currency: 'USD'
        }
      }));
      
      // Create Square order
      const metadata: Record<string, string> = {
        order_id: orderId.toString(),
        user_id: req.user.id.toString()
      };
      
      // Only add discount_code if it exists
      if (discountCode) {
        metadata.discount_code = discountCode;
      }
      
      const orderRequest = {
        idempotency_key: idempotencyKey,
        order: {
          location_id: locationId,
          line_items: lineItems,
          metadata: metadata
        }
      };
      
      console.log('Creating Square order:', JSON.stringify(orderRequest, null, 2));
      
      const orderResponse = await fetch(`${baseUrl}/v2/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': '2023-10-18'
        },
        body: JSON.stringify(orderRequest)
      });
      
      const orderData = await orderResponse.json();
      console.log('Square order response:', JSON.stringify(orderData, null, 2));
      
      if (!orderResponse.ok || !orderData.order) {
        console.error('Square order creation failed:', orderData);
        throw new Error(`Square order creation failed: ${orderData.errors?.[0]?.detail || 'Unknown error'}`);
      }
      
      const squareOrder = orderData.order;
      console.log('Square order created successfully:', squareOrder.id);
      
      // Create payment link with complete order structure
      const paymentLinkRequest = {
        idempotency_key: `payment_${idempotencyKey}`,
        description: `Payment for order ${orderId} - ${items.map(i => i.name).join(', ')}`,
        order: {
          location_id: locationId,
          line_items: lineItems,
          metadata: metadata
        },
        checkout_options: {
          redirect_url: `${req.protocol}://${req.get('host')}/store/order-complete/${orderId}`
        },
        pre_populated_data: {
          buyer_email: req.user.email || ''
        }
      };
      
      console.log('Creating Square payment link:', JSON.stringify(paymentLinkRequest, null, 2));
      
      const paymentLinkResponse = await fetch(`${baseUrl}/v2/online-checkout/payment-links`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': '2023-10-18'
        },
        body: JSON.stringify(paymentLinkRequest)
      });
      
      const paymentLinkData = await paymentLinkResponse.json();
      console.log('Square payment link response:', JSON.stringify(paymentLinkData, null, 2));
      
      if (!paymentLinkResponse.ok || !paymentLinkData.payment_link) {
        console.error('Square payment link creation failed:', paymentLinkData);
        throw new Error(`Square payment link creation failed: ${paymentLinkData.errors?.[0]?.detail || 'Unknown error'}`);
      }
      
      const paymentLink = paymentLinkData.payment_link;
      console.log('Square payment link created successfully:', paymentLink.id);
      
      // Update order with payment link ID
      await storage.updateOrder(orderId, {
        paymentIntentId: paymentLink.id,
        discountCode: discountCode
      });
      
      paymentResult = {
        paymentId: orderId,
        isFree: false,
        paymentLinkUrl: paymentLink.url,
        paymentLinkId: paymentLink.id,
        wasFixed: false,
        isFallback: false
      };
      
      console.log('Payment link created successfully:', paymentResult);
    } catch (error) {
      console.error('Square payment creation error:', error);
      return res.status(500).json({ error: 'Payment service unavailable' });
    }
    
    console.log('=== SQUARE SERVICE RESULT ===');
    console.log('Payment result:', JSON.stringify(paymentResult, null, 2));
    
    // Check if this is a fallback to custom payment (which we don't want)
    if (paymentResult.isFallback) {
      console.error('=== SQUARE API FALLBACK DETECTED ===');
      console.error('Square API failed and fell back to custom payment system');
      console.error('This should not happen - checkout will fail to force Square integration');
      return res.status(500).json({ 
        error: 'Payment system unavailable',
        details: 'Square payment processing is currently unavailable. Please try again later.'
      });
    }
    
    return res.json(paymentResult);
    
  } catch (error) {
    console.error('Error creating order:', error);
    return res.status(500).json({ error: 'Failed to create order' });
  }
});

/**
 * Check payment status for an order
 */
router.get('/verify-payment/:orderId/:paymentLinkId', async (req, res) => {
  try {
    // Require authentication
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { orderId, paymentLinkId } = req.params;
    
    // Verify the payment status
    const result = await verifyOrderPayment(paymentLinkId, orderId);
    
    return res.json(result);
    
  } catch (error) {
    console.error('Error verifying payment:', error);
    return res.status(500).json({ error: 'Failed to verify payment' });
  }
});



/**
 * Get an order by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    
    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }
    
    const order = await storage.getOrder(orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // For security, verify the user owns the order or is an admin
    const isAdmin = req.user && req.user.role === 'admin';
    if (req.user && !isAdmin && order.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get order items
    const items = await storage.getOrderItems(orderId);
    
    // Get product details for each item
    const itemsWithProductDetails = await Promise.all(
      items.map(async (item) => {
        if (item.productId) {
          const product = await storage.getProduct(item.productId);
          return {
            ...item,
            product
          };
        }
        return item;
      })
    );
    
    // Return the order with items
    return res.json({
      ...order,
      items: itemsWithProductDetails
    });
    
  } catch (error) {
    console.error('Error fetching order:', error);
    return res.status(500).json({ error: 'Failed to fetch order' });
  }
});

/**
 * Get all orders (for admin use)
 */
router.get('/admin/all', requireAdmin, async (req, res) => {
  try {
    console.log('Admin requested all orders');
    const orders = await storage.getAllOrders();
    return res.json(orders);
  } catch (error) {
    console.error('Error fetching all orders:', error);
    return res.status(500).json({ error: 'Failed to fetch all orders' });
  }
});

/**
 * Get all orders for the current user
 */
router.get('/', async (req, res) => {
  try {
    // Require authentication
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Check if user is admin and wants all orders
    if (req.user.role === 'admin' && req.query.all === 'true') {
      console.log('Admin requested all orders via query parameter');
      
      // Get all orders
      const orders = await storage.getAllOrders();
      
      // For each order, fetch and attach its items with product details
      const ordersWithItems = await Promise.all(
        orders.map(async (order) => {
          const items = await storage.getOrderItems(order.id);
          
          // Get product details for each item
          const itemsWithProductDetails = await Promise.all(
            items.map(async (item) => {
              if (item.productId) {
                const product = await storage.getProduct(item.productId);
                return {
                  ...item,
                  product
                };
              }
              return item;
            })
          );
          
          return {
            ...order,
            items: itemsWithProductDetails
          };
        })
      );
      
      return res.json(ordersWithItems);
    }
    
    // Regular user or admin not requesting all orders
    const orders = await storage.getOrdersByUserId(req.user.id);
    
    // For each order, fetch and attach its items with product details
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const items = await storage.getOrderItems(order.id);
        
        // Get product details for each item
        const itemsWithProductDetails = await Promise.all(
          items.map(async (item) => {
            if (item.productId) {
              const product = await storage.getProduct(item.productId);
              return {
                ...item,
                product
              };
            }
            return item;
          })
        );
        
        return {
          ...order,
          items: itemsWithProductDetails
        };
      })
    );
    
    return res.json(ordersWithItems);
    
  } catch (error) {
    console.error('Error fetching orders:', error);
    return res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

/**
 * Update order status (for payment completion)
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const { status, paymentMethod } = req.body;
    
    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    
    // Validate status values
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'return_requested', 'return_approved', 'return_shipped', 'return_received', 'refunded', 'returned'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    // Get the current order to verify ownership
    const existingOrder = await storage.getOrder(orderId);
    if (!existingOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Verify the user owns the order or is an admin
    const isAdmin = req.user && req.user.role === 'admin';
    if (req.user && !isAdmin && existingOrder.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Update the order status
    const updateData: any = { status };
    if (paymentMethod) {
      updateData.paymentMethod = paymentMethod;
    }
    
    const updatedOrder = await storage.updateOrder(orderId, updateData);
    
    if (!updatedOrder) {
      return res.status(404).json({ error: 'Failed to update order' });
    }
    
    // If order is paid, log for potential Printful order creation
    if (status === 'paid' && paymentMethod === 'square') {
      try {
        const items = await storage.getOrderItems(orderId);
        console.log(`Order ${orderId} paid via Square - items ready for fulfillment:`, items);
        
        // TODO: Implement Printful order creation
        // await printfulService.createOrder(updatedOrder, items);
      } catch (fulfillmentError) {
        console.error('Error preparing fulfillment for order:', fulfillmentError);
        // Don't fail the status update if fulfillment preparation fails
      }
    }
    
    console.log(`Order ${orderId} status updated to: ${status}`);
    res.json(updatedOrder);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

/**
 * Validate a store discount code
 */
router.post('/validate-discount', async (req, res) => {
  try {
    // Require authentication
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ 
        success: false, 
        message: "Discount code is required" 
      });
    }
    
    // Validate the discount code
    const discountPercentage = await validateStoreDiscountCode(code);
    
    console.log(`Validated store discount code "${code}", percentage: ${discountPercentage}%`);
    
    res.json({
      success: true,
      valid: discountPercentage > 0,
      discountPercentage,
      message: discountPercentage > 0 
        ? `Discount of ${discountPercentage}% will be applied at checkout` 
        : 'Invalid discount code'
    });
  } catch (err) {
    console.error("Error validating store discount code:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to validate discount code" 
    });
  }
});

/**
 * Update order status (for admin use)
 */
router.patch('/:id', async (req, res) => {
  try {
    // Require authentication
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const orderId = parseInt(req.params.id);
    
    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }
    
    // Get the existing order
    const order = await storage.getOrder(orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // For security, verify the user owns the order or is an admin
    const isAdmin = req.user.role === 'admin';
    if (!isAdmin && order.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get the updated fields from the request body
    const { status, trackingNumber, trackingUrl } = req.body;
    
    // Store the previous status for notification
    const previousStatus = order.status;
    
    // Validate the status if provided
    if (status) {
      // Import OrderStatus directly instead of using require
      const { OrderStatus } = await import('../../shared/schema');
      if (!Object.values(OrderStatus).includes(status)) {
        return res.status(400).json({ error: 'Invalid order status' });
      }
    }
    
    // Update the order
    const updateData: any = {};
    if (status) updateData.status = status;
    if (trackingNumber) updateData.trackingNumber = trackingNumber;
    if (trackingUrl) updateData.trackingUrl = trackingUrl;
    
    // Only update if there are fields to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    const updatedOrder = await storage.updateOrder(orderId, updateData);
    
    console.log(`Order ${orderId} updated by ${req.user.id} (${isAdmin ? 'admin' : 'owner'})`);
    
    // If status has changed, send email notification
    if (status && status !== previousStatus) {
      try {
        // Get the customer (user) of this order
        if (order.userId) {
          console.log(`Fetching user with ID ${order.userId} for email notification`);
          const customer = await storage.getUser(order.userId);
          
          if (customer && customer.email) {
            console.log(`Sending order status update email to ${customer.email} for order ${orderId}`);
            
            // Send email notification
            const emailResult = await sendOrderStatusUpdateEmail(
              updatedOrder, 
              previousStatus,
              customer.email
            );
            
            if (emailResult) {
              console.log(`Order status update email sent successfully to ${customer.email}`);
            } else {
              console.error(`Failed to send order status update email to ${customer.email}`);
            }
          } else {
            console.warn(`Customer email not found for order ${orderId}, cannot send notification`);
          }
        } else {
          console.warn(`UserId not found for order ${orderId}, cannot send notification`);
        }
      } catch (emailError) {
        // Log the error but don't fail the request
        console.error('Error sending order status update email:', emailError);
      }
    }
    
    return res.json(updatedOrder);
    
  } catch (error) {
    console.error('Error updating order:', error);
    return res.status(500).json({ error: 'Failed to update order' });
  }
});

/**
 * Get all orders for the current user
 */
router.get('/user', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const orders = await storage.getOrdersByUserId(req.user.id);
    res.json(orders);
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Track an order without requiring login (public endpoint)
 * Requires order ID and the email used for the order
 */
router.post('/track', async (req, res) => {
  try {
    console.log('Public order tracking request:', req.body);
    
    // Validate request body
    const result = TrackOrderSchema.safeParse(req.body);
    if (!result.success) {
      console.error('Order tracking validation failed:', result.error);
      return res.status(400).json({ 
        success: false,
        error: 'Invalid tracking data',
        details: result.error.issues,
      });
    }
    
    const { orderId, email } = result.data;
    
    // Get the order
    const order = await storage.getOrder(orderId);
    
    if (!order) {
      return res.status(404).json({ 
        success: false,
        error: 'Order not found' 
      });
    }
    
    // Verify the order belongs to a user with the provided email
    if (order.userId) {
      const user = await storage.getUser(order.userId);
      
      // For security, verify the email matches
      if (!user || user.email.toLowerCase() !== email.toLowerCase()) {
        return res.status(403).json({ 
          success: false,
          error: 'The email address does not match our records for this order' 
        });
      }
    } else if (order.shippingAddress && (order.shippingAddress as any).email) {
      // For guest checkouts, check the shipping address email
      if ((order.shippingAddress as any).email.toLowerCase() !== email.toLowerCase()) {
        return res.status(403).json({ 
          success: false,
          error: 'The email address does not match our records for this order' 
        });
      }
    } else {
      // No way to verify the email
      return res.status(403).json({ 
        success: false,
        error: 'Unable to verify ownership of this order' 
      });
    }
    
    // Get order items
    const items = await storage.getOrderItems(orderId);
    
    // Get product details for each item
    const itemsWithProductDetails = await Promise.all(
      items.map(async (item) => {
        if (item.productId) {
          const product = await storage.getProduct(item.productId);
          return {
            ...item,
            product
          };
        }
        return item;
      })
    );
    
    // Return the order with items
    return res.json({
      success: true,
      order: {
        ...order,
        items: itemsWithProductDetails,
        // Remove any sensitive data
        userId: undefined, 
      }
    });
    
  } catch (error) {
    console.error('Error tracking order:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to track order' 
    });
  }
});

export default router;