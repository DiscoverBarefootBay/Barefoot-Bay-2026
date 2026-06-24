#!/bin/bash

# Script to run the enhanced vendor URL format fix

echo "Running enhanced vendor URL fix script..."
echo "This will update ALL vendor URLs to use the proper format: vendors-[category]-[unique-identifier]"
echo "This version includes improved handling of compound categories and special cases."
echo "-----------------------------------"

# Execute the fix script using Node.js
node fix-vendor-url-format-enhanced.js

echo "-----------------------------------"
echo "Enhanced URL fix completed!"