import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Users, Shield, UserPlus, Edit, Trash2, Mail, Phone, Building } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import Layout from '@/components/Layout';
import Alert from '@/utils/alert';
import NoAccess from '@/components/NoAccess';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  department: string | null;
  created_at: string;
  user_roles: Array<{
    role: string;
  }>;
}

interface RoleStats {
  admin: number;
  manager: number;
  supervisor: number;
  employee: number;
}

const UserManagement = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roleStats, setRoleStats] = useState<RoleStats>({
    admin: 0,
    manager: 0,
    supervisor: 0,
    employee: 0,
  });
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [userAccountStatus, setUserAccountStatus] = useState<Record<string, any>>({});
  const { user, isAdmin } = useAuth();
  const { canEdit, hasAccess, checkAccessAndNavigate } = usePermissions();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    department: '',
    role: 'employee',
  });

  const [newUserFormData, setNewUserFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    phone: '',
    department: '',
    role: 'employee',
  });

  useEffect(() => {
    if (!checkAccessAndNavigate('users')) {
      return;
    }
    fetchUsers();
  }, [checkAccessAndNavigate]);

  const fetchUsers = async () => {
    try {
      // Get profiles without relationships first
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Get user roles separately
      const { data: userRolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Combine the data
      const usersData = profilesData?.map(profile => ({
        ...profile,
        user_roles: userRolesData?.filter(ur => ur.user_id === profile.id) || []
      })) || [];

      setUsers(usersData);

      // Calculate role stats
      const stats: RoleStats = {
        admin: 0,
        manager: 0,
        supervisor: 0,
        employee: 0,
      };

      userRolesData?.forEach((ur: any) => {
        if (stats.hasOwnProperty(ur.role)) {
          stats[ur.role as keyof RoleStats]++;
        }
      });

      setRoleStats(stats);
      
      // Fetch user account status after users are loaded
      if (usersData.length > 0) {
        fetchUserAccountStatus(usersData);
      }
    } catch (error: any) {
      const { default: Alert } = await import('@/utils/alert');
      Alert.error('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (user: UserProfile) => {
    setSelectedUser(user);
    setFormData({
      full_name: user.full_name,
      phone: user.phone || '',
      department: user.department || '',
      role: user.user_roles?.[0]?.role || 'employee',
    });
    setEditOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone || null,
          department: formData.department || null,
        })
        .eq('id', selectedUser.id);

      if (profileError) throw profileError;

      // Update role if changed
      const currentRole = selectedUser.user_roles?.[0]?.role;
      if (currentRole !== formData.role) {
        // Delete existing roles
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', selectedUser.id);

        // Insert new role
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: selectedUser.id,
            role: formData.role,
          });

        if (roleError) throw roleError;
      }

      const { default: AlertSvc } = await import('@/utils/alert');
      AlertSvc.success('User updated successfully');

      setEditOpen(false);
      fetchUsers();
    } catch (error: any) {
      const { default: AlertSvc } = await import('@/utils/alert');
      AlertSvc.error('Error', error.message);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    // Prevent users from deleting themselves
    if (userId === user?.id) {
      Alert.error('Error', 'You cannot delete your own account');
      return;
    }

    const confirmed = await Alert.confirm(
      'Delete User', 
      'This will permanently delete the user and all their data. This action cannot be undone. Are you sure?'
    );
    if (!confirmed) return;

    try {
      // Use the comprehensive deletion function
      const { data: deleteResult, error: deleteError } = await supabase.rpc('delete_user_completely', {
        user_id_param: userId
      });

      if (deleteError) throw deleteError;

      if (!deleteResult.success) {
        throw new Error(deleteResult.message || 'Failed to delete user');
      }

      // Delete from auth.users table using admin API
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);

      if (authError) {
        console.warn('Error deleting auth user:', authError);
        // Continue anyway, the database data is already deleted
      }

      Alert.success(`User deleted successfully. ${deleteResult.deleted_count} records removed.`);
      fetchUsers();
    } catch (error: any) {
      console.error('User deletion error:', error);
      Alert.error('Error', error.message || 'Failed to delete user');
    }
  };

  const handleDisableUser = async (userId: string, userName: string) => {
    const confirmed = await Alert.confirm(
      'Disable User Account', 
      `Are you sure you want to disable ${userName}'s account? They will not be able to access the system until an admin re-enables it.`
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase.rpc('admin_disable_user', {
        user_id_param: userId
      });

      if (error) throw error;

      Alert.success('Success', 'User account has been disabled successfully');
      fetchUsers();
      fetchUserAccountStatus();
    } catch (error: any) {
      console.error('Error disabling user:', error);
      Alert.error('Error', error.message || 'Failed to disable user account');
    }
  };

  const handleEnableUser = async (userId: string, userName: string) => {
    const confirmed = await Alert.confirm(
      'Enable User Account', 
      `Are you sure you want to enable ${userName}'s account? They will be able to access the system again.`
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase.rpc('admin_enable_user', {
        user_id_param: userId
      });

      if (error) throw error;

      Alert.success('Success', 'User account has been enabled successfully');
      fetchUsers();
      fetchUserAccountStatus();
    } catch (error: any) {
      console.error('Error enabling user:', error);
      Alert.error('Error', error.message || 'Failed to enable user account');
    }
  };

  const fetchUserAccountStatus = async (usersToCheck: UserProfile[] = users) => {
    try {
      const statusMap: Record<string, any> = {};
      
      for (const userProfile of usersToCheck) {
        const { data, error } = await supabase.rpc('get_user_account_status', {
          user_id_param: userProfile.id
        });
        
        if (!error && data && data.length > 0) {
          statusMap[userProfile.id] = data[0];
        }
      }
      
      setUserAccountStatus(statusMap);
    } catch (error: any) {
      console.error('Error fetching user account status:', error);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Create user directly without email confirmation
      // The database trigger will automatically confirm the email
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUserFormData.email,
        password: newUserFormData.password,
        options: {
          data: {
            full_name: newUserFormData.full_name,
          },
          // No emailRedirectTo - email will be auto-confirmed by database trigger
        },
      });

      if (authError) {
        console.error('Auth error:', authError);
        throw authError;
      }

      if (!authData.user) {
        throw new Error('User creation failed - no user returned');
      }

      console.log('User created successfully:', authData.user.id);

      // Wait for the database trigger to create profile and confirm email
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Create or update profile using the function with elevated permissions
      const { error: profileError } = await supabase.rpc('create_user_profile', {
        user_id_param: authData.user.id,
        full_name_param: newUserFormData.full_name,
        email_param: newUserFormData.email,
        phone_param: newUserFormData.phone || null,
        department_param: newUserFormData.department || null,
      });

      if (profileError) {
        console.error('Profile creation error:', profileError);
        throw profileError;
      }

      console.log('Profile created, assigning role...');

      // Assign role using the function with elevated permissions
      const { error: roleError } = await supabase.rpc('assign_user_role', {
        user_id_param: authData.user.id,
        role_param: newUserFormData.role,
      });

      if (roleError) {
        console.error('Role assignment error:', roleError);
        throw roleError;
      }

      const { default: AlertSvc } = await import('@/utils/alert');
      AlertSvc.success('User created successfully');

      // Reset form and close dialog
      setNewUserFormData({
        full_name: '',
        email: '',
        password: '',
        phone: '',
        department: '',
        role: 'employee',
      });
      setAddUserOpen(false);
      fetchUsers();
    } catch (error: any) {
      console.error('User creation error:', error);
      const { default: AlertSvc } = await import('@/utils/alert');
      AlertSvc.error('Error', error.message || 'Failed to create user');
    }
  };

  const getRoleBadgeVariant = (role: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'manager':
        return 'default';
      case 'supervisor':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getUserRole = (user: UserProfile) => {
    return user.user_roles?.[0]?.role || 'employee';
  };

  const filteredUsers = users.filter((u) => {
    if (roleFilter === 'all') return true;
    return getUserRole(u) === roleFilter;
  });

  const totalUsers = users.length;

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading users...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Check for access permission - this will handle auto-backout for no_access
  if (!hasAccess('users')) {
    return <NoAccess resource="User Management" />;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">User Management</h1>
            <p className="text-muted-foreground">Manage users, roles, and permissions</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
              <DialogTrigger asChild>
                <Button disabled={!canEdit('users')}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New User</DialogTitle>
                  <DialogDescription>
                    Create a new user account with role assignment
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddUser} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name *</Label>
                    <Input
                      id="full_name"
                      value={newUserFormData.full_name}
                      onChange={(e) => setNewUserFormData({ ...newUserFormData, full_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newUserFormData.email}
                      onChange={(e) => setNewUserFormData({ ...newUserFormData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={newUserFormData.password}
                      onChange={(e) => setNewUserFormData({ ...newUserFormData, password: e.target.value })}
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={newUserFormData.phone}
                      onChange={(e) => setNewUserFormData({ ...newUserFormData, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Input
                      id="department"
                      value={newUserFormData.department}
                      onChange={(e) => setNewUserFormData({ ...newUserFormData, department: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role *</Label>
                    <Select
                      value={newUserFormData.role}
                      onValueChange={(value) => setNewUserFormData({ ...newUserFormData, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">Employee</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAddUserOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">Create User</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold">{totalUsers}</div>
                <Users className="w-8 h-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-destructive">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Admins</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold">{roleStats.admin}</div>
                <Shield className="w-8 h-8 text-destructive opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-accent">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Managers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{roleStats.manager}</div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-warning">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Supervisors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{roleStats.supervisor}</div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-success">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Employees</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{roleStats.employee}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filter by Role</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="supervisor">Supervisor</SelectItem>
                <SelectItem value="employee">Employee</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Users List */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredUsers.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No users found</p>
              </CardContent>
            </Card>
          ) : (
            filteredUsers.map((userProfile) => {
              const role = getUserRole(userProfile);

              return (
                <Card key={userProfile.id} className="hover:shadow-lg transition-all">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                            {userProfile.full_name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-lg">{userProfile.full_name}</CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={getRoleBadgeVariant(role)}>
                              {role}
                            </Badge>
                            {userAccountStatus[userProfile.id]?.is_banned && (
                              <Badge variant="destructive" className="text-xs">
                                Disabled
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground truncate">{userProfile.email}</span>
                      </div>
                      {userProfile.phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{userProfile.phone}</span>
                        </div>
                      )}
                      {userProfile.department && (
                        <div className="flex items-center gap-2 text-sm">
                          <Building className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{userProfile.department}</span>
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Joined: {new Date(userProfile.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t">
                      {canEdit('users') && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleEditUser(userProfile)}
                        >
                          <Edit className="w-3 h-3 mr-2" />
                          Edit
                        </Button>
                      )}
                      {canEdit('users') && userProfile.id !== user?.id && (
                        <>
                          {/* Disable/Enable Button */}
                          {userAccountStatus[userProfile.id]?.is_banned ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 hover:text-green-700"
                              onClick={() => handleEnableUser(userProfile.id, userProfile.full_name)}
                            >
                              <Shield className="w-3 h-3 mr-2" />
                              Enable
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-orange-600 hover:text-orange-700"
                              onClick={() => handleDisableUser(userProfile.id, userProfile.full_name)}
                            >
                              <Shield className="w-3 h-3 mr-2" />
                              Disable
                            </Button>
                          )}
                          
                          {/* Delete Button */}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteUser(userProfile.id)}
                          >
                            <Trash2 className="w-3 h-3 mr-2" />
                            Delete
                          </Button>
                        </>
                      )}
                      {userProfile.id === user?.id && (
                        <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            Current User
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Edit User Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>Update user information and role</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">
                Update User
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default UserManagement;

