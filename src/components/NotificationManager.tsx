import React, { useState } from 'react';
import { useNotifications } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Send, Users, User, AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface NotificationFormData {
  title: string;
  body: string;
  type: 'info' | 'success' | 'warning' | 'error';
  targetType: 'all' | 'role' | 'user';
  targetRole?: 'admin' | 'manager' | 'supervisor' | 'employee';
  targetUser?: string;
  requireInteraction: boolean;
  silent: boolean;
}

export const NotificationManager: React.FC = () => {
  const {
    sendToRole,
    sendToUser,
    sendSystemNotification,
    sendAdminNotification,
    sendManagerNotification,
    sendSupervisorNotification,
    sendEmployeeNotification
  } = useNotifications();
  
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<NotificationFormData>({
    title: '',
    body: '',
    type: 'info',
    targetType: 'all',
    requireInteraction: false,
    silent: false
  });

  const userRole = user?.user_metadata?.role || 'employee';
  const canSendNotifications = ['admin', 'manager'].includes(userRole);

  if (!canSendNotifications) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            Access Denied
          </CardTitle>
          <CardDescription>
            You don't have permission to send notifications. Only admins and managers can use this feature.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleInputChange = (field: keyof NotificationFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.body.trim()) {
      toast({
        title: "Error",
        description: "Please fill in both title and body fields.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const notificationData = {
        title: formData.title,
        body: formData.body,
        data: {
          notificationId: `custom-${Date.now()}`,
          url: '/dashboard',
          type: formData.type,
          requireInteraction: formData.requireInteraction,
          silent: formData.silent,
          sentBy: user?.email,
          sentAt: new Date().toISOString()
        }
      };

      switch (formData.targetType) {
        case 'all':
          await sendSystemNotification(notificationData);
          toast({
            title: "Success",
            description: "System notification sent to all users.",
          });
          break;
        case 'role':
          if (formData.targetRole) {
            await sendToRole(formData.targetRole, notificationData);
            toast({
              title: "Success",
              description: `Notification sent to all ${formData.targetRole}s.`,
            });
          }
          break;
        case 'user':
          if (formData.targetUser) {
            await sendToUser(formData.targetUser, notificationData);
            toast({
              title: "Success",
              description: `Notification sent to user ${formData.targetUser}.`,
            });
          }
          break;
      }

      // Reset form
      setFormData({
        title: '',
        body: '',
        type: 'info',
        targetType: 'all',
        requireInteraction: false,
        silent: false
      });
    } catch (error) {
      console.error('Failed to send notification:', error);
      toast({
        title: "Error",
        description: "Failed to send notification. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Notification
          </CardTitle>
          <CardDescription>
            Send push notifications to users based on their role or specific users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Target Selection */}
            <div className="space-y-2">
              <Label htmlFor="targetType">Target Audience</Label>
              <Select
                value={formData.targetType}
                onValueChange={(value) => handleInputChange('targetType', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select target audience" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      All Users
                    </div>
                  </SelectItem>
                  <SelectItem value="role">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      By Role
                    </div>
                  </SelectItem>
                  <SelectItem value="user">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Specific User
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Role Selection */}
            {formData.targetType === 'role' && (
              <div className="space-y-2">
                <Label htmlFor="targetRole">Select Role</Label>
                <Select
                  value={formData.targetRole || ''}
                  onValueChange={(value) => handleInputChange('targetRole', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* User ID Input */}
            {formData.targetType === 'user' && (
              <div className="space-y-2">
                <Label htmlFor="targetUser">User ID</Label>
                <Input
                  id="targetUser"
                  placeholder="Enter user ID"
                  value={formData.targetUser || ''}
                  onChange={(e) => handleInputChange('targetUser', e.target.value)}
                />
              </div>
            )}

            {/* Notification Type */}
            <div className="space-y-2">
              <Label htmlFor="type">Notification Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => handleInputChange('type', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select notification type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">
                    <div className="flex items-center gap-2">
                      {getTypeIcon('info')}
                      Information
                    </div>
                  </SelectItem>
                  <SelectItem value="success">
                    <div className="flex items-center gap-2">
                      {getTypeIcon('success')}
                      Success
                    </div>
                  </SelectItem>
                  <SelectItem value="warning">
                    <div className="flex items-center gap-2">
                      {getTypeIcon('warning')}
                      Warning
                    </div>
                  </SelectItem>
                  <SelectItem value="error">
                    <div className="flex items-center gap-2">
                      {getTypeIcon('error')}
                      Error
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Enter notification title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                required
              />
            </div>

            {/* Body */}
            <div className="space-y-2">
              <Label htmlFor="body">Message</Label>
              <Textarea
                id="body"
                placeholder="Enter notification message"
                value={formData.body}
                onChange={(e) => handleInputChange('body', e.target.value)}
                rows={4}
                required
              />
            </div>

            {/* Options */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="requireInteraction"
                  checked={formData.requireInteraction}
                  onChange={(e) => handleInputChange('requireInteraction', e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="requireInteraction" className="text-sm">
                  Require user interaction (notification won't auto-dismiss)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="silent"
                  checked={formData.silent}
                  onChange={(e) => handleInputChange('silent', e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="silent" className="text-sm">
                  Silent notification (no sound or vibration)
                </Label>
              </div>
            </div>

            {/* Preview */}
            {formData.title && formData.body && (
              <div className="space-y-2">
                <Label>Preview</Label>
                <div className="p-4 border rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    {getTypeIcon(formData.type)}
                    <span className="font-medium">{formData.title}</span>
                    <Badge className={getTypeColor(formData.type)}>
                      {formData.type}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">{formData.body}</p>
                  <div className="mt-2 text-xs text-gray-500">
                    Target: {formData.targetType === 'all' ? 'All Users' : 
                             formData.targetType === 'role' ? `${formData.targetRole}s` : 
                             `User ${formData.targetUser}`}
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? 'Sending...' : 'Send Notification'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
