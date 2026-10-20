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
      <div class="ex-pied"><span class="nt" id="exInfo"></span><button class="btn" data-ex="annuler">Annuler</button><button class="btn pri" data-ex="ok">${mode === 'dossier' ? 'Choisir ce dossier' : 'Ajouter les images'}</button></div></div>`;
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
        const ds = l.filter(f => f.mimeType === BK.dossiers.FOLDER); fichiers = l.filter(f => /^image\//.test(f.mimeType));
        $('#exListe', v).innerHTML = ds.map(d => `<button class="ex-dos" data-id="${d.id}" data-nom="${esc(d.name)}">📁 ${esc(d.name)}</button>`).join('')
          + (mode === 'images' ? fichiers.map(f => `<button class="ex-img${choisis.has(f.id) ? ' on' : ''}" data-f="${f.id}" title="${esc(f.name)}"><span class="spin"></span></button>`).join('') : '')
          + (!ds.length && (mode === 'dossier' || !fichiers.length) ? '<span class="nt">Rien ici.</span>' : '');
        $$('.ex-dos', v).forEach(b => b.onclick = () => { pile.push({ id: b.dataset.id, nom: b.dataset.nom }); aller(); });
        $$('.ex-img', v).forEach(b => b.onclick = () => { choisis.has(b.dataset.f) ? choisis.delete(b.dataset.f) : choisis.add(b.dataset.f); b.classList.toggle('on'); $('#exInfo', v).textContent = choisis.size + ' image(s) choisie(s)'; });
        $('#exInfo', v).textContent = mode === 'dossier' ? (cur.id === 'root' ? 'Ouvre un dossier, puis « Choisir ce dossier ».' : cur.nom) : choisis.size + ' image(s) choisie(s)';
        for (const f of fichiers) { if (mode !== 'images') break; const u = await BK.drive.vignette(f), b = $(`.ex-img[data-f="${f.id}"]`, v); if (b) { b.innerHTML = ''; if (u) b.style.backgroundImage = `url(${u})`; } }
      } catch (e) { $('#exListe', v).innerHTML = '<span class="nt">Drive injoignable pour l\'instant.</span>'; }
    }
    (async () => { if (depart) { const d = typeof depart === 'string' ? await BK.dossiers.get(depart) : depart;
      if (d) { const ch = (d.chemin || d.nom).split(' / '); pile.push({ id: d.id, nom: ch[ch.length - 1] }); } } aller(); })();
  });
};
