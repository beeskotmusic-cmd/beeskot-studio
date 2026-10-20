// =====================================================================
// LA LISTE DES ONGLETS — c'est le seul endroit à toucher pour ajouter,
// renommer, réordonner ou cacher un onglet.
//   cote    : 'general' | 'audio' | 'visuel' | 'outils'
//   couleur : la petite pastille à gauche de la touche
//   pret    : false = affiché « bientôt » (page en construction)
//   defaut  : visible par défaut sur un nouveau PC (chaque PC peut changer dans Réglages)
// =====================================================================
BK.onglets = [
  { id: 'accueil',  cote: 'general', titre: 'Accueil',        sous: 'Next et à faire',              couleur: 'var(--mus)',  pret: true,  defaut: true },
  { id: 'renforts', cote: 'general', titre: 'Renfort AI',     sous: 'Veilleur Discord, aides',      couleur: 'var(--teal)', pret: true,  defaut: true },

  { id: 'biblio',   cote: 'audio',   titre: 'Bibliothèque',   sous: 'Morceaux, exports, projets',    couleur: 'var(--org)',  pret: true , defaut: true },
  { id: 'mixprep',  cote: 'audio',   titre: 'Ableton Live Assistant', sous: 'Noms, couleurs, gel, zip', couleur: 'var(--rust)', pret: true , defaut: true },
  { id: 'reels',    cote: 'audio',   titre: 'Assistant audio Reel', sous: 'Passage, durée, vitesse', couleur: 'var(--teal)', pret: true , defaut: true },

  { id: 'medias',   cote: 'visuel',  titre: 'Médias',         sous: 'Photos, vidéos, étiquettes',    couleur: 'var(--ox)',   pret: true, defaut: true },
  { id: 'reelvis',  cote: 'visuel',  titre: 'Assistant visuel Reel', sous: 'Montage, sous-titres, MP4',    couleur: 'var(--teal)', pret: true , defaut: true },
  { id: 'postvis',  cote: 'visuel',  titre: 'Assistant visuel Post', sous: 'Photos, carrousel Insta',      couleur: 'var(--navy)', pret: true , defaut: true },

  { id: 'lumieres', cote: 'show',    titre: 'Lumières',       sous: 'Light Show, lampes Globe',      couleur: 'var(--olv)',  pret: true, defaut: true },

  { id: 'tournage', cote: 'outils',  titre: 'Tournages',      sous: 'Plan, moodboard, PDF',          couleur: 'var(--navy)', pret: true, defaut: true },
  { id: 'agenda',   cote: 'outils',  titre: 'Calendrier',     sous: 'Agenda BEESKOT, promo',         couleur: 'var(--mus)',  pret: true , defaut: true },
  { id: 'taches',   cote: 'outils',  titre: 'To-do list',     sous: 'À faire',                       couleur: 'var(--crm)',  pret: true , defaut: true },
  { id: 'reglages', cote: 'outils',  titre: 'Réglages',       sous: '',                              couleur: '#555',        pret: true,  defaut: true, mini: true, fixe: true },
];

BK.cotes = [
  { id: 'general', titre: '' , nom: 'Général' },
  { id: 'audio',   titre: 'Audio' },
  { id: 'visuel',  titre: 'Visuel' },
  { id: 'show',    titre: 'Show' },
  { id: 'outils',  titre: 'Organisation' },
];
