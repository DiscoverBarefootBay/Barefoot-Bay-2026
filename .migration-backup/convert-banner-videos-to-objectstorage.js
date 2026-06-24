/**
 * Client-side script to update banner slide video links to use Object Storage URLs
 *
 * Instead of using server-side modules directly, we'll:
 * 1. Fetch the banner slides data using the API
 * 2. Convert video URLs to use Object Storage format
 * 3. Save the updated data back via the API
 */

// Function to handle API authentication
async function loginAsAdmin() {
  console.log('Logging in as admin...');
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: 'admin',
      password: 'password123', // Replace with actual admin password
    }),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status} ${response.statusText}`);
  }

  console.log('Login successful');
  return response;
}

// Function to get banner slides from the API
async function getBannerSlides() {
  console.log('Fetching banner slides data...');
  const response = await fetch('/api/pages/banner-slides');
  
  if (!response.ok) {
    throw new Error(`Failed to get banner slides: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  console.log(`Found banner slides with ID: ${data.id}`);
  
  return data;
}

// Function to save updated banner slides
async function saveBannerSlides(slides, pageId) {
  console.log('Saving updated banner slides...');
  
  const updateData = {
    slug: "banner-slides",
    title: "Homepage Banner Slides",
    content: JSON.stringify(slides),
    createVersion: true,
    versionNotes: "Update video URLs to use Object Storage"
  };
  
  const response = await fetch(`/api/pages/${pageId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updateData),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update banner slides: ${response.status} ${response.statusText}`);
  }
  
  console.log('Banner slides updated successfully');
  return response;
}

// Extract filename from path
function getFilename(url) {
  if (!url) return null;
  
  // Handle different path formats
  if (url.startsWith('/uploads/banner-slides/')) {
    return url.replace('/uploads/banner-slides/', '');
  } else if (url.startsWith('/banner-slides/')) {
    return url.replace('/banner-slides/', '');
  } else if (url.includes('object-storage.replit.app')) {
    const parts = url.split('/');
    return parts[parts.length - 1];
  }
  
  return null;
}

// Check if the file has a video extension
function isVideoFile(filename) {
  if (!filename) return false;
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi'];
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  return videoExtensions.includes(ext);
}

// Convert video URLs to Object Storage format
function convertVideoUrl(url) {
  if (!url || url.includes('object-storage.replit.app')) {
    return url; // Already an Object Storage URL or empty
  }
  
  const filename = getFilename(url);
  if (!filename) {
    console.log(`Could not extract filename from URL: ${url}`);
    return url;
  }
  
  if (!isVideoFile(filename)) {
    return url; // Not a video file
  }
  
  // Generate the Object Storage URL
  const bucket = 'BANNER'; // Use the BANNER bucket
  return `https://object-storage.replit.app/${bucket}/banner-slides/${filename}`;
}

// Main function to process banner slides
async function processBannerSlides() {
  try {
    // First authenticate (optional if your API doesn't require auth)
    try {
      await loginAsAdmin();
    } catch (loginError) {
      console.warn('Login failed, proceeding without authentication:', loginError);
      // Continue without auth in case the endpoint is publicly accessible
    }
    
    // Get banner slides
    const pageData = await getBannerSlides();
    
    // Parse content
    let slides;
    try {
      slides = JSON.parse(pageData.content);
      console.log(`Found ${slides.length} banner slides`);
    } catch (parseError) {
      console.error('Error parsing banner slides JSON:', parseError);
      return;
    }
    
    // Track changes
    let changeCount = 0;
    
    // Process each slide
    const updatedSlides = slides.map(slide => {
      if (!slide.src) return slide;
      
      // Check if this is a video that needs conversion
      const filename = getFilename(slide.src);
      if (filename && isVideoFile(filename) && !slide.src.includes('object-storage.replit.app')) {
        const newUrl = convertVideoUrl(slide.src);
        console.log(`Converting video URL: ${slide.src} to ${newUrl}`);
        changeCount++;
        
        return {
          ...slide,
          src: newUrl,
          // Also ensure mediaType is set correctly
          mediaType: slide.mediaType || 'video'
        };
      }
      
      return slide;
    });
    
    // Save changes if any were made
    if (changeCount > 0) {
      console.log(`Updating ${changeCount} video URLs in database...`);
      await saveBannerSlides(updatedSlides, pageData.id);
      console.log('✅ All video URLs have been updated to use Object Storage format');
    } else {
      console.log('No video URLs needed to be updated');
    }
  } catch (error) {
    console.error('Error processing banner slides:', error);
  }
}

// Run the script
processBannerSlides();

console.log(`
===============================
INSTRUCTIONS FOR MANUAL UPDATE
===============================
If the automated script doesn't work, follow these manual steps:

1. Go to the admin dashboard banner slide editor
2. For each video banner slide:
   - Note the current video filename
   - Click "Edit" on the slide
   - Temporarily change the media to an image
   - Save the slide
   - Edit it again and re-upload the same video file
   - This will ensure it gets stored in Object Storage
   - Save the slide

The system is now set up to automatically use Object Storage for 
new video uploads, so this is only needed for existing videos.
`);