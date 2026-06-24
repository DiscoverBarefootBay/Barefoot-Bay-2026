/**
 * Emergency upload fix routes to ensure media files are properly uploaded to both
 * development (/uploads/...) and production (/...) locations.
 * 
 * This fixes the issue where images display in development but not in production.
 */

import express, { type Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { MEDIA_TYPES, ensureDirectoryExists } from './media-path-utils';

// Get directory path for ESM modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure multer for emergency upload handling
const upload = multer({
  storage: multer.diskStorage({
    destination: function (req: any, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) {
      // Determine media type from the request or query params
      const mediaType = req.query.mediaType || req.body.mediaType || 'calendar';
      
      // Store the media type on the request object for later use 
      req.mediaType = mediaType;
      
      // Create both the uploads directory and the production directory
      const uploadsDir = path.join(__dirname, '../uploads', mediaType);
      const prodDir = path.join(__dirname, '..', mediaType);
      
      // Ensure both directories exist
      ensureDirectoryExists(uploadsDir);
      ensureDirectoryExists(prodDir);
      
      console.log(`[EmergencyUpload] Using directory: ${uploadsDir} for type: ${mediaType}`);
      
      cb(null, uploadsDir);
    },
    filename: function (_req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  })
});

// Helper to process uploaded files and copy them to production location
function processUploadedFiles(req: any, files: Express.Multer.File[]) {
  if (!files || files.length === 0) {
    return { success: false, message: 'No files uploaded' };
  }
  
  const mediaType = req.mediaType || req.query.mediaType || 'calendar';
  const results = [];
  
  for (const file of files) {
    // Generate URLs for both development and production
    const developmentUrl = `/uploads/${mediaType}/${file.filename}`;
    const productionUrl = `/${mediaType}/${file.filename}`;
    
    // Copy the file to the production location
    const sourcePath = path.join(__dirname, '..', developmentUrl);
    const targetPath = path.join(__dirname, '..', productionUrl);
    
    try {
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`[EmergencyUpload] Copied ${sourcePath} to ${targetPath}`);
      
      results.push({
        originalname: file.originalname,
        filename: file.filename,
        developmentUrl,
        productionUrl
      });
    } catch (error) {
      console.error(`[EmergencyUpload] Error copying file to production location:`, error);
      // We still include the file in results even if copy fails, as it's available in uploads dir
      results.push({
        originalname: file.originalname,
        filename: file.filename,
        developmentUrl,
        productionUrl,
        copyError: true
      });
    }
  }
  
  return { success: true, files: results };
}

// Register the emergency upload routes
export function registerEmergencyUploadRoutes(app: express.Express) {
  // Create router for emergency upload endpoints
  const router = express.Router();
  
  // Add helper endpoints for testing and emergency uploads
  
  // Single file upload endpoint
  router.post('/emergency-upload', upload.single('file'), (req: any, res) => {
    console.log('[EmergencyUpload] Received single file upload request');
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    const mediaType = req.mediaType || req.query.mediaType || 'calendar';
    
    // Generate URLs
    const developmentUrl = `/uploads/${mediaType}/${req.file.filename}`;
    const productionUrl = `/${mediaType}/${req.file.filename}`;
    
    // Copy to production location
    const sourcePath = path.join(__dirname, '..', developmentUrl);
    const targetPath = path.join(__dirname, '..', productionUrl);
    
    try {
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`[EmergencyUpload] Copied ${sourcePath} to ${targetPath}`);
    } catch (error) {
      console.error(`[EmergencyUpload] Error copying file:`, error);
      // Continue even if copy fails, as the file is available in uploads dir
    }
    
    // Return success response with both URLs
    res.json({
      success: true,
      file: {
        originalname: req.file.originalname,
        filename: req.file.filename,
        developmentUrl,
        productionUrl
      }
    });
  });
  
  // Multiple files upload endpoint
  router.post('/emergency-upload-multiple', upload.array('files', 10), (req: any, res) => {
    console.log('[EmergencyUpload] Received multiple files upload request');
    
    const result = processUploadedFiles(req, req.files);
    res.json(result);
  });
  
  // Banner slides specific upload endpoint
  router.post('/emergency-banner-upload', upload.single('bannerImage'), (req: any, res) => {
    console.log('[EmergencyUpload] Received banner upload request');
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No banner image uploaded' });
    }
    
    // Set media type explicitly to banner-slides
    req.mediaType = MEDIA_TYPES.BANNER_SLIDES;
    
    // Generate URLs
    const developmentUrl = `/uploads/${req.mediaType}/${req.file.filename}`;
    const productionUrl = `/${req.mediaType}/${req.file.filename}`;
    
    // Copy to production location
    const sourcePath = path.join(__dirname, '..', developmentUrl);
    const targetPath = path.join(__dirname, '..', productionUrl);
    
    try {
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`[EmergencyUpload] Copied banner image ${sourcePath} to ${targetPath}`);
    } catch (error) {
      console.error(`[EmergencyUpload] Error copying banner image:`, error);
    }
    
    // Return success response with both URLs
    res.json({
      success: true,
      url: productionUrl, // Return the production URL as the primary URL
      developmentUrl,
      productionUrl
    });
  });
  
  // Calendar event upload endpoint
  router.post('/emergency-calendar-upload', upload.single('media'), (req: any, res) => {
    console.log('[EmergencyUpload] Received calendar media upload request');
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No media file uploaded' });
    }
    
    // Set media type explicitly to calendar
    req.mediaType = MEDIA_TYPES.CALENDAR;
    
    // Generate URLs
    const developmentUrl = `/uploads/${req.mediaType}/${req.file.filename}`;
    const productionUrl = `/${req.mediaType}/${req.file.filename}`;
    
    // Copy to production location
    const sourcePath = path.join(__dirname, '..', developmentUrl);
    const targetPath = path.join(__dirname, '..', productionUrl);
    
    try {
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`[EmergencyUpload] Copied calendar media ${sourcePath} to ${targetPath}`);
    } catch (error) {
      console.error(`[EmergencyUpload] Error copying calendar media:`, error);
    }
    
    // Return success response with both URLs
    res.json({
      success: true,
      url: productionUrl, // Return the production URL as the primary URL
      developmentUrl,
      productionUrl
    });
  });
  
  // Product image upload endpoint
  router.post('/emergency-product-upload', upload.single('image'), (req: any, res) => {
    console.log('[EmergencyUpload] Received product image upload request');
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No product image uploaded' });
    }
    
    // Set media type explicitly to products
    req.mediaType = MEDIA_TYPES.PRODUCTS;
    
    // Generate URLs
    const developmentUrl = `/uploads/${req.mediaType}/${req.file.filename}`;
    const productionUrl = `/${req.mediaType}/${req.file.filename}`;
    
    // Copy to production location
    const sourcePath = path.join(__dirname, '..', developmentUrl);
    const targetPath = path.join(__dirname, '..', productionUrl);
    
    try {
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`[EmergencyUpload] Copied product image ${sourcePath} to ${targetPath}`);
    } catch (error) {
      console.error(`[EmergencyUpload] Error copying product image:`, error);
    }
    
    // Return success response with both URLs
    res.json({
      success: true,
      imageUrl: productionUrl, // Return the production URL as the primary URL
      developmentUrl,
      productionUrl
    });
  });

  // Register the router on the app
  app.use('/api', router);
  
  console.log('[EmergencyUpload] Registered emergency upload routes');
  
  return router;
}