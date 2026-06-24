import { Request, Response, Router, NextFunction } from "express";
import { storage } from "../storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import { insertProductSchema, Product } from "@workspace/db";
import { validateAdmin, requireAuth } from "../auth";

// Configure multer for design file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(process.cwd(), "uploads/designs");
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const uniquePrefix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniquePrefix + path.extname(file.originalname));
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// Configure multer for product image uploads
const uploadProductImage = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(process.cwd(), "uploads/products");
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const uniquePrefix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, `product-${uniquePrefix}${path.extname(file.originalname)}`);
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only image files are allowed"));
  },
});

// Create router
const router = Router();

// Add debugging middleware for all products routes
router.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`🛍️ [PRODUCTS ROUTER] ${req.method} ${req.path}`, { originalUrl: req.originalUrl });
  next();
});

// Get all products
router.get("/", async (req: Request, res: Response) => {
  try {
    const products = await storage.getProducts();
    res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// Get highlighted products
// Modified to return empty array - FEATURED section complete removal
router.get("/highlighted", async (req: Request, res: Response) => {
  // Return empty array to prevent frontend from showing any highlighted products
  res.status(200).json([]);
});

// Legacy endpoint for backward compatibility
// Modified to return empty array - FEATURED section complete removal
router.get("/featured", async (req: Request, res: Response) => {
  // Return empty array to prevent frontend from showing the featured section
  res.status(200).json([]);
});

// Get products by category
router.get("/category/:category", async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const products = await storage.getProductsByCategory(category);
    res.status(200).json(products);
  } catch (error) {
    console.error(`Error fetching products in category ${req.params.category}:`, error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// Store badge endpoints - these MUST come before /:id route to avoid being caught by wildcard

// Get new products count since user's last store visit
router.get("/new-products-count", requireAuth, async (req: Request, res: Response) => {
  try {
    console.log("🏪 [STORE BADGE] new-products-count endpoint called");
    console.log("🏪 [STORE BADGE] User authenticated:", !!req.user);
    const userId = req.user?.id;
    console.log("🏪 [STORE BADGE] User ID:", userId);
    
    if (!userId) {
      console.log("🏪 [STORE BADGE] No user ID found - user not properly authenticated");
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    console.log("🏪 [STORE BADGE] Calling storage.getNewProductsCount with userId:", userId);
    const count = await storage.getNewProductsCount(userId);
    console.log("🏪 [STORE BADGE] Products count result:", count);
    res.status(200).json({ count });
  } catch (error) {
    console.error("🏪 [STORE BADGE] Error getting new products count:", error);
    console.error("🏪 [STORE BADGE] Error stack:", error.stack);
    res.status(500).json({ error: "Failed to get new products count" });
  }
});

// Update user's store visit timestamp (call when user visits store page)
router.post("/visit", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    await storage.updateStoreVisit(userId);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error updating store visit:", error);
    res.status(500).json({ error: "Failed to update store visit" });
  }
});

// Get a single product (WILDCARD ROUTE - MUST BE LAST)
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const product = await storage.getProduct(id);
    
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    res.status(200).json(product);
  } catch (error) {
    console.error(`Error fetching product ${req.params.id}:`, error);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

// Create a new product (admin only)
router.post("/", validateAdmin, async (req: Request, res: Response) => {
  try {
    const validatedData = insertProductSchema.parse(req.body);
    
    // Add current user as creator
    const productData = {
      ...validatedData,
      createdBy: req.user?.id || null,
    };
    
    const newProduct = await storage.createProduct(productData);
    res.status(201).json(newProduct);
  } catch (error) {
    console.error("Error creating product:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid product data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create product" });
  }
});

// Update a product (admin only)
router.patch("/:id", validateAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const product = await storage.getProduct(id);
    
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    // Update the product
    const updatedProduct = await storage.updateProduct(id, req.body);
    res.status(200).json(updatedProduct);
  } catch (error) {
    console.error(`Error updating product ${req.params.id}:`, error);
    res.status(500).json({ error: "Failed to update product" });
  }
});

// Delete a product (admin only)
router.delete("/:id", validateAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const product = await storage.getProduct(id);
    
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    await storage.deleteProduct(id);
    res.status(204).send();
  } catch (error) {
    console.error(`Error deleting product ${req.params.id}:`, error);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

// Upload product image (admin only)
router.post("/upload/product-image", validateAdmin, uploadProductImage.single("image"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file uploaded" });
    }
    
    // Create the image URL paths for both development and production
    const developmentUrl = `/uploads/products/${req.file.filename}`;
    const productionUrl = `/products/${req.file.filename}`;
    
    // Ensure the production directory exists
    const prodDir = path.join(process.cwd(), "products");
    if (!fs.existsSync(prodDir)) {
      fs.mkdirSync(prodDir, { recursive: true });
    }
    
    // Copy the file to the production location
    const sourcePath = path.join(process.cwd(), developmentUrl);
    const targetPath = path.join(process.cwd(), productionUrl);
    
    try {
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`[ProductImage] Copied ${sourcePath} to ${targetPath}`);
    } catch (copyError) {
      console.error(`[ProductImage] Error copying file to production location:`, copyError);
      // We continue even if the copy fails, as the file is available in uploads dir
    }
    
    // Return both URLs, but use production URL as the main one
    res.status(200).json({
      imageUrl: productionUrl, // Use production URL as primary
      developmentUrl,
      productionUrl,
      message: "Image uploaded successfully"
    });
  } catch (error) {
    console.error("Error uploading product image:", error);
    res.status(500).json({ error: "Failed to upload product image" });
  }
});

// Upload design and generate mockups (admin only)
router.post("/design", validateAdmin, upload.single("design"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No design file uploaded" });
    }
    
    const productId = parseInt(req.body.productId);
    const product = await storage.getProduct(productId);
    
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    // Save the file path to the design URLs
    const designUrl = `/uploads/designs/${req.file.filename}`;
    let designUrls = product.designUrls || [];
    designUrls.push(designUrl);
    
    // In a real implementation, we would call the print provider API here
    // to generate mockups. For now, we'll simulate the response.
    
    // Generate a mockup URL (in production this would come from the API)
    const mockupUrl = `/uploads/mockups/${path.parse(req.file.filename).name}-mockup.jpg`;
    let mockupUrls = product.mockupUrls || [];
    mockupUrls.push(mockupUrl);
    
    // Update the product with the new URLs
    const updatedProduct = await storage.updateProduct(productId, {
      designUrls,
      mockupUrls,
    });
    
    res.status(200).json(updatedProduct);
  } catch (error) {
    console.error("Error uploading design:", error);
    res.status(500).json({ error: "Failed to upload design" });
  }
});

// Delete all products (admin only)
router.delete("/", validateAdmin, async (req: Request, res: Response) => {
  try {
    await storage.deleteAllProducts();
    res.status(200).json({ message: "All store products have been deleted successfully" });
  } catch (error) {
    console.error("Error deleting all products:", error);
    res.status(500).json({ error: "Failed to delete all products" });
  }
});

export default router;