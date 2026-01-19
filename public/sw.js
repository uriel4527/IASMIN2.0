const CACHE_NAME = 'chatapp-pwa-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/favicon-32x32.png',
  '/icons/apple-touch-icon.png'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache:', CACHE_NAME);
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('All resources cached successfully');
      })
      .catch((error) => {
        console.error('Cache install failed:', error);
      })
  );
  self.skipWaiting();
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle navigation/document requests: network-first, fallback to cached index
  if (request.destination === 'document') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/'))
    );
    return;
  }

  // Runtime cache for static assets (JS/CSS) to prevent white screens offline
  const isStaticAsset = (
    url.origin === self.location.origin && (
      url.pathname.startsWith('/assets/') ||
      request.destination === 'script' ||
      request.destination === 'style'
    )
  );

  if (isStaticAsset) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          return cached;
        }
        try {
          const response = await fetch(request);
          cache.put(request, response.clone());
          return response;
        } catch (error) {
          // If network fails and nothing cached, propagate error
          return cached || Promise.reject(error);
        }
      })
    );
    return;
  }

  // Default: try network, fall back to cache if available
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker activated successfully');
    })
  );
  self.clients.claim();
});

// Push notification event - Enhanced with payload support
self.addEventListener('push', (event) => {
  console.log('🔔 Push recebido:', event.data?.text());
  
  let notificationData = {
    title: 'ChatApp',
    body: 'Nova mensagem disponível!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/favicon-32x32.png',
    vibrate: [100, 50, 100],
    tag: 'message-' + Math.random().toString(36).slice(2),
    data: { url: '/chat' },
    requireInteraction: false,
    renotify: true,
    silent: false
  };
  
  // Parse custom payload if available
  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = {
        title: payload.title || notificationData.title,
        body: payload.body || notificationData.body,
        icon: payload.icon || notificationData.icon,
        badge: payload.badge || notificationData.badge,
        vibrate: payload.vibrate || notificationData.vibrate,
        tag: payload.tag || notificationData.tag,
        data: payload.data || notificationData.data,
        requireInteraction: payload.requireInteraction ?? false,
        renotify: payload.renotify ?? true,
        silent: payload.silent ?? false
      };
      console.log('✅ Payload parsed:', notificationData);
    } catch (e) {
      console.error('⚠️ Error parsing payload, using defaults:', e);
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Notification click event - Enhanced to focus existing chat window
self.addEventListener('notificationclick', (event) => {
  console.log('👆 Notificação clicada:', event.notification.tag);
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/chat';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Try to focus existing chat window
        for (const client of clientList) {
          if (client.url.includes('/chat') && 'focus' in client) {
            console.log('✅ Focusing existing chat window');
            return client.focus();
          }
        }
        // Otherwise, open new window
        if (clients.openWindow) {
          console.log('🆕 Opening new chat window');
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// IndexedDB helper for storing scheduled notifications
const DB_NAME = 'NotificationsDB';
const DB_VERSION = 1;
const STORE_NAME = 'scheduledNotifications';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

async function saveScheduledNotification(data) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.put(data);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function removeScheduledNotification(id) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllScheduledNotifications() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Handle messages from the app
self.addEventListener('message', async (event) => {
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { id, title, options, delay } = event.data;
    
    console.log(`Service Worker: Scheduling notification "${title}" for ${delay}ms`);
    
    // Save to IndexedDB for persistence
    await saveScheduledNotification({
      id,
      title,
      options,
      scheduledTime: Date.now() + delay
    });
    
    // Schedule the notification
    setTimeout(async () => {
      try {
        await self.registration.showNotification(title, options);
        await removeScheduledNotification(id);
        console.log(`Service Worker: Notification "${title}" displayed`);
      } catch (error) {
        console.error('Service Worker: Error showing notification:', error);
      }
    }, delay);
    
    // Send confirmation back to the app
    event.ports[0].postMessage({ success: true });
  }
});

// Check for pending notifications on activation
self.addEventListener('activate', async (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    (async () => {
      // Clean up old caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
      
      // Check for pending notifications
      try {
        const scheduled = await getAllScheduledNotifications();
        const now = Date.now();
        
        for (const notif of scheduled) {
          const timeRemaining = notif.scheduledTime - now;
          
          if (timeRemaining > 0) {
            // Reschedule notification
            console.log(`Service Worker: Rescheduling notification "${notif.title}"`);
            setTimeout(async () => {
              try {
                await self.registration.showNotification(notif.title, notif.options);
                await removeScheduledNotification(notif.id);
              } catch (error) {
                console.error('Error showing rescheduled notification:', error);
              }
            }, timeRemaining);
          } else {
            // Show immediately if time has passed
            console.log(`Service Worker: Showing overdue notification "${notif.title}"`);
            try {
              await self.registration.showNotification(notif.title, notif.options);
              await removeScheduledNotification(notif.id);
            } catch (error) {
              console.error('Error showing overdue notification:', error);
            }
          }
        }
      } catch (error) {
        console.error('Error checking pending notifications:', error);
      }
      
      console.log('Service Worker activated successfully');
    })()
  );
  self.clients.claim();
});
