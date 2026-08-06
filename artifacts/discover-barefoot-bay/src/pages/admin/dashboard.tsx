import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/providers/auth-provider";
import AdminLayout from "@/components/layouts/admin-layout";
import { MediaBackupTools } from "@/components/admin/media-backup-tools";

// Analytics card removed per user request
import { UserRole } from "@shared/schema";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  FileText, 
  Calendar, 
  ShoppingCart, 
  MessageSquare,
  Tag,
  Building,
  Newspaper,
  Settings,
  ShieldAlert,
  Wrench,
  Construction,
  Database,
  Sliders,
  CreditCard,
  ShoppingBag,
  Upload,
  RotateCcw,
  RefreshCw,
  Rocket,
  Image,
  ToggleLeft,
  History,
  BarChart,
  BarChart3,
  Activity,
  Clock,
  Home,
  LogOut,
  Menu,
  Mail,
  Sparkles
} from "lucide-react";

export default function AdminDashboard() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  // State to force module rendering
  const [isReady, setIsReady] = useState(false);
  
  // Ensure modules render correctly by using an effect
  useEffect(() => {
    // Set a timeout to ensure everything is mounted properly
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);
  
  // User state monitoring effect
  useEffect(() => {
    // Previously had debugging code here
  }, [user]);
  
  // Redirect non-admin users
  useEffect(() => {
    if (user && user.role !== UserRole.ADMIN) {
      toast({
        title: "Access Denied",
        description: "You need admin privileges to access this page.",
        variant: "destructive",
      });
      setLocation("/");
    } else if (!user) {
      toast({
        title: "Authentication Required",
        description: "You need to log in with admin privileges to access this page.",
        variant: "destructive",
      });
      setLocation("/auth");
    }
  }, [user, setLocation, toast]);

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    window.location.href = '/';
  };

  // Sidebar navigation items (for mobile access)
  const sidebarNavItems = [
    {
      title: "Analytics Dashboard",
      description: "View comprehensive analytics and reports",
      icon: <BarChart3 className="h-8 w-8 text-primary" />,
      href: "/analytics-dashboard",
      testId: "analytics-dashboard"
    },
    {
      title: "Admin Dashboard",
      description: "Main administration dashboard",
      icon: <BarChart className="h-8 w-8 text-primary" />,
      href: "/admin",
      testId: "admin-dashboard"
    },
    {
      title: "User Management",
      description: "Manage users, approvals, and permissions",
      icon: <Users className="h-8 w-8 text-primary" />,
      href: "/community-settings",
      testId: "user-management"
    },
    {
      title: "Calendar Management",
      description: "Manage events in the community calendar",
      icon: <Calendar className="h-8 w-8 text-primary" />,
      href: "/admin/calendar-management",
      testId: "calendar-management"
    },
    {
      title: "Feature Management",
      description: "Configure feature flags and user permissions",
      icon: <ToggleLeft className="h-8 w-8 text-primary" />,
      href: "/admin/feature-management",
      testId: "feature-management"
    },
    {
      title: "Platinum Sponsor Settings",
      description: "Control platinum sponsor randomization, rotation, and manual order",
      icon: <Sparkles className="h-8 w-8 text-primary" />,
      href: "/admin/platinum-sponsor-settings",
      testId: "platinum-sponsor-settings"
    },
    {
      title: "Membership Management",
      description: "Manage subscription-based memberships",
      icon: <CreditCard className="h-8 w-8 text-primary" />,
      href: "/admin/membership-management",
      testId: "membership-management"
    },
    {
      title: "Form Submissions",
      description: "View and manage form submissions from users",
      icon: <FileText className="h-8 w-8 text-primary" />,
      href: "/admin/form-submissions",
      testId: "form-submissions"
    },
    {
      title: "Message Management",
      description: "Review and manage user messages",
      icon: <MessageSquare className="h-8 w-8 text-primary" />,
      href: "/admin/messages",
      testId: "message-management"
    },
    {
      title: "On The Market Emails",
      description: "Configure weekly digest and listing expiration email automation",
      icon: <Tag className="h-8 w-8 text-primary" />,
      href: "/admin/on-the-market-emails",
      testId: "on-the-market-emails"
    },
    {
      title: "Email Activity",
      description: "Monitor and review email activity",
      icon: <Mail className="h-8 w-8 text-primary" />,
      href: "/admin/email-activity",
      testId: "email-activity"
    },
    {
      title: "Return to Site",
      description: "Go back to the main website",
      icon: <Home className="h-8 w-8 text-primary" />,
      href: "/",
      testId: "return-to-site"
    },
  ];

  // Admin modules
  const adminModules = [
    
    // Store Management
    {
      title: "Product Management",
      description: "Create and manage store products",
      icon: <ShoppingCart className="h-8 w-8 text-primary" />,
      href: "/admin/products",
      comingSoon: false,
      category: "store"
    },
    {
      title: "Order Management",
      description: "View and manage customer orders",
      icon: <ShoppingBag className="h-8 w-8 text-primary" />,
      href: "/admin/orders",
      comingSoon: false,
      category: "store"
    },
    {
      title: "Returns Management",
      description: "Handle product returns and refunds",
      icon: <RotateCcw className="h-8 w-8 text-primary" />,
      href: "/admin/returns",
      comingSoon: false,
      category: "store"
    },
    {
      title: "Product Image Upload",
      description: "Test product image upload functionality",
      icon: <Upload className="h-8 w-8 text-primary" />,
      href: "/admin/product-image-test",
      comingSoon: false,
      category: "store"
    },
    
    // Content Management
    {
      title: "Calendar Management",
      description: "Manage events in the community calendar",
      icon: <Calendar className="h-8 w-8 text-primary" />,
      href: "/admin/calendar-management",
      comingSoon: false,
      category: "content"
    },
    {
      title: "Community Categories",
      description: "Manage categories for community pages",
      icon: <Building className="h-8 w-8 text-primary" />,
      href: "/admin/community-categories",
      comingSoon: false,
      category: "content"
    },
    {
      title: "Manage Pages",
      description: "Create and edit community/vendor pages",
      icon: <FileText className="h-8 w-8 text-primary" />,
      href: "/admin/manage-pages",
      comingSoon: false,
      category: "content"
    },
    {
      title: "Manage Vendors",
      description: "Manage vendor categories and listings",
      icon: <Tag className="h-8 w-8 text-primary" />,
      href: "/admin/manage-vendors",
      comingSoon: false,
      category: "content"
    },
    {
      title: "Manage Listings",
      description: "Feature or unfeature On The Market listings for comp sponsorships or abuse control",
      icon: <Sparkles className="h-8 w-8 text-primary" />,
      href: "/admin/manage-listings",
      comingSoon: false,
      category: "content"
    },
    {
      title: "Extra!!! Categories",
      description: "Manage Extra!!! categories and structure",
      icon: <MessageSquare className="h-8 w-8 text-primary" />,
      href: "/admin/manage-forum",
      comingSoon: false,
      category: "content"
    },
    {
      title: "Message Management",
      description: "Review and manage user messages sent through the platform",
      icon: <ShieldAlert className="h-8 w-8 text-primary" />,
      href: "/admin/messages",
      comingSoon: false,
      category: "content"
    },
    // Launch Page Management - Hidden per user request (code preserved for future use)
    // {
    //   title: "Launch Page Management",
    //   description: "Manage the beach-themed launch page experience",
    //   icon: <Rocket className="h-8 w-8 text-primary" />,
    //   href: "/launch",
    //   comingSoon: false,
    //   category: "content"
    // },

    
    // Forms & Submissions
    {
      title: "Form Submissions",
      description: "View and manage form submissions from users",
      icon: <Newspaper className="h-8 w-8 text-primary" />,
      href: "/admin/form-submissions",
      comingSoon: false,
      category: "data"
    },

    
    // Settings
    {
      title: "User Management",
      description: "Manage users, approvals, and permissions",
      icon: <Users className="h-8 w-8 text-primary" />,
      href: "/community-settings",
      comingSoon: false,
      category: "settings"
    },
    {
      title: "Advanced Settings",
      description: "Access advanced platform configuration",
      icon: <Sliders className="h-8 w-8 text-primary" />,
      href: "/advanced-settings",
      comingSoon: false,
      category: "settings"
    },
    {
      title: "Feature Management",
      description: "Configure feature flags and user permissions",
      icon: <ToggleLeft className="h-8 w-8 text-primary" />,
      href: "/admin/feature-management",
      comingSoon: false,
      category: "settings"
    },
    {
      title: "Platinum Sponsor Settings",
      description: "Control platinum sponsor randomization, rotation, and manual order",
      icon: <Sparkles className="h-8 w-8 text-primary" />,
      href: "/admin/platinum-sponsor-settings",
      comingSoon: false,
      category: "settings"
    },

    
    // Tools & Diagnostics
    {
      title: "Version Fix",
      description: "Apply version fixes and updates",
      icon: <RefreshCw className="h-8 w-8 text-primary" />,
      href: "/admin/version-fix",
      comingSoon: false,
      category: "tools"
    },
    {
      title: "Payment Diagnostics",
      description: "Diagnose payment-related issues",
      icon: <CreditCard className="h-8 w-8 text-primary" />,
      href: "/admin/payment-diagnostics",
      comingSoon: false,
      category: "tools"
    },
    {
      title: "Membership Management",
      description: "Manage subscription-based memberships",
      icon: <Users className="h-8 w-8 text-primary" />,
      href: "/admin/membership-management",
      comingSoon: false,
      category: "tools"
    },
    {
      title: "Auth Debug Tools",
      description: "Troubleshoot authentication issues",
      icon: <ShieldAlert className="h-8 w-8 text-primary" />,
      href: "/admin/auth-debug",
      comingSoon: false,
      category: "tools"
    },
    {
      title: "Enhanced Analytics",
      description: "Advanced metrics with geolocation and user behavior analysis",
      icon: <Activity className="h-8 w-8 text-primary" />,
      href: "/admin/enhanced-analytics",
      comingSoon: false,
      category: "analytics"
    },
    
    // In Development
  ];

  return (
    <AdminLayout>
      <div className="container p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome to the Barefoot Bay administration panel. Manage all aspects of your community platform.
          </p>
          
          {/* No Direct Analytics Access Banner Needed Anymore */}
        </div>

        {/* Sidebar Navigation Section - For Mobile Access */}
        <div className="mb-10 xl:hidden">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Menu className="h-6 w-6" />
            Sidebar Navigation
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Quick access to all admin navigation items
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isReady && sidebarNavItems.map((item, index) => (
              <Card key={`sidebar-${index}`} className="overflow-hidden border-solid !border-primary/20">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">{item.title}</CardTitle>
                    {item.icon}
                  </div>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
                <CardFooter className="pt-4">
                  <Button 
                    onClick={() => {
                      if (item.href === '/analytics-dashboard') {
                        window.location.href = item.href;
                      } else {
                        setLocation(item.href);
                      }
                    }}
                    data-testid={`sidebar-nav-${item.testId}`}
                  >
                    {item.title === "Return to Site" ? "Go to Site" : "Open"}
                  </Button>
                </CardFooter>
              </Card>
            ))}
            {/* Log Out Card */}
            <Card className="overflow-hidden border-solid !border-destructive/20">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">Log Out</CardTitle>
                  <LogOut className="h-8 w-8 text-destructive" />
                </div>
                <CardDescription>Sign out of admin panel</CardDescription>
              </CardHeader>
              <CardFooter className="pt-4">
                <Button 
                  variant="destructive"
                  onClick={handleLogout}
                  data-testid="sidebar-nav-logout"
                >
                  Log Out
                </Button>
              </CardFooter>
            </Card>
            {!isReady && (
              <div className="text-muted-foreground col-span-3 text-center py-8">
                Loading cards...
              </div>
            )}
          </div>
        </div>

        {/* Store Management Section */}
        <div className="mb-10">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <ShoppingCart className="h-6 w-6" />
            Store Management
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isReady && adminModules
              .filter(module => module.category === "store")
              .map((module, index) => (
                <Card key={`store-${index}`} className="overflow-hidden border-solid !border-primary/20">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl">{module.title}</CardTitle>
                      {module.icon}
                    </div>
                    <CardDescription>{module.description}</CardDescription>
                  </CardHeader>
                  <CardFooter className="pt-4">
                    {module.comingSoon ? (
                      <Button variant="outline" disabled>Coming Soon</Button>
                    ) : (
                      <Button onClick={() => setLocation(module.href)}>
                        Manage
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            {!isReady && (
              <div className="text-muted-foreground col-span-3 text-center py-8">
                Loading cards...
              </div>
            )}
          </div>
        </div>

        {/* Settings Section */}
        <div className="mb-10">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Platform Settings
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isReady && adminModules
              .filter(module => module.category === "settings")
              .map((module, index) => (
                <Card key={`settings-${index}`} className="overflow-hidden border-solid !border-primary/20">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl">{module.title}</CardTitle>
                      {module.icon}
                    </div>
                    <CardDescription>{module.description}</CardDescription>
                  </CardHeader>
                  <CardFooter className="pt-4">
                    {module.comingSoon ? (
                      <Button variant="outline" disabled>Coming Soon</Button>
                    ) : (
                      <Button onClick={() => setLocation(module.href)}>
                        Manage
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            {!isReady && (
              <div className="text-muted-foreground col-span-3 text-center py-8">
                Loading cards...
              </div>
            )}
          </div>
        </div>

        {/* Content Management Section */}
        <div className="mb-10">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Content Management
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isReady && adminModules
              .filter(module => module.category === "content")
              .map((module, index) => (
                <Card key={`content-${index}`} className="overflow-hidden border-solid !border-primary/20">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl">{module.title}</CardTitle>
                      {module.icon}
                    </div>
                    <CardDescription>{module.description}</CardDescription>
                  </CardHeader>
                  <CardFooter className="pt-4">
                    {module.comingSoon ? (
                      <Button variant="outline" disabled>Coming Soon</Button>
                    ) : (
                      <Button onClick={() => setLocation(module.href)}>
                        Manage
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            {!isReady && (
              <div className="text-muted-foreground col-span-3 text-center py-8">
                Loading cards...
              </div>
            )}
          </div>
        </div>

        {/* Analytics & Reports Section */}
        <div className="mb-10">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Analytics & Reports
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isReady && adminModules
              .filter(module => module.category === "analytics")
              .map((module, index) => (
                <Card key={`analytics-${index}`} className="overflow-hidden border-solid !border-primary/20">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl">{module.title}</CardTitle>
                      {module.icon}
                    </div>
                    <CardDescription>{module.description}</CardDescription>
                  </CardHeader>
                  <CardFooter className="pt-4">
                    {module.comingSoon ? (
                      <Button variant="outline" disabled>Coming Soon</Button>
                    ) : (
                      <Button onClick={() => setLocation(module.href)}>
                        View Analytics
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            {!isReady && (
              <div className="text-muted-foreground col-span-3 text-center py-8">
                Loading cards...
              </div>
            )}
          </div>
        </div>
            
        {/* Forms & Data Section */}
        <div className="mb-10">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Database className="h-6 w-6" />
            Data Management
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isReady && adminModules
              .filter(module => module.category === "data")
              .map((module, index) => (
                <Card key={`data-${index}`} className="overflow-hidden border-solid !border-primary/20">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl">{module.title}</CardTitle>
                      {module.icon}
                    </div>
                    <CardDescription>{module.description}</CardDescription>
                  </CardHeader>
                  <CardFooter className="pt-4">
                    {module.comingSoon ? (
                      <Button variant="outline" disabled>Coming Soon</Button>
                    ) : (
                      <Button onClick={() => setLocation(module.href)}>
                        Manage
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            {!isReady && (
              <div className="text-muted-foreground col-span-3 text-center py-8">
                Loading cards...
              </div>
            )}
          </div>
        </div>

        {/* Tools & Diagnostics Section */}
        <div className="mb-10">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Wrench className="h-6 w-6" />
            Tools & Diagnostics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isReady && adminModules
              .filter(module => module.category === "tools")
              .map((module, index) => (
                <Card key={`tools-${index}`} className="overflow-hidden border-solid !border-primary/20">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl">{module.title}</CardTitle>
                      {module.icon}
                    </div>
                    <CardDescription>{module.description}</CardDescription>
                  </CardHeader>
                  <CardFooter className="pt-4">
                    {module.comingSoon ? (
                      <Button variant="outline" disabled>Coming Soon</Button>
                    ) : (
                      <Button onClick={() => setLocation(module.href)}>
                        Manage
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            {!isReady && (
              <div className="text-muted-foreground col-span-3 text-center py-8">
                Loading cards...
              </div>
            )}
          </div>
        </div>




        
        {/* Media Management Section */}
        <div className="mb-10">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2 mt-8">
            <History className="h-6 w-6" />
            Media Backup
          </h2>
          <div>
            <MediaBackupTools />
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}