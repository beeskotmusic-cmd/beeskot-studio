// =====================================================================
// LIGHT TOAST — la TIMELINE (façon logiciel de montage).
//
//   ┌ en-têtes ┐┌──────────── règle (temps, entrée/sortie) ─────────────┐
//   │ Pêches   ││  ▌    ▌     ▌                                         │
//   │ Effets 2 ││  [Strobo · 1-4]   [Scanner    ]   ← agit sur le dessous │
//   │ Effets 1 ││  [Plasma · tous ]  [Flamme · 2]                       │
//   │ Couleur  ││                                                       │
//   │   Tube 1 ││  [■ orange          ][■ violet   ]  ← un clip peut     │
//   │   Tube 2 ││  [■ orange          ][■ rouge    ]    couvrir plusieurs │
//   │ courbes  ││  ───◆─────◆──                          lumières        │
//   └──────────┘└───────────────────────────────────────────────────────┘
//
// Tout est dessiné dans un canvas (rapide), les en-têtes sont de vrais boutons.
// Souris : clic = curseur / sélection ; glisser un clip = le déplacer (même sur une
// autre piste du même genre) ; glisser un bord = durée ; double-clic dans le vide = nouveau clip.
// Molette = avancer dans le temps, Maj + molette = monter / descendre, Ctrl ou Alt + molette = zoom.
// =====================================================================
(function (G) {
const LT = G.LT;
const EN_TETE = 150, REGLE = 26, BORD = 9, AIMANT = 8;
const COUL = { peche: '#ff5fa2', effet: '#8a6be0', overlay: '#2f8f86', sel: '#a6f0e6', curseur: '#ffb23e', courbe: { lum: '#7be0ff', elum: '#ff9ad5', plum: '#c58bff', vitesse: '#9ad14b' } };
const NOM_COURBE = { lum: 'Lum. générale', elum: 'Force effets', plum: 'Lum. pêches', vitesse: 'Vitesse' };
const fmt = (t, fin) => { const sg = t < -1e-6 ? '-' : ''; t = Math.abs(t); const m = Math.floor(t / 60 + 1e-6), s = Math.max(0, t - m * 60); return sg + m + ':' + (s < 10 ? '0' : '') + s.toFixed(fin ? 1 : 0); };

class Timeline {
  constructor(m, racine) {
    this.m = m; this.debut = 0; this.pps = 60;            // pixels par seconde (zoom)
    racine.innerHTML = `<div class="lt2-regle"><div class="lt2-coin"></div><canvas></canvas></div>
      <div class="lt2-corps"><div class="lt2-tetes"></div><canvas class="lt2-pistes"></canvas></div>`;
    this.r = racine; this.cvR = racine.querySelector('.lt2-regle canvas'); this.corps = racine.querySelector('.lt2-corps');
    this.tetes = racine.querySelector('.lt2-tetes'); this.cv = racine.querySelector('.lt2-pistes');
    this.souris();
    new ResizeObserver(() => this.redessiner()).observe(racine);
  }

  // ---------- la liste des pistes, calculée depuis le projet ----------
  pistes() {
    const P = this.m.projet, L = [];
    L.push({ sorte: 'peches', nom: 'Pêches', h: 26, liste: P.peches.clips });
    [...P.effets].reverse().forEach(e => L.push({ sorte: 'effets', nom: e.nom, h: 30, liste: e.clips, piste: e }));   // la plus haute en premier
    L.push({ sorte: 'titre', nom: 'Couleur', h: 16 });
    P.materiel.zones.forEach(z => L.push({ sorte: 'couleur', nom: z.nom, h: 22, liste: P.couleur.clips, zone: z }));
    ['lum', 'elum', 'plum', 'vitesse'].forEach(k => L.push({ sorte: 'courbe', nom: NOM_COURBE[k], h: 34, cle: k, pts: P.courbes[k] }));
    L.push({ sorte: 'audio', nom: (P.musique && P.musique.nom) || 'Audio', h: 48 });
    (P.stems || []).forEach(st => L.push({ sorte: 'stem', nom: st.nom, h: 40, stem: st, liste: P.declencheurs || (P.declencheurs = []) }));
    let y = 0; L.forEach(p => { p.y = y; y += p.h + 1; });
    this.L = L; this.hTotal = y; return L;
  }
  famille(s) { return s; }
  // les clips visibles sur une ligne (la couleur : seulement ceux qui touchent cette lumière)
  clipsDe(p) { return p.sorte === 'couleur' ? p.liste.filter(k => k.zones.includes(p.zone.id)) : p.sorte === 'stem' ? p.liste.filter(k => k.stem === p.stem.id) : p.liste || []; }

  // ---------- temps ↔ pixels ----------
  x(t) { return (t - this.debut) * this.pps; }
  t(x) { return this.debut + x / this.pps; }
  min() { return this.m.debutMin(); }
  zoomer(f, xAncre) {
    const ta = this.t(xAncre ?? this.cv.clientWidth / 2);
    this.pps = Math.max(4, Math.min(2000, this.pps * f));
    this.debut = Math.max(this.min(), ta - (xAncre ?? this.cv.clientWidth / 2) / this.pps); this.redessiner();
  }
  toutVoir() { const a = this.min(), d = (this.m.duree() || 10) - a; this.pps = Math.max(4, (this.cv.clientWidth - 20) / d); this.debut = a; this.redessiner(); }
  suivre(t) { const w = this.cv.clientWidth; if (this.x(t) > w - 40 || this.x(t) < 0) { this.debut = Math.max(this.min(), t - 40 / this.pps); } }

  // ---------- les en-têtes (vrais boutons) ----------
  tetesHTML() {
    const cle = this.L.map(p => p.sorte + p.nom).join('|') + this.m.projet.effets.map(e => e.muet).join() + this.m.son.muet + this.m.stemChoisi + [...this.m.son.stems.values()].map(s => s.ecoute).join();
    if (cle === this._cle) return; this._cle = cle;
    this.tetes.innerHTML = this.L.map((p, i) => {
      let b = '';
      if (p.sorte === 'effets') b = `<button class="lt2-tb${p.piste.muet ? ' off' : ''}" data-a="muet" data-i="${i}" title="Couper / remettre cette piste">${p.piste.muet ? '◌' : '●'}</button>`;
      if (p.sorte === 'audio') b = `<button class="lt2-tb${this.m.son.muet ? ' off' : ''}" data-a="sonmuet" title="Couper / remettre le son du morceau">${this.m.son.muet ? '◌' : '●'}</button>`;
      if (p.sorte === 'stem') { const r = this.m.son.stems.get(p.stem.id); b = `<button class="lt2-tb${r && r.ecoute ? ' on' : ''}" data-a="ecoute" data-i="${i}" title="${r ? 'Écouter ce stem pendant la lecture' : 'Le son de ce stem n\'est plus chargé (ses coups sont gardés)'}"${r ? '' : ' disabled'}>🎧</button>`; }
      const ch = p.sorte === 'stem' && this.m.stemChoisi === p.stem.id ? ' choisi' : '';
      const fin = p.sorte === 'audio' ? '<button class="lt2-tb" data-a="stem" title="Ajouter des stems (kick, caisse claire, basse…)">+ stem</button>' : '';
      return `<div class="lt2-tete s-${p.sorte}${ch}" data-i="${i}" style="top:${p.y}px;height:${p.h}px">${b}<span${p.stem ? ` style="color:${p.stem.couleur}"` : ''}>${p.nom}</span>${fin}${p.sorte === 'effets' && p.piste === this.m.projet.effets.at(-1) ? '<button class="lt2-tb" data-a="plus" title="Ajouter une piste d\'effets">+</button>' : ''}</div>`;
    }).join('');
    this.tetes.style.height = this.hTotal + 'px';
  }

  // ---------- dessin ----------
  redessiner() { if (!this._rq) this._rq = requestAnimationFrame(() => { this._rq = 0; this.dessiner(); }); }
  dessiner() {
    const dpr = devicePixelRatio || 1, L = this.pistes(); this.tetesHTML();
    const W = this.cv.clientWidth || this.r.clientWidth - EN_TETE, H = this.hTotal;
    for (const [cv, h] of [[this.cv, H], [this.cvR, REGLE]]) {
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(h * dpr); cv.style.height = h + 'px'; }
    }
    const m = this.m, sel = m.selection, c = this.cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    // grille : les temps (battements si le tempo est connu)
    const pasG = this.pas(), g0 = this.m.projet.grille || 0, mesure = 240 / (this.m.projet.bpm || 120);
    for (let t = g0 + Math.floor((this.debut - g0) / pasG) * pasG; this.x(t) < W; t += pasG) {
      const surMesure = Math.abs(((t - g0) / mesure) - Math.round((t - g0) / mesure)) < 1e-4;
      c.fillStyle = surMesure ? 'rgba(255,255,255,.09)' : 'rgba(255,255,255,.035)'; c.fillRect(Math.round(this.x(t)), 0, 1, H);
    }
    for (const p of L) {
      if (p.sorte === 'titre') { c.fillStyle = 'rgba(255,255,255,.04)'; c.fillRect(0, p.y, W, p.h); continue; }
      c.fillStyle = p.sorte === 'couleur' ? 'rgba(0,0,0,.3)' : 'rgba(0,0,0,.18)'; c.fillRect(0, p.y, W, p.h);
      if (p.sorte === 'courbe') this.dessinerCourbe(c, p, W);
      else if (p.sorte === 'audio') this.dessinerOnde(c, p, W);
      else if (p.sorte === 'stem') { this.dessinerStem(c, p, W); for (const k of this.clipsDe(p)) this.dessinerDecl(c, p, k, sel.has(k.id), W); }
      else if (p.liste && p.sorte !== 'couleur') for (const k of p.liste) this.dessinerClip(c, p, k, sel.has(k.id), W);
    }
    this.dessinerCouleurs(c, L.filter(p => p.sorte === 'couleur'), W);
    // sélection au rectangle
    if (this.cadre && this.cadre.bouge) { const q = this.cadre; c.fillStyle = 'rgba(166,240,230,.1)'; c.strokeStyle = '#a6f0e6'; c.lineWidth = 1; c.fillRect(q.xa, q.ya, q.xb - q.xa, q.yb - q.ya); c.strokeRect(q.xa + .5, q.ya + .5, q.xb - q.xa, q.yb - q.ya); }
    // le décompte : zone hachurée avant le début
    const dc = LT.decompte.fenetre(m.projet);
    if (dc) { const a = this.x(dc.debut), b = this.x(dc.fin); c.save(); c.beginPath(); c.rect(a, 0, b - a, H); c.clip(); c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(a, 0, b - a, H); c.strokeStyle = 'rgba(255,184,77,.25)'; c.lineWidth = 2;
      for (let x = a - H; x < b; x += 10) { c.beginPath(); c.moveTo(x, H); c.lineTo(x + H, 0); c.stroke(); }
      c.fillStyle = '#ffb84d'; c.font = '600 11px "Work Sans"'; for (let i = 0; i < dc.coups; i++) { const xx = this.x(dc.debut + i * dc.temps); c.fillRect(xx, 0, 1, H); c.fillText(i + 1 === dc.coups ? 'GO' : String(i + 1), xx + 4, 12); } c.restore(); }
    // entrée / sortie
    const { entree: e, sortie: s } = m;
    if (e != null || s != null) { c.fillStyle = 'rgba(255,178,62,.07)'; const a = this.x(e ?? 0), b = this.x(s ?? m.duree()); c.fillRect(a, 0, b - a, H); }
    // là où on va déposer
    if (this.survolDepot && this.survolDepot.p) { const p = this.survolDepot.p; c.strokeStyle = '#a6f0e6'; c.lineWidth = 2; c.strokeRect(1, p.y + 1, W - 2, p.h - 1); c.fillStyle = '#a6f0e6'; c.fillRect(Math.round(this.x(this.survolDepot.t)), p.y, 2, p.h); }
    // aperçu du rasoir
    if (m.outil === 'rasoir' && this.survol != null) { c.fillStyle = '#ff5050'; c.fillRect(Math.round(this.survol), 0, 1, H); }
    // curseur de lecture
    const xc = Math.round(this.x(m.temps)); c.fillStyle = COUL.curseur; c.fillRect(xc, 0, 1.5, H);
    this.dessinerRegle(W);
  }
  pas() {
    const beat = 60 / (this.m.projet.bpm || 120), pxb = beat * this.pps;
    if (pxb > 14) return pxb > 60 ? beat / 2 : beat;
    if (pxb * 4 > 14) return beat * 4;   // une ligne par mesure
    for (const s of [1, 2, 5, 10, 30, 60]) if (s * this.pps > 40) return s;
    return 60;
  }
  dessinerRegle(W) {
    const dpr = devicePixelRatio || 1, c = this.cvR.getContext('2d'), m = this.m;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, REGLE);
    let pas = 1; for (const s of [.1, .25, .5, 1, 2, 5, 10, 15, 30, 60, 120]) { pas = s; if (s * this.pps > 70) break; }
    const dc = LT.decompte.fenetre(m.projet); if (dc) { c.fillStyle = 'rgba(255,184,77,.18)'; c.fillRect(this.x(dc.debut), 0, (dc.fin - dc.debut) * this.pps, REGLE); }
    c.font = '10px "DM Mono", monospace'; c.fillStyle = 'rgba(236,233,226,.6)'; c.strokeStyle = 'rgba(236,233,226,.25)';
    for (let t = Math.floor(this.debut / pas) * pas; this.x(t) < W; t += pas) {
      const x = Math.round(this.x(t)) + .5; c.beginPath(); c.moveTo(x, REGLE - 8); c.lineTo(x, REGLE); c.stroke(); c.fillText(fmt(t, pas < 1), x + 3, 11);
      for (let k = 1; k < 5; k++) { const xx = Math.round(this.x(t + pas * k / 5)) + .5; c.beginPath(); c.moveTo(xx, REGLE - 3); c.lineTo(xx, REGLE); c.stroke(); }
    }
    const d = m.duree(); if (d) { c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(this.x(d), 0, W, REGLE); }
    if (m.entree != null || m.sortie != null) { c.fillStyle = 'rgba(255,178,62,.55)'; const a = this.x(m.entree ?? 0), b = this.x(m.sortie ?? d); c.fillRect(a, REGLE - 5, b - a, 5); }
    const xc = this.x(m.temps); c.fillStyle = COUL.curseur; c.beginPath(); c.moveTo(xc - 6, 0); c.lineTo(xc + 6, 0); c.lineTo(xc + 6, 8); c.lineTo(xc, 14); c.lineTo(xc - 6, 8); c.fill();
  }
  // les deux poignées d'un clip choisi : on les tire pour changer sa durée
  poignees(c, x1, x2, y, h) {
    if (x2 - x1 < 12) return;
    for (const x of [x1 + 2, x2 - 6]) { c.fillStyle = COUL.sel; c.beginPath(); c.roundRect(x, y + 2, 4, h - 4, 2); c.fill(); c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(x + 1.5, y + h / 2 - 3, 1, 6); }
  }
  dessinerClip(c, p, k, choisi, W) {
    const y = p.y + 2, h = p.h - 4;
    if (p.sorte === 'peches') {
      const x = this.x(k.t); if (x < -10 || x > W + 10) return;
      const type = this.m.projet.peches.types.find(q => q.id === k.type);
      c.fillStyle = type ? type.flash : COUL.peche; c.fillRect(Math.round(x) - 2, y, 5, h);
      c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(Math.round(x) + 3, y, 1, h);
      if (choisi) { c.strokeStyle = COUL.sel; c.lineWidth = 2; c.strokeRect(Math.round(x) - 3, y - 1, 7, h + 2); }
      return;
    }
    const x1 = this.x(k.debut), x2 = this.x(k.fin); if (x2 < 0 || x1 > W) return;
    const w = Math.max(2, x2 - x1);
    c.save(); c.beginPath(); c.roundRect(x1, y, w, h, 4); c.clip();
    const def = LT.effets[k.effet] || {};
    c.fillStyle = def.sorte === 'overlay' ? COUL.overlay : COUL.effet; c.fillRect(x1, y, w, h);
    if (k.mode === 'lumiere' && def.sorte !== 'overlay') { c.fillStyle = k.couleur || '#fff'; c.fillRect(x1, y + h - 4, w, 4); }
    // fondus d'entrée / sortie
    c.fillStyle = 'rgba(0,0,0,.45)';
    if (k.entree > 0) { c.beginPath(); c.moveTo(x1, y); c.lineTo(x1 + k.entree * this.pps, y); c.lineTo(x1, y + h); c.fill(); }
    if (k.sortie > 0) { c.beginPath(); c.moveTo(x2, y); c.lineTo(x2 - k.sortie * this.pps, y); c.lineTo(x2, y + h); c.fill(); }
    if (w > 30 && h > 14) {
      const Z = this.m.projet.materiel.zones, qui = !k.zones ? 'tout' : k.zones.map(i => { const n = Z.findIndex(z => z.id === i); return Z[n] && Z[n].forme === 'rect' ? 'R' : n + 1; }).join('·');
      c.fillStyle = '#f4f1ea'; c.font = '600 11px "Work Sans"'; c.fillText(def.nom || '?', Math.max(x1, 0) + 6, y + h / 2 + 4);
      const lw = c.measureText(def.nom || '?').width; c.font = '400 10px "DM Mono"'; c.fillStyle = 'rgba(244,241,234,.6)'; c.fillText(qui, Math.max(x1, 0) + 12 + lw, y + h / 2 + 4);
    }
    c.restore();
    c.strokeStyle = choisi ? COUL.sel : 'rgba(255,255,255,.18)'; c.lineWidth = choisi ? 2 : 1;
    c.beginPath(); c.roundRect(x1 + .5, y + .5, w - 1, h - 1, 4); c.stroke();    if (choisi) this.poignees(c, x1, x2, y, h);
  }
  // les calques de couleur : un bloc par groupe de lumières voisines
  dessinerCouleurs(c, lignes, W) {
    if (!lignes.length) return;
    const idx = {}, sel = this.m.selection; lignes.forEach((p, i) => { idx[p.zone.id] = i; });
    for (const k of this.m.projet.couleur.clips) {
      const x1 = this.x(k.debut), x2 = this.x(k.fin); if (x2 < 0 || x1 > W) continue;
      const is = k.zones.map(z => idx[z]).filter(i => i != null).sort((a, b) => a - b), blocs = [];
      for (const i of is) { const b = blocs.at(-1); if (b && b[1] === i - 1) b[1] = i; else blocs.push([i, i]); }
      for (const [a, b] of blocs) {
        const y = lignes[a].y + 1, h = lignes[b].y + lignes[b].h - 1 - y, w = Math.max(2, x2 - x1);
        c.save(); c.beginPath(); c.rect(x1, y, w, h); c.clip();
        c.fillStyle = k.couleur; c.fillRect(x1, y, w, h);
        c.fillStyle = 'rgba(0,0,0,.4)';
        if (k.entree > 0) { c.beginPath(); c.moveTo(x1, y); c.lineTo(x1 + k.entree * this.pps, y); c.lineTo(x1, y + h); c.fill(); }
        if (k.sortie > 0) { c.beginPath(); c.moveTo(x2, y); c.lineTo(x2 - k.sortie * this.pps, y); c.lineTo(x2, y + h); c.fill(); }
        c.restore();
        const ch = sel.has(k.id); c.strokeStyle = ch ? COUL.sel : 'rgba(0,0,0,.16)'; c.lineWidth = ch ? 2 : 1;   // bord discret : deux morceaux de la même couleur se lisent comme un seul
        c.beginPath(); c.roundRect(x1 + .5, y + .5, w - 1, h - 1, ch ? 4 : 0); c.stroke();
        if (ch) this.poignees(c, x1, x2, y, h);
      }
    }
  }
  // un déclencheur : une zone posée sur la ligne du stem
  dessinerDecl(c, p, k, choisi, W) {
    const x1 = this.x(k.debut), x2 = this.x(k.fin); if (x2 < 0 || x1 > W) return;
    const y = p.y + 2, h = p.h - 4, w = Math.max(2, x2 - x1), A = LT.declencheurs.ACTIONS[k.action] || {};
    c.fillStyle = k.muet ? 'rgba(255,255,255,.04)' : 'rgba(255,184,77,.13)'; c.beginPath(); c.roundRect(x1, y, w, h, 4); c.fill();
    c.fillStyle = k.action === 'couleur' ? (k.couleurs || [])[0] || '#fff' : k.couleur || '#fff'; c.fillRect(x1 + 1, y + 1, w - 2, 3);
    c.strokeStyle = choisi ? COUL.sel : 'rgba(255,184,77,.55)'; c.lineWidth = choisi ? 2 : 1; c.beginPath(); c.roundRect(x1 + .5, y + .5, w - 1, h - 1, 4); c.stroke();
    if (w > 40) { c.fillStyle = '#ffd9a0'; c.font = '600 11px "Work Sans"'; c.fillText('⚡ ' + (A.nom || '') + (k.mode === 'volume' ? ' · volume' : ''), Math.max(x1, 0) + 6, y + 15); }
  }
  dessinerOnde(c, p, W) {
    const pk = this.m.pics, mid = p.y + p.h / 2, A = p.h / 2 - 3;
    if (!pk) { c.fillStyle = 'rgba(236,233,226,.35)'; c.font = '11px "Work Sans"'; c.fillText('Choisis la musique (Bibliothèque › Musique)', 10, mid + 4); return; }
    const parS = this.m.sr / LT.analyse.BLOC; c.fillStyle = this.m.son.muet ? 'rgba(255,184,77,.25)' : 'rgba(255,184,77,.75)';
    for (let x = 0; x < W; x++) {
      const a = Math.floor(this.t(x) * parS), b = Math.max(a + 1, Math.floor(this.t(x + 1) * parS)); if (a >= pk.min.length) break; if (b < 0) continue;
      let lo = 1, hi = -1; for (let i = Math.max(0, a); i < Math.min(b, pk.min.length); i++) { if (pk.min[i] < lo) lo = pk.min[i]; if (pk.max[i] > hi) hi = pk.max[i]; }
      if (hi >= lo) c.fillRect(x, mid - hi * A, 1, Math.max(1, (hi - lo) * A));
    }
    const pa = this.m.projet.musique && this.m.projet.musique.passage;
    if (pa) { c.strokeStyle = '#ffb23e'; c.setLineDash([4, 3]); c.strokeRect(this.x(pa.debut) + .5, p.y + 1.5, (pa.fin - pa.debut) * this.pps, p.h - 3); c.setLineDash([]); }
  }
  dessinerStem(c, p, W) {
    const st = p.stem, h = p.h - 4, bas = p.y + p.h - 2, sel = this.m.stemChoisi === st.id;
    c.fillStyle = st.couleur + '40'; c.beginPath(); c.moveTo(0, bas);
    for (let x = 0; x <= W; x += 2) c.lineTo(x, bas - LT.analyse.volume(st, this.t(x)) * h * .8);
    c.lineTo(W, bas); c.fill();
    c.fillStyle = st.couleur;
    for (const [t, f] of this.m.coupsDe(st)) { const x = this.x(t); if (x < -2 || x > W + 2) continue; const hh = 5 + f * (h - 5); c.fillRect(Math.round(x), bas - hh, sel ? 2 : 1.5, hh); }
    if (st.muet) { c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, p.y, W, p.h); }
  }
  dessinerCourbe(c, p, W) {
    const pts = p.pts, col = COUL.courbe[p.cle], h = p.h - 6, y0 = p.y + 3, Y = v => y0 + h - LT.borne(v) * h;
    const def = p.cle === 'vitesse' ? .5 : 1;
    c.strokeStyle = col; c.lineWidth = 1.5; c.beginPath();
    for (let x = 0; x <= W; x += 3) { const v = LT.courbe(pts, this.t(x), def); x ? c.lineTo(x, Y(v)) : c.moveTo(x, Y(v)); }
    c.stroke();
    for (const q of pts) { const x = this.x(q.t), y = Y(q.v), r = q === this.pointChoisi ? 6 : 4; c.fillStyle = q === this.pointChoisi ? '#fff' : col; c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r, y); c.lineTo(x, y + r); c.lineTo(x - r, y); c.fill(); }
  }

  // ---------- souris ----------
  ou(e) {
    const r = this.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const p = this.L.find(q => y >= q.y && y < q.y + q.h + 1);
    let k = null, zone = 'corps';
    if (p && p.liste) {
      const l = this.clipsDe(p);
      if (p.sorte === 'peches') k = [...l].reverse().find(q => Math.abs(this.x(q.t) - x) <= 5);
      else for (let i = l.length - 1; i >= 0; i--) { const q = l[i], a = this.x(q.debut), b = this.x(q.fin); if (x >= a - 4 && x <= b + 4) { k = q; const bord = Math.min(BORD, (b - a) / 3); zone = x - a < bord ? 'gauche' : b - x < bord ? 'droite' : 'corps'; break; } }   // les bords (pour changer la durée) : 9 px, ou un tiers d'un petit clip
    }
    return { x, y, p, k, zone, t: this.t(x) };
  }
  // magnétisme : colle au curseur, aux bords des clips, aux pêches, à l'entrée / sortie
  aimanter(t, sauf) {
    if (!this.m.aimant) return t;
    let best = t, d = AIMANT / this.pps;
    const essai = v => { if (v != null && Math.abs(v - t) < d) { d = Math.abs(v - t); best = v; } };
    essai(this.m.temps); essai(this.m.entree); essai(this.m.sortie); essai(0);
    const beat = 60 / (this.m.projet.bpm || 120), g0 = this.m.projet.grille || 0;
    if (beat * this.pps > 14) { const pg = this.pas(); essai(g0 + Math.round((t - g0) / pg) * pg); }   // la grille des temps
    else essai(g0 + Math.round((t - g0) / (beat * 4)) * beat * 4);
    for (const st of this.m.projet.stems || []) if (!st.muet) for (const [ct] of this.m.coupsDe(st)) essai(ct);
    for (const p of this.L) if (p.liste) for (const k of p.liste) { if (sauf && sauf.has(k.id)) continue; if (p.sorte === 'peches') essai(k.t); else { essai(k.debut); essai(k.fin); } }
    return best;
  }
  // ---------- courbes : losanges ----------
  cy(p, v) { const h = p.h - 6; return p.y + 3 + h - LT.borne(v) * h; }
  vDeY(p, y) { const h = p.h - 6; return LT.borne((p.y + 3 + h - y) / h); }
  pointSous(o) { return o.p.pts.find(q => Math.abs(this.x(q.t) - o.x) <= 6 && Math.abs(this.cy(o.p, q.v) - o.y) <= 7); }
  // clic sur une courbe : un losange = le prendre ; sur la ligne = en ajouter un ; ailleurs = rien (le curseur bouge)
  courbeClic(e, o) {
    const m = this.m, p = o.p, pts = p.pts, def = p.cle === 'vitesse' ? .5 : 1;
    let q = this.pointSous(o);
    if (!q) {
      if (Math.abs(this.cy(p, LT.courbe(pts, o.t, def)) - o.y) > 7) return false;
      m.memoriser(); q = { t: Math.max(0, this.aimanter(o.t)), v: +this.vDeY(p, o.y).toFixed(3), forme: 'lin' };
      if (!pts.length && def !== q.v) pts.push({ t: 0, v: def, forme: 'lin' });
      pts.push(q); pts.sort((a, b) => a.t - b.t); m.change();
    } else this._mem = false;
    this.pointChoisi = q; this.redessiner();
    const cv = this.cv; let bouge = false; cv.setPointerCapture(e.pointerId);
    cv.onpointermove = ev => {
      const o2 = this.ou(ev);
      if (!bouge) { bouge = true; if (this._mem === false) { m.memoriser(); this._mem = true; } }
      q.t = Math.max(0, ev.shiftKey ? q.t : this.aimanter(o2.t)); q.v = +this.vDeY(p, o2.y).toFixed(3);
      pts.sort((a, b) => a.t - b.t); m.change(true);
    };
    cv.onpointerup = () => { cv.onpointermove = null; if (bouge) m.change(); };
    return true;
  }
  // ---------- rectangle de sélection (comme dans un logiciel de montage) ----------
  selectionCadre(e, o) {
    const m = this.m, cv = this.cv, ajout = e.shiftKey || e.ctrlKey || e.metaKey, avant = new Set(ajout ? m.selection : []);
    this.cadre = { x0: o.x, y0: o.y, bouge: false }; cv.setPointerCapture(e.pointerId);
    cv.onpointermove = ev => {
      const o2 = this.ou(ev), q = this.cadre;
      if (!q.bouge && Math.abs(o2.x - q.x0) < 4 && Math.abs(o2.y - q.y0) < 4) return;
      q.bouge = true; q.xa = Math.min(q.x0, o2.x); q.xb = Math.max(q.x0, o2.x); q.ya = Math.min(q.y0, o2.y); q.yb = Math.max(q.y0, o2.y);
      const ta = this.t(q.xa), tb = this.t(q.xb), choix = new Set(avant);
      for (const p of this.L) {
        if (!p.liste || p.y + p.h < q.ya || p.y > q.yb) continue;
        for (const k of this.clipsDe(p)) if (k.t != null ? k.t >= ta && k.t <= tb : k.fin >= ta && k.debut <= tb) choix.add(k.id);
      }
      m.selection = choix; m.stemChoisi = null; this.redessiner();
    };
    cv.onpointerup = () => {
      cv.onpointermove = null; const b = this.cadre.bouge; this.cadre = null;
      if (b) m.choisir(undefined, 'garder');
      else { if (!ajout) m.choisir(null); m.aller(o.t); }
      this.redessiner();
    };
  }
  souris() {
    const cv = this.cv, m = this.m;
    this.tetes.addEventListener('click', e => {
      const b = e.target.closest('button'), tete = e.target.closest('.lt2-tete');
      if (!b) { const p = tete && this.L[+tete.dataset.i]; if (p && p.sorte === 'stem') m.choisirStem(p.stem.id); return; }
      if (b.dataset.a === 'sonmuet') { m.son.muet = !m.son.muet; m.relancer(); this.redessiner(); }
      if (b.dataset.a === 'stem') m.ajouterStems();
      if (b.dataset.a === 'ecoute') { const p = this.L[+b.dataset.i], r = m.son.stems.get(p.stem.id); if (r) { r.ecoute = !r.ecoute; m.relancer(); this.redessiner(); } }
      if (b.dataset.a === 'muet') { const p = this.L[+b.dataset.i]; m.modifier(() => { p.piste.muet = !p.piste.muet; }); }
      if (b.dataset.a === 'plus') m.modifier(() => m.projet.effets.push({ id: LT.id(), nom: 'Effets ' + (m.projet.effets.length + 1), clips: [] }));
    });
    // la règle : cliquer / glisser = déplacer le curseur
    this.cvR.addEventListener('pointerdown', e => {
      const r = this.cvR.getBoundingClientRect(), go = ev => m.aller(this.t(ev.clientX - r.left));
      go(e); this.cvR.setPointerCapture(e.pointerId);
      this.cvR.onpointermove = go; this.cvR.onpointerup = () => { this.cvR.onpointermove = null; };
    });
    cv.addEventListener('pointermove', e => {
      if (this.glisse) return;
      const o = this.ou(e);
      cv.style.cursor = m.outil === 'rasoir' ? 'crosshair' : o.k && o.zone !== 'corps' ? 'ew-resize' : o.k ? 'grab' : 'default';
      if (m.outil === 'rasoir') { this.survol = this.x(this.aimanter(o.t)); this.redessiner(); }
    });
    cv.addEventListener('pointerleave', () => { if (this.survol != null) { this.survol = null; this.redessiner(); } });
    cv.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      const o = this.ou(e);
      if (o.p && o.p.sorte === 'courbe' && this.courbeClic(e, o)) return;
      if (o.p && o.p.sorte === 'stem') m.choisirStem(o.p.stem.id);
      if (m.outil === 'rasoir') { if (o.k && o.p.sorte !== 'peches') m.couper(o.k, o.p.liste, this.aimanter(o.t)); return; }
      if (!o.k) return this.selectionCadre(e, o);   // dans le vide : curseur, ou rectangle de sélection si on glisse
      // sélection : Maj ou Ctrl = ajouter / retirer
      if (e.shiftKey || e.ctrlKey || e.metaKey) m.choisir(o.k, 'basculer');
      else if (!m.selection.has(o.k.id)) m.choisir(o.k);
      // préparer le glisser (la modification n'est enregistrée qu'au premier vrai mouvement)
      const choisis = m.clipsChoisis(), x0 = e.clientX, t0 = o.t;
      const orig = choisis.map(c => ({ c, debut: c.k.debut, fin: c.k.fin, t: c.k.t, zones: c.k.zones && c.k.zones.slice() }));
      this.glisse = { o, bouge: false };
      cv.setPointerCapture(e.pointerId);
      cv.onpointermove = ev => {
        if (!this.glisse.bouge) { if (Math.abs(ev.clientX - x0) < 3 && Math.abs(ev.clientY - e.clientY) < 3) return; this.glisse.bouge = true; m.memoriser(); }
        const o2 = this.ou(ev); let dt = o2.t - t0;
        if (o.zone === 'corps') {
          // on aimante le bord le plus proche du clip pris en main
          const ref = orig.find(q => q.c.k === o.k), sauf = new Set(choisis.map(c => c.k.id));
          if (o.p.sorte === 'peches') dt = this.aimanter(ref.t + dt, sauf) - ref.t;
          else { const a = this.aimanter(ref.debut + dt, sauf) - ref.debut, b = this.aimanter(ref.fin + dt, sauf) - ref.fin; dt = Math.abs(a - dt) <= Math.abs(b - dt) ? (a !== dt ? a : b) : b; }
          const mini = Math.min(...orig.map(q => q.t ?? q.debut)); if (mini + dt < 0) dt = -mini;
          orig.forEach(q => { if (q.t != null) q.c.k.t = q.t + dt; else { q.c.k.debut = q.debut + dt; q.c.k.fin = q.fin + dt; } });
          // un clip de couleur glissé vers le haut / le bas : il passe sur d'autres lumières (le groupe garde sa forme)
          if (choisis.length === 1 && o.p.sorte === 'couleur' && o2.p && o2.p.sorte === 'couleur') {
            const ids = m.projet.materiel.zones.map(z => z.id), dz = ids.indexOf(o2.p.zone.id) - ids.indexOf(o.p.zone.id), q = orig[0];
            const nz = q.zones.map(z => ids[ids.indexOf(z) + dz]); if (nz.every(Boolean)) o.k.zones = nz;
          }
          // un déclencheur glissé sur la ligne d'un autre stem : il suit ce stem
          if (choisis.length === 1 && o.p.sorte === 'stem' && o2.p && o2.p.sorte === 'stem') o.k.stem = o2.p.stem.id;
          // un seul clip d'effet : il peut changer de piste d'effets
          if (choisis.length === 1 && o2.p && o2.p.liste && o2.p.liste !== choisis[0].liste && this.famille(o2.p.sorte) === this.famille(o.p.sorte)) {
            const c = choisis[0]; c.liste.splice(c.liste.indexOf(c.k), 1); o2.p.liste.push(c.k); c.liste = o2.p.liste;
          }
        } else {
          const q = orig.find(r => r.c.k === o.k), k = o.k, mini = .05;
          if (o.zone === 'gauche') k.debut = Math.min(q.fin - mini, Math.max(0, this.aimanter(q.debut + dt, new Set([k.id]))));
          else k.fin = Math.max(q.debut + mini, this.aimanter(q.fin + dt, new Set([k.id])));
        }
        m.change(true);
      };
      cv.onpointerup = () => { cv.onpointermove = null; const b = this.glisse.bouge; this.glisse = null;
        if (b && o.p.sorte === 'couleur') choisis.forEach(q => m.projet.couleur.clips.includes(q.k) && m.faireDeLaPlace(q.k));   // un calque de couleur déplacé ou étiré passe par-dessus les autres
        if (b) m.change(); else if (!e.shiftKey && !e.ctrlKey && !e.metaKey) { m.choisir(o.k); m.aller(Math.max(0, o.t)); } };
    });
    // clic droit sur un losange : sa forme (droite → arrondie → palier)
    cv.addEventListener('contextmenu', e => {
      const o = this.ou(e); if (!o.p || o.p.sorte !== 'courbe') return; e.preventDefault();
      const q = this.pointSous(o); if (!q) return;
      m.modifier(() => { q.forme = { lin: 'lisse', lisse: 'palier', palier: 'lin' }[q.forme || 'lin']; });
    });
    // double-clic dans le vide d'une piste = un nouveau clip ici
    cv.addEventListener('dblclick', e => {
      const o = this.ou(e);
      if (o.p && o.p.sorte === 'courbe') { const q = this.pointSous(o); if (q) m.modifier(() => { o.p.pts.splice(o.p.pts.indexOf(q), 1); this.pointChoisi = null; }); return; }
      if (!o.p || !o.p.liste) return;
      if (o.k) { if (o.p.sorte !== 'peches') { m.choisir(o.k); m.aller(o.k.debut); } return; }
      m.nouveauClip(o.p, this.aimanter(Math.max(0, o.t)));
    });
    // molette : temps / pistes / zoom
    this.corps.addEventListener('wheel', e => {
      if (e.shiftKey) return;   // Maj + molette : on laisse défiler les pistes
      e.preventDefault();
      if (e.ctrlKey || e.altKey) this.zoomer(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX - this.cv.getBoundingClientRect().left);
      else { this.debut = Math.max(this.min(), this.debut + (e.deltaY + e.deltaX) / this.pps * .8); this.redessiner(); }
    }, { passive: false });
    // glisser depuis la bibliothèque
    cv.addEventListener('dragover', e => { const o = this.ou(e); if (o.p && (o.p.liste)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; this.survolDepot = o; this.redessiner(); } });
    cv.addEventListener('dragleave', () => { this.survolDepot = null; this.redessiner(); });
    cv.addEventListener('drop', e => { e.preventDefault(); const q = e.dataTransfer.getData('text/plain') || m.glisse, o = this.ou(e); this.survolDepot = null; if (q) m.deposer(q, Object.assign(o, { t: this.aimanter(o.t) })); });
  }
}
LT.Timeline = Timeline;
})(typeof self !== 'undefined' ? self : this);
