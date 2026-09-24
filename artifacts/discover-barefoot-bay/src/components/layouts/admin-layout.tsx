import { ReactNode } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  CalendarDays, 
  FileText, 
  Home,
  ShieldAlert,
  LogOut,
  ToggleLeft,
  CreditCard,
  BarChart3,
  MessageSquare,
  Mail,
  Sparkles,
  Tag,
  Scale,
} from 'lucide-react';
// Analytics components removed per request
import { useLocation, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/components/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { DmcaPerm, useDmcaMe } from '@/lib/dmca-admin';

interface AdminLayoutProps {
  children: ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: JSX.Element;
  highlight?: boolean;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { isAdmin } = usePermissions();
  const dmca = useDmcaMe();

  // If not an admin, show unauthorized message
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <ShieldAlert size={48} className="text-destructive mb-4" />
        <h1 className="text-2xl font-bold mb-2">Admin Access Required</h1>
        <p className="text-muted-foreground mb-4 text-center max-w-md">
          You need administrator privileges to access this area.
        </p>
        <Link href="/">
          <Button>Return to Home</Button>
        </Link>
      </div>
    );
  }

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { href: '/community-settings', label: 'User Management', icon: <Users size={18} /> },
    { href: '/admin/calendar-management', label: 'Calendar Management', icon: <CalendarDays size={18} /> },
    { href: '/admin/on-the-market-emails', label: 'On The Market Emails', icon: <Tag size={18} /> },
    { href: '/admin/feature-management', label: 'Feature Management', icon: <ToggleLeft size={18} /> },
    { href: '/admin/platinum-sponsor-settings', label: 'Platinum Sponsor Settings', icon: <Sparkles size={18} /> },
    { href: '/admin/membership-management', label: 'Membership Management', icon: <CreditCard size={18} /> },
    { href: '/admin/form-submissions', label: 'Form Submissions', icon: <FileText size={18} /> },
    { href: '/admin/messages', label: 'Message Management', icon: <MessageSquare size={18} /> },
    { href: '/admin/email-activity', label: 'Email Activity', icon: <Mail size={18} /> },
  ];

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    window.location.href = '/';
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <div className="hidden xl:flex flex-col w-64 bg-card border-r">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/">
              <div className="font-bold text-lg cursor-pointer flex items-center">
                <span className="text-primary">Admin</span>
              </div>
            </Link>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4">
            {/* Analytics Section - Special highlight */}
            <div className="mb-4">
              <h4 className="text-sm font-bold text-primary mb-2">Analytics & Reports</h4>
              <div className="bg-primary/5 rounded-md p-2 border border-primary/20">
                <a href="/analytics-dashboard">
                  <Button
                    variant={location === '/analytics-dashboard' ? "secondary" : "default"}
                    className={`w-full justify-start ${location === '/analytics-dashboard' ? 'bg-primary text-white' : 'bg-primary/10 text-primary hover:bg-primary/20'} font-semibold`}
                    size="sm"
                  >
                    <BarChart3 size={18} className="mr-2" />
                    Analytics Dashboard
                  </Button>
                </a>
              </div>
            </div>
            
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">Administration</h4>
              <nav className="space-y-1">
                {navItems
                  .filter(item => item.href !== '/analytics-dashboard')
                  .map((item) => (
                    <Link key={item.href} href={item.href}>
                      <Button
                        variant={location === item.href ? "secondary" : "ghost"}
                        className={`w-full justify-start ${location === item.href ? 'bg-muted' : ''}`}
                        size="sm"
                      >
                        <span className="mr-2">{item.icon}</span>
                        {item.label}
                      </Button>
                    </Link>
                  ))}
              </nav>
            </div>

            {dmca.can(DmcaPerm.VIEW) && (
              <div className="mb-4" data-testid="nav-section-legal-compliance">
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">Legal / Compliance</h4>
                <nav className="space-y-1">
                  {[
                    { href: '/admin/dmca', label: 'DMCA Cases', show: true },
                    { href: '/admin/dmca/holds', label: 'Legal Holds', show: dmca.can(DmcaPerm.MANAGE_HOLDS) },
                    { href: '/admin/dmca/repeat-infringers', label: 'Repeat-Infringer Review', show: dmca.can(DmcaPerm.MANAGE_REPEAT_INFRINGER) },
                    { href: '/admin/dmca/settings', label: 'DMCA Settings', show: dmca.can(DmcaPerm.MANAGE_PERMISSIONS) },
                    { href: '/admin/dmca/permissions', label: 'DMCA Permissions', show: dmca.can(DmcaPerm.MANAGE_PERMISSIONS) },
                  ].filter(item => item.show).map(item => (
                    <Link key={item.href} href={item.href}>
                      <Button
                        variant={location === item.href ? "secondary" : "ghost"}
                        className="w-full justify-start"
                        size="sm"
                        data-testid={`link-${item.href.split('/').pop() || 'dmca'}`}
                      >
                        <Scale size={18} className="mr-2" />
                        {item.label}
                      </Button>
                    </Link>
                  ))}
                </nav>
              </div>
            )}

            <Separator className="my-4" />

            <div className="mb-4">
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">General</h4>
              <nav className="space-y-1">
                <Link href="/">
                  <Button variant="ghost" className="w-full justify-start" size="sm">
                    <Home size={18} className="mr-2" />
                    Return to Site
                  </Button>
                </Link>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10" 
                  size="sm"
                  onClick={handleLogout}
                >
                  <LogOut size={18} className="mr-2" />
                  Log Out
                </Button>
              </nav>
            </div>
          </div>
        </ScrollArea>

        {/* User info at bottom */}
        <div className="p-4 border-t">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src={user?.avatarUrl ?? undefined} alt={user?.username || "Admin"} />
              <AvatarFallback>{user?.username?.charAt(0).toUpperCase() || "A"}</AvatarFallback>
            </Avatar>
            <div className="overflow-hidden">
              <p className="text-sm font-medium leading-none truncate">{user?.fullName || user?.username || "Admin"}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email || "admin@example.com"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Mobile header */}
        <header className="xl:hidden p-4 border-b flex items-center justify-between">
          <Link href="/">
            <div className="font-bold text-lg">Admin Panel</div>
          </Link>
          {/* Mobile menu button would go here - simplified for example */}
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}