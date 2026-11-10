// =====================================================================
// HORS RÉSEAU (téléphone seulement : enregistré par js/telephone.js, jamais par le .exe).
// L'appli s'ouvre même sans Internet (sur un tournage, au sous-sol…).
// On essaie TOUJOURS le réseau d'abord (donc les mises à jour arrivent tout de suite) ; chaque fichier de l'appli
// reçu est gardé sur le téléphone, et sert seulement si le réseau ne répond pas.
// Les données (Drive, Google) ne passent jamais par ici : elles ont leur propre copie (voir js/drive.js).
// =====================================================================
const CACHE = 'beeskot-studio-v1';
self.addEventListener('install', e => { e.waitUntil(self.skipWaiting()); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(l => Promise.all(l.filter(k => k.startsWith('beeskot-studio-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== self.location.origin || r.headers.has('range')) return;     // le Drive, Google, les sons : pas ici
  e.respondWith((async () => {
    try {
      const rep = await fetch(r);
      if (rep.ok && rep.type === 'basic') { const c = await caches.open(CACHE); c.put(r, rep.clone()); }
      return rep;
    } catch (err) {
      const m = await caches.match(r, { ignoreSearch: true }) || (r.mode === 'navigate' ? await caches.match('index.html', { ignoreSearch: true }) : null);
      if (m) return m; throw err;
    }
  })());
});
