// =====================================================================
// LIGHT TOAST — le DÉCOMPTE avant le début (du morceau, ou du passage de reel choisi).
//
//   coups :   1      2      3      4 (dernier)
//   cumul :   ●      ●●     ●●●    (noir) → ça part
//   avance :  ●       ●       ●    (noir)
//
// projet.decompte = { actif, coups (4), lampes 'cumul' | 'avance' | 'aucune', couleur, son (clic dans la vidéo) }
// Le tempo est celui du projet (projet.bpm).
// =====================================================================
(function (G) {
const LT = G.LT;
LT.decompte = {
  defaut() { return { actif: false, coups: 4, lampes: 'cumul', couleur: '#ffffff', son: true }; },
  // le début du décompte et le début de la musique
  fenetre(P) {
    const d = P.decompte, debut = (P.musique && P.musique.passage && P.musique.passage.debut) || 0;
    if (!d || !d.actif) return null;
    const temps = 60 / (P.bpm || 120);
    return { debut: debut - d.coups * temps, fin: debut, temps, coups: d.coups };
  },
  // à l'instant t : quelles zones sont allumées et à quelle force (null = pas dans le décompte)
  // rend un tableau : force (0-1) pour chaque zone
  lampes(P, t) {
    const f = this.fenetre(P); if (!f || t < f.debut || t >= f.fin) return null;
    const nz = P.materiel.zones.length, out = new Array(nz).fill(0), d = P.decompte;
    const i = Math.floor((t - f.debut) / f.temps), frac = (t - f.debut) / f.temps - i;
    if (i >= f.coups - 1 || d.lampes === 'aucune') return out;          // dernier coup : tout noir
    const a = frac < .5 ? 1 : Math.max(0, 1 - (frac - .5) / .4);          // allumé, puis s'éteint avant le coup suivant
    const k = i % nz;
    if (d.lampes === 'avance') out[k] = a;
    else for (let z = 0; z <= k; z++) out[z] = a;
    return out;
  },
};
})(typeof self !== 'undefined' ? self : this);
