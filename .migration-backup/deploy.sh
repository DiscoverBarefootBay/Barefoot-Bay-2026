#!/bin/bash
# Custom deployment script for preserving media files across deployments

echo "===== Barefoot Bay Media Persistence Deployment Script ====="

# Function to show usage instructions
show_usage() {
  echo "Usage: ./deploy.sh [pre|post]"
  echo "  pre  - Run before deployment to backup media files"
  echo "  post - Run after deployment to restore media files"
  exit 1
}

# Check command line arguments
if [ $# -ne 1 ]; then
  show_usage
fi

# Process command
case "$1" in
  pre)
    echo "Running pre-deployment media backup..."
    npx tsx deploy-scripts/pre-deploy.mjs
    if [ $? -eq 0 ]; then
      echo "✅ Pre-deployment backup complete. You can now deploy your application."
      echo "   After deployment is complete, run './deploy.sh post' to restore media files."
    else
      echo "❌ Pre-deployment backup failed. Check the logs above for details."
      exit 1
    fi
    ;;
    
  post)
    echo "Running post-deployment media restoration..."
    npx tsx deploy-scripts/post-deploy.mjs
    if [ $? -eq 0 ]; then
      echo "✅ Post-deployment restoration complete. Your media files should now be available."
    else
      echo "❌ Post-deployment restoration failed. Check the logs above for details."
      exit 1
    fi
    ;;
    
  *)
    show_usage
    ;;
esac

exit 0