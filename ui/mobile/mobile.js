// =====================================================================
// BEESKOT STUDIO MOBILE — la page pour le téléphone.
// Même base que le PC (coeur.js, donnees.js, drive.js) : mêmes fiches, même Drive.
//
//   Relier le téléphone : sur un PC, Réglages › Aide › « Relier un téléphone » → QR code
//   Le QR code ouvre cette page avec la clé dans le lien (#k=…) : la page la garde, puis l'efface du lien.
//
//   Chaque écran est un petit fichier dans mobile/ecrans/ qui s'inscrit avec BKM.ecran(id, { nom, ordre, dessiner }).
//   Ajouter un écran = ajouter un fichier + une ligne <script> dans index.html. C'est tout.
//
//   Ce que le téléphone ÉCRIT dans le Drive : cocher une tâche, les notes et réponses de Notes et retours.
//   Rien d'autre (pas de fiches morceaux, pas de tournages, pas de réglages du groupe).
// =====================================================================
window.BKM = (function () {
  const $ = s => document.querySelector(s), esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const page = $('#moPage');
  BK.etatDrive = () => {};                                   // le voyant DRIVE du PC n'existe pas ici (le nôtre : en haut à droite)
  BK.racineUi = window.BK_RACINE || '../';
  // PROTECTION : le téléphone n'écrit QUE les tâches (cocher) et les notes de Notes et retours.
  // Tout le reste (réglages du groupe, dossiers, fiches…) est bloqué ici, même si un outil partagé avec le PC essaie.
  const PERMIS = new Set(['taches', 'notesmix']);
  Object.assign(BK.annuler.NOMS, { notesmix: 'la note', taches: 'la tâche' });
  const ecrire0 = BK.db.ecrire.bind(BK.db), suppr0 = BK.db.supprimer.bind(BK.db);
  BK.db.ecrire = (col, fiche, o) => PERMIS.has(col) ? ecrire0(col, fiche, o) : (console.info('mobile : écriture bloquée (' + col + ')'), Promise.resolve(fiche));
  BK.db.supprimer = (col, id, o) => PERMIS.has(col) ? suppr0(col, id, o) : Promise.resolve();                                       // les images et bibliothèques partagées avec le PC sont un dossier plus haut
  let toastT = 0;
  const msg = t => { const e = $('#moToast'); e.textContent = t; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), 2600); };
  const moi = () => BK.reglage('nomPc', '') || 'Quelqu\'un';
  const COUL = { Yacine: '#f1c453', Pierre: '#5fb0ff', Baptiste: '#c58af0' };
  const couleur = q => COUL[q] || (/^Externe · /.test(q || '') ? '#7fc8a9' : '#d9b67a');
  const t2 = s => { s = isFinite(s) ? Math.max(0, s) : 0; return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); };
  const auj = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const dateFr = (d, o) => d ? new Date(d + 'T12:00').toLocaleDateString('fr-CA', o || { weekday: 'long', day: 'numeric', month: 'long' }) : '';

  // ---------- 0. les données : d'abord la copie déjà connue (instantané), puis le Drive en silence ----------
  // Chaque écran appelle BKM.liste(col). Si on a déjà une copie, elle s'affiche tout de suite ; le Drive est relu
  // derrière (au plus une fois par minute), et l'écran se redessine seulement si quelque chose a changé.
  const FRAIS = {}, SIG = {}, ENCOURS = {};
  let forcer = false, redessinPrevu = 0;
  const empreinte = l => l.map(f => f.id + ':' + (f.maj || '')).sort().join('|');
  function copie(col) {
    const out = {};
    if (BK.db.cache[col]) Object.assign(out, BK.db.cache[col]);
    else for (const x of Object.values(BK.drive.cacheDe(col).c)) if (x && x.fiche) out[x.fiche.id] = x.fiche;
    for (const a of BK.reglage('db.attente', [])) if (a.col === col) { if (a.suppr) delete out[a.id]; else out[a.fiche.id] = a.fiche; }
    return Object.values(out);
  }
  async function relire(col) {
    if (ENCOURS[col]) return ENCOURS[col];
    return ENCOURS[col] = BK.db.liste(col).then(l => { FRAIS[col] = Date.now(); const e = empreinte(l), change = SIG[col] !== undefined && SIG[col] !== e; SIG[col] = e; return { l, change }; })
      .finally(() => { delete ENCOURS[col]; });
  }
  async function liste(col) {
    const c = copie(col), vieux = Date.now() - (FRAIS[col] || 0) > 60e3;
    if (!forcer && c.length && !vieux) return c;
    if (!forcer && c.length) {                                                 // on affiche la copie ; le Drive arrive derrière
      if (SIG[col] === undefined) SIG[col] = empreinte(c);
      relire(col).then(r => { if (r.change) redessinDoux(); }).catch(() => {});
      return c;
    }
    return (await relire(col)).l;
  }
  // un redessin « doux » : jamais pendant qu'on écrit dans un champ, et une seule fois même si plusieurs collections changent
  function redessinDoux() {
    clearTimeout(redessinPrevu);
    redessinPrevu = setTimeout(() => { const a = document.activeElement;
      if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) { a.addEventListener('blur', redessinDoux, { once: true }); return; }
      redessiner(); }, 150);
  }

  // ---------- 1. la clé : reçue par le QR code (#k=…) ou par la carte d'accès ----------
  function garderCle(j) {
    const c = { client_id: j.client_id || j.i, client_secret: j.client_secret || j.s, refresh_token: j.refresh_token || j.r };
    if (!c.client_id || !c.client_secret || !c.refresh_token) throw new Error('Clé incomplète');
    BK.regler('drive.conf', c); BK.drive.jeton = null;
  }
  // la clé dans un lien : après le # (page web) ou dans ?k= (lien beeskot://relier ouvert par l'appli)
  function cleDe(url) { const m = String(url || '').match(/[#?&]k=([A-Za-z0-9_-]+)/); return m ? m[1] : ''; }
  function relierDepuis(k) {
    try { const b = k.replace(/-/g, '+').replace(/_/g, '/'); const txt = decodeURIComponent(escape(atob(b + '==='.slice((b.length + 3) % 4))));
      garderCle(JSON.parse(txt)); return true; }
    catch (e) { msg('Ce QR code n\'est pas valide'); return false; }
  }
  function lireLien() {
    const k = cleDe(location.hash) || cleDe(location.search); if (!k) return false;
    history.replaceState(null, '', location.pathname);                            // la clé ne reste pas dans le lien (ni dans l'historique)
    return relierDepuis(k);
  }
  // la clé de ce téléphone, encodée comme sur le PC (pour la passer de Chrome à l'appli)
  const cleEncodee = () => { const c = BK.drive.conf() || {}; const j = JSON.stringify({ i: c.client_id, s: c.client_secret, r: c.refresh_token });
    return btoa(unescape(encodeURIComponent(j))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const LIEN_APK = 'https://github.com/beeskotmusic-cmd/beeskot-studio/releases/download/mobile/BEESKOT-Studio-Mobile.apk';
  // Chrome → l'appli Android (si elle n'est pas installée, Chrome propose de télécharger l'APK)
  function ouvrirDansAppli() {
    location.href = 'intent://relier?k=' + cleEncodee() + '#Intent;scheme=beeskot;package=com.beeskot.studio;S.browser_fallback_url=' + encodeURIComponent(LIEN_APK) + ';end';
  }

  // ---------- 2. les écrans (chaque fichier de mobile/ecrans/ s'inscrit ici) ----------
  const ECRANS = {};
  let actuel = BK.reglage('mobile.ecran', 'biblio'), tourEcran = 0;
  const ecran = (id, e) => { ECRANS[id] = { ordre: 50, ...e }; };
  const ecransTries = () => Object.entries(ECRANS).sort((a, b) => a[1].ordre - b[1].ordre);

  function menu() {
    $('#moMenu').innerHTML = `<img class="mo-menu-logo" src="../look/logo-beeskot-studio.png" alt="">`
      + ecransTries().map(([id, e]) => `<button class="mo-tab${id === actuel ? ' on' : ''}" data-e="${id}"><span>${esc(e.nom)}</span></button>`).join('')
      + `<span class="mo-ver">${esc(BK.version || '')} · mobile${BK.reglage('nomPc', '') ? ' · ' + esc(BK.reglage('nomPc', '')) : ''}</span>`;
    $('#moMenu').querySelectorAll('[data-e]').forEach(b => b.onclick = () => { ouvrir(b.dataset.e); volet(false); });
  }
  const volet = o => { document.body.classList.toggle('menu-ouvert', o); $('#moMenu').setAttribute('aria-hidden', o ? 'false' : 'true'); };
  $('#moBurger').onclick = () => volet(!document.body.classList.contains('menu-ouvert'));
  $('#moVoile').onclick = () => volet(false);

  // ouvre un écran ; « plus » est passé à l'écran (ex. ouvrir directement un tournage).
  // Si c'est le même écran (un redessin), la page garde sa hauteur et sa position : rien ne saute, rien ne clignote.
  async function ouvrir(id, plus) {
    if (!BK.drive.relie()) return accueilSansCle();
    const nouveau = (ECRANS[id] ? id : 'biblio') !== actuel || !page.querySelector('#moCorps');
    actuel = ECRANS[id] ? id : 'biblio'; BK.regler('mobile.ecran', actuel); menu();
    const tour = ++tourEcran;
    if (nouveau) { page.innerHTML = `<h1 class="mo-titre">${esc(ECRANS[actuel].nom)}</h1><div id="moCorps"></div>`; window.scrollTo(0, 0); }
    else page.style.minHeight = page.offsetHeight + 'px';
    const corps = $('#moCorps');
    const attente = setTimeout(() => { if (tour === tourEcran && !corps.children.length) corps.innerHTML = '<p class="mo-nt mo-entre">Chargement…</p>'; }, 350);   // seulement si ça dure
    try { await ECRANS[actuel].dessiner(corps, plus || {}, () => tour === tourEcran); }
    catch (e) { console.error(e); if (tour === tourEcran) corps.innerHTML = `<p class="mo-nt">Impossible de lire le Drive : ${esc(e.message || e)}</p>`; }
    clearTimeout(attente);
    if (tour === tourEcran) { page.style.minHeight = ''; etat(BK.db.enLigne ? 'RELIÉ' : 'HORS LIGNE', BK.db.enLigne); }
  }
  // dans Chrome (pas dans l'appli) : proposer une fois d'ouvrir l'appli Android avec cette clé
  function proposerAppli() {
    if (enAppli || !BK.drive.relie() || BK.reglage('mobile.appliVue', false) || document.getElementById('moAppli')) return;
    const b = document.createElement('div'); b.id = 'moAppli'; b.className = 'mo-bandeau mo-entre';
    b.innerHTML = `<span>Tu as l'appli Android BEESKOT ?</span><button class="btn sm" data-o>Ouvrir dedans</button><button class="mo-x" data-x aria-label="Fermer">✕</button>`;
    page.before(b);
    b.querySelector('[data-o]').onclick = () => { ouvrirDansAppli(); };
    b.querySelector('[data-x]').onclick = () => { BK.regler('mobile.appliVue', true); b.remove(); };
  }
  const redessiner = () => ouvrir(actuel);
  // ↻ : relire le Drive maintenant (fiches ET fichiers), quel que soit l'âge de la copie
  $('#moRelire').onclick = async () => {
    const b = $('#moRelire'); if (b.classList.contains('tourne')) return;
    b.classList.add('tourne'); forcer = true; BK.dossiers.oublier && BK.dossiers.oublier();
    try { await ouvrir(actuel); msg('Drive relu'); } finally { forcer = false; b.classList.remove('tourne'); }
  };
  function etat(t, ok) { const e = $('#moEtat'); e.textContent = t; e.classList.toggle('ok', !!ok); }

  // ---------- pas encore relié ----------
  function accueilSansCle() {
    etat('NON RELIÉ'); $('#moMenu').innerHTML = `<img class="mo-menu-logo" src="../look/logo-beeskot-studio.png" alt=""><span class="mo-nt">Relie d'abord ce téléphone.</span>`;
    page.innerHTML = `<div class="mo-carte mo-relier">
      <span class="dymo">Relier ce téléphone</span>
      <p>Sur un PC du groupe : <b>Réglages › Aide › BEESKOT Studio Mobile › Relier un téléphone</b>.</p>
      <p>Scanne le QR code avec l'appareil photo du téléphone${enAppli ? ' : la page s\'ouvre dans Chrome, puis appuie sur <b>« Ouvrir dedans »</b> pour revenir ici, relié' : ' : cette page s\'ouvre, déjà reliée au Drive BEESKOT'}.</p>
      <p class="mo-nt">Autre façon : importer la carte d'accès (le petit fichier fait sur le PC).</p>
      <label class="btn sm">Importer la carte d'accès<input type="file" id="moCarte" accept=".json,application/json" hidden></label></div>`;
    $('#moCarte').onchange = async e => { const f = e.target.files[0]; if (!f) return;
      try { const j = JSON.parse(await f.text()); if (j.type && j.type !== 'carte-acces-beeskot') throw 0; garderCle(j); msg('Téléphone relié'); demarrer(); }
      catch (er) { msg('Ce n\'est pas une carte d\'accès BEESKOT'); } };
  }

  // ---------- 3. les sons : seulement ceux du Drive (le téléphone ne voit pas les fichiers des PC) ----------
  // toutes les versions d'un morceau qu'on peut écouter ici : { v: 'drive:ID', id, nom, t, princ }
  async function versions(m, morceaux) {
    const out = [], vus = new Set(), ajout = (id, nom, t, princ) => { if (!id || vus.has(id)) return; vus.add(id); out.push({ v: 'drive:' + id, id, nom, t: t || '', princ: !!princ }); };
    try { BK.inv.exportsDe(m, await BK.inv.tous(), morceaux).filter(f => f.drive && f.driveId).forEach(f => ajout(f.driveId, f.nom, f.modif, f.chemin === m.exportPrincipal)); } catch (e) { console.warn(e); }
    try { await BK.dossiers.assurer();
      BK.trierStems(await BK.dossiers.duMorceau(m, morceaux)).filter(f => !f.groupe && /\.(wav|mp3|m4a|aiff?|flac)$/i.test(f.name) && !/tournage|reel/i.test(f.name))
        .sort((a, b) => (b.modifiedTime || '').localeCompare(a.modifiedTime || '')).forEach(f => ajout(f.id, f.name, f.modifiedTime)); } catch (e) { console.warn(e); }
    return out.sort((a, b) => b.princ - a.princ);                  // la ★ en premier, puis dans l'ordre trouvé (fiche, puis Drive du plus récent au plus ancien)
  }
  // la version à écouter par défaut : la ★, sinon la plus récente
  async function sonDe(m, morceaux) { const l = await versions(m, morceaux); return l[0] || null; }

  // télécharger un son du Drive une seule fois, en montrant où on en est (les WAV sont lourds)
  const sons = {};
  function telecharger(id, nom, progres) {
    if (sons[id]) return sons[id];
    return sons[id] = (async () => {
      const r = await BK.drive.api(`/files/${id}?alt=media`), tot = +r.headers.get('content-length') || 0;
      const type = /\.mp3$/i.test(nom || '') ? 'audio/mpeg' : /\.m4a$/i.test(nom || '') ? 'audio/mp4' : 'audio/wav';
      if (!r.body || !tot) return URL.createObjectURL(new Blob([await r.arrayBuffer()], { type }));
      const rd = r.body.getReader(), bouts = []; let n = 0;
      for (;;) { const { done, value } = await rd.read(); if (done) break; bouts.push(value); n += value.length; progres && progres(Math.round(n / tot * 100)); }
      return URL.createObjectURL(new Blob(bouts, { type }));
    })().catch(e => { delete sons[id]; throw e; });
  }

  // ---------- 4. le lecteur en bas de l'écran (un seul son à la fois, pour toute l'appli) ----------
  const son = new Audio(); son.preload = 'auto';
  const L = { cle: '', titre: '', fin: 0, ecouteurs: new Set() };
  let glisse = false;
  function majLecteur() {
    $('#moLp').textContent = son.paused ? '▶' : '❚❚';
    $('#moLtemps').textContent = t2(son.currentTime) + ' / ' + t2(son.duration);
    if (!glisse) $('#moLpos').value = son.duration ? Math.round(son.currentTime / son.duration * 1000) : 0;
    L.ecouteurs.forEach(f => { try { f(L.cle, son); } catch (e) {} });
  }
  ['timeupdate', 'play', 'pause', 'loadedmetadata', 'ended'].forEach(e => son.addEventListener(e, majLecteur));
  son.addEventListener('timeupdate', () => { if (L.fin && son.currentTime >= L.fin) { son.pause(); L.fin = 0; } });
  $('#moLp').onclick = () => son.src && (son.paused ? son.play() : son.pause());
  $('#moLpos').oninput = () => { glisse = true; };
  $('#moLpos').onchange = e => { glisse = false; if (son.duration) son.currentTime = e.target.value / 1000 * son.duration; };

  // lire({ cle, titre, id: drive id, nom, debut, fin }) — 2e appui sur la même chose : pause
  async function lire(o) {
    if (L.cle === o.cle && son.src && o.debut == null) { son.paused ? son.play() : son.pause(); return; }
    son.pause(); L.cle = o.cle; L.titre = o.titre; L.fin = o.fin || 0;
    $('#moLecteur').hidden = false; document.body.classList.add('avec-lecteur'); $('#moLtitre').textContent = o.titre; majLecteur();
    try {
      const url = await telecharger(o.id, o.nom, p => { if (L.cle === o.cle) $('#moLtitre').textContent = `${o.titre} · ${p} %`; });
      if (L.cle !== o.cle) return;                                         // on a changé d'avis pendant le chargement
      $('#moLtitre').textContent = o.titre;
      if (son.src !== url) son.src = url;
      if (o.debut != null) { if (!son.duration) await new Promise(ok => son.addEventListener('loadedmetadata', ok, { once: true })); son.currentTime = o.debut; }
      await son.play();
    } catch (e) { console.error(e); msg('Lecture impossible : ' + (e.message || e)); }
  }
  const aller = s => { if (son.src) { son.currentTime = Math.max(0, s); son.play(); } };

  // ---------- dans l'appli Android (l'enveloppe Capacitor charge cette page) ----------
  const enAppli = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  if (enAppli) document.documentElement.classList.add('appli');
  // le bouton Retour du téléphone : ferme le menu ou l'image en grand, revient à la Bibliothèque, puis quitte
  try { const App = enAppli && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (App) { App.getLaunchUrl().then(r => { const k = r && cleDe(r.url); if (k && relierDepuis(k)) { msg('Téléphone relié'); demarrer(); } }).catch(() => {});
      App.addListener('appUrlOpen', r => { const k = cleDe(r && r.url); if (k && relierDepuis(k)) { msg('Téléphone relié'); demarrer(); } }); }
    if (App) App.addListener('backButton', () => {
      const z = document.querySelector('.mo-zoom'); if (z) return z.remove();
      if (document.body.classList.contains('menu-ouvert')) return volet(false);
      if (actuel !== 'biblio' && BK.drive.relie()) return ouvrir('biblio');
      App.exitApp(); }); } catch (e) { console.warn(e); }

  // ---------- démarrage ----------
  window.addEventListener('bk:annule', () => redessiner());               // « ↶ Annuler » : on relit l'écran
  window.addEventListener('hashchange', () => { if (lireLien()) { msg('Téléphone relié'); demarrer(); } });
  function demarrer() { lireLien(); if (BK.drive.relie()) { etat('…'); ouvrir(ECRANS[actuel] ? actuel : 'biblio'); proposerAppli(); } else accueilSansCle(); }

  return { $, esc, msg, moi, couleur, t2, auj, dateFr, ecran, ouvrir, redessiner, liste, enAppli, ouvrirDansAppli, versions, sonDe, telecharger, lire, aller, son, L, demarrer,
    get actuel() { return actuel; } };
})();
