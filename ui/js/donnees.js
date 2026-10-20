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
BK.db = {
  cache: {},                                   // { morceaux: {id: fiche}, ... }
  racine() { const d = BK.reglage('drive', ''); return d ? BK.chemin(d, BK.SOUS_DOSSIER) : ''; },
  pret() { return !BK.estExe || !!BK.db.racine(); },
  nouvelId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); },

  async liste(col) {
    if (!BK.estExe || !BK.db.racine()) return Object.values(BK.db.memoire(col));
    const dos = BK.chemin(BK.db.racine(), col), out = {};
    for (const e of await BK.fichier.liste(dos)) {
      if (!e.name || !e.name.endsWith('.json')) continue;
      try { const f = JSON.parse(await BK.fichier.lireTexte(BK.chemin(dos, e.name))); out[f.id] = f; } catch (er) { /* fichier en cours de synchro : on l'ignore */ }
    }
    BK.db.cache[col] = out;
    return Object.values(out);
  },

  async ecrire(col, fiche) {
    fiche.id = fiche.id || BK.db.nouvelId();
    fiche.maj = new Date().toISOString();
    fiche.par = BK.reglage('nomPc', '') || 'ce PC';
    (BK.db.cache[col] = BK.db.cache[col] || {})[fiche.id] = fiche;
    if (!BK.estExe || !BK.db.racine()) { BK.db.memoire(col, fiche); return fiche; }
    const dos = BK.chemin(BK.db.racine(), col);
    await BK.fichier.creerDossier(dos);
    const p = BK.chemin(dos, fiche.id + '.json');
    await BK.fichier.ecrireTexte(p + '.tmp', JSON.stringify(fiche, null, 1));   // écrit à côté, puis remplace : jamais de fichier à moitié écrit
    await BK.fichier.deplacer(p + '.tmp', p);
    return fiche;
  },

  async supprimer(col, id) {                   // jamais effacé : rangé dans « corbeille »
    if (BK.db.cache[col]) delete BK.db.cache[col][id];
    if (!BK.estExe || !BK.db.racine()) { BK.db.memoire(col, null, id); return; }
    const src = BK.chemin(BK.db.racine(), col, id + '.json'), dos = BK.chemin(BK.db.racine(), 'corbeille', col);
    await BK.fichier.creerDossier(dos);
    await BK.fichier.deplacer(src, BK.chemin(dos, id + '_' + Date.now() + '.json'));
  },

  // mode aperçu (navigateur) : stockage local
  memoire(col, fiche, idSuppr) {
    const cle = 'db.' + col, tout = BK.reglage(cle, {});
    if (fiche) tout[fiche.id] = fiche;
    if (idSuppr) delete tout[idSuppr];
    if (fiche || idSuppr) BK.regler(cle, tout);
    return tout;
  },
};

// ---------- enregistrer un fichier produit (ex. un WAV de reel) ----------
// Dans le .exe : rangé dans <Drive>/BEESKOT Studio/<sousDossier>/ (ou demandé si pas de Drive).
// Dans l'aperçu : téléchargé par le navigateur.
BK.enregistrerFichier = async function (sousDossier, nom, octets, type = 'application/octet-stream') {
  if (BK.estExe) {
    let dos = BK.db.racine() ? BK.chemin(BK.db.racine(), sousDossier) : await BK.fichier.choisirDossier('Où ranger ' + nom + ' ?');
    if (!dos) return null;
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
  const ok = BK.estExe && !!BK.reglage('drive', '');
  $('#syDrive').textContent = ok ? 'RELIÉ' : BK.estExe ? 'NON RELIÉ' : 'APERÇU';
  const led = $('#ledDrive'); if (led) { led.classList.toggle('grn', ok); }
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

// ---------- ouvrir un lien (Drive…) dans le navigateur ----------
BK.ouvrirLien = url => { if (!/^https?:\/\//i.test(url)) return; BK.estExe ? BK.T.opener.openUrl(url) : window.open(url, '_blank'); };
