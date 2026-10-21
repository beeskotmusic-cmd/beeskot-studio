// =====================================================================
// QUOI DE NEUF — l'écran qui s'affiche une fois, juste après une mise à jour.
// Pour une nouvelle version : ajouter un bloc EN HAUT de la liste, en phrases simples.
// =====================================================================
BK.NOUVEAUTES = [
  { v: '0.9.50', titre: 'Plus simple, plus clair', l: [
    ['🍞', 'Bibliothèque : « Vérifier les infos des morceaux ». Miette relit Discord et remet les BPM que vous avez écrits (Mother 78, Moon Blue 75…).'],
    ['👕', 'Tournages : les tenues avec des photos, et « Qui porte quoi ? » qui les trouve sur Discord.'],
    ['🖱', 'Médias : clic droit → un menu en cascade (Morceaux ▸, Tournage ▸, Réseaux ▸…). Barre du haut sur une seule petite ligne.'],
    ['🎨', 'Reels Photo : « Recadrer et couleur » en petit tableau, la couleur dans un menu avec « Ajouter une LUT ».'],
    ['🎬', 'Reels : on change l\'image directement sur le poster (🖼), et le type (Reel, TikTok, Clip…) dans un petit menu.'],
    ['🔧', 'Tournages : les encadrés repliés se rouvrent bien.'],
    ['⬇', 'Les mises à jour arrivent dans un grand pop-up, et ce petit écran te dit ce qui a changé.'],
    ['⏭', 'S\'il te manque plusieurs mises à jour, BEESKOT Studio installe directement la toute dernière.'],
  ] },
];

BK.nouveautes = {
  num: v => String(v || '').replace(/[^\d.]/g, ''),
  // à l'ouverture : si la version a changé depuis la dernière fois, on montre ce qui est neuf
  verifier() {
    const ici = BK.nouveautes.num(BK.version); let vu = BK.reglage('nouveautes.vu', '');
    if (!vu) {
      if (!BK.reglage('bienvenue.vue', false)) { BK.regler('nouveautes.vu', ici); return; }   // tout premier lancement : le guide de bienvenue suffit
      vu = '0.9.49';                                                  // le logiciel était déjà là avant que cet écran existe
    }
    if (vu === ici) return;
    BK.regler('nouveautes.vu', ici);
    const l = BK.NOUVEAUTES.filter(n => BK.nouveautes.plusRecent(n.v, vu) && !BK.nouveautes.plusRecent(n.v, ici));
    if (l.length) setTimeout(() => BK.nouveautes.montrer(l), 1200);
  },
  plusRecent(a, b) { const x = a.split('.').map(Number), y = String(b).split('.').map(Number);
    for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; },
  montrer(l = BK.NOUVEAUTES.slice(0, 1)) {
    if (document.getElementById('nvVoile')) return;
    const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const v = document.createElement('div'); v.className = 'voile'; v.id = 'nvVoile';
    v.innerHTML = `<div class="stopbox nv-box">
      <span class="screw tl"></span><span class="screw tr"></span><span class="screw bl"></span><span class="screw br"></span>
      <button class="btn xs rt-x" data-nv="x" title="Fermer">✕</button>
      <span class="dymo" style="align-self:center">Quoi de neuf ?</span>
      <div class="nv-l">${l.map(n => `<div class="nv-v"><span class="vfd">${esc(n.v)}</span>${n.titre ? `<b>${esc(n.titre)}</b>` : ''}</div>
        ${n.l.map(([ic, t]) => `<div class="nv-i"><span>${ic}</span><p>${esc(t)}</p></div>`).join('')}`).join('')}</div>
      <button class="btn pri" data-nv="ok" style="width:100%;justify-content:center">C'est parti ▶</button></div>`;
    document.body.appendChild(v);
    const fermer = () => v.remove();
    v.querySelectorAll('[data-nv]').forEach(b => b.onclick = fermer);
    v.addEventListener('click', e => { if (e.target === v) fermer(); });
  },
};
