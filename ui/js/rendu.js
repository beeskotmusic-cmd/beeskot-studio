// =====================================================================
// RENDU VIDÉO — dessine une image du reel : vidéo recadrée (zoom + position),
// couleur (LUT .cube), puis sous-titres. Le même dessin sert à l'aperçu ET à l'export MP4.
// =====================================================================
BK.rendu = {
  // ---------- MONTAGE : des photos ET des vidéos → une vidéo 9:16 (sans son), qu'on retravaille ensuite comme n'importe quelle vidéo ----------
  // morceaux : [{ img (ImageBitmap) OU video (<video> chargée), debut (s, pour une vidéo), duree (s), anim }]
  //   anim : 'zoom' (s'approche), 'recul' (s'éloigne), 'glisse' (traverse l'image), 'fixe'
  // transition : 'coupe', 'fondu' (enchaîné), 'noir' (fondu au noir) · voile : un effet vintage (voir VOILES)
  // Chaque image est montrée entière sur un fond flou d'elle-même. Image par image, sans jamais surcharger le PC.
  async montage(morceaux, { transition = 'coupe', voile = '', progression } = {}) {
    if (!window.VideoEncoder) throw new Error('Cet ordinateur ne sait pas encoder la vidéo');
    const L = 1080, H = 1920, fps = 30;
    let codec = 'avc1.640028', mux = 'avc';
    if (!(await VideoEncoder.isConfigSupported({ codec, width: L, height: H, bitrate: 8e6, framerate: fps })).supported) { codec = 'vp09.00.40.08'; mux = 'vp9'; }
    const muxer = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), fastStart: 'in-memory', video: { codec: mux, width: L, height: H } });
    const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: e => { throw e; } });
    venc.configure({ codec, width: L, height: H, bitrate: 8e6, framerate: fps });
    const cv = document.createElement('canvas'); cv.width = L; cv.height = H; const cx = cv.getContext('2d');
    const fond = document.createElement('canvas'); fond.width = L / 4; fond.height = H / 4; const fx = fond.getContext('2d');
    const avant = document.createElement('canvas'); avant.width = L; avant.height = H; const ax = avant.getContext('2d');   // la dernière image du morceau d'avant (pour le fondu)
    const total = morceaux.reduce((t, p) => t + Math.max(1, Math.round(p.duree * fps)), 0); let k = 0;
    const FONDU = Math.round(0.45 * fps), NOIR = Math.round(0.3 * fps);
    const caler = (v, t) => new Promise(ok => { const fin = () => { clearTimeout(z); ok(); }, z = setTimeout(ok, 1500); v.onseeked = fin; v.currentTime = t; });
    for (const [ip, p] of morceaux.entries()) {
      const src = p.img || p.video, iw = p.img ? p.img.width : p.video.videoWidth, ih = p.img ? p.img.height : p.video.videoHeight;
      const n = Math.max(1, Math.round(p.duree * fps)), ech = Math.max(fond.width / iw, fond.height / ih);
      const faireFond = () => { fx.filter = 'blur(10px) brightness(0.55)'; fx.drawImage(src, (fond.width - iw * ech) / 2, (fond.height - ih * ech) / 2, iw * ech, ih * ech); fx.filter = 'none'; };
      if (p.img) faireFond();
      for (let i = 0; i < n; i++, k++) {
        if (p.video) { await caler(p.video, (p.debut || 0) + i / fps); if (i % 3 === 0) faireFond(); }
        const q = n > 1 ? i / (n - 1) : 0, a = p.anim || 'zoom';
        cx.drawImage(fond, 0, 0, L, H);
        if (a === 'glisse') {                                   // l'image remplit l'écran et le traverse doucement
          const e = Math.max(L / iw, H / ih) * 1.12, w = iw * e, h = ih * e;
          cx.drawImage(src, (L - w) / 2 + (w - L) / 2 * (1 - 2 * q), (H - h) / 2, w, h);
        } else {
          const z = a === 'zoom' ? 1 + 0.08 * q : a === 'recul' ? 1.08 - 0.08 * q : 1, e = Math.min(L / iw, H / ih) * z;
          cx.drawImage(src, (L - iw * e) / 2, (H - ih * e) / 2, iw * e, ih * e);
        }
        if (transition === 'fondu' && ip > 0 && i < FONDU) { cx.globalAlpha = 1 - i / FONDU; cx.drawImage(avant, 0, 0); cx.globalAlpha = 1; }
        if (transition === 'noir') { const b = Math.max(ip > 0 && i < NOIR ? 1 - i / NOIR : 0, ip < morceaux.length - 1 && i >= n - NOIR ? (i - (n - NOIR) + 1) / NOIR : 0);
          if (b > 0) { cx.fillStyle = `rgba(0,0,0,${Math.min(1, b)})`; cx.fillRect(0, 0, L, H); } }
        if (voile) BK.rendu.voile(cx, L, H, voile, k / fps);
        if (i === n - 1) { ax.clearRect(0, 0, L, H); ax.drawImage(cv, 0, 0); }
        const f = new VideoFrame(cv, { timestamp: Math.round(k * 1e6 / fps), duration: Math.round(1e6 / fps) });
        venc.encode(f, { keyFrame: k % (fps * 2) === 0 }); f.close();
        if (venc.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 15));
        if (k % 10 === 0) { progression && progression(k / total); await new Promise(r => setTimeout(r, 0)); }
      }
    }
    await venc.flush(); venc.close(); muxer.finalize(); progression && progression(1);
    return new Uint8Array(muxer.target.buffer);
  },
  async diaporama(photos, o) { return BK.rendu.montage(photos.map(p => ({ ...p, anim: p.anim || 'zoom' })), o); },

  // ---------- EFFETS VINTAGE (dessinés ici, sans fichier) : par-dessus l'image, en photo comme en vidéo ----------
  VOILES: [['', 'Aucun effet'],
    ['vintage', 'Vintage'], ['delave', 'Délavé années 70'], ['kodak', 'Pellicule couleur chaude'], ['polaroid', 'Polaroid'], ['super8', 'Super 8'],
    ['sepia', 'Sépia ancien'], ['nb', 'Noir et blanc argentique'],
    ['lumiere', 'Fuite de lumière orange'], ['lumiere2', 'Fuite de lumière dorée'], ['lumiere3', 'Fuite de lumière rose'], ['brulure', 'Pellicule brûlée'], ['halo', 'Halo doux'],
    ['grain', 'Grain de film'], ['poussiere', 'Poussière et rayures'], ['papier', 'Papier poster'], ['vhs', 'VHS'], ['vignette', 'Vignettage']],
  _bruit: null,
  bruit() {
    if (BK.rendu._bruit) return BK.rendu._bruit;
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), d = x.createImageData(256, 256);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0); return BK.rendu._bruit = c;
  },
  // ---------- le papier d'affiche : fond crème, fibres, taches et un pli (dessiné une fois, gardé) ----------
  _papier: null,
  papier() {
    if (BK.rendu._papier) return BK.rendu._papier;
    const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d');
    let g = 7; const r = () => (g = (g * 16807) % 2147483647) / 2147483647;               // toujours le même papier
    x.fillStyle = '#ece2cb'; x.fillRect(0, 0, N, N);
    const d = x.getImageData(0, 0, N, N); for (let i = 0; i < d.data.length; i += 4) { const v = (r() - 0.5) * 26; d.data[i] += v; d.data[i + 1] += v; d.data[i + 2] += v * 0.9; } x.putImageData(d, 0, 0);
    for (let i = 0; i < 40; i++) { const px = r() * N, py = r() * N, rr = 20 + r() * 70, t = x.createRadialGradient(px, py, 0, px, py, rr);
      t.addColorStop(0, `rgba(${r() > 0.5 ? '150,115,70' : '255,250,235'},${0.05 + r() * 0.07})`); t.addColorStop(1, 'rgba(150,115,70,0)'); x.fillStyle = t; x.fillRect(0, 0, N, N); }
    x.lineCap = 'round';
    for (let i = 0; i < 1400; i++) { const px = r() * N, py = r() * N, a = r() * 6.3, l = 3 + r() * 16;
      x.strokeStyle = r() > 0.35 ? `rgba(110,85,55,${0.05 + r() * 0.12})` : `rgba(255,252,240,${0.15 + r() * 0.2})`; x.lineWidth = 0.4 + r() * 0.8;
      x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a + 0.6) * l / 2, py + Math.sin(a + 0.6) * l / 2, px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
    const pli = (y0, y1, a) => { x.strokeStyle = `rgba(90,70,45,${a})`; x.lineWidth = 1.2; x.beginPath(); x.moveTo(0, y0); x.lineTo(N, y1); x.stroke();
      x.strokeStyle = `rgba(255,252,240,${a * 1.6})`; x.beginPath(); x.moveTo(0, y0 + 1.5); x.lineTo(N, y1 + 1.5); x.stroke(); };
    pli(N * 0.38, N * 0.41, 0.12); return BK.rendu._papier = c;
  },
  // t : le temps (s) — en vidéo le grain et la poussière bougent ; en photo t = 0 (toujours le même dessin)
  // inten : l'intensité de l'effet (0 = rien, 1 = plein effet) — on garde l'image d'avant et on la remet par-dessus, plus ou moins transparente
  voile(cx, L, H, type, t = 0, inten = 1) {
    if (!type || inten <= 0) return;
    let avant = null;
    if (inten < 1) { avant = BK.rendu._avant || (BK.rendu._avant = document.createElement('canvas')); avant.width = L; avant.height = H; avant.getContext('2d').drawImage(cx.canvas, 0, 0); }
    BK.rendu._voile(cx, L, H, type, t);
    if (avant) { cx.save(); cx.globalAlpha = 1 - inten; cx.drawImage(avant, 0, 0); cx.restore(); }
  },
  _voile(cx, L, H, type, t = 0) {
    const s = L / 1080, f = Math.floor(t * 12), h = n => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
    cx.save();
    const grain = a => { const pat = cx.createPattern(BK.rendu.bruit(), 'repeat');
      pat.setTransform && pat.setTransform(new DOMMatrix().translate(h(f + 1) * 256, h(f + 2) * 256).scale(Math.max(1, 1.6 * s)));
      cx.globalCompositeOperation = 'overlay'; cx.globalAlpha = a; cx.fillStyle = pat; cx.fillRect(0, 0, L, H); cx.globalCompositeOperation = 'source-over'; cx.globalAlpha = 1; };
    const vignette = a => { const g = cx.createRadialGradient(L / 2, H / 2, Math.min(L, H) * 0.35, L / 2, H / 2, Math.hypot(L, H) * 0.55);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`); cx.fillStyle = g; cx.fillRect(0, 0, L, H); };
    const poussiere = nb => { for (let i = 0; i < nb; i++) { const x = h(f * 131 + i) * L, y = h(f * 173 + i * 7) * H, r = (0.6 + h(i * 3 + f) * 2.4) * s * 1.6;
        cx.fillStyle = h(i + f * 5) > 0.5 ? 'rgba(255,250,235,.55)' : 'rgba(20,14,8,.55)'; cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill(); }
      for (let i = 0; i < 2; i++) if (h(f * 11 + i) > 0.45) { const x = h(f * 19 + i * 5) * L; cx.fillStyle = 'rgba(255,248,230,.22)'; cx.fillRect(x, 0, Math.max(1, 1.5 * s), H); } };
    const lumiere = a => { cx.globalCompositeOperation = 'screen';
      const x1 = L * (0.05 + 0.08 * Math.sin(t * 0.7)), g = cx.createRadialGradient(x1, H * 0.18, 0, x1, H * 0.18, H * 0.55);
      g.addColorStop(0, `rgba(255,140,50,${a})`); g.addColorStop(0.5, `rgba(255,70,30,${a * 0.45})`); g.addColorStop(1, 'rgba(255,60,20,0)'); cx.fillStyle = g; cx.fillRect(0, 0, L, H);
      const g2 = cx.createRadialGradient(L, H * 0.85, 0, L, H * 0.85, H * 0.4); g2.addColorStop(0, `rgba(255,190,90,${a * 0.6})`); g2.addColorStop(1, 'rgba(255,190,90,0)');
      cx.fillStyle = g2; cx.fillRect(0, 0, L, H); cx.globalCompositeOperation = 'source-over'; };
    const teinte = (mode, c) => { cx.globalCompositeOperation = mode; cx.fillStyle = c; cx.fillRect(0, 0, L, H); cx.globalCompositeOperation = 'source-over'; };
    if (type === 'vintage') {                                     // chaud, noirs délavés, grain, poussière, coins sombres
      cx.globalCompositeOperation = 'multiply'; cx.fillStyle = 'rgba(255,222,170,.55)'; cx.fillRect(0, 0, L, H);
      cx.globalCompositeOperation = 'screen'; cx.fillStyle = 'rgba(46,32,20,.55)'; cx.fillRect(0, 0, L, H); cx.globalCompositeOperation = 'source-over';
      grain(0.35); poussiere(14); vignette(0.5);
    }
    if (type === 'grain') grain(0.5);
    if (type === 'papier') {                                      // imprimé sur une affiche : noirs un peu délavés, encre qui boit le papier
      teinte('screen', 'rgba(45,35,22,.35)');
      const pat = cx.createPattern(BK.rendu.papier(), 'repeat'); pat.setTransform && pat.setTransform(new DOMMatrix().scale(Math.max(1, 1.4 * s)));
      cx.globalCompositeOperation = 'multiply'; cx.fillStyle = pat; cx.fillRect(0, 0, L, H);
      cx.globalCompositeOperation = 'soft-light'; cx.globalAlpha = 0.5; cx.fillRect(0, 0, L, H); cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over';
      grain(0.12); vignette(0.18); }
    if (type === 'poussiere') { poussiere(28); grain(0.18); }
    if (type === 'lumiere') { lumiere(0.85); grain(0.15); }
    if (type === 'vignette') vignette(0.7);
    // une fuite de lumière : une tache colorée qui « brûle » un bord de l'image
    const fuite = (x, y, r, c1, c2, a) => { cx.globalCompositeOperation = 'screen'; const g = cx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${c1},${a})`); g.addColorStop(0.45, `rgba(${c2},${a * 0.5})`); g.addColorStop(1, `rgba(${c2},0)`); cx.fillStyle = g; cx.fillRect(0, 0, L, H); cx.globalCompositeOperation = 'source-over'; };
    if (type === 'lumiere2') { fuite(L * 1.02, H * (0.3 + 0.05 * Math.sin(t * 0.6)), H * 0.75, '255,224,140', '255,170,40', 1); fuite(L * 1.02, H * 0.3, H * 0.75, '255,224,140', '255,170,40', 0.5); fuite(0, H, H * 0.4, '255,200,110', '240,140,40', 0.5); grain(0.15); }
    if (type === 'lumiere3') { fuite(L * 0.85, -H * 0.02, H * 0.8, '255,170,190', '235,70,120', 1); fuite(L * 0.85, -H * 0.02, H * 0.5, '255,190,200', '235,70,120', 0.5);
      cx.globalCompositeOperation = 'screen'; const g = cx.createLinearGradient(0, 0, L, 0); g.addColorStop(0, 'rgba(255,90,140,.45)'); g.addColorStop(0.25, 'rgba(255,90,140,0)'); cx.fillStyle = g; cx.fillRect(0, 0, L, H); cx.globalCompositeOperation = 'source-over'; grain(0.15); }
    if (type === 'brulure') {                                     // le bord de la pellicule a pris la lumière : orange vif sur un côté, presque blanc au bord
      const g = cx.createLinearGradient(L, 0, L * 0.5, 0);
      g.addColorStop(0, 'rgba(255,248,225,1)'); g.addColorStop(0.1, 'rgba(255,190,70,.95)'); g.addColorStop(0.3, 'rgba(240,110,30,.7)'); g.addColorStop(0.6, 'rgba(210,60,20,.3)'); g.addColorStop(1, 'rgba(200,40,10,0)');
      cx.fillStyle = g; cx.fillRect(0, 0, L, H); cx.globalCompositeOperation = 'source-over'; fuite(0, H * 0.1, H * 0.3, '255,120,40', '200,40,10', 0.4); grain(0.25); vignette(0.35); }
    if (type === 'halo') {                                        // les lumières bavent doucement (comme un filtre « bas » sur l'objectif)
      const c = BK.rendu._halo || (BK.rendu._halo = document.createElement('canvas')); c.width = L; c.height = H; const x = c.getContext('2d');
      x.filter = `blur(${Math.round(18 * s)}px) brightness(1.15)`; x.drawImage(cx.canvas, 0, 0); x.filter = 'none';
      cx.globalCompositeOperation = 'screen'; cx.globalAlpha = 0.42; cx.drawImage(c, 0, 0); cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over'; }
    if (type === 'delave') { teinte('screen', 'rgba(60,48,30,.6)'); teinte('multiply', 'rgba(240,226,190,.7)'); teinte('soft-light', 'rgba(120,150,110,.35)'); grain(0.2); vignette(0.25); }
    if (type === 'kodak') { teinte('soft-light', 'rgba(255,140,60,.45)'); teinte('multiply', 'rgba(255,236,205,.5)'); teinte('screen', 'rgba(30,20,40,.35)'); grain(0.2); vignette(0.3); }
    if (type === 'polaroid') { teinte('screen', 'rgba(55,95,95,.7)'); teinte('soft-light', 'rgba(255,215,160,.55)'); teinte('multiply', 'rgba(255,238,210,.8)'); teinte('soft-light', 'rgba(255,255,255,.2)'); grain(0.12); vignette(0.2); }
    if (type === 'super8') { teinte('multiply', 'rgba(255,214,150,.55)'); teinte('screen', 'rgba(50,30,15,.45)');
      fuite(L * 0.5, H * 0.5, Math.hypot(L, H) * 0.3, '255,230,180', '255,200,120', 0.12 + 0.06 * Math.sin(t * 9)); grain(0.45); poussiere(10); vignette(0.85); }
    if (type === 'sepia') { teinte('saturation', 'rgb(128,128,128)'); teinte('color', 'rgba(150,105,60,.75)'); teinte('screen', 'rgba(40,28,15,.35)'); grain(0.3); poussiere(12); vignette(0.55); }
    if (type === 'nb') { teinte('saturation', 'rgb(128,128,128)'); teinte('soft-light', 'rgba(0,0,0,.25)'); grain(0.45); poussiere(8); vignette(0.45); }
    if (type === 'vhs') {
      cx.globalCompositeOperation = 'soft-light'; cx.fillStyle = 'rgba(80,120,255,.35)'; cx.fillRect(0, 0, L, H); cx.globalCompositeOperation = 'source-over';
      cx.fillStyle = 'rgba(0,0,0,.16)'; const pas = Math.max(2, Math.round(4 * s)); for (let y = 0; y < H; y += pas) cx.fillRect(0, y, L, Math.max(1, pas / 2));
      const yb = (t * 140 * s + h(3) * H) % H; cx.fillStyle = 'rgba(255,255,255,.07)'; cx.fillRect(0, yb, L, 26 * s);
      grain(0.3); vignette(0.35);
    }
    cx.restore();
  },

  // ---------- CADRES : la photo posée dans un cadre d'époque (Polaroid, vieille photo, pellicule…) ----------
  // dst : le contexte où dessiner · src : l'image finie (effets compris) · taille : 0 à 100 (épaisseur du cadre)
  CADRES: [['', 'Aucun cadre'], ['polaroid', 'Polaroid'], ['ancienne', 'Vieille photo'], ['pellicule', 'Pellicule 35 mm'], ['negatif', 'Négatif scanné'], ['diapo', 'Diapositive']],
  cadre(dst, src, L, H, type, taille = 40, graine = 0) {
    if (!type) { dst.drawImage(src, 0, 0, L, H); return; }
    const m = Math.min(L, H), b = Math.round(m * (0.025 + 0.11 * taille / 100)), h = n => { const x = Math.sin((n + graine * 31) * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
    // l'image dans la fenêtre du cadre, sans être déformée (on coupe un peu les bords si besoin)
    const poser = (x, y, w, hh) => { const k = Math.max(w / src.width, hh / src.height), sw = w / k, sh = hh / k;
      dst.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, x, y, w, hh); };
    const grain = (a) => { const pat = dst.createPattern(BK.rendu.bruit(), 'repeat'); dst.save(); dst.globalCompositeOperation = 'overlay'; dst.globalAlpha = a; dst.fillStyle = pat; dst.fillRect(0, 0, L, H); dst.restore(); };
    dst.save();
    if (type === 'polaroid') {                                   // bord crème, plus large en bas
      dst.fillStyle = '#ece3cf'; dst.fillRect(0, 0, L, H); grain(0.12);
      const bas = Math.round(b * 3.2); poser(b, b, L - 2 * b, H - b - bas);
      dst.strokeStyle = 'rgba(0,0,0,.18)'; dst.lineWidth = Math.max(1, m / 500); dst.strokeRect(b, b, L - 2 * b, H - b - bas);
    }
    if (type === 'ancienne') {                                    // papier jauni, coins usés, petit liseré
      const g = dst.createRadialGradient(L / 2, H / 2, m * 0.3, L / 2, H / 2, Math.hypot(L, H) * 0.6);
      g.addColorStop(0, '#efe2c2'); g.addColorStop(1, '#c9ae7c'); dst.fillStyle = g; dst.fillRect(0, 0, L, H); grain(0.25);
      poser(b, b, L - 2 * b, H - 2 * b);
      dst.strokeStyle = 'rgba(255,250,235,.85)'; dst.lineWidth = Math.max(2, b * 0.08); dst.strokeRect(b - b * 0.25, b - b * 0.25, L - 2 * b + b * 0.5, H - 2 * b + b * 0.5);
      dst.globalCompositeOperation = 'multiply'; const v = dst.createRadialGradient(L / 2, H / 2, m * 0.45, L / 2, H / 2, Math.hypot(L, H) * 0.62);
      v.addColorStop(0, 'rgba(255,255,255,0)'); v.addColorStop(1, 'rgba(150,110,60,.55)'); dst.fillStyle = v; dst.fillRect(0, 0, L, H);
    }
    if (type === 'pellicule' || type === 'negatif') {           // le film noir autour (avec les perforations, ou les bords irréguliers d'un scan)
      dst.fillStyle = '#0d0b09'; dst.fillRect(0, 0, L, H);
      if (type === 'pellicule') {
        const cote = Math.round(b * 1.6); poser(cote, b, L - 2 * cote, H - 2 * b);
        const tw = cote * 0.42, th = tw * 1.35, pas = th * 1.9; dst.fillStyle = '#d9d2c2';
        for (let y = pas * 0.3; y < H; y += pas) for (const x of [cote * 0.29, L - cote * 0.29 - tw]) { dst.beginPath(); dst.roundRect ? dst.roundRect(x, y, tw, th, tw * 0.2) : dst.rect(x, y, tw, th); dst.fill(); }
        dst.fillStyle = 'rgba(232,140,40,.9)'; dst.font = `600 ${Math.max(8, Math.round(b * 0.42))}px monospace`; dst.textBaseline = 'middle';
        dst.fillText('BEESKOT 400  ▸ ' + (12 + Math.floor(h(1) * 20)), cote, b / 2); dst.fillText('▸ ' + (12 + Math.floor(h(2) * 20)) + 'A', L - cote - b * 2.2, H - b / 2);
      } else {
        poser(b, b, L - 2 * b, H - 2 * b);
        dst.fillStyle = '#0d0b09';                                // bords grignotés, comme un négatif mal aligné dans le scanner
        for (let i = 0; i < 4; i++) { dst.beginPath(); const n = 22;
          for (let k = 0; k <= n; k++) { const t = k / n, j = b * (0.06 + 0.16 * h(i * 100 + k));
            const pt = i === 0 ? [t * L, b + j] : i === 1 ? [L - b - j, t * H] : i === 2 ? [(1 - t) * L, H - b - j] : [b + j, (1 - t) * H];
            k ? dst.lineTo(...pt) : dst.moveTo(...pt); }
          const coin = [[L, 0, 0, 0], [L, H, L, 0], [0, H, L, H], [0, 0, 0, H]][i]; dst.lineTo(coin[0], coin[1]); dst.lineTo(coin[2], coin[3]); dst.closePath(); dst.fill(); }
        dst.fillStyle = 'rgba(255,245,225,.6)'; dst.font = `600 ${Math.max(8, Math.round(b * 0.35))}px monospace`; dst.textBaseline = 'middle'; dst.fillText('BEESKOT   ' + (1 + Math.floor(h(3) * 36)), b, b / 2);
      }
    }
    if (type === 'diapo') {                                       // le cadre en carton d'une diapositive, fenêtre aux coins arrondis
      dst.fillStyle = '#d8cfbd'; dst.fillRect(0, 0, L, H); grain(0.15);
      const e = Math.round(b * 1.5), r = e * 0.35; dst.save(); dst.beginPath(); dst.roundRect ? dst.roundRect(e, e, L - 2 * e, H - 2 * e, r) : dst.rect(e, e, L - 2 * e, H - 2 * e); dst.clip(); poser(e, e, L - 2 * e, H - 2 * e); dst.restore();
      dst.strokeStyle = 'rgba(80,60,40,.35)'; dst.lineWidth = Math.max(1, e * 0.06); dst.beginPath(); dst.roundRect ? dst.roundRect(e, e, L - 2 * e, H - 2 * e, r) : dst.rect(e, e, L - 2 * e, H - 2 * e); dst.stroke();
      dst.fillStyle = 'rgba(60,45,30,.7)'; dst.font = `600 ${Math.max(8, Math.round(e * 0.3))}px monospace`; dst.textBaseline = 'middle'; dst.fillText('BEESKOT · ' + (1 + Math.floor(h(4) * 36)), e, e / 2);
    }
    dst.restore();
  },

  // ---------- une case « glisse la souris » (comme Zoom et Intensité) : -100 à +100 % ----------
  champGlisse(el, { min = -100, max = 100, val = 0, pas = 5, change }) {
    el.readOnly = true; let g = null, v = val;
    const poser = x => { v = Math.round(Math.max(min, Math.min(max, x))); el.value = (v > 0 && min < 0 ? '+' : '') + v + ' %'; change(v); };
    el.value = (v > 0 && min < 0 ? '+' : '') + v + ' %';
    el.addEventListener('pointerdown', e => { if (!el.readOnly) return; e.preventDefault(); el.setPointerCapture(e.pointerId); g = { x: e.clientX, y: e.clientY, v }; });
    el.addEventListener('pointermove', e => { if (g) poser(g.v + ((e.clientX - g.x) - (e.clientY - g.y)) / 2); });
    el.addEventListener('pointerup', () => { g = null; });
    el.addEventListener('dblclick', () => { el.readOnly = false; el.value = v; el.select(); });
    el.addEventListener('blur', () => { if (el.readOnly) return; el.readOnly = true; const x = parseFloat(el.value.replace(',', '.')); poser(isNaN(x) ? v : x); });
    el.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') el.blur(); });
    el.addEventListener('wheel', e => { e.preventDefault(); poser(v - Math.sign(e.deltaY) * pas); }, { passive: false });
    return { poser, regler: x => { v = x; } };
  },

  // ---------- lire un fichier LUT .cube ----------
  lireCube(txt) {
    let n = 0; const v = [];
    for (const l of txt.split(/\r?\n/)) {
      const s = l.trim(); if (!s || s[0] === '#') continue;
      const m = s.match(/^LUT_3D_SIZE\s+(\d+)/i); if (m) { n = +m[1]; continue; }
      if (/^[-\d.]/.test(s)) { const p = s.split(/\s+/).map(Number); if (p.length >= 3) v.push(p[0], p[1], p[2]); }
    }
    if (!n || v.length < n * n * n * 3) throw new Error('LUT illisible (format .cube 3D attendu)');
    // texture 2D : largeur n*n (bleu = tranche), hauteur n ; rouge varie le plus vite
    const px = new Uint8Array(n * n * n * 4);
    for (let b = 0; b < n; b++) for (let g = 0; g < n; g++) for (let r = 0; r < n; r++) {
      const i = (r + g * n + b * n * n) * 3, o = ((g * n * n) + b * n + r) * 4;
      px[o] = Math.round(Math.min(1, Math.max(0, v[i])) * 255); px[o + 1] = Math.round(Math.min(1, Math.max(0, v[i + 1])) * 255);
      px[o + 2] = Math.round(Math.min(1, Math.max(0, v[i + 2])) * 255); px[o + 3] = 255;
    }
    return { n, px };
  },

  // ---------- le moteur WebGL (léger : un seul petit programme) ----------
  creer(largeur, hauteur) {
    const cv = document.createElement('canvas'); cv.width = largeur; cv.height = hauteur;
    const gl = cv.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false });
    const vs = `attribute vec2 p; varying vec2 uv; uniform vec4 cad; void main(){ uv = cad.xy + (p*0.5+0.5)*cad.zw; uv.y = 1.0-uv.y; gl_Position = vec4(p,0,1); }`;
    const fs = `precision mediump float; varying vec2 uv; uniform sampler2D img; uniform sampler2D lut; uniform float n; uniform float force;
      vec3 l(vec3 c){ float b = c.b*(n-1.0); float b0 = floor(b); float b1 = min(b0+1.0, n-1.0);
        vec2 a0 = vec2((b0*n + c.r*(n-1.0) + 0.5)/(n*n), (c.g*(n-1.0)+0.5)/n); vec2 a1 = vec2((b1*n + c.r*(n-1.0) + 0.5)/(n*n), a0.y);
        return mix(texture2D(lut,a0).rgb, texture2D(lut,a1).rgb, b-b0); }
      void main(){ if(uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0){ gl_FragColor=vec4(0,0,0,1); return; }
        vec3 c = texture2D(img, uv).rgb; if(force>0.0){ c = mix(c, l(c), force); } gl_FragColor = vec4(c,1); }`;
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr); gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const ap = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0);
    const tex = (unite) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unite); gl.bindTexture(gl.TEXTURE_2D, t);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v); return t; };
    const tImg = tex(0), tLut = tex(1);
    gl.uniform1i(gl.getUniformLocation(pr, 'img'), 0); gl.uniform1i(gl.getUniformLocation(pr, 'lut'), 1);
    const u = { cad: gl.getUniformLocation(pr, 'cad'), n: gl.getUniformLocation(pr, 'n'), force: gl.getUniformLocation(pr, 'force') };
    const sortie = document.createElement('canvas'); sortie.width = largeur; sortie.height = hauteur;
    const ctx = sortie.getContext('2d');
    return {
      sortie,
      css: 'none',
      // contraste, lumière, saturation : en %, 0 = rien ne change (de -100 à +100)
      reglages(r = {}) { const c = 1 + (r.contraste || 0) / 100, l = 1 + (r.lumiere || 0) / 100, sa = 1 + (r.saturation || 0) / 100;
        this.css = (c === 1 && l === 1 && sa === 1) ? 'none' : `contrast(${c}) brightness(${l}) saturate(${sa})`; },
      lut(l) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tLut);
        if (l) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, l.n * l.n, l.n, 0, gl.RGBA, gl.UNSIGNED_BYTE, l.px); this.n = l ? l.n : 0; },
      // video : élément <video> ; cadre : { zoom (1 = remplit), x, y (en % du cadre) } ; sous : texte à afficher ; style des sous-titres
      dessiner(video, cadre, force, sous, voile) {
        const vw = video.videoWidth || video.naturalWidth || video.width, vh = video.videoHeight || video.naturalHeight || video.height; if (!vw) return;   // une vidéo ou une image
        // « remplir » le cadre 9:16, puis zoom et déplacement → zone de la vidéo à lire (en 0..1)
        const ech = Math.max(largeur / vw, hauteur / vh) * cadre.zoom, w = largeur / (vw * ech), h = hauteur / (vh * ech);
        const cx = 0.5 - cadre.x / 100 * (largeur / (vw * ech)), cy = 0.5 - cadre.y / 100 * (hauteur / (vh * ech));
        gl.viewport(0, 0, largeur, hauteur);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tImg);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
        gl.uniform4f(u.cad, cx - w / 2, 1 - (cy + h / 2), w, h);
        gl.uniform1f(u.n, this.n || 2); gl.uniform1f(u.force, this.n ? force : 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        ctx.filter = this.css || 'none'; ctx.drawImage(cv, 0, 0); ctx.filter = 'none';
        if (voile && voile.type) BK.rendu.voile(ctx, largeur, hauteur, voile.type, voile.t || 0, voile.k ?? 1);   // l'effet vintage, sous les sous-titres
        if (sous) BK.rendu.sousTitre(ctx, sous, largeur, hauteur);
      },
    };
  },

  // ---------- sous-titre : gros texte blanc bordé de noir, au-dessus de la zone du bas ----------
  sousTitre(ctx, texte, L, H) {
    const t = Math.round(L * 0.058); ctx.font = `700 ${t}px Jost, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const mots = texte.split(/\s+/), lignes = []; let cur = '';
    for (const m of mots) { const essai = cur ? cur + ' ' + m : m; if (ctx.measureText(essai).width > L * 0.78 && cur) { lignes.push(cur); cur = m; } else cur = essai; }
    if (cur) lignes.push(cur);
    const y0 = H * 0.66 - (lignes.length - 1) * t * 0.6;
    ctx.lineJoin = 'round'; ctx.lineWidth = t * 0.16; ctx.strokeStyle = 'rgba(0,0,0,.9)'; ctx.fillStyle = '#fff';
    lignes.forEach((l, i) => { const y = y0 + i * t * 1.2; ctx.strokeText(l, L / 2, y); ctx.fillText(l, L / 2, y); });
  },

  // quel sous-titre à l'instant t (secondes depuis le début du reel) ?
  texteA(sous, t) { let x = ''; for (const s of sous || []) if (s.t <= t) x = s.texte; else break; return x; },

  // ---------- EXPORT MP4 (encodeur intégré à Windows, assemblage en local) ----------
  async exporter({ video, debut, fin, cadre, force, lut, sous, voile, reglages, audio, progression }) {
    if (!window.VideoEncoder) throw new Error('Cet ordinateur ne sait pas encoder la vidéo');
    const L = 1080, H = 1920, fps = 30, r = BK.rendu.creer(L, H); r.lut(lut); r.reglages(reglages);
    if (audio && !(window.AudioEncoder && (await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: audio.sampleRate, numberOfChannels: audio.numberOfChannels, bitrate: 192000 })).supported)) audio = null;   // pas d'encodeur AAC : vidéo sans son
    // H.264 (le format standard des réseaux) ; secours : VP9 si l'ordinateur n'a pas d'encodeur H.264
    let codec = 'avc1.640028', mux = 'avc';
    if (!(await VideoEncoder.isConfigSupported({ codec, width: L, height: H, bitrate: 10e6, framerate: fps })).supported) {
      codec = 'vp09.00.40.08'; mux = 'vp9';
      if (!(await VideoEncoder.isConfigSupported({ codec, width: L, height: H, bitrate: 10e6, framerate: fps })).supported) throw new Error('Aucun encodeur vidéo disponible sur ce PC');
    }
    const muxer = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), fastStart: 'in-memory',
      video: { codec: mux, width: L, height: H }, ...(audio ? { audio: { codec: 'aac', sampleRate: audio.sampleRate, numberOfChannels: audio.numberOfChannels } } : {}) });
    const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: e => { throw e; } });
    venc.configure({ codec, width: L, height: H, bitrate: 10e6, framerate: fps });
    // image par image : on se place à chaque instant de la vidéo (plus lent que la lecture, mais exact et léger pour le PC)
    const n = Math.round((fin - debut) * fps);
    video.pause();
    for (let k = 0; k < n; k++) {
      const t = debut + k / fps;
      await new Promise(res => { video.onseeked = res; video.currentTime = t; });
      r.dessiner(video, cadre, force, BK.rendu.texteA(sous, k / fps), voile ? { type: voile, t: k / fps } : null);
      const f = new VideoFrame(r.sortie, { timestamp: Math.round(k * 1e6 / fps), duration: Math.round(1e6 / fps) });
      venc.encode(f, { keyFrame: k % (fps * 2) === 0 }); f.close();
      if (venc.encodeQueueSize > 8) await new Promise(res => setTimeout(res, 10));   // ne pas surcharger le PC
      progression && progression(k / n * (audio ? 0.9 : 1));
    }
    await venc.flush(); venc.close();
    if (audio) {                                                  // le son : AAC
      const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: e => { throw e; } });
      aenc.configure({ codec: 'mp4a.40.2', sampleRate: audio.sampleRate, numberOfChannels: audio.numberOfChannels, bitrate: 192000 });
      const nb = Math.min(audio.length, Math.round((fin - debut) * audio.sampleRate)), pas = 1024 * 8;
      for (let i = 0; i < nb; i += pas) {
        const m = Math.min(pas, nb - i), plan = new Float32Array(m * audio.numberOfChannels);
        for (let c = 0; c < audio.numberOfChannels; c++) plan.set(audio.getChannelData(c).subarray(i, i + m), c * m);
        const d = new AudioData({ format: 'f32-planar', sampleRate: audio.sampleRate, numberOfFrames: m, numberOfChannels: audio.numberOfChannels, timestamp: Math.round(i / audio.sampleRate * 1e6), data: plan });
        aenc.encode(d); d.close();
      }
      await aenc.flush(); aenc.close(); progression && progression(1);
    }
    muxer.finalize();
    return new Uint8Array(muxer.target.buffer);
  },
};

// ---------- FILTRES prêts à l'emploi (fabriqués ici, sans fichier) : comme une LUT, en un clic ----------
(() => {
  const cl = x => Math.min(1, Math.max(0, x)), lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const sat = (r, g, b, k) => { const l = lum(r, g, b); return [l + (r - l) * k, l + (g - l) * k, l + (b - l) * k]; };
  const contraste = (x, k) => 0.5 + (x - 0.5) * k, courbeS = x => x * x * (3 - 2 * x);
  BK.filtres = [
    { nom: 'Chaud', f: (r, g, b) => [r * 1.06 + .02, g * 1.01, b * .9] },
    { nom: 'Froid', f: (r, g, b) => [r * .92, g * 1.0, b * 1.08 + .02] },
    { nom: 'Vintage 70s', f: (r, g, b) => { [r, g, b] = sat(r, g, b, .8); return [.08 + r * .9 * 1.05, .06 + g * .88, .05 + b * .78]; } },
    { nom: 'Délavé', f: (r, g, b) => { [r, g, b] = sat(r, g, b, .75); return [.1 + r * .82, .1 + g * .82, .12 + b * .8]; } },
    { nom: 'Teal & orange', f: (r, g, b) => { const l = lum(r, g, b), t = courbeS(l); return [r * .85 + t * .2, g * .92 + .02, b * (1.15 - t * .35) + (1 - t) * .06]; } },
    { nom: 'Pop', f: (r, g, b) => sat(contraste(r, 1.15), contraste(g, 1.15), contraste(b, 1.15), 1.35) },
    { nom: 'Nuit', f: (r, g, b) => { [r, g, b] = sat(r, g, b, .7); return [r * .8, g * .88, b * 1.05 + .05]; } },
    { nom: 'Pellicule', f: (r, g, b) => { [r, g, b] = sat(r, g, b, .9); return [.03 + courbeS(r) * .95, .03 + courbeS(g) * .97 + .01, .06 + courbeS(b) * .85]; } },
    { nom: 'Noir & blanc', f: (r, g, b) => { const l = lum(r, g, b); return [l, l, l]; } },
    { nom: 'N&B contrasté', f: (r, g, b) => { const l = courbeS(contraste(lum(r, g, b), 1.2)); return [l, l, l]; } },
  ];
  const memo = {};
  BK.rendu.filtre = nom => {
    if (memo[nom]) return memo[nom];
    const F = BK.filtres.find(x => x.nom === nom); if (!F) return null;
    const n = 17, lignes = ['LUT_3D_SIZE ' + n];
    for (let b = 0; b < n; b++) for (let g = 0; g < n; g++) for (let r = 0; r < n; r++) {
      const o = F.f(r / (n - 1), g / (n - 1), b / (n - 1)); lignes.push(o.map(x => cl(x).toFixed(4)).join(' ')); }
    return memo[nom] = BK.rendu.lireCube(lignes.join('\n'));
  };
})();

// la même texture papier, pour les cartes de l'onglet Reels (CSS : var(--papier))
try { document.documentElement.style.setProperty('--papier', `url(${BK.rendu.papier().toDataURL('image/png')})`); } catch (e) {}
