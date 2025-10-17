import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Users, Eye, Edit, X, Save, RotateCcw } from 'lucide-react';
import Layout from '@/components/Layout';
import Alert from '@/utils/alert';
import NoAccess from '@/components/NoAccess';
import { ResourceType, PermissionType, UserRole } from '@/contexts/PermissionContext';

interface PermissionData {
  role: UserRole;
  resource: ResourceType;
  permission: PermissionType;
}

const RESOURCE_LABELS: Record<ResourceType, string> = {
  dashboard: 'Dashboard',
  tasks: 'Tasks',
  jobs: 'Jobs',
  chat: 'Chat',
  petty_cash: 'Petty Cash',
  locations: 'Locations',
  inventory: 'Inventory',
  geofences: 'Geofences',
  users: 'Users',
  reports: 'Reports',
  permissions: 'Permission Management',
  employee_tracking: 'Employee Tracking',
  meet: 'Video Conferencing (MIDIZ)',
  index: 'Landing Page'
};

const RESOURCE_DESCRIPTIONS: Record<ResourceType, string> = {
  dashboard: 'Main dashboard with analytics and overview',
  tasks: 'Task management and assignment system',
  jobs: 'Job creation and management',
  chat: 'Internal messaging and communication',
  petty_cash: 'Expense tracking and petty cash management',
  locations: 'Location management and tracking',
  inventory: 'Stock and inventory management',
  geofences: 'Geofence creation and monitoring',
  users: 'User account management',
  reports: 'Analytics and reporting tools',
  permissions: 'Role and permission configuration',
  employee_tracking: 'Real-time employee location tracking',
  meet: 'Video conferencing and online meetings',
  index: 'Public landing page and authentication'
};

const PERMISSION_LABELS: Record<PermissionType, { label: string; color: string; icon: React.ReactNode }> = {
  no_access: { label: 'No Access', color: 'destructive', icon: <X className="w-4 h-4" /> },
  view_only: { label: 'View Only', color: 'secondary', icon: <Eye className="w-4 h-4" /> },
  edit_only: { label: 'Edit Only', color: 'default', icon: <Edit className="w-4 h-4" /> }
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  supervisor: 'Supervisor',
  employee: 'Employee'
};

const PermissionManagement = () => {
  const [permissions, setPermissions] = useState<PermissionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const { user, isAdmin } = useAuth();

  const resources: ResourceType[] = [
    'dashboard', 'tasks', 'jobs', 'chat', 'petty_cash',
    'locations', 'inventory', 'geofences', 'users', 'reports', 'permissions',
    'employee_tracking', 'meet', 'index'
  ];

  const roles: UserRole[] = ['admin', 'manager', 'supervisor', 'employee'];

  useEffect(() => {
    if (!isAdmin) {
      Alert.error('Access Denied', 'Only administrators can access permission management.');
      return;
    }
    fetchPermissions();
  }, [isAdmin]);

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('permissions')
        .select('*')
        .order('role, resource');

      if (error) throw error;
      setPermissions(data || []);
    } catch (error: any) {
      Alert.error('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const updatePermission = async (role: UserRole, resource: ResourceType, newPermission: PermissionType) => {
    try {
      setSaving(`${role}-${resource}`);
      const { error } = await supabase.rpc('update_permission', {
        target_role: role,
        target_resource: resource,
        new_permission: newPermission
      });

      if (error) throw error;

      // Update local state
      setPermissions(prev => {
        const existing = prev.find(p => p.role === role && p.resource === resource);
        if (existing) {
          return prev.map(p => 
            p.role === role && p.resource === resource 
              ? { ...p, permission: newPermission }
              : p
          );
        } else {
          return [...prev, { role, resource, permission: newPermission }];
        }
      });

      Alert.success('Permission Updated', `Updated ${RESOURCE_LABELS[resource]} permission for ${ROLE_LABELS[role]}`);
    } catch (error: any) {
      Alert.error('Error', error.message);
    } finally {
      setSaving(null);
    }
  };

  const getPermissionForRole = (role: UserRole, resource: ResourceType): PermissionType => {
    const permission = permissions.find(p => p.role === role && p.resource === resource);
    return permission?.permission || 'no_access';
  };

  const resetToDefaults = async () => {
    const confirmed = await Alert.confirm(
      'Reset Permissions',
      'Are you sure you want to reset all permissions to default values? This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      setLoading(true);
      
      // Delete all existing permissions
      await supabase.from('permissions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // Re-run the migration to insert defaults
      await supabase.rpc('sql', {
        query: `
          INSERT INTO permissions (role, resource, permission) VALUES
          ('admin', 'dashboard', 'edit_only'),
          ('admin', 'tasks', 'edit_only'),
          ('admin', 'jobs', 'edit_only'),
          ('admin', 'chat', 'edit_only'),
          ('admin', 'petty_cash', 'edit_only'),
          ('admin', 'locations', 'edit_only'),
          ('admin', 'inventory', 'edit_only'),
          ('admin', 'geofences', 'edit_only'),
          ('admin', 'users', 'edit_only'),
          ('admin', 'reports', 'edit_only'),
          ('admin', 'permissions', 'edit_only'),
          ('admin', 'employee_tracking', 'edit_only'),
          ('admin', 'meet', 'edit_only'),
          ('admin', 'index', 'edit_only'),
          ('manager', 'dashboard', 'view_only'),
          ('manager', 'tasks', 'edit_only'),
          ('manager', 'jobs', 'edit_only'),
          ('manager', 'chat', 'view_only'),
          ('manager', 'petty_cash', 'edit_only'),
          ('manager', 'locations', 'view_only'),
          ('manager', 'inventory', 'view_only'),
          ('manager', 'geofences', 'no_access'),
          ('manager', 'users', 'no_access'),
          ('manager', 'reports', 'view_only'),
          ('manager', 'permissions', 'no_access'),
          ('manager', 'employee_tracking', 'edit_only'),
          ('manager', 'meet', 'edit_only'),
          ('manager', 'index', 'view_only'),
          ('supervisor', 'dashboard', 'view_only'),
          ('supervisor', 'tasks', 'edit_only'),
          ('supervisor', 'jobs', 'edit_only'),
          ('supervisor', 'chat', 'view_only'),
          ('supervisor', 'petty_cash', 'view_only'),
          ('supervisor', 'locations', 'view_only'),
          ('supervisor', 'inventory', 'view_only'),
          ('supervisor', 'geofences', 'view_only'),
          ('supervisor', 'users', 'no_access'),
          ('supervisor', 'reports', 'no_access'),
          ('supervisor', 'permissions', 'no_access'),
          ('supervisor', 'employee_tracking', 'view_only'),
          ('supervisor', 'meet', 'edit_only'),
          ('supervisor', 'index', 'view_only'),
          ('employee', 'dashboard', 'view_only'),
          ('employee', 'tasks', 'view_only'),
          ('employee', 'jobs', 'view_only'),
          ('employee', 'chat', 'view_only'),
          ('employee', 'petty_cash', 'no_access'),
          ('employee', 'locations', 'view_only'),
          ('employee', 'inventory', 'no_access'),
          ('employee', 'geofences', 'no_access'),
          ('employee', 'users', 'no_access'),
          ('employee', 'reports', 'no_access'),
          ('employee', 'permissions', 'no_access'),
          ('employee', 'employee_tracking', 'no_access'),
          ('employee', 'meet', 'edit_only'),
          ('employee', 'index', 'view_only')
          ON CONFLICT (role, resource) DO NOTHING;
        `
      });

      await fetchPermissions();
      Alert.success('Permissions Reset', 'All permissions have been reset to default values.');
    } catch (error: any) {
      Alert.error('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return <NoAccess resource="Permission Management" />;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Permission Management</h1>
            <p className="text-muted-foreground">
              Configure access permissions for different user roles across system resources
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchPermissions} disabled={loading}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button variant="destructive" onClick={resetToDefaults} disabled={loading}>
              Reset to Defaults
            </Button>
          </div>
        </div>

        <Tabs value={selectedRole} onValueChange={(value) => setSelectedRole(value as UserRole)}>
          <TabsList className="grid w-full grid-cols-4">
            {roles.map(role => (
              <TabsTrigger key={role} value={role}>
                <Users className="w-4 h-4 mr-2" />
                {ROLE_LABELS[role]}
              </TabsTrigger>
            ))}
          </TabsList>

          {roles.map(role => (
            <TabsContent key={role} value={role} className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    {ROLE_LABELS[role]} Permissions
                  </CardTitle>
                  <CardDescription>
                    Configure what resources and actions are available to {ROLE_LABELS[role].toLowerCase()}s
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    {resources.map(resource => {
                      const currentPermission = getPermissionForRole(role, resource);
                      const isSaving = saving === `${role}-${resource}`;

                      const containerClasses =
                        currentPermission === 'no_access'
                          ? 'p-4 border rounded-lg bg-red-50 border-red-200'
                          : currentPermission === 'view_only'
                          ? 'p-4 border rounded-lg bg-amber-50 border-amber-200'
                          : 'p-4 border rounded-lg bg-primary/5 border-primary/20';

                      return (
                        <div key={resource} className={`flex items-center justify-between ${containerClasses}`}>
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                currentPermission === 'no_access'
                                  ? 'bg-red-500'
                                  : currentPermission === 'view_only'
                                  ? 'bg-amber-500'
                                  : 'bg-primary'
                              }`}
                            />
                            <div>
                              <h4 className="font-medium">{RESOURCE_LABELS[resource]}</h4>
                              <p className="text-sm text-muted-foreground">
                                {RESOURCE_DESCRIPTIONS[resource]}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <Badge
                              variant={
                                currentPermission === 'no_access'
                                  ? ('destructive' as any)
                                  : PERMISSION_LABELS[currentPermission].color as any
                              }
                              className="flex items-center gap-1"
                            >
                              {PERMISSION_LABELS[currentPermission].icon}
                              {PERMISSION_LABELS[currentPermission].label}
                            </Badge>
                            
                            <Select
                              value={currentPermission}
                              onValueChange={(value: PermissionType) => updatePermission(role, resource, value)}
                              disabled={isSaving}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(PERMISSION_LABELS).map(([permission, config]) => (
                                  <SelectItem key={permission} value={permission}>
                                    <div className="flex items-center gap-2">
                                      {config.icon}
                                      {config.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle>Permission Types</CardTitle>
            <CardDescription>Understanding the different permission levels</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {Object.entries(PERMISSION_LABELS).map(([permission, config]) => (
                <div key={permission} className="flex items-start gap-3 p-4 border rounded-lg">
                  <Badge variant={config.color as any} className="flex items-center gap-1">
                    {config.icon}
                    {config.label}
                  </Badge>
                  <div className="flex-1">
                    <h4 className="font-medium">{config.label}</h4>
                    <p className="text-sm text-muted-foreground">
                      {permission === 'no_access' && 'User cannot access this page at all - will see "No Access" message'}
                      {permission === 'view_only' && 'User can view everything but cannot make any changes'}
                      {permission === 'edit_only' && 'User can both view and edit (create, update, delete)'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default PermissionManagement;
