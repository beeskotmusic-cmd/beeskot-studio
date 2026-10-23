// =====================================================================
// QUOI DE NEUF — l'écran qui s'affiche une fois, juste après une mise à jour.
// Pour une nouvelle version : ajouter un bloc EN HAUT de la liste. Une ligne courte par point : « Onglet : ce qui change. »
// =====================================================================
BK.NOUVEAUTES = [
  { v: '0.9.61', titre: '', l: [
    ['🎧', 'L\'onglet Écoute s\'appelle maintenant « Notes et retours ».'],
    ['🎧', 'Notes et retours : A = l\'export le plus récent, B = celui d\'avant (un nouvel export prend la place de A tout seul).'],
    ['🎧', 'Bibliothèque : boutons A / B sur les exports, pour choisir les versions par défaut dans Notes et retours.'],
    ['📝', 'Notes et retours : on note seulement A ; chaque note garde le nom des deux versions comparées.'],
    ['📂', 'Notes : trier dans le morceau, par date ou par membre, avec des dossiers qui se replient.'],
    ['⤢', 'Notes : une poignée pour agrandir les notes, et « Agrandir » pour leur laisser toute la place.'],
    ['📋', 'Notes : « Copier » met toutes les notes avec leurs timecodes dans le presse-papier.'],
    ['▾', 'Partout : clic sur le titre d\'un cadre pour le replier, et tire son bord du bas pour l\'agrandir.'],
    ['🍞', 'Le bouton de Miette en haut : Tout relire, Actualiser ce que les autres ont fait, et qui est en ligne.'],
    ['🎛', 'Ableton Live : des cartes au lieu des onglets, et « Plugins manquants » membre par membre.'],
    ['🔌', 'Plugins manquants : ce qu\'il te manque pour ouvrir les projets des autres, à envoyer dans la To-do.'],
    ['■', 'Bibliothèque : Arrêt, morceau précédent / suivant, et le volume à la molette sur le lecteur.'],
    ['♪', 'Médias : Tout / Images / Vidéos / Musiques, pour voir aussi les sons et les vidéos.'],
    ['🖨', 'Tournages : le PDF d\'un tournage entier, avec tous ses reels.'],
    ['📸', 'Social Photo : le téléphone a la bonne taille dès l\'ouverture, et une photo d\'exemple au lieu du texte.'],
    ['🍞', 'Miette AI : l\'onglet s\'ouvre sur Miette.'],
    ['🏠', 'Accueil : plus de photo du jour, plus de place pour le reste.'],
    ['🎵', 'Bibliothèque : « Notes du mix » devient un lien vers Notes et retours.'],
    ['✓', 'Le bouton ✓ d\'enregistrement aussi dans Lumières et Miette AI.'] ] },
  { v: '0.9.60', titre: '', l: [
    ['🎬', 'Reels : la fiche d\'un reel devient un formulaire simple (morceau, extrait, lieu, cadrage, équipement, outfit, notes).'],
    ['🎵', 'Reels : l\'extrait se tape en début / fin, il est gardé et revient dans le menu « Passage ».'],
    ['🚀', 'Reels : la sortie prévue peut être une date ou une période (« début novembre »).'],
    ['📋', 'Reels : « Envoyer dans Tournages » le range avec toutes ses infos, prêt à glisser dans la bonne journée.'],
    ['🖼', 'Médias : un titre trop long ne déborde plus en haut de la fenêtre.'] ] },
  { v: '0.9.59', titre: '', l: [
    ['🎬', 'Tournages : un tournage = une journée ; dedans, les reels qu\'on y tourne, qui se déplient (infos, moodboard, découpage, tenues).'],
    ['👕', 'Tournages : glisse une photo sur la tenue de Pierre ou de Yacine : elle est étiquetée toute seule (tenue, membre, morceau).'],
    ['👕', 'Tenues et matériel du tournage = pour tous ses reels ; dans un reel = rien que pour lui.'],
    ['📋', 'Le PLAN.xlsx crée le tournage et un reel par ligne.'],
    ['♪', 'Bibliothèque : la barre du haut se remplit à moitié pour une étape en cours, et le bout brille.'],
    ['⟳', 'Social Photo : une molette pour pencher la photo, et des quarts de tour.'],
    ['📱', 'Social Photo : en Story et en Portrait, le téléphone tient en entier dans la fenêtre.'],
    ['🏷', 'Médias : les étiquettes s\'affichent tout de suite (le Drive enregistre derrière, même s\'il est coupé un moment).'],
    ['✋', 'Médias : glisse un média sur un onglet du menu (Social Photo, Reels Vidéo, Tournages, Écoute, Reels, Bibliothèque), il s\'ouvre : lâche-la là où elle va.'],
    ['＋', 'Médias : « + Créer un dossier », et les questions s\'ouvrent dans le logiciel (plus de fenêtre Windows bizarre).'],
    ['📁', 'Médias : « Ajouter un dossier du Drive » montre un dossier qui existe déjà (Musiques, Exports…), pour tout le groupe.'],
    ['♪', 'Médias : les sons aussi (Drive et Discord), avec un bouton pour les écouter.'],
    ['✋', 'On peut aussi glisser un média dans Écoute, Reels Audio, Reels (affiche) et la Bibliothèque (photo ou export).'],
  ] },
  { v: '0.9.58', titre: '', l: [
    ['⟳', 'Social Photo : bouton « Tourner » (quart de tour).'],
    ['⚡', 'Miette répond plus vite : si Gemini est saturé, elle passe tout de suite par un autre modèle.'],
    ['🍞', 'Quand Miette réfléchit, un petit cercle tourne autour de son patch (en haut et sur ses boutons).'],
    ['🎬', 'Reels Audio : les passages déjà trouvés restent, une nouvelle recherche ne les efface plus.'],
    ['🎧', 'Écoute : un seul mix → la case B se grise et la forme du son prend toute la hauteur.'],
    ['📅', 'Calendrier : « Je ne suis pas là », et « Autres disponibilités ▸ » pour marquer Pierre, Baptiste ou tout le monde.'],
    ['🍞', 'Calendrier : Miette repère les absences dites sur Discord (pointillés) ; un clic droit pour valider.'],
    ['✓', 'Bibliothèque : petit ✓ dans Paroles, Infos et Notes (orange = pas encore enregistré, vert = enregistré).'],
    ['🏠', 'Accueil : à droite, une photo du jour (affiche ou presse) façon Polaroid et une phrase qui motive selon l\'avancement des releases.'],
    ['🏠', 'Accueil : la liste À faire se déroule jusqu\'en bas.'],
    ['🎬', 'Reels : les cartes sont en noir et blanc sur papier d\'affiche, en couleur au survol (la vidéo du reel se lance si elle existe).'],
    ['📜', 'Social Photo et Reels Vidéo : nouvel effet « Papier poster ».'],
    ['🍞', 'Miette AI : une aide pour parler à Miette sur Discord (réaction 🍞 : tape « bread » ; 🥖 « baguette » marche aussi).'],
    ['🍞', 'Tout ce que Miette ajoute est en vert transparent : vérifie, puis ✓ pour valider (To-do, Budget, Bibliothèque, Calendrier, Tournages).'],
    ['🍞', 'To-do list : « Dis-le à Miette » sous Ajouter, elle comprend qui fait quoi et pour quand.'],
    ['🍞', 'Budget : bouton « Chercher les dépenses », Miette relit Discord et propose les paiements.'],
    ['✦', 'Médias : nouvelle étiquette « Références / inspiration ».'],
    ['◉', 'Médias : étiquettes Yacine, Pierre et Baptiste (rubrique Membres).'],
    ['🍞', 'Reels : bouton « Chercher les reels », Miette crée une carte (en vert) pour chaque reel dont vous avez parlé sur Discord.'],
    ['🎬', 'Tournages : des journées de tournage (« Tournage · date ») ; glisse un tournage dedans, la journée va dans le Calendrier.'],
    ['🎬', 'Tournages : bouton « → Reels » pour créer la carte du reel avec les infos du tournage.'],
    ['🎬', 'Tournages : « ＋ Ajouter un média » à droite ; glisse l\'image sur un tournage (moodboard) ou sur une journée.'],
    ['🎬', 'Tournages : chaque journée a ses Assets, rangés en petits dossiers (Tenues, Moodboard, Audio…) ; ce que Médias connaît déjà arrive en vert.'],
    ['🎬', 'Tournages et Reels reliés : bouton « Tournage fini » (le reel passe à Tourné), et le titre, le morceau et l\'idée se suivent.'],
    ['♪', 'Bibliothèque : clic droit sur une étape d\'Avancement → « Mettre en cours » (la moitié de l\'étape).'],
    ['▶', 'Écoute, Reels Audio et Reels Vidéo : la lecture coupe la Bibliothèque et s\'affiche dans le lecteur du bas.'],
    ['🍞', 'Médias : « Étiqueter les photos » ne regarde que là où tu es (ce dossier, ou Discord).'],
    ['＋', 'Réglages › Drive : créer vos propres étiquettes pour Médias.'],
    ['▸', 'Menu : catégorie « Show » avec Lumières, et Répète et Concert (incoming).'],
  ] },
  { v: '0.9.57', titre: '', l: [
    ['⌂', 'Médias : bouton Maison, les étiquettes du bas filtrent le dossier ouvert.'],
    ['🔍', 'Médias : « Voir tout ▾ » montre une étiquette dans tout Médias.'],
    ['📅', 'Calendrier : dispo en vert, pas dispo en rouge, contour à la couleur de chacun.'],
    ['📅', 'Calendrier : enlever une dispo, et un événement sur toute une période.'],
    ['🎧', 'Écoute : un seul mix possible (B = Aucun).'],
    ['🇬🇧', 'Écoute : Miette traduit les notes en anglais pour l\'ingé son (le français reste).'],
    ['📚', 'Bibliothèque : fiche rangée en Fichiers, Orga, Retours (les notes du mix par version).'],
    ['🍞', 'Bibliothèque : bouton « Faire le point Discord » dans Notes du groupe.'],
    ['🎵', 'Reels Vidéo : la musique peut venir d\'un morceau de la Bibliothèque.'],
    ['🔧', 'Calendrier : « Planning de promo seulement » refiltre bien.'],
    ['☁', 'Bibliothèque : le Drive d\'abord ; « Scanner ce PC » passe dans les dossiers de ce PC.'],
    ['🔌', 'Ableton Live : les plugins manquants du projet, PC par PC, et « Envoyer dans les tâches ».'],
    ['📱', 'Réglages : le QR code de BEESKOT Studio Mobile (l\'appli arrive avec la V1).'],
  ] },
  { v: '0.9.56', titre: '', l: [
    ['🎧', 'Nouvel onglet Écoute : mix A/B, notes minutées pour tout le groupe.'],
    ['🔍', 'Social Photo et Reels Vidéo : zoom possible sous 0 %.'],
    ['📷', 'Reels Photo s\'appelle maintenant Social Photo, sous Ableton Live.'],
    ['🎞', 'Social Photo : 10 effets en plus (fuites de lumière, Polaroid, Super 8…) et leur intensité.'],
    ['⇅', 'Menu : Ableton Live en premier dans Assistant tools.'],
    ['🖼', 'Social Photo : cadres d\'époque (Polaroid, pellicule, diapo…) à la taille voulue.'],
    ['✨', 'Social Photo : menu Preset (couleur, effet, réglages et cadre d\'un coup), zoom avec les réglages.'],
    ['🍞', 'Miette a un nouveau patch brodé, aussi en photo sur Discord.'],
    ['🍞', 'Miette passe au vert olive : foncé en Rapide, clair en Intelligent.'],
    ['⏺', 'Bouton du haut : le losange DARI remplace le « ? ».'],
    ['‹', 'Menu de gauche repliable (languette au bord) : plus de place pour la page.'],
    ['📅', 'Calendrier : les dispos de chacun (clic droit, Maj pour une période).'],
    ['🍞', 'Discord : « Miette ? … » → elle répond sous le message.'],
    ['🍞', 'Discord : réaction 🍞 ou « Miette, … » → rangé dans le logiciel, ✅ sur Discord.'],
    ['🎤', 'Reels Audio : les paroles exactes du passage.'],
    ['💾', 'Ableton : sauvegarde automatique des projets dans le Drive.'],
    ['🧹', 'Médias : Miette fait le ménage (doublons, fichiers vides).'],
    ['🎬', 'Reels : Moodboard puis Médias, avec « ＋ Insérer » (fenêtre Médias).'],
    ['💡', 'Miette AI : idées de questions selon vos morceaux, tâches, tournages.'],
    ['🧠', 'Miette AI : Rapide, Normal ou Intelligent, à côté de « Demander ».'],
    ['🎉', 'Sorties : chaque PC fête un morceau qui sort.'],
    ['🔎', 'Médias : « Tout » enlève le filtre, les étiquettes s\'ouvrent en dessous.'],
    ['🏠', 'Accueil : « La semaine dernière, résumée par Miette ».'],
    ['🖱', 'Boutons grisés : plus de souris qui tourne, et on dit pourquoi.'],
  ] },
  { v: '0.9.55', titre: '', l: [
    ['🏷', 'Médias : une seule sorte d\'étiquettes (en couleur sur l\'image).'],
    ['🔎', 'Fenêtre Médias : « Filtrer », les choix juste en dessous.'],
    ['＋', 'Reels Vidéo : un seul bouton « Importer » (photos et vidéos).'],
    ['🎚', 'Reels Photo et Vidéo : contraste, lumière, saturation.'],
    ['🔧', 'Fenêtre Médias : réparée quand on l\'ouvre plusieurs fois.'],
    ['🛡', 'Drive : un nouveau PC ne peut plus écraser le travail du groupe.'],
  ] },
  { v: '0.9.54', titre: '', l: [
    ['🎛', 'Outils Reels et Ableton : seuls les exports sont partagés en direct.'],
    ['🖼', 'Reels Photo et Vidéo : on importe depuis une fenêtre Médias (étiquettes en haut).'],
    ['▾', 'Reels Photo et Vidéo : « De quoi parle… » en menu déroulant.'],
    ['🖼', 'Tournages, posters, photos des morceaux : choisis aussi dans Médias.'],
    ['🍞', 'Partout : la biscotte jaune montre où Miette peut aider.'],
    ['🍞', 'Tournages : Miette trouve les moodboards et les références (bouton biscotte « Trouver »).'],
    ['↰', 'Médias : bouton Retour plus visible.'],
    ['🔌', 'AI Miette coupée : toutes ses aides disparaissent.'],
    ['📋', 'Améliorer : les mots exacts sont gardés, bouton pour les copier.'],
  ] },
  { v: '0.9.53', titre: '', l: [
    ['🔍', 'Bouton rouge (?) : vérifier les mises à jour.'],
    ['📖', 'Tuto : pas à pas, questions fréquentes, recherche.'],
    ['🍞', 'Miette : répond aux questions sur le logiciel.'],
  ] },
  { v: '0.9.52', titre: '', l: [
    ['⚡', 'Démarrage : le logiciel s\'ouvre plus vite.'],
    ['🟢', 'Bandeau : ONLINE se met à jour quand on ouvre ou ferme le logiciel.'],
    ['☁', 'Photos : lues depuis le Drive, plus recopiées dans les fiches.'],
    ['🪶', 'Réglages : « Alléger les fiches » range les vieilles photos dans le Drive.'],
    ['🏷', 'Médias : barre des étiquettes fine, repliable avec ▾.'],
    ['📂', 'Médias : s\'ouvre toujours sur « Tous les dossiers ».'],
    ['🗂', 'Réglages : rangés en onglets.'],
    ['🎞', 'Reels Vidéo : photos et vidéos mélangées, une durée par fichier.'],
    ['✨', 'Reels Vidéo : animations, transitions et effets vintage.'],
    ['🎨', 'Reels Vidéo : cadrage et couleur comme dans Reels Photo.'],
    ['📼', 'Reels Photo : effets vintage (grain, poussière, VHS…).'],
    ['🟢', 'Bandeau : le nom du PC (Yacine, Studio…) au lieu de « Ce PC ».'],
    ['📅', 'Calendrier : les dates de Miette ne s\'effacent plus, et on voit ce qu\'elle a lu.'],
    ['🍞', 'Accueil : résumé de la semaine avec les mails et où on en est.'],
  ] },
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
// LE TUTO — tout le logiciel, onglet par onglet : à quoi ça sert, comment faire (pas à pas), bon à savoir.
// + une FAQ. Miette le lit aussi pour répondre aux questions sur le logiciel.
// À METTRE À JOUR à chaque push si une fonction apparaît, change ou disparaît.
//   o : nom de l'onglet · quoi : à quoi il sert · comment : [question, réponse pas à pas] · astuces : petites phrases
// =====================================================================
BK.TUTO = [
  { o: 'Pour commencer', ic: '👋', quoi: 'BEESKOT Studio rassemble tout le travail du groupe : morceaux, photos, reels, tournages, rendez-vous, tâches, budget. Tout est rangé dans le Google Drive BEESKOT, donc chaque membre voit la même chose sur son PC.',
    comment: [
      ['Relier un nouveau PC', 'Demande à Dari la « carte d\'accès » (un petit fichier, envoyé en message privé) → Réglages › Drive › Importer une carte d\'accès → choisis le fichier. C\'est fini : le Drive et Miette sont reliés.'],
      ['Dire qui utilise ce PC', 'Clique la case « PC : » en haut à droite (ou Réglages › Ce PC) → choisis Yacine, Pierre, Baptiste ou Studio. C\'est ce nom qui apparaît dans ONLINE et sur ce que tu fais.'],
      ['Mettre à jour le logiciel', 'Quand une version sort, une fenêtre s\'ouvre toute seule : « Installer maintenant ». Pour vérifier toi-même : bouton rouge (?) en haut → 🔍 Vérifier les mises à jour.'],
      ['Annuler une erreur', 'Ctrl + Z annule la dernière action. Pour revenir plus loin en arrière (des heures, des jours) : Réglages › Drive › ⏪ Time Machine.'] ],
    astuces: [
      'Un bouton vert olive avec le petit patch de Miette (ex. « Trouver », « Qui porte quoi ? »), partout dans le logiciel = Miette peut t\'aider ici. Son vert dit comment elle réfléchit : foncé = rapide, olive = normal, clair = intelligent.',
      'Interrupteur « AI Miette » en bas du menu : coupé, toutes les aides de Miette disparaissent (ce que vous avez déjà validé reste).',
      'Bouton rouge au losange DARI : version, mises à jour, nouveautés, relancer, fermer.',
      'ONLINE (en haut) : qui est connecté. EN CE MOMENT (en bas de chaque page) : ce que font les autres.',
      'Ce que tu fais arrive sur les autres PC en moins d\'une minute. Pour aller plus vite : clic sur le patch de Miette en haut → 🔄 Actualiser.',
      'Clic sur le patch de Miette en haut : 📖 Tout relire, 🔄 Actualiser, et qui est en ligne ou hors ligne (depuis quand).',
      'Chaque cadre avec un titre se replie d\'un clic sur ce titre (▾ / ▸). Tire son bord du bas pour l\'agrandir ; double-clic sur ce bord = taille normale. C\'est gardé sur ton PC.',
      'Chaque titre du menu de gauche (Audiovisuel, Organisation…) se replie d\'un clic.',
      'La petite languette ‹ au bord du menu le replie : il ne reste que les traits de couleur, la page prend plus de place. La languette devient jaune : clique dessus pour redéplier. Passe la souris sur un trait pour voir le nom de l\'onglet.' ] },
  { o: 'Accueil', ic: '🏠', quoi: 'Le résumé du moment : ce qui s\'est passé cette semaine (Discord et mails), le prochain rendez-vous, la prochaine sortie et ce qu\'il reste à faire.',
    comment: [
      ['Mettre le résumé de la semaine à jour', 'Clique ↻ dans la case « Cette semaine », ou la biscotte jaune. Miette relit les messages et les mails des 7 derniers jours.'],
      ['Cocher une tâche faite', 'Dans « À faire », coche la case : elle passe dans « Déjà fait » de la To-do list.'],
      ['Garder la place pour l\'essentiel', 'Clic sur le titre d\'un cadre pour le replier.'] ],
    astuces: [
      '« La semaine dernière, résumée par Miette » : ce qu\'on s\'est dit, où on en est, ce qui ressort à faire.',
      'Prochaine release : les 2 prochains morceaux qui sortent, avec leur avancement.' ] },
  { o: 'Miette AI', ic: '🍞', quoi: 'Miette est l\'assistante du groupe. Elle lit Discord (et les mails recopiés par le bot), répond aux questions et propose des tâches, des dates et des dépenses.',
    comment: [
      ['Ce qui est en vert', 'Tout ce que Miette ajoute toute seule (tâches, dépenses, BPM, notes, rendez-vous, références) est en vert transparent : elle prépare, vous validez avec ✓.'],
      ['Pointer un message à Miette sur Discord', 'Réaction « pain » 🍞 sous le message : « Ajouter une réaction » → tape bread (Discord cherche en anglais). La baguette 🥖 (baguette) marche aussi. Ou commence ton message par « Miette, … ». Elle met ✅ quand c\'est rangé.'],
      ['Choisir si Miette va vite ou réfléchit', 'À côté de « Demander » : ⚡ Rapide (quelques secondes), Normal (conseillé) ou 🧠 Intelligent (plus fin, plus lent). C\'est le même réglage pour tout le groupe.'],
      ['Trouver une bonne question', '💡 Idées de questions ▾ : un menu qui se déroule (Le groupe, Les morceaux, Les tâches, Les tournages, Les rendez-vous). Les questions changent avec ce que vous avez : « Mother · reste avant la sortie ? », « Appeler la salle · Pierre »… Un clic la met dans la case, tu peux la modifier, puis Demander.'],
      ['Poser une question', 'Écris ta question (« quand est le tournage de Mother ? », « comment on exporte un reel ? ») → Demander. Miette répond avec les messages Discord et ce qu\'elle sait du logiciel.'],
      ['Valider ce que Miette a repéré', 'Dans « À valider » : ✓ pour accepter (ça va dans la To-do, le Calendrier ou le Budget), ✕ pour refuser.'],
      ['Signaler un problème ou une idée', 'Choisis « 🔧 Améliorer BEESKOT Studio » → écris ou 🎤 dicte ce qui ne va pas → Ranger en note. Tes mots exacts sont gardés dans le Drive tout de suite (même sans AI). Dari récupère tout avec 📋 Copier les mots exacts.'],
      ['Envoyer une info de Discord dans le logiciel', 'Sur Discord, mets la réaction 🍞 sous un message (même celui de quelqu\'un d\'autre, ou un mail recopié), ou écris un message qui commence par « Miette, … » (ex. « Miette, tournage de Mother le 12 novembre au studio »). Dès qu\'un PC a BEESKOT Studio ouvert, Miette range l\'info au bon endroit (Calendrier, To-do, fiche du morceau, Références, Budget) et met ✅ sous le message. ❓ = elle n\'a rien trouvé à ranger.'],
      ['Choisir les salons Discord à lire', 'Réglages › Miette & Discord → coche les salons (pense au salon des mails).'] ],
    astuces: [
      '« 👁 Ce que Miette a lu » : la liste des salons et des mails qu\'elle a vraiment lus.',
      'Miette ne crée jamais rien toute seule : elle propose, vous acceptez.',
      'Il faut la clé Gemini (gratuite) et l\'interrupteur « AI Miette activée » allumé en bas du menu.' ] },
  { o: 'Bibliothèque', ic: '🎵', quoi: 'Une fiche par morceau : ses exports audio, ses projets Ableton, ses paroles, sa photo, son tempo et son avancement (maquette → sortie).',
    comment: [
      ['Projets perso dans À ranger', '« ✕ Pas BEESKOT » les retire de la liste sur ce PC (le fichier n\'est pas touché). « ↺ Les remettre » en bas pour annuler.'],
      ['Une étape en cours', 'Avancement : clic droit sur une étape → « Mettre en cours » (la barre avance de la moitié de l\'étape) ou « Retirer en cours ».'],
      ['S\'y retrouver dans une fiche', 'Avancement tout en haut. Puis 3 ensembles : FICHIERS (Exports, Projets Ableton), ORGA (Paroles, Infos, Étiquettes, Notes du groupe), RETOURS (Notes du mix : un lien qui ouvre ce morceau dans Notes et retours).'],
      ['Faire le point Discord sur un morceau', 'Orga › Notes du groupe → bouton biscotte « Faire le point Discord » : Miette relit tout ce que le groupe a dit sur ce morceau et résume où il en est.'],
      ['Créer une fiche', '« + Créer la fiche » à droite. Les fichiers du Drive se relient tout seuls (↻ Relire le Drive en bas pour les voir tout de suite) ; « À ranger » propose ce qui n\'est pas encore relié. Les dossiers de ce PC (Scanner ce PC) ne servent que pour ce qui n\'est pas encore dans le Drive.'],
      ['Choisir le bon export d\'un morceau', 'Ouvre la fiche → clique ☆ à côté de l\'export : il devient ★. C\'est lui qu\'utilisent Reels Audio et les autres onglets.'],
      ['Changer l\'avancement', 'Ouvre la fiche → clique l\'étape (maquette, enregistrement, mixage, master, sortie, promo).'],
      ['Changer la photo', 'Clique la photo de la fiche → la fenêtre Médias s\'ouvre sur les photos du morceau → double-clic sur la photo. Elle reste dans le Drive : la fiche garde juste son adresse.'],
      ['Mettre le bon BPM', 'Écris-le dans la fiche : ce que vous écrivez passe avant tout. Sinon : 🎛 Ableton (le tempo du projet), ou le bouton biscotte « Vérifier les infos des morceaux » (ce qui a été dit sur Discord).'],
      ['Être sûr que c\'est enregistré', 'Dans Paroles, Infos et Notes du groupe : le petit ✓ devient orange dès que tu écris (clique dessus pour enregistrer), et vert une fois que c\'est sauvé. Ça s\'enregistre aussi tout seul quand tu cliques ailleurs.'],
      ['Copier les paroles pour le distributeur', 'Ouvre la fiche → Paroles → Copier pour le distributeur.'],
      ['Écouter les morceaux', '▶ dans la fiche : l\'export ★. ■ = Arrêt (on revient au début). ⏮ / ⏭ = le morceau d\'avant / d\'après dans la liste (⏮ revient d\'abord au début s\'il joue depuis plus de 3 s). Les mêmes boutons sont dans le lecteur en bas. Molette sur le lecteur = volume.'] ],
    astuces: [
      'Next release, Work in progress, Sortis : glisse une fiche pour changer son statut ou son ordre. Quand un morceau passe en Sorti, tous les PC le fêtent 🎉.',
      'Orga › Étiquettes : tout ce qui concerne le morceau (audio, projets, photos), rangé par type.',
      'Une couleur par étape : maquette rouge, enregistrement orange, mixage jaune, master bleu-vert, sortie bleu, promo vert.' ] },
  { o: 'Médias', ic: '🖼', quoi: 'Toutes les photos, vidéos et musiques du groupe : les dossiers du Drive, plus celles postées sur Discord. Partout dans le logiciel, on importe une photo ou une vidéo depuis une fenêtre Médias. On les range avec des étiquettes (un morceau, un tournage, Instagram…), sans jamais déplacer les fichiers.',
    comment: [
      ['Voir seulement les musiques (ou les vidéos)', 'En haut : Tout / Images / Vidéos / Musiques. Dans un dossier, ça trie ce dossier ; tout en haut (« Tous les dossiers »), ça cherche dans tout Médias (Musiques : aussi les sons postés sur Discord). ▶ sur un son pour l\'écouter.'],
      ['Envoyer un média vers un autre outil', 'Attrape la photo (ou plusieurs), garde-la une demi-seconde sur l\'onglet voulu dans le menu (Social Photo, Reels Vidéo, Tournages) : il s\'ouvre. Lâche-la là où elle va. Les onglets grisés ne prennent pas de média.'],
      ['Créer une étiquette', 'Réglages › Drive › « Étiquettes des Médias » : écris le nom, choisis la rubrique, « + Créer l\'étiquette ». Elle apparaît pour tout le groupe.'],
      ['Étiqueter des photos', 'Choisis les photos (clic, Ctrl+clic pour en ajouter, Maj+clic pour une suite) → clic droit → Morceaux ▸ / Tournage ▸ / Réseaux ▸ → l\'étiquette. Ou glisse-les sur une étiquette dans la barre du bas.'],
      ['Filtrer le dossier ouvert', 'Barre du bas « Filtrer » : clic sur Morceaux = tout ce qui a une étiquette de morceau dans ce dossier ; clic sur Moon Blue = seulement Moon Blue. Pareil pour Tournage (tenues, moodboard…), Lumière (light show, scénographie, live), Réseaux. Re-clic sur ce qui est allumé = on enlève le filtre. Tout en haut (« Tous les dossiers »), le filtre cherche dans tout Médias.'],
      ['Retrouver les photos d\'un morceau partout', '« Voir tout ▾ » en haut → Morceaux ▸ Moon Blue : tout ce qui est étiqueté Moon Blue dans TOUT Médias, quel que soit le dossier. « — Rien » pour revenir au dossier.'],
      ['Ajouter des photos de ce PC', 'Ouvre le dossier du Drive voulu → glisse les fichiers sur la page, ou « + Choisir des fichiers ». Ils partent dans ce dossier du Drive.'],
      ['Faire le ménage du Drive', 'Bouton biscotte « Faire le ménage » (à droite) : Miette cherche les fichiers en double (même nom, même taille) et les fichiers vides. Tu coches ce qui part : ça va dans la corbeille de BEESKOT Studio, rien n\'est effacé.'],
      ['Laisser Miette étiqueter', 'Bouton biscotte « Étiqueter les photos » (à droite) : elle regarde les photos sans étiquette et propose où les ranger.'] ],
    astuces: [
      'Médias s\'ouvre toujours sur « Tous les dossiers ». ⌂ = tout en haut d\'un coup, ↰ Retour = le dossier d\'avant.',
      'Avec des photos choisies, un clic sur une étiquette du bas les étiquette (au lieu de filtrer). Glisser des photos sur une étiquette marche toujours.',
      'Discord (pas sur le Drive) : chargé une fois, puis ↻ Actualiser Discord pour les nouvelles images.',
      '− + : taille des vignettes. 🙈 : voir les fichiers masqués. ▾ : replier la barre des étiquettes.' ] },
  { o: 'Reels', ic: '🎬', quoi: 'Le suivi de chaque reel : un poster par reel, et une fiche simple (morceau, extrait, lieu, cadrage, équipement, outfit, notes, sortie) qu\'on envoie dans Tournages.',
    comment: [
      ['Retrouver les reels dont on a parlé', 'Bouton « Chercher les reels » : Miette relit Discord et crée une carte verte par reel. ✓ sur la carte pour la valider.'],
      ['Voir un reel en couleur', 'Les cartes sont en noir et blanc : passe la souris dessus pour la couleur. Si le reel a une vidéo étiquetée, elle se lance (sans le son).'],
      ['Créer un reel', 'À droite, « Nouveau reel » : choisis le morceau → + Créer le reel. Un poster apparaît.'],
      ['Remplir un reel', 'Clique le poster : la fiche s\'ouvre dessous. Choisis le morceau (ou « Autre… »), puis remplis lieu, cadrage, équipement, outfit et notes. Tout s\'enregistre seul.'],
      ['Choisir l\'extrait audio', 'Tape le Début et la Fin (ex. 0:08.0 et 0:30.0) puis Entrée : l\'extrait est gardé pour ce morceau et revient dans le menu « Passage ». ▶ pour l\'écouter, « → Reels Audio » pour en faire l\'export.'],
      ['Envoyer dans Tournages', 'Bouton « Envoyer dans Tournages » : le reel arrive dans Tournages (Reels sans tournage) avec toutes ses infos. Glisse-le ensuite dans la bonne journée. Ce que tu changes ensuite dans la fiche suit dans Tournages.'],
      ['Changer l\'image du poster', '🖼 sur le poster → la fenêtre Médias s\'ouvre sur le morceau → choisis l\'image. ↺ revient à l\'image automatique.'],
      ['Prévoir la sortie', 'Sortie prévue : tape une période (« début novembre ») ou clique 📅 pour une date. Une date va toute seule dans le Calendrier.'] ],
    astuces: [ 'Chaque étape cochée (Idée, Audio, Tourné, Monté, Publié) va dans la To-do de la personne.' ] },
  { o: 'Calendrier', ic: '📅', quoi: 'Les rendez-vous du groupe (tournages, shootings, enregistrements, sorties…), les tâches avec une date, et les dates que Miette a repérées sur Discord et dans les mails.',
    comment: [
      ['Ajouter un rendez-vous', 'Clique le jour → remplis type, titre, heure, lieu → + Ajouter. « Ajouter à Google Agenda ↗ » le met aussi dans Google.'],
      ['Ajouter un événement sur plusieurs jours', 'Clic sur le 1er jour, Maj + clic sur le dernier → clic droit → ＋ Ajouter un événement sur cette période → remplis à droite → + Ajouter. Il s\'étale sur tous les jours (↔). Tu peux aussi remplir « Jusqu\'au » à la main.'],
      ['Garder une date repérée par Miette', 'Dans « Repéré par Miette » : ✎ remplit le formulaire → vérifie → + Ajouter. ✕ l\'ignore pour de bon.'],
      ['Dire quand je suis dispo', 'Clic sur un jour (Maj + clic sur un autre jour = toute la période) → clic droit → Je suis dispo, ou Pas dispo. L\'initiale de chacun s\'affiche sur le jour : pastille verte = dispo, rouge = pas dispo, et le contour a la couleur de la personne (voir la légende sous le calendrier). Le jour devient vert quand tout le monde est dispo.'],
      ['Marquer quelqu\'un d\'autre', 'Clic droit sur les jours → « Autres disponibilités ▸ » → Dispo ou Pas dispo → Pierre, Baptiste ou Tout le monde.'],
      ['Les absences repérées par Miette', 'Quand quelqu\'un dit sur Discord qu\'il n\'est pas là, Miette met une pastille en pointillés sur ces jours. Clic droit → « ✓ Valider » pour la confirmer.'],
      ['Enlever une dispo', 'Choisis le ou les jours → clic droit → « Enlever ma dispo » (ou celle de quelqu\'un d\'autre, si besoin).'],
      ['Comprendre pourquoi une date manque', 'Regarde la ligne « 🍞 Dernière lecture » : combien de messages et de mails Miette a lus, combien de dates elle a trouvées. 0 mail = le salon des mails n\'est pas coché dans Réglages.'] ],
    astuces: [ 'Pointillés = date possible (pas encore décidée). Trait plein = décidé.', 'Bouton biscotte « Trouver les dates » (en haut) : relit Discord et les mails tout de suite, sans attendre la biscotte.' ] },
  { o: 'To-do list', ic: '✅', quoi: 'Qui fait quoi : un panier par membre, plus « BEESKOT » (tout le groupe) et « Déjà fait ».',
    comment: [
      ['Demander à Miette', 'Écris dans « Dis-le à Miette » (ex. « Pierre réserve le studio avant vendredi ») puis « Miette l\'ajoute ». Ses tâches sont en vert : ✓ pour valider.'],
      ['Ajouter une tâche', 'Écris-la en haut (morceau et date si besoin) → + Ajouter ou Entrée. Elle arrive dans « Tâches en vrac ». Avec une date, elle apparaît aussi dans le Calendrier.'],
      ['Donner une tâche à quelqu\'un', 'Attrape la tâche et lâche-la dans son panier.'],
      ['Marquer comme fait', 'Glisse-la dans « Déjà fait », ou coche-la dans l\'Accueil.'] ],
    astuces: [ 'Miette propose : les tâches repérées sur Discord et dans les mails, à accepter ou non.' ] },
  { o: 'Budget', ic: '💰', quoi: 'Les dépenses du groupe, qui a payé, et les remboursements entre vous.',
    comment: [
      ['Trouver les dépenses avec Miette', 'Bouton « Chercher les dépenses » à côté du mois : Miette relit Discord des 2 derniers mois et propose les paiements en vert. ✓ pour les ajouter.'],
      ['Noter une dépense', 'Titre, montant, qui a payé, pour qui → + Ajouter la dépense.'],
      ['Dire que j\'ai remboursé ma part', 'Sur la dépense : ↩ Ma part. (Ça utilise le nom de ce PC : règle-le en haut à droite.)'],
      ['Ajouter un abonnement', '↻ Chaque mois ou ↻ Chaque année : il revient tout seul. « Arrêter » pour le stopper.'],
      ['Voir qui doit rembourser qui', 'Encadré « Remboursements » : qui fait un virement à qui. ✓ Virement fait quand c\'est payé.'] ],
    astuces: [ 'Les petites sommes (moins de 0,50 $) sont ignorées.' ] },
  { o: 'Notes et retours', ic: '🎧', quoi: 'Comparer deux versions d\'un mix (A en bleu, B en rouge) au même endroit, et laisser des notes minutées sur A, que tout le groupe voit.',
    comment: [
      ['Écouter un seul mix', 'Choisis le morceau et la version A, et mets B sur « — Aucun ». Tu écoutes et tu laisses tes notes, sans comparaison.'],
      ['Comparer deux mix', 'Choisis le morceau, puis la version A et la version B → ▶ → Tab (ou les boutons A / B) pour passer de l\'une à l\'autre au même endroit. Par défaut : A = l\'export le plus récent, B = celui d\'avant. Un nouvel export devient A tout seul, l\'ancien passe en B.'],
      ['Choisir les versions par défaut', 'Bibliothèque › fiche du morceau › Exports : boutons A et B sur la ligne d\'un export. Re-clic = automatique.'],
      ['Les deux versions ne commencent pas pareil', '« Caler tout seul » cherche le décalage. Sinon, glisse la souris sur la case « Recaler B » (en secondes).'],
      ['Laisser une note', 'Clique sur la forme du son à l\'endroit voulu (ou cliquer-glisser pour un passage) → écris ta note → Entrée. La note va toujours sur A (même si tu écoutes B), et elle garde le nom de A et de B.'],
      ['Trier les notes', '« Dans le morceau » : dans l\'ordre des timecodes. « Par date » : un dossier par jour, les plus anciennes en haut. « Par membre » : un dossier par personne. Clique un dossier pour le replier : ses notes disparaissent aussi sous la forme du son.'],
      ['Voir les notes en grand', 'Tire la poignée entre le lecteur et les notes (double-clic = taille normale). « ⤢ Agrandir » : les notes prennent toute la place, ▶ et A / B restent en haut. « ⤡ Réduire » pour revenir.'],
      ['Répondre ou dire que c\'est réglé', '💬 pour répondre sous une note, ○ / ✓ réglé quand c\'est fait.'],
      ['Traduire pour un ingé son anglais', 'Bouton biscotte « Traduire en anglais » : Miette traduit les notes (et les réponses) en langage de studio. Le français reste, l\'anglais s\'affiche dessous.'],
      ['Copier les notes', '📋 Copier : toutes les notes affichées, avec leurs timecodes, dans l\'ordre du tri choisi, vont dans le presse-papier (✓ devant celles qui sont réglées). Colle-les dans un mail, sur Discord ou sur Fiverr. Si tout est traduit, c\'est l\'anglais qui est copié.'],
      ['Garder la meilleure version', '★ à côté de A ou B : elle devient l\'export principal du morceau (Bibliothèque, Reels…).'] ],
    astuces: [ 'Espace = lecture / pause. Un clic sur le timecode d\'une note = l\'écouter à cet endroit.', 'Toutes les notes se retrouvent aussi dans la Bibliothèque : fiche du morceau › Retours › Notes du mix, rangées par version.', 'Couleurs : Yacine jaune, Pierre vert, Baptiste violet (le nom vient de la case « PC : » en haut).' ] },
  { o: 'Tournages', ic: '🎥', quoi: 'Une fiche par tournage ou shooting : l\'idée, le moodboard, des références, le découpage plan par plan, les tenues, le matériel. On l\'imprime en PDF pour l\'équipe.',
    comment: [
      ['Un tournage, ses reels', 'Un tournage = une journée (date, heure, lieu : il va dans le Calendrier). Clique son affiche : tu vois ses reels. Chaque reel se déplie (infos, moodboard, découpage, tenues, matériel). Glisse un reel sur l\'affiche d\'un tournage pour l\'y mettre.'],
      ['Les tenues', 'Glisse une photo (« Médias à ranger », Assets, ou une autre tenue) sur la ligne d\'un membre : elle est étiquetée tenue + ce membre + le morceau. Dans le tournage = pour tous les reels ; dans un reel = rien que pour lui. Une même photo peut aller à Pierre ET à Yacine.'],
      ['Ce qui est déjà dans Médias', 'Les photos déjà étiquetées pour ce tournage ou ce reel arrivent en vert à leur place : ✓ pour valider.'],
      ['Envoyer dans les Reels', '« → Reels » sur un reel : la carte est créée dans l\'onglet Reels, déjà reliée. « Tournage fini » : ses reels passent à « Tourné ».'],
      ['Créer un tournage', '+ Nouveau tournage (à droite) → titre, type (Clip, Reel, Shooting), morceau, date, lieu. 📅 Mettre au Calendrier pour la date.'],
      ['Remplir le moodboard', '＋ Ajouter des images → la fenêtre Médias s\'ouvre sur l\'étiquette Moodboard (clique une autre étiquette ou un dossier si besoin) → choisis → Ajouter au moodboard. Elles sont étiquetées « moodboard » et « ce tournage » toutes seules.'],
      ['Ajouter les tenues', '＋ Photo sous le nom de chacun (la fenêtre Médias s\'ouvre sur l\'étiquette Tenues), ou le bouton biscotte « Qui porte quoi ? » pour que Miette trouve les photos de tenues sur Discord.'],
      ['Laisser Miette remplir le moodboard et les références', 'Bouton biscotte « Trouver » du Moodboard : les images du dossier Moodboards du Drive et de Discord qui parlent de ce tournage. Bouton biscotte « Trouver » des Références : les liens Instagram, TikTok, YouTube donnés sur Discord. Tu coches ce que tu gardes.'],
      ['Faire le découpage', '+ Ajouter un plan pour chaque plan (cadrage, ce qu\'on voit, durée), ou le bouton biscotte « Proposer » : Miette propose un découpage.'],
      ['Imprimer la fiche', 'Dans un reel : Imprimer / PDF → « Enregistrer au format PDF » ou ton imprimante.'],
      ['Imprimer tout un tournage', 'Ouvre le tournage (son affiche) → Imprimer / PDF : la journée (date, lieu, tenues, matériel), la liste des reels, puis chaque reel sur sa page.'] ],
    astuces: [ 'Chaque encadré se replie d\'un clic sur son titre.', 'Les images restent dans le Drive : la fiche garde juste leur adresse.' ] },
  { o: 'Ableton Live', ic: '🎛', quoi: 'Prépare un projet Ableton pour l\'envoyer au mixeur (noms des pistes, couleurs, gel, zip daté dans le Drive), et dit à chacun les plugins qui lui manquent. Six cartes en haut : Ableton, Renommer, Trier, Geler, Zip + envoi, Plugins manquants. Clique une carte, elle s\'ouvre dessous.',
    comment: [
      ['Voir les plugins qui me manquent', 'Carte « Plugins manquants » → clique ton nom (Yacine, Pierre, Baptiste, Studio) : la liste des plugins utilisés dans les projets des AUTRES que tu n\'as pas, un par ligne, avec les projets où ils servent. « 📋 Envoyer dans la To-do list » : une tâche « Installer : … » à ton nom. Chaque PC envoie sa liste tout seul, une fois par jour.'],
      ['Le projet ouvert sur ce PC', 'Sous la liste : ce qui manque à chaque PC pour le projet ouvert dans Ableton (comme avant).'],
      ['Relier Ableton (une fois par PC)', 'Réglages › Ableton › Relier Ableton → dans Ableton : Préférences › Link/Tempo/MIDI › Control Surface → choisis « BEESKOT ».'],
      ['Les sauvegardes automatiques', 'Toutes les 30 min, les projets Ableton de ce PC qui ont changé sont copiés dans le Drive (BEESKOT Studio / Sauvegardes Ableton), avec la date et l\'heure dans le nom. Seulement le fichier .als, rien n\'est effacé. Case « 💾 Sauvegardes automatiques » pour couper ou sauvegarder tout de suite.'],
      ['Préparer pour le mixage', 'Ouvre le projet dans Ableton → Lire les pistes → Trier / Couleurs par groupe / Geler automatiquement → Appliquer dans Ableton → Zipper le projet → Envoyer dans le Drive.'] ],
    astuces: [ 'Le tempo lu dans Ableton peut aller dans la fiche du morceau (🎛 dans la Bibliothèque).' ] },
  { o: 'Reels Audio', ic: '🎧', quoi: 'Coupe le bon passage d\'un morceau pour un reel, à la bonne durée, et prépare la version ralentie ou accélérée pour le tournage.',
    comment: [
      ['Faire l\'audio d\'un reel', 'Choisis le morceau (son export ★) → place le passage (glisse le bloc, ou I / O) → durée → Exporter.'],
      ['Tourner au ralenti', 'Règle la vitesse de tournage (ex. 50 %) : l\'export donne 2 fichiers, MONTAGE (vitesse normale) et TOURNAGE (à jouer pendant le tournage).'],
      ['Voir les paroles du passage', 'Sous « Écouter » : les paroles exactes chantées pendant le passage, avec leur minutage. La 1re fois, cale les paroles du morceau : ⏺ Caler (Espace au début de chaque phrase) ou le bouton biscotte « Caler » (Miette écoute le morceau). Clic sur une ligne = l\'écouter pour vérifier. 📋 Copier.'],
      ['Reprendre un passage dit sur Discord', 'Bouton biscotte « Trouver les passages » : les timings donnés sur Discord pour ce morceau arrivent dans la liste des passages.'] ],
    astuces: [ 'Après l\'export : 📂 Ouvrir le dossier, ⇪ Upload Drive → ☁ Ouvrir le dossier du Drive.' ] },
  { o: 'Social Photo', ic: '📸', quoi: 'Prépare des photos ou un carrousel Instagram : format, cadrage, couleur, effet vintage, légende.',
    comment: [
      ['Faire un post', '+ Ajouter des photos → la fenêtre Médias s\'ouvre (dossiers, Discord, et « Filtrer » en haut : clique une rubrique puis une étiquette en dessous pour voir ce qu\'elle contient) → choisis les photos → Ajouter au post. Puis De quoi parle le post ? ▾, le format (Story 9:16, Portrait 4:5, Carré, Paysage), règle chaque photo → Exporter les images.'],
      ['Régler une photo', 'Clique-la dans la bande → Cadrage (Entière, Remplir, Centrer), Zoom (glisse la souris sur la case), glisse l\'image dans l\'aperçu pour la déplacer.'],
      ['Mettre une couleur ou un effet', 'Preset : un menu de looks tout prêts (Été 70, Souvenir Polaroid, Super 8, Diapo 70, Coucher de soleil, Vieux sépia…) qui règle couleur, effet, contraste, lumière, saturation et cadre d\'un coup ; tu peux tout retoucher après. Si tu avais déjà réglé des choses à la main, le logiciel te demande avant de les remplacer. Réglages : contraste, lumière, saturation (glisse la souris sur la case). Couleur : un filtre ou ta LUT, avec son intensité. Effet : vintage, délavé années 70, Polaroid, Super 8, sépia, noir et blanc, fuites de lumière (orange, dorée, rose), pellicule brûlée, halo, grain, VHS… À côté, Intensité : de 0 % (rien) à 100 % (plein effet). L\'effet va sur toutes les photos du carrousel. Cadre : la photo posée dans un Polaroid, une vieille photo, une pellicule 35 mm, un négatif scanné ou une diapositive ; Taille : un cadre fin ou épais.'],
      ['Trouver une légende', '✨ Idées de légende : Miette en propose. Copier la légende pour la coller sur Instagram.'] ],
    astuces: [ 'Tourner : la molette pour pencher la photo (double-clic = droite), ⟲ / ⟳ pour un quart de tour.', 'Sans photo, le téléphone montre une photo du groupe un peu effacée, pour voir le rendu : clique dessus pour ajouter tes photos.' ] },
  { o: 'Reels Vidéo', ic: '🎞', quoi: 'Monte une vidéo verticale (1080×1920) : couper, recadrer, couleur, effet, sous-titres calés sur la musique, export MP4.',
    comment: [
      ['Importer', 'De quoi parle la vidéo ? ▾ → ＋ Importer… → la fenêtre Médias (ou Ce PC) → choisis. 1 vidéo seule : elle se charge directement. Des photos ou plusieurs fichiers : la fenêtre du montage s\'ouvre déjà remplie.'],
      ['Faire une vidéo avec des photos et des vidéos', '＋ Importer… → choisis plusieurs fichiers → 🖼 Depuis Médias… ou 💻 Ce PC… → pour chacun : durée et animation (zoom avant, zoom arrière, glisser, fixe) → Transition et Effet → Importer ces fichiers.'],
      ['Mettre la musique', 'À droite, Musique : un export de Reels Audio, le passage ouvert dans Reels Audio, un morceau de la Bibliothèque (Morceau ▸ la version ; ★ = l\'export principal), ou une musique de ce PC.'],
      ['Ajouter des sous-titres', 'Choisis les paroles d\'un morceau → ⏺ Caler en écoutant → appuie sur Espace au début de chaque phrase.'],
      ['Exporter', 'Exporter en MP4 → 📂 Ouvrir le dossier ou ⇪ Upload Drive.'] ],
    astuces: [ 'Le son des vidéos importées n\'est pas gardé : la musique se choisit à droite.', 'Gabarit Instagram / TikTok : les zones hachurées seront cachées par l\'appli.' ] },
  { o: 'Lumières', ic: '💡', quoi: 'Le Light Show (LED de Pierre, TouchDesigner) et les lampes Globe du studio, depuis le PC.',
    comment: [
      ['Lancer le Light Show', '▶ Ouvrir dans TouchDesigner, ou ▶ Autre programme LED (ce PC).'],
      ['Piloter les lampes Globe', 'Enregistrer et chercher les lampes (une fois) → Allumer / Éteindre chaque lampe.'] ],
    astuces: [ 'À afficher seulement sur les PC qui en ont besoin (Réglages › Onglets).' ] },
  { o: 'Réglages', ic: '⚙', quoi: 'Ce qui est propre à cet ordinateur, plus le Drive, Miette et Ableton. Rangé en onglets : Aide, Ce PC, Onglets, Miette & Discord, Drive, Ableton.',
    comment: [
      ['Revenir en arrière après une erreur', 'Drive › ⏪ Time Machine → choisis l\'onglet et l\'heure d\'avant l\'erreur → Remettre comme avant. Google garde 30 jours d\'historique.'],
      ['Alléger les fiches', 'Drive › 🪶 Alléger les fiches : les vieilles photos recopiées dans les fiches sont rangées dans le Drive. Une seule fois, sur un seul PC.'],
      ['Fabriquer une carte d\'accès', 'Drive › 🎫 Fabriquer la carte d\'accès → elle arrive sur le Bureau. Ne l\'envoie qu\'aux membres, en message privé.'],
      ['Cacher un onglet sur ce PC', 'Onglets → éteins l\'interrupteur de l\'onglet.'] ],
    astuces: [ 'Taille de l\'interface : Ce PC › Zoom.' ] },
  { o: 'Questions fréquentes', ic: '❓', quoi: 'Les questions qu\'on se pose le plus souvent.',
    comment: [
      ['Je ne vois pas ce qu\'un autre a fait', 'Attends une minute (le partage se fait toutes les minutes). Sinon Réglages › Drive › ↻ Relire le Drive.'],
      ['Je n\'ai pas eu la fenêtre de mise à jour', 'Bouton rouge au losange DARI → 🔍 Vérifier les mises à jour. Le logiciel vérifie aussi tout seul au démarrage, puis toutes les 20 minutes.'],
      ['J\'ai effacé ou cassé quelque chose', 'Ctrl + Z tout de suite. Sinon Réglages › Drive › ⏪ Time Machine. Rien n\'est jamais vraiment effacé : ça part dans la corbeille du Drive.'],
      ['Le patch de Miette en haut, il fait quoi ?', 'Miette relit Discord (et les mails), le Drive, fait le résumé de la semaine, propose des tâches, des dépenses et des tournages, place les dates au Calendrier, reprend les BPM et remplit les moodboards vides. Elle ne valide rien toute seule.'],
      ['Miette ne répond pas', 'Vérifie l\'interrupteur « AI Miette activée » en bas du menu, et la clé Gemini dans Réglages › Miette & Discord. Si Gemini est occupé, réessaie dans une minute.'],
      ['Une date ou un mail n\'apparaît pas', 'Calendrier › ligne « Dernière lecture » : si 0 mail, coche le salon des mails dans Réglages › Miette & Discord, puis appuie sur la biscotte.'],
      ['Le PC rame', 'Le logiciel est fait pour ne jamais bloquer le PC : les gros exports vont plus lentement exprès. Ferme les onglets Médias / Reels Vidéo si tu ne t\'en sers pas.'],
      ['Où sont mes exports ?', 'Après chaque export : 📂 Ouvrir le dossier. Sur le Drive : ⇪ Upload Drive → ☁ Ouvrir le dossier du Drive.'],
      ['Poser une question à Miette depuis Discord', 'Écris « Miette ? c\'est quand le tournage de Mother ? ». Dès qu\'un PC a le logiciel ouvert, Miette répond juste sous le message. Interrupteur dans Réglages › Miette & Discord.'],
      ['Comment dire à Miette de noter quelque chose depuis Discord ?', 'Réaction 🍞 sous le message, ou un message qui commence par « Miette, ». Le ✅ apparaît sous le message quand c\'est rangé (dès qu\'un PC a le logiciel ouvert).'],
      ['Le Drive dit « non relié »', 'Réglages › Drive › Importer une carte d\'accès (demande-la à Dari).'] ] },
];

BK.nouveautes = {
  // le tuto : un onglet à la fois, une ligne par fonction
  tuto(depart) {
    if (document.getElementById('tuVoile')) return;
    const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    let i = Math.max(0, BK.TUTO.findIndex(x => x.o === depart)), cherche = '';
    const v = document.createElement('div'); v.className = 'voile'; v.id = 'tuVoile';
    const bloc = (q, r) => `<details class="tu-q"><summary>${esc(q)}</summary><p>${esc(r).replace(/ → /g, ' <b>→</b> ')}</p></details>`;
    const contenu = () => {
      if (cherche) {                                              // la recherche : dans tout le tuto et la FAQ
        const n = t => BK.inv ? BK.inv.normaliser(t) : String(t).toLowerCase(), m = n(cherche);
        const r = BK.TUTO.flatMap(t => [...(t.comment || []).filter(([q, x]) => n(q + ' ' + x).includes(m)).map(([q, x]) => bloc(t.ic + ' ' + q, x)),
          ...(t.astuces || []).filter(x => n(x).includes(m)).map(x => `<p class="tu-a">${t.ic} ${esc(x)}</p>`)]);
        return `<b>🔍 « ${esc(cherche)} »</b>${r.length ? r.join('') : '<p class="nt">Rien trouvé. Essaie un autre mot, ou pose la question à Miette.</p>'}`;
      }
      const t = BK.TUTO[i];
      return `<b>${t.ic} ${esc(t.o)}</b><p class="tu-quoi">${esc(t.quoi || '')}</p>
        ${(t.comment || []).length ? `<span class="eng tu-t">${t.o === 'Questions fréquentes' ? 'Clique une question' : 'Comment faire…'}</span>${t.comment.map(([q, r]) => bloc(q, r)).join('')}` : ''}
        ${(t.astuces || []).length ? `<span class="eng tu-t">Bon à savoir</span>${t.astuces.map(x => `<p class="tu-a">• ${esc(x)}</p>`).join('')}` : ''}
        <div class="tu-nav">${i > 0 ? `<button class="btn sm" data-tu="${i - 1}">◀ ${esc(BK.TUTO[i - 1].o)}</button>` : '<span></span>'}${i < BK.TUTO.length - 1 ? `<button class="btn sm pri" data-tu="${i + 1}">${esc(BK.TUTO[i + 1].o)} ▶</button>` : '<button class="btn sm pri" data-tu="x">Fini ✓</button>'}</div>`;
    };
    const dessiner = () => {
      v.innerHTML = `<div class="stopbox tu-box">
        <span class="screw tl"></span><span class="screw tr"></span><span class="screw bl"></span><span class="screw br"></span>
        <button class="btn xs rt-x" data-tu="x" title="Fermer">✕</button>
        <span class="dymo" style="align-self:center">Tuto</span>
        <div class="tu-cols"><div class="tu-menu"><input class="fld tu-cherche" id="tuCherche" placeholder="🔍 Chercher…" value="${esc(cherche)}">
            ${BK.TUTO.map((x, k) => `<button class="${k === i && !cherche ? 'on' : ''}" data-tu="${k}">${x.ic} ${esc(x.o)}</button>`).join('')}</div>
          <div class="tu-c" id="tuC">${contenu()}</div></div></div>`;
      const c = v.querySelector('#tuCherche');
      c.addEventListener('keydown', e => e.stopPropagation());
      c.oninput = () => { cherche = c.value.trim(); v.querySelector('#tuC').innerHTML = contenu(); lier(); v.querySelectorAll('.tu-menu [data-tu]').forEach(b => b.classList.toggle('on', !cherche && +b.dataset.tu === i)); };
      lier(); };
    const lier = () => v.querySelectorAll('[data-tu]').forEach(b => b.onclick = () => { if (b.dataset.tu === 'x') return v.remove(); i = +b.dataset.tu; cherche = ''; dessiner(); });
    document.body.appendChild(v); dessiner();
    v.addEventListener('click', e => { if (e.target === v) v.remove(); });
  },
  // tout le tuto en texte simple : Miette s'en sert pour répondre aux questions sur le logiciel
  texteGuide() {
    return BK.TUTO.map(t => `## ${t.o}\n${t.quoi || ''}\n${(t.comment || []).map(([q, r]) => `- ${q} : ${r}`).join('\n')}\n${(t.astuces || []).map(x => `- ${x}`).join('\n')}`).join('\n\n');
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
