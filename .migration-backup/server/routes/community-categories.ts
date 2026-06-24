import { Router } from "express";
import { IStorage } from "../storage";
import { requireAuth, requireAdmin } from "../auth";
import { z } from "zod";
import { insertCommunityCategorySchema } from "@shared/schema";

export function createCommunityCategoryRouter(storage: IStorage) {
  const router = Router();

  // Get all community categories
  router.get("/", async (req, res) => {
    try {
      const categories = await storage.getCommunityCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching community categories:", error);
      res.status(500).json({ message: "Failed to fetch community categories" });
    }
  });

  // Get a specific community category by ID
  router.get("/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid community category ID" });
      }

      const category = await storage.getCommunityCategory(id);
      if (!category) {
        return res.status(404).json({ message: "Community category not found" });
      }

      res.json(category);
    } catch (error) {
      console.error("Error fetching community category:", error);
      res.status(500).json({ message: "Failed to fetch community category" });
    }
  });

  // Create a new community category (admin only)
  router.post("/", requireAuth, requireAdmin, async (req, res) => {
    try {
      const validatedData = insertCommunityCategorySchema.parse(req.body);
      
      // Check if a category with the same slug already exists
      const existingCategory = await storage.getCommunityCategoryBySlug(validatedData.slug);
      if (existingCategory) {
        return res.status(400).json({ message: "A category with this slug already exists" });
      }

      const newCategory = await storage.createCommunityCategory(validatedData);
      res.status(201).json(newCategory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid community category data", errors: error.errors });
      }
      console.error("Error creating community category:", error);
      res.status(500).json({ message: "Failed to create community category" });
    }
  });

  // Update an existing community category (admin only)
  router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid community category ID" });
      }

      // Check if the category exists
      const existingCategory = await storage.getCommunityCategory(id);
      if (!existingCategory) {
        return res.status(404).json({ message: "Community category not found" });
      }

      // Track if slug is being changed to update related pages
      const isSlugChanging = req.body.slug && req.body.slug !== existingCategory.slug;
      const oldSlug = existingCategory.slug;
      const newSlug = req.body.slug;

      // If slug is being updated, check it's not already in use by another category
      if (isSlugChanging) {
        const categoryWithSlug = await storage.getCommunityCategoryBySlug(newSlug);
        if (categoryWithSlug && categoryWithSlug.id !== id) {
          return res.status(400).json({ message: "A category with this slug already exists" });
        }
      }

      // Validate the update data
      const validationSchema = insertCommunityCategorySchema
        .partial()
        .refine(data => Object.keys(data).length > 0, {
          message: "At least one field must be provided for update"
        });

      const validatedData = validationSchema.parse(req.body);
      const updatedCategory = await storage.updateCommunityCategory(id, validatedData);
      
      // If the slug changed, update all pages that use the old slug as prefix
      if (isSlugChanging) {
        try {
          console.log(`Category slug changed from "${oldSlug}" to "${newSlug}". Updating related pages...`);
          const updatedPagesResult = await storage.updatePageSlugsForCategoryChange(oldSlug, newSlug);
          console.log(`Updated ${updatedPagesResult.count} pages with new category slug`);
          
          // Add this information to the response
          return res.json({
            ...updatedCategory,
            _meta: {
              updatedPages: updatedPagesResult.count,
              pageIds: updatedPagesResult.updatedIds
            }
          });
        } catch (updateError) {
          console.error("Error updating page slugs:", updateError);
          // Still return success for the category update, but include error info
          return res.json({
            ...updatedCategory,
            _meta: {
              updatedPages: 0,
              error: "Failed to update related page slugs"
            }
          });
        }
      }
      
      res.json(updatedCategory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid update data", errors: error.errors });
      }
      console.error("Error updating community category:", error);
      res.status(500).json({ message: "Failed to update community category" });
    }
  });

  // Delete a community category (admin only)
  router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid community category ID" });
      }

      // Check if the category exists
      const existingCategory = await storage.getCommunityCategory(id);
      if (!existingCategory) {
        return res.status(404).json({ message: "Community category not found" });
      }

      await storage.deleteCommunityCategory(id);
      res.json({ success: true, message: "Community category deleted successfully" });
    } catch (error) {
      console.error("Error deleting community category:", error);
      res.status(500).json({ message: "Failed to delete community category" });
    }
  });

  return router;
}