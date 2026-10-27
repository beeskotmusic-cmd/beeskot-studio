// =====================================================================
// LES LANGUETTES SUR LES BORDS : chaque languette replie ce qui est juste à côté d'elle.
//   en haut   → le bandeau (logo, STOP, CHARGE…) + le titre de la page    classe body : haut-cache
//   à gauche  → le menu (languette déjà dans coeur.js) classe body : menu-etroit
//   à droite  → la colonne de droite de la page        classe body : droite-cachee
//   en bas    → la barre du bas de la page (PRÊT, Export…) classe body : bas-cache
// Tout d'un coup : Ctrl + Maj + F, ou double-clic sur le titre de la page.
// Repliée = languette jaune (bien visible). Chaque état est gardé sur ce PC.
// =====================================================================
(function () {
  var body = document.body;
  var BORDS = {
    haut:   { cls: 'haut-cache',    cle: 'bord.haut',   ouvert: '▴', ferme: '▾', nom: 'le bandeau du haut et le titre de la page' },
    droite: { cls: 'droite-cachee', cle: 'bord.droite', ouvert: '›', ferme: '‹', nom: 'la colonne de droite' },
    bas:    { cls: 'bas-cache',     cle: 'bord.bas',    ouvert: '▾', ferme: '▴', nom: 'la barre du bas' }
  };
  function resize() { setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 280); }   // les aperçus se remettent à la bonne taille

  function majTexte(b) {
    var d = BORDS[b], el = document.getElementById('bord-' + b); if (!el) return;
    var cache = body.classList.contains(d.cls);
    el.textContent = cache ? d.ferme : d.ouvert;
    el.title = (cache ? 'Déplier ' : 'Replier ') + d.nom + ' (tout d\'un coup : Ctrl + Maj + F, ou double-clic sur le titre de la page)';
  }
  BK.bord = function (b, cache) {
    var d = BORDS[b]; if (!d) return;
    if (cache === undefined) cache = !body.classList.contains(d.cls);
    body.classList.toggle(d.cls, !!cache); BK.regler(d.cle, !!cache); majTexte(b); resize();
  };
  // tout replier (s'il reste quelque chose d'ouvert) ou tout déplier
  BK.toutReplier = function () {
    var ouvert = !body.classList.contains('menu-etroit') || Object.keys(BORDS).some(function (b) { return !body.classList.contains(BORDS[b].cls); });
    Object.keys(BORDS).forEach(function (b) { BK.bord(b, ouvert); });
    BK.regler('menu.etroit', ouvert); BK.volet(ouvert);
  };

  // les languettes : haut et bas dans une petite « rainure » de hauteur 0 (ne prend pas de place), droite au bord de la rangée
  function poser(b, parent, avant) {
    if (!parent || document.getElementById('bord-' + b)) return;
    var bt = document.createElement('button'); bt.id = 'bord-' + b; bt.type = 'button';
    bt.onclick = function () { BK.bord(b); };
    if (b === 'droite') { bt.className = 'volet volet-d'; parent.appendChild(bt); }
    else { var r = document.createElement('div'); r.className = 'rainure rainure-' + b; bt.className = 'languette'; r.appendChild(bt); parent.insertBefore(r, avant || null); }
  }
  var app = document.querySelector('.app'), rowm = document.querySelector('.rowm');
  poser('haut', app, rowm);
  poser('droite', rowm);
  poser('bas', app, rowm && rowm.nextSibling);

  // au démarrage : comme la dernière fois
  Object.keys(BORDS).forEach(function (b) { body.classList.toggle(BORDS[b].cls, !!BK.reglage(BORDS[b].cle, false)); majTexte(b); });

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && (e.key === 'F' || e.key === 'f')) { e.preventDefault(); BK.toutReplier(); }
  });
  document.addEventListener('dblclick', function (e) {
    var h = e.target.closest && e.target.closest('#pages .hdr');
    if (!h || e.target.closest('button, input, select, textarea, a, .vfd')) return;
    BK.toutReplier();
  });
})();
