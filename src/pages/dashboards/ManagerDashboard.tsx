import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Users, 
  CheckCircle2, 
  Clock,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  MessageSquare,
  UserCheck,
  FileText
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import Alert from '@/utils/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface ManagerStats {
  teamMembers: number;
  activeTasks: number;
  completedTasks: number;
  pendingApprovals: number;
  teamExpenses: number;
  pendingExpenses: number;
  teamLocations: number;
  unreadMessages: number;
}

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  department: string;
  task_count: number;
  completion_rate: number;
}

interface PendingApproval {
  id: string;
  type: 'expense' | 'task';
  title: string;
  amount?: number;
  employee_name: string;
  created_at: string;
}

const ManagerDashboard = () => {
  const { user, isManager } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState<ManagerStats>({
    teamMembers: 0,
    activeTasks: 0,
    completedTasks: 0,
    pendingApprovals: 0,
    teamExpenses: 0,
    pendingExpenses: 0,
    teamLocations: 0,
    unreadMessages: 0,
  });
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isManager) {
      Alert.error('Access Denied', 'You do not have permission to access this page');       
      navigate('/dashboard');
      return;
    }
    fetchManagerData();
  }, [isManager, navigate]);

  const fetchManagerData = async () => {
    if (!user) return;

    try {
      await Promise.all([
        fetchTeamStats(),
        fetchTeamMembers(),
        fetchPendingApprovals(),
        fetchTeamLocations(),
        fetchMessageStats(),
      ]);
    } catch (error) {
      console.error('Error fetching manager data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamStats = async () => {
    try {
      // Get team members (employees and supervisors under this manager)
      const { data: teamRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['employee', 'supervisor']);

      if (teamRoles) {
        const teamUserIds = teamRoles.map(tr => tr.user_id);
        
        // Get team profiles
        const { data: teamProfiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', teamUserIds);

        setStats(prev => ({
          ...prev,
          teamMembers: teamProfiles?.length || 0,
        }));

        // Get team tasks
        if (teamUserIds.length > 0) {
          const { data: teamTaskAssignees } = await supabase
            .from('task_assignees')
            .select('task_id')
            .in('user_id', teamUserIds);

          if (teamTaskAssignees) {
            const teamTaskIds = teamTaskAssignees.map(tta => tta.task_id);
            const { data: teamTasks } = await supabase
              .from('tasks')
              .select('status')
              .in('id', teamTaskIds);

            if (teamTasks) {
              setStats(prev => ({
                ...prev,
                activeTasks: teamTasks.filter(t => t.status === 'in_progress').length,
                completedTasks: teamTasks.filter(t => t.status === 'completed').length,
              }));
            }
          }

          // Get team expenses
          const { data: teamExpenses } = await supabase
            .from('petty_cash_transactions')
            .select('status')
            .in('employee_id', teamUserIds);

          if (teamExpenses) {
            setStats(prev => ({
              ...prev,
              teamExpenses: teamExpenses.length,
              pendingExpenses: teamExpenses.filter(e => e.status === 'pending').length,
            }));
          }
        }
      }
    } catch (error) {
      console.error('Error fetching team stats:', error);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const { data: teamRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['employee', 'supervisor']);

      if (teamRoles) {
        const teamUserIds = teamRoles.map(tr => tr.user_id);
        
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, department')
          .in('id', teamUserIds);

        if (profiles) {
          // Get task stats for each team member
          const membersWithStats = await Promise.all(
            profiles.map(async (profile) => {
              const { data: assignedTasks } = await supabase
                .from('task_assignees')
                .select('task_id')
                .eq('user_id', profile.id);

              let taskCount = 0;
              let completedCount = 0;

              if (assignedTasks && assignedTasks.length > 0) {
                const taskIds = assignedTasks.map(t => t.task_id);
                const { data: tasks } = await supabase
                  .from('tasks')
                  .select('status')
                  .in('id', taskIds);

                if (tasks) {
                  taskCount = tasks.length;
                  completedCount = tasks.filter(t => t.status === 'completed').length;
                }
              }

              return {
                ...profile,
                task_count: taskCount,
                completion_rate: taskCount > 0 ? (completedCount / taskCount) * 100 : 0,
              };
            })
          );

          setTeamMembers(membersWithStats.slice(0, 5)); // Show top 5
        }
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  };

  const fetchPendingApprovals = async () => {
    try {
      // Get pending expenses
      const { data: pendingExpenses } = await supabase
        .from('petty_cash_transactions')
        .select(`
          id,
          amount,
          description,
          created_at,
          profiles:employee_id (full_name)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5);

      const approvals: PendingApproval[] = [];

      if (pendingExpenses) {
        pendingExpenses.forEach(expense => {
          approvals.push({
            id: expense.id,
            type: 'expense',
            title: expense.description,
            amount: expense.amount,
            employee_name: expense.profiles?.full_name || 'Unknown',
            created_at: expense.created_at,
          });
        });
      }

      setPendingApprovals(approvals);
      setStats(prev => ({
        ...prev,
        pendingApprovals: approvals.length,
      }));
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
    }
  };

  const fetchTeamLocations = async () => {
    try {
      const { data: locations } = await supabase
        .from('employee_locations')
        .select('id')
        .eq('is_active', true)
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      setStats(prev => ({
        ...prev,
        teamLocations: locations?.length || 0,
      }));
    } catch (error) {
      console.error('Error fetching team locations:', error);
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

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading manager dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Manager Dashboard</h1>
            <p className="text-muted-foreground">Team oversight and management tools</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/reports')} variant="outline">
              <BarChart3 className="w-4 h-4 mr-2" />
              Team Reports
            </Button>
            <Button onClick={() => navigate('/users')} variant="outline">
              <Users className="w-4 h-4 mr-2" />
              Manage Team
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Team Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.teamMembers}</div>
              <p className="text-xs text-muted-foreground">
                Active team members
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeTasks}</div>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <span>{stats.completedTasks} completed</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.pendingApprovals}</div>
              <p className="text-xs text-muted-foreground">
                Require your attention
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Team Expenses</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.teamExpenses}</div>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <span>{stats.pendingExpenses} pending</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Team Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Team Performance</CardTitle>
              <CardDescription>Top performing team members</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {teamMembers.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No team members found</p>
                  </div>
                ) : (
                  teamMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <h4 className="font-medium">{member.full_name}</h4>
                        <p className="text-sm text-muted-foreground">{member.department}</p>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm">{member.task_count} tasks</span>
                          <span className="text-sm text-muted-foreground">•</span>
                          <span className="text-sm">{member.completion_rate.toFixed(0)}% completion</span>
                        </div>
                        <Progress value={member.completion_rate} className="w-full" />
                      </div>
                      <Badge variant="outline">
                        {member.completion_rate > 80 ? 'High Performer' : 
                         member.completion_rate > 60 ? 'Good' : 'Needs Support'}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pending Approvals */}
          <Card>
            <CardHeader>
              <CardTitle>Pending Approvals</CardTitle>
              <CardDescription>Items requiring your approval</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingApprovals.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-4" />
                    <p className="text-muted-foreground">No pending approvals</p>
                    <p className="text-sm text-muted-foreground">All caught up!</p>
                  </div>
                ) : (
                  pendingApprovals.map((approval) => (
                    <div key={approval.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <Badge variant={approval.type === 'expense' ? 'default' : 'secondary'}>
                            {approval.type}
                          </Badge>
                        </div>
                        <h4 className="font-medium">{approval.title}</h4>
                        {approval.amount && (
                          <p className="text-sm font-medium">LKR {approval.amount}</p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          By {approval.employee_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(approval.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/petty-cash')}
                      >
                        Review
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
            <CardTitle>Management Tools</CardTitle>
            <CardDescription>Quick access to management functions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center space-y-2"
                onClick={() => navigate('/tasks')}
              >
                <CheckCircle2 className="w-6 h-6" />
                <span>Assign Tasks</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center space-y-2"
                onClick={() => navigate('/petty-cash')}
              >
                <DollarSign className="w-6 h-6" />
                <span>Review Expenses</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center space-y-2"
                onClick={() => navigate('/reports')}
              >
                <BarChart3 className="w-6 h-6" />
                <span>Team Reports</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center space-y-2"
                onClick={() => navigate('/users')}
              >
                <UserCheck className="w-6 h-6" />
                <span>Manage Team</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ManagerDashboard;
