// =====================================================================
// BEESKOT STUDIO MOBILE — la page pour le téléphone.
// Même base que le PC (coeur.js, donnees.js, drive.js) : mêmes fiches, même Drive.
//
//   Relier le téléphone : sur un PC, Réglages › Aide › « Relier un téléphone » → QR code
//   Le QR code ouvre cette page avec la clé dans le lien (#k=…) : la page la garde, puis l'efface du lien.
//
//   Ajouter un écran : une ligne dans ECRANS (nom + fonction qui dessine). C'est tout.
//   Cette première version ne fait que LIRE le Drive (rien n'est écrit).
// =====================================================================
(function () {
  const $ = s => document.querySelector(s), esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const page = $('#moPage');
  BK.etatDrive = () => {};                                   // le voyant DRIVE du PC n'existe pas ici (le nôtre : en haut à droite)
  let toastT = 0;
  const msg = t => { const e = $('#moToast'); e.textContent = t; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), 2600); };

  // ---------- 1. la clé : reçue par le QR code (#k=…) ou par la carte d'accès ----------
  function garderCle(j) {
    const c = { client_id: j.client_id || j.i, client_secret: j.client_secret || j.s, refresh_token: j.refresh_token || j.r };
    if (!c.client_id || !c.client_secret || !c.refresh_token) throw new Error('Clé incomplète');
    BK.regler('drive.conf', c); BK.drive.jeton = null;
  }
  function lireLien() {
    const m = location.hash.match(/[#&]k=([A-Za-z0-9_-]+)/); if (!m) return false;
    history.replaceState(null, '', location.pathname + location.search);          // la clé ne reste pas dans le lien (ni dans l'historique)
    try { const b = m[1].replace(/-/g, '+').replace(/_/g, '/'); const txt = decodeURIComponent(escape(atob(b + '==='.slice((b.length + 3) % 4))));
      garderCle(JSON.parse(txt)); return true; }
    catch (e) { msg('Ce QR code n\'est pas valide'); return false; }
  }

  // ---------- 2. les écrans ----------
  const ECRANS = {
    biblio:  { nom: 'Bibliothèque',      dessiner: biblio },
    agenda:  { nom: 'Calendrier',        bientot: true },
    taches:  { nom: 'To-do list',        bientot: true },
    ecoute:  { nom: 'Notes et retours',  bientot: true },
    tournage:{ nom: 'Tournages',         bientot: true },
    reglages:{ nom: 'Réglages',          dessiner: reglages },
  };
  let actuel = BK.reglage('mobile.ecran', 'biblio');

  function menu() {
    $('#moMenu').innerHTML = `<img class="mo-menu-logo" src="../look/logo-beeskot-studio.png" alt="">`
      + Object.entries(ECRANS).map(([id, e]) => `<button class="mo-tab${id === actuel ? ' on' : ''}${e.bientot ? ' bientot' : ''}" data-e="${id}"><span>${esc(e.nom)}</span>${e.bientot ? '<em>bientôt</em>' : ''}</button>`).join('')
      + `<span class="mo-ver">${esc(BK.version || '')} · mobile</span>`;
    $('#moMenu').querySelectorAll('[data-e]').forEach(b => b.onclick = () => { if (ECRANS[b.dataset.e].bientot) return msg('Arrive bientôt'); ouvrir(b.dataset.e); volet(false); });
  }
  const volet = o => { document.body.classList.toggle('menu-ouvert', o); $('#moMenu').setAttribute('aria-hidden', o ? 'false' : 'true'); };
  $('#moBurger').onclick = () => volet(!document.body.classList.contains('menu-ouvert'));
  $('#moVoile').onclick = () => volet(false);

  function ouvrir(id) {
    if (!BK.drive.relie()) return accueilSansCle();
    actuel = ECRANS[id] && !ECRANS[id].bientot ? id : 'biblio'; BK.regler('mobile.ecran', actuel); menu();
    page.innerHTML = `<h1 class="mo-titre">${esc(ECRANS[actuel].nom)}</h1><div id="moCorps"><p class="mo-nt">Chargement…</p></div>`;
    ECRANS[actuel].dessiner($('#moCorps'));
  }
  function etat(t, ok) { const e = $('#moEtat'); e.textContent = t; e.classList.toggle('ok', !!ok); }

  // ---------- pas encore relié ----------
  function accueilSansCle() {
    etat('NON RELIÉ'); menu();
    page.innerHTML = `<div class="mo-carte mo-relier">
      <span class="dymo">Relier ce téléphone</span>
      <p>Sur un PC du groupe : <b>Réglages › Aide › BEESKOT Studio Mobile › Relier un téléphone</b>.</p>
      <p>Scanne le QR code avec l'appareil photo du téléphone : cette page s'ouvre, déjà reliée au Drive BEESKOT.</p>
      <p class="mo-nt">Autre façon : importer la carte d'accès (le petit fichier fait sur le PC).</p>
      <label class="btn sm">Importer la carte d'accès<input type="file" id="moCarte" accept=".json,application/json" hidden></label></div>`;
    $('#moCarte').onchange = async e => { const f = e.target.files[0]; if (!f) return;
      try { const j = JSON.parse(await f.text()); if (j.type && j.type !== 'carte-acces-beeskot') throw 0; garderCle(j); msg('Téléphone relié'); demarrer(); }
      catch (er) { msg('Ce n\'est pas une carte d\'accès BEESKOT'); } };
  }

  // ---------- Bibliothèque : les morceaux, et écouter la version ★ ----------
  let MORCEAUX = [];
  async function biblio(z) {
    try { MORCEAUX = (await BK.db.liste('morceaux')).sort((a, b) => String(a.nom).localeCompare(String(b.nom))); }
    catch (e) { z.innerHTML = `<p class="mo-nt">Impossible de lire le Drive : ${esc(e.message)}</p>`; return; }
    etat(BK.db.enLigne ? 'RELIÉ' : 'HORS LIGNE', BK.db.enLigne);
    if (!MORCEAUX.length) { z.innerHTML = '<p class="mo-nt">Aucun morceau dans le Drive.</p>'; return; }
    const groupe = (titre, l) => l.length ? `<h2 class="mo-sous">${titre}</h2>` + l.map(m => `
      <button class="mo-morceau${LECT.m === m.id ? ' joue' : ''}" data-m="${esc(m.id)}">
        <span class="mo-play">${LECT.m === m.id && !son.paused ? '❚❚' : '▶'}</span>
        <span class="mo-m-txt"><b>${esc(m.nom)}</b><span>${esc([m.bpm && m.bpm + ' BPM', m.ton, m.sortie && 'sortie ' + m.sortie].filter(Boolean).join(' · ')) || '&nbsp;'}</span></span>
        <span class="dymo sm">${m.statut === 'sorti' ? 'Sorti' : m.statut === 'prochaine' ? 'Next' : 'En cours'}</span></button>`).join('') : '';
    z.innerHTML = groupe('En cours', MORCEAUX.filter(m => m.statut !== 'sorti')) + groupe('Sortis', MORCEAUX.filter(m => m.statut === 'sorti'));
    z.querySelectorAll('[data-m]').forEach(b => b.onclick = () => jouer(MORCEAUX.find(m => m.id === b.dataset.m)));
  }

  // ---------- le lecteur (en bas de l'écran) ----------
  const son = new Audio(), LECT = { m: '', urls: {} };
  son.preload = 'auto';
  const t2 = s => { s = isFinite(s) ? s : 0; return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); };
  function majLecteur() {
    $('#moLp').textContent = son.paused ? '▶' : '❚❚';
    $('#moLtemps').textContent = t2(son.currentTime) + ' / ' + t2(son.duration);
    if (!glisse) $('#moLpos').value = son.duration ? Math.round(son.currentTime / son.duration * 1000) : 0;
    document.querySelectorAll('.mo-morceau').forEach(b => { const j = b.dataset.m === LECT.m; b.classList.toggle('joue', j); b.querySelector('.mo-play').textContent = j && !son.paused ? '❚❚' : '▶'; });
  }
  let glisse = false;
  ['timeupdate', 'play', 'pause', 'loadedmetadata', 'ended'].forEach(e => son.addEventListener(e, majLecteur));
  $('#moLp').onclick = () => son.paused ? son.play() : son.pause();
  $('#moLpos').oninput = () => { glisse = true; };
  $('#moLpos').onchange = e => { glisse = false; if (son.duration) son.currentTime = e.target.value / 1000 * son.duration; };

  async function jouer(m) {
    if (!m) return;
    if (LECT.m === m.id && son.src) return son.paused ? son.play() : son.pause();
    son.pause(); LECT.m = m.id; $('#moLecteur').hidden = false; $('#moLtitre').textContent = m.nom; majLecteur();
    try {
      let url = LECT.urls[m.id];
      if (!url) {
        msg('Je cherche la version ★…');
        const src = await sonMobile(m);
        if (!src) return msg('Pas de version de ' + m.nom + ' sur le Drive (seulement sur un PC)');
        url = LECT.urls[m.id] = await telecharger(src.drive, src.nom);
      }
      if (LECT.m !== m.id) return;                                          // on a changé de morceau pendant le chargement
      $('#moLtitre').textContent = m.nom; son.src = url; await son.play();
    } catch (e) { console.error(e); msg('Lecture impossible : ' + (e.message || e)); }
  }
  // le son à écouter : la version ★ si elle est sur le Drive, sinon la plus récente du Drive (le téléphone ne voit pas les fichiers des PC)
  async function sonMobile(m) {
    const src = await BK.sonDuMorceau(m, MORCEAUX); if (src && src.drive) return src;
    const exps = BK.inv.exportsDe(m, await BK.inv.tous(), MORCEAUX).filter(x => x.drive && x.driveId);
    if (exps.length) return { drive: exps[0].driveId, nom: exps[0].nom };
    try { await BK.dossiers.assurer();
      const l = BK.trierStems(await BK.dossiers.duMorceau(m, MORCEAUX)).filter(f => !f.groupe && /\.(wav|mp3)$/i.test(f.name) && !/tournage/i.test(f.name))
        .sort((a, b) => (b.modifiedTime || '').localeCompare(a.modifiedTime || ''));
      if (l[0]) return { drive: l[0].id, nom: l[0].name }; } catch (e) { console.warn(e); }
    return null;
  }
  // télécharger le son du Drive, en montrant où on en est (les WAV sont lourds)
  async function telecharger(id, nom) {
    const r = await BK.drive.api(`/files/${id}?alt=media`), tot = +r.headers.get('content-length') || 0;
    if (!r.body || !tot) return URL.createObjectURL(await r.blob());
    const rd = r.body.getReader(), bouts = []; let n = 0;
    for (;;) { const { done, value } = await rd.read(); if (done) break; bouts.push(value); n += value.length;
      $('#moLtitre').textContent = `${nom} · ${Math.round(n / tot * 100)} %`; }
    return URL.createObjectURL(new Blob(bouts, { type: /\.mp3$/i.test(nom) ? 'audio/mpeg' : 'audio/wav' }));
  }

  // ---------- Réglages : le nom, et délier ce téléphone ----------
  function reglages(z) {
    z.innerHTML = `<div class="mo-carte">
      <span class="dymo">Qui utilise ce téléphone ?</span>
      <div class="mo-chips">${['Yacine', 'Pierre', 'Baptiste'].map(n => `<button class="chip${BK.reglage('nomPc', '') === n ? ' on' : ''}" data-nom="${n}">${n}</button>`).join('')}</div></div>
      <div class="mo-carte"><span class="dymo">Ce téléphone</span>
      <p class="mo-nt">Relié au Drive BEESKOT. Si tu le perds ou le prêtes : « Délier ».</p>
      <button class="btn sm" id="moDelier">Délier ce téléphone</button></div>`;
    z.querySelectorAll('[data-nom]').forEach(b => b.onclick = () => { BK.regler('nomPc', b.dataset.nom); reglages(z); });
    $('#moDelier').onclick = () => { if (!confirm('Délier ce téléphone du Drive BEESKOT ?')) return;
      BK.regler('drive.conf', null); Object.keys(localStorage).filter(k => k.startsWith('bk.drive.cache.')).forEach(k => localStorage.removeItem(k)); location.reload(); };
  }

  // ---------- démarrage ----------
  function demarrer() { lireLien(); if (BK.drive.relie()) { etat('…'); ouvrir(actuel); } else accueilSansCle(); }
  window.addEventListener('hashchange', () => { if (lireLien()) { msg('Téléphone relié'); demarrer(); } });
  demarrer();
})();
