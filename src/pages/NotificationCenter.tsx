import React from 'react';
import { NotificationSettings } from '@/components/NotificationSettings';
import { NotificationManager } from '@/components/NotificationManager';
import { NotificationTester } from '@/components/NotificationTester';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, Settings, Send, TestTube } from 'lucide-react';

export const NotificationCenter: React.FC = () => {
  const { user } = useAuth();
  const userRole = user?.user_metadata?.role || 'employee';
  const canManageNotifications = ['admin', 'manager'].includes(userRole);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold">Notification Center</h1>
          <p className="text-muted-foreground">
            Manage your notification preferences and send notifications
          </p>
        </div>
      </div>

      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList className={`grid w-full ${canManageNotifications ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="tester" className="flex items-center gap-2">
            <TestTube className="h-4 w-4" />
            Tester
          </TabsTrigger>
          {canManageNotifications && (
            <TabsTrigger value="manager" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Send Notifications
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="settings">
          <NotificationSettings />
        </TabsContent>

        <TabsContent value="tester">
          <NotificationTester />
        </TabsContent>

        {canManageNotifications && (
          <TabsContent value="manager">
            <NotificationManager />
          </TabsContent>
        )}
      </Tabs>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common notification tasks and shortcuts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-full">
                  <Bell className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium">Test Notifications</h3>
                  <p className="text-sm text-muted-foreground">
                    Send test notifications to verify your setup
                  </p>
                </div>
              </div>
            </Card>

            {canManageNotifications && (
              <>
                <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-full">
                      <Send className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">Send to Role</h3>
                      <p className="text-sm text-muted-foreground">
                        Send notifications to specific user roles
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-full">
                      <Settings className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">System Alerts</h3>
                      <p className="text-sm text-muted-foreground">
                        Send system-wide emergency notifications
                      </p>
                    </div>
                  </div>
                </Card>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Role Information */}
      <Card>
        <CardHeader>
          <CardTitle>Your Role & Permissions</CardTitle>
          <CardDescription>
            Current role and notification capabilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="font-medium">Role:</span>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Can Send Notifications:</span>
              <span className={`px-2 py-1 rounded-full text-sm font-medium ${
                canManageNotifications 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {canManageNotifications ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
