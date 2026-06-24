// Test script for the enhanced analytics features
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000/api';
const SESSION_ID = 'test-session-' + Date.now();
const USER_ID = 6; // Using the admin user ID

async function testPageView() {
  console.log('\n🔍 Testing page view tracking with scroll depth...');
  
  const timestamp = new Date();
  
  const response = await fetch(`${API_BASE}/analytics/page-view`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessionId: SESSION_ID,
      userId: USER_ID,
      path: '/test-analytics-homepage',
      timestamp,
      referrer: 'https://google.com',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      pageHeight: 2500,
      maxScrollDepth: 1800,
      maxScrollPercentage: 72,
      pageType: 'homepage',
      pageCategory: 'landing',
      customDimensions: {
        theme: 'light',
        language: 'en-US',
        featureFlags: ['new-header', 'enhanced-search']
      }
    })
  });
  
  const pageViewResult = await response.json();
  console.log('✅ Page view tracked:', pageViewResult);
  return pageViewResult;
}

async function testPageExit(pageView) {
  console.log('\n🔍 Testing page exit with enhanced metrics...');
  
  const exitTimestamp = new Date(new Date().getTime() + 60000); // 1 minute later
  
  const response = await fetch(`${API_BASE}/analytics/page-exit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessionId: SESSION_ID,
      userId: USER_ID,
      path: '/test-analytics-homepage',
      exitTimestamp,
      pageHeight: 2500,
      maxScrollDepth: 2200,
      maxScrollPercentage: 88,
      timeOnPage: 60,
      pageType: 'homepage',
      pageCategory: 'landing'
    })
  });
  
  const result = await response.json();
  console.log('✅ Page exit tracked:', result);
  return result;
}

async function testClickEvent() {
  console.log('\n🔍 Testing click event with position data...');
  
  const timestamp = new Date();
  
  const response = await fetch(`${API_BASE}/analytics/event`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessionId: SESSION_ID,
      userId: USER_ID,
      eventType: 'click',
      category: 'navigation',
      action: 'button_click',
      label: 'get_started_button',
      value: 1,
      xPosition: 450,
      yPosition: 320,
      elementId: 'get-started-btn',
      elementType: 'button',
      eventData: {
        buttonColor: 'blue',
        buttonSize: 'large',
        buttonText: 'Get Started'
      },
      timestamp,
      path: '/test-analytics-homepage'
    })
  });
  
  const eventResult = await response.json();
  console.log('✅ Click event tracked:', eventResult);
  return eventResult;
}

async function testCustomEvent() {
  console.log('\n🔍 Testing custom conversion event...');
  
  const timestamp = new Date();
  
  const response = await fetch(`${API_BASE}/analytics/event`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessionId: SESSION_ID,
      userId: USER_ID,
      eventType: 'conversion',
      category: 'membership',
      action: 'signup_completed',
      label: 'monthly_plan',
      value: 29.99,
      eventData: {
        planId: 'monthly-29',
        discountApplied: true,
        couponCode: 'WELCOME10'
      },
      timestamp,
      path: '/signup/complete'
    })
  });
  
  const eventResult = await response.json();
  console.log('✅ Custom event tracked:', eventResult);
  return eventResult;
}

async function testAdminApiEndpoints() {
  console.log('\n🔍 Testing admin analytics API endpoints...');
  
  console.log('\nTesting scroll depth stats endpoint...');
  const scrollDepthResponse = await fetch(`${API_BASE}/analytics/scroll-depth-stats?path=/test-analytics-homepage`);
  const scrollDepthData = await scrollDepthResponse.json();
  console.log('Scroll depth stats:', scrollDepthData);
  
  console.log('\nTesting click heatmap endpoint...');
  const encodedPath = encodeURIComponent('/test-analytics-homepage');
  const heatmapResponse = await fetch(`${API_BASE}/analytics/click-heatmap/${encodedPath}`);
  const heatmapData = await heatmapResponse.json();
  console.log('Click heatmap data:', heatmapData);
  
  console.log('\nTesting entry/exit pages endpoint...');
  const entryExitResponse = await fetch(`${API_BASE}/analytics/entry-exit-pages`);
  const entryExitData = await entryExitResponse.json();
  console.log('Entry/Exit pages:', entryExitData);
  
  console.log('\nTesting page categories endpoint...');
  const categoriesResponse = await fetch(`${API_BASE}/analytics/page-categories`);
  const categoriesData = await categoriesResponse.json();
  console.log('Page categories:', categoriesData);
}

async function runTests() {
  try {
    console.log('🚀 Starting enhanced analytics tests...');
    const pageView = await testPageView();
    await testPageExit(pageView);
    await testClickEvent();
    await testCustomEvent();
    
    // Wait a moment for data to be processed
    console.log('\nWaiting 2 seconds before testing admin endpoints...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await testAdminApiEndpoints();
    
    console.log('\n✅ All tests completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

runTests();