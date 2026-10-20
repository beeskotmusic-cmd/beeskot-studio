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
  // un fichier peut avoir PLUSIEURS étiquettes : des morceaux (leur id) et des rubriques (« c:tournage », « t:<fiche tournage> », « c:lumiere »…)
  // '-' = « aucun morceau » (on ne devine plus par le nom)
  liste(tags, id) { const t = tags[id]; return !t ? [] : Array.isArray(t) ? t : [t]; },
  estMorceau: k => k && k !== '-' && !/^[a-z]:/.test(k),
  async mettre(fileId, morceauId) {                      // '' = enlever les étiquettes de morceau ; '-' = « aucun morceau »
    const d = await BK.etiquettes.charger(), autres = BK.etiquettes.liste(d.map, fileId).filter(k => /^[a-z]:/.test(k));
    const l = morceauId ? [morceauId, ...autres] : autres;
    if (l.length) d.map[fileId] = l; else delete d.map[fileId];
    await BK.db.ecrire('config', d);
  },
  async basculer(fileId, cle, forcer) {                  // ajoute (ou retire) une étiquette, sans toucher aux autres
    const d = await BK.etiquettes.charger(); let l = BK.etiquettes.liste(d.map, fileId).filter(k => k !== '-');
    const a = forcer ?? !l.includes(cle); l = l.filter(k => k !== cle); if (a) l.push(cle);
    if (l.length) d.map[fileId] = l; else delete d.map[fileId];
    await BK.db.ecrire('config', d); return a;
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
