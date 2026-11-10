// =====================================================================
// HORS RÉSEAU — l'appli s'ouvre même sans Internet (sur un tournage, au sous-sol…).
// Chaque fichier de l'appli est gardé sur le téléphone. On essaie TOUJOURS le réseau d'abord
// (donc les mises à jour arrivent tout de suite) ; le téléphone sert sa copie seulement si le réseau ne répond pas.
// Les données (Drive, Google) ne passent jamais par ici : elles ont leur propre copie (voir js/drive.js).
// =====================================================================
const CACHE = 'beeskot-appli-v1';
const BASE = ['./', 'index.html', 'ancien.html', 'mobile.js', 'mobile.css', 'manifest.json', 'icone-192.png',
  'ecrans/accueil.js', 'ecrans/biblio.js', 'ecrans/agenda.js', 'ecrans/taches.js', 'ecrans/reels.js', 'ecrans/ecoute.js', 'ecrans/notesvid.js', 'ecrans/budget.js', 'ecrans/tournage.js', 'ecrans/reglages.js',
  '../js/coeur.js', '../js/pictos.js', '../js/donnees.js', '../js/drive.js', '../js/audio.js', '../js/inventaire.js', '../js/dossiers.js', '../js/images.js', '../js/itineraire.js', '../js/pdftournage.js',
  '../style/base.css', '../style/fonts.css', '../look/beeskot.png', '../look/logo-beeskot-studio.png', '../look/wood.jpg', '../look/bandeau-beeskot.jpg', '../textures/bois-menu.jpg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(BASE.map(u => c.add(u)))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(l => Promise.all(l.filter(k => k.startsWith('beeskot-appli-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== self.location.origin || r.headers.has('range')) return;     // le Drive, Google, les sons : pas ici
  e.respondWith((async () => {
    try {
      const rep = await fetch(r);
      if (rep.ok && rep.type === 'basic') { const c = await caches.open(CACHE); c.put(r, rep.clone()); }
      return rep;
    } catch (err) {
      const m = await caches.match(r, { ignoreSearch: true }) || (r.mode === 'navigate' ? await caches.match('index.html') : null);
      if (m) return m; throw err;
    }
  })());
});
