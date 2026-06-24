/**
 * One-time cleanup script to clear legacy cart data
 * This script clears all existing cart data from localStorage to ensure
 * a clean transition to the new user-specific cart system
 */

console.log('🧹 Starting cart data cleanup...');

if (typeof window !== 'undefined' && localStorage) {
  const keys = Object.keys(localStorage);
  let clearedItems = 0;
  
  keys.forEach(key => {
    if (key.startsWith('barefootbay-cart')) {
      localStorage.removeItem(key);
      clearedItems++;
      console.log(`Removed: ${key}`);
    }
  });
  
  console.log(`✅ Cleanup complete! Cleared ${clearedItems} cart items.`);
  console.log('🔄 Please refresh the page for changes to take effect.');
} else {
  console.log('❌ localStorage not available');
}