import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  LogOut, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  BarChart3,
  MapPin,
  DollarSign,
  Package
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const Dashboard = () => {
  const { user, signOut, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    urgentTasks: 0,
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchTaskStats();
    }
  }, [user]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user?.id)
      .single();
    
    if (data) {
      setProfile(data);
    }
  };

  const fetchTaskStats = async () => {
    if (!user) return;

    // Fetch tasks assigned to user
    const { data: assignedTasks } = await supabase
      .from('task_assignees')
      .select('task_id')
      .eq('user_id', user.id);

    if (assignedTasks) {
      const taskIds = assignedTasks.map(t => t.task_id);
      
      if (taskIds.length > 0) {
        const { data: tasks } = await supabase
          .from('tasks')
          .select('*')
          .in('id', taskIds);

        if (tasks) {
          setStats({
            totalTasks: tasks.length,
            completedTasks: tasks.filter(t => t.status === 'completed').length,
            pendingTasks: tasks.filter(t => t.status === 'pending').length,
            urgentTasks: tasks.filter(t => t.priority === 'urgent').length,
          });
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="bg-card border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">TaskVision</h1>
              <p className="text-sm text-muted-foreground">Welcome back, {profile?.full_name || 'User'}</p>
            </div>
            <div className="flex items-center gap-4">
              {isAdmin && (
                <Badge variant="default" className="bg-primary">Admin</Badge>
              )}
              <Button variant="ghost" onClick={signOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-all border-l-4 border-l-primary">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold">{stats.totalTasks}</div>
                <CheckCircle2 className="w-8 h-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all border-l-4 border-l-success">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-success">{stats.completedTasks}</div>
                <CheckCircle2 className="w-8 h-8 text-success opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all border-l-4 border-l-warning">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-warning">{stats.pendingTasks}</div>
                <Clock className="w-8 h-8 text-warning opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all border-l-4 border-l-destructive">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Urgent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-destructive">{stats.urgentTasks}</div>
                <AlertCircle className="w-8 h-8 text-destructive opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="hover:shadow-lg transition-all cursor-pointer group">
            <CardHeader>
              <div className="w-12 h-12 bg-primary-light rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Tasks</CardTitle>
              <CardDescription>View and manage your tasks</CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-all cursor-pointer group">
            <CardHeader>
              <div className="w-12 h-12 bg-accent-light rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <MapPin className="w-6 h-6 text-accent" />
              </div>
              <CardTitle>Locations</CardTitle>
              <CardDescription>Track locations and geofences</CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-all cursor-pointer group">
            <CardHeader>
              <div className="w-12 h-12 bg-warning-light rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <DollarSign className="w-6 h-6 text-warning" />
              </div>
              <CardTitle>Petty Cash</CardTitle>
              <CardDescription>Manage expenses and budgets</CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-all cursor-pointer group">
            <CardHeader>
              <div className="w-12 h-12 bg-success-light rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Package className="w-6 h-6 text-success" />
              </div>
              <CardTitle>Inventory</CardTitle>
              <CardDescription>Track stock and movements</CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Welcome Message */}
        <Card className="mt-8 bg-gradient-primary text-primary-foreground">
          <CardHeader>
            <CardTitle className="text-2xl">Welcome to TaskVision</CardTitle>
            <CardDescription className="text-primary-foreground/80">
              Your enterprise task management system is ready to use. 
              {isAdmin ? ' As an admin, you have full access to all features.' : ' Start by viewing your assigned tasks.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;
