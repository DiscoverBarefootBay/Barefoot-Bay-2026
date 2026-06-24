/**
 * Test the complete listing contact endpoint to identify where the 500 error occurs
 */

import { storage } from './server/storage.js';
import dotenv from 'dotenv';

dotenv.config();

async function testListingContactEndpoint() {
  console.log('Testing Listing Contact Endpoint Components');
  console.log('==========================================');
  
  // Test with listing ID 80 as mentioned in the production error
  const listingId = 80;
  
  try {
    console.log('\n1. Testing listing retrieval...');
    const listing = await storage.getListing(listingId);
    
    if (!listing) {
      console.log('❌ ISSUE FOUND: Listing not found for ID:', listingId);
      console.log('This would cause a 404 error, not 500');
      return;
    }
    
    console.log('✅ Listing found:', {
      id: listing.id,
      title: listing.title,
      hasContactInfo: !!listing.contactInfo
    });
    
    console.log('\n2. Testing contact info validation...');
    const contactInfo = listing.contactInfo;
    
    if (!contactInfo) {
      console.log('❌ ISSUE FOUND: No contact info in listing');
      console.log('This would cause a 400 error, not 500');
      return;
    }
    
    console.log('✅ Contact info exists:', typeof contactInfo);
    
    // Parse contact info
    let parsedContactInfo;
    try {
      if (typeof contactInfo === 'string') {
        parsedContactInfo = JSON.parse(contactInfo);
      } else {
        parsedContactInfo = contactInfo;
      }
    } catch (parseError) {
      console.log('❌ ISSUE FOUND: Contact info parsing failed:', parseError.message);
      console.log('This could cause a 500 error');
      return;
    }
    
    console.log('✅ Contact info parsed successfully:', {
      hasEmail: !!parsedContactInfo.email,
      hasName: !!parsedContactInfo.name,
      hasPhone: !!parsedContactInfo.phone
    });
    
    if (!parsedContactInfo.email) {
      console.log('❌ ISSUE FOUND: No email in contact info');
      console.log('This would cause a 400 error, not 500');
      return;
    }
    
    console.log('✅ Email found:', parsedContactInfo.email);
    
    console.log('\n3. All endpoint validation checks passed');
    console.log('The 500 error is likely occurring during email sending or authentication');
    
  } catch (error) {
    console.log('\n❌ ERROR in listing contact endpoint test:', error.message);
    console.log('Stack:', error.stack);
    console.log('\nThis error could be causing the 500 response in production');
  }
}

testListingContactEndpoint().catch(console.error);