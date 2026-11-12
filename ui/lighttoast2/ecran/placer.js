// =====================================================================
// LIGHT TOAST — l'outil « PLACER LES OBJETS » (vue 3D, version d'essai seulement : LT.modeReglage = true)
//
//   Sert à régler une bonne fois la place des objets du studio. Quand c'est fini :
//   « Copier le placement » → on le colle dans studio.js → mesures().placement (définitif).
//
//   clic sur un objet ──► il est entouré d'un cadre jaune
//        ├─ glisser          → il bouge sur le sol
//        ├─ glisser + Maj    → il monte / descend
//        ├─ molette dessus   → il tourne (Maj = petit pas)
//        └─ le panneau       → réglages précis + « Remettre comme avant »
//   Clic dans le vide = tourner la caméra comme d'habitude. Ctrl+Z = annuler.
//   Cliquer un membre = déplacer la PLACE de son instrument (le « poste »).
//   Le réglage est gardé dans le navigateur (localStorage) en attendant.
// =====================================================================
(function (G) {
const LT = G.LT, CLE = 'lt2-placement';
LT.placementEssai = () => { try { return LT.modeReglage ? JSON.parse(localStorage.getItem(CLE) || 'null') : null; } catch (e) { return null; } };

const NOMS = { t1: 'Tube 1', t2: 'Tube 2', t3: 'Tube 3', t4: 'Tube 4', p1: 'Panneau (5)', batterie: 'Batterie', bongos: 'Bongos', conga: 'Conga',
  'ampli-basse': 'Ampli de basse', 'ampli-bas': 'Ampli (bas)', 'ampli-haut': 'Ampli (haut)', basse: 'Basse', micro: 'Micro', 'micro-2': 'Micro 2', orgue: 'Orgue',
  fauteuil: 'Canapé', 'meuble-ampli': 'Petit meuble', 'meuble-amplis': 'Meuble des amplis', 'rideau-g': 'Rideau gauche', 'tapis-batterie': 'Tapis de la batterie', tapis: 'Tapis', 'chaise-bureau': 'Chaise du bureau', 'lampe-globe': 'Lampe Globe', 'bois-fenetres': 'Bois (mur des fenêtres)', 'bois-gauche': 'Bois (retour à gauche)', 'mousse-g': 'Mousse beige (gauche)', 'mousse-d1': 'Mousse beige (droite 1)', 'mousse-d2': 'Mousse beige (droite 2)', 'mousse-noire-1': 'Mousse noire (fond)', 'mousse-noire-2': 'Mousse noire (droite)', etagere: 'Étagère rouge', bureau: 'Bureau', veilleuse: 'Petite lampe (canapé)', 'suspension-1': 'Suspension 1', 'suspension-2': 'Suspension 2', 'lampe-bureau': 'Lampe du bureau', 'lampe-ampli': 'Lampe à côté de l\'ampli', 'rideau-d': 'Rideau droit', tabouret: 'Tabouret', plante: 'Plante', 'guitare-mur': 'Jaguar (mur)', 'guitare-mur2': 'Jaguar', 'guitare-mur3': 'Explorer' };
const nomDe = n => n.includes('~') ? nomDe(n.split('~')[0]) + ' (copie ' + n.split('~')[1] + ')' : n.startsWith('poste:') ? 'Place : ' + ((LT.studio.mesures().postes[n.slice(6)] || {}).nom || n) : (NOMS[n] || n);

class Placer {
  constructor(v, el) {
    this.v = v; this.el = el; this.T = v.T; this.choix = null; this.hist = []; this.actif = false;
    const can = v.r.domElement, T = this.T;
    this.ray = new T.Raycaster(); this.cadre = new T.BoxHelper(undefined, '#ffcc33'); this.cadre.visible = false; v.scene.add(this.cadre);
    // capture : passe avant la caméra quand on touche un objet
    can.addEventListener('pointerdown', e => this.appui(e), true);
    can.addEventListener('wheel', e => this.molette(e), { capture: true, passive: false });
    this._clavier = e => {
      if (!this.actif) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.stopImmediatePropagation(); this.annuler(); }
      else if (e.key === 'Escape') { e.stopImmediatePropagation(); this.choisir(null); }
      else if (this.choix && /^Arrow/.test(e.key) && !/INPUT|SELECT|TEXTAREA/.test((e.target || {}).tagName)) {   // flèches = pousser de 1 cm (Maj = 10 cm)
        e.preventDefault(); e.stopImmediatePropagation(); const pas = e.shiftKey ? .1 : .01, d = this.P[this.choix] || {};
        if (!e.repeat) this.memoriser();
        if (e.key === 'ArrowLeft') this.regler('dx', (d.dx || 0) - pas); if (e.key === 'ArrowRight') this.regler('dx', (d.dx || 0) + pas);
        if (e.key === 'ArrowUp') this.regler('dz', (d.dz || 0) - pas); if (e.key === 'ArrowDown') this.regler('dz', (d.dz || 0) + pas);
      }
    };
    document.addEventListener('keydown', this._clavier, true);
  }
  activer(oui) { this.actif = oui; this.el.hidden = !oui; if (!oui) this.choisir(null); else this.panneau(); }
  get P() { return this.v.placement; }

  // ce qu'il y a sous la souris (seulement les objets déplaçables, visibles)
  viser(e) {
    const T = this.T, r = this.v.r.domElement.getBoundingClientRect();
    this.souris = new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    this.ray.setFromCamera(this.souris, this.v.cam);
    const cibles = Object.values(this.v.cibles).map(c => c.g).concat(this.v.S.membres.children);
    for (const h of this.ray.intersectObjects(cibles, true)) {
      let o = h.object, vu = true, nom = null;
      for (; o; o = o.parent) { if (!o.visible) vu = false; if (!nom && o.userData.cible) nom = o.userData.cible; }
      if (vu && nom) return { nom, point: h.point };
    }
    return null;
  }
  appui(e) {
    if (!this.actif || e.button !== 0) return;
    const h = this.viser(e); if (!h) return;
    e.stopImmediatePropagation(); e.preventDefault();
    this.choisir(h.nom); this.memoriser();
    const T = this.T, can = this.v.r.domElement, d0 = Object.assign({}, this.P[h.nom]), plan = new T.Plane(new T.Vector3(0, 1, 0), -h.point.y), p0 = h.point.clone(), y0 = e.clientY;
    can.setPointerCapture(e.pointerId); let bouge = false;
    const deplacer = ev => {
      bouge = true; const d = this.P[h.nom] = Object.assign({}, this.P[h.nom]);
      if (ev.shiftKey && !h.nom.startsWith('poste:')) d.dy = +((d0.dy || 0) + (y0 - ev.clientY) * .004).toFixed(3);
      else {
        this.viser(ev); const p = new T.Vector3(); if (!this.ray.ray.intersectPlane(plan, p)) return;
        const dv = p.sub(p0), corps = d0.main && this.v.corps(d0.main); if (corps) dv.applyQuaternion(corps.quat.clone().invert());   // tenu : dans le sens du membre
        d.dx = +((d0.dx || 0) + dv.x).toFixed(3); d.dz = +((d0.dz || 0) + dv.z).toFixed(3);
      }
      this.v.appliquer(h.nom); this.majCadre();
    };
    const fin = () => { can.removeEventListener('pointermove', deplacer); can.removeEventListener('pointerup', fin); if (bouge) { this.garder(); this.panneau(); } else this.hist.pop(); };
    can.addEventListener('pointermove', deplacer); can.addEventListener('pointerup', fin);
  }
  molette(e) {
    if (!this.actif || !this.choix) return;
    const h = this.viser(e); if (!h || h.nom !== this.choix) return;
    e.preventDefault(); e.stopImmediatePropagation();
    clearTimeout(this._mol); if (!this._mol) this.memoriser();
    this._mol = setTimeout(() => { this._mol = null; this.garder(); this.panneau(); }, 400);
    this.regler('r', ((this.P[this.choix] || {}).r || 0) + (e.deltaY > 0 ? 1 : -1) * (e.shiftKey ? 1 : 5), true);
  }
  regler(cle, val, vite) {
    const n = this.choix; if (!n) return;
    const d = this.P[n] = Object.assign({}, this.P[n]); d[cle] = +(+val).toFixed(3);
    if (/^r/.test(cle)) d[cle] = ((d[cle] % 360) + 540) % 360 - 180;
    this.v.appliquer(n); this.majCadre(); if (!vite) { this.garder(); this.panneau(); }
  }
  choisir(nom) { this.choix = nom; this.majCadre(); if (this.actif) this.panneau(); this.v.rendre(); }
  majCadre() {
    const n = this.choix, c = n && (this.v.cibles[n] || null);
    let obj = c && c.g;
    if (n && n.startsWith('poste:')) obj = this.v.S.membres.children.find(o => o.visible && o.userData.cible === n) || null;
    this.cadre.visible = !!obj && obj.visible; if (this.cadre.visible) this.cadre.setFromObject(obj); this.v.rendre();
  }
  memoriser() { this.hist.push(JSON.stringify(this.P)); if (this.hist.length > 100) this.hist.shift(); }
  annuler() { const s = this.hist.pop(); if (s == null) return; this.v.placement = JSON.parse(s); this.v.appliquer(); this.majCadre(); this.garder(); this.panneau(); }
  garder() {
    for (const [n, d] of Object.entries(this.P)) { for (const k in d) if ((!d[k] && !/^k/.test(k)) || (/^k/.test(k) && (d[k] === 1 || d[k] == null))) delete d[k]; if (!Object.keys(d).length) delete this.P[n]; }
    try { localStorage.setItem(CLE, JSON.stringify(this.P)); } catch (e) { }
    this.onChange && this.onChange();
  }
  // le panneau de réglage (en haut à droite de la vue 3D)
  panneau() {
    const n = this.choix, d = (n && this.P[n]) || {}, poste = n && n.startsWith('poste:');
    const champ = (cle, nom, pas, unite, val) => `<label>${nom}<input type="number" step="${pas}" data-c="${cle}" value="${val}"><i>${unite}</i></label>`;
    this.el.innerHTML = `<b>Placer les objets</b>
      <p>${n ? nomDe(n) : 'Clique un objet. Glisser = bouger · Maj + glisser = monter · molette = tourner.'}</p>
      ${n ? `<div class="lt2-pl-c">${champ('dx', 'Gauche / droite', .01, 'm', d.dx || 0)}${champ('dz', 'Avant / arrière', .01, 'm', d.dz || 0)}
        ${poste ? '' : champ('dy', 'Monter / descendre', .01, 'm', d.dy || 0)}
        ${poste ? champ('r', 'Rotation Y', 1, '°', d.r || 0) : champ('rx', 'Rotation X', 1, '°', d.rx || 0) + champ('r', 'Rotation Y', 1, '°', d.r || 0) + champ('rz', 'Rotation Z', 1, '°', d.rz || 0)
          + champ('k', 'Taille (tout)', 5, '%', Math.round((d.k || 1) * 100)) + champ('kx', 'Largeur (X)', 5, '%', Math.round((d.kx || 1) * 100))
          + champ('ky', 'Hauteur (Y)', 5, '%', Math.round((d.ky || 1) * 100)) + champ('kz', 'Profondeur (Z)', 5, '%', Math.round((d.kz || 1) * 100))}</div>
        ${poste || !this.v.S.pieces[n] ? '' : `<label class="lt2-pl-m">Dans les mains de <select data-main><option value="">personne</option>${Object.entries(LT.studio.mesures().postes).map(([k, o]) => `<option value="${k}"${d.main === k ? ' selected' : ''}>celui qui joue : ${o.nom}</option>`).join('')}</select></label>`}
        <div class="lt2-pl-b"><button data-p="reset">Remettre comme avant</button>${poste ? '' : `<button data-p="cache">${d.copie ? 'Supprimer la copie' : d.cache ? 'Remettre dans le studio' : 'Supprimer'}</button>`}${this.v.S.pieces[n] || d.copie ? '<button data-p="dup">Dupliquer</button>' : ''}</div>` : ''}
      <div class="lt2-pl-b"><button data-p="copier" class="lt2-pri">${this.nomCopier || 'Copier le placement'}</button><button data-p="tout">Tout remettre</button>${this.onFin ? '<button data-p="fin">Terminer</button>' : ''}</div>
      <textarea readonly hidden></textarea>`;
    this.el.querySelectorAll('[data-c]').forEach(i => {
      i.onfocus = () => this.memoriser();
      i.oninput = () => { const v = +i.value || 0; this.regler(i.dataset.c, /^k/.test(i.dataset.c) ? Math.max(.05, v / 100) : v, true); };
      i.onchange = () => { this.garder(); };
      i.onkeydown = e => e.stopPropagation();   // les flèches / lettres ne pilotent pas la timeline
    });
    const sm = this.el.querySelector('[data-main]');
    if (sm) sm.onchange = () => {   // le prendre en main : on repart de réglages vides (collé au buste) ; le poser : retour à sa place
      this.memoriser(); const t = { k: d.k, kx: d.kx, ky: d.ky, kz: d.kz }; this.P[n] = sm.value ? Object.assign(t, { main: sm.value, dy: -.38, dz: .14, rz: -62 }) : t;   // tenu comme une guitare : à la taille, manche vers sa gauche
      this.v.appliquer(n); this.majCadre(); this.garder(); this.panneau();
    };
    this.el.querySelectorAll('[data-p]').forEach(b => b.onclick = () => {
      const a = b.dataset.p;
      if (a === 'dup') {   // une copie, posée un peu à côté
        this.memoriser(); const src = d.copie || n; let i = 2; while (this.P[src + '~' + i]) i++;
        const c = src + '~' + i; this.P[c] = Object.assign({}, d, { copie: src, dx: +((d.dx || 0) + .4).toFixed(3) }); delete this.P[c].cache; delete this.P[c].main;
        this.v.appliquer(); this.garder(); this.choisir(c); return;
      }
      if (a === 'cache' && d.copie) { this.memoriser(); delete this.P[n]; this.v.appliquer(); this.garder(); this.choisir(null); return; }
      if (a === 'cache') { this.memoriser(); const x = this.P[n] = Object.assign({}, d); if (x.cache) delete x.cache; else x.cache = true; this.v.appliquer(n); this.majCadre(); this.garder(); this.panneau(); }
      if (a === 'reset') { this.memoriser(); delete this.P[n]; this.v.appliquer(n); this.majCadre(); this.garder(); this.panneau(); }
      if (a === 'tout' && confirm('Remettre tous les objets à leur place de départ ?')) { this.memoriser(); this.v.placement = {}; this.v.appliquer(); this.choisir(null); this.garder(); }
      if (a === 'fin') this.onFin && this.onFin();
      if (a === 'copier' && this.onCopier) { this.onCopier(b); return; }
      if (a === 'copier') {
        const t = JSON.stringify(this.P, null, 1), z = this.el.querySelector('textarea');
        z.hidden = false; z.value = t; z.select();
        try { navigator.clipboard.writeText(t).then(() => { b.textContent = 'Copié ! Colle-le à Claude'; }, () => { b.textContent = 'Fais Ctrl+C dans le cadre'; }); } catch (e) { b.textContent = 'Fais Ctrl+C dans le cadre'; }
      }
    });
  }
}
LT.Placer = Placer; Placer.nomDe = nomDe;
})(typeof self !== 'undefined' ? self : this);
