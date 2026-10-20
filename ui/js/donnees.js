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
  async creerDossier(p)     { if (!(await BK.fichier.existe(p))) await BK.T.fs.mkdir(p, { recursive: true }); },
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
      BK.db.cache[col] = out; BK.db.enLigne = true;
    } catch (e) {
      BK.db.enLigne = false;                                         // hors ligne : dernière copie connue
      const c = BK.reglage('drive.cache.' + col, {}), out = {};
      for (const x of Object.values(c)) out[x.fiche.id] = x.fiche;
      for (const a of BK.reglage('db.attente', [])) if (a.col === col) { if (a.suppr) delete out[a.id]; else out[a.fiche.id] = a.fiche; }
      BK.db.cache[col] = out;
    }
    BK.etatDrive && BK.etatDrive();
    return Object.values(BK.db.cache[col]);
  },

  async ecrire(col, fiche) {
    fiche.id = fiche.id || BK.db.nouvelId();
    fiche.maj = new Date().toISOString();
    fiche.par = BK.reglage('nomPc', '') || 'ce PC';
    (BK.db.cache[col] = BK.db.cache[col] || {})[fiche.id] = fiche;
    setTimeout(() => window.dispatchEvent(new CustomEvent('bk:change', { detail: { col, id: fiche.id } })), 0);   // les autres onglets se mettent à jour
    if (!BK.db.drive()) { BK.db.memoire(col, fiche); return fiche; }
    try { await BK.drive.ecrire(col, fiche); BK.db.enLigne = true; }
    catch (e) { BK.db.attendre({ col, fiche }); }                    // hors ligne : envoyé plus tard
    return fiche;
  },

  async supprimer(col, id) {                                        // jamais effacé : rangé dans « corbeille »
    if (BK.db.cache[col]) delete BK.db.cache[col][id];
    if (!BK.db.drive()) { BK.db.memoire(col, null, id); return; }
    try { await BK.drive.supprimer(col, id); } catch (e) { BK.db.attendre({ col, id, suppr: true }); }
  },

  // file d'attente hors ligne
  attendre(a) { const l = BK.reglage('db.attente', []); l.push(a); BK.regler('db.attente', l); BK.db.enLigne = false; BK.etatDrive && BK.etatDrive(); },
  async viderAttente() {
    const l = BK.reglage('db.attente', []); if (!l.length || !BK.db.drive()) return;
    const reste = [];
    for (const a of l) { try { a.suppr ? await BK.drive.supprimer(a.col, a.id) : await BK.drive.ecrire(a.col, a.fiche); } catch (e) { reste.push(a); } }
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
BK.synchro = async function () {
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

// ---------- voyant et afficheur « Drive » du bandeau ----------
BK.etatDrive = function () {
  const ok = BK.drive && BK.drive.relie(), hl = ok && !BK.db.enLigne;
  $('#syDrive').textContent = !BK.estExe ? 'APERÇU' : !ok ? 'NON RELIÉ' : hl ? 'HORS LIGNE' : 'RELIÉ';
  const led = $('#ledDrive'); if (led) { led.className = 'led ' + (ok ? (hl ? 'amb' : 'grn') : ''); }
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
  for (const f of BK.FICHES_DEPART) if (!deja.has(f.id)) await BK.db.ecrire('morceaux', { ...f, statut: 'chantier', fait: 0 });
  BK.regler('seme.v1', true);
};
// les petits noms utilisés dans le Drive et sur Discord (OPP, GLAM…) : ajoutés une fois aux fiches
BK.ALIAS_DEPART = { 'glamorous-sky': ['GLAM', 'GLAMOROUSSKY'], 'one-point-perspective': ['OPP'], 'moon-blue': ['MOONBLUE'] };
BK.semerAlias = async function () {
  if (BK.reglage('alias.v1', false)) return;
  for (const m of await BK.db.liste('morceaux')) {
    const a = BK.ALIAS_DEPART[m.id]; if (!a) continue;
    const l = new Set((m.alias || []).map(x => x.toUpperCase())), manque = a.filter(x => !l.has(x));
    if (manque.length) { m.alias = [...(m.alias || []), ...manque]; await BK.db.ecrire('morceaux', m); }
  }
  BK.regler('alias.v1', true);
};

// ---------- ouvrir un lien (Drive…) dans le navigateur ----------
BK.ouvrirLien = url => { if (!/^https?:\/\//i.test(url)) return; BK.estExe ? BK.T.opener.openUrl(url) : window.open(url, '_blank'); };
