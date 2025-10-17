import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { BarChart3, TrendingUp, TrendingDown, Users, Package, DollarSign, CheckCircle, Clock, FileText, Calendar } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import Layout from '@/components/Layout';
import Alert from '@/utils/alert';

interface AnalyticsData {
  tasks: {
    total: number;
    completed: number;
    pending: number;
    inProgress: number;
    byPriority: { [key: string]: number };
    byStatus: { [key: string]: number };
    completionRate: number;
  };
  expenses: {
    total: number;
    approved: number;
    pending: number;
    rejected: number;
    byCategory: Array<{ category: string; amount: number }>;
    avgAmount: number;
  };
  inventory: {
    totalItems: number;
    lowStock: number;
    totalValue: number;
    movements: number;
    alerts: number;
  };
  users: {
    total: number;
    active: number;
    byRole: { [key: string]: number };
  };
}

const Reports = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    tasks: {
      total: 0,
      completed: 0,
      pending: 0,
      inProgress: 0,
      byPriority: {},
      byStatus: {},
      completionRate: 0,
    },
    expenses: {
      total: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
      byCategory: [],
      avgAmount: 0,
    },
    inventory: {
      totalItems: 0,
      lowStock: 0,
      totalValue: 0,
      movements: 0,
      alerts: 0,
    },
    users: {
      total: 0,
      active: 0,
      byRole: {},
    },
  });
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAdmin) {
      Alert.error('Access Denied', 'You do not have permission to access this page');       
      navigate('/dashboard');
      return;
    }
    fetchAnalytics();
  }, [isAdmin, navigate, timeRange]);

  const getTimeThreshold = () => {
    const now = new Date();
    switch (timeRange) {
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const timeThreshold = getTimeThreshold();
      await Promise.all([
        fetchTaskAnalytics(timeThreshold),
        fetchExpenseAnalytics(timeThreshold),
        fetchInventoryAnalytics(),
        fetchUserAnalytics(),
      ]);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTaskAnalytics = async (timeThreshold: Date) => {
    try {
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('*')
        .gte('created_at', timeThreshold.toISOString());

      if (error) throw error;

      const byPriority: { [key: string]: number } = {};
      const byStatus: { [key: string]: number } = {};

      tasks?.forEach((task) => {
        byPriority[task.priority] = (byPriority[task.priority] || 0) + 1;
        byStatus[task.status] = (byStatus[task.status] || 0) + 1;
      });

      const completed = tasks?.filter((t) => t.status === 'completed').length || 0;
      const total = tasks?.length || 0;

      setAnalytics((prev) => ({
        ...prev,
        tasks: {
          total,
          completed,
          pending: tasks?.filter((t) => t.status === 'pending').length || 0,
          inProgress: tasks?.filter((t) => t.status === 'in_progress').length || 0,
          byPriority,
          byStatus,
          completionRate: total > 0 ? (completed / total) * 100 : 0,
        },
      }));
    } catch (error: any) {
      console.error('Error fetching task analytics:', error);
    }
  };

  const fetchExpenseAnalytics = async (timeThreshold: Date) => {
    try {
      const { data: transactions, error } = await supabase
        .from('petty_cash_transactions')
        .select(`
          *,
          petty_cash_categories (name)
        `)
        .gte('created_at', timeThreshold.toISOString());

      if (error) throw error;

      const categoryMap = new Map<string, number>();
      let totalAmount = 0;

      transactions?.forEach((tx) => {
        const amount = parseFloat(tx.amount.toString());
        totalAmount += amount;
        const catName = tx.petty_cash_categories?.name || 'Uncategorized';
        categoryMap.set(catName, (categoryMap.get(catName) || 0) + amount);
      });

      const byCategory = Array.from(categoryMap.entries()).map(([category, amount]) => ({
        category,
        amount,
      }));

      setAnalytics((prev) => ({
        ...prev,
        expenses: {
          total: totalAmount,
          approved: transactions?.filter((t) => t.status === 'approved').reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0) || 0,
          pending: transactions?.filter((t) => t.status === 'pending').length || 0,
          rejected: transactions?.filter((t) => t.status === 'rejected').length || 0,
          byCategory,
          avgAmount: transactions?.length ? totalAmount / transactions.length : 0,
        },
      }));
    } catch (error: any) {
      console.error('Error fetching expense analytics:', error);
    }
  };

  const fetchInventoryAnalytics = async () => {
    try {
      const { data: items, error: itemsError } = await supabase
        .from('inventory_items')
        .select(`
          *,
          stock_levels (current_quantity)
        `)
        .eq('is_active', true);

      const { data: movements, error: movementsError } = await supabase
        .from('stock_movements')
        .select('id');

      const { data: alerts, error: alertsError } = await supabase
        .from('inventory_alerts')
        .select('id')
        .eq('is_resolved', false);

      if (itemsError) throw itemsError;

      const lowStock = items?.filter((item) => {
        const totalStock = item.stock_levels?.reduce((sum: number, level: any) => sum + level.current_quantity, 0) || 0;
        return totalStock <= item.reorder_level;
      }).length || 0;

      const totalValue = items?.reduce((sum, item) => {
        const stock = item.stock_levels?.reduce((s: number, l: any) => s + l.current_quantity, 0) || 0;
        return sum + stock * (item.unit_price || 0);
      }, 0) || 0;

      setAnalytics((prev) => ({
        ...prev,
        inventory: {
          totalItems: items?.length || 0,
          lowStock,
          totalValue,
          movements: movements?.length || 0,
          alerts: alerts?.length || 0,
        },
      }));
    } catch (error: any) {
      console.error('Error fetching inventory analytics:', error);
    }
  };

  const fetchUserAnalytics = async () => {
    try {
      // Get profiles without relationships first
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) throw profilesError;

      // Get user roles separately
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const { data: locations, error: locationsError } = await supabase
        .from('employee_locations')
        .select('user_id')
        .eq('is_active', true)
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (locationsError) throw locationsError;

      const byRole: { [key: string]: number } = {};
      userRoles?.forEach((ur: any) => {
        byRole[ur.role] = (byRole[ur.role] || 0) + 1;
      });

      const activeUsers = new Set(locations?.map((l) => l.user_id)).size;

      setAnalytics((prev) => ({
        ...prev,
        users: {
          total: profiles?.length || 0,
          active: activeUsers,
          byRole,
        },
      }));
    } catch (error: any) {
      console.error('Error fetching user analytics:', error);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading analytics...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Reports & Analytics</h1>
            <p className="text-muted-foreground">Comprehensive insights and performance metrics</p>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Task Completion
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-2">{analytics.tasks.completionRate.toFixed(1)}%</div>
              <Progress value={analytics.tasks.completionRate} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                {analytics.tasks.completed} of {analytics.tasks.total} completed
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-success">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Total Expenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-2">${analytics.expenses.total.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                Avg: ${analytics.expenses.avgAmount.toFixed(2)} per transaction
              </p>
              <p className="text-xs text-muted-foreground">
                {analytics.expenses.pending} pending approval
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-warning">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Package className="w-4 h-4" />
                Inventory Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-2">${analytics.inventory.totalValue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                {analytics.inventory.totalItems} items tracked
              </p>
              <p className="text-xs text-destructive">
                {analytics.inventory.lowStock} items low on stock
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-accent">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="w-4 h-4" />
                Active Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-2">{analytics.users.active}</div>
              <p className="text-xs text-muted-foreground">
                of {analytics.users.total} total users
              </p>
              <p className="text-xs text-muted-foreground">Last 24 hours</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="tasks" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Task Status Breakdown</CardTitle>
                  <CardDescription>Distribution of tasks by status</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(analytics.tasks.byStatus).map(([status, count]) => (
                    <div key={status} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium capitalize">{status.replace('_', ' ')}</span>
                        <span className="text-sm text-muted-foreground">{count}</span>
                      </div>
                      <Progress value={(count / analytics.tasks.total) * 100} className="h-2" />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Priority Distribution</CardTitle>
                  <CardDescription>Tasks by priority level</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(analytics.tasks.byPriority).map(([priority, count]) => (
                    <div key={priority} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium capitalize">{priority}</span>
                        <span className="text-sm text-muted-foreground">{count}</span>
                      </div>
                      <Progress value={(count / analytics.tasks.total) * 100} className="h-2" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Task Metrics</CardTitle>
                <CardDescription>Key performance indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 rounded-lg bg-muted">
                    <CheckCircle className="w-8 h-8 text-success mx-auto mb-2" />
                    <div className="text-2xl font-bold">{analytics.tasks.completed}</div>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted">
                    <Clock className="w-8 h-8 text-warning mx-auto mb-2" />
                    <div className="text-2xl font-bold">{analytics.tasks.inProgress}</div>
                    <p className="text-xs text-muted-foreground">In Progress</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted">
                    <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <div className="text-2xl font-bold">{analytics.tasks.pending}</div>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted">
                    <BarChart3 className="w-8 h-8 text-primary mx-auto mb-2" />
                    <div className="text-2xl font-bold">{analytics.tasks.total}</div>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expenses" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Expenses by Category</CardTitle>
                <CardDescription>Spending breakdown across categories</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {analytics.expenses.byCategory.map(({ category, amount }) => (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{category}</span>
                      <span className="text-sm font-semibold">${amount.toFixed(2)}</span>
                    </div>
                    <Progress value={(amount / analytics.expenses.total) * 100} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Approved</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold text-success">${analytics.expenses.approved.toFixed(2)}</div>
                    <TrendingUp className="w-6 h-6 text-success" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Pending</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold text-warning">{analytics.expenses.pending}</div>
                    <Clock className="w-6 h-6 text-warning" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Rejected</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold text-destructive">{analytics.expenses.rejected}</div>
                    <TrendingDown className="w-6 h-6 text-destructive" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="inventory" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Inventory Overview</CardTitle>
                  <CardDescription>Current stock status</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                    <div className="flex items-center gap-3">
                      <Package className="w-5 h-5 text-primary" />
                      <span>Total Items</span>
                    </div>
                    <span className="text-xl font-bold">{analytics.inventory.totalItems}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/10">
                    <div className="flex items-center gap-3">
                      <TrendingDown className="w-5 h-5 text-destructive" />
                      <span>Low Stock</span>
                    </div>
                    <span className="text-xl font-bold text-destructive">{analytics.inventory.lowStock}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-success/10">
                    <div className="flex items-center gap-3">
                      <DollarSign className="w-5 h-5 text-success" />
                      <span>Total Value</span>
                    </div>
                    <span className="text-xl font-bold text-success">${analytics.inventory.totalValue.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Activity Metrics</CardTitle>
                  <CardDescription>Recent inventory activity</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                    <div className="flex items-center gap-3">
                      <BarChart3 className="w-5 h-5 text-accent" />
                      <span>Stock Movements</span>
                    </div>
                    <span className="text-xl font-bold">{analytics.inventory.movements}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-warning/10">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-warning" />
                      <span>Active Alerts</span>
                    </div>
                    <span className="text-xl font-bold text-warning">{analytics.inventory.alerts}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>User Distribution by Role</CardTitle>
                <CardDescription>Team composition overview</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(analytics.users.byRole).map(([role, count]) => (
                  <div key={role} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {role}
                        </Badge>
                      </div>
                      <span className="text-sm font-semibold">{count} users</span>
                    </div>
                    <Progress value={(count / analytics.users.total) * 100} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>User Activity</CardTitle>
                  <CardDescription>Recent engagement metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center p-6">
                    <Users className="w-16 h-16 text-primary mx-auto mb-4" />
                    <div className="text-4xl font-bold mb-2">{analytics.users.active}</div>
                    <p className="text-muted-foreground">Active in last 24 hours</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      {((analytics.users.active / analytics.users.total) * 100).toFixed(1)}% activity rate
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Total Users</CardTitle>
                  <CardDescription>Complete user base</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center p-6">
                    <Users className="w-16 h-16 text-accent mx-auto mb-4" />
                    <div className="text-4xl font-bold mb-2">{analytics.users.total}</div>
                    <p className="text-muted-foreground">Registered users</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Reports;

