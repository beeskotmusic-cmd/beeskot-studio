// =====================================================================
// LE VISEUR MIETTE (nouveau look, idée de Dari) — un clic sur le patch Miette : le curseur devient Miette,
// les cadres qu'elle sait remplir s'entourent de pointillés ; un clic sur l'un d'eux, et elle s'y met.
//   Échap, clic droit, clic à côté ou nouveau clic sur le patch : on sort sans rien lancer.
//   Rien n'est réécrit : chaque cadre réutilise le bouton « .miette-aide » qui est déjà dans la page (caché
//   dans le nouveau look). Un bouton dans un élément [data-mi-zone] vise cet élément ; sinon le cadre (.box) autour.
//   La petite flèche ▾ à côté du patch ouvre le menu Miette habituel (Tout relire, Actualiser, Qui est là…).
// =====================================================================
(() => {
const $ = s => document.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let actif = false, cibles = [];
const nom = b => (b.dataset.mi || b.textContent || b.title || 'Miette').replace(/\s+/g, ' ').trim().slice(0, 40);
const zoneDe = b => b.closest('[data-mi-zone]') || b.closest('.box') || b.closest('.pane') || b.parentElement;

const V = BK.viseur = {
  actif: () => actif,
  installer() {
    if (!BK.look || !BK.look.neuf()) return;
    const bm = $('#btMiette'); if (!bm || $('#btMietteMenu')) return;
    bm.title = 'Miette : clique ici, puis sur ce qu\'elle doit remplir';
    // le menu Miette : un vrai bouton (même taille que la cloche), placé à gauche de la cloche (ordre fixé en CSS)
    const f = document.createElement('button'); f.className = 'fil-cloche mi-menu-b'; f.id = 'btMietteMenu'; f.type = 'button'; f.title = 'Le menu Miette : tout relire, actualiser, qui est là…';
    f.setAttribute('aria-label', 'Le menu Miette');
    f.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1.2" fill="currentColor"/><circle cx="4" cy="12" r="1.2" fill="currentColor"/><circle cx="4" cy="18" r="1.2" fill="currentColor"/></svg>';
    bm.after(f); f.onclick = e => { e.stopPropagation(); V.sortir(); BK.menuMiette && BK.menuMiette(f); };
  },
  basculer() { actif ? V.sortir() : V.entrer(); },
  // les boutons Miette de ce qu'on voit : la page ouverte, et une fenêtre ouverte par-dessus (ex. Veo)
  boutons() {
    const fen = $$('.voile:not(.hidden)').pop(), racine = fen || $('#pages > section:not(.hidden)');
    return racine ? $$('.miette-aide', racine).filter(b => !b.disabled && !b.closest('.hidden')) : [];
  },
  entrer() {
    if (document.body.classList.contains('sans-miette')) return BK.avis && BK.avis('AI Miette est coupée sur ce PC (en bas du menu)');
    const bs = V.boutons();
    if (!bs.length) return BK.avis && BK.avis('Ici, Miette n\'a rien à remplir. Le menu ▾ à côté d\'elle : tout relire, actualiser…');
    actif = true; document.body.classList.add('miette-vise'); $('#btMiette') && $('#btMiette').classList.add('vise');
    const zones = new Map();
    bs.forEach(b => { const z = zoneDe(b); if (!zones.has(z)) zones.set(z, []); zones.get(z).push(b); });
    cibles = [...zones].map(([z, l]) => ({ z, l }));
    cibles.forEach((c, i) => { c.z.classList.add('mi-cible'); c.z.dataset.miEtiq = c.l.map(nom).join(' · '); c.z.dataset.miI = i; });
    const band = document.createElement('div'); band.className = 'mi-bandeau'; band.id = 'miBandeau'; band.setAttribute('role', 'status');
    band.innerHTML = `<img src="look/patch-miette.png" alt=""><b>Clique sur ce que Miette doit remplir</b><span>ou :</span>`
      + cibles.flatMap((c, i) => c.l.map((b, k) => `<button class="mi-puce" data-c="${i}" data-k="${k}">${esc(nom(b))}</button>`)).join('')
      + `<em>Échap pour sortir</em>`;
    document.body.appendChild(band);
    band.onclick = e => { const p = e.target.closest('[data-c]'); if (p) { e.stopPropagation(); V.lancer(cibles[+p.dataset.c].l[+p.dataset.k], cibles[+p.dataset.c].z); } };
    document.addEventListener('pointerdown', V.clic, true); document.addEventListener('click', V.bloque, true);
    document.addEventListener('keydown', V.touche, true); document.addEventListener('contextmenu', V.droit, true);
  },
  sortir() {
    if (!actif) return; actif = false;
    document.body.classList.remove('miette-vise'); $('#btMiette') && $('#btMiette').classList.remove('vise');
    cibles.forEach(c => { c.z.classList.remove('mi-cible'); delete c.z.dataset.miEtiq; delete c.z.dataset.miI; }); cibles = [];
    const band = $('#miBandeau'); band && band.remove(); const m = $('#miChoix'); m && m.remove();
    document.removeEventListener('pointerdown', V.clic, true); document.removeEventListener('click', V.bloque, true);
    document.removeEventListener('keydown', V.touche, true); document.removeEventListener('contextmenu', V.droit, true);
  },
  // un clic pendant le viseur : sur un cadre → Miette s'y met ; ailleurs → on sort (sans rien faire d'autre)
  clic(e) {
    if (e.button !== 0 || e.target.closest('#miBandeau, #miChoix, #btMiette, #btMietteMenu')) return;   // le patch : son clic fait sortir
    e.preventDefault(); e.stopPropagation();
    const z = e.target.closest('.mi-cible'), c = z && cibles[+z.dataset.miI];
    if (!c) return V.sortir();
    if (c.l.length === 1) return V.lancer(c.l[0], c.z);
    V.choix(c, e.clientX, e.clientY);                                     // plusieurs choses possibles ici (ex. Médias) : un petit menu
  },
  bloque(e) { if (actif && !e.target.closest('#miBandeau, #miChoix, #btMiette, #btMietteMenu')) { e.preventDefault(); e.stopPropagation(); } },
  touche(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); V.sortir(); } },
  droit(e) { e.preventDefault(); V.sortir(); },
  choix(c, x, y) {
    const m = $('#miChoix') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'miChoix', className: 'mi-choix' }));
    m.innerHTML = c.l.map((b, k) => `<button data-k="${k}">${esc(nom(b))}</button>`).join('');
    m.style.left = Math.min(x, innerWidth - 240) + 'px'; m.style.top = Math.min(y, innerHeight - 40 * c.l.length - 20) + 'px';
    m.onclick = e => { const b = e.target.closest('[data-k]'); if (b) V.lancer(c.l[+b.dataset.k], c.z); };
  },
  // Miette s'y met : on appuie sur son vrai bouton ; le cadre montre qu'elle travaille tant que le bouton est occupé
  async lancer(b, z) {
    V.sortir();
    if (b.id === 'taMiAjout') {                                           // To-do : « Dis-le à Miette » demande du texte
      const ch = $('#taMiTexte'); if (ch && !ch.value.trim()) { const t = await BK.saisir('Dis-le à Miette : qui fait quoi, et pour quand ?', '', { oui: 'Miette l\'ajoute' }); if (!t) return; ch.value = t; }
    }
    b.click();
    z.classList.add('mi-travail'); const fin = Date.now() + 180e3;
    const suivre = () => { const occupe = b.disabled || !!b.querySelector('.spin');
      if (occupe && Date.now() < fin) return setTimeout(suivre, 400);
      z.classList.remove('mi-travail'); };
    setTimeout(suivre, 400);
  },
};
})();
