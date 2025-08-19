// This is a placeholder service worker file.
// You can add your own service worker logic here.

self.addEventListener('install', (event) => {
  console.log('Service worker installed');
});

self.addEventListener('fetch', (event) => {
  // This is a basic pass-through service worker.
  // You can add caching strategies here.
  event.respondWith(fetch(event.request));
});
