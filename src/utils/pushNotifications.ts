// Push Notification Service for TrackFlow Vision
import { supabase } from '@/integrations/supabase/client';

export interface PushNotificationData {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: {
    notificationId?: string;
    url?: string;
    role?: 'admin' | 'manager' | 'supervisor' | 'employee';
    type?: 'info' | 'success' | 'warning' | 'error';
    requireInteraction?: boolean;
    silent?: boolean;
    [key: string]: any;
  };
}

export interface UserRole {
  id: string;
  role: 'admin' | 'manager' | 'supervisor' | 'employee';
  permissions: string[];
}

export class PushNotificationService {
  private static instance: PushNotificationService;
  private registration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;
  private vapidPublicKey: string | null = null;

  private constructor() {
    this.init();
  }

  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  private async init() {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        this.registration = await navigator.serviceWorker.ready;
        await this.loadVapidKey();
        await this.checkSubscription();
      } catch (error) {
        console.error('Push notification initialization failed:', error);
      }
    }
  }

  private async loadVapidKey() {
    try {
      // In production, this should come from your environment variables
      // For now, we'll use a placeholder - you'll need to generate your own VAPID keys
      this.vapidPublicKey = 'BEl62iUYgUivxIkv69yViEuiBIa40HI0F2HjQwYg9wgP7d9QvLyeFuQrKzsfunvjmQ4yuuP0gwlQ7fAcmSxDuPk';
    } catch (error) {
      console.error('Failed to load VAPID key:', error);
    }
  }

  public async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      throw new Error('This browser does not support notifications');
    }

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        await this.subscribeToPush();
      }
      return permission;
    }

    return Notification.permission;
  }

  public async subscribeToPush(): Promise<PushSubscription | null> {
    if (!this.registration || !this.vapidPublicKey) {
      throw new Error('Service worker not ready or VAPID key not available');
    }

    try {
      this.subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
      });

      // Save subscription to database
      await this.saveSubscriptionToDatabase(this.subscription);
      
      console.log('Push subscription successful:', this.subscription);
      return this.subscription;
    } catch (error) {
      console.error('Push subscription failed:', error);
      return null;
    }
  }

  public async unsubscribeFromPush(): Promise<boolean> {
    if (!this.subscription) return false;

    try {
      const result = await this.subscription.unsubscribe();
      if (result) {
        await this.removeSubscriptionFromDatabase();
        this.subscription = null;
      }
      return result;
    } catch (error) {
      console.error('Push unsubscription failed:', error);
      return false;
    }
  }

  public async checkSubscription(): Promise<boolean> {
    if (!this.registration) return false;

    try {
      this.subscription = await this.registration.pushManager.getSubscription();
      return this.subscription !== null;
    } catch (error) {
      console.error('Failed to check subscription:', error);
      return false;
    }
  }

  public async sendNotification(notification: PushNotificationData): Promise<void> {
    if (!this.registration) {
      throw new Error('Service worker not ready');
    }

    try {
      await this.registration.showNotification(notification.title, {
        body: notification.body,
        icon: notification.icon || '/icons/icon-192x192.png',
        badge: notification.badge || '/icons/icon-72x72.png',
        image: notification.image,
        data: notification.data,
        tag: notification.data?.notificationId || 'default',
        renotify: true,
        requireInteraction: notification.data?.requireInteraction || false,
        silent: notification.data?.silent || false,
        timestamp: Date.now(),
        actions: [
          {
            action: 'view',
            title: 'View Details',
            icon: '/icons/action-view.png'
          },
          {
            action: 'dismiss',
            title: 'Dismiss',
            icon: '/icons/action-close.png'
          }
        ]
      });
    } catch (error) {
      console.error('Failed to show notification:', error);
    }
  }

  // Role-based notification methods
  public async sendAdminNotification(data: Omit<PushNotificationData, 'data'> & { data?: any }) {
    return this.sendNotification({
      ...data,
      data: {
        ...data.data,
        role: 'admin',
        type: data.data?.type || 'info'
      }
    });
  }

  public async sendManagerNotification(data: Omit<PushNotificationData, 'data'> & { data?: any }) {
    return this.sendNotification({
      ...data,
      data: {
        ...data.data,
        role: 'manager',
        type: data.data?.type || 'info'
      }
    });
  }

  public async sendSupervisorNotification(data: Omit<PushNotificationData, 'data'> & { data?: any }) {
    return this.sendNotification({
      ...data,
      data: {
        ...data.data,
        role: 'supervisor',
        type: data.data?.type || 'info'
      }
    });
  }

  public async sendEmployeeNotification(data: Omit<PushNotificationData, 'data'> & { data?: any }) {
    return this.sendNotification({
      ...data,
      data: {
        ...data.data,
        role: 'employee',
        type: data.data?.type || 'info'
      }
    });
  }

  // Bulk notification methods
  public async sendToRole(role: 'admin' | 'manager' | 'supervisor' | 'employee', notification: PushNotificationData) {
    try {
      const { data: users, error } = await supabase
        .from('profiles')
        .select('id, push_subscription')
        .eq('role', role)
        .not('push_subscription', 'is', null);

      if (error) throw error;

      const promises = users?.map(user => 
        this.sendPushToUser(user.id, {
          ...notification,
          data: {
            ...notification.data,
            role,
            userId: user.id
          }
        })
      ) || [];

      await Promise.all(promises);
    } catch (error) {
      console.error(`Failed to send notification to ${role}s:`, error);
    }
  }

  public async sendToUser(userId: string, notification: PushNotificationData) {
    return this.sendPushToUser(userId, notification);
  }

  public async sendToMultipleUsers(userIds: string[], notification: PushNotificationData) {
    const promises = userIds.map(userId => this.sendPushToUser(userId, notification));
    await Promise.all(promises);
  }

  // System-wide notifications
  public async sendSystemNotification(notification: PushNotificationData) {
    try {
      const { data: users, error } = await supabase
        .from('profiles')
        .select('id, push_subscription')
        .not('push_subscription', 'is', null);

      if (error) throw error;

      const promises = users?.map(user => 
        this.sendPushToUser(user.id, {
          ...notification,
          data: {
            ...notification.data,
            userId: user.id,
            system: true
          }
        })
      ) || [];

      await Promise.all(promises);
    } catch (error) {
      console.error('Failed to send system notification:', error);
    }
  }

  // Task-related notifications
  public async notifyTaskAssigned(taskId: string, assigneeId: string, taskTitle: string) {
    await this.sendToUser(assigneeId, {
      title: 'New Task Assigned',
      body: `You have been assigned a new task: ${taskTitle}`,
      data: {
        notificationId: `task-assigned-${taskId}`,
        url: `/tasks/${taskId}`,
        type: 'info',
        taskId,
        action: 'task_assigned'
      }
    });
  }

  public async notifyTaskCompleted(taskId: string, assigneeId: string, taskTitle: string, completedBy: string) {
    await this.sendToUser(assigneeId, {
      title: 'Task Completed',
      body: `${completedBy} has completed the task: ${taskTitle}`,
      data: {
        notificationId: `task-completed-${taskId}`,
        url: `/tasks/${taskId}`,
        type: 'success',
        taskId,
        action: 'task_completed'
      }
    });
  }

  public async notifyTaskOverdue(taskId: string, assigneeId: string, taskTitle: string) {
    await this.sendToUser(assigneeId, {
      title: 'Task Overdue',
      body: `The task "${taskTitle}" is now overdue`,
      data: {
        notificationId: `task-overdue-${taskId}`,
        url: `/tasks/${taskId}`,
        type: 'warning',
        taskId,
        action: 'task_overdue',
        requireInteraction: true
      }
    });
  }

  // Job-related notifications
  public async notifyJobCreated(jobId: string, jobTitle: string, createdBy: string) {
    await this.sendToRole('manager', {
      title: 'New Job Created',
      body: `${createdBy} has created a new job: ${jobTitle}`,
      data: {
        notificationId: `job-created-${jobId}`,
        url: `/jobs/${jobId}`,
        type: 'info',
        jobId,
        action: 'job_created'
      }
    });
  }

  // Emergency notifications
  public async sendEmergencyNotification(message: string, affectedUsers?: string[]) {
    const notification: PushNotificationData = {
      title: '🚨 Emergency Alert',
      body: message,
      data: {
        notificationId: `emergency-${Date.now()}`,
        url: '/dashboard',
        type: 'error',
        action: 'emergency',
        requireInteraction: true,
        silent: false
      }
    };

    if (affectedUsers && affectedUsers.length > 0) {
      await this.sendToMultipleUsers(affectedUsers, notification);
    } else {
      await this.sendSystemNotification(notification);
    }
  }

  // Private helper methods
  private async sendPushToUser(userId: string, notification: PushNotificationData) {
    try {
      const { data: user, error } = await supabase
        .from('profiles')
        .select('push_subscription')
        .eq('id', userId)
        .single();

      if (error || !user?.push_subscription) return;

      // In a real implementation, you would send this to your push service
      // For now, we'll use the local notification API
      if (this.registration) {
        await this.registration.showNotification(notification.title, {
          body: notification.body,
          icon: notification.icon || '/icons/icon-192x192.png',
          badge: notification.badge || '/icons/icon-72x72.png',
          data: notification.data,
          tag: notification.data?.notificationId || 'default'
        });
      }
    } catch (error) {
      console.error(`Failed to send push to user ${userId}:`, error);
    }
  }

  private async saveSubscriptionToDatabase(subscription: PushSubscription) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({ push_subscription: subscription })
        .eq('id', user.id);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to save subscription to database:', error);
    }
  }

  private async removeSubscriptionFromDatabase() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({ push_subscription: null })
        .eq('id', user.id);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to remove subscription from database:', error);
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Getters
  public get isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window;
  }

  public get isSubscribed(): boolean {
    return this.subscription !== null;
  }

  public get currentSubscription(): PushSubscription | null {
    return this.subscription;
  }
}

// Export singleton instance
export const pushNotificationService = PushNotificationService.getInstance();
