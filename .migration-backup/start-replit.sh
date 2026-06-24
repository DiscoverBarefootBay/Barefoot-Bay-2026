#!/bin/bash
# Script to build and start the application on Replit
# This ensures the server runs on port 5000 as expected by Replit

# Build the application
echo "Building application..."
npm run build

# Start the server in production mode
echo "Starting server on port 5000..."
export PORT=5000
export NODE_ENV=production
node dist/index.js