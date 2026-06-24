import { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { FixVersionHistory } from '@/components/admin/fix-version-history';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';

export default function VersionFixPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    // Redirect non-admin users
    if (user && user.role !== 'admin') {
      toast({
        title: 'Access Denied',
        description: 'You need admin privileges to access this page.',
        variant: 'destructive',
      });
      navigate('/');
    } else if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'You need to log in with admin privileges to access this page.',
        variant: 'destructive',
      });
      navigate('/auth');
    }
  }, [user, navigate]);

  if (!user || user.role !== 'admin') {
    return (
      <div className="container py-10">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You need admin privileges to access this page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-8">Admin Tools - Version History System</h1>
      
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Version History System Maintenance</CardTitle>
            <CardDescription>
              Use these tools to diagnose and fix issues with the content version history system.
              Emergency fixes are available when content or versions aren't working properly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FixVersionHistory />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}