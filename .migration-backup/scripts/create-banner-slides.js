// Script to create initial banner slides content
import fetch from 'node-fetch';

async function createBannerSlides() {
  try {
    const defaultBannerSlides = [
      {
        src: "/uploads/banner-slides/bannerImage-1741926522955-8756145.png", 
        alt: "Barefoot Bay Community",
        caption: "Welcome to Barefoot Bay",
        link: "/amenities",
        buttonText: "Explore Amenities",
        bgPosition: "center"
      },
      {
        src: "/uploads/banner-slides/bannerImage-1741927053069-856446994.png",
        alt: "Barefoot Bay Events",
        caption: "Join Our Community Events",
        link: "/calendar",
        buttonText: "View Calendar",
        bgPosition: "center"
      }
    ];

    // Create banner slides content
    const response = await fetch('https://10d91268-aa00-4bbf-8cbc-902453f7f73d-00-y43hx7t2mc3m.janeway.replit.dev/api/pages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        slug: "banner-slides",
        title: "Homepage Banner Slides",
        content: JSON.stringify(defaultBannerSlides)
      }),
      credentials: 'include'
    });

    const result = await response.json();
    console.log('Banner slides created:', result);
  } catch (error) {
    console.error('Error creating banner slides:', error);
  }
}

// Run the function
createBannerSlides();