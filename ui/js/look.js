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
const MEMBRES = ['Yacine', 'Pierre', 'Baptiste'];
const PIN = n => 'look/pins/' + n.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '') + '.png';

const L = BK.look = {
  neuf: () => BK.reglage('look', null) === 'neuf',
  choisi: () => BK.reglage('look', null) !== null,
  pasPret: id => L.neuf() && PAS_PRETS.includes(id),
  sectionDe: id => Object.keys(SECTIONS).find(k => SECTIONS[k].ids.includes(id)) || 'general',
  // les groupes du menu : [{ id, titre, ids }] (les onglets ajoutés plus tard et pas encore rangés : dans le premier groupe)
  groupes() {
    const ranges = new Set(Object.values(SECTIONS).flatMap(s => s.ids));
    const reste = BK.onglets.map(o => o.id).filter(id => !ranges.has(id));
    return Object.entries(SECTIONS).map(([id, s], i) => ({ id, titre: s.titre, ids: i === 0 ? [...s.ids, ...reste] : s.ids }));
  },
  appliquer() {
    document.body.classList.toggle('look-neuf', L.neuf());
    if (!L.neuf()) return;
    const top = $('header.top'); if (top && !$('#syPins')) {
      const p = document.createElement('div'); p.className = 'pins'; p.id = 'syPins'; p.setAttribute('aria-label', 'Qui est là');
      top.insertBefore(p, top.querySelector('.sys')); L.pins([]);
    }
  },
  // l'onglet ouvert → sa section : le tapis (en fondu), la couleur, le titre du groupe allumé
  section(id) {
    if (!L.neuf()) return;
    const k = L.sectionDe(id), b = document.body;
    document.querySelectorAll('#nav .cote').forEach(c => c.classList.toggle('on', c.dataset.cote === k));
    if (b.dataset.section === k) return;
    const top = $('header.top'), avant = b.dataset.section && top ? getComputedStyle(top).backgroundImage : '';
    b.dataset.section = k;
    if (!avant || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const o = document.createElement('div'); o.className = 'tapis-avant'; o.style.backgroundImage = avant; top.prepend(o);
    requestAnimationFrame(() => requestAnimationFrame(() => { o.style.opacity = '0'; }));
    setTimeout(() => o.remove(), 450);
  },
  // les pins brodés : allumés = sur BEESKOT Studio en ce moment (survol : où) ; le sien se clique (Réglages › Ce PC)
  pins(autres) {
    const z = $('#syPins'); if (!z) return;
    const moi = BK.reglage('nomPc', ''), ou = {};
    (autres || []).forEach(x => { ou[String(x.qui || '').toLowerCase()] = x.onglet || ''; });
    const ici = (BK.onglets.find(o => o.id === BK.reglage('dernierOnglet', 'accueil')) || {}).titre || '';
    z.innerHTML = MEMBRES.map(m => { const lui = m === moi, la = lui || ou[m.toLowerCase()] !== undefined, onglet = lui ? ici : ou[m.toLowerCase()];
      const t = lui ? `${m} (toi, sur ce PC)${onglet ? ' · ' + onglet : ''} : clic pour changer` : la ? `${m} · ${onglet || 'en ligne'}` : `${m} · pas là`;
      return `<button class="pin${la ? ' la' : ''}${lui ? ' moi' : ''}" ${lui ? '' : 'tabindex="-1"'} title="${t}" aria-label="${t}"><img src="${PIN(m)}" alt=""></button>`; }).join('')
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
          <button class="look-carte" data-l="ancien" aria-pressed="false"><b>Garder l'ancien pour l'instant</b><span class="nt">Tout reste comme avant. Tu pourras passer au nouveau quand tu veux.</span></button>
        </div>
        <span class="nt">Changer plus tard : Réglages › Ce PC › Apparence. Chacun choisit sur son PC.</span>
        <div class="stopbox-btns"><button class="btn pri" id="lookOk">C'est parti</button></div></div>`;
    document.body.appendChild(v);
    v.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { choix = b.dataset.l;
      v.querySelectorAll('[data-l]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); });
    v.querySelector('#lookOk').onclick = () => { v.remove(); L.choisir(choix); };
  },
  choisir(v) { const avant = L.neuf(); BK.regler('look', v); if ((v === 'neuf') !== avant) location.reload(); },
};
})();
