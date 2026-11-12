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
    // les 4 tubes LED (positions dans la vidéo reprises de l'ancien masque Light Toast)
    const X = [.0316, .2430, .4617, .6801], Y = [.0145, .0167, .0130, .0100];
    const zones = X.map((x, i) => ({ id: 't' + (i + 1), nom: 'Tube ' + (i + 1), forme: 'tube', x, y: Y[i], l: .0806, h: .972, cols: 4, rangs: 96 }));
    // le panneau LED au plafond (n° 5 sur le plan) : place dans la vidéo reprise de l'ancien masque
    zones.push({ id: 'p1', nom: 'Panneau', forme: 'rect', x: .8934, y: .0011, l: .0806, h: .972, cols: 16, rangs: 96 });
    return { largeur: 1920, hauteur: 1080, zones };
  },
};
})(typeof self !== 'undefined' ? self : this);
