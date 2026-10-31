// =====================================================================
// LE FIL DU GROUPE (nouveau look) — « ce que les autres ont fait », à un seul endroit :
//   la cloche en haut (le badge = ce qui est nouveau depuis ta dernière visite), un tiroir à droite (qui est là,
//   puis le journal jour par jour ; un clic sur une ligne ouvre l'endroit), et les dernières lignes sur l'Accueil.
//   Les lignes viennent du journal déjà partagé (collection « activite », voir js/miette.js).
// =====================================================================
(() => {
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const COUL = { Yacine: '#f1c453', Pierre: '#5fb0ff', Baptiste: '#c58af0' };
const hm = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
const jourDe = t => { const d = new Date(t), a = new Date(), h = new Date(Date.now() - 864e5);
  return d.toDateString() === a.toDateString() ? 'Aujourd\'hui' : d.toDateString() === h.toDateString() ? 'Hier' : d.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' }); };
let lignes = [], ouvert = false;

const F = BK.fil = {
  vu: () => +BK.reglage('fil.vu', 0) || 0,
  autres: l => l.filter(x => x.qui && x.qui !== BK.reglage('nomPc', '')),
  nouveaux: () => F.autres(lignes).filter(x => (x.t || 0) > F.vu()).length,
  // la cloche, posée dans la barre du haut juste avant Miette
  installer() {
    if (!BK.look || !BK.look.neuf() || $('#btFil')) return;
    const sys = $('header.top .sys'); if (!sys) return;
    const b = document.createElement('button'); b.className = 'fil-cloche'; b.id = 'btFil'; b.type = 'button'; b.title = 'Le fil du groupe : ce que les autres ont fait';
    b.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg><span class="fil-badge" hidden></span>';
    sys.prepend(b); b.onclick = () => ouvert ? F.fermer() : F.ouvrir();
    F.maj();
  },
  async maj() {
    if (!BK.look || !BK.look.neuf() || !BK.journalLire) return;
    lignes = await BK.journalLire().catch(() => lignes);
    const n = F.nouveaux(), g = $('#btFil .fil-badge');
    if (g) { g.hidden = !n; g.textContent = n > 9 ? '9+' : n; $('#btFil').setAttribute('aria-label', n ? `Le fil du groupe : ${n} nouveauté${n > 1 ? 's' : ''}` : 'Le fil du groupe'); }
    if (ouvert) F.remplir();
    F.accueil();
  },
  // une ligne du journal → un bouton qui ouvre l'endroit
  ligne(x, neuf) {
    return `<button class="fil-l${neuf ? ' neuf' : ''}" data-va="${esc(x.onglet || 'accueil')}"><span class="fil-h">${hm(new Date(x.t))}</span>
      <span><b style="color:${COUL[x.qui] || '#d9b67a'}">${esc(x.qui)}</b> ${esc(x.quoi)}${x.sujet ? ' · <i>' + esc(x.sujet) + '</i>' : ''}</span></button>`;
  },
  liste(l, vu) { let jour = '';
    return l.map(x => { const j = jourDe(x.t), t = j !== jour ? `<span class="fil-jour">${esc(j)}</span>` : ''; jour = j; return t + F.ligne(x, (x.t || 0) > vu && x.qui !== BK.reglage('nomPc', '')); }).join(''); },
  ouvrir() {
    if (ouvert) return; ouvert = true; F.vuAvant = F.vu();
    const t = document.createElement('aside'); t.className = 'fil-tiroir'; t.id = 'filTiroir'; t.setAttribute('aria-label', 'Le fil du groupe');
    t.innerHTML = `<div class="fil-tete"><span class="dymo">Fil du groupe</span><button class="btn xs" id="filActu" title="Relire le Drive maintenant">↻ Actualiser</button><button class="btn xs" id="filX" aria-label="Fermer">✕</button></div>
      <div class="fil-la" id="filLa"></div><div class="fil-corps" id="filCorps"><span class="nt"><span class="spin"></span>…</span></div>
      <span class="nt fil-pied">Clic sur une ligne : ça ouvre l'endroit. Les nouveautés depuis ta dernière visite ont un trait de couleur.</span>`;
    document.body.appendChild(t); $('#btFil') && $('#btFil').classList.add('on');
    t.onclick = e => { const o = e.target.closest('[data-va]'); if (o) { F.fermer(); BK.ouvrir(o.dataset.va); } };
    $('#filX').onclick = F.fermer;
    $('#filActu').onclick = async () => { const b = $('#filActu'); b.disabled = true; b.innerHTML = '<span class="spin"></span>…';
      try { if (BK.db.viderAttente) await BK.db.viderAttente(); window.dispatchEvent(new CustomEvent('bk:distant', { detail: { cols: (BK.synchro && BK.synchro.COLS) || [] } }));
        BK.presence && await BK.presence.maj(true); await F.maj(); BK.avis && BK.avis('À jour : ce que les autres ont fait est arrivé'); }
      catch (e) { BK.avis && BK.avis('Drive injoignable pour l\'instant'); }
      b.disabled = false; b.textContent = '↻ Actualiser'; };
    F.remplir(); F.maj();
    document.addEventListener('keydown', F.echap, true); setTimeout(() => document.addEventListener('pointerdown', F.dehors, true), 0);
    BK.regler('fil.vu', Date.now());                                    // vu : le badge s'éteint (le trait reste le temps de l'ouverture)
    const g = $('#btFil .fil-badge'); if (g) g.hidden = true;
  },
  remplir() {
    const c = $('#filCorps'), la = $('#filLa'); if (!c) return;
    const moi = BK.reglage('nomPc', ''), ici = (BK.onglets.find(o => o.id === BK.reglage('dernierOnglet', 'accueil')) || {}).titre || '';
    const pres = (BK.presence && BK.presence.derniers) || [];
    la.innerHTML = (moi ? `<span class="fil-p on">● ${esc(moi)} · ${esc(ici)}</span>` : '') + pres.map(x => `<span class="fil-p on">● ${esc(x.qui)}${x.onglet ? ' · ' + esc(x.onglet) : ''}</span>`).join('')
      + ['Yacine', 'Pierre', 'Baptiste'].filter(m => m !== moi && !pres.some(x => String(x.qui).toLowerCase() === m.toLowerCase())).map(m => `<span class="fil-p">${m} · pas là</span>`).join('');
    c.innerHTML = lignes.length ? F.liste(lignes.slice(0, 120), F.vuAvant || 0) : '<span class="nt">Rien pour l\'instant. Ce que chacun fait (notes, tâches, dates, reels…) arrive ici.</span>';
  },
  fermer() { const t = $('#filTiroir'); if (t) t.remove(); ouvert = false; $('#btFil') && $('#btFil').classList.remove('on');
    document.removeEventListener('keydown', F.echap, true); document.removeEventListener('pointerdown', F.dehors, true); },
  echap(e) { if (e.key === 'Escape' && !document.querySelector('.voile:not(.hidden)')) { e.stopPropagation(); F.fermer(); } },
  dehors(e) { if (!e.target.closest('#filTiroir, #btFil, .voile:not(.hidden)')) F.fermer(); },
  // sur l'Accueil (nouveau look) : les 8 dernières lignes
  accueil() {
    const z = $('#acFil'); if (!z) return;
    const n = F.nouveaux();
    z.innerHTML = `<div class="ligne-titre"><span class="lb">Fil du groupe</span>${n ? `<span class="fil-n">${n} nouveau${n > 1 ? 'x' : ''}</span>` : ''}<button class="btn xs" id="acFilTout" style="margin-left:auto">Tout voir</button></div>
      <div class="fil-corps">${lignes.length ? F.liste(lignes.slice(0, 8), F.vu()) : '<span class="nt">Rien pour l\'instant : ce que chacun fait arrive ici.</span>'}</div>`;
    z.onclick = e => { if (e.target.closest('#acFilTout')) return F.ouvrir(); const o = e.target.closest('[data-va]'); if (o) BK.ouvrir(o.dataset.va); };
  },
};
BK.filMaj = () => F.maj();                                              // appelé quand le journal change sur le Drive (js/miette.js)
})();
