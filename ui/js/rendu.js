// =====================================================================
// RENDU VIDÉO — dessine une image du reel : vidéo recadrée (zoom + position),
// couleur (LUT .cube), puis sous-titres. Le même dessin sert à l'aperçu ET à l'export MP4.
// =====================================================================
BK.rendu = {
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
      lut(l) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tLut);
        if (l) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, l.n * l.n, l.n, 0, gl.RGBA, gl.UNSIGNED_BYTE, l.px); this.n = l ? l.n : 0; },
      // video : élément <video> ; cadre : { zoom (1 = remplit), x, y (en % du cadre) } ; sous : texte à afficher ; style des sous-titres
      dessiner(video, cadre, force, sous) {
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
        ctx.drawImage(cv, 0, 0);
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
  async exporter({ video, debut, fin, cadre, force, lut, sous, audio, progression }) {
    if (!window.VideoEncoder) throw new Error('Cet ordinateur ne sait pas encoder la vidéo');
    const L = 1080, H = 1920, fps = 30, r = BK.rendu.creer(L, H); r.lut(lut);
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
      r.dessiner(video, cadre, force, BK.rendu.texteA(sous, k / fps));
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
