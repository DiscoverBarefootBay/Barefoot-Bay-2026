/**
 * Printful API Routes
 * 
 * This file contains endpoints for interacting with the Printful API
 * for print-on-demand functionality. These routes expose the Printful
 * service functionality to the frontend.
 */

import { Router, Request, Response, NextFunction } from "express";
import * as printfulService from "../printful-service";
import passport from "passport";
import { validateAdmin } from "../auth";
import { runScheduledTasks, checkAllPrintfulOrders } from "../scheduled-tasks";
import fs from "fs";
import path from "path";
import { z } from "zod/v4";

// Config file path
const CONFIG_DIR = path.join(process.cwd(), "config");
const CONFIG_FILE = path.join(CONFIG_DIR, "print-service.json");

// Config schema
const PrintfulConfigSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
  storeId: z.string().min(1, "Store ID is required"),
  serviceProvider: z.literal("printful")
});

type PrintfulConfig = z.infer<typeof PrintfulConfigSchema>;

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Authentication middleware
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
};

const router = Router();

/**
 * Test the Printful API connection
 * GET /api/printful/test
 */
router.get("/test", requireAuth, validateAdmin, async (req, res) => {
  try {
    const result = await printfulService.testConnection();
    return res.json(result);
  } catch (error) {
    console.error("Error testing Printful connection:", error);
    return res.status(500).json({ error: "Failed to test Printful connection" });
  }
});

/**
 * Get Printful store information
 * GET /api/printful/store
 */
router.get("/store", requireAuth, validateAdmin, async (req, res) => {
  try {
    const result = await printfulService.getStore();
    return res.json(result);
  } catch (error) {
    console.error("Error getting Printful store:", error);
    return res.status(500).json({ error: "Failed to get Printful store information" });
  }
});

/**
 * Get product catalog
 * GET /api/printful/catalog
 */
router.get("/catalog", requireAuth, validateAdmin, async (req, res) => {
  try {
    const result = await printfulService.getProductCatalog();
    return res.json(result);
  } catch (error) {
    console.error("Error getting Printful catalog:", error);
    return res.status(500).json({ error: "Failed to get Printful catalog" });
  }
});

/**
 * Get store products
 * GET /api/printful/products
 */
router.get("/products", requireAuth, validateAdmin, async (req, res) => {
  try {
    const result = await printfulService.getStoreProducts();
    return res.json(result);
  } catch (error) {
    console.error("Error getting Printful store products:", error);
    return res.status(500).json({ error: "Failed to get Printful store products" });
  }
});

/**
 * Get specific product
 * GET /api/printful/products/:id
 */
router.get("/products/:id", requireAuth, validateAdmin, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    if (isNaN(productId)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }
    
    const result = await printfulService.getStoreProduct(productId);
    return res.json(result);
  } catch (error) {
    console.error("Error getting Printful product:", error);
    return res.status(500).json({ error: "Failed to get Printful product" });
  }
});

/**
 * Add a product to the store
 * POST /api/printful/products
 */
router.post("/products", requireAuth, validateAdmin, async (req, res) => {
  try {
    const productData = req.body;
    if (!productData) {
      return res.status(400).json({ error: "Missing product data" });
    }
    
    const result = await printfulService.addStoreProduct(productData);
    return res.json(result);
  } catch (error) {
    console.error("Error creating Printful product:", error);
    return res.status(500).json({ error: "Failed to create Printful product" });
  }
});

/**
 * Update a product in the store
 * PUT /api/printful/products/:id
 */
router.put("/products/:id", requireAuth, validateAdmin, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    if (isNaN(productId)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }
    
    const productData = req.body;
    if (!productData) {
      return res.status(400).json({ error: "Missing product data" });
    }
    
    const result = await printfulService.updateStoreProduct(productId, productData);
    return res.json(result);
  } catch (error) {
    console.error("Error updating Printful product:", error);
    return res.status(500).json({ error: "Failed to update Printful product" });
  }
});

/**
 * Delete a product from the store
 * DELETE /api/printful/products/:id
 */
router.delete("/products/:id", requireAuth, validateAdmin, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    if (isNaN(productId)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }
    
    const result = await printfulService.deleteStoreProduct(productId);
    return res.json(result);
  } catch (error) {
    console.error("Error deleting Printful product:", error);
    return res.status(500).json({ error: "Failed to delete Printful product" });
  }
});

/**
 * Get product variants
 * GET /api/printful/products/:id/variants
 */
router.get("/products/:id/variants", requireAuth, validateAdmin, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    if (isNaN(productId)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }
    
    const result = await printfulService.getStoreProductVariants(productId);
    return res.json(result);
  } catch (error) {
    console.error("Error getting Printful product variants:", error);
    return res.status(500).json({ error: "Failed to get Printful product variants" });
  }
});

/**
 * Create a product variant
 * POST /api/printful/products/:id/variants
 */
router.post("/products/:id/variants", requireAuth, validateAdmin, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    if (isNaN(productId)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }
    
    const variantData = req.body;
    if (!variantData) {
      return res.status(400).json({ error: "Missing variant data" });
    }
    
    const result = await printfulService.createStoreProductVariant(productId, variantData);
    return res.json(result);
  } catch (error) {
    console.error("Error creating Printful product variant:", error);
    return res.status(500).json({ error: "Failed to create Printful product variant" });
  }
});

/**
 * Update a product variant
 * PUT /api/printful/products/:id/variants/:variantId
 */
router.put("/products/:id/variants/:variantId", requireAuth, validateAdmin, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const variantId = parseInt(req.params.variantId);
    
    if (isNaN(productId) || isNaN(variantId)) {
      return res.status(400).json({ error: "Invalid product or variant ID" });
    }
    
    const variantData = req.body;
    if (!variantData) {
      return res.status(400).json({ error: "Missing variant data" });
    }
    
    const result = await printfulService.updateStoreProductVariant(productId, variantId, variantData);
    return res.json(result);
  } catch (error) {
    console.error("Error updating Printful product variant:", error);
    return res.status(500).json({ error: "Failed to update Printful product variant" });
  }
});

/**
 * Delete a product variant
 * DELETE /api/printful/products/:id/variants/:variantId
 */
router.delete("/products/:id/variants/:variantId", requireAuth, validateAdmin, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const variantId = parseInt(req.params.variantId);
    
    if (isNaN(productId) || isNaN(variantId)) {
      return res.status(400).json({ error: "Invalid product or variant ID" });
    }
    
    const result = await printfulService.deleteStoreProductVariant(productId, variantId);
    return res.json(result);
  } catch (error) {
    console.error("Error deleting Printful product variant:", error);
    return res.status(500).json({ error: "Failed to delete Printful product variant" });
  }
});

/**
 * Calculate shipping rates
 * POST /api/printful/shipping/rates
 */
router.post("/shipping/rates", requireAuth, async (req, res) => {
  try {
    const { items, address } = req.body;
    
    if (!items || !address) {
      return res.status(400).json({ error: "Missing items or address data" });
    }
    
    const result = await printfulService.calculateShipping(items, address);
    return res.json(result);
  } catch (error) {
    console.error("Error calculating shipping rates:", error);
    return res.status(500).json({ error: "Failed to calculate shipping rates" });
  }
});

/**
 * Create an order
 * POST /api/printful/orders
 */
router.post("/orders", requireAuth, validateAdmin, async (req, res) => {
  try {
    const { items, recipient, shipping } = req.body;
    
    if (!items || !recipient || !shipping) {
      return res.status(400).json({ error: "Missing order data" });
    }
    
    const result = await printfulService.createOrder(items, recipient, shipping);
    return res.json(result);
  } catch (error) {
    console.error("Error creating Printful order:", error);
    return res.status(500).json({ error: "Failed to create Printful order" });
  }
});

/**
 * Get all orders
 * GET /api/printful/orders
 */
router.get("/orders", requireAuth, validateAdmin, async (req, res) => {
  try {
    const { status, offset, limit } = req.query;
    
    const options: { status?: string; offset?: number; limit?: number } = {};
    
    if (status) options.status = status as string;
    if (offset) options.offset = parseInt(offset as string);
    if (limit) options.limit = parseInt(limit as string);
    
    const result = await printfulService.getOrders(options);
    return res.json(result);
  } catch (error) {
    console.error("Error getting Printful orders:", error);
    return res.status(500).json({ error: "Failed to get Printful orders" });
  }
});

/**
 * Get order status
 * GET /api/printful/orders/:id
 */
router.get("/orders/:id", requireAuth, validateAdmin, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    
    if (isNaN(orderId)) {
      return res.status(400).json({ error: "Invalid order ID" });
    }
    
    const result = await printfulService.getOrderStatus(orderId);
    return res.json(result);
  } catch (error) {
    console.error("Error getting Printful order status:", error);
    return res.status(500).json({ error: "Failed to get Printful order status" });
  }
});

/**
 * Create a mockup for a product
 * POST /api/printful/mockup
 */
router.post("/mockup", requireAuth, validateAdmin, async (req, res) => {
  try {
    const { variantId, placement, imageUrl } = req.body;
    
    if (!variantId || !placement || !imageUrl) {
      return res.status(400).json({ error: "Missing mockup data" });
    }
    
    const result = await printfulService.createMockup(variantId, placement, imageUrl);
    return res.json(result);
  } catch (error) {
    console.error("Error creating Printful mockup:", error);
    return res.status(500).json({ error: "Failed to create Printful mockup" });
  }
});

/**
 * Get sync products (read-only)
 * GET /api/printful/sync
 */
router.get("/sync", requireAuth, validateAdmin, async (req, res) => {
  try {
    const result = await printfulService.syncProducts();
    return res.json(result);
  } catch (error) {
    console.error("Error getting Printful sync products:", error);
    return res.status(500).json({ error: "Failed to get Printful sync products" });
  }
});

/**
 * Sync products to local database
 * POST /api/printful/sync
 */
router.post("/sync", requireAuth, validateAdmin, async (req, res) => {
  try {
    console.log('Starting Printful product sync to local database...');
    
    // Import the sync module
    const { syncAllPrintfulProducts } = await import('../printful-sync');
    
    // Perform the actual sync operation
    const syncedCount = await syncAllPrintfulProducts();
    
    return res.json({
      success: true,
      message: `Successfully synced ${syncedCount} products from Printful to the local database.`,
      syncedCount
    });
  } catch (error) {
    console.error("Error syncing Printful products to database:", error);
    return res.status(500).json({ 
      success: false,
      error: "Failed to sync Printful products to database",
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get specific sync product
 * GET /api/printful/sync/:id
 */
router.get("/sync/:id", requireAuth, validateAdmin, async (req, res) => {
  try {
    const syncProductId = parseInt(req.params.id);
    
    if (isNaN(syncProductId)) {
      return res.status(400).json({ error: "Invalid sync product ID" });
    }
    
    const result = await printfulService.getSyncProduct(syncProductId);
    return res.json(result);
  } catch (error) {
    console.error("Error getting Printful sync product:", error);
    return res.status(500).json({ error: "Failed to get Printful sync product" });
  }
});

/**
 * Manually trigger a check of all Printful orders for status updates
 * POST /api/printful/check-orders
 */
router.post("/check-orders", requireAuth, validateAdmin, async (req, res) => {
  try {
    console.log('Manually triggering Printful order status check');
    
    // Run the check
    const updatedCount = await checkAllPrintfulOrders();
    
    return res.json({
      success: true,
      message: `Order status check completed. Updated ${updatedCount} orders.`,
      updatedCount
    });
  } catch (error) {
    console.error("Error checking Printful orders:", error);
    return res.status(500).json({ 
      success: false,
      error: "Failed to check Printful orders",
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Manually trigger all scheduled tasks
 * POST /api/printful/run-scheduled-tasks
 */
router.post("/run-scheduled-tasks", requireAuth, validateAdmin, async (req, res) => {
  try {
    console.log('Manually triggering all scheduled tasks');
    
    // Run all scheduled tasks
    await runScheduledTasks();
    
    return res.json({
      success: true,
      message: "All scheduled tasks completed successfully"
    });
  } catch (error) {
    console.error("Error running scheduled tasks:", error);
    return res.status(500).json({ 
      success: false,
      error: "Failed to run scheduled tasks",
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Helper functions to manage Printful configuration
 */
 
// Save configuration to file
const savePrintfulConfig = (config: PrintfulConfig): boolean => {
  try {
    // Ensure serviceProvider is set to printful
    const configToSave = {
      ...config,
      serviceProvider: 'printful' as const
    };
    
    fs.writeFileSync(
      CONFIG_FILE,
      JSON.stringify(configToSave, null, 2),
      { encoding: 'utf8' }
    );
    return true;
  } catch (error) {
    console.error('Error saving Printful configuration:', error);
    return false;
  }
};

// Get current configuration
const getPrintfulConfig = (): Partial<PrintfulConfig> | null => {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const configData = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      return configData;
    }
  } catch (error) {
    console.error('Error reading Printful configuration:', error);
  }
  return null;
};

/**
 * Get Printful configuration (admin only)
 * Provides safe configuration data without exposing API key
 * GET /api/printful/config
 */
router.get("/config", requireAuth, validateAdmin, (req, res) => {
  try {
    const config = getPrintfulConfig();
    
    // Return safe configuration data
    return res.json({
      hasApiKey: Boolean(config?.apiKey),
      storeId: config?.storeId || null
    });
  } catch (error) {
    console.error('Error fetching Printful configuration:', error);
    return res.status(500).json({ error: 'Failed to fetch Printful configuration' });
  }
});

/**
 * Update Printful configuration (admin only)
 * POST /api/printful/update-config
 */
router.post("/update-config", requireAuth, validateAdmin, (req, res) => {
  try {
    const { apiKey, storeId } = req.body;
    
    if (!apiKey || !storeId) {
      return res.status(400).json({ error: 'API key and Store ID are required' });
    }
    
    // Create configuration object
    const configData: PrintfulConfig = {
      apiKey,
      storeId,
      serviceProvider: 'printful'
    };
    
    // Validate with schema
    try {
      PrintfulConfigSchema.parse(configData);
    } catch (validationError) {
      console.error('Printful config validation error:', validationError);
      return res.status(400).json({ 
        error: 'Invalid configuration data',
        details: validationError instanceof Error ? validationError.message : 'Validation failed'
      });
    }
    
    // Save configuration
    const success = savePrintfulConfig(configData);
    
    if (!success) {
      return res.status(500).json({ error: 'Failed to save configuration' });
    }
    
    // Return success with safe data
    return res.json({
      success: true,
      message: 'Printful API configuration updated successfully',
      hasApiKey: true,
      storeId
    });
  } catch (error) {
    console.error('Error updating Printful configuration:', error);
    return res.status(500).json({ 
      error: 'Failed to update Printful configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;