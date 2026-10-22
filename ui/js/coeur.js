// =====================================================================
// BEESKOT Studio — le cœur : petits outils communs à tous les onglets.
// Chaque onglet vit dans son propre fichier (modules/xxx.js) et s'inscrit
// avec BK.module('id', function(page){ ... }).
// =====================================================================
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const BK = {
  version: '0.9.60 bêta',
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
        html += `<button class="tab${o.mini ? ' mini' : ''}${o.pret ? '' : ' bientot'}" data-p="${o.id}" title="${o.titre}">
          <span class="nchip" style="--c:${o.couleur}"></span>
          <span class="t"><span class="lab">${o.titre}</span>${o.sous && !o.mini ? `<span class="nsub">${o.sous}</span>` : ''}</span>
          <span class="led"></span></button>`;
      }
      html += '</div>';
    }
    const ia = BK.reglage('ia.active', true);
    document.body.classList.toggle('sans-miette', !ia);          // Miette coupée : plus aucun bouton d'aide (ce qui est déjà validé reste)
    html += `<div class="navfoot">
        <button class="st bascule${ia ? ' on' : ''}" id="iaBascule" title="Active ou coupe l'AI (Gemini) sur ce PC"><span class="interrupteur"><i></i></span><span class="eng">AI Miette ${ia ? 'activée' : 'coupée'}</span></button>
        <div class="st"><span id="ledDrive" class="led"></span><span class="eng">Drive BEESKOT</span></div>
        <div class="st"><span id="ledLive" class="led"></span><span class="eng">Ableton Live</span></div>
      </div>`;
    nav.innerHTML = html;
    $$('.tab', nav).forEach(b => b.onclick = () => BK.ouvrir(b.dataset.p));
    const bv = document.getElementById('btVolet');
    if (bv && !bv.onclick) bv.onclick = () => { const e = !BK.reglage('menu.etroit', false); BK.regler('menu.etroit', e); BK.volet(e); };
    BK.volet();
    $$('[data-cote]', nav).forEach(b => b.onclick = () => { const r = BK.reglage('menu.replie', {}); r[b.dataset.cote] = !r[b.dataset.cote]; BK.regler('menu.replie', r);
      $(`.cote-groupe[data-g="${b.dataset.cote}"]`, nav).classList.toggle('replie', r[b.dataset.cote]); b.textContent = (r[b.dataset.cote] ? '▸ ' : '▾ ') + b.textContent.replace(/^[▸▾]\s*/, ''); });
    $('#iaBascule').onclick = () => { BK.regler('ia.active', !BK.reglage('ia.active', true)); const id = ($('#nav .tab.on') || {}).dataset; BK.construireMenu(); BK.etatDrive && BK.etatDrive(); BK.ableton && BK.ableton.majLed && BK.ableton.majLed();
      if (id && id.p) $$('#nav .tab').forEach(t => { const on = t.dataset.p === id.p; t.classList.toggle('on', on); $('.led', t).classList.toggle('amb', on); });
      window.dispatchEvent(new CustomEvent('bk:ia')); };
  },

  // ---------- le volet de gauche : déplié (noms) ou replié (juste les traits de couleur) ----------
  //   [ | ACCUEIL ]‹ (brun, discret)   ⇄   [ | ]› (jaune, bien visible)
  volet(etroit) {
    if (etroit === undefined) etroit = BK.reglage('menu.etroit', false);
    document.body.classList.toggle('menu-etroit', !!etroit);
    const b = document.getElementById('btVolet');
    if (b) { b.textContent = etroit ? '›' : '‹'; b.title = etroit ? 'Déplier le menu' : 'Replier le menu (plus de place pour la page)'; }
    setTimeout(() => window.dispatchEvent(new Event('resize')), 280);     // les aperçus se remettent à la bonne taille
  },

  // ---------- pages ----------
  // Au démarrage : les cadres des onglets sont posés (léger), mais un onglet n'est CONSTRUIT qu'à sa première ouverture,
  // ou tranquillement en arrière-plan quand le PC n'a rien d'autre à faire. Démarrage plus rapide, moins de mémoire.
  // le nom de CE PC dans le bandeau (Yacine, Pierre, Baptiste, Studio) — à régler une fois dans Réglages › Ce PC
  // ---------- petite fenêtre « Es-tu sûr ? » (Oui / Non), dans le style du logiciel ----------
  // une question avec une case à remplir, dans le logiciel (plus la fenêtre Windows « tauri.localhost indique »)
  saisir(texte, defaut = '', { oui = 'OK', non = 'Annuler', long = false } = {}) {
    return new Promise(ok => {
      const v = document.createElement('div'); v.className = 'voile';
      v.innerHTML = `<div class="stopbox bk-conf" role="dialog"><span class="nt bk-conf-t"></span>${long ? '<textarea class="fld bk-saisie" rows="6"></textarea>' : '<input class="fld bk-saisie">'}<div class="bk-conf-b"><button class="btn sm" data-r="0"></button><button class="btn sm warm" data-r="1"></button></div></div>`;
      v.querySelector('.bk-conf-t').textContent = texte; v.querySelector('[data-r="0"]').textContent = non; v.querySelector('[data-r="1"]').textContent = oui;
      const ch = v.querySelector('.bk-saisie'); ch.value = defaut;
      const fin = r => { document.removeEventListener('keydown', k, true); v.remove(); ok(r ? ch.value : null); };
      const k = e => { if (e.key === 'Escape') { e.stopPropagation(); fin(false); } else if (e.key === 'Enter' && !long) { e.stopPropagation(); fin(true); } else e.stopPropagation(); };
      v.onclick = e => { if (e.target === v) fin(false); const b = e.target.closest('[data-r]'); if (b) fin(b.dataset.r === '1'); };
      document.addEventListener('keydown', k, true); document.body.appendChild(v); ch.focus(); ch.select && ch.select();
    });
  },
  confirmer(texte, { oui = 'Oui', non = 'Non' } = {}) {
    return new Promise(ok => {
      const v = document.createElement('div'); v.className = 'voile';
      v.innerHTML = `<div class="stopbox bk-conf" role="dialog"><span class="nt bk-conf-t"></span><div class="bk-conf-b"><button class="btn sm" data-r="0"></button><button class="btn sm warm" data-r="1"></button></div></div>`;
      v.querySelector('.bk-conf-t').textContent = texte; v.querySelector('[data-r="0"]').textContent = non; v.querySelector('[data-r="1"]').textContent = oui;
      const fin = r => { document.removeEventListener('keydown', k, true); v.remove(); ok(r); };
      const k = e => { if (e.key === 'Escape') { e.stopPropagation(); fin(false); } if (e.key === 'Enter') { e.stopPropagation(); fin(true); } };
      v.onclick = e => { if (e.target === v) fin(false); const b = e.target.closest('[data-r]'); if (b) fin(b.dataset.r === '1'); };
      document.addEventListener('keydown', k, true); document.body.appendChild(v); v.querySelector('[data-r="1"]').focus();
    });
  },
  majNomPc() { const n = BK.reglage('nomPc', ''), e = document.getElementById('syPc'), b = document.getElementById('syPcB'); if (!e) return;
    e.textContent = n ? n.toUpperCase() : 'QUI ?'; b && b.classList.toggle('a-regler', !n); },
  OUTILS_EDITION: ['reels', 'postvis', 'reelvis', 'mixprep'],
  construits: {},
  construirePages() {
    const zone = $('#pages'); zone.innerHTML = ''; BK.construits = {};
    for (const o of BK.onglets) zone.appendChild(BK.page(o, o.droite || ''));
  },
  construire(id) {
    if (BK.construits[id]) return; BK.construits[id] = true;
    const o = BK.onglets.find(x => x.id === id), p = $('#p-' + id); if (!o || !p) return;
    const dessiner = BK.modules[o.id] || (o.pret ? null : BK.modules['_en-construction']);
    try { if (dessiner) dessiner(p, o); }
    catch (e) { $('.grid', p).innerHTML = `<div class="pane vit"><span class="nt">Cet onglet a un souci : ${e.message}</span></div>`; console.error(e); }
    $$('.knobify', p).forEach(BK.knobify);
    const v = $('.pane.abar > .vfd', p); if (v && BK._obsEtats) BK._obsEtats.observe(v, { childList: true, characterData: true, subtree: true });
  },
  // les autres onglets se construisent un par un, seulement quand le PC est au repos
  construireLeReste(ordre) {
    const reste = ordre.filter(id => !BK.construits[id]); if (!reste.length) return;
    const suivant = () => { const id = reste.shift(); if (!id) return; BK.construire(id); planifier(); };
    const planifier = () => window.requestIdleCallback ? requestIdleCallback(suivant, { timeout: 1500 }) : setTimeout(suivant, 120);
    planifier();
  },

  ouvrir(id) {
    if (!$('#p-' + id)) id = 'accueil';
    BK.construire(id);
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
  async fermer() {                                                   // on prévient « je pars » (1,5 s maximum), puis on ferme
    try { await Promise.race([BK.presence && BK.presence.battre(true), new Promise(r => setTimeout(r, 1500))]); } catch (e) {}
    if (window.__TAURI__?.process) window.__TAURI__.process.exit(0); else window.close(); },
  // ---------- mises à jour : vérifiées au démarrage, installées en 1 clic depuis le bouton STOP ----------
  // renvoie { m } (une version trouvée), { aJour: true }, ou { erreur } — pour pouvoir le dire à l'écran
  async verifierMaj() {
    const up = BK.T && BK.T.updater; if (!up) return { erreur: 'seulement dans le logiciel installé' };
    try {
      const m = await up.check(); if (!m) return { aJour: true };
      BK.majDispo = m;
      $('#stopLed').classList.add('on'); $('#syMaj').textContent = 'MAJ ' + m.version;
      $('#btStop').classList.add('maj'); $('#btStop').title = 'Mise à jour ' + m.version + ' disponible';
      const b = $('#stMaj'); b.classList.remove('hidden'); b.classList.add('clignote'); b.textContent = '⬇ Installer la version ' + m.version;
      BK.popupMaj(m);
      return { m };
    } catch (e) { return { erreur: 'pas de réponse (Internet ?) : ' + (e && e.message || e) }; }     // on réessaiera tout à l'heure
  },
  // le bouton « 🔍 Vérifier les mises à jour » (bouton rouge ? et Réglages) : on dit toujours ce qu'on a trouvé
  async verifierMajBouton(b, txt) {
    const lab = b.textContent; b.disabled = true; b.innerHTML = '<span class="spin"></span>Recherche…';
    BK.regler('maj.plusTard', 0);                                     // « plus tard » oublié : on veut la voir maintenant
    const r = await BK.verifierMaj();
    b.disabled = false; b.textContent = lab;
    const t = r.m ? '✓ Version ' + r.m.version + ' trouvée : installe-la !' : r.aJour ? '✓ Tu as la dernière version (' + String(BK.version).replace(' bêta', '') + ').' : '⚠ Vérification impossible — ' + r.erreur;
    if (txt) { txt.textContent = t; txt.style.color = r.m ? '#ffb23e' : r.aJour ? '#7ee08a' : '#ff7a5a'; }
    return r;
  },
  // ---------- la mise à jour est obligatoire (tout le monde sur la même version) : un gros pop-up au milieu ----------
  // un petit mot différent à chaque mise à jour (choisi selon le numéro de version) — à compléter à chaque fois
  MOTS_MAJ: [
    'Si tu ne veux pas que tout parte en miettes,<br><b>fais la mise à jour.</b>',
    'Deux secondes, papillon : ça t\'embête pas ?<br><b>Petite mise à jour à faire.</b>',
    'Je sais que t\'as du pain sur la planche…<br><b>mais si tu veux pas perdre une miette, mets à jour.</b>',
    'Je vais pas te tartiner avec des histoires :<br><b>la mise à jour, c\'est maintenant.</b>',
    'Une biscotte toute fraîche sort du four.<br><b>Croque dedans : mise à jour !</b>',
    'Ne reste pas sur ta faim :<br><b>la nouvelle fournée t\'attend.</b>',
    'Ça croustille de nouveautés.<br><b>Une minute et c\'est servi.</b>',
    'Pas de quoi en faire tout un fromage :<br><b>un clic et c\'est à jour.</b>',
    'Le beurre, l\'argent du beurre… et la mise à jour.<br><b>On y va ?</b>',
    'Pour rester dans le même pétrin que le groupe,<br><b>prends la nouvelle version.</b>',
    'C\'est pas de la confiture donnée aux cochons :<br><b>c\'est la mise à jour.</b>',
    'Il reste une biscotte au fond du paquet…<br><b>la nouvelle version. Prends-la !</b>',
  ],
  motMaj(v) { let h = 0; for (const c of String(v || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return BK.MOTS_MAJ[(h + 1) % BK.MOTS_MAJ.length]; },
  popupMaj(m) {
    if (document.getElementById('majVoile')) return;
    if (Date.now() < BK.reglage('maj.plusTard', 0)) { setTimeout(() => BK.popupMaj(m), BK.reglage('maj.plusTard', 0) - Date.now() + 500); return; }
    const v = document.createElement('div'); v.className = 'voile maj-voile'; v.id = 'majVoile';
    v.innerHTML = `<div class="stopbox maj-box">
      <span class="screw tl"></span><span class="screw tr"></span><span class="screw bl"></span><span class="screw br"></span>
      <img src="look/patch-biscotte.png" class="maj-biscotte" alt="">
      <span class="dymo">Mise à jour nécessaire</span>
      <p class="maj-txt">${BK.motMaj(m.version)}</p>
      <span class="nt">Version ${String(m.version).replace(/[<>&]/g, '')} · tout le groupe doit avoir la même pour que le travail reste synchronisé. Ça prend une minute, le logiciel se relance tout seul.</span>
      <button class="btn pri maj-go" id="majGo">⬇ Installer maintenant</button>
      <button class="maj-tard" id="majTard">Plus tard (10 min) — je finis ce que je fais</button></div>`;
    document.body.appendChild(v);
    v.querySelector('#majGo').onclick = async () => {
      const b = v.querySelector('#majGo'); b.disabled = true; b.innerHTML = '<span class="spin"></span>Recherche de la dernière version…'; v.querySelector('#majTard').remove();
      try { const d = await BK.derniereMaj(); b.innerHTML = '<span class="spin"></span>Téléchargement de la ' + d.version + '…';
        await d.downloadAndInstall(); await BK.T.process.relaunch(); }
      catch (e) { b.disabled = false; b.textContent = 'Échec : réessayer'; }
    };
    v.querySelector('#majTard').onclick = () => { BK.regler('maj.plusTard', Date.now() + 10 * 60e3); v.remove(); setTimeout(() => BK.popupMaj(m), 10 * 60e3 + 500); };
  },
  // la version trouvée il y a 20 min n'est peut-être plus la dernière : on redemande juste avant d'installer,
  // pour sauter directement à la plus récente (jamais plusieurs mises à jour d'affilée)
  async derniereMaj() {
    try { const m = await BK.T.updater.check(); if (m) BK.majDispo = m; } catch (e) {}
    return BK.majDispo;
  },
  async installerMaj() {
    if (!BK.majDispo) return;
    const b = $('#stMaj'); b.disabled = true; b.classList.remove('clignote'); b.innerHTML = '<span class="spin"></span>Recherche de la dernière version…';
    try { const m = await BK.derniereMaj(); b.innerHTML = '<span class="spin"></span>Téléchargement de la ' + m.version + '…';
      await m.downloadAndInstall(); await BK.T.process.relaunch(); }
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
    BK._obsEtats = new MutationObserver(ms => { const vfd = ms[0] && ms[0].target; const el = vfd.nodeType === 3 ? vfd.parentElement : vfd;
      const page = el && el.closest('#pages > section'); if (!page || page.classList.contains('hidden')) return;
      // les outils d'édition (Reels Audio / Photo / Vidéo, Ableton) : les autres PC n'ont pas besoin de suivre chaque réglage, seulement les exports
      if (BK.OUTILS_EDITION.includes(page.id.replace(/^p-/, '')) && !/export|upload|drive|enregistr|prêt|zipp|envoy/i.test(el.textContent)) return;
      BK.presence && BK.presence.noter(el.textContent); });
    BK.construireMenu();
    BK.construirePages();
    // d'abord ce qui sert partout (Miette AI range ses réglages dans Réglages), puis l'onglet qu'on ouvre
    BK.construire('renforts'); BK.construire('reglages'); BK.construire(BK.reglage('dernierOnglet', 'accueil'));
    $$('#nav .knobify, header .knobify').forEach(BK.knobify);
    $('#syVer').textContent = BK.version.toUpperCase();
    if (BK.T && BK.T.app) BK.T.app.getVersion().then(v => { BK.version = v + ' bêta'; $('#syVer').textContent = $('#stVer').textContent = BK.version.toUpperCase(); });   // le vrai numéro du .exe
    BK.majNomPc(); $('#syPcB').onclick = () => { BK.ouvrir('reglages'); BK.reglagesOnglet && BK.reglagesOnglet('pc'); };
    BK.etatDrive && BK.etatDrive();
    BK.horloge(); setInterval(BK.horloge, 20000);   // léger : une mise à jour toutes les 20 s
    BK.charge(); setInterval(BK.charge, 8000);
    BK.appliquerZoom(BK.reglage('zoom', 100));
    BK.synchro && BK.synchro.demarrer();                              // ce qu'un autre PC change arrive ici tout seul
    // ce qu'on fait ici (la ligne d'état en bas de l'onglet) est partagé avec les autres PC :
    // chaque onglet branche sa petite ligne sur l'écouteur au moment où il se construit (voir BK.construire).
    const ba = document.getElementById('stAmeliorer');                 // raconter un souci → Miette AI › Aides
    if (ba) ba.onclick = () => { document.getElementById('stopVoile').classList.add('hidden');
      BK.regler('renfort.aide', 'amelioration'); BK.renfortDemander ? BK.renfortDemander('amelioration', {}) : BK.ouvrir('renforts'); };
    const bm = document.getElementById('btMiette');                 // le bouton jaune : Miette relit tout
    if (bm) bm.onclick = () => { bm.classList.add('pressed'); setTimeout(() => bm.classList.remove('pressed'), 150); BK.miette.toutLire(); };
    BK.ouvrir(BK.reglage('dernierOnglet', 'accueil'));
    // le reste se construit en arrière-plan, quand le PC est au repos (l'Accueil d'abord, il sert souvent)
    setTimeout(() => BK.construireLeReste(['accueil', 'biblio', 'medias', 'taches', 'agenda', 'suivi', 'tournage', 'budget', ...BK.onglets.map(o => o.id)]), 1200);
    setTimeout(() => BK.bienvenue && BK.bienvenue.ouvrir(), 600);      // premier lancement : le petit guide
    setTimeout(BK.verifierMaj, 3000);
    BK.nouveautes && BK.nouveautes.verifier();                  // juste après une mise à jour : « Quoi de neuf ? »
    const sv = document.getElementById('stVerif'); if (sv) sv.onclick = () => BK.verifierMajBouton(sv, document.getElementById('stVerifTxt'));
    const st = document.getElementById('stTuto'); if (st) st.onclick = () => { document.getElementById('stopVoile').classList.add('hidden'); BK.nouveautes.tuto(); };
    const nv = document.getElementById('stNouveau'); if (nv) nv.onclick = () => { document.getElementById('stopVoile').classList.add('hidden'); BK.nouveautes.montrer(); };
    setInterval(BK.verifierMaj, 20 * 60e3);        // le bouton se met à clignoter sans avoir à relancer
    BK.ableton && BK.ableton.surveiller();
    BK.discord && BK.discord.surveiller();                         // le Veilleur : toutes les 30 min, s'il est réglé
    setInterval(() => BK.pousser && BK.pousser(), 60000);          // partage avec les autres PC : toutes les minutes              // quelques secondes après l'ouverture, sans gêner
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
