// =====================================================================
// LIGHT TOAST — le son : la musique + les stems qu'on écoute.
// Pendant la lecture, c'est LE SON qui donne l'heure (l'image suit la musique).
// Vitesse 1 = normal ; 2, 4… = plus vite (le son monte) ; en arrière = sans son.
// =====================================================================
(function (G) {
const LT = G.LT;
class Son {
  constructor() { this.ctx = null; this.musique = null; this.stems = new Map(); this.sources = []; this.muet = false; }
  contexte() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); return this.ctx; }
  async decoder(octets) { return this.contexte().decodeAudioData(octets.slice ? octets.slice(0) : octets); }
  canaux(buf) { return Array.from({ length: buf.numberOfChannels }, (_, i) => buf.getChannelData(i)); }
  // lance la lecture à partir de t (secondes).
  // dc = le décompte { debut, fin, temps, coups, clic } : pendant ce temps-là, seulement le clic (pas de musique)
  jouer(t, vitesse = 1, dc = null) {
    this.arreter(); if (vitesse <= 0) return false;
    const c = this.contexte(); if (c.state === 'suspended') c.resume();
    const now = c.currentTime + .03, quand = x => now + Math.max(0, x - t) / vitesse;
    const lancer = (buf, de, a, b) => {   // joue buf de la position a à la position b (temps du morceau), départ à « de »
      if (!buf || a >= buf.duration || (b != null && b <= a)) return;
      const s = c.createBufferSource(); s.buffer = buf; s.playbackRate.value = vitesse; s.connect(c.destination);
      s.start(quand(de), a); if (b != null) s.stop(quand(de) + (b - a) / vitesse); this.sources.push(s);
    };
    const piste = buf => {
      if (!dc) return lancer(buf, t, Math.max(0, t));
      if (t < dc.debut) lancer(buf, t, Math.max(0, t), dc.debut);     // avant le décompte : la musique normale
      lancer(buf, Math.max(t, dc.fin), Math.max(t, dc.fin));            // après : la musique repart au début
    };
    if (!this.muet) piste(this.musique);
    this.stems.forEach(s => s.ecoute && piste(s.buf));
    if (dc && dc.clic && t < dc.fin) { const b = this.clic(dc); lancer(b, Math.max(t, dc.debut), Math.max(0, t - dc.debut)); }
    this.depart = { ctx: now, t, v: vitesse };
    return true;
  }
  // le clic du décompte (premier coup plus aigu), comme le pré-clic de Reels Audio
  clic(dc) {
    const c = this.contexte(), sr = c.sampleRate, cle = dc.coups + '|' + dc.temps;
    if (this._clic && this._clic.cle === cle) return this._clic.buf;
    const n = Math.ceil(dc.coups * dc.temps * sr) + 1, buf = c.createBuffer(1, n, sr), x = buf.getChannelData(0);
    for (let k = 0; k < dc.coups; k++) {
      const a = Math.round(k * dc.temps * sr), f = k === 0 ? 2000 : 1400, L = Math.round(.04 * sr);
      for (let i = 0; i < L && a + i < n; i++) x[a + i] = Math.sin(2 * Math.PI * f * i / sr) * Math.exp(-i / (.008 * sr)) * .7;
    }
    this._clic = { cle, buf }; return buf;
  }
  temps() { const d = this.depart; return d ? d.t + Math.max(0, this.ctx.currentTime - d.ctx) * d.v : 0; }
  arreter() { this.sources.forEach(s => { try { s.stop(); } catch (e) {} }); this.sources = []; this.depart = null; }
}
LT.Son = Son;

// ---------- d'où vient la musique ----------
// Ce bloc marche seul (fichier du PC). Dans BEESKOT Studio, il est remplacé pour proposer
// aussi la Bibliothèque (morceau → version), Médias et les passages de « Reels Audio ».
//   choisirMusique() → { nom, octets, morceau? }      choisirStems() → [{ nom, octets }]
//   passages(morceau) → [{ debut, fin, nom }]
const fichiers = multiple => new Promise(res => {
  const i = Object.assign(document.createElement('input'), { type: 'file', accept: 'audio/*', multiple });
  i.onchange = async () => res(await Promise.all([...i.files].map(async f => ({ nom: f.name.replace(/\.[^.]+$/, ''), octets: await f.arrayBuffer() }))));
  i.click();
});
LT.sources = LT.sources || {
  async choisirMusique() { return (await fichiers(false))[0] || null; },
  async choisirStems() { return fichiers(true); },
  async passages() { return []; },
  // les POSES des membres (fichiers Mixamo .fbx : batterie, piano, guitare, basse, chant).
  // Rangées hors du dépôt public (licence Mixamo) : dans DBS elles viennent du Drive BEESKOT ;
  // ici, on les choisit sur le PC (bouton « Charger les poses »). poses() → { batterie: octets, … } ou null
  async poses() { return null; },
  // les vrais modèles 3D (personnes, instruments) : un dossier « modeles/ » avec liste.json + les fichiers .glb
  modeles: {
    base: 'modeles/',
    async liste() { const r = await fetch(this.base + 'liste.json', { cache: 'no-store' }); return r.ok ? r.json() : null; },
    async fichier(nom) { const r = await fetch(this.base + nom); if (!r.ok) throw new Error(nom + ' introuvable'); return r.arrayBuffer(); },
  },
};
})(typeof self !== 'undefined' ? self : this);
