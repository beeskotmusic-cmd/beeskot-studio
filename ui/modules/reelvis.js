// =====================================================================
// ASSISTANT VISUEL REEL — voir à quoi ressemblera un reel :
// cadre 9:16, gabarit Instagram ou TikTok (zones du pseudo, de la légende
// et des boutons), une vidéo glissée dedans, recadrée et coupée,
// avec la musique du passage choisi dans l'Assistant audio Reel.
// (Étapes suivantes : LUT, sous-titres synchronisés, export MP4.)
// =====================================================================
(() => {
// zones occupées par l'interface des applis, en % de l'écran 9:16 (valeurs moyennes 2026)
const GABARITS = {
  insta:  { nom: 'Instagram', haut: 11, bas: 20, droite: 14 },
  tiktok: { nom: 'TikTok',    haut: 9,  bas: 24, droite: 15 },
  aucun:  { nom: 'Aucun',     haut: 0,  bas: 0,  droite: 0 },
};
const V = { gabarit: BK.reglage('rv.gabarit', 'insta'), zones: true, zoom: 100, x: 0, y: 0, debut: 0, fin: 0, musique: 'video', lecture: null };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function calque(g) {          // l'interface « type » de l'appli, dessinée en formes simples (sans logos)
  if (g === 'aucun') return '';
  const icones = ['♡', '💬', '➤', '⋯'].map(i => `<span class="rv-ic">${i}</span>`).join('');
  return `<div class="rv-ui rv-${g}">
    <div class="rv-haut">${g === 'insta' ? '<b>Reels</b><span>⌕</span>' : '<span>Abonnements</span><b>Pour toi</b><span>⌕</span>'}</div>
    <div class="rv-droite">${g === 'tiktok' ? '<span class="rv-avatar"></span>' : ''}${icones}</div>
    <div class="rv-bas"><div class="rv-compte"><span class="rv-avatar petit"></span><b>beeskot</b><span class="rv-suivre">Suivre</span></div>
      <div class="rv-legende">La légende du reel apparaît ici… #beeskot</div>
      <div class="rv-son">♫ BEESKOT · son original</div></div>
  </div>`;
}

BK.module('reelvis', function (page) {
  $('.sub', page).textContent = 'Voir le reel dans le gabarit Instagram ou TikTok';
  $('.hdr .right', page).innerHTML = `<div><span class="eng" style="font-size:9px">Vidéo</span><span class="vfd" id="rvNomH" style="width:200px">—</span></div>
    <div><span class="eng" style="font-size:9px">Durée</span><span class="vfd" id="rvDurH">—</span></div>`;
  $('.grid', page).innerHTML = `
    <div class="cols">
      <section class="pane vit rv-vit"><span class="ptitle">① Vitrine</span>
        <div class="rv-scene">
          <div class="rv-tel" id="rvTel">
            <div class="rv-ecran" id="rvEcran">
              <video id="rvVideo" playsinline preload="auto"></video>
              <div class="rv-vide" id="rvVide"><span class="dymo">Glisse une vidéo ici</span><span class="nt">MP4, MOV… · ou bouton « Charger »</span></div>
              <div class="rv-zones" id="rvZones"></div>
              <div id="rvCalque"></div>
            </div>
          </div>
          <div class="rv-cote">
            <div class="box"><span class="lb">Couper la vidéo</span>
              <div class="rv-trim"><span class="eng">Début</span><input type="range" id="rvDeb" min="0" max="100" step="0.1" value="0"><span class="vfd" id="rvDebV">0:00.0</span></div>
              <div class="rv-trim"><span class="eng">Fin</span><input type="range" id="rvFin" min="0" max="100" step="0.1" value="100"><span class="vfd" id="rvFinV">0:00.0</span></div>
              <span class="nt">Durée gardée : <b id="rvGarde">—</b></span></div>
            <div class="box"><span class="lb">Recadrer</span>
              <span class="nt">Fais glisser l'image dans le téléphone pour la déplacer.</span>
              <div class="knobs" style="justify-content:center"><div class="kb">
                <input id="rvZoom" type="range" min="100" max="300" step="1" value="100" class="knobify" data-ticks="100,150,200,250,300" data-fmt="{} %"><span class="lb">Zoom</span></div></div>
              <div class="chips"><button class="chip" id="rvCentre">Recentrer</button></div></div>
          </div>
        </div>
      </section>
      <section class="pane reg"><span class="ptitle">② Réglages</span>
        <div class="box"><span class="lb">Gabarit</span>
          <div class="chips" style="margin-top:10px" id="rvGab">${Object.entries(GABARITS).map(([k, g]) => `<button class="chip" data-g="${k}">${g.nom}</button>`).join('')}</div>
          <div class="chips" style="margin-top:8px"><button class="chip on" id="rvZonesB">Montrer les zones à éviter</button></div>
          <span class="nt">Les zones hachurées sont cachées par l'appli (pseudo, légende, boutons) : n'y mets rien d'important.</span></div>
        <div class="box"><span class="lb">Musique</span>
          <div class="chips" style="margin-top:10px" id="rvMus"><button class="chip" data-m="video">Son de la vidéo</button><button class="chip" data-m="reel">Passage de l'Assistant audio</button></div>
          <span class="nt" id="rvMusTxt"></span></div>
        <div class="box"><span class="lb">Bientôt</span><span class="nt">LUT (couleur), sous-titres synchronisés avec les paroles, export MP4.</span></div>
      </section>
    </div>
    <div class="pane abar"><span class="ptitle">③ Barre</span><span class="vfd" id="rvMsg">GLISSE UNE VIDÉO</span>
      <div class="right"><button class="btn" id="rvPick">Charger une vidéo…</button><input type="file" id="rvInput" accept="video/*" hidden>
        <button class="btn pri" id="rvPlay" disabled>▶ Lire</button></div></div>`;

  const msg = t => $('#rvMsg').textContent = String(t).toUpperCase();
  const vid = $('#rvVideo'), ecran = $('#rvEcran'), son = new Audio();
  const t2 = BK.audio.temps;

  // ---------- gabarit + zones ----------
  function majGabarit() {
    const g = GABARITS[V.gabarit];
    $$('#rvGab .chip').forEach(c => c.classList.toggle('on', c.dataset.g === V.gabarit));
    $('#rvCalque').innerHTML = calque(V.gabarit);
    $('#rvZones').innerHTML = V.zones && V.gabarit !== 'aucun' ? `<i style="top:0;left:0;right:0;height:${g.haut}%"></i><i style="bottom:0;left:0;right:0;height:${g.bas}%"></i><i style="top:${g.haut}%;bottom:${g.bas}%;right:0;width:${g.droite}%"></i>` : '';
  }
  $$('#rvGab .chip').forEach(c => c.onclick = () => { V.gabarit = c.dataset.g; BK.regler('rv.gabarit', V.gabarit); majGabarit(); });
  $('#rvZonesB').onclick = e => { V.zones = !V.zones; e.target.classList.toggle('on', V.zones); majGabarit(); };

  // ---------- charger une vidéo ----------
  function charger(f) {
    if (!f || !/^video\//.test(f.type) && !/\.(mp4|mov|m4v|webm)$/i.test(f.name)) return msg('Ce n\'est pas une vidéo');
    if (V.url) URL.revokeObjectURL(V.url);
    V.url = URL.createObjectURL(f); vid.src = V.url; V.nom = f.name;
    $('#rvNomH').textContent = f.name.replace(/\.[^.]+$/, '').toUpperCase(); msg('Lecture de la vidéo…');
  }
  vid.onloadedmetadata = () => {
    V.debut = 0; V.fin = vid.duration;
    for (const id of ['#rvDeb', '#rvFin']) { $(id).max = vid.duration; }
    $('#rvDeb').value = 0; $('#rvFin').value = vid.duration;
    $('#rvVide').classList.add('hidden'); $('#rvPlay').disabled = false; V.x = V.y = 0; placer(); majTrim();
    msg(`Vidéo prête · ${vid.videoWidth}×${vid.videoHeight}`);
  };
  vid.onerror = () => msg('Vidéo illisible (essaie un MP4)');
  $('#rvPick').onclick = () => $('#rvInput').click();
  $('#rvInput').onchange = e => charger(e.target.files[0]);
  page.addEventListener('dragover', e => { e.preventDefault(); ecran.classList.add('survol'); });
  page.addEventListener('dragleave', e => { if (e.target === page) ecran.classList.remove('survol'); });
  page.addEventListener('drop', e => { e.preventDefault(); ecran.classList.remove('survol'); charger(e.dataTransfer.files[0]); });

  // ---------- couper ----------
  function majTrim() {
    V.debut = Math.min(+$('#rvDeb').value, V.fin - 0.5); V.fin = Math.max(+$('#rvFin').value, V.debut + 0.5);
    $('#rvDebV').textContent = t2(V.debut); $('#rvFinV').textContent = t2(V.fin);
    $('#rvGarde').textContent = t2(V.fin - V.debut); $('#rvDurH').textContent = Math.round(V.fin - V.debut) + ' S';
  }
  $('#rvDeb').oninput = () => { majTrim(); vid.currentTime = V.debut; };
  $('#rvFin').oninput = () => { majTrim(); vid.currentTime = V.fin; };

  // ---------- recadrer : zoom + glisser l'image ----------
  function placer() {
    const s = V.zoom / 100;
    vid.style.transform = `translate(${V.x}%, ${V.y}%) scale(${s})`;
  }
  $('#rvZoom').onchange = $('#rvZoom').oninput = e => { V.zoom = +e.target.value; placer(); };
  $('#rvCentre').onclick = () => { V.x = V.y = 0; placer(); };
  let d0 = null;
  ecran.addEventListener('pointerdown', e => { if (!vid.src) return; d0 = { x: e.clientX, y: e.clientY, vx: V.x, vy: V.y }; ecran.setPointerCapture(e.pointerId); });
  ecran.addEventListener('pointermove', e => { if (!d0) return; const r = ecran.getBoundingClientRect();
    V.x = d0.vx + (e.clientX - d0.x) / r.width * 100; V.y = d0.vy + (e.clientY - d0.y) / r.height * 100; placer(); });
  ecran.addEventListener('pointerup', () => d0 = null);

  // ---------- musique ----------
  function majMusique() {
    $$('#rvMus .chip').forEach(c => c.classList.toggle('on', c.dataset.m === V.musique));
    const r = BK.reelAudio && BK.reelAudio();
    $('#rvMusTxt').textContent = V.musique === 'reel'
      ? (r ? `Passage de « ${r.nom} » : ${t2(r.debut)} → ${t2(r.debut + r.duree)}` : 'Choisis d\'abord un passage dans l\'Assistant audio Reel.')
      : 'Le son d\'origine de la vidéo.';
  }
  $$('#rvMus .chip').forEach(c => c.onclick = () => { V.musique = c.dataset.m; majMusique(); });
  BK.surOuvrir = BK.surOuvrir || {}; BK.surOuvrir.reelvis = majMusique;

  // ---------- lecture ----------
  function stop() { vid.pause(); son.pause(); cancelAnimationFrame(V.lecture); V.lecture = null; $('#rvPlay').textContent = '▶ Lire'; }
  $('#rvPlay').onclick = () => {
    if (V.lecture) return stop();
    const r = V.musique === 'reel' && BK.reelAudio && BK.reelAudio();
    vid.currentTime = V.debut; vid.muted = !!r;
    if (r) { son.src = r.url; son.currentTime = r.debut; son.play(); }
    vid.play(); $('#rvPlay').textContent = '■ Stop';
    const fin = r ? Math.min(V.fin, V.debut + r.duree) : V.fin;
    const tic = () => { if (vid.currentTime >= fin || vid.paused) return stop(); V.lecture = requestAnimationFrame(tic); };
    V.lecture = requestAnimationFrame(tic);
  };

  majGabarit(); majMusique();
});
})();
