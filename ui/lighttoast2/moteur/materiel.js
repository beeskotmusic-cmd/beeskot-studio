// =====================================================================
// LIGHT TOAST — le matériel : où sont les lumières dans la vidéo exportée.
// x, y, l (largeur), h (hauteur) : en part de l'image (0 à 1).
// cols × rangs : la finesse du calcul dans chaque zone (plus = plus fin, plus lent).
// Pour changer le matériel : écran « Matériel » (ou ici, les valeurs par défaut).
// =====================================================================
(function (G) {
const LT = G.LT;
LT.materiel = {
  defaut() {
    // 5 bandes dans la vidéo, de gauche à droite (places reprises de l'ancien masque Light Toast) :
    //   1 et 2 = tubes de gauche · 3 = le panneau LED du plafond · 4 et 5 = tubes de droite (numéros de Pierre, 12 nov. 2026)
    // Les identifiants (t1…t4, p1) ne changent pas : les projets déjà faits restent bons.
    const X = [.0316, .2430, .4617, .6801, .8934], Y = [.0145, .0167, .0130, .0100, .0011];
    const B = [['t1', 'Tube 1', 'tube'], ['t2', 'Tube 2', 'tube'], ['p1', 'Panneau (3)', 'rect'], ['t3', 'Tube 4', 'tube'], ['t4', 'Tube 5', 'tube']];
    const zones = B.map(([id, nom, forme], i) => ({ id, nom, forme, x: X[i], y: Y[i], l: .0806, h: .972, cols: forme === 'rect' ? 16 : 4, rangs: 96 }));
    return { v: 2, largeur: 1920, hauteur: 1080, zones };
  },
  // un projet fait avant le changement d'ordre (panneau en 5e) prend le nouveau matériel
  aJour(P) { if (P && (!P.materiel || (P.materiel.v || 1) < 2)) P.materiel = this.defaut(); return P; },
};
})(typeof self !== 'undefined' ? self : this);
