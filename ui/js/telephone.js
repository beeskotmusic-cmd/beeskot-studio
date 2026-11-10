// =====================================================================
// LE MODE TÉLÉPHONE — le MÊME logiciel que sur le PC, rangé pour un petit écran.
// Il n'y a plus d'écrans « mobile » à part : chaque onglet du PC s'affiche tel quel, en une colonne.
//
//   Où ça se règle :
//     - ce fichier            : ce qui change de comportement (menu tiroir, relier par QR code, bouton Retour, onglets retirés)
//     - style/telephone.css   : toute la mise en page téléphone (rien d'autre : le PC ne lit jamais ces règles)
//     - SANS_TELEPHONE        : la liste des onglets qu'on n'affiche pas sur le téléphone (une ligne à changer)
//
//   Quand est-ce que ça s'allume : jamais dans le .exe. Seulement dans un navigateur, si l'écran est petit,
//   si le lien finit par ?tel=1, ou dans l'appli Android (l'enveloppe qui ouvre cette page).
//   Tout le CSS est sous « html.tel » : sans cette classe, rien ne bouge.
// =====================================================================
(() => {
  const dansExe = !!window.__TAURI__;
  const enAppli = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const demande = /[?&]tel=1/.test(location.search), refuse = /[?&]tel=0/.test(location.search);
  const petit = window.matchMedia && matchMedia('(max-width: 820px)').matches;
  if (dansExe || refuse || !(demande || enAppli || petit)) return;

  // ---------- les onglets qu'on ne montre pas sur le téléphone ----------
  //   lighttoast : choix de Dari.  mixprep (Ableton Live) : il a besoin de l'Ableton d'un PC, rien ne marche sur un téléphone.
  const SANS_TELEPHONE = ['lighttoast', 'mixprep'];
  // ---------- les touches du clavier qui servent dans un onglet : des boutons flottants les remplacent ----------
  //   espace = lecture / caler une phrase · maj = choisir une suite, une période · ctrl = en choisir plusieurs
  const TOUCHES = { ecoute: ['espace'], notesvid: ['espace'], reels: ['espace'], reelvis: ['espace'], agenda: ['maj'], medias: ['ctrl', 'maj'] };
  // ---------- les phrases d'aide écrites pour la souris, dites pour le doigt (appliqué aux petites lignes d'aide) ----------
  const MOTS = [
    [/clic droit/g, 'appui long'], [/Clic droit/g, 'Appui long'], [/molette/g, 'pincer'], [/double-clic/g, 'double appui'], [/Double-clic/g, 'Double appui'],
    [/Maj ?\+ ?clic/g, 'bouton Maj + appui'], [/Ctrl ?\+ ?clic/g, 'bouton Ctrl + appui'], [/glisse la souris/g, 'glisse le doigt'], [/\bClic = /g, 'Appui = '],
    [/(?<!bouton )\bEspace\b/g, 'bouton Espace'], [/ · Tab = A\/B/g, ''],
    [/\b[Cc]e PC\b/g, m => m[0] === 'C' ? 'Ce téléphone' : 'ce téléphone'], [/cet ordinateur/g, 'ce téléphone'],
  ];

  window.BK_MOBILE = true;
  const H = document.documentElement; H.classList.add('tel'); if (enAppli) H.classList.add('appli');
  const $ = s => document.querySelector(s);
  const vp = document.querySelector('meta[name=viewport]'); if (vp) vp.content = 'width=device-width, initial-scale=1, viewport-fit=cover';
  for (const [n, c] of [['theme-color', '#2b1b11'], ['color-scheme', 'dark']]) { const m = document.createElement('meta'); m.name = n; m.content = c; document.head.appendChild(m); }
  const man = document.createElement('link'); man.rel = 'manifest'; man.href = 'mobile/manifest.json'; document.head.appendChild(man);

  // ---------- 1. la clé du Drive : reçue par le QR code du PC (#k=…), un lien collé ou la carte d'accès ----------
  const garderCle = j => {
    const c = { client_id: j.client_id || j.i, client_secret: j.client_secret || j.s, refresh_token: j.refresh_token || j.r };
    if (!c.client_id || !c.client_secret || !c.refresh_token) throw new Error('Clé incomplète');
    BK.regler('drive.conf', c); if (BK.drive) BK.drive.jeton = null;
  };
  const cleDe = url => { const m = String(url || '').match(/[#?&]k=([A-Za-z0-9_-]+)/); return m ? m[1] : ''; };
  const relierDepuis = k => {
    try { const b = k.replace(/-/g, '+').replace(/_/g, '/'); garderCle(JSON.parse(decodeURIComponent(escape(atob(b + '==='.slice((b.length + 3) % 4)))))); return true; }
    catch (e) { return false; }
  };
  // la clé ne reste jamais dans le lien (ni dans l'historique)
  const lireLien = () => { const k = cleDe(location.hash) || cleDe(location.search); if (!k) return false;
    history.replaceState(null, '', location.pathname + (demande ? '?tel=1' : '')); return relierDepuis(k); };
  const relie = () => { const c = BK.reglage('drive.conf', null); return !!(c && c.refresh_token); };

  // ---------- 2. pas encore relié : on n'ouvre PAS le logiciel (rien ne doit s'écrire sur le téléphone avant le Drive) ----------
  function ecranRelier() {
    document.body.classList.add('tel-relier');
    const v = document.createElement('div'); v.className = 'tel-porte';
    v.innerHTML = `<img class="tel-porte-logo" src="look/logo-beeskot-studio.png" alt="BEESKOT Studio">
      <div class="tel-carte">
        <span class="dymo">Relier ce téléphone</span>
        <p>Sur un PC du groupe : <b>Réglages › BEESKOT Mobile › Lier au téléphone</b>. Un QR code s'affiche.</p>
        <button class="btn pri tel-gros" id="telScanner">Scanner le QR code du PC</button>
        <p class="nt">La caméra s'ouvre ici. Vise le QR code : c'est relié tout seul.</p>
        <details><summary>Ça ne marche pas ?</summary>
          <p class="nt">Colle ici le lien « Relier » (sur le PC : bouton « Copier le lien ») :</p>
          <div class="tel-ligne"><input class="fld" id="telLien" placeholder="https://…#k=…" autocomplete="off" spellcheck="false"><button class="btn sm" id="telLienOk">Relier</button></div>
          <p class="nt">Ou importe la carte d'accès (le petit fichier fait sur le PC).</p>
          <label class="btn sm">Importer la carte d'accès<input type="file" id="telCarte" accept=".json,application/json" hidden></label>
        </details>
        <p class="nt" id="telPorteMsg" role="status"></p>
      </div>`;
    document.body.appendChild(v);
    const dire = t => { $('#telPorteMsg').textContent = t; }, fait = () => { dire('Téléphone relié'); location.reload(); };
    $('#telScanner').onclick = () => scanner(txt => { const k = cleDe(txt); if (!k || !relierDepuis(k)) return false; fait(); return true; }, dire);
    $('#telLienOk').onclick = () => { const k = cleDe($('#telLien').value.trim()); if (!k) return dire('Ce lien n\'est pas un lien « Relier »'); relierDepuis(k) ? fait() : dire('Ce lien n\'est pas valide'); };
    $('#telCarte').onchange = async e => { const f = e.target.files[0]; if (!f) return;
      try { const j = JSON.parse(await f.text()); if (j.type && j.type !== 'carte-acces-beeskot') throw 0; garderCle(j); fait(); } catch (er) { dire('Ce n\'est pas une carte d\'accès BEESKOT'); } };
  }

  // ---------- le scanner de QR code (caméra arrière, dans la page) ----------
  let jsqrPret = null;
  const chargerJsqr = () => jsqrPret || (jsqrPret = new Promise((ok, non) => { if (window.jsQR) return ok();
    const s = document.createElement('script'); s.src = 'mobile/lib/jsQR.js'; s.onload = ok; s.onerror = () => { jsqrPret = null; non(new Error('Lecteur de QR non chargé')); }; document.head.appendChild(s); }));
  async function scanner(trouve, dire) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return dire('Pas de caméra disponible ici');
    const v = document.createElement('div'); v.className = 'tel-scan';
    v.innerHTML = `<video playsinline muted autoplay></video><div class="tel-scan-cadre"></div><p class="tel-scan-txt">Vise le QR code affiché sur le PC</p><button class="btn sm tel-scan-x" id="telScanX">Annuler</button>`;
    document.body.appendChild(v);
    const video = v.querySelector('video'), txt = v.querySelector('.tel-scan-txt'); let flux = null, fini = false, boucle = 0;
    const fermer = () => { if (fini) return; fini = true; cancelAnimationFrame(boucle); if (flux) flux.getTracks().forEach(t => t.stop()); v.remove(); };
    v.querySelector('#telScanX').onclick = fermer;
    try {
      const [, f] = await Promise.all([chargerJsqr(), navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })]);
      if (fini) { f.getTracks().forEach(t => t.stop()); return; }
      flux = f; video.srcObject = f; await video.play();
    } catch (e) { fermer(); return dire(/denied|permission|NotAllowed/i.test(e.name + e.message) ? 'Autorise la caméra pour scanner (Réglages du téléphone › Applis › BEESKOT)' : 'Caméra impossible : ' + (e.message || e)); }
    const c = document.createElement('canvas'), ctx = c.getContext('2d', { willReadFrequently: true }); let dernier = 0;
    const lire = t => { if (fini) return; boucle = requestAnimationFrame(lire);
      if (t - dernier < 120 || video.readyState < 2) return; dernier = t;                 // ~8 lectures par seconde : le téléphone ne chauffe pas
      const w = video.videoWidth, h = video.videoHeight; if (!w) return;
      const s = Math.min(w, h) * .7, x = (w - s) / 2, y = (h - s) / 2;
      c.width = c.height = 400; ctx.drawImage(video, x, y, s, s, 0, 0, 400, 400);
      const r = window.jsQR(ctx.getImageData(0, 0, 400, 400).data, 400, 400, { inversionAttempts: 'dontInvert' });
      if (!r || !r.data) return;
      if (trouve(r.data)) { v.classList.add('ok'); setTimeout(fermer, 250); } else txt.textContent = 'Ce n\'est pas le QR code « Lier au téléphone »'; };
    boucle = requestAnimationFrame(lire);
  }

  // ---------- 3. le menu : un tiroir qui glisse depuis la gauche (bouton en haut à gauche) ----------
  const tiroir = o => { document.body.classList.toggle('tel-menu', !!o); const b = $('#telBurger'); if (b) b.setAttribute('aria-expanded', o ? 'true' : 'false'); };
  function habiller() {
    const top = $('header.top'), side = $('.side'); if (!top || !side || $('#telBurger')) return;
    const b = document.createElement('button'); b.id = 'telBurger'; b.className = 'tel-burger'; b.setAttribute('aria-label', 'Menu'); b.innerHTML = '<i></i><i></i><i></i>';
    top.prepend(b); b.onclick = () => tiroir(!document.body.classList.contains('tel-menu'));
    const voile = document.createElement('div'); voile.className = 'tel-voile'; voile.onclick = () => tiroir(false); side.before(voile);          // dans la même couche que le menu, juste dessous
    // les afficheurs du bandeau (Drive, qui est en ligne, version) descendent dans le tiroir : le bandeau reste petit
    const sys = $('.sysgrid'); if (sys) side.appendChild(sys);
    side.addEventListener('click', e => { if (e.target.closest('.tab,.sy-pc')) tiroir(false); });
    // glisser depuis le bord gauche ouvre le menu ; glisser vers la gauche le referme
    let x0 = null, y0 = 0;
    document.addEventListener('touchstart', e => { const t = e.touches[0]; x0 = (t.clientX < 22 || document.body.classList.contains('tel-menu')) ? t.clientX : null; y0 = t.clientY; }, { passive: true });
    document.addEventListener('touchend', e => { if (x0 === null) return; const t = e.changedTouches[0], dx = t.clientX - x0, dy = Math.abs(t.clientY - y0); const ouvert = document.body.classList.contains('tel-menu');
      if (!ouvert && dx > 60 && dy < 50) tiroir(true); else if (ouvert && dx < -60 && dy < 50) tiroir(false); x0 = null; }, { passive: true });
  }

  // le fil du groupe et « tout replier » quittent le bandeau (trop serré) pour le haut du menu, avec leur nom
  function ranger() {
    const side = $('.side'), nav = $('#nav'); if (!side || !nav || $('.tel-outils')) return;
    const z = document.createElement('div'); z.className = 'tel-outils';
    for (const [id, nom] of [['btFil', 'Fil du groupe'], ['btPlier', 'Tout replier']]) { const b = document.getElementById(id); if (!b) continue;
      const l = document.createElement('div'); l.className = 'tel-outil'; l.append(b); const s = document.createElement('span'); s.textContent = nom; l.append(s);
      l.addEventListener('click', e => { if (!e.target.closest('button')) b.click(); tiroir(false); }); z.append(l); }
    if (z.children.length) side.insertBefore(z, nav);
  }

  // ---------- 4. le bouton Retour d'Android : ferme ce qui est ouvert, revient à l'Accueil, puis quitte ----------
  function retour() {
    const sc = $('#telScanX'); if (sc) return sc.click(), true;
    if (document.body.classList.contains('tel-menu')) return tiroir(false), true;
    const voiles = [...document.querySelectorAll('.voile:not(.hidden)')].filter(v => v.offsetParent !== null || getComputedStyle(v).position === 'fixed');
    const v = voiles[voiles.length - 1];
    if (v) { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      setTimeout(() => { if (v.isConnected && !v.classList.contains('hidden')) v.id ? v.classList.add('hidden') : v.remove(); }, 60); return true; }
    if (BK.reglage('dernierOnglet', 'accueil') !== 'accueil') return BK.ouvrir('accueil'), true;
    return false;
  }
  try { const App = enAppli && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (App) { const recu = r => { const k = cleDe(r && r.url); if (k && relierDepuis(k)) location.reload(); };
      App.getLaunchUrl().then(recu).catch(() => {}); App.addListener('appUrlOpen', recu);
      App.addListener('backButton', () => { if (!retour()) App.exitApp(); }); } } catch (e) { console.warn(e); }

  // ---------- 5. les gestes : ce que la souris et le clavier font sur le PC, au doigt ----------
  // a) les boutons flottants « Espace / Maj / Ctrl » (seulement dans les onglets qui s'en servent : voir TOUCHES)
  const tenu = { maj: false, ctrl: false };
  function barreTouches() {
    let b = $('#telTouches'); if (!b) { b = document.createElement('div'); b.id = 'telTouches'; b.className = 'tel-touches'; document.body.appendChild(b);
      b.addEventListener('click', e => { const t = e.target.closest('[data-t]'); if (!t) return; const k = t.dataset.t;
        if (k === 'espace') { for (const n of ['keydown', 'keyup']) document.body.dispatchEvent(new KeyboardEvent(n, { key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true, cancelable: true })); return; }
        tenu[k] = !tenu[k]; t.classList.toggle('on', tenu[k]); t.setAttribute('aria-pressed', tenu[k]); }); }
    const choix = document.querySelector('.voile:not(.hidden) #mdChN');                 // la fenêtre « Choisir dans Médias » (ouverte depuis n'importe quel onglet)
    const l = choix ? ['ctrl', 'maj'] : (TOUCHES[BK.reglage('dernierOnglet', 'accueil')] || []);
    const cle = l.join(); if (b.dataset.l === cle) return; b.dataset.l = cle; tenu.maj = tenu.ctrl = false;
    const NOM = { espace: ['Espace', 'Comme la barre d\'espace : lecture, ou caler une phrase'], maj: ['Maj', 'Allumé : l\'appui suivant choisit toute la suite (ou une période)'], ctrl: ['Ctrl', 'Allumé : chaque appui en ajoute un au choix'] };
    b.innerHTML = l.map(k => `<button type="button" data-t="${k}" aria-label="${NOM[k][1]}"${k === 'espace' ? '' : ' aria-pressed="false"'}>${NOM[k][0]}</button>`).join(''); b.hidden = !l.length;
  }
  // Maj / Ctrl allumés : l'appui est rejoué comme un clic avec la touche tenue
  document.addEventListener('click', e => { if (!e.isTrusted || !(tenu.maj || tenu.ctrl) || e.target.closest('.tel-touches, .tel-burger, .side')) return;
    e.preventDefault(); e.stopImmediatePropagation();
    e.target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, clientX: e.clientX, clientY: e.clientY, shiftKey: tenu.maj, ctrlKey: tenu.ctrl })); }, true);

  // b) deux appuis rapides = double-clic (si le téléphone ne l'envoie pas lui-même)
  let dernierAppui = { t: 0, x: 0, y: 0, el: null }, dblVu = 0;
  document.addEventListener('dblclick', e => { if (e.isTrusted) dblVu = Date.now(); }, true);
  document.addEventListener('click', e => { if (!e.isTrusted) return; const n = Date.now(), d = dernierAppui;
    if (n - d.t < 350 && Math.abs(e.clientX - d.x) < 30 && Math.abs(e.clientY - d.y) < 30 && d.el === e.target) { const el = e.target, x = e.clientX, y = e.clientY; dernierAppui = { t: 0 };
      setTimeout(() => { if (Date.now() - dblVu > 400 && el.isConnected) el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y })); }, 60); }
    else dernierAppui = { t: n, x: e.clientX, y: e.clientY, el: e.target }; }, true);

  // c) pincer avec deux doigts = la molette (zoom de la forme d'onde, du recadrage, de la Storyline, de la visionneuse)
  let pince = 0;
  const ecart = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  document.addEventListener('touchstart', e => { pince = e.touches.length === 2 ? ecart(e.touches) : 0; }, { passive: true });
  document.addEventListener('touchmove', e => { if (!pince || e.touches.length !== 2) return; const d = ecart(e.touches); if (Math.abs(d - pince) < 14) return;
    const x = (e.touches[0].clientX + e.touches[1].clientX) / 2, y = (e.touches[0].clientY + e.touches[1].clientY) / 2, el = document.elementFromPoint(x, y);
    if (el) el.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, deltaY: d > pince ? -100 : 100, deltaMode: 0 })); pince = d; }, { passive: true });

  // d) glisser-déposer au doigt : appui tenu sans bouger (0,3 s), puis glisser. Si le téléphone sait le faire tout seul, on le laisse faire.
  let natif = false, g = null;
  document.addEventListener('dragstart', e => { if (e.isTrusted) { natif = true; finGlisse(false); } }, true);
  const sous = (x, y) => { if (g && g.fantome) g.fantome.style.display = 'none'; const el = document.elementFromPoint(x, y); if (g && g.fantome) g.fantome.style.display = ''; return el; };
  const envoi = (el, type, x, y) => { if (!el) return true; const ev = new DragEvent(type, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, dataTransfer: g.dt }); return el.dispatchEvent(ev); };
  function finGlisse(lache, x, y) {
    if (!g) return; clearTimeout(g.minuteur);
    if (g.actif) { if (lache && g.cible) envoi(g.cible, 'drop', x, y); else if (g.cible) envoi(g.cible, 'dragleave', x, y);
      envoi(g.el, 'dragend', x || 0, y || 0); if (g.fantome) g.fantome.remove(); document.body.classList.remove('tel-glisse'); }
    g = null;
  }
  document.addEventListener('touchstart', e => { finGlisse(false); if (natif || e.touches.length !== 1) return;
    const el = e.target.closest && e.target.closest('[draggable="true"]'); if (!el || e.target.closest('input,textarea,select')) return;
    const t = e.touches[0]; g = { el, x: t.clientX, y: t.clientY, arme: false, actif: false, cible: null, dt: null };
    g.minuteur = setTimeout(() => { if (g) { g.arme = true; if (navigator.vibrate) try { navigator.vibrate(12); } catch (er) {} } }, 300); }, { passive: true });
  document.addEventListener('touchmove', e => { if (!g) return; const t = e.touches[0], dx = t.clientX - g.x, dy = t.clientY - g.y;
    if (!g.actif) { if (Math.hypot(dx, dy) < 8) return; if (!g.arme) return finGlisse(false);              // on a bougé avant la fin de l'appui tenu : c'est un défilement
      try { g.dt = new DataTransfer(); } catch (er) { return finGlisse(false); }
      g.actif = true; if (!envoi(g.el, 'dragstart', g.x, g.y)) return finGlisse(false);
      const r = g.el.getBoundingClientRect(), f = g.el.cloneNode(true); f.className += ' tel-fantome'; f.removeAttribute('id');
      Object.assign(f.style, { position: 'fixed', left: '0', top: '0', width: Math.min(r.width, 220) + 'px', height: Math.min(r.height, 160) + 'px', pointerEvents: 'none', zIndex: 90, opacity: '.82', overflow: 'hidden' });
      g.fantome = f; g.dox = Math.min(g.x - r.left, 110); g.doy = Math.min(g.y - r.top, 80); document.body.appendChild(f); document.body.classList.add('tel-glisse'); }
    e.preventDefault();                                                                                   // la page ne défile pas pendant qu'on transporte
    g.fantome.style.transform = `translate(${t.clientX - g.dox}px,${t.clientY - g.doy}px)`;
    const c = sous(t.clientX, t.clientY); if (c !== g.cible) { if (g.cible) envoi(g.cible, 'dragleave', t.clientX, t.clientY); g.cible = c; envoi(c, 'dragenter', t.clientX, t.clientY); }
    envoi(c, 'dragover', t.clientX, t.clientY);
    const m = $('#pages'); if (m) { if (t.clientY > innerHeight - 70) m.scrollTop += 14; else if (t.clientY < 110) m.scrollTop -= 14; }   // près du bord : la page suit
  }, { passive: false });
  document.addEventListener('touchend', e => { if (!g) return; const t = e.changedTouches[0]; const actif = g.actif; finGlisse(true, t.clientX, t.clientY); if (actif) e.preventDefault(); }, { passive: false });
  document.addEventListener('touchcancel', () => finGlisse(false), { passive: true });
  document.addEventListener('contextmenu', e => { if (g && g.actif) e.preventDefault(); else if (g) finGlisse(false); }, true);   // appui long sans bouger : le menu, pas le transport

  // e) les phrases d'aide : « clic droit » → « appui long », etc. (voir MOTS), sur l'onglet affiché et les fenêtres ouvertes
  let motsPrevu = 0;
  function mots() {
    const zones = [document.querySelector('#pages > section:not(.hidden)'), ...document.querySelectorAll('.voile:not(.hidden)')].filter(Boolean);
    for (const z of zones) { for (const el of z.querySelectorAll('.nt, .eng, .vfd, .lb, .rg-tabs button, summary, .dymo')) for (const n of el.childNodes) { if (n.nodeType !== 3 || !n.nodeValue.trim()) continue;
        let v = n.nodeValue; for (const [a, b] of MOTS) v = v.replace(a, b); if (v !== n.nodeValue) n.nodeValue = v; }
      for (const el of z.querySelectorAll('[placeholder]')) { let v = el.placeholder; for (const [a, b] of MOTS) v = v.replace(a, b); if (v !== el.placeholder) el.placeholder = v; } }
  }
  const motsBientot = () => { if (motsPrevu) return; motsPrevu = setTimeout(() => { motsPrevu = 0; mots(); barreTouches(); }, 500); };   // au plus 2 fois par seconde, même pendant une lecture

  // f) un morceau déjà écouté reste sur le téléphone : il repart tout de suite, même sans réseau (400 Mo au plus, les plus anciens sortent)
  function garderLesSons() {
    if (!BK.drive || !BK.drive.telecharger || !window.caches) return;
    const CACHE = 'beeskot-sons', MAX = 400e6, GROS = 120e6, cle = id => 'https://beeskot.local/son/' + encodeURIComponent(id);
    const liste = () => BK.reglage('tel.sons', {}) || {}, t0 = BK.drive.telecharger.bind(BK.drive);
    BK.drive.telecharger = async id => {
      let frais = null; try { frais = await (await BK.drive.api(`/files/${id}?fields=modifiedTime,size`)).json(); } catch (e) {}
      const l = liste(), connu = l[id];
      if (connu && (!frais || frais.modifiedTime === connu.t)) { try { const r = await (await caches.open(CACHE)).match(cle(id));
          if (r) { connu.q = Date.now(); BK.regler('tel.sons', l); return new Uint8Array(await r.arrayBuffer()); } } catch (e) {} }
      const o = await t0(id);
      if (frais && o.byteLength <= GROS) (async () => { try { const c = await caches.open(CACHE); await c.put(cle(id), new Response(o.slice ? o.slice() : o));
          const l2 = liste(); l2[id] = { t: frais.modifiedTime, n: o.byteLength, q: Date.now() };
          let tot = Object.values(l2).reduce((a, x) => a + (x.n || 0), 0);
          for (const [k, x] of Object.entries(l2).sort((a, b) => a[1].q - b[1].q)) { if (tot <= MAX) break; if (k === id) continue; await c.delete(cle(k)); tot -= x.n || 0; delete l2[k]; }
          BK.regler('tel.sons', l2); try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {} } catch (e) { console.warn('son non gardé', e); } })();
      return o;
    };
  }
  // g) l'écran verrouillé et les écouteurs : lecture / pause du son en cours
  if ('mediaSession' in navigator) { const jouer0 = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { const m = this;
      try { if (window.MediaMetadata) navigator.mediaSession.metadata = new MediaMetadata({ title: 'BEESKOT Studio', artist: 'BEESKOT', artwork: [{ src: new URL('mobile/icone-192.png', location.href).href, sizes: '192x192', type: 'image/png' }] });
        navigator.mediaSession.setActionHandler('play', () => jouer0.call(m)); navigator.mediaSession.setActionHandler('pause', () => m.pause()); } catch (e) {}
      return jouer0.apply(m, arguments); }; }

  // ---------- 6. démarrage : on se glisse juste avant le démarrage normal du logiciel ----------
  const demarrerPc = BK.demarrer;
  BK.demarrer = async function () {
    lireLien();
    if (!relie()) return ecranRelier();
    BK.onglets = BK.onglets.filter(o => !SANS_TELEPHONE.includes(o.id));          // ex. Light Toast : pas sur le téléphone
    for (const id of SANS_TELEPHONE) delete BK.modules[id];
    if (SANS_TELEPHONE.includes(BK.reglage('dernierOnglet', 'accueil'))) BK.regler('dernierOnglet', 'accueil');
    // PROTECTION : un téléphone n'est jamais le premier appareil du groupe. Il ne « sème » donc rien dans le Drive
    // (fiches de départ, budget de départ, petits noms) : sinon un nouveau téléphone pourrait recréer une fiche que le groupe a retirée.
    for (const g of ['seme.v1', 'budget.v1', 'alias.v1']) BK.regler(g, true);
    BK.regler('zoom', 100); BK.regler('menu.etroit', false);                          // le zoom et le menu replié du PC n'ont pas de sens ici
    if (BK.reglage('look', null) === null) BK.regler('look', 'neuf');                // un seul look sur le téléphone : pas de question au démarrage
    if (!BK.reglage('bienvenue.vue', false)) { BK.regler('bienvenue.vue', true); BK.regler('nouveautes.vu', BK.nouveautes ? BK.nouveautes.num(BK.version) : ''); }   // le guide d'installation du PC (dossiers, Ableton…) ne sert pas ici
    habiller(); garderLesSons();
    // les autres onglets se construisent en fond plus tard que sur le PC (5 s) : l'onglet ouvert est prêt plus vite
    const reste0 = BK.construireLeReste; BK.construireLeReste = function (ordre) { setTimeout(() => reste0.call(BK, ordre), 5000); };
    const ouvrir0 = BK.ouvrir; BK.ouvrir = function () { const r = ouvrir0.apply(BK, arguments); motsBientot(); return r; };
    await demarrerPc.apply(BK, arguments);
    ranger(); mots(); barreTouches();
    new MutationObserver(motsBientot).observe(document.body, { childList: true, subtree: true });       // une aide qui change, une fenêtre qui s'ouvre
    // un nouveau téléphone : on demande d'abord qui s'en sert (les tâches cochées, les notes et « ONLINE » portent ce prénom)
    if (!BK.reglage('nomPc', '')) { BK.ouvrir('reglages'); BK.reglagesOnglet && BK.reglagesOnglet('pc'); }
    BK.telephone.pret = true;
  };
  window.addEventListener('hashchange', () => { if (lireLien()) location.reload(); });
  // le clavier : le champ où on écrit reste visible
  document.addEventListener('focusin', e => { if (e.target.matches && e.target.matches('input:not([type=range]):not([type=checkbox]),textarea,select')) setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300); });
  // sans réseau : l'appli s'ouvre quand même (les fichiers de l'appli gardés sur le téléphone : voir sw.js)
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(e => console.warn('hors réseau indisponible', e));

  BK.telephone = { enAppli, tiroir, retour, scanner, SANS_TELEPHONE, TOUCHES, MOTS, pret: false };
})();
