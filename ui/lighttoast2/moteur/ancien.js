// =====================================================================
// LIGHT TOAST — ouvrir un projet de l'ANCIEN Light Toast (v1, fichiers « pulse-led » .json).
//
//   ancien projet                        →  projet TOAST2
//   pal (palette)                        →  palette
//   secs (sections, couleurs par tube)   →  calques de Couleur (un clip par couleur et par section, fondu 0,6 s)
//   secs.fx (plasma, bougie, ondes…)     →  un overlay sur la piste « Fonds » pendant la section
//   manual + ptypes (pêches)             →  pêches + types de pêche
//   fxev + etypes (effets posés)         →  clips d'effets en mode Lumière (l'effet le plus proche)
//   lpts / epts / ppts / spts (courbes)  →  luminosité générale / force des effets / pêches / vitesse
//   audio (la musique, dans le fichier)  →  LT.ancien.musique(o) rend ses octets
//
// Pas repris : les automations (autos), la dynamique (dpts), « ce tube suit la courbe » (lm), les réglages fins des effets.
// Bandes de l'ancien, de gauche à droite : tube 1, tube 2, le panneau (3), tube 4, tube 5 → t1, t2, p1, t3, t4.
// =====================================================================
(function (G) {
const LT = G.LT, Z = ['t1', 't2', 'p1', 't3', 't4'];   // les 5 bandes de l'ancien, de gauche à droite
// l'effet le plus proche dans TOAST2 : [effet, réglages]
const EFFETS = {
  sunrise: et => ['sunrise', { sens: et.top ? 'bas' : 'haut' }], flicker: () => ['scintille', { div: 4 }], sweep: () => ['balayage', {}], wrap: () => ['balayage', {}],
  shot: et => ['projectile', { depart: et.top ? 'haut' : 'bas' }], dots: () => ['points', {}], scan: () => ['scanner', {}], bars: () => ['codebarres', {}], candle: () => ['flamme', {}],
};
const FONDS = { plasma: 'plasma', candle: 'flamme', ripples: 'ondes', rain: 'pluie', grain: 'grain', noise: 'grain', gradient: 'degrade', breathe: 'respire' };
const HOLDK = ['sunrise', 'dots', 'scan', 'bars', 'candle', 'wrap'];
const hex = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null;

LT.ancien = {
  est(o) { return !!o && (o.app === 'pulse-led' || (Array.isArray(o.secs) && !o.format)); },
  // la musique rangée dans le fichier (base64) → octets, ou null
  musique(o) {
    if (!o || typeof o.audio !== 'string' || !o.audio) return null;
    const b = atob(o.audio.replace(/^data:[^,]*,/, '')), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer;
  },
  // o = l'ancien projet ; duree = la durée de la musique (secondes) → { projet, notes: [ce qui n'a pas pu être repris tel quel] }
  convertir(o, duree) {
    const nom = String(o.reel || o.audioName || 'Ancien projet').replace(/\.[^.]+$/, ''), P = LT.projet.nouveau(nom), notes = [];
    const pal = (o.pal || []).map(hex).filter(Boolean), col = n => n === -1 ? '#000000' : n === -2 ? '#ffffff' : hex(n) || pal[Math.max(0, Math.min(pal.length - 1, n | 0))] || '#000000';
    const secs = (o.secs || []).slice().sort((a, b) => a.a - b.a);
    duree = duree || Math.max(1, ...secs.map(s => +s.b || 0)) ; P.duree = duree; if (pal.length) P.palette = pal.slice(0, 12);
    // --- les sections : couleurs par tube + le fond ---
    P.couleur.clips = []; const fonds = { id: LT.id(), nom: 'Fonds', clips: [] };
    secs.forEach((s, i) => {
      const a = Math.max(0, +s.a || 0), b = Math.min(duree, i < secs.length - 1 ? secs[i + 1].a : duree); if (b <= a) return;
      const g = Array.isArray(s.g) && s.g.length === 5 ? s.g : [0, 1, 2, 3, 4], chef = k => g.indexOf(g[k]);
      const paire = k => (s.sb && Array.isArray(s.ks) && s.ks[chef(k)]) || s.k || [0, 0], parCouleur = {};
      Z.forEach((z, k) => { const c = col(paire(k)[0]); (parCouleur[c] = parCouleur[c] || []).push(z); });
      for (const [c, zones] of Object.entries(parCouleur)) P.couleur.clips.push({ id: LT.id(), debut: a, fin: b, couleur: c, zones, entree: i ? Math.min(.6, b - a) : 0, sortie: 0 });
      const f = FONDS[s.fx]; if (!f && s.fx) notes.push('fond « ' + s.fx + ' » remplacé par Plasma');
      const allumes = Z.filter((z, k) => col(paire(k)[0]) !== '#000000');
      if (allumes.length) fonds.clips.push(Object.assign(LT.projet.nouvelEffet(f || 'plasma', a, b, P), { zones: allumes.length === Z.length ? null : allumes, eclat: .35 }));
    });
    if (!P.couleur.clips.length) P.couleur.clips.push({ id: LT.id(), debut: 0, fin: duree, couleur: P.palette[0], zones: Z.slice(), entree: 0, sortie: 0 });
    P.effets = [fonds];
    // --- les pêches ---
    const zonesDe = t => { const l = Z.filter((z, k) => !Array.isArray(t.tubes) || t.tubes[k] !== false); return l.length === Z.length || !l.length ? null : l; };
    P.peches.types = (o.ptypes || []).map((t, k) => ({ id: 'a' + k, nom: t.name || 'Pêche ' + (k + 1), eclair: hex(t.e) || '#ffffff', flash: hex(t.f) || '#ffffff',
      ed: +t.ed || 30, fd: +t.fd || 250, h: Math.max(.05, Math.min(1, (+t.h || 100) / 100)), ancre: ['b', 'm', 't'].includes(t.an) ? t.an : t.top ? 't' : 'b', zones: zonesDe(t) }));
    if (!P.peches.types.length) P.peches.types = LT.projet.nouveau().peches.types;
    if ((o.ptypes || []).some(t => t.same === false)) notes.push('pêches avec une couleur différente par tube : une seule couleur gardée');
    P.peches.clips = (o.manual || []).filter(m => isFinite(m.t) && m.t >= 0 && m.t <= duree).map(m => ({ id: LT.id(), t: +m.t, type: (P.peches.types[m.c] || P.peches.types[0]).id }));
    // --- les effets posés : sur des pistes au-dessus des fonds, sans chevauchement ---
    const pistes = [], vus = new Set();
    for (const ev of (o.fxev || []).slice().sort((a, b) => a.t - b.t)) {
      const et = (o.etypes || [])[ev.e]; if (!et || !isFinite(ev.t)) continue;
      const rise = Math.max(.05, ev.r != null ? +ev.r : +et.rise || .1), h = ev.h != null ? +ev.h : null;
      const hold = h != null && HOLDK.includes(et.k) ? h : +et.hold || 0, fade = h != null && (et.k === 'flicker' || et.k === 'shot') ? h : +et.fade || 0;
      const tot = et.k === 'sweep' ? rise : et.k === 'flicker' ? rise + fade : et.k === 'shot' ? Math.max(rise, fade) : rise + Math.max(et.k === 'sunrise' ? 0 : .05, hold) + fade;
      const [effet, reg] = (EFFETS[et.k] || EFFETS.sunrise)(et), debut = Math.max(0, +ev.t), fin = Math.min(duree, debut + Math.max(.1, tot)); if (fin <= debut) continue;
      if (!EFFETS[et.k] && !vus.has(et.k)) { vus.add(et.k); notes.push('effet « ' + et.k + ' » remplacé par Sunrise'); }
      const c = Object.assign(LT.projet.nouvelEffet(effet, debut, fin, P), { zones: zonesDe(et), mode: LT.effets[effet].sorte === 'mouvement' ? 'lumiere' : 'masque',
        couleur: hex(et.c) || '#ffffff', sortie: Math.min(fade, (fin - debut) / 2), reglages: Object.assign({}, reg, effet === 'sunrise' ? { montee: Math.min(.95, rise / (fin - debut)) } : null) });
      let p = pistes.find(x => !x.clips.some(y => y.debut < fin && y.fin > debut)); if (!p) { p = { id: LT.id(), nom: 'Effets ' + (pistes.length + 1), clips: [] }; pistes.push(p); }
      p.clips.push(c);
    }
    P.effets.push(...pistes); if (!pistes.length) P.effets.push({ id: LT.id(), nom: 'Effets 1', clips: [] });
    // --- les courbes ---
    const pts = a => (Array.isArray(a) ? a : []).filter(p => isFinite(p.t) && isFinite(p.v)).map(p => ({ t: +p.t, v: Math.max(0, Math.min(1, +p.v)) })).sort((x, y) => x.t - y.t);
    P.courbes = { lum: pts(o.lpts), elum: pts(o.epts), plum: pts(o.ppts), vitesse: pts(o.spts) };
    if ((o.autos || []).length) notes.push(o.autos.length + ' automation(s) non reprise(s)');
    P.musique = o.audioName ? { nom: String(o.audioName).replace(/\.[^.]+$/, ''), morceau: null, version: null, passage: null } : null;
    P.ancien = { fichier: o.audioName || '', reel: o.reel || '' };
    return { projet: P, notes: [...new Set(notes)] };
  },
};
})(typeof self !== 'undefined' ? self : this);
