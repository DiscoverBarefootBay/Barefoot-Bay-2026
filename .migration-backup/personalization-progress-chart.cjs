/**
 * Script to generate a visual HTML report of event image personalization progress
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Initialize PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Target event IDs we're tracking
const TARGET_EVENTS = [338, 341, 342, 343, 344, 345];
const EVENT_NAMES = {
  338: 'LAP SWIMMING',
  341: 'HYDRO EXERCISE',
  342: 'AQUATIC AEROBICS',
  343: 'AQUA ZUMBA',
  344: 'BEGINNER LINE DANCE',
  345: 'LINE DANCING'
};

/**
 * Create HTML progress report with visual elements
 */
async function createVisualReport() {
  try {
    console.log('Generating visual personalization progress report...');
    
    // Get events
    const { rows } = await pool.query(`
      SELECT id, title, media_urls, description
      FROM events 
      WHERE id = ANY($1)
      ORDER BY id
    `, [TARGET_EVENTS]);
    
    console.log(`Found ${rows.length} events to analyze`);
    
    // Track overall progress and event data
    let totalPersonalized = 0;
    const eventsData = [];
    
    // Process each event
    for (const event of rows) {
      const mediaUrls = event.media_urls || [];
      const imageCount = mediaUrls.length;
      
      // Check if images are personalized (not the generic social-X.jpg pattern)
      const genericImages = mediaUrls.filter(url => url.includes('social-')).length;
      const personalizedImages = imageCount - genericImages;
      
      // Calculate completion percentage
      const completionPercentage = Math.round((personalizedImages / 2) * 100);
      
      // Update total
      totalPersonalized += personalizedImages;
      
      // Add to events data
      eventsData.push({
        id: event.id,
        title: event.title,
        description: event.description ? event.description.substring(0, 150) + '...' : 'No description',
        mediaUrls,
        personalizedImages,
        genericImages,
        completionPercentage,
        status: personalizedImages >= 2 ? 'COMPLETE' : 'IN PROGRESS'
      });
    }
    
    // Calculate overall progress
    const totalExpectedImages = TARGET_EVENTS.length * 2;
    const overallPercentage = Math.round((totalPersonalized / totalExpectedImages) * 100);
    
    // Generate HTML content
    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Event Image Personalization Progress</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 {
      color: #2c3e50;
      border-bottom: 2px solid #3498db;
      padding-bottom: 10px;
    }
    h2 {
      color: #2980b9;
      margin-top: 30px;
    }
    .progress-container {
      margin: 40px 0;
      text-align: center;
    }
    .progress-circle {
      position: relative;
      width: 200px;
      height: 200px;
      border-radius: 50%;
      background: #e0e0e0;
      display: inline-block;
      overflow: hidden;
    }
    .progress-circle::after {
      content: '';
      position: absolute;
      top: 10px;
      left: 10px;
      width: 180px;
      height: 180px;
      border-radius: 50%;
      background: white;
    }
    .progress-circle-fill {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      clip: rect(0px, 200px, 200px, 100px);
      transform: rotate(0deg);
      background: #3498db;
      transition: transform 0.5s;
    }
    .progress-circle-value {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 10;
      font-size: 36px;
      font-weight: bold;
      color: #2c3e50;
    }
    .event-card {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 20px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      display: flex;
      gap: 20px;
    }
    .event-info {
      flex: 2;
    }
    .event-images {
      flex: 1;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .event-image {
      width: 150px;
      height: 100px;
      object-fit: cover;
      border-radius: 4px;
    }
    .event-progress {
      height: 20px;
      background-color: #e0e0e0;
      border-radius: 10px;
      margin: 10px 0;
      overflow: hidden;
    }
    .event-progress-bar {
      height: 100%;
      border-radius: 10px;
      background-color: #3498db;
      width: 0%;
      transition: width 0.5s;
    }
    .event-progress-text {
      margin-top: 5px;
      font-size: 14px;
      color: #7f8c8d;
    }
    .complete {
      background-color: #2ecc71;
    }
    .in-progress {
      background-color: #f39c12;
    }
    .timestamp {
      font-size: 14px;
      color: #7f8c8d;
      margin-top: 5px;
    }
  </style>
</head>
<body>
  <h1>Event Image Personalization Progress</h1>
  <p class="timestamp">Generated: ${new Date().toLocaleString()}</p>
  
  <div class="progress-container">
    <div class="progress-circle">
      <div id="progress-fill" class="progress-circle-fill"></div>
      <div class="progress-circle-value">${overallPercentage}%</div>
    </div>
    <h2>Overall Progress</h2>
    <p>Personalized images: ${totalPersonalized} / ${totalExpectedImages}</p>
  </div>
  
  <h2>Individual Event Status</h2>`;
    
    // Add each event card
    for (const event of eventsData) {
      html += `
  <div class="event-card">
    <div class="event-info">
      <h3>${event.title} (ID: ${event.id})</h3>
      <p>${event.description}</p>
      <div class="event-progress">
        <div class="event-progress-bar ${event.status === 'COMPLETE' ? 'complete' : 'in-progress'}" style="width: ${event.completionPercentage}%"></div>
      </div>
      <p class="event-progress-text">Status: ${event.status} (${event.completionPercentage}%)</p>
      <p class="event-progress-text">Images: ${event.personalizedImages} personalized, ${event.genericImages} generic</p>
    </div>
    <div class="event-images">`;
      
      // Add images
      for (const url of event.mediaUrls) {
        html += `
      <img class="event-image" src="${url}" alt="Event image" />`;
      }
      
      html += `
    </div>
  </div>`;
    }
    
    // Close HTML
    html += `
  <script>
    // Animate progress circle
    window.onload = function() {
      const value = ${overallPercentage};
      const fill = document.getElementById('progress-fill');
      
      // Set initial rotation based on percentage
      const rotation = value / 100 * 360;
      
      // Animate by setting transform and changing background for > 50%
      setTimeout(() => {
        if (rotation <= 180) {
          fill.style.transform = 'rotate(' + rotation + 'deg)';
        } else {
          fill.style.transform = 'rotate(180deg)';
          
          // Create second half for > 50%
          const secondHalf = document.createElement('div');
          secondHalf.className = 'progress-circle-fill';
          secondHalf.style.transform = 'rotate(' + (rotation - 180) + 'deg)';
          secondHalf.style.clip = 'rect(0px, 100px, 200px, 0px)';
          document.querySelector('.progress-circle').appendChild(secondHalf);
        }
      }, 500);
      
      // Animate progress bars
      const bars = document.querySelectorAll('.event-progress-bar');
      bars.forEach(bar => {
        const width = bar.style.width;
        bar.style.width = '0%';
        setTimeout(() => {
          bar.style.width = width;
        }, 500);
      });
    };
  </script>
</body>
</html>`;
    
    // Write HTML to file
    fs.writeFileSync('personalization-report.html', html);
    console.log('Visual report saved to personalization-report.html');
    
  } catch (err) {
    console.error('Error generating visual report:', err);
  } finally {
    await pool.end();
    console.log('Database connection closed');
  }
}

// Create the visual report
createVisualReport().catch(console.error);