import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  MapPin, 
  Users, 
  CheckCircle2, 
  Clock,
  AlertTriangle,
  Navigation,
  Activity,
  TrendingUp,
  Eye,
  FileText
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import Alert from '@/utils/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface SupervisorStats {
  fieldTeam: number;
  activeLocations: number;
  completedTasks: number;
  pendingTasks: number;
  locationUpdates: number;
  fieldExpenses: number;
  geofenceAlerts: number;
  unreadMessages: number;
}

interface FieldMember {
  id: string;
  full_name: string;
  email: string;
  department: string;
  last_location?: string;
  last_update?: string;
  battery_level?: number;
  active_tasks: number;
}

interface LocationAlert {
  id: string;
  type: 'breach' | 'low_battery' | 'inactive';
  message: string;
  employee_name: string;
  timestamp: string;
}

const SupervisorDashboard = () => {
  const { user, isSupervisor } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState<SupervisorStats>({
    fieldTeam: 0,
    activeLocations: 0,
    completedTasks: 0,
    pendingTasks: 0,
    locationUpdates: 0,
    fieldExpenses: 0,
    geofenceAlerts: 0,
    unreadMessages: 0,
  });
  const [fieldMembers, setFieldMembers] = useState<FieldMember[]>([]);
  const [locationAlerts, setLocationAlerts] = useState<LocationAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupervisor) {
      Alert.error('Access Denied', 'You do not have permission to access this page');       
      navigate('/dashboard');
      return;
    }
    fetchSupervisorData();
  }, [isSupervisor, navigate]);

  const fetchSupervisorData = async () => {
    if (!user) return;

    try {
      await Promise.all([
        fetchFieldTeamStats(),
        fetchFieldMembers(),
        fetchLocationAlerts(),
        fetchLocationStats(),
        fetchMessageStats(),
      ]);
    } catch (error) {
      console.error('Error fetching supervisor data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFieldTeamStats = async () => {
    try {
      // Get field team members (employees under supervisors)
      const { data: teamRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'employee');

      if (teamRoles) {
        const teamUserIds = teamRoles.map(tr => tr.user_id);
        
        setStats(prev => ({
          ...prev,
          fieldTeam: teamUserIds.length,
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
                completedTasks: teamTasks.filter(t => t.status === 'completed').length,
                pendingTasks: teamTasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length,
              }));
            }
          }

          // Get field expenses
          const { data: fieldExpenses } = await supabase
            .from('petty_cash_transactions')
            .select('id')
            .in('employee_id', teamUserIds);

          if (fieldExpenses) {
            setStats(prev => ({
              ...prev,
              fieldExpenses: fieldExpenses.length,
            }));
          }
        }
      }
    } catch (error) {
      console.error('Error fetching field team stats:', error);
    }
  };

  const fetchFieldMembers = async () => {
    try {
      const { data: teamRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'employee');

      if (teamRoles) {
        const teamUserIds = teamRoles.map(tr => tr.user_id);
        
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, department')
          .in('id', teamUserIds);

        if (profiles) {
          // Get location and task data for each field member
          const membersWithData = await Promise.all(
            profiles.map(async (profile) => {
              // Get latest location
              const { data: latestLocation } = await supabase
                .from('employee_locations')
                .select('latitude, longitude, timestamp, battery_level')
                .eq('user_id', profile.id)
                .eq('is_active', true)
                .order('timestamp', { ascending: false })
                .limit(1)
                .single();

              // Get active tasks
              const { data: assignedTasks } = await supabase
                .from('task_assignees')
                .select('task_id')
                .eq('user_id', profile.id);

              let activeTasks = 0;
              if (assignedTasks) {
                const taskIds = assignedTasks.map(t => t.task_id);
                const { data: tasks } = await supabase
                  .from('tasks')
                  .select('status')
                  .in('id', taskIds)
                  .in('status', ['pending', 'in_progress']);

                activeTasks = tasks?.length || 0;
              }

              return {
                ...profile,
                last_location: latestLocation ? 
                  `${latestLocation.latitude.toFixed(4)}, ${latestLocation.longitude.toFixed(4)}` : 
                  'No location data',
                last_update: latestLocation?.timestamp,
                battery_level: latestLocation?.battery_level,
                active_tasks: activeTasks,
              };
            })
          );

          // Sort by last update time
          membersWithData.sort((a, b) => {
            if (!a.last_update) return 1;
            if (!b.last_update) return -1;
            return new Date(b.last_update).getTime() - new Date(a.last_update).getTime();
          });

          setFieldMembers(membersWithData.slice(0, 6)); // Show top 6
        }
      }
    } catch (error) {
      console.error('Error fetching field members:', error);
    }
  };

  const fetchLocationAlerts = async () => {
    try {
      // Simulate location alerts (in a real app, these would come from geofence monitoring)
      const alerts: LocationAlert[] = [];
      
      // Check for low battery levels
      const { data: lowBatteryLocations } = await supabase
        .from('employee_locations')
        .select(`
          id,
          battery_level,
          timestamp,
          profiles:user_id (full_name)
        `)
        .eq('is_active', true)
        .lt('battery_level', 20)
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (lowBatteryLocations) {
        lowBatteryLocations.forEach(location => {
          alerts.push({
            id: `battery-${location.id}`,
            type: 'low_battery',
            message: `Low battery: ${location.battery_level}%`,
            employee_name: location.profiles?.full_name || 'Unknown',
            timestamp: location.timestamp,
          });
        });
      }

      // Check for inactive team members
      const { data: inactiveMembers } = await supabase
        .from('employee_locations')
        .select(`
          user_id,
          timestamp,
          profiles:user_id (full_name)
        `)
        .eq('is_active', true)
        .lt('timestamp', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());

      if (inactiveMembers) {
        inactiveMembers.forEach(member => {
          alerts.push({
            id: `inactive-${member.user_id}`,
            type: 'inactive',
            message: 'No location update in 2+ hours',
            employee_name: member.profiles?.full_name || 'Unknown',
            timestamp: member.timestamp,
          });
        });
      }

      setLocationAlerts(alerts.slice(0, 5));
      setStats(prev => ({
        ...prev,
        geofenceAlerts: alerts.length,
      }));
    } catch (error) {
      console.error('Error fetching location alerts:', error);
    }
  };

  const fetchLocationStats = async () => {
    try {
      const { data: locations } = await supabase
        .from('employee_locations')
        .select('id, user_id')
        .eq('is_active', true)
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (locations) {
        const uniqueUsers = new Set(locations.map(l => l.user_id));
        setStats(prev => ({
          ...prev,
          activeLocations: uniqueUsers.size,
          locationUpdates: locations.length,
        }));
      }
    } catch (error) {
      console.error('Error fetching location stats:', error);
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

  const getBatteryColor = (level?: number) => {
    if (!level) return 'secondary';
    if (level < 20) return 'destructive';
    if (level < 50) return 'default';
    return 'default';
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'breach': return 'destructive';
      case 'low_battery': return 'default';
      case 'inactive': return 'secondary';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading supervisor dashboard...</p>
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
            <h1 className="text-3xl font-bold">Supervisor Dashboard</h1>
            <p className="text-muted-foreground">Field operations and team monitoring</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/locations')} variant="outline">
              <MapPin className="w-4 h-4 mr-2" />
              View Locations
            </Button>
            <Button onClick={() => navigate('/reports')} variant="outline">
              <TrendingUp className="w-4 h-4 mr-2" />
              Field Reports
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Field Team</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.fieldTeam}</div>
              <p className="text-xs text-muted-foreground">
                Active field members
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Locations</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeLocations}</div>
              <p className="text-xs text-muted-foreground">
                Team members with GPS
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Field Tasks</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completedTasks}</div>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <span>{stats.pendingTasks} pending</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.geofenceAlerts}</div>
              <p className="text-xs text-muted-foreground">
                Location & battery alerts
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Field Team Status */}
          <Card>
            <CardHeader>
              <CardTitle>Field Team Status</CardTitle>
              <CardDescription>Real-time location and activity tracking</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {fieldMembers.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No field team members found</p>
                  </div>
                ) : (
                  fieldMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <h4 className="font-medium">{member.full_name}</h4>
                        <p className="text-sm text-muted-foreground">{member.department}</p>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm">{member.active_tasks} active tasks</span>
                          {member.battery_level && (
                            <>
                              <span className="text-sm text-muted-foreground">•</span>
                              <Badge variant={getBatteryColor(member.battery_level)}>
                                {member.battery_level}% battery
                              </Badge>
                            </>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Last update: {member.last_update ? 
                            new Date(member.last_update).toLocaleString() : 
                            'Never'}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant={member.last_update && 
                          new Date(member.last_update).getTime() > Date.now() - 2 * 60 * 60 * 1000 ? 
                          'default' : 'secondary'}>
                          {member.last_update && 
                            new Date(member.last_update).getTime() > Date.now() - 2 * 60 * 60 * 1000 ? 
                            'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Location Alerts */}
          <Card>
            <CardHeader>
              <CardTitle>Location Alerts</CardTitle>
              <CardDescription>Geofence and safety alerts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {locationAlerts.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-4" />
                    <p className="text-muted-foreground">No alerts</p>
                    <p className="text-sm text-muted-foreground">All team members are safe</p>
                  </div>
                ) : (
                  locationAlerts.map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <Badge variant={getAlertColor(alert.type)}>
                            {alert.type.replace('_', ' ')}
                          </Badge>
                        </div>
                        <h4 className="font-medium">{alert.message}</h4>
                        <p className="text-sm text-muted-foreground">
                          {alert.employee_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(alert.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/locations')}
                      >
                        <Eye className="w-4 h-4 mr-2" />
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
            <CardTitle>Field Operations</CardTitle>
            <CardDescription>Quick access to field management tools</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center space-y-2"
                onClick={() => navigate('/locations')}
              >
                <MapPin className="w-6 h-6" />
                <span>Track Locations</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center space-y-2"
                onClick={() => navigate('/tasks')}
              >
                <CheckCircle2 className="w-6 h-6" />
                <span>Field Tasks</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center space-y-2"
                onClick={() => navigate('/geofences')}
              >
                <Navigation className="w-6 h-6" />
                <span>Geofences</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center space-y-2"
                onClick={() => navigate('/reports')}
              >
                <Activity className="w-6 h-6" />
                <span>Field Reports</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default SupervisorDashboard;
