#!/bin/bash
# Script to rebuild the client-side code

echo "Starting to fix UI build issues..."

# Stop any existing builds
# pkill -f "node dist/index.js" || true

# Clear browser cache
echo "function clearCache() {
  localStorage.clear();
  sessionStorage.clear();
  console.log('Cache cleared. Please refresh the page.');
}
clearCache();" > client/src/cache-clear.js

# Rebuild the client
echo "Rebuilding the client code..."
cd /home/runner/workspace
npm run build

# Copy the updated manage-vendors.tsx file manually to dist
echo "Ensuring manage-vendors.tsx changes are in the distribution..."
mkdir -p dist/client/src/pages/admin
cp client/src/pages/admin/manage-vendors.tsx dist/client/src/pages/admin/

echo "Build complete. Please refresh your browser and check if changes are visible."