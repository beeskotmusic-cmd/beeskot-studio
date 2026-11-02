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
    body.classList.toggle(d.cls, !!cache); BK.regler(d.cle, !!cache); majTexte(b); resize(); majPlier();
  };
  // tout replier (s'il reste quelque chose d'ouvert) ou tout déplier
  //   nouveau look : le bandeau du haut ne se replie jamais (il porte le bouton ⤢), seuls menu, droite et bas se replient
  var neuf = function () { return !!(BK.look && BK.look.neuf && BK.look.neuf()); };
  var bordsActifs = function () { return Object.keys(BORDS).filter(function (b) { return !(neuf() && b === 'haut'); }); };
  BK.toutReplier = function () {
    var ouvert = !body.classList.contains('menu-etroit') || bordsActifs().some(function (b) { return !body.classList.contains(BORDS[b].cls); });
    bordsActifs().forEach(function (b) { BK.bord(b, ouvert); });
    if (neuf()) BK.bord('haut', false);
    BK.regler('menu.etroit', ouvert); BK.volet(ouvert); majPlier();
  };
  // le bouton ⤢ dans la barre du haut (nouveau look) : un clic replie tout, un autre déplie tout ; doré quand tout est replié
  function majPlier() {
    var b = document.getElementById('btPlier'); if (!b) return;
    var tout = body.classList.contains('menu-etroit') && bordsActifs().every(function (x) { return body.classList.contains(BORDS[x].cls); });
    b.classList.toggle('on', tout); b.title = (tout ? 'Tout déplier' : 'Tout replier : menu, colonne de droite, barre du bas') + ' (Ctrl + Maj + F)';
    b.setAttribute('aria-pressed', tout);
  }
  BK.plierInstaller = function () {
    if (!neuf() || document.getElementById('btPlier')) return;
    var sys = document.querySelector('header.top .sys'); if (!sys) return;
    var b = document.createElement('button'); b.id = 'btPlier'; b.type = 'button'; b.className = 'fil-cloche plier-tout';
    b.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';
    b.onclick = BK.toutReplier; sys.prepend(b);
    if (body.classList.contains('haut-cache')) BK.bord('haut', false);      // un bandeau caché d'avant revient : le bouton doit rester visible
    majPlier();
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
  BK.plierInstaller();

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && (e.key === 'F' || e.key === 'f')) { e.preventDefault(); BK.toutReplier(); }
  });
  document.addEventListener('dblclick', function (e) {
    var h = e.target.closest && e.target.closest('#pages .hdr');
    if (!h || e.target.closest('button, input, select, textarea, a, .vfd')) return;
    BK.toutReplier();
  });
})();
