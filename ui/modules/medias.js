// =====================================================================
// MÉDIAS — les vrais dossiers du groupe dans le Drive :
//   Photos / Vidéos (moodboards, tournages, outfits…), Scénographie, Light Show…
// On navigue dans les dossiers, on voit les images, on ajoute des fichiers
// dans le dossier ouvert. Rien n'est jamais effacé (corbeille de BEESKOT Studio).
// =====================================================================
(() => {
const RACINES = [['photovideo', 'Photos / Vidéos'], ['moodboard', 'Moodboards'], ['tournage', 'Tournages'], ['outfits', 'Outfits'], ['scenographie', 'Scénographie'], ['lightshow', 'Light Show']];
const M = { racine: BK.reglage('medias.racine', 'photovideo'), pile: [], fichiers: [], envoi: false, morceaux: [], tags: {}, filtre: '' };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const DOSSIER = 'application/vnd.google-apps.folder';

BK.module('medias', function (page) {
  $('.sub', page).textContent = 'Les dossiers photos, vidéos, moodboards et tournages du Drive BEESKOT';
  $('.hdr .right', page).innerHTML = `<div><span class="eng" style="font-size:9px">Fichiers</span><span class="vfd" id="mdNb">—</span></div>`;
  $('.grid', page).innerHTML = `
    <div class="cols">
      <section class="pane vit md-vit">
        <div class="box md-barre">
          <div class="seg" id="mdRacines">${RACINES.map(([k, n]) => `<button data-r="${k}">${n}</button>`).join('')}</div>
          <div class="md-fil" id="mdFil"></div>
          <label class="md-filtre"><span class="eng">🏷 Voir</span><select class="fld" id="mdFiltre"><option value="">Tous (dossier ouvert)</option></select></label>
        </div>
        <div class="box grow md-zone" id="mdZone"><div class="md-grille" id="mdGrille"></div></div>
      </section>
      <section class="pane reg" style="width:260px"><span class="ptitle">② Réglages</span>
        <div class="box"><span class="lb">Ajouter</span>
          <span class="nt">Glisse des fichiers sur la page, ou « + » : ils vont dans le dossier ouvert.</span>
          <button class="btn sm" id="mdAjout" style="margin-top:10px">+ Choisir des fichiers…</button>
          <button class="btn sm" id="mdDossier" style="margin-top:8px">+ Nouveau dossier ici…</button>
          <input type="file" id="mdInput" multiple hidden></div>
        <div class="box"><span class="lb">Drive</span>
          <span class="nt mono" id="mdChemin">—</span>
          <button class="btn sm" id="mdOuvrirDos" style="margin-top:10px">Ouvrir ce dossier dans le Drive</button></div>
        <div class="box"><span class="lb">Rien n'est effacé</span></div>
      </section>
    </div>
    <div class="pane md-ajouter"><span class="ptitle">Ajouter à</span>
      <div class="md-aj-tete"><div class="seg" id="mdRub"><button data-rub="morceaux">♪ Morceaux</button><button data-rub="tournage">🎬 Tournage</button><button data-rub="lumiere">💡 Lumière / scène</button></div>
        <span class="nt">Glisse un média sur une case (ou clique le média, puis la case). Un fichier peut aller dans plusieurs cases.</span></div>
      <div class="md-paniers" id="mdPaniers"></div></div>
    <div class="pane abar"><span class="vfd" id="mdMsg">PRÊT</span>
      <div class="right"><button class="btn" id="mdRelire">↻ Relire</button></div></div>`;
  const msg = t => $('#mdMsg').textContent = String(t).toUpperCase().slice(0, 90);
  const ici = () => M.pile[M.pile.length - 1];

  async function allerRacine(r) {
    M.racine = r; BK.regler('medias.racine', r);
    $$('#mdRacines button').forEach(b => b.classList.toggle('on', b.dataset.r === r));
    if (!BK.drive.relie()) return vide('Relie d\'abord le Drive (Réglages › Drive).');
    await BK.dossiers.assurer(); if (!M.morceaux.length) await etiquettes();
    const d = await BK.dossiers.get(r);
    if (!d) return vide('Ce dossier n\'a pas été trouvé dans le Drive. Choisis-le dans Réglages › Vos dossiers du Drive.');
    M.pile = [{ id: d.id, nom: BK.dossiers.joli(d.nom) }]; charger();
  }
  function vide(t) { $('#mdGrille').innerHTML = `<span class="nt md-vide">${t}</span>`; $('#mdNb').textContent = '—'; $('#mdFil').innerHTML = ''; }

  async function etiquettes() {
    M.morceaux = (await BK.db.liste('morceaux')).sort((a, b) => a.nom.localeCompare(b.nom)); M.tags = await BK.etiquettes.tous();
    M.tournages = (await BK.db.liste('tournages')).sort((a, b) => (b.date || b.maj || '').localeCompare(a.date || a.maj || ''));
    const sel = $('#mdFiltre'), v = sel.value, rubs = cases();
    sel.innerHTML = '<option value="">Tous (dossier ouvert)</option>' + [['morceaux', 'Morceaux'], ['tournage', 'Tournage'], ['lumiere', 'Lumière / scène']]
      .map(([r, t]) => `<optgroup label="${t}">${rubs[r].map(c => `<option value="${c.k}">${esc(c.nom)}</option>`).join('')}</optgroup>`).join(''); sel.value = v;
    paniers();
  }
  // ---------- « Ajouter à » : un panier par morceau, on y lâche les médias ----------
  // les cases de chaque rubrique : morceaux, tournages (une case par fiche + « général »), lumière / scène
  function cases() {
    return {
      morceaux: M.morceaux.map(m => ({ k: m.id, nom: m.nom, ph: m.photo, ic: '♪' })),
      tournage: [{ k: 'c:tournage', nom: 'Tournage (général)', ic: '🎬' }, { k: 'c:outfits', nom: 'Tenues', ic: '👕' }, { k: 'c:moodboard', nom: 'Moodboard', ic: '🖼' },
        ...(M.tournages || []).map(t => ({ k: 't:' + t.id, nom: t.titre || 'Tournage', ic: '🎬' }))],
      lumiere: [{ k: 'c:lumiere', nom: 'Light show', ic: '💡' }, { k: 'c:scenographie', nom: 'Scénographie', ic: '🎭' }, { k: 'c:live', nom: 'Live / concert', ic: '🎤' }],
    };
  }
  const nomCase = k => Object.values(cases()).flat().find(c => c.k === k);
  function paniers() {
    const z = $('#mdPaniers'), rub = M.rub = M.rub || BK.reglage('medias.rub', 'morceaux');
    $$('#mdRub button').forEach(b => { b.classList.toggle('on', b.dataset.rub === rub); b.onclick = () => { M.rub = b.dataset.rub; BK.regler('medias.rub', M.rub); paniers(); }; });
    const compte = k => Object.keys(M.tags).filter(id => BK.etiquettes.liste(M.tags, id).includes(k)).length;
    z.innerHTML = cases()[rub].map(c => { const n = compte(c.k);
      return `<div class="md-panier" data-pan="${esc(c.k)}">${c.ph ? `<span class="md-pan-ph" style="background-image:url(${c.ph})"></span>` : `<span class="md-pan-ph">${c.ic}</span>`}<b>${esc(c.nom)}</b>${n ? `<em>${n}</em>` : ''}</div>`; }).join('')
      || '<span class="nt">Aucun morceau : crée d\'abord des fiches dans la Bibliothèque.</span>';
    $$('.md-panier', z).forEach(p => {
      p.ondragover = e => { if (e.dataTransfer.types.includes('text/bk-media') || e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.stopPropagation(); p.classList.add('survol'); } };
      p.ondragleave = () => p.classList.remove('survol');
      p.ondrop = e => { e.preventDefault(); e.stopPropagation(); p.classList.remove('survol');
        const id = e.dataTransfer.getData('text/bk-media'); if (id) return etiqueter(id, p.dataset.pan);
        if (e.dataTransfer.files.length) envoyer(e.dataTransfer.files, p.dataset.pan); };     // un fichier du PC lâché sur une case : envoyé dans le bon dossier + étiqueté
      p.onclick = () => { if (M.choisi) etiqueter(M.choisi, p.dataset.pan, null); else { const sel = $('#mdFiltre'); sel.value = p.dataset.pan; sel.onchange({ target: sel }); } };
    });
  }
  async function etiqueter(fileId, cle, forcer = true) {
    const c = nomCase(cle), f = M.fichiers.find(x => x.id === fileId);
    const a = await BK.etiquettes.basculer(fileId, cle, forcer); M.tags = await BK.etiquettes.tous(); M.choisi = null;
    msg(`« ${f ? f.name : 'fichier'} » ${a ? '→' : 'retiré de'} ${c ? c.nom : ''} 🏷`); rendre(!!M.filtre); paniers();
  }
  // tout ce qui porte l'étiquette d'un morceau, dans tous les dossiers médias
  async function parMorceau(id) {
    const m = M.morceaux.find(x => x.id === id), c = nomCase(id); if (!m && !c) return;
    $('#mdFil').innerHTML = `<span class="ex-miette">🏷 Tout ce qui est dans « ${esc((m || c).nom)} »</span>`; $('#mdChemin').textContent = 'Plusieurs dossiers';
    $('#mdGrille').innerHTML = '<span class="nt md-vide"><span class="spin"></span>Recherche dans le Drive…</span>';
    try { const l = m ? await BK.dossiers.duMorceau(m, M.morceaux) : (await BK.dossiers.tousFichiers()).filter(f => BK.etiquettes.liste(M.tags, f.id).includes(id));
      M.fichiers = l.filter(f => /^(image|video)\//.test(f.mimeType) || /\.pdf$/i.test(f.name)); if (M.filtre === id) rendre(true); }
    catch (e) { vide('Drive injoignable pour l\'instant.'); }
  }
  window.addEventListener('bk:annule', () => charger());   // après « ↶ Annuler » : on relit
  async function charger() {
    if (M.filtre) return parMorceau(M.filtre);
    const cur = ici(); if (!cur) return;
    $('#mdFil').innerHTML = M.pile.map((p, i) => `<button class="ex-miette" data-i="${i}">${esc(p.nom)}</button>`).join('<span>›</span>');
    $$('#mdFil .ex-miette').forEach(b => b.onclick = () => { M.pile = M.pile.slice(0, +b.dataset.i + 1); charger(); });
    $('#mdChemin').textContent = M.pile.map(p => p.nom).join(' / ');
    $('#mdGrille').innerHTML = '<span class="nt md-vide"><span class="spin"></span>Lecture du Drive…</span>';
    try { M.fichiers = await BK.dossiers.enfants(cur.id); if (ici() === cur) rendre(); }
    catch (e) { vide('Drive injoignable pour l\'instant.'); console.error(e); }
  }
  BK.mediasRecharger = charger;

  function rendre(filtre) {
    const ds = M.fichiers.filter(f => f.mimeType === DOSSIER), fs = M.fichiers.filter(f => f.mimeType !== DOSSIER);
    const tag = f => { const ms = BK.etiquettes.morceauxDe({ ...f, dossiers: f.dossiers || M.pile.map(p => p.nom) }, M.morceaux, M.tags), l = BK.etiquettes.liste(M.tags, f.id);
      const main = l.some(BK.etiquettes.estMorceau), noms = [...ms.map(m => m.nom), ...l.filter(k => /^[a-z]:/.test(k)).map(k => (nomCase(k) || {}).nom).filter(Boolean)];
      return `<button class="md-tag${l.length ? ' main' : noms.length ? '' : ' vide'}" data-tag="${f.id}" title="${main || l.length ? 'Étiquettes choisies à la main' : noms.length ? 'Devinée par le nom' : 'Étiqueter'}">🏷 ${esc(noms.length ? noms.join(' · ') : 'Étiqueter')}</button>`; };
    $('#mdNb').textContent = String(fs.length).padStart(2, '0');
    $('#mdGrille').innerHTML = ds.map(d => `<button class="md-tuile md-dos" data-dos="${d.id}" data-nom="${esc(d.name)}"><span class="md-dos-ic">📁</span><span class="md-nom">${esc(d.name)}</span></button>`).join('')
      + (filtre ? '' : `<button class="md-tuile md-plus" id="mdPlus"><span>+</span><span class="nt">Ajouter ici</span></button>`)
      + fs.map(f => {
        const video = /^video\//.test(f.mimeType), d = f.videoMediaMetadata && f.videoMediaMetadata.durationMillis;
        return `<div class="md-tuile${M.choisi === f.id ? ' choisie' : ''}" data-id="${f.id}" title="${esc(f.name)}" draggable="true">
          <div class="md-img${video ? ' video' : ''}">${f.thumbnailLink ? '<span class="spin"></span>' : `<span class="md-ext">${esc((f.name.split('.').pop() || '').toUpperCase())}</span>`}
            ${video ? `<span class="md-duree">${d ? BK.audio.temps(d / 1000).replace(/\.\d$/, '') : '▶'}</span>` : ''}</div>
          <span class="md-nom">${esc(f.name)}</span>${tag(f)}
          <button class="md-x" data-x="${f.id}" title="Ranger dans la corbeille">✕</button></div>`;
      }).join('');
    $$('.md-dos').forEach(b => b.onclick = () => { M.pile.push({ id: b.dataset.dos, nom: b.dataset.nom }); charger(); });
    if (!filtre) $('#mdPlus').onclick = () => $('#mdInput').click();
    $$('.md-tag').forEach(b => b.onclick = e => { e.stopPropagation(); menuTag(b); });
    $$('.md-tuile[data-id]').forEach(t => { t.ondragstart = e => { e.dataTransfer.setData('text/bk-media', t.dataset.id); e.dataTransfer.effectAllowed = 'link'; $('#mdPaniers').classList.add('actif'); };
      t.ondragend = () => $('#mdPaniers').classList.remove('actif'); });
    $$('.md-tuile[data-id]').forEach(t => t.ondblclick = e => { const f = M.fichiers.find(x => x.id === t.dataset.id); f && BK.ouvrirLien(f.webViewLink); });
    $$('.md-tuile[data-id]').forEach(t => t.onclick = e => { if (e.target.closest('.md-x,.md-tag')) return;
      if (!e.ctrlKey) { M.choisi = M.choisi === t.dataset.id ? null : t.dataset.id; $$('.md-tuile').forEach(x => x.classList.toggle('choisie', x.dataset.id === M.choisi)); if (M.choisi) msg('Clique un morceau en bas (ou double-clic pour ouvrir)'); return; } const f = M.fichiers.find(x => x.id === t.dataset.id); f && BK.ouvrirLien(f.webViewLink); });
    $$('.md-x').forEach(b => b.onclick = async () => {
      const f = M.fichiers.find(x => x.id === b.dataset.x); if (!f || !confirm(`Ranger « ${f.name} » dans la corbeille de BEESKOT Studio ?`)) return;
      try { await BK.drive.corbeille(f.id); M.fichiers = M.fichiers.filter(x => x !== f); rendre(); msg('Rangé dans la corbeille'); } catch (e) { msg('Impossible pour l\'instant'); }
    });
    (async () => { for (const f of fs) {                               // vignettes une par une : léger
      if (!f.thumbnailLink) continue; const u = await BK.drive.vignette(f), el = $(`.md-tuile[data-id="${f.id}"] .md-img`);
      if (el) { const sp = $('.spin', el); sp && sp.remove(); if (u) el.style.backgroundImage = `url(${u})`; }
    } })();
  }

  // ---------- choisir l'étiquette d'un fichier ----------
  function menuTag(b) {
    $$('.md-menu').forEach(x => x.remove());
    const id = b.dataset.tag, r = b.getBoundingClientRect(), menu = document.createElement('div'); menu.className = 'md-menu';
    menu.style.left = Math.min(r.left, innerWidth - 230) + 'px'; menu.style.top = Math.min(r.bottom + 4, innerHeight - 320) + 'px';
    const l = BK.etiquettes.liste(M.tags, id), rubs = cases();
    const dessiner = () => { const l = BK.etiquettes.liste(M.tags, id);
      menu.innerHTML = [['morceaux', 'Morceaux'], ['tournage', 'Tournage'], ['lumiere', 'Lumière / scène']].map(([r, t]) => `<span class="md-menu-t">${t}</span>`
        + rubs[r].map(c => `<button data-m="${esc(c.k)}"${l.includes(c.k) ? ' class="on"' : ''}>${l.includes(c.k) ? '☑' : '☐'} ${esc(c.nom)}</button>`).join('')).join('')
        + `<span class="md-menu-t"></span><button data-m="-"${l.includes('-') ? ' class="on"' : ''}>— Aucun morceau</button>${l.length ? '<button data-m="">↺ Tout enlever (deviner par le nom)</button>' : ''}`; };
    dessiner();
    document.body.appendChild(menu);
    const fermer = e => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('pointerdown', fermer, true); } };
    setTimeout(() => document.addEventListener('pointerdown', fermer, true));
    menu.onclick = async e => { const x = e.target.closest('[data-m]'); if (!x) return; const k = x.dataset.m;
      if (k === '' || k === '-') { const d = await BK.etiquettes.charger(); if (k) d.map[id] = ['-']; else delete d.map[id]; await BK.db.ecrire('config', d); menu.remove(); }
      else { await BK.etiquettes.basculer(id, k); }
      M.tags = await BK.etiquettes.tous(); msg('Étiquettes enregistrées'); if (menu.isConnected) dessiner(); rendre(!!M.filtre); paniers(); };
  }

  // ---------- ajouter des fichiers dans le dossier ouvert ----------
  // où va un fichier lâché sur une case : le dossier du Drive qui correspond (sinon le dossier ouvert)
  const ROLE_CASE = { 'c:tournage': 'tournage', 'c:outfits': 'outfits', 'c:moodboard': 'moodboard', 'c:lumiere': 'lightshow', 'c:scenographie': 'scenographie', 'c:live': 'scenographie' };
  async function dossierPour(cle) {
    const r = ROLE_CASE[cle] || (/^t:/.test(cle) ? 'tournage' : '');
    if (r) { const d = await BK.dossiers.get(r).catch(() => null); if (d) return { id: d.id, nom: BK.dossiers.joli(d.nom) }; }
    if (!M.filtre && ici()) return ici();
    const d = await BK.dossiers.get('photovideo').catch(() => null); return d ? { id: d.id, nom: BK.dossiers.joli(d.nom) } : ici();
  }
  async function envoyer(liste, cle = '') {
    const cur = cle || M.filtre ? await dossierPour(cle || M.filtre) : ici(); if (!cur) return msg('Ouvre d\'abord un dossier');
    if (M.envoi) return msg('Un envoi est déjà en cours');
    const fs = [...liste]; if (!fs.length) return;
    M.envoi = true;
    try {
      for (let i = 0; i < fs.length; i++) {
        const n = await BK.drive.envoyerBlob(fs[i], fs[i].name, cur.id, p => msg(`Envoi ${i + 1}/${fs.length} vers ${cur.nom} · ${Math.round(p * 100)} %`));
        if ((cle || M.filtre) && n && n.id) await BK.etiquettes.basculer(n.id, cle || M.filtre, true);      // et il prend l'étiquette de la case
      }
      BK.dossiers.oublier(); M.tags = await BK.etiquettes.tous();
      msg((fs.length > 1 ? fs.length + ' fichiers envoyés' : 'Fichier envoyé') + ' dans ' + cur.nom); paniers();
    } catch (e) { msg('Envoi impossible : ' + e.message); console.error(e); }
    M.envoi = false; charger();
  }
  $('#mdAjout').onclick = () => $('#mdInput').click();
  $('#mdInput').onchange = e => { envoyer(e.target.files); e.target.value = ''; };
  $('#mdDossier').onclick = async () => {
    const cur = ici(); if (!cur) return; const n = prompt('Nom du nouveau dossier'); if (!n || !n.trim()) return;
    try { await BK.drive.dossier(n.trim(), cur.id); msg('Dossier créé'); charger(); } catch (e) { msg('Impossible pour l\'instant'); }
  };
  page.addEventListener('dragover', e => { e.preventDefault(); if (!e.dataTransfer.types.includes('text/bk-media')) $('#mdZone').classList.add('survol'); });
  page.addEventListener('dragleave', e => { if (!page.contains(e.relatedTarget)) $('#mdZone').classList.remove('survol'); });
  page.addEventListener('drop', e => { e.preventDefault(); $('#mdZone').classList.remove('survol'); if (e.dataTransfer.types.includes('text/bk-media')) return; if (e.dataTransfer.files.length) envoyer(e.dataTransfer.files); });

  $$('#mdRacines button').forEach(b => b.onclick = () => { M.filtre = ''; $('#mdFiltre').value = ''; allerRacine(b.dataset.r); });
  $('#mdFiltre').onchange = e => { M.filtre = e.target.value; M.filtre ? parMorceau(M.filtre) : (M.pile.length ? charger() : allerRacine(M.racine)); };
  $('#mdRelire').onclick = charger;
  $('#mdOuvrirDos').onclick = () => ici() ? BK.ouvrirLien('https://drive.google.com/drive/folders/' + ici().id) : msg('Relie d\'abord le Drive');
  BK.surOuvrir = BK.surOuvrir || {};
  BK.surOuvrir.medias = async () => { await etiquettes(); if (!M.pile.length && !M.filtre) allerRacine(M.racine); };
  BK.ouvrirMedias = async role => { BK.ouvrir('medias'); allerRacine(role || 'photovideo'); };
  $$('#mdRacines button').forEach(b => b.classList.toggle('on', b.dataset.r === M.racine));
});
})();
