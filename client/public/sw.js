// Chama360 service worker: network-first pass-through. No caching yet ?
// financial data must never be served stale. Exists so registration succeeds
// and offline/PWA caching can be added behind this boundary later.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  // Intentionally not intercepting: all requests go to the network as usual.
});
