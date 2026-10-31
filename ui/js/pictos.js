// =====================================================================
// LES PICTOS BEESKOT — remplace certains emojis par les dessins maison.
// Pour changer un picto : on ne touche QU'À la table PICTOS ci-dessous.
// Le texte de l'emoji reste dans la page (invisible), donc rien ne casse.
// A_ = tampon (petits boutons) · H_ = brodé (pictos principaux)
// Zone : toute l'app (voir EXCLUS).
// =====================================================================
(function () {
  var PICTOS = {
    '☰': 'A_menu', '❚❚': 'A_pause', '✕': 'A_croix', '✓': 'A_coche', '✔': 'A_coche', '▶': 'A_lecture',
    '↻': 'A_sync', '⏮': 'A_precedent', '⏭': 'A_suivant',
    '⚙': 'A_engrenage', '🔧': 'A_engrenage', '🔍': 'A_loupe',
    '✎': 'A_crayon', '✏': 'A_crayon', '⬇': 'A_telecharger', '★': 'A_etoile',
    '🔊': 'A_volume', '🔗': 'A_lien', '💾': 'A_disquette', '⚠': 'A_alerte',
    '🔁': 'A_boucle', '⏹': 'A_stop', '👍': 'A_pouce',
    '🎧': 'A_casque', '🎛': 'A_mixeur',
    '🎤': 'H_micro', '🎬': 'H_clap', '✨': 'H_etincelle', '🚀': 'H_fusee',
    '🎵': 'H_note', '♪': 'H_note', '💬': 'H_bulle', '📁': 'H_dossier', '📂': 'H_dossier',
    '✅': 'A_coche', '⏪': 'A_precedent', '🎥': 'H_clap', '🎞': 'H_clap',
    '📣': 'H_megaphone', '📢': 'H_megaphone', '📰': 'H_presse'
  };
  // Partout dans l'app, sauf là où on écrit ou où ce n'est pas du texte affiché.
  var EXCLUS = 'script, style, textarea, input, select, option, title, [contenteditable], [contenteditable] *, .pic';

  var cles = Object.keys(PICTOS).map(function (c) { return c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
  var RE = new RegExp('(' + cles.join('|') + ')️?', 'g');

  function traiterTexte(n) {
    var t = n.nodeValue;
    if (!t || !RE.test(t)) { RE.lastIndex = 0; return; }
    RE.lastIndex = 0;
    var frag = document.createDocumentFragment(), dernier = 0, m;
    while ((m = RE.exec(t))) {
      if (m.index > dernier) frag.appendChild(document.createTextNode(t.slice(dernier, m.index)));
      var s = document.createElement('span');
      s.className = 'pic';
      var nom = PICTOS[m[1]], url = 'url(' + (window.BK_RACINE || '') + 'pictos/' + nom + '.png)';   // BK_RACINE : la page mobile est un dossier plus bas
      if (nom.charAt(0) === 'A') { s.className = 'pic a'; s.style.webkitMaskImage = url; s.style.maskImage = url; } // tampon : prend la couleur du texte
      else s.style.backgroundImage = url;                                                    // brodé : garde ses couleurs
      s.textContent = m[0];
      frag.appendChild(s);
      dernier = m.index + m[0].length;
    }
    if (dernier < t.length) frag.appendChild(document.createTextNode(t.slice(dernier)));
    n.parentNode.replaceChild(frag, n);
  }

  function traiter(racine) {
    if (!racine || racine.nodeType !== 1 || racine.closest(EXCLUS)) return;
    var w = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode;
        return p && p.closest && p.closest(EXCLUS) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    }), liste = [], n;
    while ((n = w.nextNode())) liste.push(n);
    liste.forEach(traiterTexte);
  }

  function demarrer() {
    traiter(document.body);
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        if (m.type === 'childList') m.addedNodes.forEach(function (n) { traiter(n.nodeType === 3 ? n.parentNode : n); });
        else if (m.type === 'characterData') traiter(m.target.parentNode);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  BK.pictos = PICTOS;
  if (document.body) demarrer(); else document.addEventListener('DOMContentLoaded', demarrer);
})();
