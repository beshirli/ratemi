// Çevrimdışı çalışma: uygulama dosyaları önbellekte; yeni sürüm yayınlanınca VERSION artırılır.
const VERSION = 'ratemi-v23';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css', 'css/print.css',
  'js/main.js', 'js/ui.js', 'js/screens.js', 'js/builder.js', 'js/sheets.js', 'js/print.js', 'js/finance.js', 'js/format.js', 'js/store.js', 'js/account.js', 'js/cloud.js', 'js/tailor.js', 'js/tailorui.js',
  'vendor/preact-htm.js', 'img/logo.png', 'img/icon-192.png', 'img/icon-512.png', 'img/icon-32.png', 'img/icon-180.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Önce ağ (güncel sürüm), ağ yoksa önbellek.
self.addEventListener('fetch', (e) => {
  // Yalnız sitenin kendi dosyaları; Firebase istekleri doğrudan gider.
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    // no-cache: tarayıcının HTTP önbelleği yerine her seferinde sunucuya sorar (değişmediyse hızlı 304).
    fetch(e.request, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))),
  );
});
