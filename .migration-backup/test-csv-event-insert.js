/**
 * Simple test script to insert an event from CSV data
 * Focuses on handling the mediaUrls field correctly
 */
import fetch from 'node-fetch';
import fs from 'fs';

async function testCSVEventInsert() {
  try {
    console.log('Starting CSV event insert test');
    
    // Use the current server URL where the workflow is running
    const SERVER_URL = 'https://' + process.env.REPL_SLUG + '.' + process.env.REPL_OWNER + '.repl.co';
    console.log('Using server URL:', SERVER_URL);
    
    // Simple login to get a session cookie
    console.log('Logging in...');
    const loginResponse = await fetch(`${SERVER_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Bob the Builder',
        password: 'admin123'
      })
    });
    
    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
    }
    
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('Login successful, got cookies:', cookies);
    
    // Create a test event
    const testEvent = {
      title: 'Test Event from CSV Import Script',
      description: 'This is a test event created from a CSV import script',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      location: 'Test Location',
      category: 'social',
      contactInfo: {
        name: 'Test Person',
        phone: '(555) 555-5555',
        email: 'test@example.com',
        website: ''
      },
      // Test with different media URL formats to see what works
      mediaUrls: ['http://example.com/test.jpg', 'http://example.com/test2.jpg'],
      isRecurring: false
    };
    
    console.log('Creating test event...');
    console.log('Event payload:', JSON.stringify(testEvent, null, 2));
    
    const eventResponse = await fetch(`${SERVER_URL}/api/events`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': cookies
      },
      body: JSON.stringify(testEvent)
    });
    
    if (!eventResponse.ok) {
      const errorText = await eventResponse.text();
      throw new Error(`Event creation failed: ${eventResponse.status} ${eventResponse.statusText}\n${errorText}`);
    }
    
    const eventResult = await eventResponse.json();
    console.log('Event created successfully:', eventResult);
    
    // Verify the event was created
    console.log('Retrieving all events to verify...');
    const eventsResponse = await fetch(`${SERVER_URL}/api/events`, {
      headers: { 'Cookie': cookies }
    });
    
    if (!eventsResponse.ok) {
      throw new Error(`Failed to retrieve events: ${eventsResponse.status} ${eventsResponse.statusText}`);
    }
    
    const events = await eventsResponse.json();
    console.log('Retrieved events:', events);
    
    console.log('Events count:', events.length);
    console.log('Test completed successfully');
    
  } catch (error) {
    console.error('Error in test script:', error);
  }
}

testCSVEventInsert();