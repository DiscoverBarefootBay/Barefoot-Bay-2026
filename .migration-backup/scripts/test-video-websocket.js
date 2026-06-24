/**
 * Tool to test WebSocket connection for improved video debugging
 * This script:
 * 1. Connects to the server's WebSocket endpoint
 * 2. Reports video playback status
 * 3. Listens for broadcasts
 * 
 * To run:
 * node scripts/test-video-websocket.js
 */

const WebSocket = require('ws');

const serverUrl = 'ws://localhost:5000/ws';
let retryCount = 0;
const maxRetries = 3;
let reconnectTimeout;

function createWebSocketConnection() {
  const ws = new WebSocket(serverUrl);
  console.log(`Connecting to WebSocket at ${serverUrl}`);

  ws.on('open', () => {
    console.log('✅ WebSocket connection established');
    retryCount = 0;
    // Send test video status message
    testVideoPlayback(ws);
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('Received message:', message);
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`WebSocket closed: ${code} ${reason || 'No reason provided'}`);
    if (retryCount < maxRetries) {
      retryCount++;
      console.log(`Attempting to reconnect (${retryCount}/${maxRetries})...`);
      reconnectTimeout = setTimeout(() => {
        createWebSocketConnection();
      }, 2000);
    } else {
      console.log('Maximum retry attempts reached.');
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error.message);
  });

  return ws;
}

function testVideoPlayback(ws) {
  if (ws.readyState === WebSocket.OPEN) {
    const testVideos = [
      '/static/videos/BackgroundVideo.mp4',
      '/uploads/banner-slides/test-video.mp4',
      '/banner-slides/banner-video.mp4'
    ];

    console.log('Sending test video status messages...');
    
    // Send test messages for each video
    testVideos.forEach((videoUrl, index) => {
      setTimeout(() => {
        const message = {
          type: 'video-status',
          data: {
            url: videoUrl,
            status: 'test-playback',
            timestamp: new Date().toISOString()
          }
        };
        
        ws.send(JSON.stringify(message));
        console.log(`Sent test status for: ${videoUrl}`);
      }, index * 1000);
    });
  } else {
    console.log('WebSocket not connected, cannot send test messages');
  }
}

// Create connection
const ws = createWebSocketConnection();

// Handle process termination
process.on('SIGINT', () => {
  console.log('Disconnecting WebSocket...');
  if (ws) {
    ws.close(1000, 'User requested termination');
  }
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }
  process.exit(0);
});

// Keep process running
console.log('WebSocket test client running. Press Ctrl+C to exit.');