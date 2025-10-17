import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionContext';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  CheckSquare,
  MapPin,
  MessageSquare,
  DollarSign,
  Package,
  Shield,
  LogOut,
  Menu,
  Users,
  BarChart3 as BarChartIcon,
  FileText,
  Settings,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import NotificationDropdown from './NotificationDropdown';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { signOut, user, isAdmin, isManager, isSupervisor, isEmployee } = useAuth();
  const { canEdit, hasAccess } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();

  const getDashboardRoute = () => {
    if (isAdmin) return '/dashboard/admin';
    if (isManager) return '/dashboard/manager';
    if (isSupervisor) return '/dashboard/supervisor';
    if (isEmployee) return '/dashboard/employee';
    return '/dashboard';
  };

  // Navigation items with permission filtering
  const getRoleSpecificNavItems = () => {
    const allItems = [
      { path: getDashboardRoute(), icon: LayoutDashboard, label: 'Dashboard', resource: 'dashboard' as const },
      { path: '/jobs', icon: FileText, label: 'Jobs', resource: 'jobs' as const },
      { path: '/tasks', icon: CheckSquare, label: 'Tasks', resource: 'tasks' as const },
      { path: '/chat', icon: MessageSquare, label: 'Chat', resource: 'chat' as const },
      { path: '/petty-cash', icon: DollarSign, label: 'Petty Cash', resource: 'petty_cash' as const },
      { path: '/locations', icon: MapPin, label: 'Locations', resource: 'locations' as const },
      { path: '/tracking', icon: MapPin, label: 'Employee Tracking', resource: 'locations' as const },
      { path: '/inventory', icon: Package, label: 'Inventory', resource: 'inventory' as const },
      { path: '/geofences', icon: Shield, label: 'Geofences', resource: 'geofences' as const },
      { path: '/users', icon: Users, label: 'Users', resource: 'users' as const },
      { path: '/reports', icon: BarChartIcon, label: 'Reports', resource: 'reports' as const },
      { path: '/permissions', icon: Settings, label: 'Permissions', resource: 'permissions' as const }
    ];

    // Filter items based on user permissions
    return allItems.filter(item => {
      // Always show dashboard
      if (item.resource === 'dashboard') return true;
      
      // Check if user has any access to this resource
      return hasAccess(item.resource);
    }).map(({ resource, ...item }) => item); // Remove resource property from final items
  };

  const navItems = getRoleSpecificNavItems();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const NavContent = () => (
    <>
      <div className="flex items-center gap-2 p-3 sm:p-4 border-b">
        <div className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-gradient-primary rounded-xl">
          <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
        </div>
        <div>
          <h2 className="font-bold text-sm sm:text-base">TaskVision</h2>
          <p className="text-xs text-muted-foreground">Enterprise Management</p>
        </div>
      </div>

      <nav className="flex-1 p-3 sm:p-4 space-y-1 sm:space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path}>
              <Button
                variant={isActive ? 'default' : 'ghost'}
                className="w-full justify-start h-9 sm:h-10 text-sm"
              >
                <Icon className="w-4 h-4 mr-2 sm:mr-3" />
                <span className="truncate">{item.label}</span>
              </Button>
            </Link>
          );
        })}
        <Link to="/meet">
          <Button
            variant={location.pathname === '/meet' ? 'default' : 'ghost'}
            className="w-full justify-start h-9 sm:h-10 text-sm"
          >
            <Users className="w-4 h-4 mr-2 sm:mr-3" />
            Meet
          </Button>
        </Link>
      </nav>

      <div className="p-3 sm:p-4 border-t space-y-2 sm:space-y-3">
        <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-muted">
          <Avatar className="w-8 h-8 sm:w-10 sm:h-10">
            <AvatarFallback className="text-xs sm:text-sm">{user?.email?.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm font-medium truncate">{user?.email}</p>
            {(isAdmin || isManager || isSupervisor || isEmployee) && (
              <Badge variant="default" className="text-xs mt-1">
                {isAdmin ? 'Admin' : isManager ? 'Manager' : isSupervisor ? 'Supervisor' : 'Employee'}
              </Badge>
            )}
          </div>
        </div>
        <Button onClick={handleSignOut} variant="outline" className="w-full h-9 sm:h-10 text-sm">
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 flex-col border-r bg-card">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center justify-center w-8 h-8 bg-gradient-primary rounded-lg">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold">TaskVision</span>
          </div>
          <NotificationDropdown />
        </div>
        <NavContent />
      </aside>

      {/* Floating PWA Install prompt (appears when available) */}
      <div id="pwa-install-anchor" className="hidden md:block pwa-floating"></div>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b p-3 sm:p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 bg-gradient-primary rounded-lg">
            <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-sm sm:text-base">TaskVision</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <NotificationDropdown />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10">
                <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 sm:w-72">
            <div className="flex flex-col h-full">
              <NavContent />
            </div>
          </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pt-16 md:pt-0">
        <div className="container mx-auto p-4 sm:p-6">
          {(() => {
            // Try to infer current resource from path to decide if we show a view-only banner
            const path = location.pathname;
            const toResource = () => {
              if (path.startsWith('/dashboard')) return 'dashboard' as const;
              if (path.startsWith('/tasks')) return 'tasks' as const;
              if (path.startsWith('/jobs')) return 'jobs' as const;
              if (path.startsWith('/chat')) return 'chat' as const;
              if (path.startsWith('/petty-cash')) return 'petty_cash' as const;
              if (path.startsWith('/locations')) return 'locations' as const;
              if (path.startsWith('/inventory')) return 'inventory' as const;
              if (path.startsWith('/geofences')) return 'geofences' as const;
              if (path.startsWith('/users')) return 'users' as const;
              if (path.startsWith('/reports')) return 'reports' as const;
              if (path.startsWith('/permissions')) return 'permissions' as const;
              return null;
            };

            const res = toResource();
            const isViewOnlyBanner = res && hasAccess(res) && !canEdit(res);

            return (
              <>
                {isViewOnlyBanner && (
                  <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span className="font-medium">View Only</span>
                    <span className="text-sm text-amber-800">You can browse this page but cannot make changes.</span>
                  </div>
                )}
                {children}
              </>
            );
          })()}
        </div>
      </main>
    </div>
  );
};

export default Layout;
