/**
 * List available Gemini AI models
 * This script helps identify which models are available for your API key
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Check for Gemini API key
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("Error: GEMINI_API_KEY not found in environment variables");
  console.error("Please set GEMINI_API_KEY in your .env file");
  process.exit(1);
}

// Initialize Gemini
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

async function listModels() {
  try {
    console.log("Attempting to list available Gemini models...");
    
    // Try to list the models
    const models = await genAI.getModels();
    console.log("Available models:", models);
    
    return models;
  } catch (error) {
    console.error("Error listing models:", error);
    
    // Try some common model names directly
    console.log("\nTrying common model names directly:");
    
    const commonModels = [
      "gemini-pro", 
      "gemini-1.0-pro",
      "gemini-1.5-pro", 
      "gemini-1.5-flash",
      "gemini-2.0-pro",
      "gemini-2.0-flash"
    ];
    
    for (const modelName of commonModels) {
      try {
        console.log(`\nTesting model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Hello, what models are available?");
        console.log(`✅ Success with model: ${modelName}`);
        console.log("Sample response:", result.response.text().substring(0, 100) + "...");
      } catch (error) {
        console.error(`❌ Error with model ${modelName}:`, error.message);
      }
    }
  }
}

// Run the function
listModels().catch(console.error);