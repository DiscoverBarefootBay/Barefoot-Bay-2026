import { Router } from "express";
import { IStorage } from "../storage";
import { requireAuth, requireAdmin } from "../auth";
import { z } from "zod";
import { insertVendorCategorySchema } from "@shared/schema";

export function createVendorCategoryRouter(storage: IStorage) {
  const router = Router();

  // Get all vendor categories
  router.get("/", async (req, res) => {
    try {
      // Check if the user is an admin
      const isAdmin = req.user && req.user.role === 'admin';
      
      // Include hidden categories if explicitly requested OR if the user is an admin
      let includeHidden = req.query.includeHidden === 'true';
      
      // If user is admin and not specifically requesting non-hidden categories
      if (isAdmin && req.query.includeHidden !== 'false') {
        // For admin users, always include hidden categories by default
        includeHidden = true;
        console.log('Admin user accessing vendor categories, including hidden items');
      }
      
      // Pass the includeHidden parameter to the storage method
      const categories = await storage.getVendorCategories(includeHidden);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching vendor categories:", error);
      res.status(500).json({ message: "Failed to fetch vendor categories" });
    }
  });

  // Get a specific vendor category by ID
  router.get("/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid vendor category ID" });
      }

      const category = await storage.getVendorCategory(id);
      if (!category) {
        return res.status(404).json({ message: "Vendor category not found" });
      }

      res.json(category);
    } catch (error) {
      console.error("Error fetching vendor category:", error);
      res.status(500).json({ message: "Failed to fetch vendor category" });
    }
  });

  // Create a new vendor category (admin only)
  router.post("/", requireAuth, requireAdmin, async (req, res) => {
    try {
      const validatedData = insertVendorCategorySchema.parse(req.body);
      
      // Check if a category with the same slug already exists
      const existingCategory = await storage.getVendorCategoryBySlug(validatedData.slug);
      if (existingCategory) {
        return res.status(400).json({ message: "A category with this slug already exists" });
      }

      const newCategory = await storage.createVendorCategory(validatedData);
      res.status(201).json(newCategory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid vendor category data", errors: error.errors });
      }
      console.error("Error creating vendor category:", error);
      res.status(500).json({ message: "Failed to create vendor category" });
    }
  });

  // Update an existing vendor category (admin only)
  router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid vendor category ID" });
      }

      // Check if the category exists
      const existingCategory = await storage.getVendorCategory(id);
      if (!existingCategory) {
        return res.status(404).json({ message: "Vendor category not found" });
      }

      // Track if slug is being changed to update related pages
      const isSlugChanging = req.body.slug && req.body.slug !== existingCategory.slug;
      const oldSlug = existingCategory.slug;
      const newSlug = req.body.slug;

      // If slug is being updated, check it's not already in use by another category
      if (isSlugChanging) {
        const categoryWithSlug = await storage.getVendorCategoryBySlug(newSlug);
        if (categoryWithSlug && categoryWithSlug.id !== id) {
          return res.status(400).json({ message: "A category with this slug already exists" });
        }
      }

      // Validate the update data
      const validationSchema = insertVendorCategorySchema
        .partial()
        .refine(data => Object.keys(data).length > 0, {
          message: "At least one field must be provided for update"
        });

      const validatedData = validationSchema.parse(req.body);
      const updatedCategory = await storage.updateVendorCategory(id, validatedData);
      
      // If the slug changed, update all vendor pages that use the old slug in their pattern
      if (isSlugChanging) {
        try {
          console.log(`Vendor category slug changed from "${oldSlug}" to "${newSlug}". Updating related pages...`);
          const updatedPagesResult = await storage.updatePageSlugsForVendorCategoryChange(oldSlug, newSlug);
          console.log(`Updated ${updatedPagesResult.count} vendor pages with new category slug`);
          
          // Add this information to the response
          return res.json({
            ...updatedCategory,
            _meta: {
              updatedPages: updatedPagesResult.count,
              pageIds: updatedPagesResult.updatedIds
            }
          });
        } catch (updateError) {
          console.error("Error updating vendor page slugs:", updateError);
          // Still return success for the category update, but include error info
          return res.json({
            ...updatedCategory,
            _meta: {
              error: "Failed to update some vendor page slugs"
            }
          });
        }
      }
      
      res.json(updatedCategory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid update data", errors: error.errors });
      }
      console.error("Error updating vendor category:", error);
      res.status(500).json({ message: "Failed to update vendor category" });
    }
  });

  // Delete a vendor category (admin only)
  router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid vendor category ID" });
      }

      // Check if the category exists
      const existingCategory = await storage.getVendorCategory(id);
      if (!existingCategory) {
        return res.status(404).json({ message: "Vendor category not found" });
      }

      await storage.deleteVendorCategory(id);
      res.json({ success: true, message: "Vendor category deleted successfully" });
    } catch (error) {
      console.error("Error deleting vendor category:", error);
      res.status(500).json({ message: "Failed to delete vendor category" });
    }
  });

  return router;
}