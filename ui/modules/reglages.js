// =====================================================================
// RÉGLAGES — propres à CE PC (onglets visibles, nom du PC, taille)
// =====================================================================
BK.module('reglages', function (page) {
  $('.sub', page).textContent = 'Ce qui est réglé ici ne concerne que cet ordinateur';
  const choix = BK.onglets.filter(o => !o.fixe);
  $('.grid', page).innerHTML = `
    <div class="cols">
      <section class="pane vit"><span class="ptitle">① Onglets de ce PC</span>
        <div class="box"><span class="lb">Onglets affichés</span>
          <span class="nt">Allume seulement ce qui sert sur cet ordinateur (ex. Lumières : au studio et chez Pierre).</span>
          <div class="interrupteurs">${choix.map(o => `
            <button class="inter${BK.ongletVisible(o) ? ' on' : ''}" data-id="${o.id}">
              <span class="led ${BK.ongletVisible(o) ? 'grn' : ''}"></span>
              <span class="nchip" style="--c:${o.couleur}"></span>
              <span class="t"><span class="lab">${o.titre}</span><span class="nsub">${(c => c.titre || c.nom)(BK.cotes.find(c => c.id === o.cote))}${o.pret ? '' : ' · bientôt'}</span></span>
            </button>`).join('')}
          </div></div>
        <div class="box grow rg-dos"><div class="ligne-titre"><span class="lb">Vos dossiers du Drive</span>
            <button class="btn xs" id="rgDetecter" style="margin-left:auto">↻ Chercher à nouveau</button><button class="btn xs" id="rgPlan">Copier le plan du Drive</button></div>
          <span class="nt">Le logiciel lit ces dossiers (il ne déplace et ne renomme rien). « Changer… » si un dossier n'est pas le bon. Pour tout le groupe.</span>
          <div class="rg-dos-liste" id="rgDos"></div></div>
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
        <div class="box"><span class="lb">Drive BEESKOT</span><div id="rgDriveZone"></div></div>
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
  // ---------- Drive : 3 états (rien / fichier client importé / relié) ----------
  const rmsg = t => $('#rgMsg', page).textContent = String(t).toUpperCase();
  function zoneDrive() {
    const c = BK.drive.conf(), z = $('#rgDriveZone', page);
    if (!BK.estExe) { z.innerHTML = '<span class="nt">Disponible dans le logiciel installé.</span>'; return; }
    if (BK.drive.relie()) z.innerHTML = `<span class="nt">✅ Relié. Les fiches sont partagées avec tous les PC (dossier « BEESKOT Studio » du Drive).</span>
      <div class="chips" style="margin-top:10px"><button class="chip" data-d="carte">Fabriquer la carte d'accès…</button><button class="chip" data-d="sync">↻ Relire le Drive</button><button class="chip" data-d="off">Déconnecter</button></div>
      <span class="nt">La carte d'accès sert à relier les autres PC sans mot de passe. Ne l'envoie qu'aux membres.</span>`;
    else z.innerHTML = `<span class="nt"><b>Chez Yacine (1 fois)</b> : importe le fichier client Google, puis connecte-toi.<br><b>Autres PC</b> : importe la carte d'accès.</span>
      <div class="chips" style="margin-top:10px">
        <button class="chip" data-d="client">${c && c.client_id ? '✓ Fichier client importé' : '1. Importer le fichier client…'}</button>
        <button class="chip" data-d="connecter" ${c && c.client_id ? '' : 'disabled'}>2. Se connecter au Drive</button></div>
      <div class="chips" style="margin-top:8px"><button class="chip" data-d="importer">Importer une carte d'accès…</button></div>`;
    $$('[data-d]', z).forEach(b => b.onclick = async () => {
      const a = b.dataset.d;
      try {
        if (a === 'client') { if (await BK.drive.importerClient()) rmsg('Fichier client importé'); }
        if (a === 'connecter') { rmsg('Autorise BEESKOT Studio dans la page Google…'); await BK.drive.connecter(); rmsg('Drive relié'); BK.synchro(); }
        if (a === 'importer') { if (await BK.drive.importerCarte()) { rmsg('Drive relié avec la carte'); BK.synchro(); } }
        if (a === 'carte') { const p = await BK.drive.exporterCarte(); if (p) { rmsg('Carte enregistrée'); BK.drive.derniereCarte = p; } }
        if (a === 'sync') { rmsg('Lecture du Drive…'); await BK.synchro(); rmsg('Drive relu'); }
        if (a === 'off') { if (confirm('Déconnecter ce PC du Drive BEESKOT ? (rien n\'est effacé)')) { BK.drive.deconnecter(); rmsg('Déconnecté'); } }
      } catch (e) { console.error(e); rmsg('Problème : ' + (e.message || e)); }
      zoneDrive(); BK.etatDrive();
      if (BK.drive.derniereCarte) { $('#rgDriveZone', page).insertAdjacentHTML('beforeend', `<span class="nt" style="color:#ffb23e">✓ Carte enregistrée ici : ${BK.drive.derniereCarte.replace(/[<>&]/g, '')}</span>`); BK.drive.derniereCarte = null; }
    });
  }
  zoneDrive();

  // ---------- vos dossiers du Drive ----------
  async function rendreDossiers() {
    const z = $('#rgDos', page);
    if (!BK.drive.relie()) { z.innerHTML = '<span class="nt">Relie d\'abord le Drive (à droite).</span>'; return; }
    const c = await BK.dossiers.config();
    z.innerHTML = BK.dossiers.ROLES.map(r => { const d = c.roles[r.id];
      return `<div class="rg-dos-l"><span class="eng">${r.nom}</span><span class="nt mono">${d ? '📁 ' + (d.chemin || d.nom).replace(/[<>&]/g, '') : '— pas trouvé —'}${d && d.manuel ? ' ✋' : ''}</span>
        <button class="btn xs" data-role="${r.id}">Changer…</button></div>`; }).join('');
    $$('[data-role]', z).forEach(b => b.onclick = async () => {
      const d = await BK.explorerDrive({ titre: 'Dossier « ' + BK.dossiers.ROLES.find(r => r.id === b.dataset.role).nom + ' »', mode: 'dossier' });
      if (d) { await BK.dossiers.regler(b.dataset.role, d); rmsg('Dossier enregistré'); rendreDossiers(); }
    });
  }
  $('#rgDetecter', page).onclick = async () => {
    if (!BK.drive.relie()) return rmsg('Relie d\'abord le Drive');
    try { const t = await BK.dossiers.detecter(rmsg); rmsg(Object.keys(t).length + ' dossier(s) trouvés'); } catch (e) { rmsg('Problème : ' + e.message); }
    rendreDossiers();
  };
  $('#rgPlan', page).onclick = async () => {
    if (!BK.drive.relie()) return rmsg('Relie d\'abord le Drive');
    rmsg('Lecture du plan…');
    try { const t = await BK.dossiers.plan(); await navigator.clipboard.writeText(t); rmsg('Plan copié (noms des dossiers seulement)'); } catch (e) { rmsg('Problème : ' + e.message); }
  };
  BK.surOuvrir = BK.surOuvrir || {};
  BK.surOuvrir.reglages = async () => { if (BK.drive.relie()) await BK.dossiers.assurer(); rendreDossiers(); };
  rendreDossiers();
  $('#rgAbleton', page).onclick = async () => {
    if (!BK.estExe) { $('#rgMsg', page).textContent = 'DISPONIBLE DANS LE LOGICIEL INSTALLÉ'; return; }
    try { const d = await BK.ableton.installerPont(); if (d) BK.ableton.fenetre(d); } catch (e) { $('#rgMsg', page).textContent = 'INSTALLATION IMPOSSIBLE'; }
  };
  $('#rgZoom', page).onchange = e => { BK.regler('zoom', +e.target.value); document.documentElement.style.zoom = e.target.value / 100; };
});
