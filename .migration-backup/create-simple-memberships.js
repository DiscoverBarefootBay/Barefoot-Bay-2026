/**
 * Simple script to create membership products in the store
 * 
 * This script creates two membership products: a monthly subscription at $5/month
 * and an annual subscription at $50/year, without using canvas for image generation.
 */

import 'dotenv/config';
import fetch from 'node-fetch';

// Define subscription plans and details
const SubscriptionPlans = {
  MONTHLY: 'monthly_membership',
  ANNUAL: 'annual_membership'
};

const SubscriptionPlanDetails = {
  [SubscriptionPlans.MONTHLY]: {
    name: 'Monthly Membership',
    description: 'Get premium access to all paid community features with our monthly subscription. Only $5/month!',
    price: 500, // in cents
    interval: 'MONTHLY'
  },
  [SubscriptionPlans.ANNUAL]: {
    name: 'Annual Membership',
    description: 'Save $10/year with our annual subscription! Get all premium features for a full year.',
    price: 5000, // in cents
    interval: 'ANNUAL'
  }
};

async function createMembershipProducts() {
  try {
    console.log('Creating membership products...');
    
    // Create monthly membership product
    const monthlyProduct = {
      name: SubscriptionPlanDetails[SubscriptionPlans.MONTHLY].name,
      description: SubscriptionPlanDetails[SubscriptionPlans.MONTHLY].description,
      price: SubscriptionPlanDetails[SubscriptionPlans.MONTHLY].price / 100, // Convert cents to dollars
      category: 'memberships',
      status: 'active',
      imageUrls: ['/BBLogo.png'], // Use existing BBLogo.png image
      // Store subscription plan details in variantData for checkout integration
      variantData: {
        subscriptionPlan: SubscriptionPlans.MONTHLY,
        billingInterval: SubscriptionPlanDetails[SubscriptionPlans.MONTHLY].interval,
        upgradesToRole: 'paid'
      }
    };

    // Create annual membership product
    const annualProduct = {
      name: SubscriptionPlanDetails[SubscriptionPlans.ANNUAL].name,
      description: SubscriptionPlanDetails[SubscriptionPlans.ANNUAL].description,
      price: SubscriptionPlanDetails[SubscriptionPlans.ANNUAL].price / 100, // Convert cents to dollars
      category: 'memberships',
      status: 'active',
      imageUrls: ['/BBLogo.png'], // Use existing BBLogo.png image
      // Store subscription plan details in variantData for checkout integration
      variantData: {
        subscriptionPlan: SubscriptionPlans.ANNUAL,
        billingInterval: SubscriptionPlanDetails[SubscriptionPlans.ANNUAL].interval,
        upgradesToRole: 'paid'
      }
    };

    // Get the server URL - use localhost if not in production
    const baseUrl = process.env.API_URL || 'http://localhost:5000';
    
    // Send API request to create the monthly membership product
    console.log(`Sending POST request to ${baseUrl}/api/products for monthly membership`);
    const responseMonthly = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(monthlyProduct)
    });

    if (!responseMonthly.ok) {
      console.error('Failed to create monthly membership product:', await responseMonthly.text());
    } else {
      console.log('Monthly membership product created successfully');
    }

    // Send API request to create the annual membership product
    console.log(`Sending POST request to ${baseUrl}/api/products for annual membership`);
    const responseAnnual = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(annualProduct)
    });

    if (!responseAnnual.ok) {
      console.error('Failed to create annual membership product:', await responseAnnual.text());
    } else {
      console.log('Annual membership product created successfully');
    }

    console.log('Membership products creation complete!');
  } catch (error) {
    console.error('Error creating membership products:', error);
  }
}

// Run the script
createMembershipProducts();