// =====================================================================
// LIGHT TOAST — l'EXPORT : la vidéo .mp4 pour les lumières (les mêmes images que le moniteur « Tubes »).
//
//   projet ──▶ une copie figée ──▶ un moteur à part ──▶ image par image ──▶ encodeur vidéo ──▶ .mp4
//                                                        (+ la musique et le clic du décompte, si demandé)
//
// Tout se fait en fond, par petits bouts, avec des pauses : on peut continuer à travailler, le PC n'est jamais bloqué.
//   LT.exporter(m, { debut, fin, ips, son, progression(0…1), arret: () => true pour annuler }) → { mp4 (Uint8Array), son (vrai si le son est dedans) } ou null si annulé
// =====================================================================
(function (G) {
const LT = G.LT, pause = ms => new Promise(ok => setTimeout(ok, ms));

LT.exporter = async function (m, { debut, fin, ips = 30, son = true, progression, arret, vitesse = 1 } = {}) {   // vitesse ≠ 1 : à la vitesse du tournage (×0,5 = 2 fois plus long)
  if (!G.VideoEncoder || !G.Mp4Muxer) throw new Error('cet ordinateur ne sait pas encoder la vidéo');
  const P = JSON.parse(JSON.stringify(m.projet)), moteur = new LT.Moteur(P), L = P.materiel.largeur || 1920, H = P.materiel.hauteur || 1080;
  debut = debut ?? m.debutMin(); fin = fin ?? m.duree(); if (!(fin > debut)) throw new Error('rien à exporter');
  const v = vitesse > 0 ? vitesse : 1, total = Math.ceil((fin - debut) / v * ips), debit = 10e6;
  let codec = 'avc1.640028', mux = 'avc';
  if (!(await VideoEncoder.isConfigSupported({ codec, width: L, height: H, bitrate: debit, framerate: ips })).supported) { codec = 'vp09.00.40.08'; mux = 'vp9'; }
  // --- le son : la musique à sa place, plus le clic du décompte si la case « dans la vidéo » est cochée ---
  let audio = null;
  const musique = m.son.musique, f = LT.decompte.fenetre(P), clic = f && P.decompte.son && fin > f.debut && debut < f.fin ? m.son.clic(f) : null;
  if (son && (musique || clic) && G.AudioEncoder) {
    const sr = (musique || clic).sampleRate, nc = musique ? Math.min(2, musique.numberOfChannels) : 1, n = Math.round((fin - debut) / v * sr);
    if ((await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: sr, numberOfChannels: nc, bitrate: 192000 })).supported) {
      audio = { sr, nc, n, voies: Array.from({ length: nc }, () => new Float32Array(n)) };
      const poser = (buf, t0, saufAvant) => {   // pose un son à l'instant t0 du projet
        if (v !== 1) {   // à la vitesse du tournage : le son est étiré (comme à la lecture : plus grave quand c'est plus lent)
          const bs = buf.sampleRate; for (let c = 0; c < nc; c++) { const src = buf.getChannelData(Math.min(c, buf.numberOfChannels - 1)), out = audio.voies[c];
            for (let i = 0; i < n; i++) { const tp = debut + i * v / sr; if (saufAvant && tp < saufAvant) continue; const s = (tp - t0) * bs, j = Math.floor(s); if (j < 0 || j + 1 >= src.length) continue; out[i] += src[j] + (src[j + 1] - src[j]) * (s - j); } }
          return;
        }
        const a = Math.round((t0 - debut) * sr);
        for (let c = 0; c < nc; c++) { const src = buf.getChannelData(Math.min(c, buf.numberOfChannels - 1)), out = audio.voies[c];
          for (let i = Math.max(0, -a, saufAvant ? Math.round((saufAvant - t0) * sr) : 0); i < src.length && a + i < n; i++) out[a + i] += src[i]; } };
      if (musique) poser(musique, 0, f && f.fin > 0 ? f.fin : 0);   // pendant le décompte : pas de musique, comme à la lecture
      if (clic) poser(clic, f.debut);
    }
  }
  const muxer = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), fastStart: 'in-memory', video: { codec: mux, width: L, height: H },
    ...(audio ? { audio: { codec: 'aac', sampleRate: audio.sr, numberOfChannels: audio.nc } } : {}) });
  let erreur = null;
  const venc = new VideoEncoder({ output: (c, meta) => muxer.addVideoChunk(c, meta), error: e => { erreur = e; } });
  venc.configure({ codec, width: L, height: H, bitrate: debit, framerate: ips });
  const cv = document.createElement('canvas'); cv.width = L; cv.height = H; const cx = cv.getContext('2d');
  for (let k = 0; k < total; k++) {
    if (erreur) throw erreur;
    if (arret && arret()) { try { venc.close(); } catch (e) { } return null; }
    moteur.rendre(debut + k / ips * v); moteur.dessiner(cx, L, H);
    const img = new VideoFrame(cv, { timestamp: Math.round(k * 1e6 / ips), duration: Math.round(1e6 / ips) });
    venc.encode(img, { keyFrame: k % (ips * 2) === 0 }); img.close();
    while (venc.encodeQueueSize > 4) await pause(12);              // on attend l'encodeur plutôt que d'empiler
    if (k % 3 === 0) { progression && progression(k / total * (audio ? .95 : 1)); await pause(document.hidden ? 0 : 4); }   // on laisse respirer le PC
  }
  await venc.flush(); venc.close(); if (erreur) throw erreur;
  if (audio) {
    const aenc = new AudioEncoder({ output: (c, meta) => muxer.addAudioChunk(c, meta), error: e => { erreur = e; } });
    aenc.configure({ codec: 'mp4a.40.2', sampleRate: audio.sr, numberOfChannels: audio.nc, bitrate: 192000 });
    const pas = 1024 * 8;
    for (let i = 0, tour = 0; i < audio.n; i += pas, tour++) {
      const q = Math.min(pas, audio.n - i), plan = new Float32Array(q * audio.nc);
      for (let c = 0; c < audio.nc; c++) plan.set(audio.voies[c].subarray(i, i + q), c * q);
      const d = new AudioData({ format: 'f32-planar', sampleRate: audio.sr, numberOfFrames: q, numberOfChannels: audio.nc, timestamp: Math.round(i / audio.sr * 1e6), data: plan });
      aenc.encode(d); d.close();
      if (tour % 40 === 0) { if (arret && arret()) { try { aenc.close(); } catch (e) { } return null; } await pause(2); }
    }
    await aenc.flush(); aenc.close(); if (erreur) throw erreur;
  }
  muxer.finalize(); progression && progression(1);
  return { mp4: new Uint8Array(muxer.target.buffer), son: !!audio };
};
})(typeof self !== 'undefined' ? self : this);
