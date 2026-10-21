// =====================================================================
// QUOI DE NEUF — l'écran qui s'affiche une fois, juste après une mise à jour.
// Pour une nouvelle version : ajouter un bloc EN HAUT de la liste. Une ligne courte par point : « Onglet : ce qui change. »
// =====================================================================
BK.NOUVEAUTES = [
  { v: '0.9.51', titre: '', l: [
    ['🎨', 'Bibliothèque : une couleur par étape.'],
    ['📖', 'Réglages : tuto de tout le logiciel.'],
    ['✨', 'Réglages : revoir les nouveautés.'],
    ['🎬', 'Reels : noms courts et étiquette du morceau sur les posters.'],
    ['🖼', 'Reels Vidéo : une vidéo avec des photos et une musique.'],
    ['🎵', 'Reels Vidéo : musique depuis ce PC.'],
    ['📸', 'Reels Photo : 9:16 par défaut.'],
    ['🍞', 'Médias : Discord ne se recharge plus tout seul.'],
    ['⚡', 'Partout : moins de processeur et de mémoire utilisés.'],
  ] },
  { v: '0.9.50', titre: '', l: [
    ['🔧', 'Tournages : problème graphique réglé.'],
    ['🍞', 'Bouton jaune : Miette met à jour les BPM.'],
    ['🍞', 'Bibliothèque : vérifier les infos avec Miette.'],
    ['👕', 'Tournages : tenues en photos.'],
    ['🖱', 'Médias : clic droit en cascade.'],
    ['🎨', 'Reels Photo : réglages plus clairs.'],
    ['🎬', 'Reels : image modifiable sur le poster.'],
    ['⏭', 'Mises à jour : toujours la dernière.'],
  ] },
];

// =====================================================================
// LE TUTO — tout le logiciel, onglet par onglet, une ligne par fonction.
// À METTRE À JOUR à chaque push si une fonction apparaît, change ou disparaît.
// =====================================================================
BK.TUTO = [
  { o: 'Partout', ic: '🍞', l: [
    'Bouton jaune (biscotte) : Miette relit Discord et le Drive, et remplit tous les onglets.',
    'Bouton rouge (?) : version, mises à jour, relancer, fermer.',
    'ONLINE (en haut) : qui est connecté. EN CE MOMENT (en bas) : ce que font les autres.',
    'Ctrl + Z : annule la dernière action.',
    'Tout est enregistré sur le Drive et arrive sur les autres PC en moins d\'une minute.',
    'Chaque titre du menu de gauche se replie d\'un clic.' ] },
  { o: 'Accueil', ic: '🏠', l: [
    'Le prochain rendez-vous, ce qu\'on s\'est dit cette semaine sur Discord, la prochaine release.',
    'À faire : coche une case pour dire que c\'est fait.',
    'À droite : l\'avancement de chaque morceau, et les alertes.' ] },
  { o: 'Miette AI', ic: '🍞', l: [
    'Pose une question à Miette sur le groupe.',
    '« Ce que Miette a lu » : les salons Discord lus, et les mails recopiés par les bots (🤖).',
    'À valider : ce que Miette a repéré sur Discord (tâches, dates, dépenses).',
    'Améliorer BEESKOT Studio : écris ou dicte un problème, Miette en fait une note.' ] },
  { o: 'Bibliothèque', ic: '🎵', l: [
    'Next release, Work in progress, Sortis : glisse une fiche pour changer son statut ou son ordre.',
    '★ sur un export : c\'est LE bon fichier du morceau, utilisé partout.',
    'Clique la photo d\'une fiche pour la changer.',
    '🏷 Étiqueté BEESKOT : tout ce qui concerne le morceau (audio, projets, photos).',
    'BPM : ce que vous écrivez passe avant Discord, Ableton et la détection.',
    'Avancement : une couleur par étape (maquette rouge, enregistrement orange, mixage jaune…).',
    '🍞 Vérifier les infos des morceaux : Miette remet les BPM dits sur Discord.' ] },
  { o: 'Médias', ic: '🖼', l: [
    'Tous les dossiers du Drive, plus Discord (pas sur le Drive).',
    'Clic = choisir, Ctrl+clic = en ajouter, Maj+clic = toute une suite.',
    'Clic droit : les étiquettes, en cascade (Morceaux ▸, Tournage ▸, Réseaux ▸).',
    'Ou glisse les photos sur une étiquette en bas.',
    '− + : taille des vignettes. 🙈 : les fichiers masqués.',
    'Discord : chargé une fois, puis ↻ Actualiser Discord (à droite) pour les nouvelles images.' ] },
  { o: 'Reels', ic: '🎬', l: [
    'Un poster par reel : clique pour voir l\'audio, les médias, le moodboard, le tournage.',
    'Le nom court du poster (ex. Reel 1) se change en haut du panneau.',
    '🖼 sur le poster : changer l\'image. ↺ : revenir à l\'image automatique.',
    'Sortie prévue : la date va dans le Calendrier.',
    'Les 5 étapes (Idée → Publié) : chaque étape faite va dans la To-do de la personne.' ] },
  { o: 'Calendrier', ic: '📅', l: [
    'Les rendez-vous du groupe, et ceux que Miette a lus sur Discord.' ] },
  { o: 'To-do list', ic: '✅', l: [
    'Glisse une tâche dans le panier de quelqu\'un, ou dans « Déjà fait ».',
    'Miette propose : les tâches repérées sur Discord.' ] },
  { o: 'Budget', ic: '💰', l: [
    '↩ Ma part : tu as remboursé ta part d\'une dépense.',
    'Chaque mois / chaque année : les abonnements et le loyer reviennent tout seuls.',
    'Remboursements : qui fait un virement à qui.' ] },
  { o: 'Tournages', ic: '🎥', l: [
    'Une fiche par tournage. Chaque encadré se replie d\'un clic sur son titre.',
    'Moodboard : ＋ Ajouter des images (étiquetées, cloud ou Discord), étiquetées toutes seules.',
    'Références : colle des liens Instagram, TikTok, YouTube…',
    'Tenues : une photo par personne. 🍞 Qui porte quoi ? les trouve sur Discord.',
    'Imprimer / PDF : la fiche à donner à l\'équipe.' ] },
  { o: 'Ableton Live', ic: '🎛', l: [
    'Relie Ableton (A BEESKOT dans Control Surface), puis renomme, colore, gèle et zippe pour le mixage.',
    'Le tempo lu dans Ableton va dans la fiche du morceau.' ] },
  { o: 'Reels Audio', ic: '🎧', l: [
    'Choisis un morceau (le ★ de la Bibliothèque), un passage, sa durée, la vitesse de tournage.',
    'Exporter : le fichier MONTAGE, et le fichier TOURNAGE si la vitesse change.',
    'Après l\'export : 📂 Ouvrir le dossier, ⇪ Upload Drive.' ] },
  { o: 'Reels Photo', ic: '📸', l: [
    'Ajoute des photos, choisis le format (story 9:16 par défaut, 4:5, carré, paysage).',
    'Cadrage : Entière, Remplir, Centrer. Couleur : un filtre ou ta LUT.',
    'Exporter : 📂 Ouvrir le dossier, ⇪ Upload Drive.' ] },
  { o: 'Reels Vidéo', ic: '🎞', l: [
    'Une vidéo verticale avec la musique d\'un export Reels Audio (ou de ce PC), et des sous-titres.',
    '🖼 Des photos… : choisis des photos et leur durée (ou cale-les sur la musique), ça fabrique la vidéo.' ] },
  { o: 'Réglages', ic: '⚙', l: [
    'Qui utilise ce PC, taille de l\'interface, onglets affichés.',
    'Drive : carte d\'accès pour les autres PC, ⏪ Time Machine pour revenir en arrière.',
    'Miette : la clé Gemini et les salons Discord à lire.' ] },
];

BK.nouveautes = {
  // le tuto : un onglet à la fois, une ligne par fonction
  tuto(depart) {
    if (document.getElementById('tuVoile')) return;
    const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    let i = Math.max(0, BK.TUTO.findIndex(x => x.o === depart));
    const v = document.createElement('div'); v.className = 'voile'; v.id = 'tuVoile';
    const dessiner = () => { const t = BK.TUTO[i];
      v.innerHTML = `<div class="stopbox tu-box">
        <span class="screw tl"></span><span class="screw tr"></span><span class="screw bl"></span><span class="screw br"></span>
        <button class="btn xs rt-x" data-tu="x" title="Fermer">✕</button>
        <span class="dymo" style="align-self:center">Tuto</span>
        <div class="tu-cols"><div class="tu-menu">${BK.TUTO.map((x, k) => `<button class="${k === i ? 'on' : ''}" data-tu="${k}">${x.ic} ${esc(x.o)}</button>`).join('')}</div>
          <div class="tu-c"><b>${t.ic} ${esc(t.o)}</b>${t.l.map(x => `<p>• ${esc(x)}</p>`).join('')}
            <div class="tu-nav">${i > 0 ? `<button class="btn sm" data-tu="${i - 1}">◀ ${esc(BK.TUTO[i - 1].o)}</button>` : '<span></span>'}${i < BK.TUTO.length - 1 ? `<button class="btn sm pri" data-tu="${i + 1}">${esc(BK.TUTO[i + 1].o)} ▶</button>` : '<button class="btn sm pri" data-tu="x">Fini ✓</button>'}</div></div></div></div>`;
      v.querySelectorAll('[data-tu]').forEach(b => b.onclick = () => { if (b.dataset.tu === 'x') return v.remove(); i = +b.dataset.tu; dessiner(); }); };
    document.body.appendChild(v); dessiner();
    v.addEventListener('click', e => { if (e.target === v) v.remove(); });
  },
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
