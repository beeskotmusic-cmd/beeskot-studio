// =====================================================================
// LIGHT TOAST — écouter le son : forme d'onde, volume, coups (attaques).
// Calculs purs (aucun dessin) : marchent aussi en arrière-plan.
//
//   son ─▶ pics      (min / max par petit bloc → la forme d'onde)
//       ─▶ volume    (0 à 100, 50 fois par seconde → « suivre le volume »)
//       ─▶ candidats [[temps, force]]  (toutes les attaques possibles)
//                       │
//          filtrer(sensibilité, écart mini) ─▶ les coups gardés
//
// On garde dans le projet le volume et les candidats (petits), jamais le son :
// on peut donc régler la sensibilité plus tard sans recharger le stem.
// =====================================================================
(function (G) {
const LT = G.LT;
const mono = canaux => { if (canaux.length === 1) return canaux[0]; const n = canaux[0].length, o = new Float32Array(n), k = 1 / canaux.length; for (const c of canaux) for (let i = 0; i < n; i++) o[i] += c[i] * k; return o; };

LT.analyse = {
  BLOC: 128,
  // forme d'onde : min / max pour chaque bloc de 128 échantillons
  pics(canaux) {
    const x = mono(canaux), B = this.BLOC, n = Math.ceil(x.length / B), mn = new Float32Array(n), mx = new Float32Array(n);
    for (let b = 0; b < n; b++) { let a = 1, z = -1; for (let i = b * B, f = Math.min(x.length, i + B); i < f; i++) { const v = x[i]; if (v < a) a = v; if (v > z) z = v; } mn[b] = a; mx[b] = z; }
    return { min: mn, max: mx };
  },
  // volume (50 / s, 0-100) et attaques ; rend la main régulièrement pour ne jamais bloquer le PC
  async coups(canaux, sr) {
    const x = mono(canaux), HOP = 256, n = Math.floor(x.length / HOP), l = new Float32Array(n);
    for (let f = 0; f < n; f++) {
      let e = 0; const a = f * HOP;
      for (let i = a + 1; i < a + HOP; i++) { const d = x[i] - .9 * x[i - 1]; e += d * d; }   // on accentue les attaques
      l[f] = Math.log(1 + 1000 * Math.sqrt(e / HOP));
      if (f % 20000 === 0) await new Promise(r => setTimeout(r, 0));
    }
    // fonction d'attaque : ce qui monte d'un coup
    const odf = new Float32Array(n);
    for (let f = 0; f < n; f++) odf[f] = Math.max(0, l[f] - Math.max(f > 0 ? l[f - 1] : 0, f > 1 ? l[f - 2] * .98 : 0));
    let max = 1e-9; for (let f = 0; f < n; f++) if (odf[f] > max) max = odf[f];
    const cands = [];
    for (let f = 0; f < n; f++) {
      const v = odf[f]; if (v / max < .04) continue;
      let pic = true; for (let k = -3; k <= 3; k++) if (k && f + k >= 0 && f + k < n && odf[f + k] > v) { pic = false; break; }
      if (pic) cands.push([+(f * HOP / sr).toFixed(4), +(v / max).toFixed(3)]);
    }
    // volume 50 / s
    const P = Math.round(sr / 50), m = Math.floor(x.length / P), vol = new Array(m); let vmax = 1e-9;
    for (let k = 0; k < m; k++) { let e = 0; for (let i = k * P, f = i + P; i < f; i++) e += x[i] * x[i]; vol[k] = Math.sqrt(e / P); if (vol[k] > vmax) vmax = vol[k]; }
    for (let k = 0; k < m; k++) vol[k] = Math.round(vol[k] / vmax * 100);
    return { cands, volume: vol, duree: x.length / sr };
  },
  // les coups gardés : sensibilité 0-1 (plus haut = plus de coups), écart mini en ms
  filtrer(cands, sens = .5, ecartMs = 60) {
    const seuil = .02 + .6 * Math.pow(1 - sens, 1.6), ec = ecartMs / 1000, garde = [];
    const fortes = cands.filter(c => c[1] >= seuil).sort((a, b) => b[1] - a[1]);
    const pris = [];   // plus fort d'abord : un coup faible trop près d'un fort disparaît
    for (const c of fortes) if (!pris.some(t => Math.abs(t - c[0]) < ec)) { pris.push(c[0]); garde.push(c); }
    return garde.sort((a, b) => a[0] - b[0]);
  },
  // volume (0-1) d'un stem à l'instant t
  volume(stem, t) { const v = stem.volume; if (!v || !v.length) return 0; const i = t * 50, a = Math.floor(i), f = i - a; if (a < 0) return 0; if (a >= v.length - 1) return (v[v.length - 1] || 0) / 100; return (v[a] + (v[a + 1] - v[a]) * f) / 100; },
};
})(typeof self !== 'undefined' ? self : this);
