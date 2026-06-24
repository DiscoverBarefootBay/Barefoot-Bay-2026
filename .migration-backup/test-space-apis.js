/**
 * Test script for checking space-related API connectivity
 * 
 * This script tests connections to:
 * 1. Weather API (OpenWeatherMap)
 * 2. Rocket Launch API
 * 
 * Usage: node test-space-apis.js
 */

const fetch = require('node-fetch');

/**
 * Test OpenWeatherMap API
 */
async function testWeatherApi() {
  console.log('\n--- Testing OpenWeatherMap API ---');
  
  // Barefoot Bay, FL coordinates 
  const lat = 27.9589;
  const lon = -80.5603;
  const apiKey = process.env.OPENWEATHER_API_KEY;
  
  if (!apiKey) {
    console.log('❌ No OpenWeatherMap API key found in environment');
    return false;
  }

  try {
    console.log('Making request to OpenWeatherMap API...');
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${apiKey}`
    );
    
    const data = await response.json();
    console.log('Response status:', response.status);
    
    if (response.ok) {
      console.log('✅ OpenWeatherMap API is working!');
      console.log('Weather data:', {
        location: data.name,
        weather: data.weather[0]?.description,
        temperature: data.main?.temp,
        humidity: data.main?.humidity,
        wind: data.wind?.speed
      });
      return true;
    } else {
      console.log('❌ OpenWeatherMap API returned an error:');
      console.log('Error details:', JSON.stringify(data, null, 2));
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing OpenWeatherMap API:', error.message);
    return false;
  }
}

/**
 * Test Rocket Launch API (RocketLaunch.live)
 */
async function testRocketLaunchApi() {
  console.log('\n--- Testing Rocket Launch API ---');
  
  const apiKey = process.env.ROCKETLAUNCH_API_KEY;
  
  // Try to test with API key if available
  if (apiKey) {
    try {
      console.log('Making authenticated request to RocketLaunch.live API...');
      const response = await fetch(
        'https://fdo.rocketlaunch.live/json/launches/next/5',
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        }
      );
      
      const data = await response.json();
      console.log('Response status:', response.status);
      
      if (response.ok && data.result) {
        console.log('✅ RocketLaunch.live API is working with authentication!');
        console.log(`Found ${data.result} upcoming launches`);
        if (data.result > 0 && data.launches?.length > 0) {
          console.log('Next launch:', {
            name: data.launches[0].name,
            provider: data.launches[0].provider?.name,
            date: data.launches[0].date_str,
            location: data.launches[0].pad?.location?.name
          });
        }
        return true;
      } else {
        console.log('❌ Authenticated request failed. Trying public endpoint...');
      }
    } catch (error) {
      console.error('❌ Error with authenticated request:', error.message);
      console.log('Trying public endpoint...');
    }
  } else {
    console.log('No RocketLaunch.live API key found. Trying public endpoint...');
  }
  
  // Fall back to public endpoint
  try {
    console.log('Making public request to RocketLaunch.live API...');
    const response = await fetch('https://fdo.rocketlaunch.live/json/launches/next/5');
    
    const data = await response.json();
    console.log('Response status:', response.status);
    
    if (response.ok && data.result) {
      console.log('✅ RocketLaunch.live public API is working!');
      console.log(`Found ${data.result} upcoming launches`);
      if (data.result > 0 && data.launches?.length > 0) {
        console.log('Next launch:', {
          name: data.launches[0].name,
          provider: data.launches[0].provider?.name,
          date: data.launches[0].date_str,
          location: data.launches[0].pad?.location?.name
        });
      }
      return true;
    } else {
      console.log('❌ RocketLaunch.live API returned an error:');
      console.log('Error details:', JSON.stringify(data, null, 2));
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing RocketLaunch.live API:', error.message);
    return false;
  }
}

/**
 * Run all API tests
 */
async function testAllApis() {
  console.log('========================================');
  console.log('   SPACE APIs CONNECTION TEST');
  console.log('========================================');
  
  // Check available keys
  const keys = {
    weather: !!process.env.OPENWEATHER_API_KEY,
    rocketLaunch: !!process.env.ROCKETLAUNCH_API_KEY
  };
  
  console.log(`Available API keys: ${Object.values(keys).filter(Boolean).length}/2`);
  console.log('- OpenWeatherMap API key:', keys.weather ? '✓ Present' : '✗ Missing');
  console.log('- RocketLaunch API key:', keys.rocketLaunch ? '✓ Present' : '✗ Missing');
  
  // Run tests
  const results = {
    weather: await testWeatherApi(),
    rocketLaunch: await testRocketLaunchApi()
  };
  
  // Print summary
  console.log('\n========================================');
  console.log('             TEST SUMMARY');
  console.log('========================================');
  console.log('OpenWeatherMap API:', results.weather ? '✅ Working' : '❌ Not working');
  console.log('RocketLaunch API:', results.rocketLaunch ? '✅ Working' : '❌ Not working');
  
  const workingCount = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\nOverall result: ${workingCount}/${totalTests} APIs working`);
}

// Run all tests
testAllApis().catch(error => {
  console.error('Error running tests:', error);
});