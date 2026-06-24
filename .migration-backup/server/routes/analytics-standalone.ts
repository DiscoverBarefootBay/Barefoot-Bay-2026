/**
 * Standalone analytics dashboard route
 * This serves a completely self-contained HTML page that doesn't rely on React
 */

import express from 'express';

const router = express.Router();

// Direct HTML route that doesn't rely on React routing
router.get('/simple-analytics', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Analytics Dashboard</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.5;
      margin: 0;
      padding: 0;
      color: #333;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    header {
      background-color: #ffffff;
      padding: 1rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 2rem;
    }
    h1 {
      margin: 0;
      font-size: 1.75rem;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background: white;
      border-radius: 8px;
      padding: 1.5rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .stat-card h2 {
      margin-top: 0;
      font-size: 1rem;
      color: #666;
    }
    .stat-card p {
      font-size: 2rem;
      font-weight: bold;
      margin: 0;
    }
    .chart-container {
      background: white;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 2rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .map-container {
      background: white;
      border-radius: 8px;
      padding: 1.5rem;
      height: 400px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      border: 1px dashed #ddd;
      border-radius: 4px;
      color: #999;
    }
    .nav-link {
      display: inline-block;
      margin-top: 1rem;
      color: #0066cc;
      text-decoration: none;
    }
    .nav-link:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <header>
    <div class="container">
      <h1>Analytics Dashboard</h1>
    </div>
  </header>
  
  <div class="container">
    <div class="stats-grid">
      <div class="stat-card">
        <h2>Page Views</h2>
        <p>15,278</p>
      </div>
      <div class="stat-card">
        <h2>Unique Visitors</h2>
        <p>4,209</p>
      </div>
      <div class="stat-card">
        <h2>Avg. Session Duration</h2>
        <p>2m 23s</p>
      </div>
      <div class="stat-card">
        <h2>Bounce Rate</h2>
        <p>32%</p>
      </div>
    </div>
    
    <div class="chart-container">
      <h2>Traffic Sources</h2>
      <div class="placeholder" style="height: 250px;">
        Traffic source visualization would appear here
      </div>
    </div>
    
    <div class="map-container">
      <h2>Visitor Locations</h2>
      <div class="placeholder">
        Geographic map would appear here
      </div>
    </div>
    
    <a href="/" class="nav-link">Back to Home</a>
  </div>

  <script>
    // Simple analytics data could be loaded here with fetch
    console.log('Analytics dashboard loaded');
  </script>
</body>
</html>
  `;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

export default router;