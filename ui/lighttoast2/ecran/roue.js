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

// ---------- la PALETTE du morceau (remplace l'ancienne roue dans l'Inspecteur) ----------
//   [█████] █ █ █ █ ◐     clic = choisir cette couleur ; double-clic (ou ◐) = modifier la palette (roue façon Adobe Color)
// LT.choixPalette(conteneur, hex, { palette, choisir(hex), modifier(fini) })
LT.choixPalette = function (cont, hex, o) {
  const el = document.createElement('div'); el.className = 'lt2-pp'; cont.appendChild(el);
  const dessiner = () => {
    const h = String(hex || '').toLowerCase();
    el.innerHTML = o.palette.map((c, i) => `<button type="button" class="lt2-pp-c${i === 0 ? ' grand' : ''}${c.toLowerCase() === h ? ' on' : ''}" data-pc="${i}" style="background:${c}" title="${i === 0 ? 'La couleur principale. ' : ''}Clic = choisir · double-clic = modifier la palette"></button>`).join('')
      + '<button type="button" class="lt2-pp-e" title="Modifier la palette (roue façon Adobe Color)">◐</button>';
    el.querySelectorAll('[data-pc]').forEach(b => {
      b.onclick = () => { hex = o.palette[+b.dataset.pc]; o.choisir && o.choisir(hex); dessiner(); };
      b.ondblclick = () => ouvrir(+b.dataset.pc);
    });
    el.querySelector('.lt2-pp-e').onclick = () => ouvrir(0);
  };
  const ouvrir = i => LT.editeurPalette(o.palette, { choisi: i, quand: fini => { dessiner(); o.modifier && o.modifier(fini); } });
  dessiner(); return el;
};

// ---------- l'éditeur de palette, comme Adobe Color : une roue avec un point par couleur + les règles ----------
const REGLES = { libre: 'Libre', analogue: 'Analogue', mono: 'Monochrome', triade: 'Triade', complementaire: 'Complémentaire', compose: 'Composée', carre: 'Carré' };
const suivre = (regle, h, s, v, n) => {   // les couleurs 2…n à partir de la principale (h, s, v)
  const t = (d, ss = s, vv = v) => [((h + d) % 360 + 360) % 360, Math.max(0, Math.min(1, ss)), Math.max(0, Math.min(1, vv))], r = [];
  for (let i = 1; i < n; i++) {
    if (regle === 'analogue') r.push(t([-30, 30, -60, 60, -15, 15][(i - 1) % 6]));
    if (regle === 'mono') r.push(t(0, [s * .45, s, s * .2, s * .7, s][(i - 1) % 5], [v, v * .55, v, v * .8, v * .3][(i - 1) % 5]));
    if (regle === 'triade') r.push(t([120, 240, 0, 120, 240][(i - 1) % 5], i > 2 ? s * .55 : s, i > 2 ? Math.min(1, v * 1.1) : v));
    if (regle === 'complementaire') r.push(t([180, 0, 180, 0, 180][(i - 1) % 5], i > 1 ? s * .5 : s, i > 2 ? v * .6 : v));
    if (regle === 'compose') r.push(t([150, 210, 0, 150, 210][(i - 1) % 5], i > 2 ? s * .55 : s, v));
    if (regle === 'carre') r.push(t([90, 180, 270, 0, 90][(i - 1) % 5], i > 3 ? s * .5 : s, v));
  }
  return r;
};
LT.editeurPalette = function (pal, o = {}) {
  document.querySelectorAll('.lt2-ep').forEach(x => x.remove());
  const T = 130, fond = document.createElement('div'); fond.className = 'lt2-ep';
  fond.innerHTML = `<div class="lt2-ep-b"><div class="lt2-ep-t">Palette du morceau<button type="button" data-x title="Fermer">✕</button></div>
    <div class="lt2-ep-m"><div class="lt2-ep-r"><canvas width="${T * 2}" height="${T * 2}"></canvas><div class="lt2-ep-pts"></div></div>
      <div class="lt2-ep-d"><div class="lt2-ep-cols"></div><label class="lt2-ep-v">Luminosité <input type="range" min="0" max="1" step="0.005" data-v></label>
      <div class="lt2-ep-n"><button type="button" data-n="-" title="Une couleur de moins">−</button><button type="button" data-n="+" title="Une couleur de plus">+</button></div></div></div>
    <div class="lt2-ep-reg">${Object.entries(REGLES).map(([k, n]) => `<button type="button" data-r="${k}">${n}</button>`).join('')}</div>
    <p class="lt2-ep-a">Glisse les points sur la roue. La 1re couleur (gros point) est la principale : avec une règle, les autres la suivent.</p></div>`;
  document.body.appendChild(fond);
  const cv = fond.querySelector('canvas'), cx = cv.getContext('2d'), pts = fond.querySelector('.lt2-ep-pts'), cols = fond.querySelector('.lt2-ep-cols'), vv = fond.querySelector('[data-v]');
  let choisi = Math.min(o.choisi || 0, pal.length - 1), regle = o.regle || 'libre';
  const hsv = () => pal.map(h => C.hsv(C.rgb(h)));
  const roue = val => { const img = cx.createImageData(T * 2, T * 2), d = img.data; for (let j = 0; j < T * 2; j++) for (let i = 0; i < T * 2; i++) { const dx = i - T, dy = j - T, r = Math.hypot(dx, dy); if (r > T) continue; const c = C.deHsv((Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, r / T, val), k = (j * T * 2 + i) * 4; d[k] = c[0] * 255; d[k + 1] = c[1] * 255; d[k + 2] = c[2] * 255; d[k + 3] = 255; } cx.putImageData(img, 0, 0); };
  const maj = (fini = false) => {
    const H = hsv(); roue(Math.max(.25, H[choisi][2])); vv.value = H[choisi][2];
    if (pts.children.length !== pal.length) {   // les points et la liste ne sont refaits que si le nombre de couleurs change
      pts.innerHTML = pal.map((h, i) => `<i data-p="${i}" class="${i === 0 ? 'grand' : ''}"></i>`).join('');
      cols.innerHTML = pal.map((h, i) => `<div class="lt2-ep-c" data-c="${i}"><span></span><input type="text" maxlength="7" data-hx="${i}"></div>`).join('');
      pts.querySelectorAll('[data-p]').forEach(p => p.onpointerdown = e => { e.preventDefault(); choisi = +p.dataset.p; p.setPointerCapture(e.pointerId); const r = cv.getBoundingClientRect();
        p.onpointermove = ev => { const dx = ev.clientX - r.left - T, dy = ev.clientY - r.top - T, s = Math.min(1, Math.hypot(dx, dy) / T), h = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, v = hsv()[choisi][2] || 1; poser(choisi, h, s, v); maj(); };
        p.onpointerup = () => { p.onpointermove = null; maj(true); }; maj(); });
      cols.querySelectorAll('[data-c]').forEach(d => d.onclick = e => { if (e.target.tagName !== 'INPUT') { choisi = +d.dataset.c; maj(); } });
      cols.querySelectorAll('[data-hx]').forEach(inp => { inp.onkeydown = e => e.stopPropagation(); inp.onchange = () => { const v = inp.value.trim(); if (/^#?[0-9a-f]{6}$/i.test(v)) { const [h, s, vl] = C.hsv(C.rgb(v[0] === '#' ? v : '#' + v)); choisi = +inp.dataset.hx; poser(choisi, h, s, vl); } maj(true); }; });
    }
    H.forEach(([h, s], i) => { const a = h * Math.PI / 180, p = pts.children[i]; p.style.left = (T + Math.cos(a) * s * T) + 'px'; p.style.top = (T + Math.sin(a) * s * T) + 'px'; p.style.background = pal[i]; p.classList.toggle('on', i === choisi);
      const c = cols.children[i]; c.classList.toggle('on', i === choisi); c.querySelector('span').style.background = pal[i]; const inp = c.querySelector('input'); if (document.activeElement !== inp) inp.value = pal[i]; });
    fond.querySelectorAll('[data-r]').forEach(b => b.classList.toggle('on', b.dataset.r === regle));
    o.quand && o.quand(fini);
  };
  const poser = (i, h, s, v) => {   // change la couleur i ; avec une règle, la principale entraîne les autres
    pal[i] = C.hex(C.deHsv(h, s, v));
    if (regle !== 'libre' && i === 0) suivre(regle, h, s, v, pal.length).forEach((c, j) => { pal[j + 1] = C.hex(C.deHsv(...c)); });
  };
  vv.oninput = () => { const [h, s] = hsv()[choisi]; poser(choisi, h, s, +vv.value); maj(); }; vv.onchange = () => maj(true);
  fond.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { regle = b.dataset.r; if (regle !== 'libre') { const [h, s, v] = hsv()[0]; poser(0, h, s, v); } maj(true); });
  fond.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { if (b.dataset.n === '+' && pal.length < 10) pal.push(pal[pal.length - 1]); if (b.dataset.n === '-' && pal.length > 1) { pal.pop(); choisi = Math.min(choisi, pal.length - 1); } if (regle !== 'libre') { const [h, s, v] = hsv()[0]; poser(0, h, s, v); } maj(true); });
  const fermer = () => { fond.remove(); document.removeEventListener('keydown', esc, true); o.quand && o.quand(true); };
  const esc = e => { if (e.key === 'Escape') { e.stopPropagation(); fermer(); } };
  fond.querySelector('[data-x]').onclick = fermer; fond.onpointerdown = e => { if (e.target === fond) fermer(); }; document.addEventListener('keydown', esc, true);
  maj();
};
})(typeof self !== 'undefined' ? self : this);
