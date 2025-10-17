import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  MapPin,
  DollarSign,
  MessageSquare,
  FileText,
  TrendingUp
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import Alert from '@/utils/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface EmployeeStats {
  myTasks: number;
  completedTasks: number;
  pendingTasks: number;
  urgentTasks: number;
  myExpenses: number;
  pendingExpenses: number;
  unreadMessages: number;
  locationUpdates: number;
}

interface RecentTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string;
  created_at: string;
}

interface RecentExpense {
  id: string;
  amount: number;
  description: string;
  status: string;
  created_at: string;
}

const EmployeeDashboard = () => {
  const { user, isEmployee } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState<EmployeeStats>({
    myTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    urgentTasks: 0,
    myExpenses: 0,
    pendingExpenses: 0,
    unreadMessages: 0,
    locationUpdates: 0,
  });
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<RecentExpense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isEmployee) {
      Alert.error('Access Denied', 'You do not have permission to access this page');       
      navigate('/dashboard');
      return;
    }
    fetchEmployeeData();
  }, [isEmployee, navigate]);

  const fetchEmployeeData = async () => {
    if (!user) return;

    try {
      await Promise.all([
        fetchTaskStats(),
        fetchExpenseStats(),
        fetchRecentTasks(),
        fetchRecentExpenses(),
        fetchMessageStats(),
        fetchLocationStats(),
      ]);
    } catch (error) {
      console.error('Error fetching employee data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTaskStats = async () => {
    if (!user) return;

    try {
      // Get assigned tasks
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
          setStats(prev => ({
            ...prev,
            myTasks: tasks.length,
            completedTasks: tasks.filter(t => t.status === 'completed').length,
            pendingTasks: tasks.filter(t => t.status === 'pending').length,
            urgentTasks: tasks.filter(t => t.priority === 'urgent').length,
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching task stats:', error);
    }
  };

  const fetchExpenseStats = async () => {
    if (!user) return;

    try {
      const { data: expenses } = await supabase
        .from('petty_cash_transactions')
        .select('*')
        .eq('employee_id', user.id);

      if (expenses) {
        setStats(prev => ({
          ...prev,
          myExpenses: expenses.length,
          pendingExpenses: expenses.filter(e => e.status === 'pending').length,
        }));
      }
    } catch (error) {
      console.error('Error fetching expense stats:', error);
    }
  };

  const fetchRecentTasks = async () => {
    if (!user) return;

    try {
      const { data: assignedTasks } = await supabase
        .from('task_assignees')
        .select('task_id')
        .eq('user_id', user.id);

      if (assignedTasks && assignedTasks.length > 0) {
        const taskIds = assignedTasks.map(t => t.task_id);
        const { data: tasks } = await supabase
          .from('tasks')
          .select('*')
          .in('id', taskIds)
          .order('created_at', { ascending: false })
          .limit(5);

        setRecentTasks(tasks || []);
      }
    } catch (error) {
      console.error('Error fetching recent tasks:', error);
    }
  };

  const fetchRecentExpenses = async () => {
    if (!user) return;

    try {
      const { data: expenses } = await supabase
        .from('petty_cash_transactions')
        .select('*')
        .eq('employee_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentExpenses(expenses || []);
    } catch (error) {
      console.error('Error fetching recent expenses:', error);
    }
  };

  const fetchMessageStats = async () => {
    if (!user) return;

    try {
      const { data: messages } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('receiver_id', user.id)
        .eq('is_read', false);

      setStats(prev => ({
        ...prev,
        unreadMessages: messages?.length || 0,
      }));
    } catch (error) {
      console.error('Error fetching message stats:', error);
    }
  };

  const fetchLocationStats = async () => {
    if (!user) return;

    try {
      const { data: locations } = await supabase
        .from('employee_locations')
        .select('id')
        .eq('user_id', user.id)
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      setStats(prev => ({
        ...prev,
        locationUpdates: locations?.length || 0,
      }));
    } catch (error) {
      console.error('Error fetching location stats:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'in_progress': return 'default';
      case 'pending': return 'secondary';
      case 'cancelled': return 'destructive';
      default: return 'default';
    }
  };

  const getExpenseStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'default';
      case 'pending': return 'secondary';
      case 'rejected': return 'destructive';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="text-center space-y-4 max-w-sm mx-auto">
            <div className="relative">
              <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
              <div className="absolute inset-0 w-12 h-12 sm:w-16 sm:h-16 border-4 border-transparent border-t-primary/20 rounded-full animate-pulse"></div>
            </div>
            <div className="space-y-2">
              <p className="text-muted-foreground font-medium">Loading your dashboard...</p>
              <p className="text-sm text-muted-foreground/70">Preparing your workspace</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 sm:space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold">My Dashboard</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Welcome back! Here's what's happening with your tasks and activities.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={() => navigate('/tasks')} variant="outline" className="w-full sm:w-auto">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              View All Tasks
            </Button>
            <Button onClick={() => navigate('/petty-cash')} variant="outline" className="w-full sm:w-auto">
              <DollarSign className="w-4 h-4 mr-2" />
              Submit Expense
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">My Tasks</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-xl sm:text-2xl font-bold">{stats.myTasks}</div>
              <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2 text-xs sm:text-sm text-muted-foreground">
                <span>{stats.completedTasks} completed</span>
                <span className="hidden sm:inline">•</span>
                <span>{stats.pendingTasks} pending</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Urgent Tasks</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-xl sm:text-2xl font-bold text-destructive">{stats.urgentTasks}</div>
              <p className="text-xs text-muted-foreground">
                Requires immediate attention
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">My Expenses</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-xl sm:text-2xl font-bold">{stats.myExpenses}</div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                <span>{stats.pendingExpenses} pending approval</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Unread Messages</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-xl sm:text-2xl font-bold">{stats.unreadMessages}</div>
              <p className="text-xs text-muted-foreground">
                New messages from team
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Recent Tasks */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Tasks</CardTitle>
              <CardDescription>Your latest assigned tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentTasks.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No tasks assigned yet</p>
                  </div>
                ) : (
                  recentTasks.map((task) => (
                    <div key={task.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border rounded-lg space-y-3 sm:space-y-0">
                      <div className="space-y-2 flex-1">
                        <h4 className="font-medium text-sm sm:text-base">{task.title}</h4>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={getPriorityColor(task.priority)} className="text-xs">
                            {task.priority}
                          </Badge>
                          <Badge variant={getStatusColor(task.status)} className="text-xs">
                            {task.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        {task.due_date && (
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            Due: {new Date(task.due_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/tasks')}
                        className="w-full sm:w-auto"
                      >
                        View
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Expenses */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Expenses</CardTitle>
              <CardDescription>Your latest expense submissions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentExpenses.length === 0 ? (
                  <div className="text-center py-8">
                    <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No expenses submitted yet</p>
                    <Button 
                      className="mt-4" 
                      onClick={() => navigate('/petty-cash')}
                    >
                      Submit First Expense
                    </Button>
                  </div>
                ) : (
                  recentExpenses.map((expense) => (
                    <div key={expense.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <h4 className="font-medium">${expense.amount}</h4>
                        <p className="text-sm text-muted-foreground">{expense.description}</p>
                        <div className="flex items-center space-x-2">
                          <Badge variant={getExpenseStatusColor(expense.status)}>
                            {expense.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(expense.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/petty-cash')}
                      >
                        View
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center space-y-2"
                onClick={() => navigate('/tasks')}
              >
                <CheckCircle2 className="w-6 h-6" />
                <span>View My Tasks</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center space-y-2"
                onClick={() => navigate('/petty-cash')}
              >
                <DollarSign className="w-6 h-6" />
                <span>Submit Expense</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center space-y-2"
                onClick={() => navigate('/chat')}
              >
                <MessageSquare className="w-6 h-6" />
                <span>Team Chat</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default EmployeeDashboard;
