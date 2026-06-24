#!/bin/bash

# Script to clean up development files before deployment to reduce image size
# This does NOT remove any media files needed for the site to function

echo "Starting deployment preparation cleanup..."

# Create backup directory
echo "Creating backup directory..."
mkdir -p /tmp/deployment-backups

# Backup then remove backup folders (these are just duplicates)
echo "Backing up and removing backup folders..."
if [ -d "./uploads/backups" ]; then
  cp -r ./uploads/backups /tmp/deployment-backups/
  rm -rf ./uploads/backups
fi

# Remove .git folder temporarily (can be restored after deployment)
echo "Backing up and removing .git folder..."
cp -r ./.git /tmp/deployment-backups/
rm -rf ./.git

# Clean node_modules caches
echo "Cleaning npm cache..."
rm -rf ./node_modules/.cache

echo "Cleanup complete! Image size should be reduced significantly."
echo "After deployment, you can restore files from /tmp/deployment-backups/"