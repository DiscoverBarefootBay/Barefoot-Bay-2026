# Barefoot Bay AI Content Generation

This document provides instructions for using the AI content generation scripts to populate different sections of the Barefoot Bay community platform with realistic content.

## Prerequisites

Before using these scripts, ensure you have:

1. Node.js installed (version 16+)
2. PostgreSQL database set up (credentials in `.env` file)
3. Google Gemini API key (set as `GEMINI_API_KEY` or `VITE_GEMINI_API_KEY` in your environment)
4. Node packages: `@google/generative-ai`, `node-fetch`, `pg`, `dotenv` (these should already be installed)

## Available Scripts

The following AI content generation scripts are available:

### 1. Forum Content Generation

Generate realistic forum posts and comments appropriate for the Barefoot Bay community.

```bash
node ai-generate-forum-content.js
```

**Features:**
- Creates posts for each forum category
- Generates multiple comments on each post
- Adds realistic reactions to posts and comments
- Uses Barefoot Bay community context for relevant topics

### 2. Calendar Events Generation

Generate realistic community events with detailed descriptions and scheduling information.

```bash
node ai-generate-calendar-events.js
```

**Features:**
- Creates events for multiple categories (social, sports, recreation, etc.)
- Generates detailed descriptions and location information 
- Sets up recurring events with proper scheduling
- Adds contact information and other required details
- Downloads and attaches relevant imagery for each event category

### 3. Real Estate Listings Generation

Generate realistic property listings for the Barefoot Bay area.

```bash
node create-real-estate-listings.js
```

**Features:**
- Creates listings for different property types (For Sale, For Rent, Agent, FSBO)
- Downloads property images from Unsplash API
- Generates realistic property details (price, bedrooms, features, etc.)
- Creates contact information for each listing

### 4. Vendor Listings Generation

Generate realistic vendor listings for local businesses serving Barefoot Bay.

```bash
node ai-generate-vendor-content.js
```

**Features:**
- Creates vendor listings across multiple categories
- Generates detailed business descriptions with proper HTML formatting
- Adds realistic contact information and hours of operation
- Sets appropriate service categories and tags
- Downloads and attaches relevant imagery for each vendor category

### 5. "More" Section Content Generation

Generate informative content for various pages in the "More" section of the website.

```bash
node ai-generate-more-content.js
```

**Features:**
- Creates content for amenities, governance, and community information pages
- Generates HTML content with proper formatting
- Uses community context to ensure relevant information
- Saves content to both database and static files

### Master Script (All Content Generation)

Run all content generation scripts with a single command:

```bash
node ai-generate-all-content.js
```

This script provides a menu to select which content types to generate.

## Usage Notes

1. **API Keys**: Ensure all required API keys are set in your `.env` file before running any scripts.

2. **Database Content**: By default, scripts will ask before inserting content into the database. Choose "No" to only generate and save content to files for review.

3. **Content Customization**: Each script has configuration variables at the top that can be adjusted to customize the type and amount of content generated.

4. **Error Handling**: If the AI service fails to generate content, fallback content will be used where possible.

5. **Image Attribution**: When using images from Unsplash API, proper attribution may be required.

## Troubleshooting

- **API Key Issues**: If you see errors about missing or invalid API keys, check your `.env` file and ensure the keys are set correctly.

- **Database Connection**: If scripts can't connect to the database, verify your PostgreSQL connection string in the `.env` file.

- **Content Generation Failures**: If AI content generation fails, check your internet connection and API key validity. The scripts include fallback content for some failures.

- **Rate Limiting**: If you hit API rate limits, wait a few minutes before trying again or reduce the amount of content being generated at once.

## Updates (April 2025)

- Updated all scripts to use Google's Generative AI SDK directly instead of raw API calls
- Added image download functionality to vendor and calendar event generators
- Improved error handling for API key verification
- Enhanced content generation prompts to be more specific to Barefoot Bay community context
- All scripts now accept both `GEMINI_API_KEY` and `VITE_GEMINI_API_KEY` environment variables
