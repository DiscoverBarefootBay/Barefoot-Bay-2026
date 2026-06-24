import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';

/**
 * Production CSS Middleware
 * 
 * This middleware ensures CSS assets are properly served in production
 * and adds fallback CSS injection if main styles are missing
 */

const CRITICAL_CSS = `
/* Critical production CSS to prevent layout stacking */
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  box-sizing: border-box;
}

*, *::before, *::after {
  box-sizing: border-box;
}

.min-h-screen {
  min-height: 100vh !important;
}

.flex {
  display: flex !important;
}

.flex-col {
  flex-direction: column !important;
}

.container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding-left: 1rem;
  padding-right: 1rem;
}

nav {
  position: relative;
  z-index: 50;
}

main {
  flex: 1;
  width: 100%;
}

/* Responsive layout fixes */
@media (max-width: 768px) {
  .container {
    padding-left: 0.5rem;
    padding-right: 0.5rem;
  }
}
`;

export function productionCssMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only apply in production
    if (process.env.NODE_ENV !== 'production') {
      return next();
    }

    // Check if request is for HTML page
    if (req.path === '/' || req.path.endsWith('.html') || !req.path.includes('.')) {
      const originalSend = res.send;
      
      res.send = function(body: any) {
        if (typeof body === 'string' && body.includes('<html')) {
          // Inject critical CSS to prevent layout issues
          const criticalStyleTag = `<style id="critical-css">${CRITICAL_CSS}</style>`;
          
          // Insert critical CSS in head
          if (body.includes('<head>')) {
            body = body.replace('<head>', `<head>${criticalStyleTag}`);
          } else if (body.includes('<html>')) {
            body = body.replace('<html>', `<html><head>${criticalStyleTag}</head>`);
          }
          
          // Add CSS loading validation script
          const validationScript = `
            <script>
              (function() {
                // Check if main CSS is loaded
                let cssLoaded = false;
                const stylesheets = document.styleSheets;
                
                for (let i = 0; i < stylesheets.length; i++) {
                  try {
                    if (stylesheets[i].href && stylesheets[i].href.includes('assets/')) {
                      cssLoaded = true;
                      break;
                    }
                  } catch (e) {
                    // Security error accessing cross-origin stylesheet
                    cssLoaded = true; // Assume it's loaded if we can't check
                  }
                }
                
                if (!cssLoaded) {
                  console.warn('[Production CSS] Main stylesheet not detected, critical CSS applied');
                }
                
                // Remove critical CSS once main CSS is loaded
                window.addEventListener('load', function() {
                  setTimeout(function() {
                    const criticalCss = document.getElementById('critical-css');
                    if (criticalCss && cssLoaded) {
                      criticalCss.remove();
                    }
                  }, 1000);
                });
              })();
            </script>
          `;
          
          body = body.replace('</body>', `${validationScript}</body>`);
        }
        
        return originalSend.call(this, body);
      };
    }

    next();
  };
}

export function cssAssetValidation() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check for CSS asset requests
    if (req.path.endsWith('.css')) {
      const filePath = path.join(process.cwd(), 'dist/public', req.path);
      
      if (!fs.existsSync(filePath)) {
        console.warn(`[Production CSS] Missing CSS file: ${req.path}`);
        
        // Return critical CSS as fallback
        res.setHeader('Content-Type', 'text/css');
        return res.send(CRITICAL_CSS);
      }
    }
    
    next();
  };
}