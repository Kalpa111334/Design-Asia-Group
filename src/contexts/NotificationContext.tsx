import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { pushNotificationService, PushNotificationData } from '@/utils/pushNotifications';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  action_url?: string;
  action_label?: string;
  data?: any;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  addNotification: (notification: Omit<Notification, 'id' | 'created_at' | 'read'>) => void;
  clearNotification: (id: string) => void;
  clearAllNotifications: () => void;
  // Push notification methods
  requestNotificationPermission: () => Promise<NotificationPermission>;
  subscribeToPush: () => Promise<boolean>;
  unsubscribeFromPush: () => Promise<boolean>;
  isPushSupported: boolean;
  isPushSubscribed: boolean;
  // Role-based notification methods
  sendAdminNotification: (data: Omit<PushNotificationData, 'data'> & { data?: any }) => Promise<void>;
  sendManagerNotification: (data: Omit<PushNotificationData, 'data'> & { data?: any }) => Promise<void>;
  sendSupervisorNotification: (data: Omit<PushNotificationData, 'data'> & { data?: any }) => Promise<void>;
  sendEmployeeNotification: (data: Omit<PushNotificationData, 'data'> & { data?: any }) => Promise<void>;
  sendToRole: (role: 'admin' | 'manager' | 'supervisor' | 'employee', notification: PushNotificationData) => Promise<void>;
  sendToUser: (userId: string, notification: PushNotificationData) => Promise<void>;
  sendSystemNotification: (notification: PushNotificationData) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchNotifications();
      setupRealtimeSubscription();
      checkPushSubscription();
    }
  }, [user]);

  useEffect(() => {
    const count = notifications.filter(n => !n.read).length;
    setUnreadCount(count);
  }, [notifications]);

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!user) return;

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications(prev => [newNotification, ...prev]);
          
          // Show browser notification if permission granted
          if (Notification.permission === 'granted') {
            new Notification(newNotification.title, {
              body: newNotification.message,
              icon: '/favicon.ico',
              tag: newNotification.id,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const markAsRead = async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => ({ ...n, read: true }))
      );
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const addNotification = async (notification: Omit<Notification, 'id' | 'created_at' | 'read'>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert([
          {
            user_id: user.id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            action_url: notification.action_url,
            action_label: notification.action_label,
            data: notification.data,
            read: false,
          }
        ])
        .select()
        .single();

      if (error) throw error;

      setNotifications(prev => [data, ...prev]);
    } catch (error) {
      console.error('Error adding notification:', error);
    }
  };

  const clearNotification = async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Error clearing notification:', error);
    }
  };

  const clearAllNotifications = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      setNotifications([]);
    } catch (error) {
      console.error('Error clearing all notifications:', error);
    }
  };

  // Push notification methods
  const checkPushSubscription = async () => {
    const subscribed = await pushNotificationService.checkSubscription();
    setIsPushSubscribed(subscribed);
  };

  const requestNotificationPermission = async (): Promise<NotificationPermission> => {
    const permission = await pushNotificationService.requestPermission();
    if (permission === 'granted') {
      await checkPushSubscription();
    }
    return permission;
  };

  const subscribeToPush = async (): Promise<boolean> => {
    const subscription = await pushNotificationService.subscribeToPush();
    const success = subscription !== null;
    setIsPushSubscribed(success);
    return success;
  };

  const unsubscribeFromPush = async (): Promise<boolean> => {
    const success = await pushNotificationService.unsubscribeFromPush();
    setIsPushSubscribed(!success);
    return success;
  };

  // Role-based notification methods
  const sendAdminNotification = async (data: Omit<PushNotificationData, 'data'> & { data?: any }) => {
    await pushNotificationService.sendAdminNotification(data);
  };

  const sendManagerNotification = async (data: Omit<PushNotificationData, 'data'> & { data?: any }) => {
    await pushNotificationService.sendManagerNotification(data);
  };

  const sendSupervisorNotification = async (data: Omit<PushNotificationData, 'data'> & { data?: any }) => {
    await pushNotificationService.sendSupervisorNotification(data);
  };

  const sendEmployeeNotification = async (data: Omit<PushNotificationData, 'data'> & { data?: any }) => {
    await pushNotificationService.sendEmployeeNotification(data);
  };

  const sendToRole = async (role: 'admin' | 'manager' | 'supervisor' | 'employee', notification: PushNotificationData) => {
    await pushNotificationService.sendToRole(role, notification);
  };

  const sendToUser = async (userId: string, notification: PushNotificationData) => {
    await pushNotificationService.sendToUser(userId, notification);
  };

  const sendSystemNotification = async (notification: PushNotificationData) => {
    await pushNotificationService.sendSystemNotification(notification);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        addNotification,
        clearNotification,
        clearAllNotifications,
        // Push notification methods
        requestNotificationPermission,
        subscribeToPush,
        unsubscribeFromPush,
        isPushSupported: pushNotificationService.isSupported,
        isPushSubscribed,
        // Role-based notification methods
        sendAdminNotification,
        sendManagerNotification,
        sendSupervisorNotification,
        sendEmployeeNotification,
        sendToRole,
        sendToUser,
        sendSystemNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
