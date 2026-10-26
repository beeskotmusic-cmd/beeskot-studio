// =====================================================================
// BEESKOT Studio — ESPACE DE PARTAGE (le « guichet »)
//
// Ce petit programme tourne chez Google (Apps Script), gratuitement, avec le
// compte Gmail BEESKOT. Il sert la page web aux invités (ingé son, caméraman…)
// et lit / écrit dans le Drive BEESKOT, dans le même dossier que le logiciel :
//
//   <Drive BEESKOT>/BEESKOT Studio/
//        partages/<id>.json      un lien secret (fait par le logiciel) : ses morceaux / vidéos
//        notesmix/ext-*.json     les notes des invités sur un morceau (faites ICI) → le logiciel les voit
//        notesvid/ext-*.json     les notes des invités sur une vidéo, dessins compris (faites ICI)
//
// Le son et la vidéo ne passent PAS par ce programme : la page de l'invité les lit
// directement depuis le fichier du Drive (le logiciel rend le fichier lisible « avec le
// lien » tant que le lien secret est actif, et retire cet accès quand on coupe le lien).
//
// RÈGLES DE SÉCURITÉ : le guichet ne MODIFIE jamais une fiche du groupe.
// Il ne fait qu'AJOUTER des notes (nouveaux fichiers « ext-… »), et ne retouche que
// les réactions / la couleur de ces notes d'invités. Un lien coupé (actif: false)
// ou inconnu → « Ce lien n'est plus actif ».
// =====================================================================
var RACINE = 'BEESKOT Studio';
var COL_LIENS = 'partages', COL_AUDIO = 'notesmix', COL_VIDEO = 'notesvid';
var MAX_TEXTE = 600;          // longueur maximum d'une note
var MAX_NOTES_HEURE = 60;     // par lien et par heure (contre les petits malins)

// ---------- la page ----------
function doGet(e) {
  var t = HtmlService.createTemplateFromFile('page');
  t.cle = String((e && e.parameter && e.parameter.k) || '').replace(/[^a-zA-Z0-9_-]/g, '');
  return t.evaluate().setTitle('BEESKOT · Espace de partage')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ---------- les dossiers du Drive ----------
function dossier(nom, parent, creer) {
  var it = (parent || DriveApp.getRootFolder()).getFoldersByName(nom);
  if (it.hasNext()) return it.next();
  if (creer) return parent.createFolder(nom);
  throw new Error('Dossier introuvable dans le Drive : ' + nom);
}
function racine() { return dossier(RACINE); }
function dossierLiens() { return dossier(COL_LIENS, racine()); }
function dossierNotesDe(el) { return dossier(el && el.type === 'video' ? COL_VIDEO : COL_AUDIO, racine(), true); }

// lire un petit fichier JSON (gardé en cache tant qu'il n'a pas changé)
function lireJson(f) {
  var cache = CacheService.getScriptCache(), k = 'f:' + f.getId() + ':' + f.getLastUpdated().getTime();
  var c = cache.get(k); if (c) return JSON.parse(c);
  var txt = f.getBlob().getDataAsString('UTF-8');
  if (txt.length < 90000) cache.put(k, txt, 21600);
  return JSON.parse(txt);
}

// ---------- le lien secret ----------
function trouverLien(cle) {
  cle = String(cle || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (cle.length < 8) throw new Error('Ce lien n\'est pas valide.');
  var cache = CacheService.getScriptCache(), idF = cache.get('l:' + cle), f = null;
  if (idF) { try { f = DriveApp.getFileById(idF); } catch (e) { f = null; } }
  if (!f) {
    var it = dossierLiens().getFiles();
    while (it.hasNext()) { var x = it.next(); if (!/\.json$/.test(x.getName())) continue;
      var j; try { j = lireJson(x); } catch (e) { continue; }
      if (j && j.cle === cle) { f = x; cache.put('l:' + cle, x.getId(), 600); break; } }
  }
  if (!f) throw new Error('Ce lien n\'est plus actif.');
  var lien = lireJson(f);                              // toujours relu : « couper le lien » marche tout de suite
  if (!lien || lien.cle !== cle || lien.actif === false) throw new Error('Ce lien n\'est plus actif.');
  return lien;
}
var DROITS = { 'voir-ecrire': 1, 'ecrire': 1, 'lire': 1 };
function droitDe(lien) { return DROITS[lien.droit] ? lien.droit : 'lire'; }
function elementDe(lien, id) {
  var el = (lien.elements || []).filter(function (x) { return x.id === id; })[0];
  if (!el) throw new Error('Élément inconnu.');
  return el;
}
function prenomNet(p) { return String(p || '').trim().slice(0, 30).replace(/[<>]/g, ''); }

// ---------- ce que la page demande ----------
// à l'ouverture : le nom du lien, le droit, la liste des morceaux / vidéos (avec l'identifiant de leur fichier Drive)
function ouvrir(cle, prenom) {
  var lien = trouverLien(cle), els = lien.elements || [];
  return { nom: lien.nom || '', droit: droitDe(lien), mot: lien.mot || '', cleApi: lien.cleApi || '', ab: !!lien.ab && els.length === 2 && (els[0].type === 'video') === (els[1].type === 'video'),
    elements: els.map(function (e) { return { id: e.id, type: e.type === 'video' ? 'video' : 'audio', nom: e.nom || '', versionNom: e.versionNom || '', fichier: e.fichier || '', taille: e.taille || 0 }; }),
    notes: els.length ? notes(cle, els[0].id, prenom) : [] };
}

// les notes de ce lien pour cet élément (jamais celles du groupe, jamais celles qui sont cachées)
function notes(cle, idEl, prenom) {
  var lien = trouverLien(cle), droit = droitDe(lien), el = elementDe(lien, idEl), video = el.type === 'video';
  var it = dossierNotesDe(el).searchFiles("title contains 'ext-" + lien.id + "-'"), out = [];
  while (it.hasNext()) { var f = it.next(); var n; try { n = lireJson(f); } catch (e) { continue; }
    if (!n || n.partage !== lien.id || n.cache) continue;
    if (video ? n.video !== 'drive:' + el.fichier : n.morceau !== el.morceau) continue;
    if (droit === 'ecrire' && n.prenom !== prenom) continue;        // « écrire seulement » : on ne voit que ses propres notes
    out.push({ id: n.id, ab: n.ab || '', t: n.t || 0, fin: n.fin || null, tout: !!n.tout, texte: n.texte || '', prenom: n.prenom || '', quand: n.quand || '', regle: !!n.regle,
      reactions: n.reactions || {}, couleur: n.couleur || '', dessin: n.dessin || null,
      reponses: (n.reponses || []).map(function (r) { return { par: r.par || '', texte: r.texte || '', quand: r.quand || '' }; }) });
  }
  return out.sort(function (a, b) { return a.t - b.t; });
}

// un dessin d'invité : on garde seulement ce qui ressemble à des traits (couleur, points entre 0 et 1), en quantité limitée
function nettoyerDessin(d) {
  if (!Array.isArray(d)) return null;
  var out = [], k = function (v) { v = +v; return isFinite(v) ? Math.round(Math.max(0, Math.min(1, v)) * 1000) / 1000 : null; };
  for (var i = 0; i < Math.min(d.length, 40); i++) {
    var t = d[i] || {}, c = /^#[0-9a-fA-F]{6}$/.test(String(t.c)) ? t.c : '#ffb23e', p = [], a = Array.isArray(t.p) ? t.p : [];
    for (var j = 0; j < Math.min(a.length, 400); j++) { var x = k(a[j] && a[j][0]), y = k(a[j] && a[j][1]); if (x !== null && y !== null) p.push([x, y]); }
    if (p.length) out.push({ c: c, p: p });
  }
  return out.length ? out : null;
}

// une nouvelle note : un NOUVEAU fichier dans notesmix / notesvid (le logiciel la voit dans la minute)
function ecrireNote(cle, idEl, prenom, note) {
  var lien = trouverLien(cle), droit = droitDe(lien);
  if (droit === 'lire') throw new Error('Ce lien permet seulement d\'écouter.');
  var el = elementDe(lien, idEl), video = el.type === 'video';
  var lesEls = lien.elements || [], etiq = lien.ab && lesEls.length === 2 ? (lesEls[0].id === el.id ? 'A' : 'B') : '';
  prenom = prenomNet(prenom);
  var texte = String((note && note.texte) || '').trim().slice(0, MAX_TEXTE);
  if (!prenom) throw new Error('Il faut un prénom.');
  if (!texte) throw new Error('La note est vide.');
  // pas plus de MAX_NOTES_HEURE notes par heure sur ce lien
  var cache = CacheService.getScriptCache(), k = 'n:' + lien.id + ':' + Math.floor(Date.now() / 3600000), nb = +(cache.get(k) || 0);
  if (nb >= MAX_NOTES_HEURE) throw new Error('Beaucoup de notes d\'un coup : réessaie dans un moment.');
  cache.put(k, String(nb + 1), 3600);
  var id = 'ext-' + lien.id + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  var quand = new Date().toISOString(), tout = !!note.tout;
  var base = { id: id, t: tout ? 0 : Math.max(0, Math.round((+note.t || 0) * 10) / 10), fin: !tout && note.fin ? Math.round(+note.fin * 10) / 10 : null, tout: tout,
    texte: texte, auteur: 'Externe · ' + prenom + (etiq ? ' (' + etiq + ')' : ''), ab: etiq, par: 'Externe', externe: true, prenom: prenom, partage: lien.id, quand: quand, maj: quand, reponses: [], regle: false, cache: false };
  var fiche;
  if (video) { fiche = base; fiche.video = 'drive:' + el.fichier; fiche.videoNom = el.nom || ''; fiche.lien = el.lien || ''; var d = nettoyerDessin(note.dessin); if (d && !tout) fiche.dessin = d; }
  else { fiche = base; fiche.morceau = el.morceau; fiche.version = el.version || ''; fiche.versionNom = el.versionNom || ''; fiche.contre = ''; fiche.contreNom = ''; }
  dossierNotesDe(el).createFile(id + '.json', JSON.stringify(fiche, null, 1), 'application/json');
  return { id: id, t: fiche.t, fin: fiche.fin, tout: fiche.tout, texte: texte, prenom: prenom, ab: etiq, quand: quand, regle: false, reponses: [], reactions: {}, couleur: '', dessin: fiche.dessin || null };
}

// ---------- réagir (pouce / croix) ou marquer d'une couleur une note qu'on voit ----------
// Seulement les notes de CE lien (fichiers « ext-<lien>-… », faits par le guichet) : jamais une note du groupe.
// On relit le fichier juste avant, et on ne change QUE la réaction de cette personne (ou la couleur).
var COULEURS_OK = { '#d9a93c': 1, '#c65d2a': 1, '#7a2430': 1, '#3f6b3a': 1, '#2f7377': 1, '#2a3f6a': 1, '': 1 };
function fichierNote(lien, idNote) {
  idNote = String(idNote || '');
  if (idNote.indexOf('ext-' + lien.id + '-') !== 0 || !/^[a-zA-Z0-9-]+$/.test(idNote)) throw new Error('Note inconnue.');
  var dossiers = [dossierNotesDe({ type: 'audio' }), dossierNotesDe({ type: 'video' })];
  for (var i = 0; i < dossiers.length; i++) { var it = dossiers[i].getFilesByName(idNote + '.json'); if (it.hasNext()) return it.next(); }
  throw new Error('Note introuvable.');
}
function modifierNote(cle, idNote, changer) {
  var lien = trouverLien(cle); if (droitDe(lien) === 'lire') throw new Error('Ce lien permet seulement d\'écouter.');
  var verrou = LockService.getScriptLock(); verrou.waitLock(8000);
  try {
    var f = fichierNote(lien, idNote), n = JSON.parse(f.getBlob().getDataAsString('UTF-8'));
    if (n.partage !== lien.id || n.cache) throw new Error('Note inconnue.');
    changer(n); n.maj = new Date().toISOString();
    f.setContent(JSON.stringify(n, null, 1));
    return { reactions: n.reactions || {}, couleur: n.couleur || '' };
  } finally { verrou.releaseLock(); }
}
function reagir(cle, idNote, prenom, reac) {
  prenom = prenomNet(prenom); if (!prenom) throw new Error('Il faut un prénom.');
  if (reac !== 'pouce' && reac !== 'croix' && reac !== '') throw new Error('Réaction inconnue.');
  var qui = 'Externe · ' + prenom;
  return modifierNote(cle, idNote, function (n) { n.reactions = n.reactions || {}; if (reac) n.reactions[qui] = reac; else delete n.reactions[qui]; });
}
function marquer(cle, idNote, couleur) {
  couleur = String(couleur || ''); if (!COULEURS_OK[couleur]) throw new Error('Couleur inconnue.');
  return modifierNote(cle, idNote, function (n) { if (couleur) n.couleur = couleur; else delete n.couleur; });
}

// ---------- pour vérifier que tout est bien branché (menu Exécuter › tester) ----------
function tester() {
  var r = racine(); Logger.log('Dossier trouvé : ' + r.getName());
  Logger.log('Liens : ' + dossierLiens().getName() + ' · Notes : ' + dossierNotesDe({ type: 'audio' }).getName() + ' · ' + dossierNotesDe({ type: 'video' }).getName());
  Logger.log('Tout est bon.');
}
