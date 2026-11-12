// =====================================================================
// LIGHT TOAST — les DÉCLENCHEURS : un stem fait réagir les lumières.
//
//   Stem kick  │   │   │   │      ← ses coups (ou son volume)
//              [⚡ Flash · 1·2·3·4 ]   ← un déclencheur = une zone posée sur la ligne du stem
//                  ↓
//   à chaque coup :  ▲╲  ▲╲  ▲╲      (la réaction retombe en « chute » temps)
//   suivre le volume : ∿∿∿∿          (la réaction suit le volume du stem)
//
// Un déclencheur agit par-dessus les effets (et sous les pêches), sur les lumières choisies.
// projet.declencheurs[] : { id, stem, debut, fin, action, mode 'coup' | 'volume', zones | null,
//   force, chute (temps), seuil (volume), suitForce, couleur, couleurs [], effet, duree (temps), effetMode }
// Ajouter une action = ajouter un bloc dans ACTIONS.
// =====================================================================
(function (G) {
const LT = G.LT;
const memo = new WeakMap();
// les coups gardés d'un stem (mémorisés tant que ses réglages ne changent pas)
const coups = st => { const k = st.sens + '|' + st.ecart, m = memo.get(st); if (m && m.k === k) return m.l; const l = LT.analyse.filtrer(st.cands || [], st.sens, st.ecart); memo.set(st, { k, l }); return l; };
// le dernier coup avant t (recherche rapide)
const dernier = (l, t) => { let lo = 0, hi = l.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (l[m][0] <= t) { r = m; lo = m + 1; } else hi = m - 1; } return r; };

LT.declencheurs = {
  ACTIONS: {
    flash: { nom: 'Flash de couleur', aide: 'Ajoute un flash de sa couleur.' },
    plus: { nom: 'Luminosité ↑', aide: 'Les lumières sont baissées, et remontent à chaque coup.' },
    moins: { nom: 'Luminosité ↓', aide: 'Les lumières baissent à chaque coup (comme un « pompage »).' },
    couleur: { nom: 'Changer de couleur', aide: 'À chaque coup : la couleur suivante de la liste. En suivant le volume : glisse de la 1re à la 2e.' },
    effet: { nom: 'Lancer un effet', aide: 'À chaque coup, un effet de mouvement démarre (sunrise, projectile…).' },
  },
  nouveau(stem, debut, fin, P) {
    return { id: LT.id(), stem, debut, fin, action: 'flash', mode: 'coup', zones: null, force: 1, chute: .5, seuil: .2, suitForce: true,
      couleur: '#ffffff', couleurs: P.palette.slice(0, 3), effet: 'sunrise', duree: 1, effetMode: 'lumiere' };
  },
  coups,
  // l'état d'un déclencheur à l'instant t : { env (0-1), n (numéro du coup), lt (secondes depuis le coup) } ou null
  etat(k, st, t, bps) {
    if (!st || t < k.debut || t >= k.fin) return null;
    if (k.mode === 'volume') { const v = LT.analyse.volume(st, t), s = k.seuil || 0; return { env: LT.borne((v - s) / (1 - s || 1)), n: 0, lt: 0, vol: true }; }
    const l = coups(st), i = dernier(l, t); if (i < 0 || l[i][0] < k.debut) return { env: 0, n: -1, lt: 1e9 };
    const lt = t - l[i][0], chute = Math.max(.02, (k.chute || .5) / bps);
    let env = Math.exp(-lt / chute * 2.5); if (k.suitForce) env *= .35 + .65 * l[i][1];
    // le numéro du coup depuis le début du déclencheur (pour faire tourner les couleurs)
    return { env, n: i - (dernier(l, k.debut - 1e-6) + 1), lt };
  },
  // « Figer en clips » : flash → pêches ; effet → clips d'effets. Rend le nombre de clips créés.
  figer(P, k, pisteLibre) {
    const st = P.stems.find(s => s.id === k.stem); if (!st) return 0;
    const l = coups(st).filter(c => c[0] >= k.debut && c[0] < k.fin), bps = (P.bpm || 120) / 60;
    if (k.action === 'flash') {
      const y = { id: LT.id(), nom: 'Flash ' + st.nom, eclair: k.couleur, flash: k.couleur, ed: 10, fd: Math.round(k.chute / bps * 1000), h: 1, ancre: 'b', zones: k.zones };
      P.peches.types.push(y); l.forEach(c => P.peches.clips.push({ id: LT.id(), t: c[0], type: y.id })); return l.length;
    }
    if (k.action === 'effet') {
      const d = k.duree / bps;
      l.forEach(c => { const e = LT.projet.nouvelEffet(k.effet, c[0], c[0] + d, P); e.zones = k.zones; e.mode = k.effetMode; e.couleur = k.couleur; pisteLibre(e.debut, e.fin).clips.push(e); });
      return l.length;
    }
    return 0;
  },
};
})(typeof self !== 'undefined' ? self : this);
