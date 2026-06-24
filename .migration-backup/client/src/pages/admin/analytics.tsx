import { useEffect } from "react";
import { useLocation } from "wouter";
import AdminLayout from "@/components/layouts/admin-layout";

export default function AnalyticsRedirect() {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    // Redirect to analytics-dashboard
    setLocation("/admin/analytics-dashboard");
  }, [setLocation]);
  
  return (
    <AdminLayout>
      <div className="container p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Redirecting to analytics dashboard...
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}