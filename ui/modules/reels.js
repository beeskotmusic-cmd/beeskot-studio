// =====================================================================
// ASSISTANT AUDIO REEL — choisir un passage, sa durée, la vitesse de tournage,
// et sortir 2 fichiers : MONTAGE (vitesse normale) et TOURNAGE (vitesse choisie,
// avec si on veut un élan musical ou un clic 1-2-3-4 ×2 avant le passage).
// =====================================================================
(() => {
const R = { nom: '', buffer: null, url: '', pics: null, debut: 0, duree: 30, v: 1, garderNote: true, elan: 0, clic: false, bpm: 0,
  fondu: false, lecture: null, source: BK.reglage('reel.source', 'fichier'), timers: [] };
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
      <section class="pane vit" aria-label="Vitrine"><span class="ptitle">① Vitrine</span>
        <div class="seg reel-src" id="reSrc"><button data-s="fichier">Charger un fichier</button><button data-s="biblio">Depuis la Bibliothèque</button></div>
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
        <div class="box grow">
          <div class="ligne-titre"><span class="lb">Passage</span>
            <span class="nt" style="margin:0 0 0 auto">Glisse le bloc · tire ses bords · <b>I</b> / <b>O</b> = début / fin à la tête de lecture</span></div>
          <div class="onde" id="reOnde">
            <canvas id="reCanvas"></canvas>
            <div class="onde-bloc hidden" id="reBloc"><span class="poignee g"></span><span class="bloc-txt" id="reBlocTxt"></span><span class="poignee d"></span></div>
            <div class="onde-tete hidden" id="reTete"></div>
            <span class="nt onde-vide" id="reVide">Aucun morceau chargé</span>
          </div>
          <div class="regle" id="reRegle"></div>
          <div class="compteurs">
            <button class="btn ecoute" id="rePlay" disabled title="Écouter le passage (barre d'espace)">▶ Normal</button>
            <button class="btn ecoute warm" id="reEcouteT" disabled>▶ Tournage</button>
            <div><span class="eng">Début</span><span class="vfd" id="reDeb">—</span></div>
            <div><span class="eng">Fin</span><span class="vfd" id="reFin">—</span></div>
            <div><span class="eng">Reel (montage)</span><span class="vfd" id="reDurM">—</span></div>
            <div><span class="eng">Musique de tournage</span><span class="vfd" id="reDurT">—</span></div>
            <div class="compteurs-btn">
              <button class="btn sm" id="reI" title="Début ici (touche I)">I</button>
              <button class="btn sm" id="reO" title="Fin ici (touche O)">O</button>
            </div>
          </div>
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
          <div class="chips" style="margin-top:10px"><button class="chip on" id="reNote" title="Sinon, accélérer fait monter la musique dans les aigus">Garder la note</button></div></div>
        <div class="box"><span class="lb">Avant le passage (tournage)</span>
          <div class="chips" style="margin-top:8px"><button class="chip" id="reClic">Clic d'élan 1-2-3-4 ×2</button></div>
          <div class="reel-bpm"><span class="eng">Tempo</span><input class="fld" id="reBpm" inputmode="decimal" placeholder="BPM"><button class="btn xs" id="reTap" title="Tape en rythme 4 fois ou plus">Taper</button></div>
          <span class="nt" id="reClicTxt">Le clic démarre pile 2 mesures avant le passage : place le début du bloc sur un premier temps.</span>
          <div class="chips" style="margin-top:10px" id="reElan"><button class="chip on" data-e="0">Sans élan musical</button><button class="chip" data-e="2">Élan 2 s</button><button class="chip" data-e="4">Élan 4 s</button></div>
          <div class="chips" style="margin-top:8px"><button class="chip" id="reFondu">Fondu de fin (1 s)</button></div></div>
      </section>
    </div>
    <div class="pane abar" aria-label="Barre"><span class="ptitle">③ Barre</span>
      <span class="vfd" id="reMsg">CHARGE UN MORCEAU</span>
      <div class="right"><button class="btn pri" id="reExport" disabled>Exporter les 2 fichiers ▶</button></div></div>`;

  const msg = t => $('#reMsg').textContent = String(t).toUpperCase();
  const cv = $('#reCanvas'), onde = $('#reOnde'), bloc = $('#reBloc'), tete = $('#reTete');
  const audio = new Audio(); audio.preload = 'auto';

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
  async function remplirVersions() {
    const m = (R.morceaux || []).find(x => x.id === $('#reMorceau').value), v = $('#reVersion');
    if (!m) { v.innerHTML = '<option value="">—</option>'; return; }
    const fs = (await BK.inv.tous()).filter(f => f.type === 'audio' && f.ici && BK.inv.trouverMorceau(f.nom, R.morceaux) === m).sort((a, b) => (b.modif || '').localeCompare(a.modif || ''));
    v.innerHTML = fs.length ? fs.map((f, i) => `<option value="${esc(f.chemin)}">${i === 0 ? '★ ' : ''}${esc(f.nom)}</option>`).join('')
      : '<option value="">aucun export sur ce PC (Bibliothèque › Scanner ce PC)</option>';
    if (m.bpm && !R.clicBpmManuel) { R.bpm = parseFloat(String(m.bpm).replace(',', '.')) || 0; $('#reBpm').value = m.bpm; }
  }
  $('#reMorceau').onchange = remplirVersions;
  $('#reCharger').onclick = async () => {
    const p = $('#reVersion').value; if (!p) return msg('Choisis une version');
    if (!BK.estExe) return msg('Disponible dans le logiciel installé');
    try { msg('Lecture…'); const o = await BK.fichier.lireOctets(p); await charger(new File([o], p.split(/[\\/]/).pop())); } catch (e) { msg('Fichier illisible'); }
  };

  // ---------- chargement ----------
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
      ['#rePlay', '#reEcouteT', '#reExport'].forEach(s => $(s).disabled = false);
      dessiner(); maj(); msg('Prêt · ' + BK.audio.temps(R.buffer.duration));
    } catch (e) { msg('Fichier illisible'); console.error(e); }
  }
  BK.reelsCharger = charger;                       // la Bibliothèque peut envoyer un morceau ici
  $('#rePick').onclick = () => $('#reInput').click();
  $('#reInput').onchange = e => e.target.files[0] && charger(e.target.files[0]);
  page.addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('dropping'); });
  page.addEventListener('dragleave', e => { if (e.target === page) document.body.classList.remove('dropping'); });
  page.addEventListener('drop', e => { e.preventDefault(); document.body.classList.remove('dropping'); const f = e.dataTransfer.files[0]; if (f) { source('fichier'); charger(f); } });

  // ---------- forme d'onde ----------
  function dessiner() {
    if (!R.buffer) return;
    const w = onde.clientWidth, h = onde.clientHeight, dpr = window.devicePixelRatio || 1;
    cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px';
    if (!R.pics || R.pics.length !== w * 2) R.pics = BK.audio.pics(R.buffer, w);
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, '#ffcf7a'); grad.addColorStop(.5, '#ffb23e'); grad.addColorStop(1, '#c97a12');
    g.fillStyle = grad; g.shadowColor = 'rgba(255,160,40,.5)'; g.shadowBlur = 4;
    for (let x = 0; x < w; x++) { const mn = R.pics[x * 2], mx = R.pics[x * 2 + 1]; g.fillRect(x, h / 2 - mx * h * .46, 1, Math.max(1, (mx - mn) * h * .46)); }
    const D = R.buffer.duration, pas = D > 240 ? 30 : D > 120 ? 15 : 10;
    $('#reRegle').innerHTML = Array.from({ length: Math.floor(D / pas) + 1 }, (_, i) => `<span style="left:${i * pas / D * 100}%">${BK.audio.temps(i * pas).replace(/\.\d$/, '')}</span>`).join('');
  }
  new ResizeObserver(() => dessiner()).observe(onde);

  // ---------- afficheurs ----------
  const dureeClic = () => R.clic && R.bpm ? 8 * 60 / (R.bpm * R.v) : 0;
  function maj() {
    $('#reEcouteT').textContent = '▶ Tournage ×' + x2(R.v);
    if (!R.buffer) return;
    const D = R.buffer.duration;
    R.duree = Math.min(R.duree, D); R.debut = Math.max(0, Math.min(R.debut, D - R.duree));
    bloc.style.left = (R.debut / D * 100) + '%'; bloc.style.width = (R.duree / D * 100) + '%';
    $('#reBlocTxt').textContent = Math.round(R.duree) + ' s';
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
      : 'Le clic démarre pile 2 mesures avant le passage : place le début du bloc sur un premier temps.';
    maj();
  }

  // ---------- glisser le bloc / ses bords ----------
  let drag = null;
  const tempsA = clientX => { const r = onde.getBoundingClientRect(); return Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * R.buffer.duration; };
  bloc.addEventListener('pointerdown', e => { if (!R.buffer) return; e.stopPropagation(); bloc.setPointerCapture(e.pointerId);
    drag = { mode: e.target.classList.contains('g') ? 'g' : e.target.classList.contains('d') ? 'd' : 'm', t0: tempsA(e.clientX), deb: R.debut, dur: R.duree }; });
  bloc.addEventListener('pointermove', e => { if (!drag) return; const dt = tempsA(e.clientX) - drag.t0;
    if (drag.mode === 'm') R.debut = drag.deb + dt;
    if (drag.mode === 'd') { R.duree = Math.max(3, drag.dur + dt); suivreDuree(); }
    if (drag.mode === 'g') { const fin = drag.deb + drag.dur; R.debut = Math.min(fin - 3, Math.max(0, drag.deb + dt)); R.duree = fin - R.debut; suivreDuree(); }
    maj(); });
  bloc.addEventListener('pointerup', () => { drag = null; });
  onde.addEventListener('pointerdown', e => { if (!R.buffer || e.target !== cv) return; audio.currentTime = tempsA(e.clientX); montrerTete(); });
  function suivreDuree() { const el = $('#reDuree'); el.value = Math.min(90, Math.round(R.duree)); el.knobMaj && el.knobMaj(); }

  // ---------- écoute (le tournage s'écoute avec son clic ou son élan) ----------
  function montrerTete() { if (!R.buffer) return; tete.classList.remove('hidden'); tete.style.left = (audio.currentTime / R.buffer.duration * 100) + '%'; }
  function stop() {
    audio.pause(); cancelAnimationFrame(R.lecture); R.lecture = null; R.timers.forEach(clearTimeout); R.timers = [];
    $('#rePlay').textContent = '▶ Normal'; $('#reEcouteT').textContent = '▶ Tournage ×' + x2(R.v);
  }
  function ecouter(tournage) {
    if (!R.buffer) return;
    if (R.lecture || R.timers.length) return stop();
    const v = tournage ? R.v : 1, debut = tournage && !R.clic ? Math.max(0, R.debut - R.elan) : R.debut;
    audio.preservesPitch = audio.mozPreservesPitch = audio.webkitPreservesPitch = R.garderNote;
    audio.playbackRate = v; audio.currentTime = debut;
    (tournage ? $('#reEcouteT') : $('#rePlay')).textContent = '■ Stop';
    const lancer = () => {
      audio.play(); const fin = R.debut + R.duree;
      const tic = () => { montrerTete(); if (audio.currentTime >= fin || audio.paused) return stop(); R.lecture = requestAnimationFrame(tic); };
      R.lecture = requestAnimationFrame(tic);
    };
    if (tournage && R.clic && R.bpm) {                       // 8 clics, puis la musique
      const ctx = BK.audio.contexte(), t0 = ctx.currentTime + 0.1, temps = 60 / (R.bpm * v);
      for (let k = 0; k < 8; k++) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = k % 4 ? 1400 : 2000;
        g.gain.setValueAtTime(0.5, t0 + k * temps); g.gain.exponentialRampToValueAtTime(0.001, t0 + k * temps + 0.05);
        o.connect(g).connect(ctx.destination); o.start(t0 + k * temps); o.stop(t0 + k * temps + 0.06); }
      R.timers.push(setTimeout(() => { R.timers = []; lancer(); }, (0.1 + 8 * temps) * 1000));
    } else lancer();
  }
  $('#rePlay').onclick = () => ecouter(false);
  $('#reEcouteT').onclick = () => ecouter(true);
  document.addEventListener('keydown', e => {
    if (page.classList.contains('hidden') || !R.buffer || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); ecouter(false); }
    if (e.key === 'i' || e.key === 'I') $('#reI').click();
    if (e.key === 'o' || e.key === 'O') $('#reO').click();
  });
  $('#reI').onclick = () => { if (!R.buffer) return; const fin = R.debut + R.duree; R.debut = audio.currentTime; if (fin - R.debut >= 3) { R.duree = fin - R.debut; suivreDuree(); } maj(); };
  $('#reO').onclick = () => { if (!R.buffer) return; const t = audio.currentTime; if (t - R.debut >= 3) { R.duree = t - R.debut; suivreDuree(); maj(); } };

  // ---------- réglages ----------
  $('#reDuree').onchange = e => { R.duree = Math.max(3, +e.target.value); maj(); };
  $('#reVit').oninput = $('#reVit').onchange = e => { R.v = +e.target.value / 100; expliquer(); majClic(); };
  $('#reNote').onclick = e => { R.garderNote = !R.garderNote; e.target.classList.toggle('on', R.garderNote); };
  $$('#reElan .chip').forEach(c => c.onclick = () => { R.elan = +c.dataset.e; $$('#reElan .chip').forEach(x => x.classList.toggle('on', x === c)); maj(); });
  $('#reFondu').onclick = e => { R.fondu = !R.fondu; e.target.classList.toggle('on', R.fondu); };
  $('#reClic').onclick = () => { R.clic = !R.clic; majClic(); };
  $('#reBpm').onchange = e => { R.bpm = parseFloat(e.target.value.replace(',', '.')) || 0; R.clicBpmManuel = true; majClic(); };
  let taps = [];
  $('#reTap').onclick = () => {                                // taper le tempo en rythme
    const t = performance.now(); taps = taps.filter(x => t - x < 3000); taps.push(t);
    if (taps.length >= 4) { const ecarts = taps.slice(1).map((x, i) => x - taps[i]); R.bpm = Math.round(60000 / (ecarts.reduce((a, b) => a + b) / ecarts.length) * 10) / 10;
      $('#reBpm').value = R.bpm; R.clicBpmManuel = true; majClic(); }
  };

  // ---------- export ----------
  $('#reExport').onclick = async () => {
    if (!R.buffer) return; stop();
    if (R.clic && !R.bpm) return msg('Indique le tempo pour le clic d\'élan');
    const b = $('#reExport'); b.disabled = true; b.innerHTML = '<span class="spin"></span>Export…';
    try {
      const sr = R.buffer.sampleRate, d = Math.round(R.duree), dossier = BK.chemin('Reels', R.nom);
      const montage = BK.audio.extraire(R.buffer, R.debut, R.debut + R.duree, 0.01, R.fondu ? 1 : 0.02);
      msg('Fichier montage…'); await BK.audio.pause();
      await BK.enregistrerFichier(dossier, `${R.nom}_REEL_${d}s_MONTAGE.wav`, BK.audio.wav(montage, sr), 'audio/wav');
      let p2 = null;
      if (R.v !== 1 || R.elan || R.clic) {
        const elan = R.clic ? 0 : R.elan, deb = Math.max(0, R.debut - elan);
        const brut = BK.audio.extraire(R.buffer, deb, R.debut + R.duree, elan ? Math.min(1, elan) : 0.01, R.fondu ? 1 : 0.02);
        let t = await BK.audio.vitesse(brut, sr, R.v, R.garderNote, p => msg('Fichier tournage… ' + Math.round(p * 100) + ' %'));
        if (R.clic) t = coller(fabriquerClic(sr, R.bpm * R.v, t.length), t);
        const nomV = String(Math.round(R.v * 100)).padStart(3, '0');
        p2 = await BK.enregistrerFichier(dossier, `${R.nom}_REEL_${d}s_TOURNAGE_${nomV}pc${R.clic ? '_CLIC' : ''}.wav`, BK.audio.wav(t, sr), 'audio/wav');
      }
      msg(p2 ? '2 fichiers prêts' : 'Fichier prêt (vitesse normale : un seul fichier)');
    } catch (e) { msg('Erreur à l\'export'); console.error(e); }
    b.disabled = false; b.textContent = 'Exporter les 2 fichiers ▶';
  };

  source(R.source); expliquer(); majClic();
});
})();
