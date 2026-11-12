// =====================================================================
// SYNCH BREAD — la page des invités : ce qu'un invité sait faire (écouter en synchro, lancer, choisir un passage,
// régler ses écouteurs). Il ne voit rien d'autre de BEESKOT Studio.
// Le lien contient le code de la salle après le # (il ne part jamais sur Internet tout seul).
// Le morceau est lu directement dans le Drive, tant que le groupe garde les invitations ouvertes.
// =====================================================================
(() => {
const racine = document.getElementById('live'), L = window.BKLive;
const salle = (new URLSearchParams(location.hash.slice(1)).get('s') || '').replace(/[^a-z0-9]/gi, '');
if (!salle || salle.length < 12) { racine.innerHTML = '<p style="color:#efe6d2;font:16px system-ui,sans-serif;padding:24px;text-align:center">Ce lien n\'est pas valide. Redemande le QR code au groupe.</p>'; return; }

const CACHE = 'bk-live-sons';
L.monter(racine, {
  nom: L.outils.lu('bk.live.nom', ''), type: 'invite', membre: false, salle,
  async octets(p) {
    const cle = 'https://live.cache/' + p.fichier;
    try { const c = await caches.open(CACHE), deja = await c.match(cle); if (deja) return deja.arrayBuffer(); } catch (e) {}
    if (!p.cle) throw new Error('les invitations sont fermées (demande au groupe de rouvrir « Inviter »)');
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(p.fichier)}?alt=media&key=${encodeURIComponent(p.cle)}`, { referrerPolicy: 'no-referrer' });
    if (!r.ok) throw new Error('fichier non lisible (' + r.status + ')');
    const ab = await r.arrayBuffer();
    try { const c = await caches.open(CACHE); for (const k of await c.keys()) await c.delete(k); await c.put(cle, new Response(ab.slice(0))); } catch (e) {}   // on ne garde que le dernier morceau
    return ab;
  },
});
})();
