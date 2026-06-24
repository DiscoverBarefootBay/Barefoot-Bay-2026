/**
 * Serve Test Pages
 * 
 * This module provides endpoints for serving test HTML pages
 * to validate real estate media upload functionality.
 */

import { Request, Response, Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Serve the real estate upload test page
router.get('/real-estate-upload-test', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'real-estate-upload-test.html'));
});

// Serve the real estate listing test page
router.get('/real-estate-listing-test', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'real-estate-listing-test.html'));
});

export default router;