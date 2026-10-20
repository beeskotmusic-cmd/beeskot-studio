// =====================================================================
// ASSISTANT VISUEL REEL — un petit montage pour les réseaux :
//   vidéo glissée dans un cadre 9:16 · gabarit Instagram / TikTok (zones à éviter)
//   couper (début / fin) · recadrer (zoom + glisser) · couleur (LUT .cube)
//   sous-titres calés sur la musique (paroles de la fiche) · export MP4 1080×1920
// =====================================================================
(() => {
const GABARITS = {                 // zones occupées par l'interface des applis (en % de l'écran 9:16)
  insta:  { nom: 'Instagram', haut: 11, bas: 20, droite: 14 },
  tiktok: { nom: 'TikTok',    haut: 9,  bas: 24, droite: 15 },
  aucun:  { nom: 'Aucun',     haut: 0,  bas: 0,  droite: 0 },
};
const V = { gabarit: BK.reglage('rv.gabarit', 'insta'), zones: true, zoom: 100, x: 0, y: 0, debut: 0, fin: 0, musique: 'video',
  lecture: null, lut: null, lutNom: '', force: 100, sous: [], lignes: [], calage: -1, sousOn: true };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function calque(g) {               // l'interface « type » de l'appli, en formes simples (sans logos)
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
  $('.sub', page).textContent = 'Couper, recadrer, couleur, sous-titres, export MP4';
  $('.hdr .right', page).innerHTML = `<div><span class="eng" style="font-size:9px">Vidéo</span><span class="vfd" id="rvNomH" style="width:200px">—</span></div>
    <div><span class="eng" style="font-size:9px">Durée</span><span class="vfd" id="rvDurH">—</span></div>`;
  $('.grid', page).innerHTML = `
    <div class="cols">
      <section class="pane vit rv-vit"><span class="ptitle">① Vitrine</span>
        <div class="rv-scene">
          <div class="rv-tel"><div class="rv-ecran" id="rvEcran">
            <canvas id="rvCanvas" width="540" height="960"></canvas>
            <video id="rvVideo" playsinline preload="auto" hidden></video>
            <div class="rv-vide" id="rvVide"><span class="dymo">Glisse une vidéo ici</span><span class="nt">MP4, MOV… · ou bouton « Charger »</span></div>
            <div class="rv-zones" id="rvZones"></div><div id="rvCalque"></div>
          </div></div>
          <div class="rv-cote">
            <div class="box"><div class="ligne-titre"><span class="lb">Couper la vidéo</span>
                <span class="nt" style="margin:0 0 0 auto">Glisse le bloc · tire ses bords · <b>I</b> / <b>O</b> = début / fin à la tête de lecture</span></div>
              <div class="onde rv-bande" id="rvBande">
                <div class="rv-vignettes" id="rvVign"></div>
                <div class="onde-bloc hidden" id="rvBloc"><span class="poignee g"></span><span class="bloc-txt" id="rvBlocTxt"></span><span class="poignee d"></span></div>
                <div class="onde-tete hidden" id="rvTete"></div>
                <span class="nt onde-vide" id="rvBandeVide">Aucune vidéo</span>
              </div>
              <div class="compteurs">
                <div><span class="eng">Début</span><span class="vfd" id="rvDebV">—</span></div>
                <div><span class="eng">Fin</span><span class="vfd" id="rvFinV">—</span></div>
                <div><span class="eng">Durée gardée</span><span class="vfd" id="rvGarde">—</span></div>
                <div class="compteurs-btn"><button class="btn sm" id="rvI" title="Début ici (touche I)">I</button><button class="btn sm" id="rvO" title="Fin ici (touche O)">O</button></div>
              </div></div>
            <div class="box"><span class="lb">Recadrer et couleur</span>
              <span class="nt">Fais glisser l'image dans le téléphone pour la déplacer.</span>
              <div class="rv-reglages">
                <span class="eng">Zoom</span><input class="fld rv-glisse" id="rvZoom" value="0 %" title="Clic maintenu et glisse la souris (ou double-clic pour taper)">
                <button class="chip" id="rvCentre">Recentrer</button></div>
              <div class="chips"><button class="chip" id="rvLutB">Charger une LUT (.cube)…</button><button class="chip hidden" id="rvLutX">Sans LUT</button></div>
              <input type="file" id="rvLutIn" accept=".cube" hidden><span class="nt" id="rvLutNom"></span></div>
            <div class="box grow"><div class="ligne-titre"><span class="lb">Sous-titres</span>
                <button class="chip on" id="rvSousOn" style="margin-left:auto">Afficher</button></div>
              <div class="rv-sous-src"><select class="fld" id="rvSousM"><option value="">Paroles d'un morceau…</option></select><button class="btn xs" id="rvSousColler">Coller du texte…</button></div>
              <button class="btn sm warm" id="rvCaler" disabled>⏺ Caler en écoutant (Espace à chaque phrase)</button>
              <div class="rv-sous" id="rvSous"><span class="nt">Choisis les paroles d'un morceau, puis « Caler en écoutant » : appuie sur Espace au début de chaque phrase.</span></div></div>
          </div>
        </div>
      </section>
      <section class="pane reg"><span class="ptitle">② Réglages</span>
        <div class="box"><span class="lb">Gabarit</span>
          <div class="chips" style="margin-top:10px" id="rvGab">${Object.entries(GABARITS).map(([k, g]) => `<button class="chip" data-g="${k}">${g.nom}</button>`).join('')}</div>
          <div class="chips" style="margin-top:8px"><button class="chip on" id="rvZonesB">Montrer les zones à éviter</button></div>
          <span class="nt">Les zones hachurées sont cachées par l'appli : n'y mets rien d'important. Le gabarit n'apparaît pas dans le MP4.</span></div>
        <div class="box"><span class="lb">Musique</span>
          <div class="chips" style="margin-top:10px" id="rvMus"><button class="chip" data-m="video">Son de la vidéo</button><button class="chip" data-m="reel">Passage de l'Assistant audio</button></div>
          <span class="nt" id="rvMusTxt"></span></div>
        <div class="box"><span class="lb">Export</span><span class="nt">MP4 vertical 1080×1920, 30 images/s. L'export prend un peu plus de temps que la durée du reel : le PC reste utilisable.</span></div>
      </section>
    </div>
    <div class="pane abar"><span class="ptitle">③ Barre</span><span class="vfd" id="rvMsg">GLISSE UNE VIDÉO</span>
      <div class="right"><button class="btn" id="rvPick">Charger une vidéo…</button><input type="file" id="rvInput" accept="video/*" hidden>
        <button class="btn" id="rvPlay" disabled>▶ Lire</button><button class="btn pri" id="rvExport" disabled>Exporter en MP4 ▶</button></div></div>`;

  const msg = t => $('#rvMsg').textContent = String(t).toUpperCase();
  const vid = $('#rvVideo'), ecran = $('#rvEcran'), cv = $('#rvCanvas'), cx2 = cv.getContext('2d'), son = new Audio(), t2 = BK.audio.temps;
  const r = BK.rendu.creer(540, 960);
  const cadre = () => ({ zoom: V.zoom / 100, x: V.x, y: V.y });
  const tReel = () => vid.currentTime - V.debut;                    // temps depuis le début du reel
  function dessiner() { if (!vid.videoWidth) return; r.dessiner(vid, cadre(), V.force / 100, V.sousOn ? BK.rendu.texteA(V.sous, tReel()) : ''); cx2.drawImage(r.sortie, 0, 0); }

  // ---------- gabarit ----------
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
    if (!f || (!/^video\//.test(f.type) && !/\.(mp4|mov|m4v|webm)$/i.test(f.name))) return msg('Ce n\'est pas une vidéo');
    if (V.url) URL.revokeObjectURL(V.url);
    V.fichier = f; V.url = URL.createObjectURL(f); vid.src = V.url; V.nom = f.name.replace(/\.[^.]+$/, '');
    $('#rvNomH').textContent = V.nom.toUpperCase(); msg('Lecture de la vidéo…');
  }
  vid.onloadedmetadata = () => {
    V.debut = 0; V.fin = vid.duration; $('#rvBloc').classList.remove('hidden'); $('#rvBandeVide').classList.add('hidden'); vignettes();
    $('#rvVide').classList.add('hidden'); ['#rvPlay', '#rvExport', '#rvCaler'].forEach(s => $(s).disabled = false);
    V.x = V.y = 0; reglerZoom(100); majTrim(); msg(`Vidéo prête · ${vid.videoWidth}×${vid.videoHeight}`);
  };
  vid.onseeked = () => { if (!V.lecture) dessiner(); };
  vid.onerror = () => msg('Vidéo illisible (essaie un MP4)');
  $('#rvPick').onclick = () => $('#rvInput').click();
  $('#rvInput').onchange = e => charger(e.target.files[0]);
  page.addEventListener('dragover', e => { e.preventDefault(); ecran.classList.add('survol'); });
  page.addEventListener('dragleave', e => { if (e.target === page) ecran.classList.remove('survol'); });
  page.addEventListener('drop', e => { e.preventDefault(); ecran.classList.remove('survol'); const f = e.dataTransfer.files[0]; if (!f) return;
    if ( /\.cube$/i.test(f.name)) return chargerLut(f); charger(f); });

  // ---------- couper : une bande d'images avec un bloc, comme l'Assistant audio ----------
  const bande = $('#rvBande'), bloc = $('#rvBloc'), tete = $('#rvTete');
  function majTrim() {
    const D = vid.duration || 1;
    V.debut = Math.max(0, Math.min(V.debut, D - 0.5)); V.fin = Math.min(D, Math.max(V.fin, V.debut + 0.5));
    bloc.style.left = (V.debut / D * 100) + '%'; bloc.style.width = ((V.fin - V.debut) / D * 100) + '%';
    $('#rvBlocTxt').textContent = Math.round(V.fin - V.debut) + ' s';
    $('#rvDebV').textContent = t2(V.debut); $('#rvFinV').textContent = t2(V.fin);
    $('#rvGarde').textContent = t2(V.fin - V.debut); $('#rvDurH').textContent = Math.round(V.fin - V.debut) + ' S';
  }
  function montrerTete() { if (!vid.duration) return; tete.classList.remove('hidden'); tete.style.left = (vid.currentTime / vid.duration * 100) + '%'; }
  vid.addEventListener('timeupdate', montrerTete); vid.addEventListener('seeked', montrerTete);
  async function vignettes() {                    // petites images le long de la bande (une 2e vidéo, sans gêner l'aperçu)
    const n = 10, z = $('#rvVign'); z.innerHTML = ''; const v2 = document.createElement('video'); v2.muted = true; v2.src = V.url; v2.preload = 'auto';
    await new Promise(r => v2.onloadeddata = r);
    const c = document.createElement('canvas'); c.height = 72; c.width = Math.round(72 * v2.videoWidth / v2.videoHeight) || 128; const g = c.getContext('2d');
    for (let i = 0; i < n; i++) {
      if (v2.src !== V.url) return;
      v2.currentTime = (i + 0.5) * v2.duration / n; await new Promise(r => v2.onseeked = r);
      g.drawImage(v2, 0, 0, c.width, c.height); const im = new Image(); im.draggable = false; im.src = c.toDataURL('image/jpeg', 0.6); z.appendChild(im);
      await BK.audio.pause();
    }
    v2.removeAttribute('src'); v2.load();
  }
  let drag = null;
  const tempsA = x => { const b = bande.getBoundingClientRect(); return Math.max(0, Math.min(1, (x - b.left) / b.width)) * vid.duration; };
  bloc.addEventListener('pointerdown', e => { if (!vid.duration) return; e.stopPropagation(); bloc.setPointerCapture(e.pointerId);
    drag = { mode: e.target.classList.contains('g') ? 'g' : e.target.classList.contains('d') ? 'd' : 'm', t0: tempsA(e.clientX), deb: V.debut, fin: V.fin }; });
  bloc.addEventListener('pointermove', e => { if (!drag) return; const dt = tempsA(e.clientX) - drag.t0, D = vid.duration;
    if (drag.mode === 'm') { const l = drag.fin - drag.deb; V.debut = Math.max(0, Math.min(D - l, drag.deb + dt)); V.fin = V.debut + l; vid.currentTime = V.debut; }
    if (drag.mode === 'g') { V.debut = Math.min(drag.fin - 0.5, Math.max(0, drag.deb + dt)); vid.currentTime = V.debut; }
    if (drag.mode === 'd') { V.fin = Math.max(drag.deb + 0.5, Math.min(D, drag.fin + dt)); vid.currentTime = V.fin; }
    majTrim(); });
  bloc.addEventListener('pointerup', () => { drag = null; });
  bande.addEventListener('pointerdown', e => { if (!vid.duration || e.target.closest('#rvBloc')) return; vid.currentTime = tempsA(e.clientX); });
  $('#rvI').onclick = () => { if (!vid.duration) return; V.debut = Math.min(vid.currentTime, V.fin - 0.5); majTrim(); };
  $('#rvO').onclick = () => { if (!vid.duration) return; V.fin = Math.max(vid.currentTime, V.debut + 0.5); majTrim(); };
  document.addEventListener('keydown', e => {
    if (page.classList.contains('hidden') || !vid.duration || V.calage >= 0 || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (e.key === 'i' || e.key === 'I') $('#rvI').click();
    if (e.key === 'o' || e.key === 'O') $('#rvO').click();
  });

  // ---------- recadrer ----------
  const champZoom = $('#rvZoom');
  const reglerZoom = z => { V.zoom = Math.round(Math.max(100, Math.min(400, z))); champZoom.value = (V.zoom - 100) + ' %'; dessiner(); };
  champZoom.readOnly = true; let zg = null;
  champZoom.addEventListener('pointerdown', e => { if (!champZoom.readOnly) return; e.preventDefault(); champZoom.setPointerCapture(e.pointerId); zg = { x: e.clientX, y: e.clientY, z: V.zoom }; });
  champZoom.addEventListener('pointermove', e => { if (!zg) return; reglerZoom(zg.z + (e.clientX - zg.x) - (e.clientY - zg.y)); });
  champZoom.addEventListener('pointerup', () => { zg = null; });
  champZoom.addEventListener('dblclick', () => { champZoom.readOnly = false; champZoom.value = V.zoom - 100; champZoom.select(); });
  const finSaisie = () => { if (champZoom.readOnly) return; champZoom.readOnly = true; const v = parseFloat(champZoom.value.replace(',', '.')); reglerZoom(isNaN(v) ? V.zoom : 100 + v); };
  champZoom.addEventListener('blur', finSaisie);
  champZoom.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') champZoom.blur(); });
  champZoom.addEventListener('wheel', e => { e.preventDefault(); reglerZoom(V.zoom - Math.sign(e.deltaY) * 5); }, { passive: false });
  $('#rvCentre').onclick = () => { V.x = V.y = 0; dessiner(); };
  let d0 = null;
  ecran.addEventListener('pointerdown', e => { if (!vid.videoWidth) return; d0 = { x: e.clientX, y: e.clientY, vx: V.x, vy: V.y }; ecran.setPointerCapture(e.pointerId); });
  ecran.addEventListener('pointermove', e => { if (!d0) return; const b = ecran.getBoundingClientRect();
    V.x = d0.vx + (e.clientX - d0.x) / b.width * 100; V.y = d0.vy + (e.clientY - d0.y) / b.height * 100; dessiner(); });
  ecran.addEventListener('pointerup', () => d0 = null);

  // ---------- couleur : LUT ----------
  async function chargerLut(f) {
    try { V.lut = BK.rendu.lireCube(await f.text()); V.lutNom = f.name; r.lut(V.lut); $('#rvLutNom').textContent = 'LUT : ' + f.name; $('#rvLutX').classList.remove('hidden'); dessiner(); msg('LUT appliquée'); }
    catch (e) { msg(e.message); }
  }
  $('#rvLutB').onclick = () => $('#rvLutIn').click();
  $('#rvLutIn').onchange = e => e.target.files[0] && chargerLut(e.target.files[0]);
  $('#rvLutX').onclick = () => { V.lut = null; r.lut(null); $('#rvLutNom').textContent = ''; $('#rvLutX').classList.add('hidden'); dessiner(); };

  // ---------- sous-titres ----------
  async function remplirMorceaux() {
    const ms = (await BK.db.liste('morceaux')).filter(m => m.paroles).sort((a, b) => a.nom.localeCompare(b.nom)); V.morceaux = ms;
    $('#rvSousM').innerHTML = `<option value="">Paroles d'un morceau…</option>` + ms.map(m => `<option value="${m.id}">${esc(m.nom)}</option>`).join('');
    if (V.ficheId) $('#rvSousM').value = V.ficheId;
  }
  function majSous() {
    const z = $('#rvSous');
    if (!V.lignes.length) { z.innerHTML = '<span class="nt">Aucune parole : remplis-les dans la Bibliothèque (tiroir Paroles), ou colle du texte.</span>'; return; }
    z.innerHTML = V.lignes.map((l, i) => { const s = V.sous.find(x => x.i === i);
      return `<div class="rv-l${V.calage === i ? ' encours' : ''}${s ? ' ok' : ''}"><input class="rv-t mono" data-i="${i}" value="${s ? s.t.toFixed(1) : ''}" placeholder="—"><span>${esc(l)}</span></div>`; }).join('');
    $$('.rv-t', z).forEach(c => c.onchange = () => { const i = +c.dataset.i, t = parseFloat(c.value.replace(',', '.'));
      V.sous = V.sous.filter(x => x.i !== i); if (!isNaN(t)) V.sous.push({ i, t, texte: V.lignes[i] }); V.sous.sort((a, b) => a.t - b.t); sauverSous(); majSous(); dessiner(); });
  }
  async function sauverSous() {                // gardés dans la fiche du morceau (partagés avec le groupe)
    const m = (V.morceaux || []).find(x => x.id === V.ficheId); if (!m) return;
    m.sousTitres = V.sous.map(s => ({ i: s.i, t: s.t })); await BK.db.ecrire('morceaux', m);
  }
  $('#rvSousM').onchange = e => {
    const m = (V.morceaux || []).find(x => x.id === e.target.value); V.ficheId = m ? m.id : null;
    V.lignes = m ? BK.parolesPropres(m.paroles).split('\n').map(s => s.trim()).filter(Boolean) : [];
    V.sous = m && m.sousTitres ? m.sousTitres.filter(s => V.lignes[s.i]).map(s => ({ ...s, texte: V.lignes[s.i] })) : [];
    majSous(); dessiner();
  };
  $('#rvSousColler').onclick = () => { const t = prompt('Colle le texte (une phrase par ligne)'); if (!t) return;
    V.ficheId = null; V.lignes = t.split('\n').map(s => s.trim()).filter(Boolean); V.sous = []; majSous(); };
  $('#rvSousOn').onclick = e => { V.sousOn = !V.sousOn; e.target.classList.toggle('on', V.sousOn); dessiner(); };
  $('#rvCaler').onclick = () => {
    if (!V.lignes.length) return msg('Choisis d\'abord des paroles');
    V.sous = []; V.calage = 0; majSous(); lire(true); msg('Appuie sur Espace au début de chaque phrase');
  };
  document.addEventListener('keydown', e => {
    if (page.classList.contains('hidden') || V.calage < 0 || e.code !== 'Space') return;
    e.preventDefault(); V.sous.push({ i: V.calage, t: Math.max(0, tReel()), texte: V.lignes[V.calage] }); V.calage++;
    if (V.calage >= V.lignes.length) { V.calage = -1; sauverSous(); msg('Sous-titres calés ✓'); }
    majSous();
  });

  // ---------- musique ----------
  function majMusique() {
    $$('#rvMus .chip').forEach(c => c.classList.toggle('on', c.dataset.m === V.musique));
    const a = BK.reelAudio && BK.reelAudio();
    $('#rvMusTxt').textContent = V.musique === 'reel' ? (a ? `Passage de « ${a.nom} » : ${t2(a.debut)} → ${t2(a.debut + a.duree)}` : 'Choisis d\'abord un passage dans l\'Assistant audio Reel.') : 'Le son d\'origine de la vidéo.';
  }
  $$('#rvMus .chip').forEach(c => c.onclick = () => { V.musique = c.dataset.m; majMusique(); });
  BK.surOuvrir = BK.surOuvrir || {}; BK.surOuvrir.reelvis = () => { majMusique(); remplirMorceaux(); };

  // ---------- lecture ----------
  function stop() { vid.pause(); son.pause(); cancelAnimationFrame(V.lecture); V.lecture = null; $('#rvPlay').textContent = '▶ Lire';
    if (V.calage >= 0) { V.calage = -1; sauverSous(); majSous(); } }
  function lire(force) {
    if (V.lecture && !force) return stop();
    const a = V.musique === 'reel' && BK.reelAudio && BK.reelAudio();
    vid.currentTime = V.debut; vid.muted = !!a;
    if (a) { son.src = a.url; son.currentTime = a.debut; son.play(); }
    vid.play(); $('#rvPlay').textContent = '■ Stop';
    const fin = a ? Math.min(V.fin, V.debut + a.duree) : V.fin;
    const tic = () => { dessiner(); montrerTete(); if (vid.currentTime >= fin || vid.paused) return stop(); V.lecture = requestAnimationFrame(tic); };
    V.lecture = requestAnimationFrame(tic);
  }
  $('#rvPlay').onclick = () => lire();

  // ---------- export MP4 ----------
  $('#rvExport').onclick = async () => {
    stop(); const b = $('#rvExport'); b.disabled = true; b.innerHTML = '<span class="spin"></span>Export…';
    try {
      const a = V.musique === 'reel' && BK.reelAudio && BK.reelAudio();
      let audio = null, fin = V.fin;
      if (a) { fin = Math.min(V.fin, V.debut + a.duree); const buf = await BK.audio.decoder(new Uint8Array(await (await fetch(a.url)).arrayBuffer())); audio = tranche(buf, a.debut, fin - V.debut); }
      else { try { const buf = await BK.audio.decoder(new Uint8Array(await V.fichier.arrayBuffer())); audio = tranche(buf, V.debut, fin - V.debut); } catch (e) { audio = null; } }
      const mp4 = await BK.rendu.exporter({ video: vid, debut: V.debut, fin, cadre: cadre(), force: V.force / 100, lut: V.lut, sous: V.sousOn ? V.sous : [], audio,
        progression: p => msg('Export… ' + Math.round(p * 100) + ' %') });
      const p = await BK.enregistrerFichier(BK.chemin('Reels', V.nom), `${V.nom}_REEL_${Math.round(fin - V.debut)}s_${GABARITS[V.gabarit] ? 'VERTICAL' : ''}.mp4`, mp4, 'video/mp4');
      msg(p ? 'MP4 prêt ✓' : 'Export annulé');
    } catch (e) { msg('Export impossible : ' + e.message); console.error(e); }
    b.disabled = false; b.textContent = 'Exporter en MP4 ▶'; dessiner();
  };
  function tranche(buf, debut, duree) {           // un morceau d'AudioBuffer
    const sr = buf.sampleRate, a = Math.round(debut * sr), n = Math.max(1, Math.min(buf.length - a, Math.round(duree * sr)));
    const out = new AudioBuffer({ length: n, numberOfChannels: buf.numberOfChannels, sampleRate: sr });
    for (let c = 0; c < buf.numberOfChannels; c++) out.copyToChannel(buf.getChannelData(c).subarray(a, a + n), c);
    return out;
  }

  majGabarit(); majMusique(); remplirMorceaux();
});
})();
