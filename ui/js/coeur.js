// =====================================================================
// BEESKOT Studio — le cœur : petits outils communs à tous les onglets.
// Chaque onglet vit dans son propre fichier (modules/xxx.js) et s'inscrit
// avec BK.module('id', function(page){ ... }).
// =====================================================================
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const BK = {
  version: '0.9.32 bêta',
  modules: {},
  onglets: [],
  cotes: [],

  // ---------- réglages propres à CE PC (jamais partagés) ----------
  reglage(cle, defaut) {
    try { const v = localStorage.getItem('bk.' + cle); return v === null ? defaut : JSON.parse(v); }
    catch (e) { return defaut; }
  },
  regler(cle, valeur) {
    try { localStorage.setItem('bk.' + cle, JSON.stringify(valeur)); } catch (e) {}
  },
  ongletVisible(o) {
    if (o.fixe) return true;
    return BK.reglage('visible.' + o.id, o.defaut);
  },

  // ---------- inscription d'un onglet ----------
  module(id, dessiner) { BK.modules[id] = dessiner; },

  // ---------- fabrique une page avec l'en-tête console (vis + étiquette Dymo + afficheurs) ----------
  page(o, droite = '') {
    const s = document.createElement('section');
    s.id = 'p-' + o.id; s.className = 'hidden';
    s.innerHTML = `
      <header class="hdr"><span class="screw tl" style="--r:60deg"></span><span class="screw bl" style="--r:-30deg"></span><span class="screw tr" style="--r:5deg"></span><span class="screw br" style="--r:85deg"></span>
        <h1 class="h1">${o.titre}</h1><p class="sub">${o.sous || ''}</p>
        <div class="right">${droite}</div></header>
      <div class="grid"></div>`;
    return s;
  },

  // ---------- menu de gauche ----------
  construireMenu() {
    const nav = $('#nav');
    let html = '';
    for (const c of BK.cotes) {
      const liste = BK.onglets.filter(o => o.cote === c.id && BK.ongletVisible(o));
      if (!liste.length) continue;
      // chaque côté (Audio, Visuel, Show, Organisation) se replie d'un clic ; l'onglet ouvert reste toujours visible
      const replie = c.titre && BK.reglage('menu.replie', {})[c.id];
      if (c.titre) html += `<button class="eng cote cote-${c.id}" data-cote="${c.id}" title="Replier / déplier">${replie ? '▸' : '▾'} ${c.titre}</button>`;
      html += `<div class="cote-groupe${replie ? ' replie' : ''}" data-g="${c.id}">`;
      for (const o of liste) {
        html += `<button class="tab${o.mini ? ' mini' : ''}${o.pret ? '' : ' bientot'}" data-p="${o.id}">
          <span class="nchip" style="--c:${o.couleur}"></span>
          <span class="t"><span class="lab">${o.titre}</span>${o.sous && !o.mini ? `<span class="nsub">${o.sous}</span>` : ''}</span>
          <span class="led"></span></button>`;
      }
      html += '</div>';
    }
    const ia = BK.reglage('ia.active', true);
    html += `<div class="navfoot">
        <button class="st bascule${ia ? ' on' : ''}" id="iaBascule" title="Active ou coupe l'AI (Gemini) sur ce PC"><span class="interrupteur"><i></i></span><span class="eng">AI Miette ${ia ? 'activée' : 'coupée'}</span></button>
        <div class="st"><span id="ledDrive" class="led"></span><span class="eng">Drive BEESKOT</span></div>
        <div class="st"><span id="ledLive" class="led"></span><span class="eng">Ableton Live</span></div>
      </div>`;
    nav.innerHTML = html;
    $$('.tab', nav).forEach(b => b.onclick = () => BK.ouvrir(b.dataset.p));
    $$('[data-cote]', nav).forEach(b => b.onclick = () => { const r = BK.reglage('menu.replie', {}); r[b.dataset.cote] = !r[b.dataset.cote]; BK.regler('menu.replie', r);
      $(`.cote-groupe[data-g="${b.dataset.cote}"]`, nav).classList.toggle('replie', r[b.dataset.cote]); b.textContent = (r[b.dataset.cote] ? '▸ ' : '▾ ') + b.textContent.replace(/^[▸▾]\s*/, ''); });
    $('#iaBascule').onclick = () => { BK.regler('ia.active', !BK.reglage('ia.active', true)); const id = ($('#nav .tab.on') || {}).dataset; BK.construireMenu(); BK.etatDrive && BK.etatDrive(); BK.ableton && BK.ableton.majLed && BK.ableton.majLed();
      if (id && id.p) $$('#nav .tab').forEach(t => { const on = t.dataset.p === id.p; t.classList.toggle('on', on); $('.led', t).classList.toggle('amb', on); });
      window.dispatchEvent(new CustomEvent('bk:ia')); };
  },

  // ---------- pages ----------
  construirePages() {
    const zone = $('#pages'); zone.innerHTML = '';
    for (const o of BK.onglets) {
      const p = BK.page(o, o.droite || '');
      zone.appendChild(p);
      const dessiner = BK.modules[o.id] || (o.pret ? null : BK.modules['_en-construction']);
      try { if (dessiner) dessiner(p, o); }
      catch (e) { $('.grid', p).innerHTML = `<div class="pane vit"><span class="nt">Cet onglet a un souci : ${e.message}</span></div>`; console.error(e); }
    }
  },

  ouvrir(id) {
    if (!$('#p-' + id)) id = 'accueil';
    $$('#pages > section').forEach(s => s.classList.toggle('hidden', s.id !== 'p-' + id));
    $$('#nav .tab').forEach(t => {
      const on = t.dataset.p === id;
      t.classList.toggle('on', on);
      $('.led', t).classList.toggle('amb', on);
    });
    BK.regler('dernierOnglet', id);
    if (BK.surOuvrir && BK.surOuvrir[id]) BK.surOuvrir[id]();      // un onglet peut se rafraîchir quand on l'ouvre
  },

  // ---------- bandeau du haut ----------
  // l'afficheur « charge » : ce que le logiciel prend sur cet ordinateur
  async charge() {
    const c = document.getElementById('syCpu'), r = document.getElementById('syRam'); if (!c) return;
    if (!BK.estExe) { c.textContent = 'APERÇU'; r.textContent = '·'; return; }
    try { const j = JSON.parse(await BK.T.core.invoke('ressources'));
      c.textContent = Math.round(j.cpu) + ' % CPU'; r.textContent = j.ramMo >= 1024 ? (j.ramMo / 1024).toFixed(1) + ' Go' : j.ramMo + ' Mo';
      c.parentElement.classList.toggle('chaud', j.cpu > 60);
    } catch (e) { c.textContent = '—'; }
  },
  horloge() {
    const d = new Date();
    const dd = document.getElementById('syDate'); if (dd) dd.textContent = d.toLocaleDateString('fr-CA', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase();
    const hh = document.getElementById('syHeure'); if (hh) hh.textContent = d.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
  },

  // ---------- bouton STOP : relancer / fermer / version ----------
  // (dans le .exe, ces deux gestes passeront par le moteur du logiciel ; ici, version de secours)
  // taille de l'interface : le zoom de la fenêtre (comme Ctrl + / Ctrl − d'un navigateur) — tout se réorganise, sans bande vide
  appliquerZoom(z) {
    const f = (+z || 100) / 100, wv = window.__TAURI__ && window.__TAURI__.webview;
    if (wv && wv.getCurrentWebview) { wv.getCurrentWebview().setZoom(f).then(() => { document.documentElement.style.zoom = ''; document.documentElement.style.setProperty('--z', 1); })
      .catch(() => BK.zoomCss(f)); return; }
    BK.zoomCss(f);
  },
  zoomCss(f) { document.documentElement.style.zoom = f; document.documentElement.style.setProperty('--z', f); },
  relancer() { if (window.__TAURI__?.process) window.__TAURI__.process.relaunch(); else location.reload(); },
  fermer()   { if (window.__TAURI__?.process) window.__TAURI__.process.exit(0); else window.close(); },
  // ---------- mises à jour : vérifiées au démarrage, installées en 1 clic depuis le bouton STOP ----------
  async verifierMaj() {
    const up = BK.T && BK.T.updater; if (!up) return;
    try {
      const m = await up.check(); if (!m) return;
      BK.majDispo = m;
      $('#stopLed').classList.add('on'); $('#syMaj').textContent = 'MAJ ' + m.version;
      $('#btStop').classList.add('maj'); $('#btStop').title = 'Mise à jour ' + m.version + ' disponible';
      const b = $('#stMaj'); b.classList.remove('hidden'); b.textContent = '⬇ Installer la version ' + m.version;
    } catch (e) { /* pas d'Internet : on réessaiera tout à l'heure */ }
  },
  async installerMaj() {
    if (!BK.majDispo) return;
    const b = $('#stMaj'); b.disabled = true; b.innerHTML = '<span class="spin"></span>Téléchargement…';
    try { await BK.majDispo.downloadAndInstall(); await BK.T.process.relaunch(); }
    catch (e) { b.disabled = false; b.textContent = 'Échec : réessayer'; }
  },

  boutonStop() {
    const voile = $('#stopVoile'), montrer = v => voile.classList.toggle('hidden', !v);
    $('#stVer').textContent = BK.version.toUpperCase();
    $('#btStop').onclick = () => montrer(true);
    $('#stAnnuler').onclick = () => montrer(false);
    voile.onclick = e => { if (e.target === voile) montrer(false); };
    document.addEventListener('keydown', e => { if (e.key === 'Escape') montrer(false); });
    $('#stRelancer').onclick = BK.relancer;
    $('#stFermer').onclick = BK.fermer;
    $('#stMaj').onclick = BK.installerMaj;
  },

  async demarrer() {
    BK.boutonStop();
    try { await BK.semer(); await BK.semerAlias(); await BK.semerBudget(); } catch (e) { console.error(e); }
    BK.construireMenu();
    BK.construirePages();
    $$('.knobify').forEach(BK.knobify);
    $('#syVer').textContent = BK.version.toUpperCase();
    if (BK.T && BK.T.app) BK.T.app.getVersion().then(v => { BK.version = v + ' bêta'; $('#syVer').textContent = $('#stVer').textContent = BK.version.toUpperCase(); });   // le vrai numéro du .exe
    $('#syPc').textContent = BK.reglage('nomPc', 'CE PC').toUpperCase();
    BK.etatDrive && BK.etatDrive();
    BK.horloge(); setInterval(BK.horloge, 20000);   // léger : une mise à jour toutes les 20 s
    BK.charge(); setInterval(BK.charge, 5000);
    BK.appliquerZoom(BK.reglage('zoom', 100));
    BK.synchro && BK.synchro.demarrer();                              // ce qu'un autre PC change arrive ici tout seul
    const ba = document.getElementById('stAmeliorer');                 // raconter un souci → Miette AI › Aides
    if (ba) ba.onclick = () => { document.getElementById('stopVoile').classList.add('hidden');
      BK.regler('renfort.aide', 'amelioration'); BK.renfortDemander ? BK.renfortDemander('amelioration', {}) : BK.ouvrir('renforts'); };
    const bm = document.getElementById('btMiette');                 // le bouton jaune : Miette relit tout
    if (bm) bm.onclick = () => { bm.classList.add('pressed'); setTimeout(() => bm.classList.remove('pressed'), 150); BK.miette.toutLire(); };
    BK.ouvrir(BK.reglage('dernierOnglet', 'accueil'));
    setTimeout(() => BK.bienvenue && BK.bienvenue.ouvrir(), 600);      // premier lancement : le petit guide
    setTimeout(BK.verifierMaj, 3000);
    setInterval(BK.verifierMaj, 20 * 60e3);        // le bouton se met à clignoter sans avoir à relancer
    BK.ableton && BK.ableton.surveiller();
    BK.discord && BK.discord.surveiller();                         // le Veilleur : toutes les 30 min, s'il est réglé
    setInterval(() => BK.synchro && BK.synchro(), 60000);          // partage avec les autres PC : toutes les minutes              // quelques secondes après l'ouverture, sans gêner
  },

  // ---------- boutons rotatifs (repris tel quel de Dari Audio Live) ----------
  // <input type=range> ou <select> avec la classe « knobify » : l'élément d'origine reste la source de vérité
  knobify(el) {
    const sel = el.tagName === 'SELECT', min = sel ? 0 : +el.min, max = sel ? el.options.length - 1 : +el.max, step = sel ? 1 : +(el.step || 1);
    const ticks = (el.dataset.ticks || '').split(',').filter(Boolean), short = (el.dataset.short || '').split(','), fmt = el.dataset.fmt || '{}';
    const w = document.createElement('div'); w.className = 'knob'; w.tabIndex = 0; w.setAttribute('role', 'slider');
    const out = document.createElement('div'); out.className = 'glass amber kval';
    w.innerHTML = ticks.map((tk, i) => { const a = (-135 + 270 * i / Math.max(1, ticks.length - 1)) * Math.PI / 180;
      return `<span class="tk" data-i="${i}" style="left:${59 + 54 * Math.sin(a)}px;top:${59 - 54 * Math.cos(a)}px">${tk}</span>`; }).join('') + '<img src="textures/knob.png" alt="">';
    el.style.display = 'none'; el.after(w, out);
    const get = () => sel ? el.selectedIndex : +el.value;
    const draw = () => { const v = get(), p = (v - min) / ((max - min) || 1);
      $('img', w).style.transform = `rotate(${-135 + 270 * p}deg)`;
      out.textContent = sel ? (short[v] || el.options[v].text) : fmt.replace('{}', v);
      w.setAttribute('aria-valuetext', out.textContent);
      $$('.tk', w).forEach((x, i) => x.classList.toggle('on', Math.abs(i / Math.max(1, ticks.length - 1) - p) < .01)); };
    // pendant qu'on tourne le bouton : seulement « input ». « change » part à la fin,
    // sinon l'écran se redessine sous la souris à chaque cran (et le bouton se dérobe).
    const set = (v, fin = true) => { v = Math.max(min, Math.min(max, Math.round(v / step) * step)); if (v === get()) return;
      if (sel) el.selectedIndex = v; else el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      if (fin) el.dispatchEvent(new Event('change', { bubbles: true }));
      draw(); };
    let y0 = null, v0 = 0;
    w.addEventListener('pointerdown', e => { if (e.target.classList.contains('tk')) return; y0 = e.clientY; v0 = get(); w.setPointerCapture(e.pointerId); });
    // sensibilité douce : il faut glisser ~400 px pour parcourir tout le bouton (Maj = encore plus fin)
    w.addEventListener('pointermove', e => { if (y0 === null) return;
      const d = (y0 - e.clientY) * (e.shiftKey ? 0.25 : 1);
      set(sel ? v0 + d / 36 : v0 + d * (max - min) / 400, false); });
    w.addEventListener('pointerup', () => { if (y0 !== null && get() !== v0) el.dispatchEvent(new Event('change', { bubbles: true })); y0 = null; });
    w.addEventListener('keydown', e => { if (e.key === 'ArrowUp' || e.key === 'ArrowRight') set(get() + step); if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') set(get() - step); });
    $$('.tk', w).forEach(x => x.onclick = () => set(min + (max - min) * (+x.dataset.i) / Math.max(1, ticks.length - 1)));
    // cliquer sur l'afficheur = taper soi-même une valeur (ex. 35)
    out.title = 'Clique pour taper une valeur'; out.style.cursor = 'text';
    out.onclick = () => {
      if (out.querySelector('input')) return;
      const champ = document.createElement('input'); champ.className = 'kval-champ'; champ.inputMode = 'decimal';
      champ.value = sel ? el.value : get(); out.textContent = ''; out.appendChild(champ); champ.focus(); champ.select();
      const valider = () => {
        const n = parseFloat(String(champ.value).replace(',', '.').replace(/[^0-9.\-]/g, ''));
        if (!isNaN(n)) {
          if (sel) { let best = 0, d = Infinity; [...el.options].forEach((o, i) => { const dd = Math.abs(parseFloat(o.value) - n); if (dd < d) { d = dd; best = i; } }); set(best); }
          else set(Math.max(min, Math.min(max, n)));
        }
        draw();
      };
      champ.onkeydown = e => { if (e.key === 'Enter') champ.blur(); if (e.key === 'Escape') { champ.value = ''; champ.blur(); } e.stopPropagation(); };
      champ.onblur = valider;
    };
    el.knobMaj = draw;              // pour redessiner le bouton quand la valeur change ailleurs
    draw();
  },
};
