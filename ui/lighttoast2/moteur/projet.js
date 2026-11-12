// =====================================================================
// LIGHT TOAST — à quoi ressemble un projet (ce qui est enregistré en .json).
//
//  projet
//   ├ materiel        les lumières (4 tubes + le rectangle)
//   ├ palette         les couleurs du morceau
//   ├ couleur.clips   les calques de COULEUR : { id, debut, fin, couleur, zones:[ids], entree, sortie }
//   │                 (un clip peut couvrir plusieurs lumières = un groupe)
//   ├ effets[]        les pistes d'effets ; effets[0] = juste au-dessus de Couleur, la dernière = tout en haut
//   │                 clip : { id, debut, fin, effet, zones:[ids] | null (= toutes), reglages,
//   │                          mode 'masque' | 'lumiere', couleur (mode lumière), eclat (overlays), entree, sortie, force }
//   ├ peches          les types de pêche + les pêches posées { id, t, type }
//   ├ courbes         lum (générale), elum (force des effets), plum (pêches), vitesse
//   ├ bpm, grille     le tempo et l'endroit du 1er temps (secondes)
//   ├ decompte        le décompte avant le début
//   ├ musique         le morceau choisi (+ le passage de reel choisi)
//   ├ stems[]         { id, nom, couleur, sens, ecart, muet, cands [[t, force]], volume (50/s, 0-100) }
//   └ declencheurs[]  « ce stem fait ça » : zones posées sur la ligne d'un stem (voir moteur/declencheurs.js)
// =====================================================================
(function (G) {
const LT = G.LT;
LT.projet = {
  VERSION: 1,
  nouveau(nom = 'Sans titre') {
    const m = LT.materiel.defaut(), pal = ['#ff7a1a', '#7a3cff', '#18c4b4', '#ffffff'];
    return {
      format: 'lighttoast', version: this.VERSION, nom, duree: 0, bpm: 120, grille: 0,
      materiel: m, palette: pal,
      // au départ : toutes les lumières ont une couleur, sur tout le morceau (allongée quand on charge la musique)
      couleur: { clips: [{ id: LT.id(), debut: 0, fin: 60, couleur: pal[0], zones: m.zones.map(z => z.id), entree: 0, sortie: 0 }] },
      effets: [{ id: LT.id(), nom: 'Effets 1', clips: [] }],
      peches: {
        types: [
          { id: 'p1', nom: 'Flash blanc', eclair: '#ffffff', flash: '#ffffff', ed: 30, fd: 250, h: 1, ancre: 'b', zones: null },
          { id: 'p2', nom: 'Flash couleur', eclair: '#ffffff', flash: '#ff7a1a', ed: 20, fd: 400, h: 1, ancre: 'b', zones: null },
        ],
        clips: [],
      },
      courbes: { lum: [], elum: [], plum: [], vitesse: [] },
      decompte: LT.decompte.defaut(),
      musique: null,
      stems: [], declencheurs: [],
    };
  },
  nouvelEffet(effet, debut, fin, P) {
    return { id: LT.id(), debut, fin, effet, zones: null, reglages: {}, mode: 'masque', couleur: (P && P.palette[3]) || '#ffffff', eclat: .35, entree: 0, sortie: 0, force: 1 };
  },
  // un projet de démonstration (pour les essais)
demo() {
    const p = this.nouveau('Démo'), Z = ['t1', 't2', 't3', 't4'], cc = p.couleur.clips, E = (e, d, f, x = {}) => Object.assign(this.nouvelEffet(e, d, f, p), x);
    p.duree = 20; p.bpm = 120;
    cc.length = 0;
    cc.push({ id: LT.id(), debut: 0, fin: 8, couleur: '#ff7a1a', zones: ['t1', 't2'], entree: 0, sortie: 0 },
      { id: LT.id(), debut: 0, fin: 8, couleur: '#18c4b4', zones: ['t3', 't4'], entree: 0, sortie: 0 },
      { id: LT.id(), debut: 0, fin: 20, couleur: '#ffd9a0', zones: ['p1'], entree: 0, sortie: 0 },
      { id: LT.id(), debut: 8, fin: 20, couleur: '#7a3cff', zones: ['t1', 't3', 't4'], entree: .5, sortie: 0 },
      { id: LT.id(), debut: 8, fin: 20, couleur: '#ff2a2a', zones: ['t2'], entree: .5, sortie: 0 });
    p.effets[0].clips.push(E('plasma', 0, 8), E('flamme', 8, 20, { zones: ['t2'] }), E('sunrise', 14, 16));
    p.effets.push({ id: LT.id(), nom: 'Effets 2', clips: [E('strobo', 4, 6, { zones: ['t1', 't2', 't3', 't4'] }), E('scanner', 10, 13, { zones: ['t1', 't2', 't3', 't4'] })] });
    for (let t = .5; t < 20; t += 2) p.peches.clips.push({ id: LT.id(), t, type: t % 4 < 2 ? 'p1' : 'p2' });
    return p;
  },
};
})(typeof self !== 'undefined' ? self : this);
