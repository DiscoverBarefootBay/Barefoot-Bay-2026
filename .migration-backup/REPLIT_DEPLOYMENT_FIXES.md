# Replit Deployment Issues & Fixes

This document provides solutions to common Replit deployment issues for the Barefoot Bay application.

## Fixing the Run Command in .replit File

**Deployment Error:**
```
Run command format in .replit file is incorrect for Node.js deployments
The PORT environment variable in run command doesn't match the port forwarding configuration
The script tries to execute NODE_ENV=production as an executable instead of setting it as an environment variable
```

### Solution 1: Use Array Format (Recommended)

Edit your `.replit` file to use this exact format:

```
[deployment]
run = ["sh", "-c", "NODE_ENV=production PORT=5000 node dist/index.js"]
```

This format:
- Properly sets environment variables using the shell
- Uses the correct array notation Replit expects
- Specifies port 5000 which Replit requires

### Solution 2: Use Deployment Shell Script

If you prefer using a script:

1. Edit your `.replit` file:
```
[deployment]
run = ["sh", "-c", "bash deploy.sh"]
```

2. Our `deploy.sh` script is already set up with:
```bash
#!/bin/bash
export NODE_ENV=production
export PORT=5000
echo "Starting server with NODE_ENV=$NODE_ENV on PORT=$PORT"
node dist/index.js
```

## WebSocket Connection Issues

If you're seeing WebSocket errors in the browser console:

### 1. Use the Enhanced WebSocket Helper

We've created `client/src/utils/websocket-helper.ts` with improved connection handling for Replit deployments:

```typescript
// In your component:
import { initEnhancedWebSocket, sendMessage } from '../utils/websocket-helper';

// Initialize connection
const socket = initEnhancedWebSocket();

// Send message
sendMessage('event_type', { data: 'value' });

// Listen for events
window.addEventListener('websocket-message', (event: CustomEvent) => {
  const message = event.detail;
  // Handle message
});
```

### 2. Check WebSocket Server Status

Verify the WebSocket server is running by looking for these log messages:
```
WebSocket server available at ws://0.0.0.0:5000/ws
```

### 3. Check for CSP Issues

Some Replit deployments may need Content-Security-Policy headers adjusted for WebSockets.
Add this to your server's response headers:

```javascript
// In server/index.ts
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; connect-src 'self' wss: ws:;"
  );
  next();
});
```

## Port Configuration Issues

Always use port 5000 for Replit deployments:

1. In your server:
```javascript
const PORT = process.env.PORT || 5000;
```

2. In deployment scripts:
```bash
export PORT=5000
```

3. In `.replit` deployment configuration:
```
[deployment]
run = ["sh", "-c", "PORT=5000 NODE_ENV=production node dist/index.js"]
```

## Testing Your Deployment

After making these changes:

1. Deploy your application again
2. Check the deployment logs for error messages
3. Use browser developer tools to verify WebSocket connections

Remember that Replit requires port 5000 for both HTTP and WebSocket communication.