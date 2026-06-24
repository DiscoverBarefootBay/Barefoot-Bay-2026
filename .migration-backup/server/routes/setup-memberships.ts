import { Request, Response, Router } from "express";
import { storage } from "../storage";
import { insertProductSchema } from "@shared/schema";
import path from "path";
import fs from "fs";

const router = Router();

// Constants for subscription plans
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

// Setup membership products
router.post("/", async (req: Request, res: Response) => {
  try {
    console.log("Setting up membership products");
    
    // Check for secret key to ensure only authorized calls
    const secretKey = req.query.key || req.body.key;
    if (secretKey !== "setup-barefoot-memberships") {
      return res.status(401).json({ 
        error: "Unauthorized", 
        message: "Invalid setup key provided" 
      });
    }
    
    const results = {
      categoryCreated: false,
      monthlyCreated: false,
      annualCreated: false,
      errors: [] as string[]
    };
    
    // We'll check for existing products in the 'memberships' category
    let existingProducts;
    try {
      // Use the existing method to check for products with the memberships category
      existingProducts = await storage.getProductsByCategory('memberships');
      console.log(`Found ${existingProducts.length} existing products in memberships category`);
      
      // If we were able to find products, the category exists
      results.categoryCreated = false;
      console.log("Memberships category already exists");
    } catch (error) {
      console.log("No products found in memberships category, assuming it's new");
      existingProducts = [];
      
      // The category will be created automatically when creating products
      results.categoryCreated = true;
    }
    
    // Create monthly membership product
    try {
      // Check if the product already exists by name, using the existingProducts we already loaded
      const monthlyExists = existingProducts.some(p => 
        p.name === SubscriptionPlanDetails[SubscriptionPlans.MONTHLY].name);
      
      if (!monthlyExists) {
        // Prepare image URL, using the BBLogo as fallback
        let imageUrl = '/BBLogo.png';
        
        // Create product in database
        const monthlyProduct = await storage.createProduct({
          name: SubscriptionPlanDetails[SubscriptionPlans.MONTHLY].name,
          description: SubscriptionPlanDetails[SubscriptionPlans.MONTHLY].description,
          price: SubscriptionPlanDetails[SubscriptionPlans.MONTHLY].price / 100, // Convert cents to dollars
          category: 'memberships',
          status: 'active',
          imageUrls: [imageUrl],
          createdBy: null,
          // Store subscription plan details in variantData for checkout integration
          variantData: {
            subscriptionPlan: SubscriptionPlans.MONTHLY,
            billingInterval: SubscriptionPlanDetails[SubscriptionPlans.MONTHLY].interval,
            upgradesToRole: 'paid'
          }
        });
        
        results.monthlyCreated = true;
        console.log("Monthly membership product created successfully:", monthlyProduct);
      } else {
        console.log("Monthly membership already exists");
      }
    } catch (error) {
      console.error("Error creating monthly membership:", error);
      results.errors.push("Failed to create monthly membership");
    }
    
    // Create annual membership product
    try {
      // Check if the product already exists by name, using the existingProducts we already loaded
      const annualExists = existingProducts.some(p => 
        p.name === SubscriptionPlanDetails[SubscriptionPlans.ANNUAL].name);
      
      if (!annualExists) {
        // Prepare image URL, using the BBLogo as fallback
        let imageUrl = '/BBLogo.png';
        
        // Create product in database
        const annualProduct = await storage.createProduct({
          name: SubscriptionPlanDetails[SubscriptionPlans.ANNUAL].name,
          description: SubscriptionPlanDetails[SubscriptionPlans.ANNUAL].description,
          price: SubscriptionPlanDetails[SubscriptionPlans.ANNUAL].price / 100, // Convert cents to dollars
          category: 'memberships',
          status: 'active',
          imageUrls: [imageUrl],
          createdBy: null,
          // Store subscription plan details in variantData for checkout integration
          variantData: {
            subscriptionPlan: SubscriptionPlans.ANNUAL,
            billingInterval: SubscriptionPlanDetails[SubscriptionPlans.ANNUAL].interval,
            upgradesToRole: 'paid'
          }
        });
        
        results.annualCreated = true;
        console.log("Annual membership product created successfully:", annualProduct);
      } else {
        console.log("Annual membership already exists");
      }
    } catch (error) {
      console.error("Error creating annual membership:", error);
      results.errors.push("Failed to create annual membership");
    }
    
    // Return success or error status
    if (results.errors.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Membership products setup completed successfully",
        ...results
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Some membership products setup steps failed",
        ...results
      });
    }
  } catch (error) {
    console.error("Error setting up membership products:", error);
    return res.status(500).json({ 
      error: "Internal server error", 
      message: "Failed to set up membership products" 
    });
  }
});

export default router;