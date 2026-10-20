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

  { id: 'biblio',   cote: 'audio',   titre: 'Bibliothèque',   sous: 'Morceaux, exports, projets',    couleur: 'var(--org)',  pret: true , defaut: true },
  { id: 'mixprep',  cote: 'audio',   titre: 'Prépa mixage',   sous: 'Noms, couleurs, zip, Drive',    couleur: 'var(--rust)', pret: true , defaut: true },
  { id: 'reels',    cote: 'audio',   titre: 'Assistant audio Reel', sous: 'Passage, durée, vitesse', couleur: 'var(--teal)', pret: true , defaut: true },

  { id: 'reelvis',  cote: 'visuel',  titre: 'Assistant visuel Reel', sous: 'Formats, sous-titres, Premiere', couleur: 'var(--teal)', pret: false, defaut: true },
  { id: 'tournage', cote: 'visuel',  titre: 'Tournages',      sous: 'Moodboard, découpage, PDF',     couleur: 'var(--navy)', pret: false, defaut: true },
  { id: 'medias',   cote: 'visuel',  titre: 'Médias',         sous: 'Photos, pochettes, vidéos',     couleur: 'var(--ox)',   pret: false, defaut: true },
  { id: 'lumieres', cote: 'visuel',  titre: 'Lumières',       sous: 'Lampes Globe, LED du studio',   couleur: 'var(--olv)',  pret: false, defaut: false },

  { id: 'agenda',   cote: 'outils',  titre: 'Calendrier',     sous: 'Agenda BEESKOT, promo',         couleur: 'var(--mus)',  pret: true , defaut: true },
  { id: 'taches',   cote: 'outils',  titre: 'To-do list',     sous: 'À faire',                       couleur: 'var(--crm)',  pret: true , defaut: true },
  { id: 'renforts', cote: 'outils',  titre: 'Renforts AI',    sous: 'Gemini, Codex…',                couleur: '#555',        pret: false, defaut: true, mini: true },
  { id: 'reglages', cote: 'outils',  titre: 'Réglages',       sous: '',                              couleur: '#555',        pret: true,  defaut: true, mini: true, fixe: true },
];

BK.cotes = [
  { id: 'general', titre: '' , nom: 'Général' },
  { id: 'audio',   titre: 'Audio' },
  { id: 'visuel',  titre: 'Visuel' },
  { id: 'outils',  titre: 'Organisation' },
];
