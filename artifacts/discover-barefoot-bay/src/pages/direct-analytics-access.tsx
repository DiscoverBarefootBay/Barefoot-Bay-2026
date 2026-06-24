import React, { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/components/providers/auth-provider';
import { UserRole } from '@shared/schema';
import AdminLayout from '@/components/layouts/admin-layout';
import { BarChart3 } from 'lucide-react';

/**
 * Direct Analytics Access Page
 * 
 * This page immediately redirects to the analytics dashboard if the user is an admin.
 * If not, it shows an error message.
 */
export default function DirectAnalyticsAccess() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    // If user is loaded and is admin, redirect to analytics dashboard
    if (!isLoading && user?.role === UserRole.ADMIN) {
      console.log('Redirecting admin to analytics dashboard');
      navigate('/admin/analytics-dashboard');
    } else if (!isLoading && user && user.role !== UserRole.ADMIN) {
      console.log('User is not admin, not redirecting', user);
    } else if (!isLoading && !user) {
      console.log('No user found, not redirecting');
    }
  }, [user, isLoading, navigate]);

  // If still loading, show loading message
  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <BarChart3 className="mx-auto h-12 w-12 text-primary animate-pulse" />
            <h1 className="mt-4 text-2xl font-bold">Loading Analytics...</h1>
            <p className="mt-2 text-muted-foreground">Please wait while we verify your credentials.</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // If user is not admin, show access denied
  if (user && user.role !== UserRole.ADMIN) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
            <p className="mt-2 text-muted-foreground">
              You don't have permission to access the analytics dashboard. Please contact an administrator.
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // If no user, show login required
  if (!user) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold text-amber-600">Authentication Required</h1>
            <p className="mt-2 text-muted-foreground">
              Please log in with administrator credentials to access the analytics dashboard.
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // This should only show briefly while redirecting
  return (
    <AdminLayout>
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <BarChart3 className="mx-auto h-12 w-12 text-primary animate-pulse" />
          <h1 className="mt-4 text-2xl font-bold">Redirecting to Analytics Dashboard...</h1>
          <p className="mt-2 text-muted-foreground">You'll be redirected in a moment.</p>
        </div>
      </div>
    </AdminLayout>
  );
}