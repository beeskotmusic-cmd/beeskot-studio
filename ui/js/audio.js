// =====================================================================
// BEESKOT Studio — outils AUDIO (lecture, forme d'onde, export WAV,
// changement de vitesse en gardant la note).
// Tout est fait par petits morceaux avec des pauses : l'ordinateur ne bloque jamais.
// =====================================================================
BK.audio = {
  ctx: null,
  contexte() { return BK.audio.ctx || (BK.audio.ctx = new (window.AudioContext || window.webkitAudioContext)()); },
  pause: () => new Promise(r => setTimeout(r, 0)),

  async decoder(octets) {
    const buf = octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength);
    return BK.audio.contexte().decodeAudioData(buf);
  },

  // forme d'onde : n colonnes (min, max) — calculée une fois
  pics(buffer, n) {
    const d = buffer.getChannelData(0), d2 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : d;
    const pas = Math.max(1, Math.floor(d.length / n)), out = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      let mn = 1, mx = -1; const a = i * pas, b = Math.min(d.length, a + pas);
      for (let j = a; j < b; j += 8) { const v = (d[j] + d2[j]) / 2; if (v < mn) mn = v; if (v > mx) mx = v; }
      out[i * 2] = mn; out[i * 2 + 1] = mx;
    }
    return out;
  },

  // découpe [debut, fin] (secondes) → tableaux Float32 par canal, avec fondus
  extraire(buffer, debut, fin, fonduEntree = 0, fonduSortie = 0) {
    const sr = buffer.sampleRate, a = Math.max(0, Math.round(debut * sr)), b = Math.min(buffer.length, Math.round(fin * sr));
    const canaux = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const x = buffer.getChannelData(c).slice(a, b), fi = Math.round(fonduEntree * sr), fo = Math.round(fonduSortie * sr);
      for (let i = 0; i < fi && i < x.length; i++) x[i] *= i / fi;
      for (let i = 0; i < fo && i < x.length; i++) x[x.length - 1 - i] *= i / fo;
      canaux.push(x);
    }
    return canaux;
  },

  // changer la vitesse. garderNote = true : même hauteur (méthode WSOLA) ; false : comme un disque
  async vitesse(canaux, sr, v, garderNote, progression) {
    if (Math.abs(v - 1) < 1e-4) return canaux;
    if (!garderNote) {                                     // simple ré-échantillonnage
      return canaux.map(x => { const n = Math.floor(x.length / v), y = new Float32Array(n);
        for (let i = 0; i < n; i++) { const p = i * v, k = Math.floor(p), f = p - k; y[i] = (x[k] || 0) * (1 - f) + (x[k + 1] || 0) * f; } return y; });
    }
    const W = Math.round(sr * 0.046) & ~1, Ha = W / 2, Hs = Ha * v, tol = Math.round(sr * 0.012);
    const L = canaux[0].length, nOut = Math.floor(L / v) + W, fen = new Float32Array(W);
    for (let i = 0; i < W; i++) fen[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / W);
    const mono = new Float32Array(L);
    for (const x of canaux) for (let i = 0; i < L; i++) mono[i] += x[i] / canaux.length;
    const out = canaux.map(() => new Float32Array(nOut)), poids = new Float32Array(nOut);
    let prec = 0, k = 0;
    for (let o = 0; o + W < nOut; o += Ha, k++) {
      const cible = Math.round(k * Hs);
      if (cible + W + tol >= L) break;
      let meilleur = cible;
      if (k > 0) {                                         // chercher le décalage qui raccorde le mieux
        const ref = prec + Ha; let best = -Infinity;
        for (let d = -tol; d <= tol; d += 4) {
          const s = cible + d; if (s < 0) continue; let c = 0;
          for (let i = 0; i < W / 2; i += 8) c += mono[ref + i] * mono[s + i];
          if (c > best) { best = c; meilleur = s; }
        }
      }
      for (let ch = 0; ch < canaux.length; ch++) { const x = canaux[ch], y = out[ch]; for (let i = 0; i < W; i++) y[o + i] += x[meilleur + i] * fen[i]; }
      for (let i = 0; i < W; i++) poids[o + i] += fen[i];
      prec = meilleur;
      if (k % 150 === 0) { progression && progression(cible / L); await BK.audio.pause(); }   // laisser respirer l'ordinateur
    }
    const n = Math.floor(L / v);
    return out.map(y => { const z = new Float32Array(n); for (let i = 0; i < n; i++) z[i] = poids[i] > 1e-3 ? y[i] / poids[i] : 0; return z; });
  },

  // WAV 24 bits (comme les exports Ableton)
  wav(canaux, sr) {
    const n = canaux[0].length, nc = canaux.length, oct = 3, taille = 44 + n * nc * oct;
    const buf = new ArrayBuffer(taille), v = new DataView(buf);
    const t = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    t(0, 'RIFF'); v.setUint32(4, taille - 8, true); t(8, 'WAVE'); t(12, 'fmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, nc, true); v.setUint32(24, sr, true); v.setUint32(28, sr * nc * oct, true);
    v.setUint16(32, nc * oct, true); v.setUint16(34, 24, true); t(36, 'data'); v.setUint32(40, n * nc * oct, true);
    let p = 44;
    for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) {
      const s = Math.max(-1, Math.min(1, canaux[c][i])), x = Math.round(s < 0 ? s * 0x800000 : s * 0x7FFFFF);
      v.setUint8(p, x & 255); v.setUint8(p + 1, (x >> 8) & 255); v.setUint8(p + 2, (x >> 16) & 255); p += 3;
    }
    return new Uint8Array(buf);
  },

  // ---------- analyser un morceau : durée, tempo (BPM), tonalité (estimation) ----------
  async analyser(buffer, progression = () => {}) {
    const sr0 = buffer.sampleRate, k = Math.max(1, Math.round(sr0 / 11025)), sr = sr0 / k;
    const d0 = buffer.getChannelData(0), d1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : d0;
    const debut = Math.max(0, Math.floor(buffer.length / 2 - 45 * sr0)), fin = Math.min(buffer.length, debut + 90 * sr0);   // 90 s au milieu
    const x = new Float32Array(Math.floor((fin - debut) / k));
    for (let i = 0; i < x.length; i++) { let s = 0; const a = debut + i * k; for (let j = 0; j < k; j++) s += d0[a + j] + d1[a + j]; x[i] = s / (2 * k); }
    await BK.audio.pause(); progression(0.2);
    // tempo : enveloppe des attaques, puis on cherche la période qui se répète le mieux
    const hop = 128, n = Math.floor(x.length / hop) - 1, env = new Float32Array(n); let prec = 0;
    for (let i = 0; i < n; i++) { let e = 0; for (let j = 0; j < hop; j++) { const v = x[i * hop + j]; e += v * v; } e = Math.log(1e-9 + e); env[i] = Math.max(0, e - prec); prec = e; }
    const fps = sr / hop, lmin = Math.floor(fps * 60 / 200), lmax = Math.ceil(fps * 60 / 60);
    let best = 0, lag = lmin;
    for (let L = lmin; L <= lmax; L++) { let c = 0; for (let i = 0; i + L < n; i++) c += env[i] * env[i + L]; c /= (n - L); const bpm = 60 * fps / L, poids = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 115), 2) / 0.36); if (c * poids > best) { best = c * poids; lag = L; } }
    // affiner autour du meilleur décalage
    // affiner sur 8 temps (plus précis) : on cherche la meilleure période autour de 8 × le décalage trouvé
    let bpm = 60 * fps / lag;
    { const M = 8; let b2 = -1, l2 = lag * M;
      for (let L = lag * M - M; L <= lag * M + M; L += 0.1) { let c = 0; for (let i = 0; i + Math.ceil(L) + 1 < n; i++) { const f = i + L, a = Math.floor(f), t = f - a; c += env[i] * (env[a] * (1 - t) + env[a + 1] * t); } if (c > b2) { b2 = c; l2 = L; } }
      bpm = 60 * fps * M / l2; }
    await BK.audio.pause(); progression(0.5);
    // tonalité : énergie de chaque note (do, do#…), comparée aux profils majeur / mineur
    const N = 4096, chroma = new Float64Array(12), fen = new Float32Array(N).map((_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let a = 0, t = 0; a + N < x.length; a += N * 2, t++) {
      for (let i = 0; i < N; i++) { re[i] = x[a + i] * fen[i]; im[i] = 0; }
      BK.audio.fft(re, im);
      for (let b = 1; b < N / 2; b++) { const f = b * sr / N; if (f < 55 || f > 2000) continue; const note = Math.round(12 * Math.log2(f / 440)) + 69; chroma[((note % 12) + 12) % 12] += Math.hypot(re[b], im[b]); }
      if (t % 8 === 0) await BK.audio.pause();
    }
    const MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88], MIN = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
    const corr = (p, r) => { const mx = chroma.reduce((s, v) => s + v, 0) / 12, mp = p.reduce((s, v) => s + v, 0) / 12; let a = 0, b = 0, c = 0; for (let i = 0; i < 12; i++) { const u = chroma[(i + r) % 12] - mx, v = p[i] - mp; a += u * v; b += u * u; c += v * v; } return a / Math.sqrt(b * c || 1); };
    let tb = -2, ton = '';
    const NOMS = ['Do', 'Do#', 'Ré', 'Mib', 'Mi', 'Fa', 'Fa#', 'Sol', 'Lab', 'La', 'Sib', 'Si'];
    for (let r = 0; r < 12; r++) { const a = corr(MAJ, r), b = corr(MIN, r); if (a > tb) { tb = a; ton = NOMS[r] + ' majeur'; } if (b > tb) { tb = b; ton = NOMS[r] + ' mineur'; } }
    progression(1);
    const dur = buffer.duration;
    const b = Math.abs(bpm - Math.round(bpm)) < 0.35 ? Math.round(bpm) : Math.round(bpm * 10) / 10;
    return { duree: `${Math.floor(dur / 60)}:${String(Math.round(dur % 60)).padStart(2, '0')}`, bpm: b, ton };
  },
  fft(re, im) {                                          // transformée de Fourier (sur place)
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
    for (let l = 2; l <= n; l <<= 1) { const a = -2 * Math.PI / l, wr = Math.cos(a), wi = Math.sin(a);
      for (let i = 0; i < n; i += l) { let cr = 1, ci = 0; for (let j = 0; j < l / 2; j++) { const k = i + j + l / 2, tr = re[k] * cr - im[k] * ci, ti = re[k] * ci + im[k] * cr;
        re[k] = re[i + j] - tr; im[k] = im[i + j] - ti; re[i + j] += tr; im[i + j] += ti; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } } }
  },

  temps(s) { if (!isFinite(s)) s = 0; const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r.toFixed(1).padStart(4, '0')}`; },
};
