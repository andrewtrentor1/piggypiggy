// MBE PIG POINTS - Service Worker
// Handles offline support, caching, and push notifications

const CACHE_NAME = 'mbe-pig-points-v15-oath';
const urlsToCache = [
  '/',
  '/index.html',
  '/icon-192x192.png',
  '/icon-180.png',
  '/activity.html',
  '/history.html',
  '/golf.html',
  '/games.html',
  '/script.js',
  '/js/features/season.js',
  '/js/features/push.js',
  '/consolidated-styles.css',
  '/mbe-theme.css',
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

// Fetch event
// - Page navigations + core CSS/JS: NETWORK FIRST (so pushes appear on next
//   open), falling back to cache when offline
// - Everything else (audio, icons, fonts): cache first
self.addEventListener('fetch', event => {
  const isNavigation = event.request.mode === 'navigate' || event.request.destination === 'document';
  const url = new URL(event.request.url);
  const isCoreAsset = url.origin === self.location.origin &&
    (url.pathname.endsWith('.css') || url.pathname.endsWith('.js') || url.pathname.endsWith('.json'));

  if (isNavigation || isCoreAsset) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then(r => r || (isNavigation ? caches.match('/index.html') : undefined)))
    );
    return;
  }

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

// Push notification event — bare push wakes us; we fetch the event
// details from the piggy-push worker (see push-worker/index.js)
const PUSH_WORKER = 'https://piggy-push.andrew-247.workers.dev';
const PUSH_URLS = {
  danger_zone: '/', season: '/', drinks: '/games.html', supervisor: '/games.html',
  tribunal: '/games.html', oracle: '/games.html', organ: '/games.html', general: '/'
};

self.addEventListener('push', event => {
  console.log('📱 Service Worker: Push received, fetching latest event...');
  event.waitUntil(
    fetch(PUSH_WORKER + '/latest')
      .then(r => r.json())
      .then(e => self.registration.showNotification(e.title || '🐷 THE ROYAL ORDER', {
        body: e.body || '',
        icon: '/icon-192x192.png',
        badge: '/icon-72x72.png',
        tag: 'mbe-' + (e.type || 'general'),
        requireInteraction: e.type === 'danger_zone' || e.type === 'tribunal',
        vibrate: e.type === 'danger_zone' ? [200, 100, 200, 100, 200] : [150, 75, 150],
        data: { type: e.type, url: PUSH_URLS[e.type] || '/' }
      }))
      .catch(() => self.registration.showNotification('🐷 THE ROYAL ORDER', {
        body: 'Something happened at the club. Investigate.',
        icon: '/icon-192x192.png',
        badge: '/icon-72x72.png',
        tag: 'mbe-general',
        data: { url: '/' }
      }))
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
