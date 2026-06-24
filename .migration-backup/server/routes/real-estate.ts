import { Request, Response, Router } from "express";
import { storage } from "../storage";
import { requireAuth } from "../auth";

// Create router
const router = Router();

// Get new listings count since user's last for-sale visit
router.get("/new-listings-count", requireAuth, async (req: Request, res: Response) => {
  try {
    console.log("🏠 [FOR SALE BADGE] new-listings-count endpoint called");
    console.log("🏠 [FOR SALE BADGE] User authenticated:", !!req.user);
    const userId = req.user?.id;
    console.log("🏠 [FOR SALE BADGE] User ID:", userId);
    
    if (!userId) {
      console.log("🏠 [FOR SALE BADGE] No user ID found - user not properly authenticated");
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    console.log("🏠 [FOR SALE BADGE] Calling storage.getNewListingsCount with userId:", userId);
    const count = await storage.getNewListingsCount(userId);
    console.log("🏠 [FOR SALE BADGE] Listings count result:", count);
    res.status(200).json({ count });
  } catch (error) {
    console.error("🏠 [FOR SALE BADGE] Error getting new listings count:", error);
    console.error("🏠 [FOR SALE BADGE] Error stack:", error.stack);
    res.status(500).json({ error: "Failed to get new listings count" });
  }
});

// Update user's for-sale visit timestamp (call when user visits for-sale page)
router.post("/visit", requireAuth, async (req: Request, res: Response) => {
  try {
    console.log("🏠 [FOR SALE BADGE] visit endpoint called");
    const userId = req.user?.id;
    console.log("🏠 [FOR SALE BADGE] User ID for visit update:", userId);
    
    if (!userId) {
      console.log("🏠 [FOR SALE BADGE] No user ID found for visit update");
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    console.log("🏠 [FOR SALE BADGE] Calling storage.updateForSaleVisit with userId:", userId);
    await storage.updateForSaleVisit(userId);
    console.log("🏠 [FOR SALE BADGE] Visit updated successfully");
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("🏠 [FOR SALE BADGE] Error updating for-sale visit:", error);
    console.error("🏠 [FOR SALE BADGE] Error stack:", error.stack);
    res.status(500).json({ error: "Failed to update for-sale visit" });
  }
});

export default router;