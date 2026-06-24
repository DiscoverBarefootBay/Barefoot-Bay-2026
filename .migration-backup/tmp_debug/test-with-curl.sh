#!/bin/bash

# Test script for verifying forum media URL formats using curl
# This is a simplified version that avoids node module issues

echo "Creating a test file to upload..."
TEST_FILENAME="forum-test-$(date +%s).txt"
TEST_CONTENT="This is a test file for verifying FORUM/forum standard format $(date)"
echo "$TEST_CONTENT" > "$TEST_FILENAME"

# Use curl to upload the file directly to Object Storage
# Note the correct URL format for Replit Object Storage API - we need to include
# the X-Obj-Bucket header instead of putting it in the URL path
echo "Uploading file to Object Storage..."
curl -X PUT \
  -H "Authorization: Bearer $REPLIT_OBJECT_STORAGE_TOKEN" \
  -H "Content-Type: text/plain" \
  -H "X-Obj-Bucket: FORUM" \
  --data-binary "@$TEST_FILENAME" \
  "https://object-storage.replit.app/forum/$TEST_FILENAME"

echo "Verifying file exists in Object Storage..."
curl -s -I \
  -H "Authorization: Bearer $REPLIT_OBJECT_STORAGE_TOKEN" \
  -H "X-Obj-Bucket: FORUM" \
  "https://object-storage.replit.app/forum/$TEST_FILENAME"

echo -e "\nWaiting 5 seconds for Object Storage propagation..."
sleep 5

# Test accessing the file through the standard format URL
echo -e "\nTesting standard format URL:"
echo "http://localhost:5000/api/storage-proxy/FORUM/forum/$TEST_FILENAME"
curl -v "http://localhost:5000/api/storage-proxy/FORUM/forum/$TEST_FILENAME"

# Test accessing the file through the direct-forum endpoint for comparison
echo -e "\n\nTesting direct-forum endpoint (known working format):"
echo "http://localhost:5000/api/storage-proxy/direct-forum/$TEST_FILENAME"
curl -s "http://localhost:5000/api/storage-proxy/direct-forum/$TEST_FILENAME"

# Cleanup
echo -e "\n\nCleaning up - deleting the test file from Object Storage..."
curl -X DELETE \
  -H "Authorization: Bearer $REPLIT_OBJECT_STORAGE_TOKEN" \
  -H "X-Obj-Bucket: FORUM" \
  "https://object-storage.replit.app/forum/$TEST_FILENAME"

# Remove local test file
rm "$TEST_FILENAME"
echo "Test complete!"