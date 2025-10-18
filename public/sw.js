// Service Worker for TaskVision PWA
const CACHE_NAME = 'taskvision-v1.0.0';
const STATIC_CACHE = 'taskvision-static-v1.0.0';
const DYNAMIC_CACHE = 'taskvision-dynamic-v1.0.0';

// Files to cache for offline functionality
const STATIC_FILES = [
  '/',
  '/dashboard',
  '/tasks',
  '/jobs',
  '/chat',
  '/petty-cash',
  '/locations',
  '/inventory',
  '/geofences',
  '/users',
  '/reports',
  '/permissions',
  '/auth',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Service Worker: Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('Service Worker: Static files cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Failed to cache static files', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated successfully');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip external requests
  if (url.origin !== location.origin) {
    return;
  }

  // Skip API calls to Supabase (let them fail gracefully)
  if (url.pathname.startsWith('/rest/v1/') || url.pathname.startsWith('/auth/v1/')) {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        // Return cached version if available
        if (cachedResponse) {
          console.log('Service Worker: Serving from cache:', request.url);
          return cachedResponse;
        }

        // Otherwise, fetch from network
        return fetch(request)
          .then((response) => {
            // Don't cache if not a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Cache the response for future use
            caches.open(DYNAMIC_CACHE)
              .then((cache) => {
                cache.put(request, responseToCache);
              });

            return response;
          })
          .catch((error) => {
            console.log('Service Worker: Network request failed:', error);
            
            // Return offline page for navigation requests
            if (request.destination === 'document') {
              return caches.match('/offline.html');
            }
            
            // Return a generic offline response for other requests
            return new Response(
              JSON.stringify({
                error: 'Offline',
                message: 'You are currently offline. Please check your connection and try again.'
              }),
              {
                status: 503,
                statusText: 'Service Unavailable',
                headers: {
                  'Content-Type': 'application/json'
                }
              }
            );
          });
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered');
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Handle any pending offline actions here
      handleBackgroundSync()
    );
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received');
  
  let notificationData = {
    title: 'TaskVision',
    body: 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
      url: '/dashboard'
    }
  };

  // Parse push data if available
  if (event.data) {
    try {
      const pushData = event.data.json();
      notificationData = {
        ...notificationData,
        ...pushData,
        data: {
          ...notificationData.data,
          ...pushData.data
        }
      };
    } catch (e) {
      // Fallback to text if JSON parsing fails
      notificationData.body = event.data.text();
    }
  }

  // Role-based notification styling
  const roleColors = {
    admin: '#dc2626',      // red
    manager: '#ea580c',    // orange
    supervisor: '#d97706', // amber
    employee: '#16a34a'    // green
  };

  const role = notificationData.data?.role || 'employee';
  const themeColor = roleColors[role] || roleColors.employee;

  const options = {
    body: notificationData.body,
    icon: notificationData.icon || '/icons/icon-192x192.png',
    badge: notificationData.badge || '/icons/icon-72x72.png',
    image: notificationData.image,
    vibrate: [100, 50, 100],
    data: notificationData.data,
    tag: notificationData.data?.notificationId || 'default',
    renotify: true,
    requireInteraction: notificationData.data?.requireInteraction || false,
    silent: notificationData.data?.silent || false,
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
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked');
  
  event.notification.close();

  const notificationData = event.notification.data;
  const targetUrl = notificationData?.url || '/dashboard';

  if (event.action === 'view') {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            client.navigate(targetUrl);
            return;
          }
        }
        // Open new window if app is not open
        return clients.openWindow(targetUrl);
      })
    );
  } else if (event.action === 'dismiss') {
    // Just close the notification
    return;
  } else {
    // Default action - open the app
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            return;
          }
        }
        // Open new window if app is not open
        return clients.openWindow(targetUrl);
      })
    );
  }
});

// Handle background sync
async function handleBackgroundSync() {
  try {
    // Get pending offline actions from IndexedDB
    const pendingActions = await getPendingActions();
    
    for (const action of pendingActions) {
      try {
        await syncAction(action);
        await removePendingAction(action.id);
      } catch (error) {
        console.error('Service Worker: Failed to sync action:', error);
      }
    }
  } catch (error) {
    console.error('Service Worker: Background sync failed:', error);
  }
}

// Helper functions for offline data management
async function getPendingActions() {
  // This would typically interact with IndexedDB
  // For now, return empty array
  return [];
}

async function syncAction(action) {
  // This would sync the action with the server
  // Implementation depends on your specific needs
  console.log('Service Worker: Syncing action:', action);
}

async function removePendingAction(actionId) {
  // This would remove the action from IndexedDB
  console.log('Service Worker: Removing pending action:', actionId);
}

// Message handler for communication with the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});
