/**
 * Utility functions for role-based permissions
 */

/**
 * Check if a user role is an admin role
 * @param role User role to check
 * @returns boolean indicating if the role has admin privileges
 */
export function isAdmin(role?: string): boolean {
  return role === 'admin';
}

/**
 * Check if a user role can moderate content
 * @param role User role to check
 * @returns boolean indicating if the role has moderation privileges
 */
export function canModerate(role?: string): boolean {
  return role === 'admin' || role === 'moderator';
}

/**
 * Check if a user role has badge holder privileges
 * @param role User role to check
 * @returns boolean indicating if the role has badge holder privileges
 */
export function isBadgeHolder(role?: string): boolean {
  return role === 'admin' || role === 'moderator' || role === 'badge_holder';
}

/**
 * Check if a user role has paid privileges
 * @param role User role to check 
 * @returns boolean indicating if the role has paid privileges
 */
export function isPaidUser(role?: string): boolean {
  return role === 'admin' || role === 'moderator' || role === 'badge_holder' || role === 'paid';
}