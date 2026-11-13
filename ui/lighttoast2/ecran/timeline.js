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
// Molette = monter / descendre ; Alt + molette = zoom ; Ctrl + molette = avancer dans le temps.
// =====================================================================
(function (G) {
const LT = G.LT;
const FOND = { couleur: 'rgba(0,0,0,.3)', courbe: 'rgba(0,0,0,.36)', fond: 'rgba(255,255,255,.055)', effet: 'rgba(90,130,255,.11)', stem: 'rgba(255,90,170,.11)', peches: 'rgba(0,0,0,.18)', audio: 'rgba(0,0,0,.2)' };
const EN_TETE = 150, REGLE = 26, BORD = 9, AIMANT = 8;
const COUL = { peche: '#ff5fa2', effet: '#8a6be0', overlay: '#2f8f86', sel: '#a6f0e6', curseur: '#ffb23e', courbe: { lum: '#7be0ff', elum: '#ff9ad5', plum: '#c58bff', vitesse: '#9ad14b', zone: '#ffd27a' } };
const NOM_COURBE = { lum: 'Lum. générale', elum: 'Force effets', plum: 'Lum. pêches', vitesse: 'Vitesse' };
const fmt = (t, fin) => { const sg = t < -1e-6 ? '-' : ''; t = Math.abs(t); const m = Math.floor(t / 60 + 1e-6), s = Math.max(0, t - m * 60); return sg + m + ':' + (s < 10 ? '0' : '') + s.toFixed(fin ? 1 : 0); };

class Timeline {
  constructor(m, racine) {
    this.hauteurs = (() => { try { return JSON.parse(localStorage.getItem('lt2.hauteurs')) || {}; } catch (e) { return {}; } })();
    this.ouverts = new Set((() => { try { return JSON.parse(localStorage.getItem('lt2.ouverts')) || ['lum', 'elum', 'plum', 'vitesse']; } catch (e) { return []; } })());   // lignes dépliées (courbes)
    this.m = m; this.debut = 0; this.pps = 60;            // pixels par seconde (zoom)
    racine.innerHTML = `<div class="lt2-regle"><div class="lt2-coin"></div><canvas></canvas></div>
      <div class="lt2-corps"><div class="lt2-tetes"></div><canvas class="lt2-pistes"></canvas></div>
      <div class="lt2-hbar"><div class="lt2-hbar-p"><i></i></div></div>`;
    this.r = racine; this.cvR = racine.querySelector('.lt2-regle canvas'); this.corps = racine.querySelector('.lt2-corps');
    this.tetes = racine.querySelector('.lt2-tetes'); this.cv = racine.querySelector('.lt2-pistes');
    this.souris(); this.barreH();
    new ResizeObserver(() => this.redessiner()).observe(racine);
  }

  // ---------- la liste des pistes, calculée depuis le projet ----------
  pistes() {
    const P = this.m.projet, L = [];
    // en haut : les stems (forme d'onde + leurs déclencheurs), avec le bouton + pour en ajouter
    L.push({ sorte: 'stems', nom: 'Stems', h: 20 });
    (P.stems || []).forEach(st => L.push({ sorte: 'stem', nom: st.nom, h: 40, stem: st, liste: P.declencheurs || (P.declencheurs = []) }));
    // les pistes Pêches : la 1re (peches.clips) en bas, les ajoutées au-dessus (la plus haute en premier)
    [...(P.peches.autres || [])].reverse().forEach(x => L.push({ sorte: 'peches', nom: x.nom, h: 26, liste: x.clips, piste: x, pistePeche: true }));
    L.push({ sorte: 'peches', nom: P.peches.nom || 'Pêches', h: 26, liste: P.peches.clips, piste: P.peches, pistePeche: true });
    [...P.effets].reverse().forEach(e => L.push({ sorte: 'effets', nom: e.nom, h: 30, liste: e.clips, piste: e }));   // la plus haute en premier
    L.push({ sorte: 'titre', nom: 'Couleur', h: 16 });
    // chaque lumière peut se déplier : sa courbe d'intensité (losanges) juste dessous
    const CZ = P.courbes.zones = P.courbes.zones || {}, ouv = this.ouverts;
    P.materiel.zones.forEach(z => {
      const cle = 'z:' + z.id; L.push({ sorte: 'couleur', nom: z.nom, h: 22, liste: P.couleur.clips, zone: z, pli: cle });
      if (ouv.has(cle)) L.push({ sorte: 'courbe', nom: 'Intensité', h: 34, cle, pts: CZ[z.id] = CZ[z.id] || [], sous: true });
    });
    // les courbes générales : repliées = une fine ligne
    ['lum', 'elum', 'plum', 'vitesse'].forEach(k => L.push(ouv.has(k) ? { sorte: 'courbe', nom: NOM_COURBE[k], h: 34, cle: k, pts: P.courbes[k], pli: k } : { sorte: 'pli', nom: NOM_COURBE[k], h: 18, cle: k, pli: k, pts: P.courbes[k] }));
    L.push({ sorte: 'audio', nom: (P.musique && P.musique.nom) || 'Audio', h: 48 });
    // la hauteur choisie de chaque piste (Alt + molette sur son nom, comme Premiere)
    L.forEach(p => { p.cleH = p.sorte + ':' + ((p.zone && p.zone.id) || p.cle || (p.stem && p.stem.id) || (p.piste && p.piste.id) || p.nom); const h = this.hauteurs[p.cleH]; if (h) p.h = h; });
    let y = 0; L.forEach(p => { p.y = y; y += p.h + 1; });
    this.L = L; this.hTotal = y; return L;
  }
  famille(s) { return s; }
  // la famille d'une piste, pour sa teinte : couleur, courbe, fond, effet, stem, pêche…
  famille2(p) { return p.sorte === 'courbe' || p.sorte === 'pli' ? 'courbe' : p.sorte === 'effets' ? (/fond/i.test(p.nom) ? 'fond' : 'effet') : p.sorte; }
  // les clips visibles sur une ligne (la couleur : seulement ceux qui touchent cette lumière)
  clipsDe(p) { return p.sorte === 'couleur' ? p.liste.filter(k => k.zones.includes(p.zone.id)) : p.sorte === 'stem' ? p.liste.filter(k => k.stem === p.stem.id) : p.liste || []; }

  // ---------- temps ↔ pixels ----------
  x(t) { return (t - this.debut) * this.pps; }
  t(x) { return this.debut + x / this.pps; }
  min() { return this.m.debutMin(); }
  // la petite barre en bas : où on est dans le morceau ; on la glisse pour aller à gauche / à droite
  etendue() { const a = this.min(), W = this.cv.clientWidth || 1, vu = W / this.pps; return { a, b: Math.max((this.m.duree() || 10) + vu * .1, this.debut + vu), vu }; }
  barreH() {
    const piste = this.r.querySelector('.lt2-hbar-p'), pouce = piste.querySelector('i');
    this._majBarre = () => { const { a, b, vu } = this.etendue(), L = b - a || 1; pouce.style.left = ((this.debut - a) / L * 100) + '%'; pouce.style.width = Math.max(2, Math.min(100, vu / L * 100)) + '%'; };
    pouce.onpointerdown = e => {
      e.stopPropagation(); pouce.setPointerCapture(e.pointerId); const x0 = e.clientX, d0 = this.debut, { a, b } = this.etendue(), k = (b - a) / piste.clientWidth;
      pouce.onpointermove = ev => { this.debut = Math.max(this.min(), d0 + (ev.clientX - x0) * k); this.redessiner(); };
      pouce.onpointerup = () => { pouce.onpointermove = null; };
    };
    piste.onpointerdown = e => { if (e.target !== piste) return; const { a, b, vu } = this.etendue(), r = piste.getBoundingClientRect(); this.debut = Math.max(this.min(), a + (e.clientX - r.left) / r.width * (b - a) - vu / 2); this.redessiner(); };   // clic à côté = y aller
  }
  zoomer(f, xAncre) {
    const ta = this.t(xAncre ?? this.cv.clientWidth / 2);
    this.pps = Math.max(4, Math.min(2000, this.pps * f));
    this.debut = Math.max(this.min(), ta - (xAncre ?? this.cv.clientWidth / 2) / this.pps); this.redessiner();
  }
  toutVoir() { const a = this.min(), d = (this.m.duree() || 10) - a; this.pps = Math.max(4, (this.cv.clientWidth - 20) / d); this.debut = a; this.redessiner(); }
  suivre(t) { const w = this.cv.clientWidth; if (this.x(t) > w - 40 || this.x(t) < 0) { this.debut = Math.max(this.min(), t - 40 / this.pps); } }

  // ---------- les en-têtes (vrais boutons) ----------
  tetesHTML() {
    const cle = this.L.map(p => p.sorte + p.nom + p.h + (p.pli && this.ouverts.has(p.pli) ? '+' : '')).join('|') + this.m.projet.effets.map(e => e.muet).join() + [this.m.projet.peches, ...(this.m.projet.peches.autres || [])].map(e => !!e.muet).join() + this.m.son.muet + this.m.stemChoisi + [...this.m.son.stems.values()].map(s => s.ecoute).join();
    if (cle === this._cle) return; this._cle = cle;
    this.tetes.innerHTML = this.L.map((p, i) => {
      let b = '';
      if (p.sorte === 'effets' || p.pistePeche) b = `<button class="lt2-tb${p.piste.muet ? ' off' : ''}" data-a="muet" data-i="${i}" title="Couper / remettre cette piste">${p.piste.muet ? '◌' : '●'}</button>`;
      if (p.sorte === 'audio') b = `<button class="lt2-tb${this.m.son.muet ? ' off' : ''}" data-a="sonmuet" title="Couper / remettre le son du morceau">${this.m.son.muet ? '◌' : '●'}</button>`;
      if (p.sorte === 'stem') { const r = this.m.son.stems.get(p.stem.id); b = `<button class="lt2-tb${r && r.ecoute ? ' on' : ''}" data-a="ecoute" data-i="${i}" title="${r ? 'Écouter ce stem pendant la lecture' : 'Le son de ce stem n\'est plus chargé (ses coups sont gardés)'}"${r ? '' : ' disabled'}>🎧</button>`; }
      if (p.pli) b = `<button class="lt2-tb lt2-pli" data-a="plier" data-k="${p.pli}" title="${this.ouverts.has(p.pli) ? 'Replier' : 'Déplier : la courbe avec ses points'}">${this.ouverts.has(p.pli) ? '▾' : '▸'}</button>`;
      const ch = p.sorte === 'stem' && this.m.stemChoisi === p.stem.id ? ' choisi' : '';
      const fin = p.sorte === 'stems' ? '<button class="lt2-tb lt2-plus-stem" data-a="stem" title="Ajouter des stems (kick, caisse claire, basse…) : depuis Médias, le Drive ou ce PC. Leurs coups font réagir les lumières (déclencheurs).">+</button>' : '';
      return `<div class="lt2-tete s-${p.sorte} f-${this.famille2(p)}${ch}${p.sous ? ' sous' : ''}" data-i="${i}" style="top:${p.y}px;height:${p.h}px">${b}<span${p.stem ? ` style="color:${p.stem.couleur}" title="${String(p.nom).replace(/"/g, '&quot;')} (double-clic pour renommer)"` : ''}>${p.nom}</span>${fin}${p.pistePeche && p === this.L.find(q => q.pistePeche) ? '<button class="lt2-tb" data-a="plusPeche" title="Ajouter une piste Pêches">+</button>' : ''}${p.sorte === 'effets' && p.piste === this.m.projet.effets.at(-1) ? '<button class="lt2-tb" data-a="plus" title="Ajouter une piste d\'effets">+</button>' : ''}</div>`;
    }).join('');
    this.tetes.style.height = this.hTotal + 'px';
  }

  // ---------- dessin ----------
  redessiner() { if (!this._rq) this._rq = requestAnimationFrame(() => { this._rq = 0; this.dessiner(); }); }
  dessiner() {
    const dpr = devicePixelRatio || 1, L = this.pistes(); this.tetesHTML(); if (this._majBarre) this._majBarre();
    const W = this.cv.clientWidth || this.r.clientWidth - EN_TETE, H = this.hTotal;
    for (const [cv, h] of [[this.cv, H], [this.cvR, REGLE]]) {
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(h * dpr); cv.style.height = h + 'px'; }
    }
    if (this.cvR.style.width !== W + 'px') this.cvR.style.width = W + 'px';   // la règle exactement aussi large que les pistes (sinon, avec la barre de défilement, la tête et sa ligne se décalent)
    const m = this.m, sel = m.selection, c = this.cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    // grille : les temps (battements si le tempo est connu)
    const pasG = this.pas(), g0 = this.m.projet.grille || 0, mesure = 240 / (this.m.projet.bpm || 120);
    for (let t = g0 + Math.floor((this.debut - g0) / pasG) * pasG; this.x(t) < W; t += pasG) {
      const surMesure = Math.abs(((t - g0) / mesure) - Math.round((t - g0) / mesure)) < 1e-4;
      c.fillStyle = surMesure ? 'rgba(255,255,255,.09)' : 'rgba(255,255,255,.035)'; c.fillRect(Math.round(this.x(t)), 0, 1, H);
    }
    for (const p of L) {
      if (p.sorte === 'titre' || p.sorte === 'stems') { c.fillStyle = 'rgba(255,255,255,.04)'; c.fillRect(0, p.y, W, p.h); continue; }
      c.fillStyle = FOND[this.famille2(p)] || 'rgba(0,0,0,.18)'; c.fillRect(0, p.y, W, p.h);   // une teinte par famille de piste
      if (p.sorte === 'courbe') this.dessinerCourbe(c, p, W);
      if (p.sorte === 'pli' && p.pts) { c.fillStyle = COUL.courbe[p.cle] || COUL.courbe.zone; for (const q of p.pts) { const x = this.x(q.t); if (x > -4 && x < W + 4) c.fillRect(Math.round(x) - 1, p.y + 6, 3, p.h - 12); } }   // repliée : juste des traits là où il y a des points
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
    if (this.survolDepot && this.survolDepot.p) {   // juste la place que prendra ce qu'on dépose
      const o = this.survolDepot, p = o.p, q = m.glisse || '', d = Math.max(1, 60 / (m.projet.bpm || 120) * 4);
      let a = Math.max(0, o.t), b = a + d;
      const rien = (q.startsWith('calque:') && p.sorte !== 'couleur') || (q.startsWith('couleur:') && !o.k && p.sorte !== 'couleur') || (q.startsWith('effet:') && p.sorte !== 'couleur' && p.sorte !== 'effets');   // là, le dépôt ne ferait rien
      if (!rien) {
      if (o.k && o.k.fin != null && (q.startsWith('couleur:') || (q.startsWith('effet:') && (p.sorte === 'couleur' || p.sorte === 'effets')))) { a = o.k.debut; b = p.sorte === 'couleur' && q.startsWith('effet:') ? Math.max(o.k.fin, a + 1) : o.k.fin; }
      const xa = this.x(a), xb = this.x(b);
      c.fillStyle = 'rgba(166,240,230,.18)'; c.fillRect(xa, p.y + 1, xb - xa, p.h - 1);
      c.strokeStyle = '#a6f0e6'; c.lineWidth = 2; c.strokeRect(xa + 1, p.y + 1, Math.max(2, xb - xa - 2), p.h - 1);
    } }
    // aperçu du rasoir
    if (m.outil === 'rasoir' && this.survol != null) { c.fillStyle = '#ff5050'; c.fillRect(Math.round(this.survol), 0, 1, H); }
    for (const q of m.projet.marqueurs || []) { const x = Math.round(this.x(q.t)); if (x >= 0 && x <= W) { c.fillStyle = (q.couleur || '#7be0ff') + '55'; c.fillRect(x, 0, 1, H); } }   // les marqueurs, en trait fin
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
    // les marqueurs (comme Premiere) : un petit drapeau + son nom
    c.font = '600 10px "Work Sans", sans-serif';
    for (const q of m.projet.marqueurs || []) {
      const x = Math.round(this.x(q.t)); if (x < -80 || x > W + 4) continue;
      c.fillStyle = q.couleur || '#7be0ff'; c.beginPath(); c.moveTo(x - 5, 13); c.lineTo(x + 5, 13); c.lineTo(x + 5, 20); c.lineTo(x, 25); c.lineTo(x - 5, 20); c.fill();
      if (q.nom) { const w = c.measureText(q.nom).width; c.fillStyle = 'rgba(10,8,18,.7)'; c.fillRect(x + 7, 13, w + 6, 12); c.fillStyle = q.couleur || '#7be0ff'; c.fillText(q.nom, x + 10, 22); }
    }
    const xc = this.x(m.temps); c.fillStyle = COUL.curseur; c.beginPath(); c.moveTo(xc - 6, 0); c.lineTo(xc + 6, 0); c.lineTo(xc + 6, 8); c.lineTo(xc, 14); c.lineTo(xc - 6, 8); c.fill();
  }
  marqueurSous(x) { return (this.m.projet.marqueurs || []).find(q => Math.abs(this.x(q.t) - x) <= 6); }
  // le nom d'un marqueur : un petit champ posé sur la règle
  nommerMarqueur(q) {
    const r = this.cvR.getBoundingClientRect(), i = Object.assign(document.createElement('input'), { value: q.nom || '', className: 'lt2-renom lt2-renom-m', placeholder: 'Nom du marqueur' });
    i.style.left = (r.left + this.x(q.t) + 8) + 'px'; i.style.top = (r.top + 1) + 'px'; document.body.appendChild(i); i.focus(); i.select(); let fini = false;
    const fin = ok => { if (fini) return; fini = true; i.remove(); const v = i.value.trim().slice(0, 30); if (ok && v !== (q.nom || '')) this.m.modifier(() => { q.nom = v; }); };
    i.onkeydown = ev => { ev.stopPropagation(); if (ev.key === 'Enter') fin(true); if (ev.key === 'Escape') fin(false); }; i.onblur = () => fin(true);
  }
  menuMarqueur(e, q) {
    this.fermerMenu(); const m = this.m, el = document.createElement('div'); el.className = 'lt2-menu'; document.body.appendChild(el); this._menu = el;
    const C = ['#7be0ff', '#9ad14b', '#ffb84d', '#ff5f5f', '#c58bff', '#ff9ad5', '#ffffff'];
    el.innerHTML = `<h5>Marqueur</h5><button data-mm="nom">Renommer</button><div class="lt2-menu-coul">${C.map(x => `<button data-mc="${x}" style="background:${x}"></button>`).join('')}</div><hr><button data-mm="suppr">Supprimer</button>`;
    el.style.left = e.clientX + 'px'; el.style.top = e.clientY + 'px';
    el.querySelectorAll('[data-mc]').forEach(b => b.onclick = () => { this.fermerMenu(); m.modifier(() => { q.couleur = b.dataset.mc; }); });
    el.querySelector('[data-mm="nom"]').onclick = () => { this.fermerMenu(); this.nommerMarqueur(q); };
    el.querySelector('[data-mm="suppr"]').onclick = () => { this.fermerMenu(); m.modifier(() => { const l = m.projet.marqueurs; l.splice(l.indexOf(q), 1); }); };
    const loin = ev => { if (!el.contains(ev.target)) this.fermerMenu(); };
    setTimeout(() => document.addEventListener('pointerdown', loin, true)); this._fermer = () => document.removeEventListener('pointerdown', loin, true);
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
    // les fondus = des petites « transitions » posées sur les bords (on les tire pour changer leur durée)
    const fondu = (a, b, monte) => { const fw = b - a; if (fw < 2) return; c.fillStyle = 'rgba(16,12,34,.7)'; c.fillRect(a, y, fw, h); c.strokeStyle = 'rgba(166,240,230,.6)'; c.lineWidth = 1.5; c.beginPath(); monte ? (c.moveTo(a, y + h), c.lineTo(b, y)) : (c.moveTo(a, y), c.lineTo(b, y + h)); c.stroke(); c.strokeStyle = 'rgba(166,240,230,.45)'; c.lineWidth = 1; c.strokeRect(a + .5, y + .5, fw - 1, h - 1); };
    if (k.entree > 0) fondu(x1, x1 + k.entree * this.pps, true);
    if (k.sortie > 0) fondu(x2 - k.sortie * this.pps, x2, false);
    if (w > 30 && h > 14) {
      const Z = this.m.projet.materiel.zones, qui = !k.zones ? 'tout' : k.zones.map(i => { const n = Z.findIndex(z => z.id === i); return Z[n] && Z[n].forme === 'rect' ? 'R' : n + 1; }).join('·');
      c.fillStyle = '#f4f1ea'; c.font = '600 11px "Work Sans"'; c.fillText(def.nom || '?', Math.max(x1, 0) + 6, y + h / 2 + 4);
      const lw = c.measureText(def.nom || '?').width; c.font = '400 10px "DM Mono"'; c.fillStyle = 'rgba(244,241,234,.6)'; c.fillText(qui, Math.max(x1, 0) + 12 + lw, y + h / 2 + 4);
    }
    c.restore();
    c.strokeStyle = choisi ? COUL.sel : 'rgba(255,255,255,.18)'; c.lineWidth = choisi ? 2 : 1;
    c.beginPath(); c.roundRect(x1 + .5, y + .5, w - 1, h - 1, 4); c.stroke();    if (choisi) this.poignees(c, x1, x2, y, h);
  }
  // ---------- clic droit : un petit menu ----------
  //   sur un calque / effet / déclencheur : ses lumières à cocher (une ou plusieurs), couper, dupliquer, supprimer
  //   sur du vide : ajouter un calque ici (couleur, bi-color, dégradé, effet…)
  menu(e, o) {
    const m = this.m, P = m.projet, p = o.p, k = o.k, Z = P.materiel.zones, ids = Z.map(z => z.id);
    this.fermerMenu();
    const el = document.createElement('div'); el.className = 'lt2-menu'; document.body.appendChild(el); this._menu = el;
    const t = Math.max(0, this.aimanter(o.t));
    const effets = sorte => Object.entries(LT.effets).filter(([, f]) => f.sorte === sorte).map(([x, f]) => `<button data-ajout="effet:${x}">${f.nom}</button>`).join('');
    const sousEffets = `<div class="lt2-menu-sous"><button class="lt2-menu-f">Effet ▸</button><div class="lt2-menu-l"><h5>Overlays</h5>${effets('overlay')}<h5>Mouvements</h5>${effets('mouvement')}</div></div>`;
    const aZones = k && (p.sorte === 'couleur' || p.sorte === 'effets' || p.sorte === 'stem');
    const zonesDe = () => k.zones && k.zones.length ? k.zones : ids;   // null = toutes (effets, déclencheurs)
    // une coupure tout près du clic (comme Premiere : clic droit sur une coupe = transition par défaut)
    const tc = p.sorte === 'couleur' && !(k && k.trans) ? m.coupure(o.t, p.zone.id, 10 / this.pps) : null;
    const transMenu = tc != null ? `<button data-trans="fondu" class="lt2-menu-pri">Ajouter une transition (Fondu)</button><div class="lt2-menu-sous"><button class="lt2-menu-f">Autre transition ▸</button><div class="lt2-menu-l">${Object.entries(LT.TRANSITIONS).map(([x, d]) => `<button data-trans="${x}">${d.nom}</button>`).join('')}</div></div><hr>` : '';
    const dessiner = () => {
      if (k) {
        const z = zonesDe(), toutes = ids.every(i => z.includes(i));
        el.innerHTML = transMenu + (aZones ? `<h5>Lumières</h5>${Z.map(q => `<label><input type="checkbox" data-mz="${q.id}"${z.includes(q.id) ? ' checked' : ''}> ${q.nom}</label>`).join('')}<label><input type="checkbox" data-mz="*"${toutes ? ' checked' : ''}> Toutes</label><hr>` : '')
          + (p.sorte === 'effets' ? `<button data-fondu="in">${k.entree > 0 ? 'Enlever le fondu d\'entrée' : 'Ajouter un fondu d\'entrée'}</button><button data-fondu="out">${k.sortie > 0 ? 'Enlever le fondu de sortie' : 'Ajouter un fondu de sortie'}</button><hr>` : '')
          + (k.debut != null ? `${k.trans ? '' : '<button data-mc="couper">Couper ici</button>'}<button data-mc="dupliquer">Dupliquer</button>` : '') + `<button data-mc="supprimer">Supprimer</button>`;
      } else {
        el.innerHTML = transMenu + '<h5>Ajouter ici</h5>' + (p.sorte === 'couleur' ? '<button data-ajout="calque:">Calque de couleur</button><button data-ajout="calque:bi">Bi-color</button><button data-ajout="calque:degrade">Dégradé</button>' + sousEffets
          : p.sorte === 'effets' ? sousEffets : p.sorte === 'peches' ? '<button data-nouveau>Une pêche</button>' : '');
      }
      el.querySelectorAll('[data-mz]').forEach(c => c.onchange = () => {
        const id = c.dataset.mz, avant = zonesDe();
        let l = id === '*' ? (c.checked ? ids.slice() : [avant[0]]) : c.checked ? ids.filter(i => avant.includes(i) || i === id) : avant.filter(i => i !== id);
        if (!l.length) l = [id === '*' ? ids[0] : id];   // toujours au moins une lumière
        const plus = l.filter(i => !avant.includes(i));
        m.modifier(() => {
          if (k.trans) k.zones = l;
          else if (p.sorte === 'couleur') { k.zones = l; if (plus.length) m.faireDeLaPlace(k, plus); }
          else k.zones = l.length === ids.length ? null : l;
        });
        m.choisir(k); dessiner();
      });
      el.querySelectorAll('[data-mc]').forEach(b => b.onclick = () => {
        const a = b.dataset.mc; this.fermerMenu();
        if (a === 'couper') return m.couper(k, p.liste, t);
        if (a === 'supprimer') { m.choisir(k); return m.supprimer(); }
        if (a === 'dupliquer') {   // juste après lui
          const n = JSON.parse(JSON.stringify(k)); n.id = LT.id(); const d = k.fin - k.debut; n.debut = k.fin; n.fin = k.fin + d;
          m.modifier(() => {
            if (k.trans) P.transitions.push(n);
            else if (p.sorte === 'couleur') { m.faireDeLaPlace(n); P.couleur.clips.push(n); }
            else if (p.sorte === 'effets') m.pisteLibre(n.debut, n.fin, P.effets.indexOf(p.piste)).clips.push(n);
            else p.liste.push(n);
          });
          m.choisir(n);
        }
      });
      el.querySelectorAll('[data-fondu]').forEach(b => b.onclick = () => { this.fermerMenu(); const cle = b.dataset.fondu === 'in' ? 'entree' : 'sortie', d = Math.min((k.fin - k.debut) / 2, Math.max(.5, 60 / (P.bpm || 120))); m.modifier(() => { k[cle] = k[cle] > 0 ? 0 : d; }); });
      el.querySelectorAll('[data-trans]').forEach(b => b.onclick = () => { this.fermerMenu(); m.ajouterTransition(b.dataset.trans, tc, p.zone.id); });
      el.querySelectorAll('[data-ajout]').forEach(b => b.onclick = () => { this.fermerMenu(); m.deposer(b.dataset.ajout, { t, p, k: null }); });
      const nv = el.querySelector('[data-nouveau]'); if (nv) nv.onclick = () => { this.fermerMenu(); m.nouveauClip(p, t); };
    };
    if (k) m.choisir(k);
    dessiner();
    if (!el.innerHTML.trim() || el.innerHTML === '<h5>Ajouter ici</h5>') return this.fermerMenu();
    const L = innerWidth, H = innerHeight, r = el.getBoundingClientRect();
    el.style.left = Math.min(e.clientX, L - r.width - 6) + 'px'; el.style.top = Math.min(e.clientY, H - r.height - 6) + 'px';
    if (e.clientX + r.width + 200 > L) el.classList.add('gauche');   // le sous-menu s'ouvre à gauche s'il n'y a pas la place
    const loin = ev => { if (!el.contains(ev.target)) this.fermerMenu(); }, touche = ev => { if (ev.key === 'Escape') this.fermerMenu(); };
    setTimeout(() => { document.addEventListener('pointerdown', loin, true); document.addEventListener('keydown', touche, true); });
    this._fermer = () => { document.removeEventListener('pointerdown', loin, true); document.removeEventListener('keydown', touche, true); };
  }
  fermerMenu() { if (this._menu) { this._menu.remove(); this._menu = null; } if (this._fermer) { this._fermer(); this._fermer = null; } }
  // le dessin d'un calque à plusieurs couleurs, dans une lumière
  motif(c, k, x, y, w, h, W) {
    const cs = k.couleurs, n = cs.length;
    if (k.sorte === 'degrade') { const g = c.createLinearGradient(0, y, 0, y + h); cs.forEach((q, i) => g.addColorStop(i / (n - 1), q)); c.fillStyle = g; c.fillRect(x, y, w, h); return; }
    cs.forEach((q, i) => { c.fillStyle = q; c.fillRect(x, y + h * i / n, w, h / n + .5); });
  }
  // les calques de couleur : un bloc par groupe de lumières voisines
  dessinerCouleurs(c, lignes, W) {
    if (!lignes.length) return;
    const idx = {}, sel = this.m.selection; lignes.forEach((p, i) => { idx[p.zone.id] = i; });
    for (const k of this.m.projet.couleur.clips) {
      const x1 = this.x(k.debut), x2 = this.x(k.fin); if (x2 < 0 || x1 > W) continue;
      const is = k.zones.map(z => idx[z]).filter(i => i != null).sort((a, b) => a - b), blocs = [];
      for (const i of is) { const b = blocs.at(-1); if (b && b[1] === i - 1 && lignes[i].y === lignes[i - 1].y + lignes[i - 1].h + 1) b[1] = i; else blocs.push([i, i]); }   // une courbe dépliée entre deux lumières coupe le bloc
      for (const [a, b] of blocs) {
        const y = lignes[a].y + 1, h = lignes[b].y + lignes[b].h - 1 - y, w = Math.max(2, x2 - x1);
        c.save(); c.beginPath(); c.rect(x1, y, w, h); c.clip();
        c.fillStyle = k.couleur; c.fillRect(x1, y, w, h);
        if (k.sorte && k.couleurs && k.couleurs.length > 1) for (let i = a; i <= b; i++) this.motif(c, k, x1, lignes[i].y + 1, w, lignes[i].h - 2, W);   // bi-color / dégradé, dans chaque lumière
        c.fillStyle = 'rgba(0,0,0,.4)';
        if (k.entree > 0) { c.beginPath(); c.moveTo(x1, y); c.lineTo(x1 + k.entree * this.pps, y); c.lineTo(x1, y + h); c.fill(); }
        if (k.sortie > 0) { c.beginPath(); c.moveTo(x2, y); c.lineTo(x2 - k.sortie * this.pps, y); c.lineTo(x2, y + h); c.fill(); }
        c.restore();
        const ch = sel.has(k.id); c.strokeStyle = ch ? COUL.sel : 'rgba(0,0,0,.16)'; c.lineWidth = ch ? 2 : 1;   // bord discret : deux morceaux de la même couleur se lisent comme un seul
        c.beginPath(); c.roundRect(x1 + .5, y + .5, w - 1, h - 1, ch ? 4 : 0); c.stroke();
        if (ch) this.poignees(c, x1, x2, y, h);
      }
    }
    // les transitions : un bloc rayé à cheval sur la coupure
    for (const k of this.m.projet.transitions || []) {
      const x1 = this.x(k.debut), x2 = this.x(k.fin); if (x2 < 0 || x1 > W) continue;
      const is = (k.zones || Object.keys(idx)).map(z => idx[z]).filter(i => i != null).sort((a, b) => a - b), blocs = [];
      for (const i of is) { const b = blocs.at(-1); if (b && b[1] === i - 1 && lignes[i].y === lignes[i - 1].y + lignes[i - 1].h + 1) b[1] = i; else blocs.push([i, i]); }
      const ch = sel.has(k.id), w = Math.max(6, x2 - x1);
      for (const [a, b] of blocs) {
        const y = lignes[a].y + 3, h = lignes[b].y + lignes[b].h - 3 - y;
        c.save(); c.beginPath(); c.roundRect(x1, y, w, h, 4); c.clip();
        c.fillStyle = 'rgba(16,12,34,.72)'; c.fillRect(x1, y, w, h);
        c.strokeStyle = 'rgba(166,240,230,.55)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x1, y + h); c.lineTo(x1 + w, y); c.stroke();
        if (w > 60) { c.fillStyle = '#a6f0e6'; c.font = '600 10px "Work Sans"'; c.fillText((LT.TRANSITIONS[k.trans] || {}).nom || 'Transition', x1 + 5, y + 11); }
        c.restore();
        c.strokeStyle = ch ? COUL.sel : 'rgba(166,240,230,.6)'; c.lineWidth = ch ? 2 : 1; c.beginPath(); c.roundRect(x1 + .5, y + .5, w - 1, h - 1, 4); c.stroke();
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
    const pts = p.pts, col = COUL.courbe[p.cle] || COUL.courbe.zone, h = p.h - 6, y0 = p.y + 3, Y = v => y0 + h - LT.borne(v) * h;
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
      const tr = p.sorte === 'couleur' && (this.m.projet.transitions || []).slice().reverse().find(q => (!q.zones || q.zones.includes(p.zone.id)) && x >= this.x(q.debut) - 4 && x <= this.x(q.fin) + 4);
      if (tr) { const a = this.x(tr.debut), b = this.x(tr.fin), bord = Math.min(BORD, (b - a) / 3); return { x, y, p, k: tr, zone: x - a < bord ? 'gauche' : b - x < bord ? 'droite' : 'corps', t: this.t(x), trans: true }; }
      if (p.sorte === 'peches') k = [...l].reverse().find(q => Math.abs(this.x(q.t) - x) <= 5);
      else for (let i = l.length - 1; i >= 0; i--) { const q = l[i], a = this.x(q.debut), b = this.x(q.fin); if (x >= a - 4 && x <= b + 4) { k = q; const bord = Math.min(BORD, (b - a) / 3); zone = x - a < bord ? 'gauche' : b - x < bord ? 'droite' : 'corps'; break; } }   // les bords (pour changer la durée) : 9 px, ou un tiers d'un petit clip
    }
    // un effet / fond : ses fondus (« transitions ») d'entrée et de sortie se prennent à la main pour changer leur durée
    if (k && p.sorte === 'effets' && zone === 'corps') { const a = this.x(k.debut), b = this.x(k.fin); if (k.entree > 0 && x < a + k.entree * this.pps) zone = 'fondIn'; else if (k.sortie > 0 && x > b - k.sortie * this.pps) zone = 'fondOut'; }
    return { x, y, p, k, zone, t: this.t(x) };
  }
  // magnétisme : colle au curseur, aux bords des clips, aux pêches, à l'entrée / sortie
  aimanter(t, sauf) {
    if (!this.m.aimant) return t;
    let best = t, d = AIMANT / this.pps;
    const essai = v => { if (v != null && Math.abs(v - t) < d) { d = Math.abs(v - t); best = v; } };
    essai(this.m.temps); essai(this.m.entree); essai(this.m.sortie); essai(0);
    for (const q of this.m.projet.marqueurs || []) essai(q.t);
    const beat = 60 / (this.m.projet.bpm || 120), g0 = this.m.projet.grille || 0;
    if (beat * this.pps > 14) { const pg = this.pas(); essai(g0 + Math.round((t - g0) / pg) * pg); }   // la grille des temps
    else essai(g0 + Math.round((t - g0) / (beat * 4)) * beat * 4);
    for (const st of this.m.projet.stems || []) if (!st.muet) for (const [ct] of this.m.coupsDe(st)) essai(ct);
    for (const p of this.L) if (p.liste) for (const k of p.liste) { if (sauf && sauf.has(k.id)) continue; if (p.sorte === 'peches') essai(k.t); else { essai(k.debut); essai(k.fin); } }
    return best;
  }
  // ---------- glisser contre un bord : la timeline défile dans ce sens (plus on pousse, plus ça va vite) ----------
  // refaire(ev) rejoue le geste en cours (curseur, clip…) avec la nouvelle vue
  bordDefile(ev, refaire) {
    cancelAnimationFrame(this._def); this._def = 0;
    const r = this.cv.getBoundingClientRect(), B = 24, x = ev.clientX;
    const v = x < r.left + B ? x - (r.left + B) : x > r.right - B ? x - (r.right - B) : 0;   // en pixels au-delà de la zone
    if (!v) return;
    const pas = () => {
      const px = Math.sign(v) * Math.min(60, 3 + Math.abs(v) * .35);
      const d = Math.max(this.min(), this.debut + px / this.pps); if (d === this.debut && px < 0) return;
      this.debut = d; this._dansDefile = true; try { refaire(ev); } finally { this._dansDefile = false; } this.redessiner(); this._def = requestAnimationFrame(pas);
    };
    this._def = requestAnimationFrame(pas);
  }
  finDefile() { cancelAnimationFrame(this._def); this._def = 0; }
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
      // comme Premiere : un point ne passe jamais derrière son voisin, il s'arrête juste avant
      const i = pts.indexOf(q), av = pts[i - 1], ap = pts[i + 1], e = 1 / 120;
      let t = Math.max(0, ev.shiftKey ? q.t : this.aimanter(o2.t));
      if (av) t = Math.max(t, av.t + e); if (ap) t = Math.min(t, ap.t - e);
      q.t = t; q.v = +this.vDeY(p, o2.y).toFixed(3); m.change(true);
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
    // double-clic sur le nom d'un stem, d'une piste d'effets / fonds ou de pêches : le renommer
    this.tetes.addEventListener('dblclick', e => {
      let tete = e.target.closest('.lt2-tete'); const p = tete && this.L[+tete.dataset.i], obj = p && (p.stem || ((p.sorte === 'effets' || p.pistePeche) && p.piste)); if (!obj || e.target.closest('button')) return;
      if (this._rq) { cancelAnimationFrame(this._rq); this._rq = 0; this.dessiner(); tete = this.tetes.querySelector(`.lt2-tete[data-i="${tete.dataset.i}"]`); }   // le 1er clic a demandé un nouveau dessin : on le fait tout de suite
      const sp = tete.querySelector('span'), i = Object.assign(document.createElement('input'), { value: p.nom, className: 'lt2-renom' });
      sp.replaceWith(i); i.focus(); i.select(); let fini = false;
      const fin = ok => { if (fini) return; fini = true; const v = i.value.trim(); if (ok && v && v !== p.nom) m.modifier(() => { obj.nom = v.slice(0, 40); }); this._cle = null; this.redessiner(); m.inspecteur(); };
      i.onkeydown = ev => { ev.stopPropagation(); if (ev.key === 'Enter') fin(true); if (ev.key === 'Escape') fin(false); };
      i.onblur = () => fin(true); i.onclick = ev => ev.stopPropagation();
    });
    this.tetes.addEventListener('click', e => {
      const b = e.target.closest('button'), tete = e.target.closest('.lt2-tete');
      if (!b) { const p = tete && this.L[+tete.dataset.i]; if (p && p.sorte === 'stem' && m.stemChoisi !== p.stem.id) m.choisirStem(p.stem.id); return; }   // déjà choisi : on ne redessine pas (sinon le double-clic se perd)
      if (b.dataset.a === 'plier') { const k = b.dataset.k; this.ouverts.has(k) ? this.ouverts.delete(k) : this.ouverts.add(k); try { localStorage.setItem('lt2.ouverts', JSON.stringify([...this.ouverts])); } catch (x) {} this.redessiner(); return; }
      if (b.dataset.a === 'sonmuet') { m.son.muet = !m.son.muet; m.relancer(); this.redessiner(); }
      if (b.dataset.a === 'stem') m.ajouterStems();
      if (b.dataset.a === 'ecoute') { const p = this.L[+b.dataset.i], r = m.son.stems.get(p.stem.id); if (r) { r.ecoute = !r.ecoute; m.relancer(); this.redessiner(); } }
      if (b.dataset.a === 'muet') { const p = this.L[+b.dataset.i]; m.modifier(() => { p.piste.muet = !p.piste.muet; }); }
      if (b.dataset.a === 'plusPeche') m.modifier(() => { const A = m.projet.peches.autres = m.projet.peches.autres || []; A.push({ id: LT.id(), nom: 'Pêches ' + (A.length + 2), clips: [] }); });
      if (b.dataset.a === 'plus') m.modifier(() => m.projet.effets.push({ id: LT.id(), nom: 'Effets ' + (m.projet.effets.length + 1), clips: [] }));
    });
    // la règle : cliquer / glisser = déplacer le curseur
    this.cvR.addEventListener('contextmenu', e => {
      e.preventDefault(); const r = this.cvR.getBoundingClientRect(), x = e.clientX - r.left, q = this.marqueurSous(x);
      if (q) return this.menuMarqueur(e, q);
      // clic droit sur la règle (la tête de lecture) : ajouter un marqueur, comme Premiere
      this.fermerMenu(); const el = document.createElement('div'); el.className = 'lt2-menu'; document.body.appendChild(el); this._menu = el;
      const t = Math.abs(x - this.x(m.temps)) <= 10 ? m.temps : Math.max(0, this.aimanter(this.t(x)));
      el.innerHTML = `<button data-mk class="lt2-menu-pri">Ajouter un marqueur</button>`; el.style.left = e.clientX + 'px'; el.style.top = e.clientY + 'px';
      el.querySelector('[data-mk]').onclick = () => { this.fermerMenu(); m.ajouterMarqueur(t); };
      const loin = ev => { if (!el.contains(ev.target)) this.fermerMenu(); }; setTimeout(() => document.addEventListener('pointerdown', loin, true)); this._fermer = () => document.removeEventListener('pointerdown', loin, true);
    });
    this.cvR.addEventListener('dblclick', e => { const r = this.cvR.getBoundingClientRect(), q = this.marqueurSous(e.clientX - r.left); if (q) this.nommerMarqueur(q); });
    this.cvR.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      const r = this.cvR.getBoundingClientRect(), q = this.marqueurSous(e.clientX - r.left);
      if (q) {   // un marqueur : clic = y aller ; glisser = le déplacer
        const x0 = e.clientX, t0 = q.t; let bouge = false; this.cvR.setPointerCapture(e.pointerId); m.aller(q.t);
        this.cvR.onpointermove = ev => { if (!bouge && Math.abs(ev.clientX - x0) < 3) return; if (!bouge) { bouge = true; m.memoriser(); } q.t = Math.max(0, this.aimanter(t0 + (ev.clientX - x0) / this.pps)); m.aller(q.t); };
        this.cvR.onpointerup = () => { this.cvR.onpointermove = null; if (bouge) { m.projet.marqueurs.sort((a, b) => a.t - b.t); m.change(); } };
        return;
      }
      const va = ev => m.aller(Math.max(m.debutMin(), this.t(Math.min(Math.max(ev.clientX, r.left), r.right) - r.left))), go = ev => {
        // glisser vers le bas = zoom, vers le haut = dézoom (comme Premiere), autour de la tête de lecture
        const dy = ev.clientY - (this._yR ?? ev.clientY); this._yR = ev.clientY;
        if (dy) { this._dyR = (this._dyR || 0) + dy; if (Math.abs(this._dyR) > 6 || this._zR) { this._zR = true; this.zoomer(Math.exp(dy * .015), this.x(m.temps)); } }
        if (!this._zR || Math.abs(ev.movementX || 0) > 2) va(ev); this.bordDefile(ev, va);
      };
      this._yR = e.clientY; this._dyR = 0; this._zR = false;
      go(e); this.cvR.setPointerCapture(e.pointerId);
      this.cvR.onpointermove = go; this.cvR.onpointerup = () => { this.cvR.onpointermove = null; this.finDefile(); };
    });
    cv.addEventListener('pointermove', e => {
      if (this.glisse) return;
      const o = this.ou(e);
      cv.style.cursor = m.outil === 'main' ? 'grab' : m.outil === 'rasoir' ? 'crosshair' : o.k && o.zone !== 'corps' ? (o.zone === 'fondIn' || o.zone === 'fondOut' ? 'col-resize' : 'ew-resize') : o.k ? 'grab' : 'default';
      if (m.outil === 'rasoir') { this.survol = this.x(this.aimanter(o.t)); this.redessiner(); }
    });
    cv.addEventListener('pointerleave', () => { if (this.survol != null) { this.survol = null; this.redessiner(); } });
    cv.addEventListener('pointerdown', e => {
      if (e.button === 1 || (e.button === 0 && m.outil === 'main')) {   // la main (H) ou le clic du milieu : glisser la timeline
        e.preventDefault(); const x0 = e.clientX, d0 = this.debut; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing';
        cv.onpointermove = ev => { this.debut = Math.max(this.min(), d0 - (ev.clientX - x0) / this.pps); this.redessiner(); };
        cv.onpointerup = () => { cv.onpointermove = null; cv.style.cursor = m.outil === 'main' ? 'grab' : 'default'; };
        return;
      }
      if (e.button !== 0) return;
      const o = this.ou(e);
      if (o.p && o.p.sorte === 'courbe' && this.courbeClic(e, o)) return;
      if (this.pointChoisi) { this.pointChoisi = null; this.redessiner(); }   // on a cliqué ailleurs : plus de point clé choisi
      if (o.p && o.p.sorte === 'stem') m.choisirStem(o.p.stem.id);
      if (m.outil === 'rasoir') { if (o.k && o.p.sorte !== 'peches' && !o.k.trans) m.couper(o.k, o.p.liste, this.aimanter(o.t)); return; }
      if (!o.k) return this.selectionCadre(e, o);   // dans le vide : curseur, ou rectangle de sélection si on glisse
      // sélection : Maj ou Ctrl = ajouter / retirer
      if (e.shiftKey || e.ctrlKey || e.metaKey) m.choisir(o.k, 'basculer');
      else if (!m.selection.has(o.k.id)) m.choisir(o.k);
      // préparer le glisser (la modification n'est enregistrée qu'au premier vrai mouvement)
      const choisis = m.clipsChoisis(), x0 = e.clientX, t0 = o.t;
      const orig = choisis.map(c => ({ c, debut: c.k.debut, fin: c.k.fin, t: c.k.t, zones: c.k.zones && c.k.zones.slice(), entree: c.k.entree || 0, sortie: c.k.sortie || 0 }));
      this.glisse = { o, bouge: false };
      cv.setPointerCapture(e.pointerId);
      cv.onpointermove = ev => {
        if (!this.glisse.bouge) { if (Math.abs(ev.clientX - x0) < 3 && Math.abs(ev.clientY - e.clientY) < 3) return; this.glisse.bouge = true; m.memoriser();
          // Alt : on glisse une COPIE, l'original reste à sa place (comme dans Premiere)
          if ((e.altKey || ev.altKey) && o.zone === 'corps') choisis.forEach(c => { const n = JSON.parse(JSON.stringify(c.k)); n.id = LT.id(); c.liste.push(n); });
          // un seul calque choisi qui couvre plusieurs lumières : on ne touche que la lumière prise en main (les autres restent)
          if (choisis.length === 1 && o.p.sorte === 'couleur' && !o.k.trans && o.k.zones && o.k.zones.length > 1 && o.p.zone && !(e.altKey || ev.altKey)) {
            const reste = JSON.parse(JSON.stringify(o.k)); reste.id = LT.id(); reste.zones = o.k.zones.filter(z => z !== o.p.zone.id);
            m.projet.couleur.clips.push(reste); o.k.zones = [o.p.zone.id]; orig[0].zones = o.k.zones.slice();
          }
        }
        if (!this._dansDefile) this.bordDefile(ev, x => cv.onpointermove && cv.onpointermove(x));
        const o2 = this.ou(ev); let dt = o2.t - t0;
        if (o.zone === 'fondIn' || o.zone === 'fondOut') {   // la durée du fondu d'entrée / de sortie
          const q = orig.find(r => r.c.k === o.k), k = o.k, L = k.fin - k.debut;
          if (o.zone === 'fondIn') k.entree = Math.max(0, Math.min(L - (k.sortie || 0), q.entree + dt)); else k.sortie = Math.max(0, Math.min(L - (k.entree || 0), q.sortie - dt));
        } else if (o.zone === 'corps') {
          // on aimante le bord le plus proche du clip pris en main
          const ref = orig.find(q => q.c.k === o.k), sauf = new Set(choisis.map(c => c.k.id));
          if (o.p.sorte === 'peches') dt = this.aimanter(ref.t + dt, sauf) - ref.t;
          else { const a = this.aimanter(ref.debut + dt, sauf) - ref.debut, b = this.aimanter(ref.fin + dt, sauf) - ref.fin; dt = Math.abs(a - dt) <= Math.abs(b - dt) ? (a !== dt ? a : b) : b; }
          const mini = Math.min(...orig.map(q => q.t ?? q.debut)); if (mini + dt < 0) dt = -mini;
          orig.forEach(q => { if (q.t != null) q.c.k.t = q.t + dt; else { q.c.k.debut = q.debut + dt; q.c.k.fin = q.fin + dt; } });
          // un clip de couleur glissé vers le haut / le bas : il passe sur d'autres lumières (le groupe garde sa forme)
          if (choisis.length === 1 && o.p.sorte === 'couleur' && o.k.zones && o2.p && o2.p.sorte === 'couleur') {
            const ids = m.projet.materiel.zones.map(z => z.id), dz = ids.indexOf(o2.p.zone.id) - ids.indexOf(o.p.zone.id), q = orig[0];
            const nz = q.zones.map(z => ids[ids.indexOf(z) + dz]); if (nz.every(Boolean)) o.k.zones = nz;
          }
          // un déclencheur glissé sur la ligne d'un autre stem : il suit ce stem
          if (choisis.length === 1 && o.p.sorte === 'stem' && o2.p && o2.p.sorte === 'stem') o.k.stem = o2.p.stem.id;
          // un seul clip d'effet : il peut changer de piste d'effets
          if (choisis.length === 1 && !o.k.trans && o2.p && o2.p.liste && o2.p.liste !== choisis[0].liste && this.famille(o2.p.sorte) === this.famille(o.p.sorte)) {
            const c = choisis[0]; c.liste.splice(c.liste.indexOf(c.k), 1); o2.p.liste.push(c.k); c.liste = o2.p.liste;
          }
        } else {
          // tirer un bord : tous les clips choisis bougent ce même bord d'autant (comme Premiere), le pris en main colle au magnétisme
          const q = orig.find(r => r.c.k === o.k), k = o.k, mini = .05, sauf = new Set(choisis.map(c => c.k.id));
          const d = o.zone === 'gauche' ? Math.min(q.fin - mini, Math.max(0, this.aimanter(q.debut + dt, sauf))) - q.debut : Math.max(q.debut + mini, this.aimanter(q.fin + dt, sauf)) - q.fin;
          for (const r of orig) { if (r.debut == null) continue; const c = r.c.k;
            if (o.zone === 'gauche') c.debut = Math.min(r.fin - mini, Math.max(0, r.debut + d)); else c.fin = Math.max(r.debut + mini, r.fin + d); }
        }
        m.change(true);
      };
      cv.onpointerup = () => { cv.onpointermove = null; this.finDefile(); const b = this.glisse.bouge; this.glisse = null;
        if (b && o.p.sorte === 'couleur') choisis.forEach(q => m.projet.couleur.clips.includes(q.k) && m.faireDeLaPlace(q.k));   // un calque de couleur déplacé ou étiré passe par-dessus les autres
        if (b) m.change(); else if (!e.shiftKey && !e.ctrlKey && !e.metaKey) { m.choisir(o.k); m.aller(Math.max(0, o.t)); } };
    });
    // clic droit sur un losange : sa forme (droite → arrondie → palier)
    cv.addEventListener('contextmenu', e => {
      const o = this.ou(e); if (o.p && o.p.sorte !== 'courbe') { e.preventDefault(); this.menu(e, o); return; }
      if (!o.p || o.p.sorte !== 'courbe') return; e.preventDefault();
      const q = this.pointSous(o); if (!q) return;
      m.modifier(() => { q.forme = { lin: 'lisse', lisse: 'palier', palier: 'lin' }[q.forme || 'lin']; });
    });
    // double-clic dans le vide d'une piste = un nouveau clip ici
    cv.addEventListener('dblclick', e => {
      const o = this.ou(e);
      if (o.p && o.p.sorte === 'courbe') { const q = this.pointSous(o); if (q) m.modifier(() => { o.p.pts.splice(o.p.pts.indexOf(q), 1); this.pointChoisi = null; }); return; }
      if (!o.p || !o.p.liste) return;
      if (o.k) { if (o.p.sorte !== 'peches') { m.choisir(o.k); m.aller(o.k.debut); } return; }
      if (o.p.sorte !== 'stem') m.nouveauClip(o.p, this.aimanter(Math.max(0, o.t)));   // plus de déclencheurs à poser : les calques « réagissent à » un stem
    });
    // molette : temps / pistes / zoom
    // molette : descendre / monter dans les pistes ; Alt + molette = zoom (avant = agrandir, arrière = rétrécir) ;
    // Ctrl + molette (ou glisser de côté sur le pavé tactile) = avancer / reculer dans le temps
    this.corps.addEventListener('wheel', e => {
      const tete = e.altKey && e.target.closest('.lt2-tete');
      if (tete) {   // Alt + molette sur le nom d'une piste : plus haute / plus basse
        e.preventDefault(); const p = this.L[+tete.dataset.i]; if (!p) return;
        const h = Math.max(12, Math.min(160, Math.round(p.h + (e.deltaY < 0 ? 4 : -4)))); this.hauteurs[p.cleH] = h;
        try { localStorage.setItem('lt2.hauteurs', JSON.stringify(this.hauteurs)); } catch (x) {} this.redessiner(); return;
      }
      if (e.altKey) { e.preventDefault(); const d = e.deltaY || e.deltaX; if (d) this.zoomer(d < 0 ? 1.2 : 1 / 1.2, e.clientX - this.cv.getBoundingClientRect().left); return; }
      if (e.ctrlKey || (Math.abs(e.deltaX) > Math.abs(e.deltaY) && !e.shiftKey)) { e.preventDefault(); this.debut = Math.max(this.min(), this.debut + (e.deltaY + e.deltaX) / this.pps * .8); this.redessiner(); return; }
      // sinon : le défilement normal des pistes (haut / bas)
    }, { passive: false });
    // glisser depuis la bibliothèque
    cv.addEventListener('dragover', e => { const o = this.ou(e); if (o.p && (o.p.liste)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; this.survolDepot = o; this.redessiner(); } });
    cv.addEventListener('dragleave', () => { this.survolDepot = null; this.redessiner(); });
    cv.addEventListener('drop', e => { e.preventDefault(); const q = e.dataTransfer.getData('text/plain') || m.glisse, o = this.ou(e); this.survolDepot = null; if (q) m.deposer(q, Object.assign(o, { t: this.aimanter(o.t) })); });
  }
}
LT.Timeline = Timeline;
})(typeof self !== 'undefined' ? self : this);
