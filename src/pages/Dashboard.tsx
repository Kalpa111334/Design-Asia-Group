import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  BarChart3,
  MapPin,
  DollarSign,
  Package
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';

const Dashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
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
      fetchTaskStats();
    }
  }, [user]);

  const fetchTaskStats = async () => {
    if (!user) return;

    const { data: assignedTasks } = await supabase
      .from('task_assignees')
      .select('task_id')
      .eq('user_id', user.id);

    if (assignedTasks && assignedTasks.length > 0) {
      const taskIds = assignedTasks.map(t => t.task_id);
      
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

  if (!user) return null;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your tasks and activities</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-l-4 border-l-primary">
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

          <Card className="border-l-4 border-l-success">
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

          <Card className="border-l-4 border-l-warning">
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

          <Card className="border-l-4 border-l-destructive">
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="hover:shadow-lg transition-all cursor-pointer" onClick={() => navigate('/tasks')}>
            <CardHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-2">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Tasks</CardTitle>
              <CardDescription>View and manage tasks</CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-all cursor-pointer" onClick={() => navigate('/locations')}>
            <CardHeader>
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-2">
                <MapPin className="w-6 h-6 text-accent" />
              </div>
              <CardTitle>Locations</CardTitle>
              <CardDescription>Track locations</CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-all cursor-pointer" onClick={() => navigate('/petty-cash')}>
            <CardHeader>
              <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center mb-2">
                <DollarSign className="w-6 h-6 text-warning" />
              </div>
              <CardTitle>Petty Cash</CardTitle>
              <CardDescription>Manage expenses</CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-all cursor-pointer" onClick={() => navigate('/inventory')}>
            <CardHeader>
              <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center mb-2">
                <Package className="w-6 h-6 text-success" />
              </div>
              <CardTitle>Inventory</CardTitle>
              <CardDescription>Track stock</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
