// =====================================================================
// LIGHT TOAST — l'INSPECTEUR : les réglages de ce qui est sélectionné.
//
//   rien         → le projet : nom, tempo, palette, DÉCOMPTE
//   une couleur  → la couleur, les lumières qu'elle couvre (= un groupe), fondus
//   un effet     → effet, lumières touchées, réglages (en temps musicaux), mode masque / lumière, fondus
//   une pêche    → son type (éclair, flash, hauteur, tubes) : partagé par les pêches de ce type
//   un stem      → nom, couleur, sensibilité, écart mini (+ ajouter un déclencheur)
//   un déclencheur → action, à chaque coup / suivre le volume, lumières, force, chute…
//
// Les réglages des fonds et effets sont fabriqués tout seuls depuis moteur/fonds.js et
// moteur/effets.js : un nouveau réglage là-bas apparaît ici sans rien toucher.
// =====================================================================
(function (G) {
const LT = G.LT;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const NOM = { chute: 'Chute (temps)', seuil: 'Seuil du volume', div: 'Rythme', duree: 'Durée d\'un passage', defile: 'Défilement', eclat: 'Éclat', vitesse: 'Vitesse', taille: 'Taille', densite: 'Densité', profondeur: 'Profondeur', largeur: 'Largeur', chute: 'Chute', sens: 'Sens', montee: 'Montée (part du clip)',
  adoucir: 'Douceur du bord', depart: 'Départ', eclair: 'Éclair (part du clip)', trainee: 'Traînée', allume: 'Temps allumé', remplissage: 'Remplissage', nombre: 'Nombre', blocs: 'Blocs', lignes: 'Lignes', cadence: 'Flashs par seconde', tours: 'Tours' };
const CHOIX = { haut: 'Bas → haut', bas: 'Haut → bas', droite: 'Gauche → droite', gauche: 'Droite → gauche' };
const BORNES = { coups: [2, 16, 1], nombre: [1, 16, 1], blocs: [4, 48, 1], lignes: [4, 64, 1], cadence: [1, 20, .5], tours: [1, 8, 1] };
const fmt = t => { const s = t < 0 ? '-' : ''; t = Math.abs(t); return s + Math.floor(t / 60) + ':' + (t % 60).toFixed(2).padStart(5, '0'); };

class Inspecteur {
  constructor(m, c) { this.m = m; this.c = c; this.ed = false; this.slot = 0; }
  // ---- modifier sans redessiner l'inspecteur (on garde le curseur dans le champ) ----
  debut() { if (!this.ed) { this.m.memoriser(); this.ed = true; } }
  pendant(f) { this.debut(); f(); this.m.rafraichir(); }
  fin() { this.ed = false; this.m.change(false, true); }
  // un champ : glisseur, case, menu ou texte, relié à obj[k]
  lier(el, obj, k, conv = x => x) {
    const lire = () => el.type === 'checkbox' ? el.checked : el.type === 'range' || el.type === 'number' ? +el.value : el.value;
    el.addEventListener('input', () => { this.pendant(() => { obj[k] = conv(lire()); }); const b = el.parentElement.querySelector('b'); if (b && el.type === 'range') b.textContent = this.valTexte(k, obj[k]); });
    el.addEventListener('change', () => { this.pendant(() => { obj[k] = conv(lire()); }); this.fin(); });
  }
  valTexte(k, v) { return ['ed', 'fd', 'ecart'].includes(k) ? v + ' ms' : BORNES[k] ? v : k === 'entree' || k === 'sortie' ? v.toFixed(2) + ' s' : Math.round(v * 100) + ' %'; }
  glisseur(k, v, min = 0, max = 1, pas = .01, nom) { return `<label class="lt2-reg">${nom || NOM[k] || k} <b>${this.valTexte(k, v)}</b><input type="range" min="${min}" max="${max}" step="${pas}" data-k="${k}" value="${v}"></label>`; }

  rendre() {
    const m = this.m, ch = m.clipsChoisis(), c = this.c; this.ed = false;
    if (ch.length) m.stemChoisi = null;
    const st = !ch.length && m.projet.stems.find(x => x.id === m.stemChoisi);
    const quoi = st ? st.id : ch.map(x => x.k.id).join() || 'projet'; if (quoi !== this.quoi) { this.quoi = quoi; c.parentElement.scrollTop = 0; }
    c.innerHTML = '';
    if (st) return this.stem(st);
    if (!ch.length) return this.projet();
    if (ch.length > 1) { c.innerHTML = `<div class="lt2-titre">${ch.length} clips</div><p class="lt2-vide">Glisse-les ensemble sur la timeline. Suppr pour les effacer.</p>`; return; }
    const { k, sorte } = ch[0];
    if (sorte === 'peches') return this.peche(k);
    if (sorte === 'effets') return this.effet(k);
    if (sorte === 'declencheurs') return this.declencheur(k);
    return this.couleur(k);
  }

  // ---------- commun : temps, fondus, force ----------
  temps(k) {
    return k.t != null ? `<div class="lt2-ligne"><span>Temps</span><b>${fmt(k.t)}</b></div>`
      : `<div class="lt2-ligne"><span>Début</span><b>${fmt(k.debut)}</b></div><div class="lt2-ligne"><span>Durée</span><b>${(k.fin - k.debut).toFixed(2)} s</b></div>`;
  }
  fondus(k) { return `<h4>Apparition</h4>${this.glisseur('entree', k.entree || 0, 0, 4, .05, 'Fondu d\'entrée')}${this.glisseur('sortie', k.sortie || 0, 0, 4, .05, 'Fondu de sortie')}${this.glisseur('force', k.force ?? 1, 0, 1, .01, 'Force')}`; }
  reglages(def, k) {
    k.reglages = k.reglages || {};
    return Object.entries(def.reglages).map(([r, d]) => {
      const v = k.reglages[r] ?? d;
      if (def.choix && def.choix[r]) {   // un menu : [valeur, nom] ou juste la valeur
        const ops = def.choix[r].map(o => Array.isArray(o) ? o : [o, CHOIX[o] || o]), num = typeof ops[0][0] === 'number';
        return `<label class="lt2-reg">${NOM[r] || r}<select data-r="${r}"${num ? ' data-num' : ''}>${ops.map(([x, n]) => `<option value="${x}"${x == v ? ' selected' : ''}>${n}</option>`).join('')}</select></label>`;
      }
      const [a, b, p] = BORNES[r] || [0, 1, .01];
      return this.glisseur(r, v, a, b, p).replace('data-k=', 'data-r=');
    }).join('');
  }
  zones(k, cle = 'zones', titre = 'Lumières touchées') {
    const Z = this.m.projet.materiel.zones, z = k[cle] && k[cle].length === Z.length ? null : k[cle];
    return `<h4>${titre}</h4><div class="lt2-zones"><label><input type="checkbox" data-z="*"${!z ? ' checked' : ''}> Toutes</label>${Z.map(q => `<label><input type="checkbox" data-z="${q.id}"${!z || z.includes(q.id) ? ' checked' : ''}${!z ? ' disabled' : ''}> ${esc(q.nom)}</label>`).join('')}</div>`;
  }
  // toujours = la liste doit rester une liste (calques de couleur) : « Toutes » = toutes les lumières
  brancher(k, cleZones = 'zones', toujours = false) {
    const c = this.c, tous = () => this.m.projet.materiel.zones.map(q => q.id);
    c.querySelectorAll('[data-k]').forEach(el => this.lier(el, k, el.dataset.k, el.hasAttribute('data-num') ? Number : x => x));
    c.querySelectorAll('[data-r]').forEach(el => this.lier(el, k.reglages, el.dataset.r, el.hasAttribute('data-num') ? Number : x => x));
    c.querySelectorAll('[data-z]').forEach(el => el.onchange = () => {
      this.debut(); const avant = k[cleZones] || [];
      if (el.dataset.z === '*') k[cleZones] = el.checked ? (toujours ? tous() : null) : [tous()[0]];
      else { const l = [...c.querySelectorAll('[data-z]:not([data-z="*"])')].filter(x => x.checked).map(x => x.dataset.z); k[cleZones] = l.length ? l : [el.dataset.z]; }
      if (toujours) { const plus = k[cleZones].filter(z => !avant.includes(z)); if (plus.length) this.m.faireDeLaPlace(k, plus); }   // calque de couleur : il prend la place sur ses nouvelles lumières
      this.fin(); this.rendre();
    });
  }
  // la roue, branchée sur une couleur
  roue(place, hex, poser) {
    const P = this.m.projet;
    return LT.roue(place, hex, {
      palette: P.palette,
      quand: (c, fini) => { this.pendant(() => poser(c)); if (fini) { this.fin(); this.majPastilles(); } },
      ajouterPalette: c => { if (!P.palette.includes(c)) { this.debut(); P.palette.push(c); this.fin(); this.rendre(); this.m.biblio(); } },
    });
  }
  majPastilles() { this.c.querySelectorAll('[data-slot]').forEach(b => { const k = this.couleursSlots; if (k) b.style.background = k()[+b.dataset.slot]; }); }

  // ---------- un calque de couleur ----------
  couleur(k) {
    const c = this.c, P = this.m.projet, multi = !!(k.sorte && k.couleurs), cs = multi ? k.couleurs : [k.couleur];
    if (!multi || this.slot >= cs.length) this.slot = multi ? Math.min(this.slot || 0, cs.length - 1) : 0;
    const titre = k.sorte === 'degrade' ? 'Dégradé' : k.sorte === 'bi' ? 'Bi-color' : 'Couleur';
    const aide = k.sorte === 'degrade' ? 'La 1re couleur en haut, la dernière en bas, en passant doucement de l\'une à l\'autre.' : 'La lumière coupée en parts égales : la 1re couleur en haut, la dernière en bas.';
    c.innerHTML = `<div class="lt2-titre">${titre}</div>${this.temps(k)}
      ${multi ? `<p class="lt2-vide">${aide}</p>` : ''}
      <div class="lt2-slots">${cs.map((h, i) => `<button class="lt2-slot${this.slot === i ? ' on' : ''}" data-slot="${i}" style="background:${h}"></button>`).join('')}${multi ? `<button class="lt2-tb" data-c="+" title="Ajouter une couleur">+</button>${cs.length > 2 ? '<button class="lt2-tb" data-c="-" title="Enlever la couleur choisie">−</button>' : ''}` : ''}</div><div class="lt2-roue-ici"></div>
      ${this.zones(k, 'zones', 'Lumières couvertes')}
      <p class="lt2-vide">Coche les lumières que ce calque allume (elles n'ont pas besoin de se toucher). Il passe par-dessus les autres calques.</p>
      ${this.glisseur('force', k.force ?? 1, 0, 1, .01, 'Intensité')}
      <h4>Apparition</h4>${this.glisseur('entree', k.entree || 0, 0, 4, .05, 'Fondu d\'entrée')}${this.glisseur('sortie', k.sortie || 0, 0, 4, .05, 'Fondu de sortie')}`;
    this.couleursSlots = () => multi ? k.couleurs : [k.couleur];
    this.roue(c.querySelector('.lt2-roue-ici'), cs[this.slot], col => { if (multi) { k.couleurs[this.slot] = col; k.couleur = k.couleurs[0]; } else k.couleur = col; });
    if (multi) {
      c.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => { this.slot = +b.dataset.slot; this.rendre(); });
      c.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { this.debut(); if (b.dataset.c === '+') { k.couleurs.push(P.palette.find(x => !k.couleurs.includes(x)) || '#ffffff'); this.slot = k.couleurs.length - 1; } else { k.couleurs.splice(this.slot, 1); this.slot = 0; } k.couleur = k.couleurs[0]; this.fin(); this.rendre(); });
    }
    this.brancher(k, 'zones', true);
  }

  // ---------- un effet (calque d'effet : agit sur ce qui est en dessous) ----------
  effet(k) {
    const c = this.c, def = LT.effets[k.effet] || LT.effets.strobo, ov = def.sorte === 'overlay', lum = !ov && k.mode === 'lumiere';
    const opts = s => Object.entries(LT.effets).filter(([, f]) => f.sorte === s).map(([x, f]) => `<option value="${x}"${x === k.effet ? ' selected' : ''}>${f.nom}</option>`).join('');
    c.innerHTML = `<div class="lt2-titre">${def.nom}</div>${this.temps(k)}
      <label class="lt2-reg">Effet<select data-effet><optgroup label="Overlays · textures">${opts('overlay')}</optgroup><optgroup label="Mouvements">${opts('mouvement')}</optgroup></select></label>
      <p class="lt2-vide">${ov ? 'La couleur du dessous devient cette texture, dans sa couleur.' : 'Découpe ce qui est en dessous (ou ajoute sa propre couleur en mode lumière).'}</p>
      ${ov ? this.glisseur('eclat', k.eclat ?? .35, 0, 1, .01) : `<div class="lt2-seg"><button data-mode="masque" class="${lum ? '' : 'on'}">Masque</button><button data-mode="lumiere" class="${lum ? 'on' : ''}">Lumière</button></div>`}
      ${lum ? `<div class="lt2-slots"><button class="lt2-slot on" data-slot="0" style="background:${k.couleur}"></button></div><div class="lt2-roue-ici"></div>` : ''}
      ${this.zones(k)}<h4>Réglages</h4>${this.reglages(def, k)}${this.fondus(k)}`;
    this.couleursSlots = () => [k.couleur];
    if (lum) this.roue(c.querySelector('.lt2-roue-ici'), k.couleur, col => { k.couleur = col; });
    c.querySelector('[data-effet]').onchange = e => { this.debut(); k.effet = e.target.value; k.reglages = {}; this.fin(); this.rendre(); };
    c.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { this.debut(); k.mode = b.dataset.mode; this.fin(); this.rendre(); });
    this.brancher(k);
  }

  // ---------- un déclencheur de stem ----------
  declencheur(k) {
    const c = this.c, m = this.m, P = m.projet, st = P.stems.find(x => x.id === k.stem), A = LT.declencheurs.ACTIONS, vol = k.mode === 'volume';
    const n = st ? LT.declencheurs.coups(st).filter(q => q[0] >= k.debut && q[0] < k.fin).length : 0;
    if (k.action === 'couleur' && this.slot >= (k.couleurs || []).length) this.slot = 0;
    const mouvements = Object.entries(LT.effets).filter(([, f]) => f.sorte === 'mouvement').map(([x, f]) => `<option value="${x}"${x === k.effet ? ' selected' : ''}>${f.nom}</option>`).join('');
    const avecCouleur = k.action === 'flash' || (k.action === 'effet' && k.effetMode !== 'masque');
    c.innerHTML = `<div class="lt2-titre">⚡ Déclencheur${st ? ` · <span style="color:${st.couleur}">${esc(st.nom)}</span>` : ''}</div>${this.temps(k)}
      <div class="lt2-ligne"><span>Coups dans la zone</span><b>${n}</b></div>
      <label class="lt2-reg">Action<select data-k="action">${Object.entries(A).map(([x, a]) => `<option value="${x}"${x === k.action ? ' selected' : ''}>${a.nom}</option>`).join('')}</select></label>
      <p class="lt2-vide">${(A[k.action] || {}).aide || ''}</p>
      ${k.action === 'effet' ? '' : `<div class="lt2-seg"><button data-mode="coup" class="${vol ? '' : 'on'}">À chaque coup</button><button data-mode="volume" class="${vol ? 'on' : ''}">Suivre le volume</button></div>`}
      ${k.action === 'effet' ? `<label class="lt2-reg">Effet<select data-k="effet">${mouvements}</select></label>
        <label class="lt2-reg">Durée<select data-k="duree" data-num>${LT.DUREE.map(([v, nm]) => `<option value="${v}"${v == k.duree ? ' selected' : ''}>${nm}</option>`).join('')}</select></label>
        <div class="lt2-seg"><button data-em="lumiere" class="${k.effetMode === 'masque' ? '' : 'on'}">Lumière</button><button data-em="masque" class="${k.effetMode === 'masque' ? 'on' : ''}">Masque</button></div>` : ''}
      ${avecCouleur ? `<div class="lt2-slots"><button class="lt2-slot on" style="background:${k.couleur}"></button></div><div class="lt2-roue-ici"></div>` : ''}
      ${k.action === 'couleur' ? `<h4>${vol ? 'De la 1re couleur (calme) à la 2e (fort)' : 'Les couleurs, à tour de rôle'}</h4><div class="lt2-slots">${k.couleurs.map((h, i) => `<button class="lt2-slot${this.slot === i ? ' on' : ''}" data-slot="${i}" style="background:${h}"></button>`).join('')}<button class="lt2-tb" data-c="+">+</button>${k.couleurs.length > 1 ? '<button class="lt2-tb" data-c="-">−</button>' : ''}</div><div class="lt2-roue-ici"></div>` : ''}
      ${this.zones(k)}
      ${this.glisseur('force', k.force ?? 1, 0, 1, .01, 'Force')}
      ${vol ? this.glisseur('seuil', k.seuil ?? .2, 0, .9, .01) : k.action === 'effet' ? '' : this.glisseur('chute', k.chute ?? .5, .05, 4, .05).replace(/<b>[^<]*<\/b>/, `<b>${k.chute ?? .5} temps</b>`)}
      ${!vol && k.action !== 'effet' ? `<label class="lt2-reg lt2-coche"><input type="checkbox" data-k="suitForce"${k.suitForce ? ' checked' : ''}> Plus le coup est fort, plus ça réagit</label>` : ''}
      <label class="lt2-reg lt2-coche"><input type="checkbox" data-k="muet"${k.muet ? ' checked' : ''}> Couper ce déclencheur</label>
      ${!vol && (k.action === 'flash' || k.action === 'effet') ? '<button data-figer>Figer en clips</button><p class="lt2-vide">Transforme chaque coup en pêche (flash) ou en clip d\'effet, pour retoucher à la main.</p>' : ''}`;
    this.couleursSlots = () => k.action === 'couleur' ? k.couleurs : [k.couleur];
    const place = c.querySelector('.lt2-roue-ici');
    if (place && k.action === 'couleur') this.roue(place, k.couleurs[this.slot], col => { k.couleurs[this.slot] = col; });
    else if (place) this.roue(place, k.couleur, col => { k.couleur = col; });
    c.querySelector('[data-k="action"]').addEventListener('change', () => this.rendre());
    c.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { this.debut(); k.mode = b.dataset.mode; this.fin(); this.rendre(); });
    c.querySelectorAll('[data-em]').forEach(b => b.onclick = () => { this.debut(); k.effetMode = b.dataset.em; this.fin(); this.rendre(); });
    c.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => { this.slot = +b.dataset.slot; this.rendre(); });
    c.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { this.debut(); if (b.dataset.c === '+') { k.couleurs.push(P.palette[k.couleurs.length % P.palette.length]); this.slot = k.couleurs.length - 1; } else { k.couleurs.splice(this.slot, 1); this.slot = 0; } this.fin(); this.rendre(); });
    const fg = c.querySelector('[data-figer]');
    if (fg) fg.onclick = () => { let nb = 0; m.modifier(() => { nb = LT.declencheurs.figer(P, k, (a, b) => m.pisteLibre(a, b)); k.muet = true; }); fg.textContent = nb + ' clips créés (déclencheur coupé)'; m.biblio(); };
    const ch = c.querySelector('[data-k="chute"]'); if (ch) ch.addEventListener('input', () => { ch.parentElement.querySelector('b').textContent = ch.value + ' temps'; });
    this.brancher(k);
  }

  // ---------- une pêche (et son type) ----------
  peche(k) {
    const c = this.c, P = this.m.projet, y = P.peches.types.find(q => q.id === k.type) || P.peches.types[0];
    const n = P.peches.clips.filter(q => q.type === y.id).length;
    if (this.slot > 1) this.slot = 0;
    c.innerHTML = `<div class="lt2-titre">Pêche</div>${this.temps(k)}
      <label class="lt2-reg">Type<select data-type>${P.peches.types.map(q => `<option value="${q.id}"${q.id === y.id ? ' selected' : ''}>${esc(q.nom)}</option>`).join('')}<option value="+">+ Nouveau type…</option></select></label>
      <p class="lt2-vide">Ces réglages changent les ${n} pêche${n > 1 ? 's' : ''} de ce type.</p>
      <label class="lt2-reg">Nom du type<input type="text" data-k="nom" value="${esc(y.nom)}"></label>
      <div class="lt2-slots"><button class="lt2-slot${this.slot === 0 ? ' on' : ''}" data-slot="0" style="background:${y.eclair}" title="Éclair">É</button><button class="lt2-slot${this.slot === 1 ? ' on' : ''}" data-slot="1" style="background:${y.flash}" title="Flash">F</button></div>
      <div class="lt2-roue-ici"></div>
      ${this.glisseur('ed', y.ed, 1, 50, 1, 'Éclair').replace(/<b>[^<]*<\/b>/, `<b>${y.ed} ms</b>`)}
      ${this.glisseur('fd', y.fd, 0, 2000, 10, 'Flash qui s\'estompe').replace(/<b>[^<]*<\/b>/, `<b>${y.fd} ms</b>`)}
      ${this.glisseur('h', y.h ?? 1, .05, 1, .01, 'Hauteur éclairée')}
      <label class="lt2-reg">Part de<select data-k="ancre"><option value="b"${y.ancre === 'b' ? ' selected' : ''}>En bas</option><option value="m"${y.ancre === 'm' ? ' selected' : ''}>Au milieu</option><option value="t"${y.ancre === 't' ? ' selected' : ''}>En haut</option></select></label>
      ${this.zones(y)}`;
    this.couleursSlots = () => [y.eclair, y.flash];
    this.roue(c.querySelector('.lt2-roue-ici'), this.slot ? y.flash : y.eclair, col => { if (this.slot) y.flash = col; else y.eclair = col; });
    c.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => { this.slot = +b.dataset.slot; this.rendre(); });
    c.querySelector('[data-type]').onchange = e => {
      this.debut();
      if (e.target.value === '+') { const t = JSON.parse(JSON.stringify(y)); t.id = LT.id(); t.nom = 'Type ' + (P.peches.types.length + 1); P.peches.types.push(t); k.type = t.id; }
      else k.type = e.target.value;
      this.fin(); this.rendre();
    };
    c.querySelectorAll('[data-k]').forEach(el => this.lier(el, y, el.dataset.k));
    c.querySelectorAll('input[data-k="ed"],input[data-k="fd"]').forEach(el => el.addEventListener('input', () => { el.parentElement.querySelector('b').textContent = el.value + ' ms'; }));
    this.brancher(y);
  }

  // ---------- rien de choisi : le projet ----------
  projet() {
    const c = this.c, P = this.m.projet, d = P.decompte = P.decompte || LT.decompte.defaut();
    if (this.slot >= P.palette.length) this.slot = 0;
    c.innerHTML = `<div class="lt2-titre">Projet</div>
      <label class="lt2-reg">Nom<input type="text" data-k="nom" value="${esc(P.nom)}"></label>
      <div class="lt2-reg">Tempo (BPM)<div class="lt2-rang"><input type="number" min="30" max="300" step="0.1" data-k="bpm" value="${P.bpm}"><button class="lt2-tb" data-tap title="Tape en rythme (4 fois ou plus)">Taper</button></div></div>
      <label class="lt2-reg">Premier temps à (s)<input type="number" step="0.01" min="0" data-k="grille" value="${P.grille || 0}" title="Cale la grille des temps sur le 1er temps du morceau"></label>
      <h4>Palette du morceau</h4><div class="lt2-slots">${P.palette.map((h, i) => `<button class="lt2-slot${this.slot === i ? ' on' : ''}" data-slot="${i}" style="background:${h}"></button>`).join('')}<button class="lt2-tb" data-pal="+" title="Ajouter une couleur">+</button>${P.palette.length > 1 ? '<button class="lt2-tb" data-pal="-" title="Retirer la couleur choisie">−</button>' : ''}</div>
      <div class="lt2-roue-ici"></div>
      <h4>Intensité des lumières</h4>
      ${P.materiel.zones.map(z => `<label class="lt2-reg">${esc(z.nom)} <b>${Math.round(((P.intensites || {})[z.id] ?? 1) * 100)} %</b><input type="range" min="0" max="1" step="0.01" data-int="${z.id}" value="${(P.intensites || {})[z.id] ?? 1}"></label>`).join('')}
      <p class="lt2-vide">Pour tout le morceau : baisse une lumière trop forte par rapport aux autres.</p>
      <h4>Décompte avant le début</h4>
      <label class="lt2-reg lt2-coche"><input type="checkbox" data-d="actif"${d.actif ? ' checked' : ''}> Ajouter un décompte</label>
      <div class="lt2-dc${d.actif ? '' : ' lt2-off'}">
        ${this.glisseur('coups', d.coups, 2, 16, 1, 'Coups').replace('data-k=', 'data-d=')}
        <label class="lt2-reg">Lampes<select data-d="lampes"><option value="cumul"${d.lampes === 'cumul' ? ' selected' : ''}>Une de plus à chaque coup</option><option value="avance"${d.lampes === 'avance' ? ' selected' : ''}>Une seule qui avance</option><option value="aucune"${d.lampes === 'aucune' ? ' selected' : ''}>Aucune (seulement le son)</option></select></label>
        <label class="lt2-reg">Couleur des lampes<input type="color" data-d="couleur" value="${d.couleur}"></label>
        <label class="lt2-reg lt2-coche"><input type="checkbox" data-d="son"${d.son ? ' checked' : ''}> Le clic dans la vidéo exportée</label>
        <p class="lt2-vide">Juste avant le début (du morceau, ou du passage choisi). Le dernier coup est noir : c'est le signal.</p>
      </div>`;
    this.couleursSlots = () => P.palette;
    this.roue(c.querySelector('.lt2-roue-ici'), P.palette[this.slot], col => { P.palette[this.slot] = col; });
    c.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => { this.slot = +b.dataset.slot; this.rendre(); });
    c.querySelectorAll('[data-pal]').forEach(b => b.onclick = () => { this.debut(); if (b.dataset.pal === '+') { P.palette.push(P.palette[this.slot] || '#ffffff'); this.slot = P.palette.length - 1; } else { P.palette.splice(this.slot, 1); this.slot = 0; } this.fin(); this.rendre(); this.m.biblio(); });
    c.querySelectorAll('[data-k]').forEach(el => this.lier(el, P, el.dataset.k));
    c.querySelectorAll('[data-int]').forEach(el => { P.intensites = P.intensites || {}; this.lier(el, P.intensites, el.dataset.int); el.addEventListener('input', () => { el.parentElement.querySelector('b').textContent = Math.round(el.value * 100) + ' %'; }); });
    c.querySelectorAll('[data-d]').forEach(el => { this.lier(el, d, el.dataset.d); if (el.dataset.d === 'actif') el.addEventListener('change', () => { this.m.tl.toutVoir(); this.rendre(); }); });
    const coups = c.querySelector('input[data-d="coups"]'); coups.addEventListener('input', () => { coups.parentElement.querySelector('b').textContent = coups.value; });
    // taper le tempo
    let taps = [];
    c.querySelector('[data-tap]').onclick = () => {
      const n = performance.now(); taps = taps.filter(x => n - x < 2500); taps.push(n);
      if (taps.length >= 4) { const e = (taps.at(-1) - taps[0]) / (taps.length - 1), bpm = Math.round(600000 / e) / 10; this.debut(); P.bpm = bpm; this.fin(); c.querySelector('[data-k="bpm"]').value = bpm; }
    };
  }

  // ---------- un stem ----------
  stem(st) {
    const c = this.c, m = this.m;
    c.innerHTML = `<div class="lt2-titre" style="color:${st.couleur}">Stem · ${esc(st.nom)}</div>
      <label class="lt2-reg">Nom<input type="text" data-k="nom" value="${esc(st.nom)}"></label>
      <label class="lt2-reg">Couleur<input type="color" data-k="couleur" value="${st.couleur}"></label>
      ${this.glisseur('sens', st.sens, 0, 1, .01, 'Sensibilité')}
      ${this.glisseur('ecart', st.ecart, 10, 500, 5, 'Écart mini').replace(/<b>[^<]*<\/b>/, `<b>${st.ecart} ms</b>`)}
      <div class="lt2-ligne"><span>Coups repérés</span><b data-n>${m.coupsDe(st).length}</b></div>
      <label class="lt2-reg lt2-coche"><input type="checkbox" data-k="muet"${st.muet ? ' checked' : ''}> Ignorer ce stem (magnétisme, déclencheurs)</label>
      <p class="lt2-vide">Plus haut = plus de coups. Deux coups plus proches que l'écart mini n'en font qu'un (le plus fort reste). Le son du stem n'est pas gardé dans le projet : ses coups et son volume, oui.</p>
      <button data-decl class="lt2-pri">+ Déclencheur sur tout le morceau</button>
      <p class="lt2-vide">Ou double-clic sur la ligne du stem pour en poser un à un endroit.</p>
      <button data-suppr>Retirer ce stem</button>`;
    c.querySelectorAll('[data-k]').forEach(el => this.lier(el, st, el.dataset.k));
    const ec = c.querySelector('[data-k="ecart"]'), maj = () => { c.querySelector('[data-n]').textContent = m.coupsDe(st).length; ec.parentElement.querySelector('b').textContent = st.ecart + ' ms'; };
    c.querySelectorAll('input[type=range]').forEach(el => el.addEventListener('input', maj));
    c.querySelector('[data-k="nom"]').addEventListener('change', () => m.tl.redessiner());
    c.querySelector('[data-suppr]').onclick = () => { m.modifier(() => { const P = m.projet; P.stems.splice(P.stems.indexOf(st), 1); P.declencheurs = (P.declencheurs || []).filter(k => k.stem !== st.id); }); m.son.stems.delete(st.id); m.choisirStem(null); };
    c.querySelector('[data-decl]').onclick = () => { const P = m.projet, k = LT.declencheurs.nouveau(st.id, Math.min(0, m.debutMin()), Math.max(m.duree(), 1), P); m.modifier(() => (P.declencheurs = P.declencheurs || []).push(k)); m.choisir(k); };
  }
}
LT.Inspecteur = Inspecteur;
})(typeof self !== 'undefined' ? self : this);
