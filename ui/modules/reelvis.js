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
      <section class="pane vit rv-vit">
        <div class="rv-scene">
          <div class="rv-tel"><div class="rv-ecran" id="rvEcran">
            <canvas id="rvCanvas" width="540" height="960"></canvas>
            <video id="rvVideo" playsinline preload="auto" hidden></video>
            <div class="rv-vide rv-exemple" id="rvVide" title="Importe des vidéos ou des photos (ou glisse-les ici)"></div>
            <div class="rv-zones" id="rvZones"></div><div id="rvCalque"></div>
          </div></div>
          <div class="rv-cote">
            <div class="box"><div class="ligne-titre"><span class="lb">① La vidéo</span></div>
              <div class="rv-charge"><button class="btn sm rv-sujet-b" id="rvSujetB" title="De quoi parle la vidéo ?">De quoi parle la vidéo ? ▾</button><select class="fld hidden" id="rvMorceau"><option value="">—</option></select>
                <button class="btn sm pri" id="rvTag" title="Photos et vidéos : depuis Médias (dossiers, Discord, étiquettes) ou ce PC">＋ Importer…</button><input type="file" id="rvInput" accept="image/*,video/*" multiple hidden></div></div>
            <div class="box"><div class="ligne-titre"><span class="lb">② Couper la vidéo</span>
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
            <div class="box"><span class="lb">③ Recadrer et couleur</span>
              <div class="pv-tab">
                <span class="eng">Cadrage</span>
                <div class="pv-seg"><button id="rvEntier" title="Voir toute la vidéo, avec des bandes">⤢ Entière</button><button id="rvRemplir" title="La vidéo remplit le cadre, les bords sont coupés">⤡ Remplir</button><button id="rvCentre" title="Remettre au centre, sans zoom">⊙ Centrer</button></div>
                <span class="eng">Réglages</span>
                <div class="pv-ligne pv-regl"><span class="eng">Contraste</span><input class="fld rv-glisse" id="rvCon" title="Clic maintenu et glisse la souris (double-clic : valeur par défaut · tape un chiffre pour l'écrire)"><span class="eng">Lumière</span><input class="fld rv-glisse" id="rvLum" title="Clic maintenu et glisse la souris (double-clic : valeur par défaut · tape un chiffre pour l'écrire)"><span class="eng">Saturation</span><input class="fld rv-glisse" id="rvSat" title="Clic maintenu et glisse la souris (double-clic : valeur par défaut · tape un chiffre pour l'écrire)"></div>
                <span class="eng">Zoom</span>
                <div class="pv-ligne"><input class="fld rv-glisse" id="rvZoom" value="0 %" title="Clic maintenu et glisse la souris (double-clic : valeur par défaut · tape un chiffre pour l'écrire)"><span class="nt">glisse l'image dans le téléphone pour la déplacer</span></div>
                <span class="eng">Couleur</span>
                <div class="pv-ligne"><select class="fld" id="rvFiltre">${['', ...BK.filtres.map(f => f.nom)].map(n => `<option value="${n}">${n || 'Aucun filtre'}</option>`).join('')}<option value="__lut">＋ Ajouter une LUT (.cube)…</option></select>
                  <span class="eng" style="margin-left:6px">Intensité</span><input class="fld rv-glisse pv-force" id="rvForce" value="100 %" title="Clic maintenu et glisse la souris (double-clic : valeur par défaut · tape un chiffre pour l'écrire)"></div>
                <span class="eng">Effet</span>
                <div class="pv-ligne"><select class="fld" id="rvVoile">${BK.rendu.VOILES.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></div>
              </div>
              <input type="file" id="rvLutIn" accept=".cube" hidden></div>
            <div class="box rv-sous-box"><div class="ligne-titre"><span class="lb">④ Sous-titres</span>
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
          <span class="nt">Les zones hachurées sont cachées par l'appli : n'y mets rien d'important.</span></div>
        <div class="box"><span class="lb">Musique</span>
          <div class="chips" style="margin-top:10px" id="rvMus"><button class="chip" data-m="video">Son de la vidéo</button><button class="chip" data-m="export">Un export de l'Assistant audio</button><button class="chip" data-m="reel">Le passage ouvert dans l'Assistant audio</button><button class="chip" data-m="biblio">Un morceau de la Bibliothèque ▾</button><button class="chip" data-m="pc">🎵 Une musique de ce PC…</button></div>
          <input type="file" id="rvMusIn" accept="audio/*" hidden>
          <select class="fld hidden" id="rvExp" style="margin-top:8px"></select>
          <span class="nt" id="rvMusTxt"></span></div>
        <div class="box"><span class="lb">Export</span></div>
      </section>
    </div>
    <div class="pane abar"><span class="vfd" id="rvMsg">GLISSE UNE VIDÉO</span>
      <div class="right">
        <button class="btn" id="rvPlay" disabled>▶ Lire</button><button class="btn pri" id="rvExport" disabled>Exporter en MP4 ▶</button></div></div>`;

  const msg = t => $('#rvMsg').textContent = String(t).toUpperCase();
  const vid = $('#rvVideo'), ecran = $('#rvEcran'), cv = $('#rvCanvas'), cx2 = cv.getContext('2d'), son = new Audio(), t2 = BK.audio.temps;
  BK.mini.suivre(son, { page: 'reelvis', titre: () => 'Reels Vidéo · la musique du montage' });   // la musique coupe la Bibliothèque, et s'affiche en bas
  const r = BK.rendu.creer(540, 960);
  const cadre = () => ({ zoom: V.zoom / 100, x: V.x, y: V.y });
  const tReel = () => vid.currentTime - V.debut;                    // temps depuis le début du reel
  function dessiner() { if (!vid.videoWidth) return; r.dessiner(vid, cadre(), V.force / 100, V.sousOn ? BK.rendu.texteA(V.sous, tReel()) : '', V.voile ? { type: V.voile, t: vid.currentTime || 0 } : null); cx2.drawImage(r.sortie, 0, 0); }

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
    vid.currentTime = 0.01;                                         // pour que la 1re image s'affiche tout de suite
  };
  vid.onseeked = () => { if (!V.lecture) dessiner(); };
  vid.onerror = () => msg('Vidéo illisible (essaie un MP4)');

  // ---------- PHOTOS ET VIDÉOS → UNE VIDÉO ----------
  // On choisit des photos et des vidéos (ce PC, Médias, Discord), une durée et une animation pour chacune,
  // une transition et un effet. On importe : ça donne une vraie vidéo 9:16, et tout marche ensuite comme pour une vidéo
  // (couper, couleur, sous-titres, musique, export). Le son des vidéos n'est pas gardé : la musique se choisit à droite.
  const ANIMS = [['zoom', '↗ Zoom avant'], ['recul', '↙ Zoom arrière'], ['glisse', '↔ Glisser'], ['fixe', '■ Fixe']];
  // pre : des fichiers déjà choisis (fenêtre Médias ou ce PC), à mettre tout de suite dans le montage
  const ouvrirMontage = (pre = []) => {
    const D = { l: [], transition: BK.reglage('rv.transition', 'fondu'), voile: '' };   // l : { nom, video?, apercu, charger: () => Blob, duree, max, anim }
    const v = document.createElement('div'); v.className = 'voile';
    const dureeMus = () => { const a = musique(); return a ? a.duree : 0; };
    const total = () => D.l.reduce((t, x) => t + (+x.duree || 0), 0);
    const estVideo = (nom, type) => /^video\//.test(type || '') || /\.(mp4|mov|m4v|webm)$/i.test(nom || '');
    // une vidéo : on lit sa durée (et on fabrique une petite image d'aperçu si on n'en a pas)
    const lireVideo = async x => { try { const blob = await x.charger(); x.blob = blob; const u = URL.createObjectURL(blob), el = document.createElement('video');
        el.muted = true; el.preload = 'auto'; el.src = u; await new Promise((ok, ko) => { el.onloadeddata = ok; el.onerror = ko; });
        x.max = el.duration || 5; x.duree = Math.min(x.duree || 5, Math.round(x.max * 10) / 10);
        if (!x.apercu) { el.currentTime = Math.min(0.5, x.max / 2); await new Promise(ok => { el.onseeked = ok; setTimeout(ok, 1500); });
          const c = document.createElement('canvas'); c.width = 120; c.height = Math.round(120 * el.videoHeight / el.videoWidth) || 200; c.getContext('2d').drawImage(el, 0, 0, c.width, c.height); x.apercu = c.toDataURL('image/jpeg', 0.7); }
        URL.revokeObjectURL(u); } catch (e) { x.erreur = true; } dessinerD(); };
    const ajouter = x => { x.video = estVideo(x.nom, x.type); x.duree = x.video ? 5 : (D.dureePhoto || 2.5); x.anim = x.video ? 'fixe' : 'zoom'; D.l.push(x); if (x.video) lireVideo(x); };
    const dessinerD = () => {
      const m = dureeMus(), photos = D.l.filter(x => !x.video).length;
      v.innerHTML = `<div class="stopbox" style="width:760px;align-items:stretch">
        <span class="screw tl"></span><span class="screw tr"></span><span class="screw bl"></span><span class="screw br"></span>
        <button class="btn xs rt-x" data-d="x">✕</button>
        <span class="dymo" style="align-self:center">🖼 Photos et vidéos</span>
        <div class="mt-l">${D.l.map((x, i) => `<div class="mt-r">
            <span class="mt-ph"${x.apercu ? ` style="background-image:url('${esc(x.apercu)}')"` : ''}><b>${i + 1}</b>${x.video ? '<i>▶</i>' : ''}</span>
            <span class="mt-nom" title="${esc(x.nom)}">${esc(x.nom)}${x.erreur ? ' <em>(illisible)</em>' : ''}</span>
            <label class="mt-d"><input class="fld" type="number" min="0.5" max="${x.video ? x.max || 60 : 30}" step="0.5" value="${x.duree}" data-du="${i}"><span>s</span></label>
            <select class="fld mt-a" data-an="${i}">${ANIMS.map(([k, n]) => `<option value="${k}"${x.anim === k ? ' selected' : ''}>${n}</option>`).join('')}</select>
            <span class="mt-o"><button data-g="${i}" title="Avant">▲</button><button data-dr="${i}" title="Après">▼</button><button data-x="${i}" title="Enlever">✕</button></span></div>`).join('')
          || '<span class="nt" style="padding:14px;text-align:center">Ajoute des photos ou des vidéos : de ce PC, ou de Médias / Discord.</span>'}</div>
        <div class="chips"><button class="btn sm" data-d="pc">💻 Ce PC…</button><button class="btn sm" data-d="medias">🖼 Depuis Médias…</button></div>
        <div class="pv-tab mt-tab">
          <span class="eng">Photos</span>
          <div class="pv-ligne"><span class="nt">toutes à</span><input class="fld rv-glisse" id="dpDuree" type="number" min="0.5" max="30" step="0.5" value="${D.dureePhoto || 2.5}"><span class="nt">s</span>
            ${m && photos ? `<button class="btn xs" data-d="caler">♪ Caler sur la musique (${t2(m)})</button>` : ''}</div>
          <span class="eng">Transition</span>
          <div class="pv-ligne"><select class="fld" id="dpTrans"><option value="coupe">Coupe sèche</option><option value="fondu">Fondu enchaîné</option><option value="noir">Fondu au noir</option></select></div>
          <span class="eng">Effet</span>
          <div class="pv-ligne"><select class="fld" id="dpVoile">${BK.rendu.VOILES.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></div>
        </div>
        <span class="nt">Total : <b id="dpTotal">${t2(total())}</b> · les photos sont montrées entières sur un fond flou · le son des vidéos n'est pas gardé : choisis la musique dans « Musique » à droite.</span>
        <div class="stopbox-btns"><button class="btn pri" data-d="ok"${D.l.length ? '' : ' disabled'}>Importer ces fichiers ▶</button><button class="btn" data-d="x">Annuler</button></div>
        <input type="file" accept="image/*,video/*" multiple hidden id="dpIn"></div>`;
      v.querySelector('#dpTrans').value = D.transition; v.querySelector('#dpVoile').value = D.voile;
      v.querySelector('#dpTrans').onchange = e => { D.transition = e.target.value; BK.regler('rv.transition', D.transition); };
      v.querySelector('#dpVoile').onchange = e => { D.voile = e.target.value; };
      const majTotal = () => { const t = v.querySelector('#dpTotal'); if (t) t.textContent = t2(total()); };
      v.querySelectorAll('input').forEach(c => c.addEventListener('keydown', e => e.stopPropagation()));
      v.querySelectorAll('[data-du]').forEach(c => c.oninput = () => { const x = D.l[+c.dataset.du]; x.duree = Math.max(0.5, Math.min(x.video ? x.max || 60 : 30, parseFloat(c.value) || 0.5)); majTotal(); });
      v.querySelectorAll('[data-an]').forEach(c => c.onchange = () => { D.l[+c.dataset.an].anim = c.value; });
      const du = v.querySelector('#dpDuree');
      du.onchange = () => { D.dureePhoto = Math.max(0.5, Math.min(30, parseFloat(du.value) || 2.5)); D.l.forEach(x => { if (!x.video) x.duree = D.dureePhoto; }); dessinerD(); };
      v.querySelector('#dpIn').onchange = e => { for (const f of e.target.files) ajouter({ nom: f.name, type: f.type, apercu: /^image\//.test(f.type) ? URL.createObjectURL(f) : '', charger: async () => f }); dessinerD(); };
    };
    v.addEventListener('click', async e => {
      const b = e.target.closest('[data-d],[data-g],[data-dr],[data-x]'); if (!b) return;
      if (b.dataset.g) { const i = +b.dataset.g; if (i > 0) [D.l[i - 1], D.l[i]] = [D.l[i], D.l[i - 1]]; return dessinerD(); }
      if (b.dataset.dr) { const i = +b.dataset.dr; if (i < D.l.length - 1) [D.l[i + 1], D.l[i]] = [D.l[i], D.l[i + 1]]; return dessinerD(); }
      if (b.dataset.x) { D.l.splice(+b.dataset.x, 1); return dessinerD(); }
      const a = b.dataset.d;
      if (a === 'x') return v.remove();
      if (a === 'pc') return v.querySelector('#dpIn').click();
      if (a === 'caler') {                                         // la musique moins les vidéos, partagée entre les photos
        const reste = dureeMus() - D.l.filter(x => x.video).reduce((t, x) => t + x.duree, 0), ph = D.l.filter(x => !x.video);
        if (reste <= ph.length * 0.5) return msg('Les vidéos prennent déjà toute la musique');
        D.dureePhoto = Math.round(reste / ph.length * 10) / 10; ph.forEach(x => x.duree = D.dureePhoto); return dessinerD(); }
      if (a === 'medias') {                                         // la fenêtre Médias : dossiers, Discord, étiquettes
        if (!BK.drive.relie()) return v.querySelector('#dpIn').click();
        v.style.display = 'none';
        const l = await BK.choisirDansMedias({ titre: 'Photos et vidéos du montage', bouton: 'Ajouter', type: 'tous', sujet: $('#rvMorceau').value });
        v.style.display = '';
        for (const x of l || []) ajouter({ nom: x.nom, type: x.mime || (x.dc && x.dc.video ? 'video/mp4' : ''), apercu: x.apercu || '',
          charger: async () => x.fichier ? x.fichier : x.dc ? (await BK.discord.fetch(x.dc.url)).blob() : new Blob([await BK.drive.telecharger(x.f.id)], { type: x.f.mimeType }) });
        return dessinerD();
      }
      if (a === 'ok') {
        const ok = v.querySelector('[data-d="ok"]'); ok.disabled = true; ok.innerHTML = '<span class="spin"></span>Préparation…';
        const urls = [];
        try {
          const morceaux = [];
          for (const [i, x] of D.l.entries()) { ok.innerHTML = `<span class="spin"></span>Fichier ${i + 1}/${D.l.length}…`;
            const blob = x.blob || await x.charger();
            if (x.video) {
              const u = URL.createObjectURL(blob), el = document.createElement('video'); urls.push(u);
              el.muted = true; el.preload = 'auto'; el.src = u; await new Promise((res, ko) => { el.onloadeddata = res; el.onerror = () => ko(new Error(x.nom + ' illisible')); });
              morceaux.push({ video: el, debut: 0, duree: Math.min(x.duree, el.duration || x.duree), anim: x.anim });
            } else {
              const img = await createImageBitmap(blob), k = Math.min(1, 2160 / Math.max(img.width, img.height));      // pas plus grand qu'il ne faut : léger pour le PC
              morceaux.push({ img: k < 1 ? await createImageBitmap(blob, { resizeWidth: Math.round(img.width * k), resizeHeight: Math.round(img.height * k), resizeQuality: 'high' }) : img, duree: x.duree, anim: x.anim });
            }
          }
          const mp4 = await BK.rendu.montage(morceaux, { transition: D.transition, voile: D.voile, progression: p => ok.innerHTML = `<span class="spin"></span>Import… ${Math.round(p * 100)} %` });
          const f = new File([mp4], 'Montage_' + new Date().toISOString().slice(0, 10) + '.mp4', { type: 'video/mp4' });
          v.remove(); charger(f); if (musique()) $('#rvMusTxt').textContent += ' · calée sur le montage';
        } catch (er) { console.error(er); ok.disabled = false; ok.textContent = 'Importer ces fichiers ▶'; msg('Impossible : ' + (er.message || er)); }
        urls.forEach(u => URL.revokeObjectURL(u));
      }
    });
    for (const x of pre) ajouter(x);
    document.body.appendChild(v); dessinerD();
  };
  async function depuisDrive(f) { msg('Téléchargement de ' + f.name + '…');
    try { const o = await BK.drive.telecharger(f.id); charger(new File([o], f.name, { type: f.mimeType || 'video/mp4' })); } catch (e) { msg('Téléchargement impossible'); } }
  $('#rvVide').onclick = e => { e.stopPropagation(); $('#rvTag').click(); };             // l'écran vide (photo d'exemple) ouvre la fenêtre Médias
  BK.photoExemple && BK.photoExemple().then(u => { if (u) $('#rvVide').style.backgroundImage = `url(${u})`; });
  const galerieSiVide = () => {};
  // ---------- ① le sujet : morceau, tournage, live, promo — ses vidéos passent en premier ----------
  (async () => { const g = await BK.etiquettes.sujets();
    $('#rvMorceau').innerHTML = '<option value="">Choisis : un morceau, un tournage, un live…</option>'
      + g.map(x => `<optgroup label="${esc(x.groupe)}">${x.l.map(c => `<option value="${esc(c.k)}">${esc(c.nom)}</option>`).join('')}</optgroup>`).join('');
    V.sujets = g.flatMap(x => x.l);
    $('#rvMorceau').onchange = e => { const c = (V.sujets || []).find(x => x.k === e.target.value), m = c && c.morceau;
      const so = $('#rvSousM'); if (m && so && [...so.options].some(o => o.value === m.id)) { so.value = m.id; so.dispatchEvent(new Event('change')); }
        $('#rvSujetB').textContent = c ? c.nom + ' ▾' : 'De quoi parle la vidéo ? ▾'; $('#rvSujetB').classList.toggle('pri', !!c);
      if (c && vid.videoWidth) msg('Pour une autre vidéo de ' + c.nom + ' : 🏷 Une vidéo de Médias'); };
    V.groupes = g;
  })();
  $('#rvSujetB').onclick = e => { if (!V.groupes) return; const r = e.currentTarget.getBoundingClientRect(), sel = $('#rvMorceau');
    BK.menuCascade({ x: r.left, y: r.bottom + 4 }, V.groupes.map(x => ({ nom: x.groupe, l: x.l })), k => { sel.value = k; sel.dispatchEvent(new Event('change')); }, { actuel: sel.value, aucun: '— Aucun sujet' }); };
  const sujetV = () => (V.sujets || []).find(x => x.k === $('#rvMorceau').value);
  // ---------- ＋ IMPORTER : une seule porte (fenêtre Médias, ou ce PC) ----------
  // 1 vidéo → elle se charge directement ; des photos ou plusieurs fichiers → la fenêtre du montage, déjà remplie
  const estVid = (nom, mime) => /^video\//.test(mime || '') || /\.(mp4|mov|m4v|webm)$/i.test(nom || '');
  const versMontage = x => ({ nom: x.nom, type: x.mime || (x.dc && x.dc.video ? 'video/mp4' : ''), apercu: x.apercu || (x.fichier && /^image\//.test(x.fichier.type) ? URL.createObjectURL(x.fichier) : ''),
    charger: async () => x.fichier ? x.fichier : x.dc ? (await BK.discord.fetch(x.dc.url)).blob() : new Blob([await BK.drive.telecharger(x.f.id)], { type: x.f.mimeType }) });
  async function importer(l) {
    if (!l || !l.length) return;
    const x = l[0];
    if (l.length === 1 && estVid(x.nom, x.mime || (x.fichier && x.fichier.type))) {
      if (x.fichier) return charger(x.fichier);
      if (x.dc) { msg('Téléchargement depuis Discord…'); try { const r = await BK.discord.fetch(x.dc.url); charger(new File([await r.blob()], x.nom, { type: x.mime || 'video/mp4' })); } catch (e) { msg('Vidéo expirée sur Discord'); } return; }
      return depuisDrive(x.f);
    }
    ouvrirMontage(l.map(versMontage));
  }
  const dePC = fs => [...fs].map(f => ({ nom: f.name, mime: f.type, fichier: f }));
  $('#rvTag').onclick = async () => {
    if (!BK.drive.relie()) return $('#rvInput').click();
    importer(await BK.choisirDansMedias({ titre: 'Photos et vidéos pour le reel', bouton: 'Importer', type: 'tous', sujet: $('#rvMorceau').value }));
  };
  $('#rvInput').onchange = e => { importer(dePC(e.target.files)); e.target.value = ''; };
  page.addEventListener('dragover', e => { e.preventDefault(); ecran.classList.add('survol'); });
  page.addEventListener('dragleave', e => { if (e.target === page) ecran.classList.remove('survol'); });
  page.addEventListener('drop', async e => { e.preventDefault(); ecran.classList.remove('survol'); let fs = [...e.dataTransfer.files];
    if (!fs.length && BK.glisse.actif()) fs = await BK.glisse.fichiers(msg);       // venu de Médias
    if (!fs.length) return;
    const cube = fs.find(f => /\.cube$/i.test(f.name)); if (cube) return chargerLut(cube); importer(dePC(fs)); });

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
  const reglerZoom = z => { V.zoom = Math.round(Math.max(10, Math.min(400, z))); champZoom.value = (V.zoom - 100) + ' %'; dessiner(); };
  champZoom.readOnly = true; let zg = null;
  champZoom.addEventListener('pointerdown', e => { if (!champZoom.readOnly) return; e.preventDefault(); champZoom.setPointerCapture(e.pointerId); zg = { x: e.clientX, y: e.clientY, z: V.zoom }; });
  champZoom.addEventListener('pointermove', e => { if (!zg) return; reglerZoom(zg.z + (e.clientX - zg.x) - (e.clientY - zg.y)); });
  champZoom.addEventListener('pointerup', () => { zg = null; });
  champZoom.addEventListener('dblclick', () => { champZoom.readOnly = false; champZoom.value = V.zoom - 100; champZoom.select(); });
  const finSaisie = () => { if (champZoom.readOnly) return; champZoom.readOnly = true; const v = parseFloat(champZoom.value.replace(',', '.')); reglerZoom(isNaN(v) ? V.zoom : 100 + v); };
  champZoom.addEventListener('blur', finSaisie);
  champZoom.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') champZoom.blur(); });
  champZoom.addEventListener('wheel', e => { e.preventDefault(); reglerZoom(V.zoom - Math.sign(e.deltaY) * 5); }, { passive: false });
  // cadrage comme dans Social Photo : entière (avec bandes), remplir, centrer
  const zoomEntier = () => { const vw = vid.videoWidth, vh = vid.videoHeight; if (!vw) return 100; return Math.round(Math.min(1080 / vw, 1920 / vh) / Math.max(1080 / vw, 1920 / vh) * 100); };
  $('#rvEntier').onclick = () => { if (!vid.videoWidth) return; V.x = V.y = 0; V.zoom = zoomEntier(); champZoom.value = (V.zoom - 100) + ' %'; dessiner(); msg('Vidéo entière'); };
  $('#rvRemplir').onclick = () => { V.x = V.y = 0; reglerZoom(100); msg('La vidéo remplit le cadre'); };
  $('#rvCentre').onclick = () => { V.x = V.y = 0; reglerZoom(100); };
  // intensité du filtre (0 à 100 %) : glisser la souris sur la case, double-clic = valeur par défaut, ou tape un chiffre
  const fc = $('#rvForce'); fc.readOnly = true; let fg = null;
  const force = v => { V.force = Math.round(Math.max(0, Math.min(100, v))); fc.value = V.force + ' %'; dessiner(); };
  fc.addEventListener('pointerdown', e => { if (!fc.readOnly) return; e.preventDefault(); fc.setPointerCapture(e.pointerId); fg = { x: e.clientX, y: e.clientY, v: V.force }; });
  fc.addEventListener('pointermove', e => { if (fg) force(fg.v + ((e.clientX - fg.x) - (e.clientY - fg.y)) / 2); });
  fc.addEventListener('pointerup', () => { fg = null; });
  fc.addEventListener('dblclick', () => { fc.readOnly = false; fc.value = V.force; fc.select(); });
  fc.addEventListener('blur', () => { if (fc.readOnly) return; fc.readOnly = true; const v = parseFloat(fc.value.replace(',', '.')); force(isNaN(v) ? V.force : v); });
  fc.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') fc.blur(); });
  fc.addEventListener('wheel', e => { e.preventDefault(); force(V.force - Math.sign(e.deltaY) * 5); }, { passive: false });
  // contraste, lumière, saturation
  V.regl = { contraste: 0, lumiere: 0, saturation: 0 };
  [['#rvCon', 'contraste'], ['#rvLum', 'lumiere'], ['#rvSat', 'saturation']].forEach(([id, k]) =>
    BK.rendu.champGlisse($(id), { val: 0, change: v => { V.regl[k] = v; r.reglages(V.regl); dessiner(); } }));
  $('#rvVoile').onchange = e => { V.voile = e.target.value; dessiner(); msg(V.voile ? 'Effet : ' + e.target.selectedOptions[0].textContent : 'Sans effet'); };
  let d0 = null;
  ecran.addEventListener('pointerdown', e => { if (!vid.videoWidth) return; d0 = { x: e.clientX, y: e.clientY, vx: V.x, vy: V.y }; ecran.setPointerCapture(e.pointerId); });
  ecran.addEventListener('pointermove', e => { if (!d0) return; const b = ecran.getBoundingClientRect();
    V.x = d0.vx + (e.clientX - d0.x) / b.width * 100; V.y = d0.vy + (e.clientY - d0.y) / b.height * 100; dessiner(); });
  ecran.addEventListener('pointerup', () => d0 = null);

  // ---------- couleur : un filtre ou sa propre LUT .cube (un menu, comme dans Social Photo) ----------
  async function chargerLut(f) {
    try { V.lut = BK.rendu.lireCube(await f.text()); V.lutNom = f.name; r.lut(V.lut);
      const sel = $('#rvFiltre'); let o = sel.querySelector('option[data-lut]');
      if (!o) { o = document.createElement('option'); o.dataset.lut = '1'; sel.insertBefore(o, sel.querySelector('option[value="__lut"]')); }
      o.value = '__lutok'; o.textContent = '🎨 LUT : ' + f.name; sel.value = '__lutok'; filtreAvant = '__lutok';
      dessiner(); msg('LUT appliquée'); }
    catch (e) { msg(e.message); $('#rvFiltre').value = ''; }
  }
  $('#rvLutIn').onchange = e => { e.target.files[0] && chargerLut(e.target.files[0]); e.target.value = ''; };
  let filtreAvant = '';
  $('#rvFiltre').onchange = e => { const n = e.target.value;
    if (n === '__lut') { e.target.value = filtreAvant; return $('#rvLutIn').click(); }
    if (n === '__lutok') return;
    filtreAvant = n; V.lut = n ? BK.rendu.filtre(n) : null; V.lutNom = n; r.lut(V.lut); dessiner(); msg(n ? 'Filtre : ' + n : 'Sans filtre'); };

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
  $('#rvSousColler').onclick = async () => { const t = await BK.saisir('Colle le texte (une phrase par ligne)', '', { long: true }); if (!t) return;
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
  // la musique du reel : le son de la vidéo, un export de l'Assistant audio, ou le passage ouvert là-bas
  const musique = () => V.musique === 'reel' ? (BK.reelAudio && BK.reelAudio()) : V.musique === 'export' ? V.exp || null : V.musique === 'pc' ? V.pc || null : V.musique === 'biblio' ? V.bib || null : null;
  let EXPORTS = [];
  async function chargerExports() { try { EXPORTS = await BK.exportsAudio.tous(); } catch (e) { EXPORTS = BK.exportsAudio.local(); } remplirExports(); }
  function remplirExports() {
    const l = EXPORTS.length ? EXPORTS : BK.exportsAudio.local(), m = $('#rvMorceau') && $('#rvMorceau').selectedOptions[0], nomM = m && m.value ? m.textContent : '';
    const tri = [...l].sort((a, b) => (nomM ? (b.morceau === nomM) - (a.morceau === nomM) : 0) || b.t.localeCompare(a.t));
    $('#rvExp').innerHTML = (tri.length ? '<option value="">Choisis un export…</option>' : '<option value="">Aucun export : fais-en un dans l\'Assistant audio Reel</option>')
      + tri.map(e => `<option value="${e.id}"${V.exp && V.exp.id === e.id ? ' selected' : ''}>${esc(e.nom)} · ${new Date(e.t).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' })}</option>`).join('');
    return tri;
  }
  async function choisirExport(id) {
    const e = (EXPORTS.length ? EXPORTS : BK.exportsAudio.local()).find(x => x.id === id); if (!e) { V.exp = null; return majMusique(); }
    try {
      let url = (BK.reelsExports || {})[e.id];
      if (!url && BK.estExe) url = URL.createObjectURL(new Blob([await BK.fichier.lireOctets(e.chemin)], { type: 'audio/wav' }));
      if (!url) return msg('Fichier introuvable sur ce PC');
      const d = await new Promise(ok => { const a = new Audio(url); a.onloadedmetadata = () => ok(a.duration); a.onerror = () => ok(0); });
      V.exp = { id: e.id, nom: e.nom, url, debut: 0, duree: d || e.duree }; msg('Musique : ' + e.nom);
    } catch (er) { msg('Fichier introuvable : il a peut-être été déplacé'); V.exp = null; }
    majMusique();
  }
  $('#rvExp').onchange = e => choisirExport(e.target.value);
  function majMusique() {
    $$('#rvMus .chip').forEach(c => c.classList.toggle('on', c.dataset.m === V.musique));
    $('#rvExp').classList.toggle('hidden', V.musique !== 'export');
    if (V.musique === 'biblio') { $('#rvMusTxt').textContent = V.bib ? `« ${V.bib.nom} » (${t2(V.bib.duree)}) · clique le bouton pour en changer` : 'Choisis un morceau et sa version.'; return; }
    if (V.musique === 'pc') { $('#rvMusTxt').textContent = V.pc ? `« ${V.pc.nom} » (${t2(V.pc.duree)}) · clique « 🎵 » pour en changer` : ''; return; }
    if (V.musique === 'export') { const l = remplirExports(); if (!V.exp && l[0]) { choisirExport(l[0].id); return; } }
    const a = BK.reelAudio && BK.reelAudio();
    $('#rvMusTxt').textContent = V.musique === 'export' ? (V.exp ? `« ${V.exp.nom} » (${t2(V.exp.duree)}) remplace le son de la vidéo.` : '') : V.musique === 'reel' ? (a ? `Passage de « ${a.nom} » : ${t2(a.debut)} → ${t2(a.debut + a.duree)}` : 'Choisis d\'abord un passage dans l\'Assistant audio Reel.') : 'Le son d\'origine de la vidéo.';
  }
  $$('#rvMus .chip').forEach(c => c.onclick = () => { if (c.dataset.m === 'pc' && (!V.pc || V.musique === 'pc')) return $('#rvMusIn').click();
    if (c.dataset.m === 'biblio') return menuBiblio(c);
    V.musique = c.dataset.m; majMusique(); });
  // ---------- une musique de la Bibliothèque : morceau ▸ ses exports (★ = l'export principal en premier) ----------
  async function menuBiblio(bouton) {
    const r = bouton.getBoundingClientRect(); msg('Les morceaux de la Bibliothèque…');
    const ms = (await BK.db.liste('morceaux')).sort((a, b) => a.nom.localeCompare(b.nom)), tous = await BK.inv.tous(), vus = {};
    const groupes = ms.map(m => { const l = BK.inv.exportsDe(m, tous, ms).filter(x => x.drive || (x.ici && BK.estExe));
      l.sort((a, b) => (b.chemin === m.exportPrincipal) - (a.chemin === m.exportPrincipal));
      return { nom: m.nom, l: l.map(x => { const k = x.drive ? 'drive:' + x.driveId : x.chemin; vus[k] = { ...x, morceau: m.nom }; return { k, nom: (x.chemin === m.exportPrincipal ? '★ ' : '') + x.nom }; }) }; });
    msg('Choisis le morceau, puis la version');
    BK.menuCascade({ x: r.left, y: r.bottom + 4 }, groupes, async k => { const x = vus[k]; if (!x) return;
      try { msg('Chargement de « ' + x.nom + ' »…');
        const oct = x.drive ? await BK.drive.telecharger(x.driveId) : await BK.fichier.lireOctets(x.chemin);
        const url = URL.createObjectURL(new Blob([oct], { type: /\.mp3$/i.test(x.nom) ? 'audio/mpeg' : 'audio/wav' }));
        const d = await new Promise(ok => { const a = new Audio(url); a.onloadedmetadata = () => ok(a.duration); a.onerror = () => ok(0); });
        if (!d) return msg('Musique illisible');
        V.bib = { nom: x.morceau + ' · ' + x.nom, url, debut: 0, duree: d }; V.musique = 'biblio'; majMusique(); msg('Musique : ' + x.morceau);
      } catch (e) { msg('Impossible de lire ce fichier : ' + (e.message || e)); } }, { actuel: '' });
  }
  $('#rvMusIn').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const url = URL.createObjectURL(f), d = await new Promise(ok => { const a = new Audio(url); a.onloadedmetadata = () => ok(a.duration); a.onerror = () => ok(0); });
    if (!d) return msg('Musique illisible');
    V.pc = { nom: f.name, url, debut: 0, duree: d }; V.musique = 'pc'; majMusique(); msg('Musique : ' + f.name); };
  BK.surOuvrir = BK.surOuvrir || {}; BK.surOuvrir.reelvis = () => { galerieSiVide(); chargerExports(); majMusique(); remplirMorceaux(); };

  // ---------- lecture ----------
  function stop() { vid.pause(); son.pause(); cancelAnimationFrame(V.lecture); V.lecture = null; $('#rvPlay').textContent = '▶ Lire';
    if (V.calage >= 0) { V.calage = -1; sauverSous(); majSous(); } }
  function lire(force) {
    if (V.lecture && !force) return stop();
    const a = musique();
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
      const a = musique();
      let audio = null, fin = V.fin;
      if (a) { fin = Math.min(V.fin, V.debut + a.duree); const buf = await BK.audio.decoder(new Uint8Array(await (await fetch(a.url)).arrayBuffer())); audio = tranche(buf, a.debut, fin - V.debut); }
      else { try { const buf = await BK.audio.decoder(new Uint8Array(await V.fichier.arrayBuffer())); audio = tranche(buf, V.debut, fin - V.debut); } catch (e) { audio = null; } }
      const mp4 = await BK.rendu.exporter({ video: vid, debut: V.debut, fin, cadre: cadre(), force: V.force / 100, lut: V.lut, sous: V.sousOn ? V.sous : [], voile: V.voile || '', reglages: V.regl, audio,
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

  majGabarit(); majMusique(); remplirMorceaux(); chargerExports();
});
})();
