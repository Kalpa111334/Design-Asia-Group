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
  Package,
  TrendingUp,
  Users,
  Activity,
  Settings
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { createAdminRole } from '@/utils/adminSetup';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EmployeeDashboard from './dashboards/EmployeeDashboard';
import ManagerDashboard from './dashboards/ManagerDashboard';
import SupervisorDashboard from './dashboards/SupervisorDashboard';

interface DashboardStats {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  urgentTasks: number;
  inProgressTasks: number;
  totalExpenses: number;
  pendingExpenses: number;
  lowStockItems: number;
  activeLocations: number;
}

interface RecentActivity {
  id: string;
  type: 'task' | 'expense' | 'inventory';
  title: string;
  description: string;
  timestamp: string;
  status?: string;
}

interface TasksByPriority {
  low: number;
  medium: number;
  high: number;
  urgent: number;
}

const Dashboard = () => {
  const { user, loading, isAdmin, isManager, isSupervisor, isEmployee, userRole } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    urgentTasks: 0,
    inProgressTasks: 0,
    totalExpenses: 0,
    pendingExpenses: 0,
    lowStockItems: 0,
    activeLocations: 0,
  });
  const [tasksByPriority, setTasksByPriority] = useState<TasksByPriority>({
    low: 0,
    medium: 0,
    high: 0,
    urgent: 0,
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    console.log('Dashboard useEffect - user:', user, 'isAdmin:', isAdmin, 'isManager:', isManager, 'isSupervisor:', isSupervisor, 'isEmployee:', isEmployee, 'userRole:', userRole);
    console.log('User email:', user?.email);
    
    if (user) {
      // Only redirect non-admin users to their specific dashboards
      if (isEmployee) {
        console.log('Redirecting employee to employee dashboard');
        navigate('/dashboard/employee');
        return;
      } else if (isSupervisor) {
        console.log('Redirecting supervisor to supervisor dashboard');
        navigate('/dashboard/supervisor');
        return;
      } else if (isManager) {
        console.log('Redirecting manager to manager dashboard');
        navigate('/dashboard/manager');
        return;
      } else if (isAdmin || userRole === 'admin') {
        // Admin stays on current dashboard and fetches data
        console.log('Admin user - fetching dashboard data');
        fetchDashboardData();
        return;
      } else {
        // User has no role assigned yet, but show dashboard anyway
        console.log('User has no role assigned - showing dashboard');
        fetchDashboardData();
      }
    }
  }, [user, isAdmin, isManager, isSupervisor, isEmployee, userRole, navigate]);

  const fetchDashboardData = async () => {
    setDataLoading(true);
    try {
      await Promise.all([
        fetchTaskStats(),
        fetchExpenseStats(),
        fetchInventoryStats(),
        fetchLocationStats(),
        fetchRecentActivities(),
      ]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setDataLoading(false);
    }
  };

  const fetchTaskStats = async () => {
    if (!user) return;

    try {
      let query = supabase.from('tasks').select('*');

      if (!isAdmin) {
    const { data: assignedTasks } = await supabase
      .from('task_assignees')
      .select('task_id')
      .eq('user_id', user.id);

    if (assignedTasks && assignedTasks.length > 0) {
      const taskIds = assignedTasks.map(t => t.task_id);
          query = query.in('id', taskIds);
        } else {
          return;
        }
      }
      
      const { data: tasks } = await query;

      if (tasks) {
        const priorityCounts: TasksByPriority = {
          low: tasks.filter(t => t.priority === 'low').length,
          medium: tasks.filter(t => t.priority === 'medium').length,
          high: tasks.filter(t => t.priority === 'high').length,
          urgent: tasks.filter(t => t.priority === 'urgent').length,
        };

        setTasksByPriority(priorityCounts);
        setStats(prev => ({
          ...prev,
          totalTasks: tasks.length,
          completedTasks: tasks.filter(t => t.status === 'completed').length,
          pendingTasks: tasks.filter(t => t.status === 'pending').length,
          inProgressTasks: tasks.filter(t => t.status === 'in_progress').length,
          urgentTasks: tasks.filter(t => t.priority === 'urgent').length,
        }));
      }
    } catch (error) {
      console.error('Error fetching task stats:', error);
    }
  };

  const fetchExpenseStats = async () => {
    try {
      let query = supabase.from('petty_cash_transactions').select('*');

      if (!isAdmin && user) {
        query = query.eq('employee_id', user.id);
      }

      const { data: expenses } = await query;

      if (expenses) {
        setStats(prev => ({
          ...prev,
          totalExpenses: expenses.reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0),
          pendingExpenses: expenses.filter(e => e.status === 'pending').length,
        }));
      }
    } catch (error) {
      console.error('Error fetching expense stats:', error);
    }
  };

  const fetchInventoryStats = async () => {
    try {
      const { data: items } = await supabase
        .from('inventory_items')
        .select(`
          *,
          stock_levels (
            current_quantity
          )
        `)
        .eq('is_active', true);

      if (items) {
        const lowStock = items.filter(item => {
          const totalStock = item.stock_levels?.reduce((sum: number, level: any) => sum + level.current_quantity, 0) || 0;
          return totalStock <= item.reorder_level;
        });

        setStats(prev => ({
          ...prev,
          lowStockItems: lowStock.length,
        }));
      }
    } catch (error) {
      console.error('Error fetching inventory stats:', error);
    }
  };

  const fetchLocationStats = async () => {
    try {
      const { data: locations } = await supabase
        .from('employee_locations')
        .select('user_id')
        .eq('is_active', true)
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (locations) {
        const uniqueUsers = new Set(locations.map(l => l.user_id));
        setStats(prev => ({
          ...prev,
          activeLocations: uniqueUsers.size,
        }));
      }
    } catch (error) {
      console.error('Error fetching location stats:', error);
    }
  };

  const fetchRecentActivities = async () => {
    const activities: RecentActivity[] = [];

    try {
      // Recent tasks
      let tasksQuery = supabase
        .from('tasks')
        .select('id, title, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      if (!isAdmin && user) {
        const { data: assignedTasks } = await supabase
          .from('task_assignees')
          .select('task_id')
          .eq('user_id', user.id);

        if (assignedTasks && assignedTasks.length > 0) {
          const taskIds = assignedTasks.map(t => t.task_id);
          tasksQuery = tasksQuery.in('id', taskIds);
        }
      }

      const { data: tasks } = await tasksQuery;

      if (tasks) {
        tasks.forEach(task => {
          activities.push({
            id: task.id,
            type: 'task',
            title: task.title,
            description: `Task ${task.status}`,
            timestamp: task.created_at,
            status: task.status,
          });
        });
      }

      // Recent expenses
      let expensesQuery = supabase
        .from('petty_cash_transactions')
        .select('id, description, status, created_at, amount')
        .order('created_at', { ascending: false })
        .limit(3);

      if (!isAdmin && user) {
        expensesQuery = expensesQuery.eq('employee_id', user.id);
      }

      const { data: expenses } = await expensesQuery;

      if (expenses) {
        expenses.forEach(expense => {
          activities.push({
            id: expense.id,
            type: 'expense',
            title: `LKR ${expense.amount} Expense`,
            description: expense.description || 'No description',
            timestamp: expense.created_at,
            status: expense.status,
          });
        });
      }

      // Sort all activities by timestamp
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentActivities(activities.slice(0, 10));
    } catch (error) {
      console.error('Error fetching recent activities:', error);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed':
      case 'approved':
        return 'text-success';
      case 'in_progress':
      case 'pending':
        return 'text-warning';
      case 'cancelled':
      case 'rejected':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  const completionRate = stats.totalTasks > 0 ? (stats.completedTasks / stats.totalTasks) * 100 : 0;

  const handleCreateAdminRole = async () => {
    if (user) {
      const result = await createAdminRole(user.id);
      if (result.success) {
        // Reload the page to trigger role detection
        window.location.reload();
      } else {
        console.error('Failed to create admin role:', result.error);
      }
    }
  };

  if (loading || dataLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center space-y-4 max-w-sm mx-auto">
            <div className="relative">
              <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
              <div className="absolute inset-0 w-12 h-12 sm:w-16 sm:h-16 border-4 border-transparent border-t-primary/20 rounded-full animate-pulse"></div>
            </div>
            <div className="space-y-2">
              <p className="text-muted-foreground font-medium">Loading dashboard...</p>
              <p className="text-sm text-muted-foreground/70">Preparing your workspace</p>
            </div>
            
            {/* Temporary admin setup button */}
            {user && !isAdmin && !isManager && !isSupervisor && !isEmployee && userRole !== 'admin' && (
              <div className="mt-6 space-y-3">
                <p className="text-sm text-muted-foreground">
                  No user role detected. Click below to set up admin access:
                </p>
                <Button onClick={handleCreateAdminRole} variant="outline" className="w-full sm:w-auto">
                  <Settings className="w-4 h-4 mr-2" />
                  Setup Admin Role
                </Button>
              </div>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) return null;

  // This component now only handles admin dashboard
  // Other roles are redirected to their specific dashboards
  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        <div className="space-y-1 sm:space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Overview of your activities and metrics</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Card className="border-l-4 border-l-primary hover:shadow-lg transition-all">
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Total Tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 sm:space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-2xl sm:text-3xl font-bold">{stats.totalTasks}</div>
                <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8 text-primary opacity-50" />
              </div>
              <div className="space-y-1">
                <Progress value={completionRate} className="h-1.5 sm:h-2" />
                <p className="text-xs text-muted-foreground">{completionRate.toFixed(0)}% completed</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-success hover:shadow-lg transition-all">
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Completed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-2xl sm:text-3xl font-bold text-success">{stats.completedTasks}</div>
                <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8 text-success opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.inProgressTasks} in progress
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-warning hover:shadow-lg transition-all">
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Pending</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-2xl sm:text-3xl font-bold text-warning">{stats.pendingTasks}</div>
                <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-warning opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground">
                Awaiting action
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-destructive hover:shadow-lg transition-all">
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Urgent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-2xl sm:text-3xl font-bold text-destructive">{stats.urgentTasks}</div>
                <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 text-destructive opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground">
                Requires immediate attention
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts and Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Task Priority Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Task Priority Distribution</CardTitle>
              <CardDescription>Breakdown of tasks by priority level</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">Urgent</span>
                    <span className="text-sm text-muted-foreground">{tasksByPriority.urgent}</span>
                  </div>
                  <Progress value={(tasksByPriority.urgent / stats.totalTasks) * 100} className="h-2 bg-destructive/20" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">High</span>
                    <span className="text-sm text-muted-foreground">{tasksByPriority.high}</span>
                  </div>
                  <Progress value={(tasksByPriority.high / stats.totalTasks) * 100} className="h-2 bg-warning/20" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">Medium</span>
                    <span className="text-sm text-muted-foreground">{tasksByPriority.medium}</span>
                  </div>
                  <Progress value={(tasksByPriority.medium / stats.totalTasks) * 100} className="h-2 bg-primary/20" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">Low</span>
                    <span className="text-sm text-muted-foreground">{tasksByPriority.low}</span>
                  </div>
                  <Progress value={(tasksByPriority.low / stats.totalTasks) * 100} className="h-2 bg-muted" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Overview */}
          <Card>
            <CardHeader>
              <CardTitle>System Overview</CardTitle>
              <CardDescription>Quick stats across all modules</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Total Expenses</p>
                    <p className="text-sm text-muted-foreground">{stats.pendingExpenses} pending</p>
                  </div>
                </div>
                <p className="text-lg font-bold">LKR {stats.totalExpenses.toFixed(2)}</p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                    <Package className="w-5 h-5 text-warning" />
                  </div>
                  <div>
                    <p className="font-medium">Low Stock Items</p>
                    <p className="text-sm text-muted-foreground">Needs reordering</p>
                  </div>
                </div>
                <p className="text-lg font-bold">{stats.lowStockItems}</p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium">Active Locations</p>
                    <p className="text-sm text-muted-foreground">Last 24 hours</p>
                  </div>
                </div>
                <p className="text-lg font-bold">{stats.activeLocations}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Recent Activities
            </CardTitle>
            <CardDescription>Latest updates across the system</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivities.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No recent activities</p>
            ) : (
              <div className="space-y-3">
                {recentActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {activity.type === 'task' ? (
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                      ) : activity.type === 'expense' ? (
                        <DollarSign className="w-4 h-4 text-primary" />
                      ) : (
                        <Package className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{activity.title}</p>
                      <p className="text-sm text-muted-foreground">{activity.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                    {activity.status && (
                      <Badge variant="outline" className={getStatusColor(activity.status)}>
                        {activity.status}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
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
