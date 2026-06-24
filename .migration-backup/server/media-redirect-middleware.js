/**
 * Media Path Redirection Middleware for Barefoot Bay
 * 
 * This middleware automatically handles the path difference between development and production
 * by redirecting requests with '/uploads/' prefix to their correct locations.
 * 
 * It also normalizes paths in API responses to ensure consistent formats.
 */

const fs = require('fs');
const path = require('path');

/**
 * Middleware that handles media path redirections and normalizations
 */
function mediaRedirectMiddleware(req, res, next) {
  // Store original send function
  const originalSend = res.send;
  
  // Override send to handle API responses with media paths
  res.send = function(body) {
    // Only process JSON responses
    if (typeof body === 'string' && body.startsWith('{')) {
      try {
        // Try to parse as JSON
        const data = JSON.parse(body);
        // Normalize paths in the response
        normalizeMediaPathsInObject(data);
        // Re-stringify with normalized paths
        body = JSON.stringify(data);
      } catch (e) {
        // Not valid JSON, continue with original body
      }
    }
    
    // Call original send with possibly modified body
    return originalSend.call(this, body);
  };
  
  // Handle direct requests to /uploads paths
  if (req.path.startsWith('/uploads/')) {
    const normalizedPath = req.path.replace('/uploads/', '/');
    
    // Check if the file exists at the normalized path
    const filePath = path.join(process.cwd(), normalizedPath);
    if (fs.existsSync(filePath)) {
      return res.redirect(normalizedPath);
    }
    
    // If file doesn't exist at normalized path, check original path
    const originalFilePath = path.join(process.cwd(), req.path);
    if (fs.existsSync(originalFilePath)) {
      // Serve from original path but log the issue
      console.log(`Media path warning: ${req.path} should be ${normalizedPath}`);
    }
  }
  
  next();
}

/**
 * Recursively normalize media paths in objects and arrays
 * @param {Object|Array} obj - Object or array to normalize
 */
function normalizeMediaPathsInObject(obj) {
  if (!obj || typeof obj !== 'object') return;
  
  // Process each property of the object
  for (const key in obj) {
    const value = obj[key];
    
    if (typeof value === 'string') {
      // Fix string paths
      if (value.startsWith('/uploads/')) {
        obj[key] = value.replace('/uploads/', '/');
      }
    } else if (Array.isArray(value)) {
      // Process each item in arrays
      for (let i = 0; i < value.length; i++) {
        if (typeof value[i] === 'string' && value[i].startsWith('/uploads/')) {
          value[i] = value[i].replace('/uploads/', '/');
        } else if (typeof value[i] === 'object') {
          normalizeMediaPathsInObject(value[i]);
        }
      }
    } else if (value && typeof value === 'object') {
      // Recursively process nested objects
      normalizeMediaPathsInObject(value);
    }
  }
}

module.exports = mediaRedirectMiddleware;