// =====================================================================
// ASSISTANT VISUEL POST — comme l'Assistant visuel Reel, mais pour des PHOTOS :
//   plusieurs photos = un carrousel Instagram · format (carré, portrait 4:5, story)
//   recadrer (zoom + glisser) · couleur (LUT .cube) · aperçu « dans Instagram »
//   export : une image JPG par photo, prête à publier (1080 px de large)
// =====================================================================
(() => {
// les presets : un nom → un filtre couleur (et son intensité), un effet (et son intensité), contraste / lumière / saturation, un cadre (et sa taille)
// Pour en ajouter un : une ligne de plus ici. Les noms de filtres et d'effets sont ceux des menus (BK.filtres, BK.rendu.VOILES).
const PRESETS = [
  { nom: 'Été 70',             filtre: 'Vintage 70s',   force: 80,  voile: 'kodak',     voileK: 60, regl: { contraste: 5, lumiere: 5, saturation: 10 },  cadre: 'ancienne',  cadreT: 30 },
  { nom: 'Souvenir Polaroid',  filtre: 'Délavé',        force: 60,  voile: 'polaroid',  voileK: 80, regl: { contraste: -10, lumiere: 5, saturation: -10 }, cadre: 'polaroid', cadreT: 40 },
  { nom: 'Super 8 chaud',      filtre: 'Chaud',         force: 70,  voile: 'super8',    voileK: 70, regl: { contraste: 10 },                              cadre: 'pellicule', cadreT: 30 },
  { nom: 'Diapo 70',           filtre: 'Vintage 70s',   force: 70,  voile: 'kodak',     voileK: 50, regl: { saturation: 10 },                             cadre: 'diapo',     cadreT: 40 },
  { nom: 'Coucher de soleil',  filtre: 'Chaud',         force: 100, voile: 'lumiere2',  voileK: 70, regl: { contraste: 5, lumiere: 5, saturation: 15 },  cadre: 'polaroid',  cadreT: 20 },
  { nom: 'Rose néon',          filtre: 'Froid',         force: 40,  voile: 'lumiere3',  voileK: 70, regl: { contraste: 10, saturation: 10 },               cadre: '',          cadreT: 40 },
  { nom: 'Pellicule brûlée',   filtre: 'Pellicule',     force: 80,  voile: 'brulure',   voileK: 70, regl: { contraste: 5 },                               cadre: 'pellicule', cadreT: 35 },
  { nom: 'Rêve doux',          filtre: 'Délavé',        force: 50,  voile: 'halo',      voileK: 70, regl: { lumiere: 10, saturation: -15 },               cadre: 'polaroid',  cadreT: 25 },
  { nom: 'Ciné teal & orange', filtre: 'Teal & orange', force: 90,  voile: 'grain',     voileK: 40, regl: { contraste: 10 },                              cadre: 'negatif',   cadreT: 20 },
  { nom: 'Cassette VHS',       filtre: 'Pop',           force: 50,  voile: 'vhs',       voileK: 70, regl: { saturation: -10 },                            cadre: '',          cadreT: 40 },
  { nom: 'Vieux sépia',        filtre: '',              force: 100, voile: 'sepia',     voileK: 90, regl: { contraste: -5, lumiere: 5 },                  cadre: 'ancienne',  cadreT: 50 },
  { nom: 'Argentique N&B',     filtre: 'N&B contrasté', force: 100, voile: 'nb',        voileK: 60, regl: { contraste: 10 },                              cadre: 'negatif',   cadreT: 30 },
  { nom: 'Tout enlever',       filtre: '',              force: 100, voile: '',          voileK: 100, regl: {},                                            cadre: '',          cadreT: 40 },
];
const FORMATS = {
  story:    { nom: 'Story 9:16',   L: 1080, H: 1920 },
  portrait: { nom: 'Portrait 4:5', L: 1080, H: 1350 },
  carre:    { nom: 'Carré 1:1',    L: 1080, H: 1080 },
  paysage:  { nom: 'Paysage',      L: 1080, H: 566 },
};
const P = { format: 'story', slides: [], i: 0, lut: null, lutNom: '', legende: '', nom: 'post' };   // pas de projet en cours : on part en 9:16
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

BK.module('postvis', function (page) {
  $('.sub', page).textContent = 'Photos et carrousels Instagram : recadrer, couleur, aperçu, export';
  $('.hdr .right', page).innerHTML = `<div><span class="eng" style="font-size:9px">Photos</span><span class="vfd" id="pvNb">00</span></div>
    <div><span class="eng" style="font-size:9px">Format</span><span class="vfd" id="pvFmtH">4:5</span></div>`;
  $('.grid', page).innerHTML = `
    <div class="cols">
      <section class="pane vit rv-vit">
        <div class="rv-scene">
          <div class="pv-tel"><div class="pv-app">
            <div class="pv-tete"><span class="rv-avatar petit"></span><b>beeskot</b><span class="pv-pts">⋯</span></div>
            <div class="pv-ecran" id="pvEcran"><canvas id="pvCanvas"></canvas>
              <div class="rv-vide" id="pvVide"><span class="dymo">Glisse des photos ici</span><span class="nt">JPG, PNG… depuis ce PC · ou :</span><div class="gd" id="pvGal"><button class="btn sm pri" id="pvGalB">🖼 Choisir dans Médias…</button></div></div>
              <button class="pv-fl g" id="pvPrec">‹</button><button class="pv-fl d" id="pvSuiv">›</button><span class="pv-num" id="pvNum"></span></div>
            <div class="pv-icones"><span>♡</span><span>💬</span><span>➤</span><span class="pv-points" id="pvPoints"></span><span style="margin-left:auto">⌑</span></div>
            <div class="pv-legende"><b>beeskot</b> <span id="pvLegAff">La légende du post…</span></div>
          </div></div>
          <div class="rv-cote">
            <div class="box"><div class="ligne-titre"><span class="lb">Les photos (ordre du carrousel)</span>
                <span class="nt" style="margin:0 0 0 auto">Clique une photo pour la régler · ‹ › pour l'ordre</span>
                <button class="btn sm pri" id="pvAjout" style="flex:none">+ Ajouter des photos</button><input type="file" id="pvInput" accept="image/*" multiple hidden></div>
              <div class="pv-bande" id="pvBande"></div></div>
            <div class="box"><div class="ligne-titre"><span class="lb">De quoi parle le post ?</span>
                <button class="btn sm pv-sujet-b" id="pvSujetB" style="margin-left:auto">Choisir ▾</button><input type="hidden" id="pvSujet" value=""></div></div>
            <div class="box"><span class="lb">Recadrer et couleur</span>
              <div class="pv-tab">
                <span class="eng">Cadrage</span>
                <div class="pv-seg"><button id="pvEntier" title="Voir toute la photo, avec des bandes noires">⤢ Entière</button><button id="pvRemplir" title="La photo remplit le cadre, les bords sont coupés">⤡ Remplir</button><button id="pvCentre" title="Remettre au centre, sans zoom">⊙ Centrer</button></div>
                <span class="eng">Tourner</span>
                <div class="pv-ligne pv-rot"><button class="btn xs" id="pvRotG" title="Un quart de tour à gauche">⟲ 90°</button>
                  <input type="range" id="pvRot" min="-180" max="180" step="1" value="0" title="Pencher la photo (double-clic : remettre droit)"><span class="vfd" id="pvRotV">0°</span>
                  <button class="btn xs" id="pvRotD" title="Un quart de tour à droite">90° ⟳</button></div>
                <span class="eng">Preset</span>
                <div class="pv-ligne"><select class="fld" id="pvPreset" title="Couleur, effet et réglages d'un coup (tu peux tout retoucher après)"><option value="">Choisir un preset…</option>${PRESETS.map((x, i) => `<option value="${i}">${x.nom}</option>`).join('')}</select></div>
                <span class="eng">Réglages</span>
                <div class="pv-ligne pv-regl"><span class="eng">Zoom</span><input class="fld rv-glisse" id="pvZoom" value="0 %" title="Clic maintenu et glisse la souris (ou double-clic pour taper) · glisse l'image dans l'aperçu pour la déplacer"><span class="eng">Contraste</span><input class="fld rv-glisse" id="pvCon" title="Clic maintenu et glisse la souris (ou double-clic pour taper)"><span class="eng">Lumière</span><input class="fld rv-glisse" id="pvLum" title="Clic maintenu et glisse la souris (ou double-clic pour taper)"><span class="eng">Saturation</span><input class="fld rv-glisse" id="pvSat" title="Clic maintenu et glisse la souris (ou double-clic pour taper)"></div>
                <span class="eng">Couleur</span>
                <div class="pv-ligne"><select class="fld" id="pvFiltre">${['', ...BK.filtres.map(f => f.nom)].map(n => `<option value="${n}">${n || 'Aucun filtre'}</option>`).join('')}<option value="__lut">＋ Ajouter une LUT (.cube)…</option></select>
                  <span class="eng" style="margin-left:6px">Intensité</span><input class="fld rv-glisse pv-force" id="pvForce" value="100 %" title="Clic maintenu et glisse la souris (ou double-clic pour taper)"></div>
                <span class="eng">Effet</span>
                <div class="pv-ligne"><select class="fld" id="pvVoile">${BK.rendu.VOILES.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select>
                  <span class="eng" style="margin-left:6px">Intensité</span><input class="fld rv-glisse pv-force" id="pvVoileK" value="100 %" title="Clic maintenu et glisse la souris (ou double-clic pour taper)"></div>
                <span class="eng">Cadre</span>
                <div class="pv-ligne"><select class="fld" id="pvCadre">${BK.rendu.CADRES.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select>
                  <span class="eng" style="margin-left:6px">Taille</span><input class="fld rv-glisse pv-force" id="pvCadreT" value="40 %" title="Clic maintenu et glisse la souris (ou double-clic pour taper)"></div>
              </div>
              <input type="file" id="pvLutIn" accept=".cube" hidden></div>
            <div class="box pv-leg-box"><span class="lb">Légende</span>
              <textarea class="fld" id="pvLeg" rows="3" placeholder="Le texte du post, les hashtags…"></textarea>
              <div class="pv-idees-l"><select class="fld" id="pvMorceau"><option value="">Morceau (pour l'AI)…</option></select><input class="fld" id="pvIdee" placeholder="ce que montre le post (facultatif)"></div>
              <div class="chips" style="margin-top:8px"><button class="chip" id="pvRenfort">✨ Idées de légende</button><button class="chip" id="pvCopier">Copier la légende</button></div>
              <div class="pv-idees" id="pvIdees"></div></div>
          </div>
        </div>
      </section>
      <section class="pane reg"><span class="ptitle">Réglages</span>
        <div class="box"><span class="lb">Format</span>
          <div class="chips" style="margin-top:10px" id="pvFmt">${Object.entries(FORMATS).map(([k, f]) => `<button class="chip" data-f="${k}">${f.nom}</button>`).join('')}</div>
          <span class="nt">Instagram : <b>Portrait 4:5</b> prend le plus de place dans le fil. Toutes les photos d'un carrousel ont le même format.</span></div>
        <div class="box"><span class="lb">Nom du post</span><input class="fld" id="pvNom" value="post" style="margin-top:8px"></div>
        <div class="box"><span class="lb">Export</span></div>
      </section>
    </div>
    <div class="box re-faits hidden" id="pvFaits" style="margin:0 0 8px"></div>
    <div class="pane abar"><span class="vfd" id="pvMsg">AJOUTE DES PHOTOS</span>
      <div class="right"><button class="btn pri" id="pvExport" disabled>Exporter les images ▶</button></div></div>`;

  const msg = t => $('#pvMsg').textContent = String(t).toUpperCase().slice(0, 90);
  const cv = $('#pvCanvas'), ecran = $('#pvEcran'), c2 = cv.getContext('2d');
  let r = null;
  const F = () => FORMATS[P.format], S = () => P.slides[P.i];

  // le téléphone tient toujours dans la fenêtre (story 9:16 comprise) : la hauteur libre décide de la taille de l'écran
  function taille() {
    const f = F(), sc = $('.rv-scene', page), dispo = Math.max(220, (sc ? sc.clientHeight : 600) - 150);
    const h = Math.min(520, dispo), w = Math.min(380, Math.round(h * f.L / f.H));
    ecran.style.maxHeight = 'none'; ecran.style.maxWidth = 'none'; ecran.style.width = w + 'px'; ecran.style.height = Math.round(w * f.H / f.L) + 'px'; const tel = $('.pv-tel', page); if (tel) tel.style.width = Math.max(300, w + 20) + 'px';
  }
  window.addEventListener('resize', () => { if (!page.classList.contains('hidden')) taille(); });
  function moteur() {
    const f = F(), k = 0.5; cv.width = Math.round(f.L * k); cv.height = Math.round(f.H * k);
    r = BK.rendu.creer(cv.width, cv.height); r.lut(P.lut); r.reglages(P.regl);
    ecran.style.aspectRatio = `${f.L} / ${f.H}`;
    taille();
    $('#pvFmtH').textContent = f.nom.split(' ').pop(); $$('#pvFmt .chip').forEach(c => c.classList.toggle('on', c.dataset.f === P.format));
  }
  // « photo entière » : le moteur remplit le cadre par défaut ; ce zoom-là montre toute la photo
  // la photo tournée d'un quart de tour (0, 90, 180, 270°) : une copie gardée tant que l'angle ne change pas
  function tournee(s) {
    const rot = ((s.rot || 0) % 360 + 360) % 360; if (!rot) return s.img;
    if (s._tour && s._tour.rot === rot) return s._tour.c;
    const w = s.img.naturalWidth || s.img.width, h = s.img.naturalHeight || s.img.height, c = document.createElement('canvas'), a = rot * Math.PI / 180;
    // n'importe quel angle : la toile s'agrandit pour garder toute la photo (les coins vides restent noirs)
    c.width = Math.round(Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a))); c.height = Math.round(Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a)));
    const x = c.getContext('2d'); x.translate(c.width / 2, c.height / 2); x.rotate(rot * Math.PI / 180); x.drawImage(s.img, -w / 2, -h / 2);
    s._tour = { rot, c }; return c;
  }
  function zoomEntier(img) {
    const f = F(), vw = img.naturalWidth || img.width, vh = img.naturalHeight || img.height;
    if (!vw || !vh) return 100;
    return Math.round(Math.min(f.L / vw, f.H / vh) / Math.max(f.L / vw, f.H / vh) * 100);
  }
  // une photo très différente du cadre (une 16:9 dans un 4:5) serait coupée de moitié : on la montre entière
  function cadrageDepart(img) {
    const z = zoomEntier(img);
    return z < 80 ? z : 100;
  }
  function dessiner() {
    const s = S(); $('#pvVide').classList.toggle('hidden', !!s);
    if (!s) { c2.clearRect(0, 0, cv.width, cv.height); return; }
    r.dessiner(tournee(s), { zoom: s.zoom / 100, x: s.x, y: s.y }, (P.force ?? 100) / 100, '', P.voile ? { type: P.voile, t: 0, k: (P.voileK ?? 100) / 100 } : null); BK.rendu.cadre(c2, r.sortie, cv.width, cv.height, P.cadre || '', P.cadreT ?? 40, P.i);
    $('#pvZoom').value = (s.zoom - 100) + ' %';
  }
  function majTout() {
    try { majRot(); } catch (e) {}
    $('#pvNb').textContent = String(P.slides.length).padStart(2, '0');
    $('#pvExport').disabled = !P.slides.length;
    $('#pvNum').textContent = P.slides.length > 1 ? `${P.i + 1}/${P.slides.length}` : '';
    $('#pvPoints').innerHTML = P.slides.length > 1 ? P.slides.map((_, k) => `<i class="${k === P.i ? 'on' : ''}"></i>`).join('') : '';
    $('#pvPrec').classList.toggle('hidden', P.i <= 0); $('#pvSuiv').classList.toggle('hidden', P.i >= P.slides.length - 1);
    $('#pvBande').innerHTML = P.slides.map((s, k) => `<div class="pv-mini${k === P.i ? ' on' : ''}" data-k="${k}" style="background-image:url(${s.url})">
        <span class="pv-n">${k + 1}</span><span class="pv-mb"><button data-g="${k}">‹</button><button data-d="${k}">›</button><button data-x="${k}">✕</button></span></div>`).join('')
      || '<span class="nt">Aucune photo pour l\'instant.</span>';
    $$('.pv-mini').forEach(el => el.onclick = e => { if (e.target.closest('button')) return; P.i = +el.dataset.k; majTout(); });
    $$('[data-g]', $('#pvBande')).forEach(b => b.onclick = () => bouger(+b.dataset.g, -1));
    $$('[data-d]', $('#pvBande')).forEach(b => b.onclick = () => bouger(+b.dataset.d, 1));
    $$('[data-x]', $('#pvBande')).forEach(b => b.onclick = () => { const k = +b.dataset.x; URL.revokeObjectURL(P.slides[k].url); P.slides.splice(k, 1); P.i = Math.min(P.i, P.slides.length - 1); P.i = Math.max(0, P.i); majTout(); });
    dessiner();
  }
  function bouger(k, d) { const j = k + d; if (j < 0 || j >= P.slides.length) return; [P.slides[k], P.slides[j]] = [P.slides[j], P.slides[k]]; P.i = j; majTout(); }

  // ---------- ajouter des photos ----------
  function ajouter(fichiers) {
    const fs = [...fichiers].filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic)$/i.test(f.name)); if (!fs.length) return msg('Seulement des images');
    let reste = fs.length;
    for (const f of fs) {
      const url = URL.createObjectURL(f), img = new Image();
      img.onload = () => { P.slides.push({ img, url, nom: f.name, zoom: cadrageDepart(img), x: 0, y: 0 }); if (P.slides.length === 1 && P.nom === 'post') { P.nom = f.name.replace(/\.[^.]+$/, '').replace(/[^\w\- ]+/g, '').slice(0, 40) || 'post'; $('#pvNom').value = P.nom; }
        if (--reste === 0) { majTout(); msg(P.slides.length + ' photo(s)'); } };
      img.onerror = () => { if (--reste === 0) majTout(); msg('Image illisible : ' + f.name); };
      img.src = url;
    }
  }
  // ---------- le sujet : un menu qui se déroule (Morceaux ▸, Tournages ▸…) ----------
  (async () => { const g = await BK.etiquettes.sujets(); P.groupes = g; P.sujets = g.flatMap(x => x.l); })();
  const sujet = () => (P.sujets || []).find(c => c.k === $('#pvSujet').value);
  const changerSujet = k => { $('#pvSujet').value = k || ''; const c = sujet(); galerie();
    $('#pvSujetB').textContent = c ? c.nom + ' ▾' : 'Choisir ▾'; $('#pvSujetB').classList.toggle('pri', !!c);
    if (c && c.morceau && [...$('#pvMorceau').options].some(o => o.textContent === c.morceau.nom)) $('#pvMorceau').value = [...$('#pvMorceau').options].find(o => o.textContent === c.morceau.nom).value;
    msg(c ? 'Le post parle de « ' + c.nom + ' »' : 'PRÊT'); };
  $('#pvSujetB').onclick = async e => { if (!P.groupes) { P.groupes = await BK.etiquettes.sujets(); P.sujets = P.groupes.flatMap(x => x.l); }
    const r = e.currentTarget.getBoundingClientRect();
    BK.menuCascade({ x: r.left, y: r.bottom + 4 }, P.groupes.map(g => ({ nom: g.groupe, l: g.l })), k => changerSujet(k), { actuel: $('#pvSujet').value, aucun: '— Aucun sujet' }); };
  const telecharger = async f => new File([await (await BK.drive.api(`/files/${f.id}?alt=media`)).blob()], f.name, { type: f.mimeType || 'image/jpeg' });
  // ---------- « + Ajouter des photos » : la fenêtre Médias (dossiers, Discord, étiquettes) ----------
  async function ajouterChoisis(l) {
    msg('Chargement des photos…'); const fs = [];
    for (const x of l) { try {
      if (x.fichier) fs.push(x.fichier);
      else if (x.dc) { const r = await BK.discord.fetch(x.dc.url); if (!r.ok) throw new Error('expiré'); fs.push(new File([await r.blob()], x.nom, { type: x.mime || 'image/jpeg' })); }
      else fs.push(await telecharger(x.f));
    } catch (e) { msg('Illisible : ' + x.nom); } }
    ajouter(fs); }
  $('#pvAjout').onclick = async () => {
    if (!BK.drive.relie()) return $('#pvInput').click();                 // sans Drive : seulement ce PC
    const l = await BK.choisirDansMedias({ titre: 'Photos pour le post', bouton: 'Ajouter au post', type: 'image', sujet: $('#pvSujet').value });
    if (l && l.length) ajouterChoisis(l); };
  $('#pvInput').onchange = e => { ajouter(e.target.files); e.target.value = ''; };
  const galerie = () => {};                                     // l'écran vide propose la fenêtre Médias (plus de galerie à part)
  $('#pvGalB').onclick = e => { e.stopPropagation(); $('#pvAjout').click(); };
    page.addEventListener('dragover', e => { e.preventDefault(); ecran.classList.add('survol'); });
  page.addEventListener('dragleave', e => { if (e.target === page) ecran.classList.remove('survol'); });
  page.addEventListener('drop', async e => { e.preventDefault(); ecran.classList.remove('survol'); let fs = [...e.dataTransfer.files];
    if (!fs.length && BK.glisse.actif()) { fs = (await BK.glisse.fichiers(msg)).filter(f => /^image\//.test(f.type)); if (!fs.length) return msg('Seules les photos vont ici'); }   // venu de Médias
    if (!fs.length) return;
    const cube = fs.find(f => /\.cube$/i.test(f.name)); if (cube) return chargerLut(cube); ajouter(fs); });

  // ---------- navigation dans le carrousel ----------
  $('#pvPrec').onclick = () => { P.i = Math.max(0, P.i - 1); majTout(); };
  $('#pvSuiv').onclick = () => { P.i = Math.min(P.slides.length - 1, P.i + 1); majTout(); };
  document.addEventListener('keydown', e => {
    if (page.classList.contains('hidden') || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if (e.key === 'ArrowLeft') $('#pvPrec').click(); if (e.key === 'ArrowRight') $('#pvSuiv').click();
  });

  // ---------- recadrer : glisser l'image, zoom à la souris ----------
  let d0 = null;
  ecran.addEventListener('pointerdown', e => { const s = S(); if (!s || e.target.closest('button')) return; d0 = { x: e.clientX, y: e.clientY, sx: s.x, sy: s.y }; ecran.setPointerCapture(e.pointerId); });
  ecran.addEventListener('pointermove', e => { if (!d0) return; const s = S(), b = ecran.getBoundingClientRect(); s.x = d0.sx + (e.clientX - d0.x) / b.width * 100; s.y = d0.sy + (e.clientY - d0.y) / b.height * 100; dessiner(); });
  ecran.addEventListener('pointerup', () => d0 = null);
  const champ = $('#pvZoom'); champ.readOnly = true; let zg = null;
  const zoom = z => { const s = S(); if (!s) return; s.zoom = Math.round(Math.max(10, Math.min(400, z))); dessiner(); };
  champ.addEventListener('pointerdown', e => { if (!champ.readOnly || !S()) return; e.preventDefault(); champ.setPointerCapture(e.pointerId); zg = { x: e.clientX, y: e.clientY, z: S().zoom }; });
  champ.addEventListener('pointermove', e => { if (zg) zoom(zg.z + (e.clientX - zg.x) - (e.clientY - zg.y)); });
  champ.addEventListener('pointerup', () => { zg = null; });
  champ.addEventListener('dblclick', () => { if (!S()) return; champ.readOnly = false; champ.value = S().zoom - 100; champ.select(); });
  champ.addEventListener('blur', () => { if (champ.readOnly) return; champ.readOnly = true; const v = parseFloat(champ.value.replace(',', '.')); zoom(isNaN(v) ? S().zoom : 100 + v); });
  champ.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') champ.blur(); });
  ecran.addEventListener('wheel', e => { if (!S()) return; e.preventDefault(); zoom(S().zoom - Math.sign(e.deltaY) * 5); }, { passive: false });
  champ.addEventListener('wheel', e => { if (!S()) return; e.preventDefault(); zoom(S().zoom - Math.sign(e.deltaY) * 5); }, { passive: false });
  // ---------- intensité du filtre (0 à 100 %) : glisser la souris sur la case, ou double-clic pour taper ----------
  const fc = $('#pvForce'); fc.readOnly = true; let fg = null; P.force = P.force ?? 100;
  const force = v => { P.force = Math.round(Math.max(0, Math.min(100, v))); if (!P.enPreset) P.edite = true; fc.value = P.force + ' %'; dessiner(); };
  fc.addEventListener('pointerdown', e => { if (!fc.readOnly) return; e.preventDefault(); fc.setPointerCapture(e.pointerId); fg = { x: e.clientX, y: e.clientY, v: P.force }; });
  fc.addEventListener('pointermove', e => { if (fg) force(fg.v + ((e.clientX - fg.x) - (e.clientY - fg.y)) / 2); });
  fc.addEventListener('pointerup', () => { fg = null; });
  fc.addEventListener('dblclick', () => { fc.readOnly = false; fc.value = P.force; fc.select(); });
  fc.addEventListener('blur', () => { if (fc.readOnly) return; fc.readOnly = true; const v = parseFloat(fc.value.replace(',', '.')); force(isNaN(v) ? P.force : v); });
  fc.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') fc.blur(); });
  fc.addEventListener('wheel', e => { e.preventDefault(); force(P.force - Math.sign(e.deltaY) * 5); }, { passive: false });
  $('#pvEntier').onclick = () => { const s = S(); if (!s) return; s.zoom = zoomEntier(tournee(s)); s.x = 0; s.y = 0; dessiner(); majTout(); msg('Photo entière'); };
  $('#pvRemplir').onclick = () => { const s = S(); if (!s) return; s.zoom = 100; s.x = 0; s.y = 0; dessiner(); majTout(); msg('La photo remplit le cadre'); };
  $('#pvCentre').onclick = () => { const s = S(); if (!s) return; s.x = s.y = 0; s.zoom = 100; dessiner(); };
  const angle = s => { let a = ((s.rot || 0) % 360 + 360) % 360; return a > 180 ? a - 360 : a; };
  const majRot = () => { const s = S(), a = s ? angle(s) : 0; $('#pvRot').value = a; $('#pvRotV').textContent = a + '°'; };
  const poserRot = (a, quart) => { const s = S(); if (!s) return; s.rot = ((Math.round(a) % 360) + 360) % 360; s._tour = null;
    if (quart) { if (s.zoom < 100) s.zoom = zoomEntier(tournee(s)); s.x = 0; s.y = 0; }
    majRot(); dessiner(); };
  $('#pvRot').oninput = e => poserRot(+e.target.value);
  $('#pvRot').onchange = () => { majTout(); msg('Photo penchée : ' + angle(S() || {}) + '°'); };
  $('#pvRot').ondblclick = () => { poserRot(0, true); majTout(); };
  $('#pvRotG').onclick = () => { const s = S(); if (!s) return; poserRot(angle(s) - 90, true); majTout(); msg('Quart de tour à gauche'); };
  $('#pvRotD').onclick = () => { const s = S(); if (!s) return; poserRot(angle(s) + 90, true); majTout(); msg('Quart de tour à droite'); };


  // ---------- couleur : LUT ----------
  async function chargerLut(f) {
    try { P.lut = BK.rendu.lireCube(await f.text()); P.lutNom = f.name; r.lut(P.lut);
      const sel = $('#pvFiltre'); let o = sel.querySelector('option[data-lut]');
      if (!o) { o = document.createElement('option'); o.dataset.lut = '1'; sel.insertBefore(o, sel.querySelector('option[value="__lut"]')); }
      o.value = '__lutok'; o.textContent = '🎨 LUT : ' + f.name; sel.value = '__lutok';
      dessiner(); msg('LUT appliquée à toutes les photos'); }
    catch (e) { msg(e.message); $('#pvFiltre').value = ''; }
  }
  // contraste, lumière, saturation (pour toutes les photos, comme la couleur)
  P.regl = P.regl || { contraste: 0, lumiere: 0, saturation: 0 };
  const champsRegl = {};
  [['#pvCon', 'contraste'], ['#pvLum', 'lumiere'], ['#pvSat', 'saturation']].forEach(([id, k]) =>
    champsRegl[k] = BK.rendu.champGlisse($(id), { val: P.regl[k], change: v => { P.regl[k] = v; marquer(); r && r.reglages(P.regl); dessiner(); } }));
  // l'intensité de l'effet : de 0 (rien) à 100 % (plein effet)
  const champVoileK = BK.rendu.champGlisse($('#pvVoileK'), { min: 0, max: 100, val: 100, pas: 5, change: v => { P.voileK = v; marquer(); dessiner(); } });
  $('#pvVoileK').value = '100 %';
  // le cadre d'époque et sa taille (toutes les photos)
  const champCadreT = BK.rendu.champGlisse($('#pvCadreT'), { min: 0, max: 100, val: 40, pas: 5, change: v => { P.cadreT = v; marquer(); dessiner(); } });
  $('#pvCadre').onchange = e => { P.cadre = e.target.value; marquer(); dessiner(); msg(P.cadre ? 'Cadre : ' + e.target.selectedOptions[0].textContent + ' (toutes les photos)' : 'Sans cadre'); };
  $('#pvVoile').onchange = e => { P.voile = e.target.value; marquer(); dessiner(); msg(P.voile ? 'Effet : ' + e.target.selectedOptions[0].textContent + ' (toutes les photos)' : 'Sans effet'); };
  // ---------- PRESETS : couleur + effet + réglages d'un coup (tout reste retouchable ensuite) ----------
  P.edite = false;                                                // vrai dès qu'on touche à un réglage à la main
  const marquer = () => { if (!P.enPreset) P.edite = true; };
  $('#pvPreset').onchange = async e => { const x = PRESETS[+e.target.value]; e.target.value = ''; if (!x) return;
    if (P.edite && !(await BK.confirmer('Cela annulera tes réglages précédents (couleur, effet, cadre, contraste, lumière, saturation). Es-tu sûr ?'))) return;
    P.enPreset = true;
    const fl = $('#pvFiltre'); fl.value = x.filtre || ''; fl.onchange({ target: fl });
    force(x.force ?? 100);
    $('#pvVoile').value = x.voile || ''; P.voile = x.voile || ''; champVoileK.poser(x.voileK ?? 100);
    for (const k of ['contraste', 'lumiere', 'saturation']) champsRegl[k].poser((x.regl || {})[k] || 0);
    $('#pvCadre').value = x.cadre || ''; P.cadre = x.cadre || ''; champCadreT.poser(x.cadreT ?? 40);
    P.enPreset = false; P.edite = false;
    dessiner(); msg('Preset : ' + x.nom + ' (toutes les photos)'); };
  $('#pvLutIn').onchange = e => e.target.files[0] && chargerLut(e.target.files[0]);
  // filtres prêts à l'emploi (un clic) — ou sa propre LUT .cube
  let filtreAvant = '';
  $('#pvFiltre').onchange = e => { const n = e.target.value;
    if (n === '__lut') { e.target.value = filtreAvant; return $('#pvLutIn').click(); }      // « Ajouter une LUT » : on choisit le fichier
    if (n === '__lutok') return;
    filtreAvant = n; marquer(); P.lut = n ? BK.rendu.filtre(n) : null; P.lutNom = n; r && r.lut(P.lut); dessiner(); msg(n ? 'Filtre : ' + n : 'Sans filtre'); };

  // ---------- format, légende, nom ----------
  $$('#pvFmt .chip').forEach(c => c.onclick = () => { P.format = c.dataset.f; BK.regler('pv.format', P.format); moteur();
    for (const s of P.slides) if (s.zoom <= 100) s.zoom = cadrageDepart(tournee(s));      // on change de cadre : on ne coupe pas la photo sans le dire
    dessiner(); majTout(); });
  $('#pvLeg').oninput = e => { P.legende = e.target.value; $('#pvLegAff').textContent = P.legende.split('\n')[0] || 'La légende du post…'; };
  $('#pvLeg').addEventListener('keydown', e => e.stopPropagation());
  $('#pvCopier').onclick = async () => { await navigator.clipboard.writeText(P.legende); msg('Légende copiée'); };
  // ---------- idées de légende, ici même (Gemini ; sans clé : la demande est copiée) ----------
  (async () => { const ms = (await BK.db.liste('morceaux')).sort((a, b) => a.nom.localeCompare(b.nom));
    $('#pvMorceau').innerHTML = '<option value="">Morceau (pour l\'AI)…</option>' + ms.map(m => `<option>${esc(m.nom)}</option>`).join(''); })();
  $('#pvIdee').addEventListener('keydown', e => e.stopPropagation());
  $('#pvRenfort').onclick = async () => {
    const morceau = $('#pvMorceau').value, idee = $('#pvIdee').value.trim();
    const demande = `Écris 5 légendes courtes et différentes pour un post Instagram de BEESKOT (groupe de musique, prononcé « Biscotte »)${P.slides.length > 1 ? ', un carrousel de ' + P.slides.length + ' photos' : ''}${morceau ? ', pour le morceau « ' + morceau + ' »' : ''}${idee ? '. Le post montre : ' + idee : ''}${P.legende ? '. Brouillon actuel : « ' + P.legende + ' »' : ''}. Ton naturel, pas trop marketing, 1 ou 2 emojis maximum, et 6 à 8 hashtags pertinents à la fin de chaque légende. Réponds en JSON : un tableau de 5 textes.`;
    const z = $('#pvIdees');
    if (!BK.ia || !(await BK.ia.pret())) { try { await navigator.clipboard.writeText(demande); } catch (e) {} z.innerHTML = '<span class="nt">Pas de clé Gemini (ou AI coupée) : la demande est copiée, colle-la dans ChatGPT ou Gemini.</span>'; return; }
    const b = $('#pvRenfort'); b.disabled = true; const t0 = Date.now();
    const attente = () => { z.innerHTML = `<span class="nt pv-reflechit"><span class="spin"></span>🍞 Miette réfléchit à tes légendes… ${Math.round((Date.now() - t0) / 1000)} s</span>`; };
    attente(); const tic = setInterval(attente, 1000);
    try {
      const r = await BK.ia.demander(demande, { prio: true, json: true, vite: true, temperature: 0.8, delai: 60 });
      const tab = Array.isArray(r) ? r : (r && (r.legendes || Object.values(r).find(Array.isArray))) || (r && typeof r === 'object' ? Object.values(r).filter(x => typeof x === 'string') : []);
      clearInterval(tic);
      const l = tab.map(x => typeof x === 'string' ? x : (x && (x.legende || x.texte || x.caption || Object.values(x).find(v => typeof v === 'string'))) || '').filter(Boolean).slice(0, 6);
      z.innerHTML = l.map((t, i) => `<div class="pv-idee"><p>${esc(t)}</p><button class="btn xs" data-pi="${i}">Utiliser</button></div>`).join('') || '<span class="nt">Pas d\'idée reçue, réessaie.</span>';
      $$('[data-pi]', z).forEach(x => x.onclick = () => { P.legende = l[+x.dataset.pi]; $('#pvLeg').value = P.legende; $('#pvLegAff').textContent = P.legende.split('\n')[0]; msg('Légende choisie'); });
      BK.renfortGarder && BK.renfortGarder({ type: 'legende', q: 'Légende Insta' + (morceau ? ' · ' + morceau : '') + (idee ? ' · ' + idee : ''), r: l.join('\n\n———\n\n') });
    } catch (e) { clearInterval(tic); z.innerHTML = `<span class="nt">${esc(e.message)}</span>`; }
    clearInterval(tic); b.disabled = false;
  };
  $('#pvNom').onchange = e => { P.nom = e.target.value.trim() || 'post'; };
  $('#pvNom').addEventListener('keydown', e => e.stopPropagation());

  // ---------- export : une image par photo, en pleine taille ----------
  $('#pvExport').onclick = async () => {
    const b = $('#pvExport'); b.disabled = true; b.innerHTML = '<span class="spin"></span>Export…';
    try {
      const f = F(), rr = BK.rendu.creer(f.L, f.H); rr.lut(P.lut); rr.reglages(P.regl); const faits = [];
      for (let k = 0; k < P.slides.length; k++) {
        const s = P.slides[k]; rr.dessiner(tournee(s), { zoom: s.zoom / 100, x: s.x, y: s.y }, (P.force ?? 100) / 100, '', P.voile ? { type: P.voile, t: k * 0.37, k: (P.voileK ?? 100) / 100 } : null);   // l'effet vintage : un peu différent sur chaque photo
        const fin = document.createElement('canvas'); fin.width = f.L; fin.height = f.H;          // la photo dans son cadre (s'il y en a un)
        BK.rendu.cadre(fin.getContext('2d'), rr.sortie, f.L, f.H, P.cadre || '', P.cadreT ?? 40, k);
        const blob = await new Promise(ok => fin.toBlob(ok, 'image/jpeg', 0.92)), octets = new Uint8Array(await blob.arrayBuffer());
        const nom = `${P.nom}_${String(k + 1).padStart(2, '0')}_${f.L}x${f.H}.jpg`;
        const pth = await BK.enregistrerFichier(BK.chemin('Posts', P.nom), nom, octets, 'image/jpeg');
        faits.push({ nom, p: pth, octets, type: 'image/jpeg', ic: '🖼' });
        msg(`Export ${k + 1}/${P.slides.length}`); await BK.audio.pause();
      }
      if (P.legende) { const o = new TextEncoder().encode(P.legende), nom = `${P.nom}_legende.txt`;
        faits.push({ nom, p: await BK.enregistrerFichier(BK.chemin('Posts', P.nom), nom, o, 'text/plain'), octets: o, type: 'text/plain', ic: '📝' }); }
      msg(faits.some(x => x.p) ? P.slides.length + ' image(s) prêtes ✓' : 'Export annulé');
      BK.montrerExports($('#pvFaits'), faits, { drive: { role: 'photovideo', sous: ['Posts', P.nom], titre: 'Photos/Vidéos › Posts › ' + P.nom }, msg });
    } catch (e) { console.error(e); msg('Export impossible'); }
    b.disabled = false; b.textContent = 'Exporter les images ▶';
  };

  moteur(); majTout();
});
})();
