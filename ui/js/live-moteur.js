// =====================================================================
// SYNCH BREAD (ex « Live ») — le moteur du playback synchronisé (tout le monde entend la même musique au même moment).
// Ce fichier ne dépend PAS du reste de BEESKOT Studio : il sert à l'onglet Live (modules/live.js)
// ET à la page des invités (ui/live/index.html). L'écran est dans js/live-ecran.js.
//
//   BKLive.horloge   l'heure commune (celle du serveur), à quelques millisecondes près
//   BKLive.salle     la « salle commune » : ce que tout le monde voit en direct (qui est là, quoi jouer, quand)
//   BKLive.lecteur   joue le morceau pile à l'heure prévue, et se recale tout seul
//   BKLive.cal       « Synchroniser » : chaque appareil écoute, avec son micro, le clic du lead témoin et le sien, et se cale
//
// La salle commune est une base Firebase Realtime Database (gratuite), lue et écrite par simples
// requêtes web (pas de bibliothèque à installer). Si l'adresse change : la ligne BASE seulement.
// Règles à coller dans Firebase :  { "rules": { "live": { "$salle": { ".read": true, ".write": true } } } }
// =====================================================================
(() => {
const L = window.BKLive = {};
L.BASE = 'https://beeskot-studio-12c09-default-rtdb.firebaseio.com';
try { const b = localStorage.getItem('bk.live.base'); if (b) L.BASE = b; } catch (e) {}

// ----- les réglages faciles à changer -----
L.R = {
  AVANCE: 2500,          // ms entre l'appui sur Lancer et le premier coup du décompte (le temps que tout le monde reçoive l'ordre)
  ECART_MAX: 0.03,       // s : au-delà de cet écart, le lecteur se recale
  SURVEILLE: 1500,       // ms entre deux vérifications du recalage
  PRESENCE: 10000,       // ms entre deux « je suis là »
  ABSENT: 28000,         // ms sans nouvelle = plus là
  PERIME: 3 * 3600e3,    // ms : un ordre « Lancer » plus vieux que ça est oublié (une boucle laissée tourner ne repart pas le lendemain)
  CAL_COUPS: [0, 430, 940, 1410, 1990, 2460, 3050, 3520],   // ms : les bips du réglage (écarts irréguliers = pas de confusion possible)
  CAL_CONFIANCE: 4,      // le pic doit dépasser N fois le bruit, sinon la mesure est « ratée »
};

const perf = () => performance.now();
const garde = (k, v) => { try { v === undefined ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const lu = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const mediane = a => { const b = [...a].sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 0; };
L.outils = { garde, lu, mediane };
L.id = lu('bk.live.id', '') || (() => { const i = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); garde('bk.live.id', i); return i; })();

// ---------- LA SALLE COMMUNE ----------
// d = la copie locale de la salle, tenue à jour en direct. Structure :
//   etat : { piste, passages, passage, opts, chef, cmd, clic, invites }     gens/<id> : { nom, type, pret, sync, regle, vu }
//   cal  : { n, cible, temoin, T0 } puis { …, res: { ok, d } }
L.salle = {
  code: '', d: {}, es: null, connecte: false, erreur: '', suiveurs: new Set(),
  url(chemin = '') { return `${L.BASE}/live/${this.code}${chemin ? '/' + chemin : ''}.json`; },
  suivre(f) { this.suiveurs.add(f); return () => this.suiveurs.delete(f); },
  prevenir(quoi) { for (const f of this.suiveurs) { try { f(quoi); } catch (e) { console.error(e); } } },
  // envoi sans « pré-vérification » du navigateur (POST simple + paramètre) : un aller-retour au lieu de deux
  async envoyer(methode, chemin, v) {
    const r = await fetch(this.url(chemin) + '?x-http-method-override=' + methode, { method: 'POST', body: JSON.stringify(v), cache: 'no-store' });
    if (!r.ok) throw new Error('salle commune : ' + r.status);
    return r.json();
  },
  // les écritures partent une par une, dans l'ordre (sinon deux ordres rapprochés pourraient arriver à l'envers)
  file(f) { return this._q = (this._q || Promise.resolve()).then(f).catch(e => this.panne(e)); },
  ecrire(chemin, v) { this.poser(chemin, v); this.prevenir(chemin); return this.file(() => this.envoyer('PUT', chemin, v)); },
  maj(chemin, o) { for (const k in o) this.poser((chemin ? chemin + '/' : '') + k, o[k]); this.prevenir(chemin); return this.file(() => this.envoyer('PATCH', chemin, o)); },
  panne(e) { this.erreur = String(e && e.message || e); this.prevenir('!'); },
  poser(chemin, v) {
    const p = String(chemin).split('/').filter(Boolean);
    if (!p.length) { this.d = v || {}; return; }
    let o = this.d; for (let i = 0; i < p.length - 1; i++) { if (typeof o[p[i]] !== 'object' || o[p[i]] === null) o[p[i]] = {}; o = o[p[i]]; }
    if (v === null || v === undefined) delete o[p[p.length - 1]]; else o[p[p.length - 1]] = v;
  },
  ouvrir(code) {
    this.fermer(); this.code = code; this.d = {}; this.erreur = '';
    const es = this.es = new EventSource(this.url());
    const recu = fusion => ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } if (!m) return;
      if (fusion && m.data && typeof m.data === 'object') for (const k in m.data) this.poser(m.path + '/' + k, m.data[k]); else this.poser(m.path, m.data);
      this.connecte = true; this.erreur = ''; this.prevenir(m.path); };
    es.addEventListener('put', recu(false)); es.addEventListener('patch', recu(true));
    es.addEventListener('cancel', () => this.panne('accès refusé (règles Firebase)'));
    es.onopen = () => { this.connecte = true; this.erreur = ''; this.prevenir('!'); };
    es.onerror = () => { this.connecte = false; this.prevenir('!'); };          // le navigateur se reconnecte tout seul
  },
  fermer() { if (this.es) this.es.close(); this.es = null; this.connecte = false; clearInterval(this._p); },
  etat() { return this.d.etat || {}; },
  gens() { const now = L.horloge.maintenant() || 0, g = this.d.gens || {};
    return Object.keys(g).map(id => ({ id, ...g[id], la: !g[id].vu || !now || now - g[id].vu < L.R.ABSENT })).filter(x => x.nom && x.la)
      .sort((a, b) => (a.type === 'invite') - (b.type === 'invite') || String(a.nom).localeCompare(String(b.nom))); },
  // « je suis là » : ma fiche, rafraîchie toutes les 10 s
  presence(fiche) {
    this.moi = { ...(this.moi || {}), ...fiche };
    const battre = () => this.file(() => this.envoyer('PATCH', 'gens/' + L.id, { ...this.moi, vu: { '.sv': 'timestamp' } }));
    this.poser('gens/' + L.id, { ...((this.d.gens || {})[L.id] || {}), ...this.moi }); this.prevenir('gens');
    clearInterval(this._p); this._p = setInterval(battre, L.R.PRESENCE); return battre();
  },
  partir() { clearInterval(this._p); try { fetch(this.url('gens/' + L.id) + '?x-http-method-override=DELETE', { method: 'POST', keepalive: true }); } catch (e) {} },
};

// ---------- L'HEURE COMMUNE ----------
// On demande l'heure au serveur plusieurs fois et on garde la réponse la plus rapide (la plus fiable).
L.horloge = {
  decal: null, rtt: null, ech: [],
  maintenant() { return this.decal == null ? null : perf() + this.decal; },
  async une() {
    const t0 = perf(); let srv = await L.salle.envoyer('PUT', 'h/' + L.id, { '.sv': 'timestamp' }); const t1 = perf();
    if (typeof srv !== 'number') srv = await (await fetch(L.salle.url('h/' + L.id), { cache: 'no-store' })).json();
    if (typeof srv !== 'number') throw new Error('heure du serveur illisible');
    return { rtt: t1 - t0, decal: srv - (t0 + t1) / 2, t: t1 };
  },
  async mesurer(n = 5) {
    for (let i = 0; i < n; i++) { try { const e = await this.une(); if (e.rtt < 1500) this.ech.push(e); } catch (e) { L.salle.panne(e); } }
    const vieux = perf() - 90000; this.ech = this.ech.filter(e => e.t > vieux).slice(-24);      // les horloges dérivent : on oublie les vieilles mesures
    if (!this.ech.length) return false;
    const m = this.ech.reduce((a, b) => (b.rtt < a.rtt ? b : a));
    // on ne change d'avis que pour une mesure meilleure (ou quand la nôtre a plus de 3 minutes) : l'heure ne « saute » pas pour rien
    if (this.decal == null || m.rtt <= this.rtt || perf() - this.tm > 180000) { this.decal = m.decal; this.rtt = m.rtt; this.tm = m.t; }
    return true;
  },
  suivre() { clearInterval(this._t); this._t = setInterval(() => this.mesurer(2), 20000); return this.mesurer(8); },
  arreter() { clearInterval(this._t); },
};

// ---------- LE LECTEUR ----------
L.lecteur = {
  ctx: null, buffer: null, plan: null, sync: lu('bk.live.sync', true), calib: lu('bk.live.calib', 0), regle: lu('bk.live.regle', 0),
  deltas: [], fin: null,
  contexte() { if (!this.ctx) { this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' }); this.sortie = this.ctx.createGain(); this.sortie.connect(this.ctx.destination); } return this.ctx; },
  // à appeler dans un appui de doigt : le navigateur n'autorise le son qu'après un geste (et l'iPhone en mode silencieux a besoin d'un vrai lecteur qui tourne)
  async debloquer() {
    const c = this.contexte(); if (c.state !== 'running') { try { await c.resume(); } catch (e) {} }
    if (!this._muet) { try {                                          // une seconde de vrai silence, en boucle
      const n = 8000, o = new Uint8Array(44 + n).fill(128), v = new DataView(o.buffer), txt = (i, t) => { for (let k = 0; k < t.length; k++) o[i + k] = t.charCodeAt(k); };
      txt(0, 'RIFF'); v.setUint32(4, 36 + n, true); txt(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); txt(36, 'data'); v.setUint32(40, n, true);
      const a = this._muet = new Audio(URL.createObjectURL(new Blob([o], { type: 'audio/wav' }))); a.loop = true; a.setAttribute('playsinline', ''); a.play().catch(() => {}); } catch (e) {} }
    this.ecran(true); return c.state === 'running';
  },
  pret() { return !!(this.ctx && this.ctx.state === 'running'); },
  // l'écran reste allumé tant que le Live est ouvert
  async ecran(on) { try { if (on && navigator.wakeLock && document.visibilityState === 'visible') this._wl = await navigator.wakeLock.request('screen'); if (!on && this._wl) { this._wl.release(); this._wl = null; } } catch (e) {} },
  async charger(octets) {
    const c = this.contexte(), ab = octets instanceof ArrayBuffer ? octets : octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength);
    this.buffer = await new Promise((ok, ko) => { const p = c.decodeAudioData(ab, ok, ko); if (p && p.catch) p.catch(ko); });
    return this.buffer;
  },
  pics(n) { const b = this.buffer; if (!b) return null; const d = b.getChannelData(0), pas = Math.max(1, Math.floor(d.length / n)), out = new Float32Array(n);
    for (let i = 0; i < n; i++) { let mx = 0; for (let j = i * pas, f = Math.min(d.length, j + pas); j < f; j += 16) { const v = Math.abs(d[j]); if (v > mx) mx = v; } out[i] = mx; } return out; },

  // le lien entre l'horloge du son et l'horloge de l'ordinateur (médiane de plusieurs lectures : stable)
  relever() {
    const c = this.ctx; if (!c) return; let base; const ts = c.getOutputTimestamp ? c.getOutputTimestamp() : null;
    if (ts && ts.performanceTime > 0 && ts.contextTime > 0) base = ts.contextTime - ts.performanceTime / 1000;          // l'instant du son qu'on ENTEND maintenant
    else base = c.currentTime - (c.outputLatency || c.baseLatency || 0) - perf() / 1000;
    this.deltas.push(base); if (this.deltas.length > 15) this.deltas.shift();
  },
  // à quel instant (horloge du son) programmer un son pour qu'il soit ENTENDU à l'heure commune srvMs
  quand(srvMs) {
    if (!this.deltas.length) this.relever();
    return mediane(this.deltas) + (srvMs - L.horloge.decal) / 1000 - this.calib / 1000;
  },
  bip(srvMs, aigu) {
    const c = this.ctx, t = this.quand(srvMs); if (!c || t < c.currentTime) return;
    const o = c.createOscillator(), g = c.createGain(); o.type = 'square'; o.frequency.value = aigu ? 1760 : 880;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.002); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    o.connect(g); g.connect(this.sortie); o.start(t); o.stop(t + 0.09); (this.bips = this.bips || []).push(o);
  },
  couper() {
    const c = this.ctx; clearTimeout(this._fin);
    for (const s of [this.src, ...(this.bips || [])]) if (s) { try { s.onended = null; s.stop(); } catch (e) {} }
    if (this.gain && c) { try { this.gain.disconnect(); } catch (e) {} }
    this.src = null; this.bips = []; this.plan = null;
  },
  // cmd = { n, type:'play', t0 (heure commune du début de la musique), pos0, fin, v, boucle, coups, inter, par }
  jouer(cmd) {
    this.couper(); const c = this.ctx, h = L.horloge;
    if (!c || !this.buffer || h.decal == null || !this.sync || !cmd || cmd.type !== 'play' || h.maintenant() - cmd.t0 > L.R.PERIME) return false;
    this.relever();
    const now = h.maintenant(), v = cmd.v || 1, fin = Math.min(cmd.fin || this.buffer.duration, this.buffer.duration), pos0 = Math.max(0, cmd.pos0 || 0), len = fin - pos0;
    if (len <= 0.05) return false;
    for (let k = 1; k <= (cmd.coups || 0); k++) { const tk = cmd.t0 - k * (cmd.inter || 500); if (tk > now + 40) this.bip(tk, k === 1); }
    let srvDebut = cmd.t0, offset = pos0;
    if (now + 150 > cmd.t0) {                                          // la musique a déjà commencé : on la rejoint au bon endroit
      srvDebut = now + 150; let p = (srvDebut - cmd.t0) / 1000 * v;
      if (cmd.boucle) p %= len; else if (p >= len) return false;
      offset = pos0 + p;
    }
    const s = this.src = c.createBufferSource(), g = this.gain = c.createGain(), t = this.quand(srvDebut);
    s.buffer = this.buffer; s.playbackRate.value = v; s.connect(g); g.connect(this.sortie);
    g.gain.setValueAtTime(0, Math.max(c.currentTime, t)); g.gain.linearRampToValueAtTime(1, Math.max(c.currentTime, t) + 0.012);
    if (cmd.boucle) { s.loop = true; s.loopStart = pos0; s.loopEnd = fin; s.start(t, offset); }
    else { s.start(t, offset, fin - offset); this._fin = setTimeout(() => { if (this.plan && this.plan.cmd === cmd) { this.plan = null; this.fin && this.fin(); } }, (srvDebut - now) + (fin - offset) / v * 1000 + 200); }
    this.plan = { cmd, t, srvDebut, offset, calib: this.calib };
    return true;
  },
  // la position dans le morceau (secondes) à l'heure commune, pour l'affichage. null = rien ne joue
  position(cmd) {
    const now = L.horloge.maintenant(); if (!cmd || cmd.type !== 'play' || now == null || now - cmd.t0 > L.R.PERIME) return null;
    const v = cmd.v || 1, len = (cmd.fin || 0) - (cmd.pos0 || 0);
    if (now < cmd.t0) return { avant: cmd.t0 - now, coup: Math.ceil((cmd.t0 - now) / (cmd.inter || 500)) };
    let p = (now - cmd.t0) / 1000 * v; if (cmd.boucle && len > 0) p %= len; else if (p >= len) return null;
    return { pos: (cmd.pos0 || 0) + p };
  },
  // toutes les 1,5 s : si l'heure prévue a bougé (horloge affinée, réglage changé, dérive), on recale
  surveiller() {
    clearInterval(this._s); this._s = setInterval(() => {
      if (!this.ctx) return; this.relever();
      const p = this.plan; if (!p) return;
      if (Math.abs(this.quand(p.srvDebut) - p.t) > L.R.ECART_MAX || p.calib !== this.calib) this.jouer(p.cmd);
    }, L.R.SURVEILLE);
  },
  regler(ms, mesure) { this.calib = Math.round(ms); garde('bk.live.calib', this.calib); if (mesure) { this.regle = Date.now(); garde('bk.live.regle', this.regle); } if (this.plan) this.jouer(this.plan.cmd); },
  activer(on) { this.sync = !!on; garde('bk.live.sync', this.sync); if (!on) { this.couper(); this.clic(false); } },
  // le test « côte à côte » : un clic à chaque seconde pile de l'heure commune (tous les téléphones doivent cliquer ensemble)
  clic(on) {
    clearInterval(this._c); this._dernier = 0; if (!on) return;
    const pousser = () => { const now = L.horloge.maintenant(); if (now == null || !this.pret() || !this.sync) return; this.relever();
      for (let s = Math.ceil((now + 120) / 1000) * 1000; s < now + 1600; s += 1000) if (s > this._dernier) { this._dernier = s; this.bip(s, (s / 1000) % 4 === 0); } };
    this._c = setInterval(pousser, 400); pousser();
  },
};
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && L.lecteur.pret()) L.lecteur.ecran(true); });

// ---------- SYNCHRONISER (chaque appareil se cale tout seul sur le « lead témoin ») ----------
// L'appareil qui se synchronise ouvre SON micro. Le lead témoin joue 8 petits sifflements graves ; l'appareil
// joue les siens, plus aigus, un peu après (DECALE). Avec son micro il entend les deux (l'écouteur du témoin et
// le sien, tenus près du micro), mesure l'écart entre les deux et se corrige. Le retard du micro ne compte pas :
// il est le même pour les deux sons.
L.cal = {
  flux: null, blocs: [], VOIES: [[1000, 2200], [2600, 3800]], DUREE: 0.03, DECALE: 215,     // voie 0 = le témoin (grave), voie 1 = l'appareil qui se cale (aigu)
  // le sifflement d'une voie (sa fréquence monte), et sa version décalée d'un quart de tour (pour mesurer la force sans se soucier de la phase).
  // Les deux voies n'utilisent pas les mêmes fréquences : on les reconnaît même si l'une est bien plus forte que l'autre.
  gabarit(sr, quart, voie) { const [f1, f2] = this.VOIES[voie ? 1 : 0], n = Math.round(this.DUREE * sr), y = new Float32Array(n), k = (f2 - f1) / this.DUREE;
    for (let i = 0; i < n; i++) { const t = i / sr, ph = 2 * Math.PI * (f1 * t + k * t * t / 2), w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)); y[i] = w * (quart ? Math.cos(ph) : Math.sin(ph)); }
    return y; },
  // joue les 8 sifflements à partir de l'heure commune T0 (+ decale ms), par le chemin de son habituel (avec le réglage du moment)
  jouer(T0, voie, decale = 0) {
    const lec = L.lecteur, c = lec.ctx; if (!c) return false; lec.relever();
    const g = this.gabarit(c.sampleRate, false, voie), b = c.createBuffer(1, g.length, c.sampleRate); b.getChannelData(0).set(g);
    for (const o of L.R.CAL_COUPS) { const s = c.createBufferSource(); s.buffer = b; s.connect(lec.sortie); const t = lec.quand(T0 + o + decale); if (t > c.currentTime) s.start(t); }
    return true;
  },
  // ouvre le micro (sans les « améliorations » du téléphone, qui déforment le son)
  async micro() {
    if (this.flux) return true; const c = L.lecteur.contexte();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('micro indisponible ici');
    this.flux = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
    const src = c.createMediaStreamSource(this.flux), n = this.noeud = c.createScriptProcessor(4096, 1, 1), muet = c.createGain(); muet.gain.value = 0;
    n.onaudioprocess = e => { if (this.enr) this.blocs.push({ t: e.playbackTime, d: new Float32Array(e.inputBuffer.getChannelData(0)) }); };
    src.connect(n); n.connect(muet); muet.connect(c.destination); this._src = src; return true;
  },
  fermer() { if (this.flux) this.flux.getTracks().forEach(t => t.stop()); try { this._src.disconnect(); this.noeud.disconnect(); } catch (e) {} this.flux = null; this.enr = false; },
  // enregistre autour des sifflements attendus à partir de T0, puis mesure les deux séries.
  // Renvoie { ok, d (ms : de combien CET appareil est en retard sur le témoin), temoin, moi }
  async ecouter(T0) {
    const c = L.lecteur.ctx, h = L.horloge, dernier = L.R.CAL_COUPS[L.R.CAL_COUPS.length - 1];
    this.blocs = []; this.enr = true;
    const ds = []; const rel = setInterval(() => ds.push(c.currentTime - perf() / 1000), 60);
    await new Promise(r => setTimeout(r, Math.max(0, T0 - h.maintenant()) + dernier + this.DECALE + 1300));
    clearInterval(rel); this.enr = false;
    const blocs = this.blocs; this.blocs = []; const rate = { ok: false, d: 0, conf: 0 }; if (!blocs.length) return { ok: false, d: 0, temoin: rate, moi: rate };
    const sr = c.sampleRate, t0 = blocs[0].t, total = Math.round((blocs[blocs.length - 1].t - t0) * sr) + blocs[blocs.length - 1].d.length, rec = new Float32Array(total);
    for (const b of blocs) { const i = Math.round((b.t - t0) * sr); if (i >= 0 && i + b.d.length <= total) rec.set(b.d, i); }
    const dm = mediane(ds), att = dec => L.R.CAL_COUPS.map(o => (dm + (T0 + o + dec - h.decal) / 1000 - t0) * sr);
    const temoin = await this.detecter(rec, sr, att(0), 0), moi = await this.detecter(rec, sr, att(this.DECALE), 1);
    return { ok: temoin.ok && moi.ok, d: moi.d - temoin.d, temoin, moi };
  },
  // le calcul (sans micro : testable tout seul). attendus = la position prévue de chaque bip dans l'enregistrement (en échantillons)
  async detecter(rec, sr, attendus, voie = 0, min = -0.25, max = 0.8) {
    const q = Math.max(1, Math.round(sr / 12000)), srq = sr / q, n = Math.floor(rec.length / q), x = new Float32Array(n);
    for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < q; j++) s += rec[i * q + j]; x[i] = s / q; }      // on allège : 12 000 points par seconde suffisent
    const a = this.gabarit(srq, false, voie), b = this.gabarit(srq, true, voie), m = a.length, l0 = Math.round(min * srq), l1 = Math.round(max * srq), N = l1 - l0 + 1, score = new Float32Array(N), parBip = [];
    let energie = 0; for (let i = 0; i < n; i++) energie += x[i] * x[i];
    for (const att of attendus) { const base = Math.round(att / q), sc = new Float32Array(N); parBip.push(sc);
      for (let l = l0; l <= l1; l++) { const p = base + l; if (p < 0 || p + m > n) continue; let s1 = 0, s2 = 0;
        for (let i = 0; i < m; i++) { const v = x[p + i]; s1 += v * a[i]; s2 += v * b[i]; }
        sc[l - l0] = Math.sqrt(s1 * s1 + s2 * s2); score[l - l0] += sc[l - l0]; }
      await new Promise(r => setTimeout(r, 0)); }                       // par petits bouts : l'appareil ne bloque pas
    let im = 0; for (let i = 1; i < N; i++) if (score[i] > score[im]) im = i;
    const bruit = mediane(score) || 1e-9, conf = score[im] / bruit;
    // garde-fous : pas de silence total, et le bip doit être retrouvé au même endroit dans la plupart des 8 bips (pas un bruit isolé)
    let vus = 0; for (const sc of parBip) { const md = mediane(sc) || 1e-9; let mx = 0; for (let i = Math.max(0, im - 3); i <= Math.min(N - 1, im + 3); i++) if (sc[i] > mx) mx = sc[i]; if (mx > 2.5 * md) vus++; }
    const sain = Math.sqrt(energie / Math.max(1, n)) > 1e-5 && vus >= Math.ceil(attendus.length * 0.6);
    let fin = 0; if (im > 0 && im < N - 1) { const y0 = score[im - 1], y1 = score[im], y2 = score[im + 1], den = y0 - 2 * y1 + y2; if (den) fin = 0.5 * (y0 - y2) / den; }
    return { ok: sain && conf >= L.R.CAL_CONFIANCE, d: (im + fin + l0) / srq * 1000, conf: Math.min(conf, 9999), vus };
  },
};
})();
