// =====================================================================
// RÉGLAGES — propres à CE PC (onglets visibles, nom du PC, taille)
// =====================================================================
BK.module('reglages', function (page) {
  $('.sub', page).textContent = 'Ce qui est réglé ici ne concerne que cet ordinateur';
  const choix = BK.onglets.filter(o => !o.fixe);
  $('.grid', page).innerHTML = `
    <div class="cols">
      <section class="pane vit"><span class="ptitle">① Onglets de ce PC</span>
        <div class="box grow"><span class="lb">Onglets affichés</span>
          <span class="nt">Allume seulement ce qui sert sur cet ordinateur (ex. Lumières : au studio et chez Pierre).</span>
          <div class="interrupteurs">${choix.map(o => `
            <button class="inter${BK.ongletVisible(o) ? ' on' : ''}" data-id="${o.id}">
              <span class="led ${BK.ongletVisible(o) ? 'grn' : ''}"></span>
              <span class="nchip" style="--c:${o.couleur}"></span>
              <span class="t"><span class="lab">${o.titre}</span><span class="nsub">${(c => c.titre || c.nom)(BK.cotes.find(c => c.id === o.cote))}${o.pret ? '' : ' · bientôt'}</span></span>
            </button>`).join('')}
          </div></div>
      </section>
      <section class="pane reg"><span class="ptitle">② Ce PC</span>
        <div class="box"><span class="lb">Nom de cet ordinateur</span>
          <input class="fld" id="rgNom" style="margin-top:10px" maxlength="16" placeholder="ex. STUDIO, PIERRE…" value="${BK.reglage('nomPc', '')}"></div>
        <div class="box"><span class="lb">Taille de l'interface</span>
          <div class="knobs" style="justify-content:center"><div class="kb">
            <input id="rgZoom" type="range" min="80" max="130" step="5" value="${BK.reglage('zoom', 100)}" class="knobify" data-ticks="80,,,,,130" data-fmt="{} %"><span class="lb">Zoom</span></div></div></div>
        <div class="box"><span class="lb">Ableton Live</span>
          <span class="nt">Installe le petit pont BEESKOT dans Ableton (une fois par PC).</span>
          <div class="chips" style="margin-top:10px"><button class="chip" id="rgAbleton">Relier Ableton…</button></div></div>
        <div class="box"><span class="lb">Drive BEESKOT</span>
          <span class="nt">Le dossier Google Drive du groupe sur ce PC. Le logiciel y range ses fiches dans un sous-dossier « BEESKOT Studio » (tes fichiers existants ne sont pas touchés).</span>
          <span class="vfd" id="rgDrive" style="display:block;margin-top:10px;font-size:11px">${BK.reglage('drive', '') || 'AUCUN DOSSIER'}</span>
          <div class="chips" style="margin-top:10px"><button class="chip" id="rgDriveBtn">Choisir le dossier…</button></div></div>
      </section>
    </div>
    <div class="pane abar"><span class="ptitle">③ Barre</span><span class="vfd" id="rgMsg">PRÊT</span></div>`;

  $$('.inter', page).forEach(b => b.onclick = () => {
    const o = BK.onglets.find(x => x.id === b.dataset.id), v = !BK.ongletVisible(o);
    BK.regler('visible.' + o.id, v);
    b.classList.toggle('on', v); $('.led', b).classList.toggle('grn', v);
    BK.construireMenu(); BK.ouvrir('reglages');
    $('#rgMsg', page).textContent = (o.titre + (v ? ' AFFICHÉ' : ' CACHÉ')).toUpperCase();
  });
  $('#rgNom', page).onchange = e => { BK.regler('nomPc', e.target.value.trim()); $('#syPc').textContent = (e.target.value.trim() || 'CE PC').toUpperCase(); };
  $('#rgDriveBtn', page).onclick = async () => {
    if (!BK.estExe) { $('#rgMsg', page).textContent = 'DISPONIBLE DANS LE LOGICIEL INSTALLÉ'; return; }
    const d = await BK.fichier.choisirDossier('Dossier Google Drive BEESKOT');
    if (!d) return;
    BK.regler('drive', d); await BK.fichier.creerDossier(BK.db.racine());
    $('#rgDrive', page).textContent = d; BK.etatDrive(); $('#rgMsg', page).textContent = 'DRIVE RELIÉ';
  };
  $('#rgAbleton', page).onclick = async () => {
    if (!BK.estExe) { $('#rgMsg', page).textContent = 'DISPONIBLE DANS LE LOGICIEL INSTALLÉ'; return; }
    try { const d = await BK.ableton.installerPont(); if (d) BK.ableton.fenetre(d); } catch (e) { $('#rgMsg', page).textContent = 'INSTALLATION IMPOSSIBLE'; }
  };
  $('#rgZoom', page).onchange = e => { BK.regler('zoom', +e.target.value); document.documentElement.style.zoom = e.target.value / 100; };
});
