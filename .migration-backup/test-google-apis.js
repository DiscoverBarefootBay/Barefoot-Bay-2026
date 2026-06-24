/**
 * Test script for checking Google API connectivity
 * 
 * This script tests connections to:
 * 1. Google Maps Geocoding API
 * 2. Google Places API (if key provided)
 * 3. Google Gemini API (if key provided)
 * 
 * Usage: node test-google-apis.js
 */

// Using native fetch as we're in ES module

// Get API keys from environment
const mapsApiKey = process.env.GOOGLE_MAPS_API_KEY || '';
const placesApiKey = process.env.GOOGLE_PLACES_API_KEY || '';
const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY || '';

/**
 * Test Google Maps Geocoding API
 */
async function testMapsGeocodingApi() {
  console.log('\n--- Testing Google Maps Geocoding API ---');
  
  if (!mapsApiKey) {
    console.log('❌ No Maps API key found in environment');
    return false;
  }

  try {
    console.log('Making request to Geocoding API...');
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=1600+Amphitheatre+Parkway,+Mountain+View,+CA&key=${mapsApiKey}`
    );
    
    const data = await response.json();
    console.log('Response status:', response.status);
    
    if (response.ok && data.status === 'OK') {
      console.log('✅ Maps Geocoding API is working!');
      console.log('Example data from response:', {
        formattedAddress: data.results[0]?.formatted_address,
        location: data.results[0]?.geometry?.location
      });
      return true;
    } else {
      console.log('❌ Maps Geocoding API returned an error:');
      console.log('Status:', data.status);
      console.log('Error message:', data.error_message || 'No error message');
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing Maps Geocoding API:', error.message);
    return false;
  }
}

/**
 * Test Google Places API - Nearby Search
 */
async function testPlacesApi() {
  console.log('\n--- Testing Google Places API ---');
  
  if (!placesApiKey) {
    console.log('❌ No Places API key found in environment');
    return false;
  }

  try {
    console.log('Making request to Places API (Nearby Search)...');
    // Example coordinates for Cape Canaveral
    const lat = 28.3922;
    const lng = -80.6077;
    
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=5000&type=restaurant&key=${placesApiKey}`
    );
    
    const data = await response.json();
    console.log('Response status:', response.status);
    
    if (response.ok && data.status === 'OK') {
      console.log('✅ Places API is working!');
      console.log(`Found ${data.results.length} nearby places`);
      if (data.results.length > 0) {
        console.log('First result:', {
          name: data.results[0].name,
          address: data.results[0].vicinity
        });
      }
      return true;
    } else {
      console.log('❌ Places API returned an error:');
      console.log('Status:', data.status);
      console.log('Error message:', data.error_message || 'No error message');
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing Places API:', error.message);
    return false;
  }
}

/**
 * Test Google Gemini API
 */
async function testGeminiApi() {
  console.log('\n--- Testing Google Gemini API ---');
  
  if (!geminiApiKey) {
    console.log('❌ No Gemini API key found in environment');
    return false;
  }

  try {
    console.log('Making request to Gemini API...');
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "Tell me about space exploration in 2 sentences."
                }
              ]
            }
          ]
        })
      }
    );
    
    const data = await response.json();
    console.log('Response status:', response.status);
    
    if (response.ok) {
      console.log('✅ Gemini API is working!');
      if (data.candidates && data.candidates.length > 0) {
        const text = data.candidates[0].content.parts[0].text;
        console.log('Response text:', text);
      }
      return true;
    } else {
      console.log('❌ Gemini API returned an error:');
      console.log('Error details:', JSON.stringify(data.error || {}, null, 2));
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing Gemini API:', error.message);
    return false;
  }
}

/**
 * Run all API tests
 */
async function testAllApis() {
  console.log('========================================');
  console.log('   GOOGLE APIs CONNECTION TEST');
  console.log('========================================');
  
  // Count available keys
  const keys = {
    maps: !!mapsApiKey,
    places: !!placesApiKey,
    gemini: !!geminiApiKey
  };
  
  console.log(`Available API keys: ${Object.values(keys).filter(Boolean).length}/3`);
  console.log('- Maps API key:', keys.maps ? '✓ Present' : '✗ Missing');
  console.log('- Places API key:', keys.places ? '✓ Present' : '✗ Missing');
  console.log('- Gemini API key:', keys.gemini ? '✓ Present' : '✗ Missing');
  
  // Run tests for available APIs
  const results = {
    maps: keys.maps ? await testMapsGeocodingApi() : false,
    places: keys.places ? await testPlacesApi() : false,
    gemini: keys.gemini ? await testGeminiApi() : false
  };
  
  // Print summary
  console.log('\n========================================');
  console.log('             TEST SUMMARY');
  console.log('========================================');
  console.log('Maps Geocoding API:', results.maps ? '✅ Working' : '❌ Not working');
  console.log('Places API:', results.places ? '✅ Working' : '❌ Not working');
  console.log('Gemini API:', results.gemini ? '✅ Working' : '❌ Not working');
  
  const workingCount = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\nOverall result: ${workingCount}/${totalTests} APIs working`);
}

// Run all tests
testAllApis().catch(error => {
  console.error('Error running tests:', error);
});