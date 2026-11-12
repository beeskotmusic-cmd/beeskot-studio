// =====================================================================
// LIGHT TOAST — la VUE 3D : le studio éclairé par les 4 tubes, en direct.
//
//   Rendu : ombres douces, halo autour des tubes, légère brume, lampes d'ambiance (Globe, veilleuse).
//   moteur (couleur de chaque tube, image par image)
//        │
//        ├─▶ le tube lui-même : on colle dessus l'image calculée par le moteur
//        └─▶ 2 lampes par tube (haut / bas) : elles éclairent la pièce de la même couleur
//
// Ne redessine que quand le moniteur le demande (rien ne tourne en boucle).
//
// VRAIS MODÈLES 3D (facultatif) : si le dossier « modeles/ » contient liste.json, chaque pièce
// citée est remplacée par son fichier .glb ; sinon on garde les formes simples. Exemple de liste.json :
//   { "membre:Baptiste": { "fichier": "baptiste.glb", "rotY": 180, "temps": 1.2 },
//     "batterie":        { "fichier": "batterie.glb", "echelle": 1.1, "dx": 0.1 } }
//   rotY (degrés), echelle, hauteur (m), dx / dy / dz (m) : pour ajuster ; animation + temps : la pose d'un personnage animé.
//   Pièces : membre:Nom, batterie, bongos, conga, basse, guitare, micro, ampli-basse, amplis, orgue, fauteuil.
//
// POSES DES MEMBRES (Mixamo) : 5 fichiers .fbx (batterie, piano, guitare, basse, chant), tous avec le même squelette.
//   Chaque membre choisit son rôle → il va au « poste » de cet instrument (studio.js → postes) et prend la pose,
//   figée à un instant de l'animation (réglable). Le même squelette servira plus tard pour nos vrais modèles.
// Souris : glisser = tourner autour de la scène, molette = avancer / reculer.
// Boutons : Caméra (la place du photographe) · Large · Dessus ; ambiance Noir / Tamisé / Jour.
// =====================================================================
(function (G) {
const LT = G.LT;
const VUES = { camera: [[0, 1.4, 3.4], [0, 1.05, .8]], large: [[.25, 1.7, 5.3], [0, .95, 1.2]], regie: [[0, 1.6, 2.6], [-.2, 1.0, 6.5]], dessus: [[0, 10.5, 3.61], [0, 0, 3.6]] };
// ambiance : [lumière générale, lampe Globe, veilleuse bordeaux]
const AMBIANCES = { noir: [.03, 0, 0], tamise: [.16, .9, .5], jour: [1.6, .4, .2] };

class Vue3D {
  constructor(cont, m) {
    const T = G.THREE; this.T = T; this.m = m; this.cont = cont;
    this.r = new T.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    this.r.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));     // jamais trop lourd pour le PC
    this.r.toneMapping = T.ACESFilmicToneMapping; this.r.toneMappingExposure = 1.05;
    this.r.shadowMap.enabled = true; this.r.shadowMap.type = T.PCFSoftShadowMap;
    cont.appendChild(this.r.domElement);
    this.scene = new T.Scene(); this.scene.background = new T.Color('#050507'); this.scene.fog = new T.FogExp2('#08060c', .03);
    this.cam = new T.PerspectiveCamera(55, 16 / 9, .05, 40);
    const S = LT.studio.construire(T, LT.studio.mesures()); this.S = S; this.scene.add(S.groupe);
    this.amb = new T.HemisphereLight('#fff1dd', '#6b5a4a', 0); this.scene.add(this.amb);
    // le halo : une tache de lumière douce, toujours tournée vers la caméra
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c2 = cv.getContext('2d'), gr = c2.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(.25, 'rgba(255,255,255,.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c2.fillStyle = gr; c2.fillRect(0, 0, 128, 128);
    const lueur = new T.CanvasTexture(cv);
    // les tubes : un cylindre qui porte l'image du moteur + un halo + 2 lampes
    this.tubes = S.tubes.map(t => {
      const g = new T.Group(); g.position.set(t.x, 0, t.z); this.scene.add(g);
      const socle = new T.Mesh(new T.CylinderGeometry(.06, .075, t.socle, 16), new T.MeshLambertMaterial({ color: '#111111' })); socle.position.y = t.socle / 2; g.add(socle);
      const mat = new T.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), halo = new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .22, blending: T.AdditiveBlending, depthWrite: false });
      const y = t.socle + t.h / 2;
      const corps = new T.Mesh(new T.CylinderGeometry(t.r, t.r, t.h, 16), mat); corps.position.y = y; g.add(corps);
      const h = new T.Mesh(new T.CylinderGeometry(t.r * 2.6, t.r * 2.6, t.h, 16, 1, true), halo); h.position.y = y; g.add(h);
      const lampes = [.75, .25].map((k, i) => {   // [haut, bas] ; seule celle du haut fait des ombres (moins lourd)
        const l = new T.PointLight('#000000', 0, 8, 2); l.position.y = t.socle + t.h * k; g.add(l);
        if (i === 0) { l.castShadow = true; l.shadow.mapSize.set(512, 512); l.shadow.bias = -.003; l.shadow.radius = 4; l.shadow.camera.near = .06; l.shadow.camera.far = 8; }
        return l;
      });
      const lueurs = [.75, .25].map(k => { const sp = new T.Sprite(new T.SpriteMaterial({ map: lueur, color: '#000000', blending: T.AdditiveBlending, depthWrite: false, transparent: true })); sp.scale.set(.75, .85, 1); sp.position.y = t.socle + t.h * k; g.add(sp); return sp; });
      return { id: t.id, mat, halo, lampes, lueurs, g, base: { x: t.x, y: 0, z: t.z, r: 0 } };
    });
    // le panneau LED au plafond : il porte l'image du moteur et éclaire vers le bas (2 lampes, une à chaque bout)
    for (const p of S.panneaux) {
      const g = new T.Group(); g.position.set(p.x, p.y, p.z); this.scene.add(g);
      const cadre = new T.Mesh(new T.BoxGeometry(p.l + .06, .04, p.p + .06), new T.MeshStandardMaterial({ color: '#1a1a1a', roughness: .6 })); cadre.position.y = -.025; g.add(cadre);
      const mat = new T.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), face = new T.Mesh(new T.PlaneGeometry(p.p, p.l), mat);
      face.rotation.set(Math.PI / 2, 0, Math.PI / 2); face.position.y = -.047; g.add(face);   // tournée vers le sol, la longueur en travers de la pièce
      const lampes = [-1, 1].map(s => { const l = new T.PointLight('#000000', 0, 7, 2); l.position.set(s * p.l / 3, -.3, 0); g.add(l); return l; });
      this.tubes.push({ id: p.id, mat, lampes, lueurs: [], panneau: true, g, base: { x: p.x, y: p.y, z: p.z, r: 0 } });
    }
    // chaque objet qu'on peut déplacer a son « socle » (un groupe posé à sa place) : bouger le socle = bouger l'objet
    this.cibles = {};
    S.groupe.updateMatrixWorld(true);
    for (const [nom, p] of Object.entries(S.pieces)) {
      if (nom.startsWith('membre:')) continue;
      const socle = new T.Group(); socle.position.set(p.x, p.y || 0, p.z); S.groupe.add(socle); socle.updateMatrixWorld(true);
      p.objets.forEach(o => socle.attach(o)); p.socle = socle;
      this.cibles[nom] = { g: socle, base: { x: p.x, y: p.y || 0, z: p.z, r: 0 } };
    }
    for (const t of this.tubes) this.cibles[t.id] = { g: t.g, base: t.base };
    for (const c of Object.entries(this.cibles)) c[1].g.userData.cible = c[0];
    this.placement = Object.assign({}, LT.studio.mesures().placement, LT.placementEssai ? LT.placementEssai() : null);
    this.appliquer();
    this.ambiance('tamise', true); this.vue('camera'); this.souris();
    this.chargerModeles(); this.poses = {}; this.figurants = {};
    LT.sources.poses && LT.sources.poses().then(p => p && this.ajouterPoses(p, true)).catch(() => {});
    new ResizeObserver(() => { this.taille(); this.rendre(); }).observe(cont);
    this.taille();
  }
  taille() { const l = this.cont.clientWidth, h = this.cont.clientHeight; if (!l || !h) return; this.r.setSize(l, h, false); this.cam.aspect = l / h; this.cam.updateProjectionMatrix(); }

  // ---------- caméra ----------
  vue(nom) { const [p, c] = VUES[nom] || VUES.camera; this.cible = new this.T.Vector3(...c); const d = new this.T.Vector3(...p).sub(this.cible); this.rayon = d.length(); this.phi = Math.acos(d.y / this.rayon); this.theta = Math.atan2(d.x, d.z); this.placer(); }
  placer() { const s = Math.sin(this.phi); this.cam.position.set(this.cible.x + this.rayon * s * Math.sin(this.theta), this.cible.y + this.rayon * Math.cos(this.phi), this.cible.z + this.rayon * s * Math.cos(this.theta)); this.cam.lookAt(this.cible); }
  souris() {
    const el = this.r.domElement; el.style.touchAction = 'none'; el.style.cursor = 'grab';
    el.addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault(); });   // pas de défilement auto du clic du milieu
    el.addEventListener('pointerdown', e => {
      el.setPointerCapture(e.pointerId); let x = e.clientX, y = e.clientY;
      if (e.button === 1) {   // clic du milieu maintenu = faire glisser la caméra (droite / gauche, haut / bas)
        e.preventDefault(); const T = this.T;
        el.onpointermove = ev => {
          const k = this.rayon * .0016, dr = new T.Vector3().setFromMatrixColumn(this.cam.matrixWorld, 0), dh = new T.Vector3().setFromMatrixColumn(this.cam.matrixWorld, 1);
          this.cible.addScaledVector(dr, -(ev.clientX - x) * k).addScaledVector(dh, (ev.clientY - y) * k); x = ev.clientX; y = ev.clientY; this.placer(); this.rendre();
        };
        el.onpointerup = () => { el.onpointermove = null; }; return;
      }
      el.onpointermove = ev => { this.theta -= (ev.clientX - x) * .006; this.phi = Math.max(.05, Math.min(1.55, this.phi - (ev.clientY - y) * .006)); x = ev.clientX; y = ev.clientY; this.placer(); this.rendre(); };
      el.onpointerup = () => { el.onpointermove = null; };
    });
    el.addEventListener('wheel', e => { e.preventDefault(); this.rayon = Math.max(.6, Math.min(12, this.rayon * (e.deltaY > 0 ? 1.1 : .9))); this.placer(); this.rendre(); }, { passive: false });
  }
  ambiance(nom, sansRendu) {
    const [a] = AMBIANCES[nom] || AMBIANCES.tamise;
    this.amb.intensity = a; this.lumieres(true);
    if (!sansRendu) this.rendre();
  }
  // les lampes de la pièce : réglages du morceau (projet.studio3d.lampes), sinon ceux du studio
  reglagesLampes() { const P = this.m.projet; P.studio3d = P.studio3d || {}; return P.studio3d.lampes = P.studio3d.lampes || {}; }
  lampe(nom) { nom = (this.copies || {})[nom] || nom; const d = LT.studio.mesures().lampes[nom] || {}, r = this.reglagesLampes()[nom] || {}; return { nom: d.nom || nom, couleur: r.couleur || d.couleur || '#ffffff', force: r.force ?? d.force ?? .5, allumee: r.allumee ?? true }; }
  lumieres(sansRendu) {
    const T = this.T;
    for (const [nom, L] of Object.entries(this.S.lampes || {})) {
      const o = this.lampe(nom), visible = !(this.placement && (this.placement[nom] || {}).cache), on = o.allumee && visible;
      L.lumiere.color.set(o.couleur); L.lumiere.intensity = on ? o.force : 0;
      const c = new T.Color(o.couleur); if (!on) c.multiplyScalar(.15);
      L.mats.forEach(m => m.color.copy(c));
      (L.emis || []).forEach(m => m.emissive.set(o.couleur).multiplyScalar(on ? Math.min(1, o.force) * .7 : 0));   // l'abat-jour s'éclaire
    }
    if (!sansRendu) this.rendre();
  }
  ombres(oui) { this.tubes.forEach(t => { t.lampes[0].castShadow = oui; }); this.rendre(); }
  montrerMembres(oui) { this.S.membres.visible = oui; this.rendre(); }

  // ---------- les poses des membres (Mixamo) ----------
  // octets : { batterie: ArrayBuffer, … }  (le nom peut aussi venir d'un nom de fichier : drum, piano, guitar, bass, sing)
  ajouterPoses(octets, dejaGardees) {
    if (!dejaGardees && LT.sources.garderPoses) LT.sources.garderPoses(octets).catch(() => {});   // pour ne pas avoir à les recharger
    const sorte = n => { n = n.toLowerCase(); return /bass|basse/.test(n) ? 'basse' : /drum|batter/.test(n) ? 'batterie' : /piano|orgue/.test(n) ? 'piano' : /guit/.test(n) ? 'guitare' : /sing|chant|voix/.test(n) ? 'chant' : null; };
    let n = 0;
    for (const [nom, buf] of Object.entries(octets)) {
      const r = sorte(nom); if (!r) continue;
      try {
        const obj = new LT.FBXLoader().parse(buf, ''), clips = (obj.animations || []).slice().sort((a, b) => b.duration - a.duration);
        obj.traverse(x => { if (x.isMesh) { x.castShadow = x.receiveShadow = true; x.frustumCulled = false; } });
        this.poses[r] = { obj, clip: clips[0] || null }; n++;
      } catch (e) { console.warn('Light Toast : pose « ' + nom + ' » illisible (' + (e.message || e) + ')'); }
    }
    this.placerMembres(); this.surPoses && this.surPoses(); return n;
  }
  // place les 3 membres selon leur rôle (projet.studio3d.membres), avec la pose si on l'a, sinon la silhouette simple
  placerMembres() {
    const T = this.T, M = LT.studio.mesures(), P = this.m.projet, roles = this.roles(), pris = {};
    for (const p of M.membres) {
      const piece = this.S.pieces['membre:' + p.nom], c = roles[p.nom] || {}, r = c.role || M.roles[p.nom], poste = this.poste(r);
      if (!piece || !poste) continue;
      const d = pris[r] = (pris[r] || 0) + 1, dx = (d - 1) * .7;          // deux membres au même poste : on décale le 2e
      const pose = this.poses[r];
      let fig = this.figurants[p.nom];
      if (pose) {
        if (!fig || fig.role !== r) {
          if (fig) fig.groupe.removeFromParent();
          const copie = LT.SkeletonUtils.clone(pose.obj), groupe = new T.Group(); groupe.add(copie);
          fig = this.figurants[p.nom] = { role: r, groupe, copie, mixer: pose.clip && new T.AnimationMixer(copie) };
          if (fig.mixer) fig.mixer.clipAction(pose.clip).play();
          // aux couleurs du membre : le corps = sa veste, les articulations = un 2e ton (bonnet de Yacine, chemise de Pierre…)
          copie.traverse(x => { if (!x.isMesh) return; x.material = (Array.isArray(x.material) ? x.material : [x.material]).map(m => { m = m.clone(); m.color && m.color.set(/joint/i.test(x.name) ? (p.bas || '#333333') : (p.veste || '#888888')); return m; }); if (x.material.length === 1) x.material = x.material[0]; });
          this.S.membres.add(groupe);
        }
        // l'instant de l'animation, puis : à la bonne taille, pieds au sol, centré sur le poste
        const k = .01 * p.taille / 1.76, temps = c.temps ?? poste.temps;
        if (fig.mixer) fig.mixer.setTime(pose.clip.duration * temps);
        fig.copie.position.set(0, 0, 0); fig.groupe.position.set(0, 0, 0); fig.groupe.rotation.set(0, 0, 0); fig.groupe.scale.setScalar(1);
        fig.groupe.updateMatrixWorld(true);   // mesurer sans l'ancienne taille / place
        const b = new T.Box3().setFromObject(fig.copie, true);
        fig.copie.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
        fig.groupe.scale.setScalar(k); fig.groupe.rotation.y = poste.rotY * Math.PI / 180;
        fig.groupe.position.set(poste.x + dx, 0, poste.z); fig.groupe.visible = true; fig.groupe.userData.cible = 'poste:' + r; fig.haut = (b.max.y - b.min.y) * k;
        piece.objets.forEach(x => { x.visible = false; });
      } else {
        if (fig) fig.groupe.visible = false;
        const m = piece.objets[0]; m.visible = true; m.position.set(poste.x + dx, 0, poste.z); m.rotation.y = (poste.rotY - (LT.studio.mesures().postes[r] || poste).rotY) * Math.PI / 180; m.userData.cible = 'poste:' + r;
      }
      // l'étiquette du nom suit le membre
      const et = this.S.etiquettes && this.S.etiquettes[p.nom];
      if (et) et.position.set(poste.x + dx, (fig && fig.groupe.visible ? fig.haut : p.taille) + .25, poste.z);
    }
    if (this.cibles) for (const [n, d] of Object.entries(this.placement || {})) if (d.main && this.cibles[n]) this.appliquer(n, true);
    this.rendre();
  }
  // un poste, avec le déplacement réglé à la main
  poste(r) { const p = LT.studio.mesures().postes[r]; if (!p) return p; const d = this.placement['poste:' + r] || {}; return Object.assign({}, p, { x: p.x + (d.dx || 0), z: p.z + (d.dz || 0), rotY: p.rotY + (d.r || 0) }); }
  // le buste du membre qui tient le rôle r : position du haut du dos (os « Spine2 » de Mixamo) et sens où il regarde
  corps(r) {
    const T = this.T, fig = Object.values(this.figurants || {}).find(f => f.role === r && f.groupe.visible);
    const p = this.poste(r); if (!p) return null;
    const quat = new T.Quaternion().setFromEuler(new T.Euler(0, p.rotY * Math.PI / 180, 0));
    if (fig) {
      fig.groupe.updateMatrixWorld(true); let os = null; fig.copie.traverse(x => { if (!os && x.isBone && /Spine2$/i.test(x.name)) os = x; });
      if (os) return { pos: os.getWorldPosition(new T.Vector3()), quat };
    }
    const qui = LT.studio.mesures().membres.find(m => (this.roles()[m.nom] || {}).role === r || (!(this.roles()[m.nom] || {}).role && LT.studio.mesures().roles[m.nom] === r));
    return qui ? { pos: new T.Vector3(p.x, (qui.taille || 1.8) * .72, p.z), quat } : null;
  }
  // remet chaque objet à sa place (place de départ + réglage à la main) ; nom = un seul objet
  appliquer(nom, sansMembres) {
    if (!nom) this.copiesAJour();
    for (const [n, c] of Object.entries(this.cibles)) {
      if (nom && n !== nom) continue;
      const d = this.placement[n] || {}, b = c.base, rad = Math.PI / 180, T = this.T;
      const k = d.k || 1; c.g.scale.set(k * (d.kx || 1), k * (d.ky || 1), k * (d.kz || 1)); c.g.visible = !d.cache; if (this.S.lampes && this.S.lampes[n]) this.lumieres(true);
      const corps = d.main && this.corps(d.main);
      if (corps) {   // tenu par un membre : collé à son buste, tourné comme lui, puis les réglages
        c.g.position.copy(corps.pos).add(new T.Vector3(d.dx || 0, d.dy || 0, d.dz || 0).applyQuaternion(corps.quat));   // décalage dans le sens du membre
        c.g.quaternion.copy(corps.quat).multiply(new T.Quaternion().setFromEuler(new T.Euler((d.rx || 0) * rad, (d.r || 0) * rad, (d.rz || 0) * rad, 'YXZ')));
      } else {
        c.g.position.set(b.x + (d.dx || 0), b.y + (d.dy || 0), b.z + (d.dz || 0));
        c.g.rotation.set((d.rx || 0) * rad, (b.r + (d.r || 0)) * rad, (d.rz || 0) * rad, 'YXZ');
      }
    }
    if (!this.figurants || sansMembres) return;
    if (!nom || nom.startsWith('poste:')) this.placerMembres(); else this.rendre();
  }
  // ---------- les COPIES d'objets (« Dupliquer » dans l'outil de placement) ----------
  //   placement["tabouret~2"] = { copie: "tabouret", dx, dz, … } : une 2e pièce, réglée comme les autres
  copiesAJour() {
    this.copies = this.copies || {};
    for (const [n, d] of Object.entries(this.placement)) if (d.copie && this.S.pieces[d.copie] && !this.cibles[n]) this.creerCopie(n, d.copie);
    for (const n of Object.keys(this.copies)) if (!(this.placement[n] || {}).copie) {
      this.cibles[n].g.removeFromParent(); delete this.cibles[n]; delete this.copies[n]; if (this.S.lampes) delete this.S.lampes[n];
    }
  }
  creerCopie(n, src) {
    const g = new this.T.Group(); g.userData.cible = n; this.S.groupe.add(g);
    this.cibles[n] = { g, base: this.cibles[src].base }; this.copies[n] = src; this.remplirCopie(n);
  }
  remplirCopie(n) {   // la copie reprend ce qu'il y a dans l'original (forme simple ou modèle .glb)
    const src = this.copies[n], g = this.cibles[n].g; g.clear();
    for (const x of this.cibles[src].g.children) g.add(x.clone(true));
    const L = this.S.lampes && this.S.lampes[src];
    if (L) { let l = null; g.traverse(x => { if (!l && x.isLight) l = x; }); this.S.lampes[n] = Object.assign({}, L, { lumiere: l }); this.lumieres(true); }
  }
  // les choix de rôle, gardés dans le projet
  roles() { const P = this.m.projet; P.studio3d = P.studio3d || {}; return P.studio3d.membres = P.studio3d.membres || {}; }
  posesChargees() { return Object.keys(this.poses); }

  // ---------- les vrais modèles 3D ----------
  async chargerModeles() {
    const src = LT.sources && LT.sources.modeles; if (!src || !LT.GLTFLoader) return;
    let liste = null; try { liste = await src.liste(); } catch (e) { }
    if (!liste) return;
    for (const [nom, o] of Object.entries(liste)) {
      const p = this.S.pieces[nom]; if (!p || !o || !o.fichier) continue;
      try {
        const octets = await src.fichier(o.fichier), gltf = await new Promise((ok, ko) => new LT.GLTFLoader().parse(octets, '', ok, ko));
        this.poserModele(p, gltf, o);
      } catch (e) { console.warn('Light Toast : modèle 3D « ' + nom + ' » non chargé (' + (e.message || e) + '), on garde la forme simple.'); }
    }
    this.rendre();
  }
  // met le modèle à la bonne taille, les pieds au sol, centré sur la place de la pièce
  poserModele(p, gltf, o) {
    const T = this.T, m = gltf.scene, boite = new T.Group();
    if (gltf.animations && gltf.animations.length) { const mx = new T.AnimationMixer(m); mx.clipAction(gltf.animations[o.animation | 0] || gltf.animations[0]).play(); mx.setTime(o.temps || 0); }
    if (o.rotX || o.rotZ) { const q = new T.Group(); q.add(...m.children.slice()); m.add(q); q.rotation.set((o.rotX || 0) * Math.PI / 180, 0, (o.rotZ || 0) * Math.PI / 180); }   // remettre debout un modèle couché
    m.updateMatrixWorld(true);
    m.traverse(x => { if (x.isMesh) { x.castShadow = x.receiveShadow = true; x.frustumCulled = false; } });
    const b = new T.Box3().setFromObject(m, true), t = b.getSize(new T.Vector3()), k = ((o.largeur || p.l) ? (o.largeur || p.l) / (t.x || 1) : (o.hauteur || p.h) / (t.y || 1)) * (o.echelle || 1);   // objet plat (tapis) : mis à sa largeur
    m.position.x -= (b.min.x + b.max.x) / 2; m.position.z -= (b.min.z + b.max.z) / 2; m.position.y -= o.pendu ? b.max.y : b.min.y;   // pendu : accroché par le haut (suspension au plafond)
    boite.add(m); boite.scale.setScalar(k); boite.rotation.y = (o.rotY || 0) * Math.PI / 180; if (p.socle) boite.position.set(o.dx || 0, o.dy || 0, o.dz || 0); else boite.position.set(p.x + (o.dx || 0), (p.y || 0) + (o.dy || 0), p.z + (o.dz || 0));
    if (p.modele) p.modele.removeFromParent();
    (p.socle || p.parent || this.S.groupe).add(boite); p.objets.forEach(x => { if (!x.isLight && !x.userData.garder) x.visible = false; }); p.modele = boite;   // la lumière et l'ampoule restent
    for (const [n, src] of Object.entries(this.copies || {})) if (this.S.pieces[src] === p) { this.remplirCopie(n); this.appliquer(n, true); }
  }

  // ---------- relier les tubes aux images du moteur (refait quand le projet est rechargé) ----------
  brancher() {
    const T = this.T, zones = this.m.moteur.zones; this.zones = zones;
    for (const t of this.tubes) {
      const Z = zones.find(z => z.z.id === t.id); t.Z = Z;
      if (t.tex) t.tex.dispose(); t.tex = null;
      if (Z) { t.tex = new T.CanvasTexture(Z.cv); t.tex.colorSpace = T.SRGBColorSpace; t.tex.magFilter = T.LinearFilter; }
      t.mat.map = t.tex; t.mat.needsUpdate = true;
    }
  }
  // dessine la pièce avec les couleurs que le moteur vient de calculer
  rendre() {
    if (!this.cont.clientWidth) return;
    if (this.zones !== this.m.moteur.zones) this.brancher();
    for (const t of this.tubes) {
      const Z = t.Z; if (!Z) { t.lampes.forEach(l => l.intensity = 0); t.lueurs.forEach(l => l.material.color.set('#000000')); t.mat.color.set('#000000'); if (t.halo) t.halo.color.set('#000000'); continue; }
      // couleur moyenne du haut et du bas du tube
      const d = Z.img.data, n = d.length / 2, moy = [[0, 0, 0], [0, 0, 0]];
      for (let i = 0; i < d.length; i += 4) { const m = moy[i < n ? 0 : 1]; m[0] += d[i]; m[1] += d[i + 1]; m[2] += d[i + 2]; }
      const px = n / 4 * 255; let tout = [0, 0, 0];
      t.lampes.forEach((l, k) => {
        const c = moy[k].map(v => v / px), fort = Math.max(c[0], c[1], c[2]);
        l.color.setRGB(c[0], c[1], c[2], this.T.SRGBColorSpace); l.intensity = fort > .004 ? 3.4 : 0; t.lueurs[k] && t.lueurs[k].material.color.setRGB(c[0] * .8, c[1] * .8, c[2] * .8, this.T.SRGBColorSpace);
        tout = tout.map((v, i) => v + c[i] / 2);
      });
      if (t.tex) { t.tex.needsUpdate = true; t.mat.color.set('#ffffff'); } else t.mat.color.setRGB(tout[0], tout[1], tout[2], this.T.SRGBColorSpace);
      if (t.halo) t.halo.color.setRGB(tout[0], tout[1], tout[2], this.T.SRGBColorSpace);
    }
    this.r.render(this.scene, this.cam);
  }
}
LT.Vue3D = Vue3D;
})(typeof self !== 'undefined' ? self : this);
