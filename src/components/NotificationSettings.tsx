import React, { useState, useEffect } from 'react';
import { useNotifications } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, Settings, Shield, Users, UserCheck, User } from 'lucide-react';

export const NotificationSettings: React.FC = () => {
  const {
    requestNotificationPermission,
    subscribeToPush,
    unsubscribeFromPush,
    isPushSupported,
    isPushSubscribed,
    sendAdminNotification,
    sendManagerNotification,
    sendSupervisorNotification,
    sendEmployeeNotification,
    sendSystemNotification
  } = useNotifications();
  
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isLoading, setIsLoading] = useState(false);
  const [testNotification, setTestNotification] = useState<string | null>(null);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const handlePermissionRequest = async () => {
    setIsLoading(true);
    try {
      const newPermission = await requestNotificationPermission();
      setPermission(newPermission);
    } catch (error) {
      console.error('Failed to request notification permission:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribe = async () => {
    setIsLoading(true);
    try {
      await subscribeToPush();
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    setIsLoading(true);
    try {
      await unsubscribeFromPush();
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendTestNotification = async (role: 'admin' | 'manager' | 'supervisor' | 'employee') => {
    setTestNotification(role);
    try {
      const notificationData = {
        title: `Test ${role.charAt(0).toUpperCase() + role.slice(1)} Notification`,
        body: `This is a test notification for ${role} role`,
        data: {
          notificationId: `test-${role}-${Date.now()}`,
          url: '/dashboard',
          type: 'info',
          test: true
        }
      };

      switch (role) {
        case 'admin':
          await sendAdminNotification(notificationData);
          break;
        case 'manager':
          await sendManagerNotification(notificationData);
          break;
        case 'supervisor':
          await sendSupervisorNotification(notificationData);
          break;
        case 'employee':
          await sendEmployeeNotification(notificationData);
          break;
      }
    } catch (error) {
      console.error(`Failed to send test notification for ${role}:`, error);
    } finally {
      setTimeout(() => setTestNotification(null), 2000);
    }
  };

  const sendSystemTestNotification = async () => {
    setTestNotification('system');
    try {
      await sendSystemNotification({
        title: 'System Test Notification',
        body: 'This is a test system-wide notification',
        data: {
          notificationId: `test-system-${Date.now()}`,
          url: '/dashboard',
          type: 'info',
          test: true
        }
      });
    } catch (error) {
      console.error('Failed to send system test notification:', error);
    } finally {
      setTimeout(() => setTestNotification(null), 2000);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-4 w-4" />;
      case 'manager':
        return <Users className="h-4 w-4" />;
      case 'supervisor':
        return <UserCheck className="h-4 w-4" />;
      case 'employee':
        return <User className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'manager':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'supervisor':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'employee':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (!isPushSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Push Notifications Not Supported
          </CardTitle>
          <CardDescription>
            Your browser does not support push notifications. Please use a modern browser like Chrome, Firefox, or Safari.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Notification Settings
          </CardTitle>
          <CardDescription>
            Manage your push notification preferences and test notifications for different user roles.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Permission Status */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Notification Permission</h3>
              <p className="text-sm text-muted-foreground">
                Current status: <Badge variant={permission === 'granted' ? 'default' : 'secondary'}>
                  {permission}
                </Badge>
              </p>
            </div>
            {permission !== 'granted' && (
              <Button onClick={handlePermissionRequest} disabled={isLoading}>
                {isLoading ? 'Requesting...' : 'Request Permission'}
              </Button>
            )}
          </div>

          {/* Push Subscription */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Push Notifications</h3>
              <p className="text-sm text-muted-foreground">
                Receive real-time notifications even when the app is closed
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={isPushSubscribed}
                onCheckedChange={isPushSubscribed ? handleUnsubscribe : handleSubscribe}
                disabled={isLoading || permission !== 'granted'}
              />
              <span className="text-sm text-muted-foreground">
                {isPushSubscribed ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>

          {/* Test Notifications */}
          <div>
            <h3 className="font-medium mb-4">Test Notifications</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {['admin', 'manager', 'supervisor', 'employee'].map((role) => (
                <Card key={role} className="p-4">
                  <div className="flex flex-col items-center space-y-3">
                    <div className={`p-2 rounded-full ${getRoleColor(role)}`}>
                      {getRoleIcon(role)}
                    </div>
                    <div className="text-center">
                      <h4 className="font-medium capitalize">{role}</h4>
                      <p className="text-xs text-muted-foreground">Role-based notification</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => sendTestNotification(role as any)}
                      disabled={isLoading || testNotification === role}
                      className="w-full"
                    >
                      {testNotification === role ? 'Sending...' : 'Test'}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* System Notification Test */}
          <div>
            <h3 className="font-medium mb-2">System Notification</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Test a system-wide notification that would be sent to all users
            </p>
            <Button
              variant="outline"
              onClick={sendSystemTestNotification}
              disabled={isLoading || testNotification === 'system'}
              className="w-full md:w-auto"
            >
              {testNotification === 'system' ? 'Sending...' : 'Test System Notification'}
            </Button>
          </div>

          {/* Current User Info */}
          <div className="pt-4 border-t">
            <h3 className="font-medium mb-2">Current User</h3>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {user?.user_metadata?.role || 'employee'}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {user?.email}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
