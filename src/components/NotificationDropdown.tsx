import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useNotifications, Notification } from '@/contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  CheckCircle, 
  AlertCircle, 
  Info, 
  XCircle, 
  CheckCheck,
  Trash2,
  ExternalLink
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

const NotificationDropdown = () => {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    clearNotification,
    clearAllNotifications 
  } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-4 h-4 text-success" />;
      case 'error': return <XCircle className="w-4 h-4 text-destructive" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-warning" />;
      default: return <Info className="w-4 h-4 text-primary" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'success': return 'border-success/20 bg-success/5';
      case 'error': return 'border-destructive/20 bg-destructive/5';
      case 'warning': return 'border-warning/20 bg-warning/5';
      default: return 'border-primary/20 bg-primary/5';
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }

    if (notification.action_url) {
      navigate(notification.action_url);
    }

    setOpen(false);
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
  };

  const recentNotifications = notifications.slice(0, 10);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent className="w-80 p-0" align="end">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Notifications</CardTitle>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllAsRead}
                    className="text-xs"
                  >
                    <CheckCheck className="w-3 h-3 mr-1" />
                    Mark all read
                  </Button>
                )}
                {notifications.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllNotifications}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
            {unreadCount > 0 && (
              <CardDescription>
                {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
              </CardDescription>
            )}
          </CardHeader>

          <Separator />

          <ScrollArea className="h-96">
            <CardContent className="p-0">
              {notifications.length === 0 ? (
                <div className="p-6 text-center">
                  <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No notifications yet</p>
                  <p className="text-sm text-muted-foreground">
                    You'll see updates and alerts here
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {recentNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 border-l-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                        getNotificationColor(notification.type)
                      } ${!notification.read ? 'bg-muted/20' : ''}`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className={`text-sm font-medium ${!notification.read ? 'font-semibold' : ''}`}>
                              {notification.title}
                            </h4>
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {formatTimeAgo(notification.created_at)}
                            </span>
                          </div>
                          
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          
                          {notification.action_label && (
                            <div className="flex items-center gap-1 mt-2">
                              <ExternalLink className="w-3 h-3 text-primary" />
                              <span className="text-xs text-primary">
                                {notification.action_label}
                              </span>
                            </div>
                          )}
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            clearNotification(notification.id);
                          }}
                          className="flex-shrink-0 h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </ScrollArea>

          {notifications.length > 10 && (
            <>
              <Separator />
              <div className="p-3 text-center">
                <Button variant="ghost" size="sm" onClick={() => navigate('/notifications')}>
                  View all notifications
                </Button>
              </div>
            </>
          )}
        </Card>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationDropdown;
