/**
 * Simple test script to verify Stripe API key
 * Run with Node.js directly: node server/test-stripe.js
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function testStripeConnection() {
  try {
    console.log('Testing Stripe API connection...');
    
    // Try to list a small number of products to verify API connectivity
    const products = await stripe.products.list({ limit: 1 });
    
    console.log('✅ Stripe API connected successfully!');
    console.log(`Found ${products.data.length} products.`);
    
    return true;
  } catch (error) {
    console.error('❌ Failed to connect to Stripe API:');
    console.error(error.message);
    
    return false;
  }
}

testStripeConnection()
  .then(success => {
    if (success) {
      console.log('Your Stripe integration should work correctly.');
    } else {
      console.log('Please check your STRIPE_SECRET_KEY environment variable.');
    }
  });