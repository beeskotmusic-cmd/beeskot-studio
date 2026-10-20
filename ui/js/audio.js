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

  temps(s) { if (!isFinite(s)) s = 0; const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r.toFixed(1).padStart(4, '0')}`; },
};
