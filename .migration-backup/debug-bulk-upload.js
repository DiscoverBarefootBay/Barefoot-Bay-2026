/**
 * Debug script to help troubleshoot CSV bulk upload issues
 * 
 * This script will:
 * 1. Create a very simple event JSON
 * 2. Log the validation results
 * 3. Show exactly what the server expects for a valid event
 */

import fs from 'fs';
// Import needed for validation check - we'll create a simple schema here instead
// since we can't directly import from shared/schema.ts as it's TypeScript

function createTestEvent() {
  // Create a minimal valid event based on schema requirements
  const event = {
    title: "Test Event",
    description: "Test description",
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 3600000).toISOString(), // 1 hour later
    location: "Test Location",
    category: "social", // Must be exactly one of: social, entertainment, government
    businessName: "Test Organization",
    contactInfo: {
      name: "Test Person",
      phone: "(555) 555-5555",
      email: "test@example.com",
      website: "http://example.com"
    },
    isRecurring: false,
    mediaUrls: []
  };

  return event;
}

function main() {
  console.log("=== EVENT VALIDATION DEBUGGER ===");
  console.log("Creating test event...");
  
  const testEvent = createTestEvent();
  console.log("Test event:", JSON.stringify(testEvent, null, 2));
  
  // We'll skip actual validation since we can't import the schema
  console.log("\nSkipping schema validation (can't import TypeScript files directly)");
  
  console.log("✓ Based on the server code, a valid event must have:");
  console.log("  - title (string, required)");
  console.log("  - description (string, optional)");
  console.log("  - startDate (ISO date string, required)");
  console.log("  - endDate (ISO date string, required)");
  console.log("  - location (string, required)");
  console.log("  - category (must be 'social', 'entertainment', or 'government')");
  console.log("  - businessName (string, optional)");
  console.log("  - contactInfo (JSON object, optional)");
  console.log("  - hoursOfOperation (JSON object, optional)");
  console.log("  - isRecurring (boolean, required)");
  console.log("  - recurrenceFrequency (if isRecurring is true)");
  console.log("  - recurrenceEndDate (if isRecurring is true)");
  console.log("  - mediaUrls (array of strings, optional)");
  
  // Create a very simple CSV template
  console.log("\nCreating simplified CSV template...");
  
  const csvHeaders = "title,description,startDate,endDate,location,category,businessName,contactInfo,isRecurring\n";
  const csvRow = `"Simple Test Event","This is a very simple test event",${new Date().toISOString()},${new Date(Date.now() + 3600000).toISOString()},"Simple Location","social","Barefoot Bay",'{"name":"Test Person","phone":"(555) 555-5555","email":"test@example.com","website":"http://example.com"}',false\n`;
  
  const csvContent = csvHeaders + csvRow;
  fs.writeFileSync("./uploads/ultra-simple-template.csv", csvContent);
  
  console.log("Created simplified CSV template at ./uploads/ultra-simple-template.csv");
  console.log("Try uploading this template through the bulk uploader");
}

main();