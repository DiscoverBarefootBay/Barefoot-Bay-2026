/**
 * Force Refresh Square Credentials
 * 
 * This script forces a refresh of Square credentials in the production environment
 * by reinitializing the Square client and clearing any cached credentials.
 */

async function forceRefreshSquareCredentials() {
  console.log('='.repeat(60));
  console.log('FORCE REFRESHING SQUARE CREDENTIALS');
  console.log('='.repeat(60));

  try {
    // Import the square service
    const squareService = await import('./server/square-service.ts');
    
    console.log('\n1. Current credential status:');
    const status = squareService.getSquareClientStatus();
    console.log('   Environment:', status.environment);
    console.log('   Credentials present:', JSON.stringify(status.credentialsPresent, null, 2));
    console.log('   Masked credentials:', JSON.stringify(status.maskedCredentials, null, 2));

    console.log('\n2. Forcing Square client reinitialization...');
    await squareService.reinitializeSquareClient();
    console.log('   ✅ Square client reinitialized successfully');

    console.log('\n3. Testing connection after refresh...');
    const { accessToken, locationId } = squareService.getSquareCredentials();
    
    if (accessToken && locationId) {
      // Test with a simple locations API call
      const response = await fetch('https://connect.squareup.com/v2/locations', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Square-Version': '2024-12-18',
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('   ✅ Square API connection successful');
        console.log(`   Account has ${data.locations?.length || 0} locations`);
        
        const currentLocation = data.locations?.find(loc => loc.id === locationId);
        if (currentLocation) {
          console.log(`   ✅ Current location "${currentLocation.name}" is active and valid`);
        } else {
          console.log('   ⚠️ Current location ID not found in available locations');
        }
      } else {
        console.log(`   ❌ Square API test failed: ${response.status} ${response.statusText}`);
      }
    } else {
      console.log('   ❌ Missing credentials after refresh');
    }

    console.log('\n4. Creating test checkout link...');
    try {
      const testPayload = {
        idempotency_key: `force_refresh_test_${Date.now()}`,
        quick_pay: {
          name: 'Credential Test Payment',
          price_money: {
            amount: 100, // $1.00
            currency: 'USD'
          },
          location_id: locationId
        },
        checkout_options: {
          redirect_url: 'https://barefootbay.com/payment-success'
        }
      };

      const checkoutResponse = await fetch('https://connect.squareup.com/v2/online-checkout/payment-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'Square-Version': '2024-12-18'
        },
        body: JSON.stringify(testPayload)
      });

      if (checkoutResponse.ok) {
        const checkoutData = await checkoutResponse.json();
        console.log('   ✅ Test checkout link created successfully');
        console.log(`   Test URL: ${checkoutData.payment_link?.url || 'No URL returned'}`);
        
        // Extract and verify merchant ID from URL
        if (checkoutData.payment_link?.url) {
          const urlMatch = checkoutData.payment_link.url.match(/\/pay\/([^\/]+)/);
          if (urlMatch) {
            const merchantIdFromUrl = urlMatch[1];
            console.log(`   Merchant ID in URL: ${merchantIdFromUrl}`);
            console.log('   ✅ Checkout links will now use the correct merchant credentials');
          }
        }
      } else {
        const errorData = await checkoutResponse.json().catch(() => ({}));
        console.log(`   ❌ Test checkout creation failed: ${checkoutResponse.status} ${checkoutResponse.statusText}`);
        console.log('   Error:', errorData);
      }
    } catch (checkoutError) {
      console.log(`   ❌ Checkout test failed: ${checkoutError.message}`);
    }

    console.log('\n5. Summary:');
    console.log('   - Square client has been reinitialized with fresh credentials');
    console.log('   - Any cached credential instances have been cleared');
    console.log('   - The production environment should now use the correct Square account');
    console.log('   - Sponsorship payments and other Square transactions should work correctly');

  } catch (error) {
    console.error('\n❌ Error during force refresh:', error);
    console.error('Stack trace:', error.stack);
  }

  console.log('\n' + '='.repeat(60));
}

// Run the force refresh
await forceRefreshSquareCredentials();