import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { signOut, user, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/tasks', icon: CheckSquare, label: 'Tasks' },
    { path: '/locations', icon: MapPin, label: 'Locations' },
    { path: '/chat', icon: MessageSquare, label: 'Chat' },
    { path: '/petty-cash', icon: DollarSign, label: 'Petty Cash' },
    { path: '/inventory', icon: Package, label: 'Inventory' },
    ...(isAdmin ? [{ path: '/geofences', icon: Shield, label: 'Geofences' }] : []),
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const NavContent = () => (
    <>
      <div className="flex items-center gap-2 p-4 border-b">
        <div className="inline-flex items-center justify-center w-10 h-10 bg-gradient-primary rounded-xl">
          <Shield className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h2 className="font-bold">TaskVision</h2>
          <p className="text-xs text-muted-foreground">Enterprise Management</p>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path}>
              <Button
                variant={isActive ? 'default' : 'ghost'}
                className="w-full justify-start"
              >
                <Icon className="w-4 h-4 mr-3" />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t space-y-3">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
          <Avatar>
            <AvatarFallback>{user?.email?.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.email}</p>
            {isAdmin && (
              <Badge variant="default" className="text-xs">Admin</Badge>
            )}
          </div>
        </div>
        <Button onClick={handleSignOut} variant="outline" className="w-full">
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
        <NavContent />
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center justify-center w-8 h-8 bg-gradient-primary rounded-lg">
            <Shield className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold">TaskVision</span>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <div className="flex flex-col h-full">
              <NavContent />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pt-16 md:pt-0">
        <div className="container mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
