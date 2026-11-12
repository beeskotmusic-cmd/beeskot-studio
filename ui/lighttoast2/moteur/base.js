// =====================================================================
// LIGHT TOAST — le moteur, partie 1 : les petits outils communs
// (couleurs, bruit, courbes). Aucun dessin à l'écran ici.
// Tous les fichiers du moteur s'accrochent à « LT » : ils marchent dans la page
// ET dans un travailleur en arrière-plan (pour l'export, sans bloquer le PC).
// =====================================================================
(function (G) {
const LT = G.LT = G.LT || {};

// ---------- couleurs : une couleur = [r, g, b] entre 0 et 1 ----------
const C = LT.couleur = {
  rgb(hex) {
    let h = String(hex || '#000').replace('#', '');
    if (h.length === 3) h = h.replace(/./g, x => x + x);
    const n = parseInt(h.slice(0, 6), 16) || 0;
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  },
  hex(c) { return '#' + c.map(v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join(''); },
  // teinte (0-360), saturation et valeur (0-1)
  hsv(c) {
    const [r, g, b] = c, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx];
  },
  deHsv(h, s, v) {
    const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
    return [f(5), f(3), f(1)];
  },
  // les couleurs qui vont ensemble (comme la roue d'Adobe Color)
  harmonies(hex) {
    const [h, s, v] = C.hsv(C.rgb(hex)), t = d => C.hex(C.deHsv((h + d + 360) % 360, s, v));
    return {
      complementaire: [hex, t(180)],
      analogue: [t(-30), hex, t(30)],
      triade: [hex, t(120), t(240)],
      complementaires_proches: [hex, t(150), t(210)],
      carre: [hex, t(90), t(180), t(270)],
      nuances: [C.hex(C.deHsv(h, s, v * .35)), C.hex(C.deHsv(h, s, v * .65)), hex, C.hex(C.deHsv(h, s * .55, Math.min(1, v * 1.1))), C.hex(C.deHsv(h, s * .25, 1))],
    };
  },
};

// ---------- bruit : du hasard qui donne TOUJOURS le même résultat (l'export = l'aperçu) ----------
const hash = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
const lisse = x => x * x * (3 - 2 * x);
LT.hasard = hash;
LT.bruit = (x, graine = 0) => { const i = Math.floor(x), f = x - i; const a = hash(i + graine * 57), b = hash(i + 1 + graine * 57); return a + (b - a) * lisse(f); };
LT.bruit2 = (x, y, graine = 0) => {
  const i = Math.floor(x), j = Math.floor(y), fx = lisse(x - i), fy = lisse(y - j), k = graine * 113;
  const a = hash(i + j * 57 + k), b = hash(i + 1 + j * 57 + k), c = hash(i + (j + 1) * 57 + k), d = hash(i + 1 + (j + 1) * 57 + k);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
};
LT.lisse = lisse;
LT.borne = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;

// ---------- courbes (losanges sur la timeline) : [{t, v, forme}] triés par t ----------
// forme du passage vers le point suivant : 'lin' (droit), 'lisse' (arrondi), 'palier' (saut)
LT.courbe = function (pts, t, defaut = 1) {
  if (!pts || !pts.length) return defaut;
  if (t <= pts[0].t) return pts[0].v;
  const n = pts.length; if (t >= pts[n - 1].t) return pts[n - 1].v;
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m].t <= t) lo = m; else hi = m; }
  const a = pts[lo], b = pts[hi], f = (t - a.t) / (b.t - a.t || 1);
  return a.forme === 'palier' ? a.v : a.v + (b.v - a.v) * (a.forme === 'lisse' ? lisse(f) : f);
};

// « phase » = le temps qui avance plus ou moins vite selon la courbe de vitesse
// (0,5 = normal, 1 = ×2, 0 = arrêté). Calculée une fois puis gardée en mémoire.
const memo = new WeakMap(), PAS = 1 / 50;
LT.phase = function (pts, t) {
  if (!pts || !pts.length) return t;
  let tab = memo.get(pts);
  if (!tab) { tab = [0]; memo.set(pts, tab); }
  const i = Math.floor(t / PAS);
  while (tab.length <= i + 1) { const k = tab.length - 1; tab.push(tab[k] + PAS * 2 * LT.courbe(pts, (k + .5) * PAS, .5)); }
  return tab[i] + (t - i * PAS) * 2 * LT.courbe(pts, t, .5);
};
LT.oublierPhase = pts => pts && memo.delete(pts);   // à appeler quand on modifie la courbe de vitesse

// petit numéro unique pour les clips
LT.id = () => Math.random().toString(36).slice(2, 9);
})(typeof self !== 'undefined' ? self : this);
