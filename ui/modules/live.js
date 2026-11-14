// =====================================================================
// SYNCH BREAD (ex « Live », l'identifiant de l'onglet reste « live ») : le playback synchronisé pour les tournages (tout le monde entend la même
// musique, au même moment, dans ses écouteurs).
// L'écran est dans js/live-ecran.js, le moteur dans js/live-moteur.js (les deux servent aussi à la
// page des invités, ui/live/index.html). Ici : seulement ce que le logiciel apporte à l'écran
// (les morceaux de la Bibliothèque, les passages, les exports de Reels Audio, le lien des invités).
//
//   Passages créés dans Live : liste partagée « passages.live » (Drive) → { idMorceau: [{ nom, debut, fin }] } — lue aussi par tous les autres onglets (BK.passagesDuMorceau)
//   Passages proposés par Reels Audio (tournages, PLAN, gardés, Discord) : lus, jamais modifiés ici
//   Code de la salle commune : réglage partagé « live.salle » (le même pour tout le groupe)
//   Lien des invités : fiche « partages » d'id « live-invites » (type 'live') → ouvre / ferme l'accès au fichier du morceau
// =====================================================================
(() => {
// l'adresse de la page des invités. Si elle change un jour : cette ligne seulement.
BK.LIEN_LIVE = 'https://beeskotmusic-cmd.github.io/beeskot-studio/live/';
const AUDIO = /\.(wav|mp3|aiff?|flac|m4a|ogg)$/i;
const hasard = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), x => 'abcdefghijkmnpqrstuvwxyz23456789'[x % 32]).join('');
const clePass = p => p.export ? p.id + '|' + p.fichier : p.id;        // un export a sa propre liste de passages
// « 0:42 - 1:05 » → { debut, fin } en secondes (comme dans Reels Audio)
const morceau = async id => { const ms = await BK.db.liste('morceaux'); return { ms, m: ms.find(x => x.id === id) }; };

BK.live = {
  async salle() { let s = await BK.partage.lire('live.salle', ''); if (!s) { if (BK.db.enLigne === false) throw new Error('pas de réseau : impossible de retrouver la salle du groupe'); s = hasard(22); await BK.partage.ecrire('live.salle', s); } return s; },
  hote(salle) {
    return {
      nom: BK.reglage('nomPc', '') || 'Membre', type: window.BK_MOBILE ? 'tel' : 'pc', membre: true, salle,
      morceaux: async () => (await BK.db.liste('morceaux')).map(m => ({ id: m.id, nom: m.nom || 'Morceau' })).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
      // la version ★ du morceau, dans le Drive (les autres appareils doivent pouvoir la télécharger)
      async piste(id) { const { ms, m } = await morceau(id); if (!m) throw new Error('morceau introuvable');
        const s = await BK.ecouteExt.sonDrive(m, ms); if (!s) throw new Error('pas de version ★ dans le Drive pour « ' + m.nom + ' »');
        return { id: m.id, nom: m.nom, fichier: s.id, nomFichier: s.nom, bpm: parseFloat(m.bpm) || 0 }; },
      octets: p => BK.drive.telecharger(p.fichier),
      // les passages du morceau : ceux créés ici, puis tous ceux que Reels Audio propose déjà (son menu « Passages prévus » :
      // fiches Tournages, PLAN.xlsx, gardés dans Reels, trouvés sur Discord). Un export a ses propres passages (créés ici seulement).
      async passages(p) {
        const live = ((await BK.partage.lire('passages.live', {}))[clePass(p)] || []).map(x => ({ ...x, source: 'live' })); if (p.export) return live;
        const { ms, m } = await morceau(p.id); if (!m) return live;
        // + la liste commune de tout le logiciel (Tournages, PLAN, Reels, Reels Audio, Discord) : un passage ajouté ailleurs apparaît ici
        const l = [...live], vu = new Set(live.map(x => Math.round(x.debut) + '-' + Math.round(x.fin))), propre = t => String(t || '').replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '').replace(/\s+/g, ' ').trim();
        for (const x of await BK.passagesDuMorceau(m, ms).catch(() => [])) { if (x.source === 'live') continue; const k = Math.round(x.debut) + '-' + Math.round(x.fin); if (vu.has(k)) continue; vu.add(k);
          l.push({ nom: propre(x.nom).slice(0, 40) || 'Passage', debut: x.debut, fin: x.fin, v: 1, source: 'reels' }); }
        const caches = new Set((await BK.partage.lire('passages.caches', {}))[clePass(p)] || []);   // cachés dans Synch bread (pour tout le groupe)
        l.forEach(x => { if (x.source !== 'live' && caches.has(x.debut + '-' + x.fin)) x.cache = true; });
        return l.sort((a, b) => a.debut - b.debut);
      },
      async garderPassage(p, x) { const tout = { ...(await BK.partage.lire('passages.live', {})) }, k = clePass(p); tout[k] = [...(tout[k] || []).filter(y => y.nom !== x.nom), { nom: x.nom, debut: x.debut, fin: x.fin, v: x.v || 1 }]; await BK.partage.ecrire('passages.live', tout); },
      // un passage venu d'ailleurs (PLAN, Tournages, Reels, Discord) n'est pas effacé là-bas : il est seulement caché ici
      async cacherPassage(p, x, oui) { const tout = { ...(await BK.partage.lire('passages.caches', {})) }, k = clePass(p), c = x.debut + '-' + x.fin, s = new Set(tout[k] || []);
        if (oui) s.add(c); else s.delete(c); tout[k] = [...s]; await BK.partage.ecrire('passages.caches', tout); },
      async oublierPassage(p, x) { const tout = { ...(await BK.partage.lire('passages.live', {})) }, k = clePass(p); tout[k] = (tout[k] || []).filter(y => !(y.nom === x.nom && Math.abs(y.debut - x.debut) < .05)); await BK.partage.ecrire('passages.live', tout); },
      // les passages déjà exportés par Reels Audio (fichiers « tournage » / « montage » du morceau dans le Drive)
      async exports(p) { const { ms, m } = await morceau(p.id); if (!m || !BK.drive.relie()) return [];
        await BK.dossiers.assurer(); const l = await BK.dossiers.duMorceau(m, ms);
        return l.filter(f => !f.groupe && AUDIO.test(f.name) && (f.role === 'wavtournage' || /tournage|montage/i.test(f.name)))
          .sort((a, b) => (b.modifiedTime || '').localeCompare(a.modifiedTime || ''))
          .map(f => ({ nom: f.name.replace(AUDIO, ''), fichier: f.id, detail: (f.role === 'wavtournage' || /tournage/i.test(f.name) ? 'export tournage' : 'export montage') + (f.modifiedTime ? ' · ' + new Date(f.modifiedTime).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' }) : '') })); },
      // le lien des invités : l'accès au fichier du morceau est ouvert tant que les invitations sont ouvertes (et refermé ensuite)
      async inviter(p, on) {
        const fiche = { id: 'live-invites', type: 'live', nom: 'Invités de Synch bread', actif: !!on, elements: on && p && p.fichier ? [{ fichier: p.fichier }] : [], maj: new Date().toISOString() };
        await BK.db.ecrire('partages', fiche, { sansAnnuler: true });
        const pb = await BK.externe.synchroAcces(await BK.db.liste('partages')); if (pb.length) throw new Error(pb[0]);
        return { lien: BK.LIEN_LIVE + '#s=' + salle, cle: on ? await BK.externe.cleApi() : '' };
      },
      qr(texte) { try { const q = qrcode(0, 'M'); q.addData(texte); q.make(); return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }).replace(/fill="(white|#ffffff)"/gi, 'fill="#ece9e2"').replace(/fill="(black|#000000)"/gi, 'fill="#1c1640"'); } catch (e) { return ''; } },
    };
  },
};

BK.module('live', async function (page) {
  $('.sub', page).textContent = 'Le playback des tournages : tout le monde entend la même musique, en même temps';
  const g = $('.grid', page);
  if (!window.BKLive) { g.innerHTML = '<div class="pane vit"><span class="nt">Synch bread n\'a pas pu se charger.</span></div>'; return; }
  const monter = async () => {
    if (!BK.drive || !BK.drive.relie()) { g.innerHTML = '<div class="pane vit"><span class="nt">Relie d\'abord le Drive (Réglages › Drive) : Synch bread prend les morceaux dans le Drive du groupe.</span></div>'; page._recharger = monter; page.dataset.perime = '1'; return; }
    try { const salle = await BK.live.salle(); g.innerHTML = '<div></div>'; BK.live.ecran = BKLive.monter(g.firstChild, BK.live.hote(salle)); }
    catch (e) { g.innerHTML = `<div class="pane vit"><span class="nt">Synch bread n'a pas pu s'ouvrir (${String(e && e.message || e).replace(/[<>&]/g, '')}). Vérifie le réseau, puis reviens sur cet onglet.</span></div>`; page._recharger = monter; page.dataset.perime = '1'; console.warn(e); }
  };
  await monter();
  // la barre d'espace : lancer / stop (seulement quand l'onglet Live est à l'écran et qu'on n'est pas en train d'écrire)
  document.addEventListener('keydown', e => { if (e.code !== 'Space' || e.repeat || page.classList.contains('hidden') || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test((e.target || {}).tagName) || document.querySelector('.voile')) return;
    if (BK.live.ecran) { e.preventDefault(); BK.live.ecran.basculer(); } });
});
})();
