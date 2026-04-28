self.addEventListener('install', (event) => {
  console.log('Service Worker Installed');
});

self.addEventListener('fetch', (event) => {
  // basic caching (can improve later)
});