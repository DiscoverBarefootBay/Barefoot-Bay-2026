/**
 * Simple test script to verify Stripe API key
 * Run with Node.js directly: node server/test-stripe.cjs
 */

// Using CommonJS syntax to avoid issues with ES modules
require('dotenv').config();

async function testStripeConnection() {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  
  try {
    console.log('Testing Stripe API connection...');
    
    // Try to list a small number of products to verify API connectivity
    const products = await stripe.products.list({ limit: 1 });
    
    console.log('✅ Stripe API connected successfully!');
    console.log(`Found ${products.data.length} products.`);
    
    // Create a test payment intent
    console.log('Creating test payment intent...');
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1000, // $10.00
      currency: 'usd',
      metadata: {
        integration_test: 'true'
      }
    });
    
    console.log('✅ Successfully created test payment intent');
    console.log('Payment Intent ID:', paymentIntent.id);
    console.log('Client Secret available:', !!paymentIntent.client_secret);
    
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