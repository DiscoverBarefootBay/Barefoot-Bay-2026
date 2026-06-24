// Import the storage browser route
import storageBrowserRouter from './routes/storage-browser';

// Add this function to register the new route in routes.ts
export function addStorageBrowserRoute(app: Express) {
  // Register the storage browser router to the /api prefix
  app.use('/api', storageBrowserRouter);
  console.log('Added storage browser route: /api/storage-browser');
}