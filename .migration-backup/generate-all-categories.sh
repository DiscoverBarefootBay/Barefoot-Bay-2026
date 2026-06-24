#!/bin/bash

# Run forum content generation for each category
echo "Starting forum content generation for all categories..."

# Category 1: General Discussion
echo "Generating content for General Discussion (Category 1)..."
node generate-forum-content-by-category.js 1
echo "Completed General Discussion content."

# Wait a few seconds between runs
sleep 5

# Category 2: Announcements
echo "Generating content for Announcements (Category 2)..."
node generate-forum-content-by-category.js 2
echo "Completed Announcements content."

# Wait a few seconds between runs
sleep 5

# Category 3: Events & Activities
echo "Generating content for Events & Activities (Category 3)..."
node generate-forum-content-by-category.js 3
echo "Completed Events & Activities content."

# Wait a few seconds between runs
sleep 5

# Category 4: Neighbors Helping Neighbors
echo "Generating content for Neighbors Helping Neighbors (Category 4)..."
node generate-forum-content-by-category.js 4
echo "Completed Neighbors Helping Neighbors content."

# Wait a few seconds between runs
sleep 5

# Category 5: Recommendations
echo "Generating content for Recommendations (Category 5)..."
node generate-forum-content-by-category.js 5
echo "Completed Recommendations content."

echo "All forum content generation completed!"