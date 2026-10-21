// =====================================================================
// VOS DOSSIERS DU DRIVE — le logiciel trouve tout seul les dossiers du
// groupe (Recording, Ableton Project, CL, Photo Vidéo, Light Show…) et
// chaque onglet les lit. Rien n'est jamais déplacé ni renommé : on LIT.
// Le choix est rangé dans le Drive (config « dossiers ») : tous les PC l'ont.
// =====================================================================
BK.dossiers = {
  // rôle → comment le reconnaître (nom du dossier, et si possible son parent)
  ROLES: [
    { id: 'organisation', nom: 'Organisation',            test: /organisation/i },
    { id: 'recording',    nom: 'Recording',               test: /recording/i },
    { id: 'ableton',      nom: 'Projets Ableton',         test: /ableton/i,           parent: 'recording' },
    { id: 'cl',           nom: 'Exports clean (CL)',      test: /^cl$|clean/i,        parent: 'recording' },
    { id: 'photovideo',   nom: 'Photos / Vidéos',         test: /photos?\s*\/?\s*vid|vid[ée]os?\s*\/?\s*photo/i },
    { id: 'moodboard',    nom: 'Moodboards',              test: /mood/i,              parent: 'photovideo' },
    { id: 'tournage',     nom: 'Tournages',               test: /^tournages?$/i,      parent: 'photovideo' },
    { id: 'outfits',      nom: 'Outfits',                 test: /outfit|tenue/i,      parent: 'tournage' },
    { id: 'wavtournage',  nom: 'WAV de tournage',         test: /wav.*tournage/i,     parent: 'tournage' },
    { id: 'scenographie', nom: 'Scénographie',            test: /sc[ée]no/i },
    { id: 'lightshow',    nom: 'Light Show',              test: /light ?show/i },
    { id: 'setlist',      nom: 'Setlist',                 test: /setlist/i },
  ],
  // « 2) 🎸RECORDING » → « Recording » (pour l'affichage)
  joli: n => String(n || '').replace(/^\s*\d+\)\s*/, '').replace(/^[^\p{L}\p{N}]+/u, '').trim(),
  FOLDER: 'application/vnd.google-apps.folder',
  conf: null,

  async config() {
    if (BK.dossiers.conf) return BK.dossiers.conf;
    return BK.dossiers.conf = (await BK.db.liste('config')).find(x => x.id === 'dossiers') || { id: 'dossiers', roles: {} };
  },
  async get(role) { const c = await BK.dossiers.config(); return c.roles[role] || null; },
  async regler(role, d) { const c = await BK.dossiers.config(); c.roles[role] = d; c.detecte = c.detecte || Date.now(); await BK.db.ecrire('config', c); },

  // ---------- petits outils Drive ----------
  async enfants(id, seulementDossiers = false) {
    let out = [], page = '';
    do {
      const r = await (await BK.drive.api('/files?' + new URLSearchParams({ q: `${BK.drive.q(id)} in parents and trashed=false${seulementDossiers ? ` and mimeType='${BK.dossiers.FOLDER}'` : ''}`,
        fields: 'nextPageToken,files(id,name,mimeType,thumbnailLink,webViewLink,size,modifiedTime,parents,videoMediaMetadata(durationMillis))', orderBy: 'folder,name', pageSize: '300', pageToken: page }))).json();
      out.push(...(r.files || [])); page = r.nextPageToken || '';
    } while (page);
    return out;
  },
  noms: {},
  async chemin(id) {                                     // « Recording / Ableton Project »
    const parts = []; let cur = id;
    for (let i = 0; i < 8 && cur; i++) {
      let f = BK.dossiers.noms[cur];
      if (!f) { try { f = await (await BK.drive.api(`/files/${cur}?fields=id,name,parents`)).json(); } catch (e) { break; } BK.dossiers.noms[cur] = f; }
      if (!f.parents) break;                              // la racine « Mon Drive »
      parts.unshift(f.name); cur = f.parents[0];
    }
    return parts.join(' / ');
  },

  // ---------- trouver tout seul ----------
  async detecter(progression = () => {}) {
    progression('Recherche des dossiers du groupe…');
    let tous = [], page = '';
    do {
      const r = await (await BK.drive.api('/files?' + new URLSearchParams({ q: `mimeType='${BK.dossiers.FOLDER}' and trashed=false`, fields: 'nextPageToken,files(id,name,parents)', pageSize: '1000', pageToken: page }))).json();
      tous.push(...(r.files || [])); page = r.nextPageToken || '';
    } while (page && tous.length < 5000);
    tous = tous.filter(f => !/^BEESKOT Studio$|^corbeille$/i.test(f.name));
    const c = await BK.dossiers.config(), trouves = {};
    for (const r of BK.dossiers.ROLES) {
      if (c.roles[r.id] && c.roles[r.id].manuel) { trouves[r.id] = c.roles[r.id]; continue; }   // choisi à la main : on n'y touche pas
      let cands = tous.filter(f => r.test.test(f.name.trim()));
      const p = r.parent && trouves[r.parent];
      if (p) { const sous = cands.filter(f => (f.parents || []).includes(p.id)); if (sous.length) cands = sous; }
      cands.sort((a, b) => a.name.length - b.name.length);
      if (cands[0]) trouves[r.id] = { id: cands[0].id, nom: cands[0].name, chemin: await BK.dossiers.chemin(cands[0].id) };
    }
    c.roles = trouves; c.detecte = Date.now(); BK.dossiers.conf = c;
    await BK.db.ecrire('config', c);
    return trouves;
  },
  async assurer() {                                      // détection automatique la 1re fois
    if (!BK.drive.relie()) return null;
    const c = await BK.dossiers.config();
    if (!c.detecte) { try { await BK.dossiers.detecter(); } catch (e) { console.warn(e); } }
    return BK.dossiers.conf;
  },

  // ---------- le plan du Drive (seulement les NOMS des dossiers) ----------
  async plan(profondeur = 4) {
    const lignes = ['Mon Drive (BEESKOT)'];
    async function descendre(id, niveau) {
      if (niveau > profondeur) return;
      const ds = (await BK.dossiers.enfants(id, true)).filter(f => !/^corbeille$/i.test(f.name));
      for (const d of ds) { lignes.push('  '.repeat(niveau) + '└ ' + d.name); if (lignes.length < 400) await descendre(d.id, niveau + 1); }
    }
    await descendre('root', 1);
    return lignes.join('\n');
  },

  // ---------- la carte de TOUS les dossiers (1 seule lecture, gardée 10 min) ----------
  _carte: null,
  async carte() {
    if (BK.dossiers._carte && Date.now() - BK.dossiers._carte.t < 10 * 60e3) return BK.dossiers._carte.m;
    const m = {}; let page = '';
    do {
      const r = await (await BK.drive.api('/files?' + new URLSearchParams({ q: `mimeType='${BK.dossiers.FOLDER}' and trashed=false`, fields: 'nextPageToken,files(id,name,parents)', pageSize: '1000', pageToken: page }))).json();
      for (const f of r.files || []) m[f.id] = { name: f.name, parent: (f.parents || [])[0] || null }; page = r.nextPageToken || '';
    } while (page);
    BK.dossiers._carte = { t: Date.now(), m };
    return m;
  },
  ancetres(id, carte) { const l = []; for (let i = 0; i < 12 && id && carte[id]; i++) { l.push(id); id = carte[id].parent; } return l; },   // du plus proche au plus loin
  async roleDe(parentId, carte) {                       // dans quel dossier du groupe ce fichier se trouve
    const c = await BK.dossiers.config(), ids = Object.fromEntries(Object.entries(c.roles).map(([k, v]) => [v.id, k]));
    for (const a of BK.dossiers.ancetres(parentId, carte)) if (ids[a]) return ids[a];
    return '';
  },

  // ---------- tout ce qui concerne un morceau dans le Drive : par son NOM, son DOSSIER, ou son ÉTIQUETTE ----------
  CHAMPS: 'id,name,mimeType,thumbnailLink,webViewLink,size,modifiedTime,parents,videoMediaMetadata(durationMillis)',
  // TOUS les fichiers du Drive (sauf dossiers), lus une fois par pages de 1000 et gardés 10 min :
  // ensuite on trie ici, sans dépendre de la recherche de Google (qui rate des noms comme « GLAMOROUSSKY_… »)
  _tous: null, _tousEnCours: null,
  async tousFichiers() {
    if (BK.dossiers._tous && Date.now() - BK.dossiers._tous.t < 10 * 60e3) return BK.dossiers._tous.l;
    if (BK.dossiers._tousEnCours) return BK.dossiers._tousEnCours;
    BK.dossiers._tousEnCours = (async () => {
      const l = []; let page = '', n = 0;
      do {
        const r = await (await BK.drive.api('/files?' + new URLSearchParams({ q: `mimeType!='${BK.dossiers.FOLDER}' and trashed=false`, fields: 'nextPageToken,files(' + BK.dossiers.CHAMPS + ')', pageSize: '1000', pageToken: page }))).json();
        l.push(...(r.files || [])); page = r.nextPageToken || ''; n++;
        if (n % 3 === 0) await BK.audio.pause();
      } while (page && n < 40);
      BK.dossiers._tous = { t: Date.now(), l }; BK.dossiers._tousEnCours = null;
      return l;
    })();
    try { return await BK.dossiers._tousEnCours; } catch (e) { BK.dossiers._tousEnCours = null; throw e; }
  },
  oublier() { BK.dossiers._tous = null; BK.dossiers._carte = null; BK.dossiers.index = {}; },
  async duMorceau(m, morceaux) {
    const [carte, tous, tags] = await Promise.all([BK.dossiers.carte(), BK.dossiers.tousFichiers(), BK.etiquettes.tous()]);
    const estM = n => (BK.inv.trouverMorceau(n, morceaux) || {}).id === m.id;
    const exclus = new Set(Object.keys(carte).filter(id => /^BEESKOT Studio$|^corbeille$/i.test(carte[id].name)));
    const c = await BK.dossiers.config(), roleIds = Object.fromEntries(Object.entries(c.roles).map(([k, v]) => [v.id, k]));
    const memoD = {};
    const dossierDuMorceau = pid => memoD[pid] ?? (memoD[pid] = BK.dossiers.ancetres(pid, carte).some(a => estM(carte[a].name)));
    const out = [];
    for (const f of tous) {
      if (/\.json$/i.test(f.name)) continue;
      const p = (f.parents || [])[0], anc = p ? BK.dossiers.ancetres(p, carte) : [];
      if (anc.some(a => exclus.has(a))) continue;
      const tl = BK.etiquettes.liste(tags, f.id), sm = tl.filter(BK.etiquettes.estMorceau);
      const ok = sm.length ? sm.includes(m.id) : tl.includes('-') ? false : (estM(f.name) || (p && dossierDuMorceau(p)));
      if (!ok) continue;
      out.push({ ...f, dossiers: anc.slice().reverse().map(id => carte[id].name), role: (anc.map(a => roleIds[a]).find(Boolean)) || '' });
    }
    return out.sort((a, b) => (b.modifiedTime || '').localeCompare(a.modifiedTime || ''));
  },

  // ---------- tous les fichiers sous un dossier (quelques niveaux), pour la Bibliothèque ----------
  index: {},
  async fichiersSous(role, profondeur = 3) {
    const d = await BK.dossiers.get(role); if (!d) return [];
    const memo = BK.dossiers.index[role]; if (memo && Date.now() - memo.t < 10 * 60e3) return memo.l;
    const out = [];
    async function descendre(id, chemin, niveau) {
      for (const f of await BK.dossiers.enfants(id)) {
        if (f.mimeType === BK.dossiers.FOLDER) { if (niveau < profondeur) await descendre(f.id, [...chemin, f.name], niveau + 1); }
        else out.push({ ...f, dossiers: chemin });
      }
    }
    await descendre(d.id, [], 1);
    BK.dossiers.index[role] = { t: Date.now(), l: out };
    return out;
  },
};

// =====================================================================
// PETIT EXPLORATEUR DU DRIVE (fenêtre) — choisir un dossier, ou des images
//   BK.explorerDrive({ titre, mode: 'dossier' | 'images', depart }) → Promise
// =====================================================================
BK.explorerDrive = function ({ titre = 'Choisir dans le Drive', mode = 'dossier', depart = null } = {}) {
  return new Promise(fin => {
    const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const v = document.createElement('div'); v.className = 'voile ex-voile';
    v.innerHTML = `<div class="ex-box"><span class="screw tl" style="--r:60deg"></span><span class="screw tr" style="--r:5deg"></span>
      <div class="ex-tete"><span class="lb">${esc(titre)}</span><button class="btn xs" data-ex="x">✕</button></div>
      <div class="ex-fil" id="exFil"></div><div class="ex-liste" id="exListe"></div>
      <div class="ex-pied"><span class="nt" id="exInfo"></span><button class="btn" data-ex="annuler">Annuler</button><button class="btn pri" data-ex="ok">${mode === 'dossier' ? 'Choisir ce dossier' : mode === 'audio' || mode === 'video' ? 'Choisir ce fichier' : mode === 'image' ? 'Choisir cette image' : 'Ajouter les images'}</button></div></div>`;
    document.body.appendChild(v);
    let pile = [{ id: 'root', nom: 'Mon Drive' }], choisis = new Set(), fichiers = [];
    const fermer = r => { v.remove(); fin(r); };
    v.addEventListener('click', e => { const a = e.target.closest('[data-ex]'); if (!a) return;
      if (a.dataset.ex === 'x' || a.dataset.ex === 'annuler') fermer(null);
      if (a.dataset.ex === 'ok') { const cur = pile[pile.length - 1];
        if (mode === 'dossier') { if (cur.id === 'root') return; fermer({ id: cur.id, nom: cur.nom, chemin: pile.slice(1).map(p => p.nom).join(' / '), manuel: true }); }
        else fermer(fichiers.filter(f => choisis.has(f.id))); } });
    async function aller() {
      const cur = pile[pile.length - 1];
      $('#exFil', v).innerHTML = pile.map((p, i) => `<button class="ex-miette" data-i="${i}">${esc(p.nom)}</button>`).join('<span>›</span>');
      $$('.ex-miette', v).forEach(b => b.onclick = () => { pile = pile.slice(0, +b.dataset.i + 1); aller(); });
      $('#exListe', v).innerHTML = '<span class="nt"><span class="spin"></span>Lecture…</span>';
      try {
        const l = await BK.dossiers.enfants(cur.id, mode === 'dossier');
        const ds = l.filter(f => f.mimeType === BK.dossiers.FOLDER); fichiers = l.filter(f => mode === 'audio' ? /^audio\//.test(f.mimeType) || /\.(wav|mp3|aiff?|flac|m4a)$/i.test(f.name) : mode === 'video' ? /^video\//.test(f.mimeType) || /\.(mp4|mov|m4v|webm)$/i.test(f.name) : /^image\//.test(f.mimeType));
        $('#exListe', v).innerHTML = ds.map(d => `<button class="ex-dos" data-id="${d.id}" data-nom="${esc(d.name)}">📁 ${esc(d.name)}</button>`).join('')
          + (/^images?$/.test(mode) ? fichiers.map(f => `<button class="ex-img${choisis.has(f.id) ? ' on' : ''}" data-f="${f.id}" title="${esc(f.name)}"><span class="spin"></span></button>`).join('') : '')
          + (mode === 'audio' || mode === 'video' ? fichiers.map(f => `<button class="ex-dos ex-son${choisis.has(f.id) ? ' on' : ''}" data-f="${f.id}" title="${esc(f.name)}">${mode === 'video' ? '🎬' : '♪'} ${esc(f.name)}${f.size ? ' · ' + Math.round(f.size / 1e6) + ' Mo' : ''}</button>`).join('') : '')
          + (!ds.length && (mode === 'dossier' || !fichiers.length) ? '<span class="nt">Rien ici.</span>' : '');
        $$('.ex-dos', v).forEach(b => b.onclick = () => { pile.push({ id: b.dataset.id, nom: b.dataset.nom }); aller(); });
        $$('.ex-img,.ex-son', v).forEach(b => b.onclick = () => {
          if (mode !== 'images') { choisis.clear(); $$('.ex-img,.ex-son', v).forEach(x => x.classList.remove('on')); }
          choisis.has(b.dataset.f) ? choisis.delete(b.dataset.f) : choisis.add(b.dataset.f); b.classList.toggle('on', choisis.has(b.dataset.f));
          $('#exInfo', v).textContent = mode === 'images' ? choisis.size + ' image(s) choisie(s)' : (fichiers.find(f => choisis.has(f.id)) || {}).name || ''; });
        $('#exInfo', v).textContent = mode === 'dossier' ? (cur.id === 'root' ? 'Ouvre un dossier, puis « Choisir ce dossier ».' : cur.nom) : mode === 'images' ? choisis.size + ' image(s) choisie(s)' : '';
        for (const f of fichiers) { if (!/^images?$/.test(mode)) break; const u = await BK.drive.vignette(f), b = $(`.ex-img[data-f="${f.id}"]`, v); if (b) { b.innerHTML = ''; if (u) b.style.backgroundImage = `url(${u})`; } }
      } catch (e) { $('#exListe', v).innerHTML = '<span class="nt">Drive injoignable pour l\'instant.</span>'; }
    }
    (async () => { if (depart) { const d = typeof depart === 'string' ? await BK.dossiers.get(depart) : depart;
      if (d) { const ch = (d.chemin || d.nom).split(' / '); pile.push({ id: d.id, nom: ch[ch.length - 1] }); } } aller(); })();
  });
};

// =====================================================================
// ÉTIQUETTES — « ce fichier du Drive concerne Glamorous Sky ».
// Automatique quand le nom parle du morceau (Glam, Opp…), sinon choisie à la
// main. Rangé dans le Drive (config « etiquettes ») : tout le groupe les voit.
// Les fichiers eux-mêmes ne sont jamais touchés.
// =====================================================================
BK.etiquettes = {
  doc: null,
  async charger() { if (!BK.etiquettes.doc) BK.etiquettes.doc = (await BK.db.liste('config')).find(x => x.id === 'etiquettes') || { id: 'etiquettes', map: {} }; return BK.etiquettes.doc; },
  async tous() { return (await BK.etiquettes.charger()).map; },
  // un média Discord rangé dans le Drive : on se souvient de sa copie, pour afficher ses étiquettes dans la vue Discord
  async noterCopie(dcId, driveId) { const d = await BK.etiquettes.charger(); d.copies = d.copies || {}; d.copies[dcId] = driveId; BK.etiquettes.envoyer(); },
  // l'étiquette s'affiche TOUT DE SUITE ; l'envoi au Drive part derrière, groupé (10 photos = 1 envoi).
  // Drive injoignable : rien à faire, l'envoi attend dans la file et repart tout seul quand le Drive revient (aucun message).
  _min: null,
  envoyer() { const d = BK.etiquettes.doc; clearTimeout(BK.etiquettes._min);
    BK.etiquettes._min = setTimeout(() => { BK.etiquettes._min = null; if (d) BK.db.ecrire('config', d).catch(() => {}); }, 400); },
  copieDe(dcId) { return ((BK.etiquettes.doc || {}).copies || {})[dcId] || null; },
  // un fichier peut avoir PLUSIEURS étiquettes : des morceaux (leur id) et des rubriques (« c:tournage », « t:<fiche tournage> », « c:lumiere »…)
  // '-' = « aucun morceau » (on ne devine plus par le nom)
  liste(tags, id) { const t = tags[id]; return !t ? [] : Array.isArray(t) ? t : [t]; },
  estMorceau: k => k && k !== '-' && !/^[a-z]:/.test(k),
  async mettre(fileId, morceauId) {                      // '' = enlever les étiquettes de morceau ; '-' = « aucun morceau »
    const d = await BK.etiquettes.charger(), autres = BK.etiquettes.liste(d.map, fileId).filter(k => /^[a-z]:/.test(k));
    const l = morceauId ? [morceauId, ...autres] : autres;
    if (l.length) d.map[fileId] = l; else delete d.map[fileId];
    BK.etiquettes.envoyer();
  },
  async basculer(fileId, cle, forcer) {                  // ajoute (ou retire) une étiquette, sans toucher aux autres
    const d = await BK.etiquettes.charger(); let l = BK.etiquettes.liste(d.map, fileId).filter(k => k !== '-');
    const a = forcer ?? !l.includes(cle); l = l.filter(k => k !== cle); if (a) l.push(cle);
    if (l.length) d.map[fileId] = l; else delete d.map[fileId];
    BK.etiquettes.envoyer(); return a;
  },
  // les morceaux d'un fichier : à la main d'abord, sinon devinés (nom du fichier, puis dossiers)
  morceauxDe(f, morceaux, tags) {
    const l = BK.etiquettes.liste(tags, f.id), sm = l.filter(BK.etiquettes.estMorceau);
    if (sm.length) return sm.map(id => morceaux.find(m => m.id === id)).filter(Boolean);
    if (l.includes('-')) return [];
    const g = BK.inv.trouverMorceau(f.name, morceaux) || (f.dossiers || []).map(d => BK.inv.trouverMorceau(d, morceaux)).find(Boolean);
    return g ? [g] : [];
  },
  de(f, morceaux, tags) { return BK.etiquettes.morceauxDe(f, morceaux, tags)[0] || null; },
};

(() => {
// les STEMS (pistes séparées : perc, drums, bass, vox…) ne sont pas des exports : on les regroupe en une ligne par dossier
const AUDIO = /\.(wav|mp3|aiff?|flac|m4a|ogg)$/i;
const MOT_EXPORT = /(master|mix|final|bounce|instru|full|(^|[_\s.-])cl([_\s.-]|$))/i;
const MOT_STEM = /(^|[_\s.-])(perc|percs|perk|drums?|kick|snare|hh|hats?|hihat|bass|basse|gtr|guit|guitars?|guitare|synths?|keys|piano|pad|vox|voix|voice|vocals?|lead|backs?|ch(oe|œ)urs?|choir|brass|cuivres?|fx|sfx|sim|write|clap|toms?|oh|overheads?|room|sub|arp|strings?|cordes|congas?|shaker|tamb)([_\s.-]|\d|$)/i;
BK.trierStems = function (l) {
  const parDossier = {};
  for (const f of l) if (AUDIO.test(f.name)) { const p = (f.parents || [])[0]; parDossier[p] = (parDossier[p] || 0) + 1; }
  const garde = [], stems = {};
  for (const f of l) {
    if (/\.(asd|ini|ds_store|tmp)$/i.test(f.name)) continue;                 // fichiers techniques d'Ableton / Windows
    const n = f.name.replace(/\.[^.]+$/, ''), p = (f.parents || [])[0];
    const stem = AUDIO.test(f.name) && !MOT_EXPORT.test(n) && (MOT_STEM.test(n) || parDossier[p] >= 6);
    if (!stem) { garde.push(f); continue; }
    (stems[p] = stems[p] || { groupe: true, id: p, n: 0, dossiers: f.dossiers, name: (f.dossiers || []).slice(-1)[0] || 'Stems', modifiedTime: f.modifiedTime }).n++;
  }
  return [...garde, ...Object.values(stems)];
};
})();

// petite galerie des médias du Drive (vidéos ou photos), les plus récents d'abord — à poser dans une zone vide
BK.galerieDrive = async function (el, { type = 'video', choisir, source = null, titre = '' }) {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  if (!BK.drive.relie()) { el.innerHTML = '<span class="nt">Relie le Drive (Réglages) pour voir ses ' + (type === 'video' ? 'vidéos' : 'photos') + ' ici.</span>'; return; }
  el.innerHTML = '<span class="nt">Recherche dans le Drive…</span>';
  let tout = [];
  try {
    await BK.dossiers.assurer();
    const [l, carte] = await Promise.all([source ? source() : BK.dossiers.tousFichiers(), BK.dossiers.carte()]);
    const bon = type === 'video' ? f => /^video\//.test(f.mimeType || '') : f => /^image\/(jpe?g|png|webp|heic)/.test(f.mimeType || '');
    tout = l.filter(bon).map(f => ({ ...f, ou: BK.dossiers.ancetres((f.parents || [])[0], carte).reverse().map(a => BK.dossiers.joli(carte[a].name)).slice(-2).join(' / ') }))
      .sort((a, b) => (b.modifiedTime || '').localeCompare(a.modifiedTime || ''));
  } catch (e) { el.innerHTML = '<span class="nt">Drive injoignable pour le moment.</span>'; return; }
  el.innerHTML = `<div class="gd-tete"><span class="eng">☁ ${type === 'video' ? 'Vidéos' : 'Photos'} du Drive${titre ? ' · ' + esc(titre) : ''}</span><input class="fld gd-q" placeholder="chercher (morceau, dossier…)"></div><div class="gd-l"></div>`;
  const q = el.querySelector('.gd-q'), zone = el.querySelector('.gd-l');
  ['keydown', 'pointerdown', 'click'].forEach(t => q.addEventListener(t, e => e.stopPropagation()));
  function montrer() {
    const m = q.value.trim().toLowerCase(), l = tout.filter(f => !m || (f.name + ' ' + f.ou).toLowerCase().includes(m)).slice(0, 40);
    zone.innerHTML = l.length ? l.map(f => `<button class="gd-t" data-id="${f.id}" title="${esc(f.ou + ' / ' + f.name)}"><span class="gd-img">${type === 'video' ? '▶' : '🖼'}</span><span class="gd-n">${esc(f.name)}</span><span class="gd-o">${esc(f.ou)}</span></button>`).join('')
      : '<span class="nt">Rien trouvé.</span>';
    (async () => { for (const f of l) { if (!f.thumbnailLink) continue; const u = await BK.drive.vignette(f), b = zone.querySelector(`.gd-t[data-id="${f.id}"] .gd-img`); if (b && u) b.innerHTML = `<img src="${u}" draggable="false">`; } })();
  }
  q.oninput = montrer; montrer();
  zone.addEventListener('pointerdown', e => e.stopPropagation());
  zone.addEventListener('click', e => { e.stopPropagation(); const b = e.target.closest('.gd-t'); if (b) choisir(tout.find(f => f.id === b.dataset.id)); });
};

// ---------- les « sujets » (étiquettes) : morceaux, tournages, live, réseaux… — pour choisir de quoi parle un post ----------
BK.etiquettes.RUBRIQUES = {
  tournage: [{ k: 'c:tournage', nom: 'Tournage (général)' }, { k: 'c:outfits', nom: 'Tenues' }, { k: 'c:moodboard', nom: 'Moodboard' }],
  live: [{ k: 'c:live', nom: 'Live / concert' }, { k: 'c:lumiere', nom: 'Light show' }, { k: 'c:scenographie', nom: 'Scénographie' }],
  reseaux: [{ k: 'c:cover', nom: 'Covers' }, { k: 'c:insta', nom: 'Posts Instagram' }, { k: 'c:story', nom: 'Stories' }, { k: 'c:reel', nom: 'Reels / TikTok' }, { k: 'c:affiche', nom: 'Affiches / flyers' }, { k: 'c:presse', nom: 'Presse / EPK' }, { k: 'c:inspi', nom: 'Références / inspiration' }],
  membres: [{ k: 'c:m-yacine', nom: 'Yacine' }, { k: 'c:m-pierre', nom: 'Pierre' }, { k: 'c:m-baptiste', nom: 'Baptiste' }],
};
// les étiquettes créées par le groupe (Réglages › Drive) : partagées, rangées dans une rubrique ('tournage', 'live' ou 'reseaux')
BK.etiquettes.PERSO = [];
BK.etiquettes.chargerPerso = async function () {
  let l = []; try { l = await BK.partage.lire('etiquettes.perso', []); } catch (e) {}
  BK.etiquettes.PERSO = Array.isArray(l) ? l.filter(x => x && x.k && x.nom) : [];
  for (const r of Object.keys(BK.etiquettes.RUBRIQUES)) BK.etiquettes.RUBRIQUES[r] = BK.etiquettes.RUBRIQUES[r].filter(x => !x.perso)
    .concat(BK.etiquettes.PERSO.filter(x => (x.rub || 'reseaux') === r).map(x => ({ k: x.k, nom: x.nom, perso: true })));
  return BK.etiquettes.PERSO;
};
BK.etiquettes.creerPerso = async function (nom, rub) {
  nom = String(nom || '').trim().slice(0, 40); if (!nom) throw new Error('Écris un nom');
  await BK.etiquettes.chargerPerso();
  const tous = Object.values(BK.etiquettes.RUBRIQUES).flat();
  if (tous.some(x => x.nom.toLowerCase() === nom.toLowerCase())) throw new Error('Cette étiquette existe déjà');
  const k = 'c:p-' + nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36).slice(-3);
  const l = [...BK.etiquettes.PERSO, { k, nom, rub: rub || 'reseaux' }]; await BK.partage.ecrire('etiquettes.perso', l); await BK.etiquettes.chargerPerso(); return k;
};
BK.etiquettes.retirerPerso = async function (k) {          // la retire de la liste ; les fichiers ne sont pas touchés
  await BK.etiquettes.chargerPerso(); await BK.partage.ecrire('etiquettes.perso', BK.etiquettes.PERSO.filter(x => x.k !== k)); await BK.etiquettes.chargerPerso();
};
// une couleur par étiquette, toujours la même partout (palette rétro du logiciel)
BK.PALETTE_TAGS = ['#d2722e', '#2f7377', '#d9a93c', '#a8432a', '#5f8a9a', '#8a8a4a', '#7a2430', '#c98a5a', '#4e7c59', '#6a4e8a', '#b8691f', '#2a6f8a'];
BK.couleurTag = k => { let h = 0; for (const c of String(k)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return BK.PALETTE_TAGS[h % BK.PALETTE_TAGS.length]; };
BK.nomTag = k => { for (const l of Object.values(BK.etiquettes.RUBRIQUES)) { const x = l.find(c => c.k === k); if (x) return x.nom; } return null; };
BK.etiquettes.sujets = async function () {
  await BK.etiquettes.chargerPerso();
  const [ms, ts] = await Promise.all([BK.db.liste('morceaux'), BK.db.liste('tournages')]);
  return [
    { groupe: '♪ Morceaux', l: ms.sort((a, b) => a.nom.localeCompare(b.nom)).map(m => ({ k: m.id, nom: m.nom, morceau: m })) },
    { groupe: '🎬 Tournages', l: [...BK.etiquettes.RUBRIQUES.tournage, ...ts.map(t => ({ k: 't:' + t.id, nom: t.titre || 'Tournage' }))] },
    { groupe: '🎤 Live / concert', l: BK.etiquettes.RUBRIQUES.live },
    { groupe: '📣 Promo, réseaux et tout le reste', l: BK.etiquettes.RUBRIQUES.reseaux },
    { groupe: '◉ Membres', l: BK.etiquettes.RUBRIQUES.membres },
  ];
};
// les fichiers du Drive qui portent une étiquette (un morceau : aussi ceux devinés par le nom)
BK.etiquettes.fichiersDe = async function (k) {
  await BK.dossiers.assurer();
  const ms = await BK.db.liste('morceaux'), m = ms.find(x => x.id === k);
  if (m) return BK.dossiers.duMorceau(m, ms);
  const tags = await BK.etiquettes.tous();
  return (await BK.dossiers.tousFichiers()).filter(f => BK.etiquettes.liste(tags, f.id).includes(k));
};

// ---------- une fenêtre pour choisir plusieurs images (clic, Maj + clic, Tout sélectionner) ----------
// items : [{ id, nom, info, apercu (url) ou vignette: async () => url }]
// sources : [{ nom, charger }] → des puces en haut pour changer d'endroit (étiquetés / tout le cloud / Discord)
BK.choisirImages = function ({ titre = 'Choisir', items, charger, bouton = 'Ajouter', sources }) {
  return new Promise(fin => {
    const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const v = document.createElement('div'); v.className = 'voile ex-voile';
    v.innerHTML = `<div class="ex-box"><div class="ex-tete"><span class="lb">${esc(titre)}</span><button class="btn xs" data-ci="x">✕</button></div>
      ${sources && sources.length ? `<div class="chips ci-src">${sources.map((x, i) => `<button class="chip${i ? '' : ' on'}" data-cis="${i}">${esc(x.nom)}</button>`).join('')}</div>` : ''}
      <div class="ex-liste md-dc" id="ciL"><span class="nt"><span class="spin"></span>Recherche…</span></div>
      <div class="ex-pied"><span class="nt" id="ciInfo">Clique les images (Maj + clic : toutes celles entre les deux).</span><button class="btn" data-ci="tout">Tout sélectionner</button><button class="btn" data-ci="x">Annuler</button><button class="btn pri" data-ci="ok" disabled>${esc(bouton)}</button></div></div>`;
    document.body.appendChild(v);
    const choisis = new Set(); let l = [], dernier = null;
    const maj = () => { v.querySelectorAll('[data-cii]').forEach(t => t.classList.toggle('on', choisis.has(t.dataset.cii)));
      v.querySelector('#ciInfo').textContent = choisis.size ? choisis.size + ' image(s) choisie(s)' : 'Clique les images (Maj + clic : toutes celles entre les deux).';
      v.querySelector('[data-ci="ok"]').disabled = !choisis.size; v.querySelector('[data-ci="tout"]').textContent = choisis.size && choisis.size === l.length ? 'Tout désélectionner' : 'Tout sélectionner'; };
    const fermer = r => { v.remove(); fin(r); };
    v.addEventListener('click', e => {
      const t = e.target.closest('[data-cii]'), a = e.target.closest('[data-ci]');
      if (t) { const id = t.dataset.cii, ids = l.map(x => String(x.id));
        if (e.shiftKey && dernier && ids.includes(dernier)) { const [i, j] = [ids.indexOf(dernier), ids.indexOf(id)].sort((x, y) => x - y); ids.slice(i, j + 1).forEach(k => choisis.add(k)); }
        else choisis.has(id) ? choisis.delete(id) : choisis.add(id);
        dernier = id; return maj(); }
      if (!a) return;
      if (a.dataset.ci === 'x') return fermer(null);
      if (a.dataset.ci === 'tout') { if (choisis.size === l.length) choisis.clear(); else l.forEach(x => choisis.add(String(x.id))); return maj(); }
      if (a.dataset.ci === 'ok') fermer(l.filter(x => choisis.has(String(x.id))));
    });
    let gen = 0;
    const remplir = async (ch) => {
      const z = v.querySelector('#ciL'); z.innerHTML = '<span class="nt"><span class="spin"></span>Recherche…</span>'; z.dataset.gen = String(++gen);
      const mien = gen;
      try { l = items || await ch(); } catch (e) { z.innerHTML = `<span class="nt">${esc(e.message)}</span>`; return; }
      if (mien !== gen) return;
      choisis.clear(); maj();
      z.innerHTML = l.length ? l.map(x => `<button class="md-dc-t" data-cii="${esc(x.id)}" title="${esc(x.nom)}"><span class="md-dc-img">${x.apercu ? `<img src="${esc(x.apercu)}" loading="lazy" draggable="false" referrerpolicy="no-referrer">` : '<span class="spin"></span>'}</span>
          <span class="md-nom">${esc(x.nom)}</span>${x.info ? `<span class="nt">${esc(x.info)}</span>` : ''}</button>`).join('') : '<span class="nt">Aucune image trouvée.</span>';
      for (const x of l) if (!x.apercu && x.vignette) { if (!z.isConnected || z.dataset.gen !== String(gen)) return; const u = await x.vignette().catch(() => null), b = z.querySelector(`[data-cii="${CSS.escape(String(x.id))}"] .md-dc-img`); if (b) b.innerHTML = u ? `<img src="${u}" draggable="false">` : '🖼'; }
    };
    const srcs = sources && sources.length ? sources : [{ charger }];
    v.querySelectorAll('[data-cis]').forEach(b => b.onclick = () => { v.querySelectorAll('[data-cis]').forEach(x => x.classList.toggle('on', x === b)); remplir(srcs[+b.dataset.cis].charger); });
    remplir(srcs[0].charger);
  });
};

// =====================================================================
// 🍞 TRIER AVEC MIETTE — elle regarde les photos qui n'ont pas d'étiquette
// et propose où les ranger : tenues, scénographie, moodboard, covers, live…
// Rien n'est appliqué sans validation. Par petits paquets : léger en crédits.
// =====================================================================
BK.trierMedias = async function (fichiers, { avancement = () => {}, max = 40 } = {}) {
  if (!(await BK.ia.pret())) throw new Error('Il faut la clé Gemini et l\'AI allumée');
  const tags = await BK.etiquettes.tous(), morceaux = await BK.db.liste('morceaux');
  const CASES = [
    ['c:outfits', 'Tenues', 'des vêtements, des looks, quelqu\'un qui montre sa tenue, un portant, des chaussures'],
    ['c:scenographie', 'Scénographie', 'un décor, un lieu, une salle, des meubles, un plateau, une installation'],
    ['c:moodboard', 'Moodboard', 'une image d\'inspiration : photo d\'ambiance, référence visuelle, capture Pinterest, palette, film'],
    ['c:lumiere', 'Light show', 'des lumières, des LED, des projecteurs, un écran vidéo'],
    ['c:cover', 'Cover', 'une pochette de morceau ou une image carrée qui ressemble à une couverture d\'album'],
    ['c:live', 'Live / concert', 'une scène, un concert, le groupe en train de jouer devant du public'],
    ['c:tournage', 'Tournage', 'un tournage en cours : caméra, trépied, équipe, clap, coulisses'],
    ['c:insta', 'Post Instagram', 'une photo du groupe posée, un portrait, une image faite pour les réseaux'],
    ['c:affiche', 'Affiches / flyers', 'une affiche de concert, un flyer, une annonce avec du texte et une date'],
    ['c:inspi', 'Références / inspiration', 'le travail d\'un autre artiste montré en exemple : clip, pochette, photo, capture d\'écran'],
  ];
  // une photo de Discord : déjà étiquetée si sa copie dans le Drive l'est
  const etiq = f => BK.etiquettes.liste(tags, f.dc ? (BK.etiquettes.copieDe(f.id) || f.id) : f.id).length;
  const aTrier = fichiers.filter(f => /^image\//.test(f.mimeType || '') && !etiq(f)).slice(0, max);
  if (!aTrier.length) return [];
  const sys = `Tu ranges les photos du groupe de musique BEESKOT. Pour CHAQUE image, choisis UNE case :
${CASES.map(([k, n, d]) => `- ${k} (${n}) : ${d}`).join('\n')}
- "-" si l'image ne va dans aucune de ces cases, ou si tu n'es pas sûr.
Si on reconnaît clairement un morceau du groupe (pochette, titre écrit), dis-le dans "morceau". Morceaux : ${morceaux.map(m => m.nom).join(', ')}.
Réponds en JSON : un tableau d'objets {"i":<numéro de l'image, à partir de 1>,"case":"c:…ou -","morceau":"nom exact ou vide","pourquoi":"3 à 6 mots"}. Une entrée par image, dans l'ordre.`;
  const out = [];
  for (let d = 0; d < aTrier.length; d += 6) {
    const lot = aTrier.slice(d, d + 6);
    avancement(d, aTrier.length);
    const imgs = [];
    for (const f of lot) { try {
      let u = null;
      if (f.dc) { const r = await BK.discord.fetch((f.dc.apercu || f.dc.url) + (f.dc.apercu ? '?width=400&height=400' : '')); if (r.ok) u = URL.createObjectURL(await r.blob()); }   // photo de Discord
      else u = await BK.drive.vignette(f);
      imgs.push(u ? await BK.ia.enBase64(u) : null); } catch (e) { imgs.push(null); } }
    const bons = lot.filter((f, i) => imgs[i]);
    if (!bons.length) continue;
    try {
      const r = await BK.ia.demander(`Voici ${bons.length} image(s), dans l'ordre. Leurs noms de fichier : ${bons.map((f, i) => (i + 1) + ') ' + f.name).join(' ; ')}.`,
        { systeme: sys, json: true, temperature: 0.1, vite: true, delai: 120, fichiers: imgs.filter(Boolean) });
      for (const x of (Array.isArray(r) ? r : [])) {
        const f = bons[(+x.i || 0) - 1]; if (!f || !x.case || x.case === '-') continue;
        const c = CASES.find(([k]) => k === x.case); if (!c) continue;
        const m = x.morceau && morceaux.find(y => y.nom.toLowerCase() === String(x.morceau).toLowerCase());
        out.push({ f, cle: c[0], nom: c[1], morceau: m || null, pourquoi: x.pourquoi || '' });
      }
    } catch (e) { console.warn(e); }
    await new Promise(r => setTimeout(r, 30));
  }
  avancement(aTrier.length, aTrier.length);
  return out;
};

// ---------- un menu qui se déroule en cascade (comme le clic droit de Médias) ----------
// pos : { x, y } ; groupes : [{ nom, l: [{ k, nom, couleur? }] }] ; choisir(k, item)
BK.menuCascade = function (pos, groupes, choisir, { actuel = '', aucun = '' } = {}) {
  document.querySelectorAll('.md-menu').forEach(x => x.remove());
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const menu = document.createElement('div'); menu.className = 'md-menu';
  menu.style.left = Math.min(pos.x, innerWidth - 230) + 'px'; menu.style.top = Math.min(pos.y, innerHeight - 240) + 'px';
  menu.innerHTML = groupes.map((g, i) => `<div class="md-grp" data-grp="${i}"><button class="md-grp-b">${esc(g.nom)}${g.l.some(c => c.k === actuel) ? ' <em>●</em>' : ''}<span class="md-fl">▸</span></button>
      <div class="md-sub">${g.l.length ? g.l.map(c => `<button data-m="${esc(c.k)}"${c.k === actuel ? ' class="on"' : ''}><i style="background:${c.couleur || (BK.couleurTag ? BK.couleurTag(c.k) : '#ffb23e')}"></i>${esc(c.nom)}</button>`).join('') : '<span class="nt" style="padding:6px 10px">Rien ici</span>'}</div></div>`).join('')
    + (aucun ? `<span class="md-menu-sep"></span><button data-m="">${esc(aucun)}</button>` : '');
  document.body.appendChild(menu);
  menu.querySelectorAll('.md-grp').forEach(g => {
    const ouvrir = () => { menu.querySelectorAll('.md-grp').forEach(x => x.classList.toggle('ouvert', x === g));
      const sub = g.querySelector('.md-sub'), r = g.getBoundingClientRect(), droite = r.right + 230 < innerWidth;
      sub.style.left = (droite ? r.right + 2 : r.left - 232) + 'px';
      sub.style.top = Math.max(8, Math.min(r.top - 6, innerHeight - Math.min(sub.scrollHeight, 360) - 8)) + 'px'; };
    g.addEventListener('mouseenter', ouvrir); g.querySelector('.md-grp-b').onclick = e => { e.stopPropagation(); ouvrir(); };
  });
  const fermer = e => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('pointerdown', fermer, true); } };
  setTimeout(() => document.addEventListener('pointerdown', fermer, true));
  menu.onclick = e => { const x = e.target.closest('[data-m]'); if (!x) return; menu.remove(); document.removeEventListener('pointerdown', fermer, true);
    const k = x.dataset.m; choisir(k, groupes.flatMap(g => g.l).find(c => c.k === k) || null); };
  return menu;
};
