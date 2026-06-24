// Re-export from auth provider
export { useAuth, AuthProvider } from '../components/providers/auth-provider';

// Add a useAdminOnly hook for admin routes
import { useAuth as useAuthProvider } from '../components/providers/auth-provider';
import { UserRole } from '@shared/schema';

export function useAdminOnly() {
  const auth = useAuthProvider();
  const isAdmin = !auth.isLoading && auth.user?.role === UserRole.ADMIN;
  return { isAdmin, isLoading: auth.isLoading, user: auth.user };
}