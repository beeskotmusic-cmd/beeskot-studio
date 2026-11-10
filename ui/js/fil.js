// =====================================================================
// LE FIL DU GROUPE (nouveau look) — « ce que les autres ont fait », à un seul endroit :
//   la cloche en haut (le badge = ce qui est nouveau depuis ta dernière visite), un tiroir à droite (qui est là,
//   puis le journal jour par jour ; un clic sur une ligne ouvre l'endroit), et les dernières lignes sur l'Accueil.
//   Les lignes viennent du journal déjà partagé (collection « activite », voir js/miette.js).
// =====================================================================
(() => {
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const COUL = { Yacine: '#f1c453', Pierre: '#5fb0ff', Baptiste: '#c58af0', Studio: '#6fc39a' };
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
    return `<button class="fil-l${neuf ? ' neuf' : ''}" data-va="${esc(x.onglet || 'accueil')}" data-sujet="${esc(x.sujet || '')}" data-cible="${esc(x.cible || '')}" data-parent="${esc(x.parent || '')}"><span class="fil-h">${hm(new Date(x.t))}</span>
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
    t.onclick = e => { const o = e.target.closest('[data-va]'); if (o) { F.fermer(); F.aller(o.dataset.va, o.dataset.sujet, o.dataset.cible, o.dataset.parent); } };
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
    la.innerHTML = (moi ? `<span class="fil-p on">● ${esc(moi)} ${BK.presence ? BK.presence.pictos(BK.presence.moiApps) : ''} · ${esc(ici)}</span>` : '') + pres.map(x => `<span class="fil-p on">● ${esc(x.qui)} ${BK.presence ? BK.presence.pictos(x.apps) : ''}${x.onglet ? ' · ' + esc(x.onglet) : ''}</span>`).join('')
      + ['Yacine', 'Pierre', 'Baptiste', 'Studio'].filter(m => m !== moi && !pres.some(x => String(x.qui).toLowerCase() === m.toLowerCase())).map(m => `<span class="fil-p">${m} · pas là</span>`).join('');
    c.innerHTML = lignes.length ? F.liste(lignes.slice(0, 120), F.vuAvant || 0) : '<span class="nt">Rien pour l\'instant. Ce que chacun fait (notes, tâches, dates, reels…) arrive ici.</span>';
  },
  fermer() { const t = $('#filTiroir'); if (t) t.remove(); ouvert = false; $('#btFil') && $('#btFil').classList.remove('on');
    document.removeEventListener('keydown', F.echap, true); document.removeEventListener('pointerdown', F.dehors, true); },
  echap(e) { if (e.key === 'Escape' && !document.querySelector('.voile:not(.hidden)')) { e.stopPropagation(); F.fermer(); } },
  dehors(e) { if (!e.target.closest('#filTiroir, #btFil, .voile:not(.hidden)')) F.fermer(); },
  // un reel dans un tournage : on déplie le tournage qui le contient (une seule fois), puis on ouvre le reel et on le met en surbrillance
  // l'identifiant est connu : le tournage (parent) se déplie, puis le reel (cible) s'ouvre et s'allume — sans rien chercher
  allerId(cible, parent, essai, clique) {
    const page = document.getElementById('p-tournage'); if (!page) return;
    const q = (a, v) => page.querySelector(`[${a}="${CSS.escape(v)}"]`);
    const reel = q('data-rid', cible);
    if (reel && reel.offsetParent) {
      const plir = reel.querySelector('[data-plir]'), deplier = plir && !reel.classList.contains('ouvert');
      if (deplier) plir.click();
      return setTimeout(() => { const el = q('data-rid', cible) || reel; F.voir(el); F.flash(el); }, deplier ? 450 : 60);
    }
    const tour = page.querySelector(`.to-item[data-tour="${CSS.escape(parent || cible)}"]`);       // la ligne du tournage : on le déplie (sauf s'il l'est déjà)
    if (tour && !clique && !tour.classList.contains('on')) { tour.click(); clique = true; }
    if (essai < 12) return setTimeout(() => F.allerId(cible, parent, essai + 1, clique || !!tour), 250);
    if (tour) F.flash(tour); else page.querySelector('.hdr') && F.flash(page.querySelector('.hdr'));
  },
  allerReel(mot, i = 0, attente = 0, essai = 0) {
    const page = document.getElementById('p-tournage'); if (!page) return;
    const txt = el => (el.textContent || '').toLowerCase();
    const reel = [...page.querySelectorAll('[data-rid]')].find(el => el.offsetParent && txt(el).includes(mot));
    if (reel) {                                                    // le reel est là (son tournage est déplié) : on le déplie et on le surligne
      const plir = reel.querySelector('[data-plir]'); if (plir && !reel.classList.contains('ouvert')) plir.click();
      const id = reel.dataset.rid, quand = () => { const el = page.querySelector(`[data-rid="${CSS.escape(id)}"]`) || reel; F.voir(el); F.flash(el); };
      setTimeout(quand, plir && !reel.classList.contains('ouvert') ? 450 : 60);     // le plier ré-affiche la page : on surligne l'élément neuf
      return;
    }
    // sinon : on déplie le tournage suivant, un par un, jusqu'à trouver celui qui contient ce reel
    const tournages = [...page.querySelectorAll('.to-item[data-tour]')];
    if (!tournages.length && essai < 12) return setTimeout(() => F.allerReel(mot, 0, 0, essai + 1), 250);      // la liste des tournages n'est pas encore là
    if (attente === 0 && i < tournages.length) { tournages[i].click(); return setTimeout(() => F.allerReel(mot, i + 1, 0, 0), 380); }
    if (attente === 0) page.querySelector('.hdr') && F.flash(page.querySelector('.hdr'));   // introuvable : l'en-tête de la page
  },
  // amène un élément au centre de SON cadre qui défile (jamais la fenêtre entière : elle glissait et coupait le haut)
  voir(el) {
    if (!el) return; let c = el.parentElement;
    while (c && c !== document.body) { const o = getComputedStyle(c).overflowY; if ((o === 'auto' || o === 'scroll') && c.scrollHeight > c.clientHeight) break; c = c.parentElement; }
    if (!c || c === document.body) return;
    const r = el.getBoundingClientRect(), rc = c.getBoundingClientRect();
    c.scrollTo({ top: c.scrollTop + (r.top - rc.top) - (c.clientHeight - r.height) / 2, behavior: 'smooth' });
  },
  flash(el) { if (!el) return; el.classList.remove('fil-flash'); void el.offsetWidth; el.classList.add('fil-flash'); setTimeout(() => el.classList.remove('fil-flash'), 3200); },
  // ouvre l'onglet puis met en surbrillance ce qui a été ajouté : la fiche / le cadre qui parle du sujet (sinon l'en-tête de la page),
  // et l'entrée du menu clignote avec la couleur de la section
  aller(onglet, sujet, cible, parent) {
    BK.ouvrir(onglet);
    if (onglet === 'tournage' && cible) return F.allerId(cible, parent, 0, false);          // on sait exactement quoi : droit dessus
    if (onglet === 'tournage' && String(sujet || '').trim().length >= 3) return F.allerReel(String(sujet).trim().toLowerCase(), 0);
    const page = document.getElementById('p-' + (document.getElementById('p-' + onglet) ? onglet : 'accueil'));
    const chef = BK.look && BK.look.chef ? BK.look.chef(onglet) : onglet, tab = document.querySelector(`#nav .tab[data-p="${CSS.escape(chef)}"]`);
    const flash = el => { if (!el) return; el.classList.remove('fil-flash'); void el.offsetWidth; el.classList.add('fil-flash'); setTimeout(() => el.classList.remove('fil-flash'), 3200); };
    flash(tab);
    const cherche = (essais = 0) => {
      if (!page) return;
      let cible = null; const mot = String(sujet || '').trim().toLowerCase();
      if (mot.length >= 3) {
        const w = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) {
          if (!n.nodeValue.toLowerCase().includes(mot)) continue;
          const el = n.parentElement; if (!el || !el.offsetParent || el.closest('.hidden, script, style')) continue;
          cible = el.closest('.fiche, .cal-ev, tr, li, [data-id], [data-t], .box, .pane') || el; break;
        }
      }
      if (!cible && essais < 4) return setTimeout(() => cherche(essais + 1), 250);          // la page se remplit (Drive) : on réessaie un peu
      if (!cible) cible = page.querySelector('.hdr') || page;
      F.voir(cible); flash(cible);
    };
    setTimeout(cherche, 200);
  },
  // sur l'Accueil (nouveau look) : les 8 dernières lignes
  accueil() {
    const z = $('#acFil'); if (!z) return;
    const n = F.nouveaux();
    z.innerHTML = `<div class="ligne-titre"><span class="lb">Fil du groupe</span>${n ? `<span class="fil-n">${n} nouveau${n > 1 ? 'x' : ''}</span>` : ''}<button class="btn xs" id="acFilTout" style="margin-left:auto">Tout voir</button></div>
      <div class="fil-corps">${lignes.length ? F.liste(lignes.slice(0, 8), F.vu()) : '<span class="nt">Rien pour l\'instant : ce que chacun fait arrive ici.</span>'}</div>`;
    z.onclick = e => { if (e.target.closest('#acFilTout')) return F.ouvrir(); const o = e.target.closest('[data-va]'); if (o) F.aller(o.dataset.va, o.dataset.sujet, o.dataset.cible, o.dataset.parent); };
  },
};
BK.filMaj = () => F.maj();                                              // appelé quand le journal change sur le Drive (js/miette.js)
})();
