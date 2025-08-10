const CACHE = '1836-alpha-v2';
const ASSETS = [
  './','./index.html','./styles.css','./manifest.webmanifest',
  './js/ui.js','./js/db.js','./js/logic.js','./js/seed.js',
  './assets/icons/icon-192.png','./assets/icons/icon-512.png'
];
self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
});
self.addEventListener('fetch', e=>{
  e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request)));
});
