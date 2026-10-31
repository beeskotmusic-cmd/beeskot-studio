// =====================================================================
// ITINÉRAIRE D'UN TOURNAGE — l'ordre le plus court pour faire tous les plans d'une journée,
// sans repasser deux fois au même endroit.
//   Chaque plan du découpage a un « Lieu » (une adresse). On regroupe les plans par lieu, on trouve où est chaque
//   adresse (OpenStreetMap : gratuit, sans compte), on calcule l'ordre le plus court, et on le range DANS la fiche
//   du tournage (tr.itineraire) : le PDF et le téléphone n'ont rien à recalculer, ils lisent la fiche.
//   BK.itineraire.vue(tr, reels)        → ce qu'il faut afficher (PC, PDF, téléphone) : { etapes, hors, liens, km, … }
//   BK.itineraire.calculer(tr, reels)   → (PC seulement : Internet) trouve les adresses + l'ordre, renvoie tr.itineraire
// Les distances sont à vol d'oiseau (suffisant en ville pour choisir l'ordre) ; Google Maps calcule la vraie route.
// =====================================================================
(() => {
const norm = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const cleDe = s => norm(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// une adresse écrite dans les notes (« 1234 rue Saint-Denis, Montréal ») : repérée seulement si le plan n'a pas de Lieu
const RE_ADR = /\b\d{1,5}[a-z]?(?:\s*[-–]\s*\d{1,5})?,?\s+(?:rue|avenue|av\.?|boulevard|boul\.?|bd|chemin|ch\.?|place|pl\.?|rang|route|rte|impasse|all[ée]e|cours|quai|passage)\b[^\n;,]{0,40}/i;
const RE_VILLE = /^,\s*([A-ZÀ-Ý][\p{L}'-]+(?:\s+[A-ZÀ-Ý][\p{L}'-]+)?)/u;            // « , Montréal » juste derrière l'adresse
const R = Math.PI / 180;
let derniereRequete = 0;
const pause = ms => new Promise(r => setTimeout(r, ms));

const I = BK.itineraire = {
  norm, cleDe,
  lieuDe(p) { if (!p) return ''; const l = norm(p.lieu); if (l) return l; const t = String(p.notes || ''), m = t.match(RE_ADR); if (!m) return '';
    const ville = t.slice(m.index + m[0].length).match(RE_VILLE); return norm(m[0]).replace(/[\s.,]+$/, '') + (ville ? ', ' + ville[1] : ''); },
  // les lieux d'une journée, dans l'ordre où ils apparaissent : [{ cle, lieu, plans: [{ reel, n, cadrage }] }]
  arrets(tr, reels) {
    const m = new Map();
    const ajout = (x, nom) => (x.plans || []).forEach((p, i) => { const l = I.lieuDe(p); if (!l) return; const k = cleDe(l);
      if (!m.has(k)) m.set(k, { cle: k, lieu: l, plans: [] }); m.get(k).plans.push({ reel: nom, n: i + 1, cadrage: p.cadrage || '' }); });
    ajout(tr, ''); (reels || []).forEach(r => ajout(r, r.titre || 'Reel'));
    return [...m.values()];
  },
  // combien de plans n'ont pas (encore) de lieu
  sansLieu(tr, reels) { return [tr, ...(reels || [])].reduce((n, x) => n + (x.plans || []).filter(p => !I.lieuDe(p) && (p.action || p.cadrage || p.notes)).length, 0); },
  sig: (arrets, depart) => arrets.map(a => a.cle).sort().join('|') + '>' + cleDe(depart),
  km(a, b) { const dLat = (b.lat - a.lat) * R, dLon = (b.lon - a.lon) * R, x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * R) * Math.cos(b.lat * R) * Math.sin(dLon / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); },

  // l'ordre le plus court pour passer par tous les points (un chemin, pas une boucle) ; « dep » = le point de départ s'il y en a un
  ordre(pts, dep) {
    const n = pts.length; if (n < 2) return pts.map(p => p.cle);
    const long = o => { let s = 0, prev = dep || null; for (const i of o) { if (prev) s += I.km(prev, pts[i]); prev = pts[i]; } return s; };
    let meilleur = null, mL = Infinity; const essai = o => { const l = long(o); if (l < mL - 1e-9) { mL = l; meilleur = o.slice(); } };
    if (n <= 8) {                                                           // peu de lieux : on essaie tous les ordres (exact)
      const o = [...Array(n).keys()], perm = k => { if (k === n) return essai(o);
        for (let i = k; i < n; i++) { [o[k], o[i]] = [o[i], o[k]]; perm(k + 1); [o[k], o[i]] = [o[i], o[k]]; } };
      perm(0);
    } else {                                                                // beaucoup de lieux : le plus proche voisin, puis on défait les croisements (2-opt)
      for (let s = 0; s < n; s++) { const o = [s], vu = new Set(o);
        while (o.length < n) { const l = o[o.length - 1]; let b = -1, bd = Infinity; for (let j = 0; j < n; j++) if (!vu.has(j)) { const d = I.km(pts[l], pts[j]); if (d < bd) { bd = d; b = j; } } o.push(b); vu.add(b); }
        let o2 = o, mieux = true;
        while (mieux) { mieux = false; const l0 = long(o2);
          for (let i = 0; i < n - 1 && !mieux; i++) for (let j = i + 1; j < n && !mieux; j++) { const c = o2.slice(0, i).concat(o2.slice(i, j + 1).reverse(), o2.slice(j + 1)); if (long(c) < l0 - 1e-9) { o2 = c; mieux = true; } } }
        essai(o2); }
    }
    return meilleur.map(i => pts[i].cle);
  },

  // OpenStreetMap (Nominatim) : une adresse → un point. Une requête par seconde au maximum (c'est leur règle).
  async chercher(adresse) {
    const essais = [norm(adresse)]; if (!/montr[ée]al|qu[ée]bec|laval|longueuil/i.test(adresse)) essais.push(norm(adresse) + ', Montréal');
    for (const q of essais) {
      const attente = 1100 - (Date.now() - derniereRequete); if (attente > 0) await pause(attente); derniereRequete = Date.now();
      const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=fr&q=' + encodeURIComponent(q), { headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error('OpenStreetMap ne répond pas (' + r.status + ')');
      const j = await r.json(); if (j && j[0]) return { lat: +j[0].lat, lon: +j[0].lon, nom: String(j[0].display_name || '').slice(0, 120) };
    }
    return null;
  },
  // trouve les adresses, calcule l'ordre, range le tout dans tr.itineraire (à enregistrer ensuite avec BK.db.ecrire)
  async calculer(tr, reels, surEtape) {
    const ar = I.arrets(tr, reels); if (!ar.length) throw new Error('Aucun lieu dans le découpage');
    const cache = (await BK.partage.lire('geocode', {}).catch(() => ({}))) || {}; let change = false, i = 0;
    const total = ar.length + (norm(tr.depart) ? 1 : 0);
    const trouver = async (cle, texte) => { surEtape && surEtape(++i, total, texte);
      let g = cache[cle]; if (!g) { g = await I.chercher(texte); if (g) { cache[cle] = g; change = true; } }
      return g ? { lat: g.lat, lon: g.lon } : null; };
    let dep = null; if (norm(tr.depart)) dep = await trouver('depart:' + cleDe(tr.depart), tr.depart);
    const pts = {}; for (const a of ar) pts[a.cle] = await trouver(a.cle, a.lieu);
    if (change) BK.partage.ecrire('geocode', cache).catch(() => {});
    // deux écritures du même endroit (« 12 rue A » et « Rue A ») tombent au même point : une seule étape (à moins de 40 m)
    const trouves = [], groupes = {};
    for (const a of ar) { if (!pts[a.cle]) continue; const m = trouves.find(x => I.km(x, pts[a.cle]) < 0.04);
      if (m) groupes[m.cle].push(a.cle); else { trouves.push({ cle: a.cle, ...pts[a.cle] }); groupes[a.cle] = [a.cle]; } }
    return tr.itineraire = { sig: I.sig(ar, tr.depart), maj: new Date().toISOString(), dep, ordre: I.ordre(trouves, dep), groupes, pts, lieux: Object.fromEntries(ar.map(a => [a.cle, a.lieu])) };
  },

  // ce qu'on affiche : les étapes dans l'ordre, ce qui reste à placer, les liens Google Maps
  vue(tr, reels) {
    const ar = I.arrets(tr, reels), sans = I.sansLieu(tr, reels);
    if (!ar.length) return { vide: true, sans, etapes: [], hors: [], liens: [] };
    const It = tr.itineraire; if (!It) return { aCalculer: true, n: ar.length, sans, arrets: ar, etapes: [], hors: ar, liens: [] };
    const parCle = Object.fromEntries(ar.map(a => [a.cle, a])), etapes = []; let prev = It.dep || null, km = 0;
    const places = new Set();
    (It.ordre || []).forEach(cle => { const a = parCle[cle], p = (It.pts || {})[cle]; if (!a || !p) return;
      const membres = ((It.groupes || {})[cle] || [cle]).filter(c => parCle[c]); membres.forEach(c => places.add(c));
      const d = prev ? I.km(prev, p) : 0; km += d; etapes.push({ n: etapes.length + 1, cle, lieu: a.lieu, plans: membres.flatMap(c => parCle[c].plans), km: d, lat: p.lat, lon: p.lon }); prev = p; });
    const hors = ar.filter(a => !places.has(a.cle));                           // adresses introuvables, ou ajoutées depuis le calcul
    return { etapes, hors, km, sans, perime: It.sig !== I.sig(ar, tr.depart), depart: norm(tr.depart), liens: I.liens(etapes, hors, It.dep, norm(tr.depart)) };
  },
  // « 2 plans (Mother : 1, 6 · Reel 2 : 3) » → texte court
  plansTxt(plans) { const g = new Map(); plans.forEach(p => { const k = p.reel || ''; if (!g.has(k)) g.set(k, []); g.get(k).push(p.n); });
    return [...g].map(([k, l]) => (k ? k + ' : ' : '') + (l.length > 1 ? 'plans ' : 'plan ') + l.join(', ')).join(' · '); },
  // les liens Google Maps : 10 points par lien au maximum (départ + arrêts) ; le lien suivant repart du dernier point
  liens(etapes, hors, dep, departTxt) {
    const pt = o => o.lat !== undefined ? o.lat + ',' + o.lon : o.lieu;
    const l = [ ...(dep ? [{ lat: dep.lat, lon: dep.lon }] : departTxt ? [{ lieu: departTxt }] : []), ...etapes, ...(etapes.length ? [] : hors.map(a => ({ lieu: a.lieu }))) ];   // les adresses non placées restent hors du trajet (sauf s'il n'y a rien d'autre : Google les cherchera lui-même)
    if (!l.length) return [];
    if (l.length === 1) return [{ titre: 'Ouvrir dans Google Maps', url: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(pt(l[0])) }];
    const out = []; for (let i = 0; i < l.length - 1; i += 9) { const c = l.slice(i, i + 10); if (c.length < 2) break;
      const u = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=' + encodeURIComponent(pt(c[0])) + '&destination=' + encodeURIComponent(pt(c[c.length - 1]))
        + (c.length > 2 ? '&waypoints=' + encodeURIComponent(c.slice(1, -1).map(pt).join('|')) : '');
      out.push({ titre: 'Trajet', url: u }); }
    out.forEach((o, i) => o.titre = out.length > 1 ? `Trajet ${i + 1} / ${out.length} dans Google Maps` : 'Ouvrir dans Google Maps');
    return out;
  },
  kmTxt: k => (Math.round(k * 10) / 10).toString().replace('.', ',') + ' km',
};
})();
