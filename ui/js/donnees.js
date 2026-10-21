// =====================================================================
// BEESKOT Studio — les DONNÉES du groupe.
// Tout est rangé dans le dossier Drive BEESKOT choisi dans Réglages :
//
//   <Drive BEESKOT>/BEESKOT Studio/
//        morceaux/<id>.json      une fiche par morceau
//        taches/<id>.json        une tâche par fichier
//        inventaires/<pc>.json   ce que chaque PC a trouvé (projets, exports)
//        corbeille/...           rien n'est jamais effacé : on déplace ici
//
// Un petit fichier par élément = deux membres qui écrivent en même temps
// ne s'écrasent pas.
// Sans .exe (aperçu dans un navigateur), tout reste dans la mémoire du navigateur.
// =====================================================================
BK.T = window.__TAURI__ || null;           // le moteur du .exe, s'il est là
BK.estExe = !!BK.T;
BK.SOUS_DOSSIER = 'BEESKOT Studio';

BK.chemin = (...morceaux) => morceaux.filter(Boolean).join('\\').replace(/[\\/]+/g, '\\');

BK.fichier = {
  async lireTexte(p)        { return BK.T.fs.readTextFile(p); },
  async ecrireTexte(p, t)   { return BK.T.fs.writeTextFile(p, t); },
  async lireOctets(p)       { return new Uint8Array(await BK.T.fs.readFile(p)); },
  async ecrireOctets(p, o)  { return BK.T.fs.writeFile(p, o); },
  async existe(p)           { try { return await BK.T.fs.exists(p); } catch (e) { return false; } },
  // créer un dossier, même si tous ses parents manquent (Ableton fraîchement installé, par ex.)
  async creerDossier(p) {
    if (await BK.fichier.existe(p)) return;
    try { await BK.T.fs.mkdir(p, { recursive: true }); if (await BK.fichier.existe(p)) return; } catch (e) {}
    const bouts = String(p).split('\\'); let cur = bouts.shift();          // « C: », puis un cran à la fois
    for (const b of bouts) { if (!b) continue; cur += '\\' + b;
      if (!(await BK.fichier.existe(cur))) { try { await BK.T.fs.mkdir(cur); } catch (e) {} } }
    if (!(await BK.fichier.existe(p))) throw new Error('Impossible de créer le dossier ' + p);
  },
  async liste(p)            { try { return await BK.T.fs.readDir(p); } catch (e) { return []; } },
  async infos(p)            { try { return await BK.T.fs.stat(p); } catch (e) { return null; } },
  async deplacer(a, b)      { return BK.T.fs.rename(a, b); },
  async choisirDossier(titre) { return BK.T.dialog.open({ directory: true, title: titre }); },
  async choisirFichier(titre, filtres) { return BK.T.dialog.open({ multiple: false, title: titre, filters: filtres }); },
  async ouvrir(p)           { return BK.T.opener.openPath(p); },     // ex. ouvrir un projet Ableton
};

// ---------- la petite base de données (collections de fiches JSON) ----------
// Drive relié → les fiches vivent dans le Drive BEESKOT (copie gardée sur le PC pour marcher hors ligne).
// Pas de Drive → les fiches restent sur ce PC, et partiront dans le Drive à la connexion.
BK.db = {
  cache: {},
  enLigne: true,
  nouvelId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); },
  drive() { return BK.drive && BK.drive.relie(); },

  async liste(col) {
    if (!BK.db.drive()) return Object.values(BK.db.memoire(col));
    try {
      const out = await BK.drive.liste(col);
      for (const a of BK.reglage('db.attente', [])) if (a.col === col) { if (a.suppr) delete out[a.id]; else out[a.fiche.id] = a.fiche; }   // pas encore envoyés
      BK.db.cache[col] = out; BK.db.enLigne = true; BK.db.lu[col] = true;
    } catch (e) {
      BK.db.enLigne = false;                                         // hors ligne : dernière copie connue
      const c = (BK.drive.cacheDe ? BK.drive.cacheDe(col).c : BK.reglage('drive.cache.' + col, {})), out = {};
      for (const x of Object.values(c)) out[x.fiche.id] = x.fiche;
      for (const a of BK.reglage('db.attente', [])) if (a.col === col) { if (a.suppr) delete out[a.id]; else out[a.fiche.id] = a.fiche; }
      BK.db.cache[col] = out;
    }
    BK.etatDrive && BK.etatDrive();
    const ph = BK.db.photo[col] = BK.db.photo[col] || {};             // copie « avant » pour pouvoir annuler
    for (const f of Object.values(BK.db.cache[col])) ph[f.id] = JSON.stringify(f);
    return Object.values(BK.db.cache[col]);
  },

  photo: {},
  lu: {},                                                            // les collections bien lues dans le Drive depuis l'ouverture
  async ecrire(col, fiche, { sansAnnuler = false, graine = false } = {}) {
    fiche.id = fiche.id || BK.db.nouvelId();
    if (!graine && fiche.graine) delete fiche.graine;                 // une fiche de départ qu'on modifie devient une vraie fiche du groupe
    // PROTECTION : les réglages partagés (étiquettes, dossiers, résumé…) sont un seul gros fichier pour tout le groupe.
    // Si on n'a pas réussi à les lire dans le Drive, on ne les écrit pas : on écraserait le travail des autres avec une version vide.
    if (BK.db.drive() && (col === 'config' || col === 'veille') && !/^ici-/.test(fiche.id) && !BK.db.lu[col]) {
      await BK.db.liste(col).catch(() => {});
      if (!BK.db.lu[col]) { BK.toast && BK.toast('Drive injoignable : rien n\'a été enregistré, réessaie dans un instant'); throw new Error('Drive injoignable : rien n\'a été écrasé'); }
    }
    if (!sansAnnuler) BK.annuler.noter(col, fiche.id, 'ecrire', fiche);
    (BK.db.photo[col] = BK.db.photo[col] || {})[fiche.id] = JSON.stringify(fiche);
    fiche.maj = new Date().toISOString();
    fiche.par = BK.reglage('nomPc', '') || 'ce PC';
    (BK.db.cache[col] = BK.db.cache[col] || {})[fiche.id] = fiche;
    setTimeout(() => window.dispatchEvent(new CustomEvent('bk:change', { detail: { col, id: fiche.id } })), 0);   // les autres onglets se mettent à jour
    if (!BK.db.drive()) { BK.db.memoire(col, fiche); return fiche; }
    try { await BK.drive.ecrire(col, fiche); BK.db.enLigne = true; }
    catch (e) { BK.db.attendre({ col, fiche }); }                    // hors ligne : envoyé plus tard
    return fiche;
  },

  async supprimer(col, id, { sansAnnuler = false } = {}) {          // jamais effacé : rangé dans « corbeille »
    if (!sansAnnuler) BK.annuler.noter(col, id, 'supprimer');
    if (BK.db.photo[col]) delete BK.db.photo[col][id];
    if (BK.db.cache[col]) delete BK.db.cache[col][id];
    if (!BK.db.drive()) { BK.db.memoire(col, null, id); return; }
    try { await BK.drive.supprimer(col, id); } catch (e) { BK.db.attendre({ col, id, suppr: true }); }
  },

  // file d'attente hors ligne
  attendre(a) { const l = BK.reglage('db.attente', []); l.push(a); BK.regler('db.attente', l); BK.db.enLigne = false; BK.etatDrive && BK.etatDrive(); },
  async viderAttente() {
    const l = BK.reglage('db.attente', []); if (!l.length || !BK.db.drive()) return;
    const reste = [];
    for (const a of l) { try {
      if (a.suppr) { await BK.drive.supprimer(a.col, a.id); continue; }
      // PROTECTION : si quelqu'un a modifié cette fiche dans le Drive APRÈS nous, on ne l'écrase pas
      const dist = (await BK.drive.liste(a.col).catch(() => ({})))[a.fiche.id];
      if (dist && (dist.maj || '') > (a.fiche.maj || '')) continue;
      await BK.drive.ecrire(a.col, a.fiche); } catch (e) { reste.push(a); } }
    BK.regler('db.attente', reste); BK.db.enLigne = !reste.length;
  },

  // stockage sur ce PC (sans Drive)
  memoire(col, fiche, idSuppr) {
    const cle = 'db.' + col, tout = BK.reglage(cle, {});
    if (fiche) tout[fiche.id] = fiche;
    if (idSuppr) delete tout[idSuppr];
    if (fiche || idSuppr) BK.regler(cle, tout);
    return tout;
  },
};

// ---------- toutes les minutes : envoyer ce qui attend, relire le Drive, rafraîchir l'onglet ouvert ----------
// (le nom BK.synchro est pris par le veilleur de miette.js : ne pas le réutiliser ici)
BK.pousser = async function () {
  if (!BK.db.drive()) return;
  await BK.db.viderAttente();
  const ouvert = BK.reglage('dernierOnglet', 'accueil');
  const rafr = { accueil: BK.surOuvrir && BK.surOuvrir.accueil, biblio: BK.biblioRecharger, taches: BK.tachesRecharger, agenda: BK.agendaRecharger };
  try { rafr[ouvert] && await rafr[ouvert](); } catch (e) {}
  BK.etatDrive();
};

// ---------- enregistrer un fichier produit (ex. un WAV de reel) ----------
// Dans le .exe : rangé dans <Drive>/BEESKOT Studio/<sousDossier>/ (ou demandé si pas de Drive).
// Dans l'aperçu : téléchargé par le navigateur.
BK.enregistrerFichier = async function (sousDossier, nom, octets, type = 'application/octet-stream') {
  if (BK.estExe) {
    let base = BK.reglage('dossierExports', '');                  // choisi une fois, puis retenu
    if (!base || !(await BK.fichier.existe(base))) { base = await BK.fichier.choisirDossier('Dossier où ranger les fichiers créés par BEESKOT Studio'); if (!base) return null; BK.regler('dossierExports', base); }
    const dos = BK.chemin(base, 'BEESKOT Studio', sousDossier);
    await BK.fichier.creerDossier(dos);
    let p = BK.chemin(dos, nom), n = 2;
    while (await BK.fichier.existe(p)) p = BK.chemin(dos, nom.replace(/(\.\w+)$/, ` (${n++})$1`));   // ne jamais écraser
    await BK.fichier.ecrireOctets(p, octets);
    return p;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([octets], { type })); a.download = nom; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return nom;
};

// ---------- le bilan après un export : les fichiers écrits, « Ouvrir le dossier », « Upload Drive » ----------
// faits : [{ nom, p (chemin sur ce PC), octets, type }] ; drive : { role: 'photovideo'|'wavtournage'…, sous: ['Posts', nom], titre }
BK.montrerExports = function (el, faits, { drive, msg = () => {} } = {}) {
  if (!el) return;
  const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const vrais = faits.filter(f => f.p);
  el.classList.remove('hidden');
  const dos = vrais[0] && String(vrais[0].p).replace(/[\\/][^\\/]+$/, '');
  el.innerHTML = `<span class="lb">✓ ${vrais.length} fichier(s) écrit(s)</span>`
    + vrais.map(f => `<div class="re-fait">${esc(f.ic || '📄')} ${esc(f.nom)}</div>`).join('')
    + (faits.length > vrais.length ? `<span class="nt" style="color:#ff8a6a">${faits.length - vrais.length} fichier(s) n'ont pas pu être écrits</span>` : '')
    + (dos && BK.estExe ? `<span class="nt mono" style="white-space:normal">${esc(dos)}</span>` : '')
    + `<div class="chips" style="margin-top:6px">${dos && BK.estExe ? '<button class="btn xs" data-ex="ouvrir">📂 Ouvrir le dossier</button>' : ''}`
    + (drive && BK.drive && BK.drive.relie() && vrais.some(f => f.octets) ? '<button class="btn xs" data-ex="drive">⇪ Upload Drive</button>' : '') + '</div>';
  const bo = el.querySelector('[data-ex="ouvrir"]'); if (bo) bo.onclick = () => { try { BK.T.opener.openPath(dos); } catch (e) { msg('Dossier : ' + dos); } };
  const bd = el.querySelector('[data-ex="drive"]'); if (bd) bd.onclick = async () => {
    bd.disabled = true; bd.innerHTML = '<span class="spin"></span>Envoi…';
    try {
      await BK.dossiers.assurer();
      const dossierDe = async d => { const base = await BK.dossiers.get(d.role); if (!base) throw new Error('dossier « ' + d.role + ' » introuvable (Réglages › Vos dossiers du Drive)');
        let id = base.id; for (const n of (d.sous || [])) id = await BK.drive.dossier(String(n).replace(/[\\/]/g, '-'), id); return id; };
      let id = await dossierDe(drive), k = 0;
      for (const f of vrais.filter(f => f.octets)) { k++;
        const cible = f.drive ? await dossierDe(f.drive) : id;          // un fichier peut avoir sa propre destination (ex. le WAV tournage)
        await BK.drive.envoyerBlob(new Blob([f.octets], { type: f.type || 'application/octet-stream' }), f.nom, cible, p => msg(`Envoi ${k}/${vrais.length} · ${Math.round(p * 100)} %`)); }
      msg('Dans le Drive ✓'); BK.dossiers.oublier && BK.dossiers.oublier();
      bd.disabled = false; bd.textContent = '☁ Ouvrir le dossier du Drive'; bd.onclick = () => BK.ouvrirLien('https://drive.google.com/drive/folders/' + id);
      el.insertAdjacentHTML('beforeend', `<span class="nt">☁ ${vrais.length} fichier(s) → Drive${drive.titre ? ' (' + esc(drive.titre) + ')' : ''}</span>`);
    } catch (e) { bd.disabled = false; bd.textContent = '⇪ Upload Drive'; msg('Envoi impossible : ' + (e.message || e)); }
  };
};

// ---------- voyant et afficheur « Drive » du bandeau ----------
BK.etatDrive = function () {
  const ok = BK.drive && BK.drive.relie(), hl = ok && !BK.db.enLigne;
  $('#syDrive').textContent = !BK.estExe ? 'APERÇU' : !ok ? 'NON RELIÉ' : hl ? 'HORS LIGNE' : 'RELIÉ';
  const led = $('#ledDrive'); if (led) { led.className = 'led ' + (ok ? (hl ? 'amb' : 'grn') : ''); }
};

// ---------- les petites listes partagées (PLAN.xlsx, passages repérés sur Discord…) ----------
// Elles ne vivaient que sur le PC qui les avait faites. Maintenant elles sont aussi sur le Drive,
// donc visibles partout et rattrapables par la Time Machine.
BK.partage = {
  async lire(id, defaut) {
    const loc = BK.reglage('partage.' + id, undefined) ?? BK.reglage(id, defaut);
    if (!BK.db.drive()) return loc;
    try {
      const d = (await BK.db.liste('config')).find(x => x.id === 'partage-' + id);
      if (d && d.v !== undefined) { BK.regler('partage.' + id, d.v); return d.v; }
      if (loc !== undefined && JSON.stringify(loc) !== JSON.stringify(defaut)) await BK.partage.ecrire(id, loc);   // 1re fois : ce PC partage ce qu'il avait
    } catch (e) {}
    return loc ?? defaut;
  },
  async ecrire(id, v) {
    BK.regler('partage.' + id, v);
    if (BK.db.drive()) { try { await BK.db.ecrire('config', { id: 'partage-' + id, v }, { sansAnnuler: true }); } catch (e) {} }
  },
};

// ---------- les exports de l'Assistant Reels Audio ----------
// Avant, cette liste ne vivait que sur le PC qui avait fait l'export : les autres PC ne la voyaient
// pas, et la Time Machine ne pouvait pas la récupérer. Maintenant elle est aussi sur le Drive.
BK.exportsAudio = {
  local() { return BK.reglage('reels.exports', []); },
  async tous() {
    const loc = BK.exportsAudio.local();
    if (!BK.db.drive()) return loc;
    let dist = [];
    try { dist = await BK.db.liste('exportsaudio'); } catch (e) { return loc; }
    const connus = new Set(dist.map(x => x.id));
    for (const e of loc) if (!connus.has(e.id)) {                 // exports faits avant le partage : ils montent sur le Drive
      try { await BK.db.ecrire('exportsaudio', { ...e, pc: BK.reglage('nomPc', '') || 'ce PC' }, { sansAnnuler: true }); dist.push(e); } catch (er) {}
    }
    const par = {};
    for (const e of [...dist, ...loc]) if (e && e.id) par[e.id] = { ...(par[e.id] || {}), ...e };
    return Object.values(par).sort((a, b) => String(b.t || '').localeCompare(String(a.t || '')));
  },
  async ajouter(e) {
    BK.regler('reels.exports', [e, ...BK.exportsAudio.local().filter(x => x.id !== e.id)].slice(0, 30));
    if (BK.db.drive()) { try { await BK.db.ecrire('exportsaudio', { ...e, pc: BK.reglage('nomPc', '') || 'ce PC' }); } catch (er) {} }
  },
};

// ---------- les fiches de départ (créées une seule fois par PC, mêmes identifiants partout) ----------
BK.FICHES_DEPART = [
  { id: 'glamorous-sky',          nom: 'Glamorous Sky' },
  { id: 'mother',                 nom: 'Mother' },
  { id: 'one-point-perspective',  nom: 'One Point Perspective' },
  { id: 'moon-blue',              nom: 'Moon Blue' },
];
BK.semer = async function () {
  if (BK.reglage('seme.v1', false)) return;
  const deja = new Set((await BK.db.liste('morceaux')).map(m => m.id));
  for (const f of BK.FICHES_DEPART) if (!deja.has(f.id)) await BK.db.ecrire('morceaux', { ...f, statut: 'chantier', fait: 0, graine: true }, { graine: true, sansAnnuler: true });
  BK.regler('seme.v1', true);
};
// le budget de départ : le loyer du studio (chaque mois) et les factures déjà payées
// (créés une seule fois pour tout le groupe, grâce à des identifiants fixes)
BK.semerBudget = async function () {
  if (BK.reglage('budget.v1', false) || !BK.db.drive()) return;
  const tous = ['Yacine', 'Pierre', 'Baptiste'];
  const abos = await BK.db.liste('abonnements');
  if (!abos.some(a => a.id === 'loyer-studio'))
    await BK.db.ecrire('abonnements', { id: 'loyer-studio', titre: 'Loyer du studio', montant: 770.33, payePar: 'Baptiste', pour: tous,
      cat: 'Studio', jour: 28, depuis: new Date().toISOString().slice(0, 7), actif: true }, { sansAnnuler: true });
  const deps = await BK.db.liste('depenses');
  if (!deps.some(d => d.id === 'evan-king-1'))
    await BK.db.ecrire('depenses', { id: 'evan-king-1', titre: 'Mixage — Evan King (facture)', montant: 330.46, payePar: 'Yacine', pour: tous,
      date: new Date().toISOString().slice(0, 10), cat: 'Mixage / master' }, { sansAnnuler: true });
  BK.regler('budget.v1', true);
};
// les petits noms utilisés dans le Drive et sur Discord (OPP, GLAM…) : ajoutés une fois aux fiches
BK.ALIAS_DEPART = { 'glamorous-sky': ['GLAM', 'GLAMOROUSSKY'], 'one-point-perspective': ['OPP'], 'moon-blue': ['MOONBLUE'] };
BK.semerAlias = async function () {
  if (BK.reglage('alias.v1', false)) return;
  for (const m of await BK.db.liste('morceaux')) {
    const a = BK.ALIAS_DEPART[m.id]; if (!a) continue;
    const l = new Set((m.alias || []).map(x => x.toUpperCase())), manque = a.filter(x => !l.has(x));
    if (manque.length) { m.alias = [...(m.alias || []), ...manque]; await BK.db.ecrire('morceaux', m, { graine: !!m.graine, sansAnnuler: true }); }
  }
  BK.regler('alias.v1', true);
};

// ---------- ouvrir un lien (Drive…) dans le navigateur ----------
BK.ouvrirLien = url => { if (!/^https?:\/\//i.test(url)) return; BK.estExe ? BK.T.opener.openUrl(url) : window.open(url, '_blank'); };


// ---------- ANNULER : ce qu'on vient de faire (Ctrl+Z ou le bouton « ↶ Annuler » qui apparaît en bas) ----------
// On garde la fiche telle qu'elle était juste avant. Tout ce qu'un seul clic a changé s'annule d'un coup.
BK.annuler = {
  pile: [], geste: 0,
  PAS: new Set(['veille', 'renforts']),                                      // le journal automatique : pas besoin
  CONFIG_OK: new Set(['etiquettes', 'membres']),
  NOMS: { depenses: 'la dépense', abonnements: 'la dépense mensuelle', morceaux: 'la fiche du morceau', taches: 'la tâche', evenements: 'le rendez-vous', tournages: 'la fiche tournage', inventaires: 'l\'inventaire', propositions: 'la proposition', config: 'le réglage' },
  noter(col, id, quoi, fiche) {
    if (BK.annuler.PAS.has(col) || (col === 'config' && !BK.annuler.CONFIG_OK.has(id))) return;
    if (Date.now() - BK.annuler.geste > 15000) return;                       // pas un geste de quelqu'un (travail en fond)
    const avant = (BK.db.photo[col] || {})[id] ?? null, p = BK.annuler.pile, der = p[p.length - 1];
    const net = j => { if (!j) return j; const o = typeof j === 'string' ? JSON.parse(j) : { ...j }; delete o.maj; delete o.par; return JSON.stringify(o); };
    if (fiche && avant && net(avant) === net(fiche)) return;                 // rien n'a vraiment changé
    const g = der && der.geste === BK.annuler.geste ? der : (p.push({ t: 0, geste: BK.annuler.geste, l: [] }), p[p.length - 1]);   // un clic = un seul « annuler »
    g.t = Date.now(); if (!g.l.some(x => x.col === col && x.id === id)) g.l.push({ col, id, avant, quoi });
    if (p.length > 30) p.shift();
    BK.annuler.montrer(g);
  },
  montrer(g) {
    let b = document.getElementById('bkAnnuler');
    if (!b) { b = document.createElement('div'); b.id = 'bkAnnuler'; b.className = 'bk-annuler'; document.body.appendChild(b);
      b.onclick = e => { if (e.target.closest('button')) BK.annuler.faire(); }; }
    const x = g.l[0], txt = (x.quoi === 'supprimer' ? 'Retiré : ' : x.avant ? 'Modifié : ' : 'Créé : ') + (BK.annuler.NOMS[x.col] || x.col) + (g.l.length > 1 ? ` (+${g.l.length - 1})` : '');
    b.innerHTML = `<span>${txt}</span><button class="btn xs">↶ Annuler</button><span class="nt">Ctrl+Z</span>`;
    b.classList.add('on'); clearTimeout(BK.annuler.min); BK.annuler.min = setTimeout(() => b.classList.remove('on'), 9000);
  },
  async faire() {
    const g = BK.annuler.pile.pop(), b = document.getElementById('bkAnnuler');
    if (!g) { if (b) { b.innerHTML = '<span>Rien à annuler</span>'; b.classList.add('on'); clearTimeout(BK.annuler.min); BK.annuler.min = setTimeout(() => b.classList.remove('on'), 2500); } return; }
    for (const x of g.l.reverse()) {
      if (x.avant) await BK.db.ecrire(x.col, JSON.parse(x.avant), { sansAnnuler: true });
      else await BK.db.supprimer(x.col, x.id, { sansAnnuler: true });
    }
    if (b) { b.innerHTML = '<span>↶ Annulé</span>'; b.classList.add('on'); clearTimeout(BK.annuler.min); BK.annuler.min = setTimeout(() => b.classList.remove('on'), 2500); }
    window.dispatchEvent(new CustomEvent('bk:annule', { detail: g }));
  },
};
['pointerdown', 'keydown'].forEach(t => window.addEventListener(t, e => { if (e.isTrusted) BK.annuler.geste = Date.now(); }, true));
window.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z' || e.shiftKey) return;
  const a = document.activeElement; if (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return;   // dans un champ : le Ctrl+Z normal du texte
  e.preventDefault(); BK.annuler.faire();
});
