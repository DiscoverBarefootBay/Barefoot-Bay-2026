#!/bin/bash

# Script to run the vendor URL format fix

echo "Running vendor URL fix script..."
echo "This will update all vendor URLs to use the correct format: vendors-[category]-[unique-identifier]"
echo "-----------------------------------"

# Execute the fix script using Node.js
node fix-vendor-url-format.js

echo "-----------------------------------"
echo "URL fix completed!"