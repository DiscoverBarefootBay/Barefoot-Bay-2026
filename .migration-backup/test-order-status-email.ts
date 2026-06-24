/**
 * Order Status Update Email Test
 * 
 * This script simulates sending an order status update email
 * Run with: npx tsx test-order-status-email.ts
 */

import { OrderStatus } from './shared/schema';
import { sendOrderStatusUpdateEmail } from './server/email-service';

async function testOrderStatusEmail() {
  console.log('Testing order status update email...');
  
  // Create a mock order object
  const mockOrder = {
    id: 123,
    status: OrderStatus.SHIPPED,
    total: 149.99,
    trackingNumber: 'BB123456789',
    trackingUrl: 'https://www.fedex.com/track?tracknumber=BB123456789',
    shippingAddress: {
      fullName: 'John Doe',
      streetAddress: '123 Main St',
      city: 'Barefoot Bay',
      state: 'FL',
      zipCode: '32976',
      country: 'United States'
    }
  };
  
  try {
    // Send test email - change this to your email address
    const result = await sendOrderStatusUpdateEmail(
      mockOrder, 
      OrderStatus.PROCESSING, // previous status
      'malgatitix@gmail.com' // recipient email
    );
    
    console.log('Email sending result:', result);
  } catch (error) {
    console.error('Error testing email service:', error);
  }
}

testOrderStatusEmail().catch(console.error);