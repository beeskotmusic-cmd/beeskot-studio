// =====================================================================
// LIGHT TOAST — la bibliothèque des EFFETS. Ce sont des calques d'effets :
// ils agissent sur tout ce qui est EN DESSOUS d'eux (la couleur, et les effets plus bas).
//
//  OVERLAY (texture)   la couleur du dessous devient cette texture, dans SA couleur
//                      rendu → px.k (0 = ombre, 1 = éclat) et px.b (luminosité 0-1)
//  MOUVEMENT (masque)  découpe le dessous (strobo, sunrise…) ; en mode « lumière » il ajoute sa couleur
//                      rendu → px.a (0 = éteint, 1 = allumé)
//
// TOUT SUIT LE TEMPO :  px.tb = temps (en temps musicaux) depuis le début du clip,
//                       px.pb = temps musicaux depuis le début du morceau (suit la courbe de vitesse)
// Autres infos dans px : u, v (dans la lumière, v = 0 en haut) ; gx, gy (dans toute l'image) ;
//   zi / nz = rang de la lumière parmi celles du clip / leur nombre ; p = avancée dans le clip (0 → 1).
// Réglages : un nombre = glisseur 0-1 (ou bornes dans BORNES de l'inspecteur) ; « choix » = menu.
// Ajouter un effet = ajouter un bloc ici.
// =====================================================================
(function (G) {
const LT = G.LT, H = LT.hasard, S = Math.sin, PI2 = Math.PI * 2;
// les divisions du temps : [valeur (coups par temps), nom]
const DIV = [[.25, '1 / mesure'], [.5, '1/2'], [1, '1/4 (le temps)'], [2, '1/8'], [3, '1/8 triolet'], [4, '1/16'], [6, '1/16 triolet'], [8, '1/32']];
const DUREE = [[.5, '1/2 temps'], [1, '1 temps'], [2, '2 temps'], [4, '1 mesure'], [8, '2 mesures'], [16, '4 mesures']];
const SENS = [['haut', 'Bas → haut'], ['bas', 'Haut → bas'], ['droite', 'Gauche → droite'], ['gauche', 'Droite → gauche']];
const pos = (px, sens) => sens === 'bas' ? px.v : sens === 'droite' ? (px.zi + px.u) / px.nz : sens === 'gauche' ? 1 - (px.zi + px.u) / px.nz : 1 - px.v;
const bord = (d, doux) => d <= 0 ? 1 : d >= doux ? 0 : 1 - LT.lisse(d / doux);
const fr = x => x - Math.floor(x);

LT.DIV = DIV; LT.DUREE = DUREE;
LT.effets = {
  // ===================== OVERLAYS (textures) =====================
  flamme: {
    nom: 'Flamme', sorte: 'overlay', reglages: { vitesse: .5, profondeur: .6 },
    rendu(px, r) {
      const t = px.pb * (.6 + 3 * r.vitesse), z = px.zr * 17.3;
      const n = .5 * LT.bruit(t + z, 1) + .3 * LT.bruit(t * 2.3 + z, 2) + .2 * LT.bruit(t * 4.1 + z, 3);
      const rafale = Math.pow(LT.bruit(t * .35 + z, 4), 5), haut = 1 - px.v;
      px.b = LT.borne(1.05 - r.profondeur * (1.1 * (1 - n) + .6 * rafale) - haut * haut * .5 * r.profondeur, .05, 1);
      px.k = LT.borne((1 - haut) * .7 + (n - .5) * .5);
    },
  },
  plasma: {
    nom: 'Plasma', sorte: 'overlay', reglages: { vitesse: .5, taille: .5 },
    rendu(px, r) {
      const z = 2 + 8 * (1 - r.taille), t = px.pb * (.15 + .9 * r.vitesse), x = px.gx * z * 1.8, y = px.gy * z;
      const v = S(x + t) + S(y * .9 - t * 1.3) + S((x + y) * .7 + t * .8) + S(Math.hypot(x - 4, y - 3) - t);
      px.k = .5 + v / 8; px.b = .45 + .55 * (.5 + .5 * S(v * 1.4));
    },
  },
  ondes: {
    nom: 'Ondes', sorte: 'overlay', reglages: { vitesse: .5, taille: .5 },
    rendu(px, r) { const d = Math.hypot((px.gx - .5) * 1.78, px.gy - .5), f = 4 + 16 * (1 - r.taille), v = .5 + .5 * S(d * f * PI2 / 4 - px.pb * (.5 + 2.5 * r.vitesse)); px.k = v; px.b = .35 + .65 * v; },
  },
  pluie: {
    nom: 'Pluie', sorte: 'overlay', reglages: { vitesse: .5, densite: .5 },
    rendu(px, r) {
      const col = Math.floor(px.gx * 60), dec = H(col) * 7, vit = .6 + H(col + 99) * .8;
      const y = fr(px.gy + px.pb * (.1 + .5 * r.vitesse) * vit + dec), g = fr(y * (2 + 6 * r.densite)), goutte = g > .82 ? Math.pow((g - .82) / .18, 2) : 0;
      px.k = goutte; px.b = .2 + .8 * goutte;
    },
  },
  grain: {
    nom: 'Grain', sorte: 'overlay', reglages: { vitesse: .5, taille: .5 },
    rendu(px, r) { const z = 3 + 30 * (1 - r.taille), v = LT.bruit2(px.gx * z * 1.78, px.gy * z + px.pb * (.1 + r.vitesse), 5); px.k = v; px.b = .4 + .6 * v; },
  },
  degrade: {
    nom: 'Dégradé', sorte: 'overlay', choix: { sens: SENS }, reglages: { sens: 'haut', defile: .3 },
    rendu(px, r) { const x = fr(pos(px, r.sens) - px.pb * r.defile * .25); px.k = x; px.b = .25 + .75 * x; },
  },
  respire: {
    nom: 'Respiration', sorte: 'overlay', choix: { duree: DUREE }, reglages: { duree: 4, profondeur: .7 },
    rendu(px, r) { const v = .5 - .5 * Math.cos(fr(px.pb / r.duree) * PI2); px.b = 1 - r.profondeur * (1 - v); px.k = v * .5; },
  },
  pulsation: {
    nom: 'Pulsation au tempo', sorte: 'overlay', choix: { div: DIV }, reglages: { div: 1, chute: .5, largeur: .5 },
    rendu(px, r) {
      const e = Math.exp(-fr(px.pb * r.div) * (2 + 10 * r.chute)), d = Math.abs(px.v - .5) * 2, w = .15 + .85 * r.largeur * (.4 + .6 * e);
      const a = d < w ? 1 - d / w : 0; px.k = a * e; px.b = .1 + .9 * a * (.3 + .7 * e);
    },
  },

  // ===================== MOUVEMENTS (masques) =====================
  strobo: {
    nom: 'Stroboscope', sorte: 'mouvement', choix: { div: DIV }, reglages: { div: 2, allume: .35 },
    rendu(px, r) { px.a = fr(px.tb * r.div) < r.allume ? 1 : 0; },
  },
  sunrise: {
    nom: 'Sunrise', sorte: 'mouvement', choix: { sens: SENS }, reglages: { sens: 'haut', montee: .5, adoucir: .15 },
    rendu(px, r) { const f = r.montee > 0 ? Math.min(1, px.p / r.montee) : 1; px.a = bord(pos(px, r.sens) - f * (1 + r.adoucir), r.adoucir + .001); },
  },
  balayage: {
    nom: 'Balayage', sorte: 'mouvement', choix: { sens: SENS, duree: DUREE }, reglages: { sens: 'haut', duree: 1, largeur: .25 },
    rendu(px, r) { const c = fr(px.tb / r.duree), d = Math.abs(pos(px, r.sens) - c), w = .02 + r.largeur; px.a = bord(Math.min(d, 1 - d), w); },
  },
  scanner: {
    nom: 'Scanner', sorte: 'mouvement', choix: { duree: DUREE }, reglages: { duree: 1, trainee: .5 },
    rendu(px, r) {
      const ph = fr(px.tb / (2 * r.duree)) * 2, tete = ph < 1 ? ph : 2 - ph, ici = (px.zi + .5) / px.nz;   // un aller = « durée »
      const d = Math.abs(tete - ici), w = .5 / px.nz, derriere = ph < 1 ? tete > ici : tete < ici;
      px.a = d < w ? 1 : derriere ? Math.max(0, 1 - (d - w) / (.05 + r.trainee)) * .6 : 0;
    },
  },
  points: {
    nom: 'Points', sorte: 'mouvement', choix: { sens: SENS, duree: DUREE }, reglages: { sens: 'haut', duree: 1, nombre: 4, largeur: .4 },
    rendu(px, r) { const f = fr(pos(px, r.sens) * r.nombre - px.tb / r.duree); px.a = f < r.largeur ? S(f / r.largeur * Math.PI) : 0; },
  },
  scintille: {
    nom: 'Scintillement', sorte: 'mouvement', choix: { div: DIV }, reglages: { div: 4, densite: .5, blocs: 16 },
    rendu(px, r) { const cel = Math.floor(px.v * r.blocs), pas = Math.floor(px.tb * r.div); px.a = H(cel * 13.1 + px.zi * 71.7 + pas * 3.3) < .25 + .6 * r.densite ? 1 : 0; },
  },
  codebarres: {
    nom: 'Code-barres', sorte: 'mouvement', choix: { div: DIV }, reglages: { div: 2, lignes: 24, remplissage: .5 },
    rendu(px, r) { const pas = Math.floor(px.tb * r.div), cel = Math.floor(px.v * r.lignes); px.a = H(cel * 7.7 + px.zi * 31.3 + pas * 5.1) < r.remplissage ? 1 : 0; },
  },
  projectile: {
    nom: 'Projectile', sorte: 'mouvement', choix: { depart: [['bas', 'En bas'], ['haut', 'En haut']] }, reglages: { depart: 'bas', taille: .08, eclair: .15 },
    rendu(px, r) {
      const y = r.depart === 'haut' ? px.v : 1 - px.v;
      if (px.p < r.eclair) { px.a = bord(y - .15, .1); return; }
      const c = (px.p - r.eclair) / (1 - r.eclair);
      px.a = bord(Math.abs(y - c), r.taille) + bord(c - y, .5) * .25 * (1 - c);
    },
  },
  chenillard: {
    nom: 'Chenillard', sorte: 'mouvement', choix: { div: DIV }, reglages: { div: 1 },
    rendu(px, r) { px.a = Math.floor(px.tb * r.div) % px.nz === px.zi ? 1 : 0; },   // une lumière à la fois, à chaque temps
  },
};
})(typeof self !== 'undefined' ? self : this);
