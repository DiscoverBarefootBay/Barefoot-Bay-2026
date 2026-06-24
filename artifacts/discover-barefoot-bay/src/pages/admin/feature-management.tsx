import AdminLayout from "@/components/layouts/admin-layout";
import { FeatureFlagManager } from "@/components/admin/feature-flag-manager";
import { useAuth } from "@/components/providers/auth-provider";
import { ToggleLeft } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function FeatureManagementPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  // Redirect non-admin users
  useEffect(() => {
    if (user && user.role !== "admin") {
      setLocation("/");
    }
  }, [user, setLocation]);

  return (
    <AdminLayout>
      <div className="container p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <ToggleLeft className="h-8 w-8 text-primary" />
            Feature Management
          </h1>
          <p className="text-muted-foreground">
            Configure feature flags and user permissions to control access to different parts of the platform.
          </p>
        </div>

        <div className="mb-10">
          <FeatureFlagManager />
        </div>
      </div>
    </AdminLayout>
  );
}