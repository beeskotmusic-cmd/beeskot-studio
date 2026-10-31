// =====================================================================
// PDF DU TOURNAGE — fabrique un vrai fichier PDF (A4) avec jsPDF (chargé seulement quand on en a besoin).
//   BK.pdfTournage({ t, reels, membres, dateFr, mode }) → { bytes, nom }   mode : 'couleur' (défaut) ou 'nb' (noir et blanc)
//   t = un reel seul ; ou un tournage entier (reels = ses reels, chacun commence sur une nouvelle page).
// Tout est dessiné à la main : les pages se coupent au bon endroit, rien n'est coupé en plein milieu d'une image.
// =====================================================================
(() => {
const L = 210, H = 297, M = 14, LARG = L - 2 * M, BAS = H - 16;
const COUL = { ROUGE: [122, 36, 48], GRIS: [95, 95, 95], NOIR: [20, 20, 20], TRAIT: [205, 200, 192], FOND: [241, 235, 224] },
  NB = { ROUGE: [25, 25, 25], GRIS: [90, 90, 90], NOIR: [15, 15, 15], TRAIT: [190, 190, 190], FOND: [232, 232, 232] };
let ROUGE, GRIS, NOIR, TRAIT, FOND;
// jsPDF (polices standard) ne sait écrire que le latin : on enlève ♪, les emojis…
const net = s => String(s ?? '').replace(/[♪♫]/g, '').replace(/ /g, ' ').replace(/[‐‑]/g, '-')
  .replace(/[^\x09\x0A\x20-\x7E\xA0-\xFF‘’“”–—…€•]/g, '').replace(/[ \t]{2,}/g, ' ').trim();

async function chargerLib() {
  if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
  await new Promise((ok, ko) => { const s = document.createElement('script'); s.src = 'js/lib/jspdf.umd.min.js'; s.onload = ok; s.onerror = () => ko(new Error('Bibliothèque PDF introuvable')); document.head.appendChild(s); });
  return window.jspdf.jsPDF;
}
// une image du Drive (ou autre) → JPEG réduit + sa forme (pour ne jamais la déformer)
const cache = new Map();
function image(ref, max = 900, gris = false) {
  if (!ref) return Promise.resolve(null);
  const cle = (gris ? 'nb:' : '') + ref;
  if (!cache.has(cle)) cache.set(cle, (async () => {
    try { const u = await BK.img.url(ref); if (!u) return null;
      const im = new Image(); im.src = u; await im.decode();
      const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)), w = Math.max(1, Math.round(im.naturalWidth * k)), h = Math.max(1, Math.round(im.naturalHeight * k));
      const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); if (gris) g.filter = 'grayscale(1)'; g.drawImage(im, 0, 0, w, h);
      return { d: c.toDataURL('image/jpeg', .82), r: w / h };
    } catch (e) { return null; } })());
  return cache.get(cle);
}
// le logo BEESKOT à plat (couleur ou noir et blanc), lu une fois
const logos = {};
async function logo(nb) { const f = nb ? 'look/logo-beeskot-nb.png' : 'look/logo-beeskot-flat.png';
  if (!logos[f]) logos[f] = (async () => { try { const b = await (await fetch(f)).blob(); const d = await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); });
    const im = new Image(); im.src = d; await im.decode(); return { d, r: im.naturalWidth / im.naturalHeight }; } catch (e) { return null; } })();
  return logos[f]; }
// ---------- l'aperçu et l'impression : on dessine nous-mêmes les pages du PDF (pdf.js, chargé à la demande) ----------
async function pdfjs() {
  if (!window.pdfjsLib) await new Promise((ok, ko) => { const s = document.createElement('script'); s.src = 'js/lib/pdfjs/pdf.min.js'; s.onload = ok; s.onerror = () => ko(new Error('Aperçu indisponible')); document.head.appendChild(s); });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/lib/pdfjs/pdf.worker.min.js'; return window.pdfjsLib; }
// dessine chaque page dans « zone » (largeur de la zone) ; renvoie le nombre de pages
BK.pdfApercu = async (bytes, zone, largeur) => {
  const lib = await pdfjs(), doc = await lib.getDocument({ data: bytes.slice() }).promise; zone.innerHTML = '';
  for (let i = 1; i <= doc.numPages; i++) { const pg = await doc.getPage(i), v0 = pg.getViewport({ scale: 1 }), k = (largeur || zone.clientWidth || 800) / v0.width, v = pg.getViewport({ scale: k * (window.devicePixelRatio || 1) });
    const c = document.createElement('canvas'); c.width = v.width; c.height = v.height; c.className = 'pdf-page'; c.style.width = (v.width / (window.devicePixelRatio || 1)) + 'px';
    zone.appendChild(c); await pg.render({ canvasContext: c.getContext('2d'), viewport: v }).promise; }
  return doc.numPages; };
// imprimer : les pages en images A4, sans marge, puis la boîte d'impression (rien ne bouge : c'est exactement le PDF)
BK.pdfImprimer = async bytes => {
  const lib = await pdfjs(), doc = await lib.getDocument({ data: bytes.slice() }).promise, d = document.createElement('div'); d.id = 'impressionPdf';
  for (let i = 1; i <= doc.numPages; i++) { const pg = await doc.getPage(i), v = pg.getViewport({ scale: 2.2 }), c = document.createElement('canvas'); c.width = v.width; c.height = v.height;
    await pg.render({ canvasContext: c.getContext('2d'), viewport: v }).promise; const im = new Image(); im.src = c.toDataURL('image/jpeg', .92); d.appendChild(im); }
  document.body.appendChild(d); document.body.classList.add('imprime-pdf');
  await Promise.all([...d.querySelectorAll('img')].map(i => i.decode().catch(() => {})));
  const fin = () => { document.body.classList.remove('imprime-pdf'); d.remove(); window.removeEventListener('afterprint', fin); };
  window.addEventListener('afterprint', fin); setTimeout(() => window.print(), 100); };

const reelsRefs = x => [...(x.moodboard || []), ...Object.values(x.tenuesPhotos || {}).flat(), ...(x.plans || []).flatMap(p => p.imgs || [])];

BK.pdfTournage = async function ({ t, reels, membres, dateFr, mode }) {
  const nb = mode === 'nb'; ({ ROUGE, GRIS, NOIR, TRAIT, FOND } = nb ? NB : COUL);
  const jsPDF = await chargerLib(), doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true }), lg = await logo(nb);
  const tous = [t, ...(reels || [])];
  const refs = [...new Set(tous.flatMap(reelsRefs))]; const imgs = {};
  await Promise.all(refs.map(async r => { imgs[r] = await image(r, 900, nb); }));
  let y = M;
  const besoin = h => { if (y + h > BAS) { doc.addPage(); y = M; return true; } return false; };
  const lh = pt => pt * 0.3528 * 1.38;
  const police = (pt, gras, coul) => { doc.setFont('helvetica', gras ? 'bold' : 'normal'); doc.setFontSize(pt); doc.setTextColor(...(coul || NOIR)); };
  // un paragraphe, ligne par ligne (il peut passer sur la page suivante)
  const para = (s, { x = M, w = LARG, pt = 10, gras = false, coul = NOIR, apres = 1.5 } = {}) => {
    s = net(s); if (!s) return; police(pt, gras, coul);
    for (const l of doc.splitTextToSize(s, w)) { besoin(lh(pt)); doc.text(l, x, y + pt * 0.3528 * 0.9); y += lh(pt); }
    y += apres; };
  const titre = (s, sous, garde = 22) => { besoin(garde); y += sous ? 3 : 5; police(sous ? 8.5 : 9.5, true, ROUGE); doc.text(net(s).toUpperCase(), M, y + 3, { charSpace: 0.5 }); y += 6.5; };

  // ----- l'en-tête -----
  const entete = (x) => {
    if (lg) { const lw = 50, lh2 = lw / lg.r; doc.addImage(lg.d, 'PNG', M, y, lw, lh2); y += lh2 + 6; }
    else { police(14, true, ROUGE); doc.text('BEESKOT', M, y + 6, { charSpace: 0.8 }); y += 10; }
    police(22, true); const tt = doc.splitTextToSize(net(x.titre || 'Tournage'), LARG); doc.text(tt, M, y + 8); y += 8 + (tt.length - 1) * 8.5;
    const sub = [x.type, x.morceau].filter(Boolean).join(' · '); if (sub) { police(10, false, GRIS); doc.text(net(sub), M, y + 5); y += 6; }
    y += 2; doc.setDrawColor(...ROUGE); doc.setLineWidth(0.8); doc.line(M, y, L - M, y); y += 5;
    const info = (k, v) => { v = net(v); if (!v) return; police(10, true); doc.text(k, M, y + 3.2); police(10); const ls = doc.splitTextToSize(v, LARG - 22); ls.forEach((l, i) => { besoin(lh(10)); doc.text(l, M + 22, y + 3.2); y += lh(10); }); y += 0.8; };
    info('Quand', (dateFr(x.date) || 'à fixer') + (x.heure ? ' à ' + x.heure : '')); info('Où', x.lieu || '—'); info("L'idée", x.idee || ''); };

  // ----- le contenu d'un tournage ou d'un reel -----
  const corps = (x, sous) => {
    const mood = (x.moodboard || []);
    if (mood.length) { titre('Moodboard', sous, 70); const n = 4, g = 4, cw = (LARG - g * (n - 1)) / n, ch = 54;
      for (let i = 0; i < mood.length; i += n) { besoin(ch + 7);
        mood.slice(i, i + n).forEach((u, k) => { const im = imgs[u], cx = M + k * (cw + g);
          if (im) { const w = im.r >= cw / ch ? cw : ch * im.r, h = im.r >= cw / ch ? cw / im.r : ch; doc.addImage(im.d, 'JPEG', cx, y, w, h); }
          else { doc.setDrawColor(...TRAIT); doc.setLineWidth(0.2); doc.rect(cx, y, cw, ch); police(8, false, GRIS); doc.text('(image absente)', cx + cw / 2, y + ch / 2, { align: 'center' }); }
          police(7.5, false, GRIS); doc.text('Image ' + (i + k + 1), cx, y + ch + 3.6); });
        y += ch + 7; } }
    if ((x.plans || []).length) { titre('Découpage', sous, 40);
      const cols = [['#', 8], ['Cadrage', 26], ["Ce qu'on voit", 60], ['Durée', 14], ['Notes', 42], ['Images', 32]], pad = 1.8, pt = 9;
      const entetes = () => { besoin(8); let cx = M; doc.setFillColor(...FOND); doc.rect(M, y, LARG, 6.4, 'F'); police(7.5, true);
        cols.forEach(([n, w]) => { doc.text(n.toUpperCase(), cx + pad, y + 4.4, { charSpace: 0.25 }); cx += w; }); doc.setDrawColor(...TRAIT); doc.setLineWidth(0.2); doc.rect(M, y, LARG, 6.4); y += 6.4; };
      entetes();
      x.plans.forEach((p, i) => {
        const cel = [String(i + 1), p.cadrage, p.action, p.duree, [p.audio && '♪ ' + p.audio, p.notes].filter(Boolean).join(' · ')].map((s, k) => { police(pt); return doc.splitTextToSize(net(s), cols[k][1] - 2 * pad); });
        const iw = 9, ih = 12, gi = 1, par = Math.max(1, Math.floor((cols[5][1] - 2 * pad + gi) / (iw + gi))), nI = (p.imgs || []).length, hImgs = nI ? Math.ceil(nI / par) * (ih + gi) : 0;
        const h = Math.max(7.5, Math.max(...cel.map(l => l.length)) * lh(pt) + 2 * pad - 0.6, hImgs + 2 * pad - gi);
        if (y + h > BAS) { doc.addPage(); y = M; entetes(); }
        let cx = M; doc.setDrawColor(...TRAIT); doc.setLineWidth(0.2);
        cols.forEach(([, w], k) => { doc.rect(cx, y, w, h);
          if (k < 5) { police(pt); cel[k].forEach((l, j) => doc.text(l, cx + pad, y + pad + 3 + j * lh(pt) - 0.4)); }
          else (p.imgs || []).forEach((u, j) => { const im = imgs[u]; if (!im) return; const ix = cx + pad + (j % par) * (iw + gi), iy = y + pad + Math.floor(j / par) * (ih + gi);
            const w2 = im.r >= iw / ih ? iw : ih * im.r, h2 = im.r >= iw / ih ? iw / im.r : ih; doc.addImage(im.d, 'JPEG', ix, iy, w2, h2); });
          cx += w; });
        y += h; });
      y += 2; }
    const ten = (membres || []).filter(m => (x.tenues || {})[m] || ((x.tenuesPhotos || {})[m] || []).length);
    if (ten.length) {
      const th = 30, gx = 3, x0 = M + 24, wmax = LARG - 24;
      const bloc = m => { const ph = ((x.tenuesPhotos || {})[m] || []).map(u => imgs[u]).filter(Boolean), lignes = []; let cur = [], cw = 0;
        ph.forEach(im => { const w = Math.min(wmax, th * im.r); if (cw + w > wmax && cur.length) { lignes.push(cur); cur = []; cw = 0; } cur.push({ im, w }); cw += w + gx; }); if (cur.length) lignes.push(cur);
        police(9.5); const txt = doc.splitTextToSize(net((x.tenues || {})[m] || ''), wmax);
        return { m, lignes, txt, h: Math.max(8, lignes.length * (th + 3) + txt.length * lh(9.5) + 2) + 3 }; };
      const blocs = ten.map(bloc);
      titre('Tenues', sous, Math.min(blocs[0].h, 150) + 14);
      blocs.forEach(B => { besoin(Math.min(B.h, 200));
        police(10, true); doc.text(net(B.m), M, y + 4);
        let yy = y; B.lignes.forEach(l => { let cx = x0; l.forEach(({ im, w }) => { doc.addImage(im.d, 'JPEG', cx, yy, w, th); cx += w + gx; }); yy += th + 3; });
        police(9.5); B.txt.forEach(l => { doc.text(l, x0, yy + 3.4); yy += lh(9.5); });
        y = Math.max(yy, y + 8) + 3; doc.setDrawColor(...TRAIT); doc.setLineWidth(0.2); doc.line(M, y - 1.5, L - M, y - 1.5); }); }
    if (x.materiel) { titre('Matériel', sous); para(x.materiel); }
    if (x.notes) { titre('Notes', sous); para(x.notes); } };

  entete(t);
  if ((reels || []).length) { titre('Au programme'); reels.forEach((r, i) => para(`${i + 1}.  ${r.titre || 'Reel'}${r.morceau ? '  ·  ' + r.morceau : ''}`, { apres: 0.6 })); y += 2; }
  corps(t);
  (reels || []).forEach((r, i) => { doc.addPage(); y = M;
    police(13, true, ROUGE); doc.text(net(/^reel\b/i.test(r.titre || '') ? r.titre : 'Reel ' + (i + 1) + ' · ' + (r.titre || 'Sans titre')).toUpperCase(), M, y + 5, { charSpace: 0.4 }); y += 9;
    para([r.morceau && r.morceau, (r.passage && r.passage.fin > r.passage.debut) && ('♪ ' + BK.audio.temps(r.passage.debut).replace(/\.\d$/, '') + ' → ' + BK.audio.temps(r.passage.fin).replace(/\.\d$/, '')), r.lieu, r.idee && '« ' + r.idee + ' »'].filter(Boolean).join('  ·  '), { pt: 9.5, coul: GRIS, apres: 2 });
    corps(r, true); });

  // ----- le pied de chaque page -----
  const n = doc.getNumberOfPages(), nom = net(t.titre || 'Tournage');
  for (let i = 1; i <= n; i++) { doc.setPage(i); police(7.5, false, GRIS); doc.text('BEESKOT Studio · ' + nom, M, H - 8); doc.text(i + ' / ' + n, L - M, H - 8, { align: 'right' }); }
  const fich = (String(t.titre || 'Tournage').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Tournage') + ' - ' + new Date().toISOString().slice(0, 10) + (nb ? ' - noir et blanc' : ' - couleur') + '.pdf';
  return { bytes: new Uint8Array(doc.output('arraybuffer')), nom: fich, pages: n };
};
})();
