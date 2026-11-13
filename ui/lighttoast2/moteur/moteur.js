// =====================================================================
// LIGHT TOAST — le moteur : à un instant t, calcule la couleur de chaque lumière.
//
//   pour chaque lumière ─▶ calques COULEUR (ceux qui la touchent)
//                       ─▶ × courbe « lum »
//                       ─▶ effets, piste par piste, du bas vers le haut :
//                            overlay   = la couleur du dessous devient la texture (dans sa couleur)
//                            mouvement = découpe le dessous (masque) ou ajoute sa couleur (lumière)
//                            × courbe « elum » (force des effets)
//                       ─▶ déclencheurs des stems (flash, luminosité, couleur, effet à chaque coup)
//                       ─▶ + pêches × « plum »
//                       ─▶ × modulation (déclencheurs des stems, étape 5)
//
// Ne calcule QUE l'instant demandé. Chaque lumière est calculée en petit puis agrandie.
// =====================================================================
(function (G) {
const LT = G.LT, rgb = LT.couleur.rgb;
const toile = (l, h) => typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(l, h) : Object.assign(document.createElement('canvas'), { width: l, height: h });
const actif = (c, t) => c.debut <= t && t < c.fin;
// fondu d'entrée / de sortie d'un clip (0 à 1)
const enveloppe = (c, t) => {
  let a = 1; const lt = t - c.debut, rt = c.fin - t;
  if (c.entree > 0 && lt < c.entree) a *= lt / c.entree;
  if (c.sortie > 0 && rt < c.sortie) a *= rt / c.sortie;
  return a * (c.force ?? 1);
};
// calques à plusieurs couleurs (v = hauteur dans la lumière, 0 en haut, 1 en bas)
const bandes = (cs, v) => cs[Math.min(cs.length - 1, Math.floor(v * cs.length))];
const degrade = (cs, v) => { const x = v * (cs.length - 1), i = Math.min(cs.length - 2, Math.floor(x)), f = x - i, a = cs[i], b = cs[i + 1]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; };
const ecran = (o, i, r, g, b) => { o[i] = 1 - (1 - o[i]) * (1 - r); o[i + 1] = 1 - (1 - o[i + 1]) * (1 - g); o[i + 2] = 1 - (1 - o[i + 2]) * (1 - b); };

class Moteur {
  constructor(projet) { this.fps = 60; this.modulation = null; this.charger(projet); }
  charger(projet) {
    this.projet = projet;
    this.zones = projet.materiel.zones.map(z => {
      const cv = toile(z.cols, z.rangs);
      return { z, cv, cx: cv.getContext('2d'), img: new ImageData(z.cols, z.rangs), buf: new Float32Array(z.cols * z.rangs * 3) };
    });
  }

  // ---- ce qui joue à l'instant t (préparé une fois par image, pas par point) ----
  preparer(t) {
    const P = this.projet, ids = P.materiel.zones.map(z => z.id);
    const couleurs = P.couleur.clips.filter(c => actif(c, t)).sort((a, b) => a.debut - b.debut).map(c => {
      const o = { c, col: rgb(c.couleur), a: enveloppe(c, t) }, cs = c.sorte && c.couleurs && c.couleurs.length > 1 ? c.couleurs.map(rgb) : null;
      if (cs) {
        if (c.sorte === 'degrade') o.f = v => degrade(cs, v);   // dégradé dans la hauteur
        else o.f = v => bandes(cs, v);                          // la lumière coupée en parts égales
      }
      return o;
    });
    const effets = [];   // du bas vers le haut
    P.effets.forEach(piste => !piste.muet && piste.clips.forEach(c => {
      if (!actif(c, t)) return; const def = LT.effets[c.effet]; if (!def) return;
      const zs = c.zones ? ids.filter(i => c.zones.includes(i)) : ids;
      effets.push({ c, def, zs, r: Object.assign({}, def.reglages, c.reglages), col: rgb(c.couleur || '#ffffff'), a: enveloppe(c, t), eclat: c.eclat ?? .35 });
    }));
    const types = {}; P.peches.types.forEach(y => types[y.id] = y);
    const peches = [], img = 1 / this.fps;
    P.peches.clips.forEach(pc => {
      const y = types[pc.type], lt = t - pc.t; if (!y || lt < 0) return;
      const ed = Math.max(y.ed / 1000, img), fd = y.fd / 1000;   // un éclair plus court qu'une image occupe une image
      if (lt < ed) peches.push({ y, col: rgb(y.eclair), a: 1 });
      else if (lt < ed + fd) { const f = 1 - (lt - ed) / fd; peches.push({ y, col: rgb(y.flash), a: f * f }); }
    });
    const C = P.courbes, bps = (P.bpm || 120) / 60;
    const decl = [];
    (P.declencheurs || []).forEach(k => {
      if (k.muet) return; const st = P.stems.find(x => x.id === k.stem); if (!st || st.muet) return;
      const e = LT.declencheurs.etat(k, st, t, bps); if (!e) return;
      const zs = k.zones ? ids.filter(i => k.zones.includes(i)) : ids, d = { k, e, zs, col: rgb(k.couleur || '#ffffff') };
      if (k.action === 'couleur') { const cs = (k.couleurs && k.couleurs.length ? k.couleurs : ['#ffffff']).map(rgb);
        if (e.vol) { const a = cs[0], b = cs[1] || a; d.cible = [a[0] + (b[0] - a[0]) * e.env, a[1] + (b[1] - a[1]) * e.env, a[2] + (b[2] - a[2]) * e.env]; d.e = { env: 1 }; }
        else { d.cible = cs[((e.n % cs.length) + cs.length) % cs.length]; d.e = { env: e.n < 0 ? 0 : 1 }; } }
      if (k.action === 'effet') { d.def = LT.effets[k.effet]; const dur = (k.duree || 1) / bps; if (!d.def || e.vol || e.lt > dur) return; d.p = e.lt / dur; d.tb = e.lt * bps; }
      decl.push(d);
    });
    return { couleurs, effets, peches, bps, decl, lum: LT.courbe(C.lum, t, 1), elum: LT.courbe(C.elum, t, 1), plum: LT.courbe(C.plum, t, 1), pb: (LT.phase(C.vitesse, t) - (P.grille || 0)) * bps };
  }

  // ---- calcule toutes les lumières à l'instant t ----
  rendre(t) {
    const P = this.projet, dc = LT.decompte && LT.decompte.lampes(P, t);
    if (dc) return this.rendreDecompte(dc);
    const S = this.preparer(t), px = { t, pb: S.pb, bpm: P.bpm };
    for (let zr = 0; zr < this.zones.length; zr++) {
      const Z = this.zones[zr], z = Z.z, o = Z.buf, d = Z.img.data;
      const cols = S.couleurs.filter(c => c.c.zones.includes(z.id));
      const eff = S.effets.filter(e => e.zs.includes(z.id)).map(e => ({ e, zi: e.zs.indexOf(z.id), nz: e.zs.length, tb: (t - e.c.debut) * S.bps, p: (t - e.c.debut) / ((e.c.fin - e.c.debut) || 1), a: e.a * S.elum }));
      const pec = S.peches.filter(p => !p.y.zones || p.y.zones.includes(z.id));
      const dec = S.decl.filter(d => d.zs.includes(z.id)).map(d => Object.assign({ zi: d.zs.indexOf(z.id), nz: d.zs.length }, d));
      const mod = this.modulation ? this.modulation(t, z.id) : null, mlum = (mod ? mod.lum ?? 1 : 1) * ((P.intensites || {})[z.id] ?? 1);   // × l'intensité de cette lumière (réglage du projet)
      px.zr = zr;
      for (let r = 0, i = 0, j = 0; r < z.rangs; r++) {
        const v = (r + .5) / z.rangs;
        for (let c = 0; c < z.cols; c++, i += 3, j += 4) {
          const u = (c + .5) / z.cols;
          px.u = u; px.v = v; px.gx = z.x + u * z.l; px.gy = z.y + v * z.h;
          // 1. la couleur
          let R = 0, V = 0, B = 0;
          for (const k of cols) { const q = k.f ? k.f(v) : k.col; R += (q[0] - R) * k.a; V += (q[1] - V) * k.a; B += (q[2] - B) * k.a; }
          R *= S.lum; V *= S.lum; B *= S.lum;
          // 2. les effets, du bas vers le haut
          for (const f of eff) {
            const e = f.e, a = f.a; if (a <= 0) continue;
            px.zi = f.zi; px.nz = f.nz; px.tb = f.tb; px.p = f.p;
            if (e.def.sorte === 'overlay') {
              px.k = 0; px.b = 1; e.def.rendu(px, e.r);
              const b = px.b, w = px.k * e.eclat;   // ombre → la couleur → vers le blanc
              const r2 = (R + (1 - R) * w) * b, v2 = (V + (1 - V) * w) * b, b2 = (B + (1 - B) * w) * b;
              R += (r2 - R) * a; V += (v2 - V) * a; B += (b2 - B) * a;
            } else {
              px.a = 0; e.def.rendu(px, e.r); const m = px.a;
              if (e.c.mode === 'lumiere') { const k = m * a; if (k > 0) { R = 1 - (1 - R) * (1 - e.col[0] * k); V = 1 - (1 - V) * (1 - e.col[1] * k); B = 1 - (1 - B) * (1 - e.col[2] * k); } }
              else { const k = 1 - a + a * m; R *= k; V *= k; B *= k; }
            }
          }
          // 3. les déclencheurs des stems
          for (const d of dec) {
            const f = (d.k.force ?? 1), env = d.e.env, a = d.k.action;
            if (a === 'flash') { const q = env * f; if (q > 0) { R = 1 - (1 - R) * (1 - d.col[0] * q); V = 1 - (1 - V) * (1 - d.col[1] * q); B = 1 - (1 - B) * (1 - d.col[2] * q); } }
            else if (a === 'plus') { const q = 1 - f + f * env; R *= q; V *= q; B *= q; }
            else if (a === 'moins') { const q = 1 - f * env; R *= q; V *= q; B *= q; }
            else if (a === 'couleur') { const l = Math.max(R, V, B), q = f * env, c2 = d.cible; R += (c2[0] * l - R) * q; V += (c2[1] * l - V) * q; B += (c2[2] * l - B) * q; }
            else if (a === 'effet') {
              px.zi = d.zi; px.nz = d.nz; px.tb = d.tb; px.p = d.p; px.a = 0; d.def.rendu(px, d.def.reglages); const m = px.a * f;
              if (d.k.effetMode === 'masque') { const q = 1 - f + f * px.a; R *= q; V *= q; B *= q; }
              else if (m > 0) { R = 1 - (1 - R) * (1 - d.col[0] * m); V = 1 - (1 - V) * (1 - d.col[1] * m); B = 1 - (1 - B) * (1 - d.col[2] * m); }
            }
          }
          o[i] = R; o[i + 1] = V; o[i + 2] = B;
          // 4. les pêches : la hauteur éclairée part du bas, du milieu ou du haut, avec un bord doux
          for (const p of pec) {
            const y = p.y, h = y.h ?? 1, dist = y.ancre === 't' ? v - h : y.ancre === 'm' ? Math.abs(v - .5) * 2 - h : (1 - v) - h;
            const doux = .05 + .25 * h, m = dist <= 0 ? 1 : dist >= doux ? 0 : 1 - LT.lisse(dist / doux);
            const a = p.a * m * S.plum; if (a > 0) ecran(o, i, p.col[0] * a, p.col[1] * a, p.col[2] * a);
          }
          d[j] = o[i] * mlum * 255; d[j + 1] = o[i + 1] * mlum * 255; d[j + 2] = o[i + 2] * mlum * 255; d[j + 3] = 255;
        }
      }
      Z.cx.putImageData(Z.img, 0, 0);
    }
    return this;
  }

  // ---- pendant le décompte : seulement les lampes ----
  rendreDecompte(forces) {
    const c = LT.couleur.rgb(this.projet.decompte.couleur);
    const I = this.projet.intensites || {}; this.zones.forEach((Z, i) => { const d = Z.img.data, a = (forces[i] || 0) * (I[Z.z.id] ?? 1); for (let j = 0; j < d.length; j += 4) { d[j] = c[0] * a * 255; d[j + 1] = c[1] * a * 255; d[j + 2] = c[2] * a * 255; d[j + 3] = 255; } Z.cx.putImageData(Z.img, 0, 0); });
    return this;
  }

  // ---- dessine l'image finale (la vidéo pour les LED) ----
  // options.mur = aperçu : mur gris percé des fenêtres (jamais dans l'export)
  dessiner(ctx, l, h, options = {}) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, l, h);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    for (const Z of this.zones) { const z = Z.z; ctx.drawImage(Z.cv, z.x * l, z.y * h, z.l * l, z.h * h); }
    if (options.mur) {
      ctx.beginPath(); ctx.rect(0, 0, l, h);
      for (const Z of this.zones) { const z = Z.z; ctx.rect(z.x * l, z.y * h, z.l * l, z.h * h); }
      ctx.fillStyle = '#2d2d2d'; ctx.fill('evenodd');
    }
    return this;
  }
}
LT.Moteur = Moteur;
})(typeof self !== 'undefined' ? self : this);
