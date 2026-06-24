# Forum Content Generation with AI

This document explains the various scripts available for generating forum content using AI for the Barefoot Bay community platform.

## Available Scripts

1. **generate-forum-content-fixed.js**
   - Basic script with static predefined content
   - No API keys required
   - Most reliable option when API access is limited
   - Usage: `node generate-forum-content-fixed.js`

2. **ai-generate-forum-content.js** (Updated to ES Modules)
   - Uses Google's Gemini API or OpenAI (as fallback)
   - Requires `VITE_GEMINI_API_KEY` environment variable
   - Usage: `node ai-generate-forum-content.js`
   - Note: This script has been converted to use ES Modules

3. **ai-generate-forum-content-es.js**
   - ES Modules version with proper imports
   - Uses Google's Gemini API with fallback to OpenAI
   - Requires `VITE_GEMINI_API_KEY` environment variable
   - Usage: `node ai-generate-forum-content-es.js`

4. **ai-generate-forum-content-updated.js**
   - Enhanced version with better prompts and improved error handling
   - Uses Google's Gemini API
   - Requires `VITE_GEMINI_API_KEY` environment variable
   - Usage: `node ai-generate-forum-content-updated.js`

5. **ai-generate-forum-content-with-proxy.js**
   - Designed to handle HTTP referrer restrictions
   - Uses a proxy approach for API access
   - Requires `VITE_GEMINI_API_KEY` environment variable
   - Usage: `node ai-generate-forum-content-with-proxy.js`

6. **generate-forum-browser.html**
   - Browser-based HTML/JavaScript solution
   - Use this when direct API calls from Node.js are blocked
   - Open this file in a browser, generate content, then save the output
   - Follow up with `node process-browser-content.js` to import generated content

## Model Selection

All scripts using the Google Generative AI have been updated to use the "gemini-1.5-pro-latest" model.
This update replaces the previous "gemini-pro" model references.

## Common Issues and Solutions

1. **API Access Errors**
   - HTTP referrer restrictions may block API calls from Node.js scripts
   - Solution: Use the browser-based generator or proxy method

2. **Module System Compatibility**
   - ES Module vs CommonJS conflicts
   - Solution: Use the proper script version matching your Node.js setup

3. **Database Schema Compatibility**
   - The `forum_comments` table uses `author_id` instead of `user_id`
   - Scripts have been updated to accommodate this schema

4. **Fallback Content**
   - All scripts include fallback content when AI generation fails
   - Each script will automatically use fallbacks if API errors occur

## Recommended Approach

For the most reliable results:

1. Start with `generate-forum-content-fixed.js` to ensure basic functionality
2. Try AI-powered generation with `ai-generate-forum-content-updated.js`
3. If API access issues persist, use the browser-based approach with `generate-forum-browser.html`

## Troubleshooting

If you encounter errors:
- Check environment variables are properly set
- Verify database connection
- Confirm Gemini API key is still valid
- Look for HTTP referrer restrictions in API requests