# Event Image Personalization

This documentation explains the process for personalizing images for calendar events based on their content.

## Purpose

Instead of using generic category-based images for all events, we use the Pexels API to fetch relevant images based on keywords extracted from event titles and descriptions. This creates a more engaging and personalized experience.

## Requirements

- Pexels API key in environment variable `PEXELS_API_KEY`
- Node.js environment with PostgreSQL database access

## Process Overview

1. Extract all March 2025 events from the database
2. For each event:
   - Extract keywords from title and description
   - Match keywords against a predefined map of relevant terms
   - Search for images using Pexels API
   - Download and store images locally
   - Update event record with new image URLs

## Tools

All tools are configured to use CommonJS format (.cjs) to avoid ES modules issues.

### Main Scripts

- `personalize-event-images.js`: Original script for personalizing images (may timeout)
- `personalize-events.cjs`: Modified version with custom fetch implementation
- `run-personalization-batches.cjs`: Batch processor to handle events in smaller groups
- `check-personalization-progress.cjs`: Reports current progress and next steps

### Current Progress

As of March 20, 2025:
- Total March events: 404
- Events with personalized images: 404
- Completion: 100.00% ✅

## Batch Processing

To avoid timeouts when processing large numbers of events, we use batch processing:

```bash
# Syntax:
node run-personalization-batches.cjs <starting_index> <batch_size> <max_batches>

# Example: Process 10 events starting from index 88
node run-personalization-batches.cjs 88 10 2
```

### Checking Progress

To check current progress:

```bash
node check-personalization-progress.cjs
```

This will show you total events, personalized events, percentage complete, and the command to run for the next batch.

## Log Files

Each batch run creates a timestamped log file with detailed information about the processing:

```
personalization-log-YYYY-MM-DDTHH-MM-SS-MSSZ.txt
```

## Images

Downloaded images are stored in the `/uploads/events/` directory with filenames in the format:

```
<keyword>-<event_id>-<timestamp>.jpg
```

## Recovery

If a batch process is interrupted, you can find the recovery command in:

```
recovery-command.txt
```

## Keyword Mapping

The script uses a predefined map of keywords and synonyms to improve image relevance. This map can be extended in the `personalize-events.cjs` file.

## Rate Limiting

The Pexels API has rate limits that may cause errors during processing. The script includes:

1. Automatic delay of 1.5 seconds between Pexels API requests
2. 5-second cooldown period when rate limits are hit
3. Automatic retry mechanism for 429 (Too Many Requests) responses

If you experience persistent rate limit issues, consider:
- Reducing batch size to 5 events
- Increasing the delay between API calls
- Running batches less frequently (e.g., every 15 minutes)

## Summary Report

All event personalization tasks have been successfully completed:

1. **Basic Event Data Enhancement**: All 4,082 events in the database have been updated with complete information including:
   - Contact information (name, phone, email, website)
   - Hours of operation for each day of the week
   - Google Maps links for all event locations
   - Category-appropriate media URLs

2. **March 2025 Event Personalization**: All 404 March events (100%) have been enhanced with:
   - Personalized images based on event descriptions and keywords
   - Multiple images for events with rich descriptions
   - Properly attributed images from Pexels (via API)
   - Locally hosted images (downloaded and stored on server)

3. **Tools and Scripts Created**:
   - `personalize-events.cjs`: Core script for extracting keywords and fetching relevant images
   - `run-personalization-batches.cjs`: Batch processor with timeout handling
   - `check-personalization-progress.cjs`: Progress tracking tool
   - `personalization-progress-chart.cjs`: Visual progress reporting with HTML output