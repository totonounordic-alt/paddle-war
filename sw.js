const C='keen-v1',A=['/','/index.html','/manifest.webmanifest','/icon-192.png','/icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(A)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n!==C).map(n=>caches.delete(n)))).then(()=>clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api/'))return;
e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(C).then(ch=>ch.put(e.request,c));return r}).catch(()=>caches.match(e.request)))});
