const CACHE='forge-mobile-v1';
const CORE=[
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icon.svg',
  './payload-00.txt',
  './payload-01.txt',
  './payload-02.txt',
  './payload-03.txt',
  './payload-04.txt',
  './payload-05.txt'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  event.respondWith(
    caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
      if(response.ok&&new URL(event.request.url).origin===self.location.origin){
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy));
      }
      return response;
    }).catch(()=>event.request.mode==='navigate'?caches.match('./index.html'):undefined))
  );
});
