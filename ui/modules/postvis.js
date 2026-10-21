// =====================================================================
// ASSISTANT VISUEL POST — comme l'Assistant visuel Reel, mais pour des PHOTOS :
//   plusieurs photos = un carrousel Instagram · format (carré, portrait 4:5, story)
//   recadrer (zoom + glisser) · couleur (LUT .cube) · aperçu « dans Instagram »
//   export : une image JPG par photo, prête à publier (1080 px de large)
// =====================================================================
(() => {
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
            <div class="box"><div class="ligne-titre"><span class="lb">① Les photos (ordre du carrousel)</span>
                <span class="nt" style="margin:0 0 0 auto">Clique une photo pour la régler · ‹ › pour l'ordre</span>
                <button class="btn sm pri" id="pvAjout" style="flex:none">+ Ajouter des photos</button><input type="file" id="pvInput" accept="image/*" multiple hidden></div>
              <div class="pv-bande" id="pvBande"></div></div>
            <div class="box"><div class="ligne-titre"><span class="lb">② De quoi parle le post ?</span>
                <button class="btn sm pv-sujet-b" id="pvSujetB" style="margin-left:auto">Choisir ▾</button><input type="hidden" id="pvSujet" value=""></div></div>
            <div class="box"><span class="lb">③ Recadrer et couleur</span>
              <div class="pv-tab">
                <span class="eng">Cadrage</span>
                <div class="pv-seg"><button id="pvEntier" title="Voir toute la photo, avec des bandes noires">⤢ Entière</button><button id="pvRemplir" title="La photo remplit le cadre, les bords sont coupés">⤡ Remplir</button><button id="pvCentre" title="Remettre au centre, sans zoom">⊙ Centrer</button></div>
                <span class="eng">Réglages</span>
                <div class="pv-ligne pv-regl"><span class="eng">Contraste</span><input class="fld rv-glisse" id="pvCon" title="Clic maintenu et glisse la souris (ou double-clic pour taper)"><span class="eng">Lumière</span><input class="fld rv-glisse" id="pvLum" title="Clic maintenu et glisse la souris (ou double-clic pour taper)"><span class="eng">Saturation</span><input class="fld rv-glisse" id="pvSat" title="Clic maintenu et glisse la souris (ou double-clic pour taper)"></div>
                <span class="eng">Zoom</span>
                <div class="pv-ligne"><input class="fld rv-glisse" id="pvZoom" value="0 %" title="Clic maintenu et glisse la souris (ou double-clic pour taper)"><span class="nt">glisse l'image dans l'aperçu pour la déplacer</span></div>
                <span class="eng">Couleur</span>
                <div class="pv-ligne"><select class="fld" id="pvFiltre">${['', ...BK.filtres.map(f => f.nom)].map(n => `<option value="${n}">${n || 'Aucun filtre'}</option>`).join('')}<option value="__lut">＋ Ajouter une LUT (.cube)…</option></select>
                  <span class="eng" style="margin-left:6px">Intensité</span><input class="fld rv-glisse pv-force" id="pvForce" value="100 %" title="Clic maintenu et glisse la souris (ou double-clic pour taper)"></div>
                <span class="eng">Effet</span>
                <div class="pv-ligne"><select class="fld" id="pvVoile">${BK.rendu.VOILES.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></div>
                <span></span>
                <div class="pv-ligne"><button class="pv-lien" id="pvTous" title="Applique le cadrage de cette photo à toutes les photos du carrousel">↻ Même cadrage pour toutes les photos</button></div>
              </div>
              <input type="file" id="pvLutIn" accept=".cube" hidden></div>
            <div class="box pv-leg-box"><span class="lb">④ Légende</span>
              <textarea class="fld" id="pvLeg" rows="3" placeholder="Le texte du post, les hashtags…"></textarea>
              <div class="pv-idees-l"><select class="fld" id="pvMorceau"><option value="">Morceau (pour l'AI)…</option></select><input class="fld" id="pvIdee" placeholder="ce que montre le post (facultatif)"></div>
              <div class="chips" style="margin-top:8px"><button class="chip" id="pvRenfort">✨ Idées de légende</button><button class="chip" id="pvCopier">Copier la légende</button></div>
              <div class="pv-idees" id="pvIdees"></div></div>
          </div>
        </div>
      </section>
      <section class="pane reg"><span class="ptitle">② Réglages</span>
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

  function moteur() {
    const f = F(), k = 0.5; cv.width = Math.round(f.L * k); cv.height = Math.round(f.H * k);
    r = BK.rendu.creer(cv.width, cv.height); r.lut(P.lut); r.reglages(P.regl);
    ecran.style.aspectRatio = `${f.L} / ${f.H}`;
    ecran.style.maxWidth = Math.round(520 * f.L / f.H) + 'px';     // sinon la hauteur est bridée à 520 px et la photo s'allonge (story 9:16)
    $('#pvFmtH').textContent = f.nom.split(' ').pop(); $$('#pvFmt .chip').forEach(c => c.classList.toggle('on', c.dataset.f === P.format));
  }
  // « photo entière » : le moteur remplit le cadre par défaut ; ce zoom-là montre toute la photo
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
    r.dessiner(s.img, { zoom: s.zoom / 100, x: s.x, y: s.y }, (P.force ?? 100) / 100, '', P.voile ? { type: P.voile, t: 0 } : null); c2.drawImage(r.sortie, 0, 0);
    $('#pvZoom').value = (s.zoom - 100) + ' %';
  }
  function majTout() {
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
  // ---------- ② le sujet : un menu qui se déroule (Morceaux ▸, Tournages ▸…) ----------
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
  // ---------- ① « + Ajouter des photos » : la fenêtre Médias (dossiers, Discord, étiquettes) ----------
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
  page.addEventListener('drop', e => { e.preventDefault(); ecran.classList.remove('survol'); const fs = [...e.dataTransfer.files]; if (!fs.length) return;
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
  const zoom = z => { const s = S(); if (!s) return; s.zoom = Math.round(Math.max(100, Math.min(400, z))); dessiner(); };
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
  const force = v => { P.force = Math.round(Math.max(0, Math.min(100, v))); fc.value = P.force + ' %'; dessiner(); };
  fc.addEventListener('pointerdown', e => { if (!fc.readOnly) return; e.preventDefault(); fc.setPointerCapture(e.pointerId); fg = { x: e.clientX, y: e.clientY, v: P.force }; });
  fc.addEventListener('pointermove', e => { if (fg) force(fg.v + ((e.clientX - fg.x) - (e.clientY - fg.y)) / 2); });
  fc.addEventListener('pointerup', () => { fg = null; });
  fc.addEventListener('dblclick', () => { fc.readOnly = false; fc.value = P.force; fc.select(); });
  fc.addEventListener('blur', () => { if (fc.readOnly) return; fc.readOnly = true; const v = parseFloat(fc.value.replace(',', '.')); force(isNaN(v) ? P.force : v); });
  fc.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') fc.blur(); });
  fc.addEventListener('wheel', e => { e.preventDefault(); force(P.force - Math.sign(e.deltaY) * 5); }, { passive: false });
  $('#pvEntier').onclick = () => { const s = S(); if (!s) return; s.zoom = zoomEntier(s.img); s.x = 0; s.y = 0; dessiner(); majTout(); msg('Photo entière'); };
  $('#pvRemplir').onclick = () => { const s = S(); if (!s) return; s.zoom = 100; s.x = 0; s.y = 0; dessiner(); majTout(); msg('La photo remplit le cadre'); };
  $('#pvCentre').onclick = () => { const s = S(); if (!s) return; s.x = s.y = 0; s.zoom = 100; dessiner(); };
  $('#pvTous').onclick = () => { const s = S(); if (!s) return; P.slides.forEach(x => { x.zoom = s.zoom; x.x = s.x; x.y = s.y; }); msg('Même cadrage partout'); };

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
  [['#pvCon', 'contraste'], ['#pvLum', 'lumiere'], ['#pvSat', 'saturation']].forEach(([id, k]) =>
    BK.rendu.champGlisse($(id), { val: P.regl[k], change: v => { P.regl[k] = v; r && r.reglages(P.regl); dessiner(); } }));
  $('#pvVoile').onchange = e => { P.voile = e.target.value; dessiner(); msg(P.voile ? 'Effet : ' + e.target.selectedOptions[0].textContent + ' (toutes les photos)' : 'Sans effet'); };
  $('#pvLutIn').onchange = e => e.target.files[0] && chargerLut(e.target.files[0]);
  // filtres prêts à l'emploi (un clic) — ou sa propre LUT .cube
  let filtreAvant = '';
  $('#pvFiltre').onchange = e => { const n = e.target.value;
    if (n === '__lut') { e.target.value = filtreAvant; return $('#pvLutIn').click(); }      // « Ajouter une LUT » : on choisit le fichier
    if (n === '__lutok') return;
    filtreAvant = n; P.lut = n ? BK.rendu.filtre(n) : null; P.lutNom = n; r && r.lut(P.lut); dessiner(); msg(n ? 'Filtre : ' + n : 'Sans filtre'); };

  // ---------- format, légende, nom ----------
  $$('#pvFmt .chip').forEach(c => c.onclick = () => { P.format = c.dataset.f; BK.regler('pv.format', P.format); moteur();
    for (const s of P.slides) if (s.zoom <= 100) s.zoom = cadrageDepart(s.img);      // on change de cadre : on ne coupe pas la photo sans le dire
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
      const r = await BK.ia.demander(demande, { json: true, vite: true, temperature: 0.8, delai: 60 });
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
        const s = P.slides[k]; rr.dessiner(s.img, { zoom: s.zoom / 100, x: s.x, y: s.y }, (P.force ?? 100) / 100, '', P.voile ? { type: P.voile, t: k * 0.37 } : null);   // l'effet vintage : un peu différent sur chaque photo
        const blob = await new Promise(ok => rr.sortie.toBlob(ok, 'image/jpeg', 0.92)), octets = new Uint8Array(await blob.arrayBuffer());
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
