/**
 * Cart utilities for managing user-specific cart data
 */

export interface CartItem {
  product: any;
  quantity: number;
  variant?: string;
}

/**
 * Get the localStorage key for a specific user's cart
 */
export function getCartKey(userId: number | null): string {
  return userId ? `barefootbay-cart-${userId}` : 'barefootbay-cart-guest';
}

/**
 * Migrate legacy cart data to user-specific cart
 * This function should be called when a user logs in
 */
export function migrateLegacyCartData(userId: number): void {
  if (typeof window === 'undefined') return;

  const legacyCartKey = 'barefootbay-cart';
  const userCartKey = getCartKey(userId);
  
  // Check if there's legacy cart data
  const legacyCart = localStorage.getItem(legacyCartKey);
  const userCart = localStorage.getItem(userCartKey);
  
  // If user doesn't have a cart but there's legacy data, migrate it
  if (legacyCart && !userCart) {
    try {
      const cartData = JSON.parse(legacyCart);
      if (Array.isArray(cartData) && cartData.length > 0) {
        localStorage.setItem(userCartKey, legacyCart);
        console.log(`Migrated ${cartData.length} items to user cart for user ${userId}`);
      }
    } catch (error) {
      console.error('Error migrating legacy cart data:', error);
    }
  }
  
  // Clear the legacy cart data
  localStorage.removeItem(legacyCartKey);
}

/**
 * Clear all cart data for all users (useful for testing or cleanup)
 */
export function clearAllCartData(): void {
  if (typeof window === 'undefined') return;

  const keys = Object.keys(localStorage);
  let cleared = 0;
  
  keys.forEach(key => {
    if (key.startsWith('barefootbay-cart')) {
      localStorage.removeItem(key);
      cleared++;
    }
  });
  
  console.log(`Cleared ${cleared} cart items from localStorage`);
}

/**
 * Get cart data for a specific user
 */
export function getCartData(userId: number | null): CartItem[] {
  if (typeof window === 'undefined') return [];

  const cartKey = getCartKey(userId);
  const savedCart = localStorage.getItem(cartKey);
  
  try {
    return savedCart ? JSON.parse(savedCart) : [];
  } catch (error) {
    console.error('Error parsing cart data:', error);
    return [];
  }
}

/**
 * Save cart data for a specific user
 */
export function saveCartData(userId: number | null, cartData: CartItem[]): void {
  if (typeof window === 'undefined' || !userId) return;

  const cartKey = getCartKey(userId);
  localStorage.setItem(cartKey, JSON.stringify(cartData));
}