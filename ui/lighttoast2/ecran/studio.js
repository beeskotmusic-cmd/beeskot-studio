// =====================================================================
// LIGHT TOAST — le STUDIO en 3D (le coin scène, côté fenêtres).
//
//   vue de dessus (mètres) :   x = gauche (-) / droite (+)   z = 0 au mur des fenêtres
//
//        z=0  ──[rideau]──[lampe]──[rideau]──
//             vinyles  ▮t1  batterie    ▮t2  ampli
//             orgue        micro   basse      amplis
//                    ▮t3              ▮t4     fauteuil
//                         (caméra)
//             bureau, écrans, chaise          guitare au mur
//        z=L  ──────────[porte]────────────   (l'arrière : la régie, en simple)
//
// TOUTES LES MESURES SONT DANS « mesures() » : pour corriger la pièce ou déplacer
// un tube, on change un nombre là, rien d'autre. (Mesures estimées d'après les photos.)
// LT.studio.construire(THREE, mesures) → { groupe, tubes: [{ id, x, z, h }], membres }
// =====================================================================
(function (G) {
const LT = G.LT;

LT.studio = {
  mesures() {
    return {
      largeur: 3.26, longueur: 6, hauteur: 3.5,           // la pièce : plan du studio 200
      tube: { hauteur: 1, rayon: .028, socle: .12 },        // un tube LED (~1 m)
      // les 4 tubes forment un carré : 2 au fond, 2 devant (à la hauteur du photographe)
      // numéros du plan du studio 200 : 2 et 3 dans les coins côté fenêtres, 1 et 4 à ~1,9 m (côté caméra)
      tubes: [
        { id: 't1', x: -.95, z: 1.9 }, { id: 't2', x: -1.43, z: .2 },
        { id: 't3', x: 1.43, z: .2 }, { id: 't4', x: 1.43, z: 1.9 },
      ],
      // le panneau LED au plafond (n° 5) : au centre de la largeur, à ~2,75 m des fenêtres ; l = long (en travers), p = court
      panneaux: [{ id: 'p1', x: 0, z: 2.75, l: 1.7, p: .36 }],
      // les POSTES : où se met un membre selon ce qu'il joue (x, z en m ; rotY = vers où il regarde, en degrés ;
      // 0 = vers la caméra ; temps = l'instant de l'animation Mixamo, en part de sa durée)
      postes: {
        batterie: { nom: 'Batterie', x: -.55, z: .72, rotY: 0, temps: .35 },
        piano: { nom: 'Piano', x: -.78, z: 2.2, rotY: -90, temps: .3 },
        chant: { nom: 'Chant', x: .1, z: .98, rotY: 0, temps: .2, surPlace: true },   // surPlace : il ne se promène pas (vue3d.surPlace)
        basse: { nom: 'Basse', x: .85, z: 1.45, rotY: -15, temps: .4 },
        guitare: { nom: 'Guitare', x: -.25, z: 1.85, rotY: 15, temps: .4 },
      },
      // qui joue quoi au départ (modifiable dans la vue 3D, gardé dans le projet)
      roles: { Baptiste: 'batterie', Yacine: 'chant', Pierre: 'basse' },
      // les LAMPES de la pièce (pas pilotées par la vidéo) : couleur et force par défaut ; chaque morceau peut les changer
      lampes: {
        'lampe-globe': { nom: 'Lampe Globe', couleur: '#ffb070', force: .9 },
        veilleuse: { nom: 'Petite lampe (canapé)', couleur: '#ff5a48', force: .5 },
        'suspension-1': { nom: 'Suspension 1', couleur: '#ffcf8a', force: .6 },
        'suspension-2': { nom: 'Suspension 2', couleur: '#ffcf8a', force: .6 },
        'lampe-bureau': { nom: 'Lampe du bureau', couleur: '#ffb59a', force: .5 },
        'lampe-ampli': { nom: 'Lampe à côté de l\'ampli', couleur: '#ffb59a', force: .5 },
      },
      // le PLACEMENT réglé à la main avec l'outil « Placer les objets » (ecran/placer.js, version d'essai seulement) :
      //   { nom: { dx, dy, dz (m), r (degrés), k (taille, 1 = normal) } } — nom = une pièce, un tube (t1…), le panneau (p1) ou « poste:batterie »…
      placement: {   // réglé par Dari le 13 nov. 2026 (bouton « Éditer 3D » de TOAST2, 0 h 55)
        'ampli-bas': { dx: -0.117, dy: 0.1, dz: 1.345, r: 20 },
        'ampli-basse': { dx: 0.135, dz: 0.073, k: 1.75, r: -30 },
        'ampli-haut': { dx: -0.082, dy: 0.06, dz: 1.331, k: 0.9, r: -70 },
        basse: { dx: -0.237, dy: -0.4, dz: 0.128, main: 'basse', rz: -52, r: -36, rx: 2, k: 0.95 },
        batterie: { dx: -0.217, dz: 0.047, r: 125 },
        bongos: { dx: 2.563, dz: 0.498, k: 0.7, r: 65 },
        'chaise-bureau': { k: 1.4 },
        conga: { dx: 0.615, dz: 0.637 },
        etagere: { dx: -0.097, dz: -0.484, kx: 2.05, ky: 1.1, kz: 1.45 },
        fauteuil: { dx: 0.115, dz: 0.049, r: 130 },
        'guitare-mur': { dx: 0.156, dz: -0.706, r: -22, rz: 16 },
        'guitare-mur2': { dx: -0.661, dy: -1.15, dz: -2.557, k: 1.05, r: -15 },
        'guitare-mur3': { dx: 2.324, dy: -0.96, dz: 0.215, r: -128, rx: -4, rz: 30 },
        'lampe-ampli': { dx: 0.423, dy: 0.17, dz: -0.217 },
        'lampe-bureau': { dx: -0.222, dy: 0.32, dz: -1.653, r: 5 },
        'meuble-ampli': { dx: 0.071, dz: 0.125, r: -30 },
        'meuble-amplis': { dx: -0.083, dz: 1.203, kx: 1.85, ky: 1.2 },
        micro: { dx: 0.005, dz: 0.697, r: 90 },
        'micro-2': { cache: true, dx: 0.553, dz: 1.546 },
        'micro~2': { copie: 'micro', dx: 1.24, dz: 0.087, k: 0.95, ky: 0.45, r: 90 },
        'mousse-d1': { kx: 1.1, ky: 1.35 },
        'mousse-d2': { dy: 0.36, ky: 1.05, kz: 0.65 },
        'mousse-g': { dx: -0.006, dy: 0.21, dz: -0.941, kx: 1.15, ky: 1.55, kz: 0.85 },
        'mousse-noire-1': { dx: -0.012, dy: -0.24, dz: 0.032 },
        'mousse-noire-2': { dx: 0.018, dz: 0.212 },
        orgue: { dx: 0.119, dz: 0.653, k: 1.2 },
        p1: { dx: 0.314, dy: -0.832, dz: 0.627, kx: 0.45, r: 11, rx: 54 },
        plante: { cache: true, dx: -1.199, dz: 3.661 },
        'poste:basse': { dx: 0.061, dz: -0.054 },
        'poste:batterie': { dx: -0.361, dz: -0.161, r: 20 },
        'poste:chant': { dx: 0.014, dz: 0.906 },
        'poste:piano': { dx: 0.026, dz: 0.62 },
        'poste:guitare': { dx: 0.404, dz: 0.003 },
        'rideau-d': { dx: -0.014, dy: -0.05, dz: 0.142, k: 1.15 },
        'rideau-g': { dx: 0.027, dy: -0.05, dz: 0.14, k: 1.15 },
        'suspension-1': { dx: 0.652, dy: 0.44, dz: 3.007, k: 2.05 },
        'suspension-2': { dx: -0.383, dy: 0.45, dz: 0.124, k: 2.05 },
        t1: { dx: -0.515, dz: 0.287 },
        t3: { dx: -0.009, dz: -0.021 },
        t4: { dx: 0.076, dz: -0.132 },
        tabouret: { dx: 0.373, dz: -0.6, r: -85 },
        'tabouret~2': { copie: 'tabouret', dx: 0.355, dz: 0.305, r: -115 },
        'tabouret~3': { copie: 'tabouret', dx: 0.391, dz: -0.121, r: -80 },
        tapis: { dx: -0.177, dy: 0.01, dz: -0.184, k: 2.25, r: 90 },
        veilleuse: { dx: -0.001, dz: -0.109 },
      },
      // les membres en tournage (taille en m)
      membres: [
        { nom: 'Baptiste', x: -.55, z: .95, taille: 1.8, assis: true, veste: '#3d5266', bas: '#1f3d36' },
        { nom: 'Yacine', x: .1, z: 1.75, taille: 1.86, veste: '#6f88a3', bas: '#8a2a24' },
        { nom: 'Pierre', x: .85, z: 1.45, taille: 1.7, veste: '#26282c', bas: '#c9b48a' },
      ],
    };
  },

  construire(T, M) {
    const g = new T.Group(), W = M.largeur, L = M.longueur, H = M.hauteur;
    // ---------- petits outils ----------
    const mat = (c, o = {}) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: .88, metalness: 0 }, o));
    const chrome = c => mat(c, { roughness: .28, metalness: .35 });
    const pose = (m, x, y, z, parent = g) => { m.position.set(x, y, z); parent.add(m); return m; };
    // les « pièces » : chaque objet qu'un vrai modèle 3D peut remplacer (voir vue3d.js → chargerModeles)
    //   x, z = où le poser ; h = sa hauteur en mètres (le modèle est mis à cette taille tout seul)
    const pieces = {}, piece = (nom, d, o) => { pieces[nom] = Object.assign({ objets: g.children.slice(d) }, o); }; let d0;
    const boite = (l, h, p, c, x, y, z, parent) => pose(new T.Mesh(new T.BoxGeometry(l, h, p), c.isMaterial ? c : mat(c)), x, y + h / 2, z, parent);
    const rond = (r, h, c, x, y, z, parent, r2 = r) => pose(new T.Mesh(new T.CylinderGeometry(r2, r, h, 24), c.isMaterial ? c : mat(c)), x, y + h / 2, z, parent);
    const image = (l, h, dessin) => { const cv = document.createElement('canvas'); cv.width = l; cv.height = h; dessin(cv.getContext('2d'), l, h); const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; return t; };
    const mur = (l, h, c, x, y, z, ry) => { const m = new T.Mesh(new T.PlaneGeometry(l, h), c.isMaterial ? c : mat(c)); m.rotation.y = ry; m.userData.mur = true; return pose(m, x, y, z); };

    // ---------- les textures dessinées ----------
    const bois = image(256, 256, (c, l, h) => { c.fillStyle = '#d9bd8c'; c.fillRect(0, 0, l, h); for (let i = 0; i < 90; i++) { c.strokeStyle = `rgba(150,110,60,${.05 + Math.random() * .12})`; c.beginPath(); const x = Math.random() * l; c.moveTo(x, 0); c.bezierCurveTo(x + 10, h * .3, x - 10, h * .6, x + 4, h); c.stroke(); } });
    const rideau = image(256, 64, (c, l, h) => { const cols = ['#3a2416', '#3a2416', '#b08a4f', '#3a2416', '#7a8a55', '#3a2416', '#c9a468', '#2c1a10']; for (let i = 0; i < 32; i++) { c.fillStyle = cols[i % cols.length]; c.fillRect(i * 8, 0, 8, h); } });
    const tapis = image(256, 512, (c, l, h) => {
      c.fillStyle = '#7d1f24'; c.fillRect(0, 0, l, h); c.strokeStyle = '#e3d2b0'; c.lineWidth = 6; c.strokeRect(12, 12, l - 24, h - 24); c.lineWidth = 2; c.strokeRect(26, 26, l - 52, h - 52);
      c.fillStyle = '#e3d2b0'; for (let y = 50; y < h - 40; y += 34) for (let x = 46; x < l - 30; x += 34) { c.beginPath(); c.moveTo(x, y - 9); c.lineTo(x + 9, y); c.lineTo(x, y + 9); c.lineTo(x - 9, y); c.fill(); }
      c.fillStyle = '#243a5e'; for (let y = 67; y < h - 50; y += 34) for (let x = 63; x < l - 40; x += 34) c.fillRect(x - 3, y - 3, 6, 6);
    });
    const grille = image(64, 64, (c, l, h) => { c.fillStyle = '#b9b9b4'; c.fillRect(0, 0, l, h); c.fillStyle = '#8d8d88'; for (let y = 0; y < h; y += 4) for (let x = (y / 4 % 2) * 2; x < l; x += 4) c.fillRect(x, y, 2, 2); });

    // ---------- la pièce (pas de plafond, murs vus de l'intérieur seulement) ----------
    const blanc = '#d8d2c4';
    const sol = pose(new T.Mesh(new T.PlaneGeometry(W, L), mat('#8f9296', { roughness: .6 })), 0, 0, L / 2); sol.rotation.x = -Math.PI / 2; sol.userData.mur = true;
    const plafond = pose(new T.Mesh(new T.PlaneGeometry(W, L), mat('#cfc9bd')), 0, H, L / 2); plafond.rotation.x = Math.PI / 2; plafond.userData.mur = true;   // vu d'en dessous seulement (la vue Dessus passe à travers)
    mur(W, H, blanc, 0, H / 2, 0, 0);                         // mur des fenêtres
    mur(L, H, blanc, -W / 2, H / 2, L / 2, Math.PI / 2);      // mur gauche
    mur(L, H, blanc, W / 2, H / 2, L / 2, -Math.PI / 2);      // mur droit
    mur(W, H, blanc, 0, H / 2, L, Math.PI);                   // mur du fond (régie)
    // habillage bois du mur des fenêtres + retour sur le mur gauche
    d0 = g.children.length; mur(W - .004, H - .004, mat('#ffffff', { map: bois }), 0, H / 2, .012, 0); piece('bois-fenetres', d0, { x: 0, z: .012, h: H });   // le bois couvre tout le mur des fenêtres
    d0 = g.children.length; mur(.5, 1.7, mat('#ffffff', { map: bois }), -W / 2 + .012, 1.15, .45, Math.PI / 2); piece('bois-gauche', d0, { x: -W / 2 + .012, y: .3, z: .45, h: 1.7 });
    // les 2 fenêtres : cadre rouge + rideau rayé fermé
    for (const x of [-.72, .72]) {
      boite(.92, 2.05, .03, '#8d3327', x, .3, .03);
      d0 = g.children.length; pose(new T.Mesh(new T.PlaneGeometry(.84, 1.95), mat('#ffffff', { map: rideau })), x, 1.3, .055);
      piece(x < 0 ? 'rideau-g' : 'rideau-d', d0, { x, y: .33, z: .07, h: 1.95 });
    }
    // la lampe Globe (sur pied, abat-jour carré) entre les fenêtres : pas pilotée par la vidéo
    d0 = g.children.length;
    rond(.01, 1.15, '#9a9a9a', 0, 0, .22); rond(.11, .015, '#9a9a9a', 0, 0, .22);
    const abatjour = new T.MeshBasicMaterial({ color: '#57503f' }); boite(.2, .2, .2, abatjour, 0, 1.15, .22).userData.garder = true;
    const globe = new T.PointLight('#ffb070', 0, 5, 2); pose(globe, 0, 1.3, .3);
    piece('lampe-globe', d0, { x: 0, z: .22, h: 1.35 });
    const lampes = { 'lampe-globe': { lumiere: globe, mats: [abatjour] } };
    // une petite suspension en cône (le .glb la remplace ; l'ampoule et la lumière restent)
    const suspension = (nom, x, z) => {
      d0 = g.children.length;
      rond(.004, .27, '#222222', x, H - .27, z);
      const c = pose(new T.Mesh(new T.ConeGeometry(.12, .18, 24, 1, true), mat('#2a2a2a', { side: T.DoubleSide })), x, H - .36, z);
      const amp = new T.MeshBasicMaterial({ color: '#ffcf8a' }); pose(new T.Mesh(new T.SphereGeometry(.028, 12, 8), amp), x, H - .3, z).userData.garder = true;   // l'ampoule, dans l'abat-jour
      const l = new T.PointLight('#ffcf8a', 0, 5, 2); pose(l, x, H - .38, z);
      piece(nom, d0, { x, y: H, z, h: .48 }); lampes[nom] = { lumiere: l, mats: [amp] };
    };
    suspension('suspension-1', -.5, 1.4); suspension('suspension-2', .5, 1.4);
    // une lampe de table à abat-jour bordeaux (comme sur les photos) : pied, abat-jour qui s'éclaire, lumière
    const lampeTable = (nom, x, y, z, pied) => {
      d0 = g.children.length;
      rond(.055, .03, pied, x, y, z); rond(.045, .14, pied, x, y + .03, z, g, .03); rond(.008, .07, '#cccccc', x, y + .17, z);
      const ab = mat('#7a1a2a', { side: T.DoubleSide, emissive: '#000000' }); pose(new T.Mesh(new T.CylinderGeometry(.07, .13, .17, 24, 1, true), ab), x, y + .2, z).userData.garder = true;
      const l = new T.PointLight('#ffb59a', 0, 4, 2); pose(l, x, y + .25, z);
      piece(nom, d0, { x, y, z, h: .42 }); lampes[nom] = { lumiere: l, mats: [], emis: [ab] };
    };
    // panneaux acoustiques beiges sur les murs de côté
    d0 = g.children.length; boite(.08, 1.1, 1.7, '#cfc8b6', -W / 2 + .04, 1.0, 1.9); piece('mousse-g', d0, { x: -W / 2 + .04, y: 1.0, z: 1.9, h: 1.1 });
    d0 = g.children.length; boite(.08, 1.2, 1.5, '#cfc8b6', W / 2 - .04, 1.2, 1.2); piece('mousse-d1', d0, { x: W / 2 - .04, y: 1.2, z: 1.2, h: 1.2 });
    d0 = g.children.length; boite(.08, 1.2, 1.5, '#cfc8b6', W / 2 - .04, 1.2, 3.0); piece('mousse-d2', d0, { x: W / 2 - .04, y: 1.2, z: 3.0, h: 1.2 });
    // la plante (monstera) dans son vase, à droite
    d0 = g.children.length;
    rond(.07, .22, '#3b1420', 1.05, .95, .3, g, .03); const feuille = new T.Mesh(new T.CircleGeometry(.2, 12), mat('#1f4a2c', { side: T.DoubleSide })); pose(feuille, 1.02, 1.5, .3).rotation.z = .3;
    piece('plante', d0, { x: 1.05, y: .87, z: .3, h: .75 });

    // ---------- les tapis ----------
    d0 = g.children.length; boite(1.9, .012, 1.6, '#1d2230', -.55, 0, 1.0); piece('tapis-batterie', d0, { x: -.55, z: 1.0, h: .012, l: 1.9 });   // tapis sous la batterie
    d0 = g.children.length; boite(.95, .014, 2.4, mat('#ffffff', { map: tapis }), .55, 0, 2.6); piece('tapis', d0, { x: .55, z: 2.6, h: .014, l: .95 });

    // ---------- la batterie (noire, cerclages chromés) ----------
    d0 = g.children.length;
    const kit = new T.Group(); kit.position.set(-.55, 0, 1.25); g.add(kit);
    const fut = (r, p, x, y, z, rx = 0) => { const f = new T.Mesh(new T.CylinderGeometry(r, r, p, 28), mat('#141414')); f.rotation.x = rx; pose(f, x, y, z, kit); for (const s of [-1, 1]) { const c = new T.Mesh(new T.TorusGeometry(r, .008, 6, 28), chrome('#c8c8c8')); c.rotation.x = rx + Math.PI / 2; pose(c, x, y + (rx ? 0 : s * p / 2), z + (rx ? s * p / 2 : 0), kit); } return f; };
    fut(.28, .4, 0, .3, 0, Math.PI / 2);                        // grosse caisse
    fut(.16, .22, -.22, .72, -.02); fut(.18, .26, .28, .7, -.05); // toms
    fut(.18, .14, -.5, .62, .2); fut(.2, .36, .62, .3, .25);    // caisse claire, tom basse
    for (const [x, y, z, r] of [[-.75, 1.0, -.05, .2], [.55, 1.25, -.25, .23], [0, 1.2, -.4, .18]]) { rond(.008, y, '#b0b0b0', x, 0, z, kit); const c = rond(r, .006, mat('#c9a544', { roughness: .32, metalness: .45 }), x, y, z, kit); c.rotation.z = .12; }
    rond(.17, .5, '#3b2418', 0, 0, -.55, kit);                  // le tabouret
    piece('batterie', d0, { x: -.55, z: 1.0, h: 1.3 });
    // bongos sur pied (gauche) et conga verte (droite)
    d0 = g.children.length;
    rond(.008, .85, '#333333', -1.25, 0, 1.05); rond(.1, .17, '#d8b98a', -1.36, .85, 1.05); rond(.12, .17, '#d8b98a', -1.13, .85, 1.05);
    piece('bongos', d0, { x: -1.25, z: 1.05, h: 1.02 });
    d0 = g.children.length;
    rond(.13, .7, '#3f9a2e', .75, .05, .55, g, .17); rond(.17, .03, '#e6e0d0', .75, .75, .55);
    piece('conga', d0, { x: .75, z: .55, h: .78 });

    // ---------- les amplis, la basse, la guitare, le micro ----------
    d0 = g.children.length;
    d0 = g.children.length; boite(.62, .45, .4, '#5a3d2a', 1.05, 0, .42); piece('meuble-ampli', d0, { x: 1.05, z: .42, h: .45 });   // petit meuble
    d0 = g.children.length; boite(.48, .42, .28, '#151515', 1.05, .45, .42);                                           // ampli basse
    piece('ampli-basse', d0, { x: 1.05, y: .45, z: .42, h: .42 });
    d0 = g.children.length; boite(.42, .52, 1.2, '#2a1a14', W / 2 - .22, 0, 1.3); piece('meuble-amplis', d0, { x: W / 2 - .22, z: 1.3, h: .52 });   // meuble des amplis
    d0 = g.children.length;
    boite(.3, .5, .62, '#151515', W / 2 - .2, .55, 1.25); boite(.3, .12, .62, mat('#ffffff', { map: grille }), W / 2 - .36, .7, 1.25).scale.x = .05;  // ampli du bas
    piece('ampli-bas', d0, { x: W / 2 - .2, y: .52, z: 1.25, h: .5 });
    d0 = g.children.length;
    boite(.28, .5, .58, '#101010', W / 2 - .19, 1.07, 1.25);                                                           // ampli du haut
    piece('ampli-haut', d0, { x: W / 2 - .19, y: 1.04, z: 1.25, h: .48 });
    const corde = (x, z, corps, manche, large) => {
      const i = new T.Group(); i.position.set(x, 0, z); g.add(i);
      for (const [y, k] of [[.22, 1], [.47, .76]]) { const c = rond(large / 2 * k, .07, mat(corps, { roughness: .45 }), 0, y, 0, i); c.rotation.x = Math.PI / 2; }
      boite(.05, .62, .025, manche, 0, .55, .02, i); boite(.07, .16, .025, manche, 0, 1.17, .02, i); i.rotation.x = -.12; return i;
    };
    d0 = g.children.length;
    corde(.55, .5, '#efe2c0', '#7a4a2a', .34);                  // la basse (crème)
    piece('basse', d0, { x: .55, z: .5, h: 1.2 });
    d0 = g.children.length;
    rond(.012, 1.5, chrome('#888888'), .1, 0, 1.45); rond(.12, .01, '#333333', .1, 0, 1.45); boite(.07, .13, .06, chrome('#d0d0d0'), .1, 1.5, 1.45);   // micro vintage
    piece('micro', d0, { x: .1, z: 1.45, h: 1.63 });
    d0 = g.children.length; piece('micro-2', d0, { x: -.3, z: 1.45, h: 1.63 });   // 2e micro (modèle .glb seulement)

    // ---------- l'orgue (gauche), le canapé velours (droite) ----------
    d0 = g.children.length;
    boite(.55, .75, 1.25, '#3b2217', -W / 2 + .3, 0, 2.2); boite(.5, .22, 1.25, '#4a2b1c', -W / 2 + .28, .75, 2.2); boite(.3, .05, 1.1, '#e8e4da', -W / 2 + .42, .72, 2.2);
    piece('orgue', d0, { x: -W / 2 + .3, z: 2.2, h: .97 });
    // le petit fauteuil en velours (tourné vers la scène)
    d0 = g.children.length;
    const ft = new T.Group(); ft.position.set(W / 2 - .5, 0, 3.75); ft.rotation.y = Math.PI - .35; g.add(ft);
    const velours = mat('#4d2a1d', { roughness: 1 });
    boite(.62, .3, .6, velours, 0, .12, 0, ft); boite(.62, .5, .14, velours, 0, .38, -.27, ft);
    for (const s of [-1, 1]) { boite(.12, .26, .6, velours, s * .33, .36, 0, ft); rond(.025, .12, '#2a1a12', s * .26, 0, .22, ft); rond(.025, .12, '#2a1a12', s * .26, 0, -.22, ft); }
    piece('fauteuil', d0, { x: W / 2 - .5, z: 3.75, h: .88 });

    // ---------- l'arrière du studio : la régie (en simple) ----------
    const z0 = L - 2.6;                                                                   // début de la régie
    d0 = g.children.length;
    boite(.7, .05, 2.3, mat('#a8743f', { roughness: .5 }), -W / 2 + .36, .74, z0 + 1.25);   // le bureau en bois
    for (const z of [z0 + .2, z0 + 2.3]) boite(.6, .74, .05, '#2a1c14', -W / 2 + .34, 0, z);
    for (const z of [z0 + .95, z0 + 1.6]) { boite(.04, .34, .58, '#0c0c0e', -W / 2 + .14, .92, z); boite(.005, .3, .54, new T.MeshBasicMaterial({ color: '#27313a' }), -W / 2 + .165, .94, z).userData.mur = true; }   // 2 écrans
    boite(.2, .04, .85, '#e9e6de', -W / 2 + .45, .79, z0 + 1.3); boite(.22, .34, .2, '#141414', -W / 2 + .2, .79, z0 + .45);       // clavier + enceinte
    piece('bureau', d0, { x: -W / 2 + .36, z: z0 + 1.25, h: 1.13 });
    d0 = g.children.length;
    boite(.5, .05, 2.6, '#8d3327', -W / 2 + .26, 1.95, z0 + 1.2);                                                                 // l'étagère rouge
    boite(.4, .3, .9, '#18181c', -W / 2 + .24, 2.0, z0 + .8); boite(.4, .22, .6, '#2a2a30', -W / 2 + .24, 2.0, z0 + 1.9);
    piece('etagere', d0, { x: -W / 2 + .26, y: 1.95, z: z0 + 1.2, h: .35 });
    d0 = g.children.length; const ch = new T.Group(); ch.position.set(-W / 2 + 1.05, 0, z0 + 1.3); ch.rotation.y = -1.2; g.add(ch); piece('chaise-bureau', d0, { x: -W / 2 + 1.05, z: z0 + 1.3, h: .84 });                        // la chaise blanche
    rond(.28, .03, '#bdbdbd', 0, 0, 0, ch); rond(.025, .4, chrome('#bbbbbb'), 0, .03, 0, ch); rond(.27, .12, '#efece6', 0, .43, 0, ch, .22); boite(.5, .34, .08, '#efece6', 0, .5, -.24, ch);
    const dP = g.children.length;
    boite(.82, 2.0, .05, '#a5672f', .35, 0, L - .03); boite(.9, 2.06, .03, '#8d3327', .35, 0, L - .012); boite(.6, 1.0, .01, '#eeeeea', .35, .95, L - .06);   // la porte + tableau blanc
    d0 = g.children.length; boite(.55, 1.1, .06, '#0e0e10', -.75, .95, L - .04); piece('mousse-noire-1', d0, { x: -.75, y: .95, z: L - .04, h: 1.1 });   // panneaux noirs
    g.children.slice(dP).forEach(o => { o.userData.arriere = true; });   // porte, tableau, panneau noir : cachés quand la caméra est derrière le mur du fond (vue3d.rendre)
    d0 = g.children.length; boite(.06, 1.1, .6, '#0e0e10', W / 2 - .04, 1.0, L - 1.2); piece('mousse-noire-2', d0, { x: W / 2 - .04, y: 1.0, z: L - 1.2, h: 1.1 });
    d0 = g.children.length;
    rond(.16, .5, '#3b2418', 1.0, 0, L - .5); rond(.17, .05, '#151515', 1.0, .5, L - .5);                                          // tabouret
    piece('tabouret', d0, { x: 1.0, z: L - .5, h: .75 });
    // au mur de droite : la guitare électrique, la petite lampe bordeaux
    d0 = g.children.length;
    const st = corde(W / 2 - .06, 4.9, '#c9b98a', '#5a3b22', .3); st.rotation.set(0, -Math.PI / 2, 0); st.position.y = 1.15;
    piece('guitare-mur', d0, { x: W / 2 - .07, y: 1.15, z: 4.9, h: 1.0 });
    d0 = g.children.length; piece('guitare-mur2', d0, { x: W / 2 - .07, y: 1.15, z: 5.45, h: 1.0 });   // place libre (modèle .glb seulement)
    d0 = g.children.length; piece('guitare-mur3', d0, { x: -W / 2 + .07, y: 1.15, z: 3.05, h: 1.0 });
    d0 = g.children.length;
    boite(.4, .5, .4, '#2a1a14', W / 2 - .25, 0, 4.55); rond(.06, .14, '#e9dfd0', W / 2 - .25, .5, 4.55);
    const bordeaux = new T.MeshBasicMaterial({ color: '#3a1216' }); rond(.11, .13, bordeaux, W / 2 - .25, .64, 4.55, g, .07).userData.garder = true;
    const veilleuse = new T.PointLight('#ff5a48', 0, 3, 2); pose(veilleuse, W / 2 - .3, .75, 4.5);
    piece('veilleuse', d0, { x: W / 2 - .25, z: 4.55, h: .77 }); lampes.veilleuse = { lumiere: veilleuse, mats: [bordeaux] };
    // les 2 lampes à abat-jour bordeaux : sur le bureau (pied blanc) et à côté de l'ampli (pied en verre)
    lampeTable('lampe-bureau', -W / 2 + .4, .79, z0 + 2.1, '#efece6');
    lampeTable('lampe-ampli', W / 2 - .55, .45, 3.25, '#c9d2d6');

    // ---------- les membres (silhouettes simples) ----------
    const membres = new T.Group(), etiquettes = {}; g.add(membres);
    const etiquette = nom => { const t = image(256, 64, (c, l, h) => { c.font = '600 34px sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(0, 8, l, 48); c.fillStyle = '#f4f1ea'; c.fillText(nom, l / 2, 44); }); const s = new T.Sprite(new T.SpriteMaterial({ map: t, depthTest: false })); s.scale.set(.5, .125, 1); return s; };
    const capsule = (r, l, c, x, y, z, parent) => pose(new T.Mesh(new T.CapsuleGeometry(r, Math.max(.01, l - 2 * r), 6, 14), c.isMaterial ? c : mat(c)), x, y + l / 2, z, parent);
    for (const p of M.membres) {
      const m = new T.Group(); m.position.set(p.x, 0, p.z); membres.add(m);
      const k = p.taille / 1.8, bas = p.assis ? .52 : .88 * k, jean = mat('#5f7186'), veste = mat(p.veste), peau = mat('#c9a88c', { roughness: .7 });
      if (!p.assis) for (const s of [-1, 1]) { capsule(.075, bas, jean, s * .095, 0, 0, m); boite(.1, .06, .24, '#5a3a22', s * .095, 0, .05, m); }
      else for (const s of [-1, 1]) { const c = capsule(.075, .46, jean, s * .1, bas - .08, .2, m); c.rotation.x = Math.PI / 2; c.position.y = bas - .03; capsule(.065, bas - .05, jean, s * .1, 0, .42, m); }
      const torse = capsule(.19, .64 * k, veste, 0, bas - .04, 0, m); torse.scale.z = .68;
      for (const s of [-1, 1]) { const b = capsule(.055, .6 * k, veste, s * .25, bas, 0, m); b.rotation.z = s * .12; }
      capsule(.05, .12, peau, 0, bas + .58 * k, 0, m);
      pose(new T.Mesh(new T.SphereGeometry(.105, 24, 18), peau), 0, bas + .62 * k + .16, 0, m).scale.set(.92, 1.08, 1);
      etiquettes[p.nom] = pose(etiquette(p.nom), p.x, bas + .62 * k + .44, p.z, membres); etiquettes[p.nom].visible = false;   // les noms au-dessus des membres : cachés (demande de Dari)
      pieces['membre:' + p.nom] = { objets: [m], parent: membres, x: p.x, z: p.z, h: p.assis ? p.taille * .74 : p.taille };
    }
    // tout projette et reçoit des ombres, sauf les murs, le sol et ce qui brille tout seul
    g.traverse(o => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = !o.userData.mur && !o.userData.garder; } });

    return { groupe: g, membres, pieces, etiquettes, lampes, panneaux: M.panneaux.map(p => Object.assign({ y: M.hauteur }, p)), tubes: M.tubes.map(t => Object.assign({ h: M.tube.hauteur, r: M.tube.rayon, socle: M.tube.socle }, t)) };
  },
};
})(typeof self !== 'undefined' ? self : this);
