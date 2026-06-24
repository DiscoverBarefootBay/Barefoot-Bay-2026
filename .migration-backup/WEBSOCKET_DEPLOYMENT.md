# WebSocket Deployment Guide for Barefoot Bay

This document outlines how to configure WebSocket connections properly for deployment in the Replit environment.

## Overview

The Barefoot Bay application uses WebSockets for real-time features like:
- Calendar event updates
- Forum post notifications
- Community announcements

In development, WebSockets work well with localhost connections, but deploying to Replit requires specific configuration.

## Server Configuration

The server is already configured correctly:

```typescript
// In server/routes.ts
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
```

This setup works for both development and production environments.

## Client Configuration

For deployment, use the deployment-specific WebSocket utility:

```typescript
import { createDeploymentWebSocket } from './utils/deploy-websocket';

// When in production environment
const socket = createDeploymentWebSocket();
```

## Common Deployment Issues

1. **Connection Refused**: If the WebSocket connection is refused, check:
   - The server is listening on port 5000 (Replit's unrestricted port)
   - The WebSocket server path is '/ws'
   - The client is using the correct WebSocket URL format

2. **WebSocket Security Headers**: For HTTPS deployments, ensure:
   - Content-Security-Policy allows WebSocket connections
   - The WebSocket uses 'wss://' protocol not 'ws://'

3. **Cross-Origin Issues**: If experiencing cross-origin issues:
   - Verify the WebSocket server allows the deployed domain
   - Check browser console for detailed error messages

## Testing WebSocket Connections

To test if WebSockets are working in the deployed environment:

1. Open the browser console and check for connection messages
2. Look for "WebSocket connection established" in the logs
3. Try sending a test message through the console:

```javascript
// In browser console
const socket = new WebSocket('wss://your-app.replit.app/ws');
socket.onopen = () => socket.send(JSON.stringify({type: 'ping', data: {timestamp: Date.now()}}));
socket.onmessage = (msg) => console.log('Response:', msg.data);
```

## Environment-Specific Configuration

The application detects whether it's running in development or production and automatically uses the appropriate WebSocket configuration.

For Replit deployments specifically:
- PORT is set to 5000
- NODE_ENV is set to 'production'
- WebSocket path is '/ws'