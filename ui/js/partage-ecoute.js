// =====================================================================
// ÉCOUTE EXTERNE — un lien pour faire écouter nos morceaux à quelqu'un de l'extérieur
// (label, radio, ami…). Écoute seulement : pochette, titre, la version ★. Pas de téléchargement.
//
//   Le lien : https://ecoute.beeskot-music.workers.dev/<id du fichier du lien dans le Drive>
//   Le lien est une fiche « partages » (type: 'ecoute') — la même collection que les liens Externe,
//   donc les accès aux fichiers sont ouverts / fermés par BK.externe.synchroAcces, au même endroit.
//
//   La page de l'invité est fabriquée par Cloudflare (dossier ecoute-web/ du dépôt) : l'invité ne passe
//   JAMAIS par une page Google (plus de bug « plusieurs comptes Google »). Le son et la pochette passent
//   par Cloudflare : l'adresse des fichiers du Drive n'est jamais montrée.
//
//   Le lien suit toujours la ★ : BK.ecouteExt.rafraichir() refait la liste des fichiers des liens actifs
//   (au démarrage, à l'ouverture de la Bibliothèque, quand on change la ★).
// =====================================================================
(() => {
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const expire = l => !!(l && l.expire && Date.now() > Date.parse(l.expire));
const jourFr = iso => new Date(iso).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });
// fin de journée (heure locale) dans N jours, ou à la date choisie
const finDe = (choix, date) => { if (choix === 'jamais') return null; const d = choix === 'date' ? new Date(date + 'T23:59:59') : new Date(Date.now() + (+choix) * 864e5); if (choix !== 'date') d.setHours(23, 59, 59, 0); return isNaN(d) ? null : d.toISOString(); };
const idDrive = v => { const m = /^drive:([\w-]+)$/.exec(String(v || '')); return m ? m[1] : ''; };

BK.ecouteExt = {
  // l'adresse de la page (Cloudflare). Si elle change un jour : cette ligne seulement.
  PORTE: 'https://ecoute.beeskot-music.workers.dev/',
  lien: l => l && l.doc ? BK.ecouteExt.PORTE + l.doc : '',

  // la version ★ d'un morceau, dans le Drive : { id, nom } ou null
  async sonDrive(m, ms) {
    const s = await BK.sonDuMorceau(m, ms).catch(() => null); if (!s) return null;
    if (s.drive) return { id: s.drive, nom: s.nom || '' };
    // la ★ est un fichier d'un PC : on cherche le même fichier (même nom) dans le Drive du morceau
    try { await BK.dossiers.assurer(); const f = (await BK.dossiers.duMorceau(m, ms)).find(x => x.name === s.nom && !x.groupe); if (f) return { id: f.id, nom: f.name }; } catch (e) {}
    return null;
  },
  // la liste des morceaux du lien, avec leurs fichiers du moment (la ★ d'aujourd'hui)
  async elements(ids, ms) {
    ms = ms || await BK.db.liste('morceaux'); const out = [];
    for (const id of ids || []) { const m = ms.find(x => x.id === id); if (!m) continue;
      const s = await BK.ecouteExt.sonDrive(m, ms); if (!s) continue;
      out.push({ id: m.id, nom: m.nom || 'Morceau', fichier: s.id, image: idDrive(await BK.ecouteExt.photoDrive(m)) }); }
    return out;
  },
  // la photo du morceau doit être un fichier du Drive (Cloudflare ne lit que ça). Une ancienne photo collée dans la fiche
  // est rangée une fois dans « Images des fiches » (comme Réglages › alléger) : même image, la fiche pointe vers le fichier.
  async photoDrive(m) {
    if (!m.photo || BK.img.estDrive(m.photo) || !BK.img.estCopie(m.photo)) return m.photo || '';
    try { const blob = await (await fetch(m.photo)).blob(), nom = String(m.nom || 'morceau').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 40) + ' - photo.jpg';
      const f = await BK.drive.envoyerBlob(new File([blob], nom, { type: blob.type || 'image/jpeg' }), nom, await BK.drive.dossier('Images des fiches', await BK.drive.racine()), () => {});
      if (!f || !f.id) return '';
      BK.drive.vignetteGarder(f.id, URL.createObjectURL(blob)); m.photo = BK.img.ref(f.id); await BK.db.ecrire('morceaux', m, { sansAnnuler: true });
      return m.photo; } catch (e) { console.warn('écoute : photo', e); return ''; }
  },
  liens: async () => (await BK.db.liste('partages')).filter(l => l.type === 'ecoute'),
  // enregistre le lien dans le Drive, puis ouvre / ferme les accès (le lien, ses sons, ses pochettes)
  async garder(l) {
    l.type = 'ecoute'; l.maj = new Date().toISOString();
    await BK.db.ecrire('partages', l, { sansAnnuler: true });
    if (!l.doc) { l.doc = await BK.drive.idFichier('partages', l.id); if (!l.doc) throw new Error('Le lien n\'a pas été rangé dans le Drive'); await BK.db.ecrire('partages', l, { sansAnnuler: true }); }
    const pb = await BK.externe.synchroAcces(await BK.db.liste('partages'));
    if (pb.length) throw new Error(pb[0]);
    return l;
  },
  // le lien suit la ★ : on refait la liste des fichiers des liens actifs, et on n'écrit que si ça a changé
  async rafraichir() {
    if (!BK.drive || !BK.drive.relie() || BK.ecouteExt._enCours) return; BK.ecouteExt._enCours = true;
    try { const ls = (await BK.ecouteExt.liens()).filter(l => l.actif !== false && !expire(l)); if (!ls.length) return;
      const ms = await BK.db.liste('morceaux'); let change = false;
      for (const l of ls) { const els = await BK.ecouteExt.elements(l.morceaux, ms);
        if (JSON.stringify(els) !== JSON.stringify(l.elements || [])) { l.elements = els; l.maj = new Date().toISOString(); await BK.db.ecrire('partages', l, { sansAnnuler: true }); change = true; } }
      if (change) await BK.externe.synchroAcces(await BK.db.liste('partages'));
    } catch (e) { console.warn('écoute : mise à jour des liens', e); }
    finally { BK.ecouteExt._enCours = false; }
  },
  plusTard() { clearTimeout(BK.ecouteExt._t); BK.ecouteExt._t = setTimeout(() => BK.ecouteExt.rafraichir(), 4000); },

  // ---------- la fenêtre « Partager l'écoute » (Bibliothèque) ----------
  async fenetre() {
    if (!BK.drive || !BK.drive.relie()) return BK.avis('Relie d\'abord le Drive (Réglages › Drive) : les liens d\'écoute passent par le Drive du groupe.');
    const v = document.createElement('div'); v.className = 'voile ec-voile';
    v.innerHTML = `<div class="stopbox ecp-box"><span class="screw tl"></span><span class="screw tr"></span><span class="screw bl"></span><span class="screw br"></span>
      <button class="btn xs rt-x" id="ecpX" title="Fermer">✕</button>
      <span class="dymo" style="align-self:center">Partager l'écoute</span>
      <p class="nt ecp-aide">Coche les morceaux à faire écouter. La personne voit la pochette, le titre et la version ★, rien d'autre, et ne peut pas télécharger. Le lien suit toujours la ★ du moment.</p>
      <div class="ecp-cols">
        <div class="ecp-col"><span class="lb">Morceaux</span><div class="ecp-m" id="ecpM"><span class="nt">Chargement…</span></div>
          <div class="ecp-cree"><input class="fld" id="ecpNom" maxlength="40" placeholder="Pour qui ? (ex. Label X)">
            <select class="fld ecp-exp" id="ecpExp" title="Le lien s'éteint tout seul à cette date"><option value="jamais">N'expire jamais</option><option value="7">Expire dans 7 jours</option><option value="30">Expire dans 30 jours</option><option value="date">Expire le…</option></select><input class="fld hidden" type="date" id="ecpDate">
            <select class="fld ecp-exp" id="ecpExt" title="Écoute du morceau entier, ou seulement de son début (Cloudflare n'envoie que ce début : impossible d'écouter plus loin)"><option value="0">Morceau entier</option><option value="30">Extrait de 30 s</option><option value="42">Extrait de 42 s</option><option value="60">Extrait de 60 s</option><option value="autre">Extrait de… (secondes)</option></select><input class="fld hidden ecp-sec" type="number" id="ecpExtN" min="5" max="600" step="1" placeholder="s"><button class="btn pri" id="ecpOk" disabled>Créer le lien</button><button class="btn hidden" id="ecpAnnul">Annuler</button></div></div>
        <div class="ecp-col"><span class="lb">Les liens</span><div class="ecp-l" id="ecpL"><span class="nt">Chargement…</span></div></div>
      </div><span class="vfd" id="ecpEtat">PRÊT</span></div>`;
    document.body.appendChild(v);
    const q = s => v.querySelector(s), etat = t => { q('#ecpEtat').textContent = String(t).toUpperCase(); };
    let ms = [], dispo = {}, liens = [], edite = null, choix = new Set(), stats = {};
    // la durée de l'extrait (0 = morceau entier)
    const extraitChoisi = () => { const v = q('#ecpExt').value; const n = v === 'autre' ? Math.round(+q('#ecpExtN').value || 0) : +v; return n > 0 ? Math.min(600, Math.max(5, n)) : 0; };
    const montrerExtrait = n => { const std = ['0', '30', '42', '60'].includes(String(n || 0)); q('#ecpExt').value = std ? String(n || 0) : 'autre'; q('#ecpExtN').value = std ? '' : n; q('#ecpExtN').classList.toggle('hidden', std); };
    // les écoutes de chaque lien (comptées chez Cloudflare) : « Mother 3 · Moon Blue 1 »
    const ecoutes = l => { const s = stats[l.id]; if (s === undefined) return '<span class="ecp-ec">Écoutes : …</span>'; if (!s || !s.ok) return '';
      // TOUS les morceaux du lien, même à 0 écoute : les plus écoutés d'abord, puis par ordre alphabétique
      const noms = Object.fromEntries([...(l.elements || []).map(e => [e.id, e.nom]), ...ms.map(m => [m.id, m.nom])]);
      const lg = (l.morceaux || []).map(id => ({ nom: noms[id] || (s.m && s.m[id] && s.m[id].nom) || 'Morceau', n: (s.m && s.m[id] && s.m[id].n) || 0 }));
      for (const [k, x] of Object.entries(s.m || {})) if (!(l.morceaux || []).includes(k)) lg.push({ nom: x.nom || noms[k] || 'Morceau', n: x.n || 0 });   // un morceau retiré du lien mais déjà écouté
      lg.sort((a, b) => b.n - a.n || a.nom.localeCompare(b.nom, 'fr'));
      const tot = lg.reduce((t, x) => t + x.n, 0);
      return `<details class="ecp-ec ecp-det"><summary>🎧 ${tot ? tot + ' écoute' + (tot > 1 ? 's' : '') : 'Pas encore écouté'}${s.dernier ? ` · dernière écoute le ${jourFr(s.dernier)}` : ''}</summary>`
        + lg.map(x => `<div class="ecp-li"><span>${esc(x.nom)}</span><b>${x.n}</b></div>`).join('') + '</details>'; };
    const lireStats = () => Promise.all(liens.filter(l => l.doc).map(async l => {
      try { const r = await fetch(BK.ecouteExt.PORTE + l.doc + '/stats', { cache: 'no-store' }); stats[l.id] = r.ok ? await r.json() : null; } catch (e) { stats[l.id] = null; } })).then(() => v.isConnected && dessinerL());
    const fermer = () => { document.removeEventListener('keydown', touche, true); v.remove(); };
    const touche = e => { if (e.key === 'Escape') { e.stopPropagation(); fermer(); } };
    document.addEventListener('keydown', touche, true);
    q('#ecpX').onclick = fermer; v.addEventListener('click', e => { if (e.target === v) fermer(); });
    const majOk = () => { const b = q('#ecpOk'); b.disabled = !choix.size || !q('#ecpNom').value.trim(); b.textContent = edite ? `Mettre à jour (${choix.size})` : choix.size ? `Créer le lien (${choix.size})` : 'Créer le lien'; q('#ecpAnnul').classList.toggle('hidden', !edite); };
    const dessinerM = () => {
      q('#ecpM').innerHTML = ms.length ? ms.map(m => { const d = dispo[m.id], ok = d && d !== '…';
        return `<label class="ecp-ligne${ok ? '' : ' off'}"><input type="checkbox" data-m="${m.id}"${choix.has(m.id) ? ' checked' : ''}${ok ? '' : ' disabled'}>
          <span class="ecp-ph"${BK.img.bg(m.photo)}></span><span class="ecp-t"><b>${esc(m.nom)}</b><em>${d === '…' ? 'recherche de la ★…' : ok ? '★ ' + esc(d.nom) : 'pas de version ★ dans le Drive'}</em></span></label>`; }).join('')
        : '<span class="nt">Aucun morceau dans la Bibliothèque.</span>';
      BK.img.remplir(q('#ecpM'));
      v.querySelectorAll('[data-m]').forEach(c => c.onchange = () => { c.checked ? choix.add(c.dataset.m) : choix.delete(c.dataset.m); majOk(); });
      majOk(); };
    const dessinerL = () => {
      q('#ecpL').innerHTML = liens.length ? liens.slice().sort((a, b) => (b.cree || '').localeCompare(a.cree || '')).map(l => { const coupe = l.actif === false, fini = expire(l), n = (l.elements || []).length;
        return `<div class="ecp-lien${coupe || fini ? ' coupe' : ''}${edite === l ? ' edite' : ''}"><div class="ecp-lt"><b>${esc(l.nom || 'Sans nom')}</b><em>${n} morceau${n > 1 ? 'x' : ''}${l.extrait ? ' · extrait de ' + l.extrait + ' s' : ''}${coupe ? ' · révoqué' : fini ? ' · expiré le ' + jourFr(l.expire) : l.expire ? ' · expire le ' + jourFr(l.expire) : ''}</em></div>
          ${ecoutes(l)}
          <div class="ecp-lb">${coupe || fini ? '' : `<button class="btn xs pri" data-copier="${l.id}">Copier le lien</button>`}<button class="btn xs" data-modif="${l.id}">Modifier</button>
          <button class="btn xs" data-couper="${l.id}">${coupe ? 'Réactiver' : 'Révoquer'}</button><button class="btn xs" data-suppr="${l.id}" title="Supprimer ce lien pour toujours">✕</button></div></div>`; }).join('')
        : '<span class="nt">Aucun lien pour l\'instant.</span>';
      const trouve = id => liens.find(x => x.id === id);
      v.querySelectorAll('[data-copier]').forEach(b => b.onclick = async () => { const u = BK.ecouteExt.lien(trouve(b.dataset.copier)); try { await navigator.clipboard.writeText(u); etat('Lien copié'); } catch (e) { prompt('Copie ce lien :', u); } });
      v.querySelectorAll('[data-modif]').forEach(b => b.onclick = () => { edite = trouve(b.dataset.modif); choix = new Set(edite.morceaux || []); q('#ecpNom').value = edite.nom || ''; q('#ecpExp').value = edite.expire ? 'date' : 'jamais'; q('#ecpDate').value = edite.expire ? new Date(edite.expire).toLocaleDateString('en-CA') : ''; q('#ecpDate').classList.toggle('hidden', !edite.expire); montrerExtrait(edite.extrait); dessinerM(); dessinerL(); etat('Modification de « ' + (edite.nom || '') + ' »'); });
      v.querySelectorAll('[data-couper]').forEach(b => b.onclick = async () => { const l = trouve(b.dataset.couper); if (!l) return; b.disabled = true; etat('Un instant…');
        l.actif = l.actif === false; try { await BK.ecouteExt.garder(l); etat(l.actif ? 'Lien réactivé' + (expire(l) ? ' (mais il a expiré : Modifier pour changer la date)' : '') : 'Lien révoqué : il ne marche plus'); } catch (e) { etat('Problème : ' + (e.message || e)); } dessinerL(); });
      v.querySelectorAll('[data-suppr]').forEach(b => b.onclick = async () => { const l = trouve(b.dataset.suppr); if (!l) return;
        if (b.dataset.sur !== '1') { b.dataset.sur = '1'; b.textContent = 'Sûr ?'; setTimeout(() => { if (b.isConnected) { b.dataset.sur = ''; b.textContent = '✕'; } }, 3000); return; }
        b.disabled = true; etat('Suppression…');
        try { l.actif = false; await BK.ecouteExt.garder(l); await BK.db.supprimer('partages', l.id, { sansAnnuler: true }); liens = liens.filter(x => x !== l); if (edite === l) edite = null;
          await BK.externe.synchroAcces(await BK.db.liste('partages')); etat('Lien supprimé'); } catch (e) { etat('Problème : ' + (e.message || e)); }
        dessinerL(); dessinerM(); });
    };
    q('#ecpNom').oninput = majOk;
    q('#ecpExp').onchange = () => { const d = q('#ecpExp').value === 'date'; q('#ecpDate').classList.toggle('hidden', !d); if (d && !q('#ecpDate').value) q('#ecpDate').value = new Date(Date.now() + 14 * 864e5).toLocaleDateString('en-CA'); };
    q('#ecpExt').onchange = () => { const a = q('#ecpExt').value === 'autre'; q('#ecpExtN').classList.toggle('hidden', !a); if (a) { if (!q('#ecpExtN').value) q('#ecpExtN').value = 45; q('#ecpExtN').focus(); } };
    q('#ecpAnnul').onclick = () => { edite = null; choix = new Set(); q('#ecpNom').value = ''; q('#ecpExp').value = 'jamais'; q('#ecpDate').classList.add('hidden'); montrerExtrait(0); dessinerM(); dessinerL(); etat('Prêt'); };
    q('#ecpOk').onclick = async () => { const b = q('#ecpOk'); b.disabled = true; etat(edite ? 'Mise à jour…' : 'Création du lien…');
      try { const l = edite || { id: 'ec-' + BK.db.nouvelId(), cree: new Date().toISOString(), actif: true };
        l.nom = q('#ecpNom').value.trim().slice(0, 40); l.expire = finDe(q('#ecpExp').value, q('#ecpDate').value); if (l.expire && Date.parse(l.expire) < Date.now()) throw new Error('Cette date est déjà passée');
        const ex = extraitChoisi(); if (q('#ecpExt').value === 'autre' && !ex) throw new Error('Écris la durée de l\'extrait en secondes'); if (ex) l.extrait = ex; else delete l.extrait; l.morceaux = ms.filter(m => choix.has(m.id)).map(m => m.id); l.elements = await BK.ecouteExt.elements(l.morceaux, ms);
        if (!l.elements.length) throw new Error('Aucun de ces morceaux n\'a de version ★ dans le Drive');
        await BK.ecouteExt.garder(l); if (!liens.includes(l)) liens.push(l);
        const u = BK.ecouteExt.lien(l); try { await navigator.clipboard.writeText(u); } catch (e) {}
        etat(edite ? 'Lien mis à jour' : 'Lien créé et copié'); edite = null; choix = new Set(); q('#ecpNom').value = ''; q('#ecpExp').value = 'jamais'; q('#ecpDate').classList.add('hidden'); montrerExtrait(0);
      } catch (e) { console.error(e); etat('Problème : ' + (e.message || e)); }
      dessinerM(); dessinerL(); };
    // chargement : les morceaux, puis leur ★ dans le Drive (un par un, sans bloquer)
    try { ms = (await BK.db.liste('morceaux')).filter(m => m.statut !== 'archive').sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
      liens = await BK.ecouteExt.liens(); } catch (e) { q('#ecpM').innerHTML = '<span class="nt">Drive injoignable.</span>'; return; }
    ms.forEach(m => { dispo[m.id] = '…'; }); dessinerM(); dessinerL(); lireStats();
    for (const m of ms) { if (!v.isConnected) return; dispo[m.id] = await BK.ecouteExt.sonDrive(m, ms); dessinerM(); }
  },
};
})();
