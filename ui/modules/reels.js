// =====================================================================
// ASSISTANT AUDIO REEL — choisir un passage, sa durée, la vitesse de tournage,
// et sortir 2 fichiers : MONTAGE (vitesse normale) et TOURNAGE (vitesse choisie,
// avec si on veut un élan musical ou un clic 1-2-3-4 ×2 avant le passage).
// =====================================================================
(() => {
const R = { nom: '', buffer: null, url: '', pics: null, debut: 0, duree: 30, v: 1, elan: 0, clic: false, bpm: 0,
  fondu: false, lecture: null, source: BK.reglage('reel.source', 'biblio'), timers: [] };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const x2 = (n, d = 2) => n.toLocaleString('fr-CA', { maximumFractionDigits: d });

// ---------- le clic d'élan : 2 mesures de 4 temps (1er temps plus aigu) ----------
function fabriquerClic(sr, bpm, canaux) {
  const temps = 60 / bpm, n = Math.round(8 * temps * sr), out = Array.from({ length: canaux }, () => new Float32Array(n));
  for (let k = 0; k < 8; k++) {
    const a = Math.round(k * temps * sr), f = k % 4 === 0 ? 2000 : 1400, L = Math.round(0.04 * sr);
    for (let i = 0; i < L && a + i < n; i++) { const v = Math.sin(2 * Math.PI * f * i / sr) * Math.exp(-i / (0.008 * sr)) * 0.7; for (const c of out) c[a + i] = v; }
  }
  return out;
}
const coller = (a, b) => a.map((x, c) => { const y = new Float32Array(x.length + b[c].length); y.set(x); y.set(b[c], x.length); return y; });

BK.module('reels', function (page) {
  $('.hdr .right', page).innerHTML = `
    <div><span class="eng" style="font-size:9px">Morceau</span><span class="vfd" id="reNomH" style="width:220px">—</span></div>
    <div><span class="eng" style="font-size:9px">Reel</span><span class="vfd" id="reDurH">30 S</span></div>`;
  $('.sub', page).textContent = 'Choisis un passage, sa durée et la vitesse de tournage';

  $('.grid', page).innerHTML = `
    <div class="cols">
      <section class="pane vit" aria-label="Vitrine">
        <div class="seg reel-src" id="reSrc"><button data-s="biblio">Depuis la Bibliothèque</button><button data-s="fichier">Charger un fichier</button></div>
        <div class="box pick" id="reZoneF">
          <div><span class="lb">Fichier</span><span class="nt mono" id="reFich">Glisse un WAV ou un MP3 ici, ou clique sur Charger</span></div>
          <button class="btn xs" id="rePick">Charger…</button>
          <input type="file" id="reInput" accept="audio/*,.wav,.mp3,.aif,.aiff,.flac,.m4a,.ogg" hidden>
        </div>
        <div class="box pick hidden" id="reZoneB">
          <div class="reel-biblio">
            <label><span class="eng">Morceau</span><select class="fld" id="reMorceau"><option value="">—</option></select></label>
            <label><span class="eng">Version</span><select class="fld" id="reVersion"><option value="">—</option></select></label></div>
          <button class="btn xs" id="reCharger">Charger</button>
        </div>
        <div class="box">
          <div class="re-prevus"><select class="fld" id="rePrevus" title="Les passages déjà choisis pour les tournages (fiches Tournages, PLAN.xlsx, Discord)"><option value="">📋 Passages prévus pour ce morceau…</option></select>
            <button class="btn xs" id="reMiettePass" title="Miette cherche dans Discord les timings donnés pour ce morceau">🍞 Chercher sur Discord</button></div>
          <div class="ligne-titre"><span class="lb">Passage</span>
            <span class="nt" style="margin:0 0 0 auto">Glisse le bloc · tire ses bords · <b>I</b> / <b>O</b> · molette = zoom</span>
            <span class="onde-zoom"><span class="eng">Zoom</span><button class="btn xs" id="reZm" title="Dézoomer">−</button><button class="btn xs" id="reZp" title="Zoomer (molette) · clic molette maintenu : glisser à gauche / droite">+</button><button class="btn xs" id="reZpass" title="Zoomer sur le passage">⤢ Passage</button><button class="btn xs" id="reZtout">Tout</button></span></div>
          <div class="onde reel-onde" id="reOnde">
            <canvas id="reCanvas"></canvas>
            <div class="onde-tourn hidden" id="reTourn"><span class="onde-pre" id="rePre"></span><span class="tourn-txt" id="reTournTxt"></span></div>
            <div class="onde-bloc hidden" id="reBloc"><span class="poignee g"></span><span class="bloc-txt" id="reBlocTxt"></span><span class="poignee d"></span></div>
            <div class="onde-tete hidden" id="reTete"></div>
            <span class="nt onde-vide" id="reVide">Aucun morceau chargé</span>
          </div>
          <div class="regle" id="reRegle"></div>
          <div class="compteurs">
            <div><span class="eng">Début</span><span class="vfd" id="reDeb">—</span></div>
            <div><span class="eng">Fin</span><span class="vfd" id="reFin">—</span></div>
            <div><span class="eng">Reel (montage)</span><span class="vfd" id="reDurM">—</span></div>
            <div><span class="eng">Musique de tournage</span><span class="vfd-play"><span class="vfd" id="reDurT">—</span><button class="btn xs ecoute-mini bleu" id="reEcouteT2" title="Écouter la version pour le tournage" disabled>▶</button></span></div>
            <div class="compteurs-btn">
              <button class="btn sm" id="reI" title="Début ici (touche I)">I</button>
              <button class="btn sm" id="reO" title="Fin ici (touche O)">O</button>
            </div>
          </div>
        </div>
        <div class="box reel-ecoute"><span class="lb">Écouter</span>
          <div class="reel-ecoute-btns">
            <button class="btn ecoute bleu" id="reEcouteT" disabled>▶ Version pour le tournage</button>
            <button class="btn ecoute orange" id="rePlay" disabled>▶ Version pour le Reel</button>
          </div>
          <span class="nt" id="reEcouteTxt">Tu entends exactement les fichiers qui seront exportés. Barre d'espace : écoute libre du morceau.</span>
        </div>
      </section>

      <section class="pane reg" aria-label="Réglages"><span class="ptitle">② Réglages</span>
        <div class="box"><span class="lb">Durée et vitesse</span>
          <div class="knobs" style="justify-content:space-around">
            <div class="kb"><input id="reDuree" type="range" min="0" max="90" step="1" value="30" class="knobify" data-ticks="0,15,30,45,60,75,90" data-fmt="{} S">
              <span class="lb">Durée du reel</span></div>
            <div class="kb"><input id="reVit" type="range" min="50" max="200" step="1" value="100" class="knobify" data-ticks="50,100,150,200" data-fmt="{} %">
              <span class="lb">Vitesse tournage</span></div></div>
          <span class="nt conseil">Clique sur un afficheur pour taper ta valeur. Conseillé : <b>15 à 30 s</b> (jusqu'à 90 s).</span>
          <span class="nt" id="reExplique"></span>
          </div>
        <div class="box"><span class="lb">Avant le passage (tournage)</span>
          <div class="chips" style="margin-top:8px"><button class="chip" id="reClic">Pré-clic 1-2-3-4 ×2</button></div>
          <div class="reel-bpm"><span class="eng">Tempo</span><input class="fld" id="reBpm" inputmode="decimal" placeholder="BPM"><button class="btn xs" id="reTap" title="Tape en rythme 4 fois ou plus">Taper</button><span class="nt" id="reBpmLien" style="margin:0"></span></div>
          <span class="nt" id="reClicTxt">Le pré-clic démarre pile 2 mesures avant le passage : place le début du bloc sur un premier temps.</span>
          <div class="chips" style="margin-top:10px" id="reElan"><span class="eng" style="align-self:center;margin-right:4px">Musique avant</span><button class="chip on" data-e="0">Aucune</button><button class="chip" data-e="2">2 s</button><button class="chip" data-e="4">4 s</button></div>
          <div class="chips" style="margin-top:8px"><button class="chip" id="reFondu">Fondu de fin (1 s)</button></div></div>
      </section>
    </div>
    <div class="pane abar" aria-label="Barre">
      <span class="vfd" id="reMsg">CHARGE UN MORCEAU</span>
      <span class="nt" id="reQuoi" style="margin:0 12px"></span>
      <div class="right"><button class="btn hidden" id="reDrive" title="Dans Photos/Vidéos › Tournages › WAV tournages › le morceau">⇪ Tournage → Drive</button><button class="btn pri" id="reExport" disabled>Exporter ▶</button></div></div>`;

  const msg = t => $('#reMsg').textContent = String(t).toUpperCase();
  const cv = $('#reCanvas'), onde = $('#reOnde'), bloc = $('#reBloc'), tete = $('#reTete');
  const audio = new Audio(); audio.preload = 'auto';
  BK.mini.suivre(audio, { page: 'reels', titre: () => 'Assistant audio · ' + (($('#reFich') || {}).textContent || '') });

  // ---------- source : fichier ou Bibliothèque ----------
  function source(s) {
    R.source = s; BK.regler('reel.source', s);
    $$('#reSrc button').forEach(b => b.classList.toggle('on', b.dataset.s === s));
    $('#reZoneF').classList.toggle('hidden', s !== 'fichier'); $('#reZoneB').classList.toggle('hidden', s !== 'biblio');
    if (s === 'biblio') remplirMorceaux();
  }
  $$('#reSrc button').forEach(b => b.onclick = () => source(b.dataset.s));
  async function remplirMorceaux() {
    const ms = (await BK.db.liste('morceaux')).sort((a, b) => a.nom.localeCompare(b.nom));
    const sel = $('#reMorceau'), avant = sel.value;
    sel.innerHTML = '<option value="">— choisir —</option>' + ms.map(m => `<option value="${m.id}">${esc(m.nom)}</option>`).join('');
    sel.value = avant; R.morceaux = ms; remplirVersions();
  }
  window.addEventListener('bk:change', e => { if (R.source === 'biblio' && /morceaux|inventaires/.test(e.detail.col)) remplirMorceaux(); });
  BK.surOuvrir = BK.surOuvrir || {}; BK.surOuvrir.reels = () => { if (R.source === 'biblio') remplirMorceaux(); };
  async function remplirVersions() {
    const m = (R.morceaux || []).find(x => x.id === $('#reMorceau').value), v = $('#reVersion'), avant = v.value;
    if (!m) { v.innerHTML = '<option value="">—</option>'; return; }
    // l'export principal de la fiche d'abord, puis ceux de ce PC, puis ceux du Drive (CL, mix, masters…)
    // l'export ★ de la fiche vient toujours en premier : c'est lui qu'on utilise partout
    const ex = BK.inv.exportsDe(m, await BK.inv.tous(), R.morceaux).filter(f => f.ici || f.drive);
    const i0 = ex.findIndex(f => f.chemin === m.exportPrincipal); if (i0 > 0) ex.unshift(ex.splice(i0, 1)[0]);
    const opts = ex.map(f => ({ v: f.drive ? 'drive:' + f.driveId : f.chemin, nom: f.nom, ou: f.drive ? '☁' : '💻' }));
    if (BK.drive.relie()) {
      v.innerHTML = '<option value="">recherche dans le Drive…</option>';
      try {
        await BK.dossiers.assurer(); const l = BK.trierStems(await BK.dossiers.duMorceau(m, R.morceaux)).filter(f => !f.groupe), vus = new Set(opts.map(o => o.v));
        const rang = f => ({ cl: 0, recording: 1, ableton: 2 }[f.role] ?? 3);
        l.filter(f => /\.(wav|mp3|aiff?|flac)$/i.test(f.name) && !/tournage/i.test(f.name) && f.role !== 'wavtournage')
          .sort((a, b) => rang(a) - rang(b) || (b.modifiedTime || '').localeCompare(a.modifiedTime || ''))
          .forEach(f => { if (!vus.has('drive:' + f.id)) opts.push({ v: 'drive:' + f.id, nom: f.name, ou: '☁' }); });
      } catch (e) {}
      if (($('#reMorceau').value) !== m.id) return;
    }
    v.innerHTML = opts.length ? opts.map((o, i) => `<option value="${esc(o.v)}">${i === 0 ? '★ ' : ''}${o.ou} ${esc(o.nom)}</option>`).join('')
      : '<option value="">aucun export trouvé : ajoute-le dans la fiche (Bibliothèque › Exports)</option>';
    if (avant && opts.some(o => o.v === avant)) v.value = avant;
    if (m.bpm && !R.clicBpmManuel) { R.bpm = parseFloat(String(m.bpm).replace(',', '.')) || 0; $('#reBpm').value = m.bpm; }
    return opts;
  }
  async function chargerVersion() {
    const p = $('#reVersion').value; if (!p) return msg('Aucun export pour ce morceau');
    const nom = ($('#reVersion').selectedOptions[0] || {}).textContent.replace(/^★ /, '').replace(/^\S+ /, '');
    try {
      if (p.startsWith('drive:')) { msg('Téléchargement de ' + nom + '…'); await charger(new File([await BK.drive.telecharger(p.slice(6))], nom)); }
      else { if (!BK.estExe) return msg('Disponible dans le logiciel installé'); msg('Lecture…'); await charger(new File([await BK.fichier.lireOctets(p)], p.split(/[\\/]/).pop())); }
    } catch (e) { msg('Fichier illisible'); }
  }
  $('#reMorceau').onchange = async () => { const o = await remplirVersions(); if (o && o.length) chargerVersion(); };     // on choisit le morceau : il se charge tout seul
  $('#reVersion').onchange = chargerVersion;
  $('#reCharger').onclick = chargerVersion;

  // ---------- chargement ----------
  // le tempo vient du morceau : celui de sa fiche, sinon on le mesure (et on le range dans la fiche)
  async function lierTempo() {
    if (R.clicBpmManuel || !R.buffer) return;
    const ms = R.morceaux || await BK.db.liste('morceaux'), m = R.source === 'biblio' ? ms.find(x => x.id === $('#reMorceau').value) : BK.inv.trouverMorceau(R.nom, ms);
    if (m && m.bpm) { R.bpm = parseFloat(String(m.bpm).replace(',', '.')) || 0; $('#reBpm').value = m.bpm; $('#reBpmLien').textContent = '🔗 ' + m.nom; majClic(); return; }
    try { const a = await BK.audio.analyser(R.buffer); R.bpm = a.bpm; $('#reBpm').value = a.bpm; $('#reBpmLien').textContent = m ? '🔗 ' + m.nom + ' (mesuré)' : '(mesuré)';
      if (m && !m.bpm) { m.bpm = String(a.bpm); if (!m.ton) m.ton = a.ton; if (!m.duree) m.duree = a.duree; await BK.db.ecrire('morceaux', m); }
      majClic(); } catch (e) {}
  }
  async function charger(file) {
    try {
      msg('Lecture du fichier…'); stop();
      const oct = new Uint8Array(await file.arrayBuffer());
      R.buffer = await BK.audio.decoder(oct);
      R.nom = file.name.replace(/\.[^.]+$/, '');
      if (R.url) URL.revokeObjectURL(R.url);
      R.url = URL.createObjectURL(file); audio.src = R.url;
      R.pics = null; R.debut = Math.min(R.debut, Math.max(0, R.buffer.duration - R.duree));
      if (R.buffer.duration < R.duree) R.duree = Math.floor(R.buffer.duration);
      $('#reFich').textContent = file.name; $('#reNomH').textContent = R.nom.toUpperCase();
      $('#reVide').classList.add('hidden'); bloc.classList.remove('hidden');
      ['#rePlay', '#reEcouteT', '#reEcouteT2', '#reExport'].forEach(s => $(s).disabled = false);
      R.vue = { a: 0, b: R.buffer.duration };
      dessiner(); maj(); msg('Prêt · ' + BK.audio.temps(R.buffer.duration));
      lierTempo();
    } catch (e) { msg('Fichier illisible'); console.error(e); }
  }
  BK.reelsCharger = charger;                       // la Bibliothèque peut envoyer un morceau ici
  BK.reelsMsg = msg;

  // depuis Tournages (PLAN.xlsx) : le morceau + le passage déjà placés.
  // On prend l'export principal de ce PC, sinon le plus récent du Drive (CL, Ableton Projects…).
  BK.reelsPasser = async ({ morceau, debut, fin }) => {
    BK.ouvrir('reels'); source('biblio'); await remplirMorceaux();
    $('#reMorceau').value = morceau.id;
    try {
      const o = await remplirVersions(); if (!o || !o.length) return msg('Aucun export de ' + morceau.nom + ' : ajoute-le dans sa fiche');
      await chargerVersion();
      if (debut != null && fin > debut && R.buffer) { R.debut = debut; R.duree = Math.min(fin - debut, R.buffer.duration - debut); suivreDuree(); maj(); msg(`Passage ${BK.audio.temps(debut)} → ${BK.audio.temps(fin)} placé`); }
    } catch (e) { msg('Impossible : ' + e.message); }
  };
  // ---------- les passages déjà prévus (fiches Tournages, PLAN.xlsx, Discord) ----------
  const enSec = txt => { const t = String(txt || '').replace(/\s*[:'’]\s*/g, ':'), m = t.match(/(\d{1,2}):(\d{2})\s*[-–—à>]+\s*(\d{1,2}):(\d{2})/); return m ? { debut: +m[1] * 60 + +m[2], fin: +m[3] * 60 + +m[4] } : null; };
  async function morceauActuel() {
    const ms = await BK.db.liste('morceaux'), id = R.source === 'biblio' && $('#reMorceau').value;
    return { ms, m: (id && ms.find(x => x.id === id)) || (R.nom ? BK.inv.trouverMorceau(R.nom, ms) : null) };
  }
  async function passagesPrevus() {
    const { ms, m } = await morceauActuel(); if (!m) return { m: null, l: [] };
    const l = [], vu = new Set(), ajout = p => { const k = p.debut + '-' + p.fin; if (!vu.has(k)) { vu.add(k); l.push(p); } };
    const deCeMorceau = nom => { const x = BK.inv.trouverMorceau(nom || '', ms); return x && x.id === m.id; };
    for (const t of await BK.db.liste('tournages')) for (const p of t.plans || []) {
      if (!deCeMorceau(p.reel) && !(t.morceau === m.nom && !p.reel)) continue;
      const ps = enSec(p.audio); if (ps) ajout({ ...ps, nom: '🎬 ' + (t.titre || 'Tournage') + (p.action ? ' · ' + p.action : '') });
    }
    for (const r of await BK.partage.lire('plan.lignes', [])) if (deCeMorceau(r.reel)) { const ps = enSec(r.audio); if (ps) ajout({ ...ps, nom: '📋 PLAN · ' + (r.jour || '') + (r.plans ? ' · ' + r.plans : '') }); }
    for (const p of ((await BK.partage.lire('passages.discord', {}))[m.id] || [])) ajout(p);
    return { m, l };
  }
  async function remplirPrevus() {
    const { m, l } = await passagesPrevus(), sel = $('#rePrevus'); R.prevus = l;
    sel.innerHTML = `<option value="">${!m ? '📋 Choisis d\'abord un morceau' : l.length ? '📋 ' + l.length + ' passage(s) prévu(s) pour ' + m.nom + '…' : '📋 Aucun passage prévu pour ' + m.nom}</option>`
      + l.map((p, i) => `<option value="${i}">${BK.audio.temps(p.debut).replace(/\.\d$/, '')} → ${BK.audio.temps(p.fin).replace(/\.\d$/, '')} · ${p.nom.replace(/</g, '&lt;').slice(0, 70)}</option>`).join('');
  }
  $('#rePrevus').addEventListener('focus', remplirPrevus);
  $('#rePrevus').addEventListener('pointerdown', remplirPrevus);
  $('#rePrevus').onchange = async e => { const p = (R.prevus || [])[+e.target.value]; e.target.value = ''; if (!p) return;
    const { m } = await morceauActuel();
    if (R.buffer && m && ($('#reMorceau').value === m.id || R.source !== 'biblio')) { R.debut = p.debut; R.duree = Math.min(p.fin - p.debut, R.buffer.duration - p.debut); suivreDuree(); maj(); msg(`Passage ${BK.audio.temps(p.debut)} → ${BK.audio.temps(p.fin)} placé`); }
    else if (m) BK.reelsPasser({ morceau: m, debut: p.debut, fin: p.fin }); };
  $('#reMiettePass').onclick = async () => {
    const b = $('#reMiettePass'), { ms, m } = await morceauActuel(); if (!m) return msg('Choisis d\'abord un morceau');
    b.disabled = true; b.innerHTML = '<span class="spin"></span>Miette cherche…';
    try { const l = await BK.discord.passages(m, ms), tout = await BK.partage.lire('passages.discord', {}); tout[m.id] = l; await BK.partage.ecrire('passages.discord', tout);
      msg(l.length ? l.length + ' passage(s) trouvé(s) sur Discord : ouvre « Passages prévus »' : 'Aucun timing trouvé sur Discord pour ' + m.nom); await remplirPrevus(); }
    catch (e) { msg(e.message); }
    b.disabled = false; b.textContent = '🍞 Chercher sur Discord';
  };
  BK.reelAudio = () => R.buffer ? { nom: R.nom, url: R.url, debut: R.debut, duree: R.duree } : null;   // pour l'Assistant visuel
  $('#rePick').onclick = () => $('#reInput').click();
  $('#reInput').onchange = e => e.target.files[0] && charger(e.target.files[0]);
  page.addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('dropping'); });
  page.addEventListener('dragleave', e => { if (e.target === page) document.body.classList.remove('dropping'); });
  page.addEventListener('drop', e => { e.preventDefault(); document.body.classList.remove('dropping'); const f = e.dataTransfer.files[0]; if (f) { source('fichier'); charger(f); } });

  // ---------- forme d'onde ----------
  // la partie visible (zoom) : de R.vue.a à R.vue.b secondes
  const vue = () => R.vue || { a: 0, b: R.buffer.duration };
  const pc = t => { const v = vue(); return (t - v.a) / (v.b - v.a) * 100; };
  function picsVue(w) {
    const v = vue(), sr = R.buffer.sampleRate, d = R.buffer.getChannelData(0), d2 = R.buffer.numberOfChannels > 1 ? R.buffer.getChannelData(1) : d;
    const a0 = Math.floor(v.a * sr), n = Math.max(1, Math.floor((v.b - v.a) * sr)), pas = n / w, out = new Float32Array(w * 2), saut = Math.max(1, Math.floor(pas / 64));
    for (let i = 0; i < w; i++) { let mn = 1, mx = -1; const a = a0 + Math.floor(i * pas), b = Math.min(d.length, a0 + Math.floor((i + 1) * pas) + 1);
      for (let j = a; j < b; j += saut) { const x = (d[j] + d2[j]) / 2; if (x < mn) mn = x; if (x > mx) mx = x; } if (mn > mx) mn = mx = 0; out[i * 2] = mn; out[i * 2 + 1] = mx; }
    return out;
  }
  function zoomer(f, centre) {                       // f < 1 : zoom avant ; centre en secondes
    if (!R.buffer) return; const D = R.buffer.duration, v = vue(), c = centre ?? (v.a + v.b) / 2;
    let L = Math.max(2, Math.min(D, (v.b - v.a) * f)), a = c - (c - v.a) * (L / (v.b - v.a)); a = Math.max(0, Math.min(D - L, a));
    R.vue = { a, b: a + L }; R.pics = null; dessiner(); maj(); montrerTete();
  }
  function decaler(dt) { if (!R.buffer) return; const D = R.buffer.duration, v = vue(), L = v.b - v.a, a = Math.max(0, Math.min(D - L, v.a + dt)); R.vue = { a, b: a + L }; R.pics = null; dessiner(); maj(); montrerTete(); }
  function dessiner() {
    if (!R.buffer) return;
    const w = onde.clientWidth, h = onde.clientHeight, dpr = window.devicePixelRatio || 1;
    cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const cleV = vue().a.toFixed(3) + '|' + vue().b.toFixed(3) + '|' + w;
    if (!R.pics || R.picsCle !== cleV) { R.pics = picsVue(w); R.picsCle = cleV; }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, '#ffcf7a'); grad.addColorStop(.5, '#ffb23e'); grad.addColorStop(1, '#c97a12');
    g.fillStyle = grad; g.shadowColor = 'rgba(255,160,40,.5)'; g.shadowBlur = 4;
    for (let x = 0; x < w; x++) { const mn = R.pics[x * 2], mx = R.pics[x * 2 + 1]; g.fillRect(x, h / 2 - mx * h * .46, 1, Math.max(1, (mx - mn) * h * .46)); }
    const v = vue(), L = v.b - v.a, pas = [0.5, 1, 2, 5, 10, 15, 30, 60].find(p => L / p <= 12) || 60, t0 = Math.ceil(v.a / pas) * pas, ticks = [];
    for (let t = t0; t <= v.b + 1e-6; t += pas) ticks.push(t);
    $('#reRegle').innerHTML = ticks.map(t => `<span style="left:${pc(t)}%">${pas < 1 ? BK.audio.temps(t) : BK.audio.temps(t).replace(/\.\d$/, '')}</span>`).join('');
    $('#reZtout').disabled = L >= R.buffer.duration - 0.01;
  }
  new ResizeObserver(() => dessiner()).observe(onde);

  // ---------- afficheurs ----------
  const dureeClic = () => R.clic && R.bpm ? 8 * 60 / (R.bpm * R.v) : 0;
  function maj() {
    majBouton();
    if (!R.src) $('#reEcouteT').textContent = '▶ Version pour le tournage ×' + x2(R.v);
    if (!R.buffer) return;
    const D = R.buffer.duration;
    R.duree = Math.min(R.duree, D); R.debut = Math.max(0, Math.min(R.debut, D - R.duree));
    bloc.style.left = pc(R.debut) + '%'; bloc.style.width = (pc(R.debut + R.duree) - pc(R.debut)) + '%';
    $('#reBlocTxt').textContent = 'Reel ' + Math.round(R.duree) + ' s';
    // la bande bleue : ce que dure vraiment le fichier de tournage (élan / clic compris, à la vitesse choisie)
    const deux = deuxFichiers(), elan = R.clic ? 0 : R.elan, clicSrc = R.clic && R.bpm ? 8 * 60 / R.bpm : 0;
    const t0 = R.debut - elan - clicSrc, dureeT = dureeClic() + (R.duree + elan) / R.v;
    const tourn = $('#reTourn'); tourn.classList.toggle('hidden', !deux);
    if (deux) { tourn.style.left = pc(t0) + '%'; tourn.style.width = (pc(R.debut + R.duree) - pc(t0)) + '%';
      $('#rePre').style.width = (elan + clicSrc) / (R.duree + elan + clicSrc) * 100 + '%'; $('#rePre').textContent = R.clic ? '1-2-3-4 ×2' : elan ? '+' + elan + ' s' : '';
      $('#rePre').classList.toggle('hidden', !(elan + clicSrc));
      $('#reTournTxt').textContent = `Tournage ${Math.round(dureeT)} s${R.v !== 1 ? ' (×' + x2(R.v) + ')' : ''}`; }
    $('#reDeb').textContent = BK.audio.temps(R.debut); $('#reFin').textContent = BK.audio.temps(R.debut + R.duree);
    $('#reDurM').textContent = BK.audio.temps(R.duree);
    $('#reDurT').textContent = BK.audio.temps(dureeClic() + (R.duree + (R.clic ? 0 : R.elan)) / R.v);
    $('#reDurH').textContent = Math.round(R.duree) + ' S';
  }
  function expliquer() {
    const v = R.v;
    $('#reExplique').innerHTML = v === 1
      ? 'Vitesse normale : vous filmez sur la vraie musique.'
      : v < 1
        ? `Musique <b>ralentie (×${x2(v)})</b> : vous jouez plus lentement au tournage. Au montage, <b>accélère l'image ×${x2(1 / v)}</b> : les gestes deviennent plus vifs et tout reste synchro.`
        : `Musique <b>accélérée (×${x2(v)})</b> : filme en <b>${[30, 60, 120, 240].find(f => f >= 30 * v - 0.01) || 240} images/s</b> (ou plus), puis au montage <b>ralentis l'image à ${x2(100 / v, 0)} %</b> : effet ralenti, lèvres et doigts synchro.`;
    maj();
  }
  function majClic() {
    $('#reClic').classList.toggle('on', R.clic);
    $$('#reElan .chip').forEach(c => c.disabled = R.clic);
    $('#reClicTxt').textContent = R.clic
      ? (R.bpm ? `${x2(R.bpm * R.v, 1)} BPM au tournage : 1-2-3-4, 1-2-3-4, puis le passage. Place le début du bloc sur un premier temps.` : 'Indique le tempo du morceau (ou tape-le en rythme).')
      : 'Le pré-clic démarre pile 2 mesures avant le passage : place le début du bloc sur un premier temps.';
    maj();
  }

  // ---------- glisser le bloc / ses bords ----------
  let drag = null;
  const tempsA = clientX => { const r = onde.getBoundingClientRect(), v = vue(); return v.a + Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * (v.b - v.a); };
  const tempsBrut = clientX => { const r = onde.getBoundingClientRect(), v = vue(); return v.a + (clientX - r.left) / r.width * (v.b - v.a); };   // pour glisser au-delà du bord
  bloc.addEventListener('pointerdown', e => { if (!R.buffer || e.button !== 0) return; e.stopPropagation(); bloc.setPointerCapture(e.pointerId);
    drag = { mode: e.target.classList.contains('g') ? 'g' : e.target.classList.contains('d') ? 'd' : 'm', t0: tempsA(e.clientX), deb: R.debut, dur: R.duree }; });
  bloc.addEventListener('pointermove', e => { if (!drag) return; const dt = tempsBrut(e.clientX) - drag.t0;
    if (drag.mode === 'm') R.debut = drag.deb + dt;
    if (drag.mode === 'd') { R.duree = Math.max(3, drag.dur + dt); suivreDuree(); }
    if (drag.mode === 'g') { const fin = drag.deb + drag.dur; R.debut = Math.min(fin - 3, Math.max(0, drag.deb + dt)); R.duree = fin - R.debut; suivreDuree(); }
    maj(); });
  bloc.addEventListener('pointerup', () => { drag = null; });
  onde.addEventListener('pointerdown', e => { if (!R.buffer || e.button !== 0 || e.target !== cv) return; audio.currentTime = tempsA(e.clientX); montrerTete(); });
  onde.addEventListener('wheel', e => { if (!R.buffer) return; e.preventDefault();       // molette = zoom autour de la souris ; Maj + molette = se déplacer
    if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) { const v = vue(); decaler((e.deltaX || e.deltaY) / 400 * (v.b - v.a)); }
    else zoomer(e.deltaY > 0 ? 1.25 : 0.8, tempsA(e.clientX)); }, { passive: false });
  // clic molette (bouton du milieu) maintenu = attraper la forme d'onde et glisser à gauche / à droite
  onde.addEventListener('mousedown', e => { if (e.button !== 1 || !R.buffer) return; e.preventDefault(); e.stopPropagation();
    let x = e.clientX; onde.style.cursor = 'grabbing';
    const bouge = ev => { const v = vue(), w = onde.getBoundingClientRect().width || 1; decaler(-(ev.clientX - x) / w * (v.b - v.a)); x = ev.clientX; };
    const fin = () => { onde.style.cursor = ''; window.removeEventListener('mousemove', bouge); window.removeEventListener('mouseup', fin); };
    window.addEventListener('mousemove', bouge); window.addEventListener('mouseup', fin); }, true);
  onde.addEventListener('auxclick', e => { if (e.button === 1) e.preventDefault(); });
  $('#reZp').onclick = () => zoomer(0.6, R.debut + R.duree / 2);
  $('#reZm').onclick = () => zoomer(1 / 0.6, R.debut + R.duree / 2);
  $('#reZpass').onclick = () => { if (!R.buffer) return; const D = R.buffer.duration, marge = Math.max(1, R.duree * 0.15), a = Math.max(0, R.debut - marge), b = Math.min(D, R.debut + R.duree + marge); R.vue = { a, b }; R.pics = null; dessiner(); maj(); montrerTete(); };
  $('#reZtout').onclick = () => { if (!R.buffer) return; R.vue = { a: 0, b: R.buffer.duration }; R.pics = null; dessiner(); maj(); montrerTete(); };
  function suivreDuree() { const el = $('#reDuree'); el.value = Math.min(90, Math.round(R.duree)); el.knobMaj && el.knobMaj(); }

  // ---------- les 2 fichiers (fabriqués une fois, écoutés puis exportés tels quels) ----------
  const deuxFichiers = () => R.v !== 1 || R.elan || R.clic;
  const cle = t => [t, R.nom, R.debut.toFixed(3), R.duree.toFixed(3), R.fondu, ...(t === 'T' ? [R.v, R.clic ? 0 : R.elan, R.clic, R.bpm] : [])].join('|');
  const cache = {};
  async function fabriquer(t) {
    const k = cle(t); if (cache[t] && cache[t].k === k) return cache[t];
    const sr = R.buffer.sampleRate; let canaux, decal = 0;      // decal = secondes avant le passage (clic ou élan)
    if (t === 'M') canaux = BK.audio.extraire(R.buffer, R.debut, R.debut + R.duree, 0.01, R.fondu ? 1 : 0.02);
    else {
      const elan = R.clic ? 0 : R.elan, deb = Math.max(0, R.debut - elan);
      const brut = BK.audio.extraire(R.buffer, deb, R.debut + R.duree, elan ? Math.min(1, elan) : 0.01, R.fondu ? 1 : 0.02);
      canaux = await BK.audio.vitesse(brut, sr, R.v, true, p => msg('Préparation tournage… ' + Math.round(p * 100) + ' %'));
      decal = -(R.debut - deb) / R.v;
      if (R.clic) { const c = fabriquerClic(sr, R.bpm * R.v, canaux.length); decal = c[0].length / sr; canaux = coller(c, canaux); }
    }
    return cache[t] = { k, canaux, sr, decal };
  }

  // ---------- écoute : on entend EXACTEMENT le fichier qui sera exporté ----------
  function montrerTete(t = audio.currentTime) { if (!R.buffer) return; const p = pc(t); tete.classList.toggle('hidden', p < 0 || p > 100); tete.style.left = p + '%'; }
  function stop() {
    audio.pause(); cancelAnimationFrame(R.lecture); R.lecture = null;
    if (R.src) { try { R.src.onended = null; R.src.stop(); } catch (e) {} R.src = null; }
    $('#reEcouteT').textContent = '▶ Version pour le tournage ×' + x2(R.v); majBouton(); $('#reEcouteT2').textContent = '▶';
  }
  async function ecouter(tournage) {
    if (!R.buffer) return;
    if (R.lecture || R.src) return stop();
    if (tournage && R.clic && !R.bpm) return msg('Indique le tempo pour le pré-clic');
    const b = tournage ? $('#reEcouteT') : $('#rePlay'); b.textContent = '…';
    const f = await fabriquer(tournage ? 'T' : 'M'); msg('Écoute du fichier ' + (tournage ? 'tournage' : 'montage'));
    const ctx = BK.audio.contexte(); if (ctx.state === 'suspended') await ctx.resume();
    const ab = ctx.createBuffer(f.canaux.length, f.canaux[0].length, f.sr); f.canaux.forEach((c, i) => ab.copyToChannel(c, i));
    const src = ctx.createBufferSource(); src.buffer = ab; src.connect(ctx.destination);
    const v = tournage ? R.v : 1, t0 = ctx.currentTime + 0.05; src.start(t0); R.src = src; b.textContent = '■ Stop'; if (tournage) $('#reEcouteT2').textContent = '■';
    src.onended = () => { R.src = null; stop(); };
    const tic = () => { const e = ctx.currentTime - t0 - f.decal; if (e >= 0) montrerTete(R.debut + e * v); R.lecture = requestAnimationFrame(tic); };
    R.lecture = requestAnimationFrame(tic);
  }
  $('#rePlay').onclick = () => ecouter(false);
  $('#reEcouteT').onclick = () => ecouter(true);
  $('#reEcouteT2').onclick = () => ecouter(true);
  document.addEventListener('keydown', e => {
    if (page.classList.contains('hidden') || !R.buffer || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); if (R.src) stop(); if (audio.paused) { audio.play(); const tic = () => { montrerTete(); if (!audio.paused) R.lecture = requestAnimationFrame(tic); }; R.lecture = requestAnimationFrame(tic); } else stop(); }
    if (e.key === 'i' || e.key === 'I') $('#reI').click();
    if (e.key === 'o' || e.key === 'O') $('#reO').click();
  });
  $('#reI').onclick = () => { if (!R.buffer) return; const fin = R.debut + R.duree; R.debut = audio.currentTime; if (fin - R.debut >= 3) { R.duree = fin - R.debut; suivreDuree(); } maj(); };
  $('#reO').onclick = () => { if (!R.buffer) return; const t = audio.currentTime; if (t - R.debut >= 3) { R.duree = t - R.debut; suivreDuree(); maj(); } };

  // ---------- réglages ----------
  $('#reDuree').onchange = e => { R.duree = Math.max(3, +e.target.value); maj(); };
  $('#reVit').oninput = $('#reVit').onchange = e => { R.v = +e.target.value / 100; expliquer(); majClic(); };
  $$('#reElan .chip').forEach(c => c.onclick = () => { R.elan = +c.dataset.e; $$('#reElan .chip').forEach(x => x.classList.toggle('on', x === c)); maj(); });
  $('#reFondu').onclick = e => { R.fondu = !R.fondu; e.target.classList.toggle('on', R.fondu); };
  $('#reClic').onclick = () => { R.clic = !R.clic; majClic(); };
  $('#reBpm').onchange = e => { R.bpm = parseFloat(e.target.value.replace(',', '.')) || 0; R.clicBpmManuel = true; $('#reBpmLien').textContent = '(à la main)'; majClic(); };
  let taps = [];
  $('#reTap').onclick = () => {                                // taper le tempo en rythme
    const t = performance.now(); taps = taps.filter(x => t - x < 3000); taps.push(t);
    if (taps.length >= 4) { const ecarts = taps.slice(1).map((x, i) => x - taps[i]); R.bpm = Math.round(60000 / (ecarts.reduce((a, b) => a + b) / ecarts.length) * 10) / 10;
      $('#reBpm').value = R.bpm; R.clicBpmManuel = true; majClic(); }
  };

  // ---------- export ----------
  // chaque export « montage » est noté : l'Assistant visuel Reel le retrouve tout seul (menu Musique)
  BK.reelsExports = BK.reelsExports || {};
  async function garderExport(chemin, nom, octets) {
    if (!chemin) return;
    const { m } = await morceauActuel().catch(() => ({}));
    const e = { id: Date.now().toString(36), nom, chemin, morceau: m ? m.nom : R.nom, debut: R.debut, duree: R.duree, t: new Date().toISOString() };
    BK.reelsExports[e.id] = URL.createObjectURL(new Blob([octets], { type: 'audio/wav' }));
    await BK.exportsAudio.ajouter(e);
    if (BK.suiviEnCours) { try { const l = await BK.db.liste('reels'), r = l.find(x => x.id === BK.suiviEnCours);     // relié à la page Reels
      if (r) { r.audio = e.id; r.passage = { debut: R.debut, fin: R.debut + R.duree }; if (r.statut === 'idee') r.statut = 'audio';
        await BK.db.ecrire('reels', r); BK.suiviRecharger && BK.suiviRecharger(); } } catch (er) {} }
  }
  $('#reExport').onclick = async () => {
    if (!R.buffer) return; stop();
    if (R.clic && !R.bpm) return msg('Indique le tempo pour le pré-clic');
    const b = $('#reExport'); b.disabled = true; b.innerHTML = '<span class="spin"></span>Export…';
    try {
      const d = Math.round(R.duree), dossier = BK.chemin('Reels', R.nom), m = await fabriquer('M');
      if (!deuxFichiers()) {
        const o = BK.audio.wav(m.canaux, m.sr), p = await BK.enregistrerFichier(dossier, `${R.nom}_REEL_${d}s.wav`, o, 'audio/wav');
        garderExport(p, `${R.nom}_REEL_${d}s.wav`, o);
        msg('Fichier prêt');
      } else {
        const o = BK.audio.wav(m.canaux, m.sr), p = await BK.enregistrerFichier(dossier, `${R.nom}_REEL_${d}s_MONTAGE.wav`, o, 'audio/wav');
        garderExport(p, `${R.nom}_REEL_${d}s_MONTAGE.wav`, o);
        await BK.audio.pause();
        const t = await fabriquer('T'), nomV = String(Math.round(R.v * 100)).padStart(3, '0');
        await BK.enregistrerFichier(dossier, `${R.nom}_REEL_${d}s_TOURNAGE_${nomV}pc${R.clic ? '_CLIC' : ''}.wav`, BK.audio.wav(t.canaux, t.sr), 'audio/wav');
        msg('2 fichiers prêts');
        R.dernierTournage = { octets: BK.audio.wav(t.canaux, t.sr), nom: `${R.nom}_REEL_${d}s_TOURNAGE_${nomV}pc${R.clic ? '_CLIC' : ''}.wav` };
        $('#reDrive').classList.toggle('hidden', !BK.drive.relie());
      }
    } catch (e) { msg('Erreur à l\'export'); console.error(e); }
    b.disabled = false; majBouton();
  };
  $('#reDrive').onclick = async () => {
    const f = R.dernierTournage; if (!f) return;
    try {
      await BK.dossiers.assurer(); const w = await BK.dossiers.get('wavtournage'); if (!w) return msg('Dossier « WAV tournages » introuvable (Réglages)');
      const ms = R.morceaux || await BK.db.liste('morceaux'), m = BK.inv.trouverMorceau(R.nom, ms);
      const sous = (await BK.dossiers.enfants(w.id, true)).find(x => m && BK.inv.trouverMorceau(x.name, ms) === m);
      const dos = sous ? sous.id : await BK.drive.dossier((m ? m.nom : R.nom).toUpperCase().replace(/\s+/g, ''), w.id);
      await BK.drive.envoyerBlob(new Blob([f.octets], { type: 'audio/wav' }), f.nom, dos, p => msg('Envoi · ' + Math.round(p * 100) + ' %'));
      msg('Dans le Drive ✓ (WAV tournages)'); $('#reDrive').classList.add('hidden');
    } catch (e) { msg('Envoi impossible : ' + e.message); }
  };
  function majBouton() {
    const deux = deuxFichiers();
    $('#reExport').textContent = deux ? 'Exporter les 2 fichiers ▶' : 'Exporter le fichier ▶';
    $('#reEcouteT').classList.toggle('hidden', !deux);
    $('.reel-ecoute-btns').classList.toggle('seul', !deux);
    if (!R.src) $('#rePlay').textContent = deux ? '▶ Version pour le Reel' : '▶ Écouter (même fichier pour tourner et monter)';
    $('#reQuoi').innerHTML = deux ? '<b>Tournage</b> = à passer pendant qu\'on filme · <b>Montage</b> = à poser dans Premiere' : 'Vitesse normale, sans clic : un seul fichier, pour filmer et monter.';
  }

  source(R.source); expliquer(); majClic();
});
})();
