// Test if orders router can be imported
console.log('Testing orders router import...');

try {
  // Try importing the orders router
  import('./server/routes/orders.ts').then(module => {
    console.log('✅ Orders router imported successfully');
    console.log('Exported keys:', Object.keys(module));
  }).catch(err => {
    console.error('❌ Orders router import failed:', err.message);
    console.error('Stack:', err.stack);
  });
} catch (err) {
  console.error('❌ Immediate import error:', err.message);
  console.error('Stack:', err.stack);
}