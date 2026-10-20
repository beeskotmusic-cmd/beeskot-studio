// =====================================================================
// REELS — choisir un passage, sa durée, la vitesse de tournage,
// et sortir 2 fichiers : MONTAGE (vitesse normale) et TOURNAGE (vitesse choisie).
// =====================================================================
(() => {
const DUREES = [15, 20, 30, 45, 60, 90];
const R = { nom: '', buffer: null, url: '', pics: null, debut: 0, duree: 30, v: 1, garderNote: true, elan: 0, fondu: false, lecture: null };

BK.module('reels', function (page) {
  $('.hdr .right', page).innerHTML = `
    <div><span class="eng" style="font-size:9px">Morceau</span><span class="vfd" id="reNomH" style="width:220px">—</span></div>
    <div><span class="eng" style="font-size:9px">Reel</span><span class="vfd" id="reDurH">30 S</span></div>`;
  $('.sub', page).textContent = 'Choisis un passage, sa durée et la vitesse de tournage';

  $('.grid', page).innerHTML = `
    <div class="cols">
      <section class="pane vit" aria-label="Vitrine"><span class="ptitle">① Vitrine</span>
        <div class="box pick" id="reZone">
          <button class="btn arrow rond" id="rePlay" disabled title="Écouter le passage (barre d'espace)">▶</button>
          <div><span class="lb">Morceau</span><span class="nt mono" id="reFich">Glisse un WAV ou un MP3 ici, ou clique sur Charger</span></div>
          <button class="btn xs" id="rePick">Charger…</button>
          <input type="file" id="reInput" accept="audio/*,.wav,.mp3,.aif,.aiff,.flac,.m4a,.ogg" hidden>
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
            <div class="kb"><select id="reDuree" class="knobify" data-short="${DUREES.map(d => d + ' S').join(',')}" data-ticks="${DUREES.join(',')}">
              ${DUREES.map(d => `<option value="${d}"${d === 30 ? ' selected' : ''}>${d} s</option>`).join('')}</select>
              <span class="lb">Durée du reel</span></div>
            <div class="kb"><input id="reVit" type="range" min="50" max="200" step="5" value="100" class="knobify" data-ticks="50,100,150,200" data-fmt="{} %">
              <span class="lb">Vitesse tournage</span></div></div>
          <span class="nt conseil">Conseillé pour un reel musical : <b>15 à 30 s</b>. Court = plus revu en boucle. Jusqu'à 90 s possible.</span>
          <span class="nt" id="reExplique"></span>
          <div class="chips" style="margin-top:10px"><button class="chip on" id="reNote" title="Sinon, accélérer fait monter la musique dans les aigus">Garder la note</button></div></div>
        <div class="box"><span class="lb">Options</span>
          <span class="nt">Élan : la musique de tournage démarre un peu avant, pour se mettre dans le rythme.</span>
          <div class="chips" style="margin-top:8px" id="reElan"><button class="chip on" data-e="0">Sans élan</button><button class="chip" data-e="2">Élan 2 s</button><button class="chip" data-e="4">Élan 4 s</button></div>
          <div class="chips" style="margin-top:8px"><button class="chip" id="reFondu">Fondu de fin (1 s)</button></div></div>
      </section>
    </div>
    <div class="pane abar" aria-label="Barre"><span class="ptitle">③ Barre</span>
      <span class="vfd" id="reMsg">CHARGE UN MORCEAU</span>
      <div class="right">
        <button class="btn" id="reEcouteT" disabled>Écouter le tournage</button>
        <button class="btn pri" id="reExport" disabled>Exporter les 2 fichiers ▶</button></div></div>`;

  const msg = t => $('#reMsg').textContent = t.toUpperCase();
  const cv = $('#reCanvas'), onde = $('#reOnde'), bloc = $('#reBloc'), tete = $('#reTete');
  const audio = new Audio(); audio.preload = 'auto';

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
  BK.reelsCharger = charger;                       // la Bibliothèque pourra envoyer un morceau ici
  $('#rePick').onclick = () => $('#reInput').click();
  $('#reInput').onchange = e => e.target.files[0] && charger(e.target.files[0]);
  page.addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('dropping'); });
  page.addEventListener('dragleave', e => { if (e.target === page) document.body.classList.remove('dropping'); });
  page.addEventListener('drop', e => { e.preventDefault(); document.body.classList.remove('dropping'); const f = e.dataTransfer.files[0]; f && charger(f); });

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
    // règle du temps
    const D = R.buffer.duration, pas = D > 240 ? 30 : D > 120 ? 15 : 10;
    $('#reRegle').innerHTML = Array.from({ length: Math.floor(D / pas) + 1 }, (_, i) => `<span style="left:${i * pas / D * 100}%">${BK.audio.temps(i * pas).replace(/\.\d$/, '')}</span>`).join('');
  }
  new ResizeObserver(() => dessiner()).observe(onde);

  // ---------- mise à jour des afficheurs ----------
  function maj() {
    if (!R.buffer) return;
    const D = R.buffer.duration;
    R.duree = Math.min(R.duree, D); R.debut = Math.max(0, Math.min(R.debut, D - R.duree));
    bloc.style.left = (R.debut / D * 100) + '%'; bloc.style.width = (R.duree / D * 100) + '%';
    $('#reBlocTxt').textContent = Math.round(R.duree) + ' s';
    $('#reDeb').textContent = BK.audio.temps(R.debut); $('#reFin').textContent = BK.audio.temps(R.debut + R.duree);
    $('#reDurM').textContent = BK.audio.temps(R.duree); $('#reDurT').textContent = BK.audio.temps(R.duree / R.v + (R.elan || 0) / R.v);
    $('#reDurH').textContent = Math.round(R.duree) + ' S';
  }
  function expliquer() {
    const v = R.v, x = (n, d = 2) => n.toLocaleString('fr-CA', { maximumFractionDigits: d });
    $('#reExplique').innerHTML = v === 1
      ? 'Vitesse normale : vous filmez sur la vraie musique.'
      : v < 1
        ? `Musique <b>ralentie (×${x(v)})</b> : vous jouez plus lentement au tournage. Au montage, <b>accélère l'image ×${x(1 / v)}</b> : les gestes deviennent plus vifs et tout reste synchro.`
        : `Musique <b>accélérée (×${x(v)})</b> : filme en <b>${[30, 60, 120, 240].find(f => f >= 30 * v - 0.01) || 240} images/s</b> (ou plus), puis au montage <b>ralentis l'image à ${x(100 / v, 0)} %</b> : effet ralenti, lèvres et doigts synchro.`;
    maj();
  }

  // ---------- glisser le bloc / ses bords, cliquer pour placer la tête ----------
  let drag = null;
  const tempsA = clientX => { const r = onde.getBoundingClientRect(); return Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * R.buffer.duration; };
  bloc.addEventListener('pointerdown', e => { if (!R.buffer) return; e.stopPropagation(); bloc.setPointerCapture(e.pointerId);
    drag = { mode: e.target.classList.contains('g') ? 'g' : e.target.classList.contains('d') ? 'd' : 'm', t0: tempsA(e.clientX), deb: R.debut, dur: R.duree }; });
  bloc.addEventListener('pointermove', e => { if (!drag) return; const dt = tempsA(e.clientX) - drag.t0;
    if (drag.mode === 'm') R.debut = drag.deb + dt;
    if (drag.mode === 'd') { R.duree = Math.max(3, drag.dur + dt); libre(); }
    if (drag.mode === 'g') { const fin = drag.deb + drag.dur; R.debut = Math.min(fin - 3, Math.max(0, drag.deb + dt)); R.duree = fin - R.debut; libre(); }
    maj(); });
  bloc.addEventListener('pointerup', () => { drag = null; });
  onde.addEventListener('pointerdown', e => { if (!R.buffer || e.target !== cv) return; audio.currentTime = tempsA(e.clientX); montrerTete(); });
  function libre() { $('#reDuree').closest('.kb').querySelector('.kval').textContent = 'LIBRE ' + Math.round(R.duree) + ' S'; }

  // ---------- écoute ----------
  function montrerTete() { if (!R.buffer) return; tete.classList.remove('hidden'); tete.style.left = (audio.currentTime / R.buffer.duration * 100) + '%'; }
  function stop() { audio.pause(); cancelAnimationFrame(R.lecture); R.lecture = null; $('#rePlay').textContent = '▶'; }
  function ecouter(vitesse) {
    if (!R.buffer) return;
    if (R.lecture) return stop();
    const debut = vitesse === 1 ? R.debut : Math.max(0, R.debut - R.elan);
    audio.preservesPitch = audio.mozPreservesPitch = audio.webkitPreservesPitch = R.garderNote;
    audio.playbackRate = vitesse; audio.currentTime = debut; audio.play();
    $('#rePlay').textContent = '■';
    const fin = R.debut + R.duree;
    const tic = () => { montrerTete(); if (audio.currentTime >= fin || audio.paused) return stop(); R.lecture = requestAnimationFrame(tic); };
    R.lecture = requestAnimationFrame(tic);
  }
  $('#rePlay').onclick = () => ecouter(1);
  $('#reEcouteT').onclick = () => ecouter(R.v);
  document.addEventListener('keydown', e => {
    if (page.classList.contains('hidden') || !R.buffer || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); ecouter(1); }
    if (e.key === 'i' || e.key === 'I') $('#reI').click();
    if (e.key === 'o' || e.key === 'O') $('#reO').click();
  });
  $('#reI').onclick = () => { if (!R.buffer) return; const fin = R.debut + R.duree; R.debut = audio.currentTime; if (fin - R.debut >= 3) { R.duree = fin - R.debut; libre(); } maj(); };
  $('#reO').onclick = () => { if (!R.buffer) return; const t = audio.currentTime; if (t - R.debut >= 3) { R.duree = t - R.debut; libre(); maj(); } };

  // ---------- réglages ----------
  $('#reDuree').onchange = e => { R.duree = +e.target.value; maj(); };
  $('#reVit').oninput = e => { R.v = +e.target.value / 100; expliquer(); };
  $('#reNote').onclick = e => { R.garderNote = !R.garderNote; e.target.classList.toggle('on', R.garderNote); };
  $$('#reElan .chip').forEach(c => c.onclick = () => { R.elan = +c.dataset.e; $$('#reElan .chip').forEach(x => x.classList.toggle('on', x === c)); maj(); });
  $('#reFondu').onclick = e => { R.fondu = !R.fondu; e.target.classList.toggle('on', R.fondu); };

  // ---------- export ----------
  $('#reExport').onclick = async () => {
    if (!R.buffer) return; stop();
    const b = $('#reExport'); b.disabled = true; b.innerHTML = '<span class="spin"></span>Export…';
    try {
      const sr = R.buffer.sampleRate, d = Math.round(R.duree), dossier = BK.chemin('Reels', R.nom);
      const montage = BK.audio.extraire(R.buffer, R.debut, R.debut + R.duree, 0.01, R.fondu ? 1 : 0.02);
      msg('Fichier montage…'); await BK.audio.pause();
      const p1 = await BK.enregistrerFichier(dossier, `${R.nom}_REEL_${d}s_MONTAGE.wav`, BK.audio.wav(montage, sr), 'audio/wav');
      let p2 = null;
      if (R.v !== 1 || R.elan) {
        const deb = Math.max(0, R.debut - R.elan);
        const brut = BK.audio.extraire(R.buffer, deb, R.debut + R.duree, R.elan ? Math.min(1, R.elan) : 0.01, R.fondu ? 1 : 0.02);
        const t = await BK.audio.vitesse(brut, sr, R.v, R.garderNote, p => msg('Fichier tournage… ' + Math.round(p * 100) + ' %'));
        const nomV = String(Math.round(R.v * 100)).padStart(3, '0');
        p2 = await BK.enregistrerFichier(dossier, `${R.nom}_REEL_${d}s_TOURNAGE_${nomV}pc.wav`, BK.audio.wav(t, sr), 'audio/wav');
      }
      msg(p2 ? '2 fichiers prêts' : 'Fichier prêt (vitesse normale : un seul fichier)');
    } catch (e) { msg('Erreur à l\'export'); console.error(e); }
    b.disabled = false; b.textContent = 'Exporter les 2 fichiers ▶';
  };

  expliquer();
});
})();
