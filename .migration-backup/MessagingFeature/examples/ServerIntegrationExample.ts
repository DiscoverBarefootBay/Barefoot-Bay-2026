/**
 * Server Integration Example
 * 
 * A simple example showing how to integrate the MessagingFeature on the server.
 */

import express from 'express';
import { createServer } from 'http';
import { 
  MessagingStorage, 
  configureMessagingRoutes 
} from '../server';

// Configure your database (this is just a placeholder)
const db = {}; // Replace with your actual database connection

// Create a storage instance with your database
const messagingStorage = new MessagingStorage(db);

// Create your Express app and HTTP server
const app = express();
app.use(express.json());

const httpServer = createServer(app);

// Configure the messaging routes
const { router, wss } = configureMessagingRoutes(app, httpServer, messagingStorage);

// Add your other routes
app.get('/', (req, res) => {
  res.send('Server is running!');
});

// Start the server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  
  // Close WebSocket server
  wss.close(() => {
    console.log('WebSocket server closed');
    
    // Close HTTP server
    httpServer.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });
});