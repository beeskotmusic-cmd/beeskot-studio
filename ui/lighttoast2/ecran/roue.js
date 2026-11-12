// =====================================================================
// LIGHT TOAST — la ROUE CHROMATIQUE + les couleurs qui vont ensemble.
//
//   ( roue : teinte tout autour, plus pâle au centre )   Luminosité ▬▬▬○──
//   #ff7a1a
//   Complémentaire ● ●        Triade ● ● ●        Analogue ● ● ● …
//   Palette du morceau ● ● ● ● +
//
// LT.roue(conteneur, hex, { quand(hex, fini), palette, ajouterPalette })
//   quand(hex, false) pendant qu'on glisse, quand(hex, true) quand on lâche.
// =====================================================================
(function (G) {
const LT = G.LT, C = LT.couleur;
const NOMS = { complementaire: 'Complémentaire', complementaires_proches: 'Contraires proches', triade: 'Triade', analogue: 'Analogue', carre: 'Carré', nuances: 'Nuances' };
const pastille = (h, titre = '') => `<button type="button" class="lt2-pas" data-h="${h}" style="background:${h}" title="${titre || h}"></button>`;

LT.roue = function (cont, hex, o = {}) {
  const T = 140, el = document.createElement('div'); el.className = 'lt2-roue';
  el.innerHTML = `<div class="lt2-roue-h"><canvas width="${T * 2}" height="${T * 2}"></canvas><div class="lt2-roue-v"><input type="range" min="0" max="1" step="0.005" title="Luminosité"></div></div>
    <div class="lt2-roue-l"><span class="lt2-roue-ech"></span><input type="text" class="lt2-hex" maxlength="7"><button type="button" class="lt2-tb lt2-pip" title="Prendre une couleur à l'écran">Pipette</button></div>
    <div class="lt2-harmo"></div>`;
  cont.appendChild(el);
  const cv = el.querySelector('canvas'), x = cv.getContext('2d'), v = el.querySelector('input[type=range]'), hx = el.querySelector('.lt2-hex'), ech = el.querySelector('.lt2-roue-ech');
  let [h, s, val] = C.hsv(C.rgb(hex));

  // la roue (dessinée une fois par luminosité)
  const dessiner = () => {
    const R = T, img = x.createImageData(T * 2, T * 2), d = img.data;
    for (let j = 0; j < T * 2; j++) for (let i = 0; i < T * 2; i++) {
      const dx = i - R, dy = j - R, r = Math.hypot(dx, dy), k = (j * T * 2 + i) * 4; if (r > R) continue;
      const c = C.deHsv((Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, r / R, val);
      d[k] = c[0] * 255; d[k + 1] = c[1] * 255; d[k + 2] = c[2] * 255; d[k + 3] = r > R - 1 ? (R - r) * 255 : 255;
    }
    x.putImageData(img, 0, 0);
    const a = h * Math.PI / 180, px = R + Math.cos(a) * s * R, py = R + Math.sin(a) * s * R;
    x.lineWidth = 4; x.strokeStyle = val > .5 ? '#000' : '#fff'; x.beginPath(); x.arc(px, py, 10, 0, 7); x.stroke();
  };
  const actuel = () => C.hex(C.deHsv(h, s, val));
  const harmonies = () => {
    const H = C.harmonies(actuel());
    el.querySelector('.lt2-harmo').innerHTML = Object.entries(H).map(([k, l]) => `<div class="lt2-hl"><span>${NOMS[k]}</span><i>${l.map(c => pastille(c)).join('')}</i></div>`).join('') +
      (o.palette ? `<div class="lt2-hl"><span>Palette</span><i>${o.palette.map(c => pastille(c)).join('')}<button type="button" class="lt2-tb" data-plus title="Ajouter cette couleur à la palette">+</button></i></div>` : '');
  };
  const maj = (fini, sansHarmo) => { const c = actuel(); hx.value = c; ech.style.background = c; v.value = val; dessiner(); if (!sansHarmo) harmonies(); o.quand && o.quand(c, fini); };
  const prendre = (c, fini) => { [h, s, val] = C.hsv(C.rgb(c)); maj(fini); };

  cv.onpointerdown = e => {
    cv.setPointerCapture(e.pointerId);
    const go = ev => { const r = cv.getBoundingClientRect(), k = T * 2 / r.width, dx = (ev.clientX - r.left) * k - T, dy = (ev.clientY - r.top) * k - T;
      h = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360; s = Math.min(1, Math.hypot(dx, dy) / T); if (val < .05) val = 1; maj(false, true); };
    go(e); cv.onpointermove = go; cv.onpointerup = () => { cv.onpointermove = null; maj(true); };
  };
  v.oninput = () => { val = +v.value; maj(false, true); };
  v.onchange = () => maj(true);
  hx.onchange = () => { if (/^#?[0-9a-f]{6}$/i.test(hx.value.trim())) prendre('#' + hx.value.trim().replace('#', ''), true); else hx.value = actuel(); };
  el.querySelector('.lt2-pip').onclick = async () => { if (!window.EyeDropper) return alert('La pipette marche dans Chrome / Edge.'); try { const r = await new EyeDropper().open(); prendre(r.sRGBHex, true); } catch (e) {} };
  el.querySelector('.lt2-harmo').onclick = e => {
    if (e.target.closest('[data-plus]')) { o.ajouterPalette && o.ajouterPalette(actuel()); return; }
    const b = e.target.closest('[data-h]'); if (b) prendre(b.dataset.h, true);
  };
  hx.value = actuel(); ech.style.background = actuel(); v.value = val; dessiner(); harmonies();
  return { el, regler: c => { [h, s, val] = C.hsv(C.rgb(c)); hx.value = actuel(); ech.style.background = actuel(); v.value = val; dessiner(); harmonies(); }, palette: p => { o.palette = p; harmonies(); } };
};
LT.pastille = pastille;
})(typeof self !== 'undefined' ? self : this);
