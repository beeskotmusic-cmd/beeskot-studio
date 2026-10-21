// =====================================================================
// MÉDIAS — les vrais dossiers du groupe dans le Drive :
//   Photos / Vidéos (moodboards, tournages, outfits…), Scénographie, Light Show…
// On navigue dans les dossiers, on voit les images, on ajoute des fichiers
// dans le dossier ouvert. Rien n'est jamais effacé (corbeille de BEESKOT Studio).
// =====================================================================
(() => {
// En haut, on ne choisit QUE la source : d'où viennent les fichiers.
// Le rangement, lui, se fait uniquement avec les étiquettes, en bas.
const RACINES = [['cloud', '☁ Médias sur le cloud'], ['discord', '🍞 Discord']];
// les dossiers du Drive, qu'on retrouve en entrant dans « Médias sur le cloud »
const DOSSIERS_CLOUD = [['photovideo', 'Photos / Vidéos'], ['moodboard', 'Moodboards'], ['tournage', 'Tournages'],
  ['outfits', 'Outfits'], ['scenographie', 'Scénographie'], ['lightshow', 'Light Show']];
const M = { racine: ['cloud','discord'].includes(BK.reglage('medias.racine','cloud')) ? BK.reglage('medias.racine','cloud') : 'cloud', pile: [], fichiers: [], envoi: false, morceaux: [], tags: {}, filtre: '',
  sel: new Set(), dernier: null,
  petit: BK.reglage('medias.petit', false), voirCaches: false };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const DOSSIER = 'application/vnd.google-apps.folder';

BK.module('medias', function (page) {
  $('.sub', page).textContent = 'En haut : d\'où viennent les fichiers. En bas : les étiquettes pour les ranger.';
  $('.hdr .right', page).innerHTML = `<div><span class="eng" style="font-size:9px">Fichiers</span><span class="vfd" id="mdNb">—</span></div>`;
  $('.grid', page).innerHTML = `
    <div class="cols">
      <section class="pane vit md-vit">
        <div class="box md-barre">
          <span class="eng md-lab">Source</span>
          <div class="seg" id="mdRacines">${RACINES.map(([k, n]) => `<button data-r="${k}">${n}</button>`).join('')}</div>
          <div class="md-fil" id="mdFil"></div>
          <label class="md-filtre"><span class="eng">🏷 Voir</span><select class="fld" id="mdFiltre"><option value="">Tous (dossier ouvert)</option></select></label>
          <div class="chips md-vue"><button class="chip" id="mdPetit" title="Vignettes plus petites : moins de défilement">⊞ Petites</button><button class="chip" id="mdCaches" title="Les fichiers mis de côté">🙈 Masqués <span id="mdNbC"></span></button></div>
        </div>
        <div class="box grow md-zone" id="mdZone"><div class="md-grille" id="mdGrille"></div></div>
      </section>
      <section class="pane reg" style="width:260px"><span class="ptitle">② Réglages</span>
        <div class="box"><span class="lb">Ajouter</span>
          <span class="nt">Glisse des fichiers sur la page, ou « + » : ils vont dans le dossier ouvert.</span>
          <button class="btn sm" id="mdAjout" style="margin-top:10px">+ Choisir des fichiers…</button>
          <button class="btn sm" id="mdDossier" style="margin-top:8px">+ Nouveau dossier ici…</button>
          <button class="btn sm pri" id="mdTrier" style="margin-top:8px" title="Miette regarde les photos sans étiquette et propose où les ranger">🍞 Trier avec Miette</button>
          <input type="file" id="mdInput" multiple hidden></div>
        <div class="box"><span class="lb">📍 Tu es ici</span>
          <span class="nt" id="mdChemin" style="color:var(--ink)">—</span>
          <button class="btn sm" id="mdOuvrirDos" style="margin-top:10px">Ouvrir ce dossier dans le Drive</button>
          <button class="btn sm hidden" id="mdMajDc" style="margin-top:8px">↻ Recharger les images Discord</button></div>
        <div class="box"><span class="lb">Rien n'est effacé</span></div>
      </section>
    </div>
    <div class="pane md-ajouter"><span class="ptitle">Ajouter à</span>
      <div class="md-aj-tete"><span class="eng md-lab">Étiquettes</span><div class="seg" id="mdRub"><button data-rub="morceaux">♪ Morceaux</button><button data-rub="tournage">🎬 Tournage</button><button data-rub="lumiere">💡 Lumière / scène</button><button data-rub="reseaux">📣 Réseaux</button></div>
        <span class="nt">C\'est <b>ici</b> qu\'on range : glisse un ou plusieurs médias sur une étiquette (ou clique-les, puis l\'étiquette). Un fichier peut porter plusieurs étiquettes.</span></div>
      <div class="md-paniers" id="mdPaniers"></div></div>
    <div class="pane abar"><span class="vfd" id="mdMsg">PRÊT</span>
      <span class="vfd hidden" id="mdSelN" style="margin-left:10px;color:#ffb23e"></span>
      <span class="nt" style="margin:0 12px">Clic = choisir · <b>Ctrl+clic</b> = en ajouter · <b>Maj+clic</b> = toute une suite · puis glisse-les sur une étiquette</span>
      <div class="right"><button class="btn" id="mdRelire">↻ Relire</button></div></div>`;
  const msg = t => $('#mdMsg').textContent = String(t).toUpperCase().slice(0, 90);
  const ici = () => M.pile[M.pile.length - 1];

  async function allerRacine(r) {
    M.racine = r; BK.regler('medias.racine', r); M.filtre = ''; const sel = $('#mdFiltre'); if (sel) sel.value = '';
    $$('#mdRacines button').forEach(b => b.classList.toggle('on', b.dataset.r === r));
    if (r === 'discord') { M.pile = []; return chargerDiscord(); }
    if (!BK.drive.relie()) return vide('Relie d\'abord le Drive (Réglages › Drive).');
    await BK.dossiers.assurer(); if (!M.morceaux.length) await etiquettes();
    M.pile = []; charger();                                     // cloud : on part de la liste des dossiers du Drive
  }
  function vide(t) { $('#mdGrille').innerHTML = `<span class="nt md-vide">${t}</span>`; $('#mdNb').textContent = '—'; $('#mdFil').innerHTML = ''; }

  async function etiquettes() {
    M.morceaux = (await BK.db.liste('morceaux')).sort((a, b) => a.nom.localeCompare(b.nom)); M.tags = await BK.etiquettes.tous();
    M.tournages = (await BK.db.liste('tournages')).sort((a, b) => (b.date || b.maj || '').localeCompare(a.date || a.maj || ''));
    const sel = $('#mdFiltre'), v = sel.value, rubs = cases();
    sel.innerHTML = '<option value="">Tous (dossier ouvert)</option>' + [['morceaux', 'Morceaux'], ['tournage', 'Tournage'], ['lumiere', 'Lumière / scène'], ['reseaux', 'Réseaux']]
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
      reseaux: [{ k: 'c:cover', nom: 'Covers', ic: '💿' }, { k: 'c:insta', nom: 'Posts Instagram', ic: '📷' }, { k: 'c:story', nom: 'Stories', ic: '⭕' }, { k: 'c:reel', nom: 'Reels / TikTok', ic: '🎬' }, { k: 'c:affiche', nom: 'Affiches / flyers', ic: '📰' }, { k: 'c:presse', nom: 'Presse / EPK', ic: '🗞' }],
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
        const id = e.dataTransfer.getData('text/bk-media'); if (id) return etiqueterTous(id.split(','), p.dataset.pan);
        if (e.dataTransfer.files.length) envoyer(e.dataTransfer.files, p.dataset.pan); };     // un fichier du PC lâché sur une case : envoyé dans le bon dossier + étiqueté
      p.onclick = () => { if (M.sel.size > 1) return etiqueterTous([...M.sel], p.dataset.pan);
        if (M.choisi) etiqueter(M.choisi, p.dataset.pan, null); else { const sel = $('#mdFiltre'); sel.value = p.dataset.pan; sel.onchange({ target: sel }); } };
    });
  }
  function majSel() {
    $$('.md-tuile[data-id]').forEach(x => x.classList.toggle('choisie', M.sel.has(x.dataset.id)));
    const n = $('#mdSelN'); if (n) { n.textContent = M.sel.size > 1 ? M.sel.size + ' choisis' : ''; n.classList.toggle('hidden', M.sel.size < 2); }
  }

  // étiqueter plusieurs fichiers d'un coup
  async function etiqueterTous(ids, cle, forcer = true) {
    const l = [...new Set(ids)].filter(Boolean);
    if (l.length <= 1) return etiqueter(l[0], cle, forcer);
    let k = 0;
    for (const id of l) { k++; msg(`Étiquetage ${k}/${l.length}…`); try { await etiqueter(id, cle, forcer); } catch (e) {} }
    M.sel.clear(); M.choisi = null; M.tags = await BK.etiquettes.tous();
    msg(l.length + ' fichiers étiquetés « ' + nomCase(cle) + ' »'); rendre(!!M.filtre);
  }

  async function etiqueter(fileId, cle, forcer = true) {
    const c = nomCase(cle), f = M.fichiers.find(x => x.id === fileId);
    if (f && f.dc) {                                                   // venu de Discord : on le range d'abord dans le Drive
      if (M.envoi) return msg('Un envoi est déjà en cours');
      M.envoi = true;
      try { msg('Téléchargement de ' + f.name + '…');
        const r = await BK.discord.fetch(f.dc.url); if (!r.ok) throw new Error('fichier expiré sur Discord');
        const blob = await r.blob(), dos = await dossierPour(cle);
        const n = await BK.drive.envoyerBlob(new File([blob], f.name, { type: blob.type || f.mimeType }), f.name, dos.id, p => msg(`Envoi dans ${dos.nom} · ${Math.round(p * 100)} %`));
        await BK.etiquettes.basculer(n.id, cle, true);
        BK.dossiers.oublier(); M.tags = await BK.etiquettes.tous(); M.choisi = null;
        msg(`« ${f.name} » → ${dos.nom} · ${c ? c.nom : ''} 🏷`); paniers(); rendre();
      } catch (e) { msg('Impossible : ' + (e.message || e)); }
      M.envoi = false; return;
    }
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
  // ---------- le dossier « Discord » : toutes les photos et vidéos postées sur le serveur ----------
  async function chargerDiscord() {
    $('#mdFil').innerHTML = '<span class="ex-miette">🍞 Discord · tout ce qui a été posté</span>';
    $('#mdChemin').textContent = 'Discord (pas dans le Drive)';
    $('#mdAjout').disabled = $('#mdDossier').disabled = $('#mdOuvrirDos').disabled = true;
    $('#mdMajDc').classList.remove('hidden');
    $('#mdGrille').innerHTML = '<span class="nt md-vide"><span class="spin"></span>Ouverture…</span>';
    const pose = (l, garde) => { M.fichiers = l.map(x => ({ id: 'dc:' + x.id, name: x.nom, mimeType: x.video ? 'video/mp4' : 'image/jpeg',
        thumbnailLink: x.apercu, webViewLink: x.lien, modifiedTime: x.t, size: x.taille, dc: x, dossiers: ['Discord', '#' + x.salon] }));
      if (M.racine === 'discord') { rendre(); if (garde) msg('Miette regarde s\'il y a du nouveau…'); } };
    try {
      if (!M.morceaux.length) await etiquettes();
      const l = await BK.discord.mediasVite('media', { surMaj: pose, rafraichir: M.majDiscord });
      M.majDiscord = false; pose(l, false);
      if (M.racine === 'discord') msg(l.length + ' fichier(s) · gardés dans le Drive');
    } catch (e) { if (!M.fichiers.length) vide(e.message || 'Discord injoignable'); else msg(e.message || 'Discord injoignable'); }
  }

  window.addEventListener('bk:annule', () => charger());   // après « ↶ Annuler » : on relit
  async function charger() {
    if (M.racine === 'discord') return chargerDiscord();
    if (M.filtre) return parMorceau(M.filtre);
    if (!M.pile.length) return racineCloud();
    const cur = ici(); if (!cur) return;
    $('#mdFil').innerHTML = M.pile.map((p, i) => `<button class="ex-miette" data-i="${i}">${esc(p.nom)}</button>`).join('<span>›</span>');
    $$('#mdFil .ex-miette').forEach(b => b.onclick = () => { M.pile = M.pile.slice(0, +b.dataset.i + 1); charger(); });
    $('#mdChemin').textContent = ['Drive BEESKOT', ...M.pile.map(p => p.nom)].join(' › ');
    $('#mdAjout').disabled = $('#mdDossier').disabled = $('#mdOuvrirDos').disabled = false;
    $('#mdMajDc').classList.add('hidden');
    $('#mdGrille').innerHTML = '<span class="nt md-vide"><span class="spin"></span>Lecture du Drive…</span>';
    try { M.fichiers = await BK.dossiers.enfants(cur.id); if (ici() === cur) rendre(); }
    catch (e) { vide('Drive injoignable pour l\'instant.'); console.error(e); }
  }
  BK.mediasRecharger = charger;

  // la première page du cloud : les grands dossiers du Drive, comme des dossiers
  async function racineCloud() {
    $('#mdFil').innerHTML = '';
    $('#mdChemin').textContent = 'Drive BEESKOT';
    $('#mdAjout').disabled = $('#mdDossier').disabled = $('#mdOuvrirDos').disabled = true;
    $('#mdMajDc').classList.add('hidden');
    $('#mdGrille').innerHTML = '<span class="nt md-vide"><span class="spin"></span>Lecture du Drive…</span>';
    const l = [];
    for (const [k, n] of DOSSIERS_CLOUD) { try { const d = await BK.dossiers.get(k); if (d) l.push({ id: d.id, name: n, mimeType: DOSSIER }); } catch (e) {} }
    M.fichiers = l;
    if (!l.length) return vide('Aucun dossier trouvé. Choisis-les dans Réglages › Vos dossiers du Drive.');
    rendre();
  }

  function rendre(filtre) {
    const masque = f => BK.etiquettes.liste(M.tags, f.id).includes('c:masque');
    const ds = M.fichiers.filter(f => f.mimeType === DOSSIER), tous = M.fichiers.filter(f => f.mimeType !== DOSSIER);
    const fs = M.voirCaches ? tous.filter(masque) : tous.filter(f => !masque(f));
    const nbC = tous.filter(masque).length;
    $('#mdNbC').textContent = nbC ? '(' + nbC + ')' : '';
    $('#mdPetit').classList.toggle('on', M.petit); $('#mdCaches').classList.toggle('on', M.voirCaches);
    $('#mdGrille').classList.toggle('petit', M.petit);
    const tag = f => { if (f.dc) return `<button class="md-tag vide" data-tag="${esc(f.id)}" title="Copier dans le Drive et étiqueter">⤓ Ranger dans le Drive</button>`;
      const ms = BK.etiquettes.morceauxDe({ ...f, dossiers: f.dossiers || M.pile.map(p => p.nom) }, M.morceaux, M.tags), l = BK.etiquettes.liste(M.tags, f.id);
      const main = l.some(BK.etiquettes.estMorceau), noms = [...ms.map(m => m.nom), ...l.filter(k => /^[a-z]:/.test(k)).map(k => (nomCase(k) || {}).nom).filter(Boolean)];
      return `<button class="md-tag${l.length ? ' main' : noms.length ? '' : ' vide'}" data-tag="${f.id}" title="${main || l.length ? 'Étiquettes choisies à la main' : noms.length ? 'Devinée par le nom' : 'Étiqueter'}">🏷 ${esc(noms.length ? noms.join(' · ') : 'Étiqueter')}</button>`; };
    $('#mdNb').textContent = String(fs.length).padStart(2, '0');
    $('#mdGrille').innerHTML = ds.map(d => `<button class="md-tuile md-dos" data-dos="${d.id}" data-nom="${esc(d.name)}"><span class="md-dos-ic">📁</span><span class="md-nom">${esc(d.name)}</span></button>`).join('')
      + (filtre || M.racine === 'discord' ? '' : `<button class="md-tuile md-plus" id="mdPlus"><span>+</span><span class="nt">Ajouter ici</span></button>`)
      + fs.map(f => {
        const video = /^video\//.test(f.mimeType), d = f.videoMediaMetadata && f.videoMediaMetadata.durationMillis;
        const etqs = f.dc ? [] : (() => { const ms = BK.etiquettes.morceauxDe({ ...f, dossiers: f.dossiers || M.pile.map(p => p.nom) }, M.morceaux, M.tags), l = BK.etiquettes.liste(M.tags, f.id);
          return [...ms.map(m => m.nom), ...l.filter(k => /^[a-z]:/.test(k)).map(k => (nomCase(k) || {}).nom).filter(Boolean)]; })();
        const main = !f.dc && BK.etiquettes.liste(M.tags, f.id).length;
        return `<div class="md-tuile${M.choisi === f.id ? ' choisie' : ''}" data-id="${f.id}" title="${esc(f.name)}" draggable="true">
          <div class="md-img${video ? ' video' : ''}">${f.thumbnailLink ? '<span class="spin"></span>' : `<span class="md-ext">${esc((f.name.split('.').pop() || '').toUpperCase())}</span>`}
            ${video ? `<span class="md-duree">${d ? BK.audio.temps(d / 1000).replace(/\.\d$/, '') : '▶'}</span>` : ''}
            ${etqs.length ? `<span class="md-sur">${etqs.slice(0, 3).map(n => `<em class="${main ? 'main' : ''}">${esc(n)}</em>`).join('')}${etqs.length > 3 ? `<em>+${etqs.length - 3}</em>` : ''}</span>`
              : f.dc ? '' : '<span class="md-sur vide"><em>sans étiquette</em></span>'}</div>
          <span class="md-nom">${esc(f.name)}</span>${tag(f)}
          <button class="md-x" data-x="${f.id}" title="Ranger dans la corbeille">✕</button></div>`;
      }).join('');
    $$('.md-dos').forEach(b => b.onclick = () => { M.pile.push({ id: b.dataset.dos, nom: b.dataset.nom }); charger(); });
    if (!filtre && M.racine !== 'discord') $('#mdPlus').onclick = e => menuAjout(e.currentTarget);
    $$('.md-tag').forEach(b => b.onclick = e => { e.stopPropagation(); menuTag(b); });
    $$('.md-tuile[data-id]').forEach(t => { t.ondragstart = e => {
      const pris = M.sel.has(t.dataset.id) ? [...M.sel] : [t.dataset.id];           // on glisse toute la sélection
      e.dataTransfer.setData('text/bk-media', pris.join(',')); e.dataTransfer.effectAllowed = 'link'; $('#mdPaniers').classList.add('actif');
      if (pris.length > 1) msg(pris.length + ' fichiers : lâche-les sur une étiquette'); };
      t.ondragend = () => $('#mdPaniers').classList.remove('actif'); });
    $$('.md-tuile[data-id]').forEach(t => t.ondblclick = e => { const f = M.fichiers.find(x => x.id === t.dataset.id); f && BK.ouvrirLien(f.webViewLink); });
    $$('.md-tuile[data-id]').forEach(t => t.oncontextmenu = e => {              // clic droit : le menu des étiquettes
      e.preventDefault();
      if (!M.sel.has(t.dataset.id)) { M.sel.clear(); M.sel.add(t.dataset.id); M.choisi = t.dataset.id; majSel(); }
      const f = M.fichiers.find(x => x.id === t.dataset.id);
      if (f && f.dc) return menuTag({ dataset: { tag: 'dc:' + f.id }, getBoundingClientRect: () => t.getBoundingClientRect() });
      menuTag(t, { x: e.clientX, y: e.clientY }); });
    $$('.md-tuile[data-id]').forEach(t => t.onclick = e => { if (e.target.closest('.md-x,.md-tag')) return;
      const id = t.dataset.id, ids = $$('.md-tuile[data-id]').map(x => x.dataset.id);
      if (e.shiftKey && M.dernier) {                                   // Maj : toute la plage
        const a = ids.indexOf(M.dernier), b = ids.indexOf(id);
        if (a >= 0 && b >= 0) for (const x of ids.slice(Math.min(a, b), Math.max(a, b) + 1)) M.sel.add(x);
      } else if (e.ctrlKey || e.metaKey) { M.sel.has(id) ? M.sel.delete(id) : M.sel.add(id); }
      else { const seul = M.sel.size === 1 && M.sel.has(id); M.sel.clear(); if (!seul) M.sel.add(id); }
      M.dernier = id; M.choisi = M.sel.size === 1 ? [...M.sel][0] : null;
      majSel();
      if (M.sel.size === 1) msg('Clique une étiquette en bas (ou glisse la photo dessus)');
      else if (M.sel.size > 1) msg(M.sel.size + ' fichiers choisis · clique une étiquette ou glisse-les dessus');
    });
    $$('.md-x').forEach(b => b.onclick = async () => {
      const f = M.fichiers.find(x => x.id === b.dataset.x); if (!f) return;
      if (f.dc) return msg('Les fichiers Discord ne se masquent pas d\'ici');
      if (M.voirCaches) { await BK.etiquettes.basculer(f.id, 'c:masque', false); M.tags = await BK.etiquettes.tous(); msg('Remis en place'); return rendre(!!M.filtre); }
      await BK.etiquettes.basculer(f.id, 'c:masque', true); M.tags = await BK.etiquettes.tous();   // mis de côté : rien n'est effacé
      msg(`« ${f.name} » masqué · « 🙈 Masqués » pour le revoir`); rendre(!!M.filtre);
    });
    (async () => { for (const f of fs) {                               // vignettes une par une : léger
      if (!f.thumbnailLink) continue; const u = f.dc ? f.thumbnailLink + '?width=320&height=320' : await BK.drive.vignette(f), el = $(`.md-tuile[data-id="${CSS.escape(f.id)}"] .md-img`);
      if (el) { const sp = $('.spin', el); sp && sp.remove(); if (u) el.style.backgroundImage = `url(${u})`; }
    } })();
  }

  // ---------- choisir l'étiquette d'un fichier ----------
  // b : le bouton 🏷 (ou une tuile) ; pos : où ouvrir le menu (clic droit) ; si plusieurs fichiers sont choisis, l'étiquette va sur tous
  function menuTag(b, pos) {
    $$('.md-menu').forEach(x => x.remove());
    const idB = b.dataset.tag || b.dataset.id;
    if (String(idB).startsWith('dc:')) { M.choisi = idB; return msg('Clique une étiquette en bas (Morceaux, Tournage…) : le fichier ira dans le Drive'); }
    const id = idB, r = b.getBoundingClientRect(), menu = document.createElement('div'); menu.className = 'md-menu';
    const tous = M.sel.size > 1 && M.sel.has(id) ? [...M.sel] : [id];
    const x0 = pos ? pos.x : r.left, y0 = pos ? pos.y : r.bottom + 4;
    menu.style.left = Math.min(x0, innerWidth - 230) + 'px'; menu.style.top = Math.min(y0, innerHeight - 320) + 'px';
    const rubs = cases();
    const dessiner = () => { const l = BK.etiquettes.liste(M.tags, id);
      menu.innerHTML = (tous.length > 1 ? `<span class="md-menu-t" style="color:#ffb23e">${tous.length} fichiers choisis</span>` : '')
        + [['morceaux', 'Morceaux'], ['tournage', 'Tournage'], ['lumiere', 'Lumière / scène'], ['reseaux', 'Réseaux']].map(([r, t]) => `<span class="md-menu-t">${t}</span>`
        + rubs[r].map(c => `<button data-m="${esc(c.k)}"${l.includes(c.k) ? ' class="on"' : ''}>${l.includes(c.k) ? '☑' : '☐'} ${esc(c.nom)}</button>`).join('')).join('')
        + `<span class="md-menu-t"></span><button data-m="-"${l.includes('-') ? ' class="on"' : ''}>— Aucun morceau</button>${l.length ? '<button data-m="">↺ Tout enlever (deviner par le nom)</button>' : ''}`; };
    dessiner();
    document.body.appendChild(menu);
    const fermer = e => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('pointerdown', fermer, true); } };
    setTimeout(() => document.addEventListener('pointerdown', fermer, true));
    menu.onclick = async e => { const x = e.target.closest('[data-m]'); if (!x) return; const k = x.dataset.m;
      if (k === '' || k === '-') { const d = await BK.etiquettes.charger(); for (const i of tous) { if (k) d.map[i] = ['-']; else delete d.map[i]; } await BK.db.ecrire('config', d); menu.remove(); }
      else { const l = BK.etiquettes.liste(M.tags, id), mettre = !l.includes(k); for (const i of tous) await BK.etiquettes.basculer(i, k, mettre); }
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
  $('#mdMajDc').onclick = () => { M.majDiscord = true; chargerDiscord(); };
  $('#mdPetit').onclick = () => { M.petit = !M.petit; BK.regler('medias.petit', M.petit); rendre(!!M.filtre); };
  $('#mdCaches').onclick = () => { M.voirCaches = !M.voirCaches; msg(M.voirCaches ? 'Les fichiers masqués · ✕ pour les remettre' : 'PRÊT'); rendre(!!M.filtre); };
  $('#mdAjout').onclick = () => $('#mdInput').click();
  // ---------- 🍞 Miette regarde les photos et propose une case ----------
  $('#mdTrier').onclick = async () => {
    if (!BK.drive.relie()) return msg('Relie d\'abord le Drive');
    if (!await BK.ia.pret()) return msg('Allume l\'AI et ajoute la clé Gemini (Réglages)');
    if (M.racine === 'discord') return msg('Dans Discord, range d\'abord les fichiers dans le Drive');
    const sansTag = x => /^image\//.test(x.mimeType || '') && !BK.etiquettes.liste(M.tags, x.id).length;
    let l = (M.fichiers || []).filter(sansTag);
    if (!l.length) { msg('Miette cherche les photos sans étiquette…'); await BK.dossiers.assurer(); l = (await BK.dossiers.tousFichiers()).filter(sansTag); }
    if (!l.length) return msg('Rien à ranger : toutes les photos ont déjà une étiquette');
    const b = $('#mdTrier'); b.disabled = true; b.innerHTML = '<span class="spin"></span>Miette regarde…';
    let props = [];
    try { props = await BK.trierMedias(l, { avancement: (k, n) => msg(`Miette regarde ${k}/${n} photo(s)…`) }); }
    catch (e) { msg(e.message); }
    b.disabled = false; b.textContent = '🍞 Trier avec Miette';
    if (!props.length) return msg('Rien à ranger : tout est déjà étiqueté');
    montrerPropositions(props);
  };
  function montrerPropositions(props) {
    const v = document.createElement('div'); v.className = 'voile ex-voile';
    v.innerHTML = `<div class="ex-box"><div class="ex-tete"><span class="lb">🍞 Miette propose de ranger ${props.length} photo(s)</span><button class="btn xs" data-tr="x">✕</button></div>
      <div class="ex-liste md-dc" id="trL">${props.map((p, i) => `<button class="md-dc-t on" data-tri="${i}" title="${esc(p.f.name)}">
          <span class="md-dc-img"><span class="spin"></span></span>
          <span class="md-nom">${esc(p.nom)}${p.morceau ? ' · ' + esc(p.morceau.nom) : ''}</span>
          <span class="nt">${esc(p.pourquoi)}</span></button>`).join('')}</div>
      <div class="ex-pied"><span class="nt" id="trInfo">Décoche ce qui ne va pas, puis « Ranger ».</span><button class="btn" data-tr="x">Annuler</button><button class="btn pri" data-tr="ok">Ranger</button></div></div>`;
    document.body.appendChild(v);
    const non = new Set();
    (async () => { for (let i = 0; i < props.length; i++) { const u = await BK.drive.vignette(props[i].f), el = v.querySelector(`[data-tri="${i}"] .md-dc-img`); if (el) el.innerHTML = u ? `<img src="${u}" draggable="false">` : '🖼'; } })();
    v.addEventListener('click', async e => {
      const t = e.target.closest('[data-tri]'), a = e.target.closest('[data-tr]');
      if (t) { const i = t.dataset.tri; non.has(i) ? non.delete(i) : non.add(i); t.classList.toggle('on', !non.has(i));
        v.querySelector('#trInfo').textContent = (props.length - non.size) + ' photo(s) à ranger'; return; }
      if (!a) return; if (a.dataset.tr === 'x') return v.remove();
      const garde = props.filter((p, i) => !non.has(String(i)));
      v.remove(); let n = 0;
      for (const p of garde) { try { await BK.etiquettes.basculer(p.f.id, p.cle, true); if (p.morceau) await BK.etiquettes.basculer(p.f.id, p.morceau.id, true); n++; } catch (er) {} }
      M.tags = await BK.etiquettes.tous(); msg(n + ' photo(s) rangée(s) ✓'); paniers(); rendre(!!M.filtre);
    });
  }
  // « + Ajouter ici » : depuis ce PC, depuis le Drive ou depuis Discord
  function menuAjout(el) {
    $$('.md-menu').forEach(x => x.remove());
    const r = el.getBoundingClientRect(), menu = document.createElement('div'); menu.className = 'md-menu';
    menu.style.left = Math.min(r.left, innerWidth - 230) + 'px'; menu.style.top = Math.min(r.top + 30, innerHeight - 160) + 'px';
    menu.innerHTML = '<button data-aj="pc">💻 Depuis ce PC…</button><button data-aj="drive">☁ Depuis le Drive…</button><button data-aj="discord">🍞 Depuis Discord…</button>';
    document.body.appendChild(menu);
    const fermer = e => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('pointerdown', fermer, true); } };
    setTimeout(() => document.addEventListener('pointerdown', fermer, true));
    menu.onclick = async e => { const b = e.target.closest('[data-aj]'); if (!b) return; menu.remove();
      if (b.dataset.aj === 'pc') $('#mdInput').click();
      if (b.dataset.aj === 'discord') ajoutDepuisDiscord();
      if (b.dataset.aj === 'drive') depuisDrive(); };
  }
  // copier des fichiers du Drive dans le dossier ouvert (une copie : l'original ne bouge pas)
  async function depuisDrive() {
    const cur = ici(); if (!cur) return msg('Ouvre d\'abord un dossier');
    const l = await BK.explorerDrive({ titre: 'Copier dans « ' + cur.nom + ' »', mode: 'images', depart: 'photovideo' }); if (!l || !l.length) return;
    let n = 0;
    for (const f of l) { try { msg(`Copie ${++n}/${l.length}…`); await BK.drive.api(`/files/${f.id}/copy?fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: f.name, parents: [cur.id] }) }); } catch (e) { msg('Copie impossible : ' + f.name); } }
    BK.dossiers.oublier(); msg(l.length + ' fichier(s) copié(s) ici'); charger();
  }
  // ---------- ajouter depuis Discord : les photos et vidéos postées dans le salon « media » (et voisins) ----------
  async function ajoutDepuisDiscord() {
    const cur = M.filtre ? await dossierPour(M.filtre) : ici(); if (!cur) return msg('Ouvre d\'abord un dossier');
    const v = document.createElement('div'); v.className = 'voile ex-voile';
    v.innerHTML = `<div class="ex-box"><div class="ex-tete"><span class="lb">🍞 Photos et vidéos de Discord → ${esc(cur.nom)}</span><button class="btn xs" data-dc="x">✕</button></div>
      <div class="ex-liste md-dc" id="mdDcL"><span class="nt"><span class="spin"></span>Miette regarde les salons « media »…</span></div>
      <div class="ex-pied"><span class="nt" id="mdDcInfo">Clique les fichiers à ajouter (Maj + clic : tous ceux entre les deux).</span><button class="btn" data-dc="tout">Tout sélectionner</button><button class="btn" data-dc="x">Annuler</button><button class="btn pri" data-dc="ok" disabled>Ajouter dans le Drive</button></div></div>`;
    document.body.appendChild(v);
    const choisis = new Set(); let l = [], dernierClic = null;
    const majChoix = () => { $$('[data-dci]', v).forEach(t => t.classList.toggle('on', choisis.has(t.dataset.dci)));
      $('#mdDcInfo', v).textContent = choisis.size ? choisis.size + ' fichier(s) choisi(s)' : 'Clique les fichiers à ajouter (Maj + clic : tous ceux entre les deux).'; $('[data-dc="ok"]', v).disabled = !choisis.size;
      const t = $('[data-dc="tout"]', v); if (t) t.textContent = choisis.size && choisis.size === $$('[data-dci]', v).length ? 'Tout désélectionner' : 'Tout sélectionner'; };
    const fermer = () => v.remove();
    v.addEventListener('click', async e => {
      const a = e.target.closest('[data-dc]'), t = e.target.closest('[data-dci]');
      if (t) { const id = t.dataset.dci, tous = $$('[data-dci]', v).map(x => x.dataset.dci);
        if (e.shiftKey && dernierClic && tous.includes(dernierClic)) { const [i, j] = [tous.indexOf(dernierClic), tous.indexOf(id)].sort((a, b) => a - b); for (const k of tous.slice(i, j + 1)) choisis.add(k); }
        else choisis.has(id) ? choisis.delete(id) : choisis.add(id);
        dernierClic = id; majChoix(); return; }
      if (!a) return; if (a.dataset.dc === 'x') return fermer();
      if (a.dataset.dc === 'tout') { const tous = $$('[data-dci]', v).map(x => x.dataset.dci); if (choisis.size === tous.length) choisis.clear(); else tous.forEach(k => choisis.add(k)); return majChoix(); }
      if (a.dataset.dc === 'ok') {
        const fs = l.filter(x => choisis.has(x.id)); fermer(); msg('Téléchargement depuis Discord…'); const blobs = [];
        for (const f of fs) { try { const r = await BK.discord.fetch(f.url); if (!r.ok) throw 0; blobs.push(new File([await r.blob()], f.nom, { type: f.video ? 'video/mp4' : 'image/jpeg' })); } catch (er) { msg('Impossible de récupérer ' + f.nom); } }
        if (blobs.length) envoyer(blobs, M.filtre || '');
      }
    });
    try { l = await BK.discord.medias(); } catch (er) { $('#mdDcL', v).innerHTML = `<span class="nt">${esc(er.message)}</span>`; return; }
    const deja = new Set((M.fichiers || []).map(f => f.name));
    $('#mdDcL', v).innerHTML = l.length ? l.slice(0, 200).map(f => `<button class="md-dc-t${deja.has(f.nom) ? ' deja' : ''}" data-dci="${f.id}" title="${esc(f.texte || f.nom)}">
        <span class="md-dc-img">${f.video ? '<span>▶</span>' : `<img src="${esc(f.apercu)}?width=240&height=240" loading="lazy" draggable="false" referrerpolicy="no-referrer">`}</span>
        <span class="md-nom">${esc(f.nom)}</span><span class="nt">${esc(f.qui)} · #${esc(f.salon)} · ${new Date(f.t).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' })}${deja.has(f.nom) ? ' · déjà ici' : ''}</span></button>`).join('')
      : '<span class="nt">Aucune photo ni vidéo trouvée dans les salons « media ». Vérifie que Miette a le droit de lire ce salon.</span>';
  }
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
