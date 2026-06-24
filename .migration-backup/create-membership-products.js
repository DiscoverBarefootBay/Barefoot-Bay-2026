/**
 * Create membership products in the store
 * 
 * This script creates two membership products: a monthly subscription at $5/month
 * and an annual subscription at $50/year. These products will be available in the
 * store's MEMBERSHIPS category and will automatically upgrade users to "paid" status
 * when purchased.
 */

import 'dotenv/config';
import fetch from 'node-fetch';

// Define subscription plans and details directly since we can't import from .ts files
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
      imageUrls: ['/uploads/membership-monthly.png'], 
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
      imageUrls: ['/uploads/membership-annual.png'],
      // Store subscription plan details in variantData for checkout integration
      variantData: {
        subscriptionPlan: SubscriptionPlans.ANNUAL,
        billingInterval: SubscriptionPlanDetails[SubscriptionPlans.ANNUAL].interval,
        upgradesToRole: 'paid'
      }
    };

    // Create placeholder images for the products if they don't exist
    await createPlaceholderImage('membership-monthly.png', '#4f46e5', 'Monthly Membership');
    await createPlaceholderImage('membership-annual.png', '#16a34a', 'Annual Membership');

    // Send API requests to create the products
    const baseUrl = process.env.API_URL || 'http://localhost:5000';
    const responseMonthly = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': process.env.ADMIN_SESSION_COOKIE || '' // Admin session cookie for authentication
      },
      body: JSON.stringify(monthlyProduct)
    });

    if (!responseMonthly.ok) {
      console.error('Failed to create monthly membership product:', await responseMonthly.text());
    } else {
      console.log('Monthly membership product created successfully');
    }

    const responseAnnual = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': process.env.ADMIN_SESSION_COOKIE || '' // Admin session cookie for authentication
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

// Import node modules for file operations
import fs from 'fs';
import path from 'path';
import { createCanvas } from 'canvas';

// Helper function to create placeholder image files
async function createPlaceholderImage(filename, bgColor, text) {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const filePath = path.join(uploadsDir, filename);
  
  // Skip if file already exists
  if (fs.existsSync(filePath)) {
    console.log(`Image already exists: ${filePath}`);
    return;
  }

  try {
    // Create a simple colored rectangle with text
    const canvas = createCanvas(600, 400);
    const ctx = canvas.getContext('2d');
    
    // Fill background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 600, 400);
    
    // Add text
    ctx.fillStyle = 'white';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 300, 200);
    
    // Save the image
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filePath, buffer);
    
    console.log(`Created placeholder image: ${filePath}`);
  } catch (err) {
    console.error(`Error creating placeholder image ${filename}:`, err);
    // Create a fallback plain file if canvas fails
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '');
      console.log(`Created empty file instead: ${filePath}`);
    }
  }
}

// Run the script
createMembershipProducts();