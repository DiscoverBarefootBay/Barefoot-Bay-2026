import { Router } from "express";
import path from "path";
import fs from "fs";

const router = Router();

// API endpoint to list avatar files
router.get("/avatar-files", (req, res) => {
  try {
    // Check both avatar directories
    const rootAvatarsDir = path.join(process.cwd(), "avatars");
    const uploadsAvatarsDir = path.join(process.cwd(), "uploads", "avatars");
    
    let files = [];
    
    // Check if root avatars directory exists
    if (fs.existsSync(rootAvatarsDir)) {
      try {
        const rootFiles = fs.readdirSync(rootAvatarsDir);
        files.push(...rootFiles.map(file => `/avatars/${file}`));
      } catch (error) {
        console.error("Error reading root avatars directory:", error);
      }
    } else {
      console.log("Root avatars directory doesn't exist:", rootAvatarsDir);
    }
    
    // Check if uploads/avatars directory exists
    if (fs.existsSync(uploadsAvatarsDir)) {
      try {
        const uploadFiles = fs.readdirSync(uploadsAvatarsDir);
        files.push(...uploadFiles.map(file => `/uploads/avatars/${file}`));
      } catch (error) {
        console.error("Error reading uploads/avatars directory:", error);
      }
    } else {
      console.log("Uploads avatars directory doesn't exist:", uploadsAvatarsDir);
    }
    
    // Remove duplicates (same filename in both directories)
    files = [...new Set(files)];
    
    res.json({
      success: true,
      files
    });
  } catch (error) {
    console.error("Error fetching avatar files:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching avatar files",
      error: error.message
    });
  }
});

// Direct test endpoint that serves a static HTML page
router.get("/avatar-test", (req, res) => {
  const htmlPath = path.join(process.cwd(), "avatar-test.html");
  res.sendFile(htmlPath);
});

export default router;