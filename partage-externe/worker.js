// =====================================================================
// BEESKOT · ESPACE DE PARTAGE (Notes et retours / Notes vidéos › Externe) — chez Cloudflare.
// C'est ce fichier qu'on colle chez Cloudflare (Worker « partage »). Mode d'emploi : LISEZ-MOI.txt.
// La page elle-même (page-cf.html, fabriquée par « python3 fabriquer.py ») est lue dans le dépôt GitHub :
// pour changer la page, on la refabrique et on pousse — rien à refaire chez Cloudflare.
//
//   https://partage.beeskot-music.workers.dev/?k=<code>   la page de l'invité (fabriquée ICI)
//   POST /api                                            les notes : relayées au guichet Google (Code.gs)
//
// L'invité n'ouvre JAMAIS une page Google : c'est Cloudflare qui parle au guichet, de serveur à serveur.
// Fini le bug « Impossible d'ouvrir le fichier » quand on est connecté à plusieurs comptes Google.
// =====================================================================
// l'adresse du guichet Google (Déployer › Gérer les déploiements › URL de l'application Web). Si elle change : cette ligne.
const GUICHET = 'https://script.google.com/macros/s/AKfycbzNugeIABy4DNm26SGYB_LtXd49J4nGccpO9D9OWhgr2xqUDpnyTnYKRBleyjAWr9KcQw/exec';
const PAGE_URL = 'https://raw.githubusercontent.com/beeskotmusic-cmd/beeskot-studio/main/partage-externe/page-cf.html';

// la page, gardée 5 minutes chez Cloudflare (rapide) ; si GitHub ne répond pas, on ressert la dernière connue
async function page(ctx) {
  const cache = caches.default, cle = new Request('https://cache.partage/page'), deja = await cache.match(cle);
  if (deja && Date.now() - (+deja.headers.get('X-Lu') || 0) < 300e3) return deja.text();
  try { const r = await fetch(PAGE_URL, { cf: { cacheTtl: 60 } }); if (r.ok) { const t = await r.text();
      ctx.waitUntil(cache.put(cle, new Response(t, { headers: { 'X-Lu': String(Date.now()), 'Cache-Control': 'max-age=31536000' } }))); return t; } } catch (e) {}
  return deja ? deja.text() : '<!doctype html><meta charset="utf-8"><p style="font:16px sans-serif;text-align:center;margin-top:40px">La page ne répond pas. Réessaie dans un instant.</p>';
}

const json = (o, statut = 200) => new Response(JSON.stringify(o), { status: statut, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

export default {
  async fetch(req, env, ctx) {
    const u = new URL(req.url);
    if (u.pathname === '/api') {
      if (req.method !== 'POST') return json({ ok: false, err: 'Demande refusée.' }, 405);
      const corps = await req.text();
      if (corps.length > 60000) return json({ ok: false, err: 'Trop long.' }, 413);
      try {
        const r = await fetch(GUICHET, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corps, redirect: 'follow' });
        const t = await r.text();
        if (!/^\s*\{/.test(t)) return json({ ok: false, err: 'Le serveur ne répond pas. Réessaie dans un instant.' }, 502);
        return new Response(t, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
      } catch (e) { return json({ ok: false, err: 'Le serveur ne répond pas. Réessaie dans un instant.' }, 502); }
    }
    if (u.pathname === '/' || u.pathname === '/index.html')
      return new Response(await page(ctx), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'no-referrer' } });
    return new Response('', { status: 404 });
  },
};
