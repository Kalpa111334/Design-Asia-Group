import React, { useState } from 'react';
import { useNotifications } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  TestTube, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Bell,
  Users,
  User,
  Shield,
  UserCheck
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface TestResult {
  test: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  timestamp: Date;
}

export const NotificationTester: React.FC = () => {
  const {
    isPushSupported,
    isPushSubscribed,
    requestNotificationPermission,
    subscribeToPush,
    unsubscribeFromPush,
    sendAdminNotification,
    sendManagerNotification,
    sendSupervisorNotification,
    sendEmployeeNotification,
    sendToRole,
    sendToUser,
    sendSystemNotification
  } = useNotifications();
  
  const { user } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);

  const addResult = (test: string, status: 'success' | 'error', message: string) => {
    setResults(prev => [...prev, {
      test,
      status,
      message,
      timestamp: new Date()
    }]);
  };

  const runTest = async (testName: string, testFn: () => Promise<void>) => {
    try {
      await testFn();
      addResult(testName, 'success', 'Test passed successfully');
    } catch (error) {
      addResult(testName, 'error', `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setResults([]);

    // Test 1: Check browser support
    await runTest('Browser Support Check', async () => {
      if (!isPushSupported) {
        throw new Error('Push notifications not supported in this browser');
      }
    });

    // Test 2: Request permission
    await runTest('Permission Request', async () => {
      const permission = await requestNotificationPermission();
      if (permission !== 'granted') {
        throw new Error(`Permission denied: ${permission}`);
      }
    });

    // Test 3: Subscribe to push
    await runTest('Push Subscription', async () => {
      const success = await subscribeToPush();
      if (!success) {
        throw new Error('Failed to subscribe to push notifications');
      }
    });

    // Test 4: Send admin notification
    await runTest('Admin Notification', async () => {
      await sendAdminNotification({
        title: 'Test Admin Notification',
        body: 'This is a test notification for admin role',
        data: {
          notificationId: `test-admin-${Date.now()}`,
          url: '/dashboard',
          type: 'info',
          test: true
        }
      });
    });

    // Test 5: Send manager notification
    await runTest('Manager Notification', async () => {
      await sendManagerNotification({
        title: 'Test Manager Notification',
        body: 'This is a test notification for manager role',
        data: {
          notificationId: `test-manager-${Date.now()}`,
          url: '/dashboard',
          type: 'success',
          test: true
        }
      });
    });

    // Test 6: Send supervisor notification
    await runTest('Supervisor Notification', async () => {
      await sendSupervisorNotification({
        title: 'Test Supervisor Notification',
        body: 'This is a test notification for supervisor role',
        data: {
          notificationId: `test-supervisor-${Date.now()}`,
          url: '/dashboard',
          type: 'warning',
          test: true
        }
      });
    });

    // Test 7: Send employee notification
    await runTest('Employee Notification', async () => {
      await sendEmployeeNotification({
        title: 'Test Employee Notification',
        body: 'This is a test notification for employee role',
        data: {
          notificationId: `test-employee-${Date.now()}`,
          url: '/dashboard',
          type: 'info',
          test: true
        }
      });
    });

    // Test 8: Send role-based notification
    await runTest('Role-based Notification', async () => {
      await sendToRole('employee', {
        title: 'Test Role-based Notification',
        body: 'This is a test notification sent to all employees',
        data: {
          notificationId: `test-role-${Date.now()}`,
          url: '/dashboard',
          type: 'info',
          test: true
        }
      });
    });

    // Test 9: Send system notification
    await runTest('System Notification', async () => {
      await sendSystemNotification({
        title: 'Test System Notification',
        body: 'This is a test system-wide notification',
        data: {
          notificationId: `test-system-${Date.now()}`,
          url: '/dashboard',
          type: 'info',
          test: true
        }
      });
    });

    // Test 10: Send user-specific notification
    await runTest('User-specific Notification', async () => {
      if (user?.id) {
        await sendToUser(user.id, {
          title: 'Test User-specific Notification',
          body: 'This is a test notification sent to you specifically',
          data: {
            notificationId: `test-user-${Date.now()}`,
            url: '/dashboard',
            type: 'info',
            test: true
          }
        });
      } else {
        throw new Error('No user ID available');
      }
    });

    setIsRunning(false);
    toast({
      title: "Tests Completed",
      description: `Ran ${results.length + 10} tests. Check results below.`,
    });
  };

  const clearResults = () => {
    setResults([]);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const totalTests = results.length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Notification System Tester
          </CardTitle>
          <CardDescription>
            Comprehensive testing tool for the push notification system across all user roles.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* System Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2 p-3 rounded-lg border">
              <Bell className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Browser Support</p>
                <Badge className={isPushSupported ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                  {isPushSupported ? 'Supported' : 'Not Supported'}
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-2 p-3 rounded-lg border">
              <Shield className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm font-medium">Push Subscription</p>
                <Badge className={isPushSubscribed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                  {isPushSubscribed ? 'Subscribed' : 'Not Subscribed'}
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-2 p-3 rounded-lg border">
              <User className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm font-medium">Current User</p>
                <Badge variant="outline">
                  {user?.user_metadata?.role || 'employee'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Test Controls */}
          <div className="flex gap-4">
            <Button 
              onClick={runAllTests} 
              disabled={isRunning || !isPushSupported}
              className="flex items-center gap-2"
            >
              {isRunning ? (
                <>
                  <Clock className="h-4 w-4 animate-spin" />
                  Running Tests...
                </>
              ) : (
                <>
                  <TestTube className="h-4 w-4" />
                  Run All Tests
                </>
              )}
            </Button>
            
            <Button 
              onClick={clearResults} 
              variant="outline"
              disabled={results.length === 0}
            >
              Clear Results
            </Button>
          </div>

          {/* Test Results Summary */}
          {totalTests > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center gap-4">
                  <span>Tests completed: {totalTests}</span>
                  <span className="text-green-600">✓ {successCount} passed</span>
                  <span className="text-red-600">✗ {errorCount} failed</span>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Test Results */}
          {results.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium">Test Results</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {results.map((result, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 rounded-lg border">
                    {getStatusIcon(result.status)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{result.test}</span>
                        <Badge className={getStatusColor(result.status)}>
                          {result.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{result.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {result.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4">
              <h4 className="font-medium mb-2">Permission Management</h4>
              <div className="space-y-2">
                <Button 
                  onClick={() => requestNotificationPermission()} 
                  variant="outline" 
                  size="sm"
                  className="w-full"
                >
                  Request Permission
                </Button>
                <Button 
                  onClick={() => subscribeToPush()} 
                  variant="outline" 
                  size="sm"
                  className="w-full"
                  disabled={isPushSubscribed}
                >
                  Subscribe to Push
                </Button>
                <Button 
                  onClick={() => unsubscribeFromPush()} 
                  variant="outline" 
                  size="sm"
                  className="w-full"
                  disabled={!isPushSubscribed}
                >
                  Unsubscribe
                </Button>
              </div>
            </Card>

            <Card className="p-4">
              <h4 className="font-medium mb-2">Role Tests</h4>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button 
                    onClick={() => sendAdminNotification({
                      title: 'Quick Admin Test',
                      body: 'Admin notification test',
                      data: { test: true }
                    })} 
                    size="sm"
                    className="flex-1"
                  >
                    Admin
                  </Button>
                  <Button 
                    onClick={() => sendManagerNotification({
                      title: 'Quick Manager Test',
                      body: 'Manager notification test',
                      data: { test: true }
                    })} 
                    size="sm"
                    className="flex-1"
                  >
                    Manager
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => sendSupervisorNotification({
                      title: 'Quick Supervisor Test',
                      body: 'Supervisor notification test',
                      data: { test: true }
                    })} 
                    size="sm"
                    className="flex-1"
                  >
                    Supervisor
                  </Button>
                  <Button 
                    onClick={() => sendEmployeeNotification({
                      title: 'Quick Employee Test',
                      body: 'Employee notification test',
                      data: { test: true }
                    })} 
                    size="sm"
                    className="flex-1"
                  >
                    Employee
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
