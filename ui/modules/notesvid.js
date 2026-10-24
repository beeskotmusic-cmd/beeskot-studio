// =====================================================================
// NOTES VIDÉOS — comme Notes et retours, mais pour les vidéos (sans A / B).
//   La vidéo à gauche (timeline : clic = aller là, cliquer-glisser = un passage qui tourne en boucle),
//   les retours à droite (comme Frame.io). Chaque vidéo est reliée à un morceau OU à un tournage.
//   Sous-onglet « Historique de notes » : toutes les notes vidéo, rangées par morceau / tournage › fichier.
// Les vidéos viennent de Médias (Drive, Discord) ou de ce PC. Les notes sont dans le Drive (collection « notesvid »).
// =====================================================================
(() => {
const N = { src: null, notes: [], toutes: [], morceaux: [], tournages: [], sel: null, tout: false, vue: BK.reglage('notesvid.vue', 'notes'), hk: '', hf: '' };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tps = s => { s = Math.max(0, s || 0); return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); };
const COULEURS = { Yacine: '#f1c453', Pierre: '#7ee08a', Baptiste: '#c58af0' };
const couleur = q => COULEURS[q] || '#d9b67a';
const moi = () => BK.reglage('nomPc', '') || 'Quelqu\'un';
const qui = n => n.auteur || n.par;

BK.module('notesvid', function (page) {
  $('.sub', page).textContent = 'Des notes minutées sur une vidéo (clip, reel, live), pour tout le groupe';
  $('.hdr .right', page).innerHTML = `<div><span class="eng" style="font-size:9px">Vidéo</span><span class="vfd" id="nvNomH" style="width:220px">—</span></div>
    <div><span class="eng" style="font-size:9px">Notes</span><span class="vfd" id="nvNbH">—</span></div>`;
  $('.grid', page).innerHTML = `
    <div class="seg ec-vues" id="nvVues"><button data-v="notes">Notes</button><button data-v="histo">Historique de notes</button></div>
    <div class="cols ec-cols" id="nvVueNotes">
      <section class="pane vit ec-vit nv-vit">
        <div class="nv-barre">
          <button class="btn xs pri" id="nvMedias">🎬 Médias…</button><button class="btn xs" id="nvPC">💻 Ce PC…</button><input type="file" id="nvInput" accept="video/*" hidden>
          <select class="fld nv-lien" id="nvLien" title="Le morceau ou le tournage de cette vidéo"><option value="">— relié à : morceau ou tournage —</option></select>
          <span class="nt mono nv-fich" id="nvFich">Aucune vidéo</span></div>
        <div class="nv-zone" id="nvZone"><div class="nv-ecran" id="nvEcran"><video id="nvVideo" playsinline preload="auto"></video><canvas class="nv-dessin" id="nvDessin"></canvas><span class="nt ec-vide" id="nvVide">Choisis une vidéo (Médias ou ce PC), ou glisse-la ici</span></div></div>
        <div class="nv-ligne" id="nvLigne"><div class="nv-plein" id="nvPlein"></div><div class="ec-selz hidden" id="nvSelz"></div><div class="nv-mq" id="nvMarques"></div><div class="ec-tete" id="nvTete"></div></div>
        <div class="ec-transport nv-transport"><button class="btn xs pri" id="nvPlay" disabled title="Lecture / pause (Espace)">▶</button><span class="vfd" id="nvTemps">0:00 / 0:00</span>
          <button class="btn xs" id="nvI" title="Début du passage ici (touche I)">I</button><button class="btn xs" id="nvO" title="Fin du passage ici (touche O)">O</button>
          <input type="range" id="nvVol" min="0" max="1" step="0.01" title="Volume (double-clic : normal)">
          <button class="btn xs" id="nvCrayon" title="Dessiner sur l'image (la vidéo se met en pause) : le dessin part avec ta prochaine note">✏ Dessiner</button>
          <span class="nv-outils hidden" id="nvOutils">${['#ffcf3a', '#e0452b', '#7ee08a', '#4f9bd0', '#c58af0', '#efe4cc'].map(c => `<button class="nv-coul" data-coul="${c}" style="--c:${c}" title="Couleur"></button>`).join('')}
            <button class="btn xs" id="nvAnnuler" title="Annuler le dernier trait (Ctrl + Z)">↶</button><button class="btn xs" id="nvGomme" title="Tout effacer">⌫</button></span>
          <span class="nt ec-astuce" title="Clic sur la ligne = aller là · cliquer-glisser (ou I / O) = un passage, qui tourne en boucle · Espace = lecture">?</span></div>
      </section>
      <div class="ec-poignee" id="nvPoignee" title="Tire pour élargir les notes ou la vidéo (double-clic : taille normale)"><i></i></div>
      <section class="pane reg ec-panneau"><span class="ptitle">Retours</span>
        <div class="box ec-notes-box">
          <div class="ec-form"><span class="vfd" id="nvQuand">0:00</span><button class="btn sm" id="nvTout" title="La note parle de toute la vidéo">Toute la vidéo</button><button class="btn sm pri" id="nvAjout">＋ Note</button>
            <input class="fld" id="nvTexte" placeholder="Ta note à cet endroit… (Entrée pour ajouter)"></div>
          <div class="ec-filtres"><div class="seg ec-tri" id="nvTri"><button data-t="membre">Par membre</button><button data-t="temps">Dans la vidéo</button><button data-t="date">Par date</button></div>
            <button class="chip on" data-f="tout">Toutes</button><button class="chip" data-f="ouvertes">À régler</button>
            <button class="btn xs" id="nvCopier" style="margin-left:auto" title="Copie les notes, avec leurs timecodes">📋 Copier</button></div>
          <div class="ec-liste" id="nvListe"><span class="nt">Choisis une vidéo.</span></div></div>
      </section>
    </div>
    <div class="cols ec-cols hidden" id="nvVueHisto">
      <section class="pane reg ec-hm-pane"><span class="ptitle">Morceaux et tournages</span><div class="box grow ec-hm" id="nvHM"></div></section>
      <section class="pane vit ec-hist"><div class="box ec-notes-box">
        <div class="ec-filtres"><span class="lb" id="nvHTitre">—</span><select class="fld" id="nvHF" style="max-width:360px"></select>
          <button class="btn xs" id="nvHOuvrir" title="Ouvrir cette vidéo dans Notes">▶ Ouvrir la vidéo</button>
          <button class="btn xs" id="nvHCopier" style="margin-left:auto">📋 Copier</button></div>
        <div class="ec-liste" id="nvHL"></div></div></section>
    </div>
    <div class="pane abar"><span class="vfd" id="nvMsg">PRÊT</span></div>`;
  const msg = t => $('#nvMsg').textContent = String(t).toUpperCase().slice(0, 90);
  const vid = $('#nvVideo'), ligne = $('#nvLigne');
  BK.mini.suivre(vid, { page: 'notesvid', titre: () => 'Notes vidéos · ' + (N.src ? N.src.nom : '') });
  const D = () => vid.duration || 0;

  // ---------- les morceaux et les tournages (pour relier la vidéo) ----------
  async function listes() {
    [N.morceaux, N.tournages] = await Promise.all([BK.db.liste('morceaux').catch(() => []), BK.db.liste('tournages').catch(() => [])]);
    N.morceaux.sort((a, b) => a.nom.localeCompare(b.nom));
    const tours = N.tournages.filter(t => t.niveau === 'tournage' || !t.parent).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    $('#nvLien').innerHTML = '<option value="">— morceau ou tournage —</option><optgroup label="Morceaux">' + N.morceaux.map(m => `<option value="m:${esc(m.id)}">${esc(m.nom)}</option>`).join('') + '</optgroup>'
      + '<optgroup label="Tournages">' + tours.map(t => `<option value="t:${esc(t.id)}">${esc(t.titre || 'Tournage')}${t.date ? ' · ' + esc(t.date) : ''}</option>`).join('') + '</optgroup>';
    if (N.src) $('#nvLien').value = N.src.lien || '';
  }
  const nomLien = k => { if (!k) return 'Sans lien'; const [t, id] = [k.slice(0, 1), k.slice(2)];
    return t === 'm' ? '♪ ' + ((N.morceaux.find(m => m.id === id) || {}).nom || 'Morceau') : '🎥 ' + ((N.tournages.find(x => x.id === id) || {}).titre || 'Tournage'); };
  const devinerLien = nom => { const m = BK.inv && BK.inv.trouverMorceau(nom || '', N.morceaux); return m ? 'm:' + m.id : ''; };

  // ---------- charger une vidéo ----------
  // src = { cle: 'drive:ID' | 'dc:ID' | 'pc:nom', nom, url, lien }
  async function ouvrir(src) {
    vid.pause(); N.src = src; N.sel = null; majSel();
    $('#nvFich').textContent = src.nom; $('#nvNomH').textContent = src.nom.toUpperCase(); $('#nvVide').classList.add('hidden');
    vid.src = src.url; $('#nvPlay').disabled = false;
    // le lien gardé avec les notes de cette vidéo, sinon deviné par le nom
    const deja = N.toutes.find(n => n.video === src.cle && n.lien); src.lien = src.lien || (deja && deja.lien) || devinerLien(src.nom);
    $('#nvLien').value = src.lien || ''; BK.regler('notesvid.derniere', src.cle.startsWith('pc:') ? null : { cle: src.cle, nom: src.nom });
    await chargerNotes(); msg('« ' + src.nom + ' » prête');
  }
  async function depuisDrive(x) {
    msg('Chargement de la vidéo…');
    try { const r = x.dc ? await BK.discord.fetch(x.dc.url) : await BK.drive.api(`/files/${x.id}?alt=media`); if (!r.ok) throw 0;
      const u = URL.createObjectURL(await r.blob()); await ouvrir({ cle: (x.dc ? 'dc:' : 'drive:') + String(x.id).replace(/^dc:/, ''), nom: x.nom || x.name || 'vidéo', url: u }); }
    catch (e) { msg('Vidéo illisible ou introuvable'); }
  }
  $('#nvMedias').onclick = async () => { if (!BK.drive.relie()) return $('#nvInput').click();
    const l = await BK.choisirDansMedias({ titre: 'Une vidéo pour les notes', bouton: 'Ouvrir', type: 'video' }); if (!l || !l[0]) return;
    const x = l[0]; if (x.file) return ouvrir({ cle: 'pc:' + x.file.name, nom: x.file.name, url: URL.createObjectURL(x.file) });
    depuisDrive({ id: x.id, nom: x.name || x.nom, dc: x.dc }); };
  $('#nvPC').onclick = () => $('#nvInput').click();
  $('#nvInput').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) ouvrir({ cle: 'pc:' + f.name, nom: f.name, url: URL.createObjectURL(f) }); };
  // glissée depuis Médias (ou « Envoyer vers »), ou un fichier de ce PC
  page.addEventListener('dragover', e => e.preventDefault());
  page.addEventListener('drop', async e => { e.preventDefault();
    if (BK.glisse.actif()) { const x = BK.glisse.items.find(y => /^video\//.test(y.mime || '')); if (!x) return msg('Ici, il faut une vidéo'); return depuisDrive(x); }
    const f = [...(e.dataTransfer.files || [])].find(f => /^video\//.test(f.type)); if (f) ouvrir({ cle: 'pc:' + f.name, nom: f.name, url: URL.createObjectURL(f) }); });
  $('#nvLien').onchange = async () => { if (!N.src) return; N.src.lien = $('#nvLien').value; $('#nvLien').blur();
    for (const n of N.notes) if (n.lien !== N.src.lien) { n.lien = N.src.lien; await BK.db.ecrire('notesvid', n); }
    msg('Relié à ' + nomLien(N.src.lien)); };

  // ---------- lecture, timeline, boucle ----------
  const pos = () => vid.currentTime || 0;
  function majTete() { const d = D(); $('#nvTemps').textContent = tps(pos()) + ' / ' + tps(d); if (!d) return;
    $('#nvTete').style.left = (pos() / d * 100) + '%'; $('#nvPlein').style.width = (pos() / d * 100) + '%'; if (!N.sel && !N.tout) $('#nvQuand').textContent = tps(pos()); }
  vid.addEventListener('loadedmetadata', () => { majTete(); dessinerNotes(); });
  vid.addEventListener('timeupdate', () => { if (N.sel && N.sel.b - N.sel.a > 0.2 && (pos() >= N.sel.b || pos() < N.sel.a - 0.5)) vid.currentTime = N.sel.a; majTete(); });   // la zone tourne en boucle
  vid.addEventListener('play', () => $('#nvPlay').textContent = '❚❚'); vid.addEventListener('pause', () => $('#nvPlay').textContent = '▶');
  vid.addEventListener('ended', () => { if (N.sel) { vid.currentTime = N.sel.a; vid.play(); } else { vid.currentTime = 0; vid.play(); } });   // en boucle
  const jouer = () => { if (!N.src) return; if (vid.paused) { if (N.sel && (pos() < N.sel.a || pos() >= N.sel.b)) vid.currentTime = N.sel.a; vid.play(); } else vid.pause(); };
  $('#nvPlay').onclick = jouer; $('#nvEcran').onclick = e => { if (!N.crayon && e.target !== $('#nvDessin') || !N.crayon) jouer(); };

  // ---------- dessiner sur l'image (comme Frame.io) : le dessin est gardé avec la note ----------
  const cvD = $('#nvDessin'), cxD = cvD.getContext('2d'); N.traits = []; N.crayon = false;
  // la zone où l'image est vraiment affichée (la vidéo garde ses proportions dans l'écran)
  const zoneImage = () => { const r = cvD.getBoundingClientRect(), vw = vid.videoWidth || 16, vh = vid.videoHeight || 9, k = Math.min(r.width / vw, r.height / vh);
    const w = vw * k, h = vh * k; return { x: (r.width - w) / 2, y: (r.height - h) / 2, w, h, r }; };
  function peindre(traits) {
    const r = cvD.getBoundingClientRect(); cvD.width = Math.round(r.width * devicePixelRatio); cvD.height = Math.round(r.height * devicePixelRatio);
    cxD.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); cxD.clearRect(0, 0, r.width, r.height); if (!traits || !traits.length) return;
    const z = zoneImage(); cxD.lineCap = cxD.lineJoin = 'round';
    for (const t of traits) { cxD.strokeStyle = t.c || '#ffb23e'; cxD.lineWidth = 4; cxD.shadowColor = 'rgba(0,0,0,.7)'; cxD.shadowBlur = 3; cxD.beginPath();
      t.p.forEach(([x, y], i) => { const X = z.x + x * z.w, Y = z.y + y * z.h; i ? cxD.lineTo(X, Y) : cxD.moveTo(X, Y); }); cxD.stroke(); }
  }
  N.montre = null; const montrer = tr => { N.montre = tr; peindre(tr); };
  vid.addEventListener('play', () => { if (!N.crayon) montrer(null); });
  const crayon = on => { N.crayon = on; if (on) { vid.pause(); montrer(N.traits); } else if (!N.traits.length) montrer(null);
    $('#nvCrayon').classList.toggle('on', on); cvD.classList.toggle('actif', on); $('#nvOutils').classList.toggle('hidden', !on);
    $$('.nv-coul').forEach(b => b.classList.toggle('on', b.dataset.coul === (N.coul || ''))); msg(on ? 'Dessine sur l\'image, puis écris ta note' : N.traits.length ? 'Dessin prêt : il part avec ta prochaine note' : 'Prêt'); };
  $('#nvCrayon').onclick = e => { e.stopPropagation(); if (!N.src) return msg('Choisis d\'abord une vidéo'); crayon(!N.crayon); };
  $('#nvGomme').onclick = e => { e.stopPropagation(); N.traits = []; montrer([]); };
  const annuler = () => { N.traits.pop(); montrer(N.traits); msg(N.traits.length ? 'Dernier trait enlevé' : 'Plus de dessin'); };
  $('#nvAnnuler').onclick = e => { e.stopPropagation(); annuler(); };
  $$('.nv-coul').forEach(b => b.onclick = e => { e.stopPropagation(); N.coul = b.dataset.coul; BK.regler('notesvid.coul', N.coul); $$('.nv-coul').forEach(x => x.classList.toggle('on', x === b)); });
  N.coul = BK.reglage('notesvid.coul', '');
  document.addEventListener('keydown', e => { if (N.crayon && !page.classList.contains('hidden') && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !/INPUT|TEXTAREA/.test((document.activeElement || {}).tagName)) { e.preventDefault(); e.stopImmediatePropagation(); annuler(); } }, true);
  let trait = null;
  cvD.addEventListener('pointerdown', e => { if (!N.crayon) return; e.preventDefault(); e.stopPropagation(); cvD.setPointerCapture(e.pointerId);
    const z = zoneImage(); trait = { c: N.coul || couleur(moi()), p: [] }; N.traits.push(trait); ajoutPt(e, z); });
  const ajoutPt = (e, z) => { const x = (e.clientX - z.r.left - z.x) / z.w, y = (e.clientY - z.r.top - z.y) / z.h;
    const p = [Math.round(Math.max(0, Math.min(1, x)) * 1000) / 1000, Math.round(Math.max(0, Math.min(1, y)) * 1000) / 1000], d = trait.p[trait.p.length - 1];
    if (!d || Math.abs(d[0] - p[0]) + Math.abs(d[1] - p[1]) > 0.004) { trait.p.push(p); montrer(N.traits); } };
  cvD.addEventListener('pointermove', e => { if (trait) ajoutPt(e, zoneImage()); });
  cvD.addEventListener('pointerup', e => { if (trait) { e.stopPropagation(); trait = null; } });
  cvD.addEventListener('click', e => { if (N.crayon) e.stopPropagation(); });
  // l'écran prend la forme de la vidéo (pas de bandes noires) et la plus grande place possible
  const ajuster = () => { const z = $('#nvZone').getBoundingClientRect(), ar = vid.videoWidth && vid.videoHeight ? vid.videoWidth / vid.videoHeight : 16 / 9; if (!z.width || !z.height) return;
    let w = z.width, h = w / ar; if (h > z.height) { h = z.height; w = h * ar; }
    const e = $('#nvEcran'); e.style.width = Math.floor(w) + 'px'; e.style.height = Math.floor(h) + 'px'; peindre(N.montre); };
  new ResizeObserver(ajuster).observe($('#nvZone')); vid.addEventListener('loadedmetadata', ajuster);
  document.addEventListener('keydown', e => { const ae = document.activeElement || {};
    if (page.classList.contains('hidden') || N.vue !== 'notes' || /INPUT|TEXTAREA/.test(ae.tagName) && ae.type !== 'range' || document.querySelector('.voile:not(.hidden)')) return;
    if (e.code === 'Space') { e.preventDefault(); if (/SELECT|BUTTON/.test(ae.tagName) || ae.type === 'range') ae.blur(); jouer(); }
    if (!e.ctrlKey && !e.metaKey && (e.key === 'i' || e.key === 'I')) { e.preventDefault(); poserIO('i'); }
    if (!e.ctrlKey && !e.metaKey && (e.key === 'o' || e.key === 'O')) { e.preventDefault(); poserIO('o'); } });
  // I / O : le début et la fin du passage, à la tête de lecture
  function poserIO(k) { if (!D()) return; const t = pos(), s0 = N.sel || { a: 0, b: D() };
    N.sel = k === 'i' ? { a: t, b: s0.b > t + 0.2 ? s0.b : D() } : { a: s0.a < t - 0.2 ? s0.a : 0, b: t };
    majSel(); msg(`Passage ${tps(N.sel.a)} → ${tps(N.sel.b)} (en boucle)`); }
  $('#nvI').onclick = () => poserIO('i'); $('#nvO').onclick = () => poserIO('o');
  const vol = $('#nvVol'); vol.value = BK.reglage('notesvid.vol', 1); vid.volume = +vol.value;
  vol.oninput = () => { vid.volume = +vol.value; BK.regler('notesvid.vol', +vol.value); vol._majTri && vol._majTri(); }; vol.ondblclick = () => { vol.value = 1; vol.oninput(); };
  BK.triangle(vol);
  let g = null;
  const tA = ev => { const r = ligne.getBoundingClientRect(); return Math.max(0, Math.min(D(), (ev.clientX - r.left) / r.width * D())); };
  ligne.addEventListener('pointerdown', ev => { if (!D()) return; g = { t: tA(ev), x: ev.clientX }; ligne.setPointerCapture(ev.pointerId); });
  ligne.addEventListener('pointermove', ev => { if (!g) return; if (Math.abs(ev.clientX - g.x) > 5) { N.sel = { a: Math.min(g.t, tA(ev)), b: Math.max(g.t, tA(ev)) }; majSel(); } });
  ligne.addEventListener('pointerup', ev => { if (!g) return; const glisse = Math.abs(ev.clientX - g.x) > 5; g = null;
    if (!glisse) { N.sel = null; majSel(); vid.currentTime = tA(ev); } else { vid.currentTime = N.sel.a; $('#nvTexte').focus(); } majTete(); });
  function majSel() { const z = $('#nvSelz'), d = D();
    if (!N.sel || !d) { z.classList.add('hidden'); if (!N.tout) $('#nvQuand').textContent = tps(pos()); return; }
    z.classList.remove('hidden'); z.style.left = (N.sel.a / d * 100) + '%'; z.style.width = ((N.sel.b - N.sel.a) / d * 100) + '%';
    if (!N.tout) $('#nvQuand').textContent = tps(N.sel.a) + ' → ' + tps(N.sel.b); }

  // ---------- les notes ----------
  async function chargerToutes() { N.toutes = await BK.db.liste('notesvid').catch(() => []); }
  async function chargerNotes() { await chargerToutes(); N.notes = N.src ? N.toutes.filter(n => n.video === N.src.cle) : []; dessinerNotes(); }
  BK.notesvidRecharger = async () => { await chargerNotes(); if (N.vue === 'histo') historique(); };
  const tri = () => BK.reglage('notesvid.tri', 'membre');
  const plies = () => { const o = BK.reglage('notesvid.ouverts', {}); return new Proxy({}, { get: (_, k) => !o[k] }); };
  const jour = q => { const d = new Date(q || 0); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  function groupes(l) {
    const T = tri();
    if (T === 'date') { const g = {}; [...l].sort((a, b) => (a.quand || '').localeCompare(b.quand || '')).forEach(n => (g[jour(n.quand)] = g[jour(n.quand)] || []).push(n));
      return Object.keys(g).sort().map(k => ({ cle: 'date:' + k, titre: new Date(k + 'T12:00').toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' }), l: g[k] })); }
    if (T === 'membre') { const g = {}; l.forEach(n => (g[qui(n)] = g[qui(n)] || []).push(n)); const O = ['Yacine', 'Baptiste', 'Pierre'], r = p => { const i = O.indexOf(p); return i < 0 ? 99 : i; };
      return Object.keys(g).sort((a, b) => r(a) - r(b) || a.localeCompare(b)).map(k => ({ cle: 'membre:' + k, titre: 'Notes de ' + k, pc: couleur(k), l: g[k].sort((a, b) => a.t - b.t) })); }
    return [{ cle: '', l: [...l].sort((a, b) => a.t - b.t) }];
  }
  const ligneNote = n => `<div class="ec-n${n.regle ? ' regle' : ''}" data-n="${n.id}" style="--pc:${couleur(qui(n))}">
      <button class="ec-n-t mono${n.tout ? ' tout' : ''}" data-aller="${n.id}" title="${n.dessin ? 'Voir l\'image avec le dessin' : 'Aller à ce moment'}">${n.tout ? 'TOUT' : tps(n.t) + (n.fin ? ' → ' + tps(n.fin) : '')}${n.dessin ? ' ✏' : ''}</button>
      <div class="ec-n-c"><div class="ec-n-l">${tri() === 'membre' ? '' : `<b>${esc(qui(n))}</b>`}<span class="ec-n-txt" data-txt="${n.id}">${esc(n.texte)}</span>${n.modifie ? '<em class="ec-modif">modifiée</em>' : ''}</div>
        ${(n.reponses || []).map(r => `<div class="ec-rep" style="--pc:${couleur(r.par)}"><b>${esc(r.par)}</b> ${esc(r.texte)}</div>`).join('')}
        <div class="ec-rep-f hidden"><input class="fld" placeholder="Ta réponse… (Entrée)"></div></div>
      <div class="ec-n-o"><button class="btn xs" data-rep="${n.id}" title="Répondre">💬 ${(n.reponses || []).length || ''}</button>
        <button class="btn xs${n.regle ? ' on' : ''}" data-ok="${n.id}" title="Réglé / pas réglé">${n.regle ? '✓ réglé' : '○'}</button>
        ${qui(n) === moi() ? `<button class="btn xs" data-ed="${n.id}" title="Modifier ma note">✎</button><button class="btn xs" data-x="${n.id}" title="Retirer ma note">✕</button>` : ''}</div></div>`;
  function rendreListe(z, l, vide) { const P = plies();
    z.innerHTML = l.length ? groupes(l).map(g => !g.cle ? g.l.map(ligneNote).join('') : `<div class="ec-dos${P[g.cle] ? ' plie' : ''}"${g.pc ? ` style="--pc:${g.pc}"` : ''}>
      <button class="ec-dos-t" data-pli="${esc(g.cle)}"><span class="ec-dos-f">${P[g.cle] ? '▸' : '▾'}</span><b>${esc(g.titre)}</b><span class="nt">${g.l.length} note(s)</span></button>
      ${P[g.cle] ? '' : `<div class="ec-dos-l">${g.l.map(ligneNote).join('')}</div>`}</div>`).join('') : `<span class="nt">${vide}</span>`; }
  function brancher(z, notes, redessiner) {
    const trouver = id => notes.find(n => n.id === id);
    $$('[data-pli]', z).forEach(b => b.onclick = () => { const o = BK.reglage('notesvid.ouverts', {}); o[b.dataset.pli] = !o[b.dataset.pli]; if (!o[b.dataset.pli]) delete o[b.dataset.pli]; BK.regler('notesvid.ouverts', o); redessiner(); });
    $$('[data-aller]', z).forEach(b => b.onclick = async () => { const n = trouver(b.dataset.aller); if (!n) return;
      if (z.id !== 'nvListe') { vue('notes'); if (!N.src || N.src.cle !== n.video) await rouvrir(n); }
      if (n.dessin && n.dessin.length && D()) { vid.pause(); vid.currentTime = n.t; majTete(); setTimeout(() => montrer(n.dessin), 120); return; }   // une note dessinée : on s'arrête sur l'image, avec le dessin
      if (!n.tout && D()) { vid.currentTime = Math.max(0, n.t - 0.5); if (n.fin) { N.sel = { a: n.t, b: n.fin }; majSel(); } vid.play(); } });
    $$('[data-ok]', z).forEach(b => b.onclick = async () => { const n = trouver(b.dataset.ok); n.regle = !n.regle; await BK.db.ecrire('notesvid', n); redessiner(); });
    $$('[data-x]', z).forEach(b => b.onclick = async () => { const n = trouver(b.dataset.x); if (!await BK.confirmer('Retirer ta note ?')) return;
      for (const a of [N.notes, N.toutes]) { const i = a.indexOf(n); if (i >= 0) a.splice(i, 1); } await BK.db.supprimer('notesvid', n.id); redessiner(); });
    $$('[data-ed]', z).forEach(b => b.onclick = () => { const n = trouver(b.dataset.ed), sp = $(`[data-txt="${n.id}"]`, z); if (!sp || sp.querySelector('input')) return;
      sp.innerHTML = `<input class="fld ec-ed" value="${esc(n.texte)}">`; const i = sp.querySelector('input'); i.focus(); i.select();
      const fin = async ok => { const v = i.value.trim(); if (ok && v && v !== n.texte) { n.texte = v; n.modifie = new Date().toISOString(); await BK.db.ecrire('notesvid', n); msg('Note modifiée'); } redessiner(); };
      i.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') fin(true); if (e.key === 'Escape') fin(false); }; i.onblur = () => fin(true); });
    $$('[data-rep]', z).forEach(b => b.onclick = () => { const f = b.closest('.ec-n').querySelector('.ec-rep-f'); f.classList.toggle('hidden'); const i = f.querySelector('input'); i.focus();
      i.onkeydown = async e => { e.stopPropagation(); if (e.key !== 'Enter' || !i.value.trim()) return; const n = trouver(b.dataset.rep);
        (n.reponses = n.reponses || []).push({ par: moi(), texte: i.value.trim(), quand: new Date().toISOString() }); await BK.db.ecrire('notesvid', n); redessiner(); }; });
  }
  const visibles = () => { const f = ($('#nvVueNotes .ec-filtres .chip.on') || {}).dataset; return N.notes.filter(n => !f || f.f === 'tout' || (f.f === 'ouvertes' && !n.regle)); };
  function dessinerNotes() {
    $$('#nvTri button').forEach(b => b.classList.toggle('on', b.dataset.t === tri()));
    const l = visibles(), d = D(); $('#nvNbH').textContent = N.src ? String(N.notes.filter(n => !n.regle).length).padStart(2, '0') : '—';
    $('#nvMarques').innerHTML = d ? l.filter(n => !n.tout).map(n => `<span class="ec-mq${n.fin ? ' passage' : ''}${n.regle ? ' regle' : ''}" data-n="${n.id}" title="${esc(tps(n.t) + ' · ' + qui(n) + ' : ' + n.texte)}"
      style="left:${Math.min(100, n.t / d * 100)}%;${n.fin ? `width:${Math.max(0.6, (n.fin - n.t) / d * 100)}%;` : ''}--pc:${couleur(qui(n))}"></span>`).join('') : '';
    $$('#nvMarques .ec-mq').forEach(b => b.onclick = () => { const n = N.notes.find(x => x.id === b.dataset.n); if (n && d) { vid.pause(); vid.currentTime = n.t; majTete(); setTimeout(() => montrer(n.dessin || null), 120); } });
    rendreListe($('#nvListe'), l, N.src ? 'Pas encore de note. Clique sur la ligne sous la vidéo (ou cliquer-glisser pour un passage), puis écris ta note.' : 'Choisis une vidéo.');
    brancher($('#nvListe'), N.notes, dessinerNotes);
  }
  $$('#nvVueNotes .ec-filtres .chip').forEach(c => c.onclick = () => { $$('#nvVueNotes .ec-filtres .chip').forEach(x => x.classList.toggle('on', x === c)); dessinerNotes(); });
  $$('#nvTri button').forEach(b => b.onclick = () => { BK.regler('notesvid.tri', b.dataset.t); dessinerNotes(); });
  $('#nvTout').onclick = () => { N.tout = !N.tout; $('#nvTout').classList.toggle('on', N.tout); $('#nvQuand').textContent = N.tout ? 'TOUT' : tps(N.sel ? N.sel.a : pos()); };
  async function ajouterNote() {
    const t = $('#nvTexte').value.trim(); if (!t) return $('#nvTexte').focus();
    if (!N.src) return msg('Choisis d\'abord une vidéo');
    const n = { video: N.src.cle, videoNom: N.src.nom, lien: N.src.lien || $('#nvLien').value || '', t: N.tout ? 0 : Math.round((N.sel ? N.sel.a : pos()) * 10) / 10,
      fin: !N.tout && N.sel ? Math.round(N.sel.b * 10) / 10 : null, tout: !!N.tout, texte: t, auteur: moi(), par: moi(), quand: new Date().toISOString(), reponses: [], regle: false,
      ...(N.traits.length ? { dessin: N.traits.slice(0, 40).map(x => ({ c: x.c, p: x.p.slice(0, 400) })) } : {}) };
    const f = await BK.db.ecrire('notesvid', n); if (N.traits.length) { const d = N.traits; N.traits = []; crayon(false); montrer(d); } N.notes.push(f); N.toutes.push(f);
    $('#nvTexte').value = ''; N.sel = null; majSel(); dessinerNotes(); msg(n.tout ? 'Note sur toute la vidéo' : 'Note ajoutée à ' + tps(n.t));
    BK.annoncerRetours && BK.annoncerRetours(nomLien(n.lien).replace(/^[♪🎥] /, ''), N.src.nom, 'video');
  }
  $('#nvAjout').onclick = ajouterNote;
  $('#nvTexte').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') ajouterNote(); });
  $('#nvCopier').onclick = async () => { const l = visibles(); if (!N.src || !l.length) return msg('Aucune note à copier');
    const T = tri(), lg = n => `${n.regle ? '✓ ' : ''}${n.tout ? 'Toute la vidéo' : tps(n.t) + (n.fin ? '–' + tps(n.fin) : '')}${T === 'membre' ? '' : ' · ' + qui(n)} : ${n.texte}` + (n.reponses || []).map(r => `\n    ↳ ${r.par} : ${r.texte}`).join('');
    const txt = N.src.nom + (N.src.lien ? ' · ' + nomLien(N.src.lien) : '') + '\n' + groupes(l).map(g => (g.cle ? `\n— ${g.titre} —\n` : '\n') + g.l.map(lg).join('\n')).join('\n');
    try { await navigator.clipboard.writeText(txt); msg(l.length + ' note(s) copiée(s)'); } catch (e) { msg('Copie impossible'); } };

  // ---------- Historique de notes : par morceau / tournage › fichier vidéo ----------
  async function rouvrir(n) {
    const [t, id] = [n.video.slice(0, n.video.indexOf(':')), n.video.slice(n.video.indexOf(':') + 1)];
    if (t === 'drive') return depuisDrive({ id, nom: n.videoNom });
    if (t === 'dc') { msg('Ouvre cette vidéo depuis Médias › Discord'); return; }
    msg('Cette vidéo était sur un PC : choisis-la avec « 💻 Ce PC… »');
  }
  async function historique() {
    await Promise.all([chargerToutes(), N.morceaux.length ? 0 : listes()]);
    const parL = {}; for (const n of N.toutes) (parL[n.lien || ''] = parL[n.lien || ''] || []).push(n);
    const ks = Object.keys(parL).sort((a, b) => nomLien(a).localeCompare(nomLien(b)));
    if (!(N.hk in parL)) N.hk = ks[0] ?? '';
    $('#nvHM').innerHTML = ks.length ? ks.map(k => { const l = parL[k], fs = new Set(l.map(n => n.video)).size;
      return `<button class="ec-hm-l${k === N.hk ? ' on' : ''}" data-hk="${esc(k)}"><b>${esc(nomLien(k))}</b><span class="nt">${l.length} note(s) · ${fs} vidéo(s)</span></button>`; }).join('')
      : '<span class="nt">Pas encore de note vidéo.</span>';
    $$('[data-hk]', $('#nvHM')).forEach(b => b.onclick = () => { N.hk = b.dataset.hk; N.hf = ''; historique(); });
    const l = parL[N.hk] || [], fs = {}; for (const n of l) (fs[n.video] = fs[n.video] || { nom: n.videoNom || 'vidéo', n: 0, t: '' }).n++, fs[n.video].t = (n.quand || '') > fs[n.video].t ? n.quand : fs[n.video].t;
    if (N.hf && !fs[N.hf]) N.hf = '';
    $('#nvHTitre').textContent = nomLien(N.hk);
    $('#nvHF').innerHTML = `<option value="">Toutes les vidéos (${l.length})</option>` + Object.entries(fs).sort((a, b) => b[1].t.localeCompare(a[1].t)).map(([k, v]) => `<option value="${esc(k)}"${k === N.hf ? ' selected' : ''}>${esc(v.nom)} (${v.n})</option>`).join('');
    $('#nvHOuvrir').disabled = !N.hf;
    dessinerHisto();
  }
  const listeHisto = () => N.toutes.filter(n => (n.lien || '') === N.hk && (!N.hf || n.video === N.hf));
  function dessinerHisto() { rendreListe($('#nvHL'), listeHisto(), 'Aucune note.'); brancher($('#nvHL'), N.toutes, historique); }
  $('#nvHF').onchange = e => { N.hf = e.target.value; e.target.blur(); $('#nvHOuvrir').disabled = !N.hf; dessinerHisto(); };
  $('#nvHOuvrir').onclick = () => { const n = N.toutes.find(x => x.video === N.hf); if (n) { vue('notes'); rouvrir(n); } };
  $('#nvHCopier').onclick = async () => { const l = listeHisto(); if (!l.length) return msg('Aucune note');
    const txt = nomLien(N.hk) + '\n' + Object.entries(l.reduce((a, n) => ((a[n.videoNom || 'vidéo'] = a[n.videoNom || 'vidéo'] || []).push(n), a), {}))
      .map(([f, ns]) => `\n${f}\n` + ns.sort((a, b) => a.t - b.t).map(n => `${n.regle ? '✓ ' : ''}${n.tout ? 'Toute la vidéo' : tps(n.t)} · ${qui(n)} : ${n.texte}`).join('\n')).join('\n');
    try { await navigator.clipboard.writeText(txt); msg(l.length + ' note(s) copiée(s)'); } catch (e) { msg('Copie impossible'); } };

  // ---------- les deux sous-onglets, la poignée ----------
  function vue(v) { N.vue = v; BK.regler('notesvid.vue', v); $$('#nvVues button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
    $('#nvVueNotes').classList.toggle('hidden', v !== 'notes'); $('#nvVueHisto').classList.toggle('hidden', v !== 'histo'); if (v === 'histo') { vid.pause(); historique(); } }
  $$('#nvVues button').forEach(b => b.onclick = () => vue(b.dataset.v));
  const cols = $('#nvVueNotes'), wN = w => { if (w) cols.style.setProperty('--wn', w + 'px'); else cols.style.removeProperty('--wn'); };
  wN(BK.reglage('notesvid.wNotes', 0));
  $('#nvPoignee').addEventListener('pointerdown', ev => { ev.preventDefault(); const p = $('#nvPoignee'); p.setPointerCapture(ev.pointerId); const dr = cols.getBoundingClientRect().right;
    const bouge = e => wN(Math.max(300, Math.min(cols.getBoundingClientRect().width - 420, Math.round(dr - e.clientX))));
    const fin = () => { p.removeEventListener('pointermove', bouge); p.removeEventListener('pointerup', fin); BK.regler('notesvid.wNotes', parseInt(cols.style.getPropertyValue('--wn')) || 0); };
    p.addEventListener('pointermove', bouge); p.addEventListener('pointerup', fin); });
  $('#nvPoignee').ondblclick = () => { wN(0); BK.regler('notesvid.wNotes', 0); };

  (BK.surOuvrir = BK.surOuvrir || {}).notesvid = async () => { await listes(); if (N.vue === 'histo') historique(); else chargerNotes(); };
  vue(N.vue); listes().then(() => { const d = BK.reglage('notesvid.derniere', null); if (d && d.cle && d.cle.startsWith('drive:') && BK.drive.relie()) {
    $('#nvFich').textContent = d.nom + ' (clique « Choisir » ou rouvre-la depuis l\'historique)'; } });
});
})();
