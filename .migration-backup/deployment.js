// deployment.js - Proper configuration for Replit deployment
process.env.NODE_ENV = 'production';
process.env.PORT = 5000; // Fixed port for Replit deployments

console.log(`Starting server in ${process.env.NODE_ENV} mode on port ${process.env.PORT}`);
console.log(`This is the ONLY port that Replit allows for external traffic`);

// Import the server code
import('./dist/index.js').catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});