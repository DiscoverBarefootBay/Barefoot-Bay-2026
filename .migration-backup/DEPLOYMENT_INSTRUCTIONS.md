# Deployment Instructions for Barefoot Bay

This document provides step-by-step instructions to deploy the Barefoot Bay community portal on Replit.

## Important Configuration Steps

Before deploying, you must edit your `.replit` file with the following settings:

### Option 1: Using JavaScript (Recommended)

```
# .replit file configuration for deployment
run = "node deployment.js"

[deployment]
run = "node deployment.js"
```

### Option 2: Using Shell Script

```
# .replit file configuration for deployment
run = "bash deploy.sh"

[deployment]
run = ["sh", "-c", "bash deploy.sh"]
```

⚠️ **IMPORTANT:** Do NOT use the format `run = "NODE_ENV=production node dist/index.js"` as this causes Replit to try to execute `NODE_ENV=production` as a command.

## How This Works

1. The `deployment.js` script provides a proper way to set environment variables and start the server in the Replit deployment environment.

2. The script properly sets:
   - `NODE_ENV=production`
   - `PORT=5000` (required by Replit)

3. It then imports the compiled server code from `dist/index.js`.

## Common Deployment Errors

If you see errors like:

```
failed to start command [NODE_ENV=production PORT=3000 node dist/index.js]: 
exec: "NODE_ENV=production": executable file not found in $PATH
```

This means your `.replit` file is incorrectly formatted. Replit is trying to run `NODE_ENV=production` as an executable instead of setting it as an environment variable.

## WebSocket Configuration

For WebSockets to work properly in the deployed environment:

1. The WebSocket server must listen on the same port as the HTTP server (5000)
2. The WebSocket path must be configured as `/ws`
3. Clients must connect using the appropriate URL format

## Testing Your Deployment

After deploying:

1. Check the server logs to ensure it started on port 5000
2. Verify WebSocket connections are established
3. Test the main features of the application

## Port Configuration

Always use port 5000 for Replit deployments, as this is the only port that is:
1. Not firewalled
2. Properly forwarded to the outside world