// =====================================================================
// LE LOOK — « nouveau » (épuré : menu rangé par sections, un tapis et une couleur par section, les pins du groupe,
// tout plus compact) ou « ancien » (exactement comme avant). Chaque PC choisit ; ça ne change rien pour les autres.
//   Réglage : BK.reglage('look') = 'neuf' | 'ancien' | null (pas encore choisi → on propose au démarrage)
//   Tout le CSS du nouveau look est dans style/look-neuf.css, sous body.look-neuf : l'ancien n'est jamais touché.
//   Pour ranger un onglet ailleurs dans le nouveau menu : la liste SECTIONS ci-dessous, c'est tout.
// =====================================================================
(() => {
const $ = s => document.querySelector(s);
// les sections du nouveau menu (dans l'ordre) ; un onglet qui n'est dans aucune liste va à la fin du premier groupe
const SECTIONS = {
  general:  { titre: '',             ids: ['accueil', 'renforts'] },
  musique:  { titre: 'Musique',      ids: ['biblio', 'ecoute', 'notesvid', 'mixprep'] },
  contenus: { titre: 'Contenus',     ids: ['suivi', 'reels', 'reelvis', 'postvis', 'medias'] },
  orga:     { titre: 'Organisation', ids: ['agenda', 'tournage', 'taches', 'budget'] },
  show:     { titre: 'Show',         ids: ['lighttoast'] },
  reglages: { titre: '',             ids: ['reglages'] },
};
const PAS_PRETS = ['lumieres', 'repete', 'concert'];                  // cachés dans le nouveau look tant qu'ils ne sont pas prêts
// les onglets réunis : une seule entrée dans le menu, des sous-onglets en haut de la page (chaque module reste à part)
const GROUPES = {
  accueil: { titre: 'Accueil', ids: ['accueil', 'renforts'],                    noms: ['Accueil', 'Miette AI'] },
  suivi:  { titre: 'Reels',    ids: ['suivi', 'reels', 'reelvis'],               noms: ['Suivi', 'Audio', 'Montage'] },
  ecoute: { titre: 'Retours',  ids: ['ecoute', 'notesvid'],                       noms: ['Mix', 'Vidéo'] },
  agenda: { titre: 'Planning', ids: ['agenda', 'taches', 'budget'],               noms: ['Calendrier', 'To-do', 'Budget'] },
};
const chefDe = id => Object.keys(GROUPES).find(k => GROUPES[k].ids.includes(id)) || null;
const MEMBRES = ['Yacine', 'Pierre', 'Baptiste', 'Studio'];
const PIN = n => 'look/pins/' + n.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '') + '.png';

const L = BK.look = {
  // 'neuf' = nouveau look avec les boutons écusson (0.9.128) ; 'neuf1' = le nouveau look d'avant (0.9.126), proposé comme « Ancien look »
  // le très vieux look (« ancien », avant le nouveau look) n'existe plus : tout le monde est au moins en 'neuf1'
  neuf: () => true,
  ecusson: () => BK.reglage('look', null) === 'neuf',
  choisi: () => BK.reglage('look', null) !== null,
  pasPret: id => L.neuf() && PAS_PRETS.includes(id),
  // les sous-onglets (nouveau look) : l'entrée du menu (« chef »), son nom, et l'onglet à rouvrir (le dernier utilisé)
  chef: id => (L.neuf() && chefDe(id)) || id,
  membre: id => L.neuf() && !!chefDe(id) && chefDe(id) !== id,
  titreMenu: id => L.neuf() && GROUPES[id] ? GROUPES[id].titre : '',
  cible: id => { if (!L.neuf() || !GROUPES[id]) return id; const d = BK.reglage('groupe.' + id, id); return GROUPES[id].ids.includes(d) && BK.ongletVisible(BK.onglets.find(o => o.id === d) || {}) ? d : id; },
  visibleGroupe: o => !L.neuf() || !GROUPES[o.id] ? BK.ongletVisible(o) : GROUPES[o.id].ids.some(i => BK.ongletVisible(BK.onglets.find(x => x.id === i) || {})),
  sousOnglets(id) {
    const g = chefDe(id), p = document.getElementById('p-' + id); if (!g || !p) return;
    const hdr = p.querySelector('.hdr'); if (!hdr) return;
    let n = hdr.querySelector('.look-sous');
    if (!n) { n = document.createElement('nav'); n.className = 'seg look-sous'; n.setAttribute('aria-label', GROUPES[g].titre);
      n.innerHTML = GROUPES[g].ids.map((i, k) => BK.ongletVisible(BK.onglets.find(o => o.id === i) || {}) ? `<button data-sous="${i}">${GROUPES[g].noms[k]}</button>` : '').join('');
      const h1 = hdr.querySelector('.h1'); h1 ? h1.after(n) : hdr.prepend(n); hdr.classList.add('a-sous');
      n.onclick = e => { const b = e.target.closest('[data-sous]'); if (b) BK.ouvrir(b.dataset.sous); }; }
    n.querySelectorAll('[data-sous]').forEach(b => { const on = b.dataset.sous === id; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
  },
  sectionDe: id => Object.keys(SECTIONS).find(k => SECTIONS[k].ids.includes(id)) || 'general',
  // les groupes du menu : [{ id, titre, ids }] (les onglets ajoutés plus tard et pas encore rangés : dans le premier groupe)
  groupes() {
    const ranges = new Set(Object.values(SECTIONS).flatMap(s => s.ids));
    const reste = BK.onglets.map(o => o.id).filter(id => !ranges.has(id));
    return Object.entries(SECTIONS).map(([id, s], i) => ({ id, titre: s.titre, ids: i === 0 ? [...s.ids, ...reste] : s.ids }));
  },
  appliquer() {
    document.body.classList.toggle('look-neuf', L.neuf());
    document.body.classList.toggle('look-ecusson', L.ecusson());
    if (!L.neuf()) return;
    const top = $('header.top'); if (top && !$('#syPins')) {
      const p = document.createElement('div'); p.className = 'pins'; p.id = 'syPins'; p.setAttribute('aria-label', 'Qui est là');
      top.insertBefore(p, top.querySelector('.sys')); L.pins([]);
      const q = $('#syQui'); if (q) p.after(q);                      // l'écran ONLINE au milieu, à la place des pins (cachés)
    }
  },
  // l'onglet ouvert → sa section : le tapis (en fondu), la couleur, le titre du groupe allumé
  section(id) {
    if (!L.neuf()) return;
    const g = chefDe(id); if (g) { BK.regler('groupe.' + g, id); L.sousOnglets(id); }
    const k = L.sectionDe(id), b = document.body;
    document.querySelectorAll('#nav .cote').forEach(c => c.classList.toggle('on', c.dataset.cote === k));
    if (b.dataset.section === k) return;
    // la barre du haut glisse : vers le haut si on descend dans le menu, vers le bas si on remonte ; la ligne change juste de couleur en fondu
    const top = $('header.top'), ligne = $('.stripe'), ancienne = b.dataset.section;
    const fond = e => { const c = getComputedStyle(e); return { backgroundImage: c.backgroundImage, backgroundSize: c.backgroundSize, backgroundPosition: c.backgroundPosition, backgroundRepeat: c.backgroundRepeat, backgroundColor: c.backgroundColor }; };
    const avant = ancienne && top ? fond(top) : null, ligneAvant = ancienne && ligne ? fond(ligne) : null;
    b.dataset.section = k;
    if (!avant || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ordre = Object.keys(SECTIONS), sens = ordre.indexOf(k) > ordre.indexOf(ancienne) ? -1 : 1;   // -1 : l'ancienne part vers le haut
    top.querySelectorAll('.tapis-cadre').forEach(x => x.remove());
    const cadre = document.createElement('div'); cadre.className = 'tapis-cadre';
    const vieux = document.createElement('div'), neuf = document.createElement('div');
    vieux.className = neuf.className = 'tapis-glisse';
    Object.assign(vieux.style, avant); Object.assign(neuf.style, fond(top));
    neuf.style.transform = `translateY(${-sens * 100}%)`;
    cadre.append(vieux, neuf); top.prepend(cadre);
    if (ligneAvant) { ligne.querySelectorAll('.ligne-avant').forEach(x => x.remove());
      const l = document.createElement('div'); l.className = 'ligne-avant'; Object.assign(l.style, ligneAvant); ligne.append(l);
      requestAnimationFrame(() => requestAnimationFrame(() => { l.style.opacity = '0'; })); setTimeout(() => l.remove(), 500); }
    requestAnimationFrame(() => requestAnimationFrame(() => { vieux.style.transform = `translateY(${sens * 100}%)`; neuf.style.transform = 'translateY(0)'; }));
    setTimeout(() => cadre.remove(), 520);
  },
  // les pins brodés : allumés = sur BEESKOT Studio en ce moment (survol : où) ; le sien se clique (Réglages › Ce PC)
  pins(autres) {
    const z = $('#syPins'); if (!z) return;
    const moi = BK.reglage('nomPc', ''), ou = {};
    const sur = {}; (autres || []).forEach(x => { ou[String(x.qui || '').toLowerCase()] = x.onglet || ''; sur[String(x.qui || '').toLowerCase()] = BK.presence ? BK.presence.surQuoi(x.apps) : ''; });
    const ici = (BK.onglets.find(o => o.id === BK.reglage('dernierOnglet', 'accueil')) || {}).titre || '';
    z.innerHTML = MEMBRES.map(m => { const lui = m === moi, la = lui || ou[m.toLowerCase()] !== undefined, onglet = lui ? ici : ou[m.toLowerCase()];
      const t = lui ? `${m} (toi, sur ce PC)${onglet ? ' · ' + onglet : ''} : clic pour changer` : la ? `${m} · ${onglet || 'en ligne'}${sur[m.toLowerCase()] ? ' · sur ' + sur[m.toLowerCase()] : ''}` : `${m} · pas là`;
      return `<button class="pin${la ? ' la' : ''}${lui ? ' moi' : ''}" ${lui ? '' : 'tabindex="-1"'} title="${t}" aria-label="${t}"><img src="${PIN(m)}" alt="">${la && !lui && /téléphone/.test(sur[m.toLowerCase()] || '') ? `<i class="pin-tel">📱</i>` : ''}</button>`; }).join('')
      + (moi && MEMBRES.includes(moi) ? '' : `<button class="pin-qui" title="Qui utilise cet ordinateur ?">${moi ? moi.toUpperCase() : 'QUI ?'}</button>`);
    z.querySelectorAll('.pin.moi, .pin-qui').forEach(b => b.onclick = () => { BK.ouvrir('reglages'); BK.reglagesOnglet && BK.reglagesOnglet('pc'); });
  },
  // la fenêtre du début : essayer le nouveau look, ou garder l'ancien (une seule fois par PC)
  proposer() {
    if (L.choisi() || document.getElementById('lookChoix')) return;
    let choix = 'neuf';
    const v = document.createElement('div'); v.className = 'voile'; v.id = 'lookChoix';
    v.innerHTML = `<div class="stopbox look-choix" role="dialog" aria-labelledby="lookTitre">
        <span class="screw tl"></span><span class="screw tr"></span><span class="screw bl"></span><span class="screw br"></span>
        <span class="dymo" id="lookTitre" style="align-self:center">BEESKOT Studio fait peau neuve</span>
        <span class="nt" style="text-align:center">Moins de boutons, un menu plus court, un tapis et une couleur pour chaque section, les pins du groupe en haut. Toutes les fonctions sont toujours là.</span>
        <div class="look-cartes">
          <button class="look-carte on" data-l="neuf" aria-pressed="true"><b>Essayer le nouveau look</b><span class="nt">Menu rangé : Musique, Contenus, Organisation, Show. Conseillé.</span></button>
          <button class="look-carte" data-l="neuf1" aria-pressed="false"><b>Garder l'ancien pour l'instant</b><span class="nt">Les boutons d'avant (avec relief). Tu pourras passer au nouveau quand tu veux.</span></button>
        </div>
        <span class="nt">Changer plus tard : Réglages › Ce PC › Apparence. Chacun choisit sur son PC.</span>
        <div class="stopbox-btns"><button class="btn pri" id="lookOk">C'est parti</button></div></div>`;
    document.body.appendChild(v);
    v.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { choix = b.dataset.l;
      v.querySelectorAll('[data-l]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); });
    v.querySelector('#lookOk').onclick = () => { v.remove(); L.choisir(choix); };
  },
  choisir(v) { const avant = BK.reglage('look', null); BK.regler('look', v); if (v !== avant) location.reload(); },
};
})();

// garde-fou : la fenêtre du logiciel ne défile jamais (tout défile DANS les cadres). Un « amener à l'écran » (scrollIntoView)
// pouvait la faire glisser de quelques pixels et couper le haut (tapis, logo) : on la remet aussitôt en place.
window.addEventListener('scroll', () => { if (window.scrollY || window.scrollX) window.scrollTo(0, 0); }, { passive: true });
