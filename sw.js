/**
 * BD Bank Routing Finder & Details Parser - Service Worker
 * 100% Offline Cache & Offline PWA System
 */

const CACHE_NAME = 'bd-routing-v8';

const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './banks-data.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon.svg'
];

// Install: Cache all static assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching all static assets for 100% offline use');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Activate: Clean up old caches & claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Cache First strategy with network fallback
self.addEventListener('fetch', (event) => {
  // Only handle GET requests and http/https schemes (ignore chrome-extension, etc.)
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  // For external Google Gemini API requests, don't use cache first (pass to network)
  if (url.hostname.includes('googleapis.com')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ error: { message: 'অফলাইন মোডে আছেন। সাধারণ পার্সার ব্যবহার করুন।' } }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Local assets: Cache First, fallback to Network
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to update cache (stale-while-revalidate)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {/* Offline, ignore */});
        return cachedResponse;
      }

      // If not in cache, fetch from network and cache
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        return networkResponse;
      }).catch(() => {
        // Fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
