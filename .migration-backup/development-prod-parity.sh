#!/bin/bash
# Script to run the application in development with production-like settings
# This helps identify feature discrepancies between environments

echo "Starting application in production-like development mode..."
echo "This mode helps identify features that work differently between environments"

# Set environment variables to mimic production
export NODE_ENV=production
export PORT=5000

# Build the application with production settings
echo "Building application with production settings..."
npm run build

# Start the server with production settings
echo "Starting server with NODE_ENV=$NODE_ENV on PORT=$PORT..."
node dist/index.js