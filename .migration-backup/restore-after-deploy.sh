#!/bin/bash

# Script to restore backed up development files after deployment
# Only restores what was actually backed up in cleanup-for-deploy.sh

echo "Starting restoration of backed up files..."

# Check if backup directory exists
if [ ! -d "/tmp/deployment-backups" ]; then
  echo "Error: Backup directory not found. Nothing to restore."
  exit 1
fi

# Restore backup folders
echo "Restoring backup folders..."
if [ -d "/tmp/deployment-backups/backups" ]; then
  cp -r /tmp/deployment-backups/backups ./uploads/
fi

# Restore .git folder
echo "Restoring .git folder..."
if [ -d "/tmp/deployment-backups/.git" ]; then
  cp -r /tmp/deployment-backups/.git ./
fi

echo "Restoration complete! Your development environment is back to its original state."