// MBE PIG POINTS - Service Worker
// Handles offline support, caching, and push notifications

const CACHE_NAME = 'mbe-pig-points-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/activity.html',
  '/history.html',
  '/golf.html',
  '/script.js',
  '/consolidated-styles.css',
  '/firebase-config.js',
  '/danger-zone.mp3',
  '/manifest.json'
];

// Install event - cache resources
self.addEventListener('install', event => {
  console.log('🔧 Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Service Worker: Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ Service Worker: Installation complete');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Service Worker: Installation failed', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker: Activation complete');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }
        
        // Clone the request because it's a stream
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then(response => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Clone the response because it's a stream
          const responseToCache = response.clone();
          
          // Add to cache for future use
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          
          return response;
        }).catch(() => {
          // Network failed, try to serve offline page
          if (event.request.destination === 'document') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// Push notification event
self.addEventListener('push', event => {
  console.log('📱 Service Worker: Push notification received');
  
  let notificationData = {
    title: 'MBE PIG POINTS',
    body: 'New activity in the app!',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    tag: 'mbe-notification',
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: 'Open App',
        icon: '/icon-72x72.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icon-72x72.png'
      }
    ]
  };
  
  // Parse push data if available
  if (event.data) {
    try {
      const pushData = event.data.json();
      notificationData = {
        ...notificationData,
        ...pushData
      };
    } catch (e) {
      console.log('📱 Service Worker: Push data not JSON, using text');
      notificationData.body = event.data.text();
    }
  }
  
  // Special handling for different notification types
  if (notificationData.type === 'danger_zone') {
    notificationData.title = '💀 DANGER ZONE 💀';
    notificationData.body = `${notificationData.playerName || 'Someone'} triggered DANGER ZONE!`;
    notificationData.icon = '/icon-192x192.png';
    notificationData.badge = '/icon-72x72.png';
    notificationData.tag = 'danger-zone';
    notificationData.requireInteraction = true;
    notificationData.vibrate = [200, 100, 200, 100, 200];
    notificationData.data = { type: 'danger_zone', url: '/' };
  } else if (notificationData.type === 'drink_assignment') {
    notificationData.title = '🍺 DRINK ASSIGNMENT';
    notificationData.body = `Alex assigned drinks! Check the app.`;
    notificationData.icon = '/icon-192x192.png';
    notificationData.badge = '/icon-72x72.png';
    notificationData.tag = 'drink-assignment';
    notificationData.vibrate = [100, 50, 100];
    notificationData.data = { type: 'drink_assignment', url: '/' };
  } else if (notificationData.type === 'hogwash') {
    notificationData.title = '🐷 HOGWASH RESULT';
    notificationData.body = `${notificationData.playerName || 'Someone'} just gambled! Check the results.`;
    notificationData.icon = '/icon-192x192.png';
    notificationData.badge = '/icon-72x72.png';
    notificationData.tag = 'hogwash';
    notificationData.vibrate = [150];
    notificationData.data = { type: 'hogwash', url: '/' };
  } else if (notificationData.type === 'drink_proof') {
    notificationData.title = '📸 DRINK PROOF UPLOADED';
    notificationData.body = `${notificationData.playerName || 'Someone'} uploaded drink proof! Check it out.`;
    notificationData.icon = '/icon-192x192.png';
    notificationData.badge = '/icon-72x72.png';
    notificationData.tag = 'drink-proof';
    notificationData.vibrate = [100, 50, 100, 50, 100];
    notificationData.data = { type: 'drink_proof', url: '/activity.html' };
  } else if (notificationData.type === 'proof_request') {
    notificationData.title = '📢 PROOF REQUESTED';
    notificationData.body = `Alex is requesting additional proof for your drinks!`;
    notificationData.icon = '/icon-192x192.png';
    notificationData.badge = '/icon-72x72.png';
    notificationData.tag = 'proof-request';
    notificationData.requireInteraction = true;
    notificationData.vibrate = [200, 100, 200, 100, 200, 100, 200];
    notificationData.data = { type: 'proof_request', url: '/' };
  }
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Notification click event
self.addEventListener('notificationclick', event => {
  console.log('📱 Service Worker: Notification clicked');
  
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  // Determine URL to open
  let urlToOpen = '/';
  if (event.notification.data && event.notification.data.url) {
    urlToOpen = event.notification.data.url;
  }
  
  // Open the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin)) {
            client.focus();
            if (urlToOpen !== '/') {
              client.navigate(urlToOpen);
            }
            return;
          }
        }
        
        // Open new window if app not already open
        return clients.openWindow(urlToOpen);
      })
  );
});

// Background sync event (for offline actions)
self.addEventListener('sync', event => {
  console.log('🔄 Service Worker: Background sync triggered');
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Handle any queued actions when back online
      handleBackgroundSync()
    );
  }
});

async function handleBackgroundSync() {
  // This would handle any actions that were queued while offline
  // For now, just log that we're back online
  console.log('🌐 Service Worker: Back online, processing queued actions');
}

// Message event - communicate with main app
self.addEventListener('message', event => {
  console.log('💬 Service Worker: Message received', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const notificationData = event.data.data;
    
    // Process notification data
    let title = notificationData.title || 'MBE PIG POINTS';
    let options = {
      body: notificationData.body || 'New activity in the app!',
      icon: '/icon-192x192.png',
      badge: '/icon-72x72.png',
      tag: notificationData.type || 'mbe-notification',
      requireInteraction: true,
      data: notificationData
    };
    
    // Add vibration and customize based on type
    if (notificationData.type === 'danger_zone') {
      options.vibrate = [200, 100, 200, 100, 200];
      options.actions = [
        { action: 'open', title: 'Open App', icon: '/icon-72x72.png' },
        { action: 'dismiss', title: 'Dismiss', icon: '/icon-72x72.png' }
      ];
    } else if (notificationData.type === 'drink_assignment') {
      options.vibrate = [100, 50, 100];
      options.actions = [
        { action: 'open', title: 'Check Assignment', icon: '/icon-72x72.png' },
        { action: 'dismiss', title: 'Later', icon: '/icon-72x72.png' }
      ];
    } else {
      options.vibrate = [150];
    }
    
    // Show the notification
    self.registration.showNotification(title, options);
  }
  
  // Send response back to main app if port is available
  if (event.ports && event.ports[0]) {
    event.ports[0].postMessage({
      type: 'SW_RESPONSE',
      message: 'Service Worker is active'
    });
  }
});
