/**
 * sw.js — Safe Static-Asset Service Worker for IRONCORE PWA (Day 27 Task 54)
 *
 * Security & caching contract:
 * 1. Caches static assets and `/offline.html` ONLY.
 * 2. NEVER caches API requests (`/api/*`), authenticated requests (`Authorization`),
 *    Firebase/Firestore endpoints, Razorpay endpoints, or non-GET requests.
 * 3. Navigation requests are network-first, serving `/offline.html` when offline.
 */

const CACHE_VERSION = 'ironcore-static-v1';
const OFFLINE_URL = '/offline.html';

const PRECACHE_URLS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

const SENSITIVE_PATH_PREFIXES = [
  '/api/',
  '/auth',
  '/payments',
  '/attendance',
  '/users',
  '/members',
  '/memberships',
  '/reports',
  '/reminders',
  '/whatsapp',
  '/qr',
  '/webhook',
];

const STATIC_EXTENSIONS = [
  '.js',
  '.mjs',
  '.css',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.woff',
  '.woff2',
  '.webmanifest',
];

const STATIC_DESTINATIONS = new Set(['script', 'style', 'image', 'font', 'manifest']);

function isSafeStaticRequest(request, scopeOrigin) {
  if (!request || request.method !== 'GET') return false;
  if (request.headers && request.headers.has('Authorization')) return false;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return false;
  }

  // Strictly same-origin static files only
  if (url.origin !== scopeOrigin) return false;

  const pathname = url.pathname.toLowerCase();

  // Never intercept or cache API or sensitive domain paths
  if (SENSITIVE_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return false;
  }

  if (pathname.startsWith('/assets/') || pathname.startsWith('/icons/')) {
    return true;
  }

  if (PRECACHE_URLS.includes(url.pathname)) {
    return true;
  }

  if (request.destination && STATIC_DESTINATIONS.has(request.destination)) {
    return true;
  }

  return STATIC_EXTENSIONS.some((ext) => pathname.endsWith(ext));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((staleKey) => caches.delete(staleKey))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!request || request.method !== 'GET') return;

  const scopeOrigin = self.location.origin;

  // Navigation requests: Network-first with offline.html fallback (never serve stale user data)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_VERSION);
        const offlinePage = await cache.match(OFFLINE_URL);
        return (
          offlinePage ||
          new Response('Offline — connection required.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        );
      })
    );
    return;
  }

  // Safe static assets only: Cache-first with background network validation
  if (!isSafeStaticRequest(request, scopeOrigin)) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) {
        return cached;
      }

      const networkResponse = await fetch(request);
      if (
        networkResponse &&
        networkResponse.status === 200 &&
        networkResponse.type === 'basic'
      ) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
  );
});
