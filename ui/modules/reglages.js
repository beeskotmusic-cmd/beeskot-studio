// =====================================================================
// RÉGLAGES — propres à CE PC (onglets visibles, nom du PC, taille)
// =====================================================================
BK.module('reglages', function (page) {
  $('.sub', page).textContent = 'Ce qui est réglé ici ne concerne que cet ordinateur';
  const choix = BK.onglets.filter(o => !o.fixe);
  $('.grid', page).innerHTML = `
    <div class="rg-tabs" id="rgTabs"><button data-rgt="aide">🍞 Aide</button><button data-rgt="pc">💻 Ce PC</button><button data-rgt="onglets">🗂 Onglets</button><button data-rgt="miette">🍞 Miette & Discord</button><button data-rgt="drive">☁ Drive</button><button data-rgt="ableton">🎛 Ableton</button></div>
    <section class="pane rg-corps" id="rgCorps">
        <div data-rgo="aide" class="box"><span class="lb">Aide</span>
          <div class="chips" style="margin-top:8px"><button class="btn sm pri" id="rgNouveau">✨ Quoi de neuf ?</button><button class="btn sm" id="rgTuto">📖 Tuto : tout le logiciel</button></div>
          <button class="btn sm" id="rgGuide" style="margin-top:8px;align-self:flex-start">🍞 Revoir le guide de démarrage</button></div>
        <div data-rgo="aide" class="box"><span class="lb">Version du logiciel</span>
          <span class="vfd" style="margin-top:6px;align-self:flex-start">${String(BK.version || '').replace(/[<>&]/g, '')}</span>
          <button class="btn sm" id="rgMaj" style="margin-top:8px">🔍 Vérifier les mises à jour</button>
          <span class="nt" id="rgMajTxt">Le logiciel regarde tout seul au démarrage, puis toutes les 20 minutes.</span></div>
        <div data-rgo="pc" class="box"><span class="lb">Qui utilise cet ordinateur ?</span>
          <span class="nt">Ton prénom (Yacine, Pierre, Baptiste) ou « Studio ». C'est à ce nom que partent les tâches que tu coches et les reels que tu fais avancer.</span>
          <input class="fld" id="rgNom" style="margin-top:10px" maxlength="16" placeholder="ton prénom, ou Studio" value="${BK.reglage('nomPc', '')}">
          <div class="chips" style="margin-top:8px" id="rgNoms">${['Yacine', 'Pierre', 'Baptiste', 'Studio'].map(n => `<button class="chip${BK.reglage('nomPc', '') === n ? ' on' : ''}" data-nom="${n}">${n}</button>`).join('')}</div></div>
        <div data-rgo="pc" class="box"><span class="lb">Taille de l'interface</span>
          <div class="knobs" style="justify-content:center"><div class="kb">
            <input id="rgZoom" type="range" min="80" max="130" step="5" value="${BK.reglage('zoom', 100)}" class="knobify" data-ticks="80,,,,,130" data-fmt="{} %"><span class="lb">Zoom</span></div></div></div>
        <div data-rgo="onglets" class="box"><span class="lb">Onglets affichés</span>
          <span class="nt">Allume seulement ce qui sert sur cet ordinateur (ex. Lumières : au studio et chez Pierre).</span>
          <div class="interrupteurs">${choix.map(o => `
            <button class="inter${BK.ongletVisible(o) ? ' on' : ''}" data-id="${o.id}">
              <span class="led ${BK.ongletVisible(o) ? 'grn' : ''}"></span>
              <span class="nchip" style="--c:${o.couleur}"></span>
              <span class="t"><span class="lab">${o.titre}</span><span class="nsub">${(c => c.titre || c.nom)(BK.cotes.find(c => c.id === o.cote))}${o.pret ? '' : ' · bientôt'}</span></span>
            </button>`).join('')}
          </div></div>
        <div data-rgo="drive" class="box"><span class="lb">Drive BEESKOT</span><div id="rgDriveZone"></div></div>
        <div data-rgo="drive" class="box grow rg-dos"><div class="ligne-titre"><span class="lb">Vos dossiers du Drive</span>
            <button class="btn xs" id="rgDetecter" style="margin-left:auto">↻ Chercher à nouveau</button><button class="btn xs" id="rgPlan">Copier le plan du Drive</button></div>
          <span class="nt">Le logiciel lit ces dossiers (il ne déplace et ne renomme rien). « Changer… » si un dossier n'est pas le bon. Pour tout le groupe.</span>
          <div class="rg-dos-liste" id="rgDos"></div></div>
        <div data-rgo="ableton" class="box"><span class="lb">Ableton Live</span>
          <span class="nt">Un clic : le logiciel trouve Ableton et installe le pont tout seul. Il restera juste à le choisir dans Ableton.</span>
          <div class="chips" style="margin-top:10px"><button class="chip" id="rgAbleton">Relier Ableton (automatique)</button></div></div>
        <div data-rgo="ableton" class="box" id="rgSauv"></div>
    </section>
    <div class="pane abar"><span class="vfd" id="rgMsg">PRÊT</span></div>`;

  // ---------- les onglets de Réglages : un seul groupe à la fois ----------
  const RG = ['aide', 'pc', 'onglets', 'miette', 'drive', 'ableton'];
  const montrerRg = BK.reglagesOnglet = (k = BK.reglage('reglages.onglet', 'aide')) => { if (!RG.includes(k)) k = 'aide'; BK.regler('reglages.onglet', k);
    $$('#rgTabs button', page).forEach(b => b.classList.toggle('on', b.dataset.rgt === k));
    $$('#rgCorps > [data-rgo]', page).forEach(x => x.classList.toggle('hidden', x.dataset.rgo !== k)); };
  $$('#rgTabs button', page).forEach(b => b.onclick = () => montrerRg(b.dataset.rgt));
  montrerRg();
  $$('.inter', page).forEach(b => b.onclick = () => {
    const o = BK.onglets.find(x => x.id === b.dataset.id), v = !BK.ongletVisible(o);
    BK.regler('visible.' + o.id, v);
    b.classList.toggle('on', v); $('.led', b).classList.toggle('grn', v);
    BK.construireMenu(); BK.ouvrir('reglages');
    $('#rgMsg', page).textContent = (o.titre + (v ? ' AFFICHÉ' : ' CACHÉ')).toUpperCase();
  });
  BK.sauvegardes && BK.sauvegardes.case($('#rgSauv', page));
  $('#rgMaj', page).onclick = () => BK.verifierMajBouton($('#rgMaj', page), $('#rgMajTxt', page));
  $('#rgNouveau', page).onclick = () => BK.nouveautes.montrer(BK.NOUVEAUTES.slice(0, 3));
  $('#rgTuto', page).onclick = () => BK.nouveautes.tuto();
  $('#rgGuide', page).onclick = () => BK.bienvenue.ouvrir(true);
  const nomPc = n => { BK.regler('nomPc', n); $('#rgNom', page).value = n; BK.majNomPc(); $$('#rgNoms .chip', page).forEach(c => c.classList.toggle('on', c.dataset.nom === n));
    BK.presence && BK.presence.maj(true); $('#rgMsg', page).textContent = n ? 'CET ORDINATEUR : ' + n.toUpperCase() : 'PRÊT'; };
  $('#rgNom', page).onchange = e => nomPc(e.target.value.trim());
  $$('#rgNoms .chip', page).forEach(c => c.onclick = () => nomPc(c.dataset.nom));
  // ---------- TIME MACHINE : remettre des fiches comme elles étaient avant une heure donnée ----------
  const COLS_RETOUR = [
    { c: 'morceaux', n: 'Bibliothèque (les morceaux)' }, { c: 'taches', n: 'To-do list' },
    { c: 'evenements', n: 'Calendrier' }, { c: 'tournages', n: 'Tournages' }, { c: 'reels', n: 'Reels' },
    { c: 'depenses', n: 'Budget : dépenses' }, { c: 'abonnements', n: 'Budget : abonnements' },
    { c: 'exportsaudio', n: 'Reels Audio : les exports' }, { c: 'notesmix', n: 'Écoute : les notes sur les mix' },
    { c: 'inventaires', n: 'Fichiers repérés sur les PC' }, { c: 'config', n: 'Étiquettes et réglages partagés' },
  ];
  function panneauRetour() {
    const v = document.createElement('div'); v.className = 'voile';
    const d = new Date(Date.now() - 3 * 36e5 - new Date().getTimezoneOffset() * 60e3).toISOString().slice(0, 16);
    v.innerHTML = `<div class="stopbox" style="width:520px;align-items:stretch">
      <span class="screw tl"></span><span class="screw tr"></span><span class="screw bl"></span><span class="screw br"></span>
      <button class="btn xs rt-x" id="rtX" title="Fermer">✕</button>
      <span class="dymo" style="align-self:center">⏪ Time Machine</span>
      <span class="nt">Google garde les versions précédentes de chaque fiche pendant 30 jours. On remet tout un onglet comme il était avant l'heure choisie. <b>Rien n'est effacé</b> : on réécrit par-dessus, et on peut refaire un retour en arrière après.</span>
      <label style="margin-top:10px"><span class="eng">Quoi</span><select class="fld" id="rtCol">${COLS_RETOUR.map(x => `<option value="${x.c}">${x.n}</option>`).join('')}</select></label>
      <label style="margin-top:8px"><span class="eng">Comme c'était avant le</span><input class="fld" type="datetime-local" id="rtQuand" value="${d}"></label>
      <span class="nt" id="rtMsg" style="min-height:18px;margin-top:8px"></span>
      <div class="stopbox-btns"><button class="btn pri" id="rtGo">⏪ Remettre comme avant</button><button class="btn" id="rtNon">Annuler</button></div></div>`;
    document.body.appendChild(v);
    const fermer = () => v.remove();
    v.querySelector('#rtNon').onclick = fermer;
    v.querySelector('#rtX').onclick = fermer;
    const echap = e => { if (e.key === 'Escape') { fermer(); document.removeEventListener('keydown', echap); } };
    document.addEventListener('keydown', echap);
    v.addEventListener('click', e => { if (e.target === v) fermer(); });
    v.querySelector('#rtGo').onclick = async () => {
      const col = v.querySelector('#rtCol').value, q = v.querySelector('#rtQuand').value;
      if (!q) return v.querySelector('#rtMsg').textContent = 'Choisis une date et une heure';
      const nom = (COLS_RETOUR.find(x => x.c === col) || {}).n;
      if (!confirm(`Remettre « ${nom} » comme avant le ${new Date(q).toLocaleString('fr-CA')} ?`)) return;
      const b = v.querySelector('#rtGo'), m = v.querySelector('#rtMsg');
      b.disabled = true; b.innerHTML = '<span class="spin"></span>…';
      try {
        const n = await BK.drive.restaurer(col, new Date(q).toISOString(), t => m.textContent = t);
        m.textContent = n ? n + ' fiche(s) remises comme avant' : 'Aucune version plus ancienne trouvée';
        BK.db.cache[col] = null; BK.regler('drive.cache.' + col, {}); if (BK.drive.memo) delete BK.drive.memo[col];
        window.dispatchEvent(new CustomEvent('bk:distant', { detail: { cols: [col] } }));
        for (const f of ['biblioRecharger', 'tachesRecharger', 'agendaRecharger', 'budgetRecharger', 'tournagesRecharger', 'suiviRecharger', 'mediasRecharger']) try { BK[f] && BK[f](); } catch (e) {}
        rmsg(n ? n + ' fiche(s) récupérées' : 'rien à récupérer');
      } catch (e) { m.textContent = 'Problème : ' + (e.message || e); }
      b.disabled = false; b.textContent = '⏪ Remettre comme avant';
    };
  }

  // ---------- Drive : 3 états (rien / fichier client importé / relié) ----------
  const rmsg = t => $('#rgMsg', page).textContent = String(t).toUpperCase();
  function zoneDrive() {
    const c = BK.drive.conf(), z = $('#rgDriveZone', page);
    if (!BK.estExe) { z.innerHTML = '<span class="nt">Disponible dans le logiciel installé.</span>'; return; }
    if (BK.drive.relie()) z.innerHTML = `<span class="nt">✅ Relié. Les fiches sont partagées avec tous les PC (dossier « BEESKOT Studio » du Drive).</span>
      <div class="chips" style="margin-top:10px"><button class="btn sm pri" data-d="carte">🎫 Fabriquer la carte d'accès</button><button class="chip" data-d="sync">↻ Relire le Drive</button><button class="chip" data-d="retour">⏪ Time Machine</button><button class="chip" data-d="alleger" title="Les vieilles photos recopiées dans les fiches sont rangées dans le Drive : les fiches deviennent légères">🪶 Alléger les fiches</button><button class="chip" data-d="off">Déconnecter</button></div>
      <span class="nt">La carte d'accès relie les autres PC du groupe en un clic : le Drive <b>et</b> les codes de Miette. Elle se range sur ton Bureau. Ne l'envoie qu'aux membres (message privé).</span>`;
    else z.innerHTML = `<span class="nt"><b>Chez Yacine (1 fois)</b> : importe le fichier client Google, puis connecte-toi.<br><b>Autres PC</b> : importe la carte d'accès.</span>
      <div class="chips" style="margin-top:10px">
        <button class="chip" data-d="client">${c && c.client_id ? '✓ Fichier client importé' : '1. Importer le fichier client…'}</button>
        <button class="chip" data-d="connecter" ${c && c.client_id ? '' : 'disabled'}>2. Se connecter au Drive</button></div>
      <div class="chips" style="margin-top:8px"><button class="chip" data-d="importer">Importer une carte d'accès…</button></div>`;
    $$('[data-d]', z).forEach(b => b.onclick = async () => {
      const a = b.dataset.d;
      try {
        if (a === 'client') { if (await BK.drive.importerClient()) rmsg('Fichier client importé'); }
        if (a === 'connecter') { rmsg('Autorise BEESKOT Studio dans la page Google…'); await BK.drive.connecter(); rmsg('Drive relié'); BK.pousser(); }
        if (a === 'importer') { if (await BK.drive.importerCarte()) { rmsg('Drive relié avec la carte'); BK.pousser(); } }
        if (a === 'carte') { const p = await BK.drive.exporterCarte(); if (p) { rmsg('Carte enregistrée sur le Bureau'); BK.drive.derniereCarte = p; } }
        if (a === 'sync') { rmsg('Lecture du Drive…'); await BK.pousser(); rmsg('Drive relu'); }
        if (a === 'retour') { panneauRetour(); return; }
        if (a === 'alleger') {
          rmsg('Je compte les photos…');
          const [ms, rs, ts] = await Promise.all(['morceaux', 'reels', 'tournages'].map(c => BK.db.liste(c)));
          const n = BK.img.combienDeCopies(ms, rs, ts);
          if (!n) { rmsg('Déjà léger : toutes les photos sont lues depuis le Drive'); return; }
          if (!confirm(`${n} photo(s) sont recopiées dans les fiches.\n\nOn les range dans le Drive (dossier « BEESKOT Studio / Images des fiches ») et les fiches gardent juste leur adresse.\nUne sauvegarde est faite avant. Rien n'est effacé.\n\nOn y va ?`)) { rmsg('Rien changé'); return; }
          const k = await BK.img.alleger((p, nom) => rmsg(`Rangement des photos… ${Math.round(p * 100)} %`));
          rmsg(`✓ ${k} photo(s) rangée(s) dans le Drive · fiches allégées`); return; }
        if (a === 'off') { if (confirm('Déconnecter ce PC du Drive BEESKOT ? (rien n\'est effacé)')) { BK.drive.deconnecter(); rmsg('Déconnecté'); } }
      } catch (e) { console.error(e); rmsg('Problème : ' + (e.message || e)); }
      zoneDrive(); BK.etatDrive();
      if (BK.drive.derniereCarte) { const c = BK.drive.derniereCarte, dos = c.replace(/[\\/][^\\/]+$/, '');
        $('#rgDriveZone', page).insertAdjacentHTML('beforeend', `<div class="box" style="margin-top:8px"><span class="nt" style="color:#ffb23e">✓ Carte enregistrée ici :<br><span class="mono" style="white-space:normal">${c.replace(/[<>&]/g, '')}</span></span>
          <div class="chips" style="margin-top:8px"><button class="chip" id="rgCarteDos">📂 Ouvrir le dossier</button></div></div>`);
        const bd = $('#rgCarteDos', page); if (bd) bd.onclick = () => BK.fichier.ouvrir(dos);
        BK.drive.derniereCarte = null; }
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
  $('#rgZoom', page).onchange = e => { BK.regler('zoom', +e.target.value); BK.appliquerZoom(+e.target.value); };
});
