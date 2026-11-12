// =====================================================================
// SYNCH BREAD (ex « Live ») — l'écran (le même pour l'onglet du logiciel et pour la page des invités).
// Vocabulaire : le « lead témoin » = celui qui lance (dans le code : chef). C'est aussi sur son son que les autres se calent.
// Le moteur (heure commune, salle, lecteur, réglage) est dans js/live-moteur.js.
//
//   BKLive.monter(racine, hote)   construit l'écran dans « racine ».
//   hote = ce que l'endroit sait faire :
//     nom, type ('pc' | 'tel' | 'invite'), membre (true = membre du groupe), salle (le code de la salle)
//     octets(piste)                 → le fichier son (obligatoire)
//     morceaux(), piste(id), passages(piste), garderPassage(piste, p), oublierPassage(piste, p), exports(piste)   (membres)
//     inviter(piste, on) → { lien, cle }, qr(texte) → dessin du QR code                                         (membres)
//
// Pour changer une étiquette ou une option : les listes en haut (COUPS, ELANS, VITESSES).
// =====================================================================
(() => {
const L = window.BKLive;
const COUPS = [0, 4, 8], ELANS = [0, 2, 4, 8], VITESSES = [0.5, 0.75, 1, 1.25, 1.5, 2];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tc = (s, dix) => { s = Math.max(0, +s || 0); const m = Math.floor(s / 60), r = s - m * 60; return m + ':' + (dix ? r.toFixed(1).padStart(4, '0') : String(Math.floor(r)).padStart(2, '0')); };
const enSec = t => { const m = String(t).trim().match(/^(?:(\d+):)?(\d+(?:[.,]\d+)?)$/); return m ? (+m[1] || 0) * 60 + parseFloat(m[2].replace(',', '.')) : NaN; };
const pc = v => Math.round(v * 100) + ' %';

L.monter = function (racine, hote) {
  const S = L.salle, H = L.horloge, P = L.lecteur;
  const U = { entre: false, onglet: 'passages', charge: '', chargee: '', pics: null, edite: null, exports: null, voile: '', sync: null, enSync: false, vuCmd: 0, vuCal: 0, msg: '' };
  racine.classList.add('lv');
  racine.innerHTML = `
    <div class="lv-haut" data-z="haut"></div>
    <div class="lv-corps">
      <aside class="lv-g" data-z="gauche"></aside>
      <main class="lv-c">
        <section class="lv-moniteur" aria-live="off"><div class="lv-m1" data-m="titre"></div><div class="lv-m2" data-m="gros"></div><div class="lv-lampes" data-m="lampes" aria-hidden="true"></div><div class="lv-m3" data-m="temps"></div><div class="lv-m4" data-m="qui"></div></section>
        <div class="lv-transport" data-z="transport"></div>
        <div class="lv-options" data-z="options"></div>
        <section class="lv-onde"><div class="lv-regle" data-z="regle"></div><div class="lv-bande" data-b><canvas></canvas><div class="lv-joue" data-joue></div><div class="lv-zone" data-zone><span class="lv-poignee g" data-p="debut"></span><span class="lv-poignee d" data-p="fin"></span></div><div class="lv-tete" data-tete></div></div><div class="lv-note" data-z="note"></div></section>
      </main>
      <aside class="lv-d" data-z="droite"></aside>
    </div>
    <div class="lv-voile hidden" data-z="voile"></div>
    <div class="lv-entree" data-z="entree"></div>`;
  const q = s => racine.querySelector(s), z = n => q(`[data-z="${n}"]`), m = n => q(`[data-m="${n}"]`);
  // on ne redessine une zone que si elle a changé, et jamais pendant qu'on y tape ou qu'on y glisse un curseur
  racine.querySelectorAll('[data-z]').forEach(el => Object.defineProperty(el, 'html', { set(h) { if (el._h === h) return; const a = document.activeElement;
    if (a && el.contains(a) && /^(INPUT|SELECT)$/.test(a.tagName)) return; el._h = h; el.innerHTML = h; } }));
  const etroit = () => racine.classList.toggle('etroit', racine.clientWidth < 900);
  if (window.ResizeObserver) new ResizeObserver(etroit).observe(racine); etroit();

  // ---------- qui suis-je, que dit la salle ----------
  const E = () => S.etat();
  const chef = () => E().chef === L.id;
  const piste = () => E().piste || null;
  const passage = () => { const e = E(), p = e.passage; if (p && p.fin > p.debut) return p; const d = P.buffer && U.chargee === (piste() || {}).fichier ? P.buffer.duration : 0; return { nom: nomEntier(), debut: 0, fin: d, entier: true }; };
  // les passages : ceux annoncés par le lead témoin + ceux que CET appareil trouve lui-même (Reels Audio : PLAN, Tournages, gardés…)
  const clePiste = () => { const p = piste(); return p ? p.id + '|' + p.fichier : ''; };
  const passagesTous = () => { const e = E(), l = [...(e.passages || [])], vu = new Set(l.map(x => x.debut + '-' + x.fin));
    if (U.loc && U.loc.cle === clePiste()) for (const x of U.loc.liste) if (!vu.has(x.debut + '-' + x.fin)) { vu.add(x.debut + '-' + x.fin); l.push(x); }
    return l.sort((a, b) => a.debut - b.debut); };
  async function chercherPassages() { const p = piste(); if (!p || !hote.passages) return; const cle = clePiste();
    try { const liste = await hote.passages(p); if (clePiste() === cle) { U.loc = { cle, liste }; dessiner(); } } catch (e) { console.warn('passages', e); } }
  const nomPiste = p => !p ? '' : p.export ? ((p.origine || {}).nom || String(p.nom || '').replace(/ · export$/, '')) : p.nom;
  const nomEntier = () => (piste() || {}).export ? 'Export entier' : 'Morceau entier';
  const nomFichier = p => { const n = String((p || {}).nomFichier || '').replace(/\.[a-z0-9]{2,4}$/i, ''); return n.length > 42 ? n.slice(0, 40) + '…' : n; };
  const opts = () => ({ coups: 4, inter: 500, elan: 0, v: 1, boucle: false, ...(E().opts || {}) });
  const moi = () => ({ nom: hote.nom, type: hote.type, os: /iPhone|iPad/.test(navigator.userAgent) ? 'iPhone' : /Android/.test(navigator.userAgent) ? 'Android' : 'ordinateur', sync: P.sync, regle: P.regle || 0 });
  const dire = t => { U.msg = t; dessiner(); clearTimeout(U._m); U._m = setTimeout(() => { U.msg = ''; dessiner(); }, 5000); };

  // ---------- charger le morceau quand la salle en annonce un ----------
  async function chargerPiste() {
    const p = piste(); if (!p || !p.fichier || U.charge === p.fichier || U.chargee === p.fichier || !U.entre) return;
    U.charge = p.fichier; U.pics = null; S.presence({ pret: 'dl', piste: p.fichier }); dessiner();
    try {
      const o = await hote.octets(p); if (U.charge !== p.fichier) return;
      S.presence({ pret: 'dec' }); dessiner();
      await P.charger(o); if (U.charge !== p.fichier) return;
      U.chargee = p.fichier; U.charge = ''; U.pics = P.pics(700); S.presence({ pret: true, piste: p.fichier });
      dessinerOnde(); rejoindre();                                                       // arrivé en retard : on rejoint la musique
    } catch (e) { console.warn('live : chargement', e); if (U.charge === p.fichier) { U.charge = ''; S.presence({ pret: 'err' }); dire('Morceau impossible à charger : ' + (e.message || e)); } }
    dessiner();
  }

  // la musique tourne déjà chez les autres (arrivée en retard, synchro rallumée, heure commune enfin connue) : on la rejoint
  const rejoindre = () => { const c = E().cmd; if (c && c.type === 'play' && !P.plan && P.sync && U.chargee && U.chargee === (piste() || {}).fichier) P.jouer(c); };
  // ---------- réagir à la salle ----------
  function surSalle() {
    if (!U.entre) return dessiner();
    const e = E(), c = e.cmd;
    if (c && c.n !== U.vuCmd) { U.vuCmd = c.n; if (c.type === 'play') { if (U.chargee === (piste() || {}).fichier) P.jouer(c); } else P.couper(); }
    const clics = !!e.clic && H.maintenant() != null && H.maintenant() - e.clic < 15 * 60e3; if (clics !== U.clics) { U.clics = clics; P.clic(clics); }
    const k = S.d.cal;
    const frais = k && H.maintenant() != null && Math.abs(H.maintenant() - k.T0) < 60000;
    if (frais && k.temoin === L.id && k.cible !== L.id && k.n !== U.vuCal && !k.res) { U.vuCal = k.n;
      if (P.pret()) { L.cal.jouer(k.T0, 0); const g = S.gens().find(x => x.id === k.cible); dire((g ? g.nom : 'Quelqu\'un') + ' se synchronise sur toi : garde ton écouteur près de son micro.'); } }
    // personne ne tient la barre : le premier membre présent devient chef
    if (hote.membre && S.connecte && (!e.chef || !S.gens().some(g => g.id === e.chef)) && S.gens().filter(g => g.type !== 'invite').map(g => g.id).sort()[0] === L.id) S.maj('etat', { chef: L.id });
    if (U.entre && U.cleVue !== clePiste()) { U.cleVue = clePiste(); ecStop(); U.edite = null; U.curseur = null; chercherPassages(); }
    chargerPiste(); dessiner();
  }

  // ---------- l'écoute perso (Nouveau passage) : seulement sur cet appareil, sans synchro ----------
  const chargeOk = () => !!(P.buffer && piste() && U.chargee === piste().fichier);
  function ecStop() { const e = U.ecoute; if (!e) return; try { e.src.onended = null; e.src.stop(); } catch (er) {} try { e.g.disconnect(); } catch (er) {} U.curseur = ecPos(); U.ecoute = null; dessiner(); }
  function ecPos() { const e = U.ecoute; if (!e) return U.curseur || 0; let t = e.off + (P.ctx.currentTime - e.t0); if (e.boucle) { const l = e.fin - e.debut; if (t >= e.fin && l > 0) t = e.debut + ((t - e.debut) % l); } return Math.min(t, P.buffer ? P.buffer.duration : t); }
  function ecJouer(depuis, boucle) {
    if (!chargeOk()) return dire('Le morceau se charge encore…'); if (P.position(E().cmd)) return dire('La lecture synchro est en cours : arrête-la d\'abord.');
    if (U.ecoute) { try { U.ecoute.src.onended = null; U.ecoute.src.stop(); U.ecoute.g.disconnect(); } catch (er) {} U.ecoute = null; }
    const c = P.ctx; if (!c) return; if (c.state !== 'running') c.resume().catch(() => {});
    const d = P.buffer.duration, x = U.edite || {}, debut = Math.max(0, x.debut || 0), fin = Math.min(d, x.fin > debut ? x.fin : d);
    const off = Math.max(0, Math.min(d - 0.05, boucle ? debut : depuis)), src = c.createBufferSource(), g = c.createGain();
    src.buffer = P.buffer; src.connect(g); g.connect(P.sortie || c.destination);
    if (boucle) { src.loop = true; src.loopStart = debut; src.loopEnd = fin; src.start(0, off); } else src.start(0, off);
    src.onended = () => { if (U.ecoute && U.ecoute.src === src) { U.ecoute = null; U.curseur = 0; dessiner(); } };
    U.ecoute = { src, g, t0: c.currentTime, off, boucle: !!boucle, debut, fin }; dessiner();
  }
  const ecMarque = quoi => { if (!U.edite) return; const t = Math.round((U.ecoute ? ecPos() : U.curseur || 0) * 10) / 10, d = P.buffer ? P.buffer.duration : 36000;
    if (quoi === 'debut') { U.edite.debut = Math.min(t, d - 0.5); if (U.edite.fin < U.edite.debut + 0.5) U.edite.fin = Math.min(d, U.edite.debut + 20); }
    else { U.edite.fin = Math.max(t, 0.5); if (U.edite.debut > U.edite.fin - 0.5) U.edite.debut = Math.max(0, U.edite.fin - 0.5); }
    const a = q('#lvPd'), f = q('#lvPf'); if (a) a.value = tc(U.edite.debut, 1); if (f) f.value = tc(U.edite.fin, 1); dessinerZone(); };

  // ---------- les ordres ----------
  const ordre = o => S.maj('etat', { cmd: { n: Date.now(), par: hote.nom, ...o } });
  function lancer() {
    const now = H.maintenant(), p = passage(), o = opts(); if (now == null) return dire('Pas encore d\'heure commune : vérifie le réseau.');
    if (!(p.fin > p.debut)) return dire('Le morceau n\'est pas encore chargé.');
    const v = o.v || 1, pos0 = Math.max(0, p.debut - (o.elan || 0) * v);
    ordre({ type: 'play', t0: Math.round(now + L.R.AVANCE + (o.coups || 0) * o.inter), pos0, fin: p.fin, v, boucle: !!o.boucle, coups: o.coups || 0, inter: o.inter });
  }
  const stop = () => ordre({ type: 'stop' });
  const choisirPassage = p => S.maj('etat', { passage: p, opts: { ...opts(), v: p.v || opts().v || 1 }, cmd: { n: Date.now(), type: 'stop', par: hote.nom } });
  async function choisirPiste(p) {
    if (!p || !p.fichier) return dire('Ce morceau n\'a pas de version dans le Drive.');
    let cle = ''; if (E().invites && hote.inviter) { try { cle = (await hote.inviter(p, true)).cle || ''; } catch (e) { dire('Invités : ' + (e.message || e)); } }
    const ps = await hote.passages(p).catch(() => []);
    U.exports = null; const inter = p.bpm > 30 ? Math.round(60000 / p.bpm) : opts().inter;
    await S.maj('etat', { piste: { ...p, cle }, passages: ps, passage: null, opts: { ...opts(), v: 1, inter }, cmd: { n: Date.now(), type: 'stop', par: hote.nom } });
  }

  // ---------- dessin ----------
  let prevu = false; const dessiner = () => { if (prevu) return; prevu = true; requestAnimationFrame(() => { prevu = false; peindre(); }); };
  function peindre() {
    const e = E(), p = piste(), ch = chef(), gens = S.gens(), o = opts(), pa = passage(), nomChef = (gens.find(g => g.id === e.chef) || {}).nom || '—';
    q('.lv-entree').classList.toggle('hidden', U.entre);
    if (!U.entre) { z('entree').innerHTML = `<div class="lv-carte"><div class="lv-t">SYNCH BREAD</div><p>Tout le monde entend la même musique, au même moment, dans ses écouteurs.</p>
      ${hote.membre ? '' : `<label class="lv-lb" for="lvNom">Ton prénom</label><input class="lv-champ" id="lvNom" maxlength="20" value="${esc(hote.nom || '')}" autocomplete="off">`}
      <button type="button" class="lv-b vert gros" data-a="entrer">Entrer</button><p class="lv-petit">Mets tes écouteurs et monte le son du téléphone.</p></div>`; return; }
    // --- le haut ---
    z('haut').html = `
      ${hote.membre && hote.morceaux ? `<select class="lv-champ lv-morceau" data-c="morceau" aria-label="Morceau" ${ch ? '' : 'disabled'}><option value="">Choisir un morceau…</option>${(U.morceaux || []).map(x => `<option value="${esc(x.id)}"${p && p.id === x.id ? ' selected' : ''}>${esc(x.nom)}</option>`).join('')}</select>`
        : `<div class="lv-nompiste">${esc(p ? nomPiste(p) + (p.export ? ' · export' : '') : 'Pas encore de morceau')}</div>`}
      <span class="lv-etatreseau ${S.connecte && H.decal != null ? 'ok' : 'ko'}">${S.erreur ? 'Salle injoignable' : !S.connecte ? 'Connexion…' : H.decal == null ? 'Heure commune…' : 'En ligne'}</span>
      <span class="lv-vide"></span>
      <span class="lv-chef">Lead témoin : <b>${esc(ch ? 'toi' : nomChef)}</b></span>
      ${ch ? '' : '<button type="button" class="lv-b ambre" data-a="main">Prendre la main</button>'}
      <label class="lv-sync"><span>${P.sync ? 'Audio on' : 'Audio off'}</span><button type="button" class="lv-inter${P.sync ? ' on' : ''}" role="switch" aria-checked="${P.sync}" data-a="sync" aria-label="Musique sur cet appareil"><i></i></button></label>`;
    // --- la colonne de gauche : passages / exports (/ connectés sur téléphone) ---
    const ong = [['passages', 'Passages'], ...(hote.membre && hote.exports ? [['exports', 'Exports']] : []), ['gens', `Connectés (${gens.length})`]];
    let corps = '';
    if (U.onglet === 'passages') {
      const liste = [{ nom: nomEntier(), debut: 0, fin: 0, entier: true }, ...passagesTous()];
      const lignes = liste.map((x, i) => { const on = x.entier ? pa.entier : (!pa.entier && Math.abs(pa.debut - x.debut) < .05 && Math.abs(pa.fin - x.fin) < .05);
        return `<div class="lv-ligne${on ? ' on' : ''}"><button type="button" class="lv-pass" data-a="passage" data-i="${i}" ${ch ? '' : 'disabled'}><b>${esc(x.nom || 'Passage')}</b><em>${x.entier ? 'du début à la fin' : tc(x.debut) + ' → ' + tc(x.fin) + (x.v && x.v !== 1 ? ' · vitesse ' + pc(x.v) : '')}</em></button>
          ${hote.membre && x.source === 'live' ? `<button type="button" class="lv-x" data-a="oublier" data-i="${i}" aria-label="Supprimer ce passage">✕</button>` : ''}</div>`; }).join('');
      const edition = (hote.membre && hote.garderPassage ? (U.edite && p
          ? `<div class="lv-edit"><label class="lv-lb" for="lvPn">Nom du passage</label><input class="lv-champ" id="lvPn" maxlength="30" value="${esc(U.edite.nom)}" data-e="nom">
              <div class="lv-duo"><div><label class="lv-lb" for="lvPd">Entrée</label><input id="lvPd" inputmode="decimal" value="${tc(U.edite.debut, 1)}" data-e="debut" class="lv-champ lv-num"></div><div><label class="lv-lb" for="lvPf">Sortie</label><input id="lvPf" inputmode="decimal" value="${tc(U.edite.fin, 1)}" data-e="fin" class="lv-champ lv-num"></div></div>
              <div class="lv-ecoute"><button type="button" class="lv-b ${U.ecoute && !U.ecoute.boucle ? 'rouge' : 'vert'}" data-a="ecouter" ${chargeOk() ? '' : 'disabled'}>${!chargeOk() ? 'Chargement…' : U.ecoute && !U.ecoute.boucle ? '⏸ Pause' : '▶ Écouter'}</button><span class="lv-ecpos" data-ecpos></span></div>
              <div class="lv-duo"><button type="button" class="lv-b" data-a="marqueI" ${chargeOk() ? '' : 'disabled'}>I · Entrée ici</button><button type="button" class="lv-b" data-a="marqueO" ${chargeOk() ? '' : 'disabled'}>O · Sortie ici</button></div>
              <button type="button" class="lv-b ${U.ecoute && U.ecoute.boucle ? 'rouge' : ''}" data-a="ecpass" ${chargeOk() ? '' : 'disabled'}>${U.ecoute && U.ecoute.boucle ? '⏸ Arrêter la boucle' : '⟲ Écouter le passage (en boucle)'}</button>
              <p class="lv-petit">Toi seul l'entends. Touche la forme d'onde pour aller à un endroit, glisse les bords pour ajuster.</p>
              <div class="lv-duo"><button type="button" class="lv-b vert" data-a="garder">Garder</button><button type="button" class="lv-b" data-a="annuler">Annuler</button></div></div>`
          : `<button type="button" class="lv-b pointille" data-a="nouveau" ${p ? '' : 'disabled'}>+ Nouveau passage</button>${!p ? '<p class="lv-petit">Choisis d\'abord un morceau en haut.</p>' : ''}`) : '');
      corps = U.edite ? edition + lignes : lignes + edition;            // pendant la création, l'éditeur passe en haut (près de la forme d'onde)
    } else if (U.onglet === 'exports') {
      corps = U.exports == null ? '<p class="lv-petit">Recherche des exports…</p>' : !U.exports.length ? '<p class="lv-petit">Aucun passage exporté pour ce morceau (Reels Audio › Exporter).</p>'
        : U.exports.map((x, i) => `<div class="lv-ligne${p && p.fichier === x.fichier ? ' on' : ''}"><button type="button" class="lv-pass" data-a="export" data-i="${i}" ${ch ? '' : 'disabled'}><b>${esc(x.nom)}</b><em>${esc(x.detail || 'fichier exporté, joué tel quel')}</em></button></div>`).join('')
          + (p && p.export ? '<button type="button" class="lv-b" data-a="retour">Revenir au morceau</button>' : '');
    }
    const listeGens = gens.map(g => { const pret = g.pret === true && (!p || g.piste === p.fichier), coul = g.sync === false ? 'gris' : !pret ? 'orange' : g.regle || g.id === e.chef ? 'vert' : 'jaune';
      const txt = g.sync === false ? 'audio coupé' : g.pret === 'dl' ? 'télécharge le morceau…' : g.pret === 'dec' ? 'prépare le morceau…' : g.pret === 'err' ? 'morceau pas chargé' : !pret ? 'pas prêt' : g.regle || g.id === e.chef ? 'prêt' : 'prêt · pas synchronisé';
      return `<div class="lv-pers${g.id === e.chef ? ' chef' : ''}"><span class="lv-voyant ${coul}" aria-hidden="true"></span><div><b>${esc(g.nom)}${g.id === L.id ? ' (toi)' : ''}${g.id === e.chef ? ' <span class="lv-tagchef">· LEAD TÉMOIN</span>' : ''}${g.type === 'invite' ? ' <span class="lv-tag">· invité</span>' : ''}</b><em>${esc(g.type === 'pc' ? 'Ordinateur' : g.os || 'Téléphone')} · ${txt}</em></div></div>`; }).join('');
    const outils = `${ch && gens.length > 1 ? `<select class="lv-champ" data-c="passer" aria-label="Passer la main"><option value="">Passer la main à…</option>${gens.filter(g => g.id !== L.id).map(g => `<option value="${esc(g.id)}">${esc(g.nom)}</option>`).join('')}</select>` : ''}
      <span class="lv-vide"></span>
      ${hote.membre && hote.inviter ? `<button type="button" class="lv-b moutarde" data-a="inviter">Inviter (QR code)</button>` : ''}
`;
    if (U.onglet === 'gens') corps = listeGens + outils;
    z('gauche').html = `<div class="lv-onglets" role="tablist">${ong.map(([id, t]) => `<button type="button" role="tab" aria-selected="${U.onglet === id}" class="lv-ong${U.onglet === id ? ' on' : ''}${id === 'gens' ? ' que-etroit' : ''}" data-a="onglet" data-o="${id}">${t}</button>`).join('')}</div><div class="lv-liste">${corps}</div>`;
    z('droite').html = `<div class="lv-tt">CONNECTÉS (${gens.length})</div>${listeGens}${outils}`;
    // --- transport et options ---
    const pos = P.position(e.cmd);
    z('transport').html = ch
      ? `<button type="button" class="lv-b vert gros" data-a="lancer">▶ LANCER</button><button type="button" class="lv-b rouge gros" data-a="stop">■ STOP</button><button type="button" class="lv-b gros" data-a="lancer" aria-label="Reprendre au début du passage">⟲ REPRENDRE</button><button type="button" class="lv-b gros bleu" data-a="reglage">SYNCHRONISER</button>`
      : `<button type="button" class="lv-b ambre gros" data-a="main">Prendre la main pour lancer</button><button type="button" class="lv-b rouge gros" data-a="stop" ${pos ? '' : 'disabled'}>■ STOP</button><button type="button" class="lv-b gros bleu" data-a="reglage">SYNCHRONISER</button>`;
    const sel = (c, vals, cur, fmt) => `<select class="lv-champ lv-opt" data-c="${c}" ${ch ? '' : 'disabled'}>${vals.map(v => `<option value="${v}"${+cur === v ? ' selected' : ''}>${fmt(v)}</option>`).join('')}</select>`;
    z('options').html = `<label><span>Décompte</span>${sel('coups', COUPS, o.coups, v => v ? v + ' coups' : 'aucun')}</label>
      <label><span>Élan</span>${sel('elan', ELANS, o.elan, v => v ? v + ' s avant' : 'aucun')}</label>
      <label><span>Vitesse</span>${sel('v', VITESSES, o.v, pc)}</label>
      <label><span>Boucle</span><button type="button" class="lv-inter${o.boucle ? ' on' : ''}" role="switch" aria-checked="${!!o.boucle}" data-a="boucle" aria-label="Rejouer le passage en boucle" ${ch ? '' : 'disabled'}><i></i></button></label>`;
    z('note').textContent = U.msg || (S.erreur ? 'La salle commune ne répond pas (' + S.erreur + '). Vérifie le réseau.' : !p ? (ch ? 'Choisis un morceau en haut.' : 'Le lead témoin n\'a pas encore choisi de morceau.') : U.charge ? 'Chargement du morceau…' : o.v !== 1 ? 'Vitesse ' + pc(o.v) + ' : la musique change de hauteur, comme un disque. Pour garder la note, joue un export de Reels Audio.' : '');
    dessinerZone(); peindreVoile();
  }

  // ---------- la forme d'onde ----------
  function dessinerOnde() {
    const cv = q('.lv-bande canvas'), b = q('.lv-bande'), w = Math.max(50, b.clientWidth), h = Math.max(30, b.clientHeight), r = Math.min(2, window.devicePixelRatio || 1);
    cv.width = w * r; cv.height = h * r; const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); if (!U.pics) return;
    g.fillStyle = '#6f64c8'; const n = U.pics.length, pas = cv.width / n, mx = Math.max(0.05, ...U.pics);
    for (let i = 0; i < n; i++) { const a = Math.max(1, U.pics[i] / mx * cv.height * 0.9); g.fillRect(i * pas, (cv.height - a) / 2, Math.max(1, pas * 0.7), a); }
  }
  function dessinerZone() {
    const d = P.buffer && U.chargee ? P.buffer.duration : 0, zo = q('[data-zone]'), x = U.edite || passage();
    z('regle').innerHTML = d ? `<span>0:00</span><span>${x.entier && !U.edite ? '' : 'ENTRÉE ' + tc(x.debut, 1) + ' · SORTIE ' + tc(x.fin, 1)}</span><span>${tc(d)}</span>` : '';
    if (!d || (x.entier && !U.edite)) { zo.style.display = 'none'; return; }
    zo.style.display = ''; zo.style.left = x.debut / d * 100 + '%'; zo.style.width = Math.max(0.3, (x.fin - x.debut) / d * 100) + '%'; zo.classList.toggle('edite', !!U.edite);
  }
  // glisser les bords orange (seulement pendant « Nouveau passage »)
  q('.lv-bande').addEventListener('pointerdown', ev => {
    const po = ev.target.closest('[data-p]');
    if (!po && U.edite && chargeOk()) { const b = q('.lv-bande').getBoundingClientRect(), t = Math.min(P.buffer.duration, Math.max(0, (ev.clientX - b.left) / b.width * P.buffer.duration));
      U.curseur = t; if (U.ecoute && !U.ecoute.boucle) ecJouer(t, false); return; }
    if (!po || !U.edite || !P.buffer) return; ev.preventDefault(); po.setPointerCapture(ev.pointerId);
    const b = q('.lv-bande').getBoundingClientRect(), d = P.buffer.duration, quoi = po.dataset.p;
    const bouge = e2 => { const t = Math.min(d, Math.max(0, (e2.clientX - b.left) / b.width * d));
      if (quoi === 'debut') U.edite.debut = Math.min(t, U.edite.fin - 0.5); else U.edite.fin = Math.max(t, U.edite.debut + 0.5);
      dessinerZone(); const a = q('#lvPd'), f = q('#lvPf'); if (a) a.value = tc(U.edite.debut, 1); if (f) f.value = tc(U.edite.fin, 1); };
    const fin = () => { po.removeEventListener('pointermove', bouge); po.removeEventListener('pointerup', fin); po.removeEventListener('pointercancel', fin); };
    po.addEventListener('pointermove', bouge); po.addEventListener('pointerup', fin); po.addEventListener('pointercancel', fin);
  });

  // ---------- le moniteur (rafraîchi en continu, sans redessiner le reste) ----------
  let dernierM = '';
  function moniteur() {
    if (!racine.isConnected) return;
    if (!U.entre || racine.offsetParent === null) { setTimeout(moniteur, 500); return; }   // onglet caché ou pas entré : on ne regarde que 2 fois par seconde
    requestAnimationFrame(moniteur);
    const e = E(), c = e.cmd, pa = passage(), pos = P.position(c), d = P.buffer && U.chargee ? P.buffer.duration : 0, tete = q('[data-tete]');
    let titre, gros, temps, qui = '', lampes = 0, total = 0;
    if (pos && pos.avant != null) { total = c.coups || 0; const dans = pos.coup <= total; titre = 'DÉCOMPTE · ' + (pa.nom || '').toUpperCase(); gros = dans ? String(pos.coup) : 'PRÊTS…'; lampes = dans ? total - pos.coup + 1 : 0; temps = tc(c.pos0, 1) + ' / ' + tc(c.fin, 1); qui = 'Lancé par ' + (c.par || '?'); }
    else if (pos) { titre = 'EN LECTURE · ' + (pa.nom || '').toUpperCase(); gros = tc(pos.pos, 1); temps = 'jusqu\'à ' + tc(c.fin, 1) + (c.boucle ? ' · en boucle' : '') + (c.v && c.v !== 1 ? ' · ' + pc(c.v) : ''); qui = 'Lancé par ' + (c.par || '?'); }
    else { titre = !P.sync ? 'AUDIO COUPÉ SUR CET APPAREIL' : chef() ? 'PRÊT À LANCER' : 'EN ATTENTE DU LEAD TÉMOIN'; gros = nomPiste(piste()) || '—'; temps = pa.entier ? ((piste() || {}).export ? 'EXPORT · ' + nomFichier(piste()) + (d ? ' · ' + tc(d) : '') : d ? 'Morceau entier · ' + tc(d) : '') : pa.nom + ' · ' + tc(pa.debut) + ' → ' + tc(pa.fin); if (c && c.type === 'stop' && c.par) qui = 'Arrêté par ' + c.par; }
    const sig = titre + '|' + gros + '|' + temps + '|' + qui + '|' + lampes + '/' + total;
    if (sig !== dernierM) { dernierM = sig; m('titre').textContent = titre; const g = m('gros'); g.textContent = gros; g.classList.toggle('texte', !pos || gros === 'PRÊTS…'); m('temps').textContent = temps; m('qui').textContent = qui;
      m('lampes').innerHTML = total ? Array.from({ length: total }, (_, i) => `<span class="${i < lampes ? 'on' : ''}"></span>`).join('') : ''; }
    if (pos && U.ecoute) ecStop();                                     // la vraie lecture passe avant l'écoute perso
    const ici = U.ecoute ? ecPos() : pos && pos.pos != null ? pos.pos : null, jo = q('[data-joue]');
    if (ici != null && d) { tete.style.display = 'block'; tete.style.left = ici / d * 100 + '%'; jo.style.display = 'block'; jo.style.width = ici / d * 100 + '%'; }
    else { jo.style.display = 'none'; tete.style.display = U.edite && U.curseur != null && d ? 'block' : 'none'; if (U.edite && U.curseur != null && d) tete.style.left = U.curseur / d * 100 + '%'; }
    const ep = q('[data-ecpos]'); if (ep) { const t = tc(U.ecoute ? ecPos() : U.curseur || 0, 1); if (ep.textContent !== t) ep.textContent = t; }
  }

  // ---------- les fenêtres : réglage des écouteurs, invitation ----------
  function peindreVoile() {
    const v = z('voile'); v.classList.toggle('hidden', !U.voile); if (!U.voile) { v.html = ''; return; }
    if (U.voile === 'inviter') {
      v.html = `<div class="lv-carte"><div class="lv-t">INVITER</div>${U.invite ? `<div class="lv-qr">${hote.qr ? hote.qr(U.invite.lien) : ''}</div><p>La personne scanne ce code avec son téléphone (iPhone ou Android). Rien à installer.</p>
        <button type="button" class="lv-b" data-a="copier">Copier le lien</button>${U.invite.cle ? '' : '<p class="lv-petit">Attention : il manque la clé gratuite Google (Notes et retours › Externe). Sans elle, les invités ne peuvent pas charger le morceau.</p>'}
        <button type="button" class="lv-b" data-a="fermerinv">Fermer les invitations</button>` : '<p>Préparation du lien…</p>'}
        <button type="button" class="lv-b vert" data-a="fermer">OK</button></div>`; return; }
    const e = E(), ch = chef(), nomChef = (S.gens().find(g => g.id === e.chef) || {}).nom || 'le lead témoin', r = U.sync;
    v.html = `<div class="lv-carte large"><div class="lv-t">SYNCHRONISER</div>
      <p>Chaque paire d'écouteurs a son propre retard. Cet appareil se cale sur le son du lead témoin (${esc(ch ? 'toi' : nomChef)}).</p>
      <div class="lv-bloc"><div class="lv-tt">1 · AUTOMATIQUE</div>
        ${ch ? '<p>Tu es le lead témoin : c\'est sur ton son que les autres se calent. Rien à faire ici. Quand quelqu\'un se synchronise, tiens ton écouteur près du micro de son téléphone.</p>'
          : `<p>Tiens <b>ton écouteur</b> et <b>l'écouteur de ${esc(nomChef)}</b> tout près du micro de cet appareil, puis touche le bouton. Tu entends deux séries de petits sifflements : ça dure 6 secondes.</p>
          <button type="button" class="lv-b vert gros" data-a="synchroniser" ${U.enSync ? 'disabled' : ''}>${U.enSync ? 'Écoute en cours…' : r ? 'Refaire' : 'Synchroniser maintenant'}</button>
          ${r ? `<p class="lv-res ${r.ok ? 'ok' : 'ko'}">${esc(r.txt)}</p>` : ''}`}
      </div>
      <div class="lv-bloc"><div class="lv-tt">2 · À L'OREILLE (SECOURS)</div>
        <p>Tous les appareils font « clic » ensemble. Mets un écouteur du lead témoin et un des tiens à tes oreilles : glisse le curseur jusqu'à n'entendre qu'un seul clic.</p>
        <button type="button" class="lv-b ${U.clics ? 'rouge' : 'vert'}" data-a="clic">${U.clics ? 'Arrêter les clics' : 'Lancer les clics chez tout le monde'}</button>
        <label class="lv-lb" for="lvCal">Mon décalage : <b data-calv></b></label>
        <input type="range" id="lvCal" min="-200" max="600" step="5" value="${P.calib}" data-c="calib">
        <div class="lv-duo"><button type="button" class="lv-b" data-a="calmoins">− 10 ms</button><button type="button" class="lv-b" data-a="calplus">+ 10 ms</button></div>
        <button type="button" class="lv-b" data-a="calzero">Remettre à zéro</button>
      </div>
      <button type="button" class="lv-b vert" data-a="fermer">Terminé</button></div>`;
    majReglage();
  }
  const majReglage = () => { const b = q('[data-calv]'), r = q('#lvCal'); if (b) b.textContent = (P.calib >= 0 ? '+' : '') + P.calib + ' ms'; if (r && document.activeElement !== r) r.value = P.calib; };
  // cet appareil ouvre son micro, écoute le clic du lead témoin et le sien, et se corrige
  async function synchroniser() {
    if (U.enSync) return; const now = H.maintenant(), temoin = E().chef;
    if (now == null) return dire('Pas d\'heure commune : vérifie le réseau.');
    if (!temoin || temoin === L.id) return;
    try { await L.cal.micro(); } catch (e) { U.sync = { ok: false, txt: 'Micro refusé ou indisponible sur cet appareil (' + (e.message || e) + '). Mets l\'appli à jour, ou règle à l\'oreille.' }; return peindreVoile(); }
    U.enSync = true; U.sync = null; peindreVoile();
    const n = Date.now(), T0 = Math.round(H.maintenant() + 2500); S.ecrire('cal', { n, cible: L.id, temoin, T0 });
    L.cal.jouer(T0, 1, L.cal.DECALE);
    let res = null; try { res = await L.cal.ecouter(T0); } catch (e) { console.warn('synchro', e); }
    L.cal.fermer(); U.enSync = false;
    if (res && res.ok) { P.regler(P.calib + res.d, true); S.presence(moi()); U.sync = { ok: true, txt: 'Synchronisé : ' + (res.d >= 0 ? '+' : '') + Math.round(res.d) + ' ms de correction.' }; }
    else U.sync = { ok: false, txt: !res ? 'La mesure n\'a pas marché. Réessaie.' : !res.temoin.ok && !res.moi.ok ? 'Je n\'ai entendu aucun des deux écouteurs. Rapproche-les du micro et monte le son.' : !res.temoin.ok ? 'Je n\'ai pas entendu l\'écouteur du lead témoin. Rapproche-le du micro.' : 'Je n\'ai pas entendu ton écouteur. Rapproche-le du micro.' };
    S.maj('cal', { res: { ok: !!(res && res.ok), d: res ? Math.round(res.d) : 0 } }); peindreVoile();
  }

  // ---------- les gestes ----------
  const actions = {
    async entrer() {
      if (!hote.membre) { const n = (q('#lvNom').value || '').trim(); if (!n) return q('#lvNom').focus(); hote.nom = n; L.outils.garde('bk.live.nom', n); }
      await P.debloquer(); U.entre = true; U.cleVue = clePiste(); chercherPassages(); dessiner();
      if (!U._suivi) { U._suivi = true; S.suivre(surSalle); } S.ouvrir(hote.salle); P.surveiller();
      S.presence(moi()); await H.suivre(); rejoindre();
      if (hote.morceaux) hote.morceaux().then(l => { U.morceaux = l; dessiner(); }).catch(() => {});
      surSalle();
    },
    onglet(b) { U.onglet = b.dataset.o; if (U.onglet === 'passages') chercherPassages(); if (U.onglet === 'exports' && U.exports == null && piste()) hote.exports(piste()).then(l => { U.exports = l; dessiner(); }).catch(() => { U.exports = []; dessiner(); }); },
    main() { S.maj('etat', { chef: L.id }); },
    sync() { P.activer(!P.sync); S.presence(moi()); rejoindre(); },
    lancer() { if (chef()) lancer(); }, stop,
    boucle() { if (chef()) S.maj('etat/opts', { ...opts(), boucle: !opts().boucle }); },
    passage(b) { if (!chef()) return; const x = [{ entier: true }, ...passagesTous()][+b.dataset.i]; choisirPassage(x.entier ? null : x); },
    nouveau() { const d = P.buffer && U.chargee === (piste() || {}).fichier ? P.buffer.duration : 0, p = passage();       // sans morceau chargé : on tape les temps à la main
      U.curseur = null; U.edite = { nom: 'Passage ' + (passagesTous().length + 1), debut: p.entier ? (d ? Math.min(d * 0.25, d - 1) : 0) : p.debut, fin: p.entier ? (d ? Math.min(d * 0.25 + 20, d) : 20) : p.fin }; },
    annuler() { ecStop(); U.edite = null; U.curseur = null; },
    ecouter() { if (U.ecoute && !U.ecoute.boucle) ecStop(); else ecJouer(U.curseur != null ? U.curseur : (U.edite || {}).debut || 0, false); },
    ecpass() { if (U.ecoute && U.ecoute.boucle) ecStop(); else ecJouer(0, true); },
    marqueI() { ecMarque('debut'); }, marqueO() { ecMarque('fin'); },
    async garder() { ecStop(); U.curseur = null; const x = U.edite, p = piste(); if (!x || !p) return; const np = { nom: (x.nom || 'Passage').trim().slice(0, 30), debut: Math.round(x.debut * 10) / 10, fin: Math.round(x.fin * 10) / 10, v: 1, source: 'live' };
      U.edite = null; try { await hote.garderPassage(p, np); const ps = await hote.passages(p); U.loc = { cle: clePiste(), liste: ps }; await S.maj('etat', { passages: ps }); if (chef()) choisirPassage(np); } catch (e) { dire('Passage non gardé : ' + (e.message || e)); } },
    async oublier(b) { const x = passagesTous()[+b.dataset.i - 1], p = piste(); if (!x || !p) return; if (b.dataset.sur !== '1') { b.dataset.sur = '1'; b.textContent = 'Sûr ?'; return; }
      try { await hote.oublierPassage(p, x); const ps = await hote.passages(p); U.loc = { cle: clePiste(), liste: ps }; await S.maj('etat', { passages: ps }); } catch (e) { dire(String(e.message || e)); } },
    export(b) { if (!chef()) return; const x = U.exports[+b.dataset.i], p = piste(); choisirPiste({ id: p.id, nom: (p.origine || p).nom + ' · export', fichier: x.fichier, nomFichier: x.nom, export: true, bpm: 0, origine: p.origine || { ...p, cle: '' } }).then(() => { U.onglet = 'exports'; hote.exports(piste()).then(l => { U.exports = l; dessiner(); }); }); },
    retour() { const p = piste(); if (chef() && p && p.origine) choisirPiste(p.origine); },
    reglage() { U.voile = 'reglage'; }, fermer() { U.voile = ''; if (!U.enSync) L.cal.fermer(); },
    async inviter() { U.voile = 'inviter'; U.invite = null; dessiner(); try { U.invite = await hote.inviter(piste(), true); await S.maj('etat', { invites: true, ...(piste() ? { piste: { ...piste(), cle: U.invite.cle || '' } } : {}) }); } catch (e) { U.voile = ''; dire('Invitation impossible : ' + (e.message || e)); } },
    async fermerinv() { U.voile = ''; try { await hote.inviter(piste(), false); await S.maj('etat', { invites: false, ...(piste() ? { piste: { ...piste(), cle: '' } } : {}) }); dire('Invitations fermées.'); } catch (e) { dire(String(e.message || e)); } },
    async copier() { try { await navigator.clipboard.writeText(U.invite.lien); dire('Lien copié.'); } catch (e) { prompt('Copie ce lien :', U.invite.lien); } },
    synchroniser() { synchroniser(); return false; },
    clic() { S.maj('etat', { clic: U.clics ? 0 : Math.round(H.maintenant() || 0) }); },
    calmoins() { P.regler(P.calib - 10); }, calplus() { P.regler(P.calib + 10); }, calzero() { P.regler(0); P.regle = 0; L.outils.garde('bk.live.regle', 0); S.presence(moi()); },
  };
  racine.addEventListener('click', async ev => { const b = ev.target.closest('[data-a]'); if (!b || b.disabled || !racine.contains(b)) return; const f = actions[b.dataset.a]; if (!f) return; const r = await f(b); if (r !== false) dessiner(); });
  racine.addEventListener('change', async ev => { const c = ev.target.dataset.c, v = ev.target.value; if (ev.target.tagName === 'SELECT') ev.target.blur();
    if (c === 'morceau' && v && chef()) { try { await choisirPiste(await hote.piste(v)); } catch (e) { dire('Morceau : ' + (e.message || e)); } }
    else if (c === 'passer' && v) S.maj('etat', { chef: v });
    else if (['coups', 'elan', 'v'].includes(c) && chef()) S.maj('etat/opts', { ...opts(), [c]: +v });
    dessiner(); });
  racine.addEventListener('input', ev => { const t = ev.target;
    if (t.dataset.c === 'calib') { P.regler(+t.value); majReglage(); }
    if (t.dataset.e && U.edite) { if (t.dataset.e === 'nom') U.edite.nom = t.value; else { const s = enSec(t.value), d = P.buffer && U.chargee ? P.buffer.duration : 36000; if (!isNaN(s)) { U.edite[t.dataset.e] = Math.min(d, Math.max(0, s)); if (U.edite.fin < U.edite.debut + 0.5) U.edite.fin = Math.min(d, U.edite.debut + 0.5); dessinerZone(); } } } });
  window.addEventListener('resize', dessinerOnde); window.addEventListener('pagehide', () => S.partir());
  P.fin = dessiner;
  peindre(); requestAnimationFrame(moniteur);
  // pour la barre d'espace du logiciel : lance si rien ne joue, arrête sinon (le chef seulement pour lancer)
  const basculer = () => { if (!U.entre) return; if (P.position(E().cmd)) stop(); else if (chef()) lancer(); dessiner(); };
  return { dessiner, U, basculer };
};
})();
