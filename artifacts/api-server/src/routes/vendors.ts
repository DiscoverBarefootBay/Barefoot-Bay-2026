import { Router } from "express";
import { IStorage } from "../storage";
import { requireAuth } from "../auth";
import { z } from "zod/v4";
import { insertVendorCommentSchema, insertVendorInteractionSchema } from "@workspace/db";

export function createVendorRouter(storage: IStorage) {
  const router = Router();

  // Get comments for a vendor page
  router.get("/:slug/comments", async (req, res) => {
    try {
      const pageSlug = req.params.slug;
      if (!pageSlug) {
        return res.status(400).json({ message: "Invalid vendor page slug" });
      }

      const comments = await storage.getVendorComments(pageSlug);
      
      // Ensure we always return an array, even if comments is undefined
      const commentsArray = Array.isArray(comments) ? comments : [];
      console.log(`Retrieved ${commentsArray.length} comments for vendor page ${pageSlug}`);
      
      res.json(commentsArray);
    } catch (error) {
      console.error("Error fetching comments for vendor page:", error);
      res.status(500).json({ message: "Failed to fetch comments for vendor page" });
    }
  });

  // Add a comment to a vendor page
  router.post("/:slug/comments", requireAuth, async (req, res) => {
    try {
      const pageSlug = req.params.slug;
      if (!pageSlug) {
        return res.status(400).json({ message: "Invalid vendor page slug" });
      }

      // Special case: Handle admins directly by role name, not UserRole.ADMIN constant
      // This ensures we're capturing actual admins regardless of UserRole enum issues
      const hasAdminRole = req.user.role === 'admin';
      const isApproved = req.user.isApproved === true;
      const isBlocked = req.user.isBlocked === true;
      
      // Log user approval status to help with debugging
      console.log('Vendor comment request:', {
        userId: req.user.id,
        username: req.user.username,
        role: req.user.role,
        hasAdminRole,
        isApproved,
        isBlocked
      });
      
      // User can comment if they are not blocked, admins bypass all restrictions
      // Blocked users can never comment
      const canComment = hasAdminRole || !isBlocked;
      
      // No further checks needed for admin users - they can always comment regardless of approval
      if (!canComment) {
        return res.status(403).json({ 
          message: "You don't have permission to comment on vendor pages" 
        });
      }

      const { content } = req.body;
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ message: "Comment content is required" });
      }

      const newComment = await storage.createVendorComment({
        pageSlug,
        userId: req.user.id,
        content: content.trim()
      });

      // Get the user data to include with the comment
      const user = await storage.getUser(req.user.id);
      const commentWithUser = {
        ...newComment,
        user: user ? {
          id: user.id,
          username: user.username,
          avatarUrl: user.avatarUrl,
          isResident: user.isResident
        } : undefined
      };

      res.status(201).json(commentWithUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid comment data", errors: error.errors });
      }
      console.error("Error creating vendor comment:", error);
      res.status(500).json({ message: "Failed to create vendor comment" });
    }
  });

  // Delete a vendor comment
  router.delete("/comments/:id", requireAuth, async (req, res) => {
    try {
      const commentId = parseInt(req.params.id, 10);
      if (isNaN(commentId)) {
        return res.status(400).json({ message: "Invalid comment ID" });
      }

      const isAdmin = req.user.role === 'admin';
      
      // Admin can delete any comment
      // Regular users can only delete their own comments
      if (isAdmin) {
        await storage.deleteVendorComment(commentId, 0); // 0 signifies admin override
      } else {
        await storage.deleteVendorComment(commentId, req.user.id);
      }
      
      res.json({ success: true, message: "Comment deleted successfully" });
    } catch (error) {
      console.error("Error deleting vendor comment:", error);
      res.status(500).json({ message: "Failed to delete vendor comment" });
    }
  });

  // Get interactions for a vendor page
  router.get("/:slug/interactions", async (req, res) => {
    try {
      const pageSlug = req.params.slug;
      if (!pageSlug) {
        return res.status(400).json({ message: "Invalid vendor page slug" });
      }

      const interactions = await storage.getVendorInteractions(pageSlug);
      
      // Ensure we always return an array, even if interactions is undefined
      const interactionsArray = Array.isArray(interactions) ? interactions : [];
      console.log(`Retrieved ${interactionsArray.length} interactions for vendor page ${pageSlug}`);
      
      res.json(interactionsArray);
    } catch (error) {
      console.error("Error fetching interactions for vendor page:", error);
      res.status(500).json({ message: "Failed to fetch interactions for vendor page" });
    }
  });

  // Add/toggle an interaction for a vendor page
  router.post("/:slug/interactions", requireAuth, async (req, res) => {
    try {
      const pageSlug = req.params.slug;
      if (!pageSlug) {
        return res.status(400).json({ message: "Invalid vendor page slug" });
      }

      // Special case: Handle admins directly by role name, not UserRole.ADMIN constant
      // This ensures we're capturing actual admins regardless of UserRole enum issues
      const hasAdminRole = req.user.role === 'admin';
      const isApproved = req.user.isApproved === true;
      const isBlocked = req.user.isBlocked === true;
      
      // Log user approval status for debugging
      console.log('Vendor interaction request:', {
        userId: req.user.id,
        username: req.user.username,
        role: req.user.role,
        hasAdminRole, 
        isApproved,
        isBlocked
      });
      
      // User can interact if they are not blocked, admins bypass all restrictions
      // Blocked users can never interact
      const canInteract = hasAdminRole || !isBlocked;
      
      if (!canInteract) {
        return res.status(403).json({ 
          message: "You don't have permission to interact with vendor pages" 
        });
      }

      const { type } = req.body;
      if (!type || !['like', 'recommend'].includes(type)) {
        return res.status(400).json({ message: "Invalid interaction type" });
      }

      // Check if interaction already exists (for toggle behavior)
      const existingInteraction = await storage.getVendorInteraction(pageSlug, req.user.id, type);

      if (existingInteraction) {
        // If interaction exists, delete it (toggle behavior)
        await storage.deleteVendorInteraction(pageSlug, req.user.id, type);
        res.json({ success: true, message: "Interaction removed" });
      } else {
        // Create new interaction
        const newInteraction = await storage.createVendorInteraction({
          pageSlug,
          userId: req.user.id,
          interactionType: type
        });

        res.status(201).json(newInteraction);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid interaction data", errors: error.errors });
      }
      console.error("Error processing vendor interaction:", error);
      res.status(500).json({ message: "Failed to process vendor interaction" });
    }
  });

  // Delete all vendors endpoint (admin only)
  router.delete("/", requireAuth, async (req, res) => {
    try {
      // Check for admin permissions
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.deleteAllVendors();
      res.status(200).json({ message: "All vendors have been deleted successfully" });
    } catch (error) {
      console.error("Error deleting all vendors:", error);
      res.status(500).json({ message: "Failed to delete all vendors" });
    }
  });

  // Get new vendor pages count since last visit
  router.get("/new-pages-count", requireAuth, async (req, res) => {
    try {
      console.log("🏬 [VENDOR BADGE] new-pages-count endpoint called");
      console.log("🏬 [VENDOR BADGE] User authenticated:", !!req.user);
      console.log("🏬 [VENDOR BADGE] User ID:", req.user?.id);

      if (!req.user?.id) {
        console.error("🏬 [VENDOR BADGE] User ID not found in request");
        return res.status(401).json({ message: "User not authenticated" });
      }

      console.log("🏬 [VENDOR BADGE] Calling storage.getNewVendorPagesCount with userId:", req.user.id);
      const count = await storage.getNewVendorPagesCount(req.user.id);
      console.log("🏬 [VENDOR BADGE] Vendor pages count result:", count);

      res.json({ count });
    } catch (error) {
      console.error("🏬 [VENDOR BADGE] Error getting new vendor pages count:", error);
      res.status(500).json({ message: "Failed to get new vendor pages count" });
    }
  });

  // Update vendor visit timestamp
  router.post("/visit", requireAuth, async (req, res) => {
    try {
      console.log("🏬 [VENDOR BADGE] visit endpoint called");
      console.log("🏬 [VENDOR BADGE] User authenticated:", !!req.user);
      console.log("🏬 [VENDOR BADGE] User ID:", req.user?.id);

      if (!req.user?.id) {
        console.error("🏬 [VENDOR BADGE] User ID not found in request");
        return res.status(401).json({ message: "User not authenticated" });
      }

      console.log("🏬 [VENDOR BADGE] Calling storage.updateVendorVisit with userId:", req.user.id);
      await storage.updateVendorVisit(req.user.id);
      console.log("🏬 [VENDOR BADGE] Vendor visit updated successfully");

      res.json({ success: true });
    } catch (error) {
      console.error("🏬 [VENDOR BADGE] Error updating vendor visit:", error);
      res.status(500).json({ message: "Failed to update vendor visit" });
    }
  });

  // Mark a specific vendor page as visited
  router.post("/mark-visited/:slug", requireAuth, async (req, res) => {
    try {
      const vendorSlug = req.params.slug;
      console.log(`🔖 [VENDOR PAGE VISIT] Marking vendor as visited: ${vendorSlug} for user ${req.user?.id}`);

      if (!req.user?.id) {
        console.error("🔖 [VENDOR PAGE VISIT] User ID not found in request");
        return res.status(401).json({ message: "User not authenticated" });
      }

      if (!vendorSlug) {
        return res.status(400).json({ message: "Vendor slug is required" });
      }

      await storage.markVendorPageAsVisited(req.user.id, vendorSlug);
      console.log(`🔖 [VENDOR PAGE VISIT] Successfully marked ${vendorSlug} as visited`);

      res.json({ success: true });
    } catch (error) {
      console.error("🔖 [VENDOR PAGE VISIT] Error marking vendor page as visited:", error);
      res.status(500).json({ message: "Failed to mark vendor page as visited" });
    }
  });

  // Get list of unvisited vendor page slugs for the current user
  router.get("/unvisited", requireAuth, async (req, res) => {
    try {
      console.log(`📋 [UNVISITED VENDORS] Getting unvisited vendors for user ${req.user?.id}`);

      if (!req.user?.id) {
        console.error("📋 [UNVISITED VENDORS] User ID not found in request");
        return res.status(401).json({ message: "User not authenticated" });
      }

      const unvisitedSlugs = await storage.getUnvisitedVendorSlugs(req.user.id);
      console.log(`📋 [UNVISITED VENDORS] Found ${unvisitedSlugs.length} unvisited vendors`);

      res.json({ unvisitedSlugs });
    } catch (error) {
      console.error("📋 [UNVISITED VENDORS] Error getting unvisited vendors:", error);
      res.status(500).json({ message: "Failed to get unvisited vendors" });
    }
  });

  return router;
}