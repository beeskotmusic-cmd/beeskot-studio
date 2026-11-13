// =====================================================================
// LIGHT TOAST — l'écran de montage : tout tient ensemble ici.
//
//   ┌ Bibliothèque ┬────── Moniteur ──────┬ Inspecteur ┐
//   ├──────────────┴─ barre : outils · lecture · zoom ─┴────────────┤
//   └──────────────────────── Timeline ─────────────────────────────┘
//
// Ici : l'état (temps, sélection, outil, entrée / sortie), annuler / rétablir,
// copier / coller, les raccourcis, la lecture, le moniteur.
// Toute modification du projet passe par  m.modifier(() => { ... })  → annulable.
// =====================================================================
(function (G) {
const LT = G.LT;
const fmt = t => { t = Math.max(0, t); const m = Math.floor(t / 60), s = Math.floor(t % 60), i = Math.floor((t % 1) * 60); return `${m}:${String(s).padStart(2, '0')}:${String(i).padStart(2, '0')}`; };
const clone = o => JSON.parse(JSON.stringify(o));

class Montage {
  constructor(racine, projet) {
    this.projet = projet; this.temps = 0; this.vitesse = 0; this.outil = 'selection'; this.aimant = true;
    this.entree = null; this.sortie = null; this.selection = new Set();
    this.avant = []; this.apres = []; this.pressePapiers = null; this.ecouteurs = [];
    LT.materiel.aJour(projet); this.moteur = new LT.Moteur(projet); this.son = new LT.Son(); this.pics = null; this.sr = 44100; this.stemChoisi = null; this._coups = new Map(); this.listePassages = [];
    racine.classList.add('lt2');
    racine.innerHTML = `
      <div class="lt2-haut"><div class="lt2-sep" data-sep="g" title="Glisse pour élargir ou réduire (double-clic : taille de départ)"></div><div class="lt2-sep" data-sep="d" title="Glisse pour élargir ou réduire (double-clic : taille de départ)"></div>
        <section class="lt2-pan lt2-biblio"><h3>Bibliothèque</h3>
          <h4>Musique</h4><div class="lt2-musique"><div class="lt2-mnom">Aucune musique</div><button data-a="musique" class="lt2-pri">Choisir la musique…</button>
</div>
          <div class="lt2-biblio-l"></div></section>
        <section class="lt2-pan lt2-moni"><div class="lt2-moni-h"><h3>Moniteur</h3>
          <span class="lt2-seg lt2-mode"><button data-vue="tubes" class="on" title="L'image envoyée aux tubes">Tubes</button><button data-vue="3d" title="Le studio éclairé par les tubes">Studio 3D</button></span>
          <span class="lt2-3dc" hidden><span class="lt2-seg"><button data-cam="camera" title="La place du photographe">Caméra</button><button data-cam="large">Large</button><button data-cam="dessus">Dessus</button><button data-cam="regie" title="Vers le fond du studio">Arrière</button></span>
          <select data-amb title="La lumière de la pièce"><option value="noir">Noir</option><option value="tamise" selected>Tamisé</option><option value="jour">Jour</option></select>
          <label><input type="checkbox" data-membres checked> Membres</label>
          <button data-plein title="Plein écran (Échap pour sortir)">⛶</button><select data-qualite title="La qualité de la vue 3D sur ce PC (ne change pas la vidéo des tubes)"><option value="low">Low (rapide)</option><option value="mid">Mid</option><option value="high">High (lent)</option></select><button data-lampes title="La couleur et la force des lampes de la pièce, pour ce morceau">Lumières</button>${LT.modeReglage ? '<button data-placer title="Régler la place des objets du studio">Placer les objets</button>' : ''}</span></div>
          <div class="lt2-ecran"><canvas width="1920" height="1080"></canvas><div class="lt2-3d" hidden></div><div class="lt2-roles" hidden></div><div class="lt2-charge" hidden></div><div class="lt2-placer" hidden></div><div class="lt2-lampes" hidden></div></div><div class="lt2-pleinlec"><button data-pl="debut" title="Début">⏮</button><button data-pl="lire" title="Lecture / pause (Espace)">▶</button><button data-pl="fin" title="Fin">⏭</button><span class="lt2-pl-t">0:00:00</span><div class="lt2-pl-barre"><i></i></div><span class="lt2-pl-d">0:00</span></div></section>
        <section class="lt2-pan lt2-insp"><h3>Inspecteur</h3><div class="lt2-insp-c"></div></section>
      </div>
      <div class="lt2-barre"><div class="lt2-sep-b" data-sep="b" title="Glisse pour agrandir ou réduire la timeline (double-clic : taille de départ)"></div>
        <span class="lt2-grp"><button data-o="selection" title="Sélection (V)">V</button><button data-o="rasoir" title="Rasoir (C)">✂</button><button data-o="main" title="Main (H) : glisser pour aller à gauche / à droite. Garder H appuyé = le temps de l'appui">✋</button><button data-a="aimant" title="Magnétisme (S)">⊓</button></span>
        <span class="lt2-grp"><button data-a="annuler" title="Annuler (Ctrl+Z)">↶</button><button data-a="retablir" title="Rétablir (Ctrl+Maj+Z)">↷</button></span>
        <span class="lt2-grp lt2-lect"><button data-a="debut" title="Début (Origine)">⏮</button><button data-a="lire" class="lt2-pri" title="Lecture / pause (Espace)">▶</button><button data-a="fin" title="Fin (Fin)">⏭</button></span>
        <span class="lt2-lcd" title="minutes : secondes : images">0:00:00</span>
        <span class="lt2-grp"><button data-a="zmoins" title="Zoom − (-)">−</button><button data-a="tout" title="Tout voir (\\)">⟷</button><button data-a="zplus" title="Zoom + (+)">+</button></span>
        <span class="lt2-grp lt2-pass"><select class="lt2-passage" title="Les passages des Reels du morceau (Reels Audio, Tournages, Discord, Synch bread) : en choisir un pose I / O"><option value="">Passage : morceau entier</option><option disabled>(choisis d'abord la musique)</option></select><button data-a="ralenti" hidden title="Jouer (et exporter) à la vitesse du tournage">Vitesse tournage</button></span>
        <span class="lt2-aide">J K L · I / O · C · V · S · Ctrl+K couper · Suppr</span>
      </div>
      <div class="lt2-tl"></div>`;
    this.r = racine; this.ecran = racine.querySelector('.lt2-ecran canvas'); this.ctx = this.ecran.getContext('2d');
    this.lcd = racine.querySelector('.lt2-lcd');
    this.tl = new LT.Timeline(this, racine.querySelector('.lt2-tl'));
    this.tailles(); this.pleinLecteur();
    racine.addEventListener('contextmenu', e => { if (!e.target.closest('input,textarea,[contenteditable]')) e.preventDefault(); });   // pas de menu du navigateur (« Enregistrer l'image sous… ») dans TOAST2
    this.insp = new LT.Inspecteur(this, racine.querySelector('.lt2-insp-c'));
    this.biblio(); this.boutons(); this.clavier();
    this.change(); requestAnimationFrame(() => this.tl.toutVoir());
  }

  duree() { const P = this.projet; if (P.duree) return P.duree; let d = 0; const fin = l => l.forEach(k => d = Math.max(d, k.fin ?? k.t ?? 0)); fin(P.couleur.clips); P.effets.forEach(e => fin(e.clips)); fin(P.peches.clips); return d; }

  // ---------- modifications / annuler ----------
  memoriser() { this.avant.push(JSON.stringify(this.projet)); if (this.avant.length > 150) this.avant.shift(); this.apres = []; }
  modifier(fn) { this.memoriser(); fn(); this.change(); }
  remplacer(json) { this.projet = LT.materiel.aJour(JSON.parse(json)); this.moteur.charger(this.projet); this.change(); this.biblio(); this.majMusique(); if (this.vue3d) { this.vue3d.placerMembres(); this.vue3d.lumieres(); if (this.mode3d) { this.panneauRoles(); this.panneauLampes(); } } }
  annuler() { if (!this.avant.length) return; this.apres.push(JSON.stringify(this.projet)); this.remplacer(this.avant.pop()); }
  retablir() { if (!this.apres.length) return; this.avant.push(JSON.stringify(this.projet)); this.remplacer(this.apres.pop()); }
  // enCours = pendant un glisser (on redessine, sans prévenir le reste)
  // garderInsp = la modification vient de l'inspecteur : on ne le redessine pas (le champ garde le curseur)
  change(enCours, garderInsp) {
    this.rafraichir(); if (!enCours && !garderInsp) this.inspecteur();
    if (!enCours) this.ecouteurs.forEach(f => f(this.projet));
  }
  rafraichir() { LT.oublierPhase(this.projet.courbes.vitesse); this.tl.redessiner(); this.moniteur(); }
  surChange(f) { this.ecouteurs.push(f); }

  // ---------- sélection ----------
  // un clip choisi = { k (le clip), liste (le tableau qui le contient), sorte }
  toutesListes() {
    const P = this.projet, L = [{ liste: P.peches.clips, sorte: 'peches' }, ...(P.peches.autres || []).map(x => ({ liste: x.clips, sorte: 'peches' })), { liste: P.couleur.clips, sorte: 'couleur' }, { liste: P.transitions || (P.transitions = []), sorte: 'transitions' }, { liste: P.declencheurs || (P.declencheurs = []), sorte: 'declencheurs' }];
    P.effets.forEach(e => L.push({ liste: e.clips, sorte: 'effets' }));
    return L;
  }
  clipsChoisis() { const r = []; this.toutesListes().forEach(({ liste, sorte }) => liste.forEach(k => this.selection.has(k.id) && r.push({ k, liste, sorte }))); return r; }
  choisir(k, mode) {
    if (mode === 'garder') { this.tl.redessiner(); this.inspecteur(); return; }
    if (!k) this.selection.clear();
    else if (mode === 'basculer') this.selection.has(k.id) ? this.selection.delete(k.id) : this.selection.add(k.id);
    else { this.selection.clear(); this.selection.add(k.id); }
    this.tl.redessiner(); this.inspecteur();
  }

  // ---------- gestes de montage ----------
  nouveauClip(piste, t) {
    const P = this.projet, pal = P.palette, d = Math.max(1, 60 / (P.bpm || 120) * 4);   // une mesure, au moins 1 seconde
    let k;
    if (piste.sorte === 'peches') k = { id: LT.id(), t, type: P.peches.types[0].id };
    else if (piste.sorte === 'effets') k = LT.projet.nouvelEffet('strobo', t, t + d, P);
    else if (piste.sorte === 'couleur') k = { id: LT.id(), debut: t, fin: t + d, couleur: pal[0], zones: [piste.zone.id], entree: 0, sortie: 0 };
    else if (piste.sorte === 'stem') k = LT.declencheurs.nouveau(piste.stem.id, t, t + d * 4, P);
    else return;
    this.modifier(() => piste.liste.push(k)); this.choisir(k);
  }
  couper(k, liste, t) {
    if (t <= k.debut + .02 || t >= k.fin - .02) return;
    this.modifier(() => { const n = clone(k); n.id = LT.id(); n.debut = t; n.entree = 0; k.fin = t; k.sortie = 0; liste.push(n); });
  }
  couperAuCurseur() {   // Ctrl+K : coupe les clips choisis (ou tous ceux sous le curseur s'il n'y en a pas)
    const t = this.temps, cibles = [];
    const prendre = (k, liste) => { if (k.debut != null && t > k.debut + .02 && t < k.fin - .02) cibles.push({ k, liste }); };
    const ch = this.clipsChoisis(); if (ch.length) ch.forEach(c => prendre(c.k, c.liste)); else this.toutesListes().forEach(({ liste }) => liste.forEach(k => prendre(k, liste)));
    if (!cibles.length) return;
    this.modifier(() => cibles.forEach(({ k, liste }) => { const n = clone(k); n.id = LT.id(); n.debut = t; n.entree = 0; k.fin = t; k.sortie = 0; liste.push(n); }));
  }
  supprimer() { const ch = this.clipsChoisis(); if (!ch.length) return; this.modifier(() => ch.forEach(c => c.liste.splice(c.liste.indexOf(c.k), 1))); this.selection.clear(); this.change(); }
  copier() {
    const ch = this.clipsChoisis(); if (!ch.length) return;
    const t0 = Math.min(...ch.map(c => c.k.t ?? c.k.debut));
    this.pressePapiers = ch.map(c => ({ k: clone(c.k), liste: c.liste, t0 }));
  }
  coller() {
    if (!this.pressePapiers) return; const t = this.temps, neufs = [];
    const listes = new Set(this.toutesListes().map(l => l.liste));
    this.modifier(() => this.pressePapiers.forEach(({ k, liste, t0 }) => {
      const cible = listes.has(liste) ? liste : null; if (!cible) return;
      const n = clone(k); n.id = LT.id();
      if (n.t != null) n.t = t + (k.t - t0); else { const d = n.fin - n.debut; n.debut = t + (k.debut - t0); n.fin = n.debut + d; }
      cible.push(n); neufs.push(n.id);
    }));
    this.selection = new Set(neufs); this.change();
  }
  // les points de montage (débuts / fins de clips, pêches) pour sauter de l'un à l'autre
  points() { const s = new Set([0, ...(this.projet.marqueurs || []).map(q => q.t)]); this.toutesListes().forEach(({ liste }) => liste.forEach(k => k.t != null ? s.add(k.t) : (s.add(k.debut), s.add(k.fin)))); return [...s].sort((a, b) => a - b); }

  // ---------- temps et lecture ----------
  debutMin() { const f = LT.decompte.fenetre(this.projet); return f ? Math.min(0, f.debut) : 0; }
  planSon() { const f = LT.decompte.fenetre(this.projet); return f && Object.assign({ clic: true }, f); }
  aller(t, parLecture) {
    this.temps = Math.max(this.debutMin(), t); this.lcd.textContent = fmt(this.temps); this.tl.redessiner(); this.moniteur(); this.majPleinLec();
    if (!parLecture && this.vitesse > 0 && this.son.depart) this.son.jouer(this.temps, this.vitesse, this.planSon());   // on a cliqué ailleurs pendant la lecture
  }
  // la boucle I/O repart au début du décompte quand l'entrée est le début du passage
  debutBoucle() { const f = LT.decompte.fenetre(this.projet), e = this.entree ?? 0; return f && Math.abs(e - f.fin) < .01 ? f.debut : this.entree ?? this.debutMin(); }
  relancer() { if (this.vitesse) this.lire(this.vitesse); }
  // vitesse : 0 = arrêt, 1 = normal, 2, 4… ; négatif = en arrière (J)
  lire(v) {
    this.vitesse = v; this.r.querySelector('[data-a="lire"]').textContent = v ? '⏸' : '▶'; this.majPleinLec();
    if (this.vue3d) this.vue3d.lecture(!!v);
    this.son.arreter(); const jeton = this._jeton = {};
    if (!v) return;
    const fin0 = this.sortie ?? this.duree(); if (v > 0 && this.temps >= fin0 - .01) this.temps = this.debutBoucle();   // au bout : on repart du début
    this.son.jouer(this.temps, v, this.planSon());
    let avant = performance.now();
    const pas = n => {
      if (this._jeton !== jeton) return;
      if (this.r.offsetParent === null) return this.lire(0);   // on a quitté l'onglet : on arrête (rien ne tourne en fond)
      const dt = (n - avant) / 1000 * this.vitesse; avant = n;
      let t = this.son.depart ? this.son.temps() : this.temps + dt; const fin = this.sortie ?? this.duree(), deb = this.debutBoucle();
      if (t >= fin && this.vitesse > 0) { if (this.entree != null || this.sortie != null) { t = deb; this.son.jouer(t, this.vitesse, this.planSon()); } else { this.aller(fin, true); return this.lire(0); } }
      if (t < this.debutMin()) { this.aller(this.debutMin(), true); return this.lire(0); }
      this.aller(t, true); this.tl.suivre(t); requestAnimationFrame(pas);
    };
    requestAnimationFrame(pas);
  }
  moniteur() {
    if (this._mq) return;
    this._mq = requestAnimationFrame(() => {
      this._mq = 0; this.moteur.rendre(this.temps);
      if (this.vue3d && this.mode3d) this.vue3d.rendre(); else this.moteur.dessiner(this.ctx, this.ecran.width, this.ecran.height, { mur: true });
    });
  }
  // le moniteur en plein écran (Échap pour sortir)
  plein(oui = !this.r.querySelector('.lt2-moni').classList.contains('lt2-plein')) {
    this.r.querySelector('.lt2-moni').classList.toggle('lt2-plein', oui); if (this.vue3d) { this.vue3d.taille(); this.vue3d.rendre(true); }
    if (oui) this.montrerPleinLec(); this.majPleinLec();
  }
  // le lecteur du plein écran : ⏮ ▶ ⏭, le temps, une ligne pour aller ailleurs ; il s'efface quand la souris ne bouge plus
  pleinLecteur() {
    const moni = this.r.querySelector('.lt2-moni'), L = moni.querySelector('.lt2-pleinlec'), barre = L.querySelector('.lt2-pl-barre');
    L.querySelectorAll('[data-pl]').forEach(b => b.onclick = () => { const a = b.dataset.pl; if (a === 'lire') this.lire(this.vitesse ? 0 : this.vitLecture()); if (a === 'debut') this.aller(this.debutMin()); if (a === 'fin') this.aller(this.duree()); });
    const viser = e => { const r = barre.getBoundingClientRect(), d = this.duree() || 1; this.aller(Math.min(Math.max(0, (e.clientX - r.left) / r.width), 1) * d); };
    barre.onpointerdown = e => { barre.setPointerCapture(e.pointerId); viser(e); barre.onpointermove = viser; };
    barre.onpointerup = () => { barre.onpointermove = null; };
    moni.addEventListener('pointermove', () => { if (moni.classList.contains('lt2-plein')) this.montrerPleinLec(); });
  }
  montrerPleinLec() {
    const L = this.r.querySelector('.lt2-pleinlec'); L.classList.add('vu'); clearTimeout(this._plT);
    this._plT = setTimeout(() => { if (!L.matches(':hover')) L.classList.remove('vu'); else this.montrerPleinLec(); }, 2000);
  }
  majPleinLec() {
    const L = this.r && this.r.querySelector('.lt2-pleinlec'); if (!L || !this.r.querySelector('.lt2-moni.lt2-plein')) return;
    const d = this.duree() || 1, mn = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    L.querySelector('[data-pl="lire"]').textContent = this.vitesse ? '⏸' : '▶';
    L.querySelector('.lt2-pl-t').textContent = this.lcd.textContent; L.querySelector('.lt2-pl-d').textContent = mn(d);
    L.querySelector('.lt2-pl-barre i').style.width = Math.min(100, Math.max(0, this.temps / d * 100)) + '%';
  }
  // Tubes (l'image vidéo) ou Studio 3D ; la 3D n'est fabriquée qu'au premier clic
  modeMoniteur(mode) {
    const d3 = mode === '3d', boite = this.r.querySelector('.lt2-3d');
    if (d3 && !this.vue3d) { if (!window.THREE || !LT.Vue3D) return; boite.hidden = false; try {
      const charge = this.r.querySelector('.lt2-charge');
      this.vue3d = new LT.Vue3D(boite, this); this.vue3d.surPoses = () => this.mode3d && this.panneauRoles(); this._q1 = true;
      this.vue3d.surCharge = t => { charge.hidden = !t; charge.textContent = t || ''; };
    } catch (e) { this.vue3d = null; boite.innerHTML = '<p class="lt2-vide" style="padding:16px">La 3D ne démarre pas sur ce PC : ' + String(e.message || e).replace(/</g, '&lt;') + '</p>'; return; } }
    this.mode3d = d3; boite.hidden = !d3; this.r.querySelector('.lt2-roles').hidden = !d3; if (!d3 && this.placer) this.placer.onFin(); if (d3) this.panneauRoles(); this.ecran.hidden = d3; this.r.querySelector('.lt2-3dc').hidden = !d3;
    this.r.querySelectorAll('[data-vue]').forEach(b => b.classList.toggle('on', b.dataset.vue === mode));
    if (d3) this.vue3d.taille(); this.moniteur();
    if (d3 && this._q1) {   // 1re ouverture : le niveau de qualité (mesuré tout seul si ce PC n'a encore rien choisi)
      this._q1 = false; const v = this.vue3d, sel = this.r.querySelector('[data-qualite]');
      sel.value = v.q;
    }
  }

  // ---------- musique, passages, stems ----------
  // un petit message sous la musique (il s'efface tout seul)
  dire(t) {
    let el = this.r.querySelector('.lt2-msg'); if (!el) { el = document.createElement('p'); el.className = 'lt2-msg'; this.r.querySelector('.lt2-musique').appendChild(el); }
    el.textContent = t; el.hidden = false; clearTimeout(this._msg); this._msg = setTimeout(() => { el.hidden = true; }, 12000);
  }
  async chargerMusique(choix) {
    choix = choix || await LT.sources.choisirMusique(); if (!choix) return;
    const nom = this.r.querySelector('.lt2-mnom'); nom.textContent = 'Chargement…';
    try {
      const buf = await this.son.decoder(choix.octets); this.lire(0);
      // une musique était déjà là (ancien mix) : on cale la nouvelle dessus, puis on décale tout le projet d'autant
      let cal = null; const avant = this.son.musique;
      if (avant) { nom.textContent = 'Calage sur l\'ancienne musique…'; await new Promise(r => setTimeout(r, 30)); try { cal = LT.analyse.caler(avant, buf); } catch (e) { cal = null; } }
      this.son.musique = buf; this.sr = buf.sampleRate; this.pics = LT.analyse.pics(this.son.canaux(buf));
      const bon = cal && cal.net > 6 && cal.sur > .15;   // assez sûr pour décaler
      this.modifier(() => { if (bon && Math.abs(cal.d) > .002) LT.projet.decaler(this.projet, cal.d); const P = this.projet, ancien = P.duree || 60; P.couleur.clips.forEach(c => { if (Math.abs(c.fin - ancien) < .01) c.fin = buf.duration; }); P.duree = buf.duration; this.projet.musique = { nom: choix.nom, morceau: choix.morceau || null, version: choix.version || null, passage: null }; });
      this.tl.toutVoir(); await this.majPassages();
    } catch (e) { nom.textContent = 'Son illisible : ' + (e.message || e); return; }
    this.majMusique();
    if (cal) this.dire(bon ? (Math.abs(cal.d) > .002 ? `Nouvelle musique calée : tout le projet est décalé de ${cal.d > 0 ? '+' : ''}${cal.d.toFixed(3).replace('.', ',')} s (Ctrl+Z pour annuler).` : 'Nouvelle musique : déjà calée, rien à décaler.') : 'Nouvelle musique : je n\'ai pas réussi à la caler sur l\'ancienne (morceau trop différent ?). Rien n\'a été décalé.');
  }
  // remettre le son d'un projet rouvert (sans rien changer au projet)
  async poserMusique(octets, buf) {
    buf = buf || await this.son.decoder(octets); this.lire(0);
    this.son.musique = buf; this.sr = buf.sampleRate; this.pics = LT.analyse.pics(this.son.canaux(buf));
    this.majMusique(); await this.majPassages(); this.tl.redessiner();
  }
  majMusique() {
    const mu = this.projet.musique; this.r.querySelector('.lt2-mnom').textContent = mu ? mu.nom : 'Aucune musique';
    this.r.querySelector('[data-a="musique"]').textContent = mu ? 'Changer…' : 'Choisir la musique…';
  }
  // les passages des reels (Reels Audio, Tournages, Discord) : en choisir un place l'entrée / la sortie
  async majPassages() {
    const mu = this.projet.musique, sel = this.r.querySelector('.lt2-passage');
    this.listePassages = mu && (mu.morceau || mu.nom) ? await LT.sources.passages(mu.morceau, mu.nom || this.projet.nom).catch(() => []) : [];
    const pa = mu && mu.passage, f = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0'), x = v => String(Math.round(v * 100) / 100).replace('.', ',');
    sel.innerHTML = `<option value="">Passage : morceau entier</option>` + (this.listePassages.length ? this.listePassages.map((p, i) => `<option value="${i}"${pa && pa.debut === p.debut && pa.fin === p.fin ? ' selected' : ''}>${f(p.debut)} → ${f(p.fin)} · ${String(p.nom).replace(/</g, '&lt;')}${p.v && p.v !== 1 ? ' · ×' + x(p.v) : ''}</option>`).join('') : '<option disabled>(aucun passage dans Reels pour ce morceau)</option>');
    this.majRalenti();
  }
  // un passage avec une vitesse de tournage (×0,5…) : un bouton pour jouer / exporter à cette vitesse
  majRalenti() {
    const b = this.r.querySelector('[data-a="ralenti"]'), pa = this.projet.musique && this.projet.musique.passage, v = pa && pa.v && pa.v !== 1 ? pa.v : null;
    if (!v) this.ralenti = null;
    b.hidden = !v; b.classList.toggle('on', !!this.ralenti); if (v) b.textContent = 'Vitesse tournage ×' + String(Math.round(v * 100) / 100).replace('.', ',');
  }
  vitLecture() { return this.ralenti || 1; }
  choisirPassage(i) {
    const p = this.listePassages[i]; this.ralenti = null;
    if (this.projet.musique) this.modifier(() => { this.projet.musique.passage = p ? { debut: p.debut, fin: p.fin, nom: p.nom, v: p.v || 1 } : null; });
    this.entree = p ? p.debut : null; this.sortie = p ? p.fin : null;
    if (p) { const a = this.debutBoucle(); this.aller(a); const w = this.tl.cv.clientWidth; this.tl.pps = Math.max(4, (w - 40) / (p.fin - a)); this.tl.debut = Math.max(this.debutMin(), a - 20 / this.tl.pps); }
    this.majRalenti(); this.tl.redessiner();
  }
  async ajouterStems() {
    const l = await LT.sources.choisirStems(); if (!l || !l.length) return;
    const COUL = ['#ff5f5f', '#ffb84d', '#7be0ff', '#9ad14b', '#c58bff', '#ff9ad5'];
    // plusieurs stems du même morceau commencent tous pareil (« OPP_BEESKOT_… ») : on enlève le début commun pour voir la différence
    if (l.length > 1) { let c = l[0].nom; for (const f of l) while (c && !f.nom.startsWith(c)) c = c.slice(0, -1); c = c.replace(/[^_\-\s.]*$/, ''); if (c.length > 2) l.forEach(f => { const r = f.nom.slice(c.length).trim(); if (r) f.nom = r; }); }
    for (const f of l) {
      try {
        const buf = await this.son.decoder(f.octets), a = await LT.analyse.coups(this.son.canaux(buf), buf.sampleRate);
        const st = { id: LT.id(), nom: f.nom, couleur: COUL[(this.projet.stems.length) % COUL.length], sens: .5, ecart: 60, muet: false, cands: a.cands, volume: a.volume, duree: a.duree };
        this.son.stems.set(st.id, { buf, ecoute: false });
        this.modifier(() => this.projet.stems.push(st)); this.choisirStem(st.id);
      } catch (e) { alert('Stem illisible : ' + f.nom); }
    }
  }
  coupsDe(st) { const k = st.id + '|' + st.sens + '|' + st.ecart, c = this._coups.get(st.id); if (c && c.k === k) return c.l; const l = LT.analyse.filtrer(st.cands || [], st.sens, st.ecart); this._coups.set(st.id, { k, l }); return l; }
  choisirStem(id) { this.stemChoisi = id; if (id) this.selection.clear(); this.tl.redessiner(); this.inspecteur(); }

  // ---------- panneaux (complétés à l'étape 4) ----------
  // le petit panneau « qui joue quoi » de la vue 3D
  // les lampes de la pièce (pas dans la vidéo) : allumée, couleur (roue), force — gardées dans le morceau
  panneauLampes(ouverte) {
    const el = this.r.querySelector('.lt2-lampes'), v = this.vue3d; if (!v || el.hidden) return;
    const R = v.reglagesLampes(), noms = Object.keys(LT.studio.mesures().lampes);
    el.innerHTML = '<b>Lumières de la pièce</b><p>Elles éclairent la 3D seulement (pas les tubes). Gardées dans ce morceau.</p>' + noms.map(n => { const o = v.lampe(n);
      return `<div class="lt2-lp"><input type="checkbox" data-on="${n}"${o.allumee ? ' checked' : ''} title="Allumée"><span>${o.nom}</span>
        <button type="button" class="lt2-pas" data-coul="${n}" style="background:${o.couleur}" title="Couleur"></button>
        <input type="range" min="0" max="2" step="0.05" value="${o.force}" data-force="${n}" title="Force"></div>${ouverte === n ? '<div class="lt2-lp-roue"></div>' : ''}`; }).join('') +
      '<button type="button" data-lp-reset>Remettre les lampes du studio</button>';
    const regle = n => R[n] = R[n] || {};
    el.querySelectorAll('[data-on]').forEach(i => i.onchange = () => { this.modifier(() => { regle(i.dataset.on).allumee = i.checked; }); v.lumieres(); });
    el.querySelectorAll('[data-force]').forEach(i => {
      i.onpointerdown = () => this.memoriser();
      i.oninput = () => { regle(i.dataset.force).force = +i.value; v.lumieres(); };
      i.onchange = () => this.change(false, true);
    });
    el.querySelectorAll('[data-coul]').forEach(b => b.onclick = () => this.panneauLampes(ouverte === b.dataset.coul ? null : b.dataset.coul));
    const place = el.querySelector('.lt2-lp-roue');
    if (place) { let debut = false; LT.roue(place, v.lampe(ouverte).couleur, { palette: this.projet.palette, quand: (c, fini) => {
      if (!debut) { this.memoriser(); debut = true; } regle(ouverte).couleur = c; v.lumieres();
      const p = el.querySelector(`[data-coul="${ouverte}"]`); if (p) p.style.background = c;
      if (fini) { debut = false; this.change(false, true); } } }); }
    el.querySelector('[data-lp-reset]').onclick = () => { this.modifier(() => { for (const k in R) delete R[k]; }); v.lumieres(); this.panneauLampes(); };
  }
  panneauRoles() {
    const el = this.r.querySelector('.lt2-roles'), v = this.vue3d; if (!v) return;
    const M = LT.studio.mesures(), roles = v.roles(), charge = v.posesChargees().length;
    el.innerHTML = M.membres.map(p => { const c = roles[p.nom] || {}, r = c.role || M.roles[p.nom];
      return `<div class="lt2-role"><b>${p.nom}</b><select data-qui="${p.nom}">${Object.entries(M.postes).map(([k, o]) => `<option value="${k}"${k === r ? ' selected' : ''}>${o.nom}</option>`).join('')}</select>
        <button class="lt2-joue${c.fige ? '' : ' on'}" data-joue="${p.nom}" title="${c.fige ? 'En pause (figé) : clique pour qu\'il joue pendant la lecture' : 'Joue pendant la lecture : clique pour le mettre en pause'}"${charge ? '' : ' disabled'}>${c.fige ? '<svg viewBox="0 0 10 10" width="10" height="10"><rect x="1.5" y="1" width="2.5" height="8" fill="currentColor"/><rect x="6" y="1" width="2.5" height="8" fill="currentColor"/></svg>' : '<svg viewBox="0 0 10 10" width="10" height="10"><path d="M2 1 9 5 2 9z" fill="currentColor"/></svg>'}</button></div>`; }).join('') +
      (LT.modeReglage ? `<button data-poses>${charge ? charge + ' poses chargées · changer…' : 'Charger les poses (.fbx)…'}</button>` : '');
    el.querySelectorAll('[data-qui]').forEach(s => s.onchange = () => { this.modifier(() => { const c = roles[s.dataset.qui] = roles[s.dataset.qui] || {}; c.role = s.value; delete c.temps; }); v.placerMembres(); this.panneauRoles(); });
    el.querySelectorAll('[data-joue]').forEach(b => b.onclick = () => {   // ▶ / ⏸ : ce membre joue (ou reste figé) pendant la lecture
      this.modifier(() => { const c = roles[b.dataset.joue] = roles[b.dataset.joue] || {}; c.fige = !c.fige; delete c.temps; }); v.placerMembres(); this.panneauRoles();
    });
    const bpo = el.querySelector('[data-poses]'); if (bpo) bpo.onclick = () => {
      const i = Object.assign(document.createElement('input'), { type: 'file', accept: '.fbx', multiple: true });
      i.onchange = async () => { const o = {}; for (const f of i.files) o[f.name] = await f.arrayBuffer(); const n = await v.ajouterPoses(o); this.panneauRoles(); if (!n) alert('Aucune pose reconnue. Les noms doivent contenir : drum, piano, guitar, bass ou sing.'); };
      i.click();
    };
  }

  // agrandir / réduire les modules : on glisse les séparations (Bibliothèque | Moniteur | Inspecteur, et le haut de la timeline)
  tailles() {
    const R = this.r, cle = 'lt2.tailles', T = (() => { try { return JSON.parse(localStorage.getItem(cle)) || {}; } catch (e) { return {}; } })();
    const poser = () => { ['g', 'd', 'b'].forEach(k => T[k] ? R.style.setProperty('--lt-' + k, T[k] + 'px') : R.style.removeProperty('--lt-' + k)); };
    const garder = () => { try { localStorage.setItem(cle, JSON.stringify(T)); } catch (e) {} };
    poser();
    R.querySelectorAll('[data-sep]').forEach(h => {
      const k = h.dataset.sep;
      h.ondblclick = () => { delete T[k]; poser(); garder(); };
      h.onpointerdown = e => {
        e.preventDefault(); h.setPointerCapture(e.pointerId); h.classList.add('on');
        const x0 = e.clientX, y0 = e.clientY, haut = R.querySelector('.lt2-haut'), tl = R.querySelector('.lt2-tl');
        const v0 = k === 'g' ? haut.children[2].getBoundingClientRect().width : k === 'd' ? R.querySelector('.lt2-insp').getBoundingClientRect().width : tl.getBoundingClientRect().height;
        const H = R.getBoundingClientRect().height, Lh = haut.getBoundingClientRect().width;
        h.onpointermove = ev => {
          if (k === 'g') T.g = Math.round(Math.min(Math.max(120, v0 + ev.clientX - x0), Lh * .35));
          if (k === 'd') T.d = Math.round(Math.min(Math.max(200, v0 - (ev.clientX - x0)), Lh * .45));
          if (k === 'b') T.b = Math.round(Math.min(Math.max(140, v0 - (ev.clientY - y0)), H - 230));
          poser();
        };
        h.onpointerup = () => { h.onpointermove = h.onpointerup = null; h.classList.remove('on'); garder(); };
      };
    });
  }
  // la bibliothèque : on GLISSE une couleur ou un effet sur la timeline
  //   couleur → sur une lumière (piste Couleur) = un calque de cette couleur ; sur un clip = sa couleur change
  //   effet   → sur une piste d'effets ; ou directement sur une lumière = un effet sur cette lumière seulement
  biblio() {
    const l = this.r.querySelector('.lt2-biblio-l'), P = this.projet, esc = x => String(x).replace(/</g, '&lt;');
    const liste = sorte => Object.entries(LT.effets).filter(([, f]) => f.sorte === sorte).map(([k, f]) => `<div class="lt2-item s-${sorte}" draggable="true" data-glisse="effet:${k}">${f.nom}</div>`).join('');
    // chaque partie est un menu déroulant (ouvert / fermé gardé sur ce PC)
    let ouv; try { ouv = JSON.parse(localStorage.getItem('lt2.biblio')) || { couleur: true }; } catch (e) { ouv = { couleur: true }; }
    const part = (cle, titre, html) => `<details class="lt2-part" data-part="${cle}"${ouv[cle] ? ' open' : ''}><summary>${titre}</summary><div class="lt2-part-c">${html}</div></details>`;
    l.innerHTML = (this.morceaux && this.morceaux.length ? part('morceaux', 'Morceaux', '<div class="lt2-morceaux">' + this.morceaux.map(m => `<div class="lt2-item lt2-morceau" data-morceau="${m.id}" title="Nouveau projet avec ce morceau">${esc(m.nom)}</div>`).join('') + '</div>') : '')
      + part('couleur', 'Couleur', '<div class="lt2-item s-couleur" draggable="true" data-glisse="calque:" title="Glisse-le sur une lumière : un nouveau calque de couleur, par-dessus ce qu\'il y a déjà">Calque de couleur</div><div class="lt2-item s-couleur" draggable="true" data-glisse="calque:bi" title="Plusieurs couleurs : la lumière coupée en parts égales (bouton + pour en ajouter)">Bi-color</div><div class="lt2-item s-couleur" draggable="true" data-glisse="calque:degrade" title="Une couleur en haut qui passe doucement à une autre en bas">Dégradé</div>')
      + part('palette', 'Palette', '<div class="lt2-pal">' + P.palette.map(h => `<span class="lt2-pas" draggable="true" data-glisse="couleur:${h}" style="background:${h}" title="Glisse sur une lumière (piste Couleur) ou sur un clip"></span>`).join('') + '</div>')
      + part('transitions', 'Transitions', Object.entries(LT.TRANSITIONS).map(([k, x]) => `<div class="lt2-item s-trans" draggable="true" data-glisse="transition:${k}" title="${x.aide} — glisse-la sur la coupure entre deux calques">${x.nom}</div>`).join(''))
      + part('overlay', 'Overlays · textures', liste('overlay'))
      + part('mouvement', 'Mouvements', liste('mouvement'));
    l.querySelectorAll('details[data-part]').forEach(d => d.ontoggle = () => { ouv[d.dataset.part] = d.open; try { localStorage.setItem('lt2.biblio', JSON.stringify(ouv)); } catch (e) { } });
    l.querySelectorAll('[data-morceau]').forEach(el => el.onclick = () => this.surMorceau && this.surMorceau(el.dataset.morceau));
    l.querySelectorAll('[data-glisse]').forEach(el => el.ondragstart = e => { e.dataTransfer.setData('text/plain', el.dataset.glisse); e.dataTransfer.effectAllowed = 'copy'; this.glisse = el.dataset.glisse; });
  }

  // une piste d'effets où [debut, fin] est libre, à partir de la piste n° i (sinon une nouvelle piste en haut)
  pisteLibre(debut, fin, i = 0) {
    const E = this.projet.effets;
    for (let j = Math.max(0, i); j < E.length; j++) if (!E[j].clips.some(c => c.debut < fin - 1e-6 && c.fin > debut + 1e-6)) return E[j];
    const n = { id: LT.id(), nom: 'Effets ' + (E.length + 1), clips: [] }; E.push(n); return n;
  }
  // un calque de couleur passe PAR-DESSUS les autres, comme dans un logiciel de montage : sur ses lumières (ou seulement
  // celles de « zones ») et pendant sa durée, les calques déjà là sont coupés. Le reste des anciens calques est gardé.
  // À appeler dans modifier() (ou après memoriser()).
  faireDeLaPlace(k, zones = k.zones) {
    const L = this.projet.couleur.clips, out = [], e = 1e-6;
    let A = k.debut + (k.entree || 0), B = k.fin - (k.sortie || 0); if (A >= B) { A = k.debut; B = k.fin; }   // pendant ses fondus, le dessous reste (il se mélange)
    for (const c of L) {
      const commun = c !== k && c.zones.some(z => zones.includes(z));
      if (!commun || c.fin <= A + e || c.debut >= B - e) { out.push(c); continue; }
      const reste = c.zones.filter(z => !zones.includes(z)), bouts = [];
      if (c.debut < A - e) bouts.push(Object.assign(clone(c), { fin: A, sortie: 0 }));
      if (reste.length) bouts.push(Object.assign(clone(c), { zones: reste, debut: Math.max(c.debut, A), fin: Math.min(c.fin, B), entree: c.debut >= A - e ? c.entree : 0, sortie: c.fin <= B + e ? c.sortie : 0 }));
      if (c.fin > B + e) bouts.push(Object.assign(clone(c), { debut: B, entree: 0 }));
      bouts.forEach((b, i) => { if (i) b.id = LT.id(); out.push(b); });   // le premier bout garde l'identité de l'ancien
    }
    L.splice(0, L.length, ...out); this.recoller(k);
  }
  // recolle les morceaux de calques identiques qui se touchent (même couleur, même intensité), pour ne pas hacher la timeline :
  //   l'un après l'autre sur les mêmes lumières → un seul plus long ; au même moment sur des lumières différentes → un seul groupe.
  // « sauf » et les clips choisis ne sont jamais fondus dans un autre.
  recoller(sauf) {
    const L = this.projet.couleur.clips, e = 1e-6, fixe = c => c === sauf || this.selection.has(c.id);
    const pareil = (a, b) => a.couleur === b.couleur && (a.force ?? 1) === (b.force ?? 1) && (a.sorte || '') === (b.sorte || '') && (!a.sorte || String(a.couleurs) === String(b.couleurs)), memes = (a, b) => a.zones.length === b.zones.length && a.zones.every(z => b.zones.includes(z));
    const ordre = this.projet.materiel.zones.map(z => z.id);
    for (let encore = true; encore;) {
      encore = false;
      boucle: for (const a of L) for (const b of L) {
        if (a === b || fixe(a) || fixe(b) || !pareil(a, b)) continue;
        if (memes(a, b) && Math.abs(a.fin - b.debut) < e && !(a.sortie > 0) && !(b.entree > 0)) { a.fin = b.fin; a.sortie = b.sortie || 0; }
        else if (Math.abs(a.debut - b.debut) < e && Math.abs(a.fin - b.fin) < e && (a.entree || 0) === (b.entree || 0) && (a.sortie || 0) === (b.sortie || 0) && !a.zones.some(z => b.zones.includes(z))) a.zones = ordre.filter(z => a.zones.includes(z) || b.zones.includes(z));
        else continue;
        L.splice(L.indexOf(b), 1); encore = true; break boucle;
      }
    }
  }
  // ---------- transitions ----------
  // la coupure la plus proche de t sur cette lumière (fin d'un calque / début d'un autre) ; null si aucune à moins de « pres » secondes
  coupure(t, zone, pres = 1.5) {
    let best = null;
    for (const c of this.projet.couleur.clips) if (c.zones.includes(zone)) for (const x of [c.debut, c.fin]) if (x > 1e-3 && Math.abs(x - t) <= pres && (best == null || Math.abs(x - t) < Math.abs(best - t))) best = x;
    return best;
  }
  // pose une transition à cheval sur la coupure la plus proche, sur toutes les lumières coupées à ce moment-là
  ajouterTransition(trans, t, zone) {
    const P = this.projet, tc = this.coupure(t, zone) ?? t, d = Math.max(.5, 60 / (P.bpm || 120)), e = 1e-3;   // 1 temps, au moins ½ s
    const zones = P.materiel.zones.map(z => z.id).filter(id => P.couleur.clips.some(c => c.zones.includes(id) && (Math.abs(c.debut - tc) < e || Math.abs(c.fin - tc) < e)));
    if (!zones.includes(zone)) zones.push(zone);
    const k = { id: LT.id(), trans, debut: Math.max(0, tc - d / 2), fin: tc + d / 2, zones: P.materiel.zones.map(z => z.id).filter(id => zones.includes(id)), forme: 'douce', sens: 'normal', couleur: P.palette[0] };
    this.modifier(() => { (P.transitions = P.transitions || []).push(k); }); this.choisir(k); return k;
  }
  // ce qui arrive d'un glisser (appelé par la timeline) ; o = l'endroit (piste, clip, temps)
  deposer(quoi, o) {
    const [sorte, val] = quoi.split(':'), P = this.projet, d = Math.max(1, 60 / (P.bpm || 120) * 4), t = Math.max(0, o.t), p = o.p; if (!p) return;   // au moins 1 seconde
    let k = null;
    const calque = (couleur, x = {}) => { k = Object.assign({ id: LT.id(), debut: t, fin: t + d, couleur, zones: [p.zone.id], entree: 0, sortie: 0 }, x); this.modifier(() => { this.faireDeLaPlace(k); P.couleur.clips.push(k); }); };
    if (sorte === 'calque' && p.sorte === 'couleur') {   // un NOUVEAU calque, même par-dessus un autre
      const c0 = o.k ? o.k.couleur === P.palette[0] ? P.palette[1] || '#ffffff' : P.palette[0] : P.palette[0];
      if (val === 'bi' || val === 'degrade') { const c1 = P.palette.find(c => c !== c0) || '#ffffff'; calque(c0, { sorte: val, couleurs: [c0, c1] }); }
      else calque(c0);
    }
    if (sorte === 'couleur') {
      if (o.k && (p.sorte === 'couleur' || p.sorte === 'effets')) return this.modifier(() => { o.k.couleur = val; if (o.k.couleurs && o.k.couleurs.length) o.k.couleurs[0] = val; if (p.sorte === 'effets') o.k.mode = 'lumiere'; });
      if (p.sorte === 'couleur') calque(val);
    }
    if (sorte === 'transition' && p.sorte === 'couleur') k = this.ajouterTransition(val, t, p.zone.id);
    if (sorte === 'effet') {
      if (o.k && p.sorte === 'effets') return this.modifier(() => { o.k.effet = val; o.k.reglages = {}; });
      if (p.sorte === 'effets') { k = LT.projet.nouvelEffet(val, t, t + d, P); this.modifier(() => this.pisteLibre(k.debut, k.fin, P.effets.indexOf(p.piste)).clips.push(k)); }
      if (p.sorte === 'couleur') {   // sur une lumière : l'effet ne touche que celle-ci, et dure comme le calque de couleur visé
        k = LT.projet.nouvelEffet(val, o.k ? o.k.debut : t, o.k ? Math.max(o.k.fin, o.k.debut + 1) : t + d, P); k.zones = [p.zone.id];
        this.modifier(() => this.pisteLibre(k.debut, k.fin).clips.push(k));
      }
    }
    if (k) this.choisir(k);
  }
  inspecteur() { this.insp.rendre(); }

  // ---------- boutons et raccourcis ----------
  boutons() {
    this.r.querySelector('[data-a="musique"]').onclick = () => this.chargerMusique();
    const mh = this.r.querySelector('.lt2-moni-h');
    mh.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.vue) this.modeMoniteur(b.dataset.vue); if (b.dataset.cam && this.vue3d) { this.vue3d.vue(b.dataset.cam); this.vue3d.rendre(); } });
    mh.querySelector('[data-amb]').onchange = e => this.vue3d && this.vue3d.ambiance(e.target.value);
    mh.querySelector('[data-membres]').onchange = e => this.vue3d && this.vue3d.montrerMembres(e.target.checked);
    mh.querySelector('[data-qualite]').onchange = e => { if (!this.vue3d) return; this.vue3d.qualite(e.target.value); try { localStorage.setItem('lt2.qualite', e.target.value); } catch (x) { } };
    mh.querySelector('[data-plein]').onclick = () => this.plein();
    const bl = mh.querySelector('[data-lampes]');
    bl.onclick = () => { const el = this.r.querySelector('.lt2-lampes'); el.hidden = !el.hidden; bl.classList.toggle('on', !el.hidden); if (!el.hidden) this.panneauLampes(); };
    const bp = mh.querySelector('[data-placer]');
    if (bp) bp.onclick = () => {
      const v = this.vue3d; if (!v || !LT.Placer) return;
      if (!this.placer) { this.placer = new LT.Placer(v, this.r.querySelector('.lt2-placer')); this.placer.onFin = () => { this.placer.activer(false); bp.classList.remove('on'); }; }
      const oui = !this.placer.actif; this.placer.activer(oui); bp.classList.toggle('on', oui);
    };
    this.r.querySelector('.lt2-passage').onchange = e => this.choisirPassage(e.target.value === '' ? -1 : +e.target.value);
    this.r.querySelector('.lt2-barre').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.o) this.choisirOutil(b.dataset.o);
      const a = b.dataset.a;
      if (a === 'ralenti') { this.ralenti = this.ralenti ? null : this.projet.musique.passage.v; this.majRalenti(); if (this.vitesse) this.lire(this.vitLecture()); }
      if (a === 'aimant') { this.aimant = !this.aimant; this.etatBoutons(); }
      if (a === 'annuler') this.annuler(); if (a === 'retablir') this.retablir();
      if (a === 'lire') this.lire(this.vitesse ? 0 : this.vitLecture());
      if (a === 'debut') this.aller(this.debutMin()); if (a === 'fin') this.aller(this.duree());
      if (a === 'zplus') this.tl.zoomer(1.4); if (a === 'zmoins') this.tl.zoomer(1 / 1.4); if (a === 'tout') this.tl.toutVoir();
    });
    this.etatBoutons();
  }
  choisirOutil(o) { this.outil = o; this.tl.survol = null; this.etatBoutons(); this.tl.redessiner(); }
  etatBoutons() {
    this.r.querySelectorAll('[data-o]').forEach(b => b.classList.toggle('on', b.dataset.o === this.outil));
    this.r.querySelector('[data-a="aimant"]').classList.toggle('on', this.aimant);
  }
  clavier() {
    this._clavier = e => {
      if (!this.r.isConnected || this.r.offsetParent === null) return;      // onglet caché
      if (e.target.closest('input,textarea,select,[contenteditable]')) return;
      const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey, img = 1 / 60;
      const fait = () => e.preventDefault();
      if (ctrl && k === 'z') { fait(); e.shiftKey ? this.retablir() : this.annuler(); return; }
      if (ctrl && k === 'y') { fait(); this.retablir(); return; }
      if (ctrl && k === 'c') { fait(); this.copier(); return; }
      if (ctrl && k === 'v') { fait(); this.coller(); return; }
      if (ctrl && k === 'x') { fait(); this.copier(); this.supprimer(); return; }
      if (ctrl && k === 'k') { fait(); this.couperAuCurseur(); return; }
      if (ctrl && k === 'a') { fait(); this.toutesListes().forEach(({ liste }) => liste.forEach(c => this.selection.add(c.id))); this.change(); return; }
      if (ctrl) return;
      switch (k) {
        case ' ': fait(); this.lire(this.vitesse ? 0 : this.vitLecture()); break;
        case 'l': this.lire(this.vitesse > 0 ? Math.min(8, this.vitesse * 2) : 1); break;
        case 'j': this.lire(this.vitesse < 0 ? Math.max(-8, this.vitesse * 2) : -1); break;
        case 'k': this.lire(0); break;
        case 'i': this.entree = this.temps; if (this.sortie != null && this.sortie <= this.entree) this.sortie = null; this.tl.redessiner(); break;
        case 'o': this.sortie = this.temps; if (this.entree != null && this.entree >= this.sortie) this.entree = null; this.tl.redessiner(); break;
        case 'x': this.entree = this.sortie = null; this.tl.redessiner(); break;
        case 'v': this.choisirOutil('selection'); break;
        case 'c': this.choisirOutil('rasoir'); break;
        case 'm': { const P = this.projet, t = this.temps; if ((P.marqueurs || []).some(q => Math.abs(q.t - t) < .01)) break; this.modifier(() => { (P.marqueurs = P.marqueurs || []).push({ id: LT.id(), t, nom: '', couleur: '#7be0ff' }); P.marqueurs.sort((a, b) => a.t - b.t); }); break; }   // M : un marqueur ici
        case 'h': if (!e.repeat && this.outil !== 'main') { this._avantMain = this.outil; this._hT = performance.now(); this.choisirOutil('main'); } break;   // H : la main (gardé appuyé = provisoire)
        case 's': this.aimant = !this.aimant; this.etatBoutons(); break;
        case 'delete': case 'backspace': fait(); this.supprimer(); break;
        case 'arrowleft': fait(); this.aller(this.temps - (e.shiftKey ? 1 : img)); break;
        case 'arrowright': fait(); this.aller(this.temps + (e.shiftKey ? 1 : img)); break;
        case 'arrowup': fait(); { const p = this.points().filter(x => x < this.temps - 1e-4); if (p.length) this.aller(p.at(-1)); } break;
        case 'arrowdown': fait(); { const p = this.points().find(x => x > this.temps + 1e-4); if (p != null) this.aller(p); } break;
        case 'home': this.aller(this.debutMin()); break;
        case 'end': this.aller(this.duree()); break;
        case '+': case '=': this.tl.zoomer(1.4); break;
        case '-': this.tl.zoomer(1 / 1.4); break;
        case '\\': this.tl.toutVoir(); break;
        case 'escape': if (this.r.querySelector('.lt2-plein')) this.plein(false); else this.choisir(null); break;
      }
    };
    document.addEventListener('keydown', this._clavier, true);   // en premier : Espace ne lance pas aussi le petit lecteur de BS
    // H gardé appuyé plus d'un instant : en le lâchant, on revient à l'outil d'avant
    this._clavierH = e => { if (e.key.toLowerCase() === 'h' && this._hT && performance.now() - this._hT > 300 && this.outil === 'main') this.choisirOutil(this._avantMain || 'selection'); this._hT = 0; };
    document.addEventListener('keyup', this._clavierH, true);
  }
  detruire() { this.tl.fermerMenu(); document.removeEventListener('keydown', this._clavier, true); document.removeEventListener('keyup', this._clavierH, true); this.lire(0); }
}
LT.Montage = Montage;
})(typeof self !== 'undefined' ? self : this);
