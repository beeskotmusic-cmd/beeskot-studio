// =====================================================================
// PAIN TURE — fabriquer une image à partir d'une idée (pour dépanner un reel, un moodboard…).
// Elle passe par « agy », l'outil gratuit de Google, connecté au compte BEESKOT.
//
//   [Pierre] [Yacine] [Baptiste]     ← les membres : leur photo de réf. + leur description (fiche ✎)
//   [Le groupe joue] [Rétro 70s]… [+] ← des bouts de prompt tout prêts (on peut en créer)
//   Références : la boîte (3 max) — photos des membres allumés + lieux / objets ajoutés (PC ou Médias)
//   Ton idée → ✨ Générer → barre de progression → Garder (Drive › Photos/Vidéos › Pain Ture) · Refaire · Jeter
//
// Partagé avec tout le groupe (Drive) : les fiches membres (painture.membres) et les boutons (painture.presets).
// PC seulement (agy ne tourne pas sur téléphone). Une image à la fois.
// La 1re fois sur un PC : ① Installer ② Se connecter ③ Vérifier — puis plus jamais.
// =====================================================================
(() => {
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const FORMATS = { '9:16': 'Vertical 9:16 (reel)', '4:5': 'Portrait 4:5 (post)', '1:1': 'Carré 1:1', '16:9': 'Horizontal 16:9' };
const MAX_REFS = 3;                                       // la limite de l'outil Google
const TROP = 'Maximum trois références !';
const MEMBRES = ['Pierre', 'Yacine', 'Baptiste'];
// ce qu'on sait déjà de chacun (complété ensuite dans la fiche ✎, pour tout le groupe)
const MEMBRES_DEFAUT = {         // les photos de départ sont livrées avec le logiciel (ui/look/membres/)
  Pierre:   { photo: 'look/membres/pierre.jpg',   taille: '1,73 m', vetements: '', attributs: 'bassiste, le plus petit des trois ; cheveux courts châtains, lunettes rondes fines, moustache et petite barbe' },
  Yacine:   { photo: 'look/membres/yacine.jpg',   taille: '1,92 m', vetements: '', attributs: 'chanteur (joue aussi guitare, piano ou congas), le plus grand des trois ; barbe noire fournie, souvent un bonnet' },
  Baptiste: { photo: 'look/membres/baptiste.jpg', taille: '1,80 m', vetements: '', attributs: 'batteur ; cheveux châtains mi-longs, lunettes rondes, barbe' },
};
// les boutons de prompt tout prêts (le groupe peut en ajouter, les changer ou les retirer)
const PRESETS_DEFAUT = [
  { id: 'joue',    nom: 'Le groupe joue',   texte: 'The band members are playing their instruments, live energy, natural poses, mid-performance.' },
  { id: 'retro',   nom: 'Rétro 70s',        texte: '1970s analog film look, warm faded colors, natural film grain, soft halation, vintage clothing and props.' },
  { id: 'art',     nom: 'Artistique',       texte: 'Artistic editorial photography, cinematic composition, bold framing, rich mood.' },
  { id: 'neons',   nom: 'Néons la nuit',    texte: 'At night, lit by red and blue neon lights, deep shadows, glowing reflections.' },
  { id: 'or',      nom: 'Lumière dorée',    texte: 'Golden hour sunlight, warm low sun, long soft shadows, lens flare.' },
  { id: 'cover',   nom: 'Pochette d\'album', texte: 'Composed like a classic rock album cover: strong central subject, iconic, simple background, room for a title.' },
  { id: 'coul',    nom: 'Coulisses',        texte: 'Candid backstage moment, behind the scenes, relaxed and spontaneous, documentary style.' },
  { id: 'studio',  nom: 'Au studio',        texte: 'Inside a small cosy rehearsal studio: wood, warm lamps, amps, cables, rugs.' },
];
const P = { format: '9:16', manuels: [], images: [], enCours: false, actifs: new Set(), presetsOn: new Set(), membres: null, presets: null };
const inv = (cmd, a) => BK.T.core.invoke(cmd, a);

// ---------- les fiches partagées ----------
async function lireFiches() {
  const m = await BK.partage.lire('painture.membres', {}).catch(() => ({}));
  P.membres = Object.fromEntries(MEMBRES.map(n => [n, { ...MEMBRES_DEFAUT[n], ...((m || {})[n] || {}) }]));
  const p = await BK.partage.lire('painture.presets', null).catch(() => null);
  P.presets = Array.isArray(p) && p.length ? p : PRESETS_DEFAUT.map(x => ({ ...x }));
}
const garderMembres = () => BK.partage.ecrire('painture.membres', P.membres);
const garderPresets = () => BK.partage.ecrire('painture.presets', P.presets);

// ---------- les références : photos des membres allumés + ajouts à la main ----------
// une référence = { nom, apercu, fichier (PC) | f (Drive) | ref ('drive:ID') | dc (Discord), membre? }
const refsMembres = () => [...P.actifs].filter(n => P.membres[n] && P.membres[n].photo).map(n => ({ nom: n, ref: P.membres[n].photo, membre: n }));
const toutesRefs = () => [...refsMembres(), ...P.manuels];
async function octetsDe(x) {
  if (x.fichier) return new Uint8Array(await x.fichier.arrayBuffer());
  if (x.f) return BK.drive.telecharger(x.f.id);
  if (x.ref && BK.img.estDrive(x.ref)) return BK.drive.telecharger(BK.img.id(x.ref));
  if (x.ref) return new Uint8Array(await (await fetch(x.ref)).arrayBuffer());   // une ancienne image gardée telle quelle
  if (x.dc && x.dc.url) return new Uint8Array(await (await BK.ia.fetch(x.dc.url)).arrayBuffer());
  throw new Error('photo illisible (' + (x.nom || '?') + ')');
}
async function dossierPainTure(sous) {
  await BK.dossiers.assurer();
  const base = await BK.dossiers.get('photovideo'); if (!base) throw new Error('dossier Photos/Vidéos introuvable (Réglages › Vos dossiers du Drive)');
  let id = await BK.drive.dossier('Pain Ture', base.id); if (sous) id = await BK.drive.dossier(sous, id); return id;
}
// une photo de la fiche d'un membre : rangée dans le Drive (Photos/Vidéos › Pain Ture › Références) pour que tout le groupe l'ait
async function versDrive(x) {
  if (x.ref) return x.ref;
  if (x.f) return BK.img.ref(x.f.id);
  if (!BK.drive.relie()) throw new Error('relie d\'abord le Drive (Réglages › Drive)');
  const octets = await octetsDe(x), dos = await dossierPainTure('Références');
  const r = await BK.drive.envoyerBlob(new Blob([octets], { type: x.mime || (x.fichier && x.fichier.type) || 'image/jpeg' }), x.nom || 'reference.jpg', dos);
  return BK.img.ref(r.id);
}

// « + » : une photo du PC ou de Médias → [références]
function choisirPhoto({ titre, plusieurs = true } = {}) {
  return new Promise(ok => {
    const v = document.createElement('div'); v.className = 'voile';
    v.innerHTML = `<div class="stopbox pt-choix"><span class="dymo" style="align-self:center">${esc(titre || 'Ajouter une photo')}</span>
      <div class="chips" style="justify-content:center"><button class="btn pri" data-c="pc">💻 Ce PC</button><button class="btn pri" data-c="md">🖼 Médias</button></div>
      <div class="stopbox-btns"><button class="btn" data-c="x">Annuler</button></div><input type="file" accept="image/*" ${plusieurs ? 'multiple' : ''} hidden></div>`;
    document.body.appendChild(v);
    const fin = l => { v.remove(); ok(l || []); };
    const inp = v.querySelector('input');
    inp.onchange = () => fin([...inp.files].map(f => ({ nom: f.name, mime: f.type, fichier: f, apercu: URL.createObjectURL(f) })));
    v.onclick = async e => { const b = e.target.closest('[data-c]'); if (!b) { if (e.target === v) fin([]); return; }
      if (b.dataset.c === 'x') return fin([]);
      if (b.dataset.c === 'pc') return inp.click();
      v.classList.add('hidden');
      const l = await BK.choisirDansMedias({ titre: titre || 'Choisir dans Médias', bouton: 'Prendre', type: 'image' });
      fin((l || []).filter(x => !x.retirer).map(x => x.fichier ? { ...x, apercu: x.apercu || URL.createObjectURL(x.fichier) } : x)); };
  });
}

// la demande envoyée à l'outil (en anglais : il comprend mieux), avec les garde-fous
function demande(idee, format, refs, sansTexte) {
  const L = ['Generate exactly ONE image with your image generation tool.', `Aspect ratio: ${format}.`];
  const gens = [...P.actifs];
  if (gens.length) {
    L.push('People in the image (BEESKOT, a three-piece 70s-inspired rock band). Keep each person recognizable: same face, hair and build as in his reference photo.');
    for (const n of gens) { const m = P.membres[n] || {}, k = refs.findIndex(r => r.membre === n);
      L.push(`- ${n}${k >= 0 ? ` (reference photo: ref${k + 1}.jpg)` : ''}: ${[m.taille && 'height ' + m.taille, m.vetements && 'clothes: ' + m.vetements, m.attributs].filter(Boolean).join('; ') || 'band member'}.`); }
    L.push(`Only these ${gens.length} band member(s) appear as the main people.`);
  }
  const autres = refs.map((r, i) => r.membre ? '' : `ref${i + 1}.jpg`).filter(Boolean);
  if (autres.length) L.push(`Other reference images in the current folder (place, object or style to use): ${autres.join(', ')}.`);
  const styles = P.presets.filter(p => P.presetsOn.has(p.id)).map(p => p.texte).filter(Boolean);
  if (styles.length) L.push('Scene and style: ' + styles.join(' '));
  if (idee) L.push('Description (may be in French): ' + idee);
  if (sansTexte) L.push('No visible text, letters, signs, brand names or logos in the image.');
  L.push('Rules: do not run any shell command, do not create, copy or move any file yourself. Only generate the image, then answer with one short sentence.');
  return L.join('\n');
}

BK.module('painture', function (page) {
  $('.sub', page).textContent = 'Une idée → une image (compte BEESKOT, gratuit)';
  const g = $('.grid', page);
  if (!BK.estExe || window.BK_MOBILE) { g.innerHTML = '<div class="pane vit"><span class="nt">Pain Ture marche seulement dans le logiciel installé sur un PC.</span></div>'; return; }

  g.innerHTML = `
    <div class="cols">
      <section class="pane vit">
        <div class="box hidden" id="ptInstall">
          <span class="lb">Préparer ce PC (une seule fois)</span>
          <div class="pt-etape"><b>1</b><button class="btn sm pri" id="ptInst">⬇ Installer</button><span class="nt" id="ptInstN">L'outil Google s'installe tout seul, sans fenêtre (1 à 2 minutes).</span></div>
          <div class="pt-etape"><b>2</b><button class="btn sm" id="ptCo">🔗 Se connecter</button><span class="nt">Une fenêtre noire s'ouvre. Appuie sur Entrée jusqu'à « Login with Google », choisis le <b>compte BEESKOT</b> dans la page Google, copie le code, colle-le dans la fenêtre noire (clic droit) puis Entrée. Ferme la fenêtre.</span></div>
          <div class="pt-etape"><b>3</b><button class="btn sm" id="ptVerif">✓ Vérifier</button><span class="nt" id="ptVerifN">Un petit essai pour voir si tout marche.</span></div>
        </div>
        <div class="box" id="ptForm">
          <span class="lb">Qui est dans l'image ?</span>
          <div class="chips pt-membres" id="ptMembres"></div>
          <span class="lb" style="margin-top:8px">Ambiance <small class="nt">(clic droit sur un bouton : le modifier)</small></span>
          <div class="chips pt-presets" id="ptPresets"></div>
          <span class="lb" style="margin-top:8px">Références <small class="nt">(3 max)</small></span>
          <div class="pt-refs" id="ptRefs"></div>
          <span class="lb" style="margin-top:8px">Ton idée</span>
          <textarea class="fld" id="ptIdee" rows="3" placeholder="Ex. : sur un toit de Montréal la nuit, la ville derrière eux"></textarea>
          <span class="lb" style="margin-top:8px">Format</span>
          <div class="seg" id="ptFmt">${Object.entries(FORMATS).map(([k, n]) => `<button data-f="${k}" title="${esc(n)}">${k}</button>`).join('')}</div>
          <label class="nt pt-case"><input type="checkbox" id="ptSansTexte" checked> Pas de texte ni de logo inventé</label>
          <div class="chips" style="margin-top:8px"><button class="btn pri" id="ptGo">✨ Générer</button><span class="nt" id="ptMsg"></span></div>
          <div class="pt-barre hidden" id="ptBarre"><i></i><span></span></div>
        </div>
      </section>
      <section class="pane vit">
        <div class="box grow"><span class="lb">Images</span>
          <div class="pt-images" id="ptImages"></div></div>
      </section>
    </div>`;

  const msg = t => { $('#ptMsg', page).textContent = t || ''; };
  const majFmt = () => $$('#ptFmt button', page).forEach(b => b.classList.toggle('on', b.dataset.f === P.format));
  $('#ptFmt', page).onclick = e => { const b = e.target.closest('[data-f]'); if (b) { P.format = b.dataset.f; BK.regler('painture.format', P.format); majFmt(); } };
  P.format = BK.reglage('painture.format', '9:16'); majFmt();

  // ---------- les membres ----------
  const majMembres = () => {
    $('#ptMembres', page).innerHTML = MEMBRES.map(n => { const m = P.membres[n] || {};
      return `<span class="pt-mb"><button class="btn sm${P.actifs.has(n) ? ' on' : ''}" data-mb="${n}" title="${esc([m.taille, m.vetements, m.attributs].filter(Boolean).join(' · ') || 'Remplis sa fiche avec ✎')}">${m.photo ? '' : '<i class="pt-pas" title="Pas encore de photo de référence">!</i>'}${n}</button><button class="btn xs" data-mbe="${n}" title="La fiche de ${n} (photo, taille, vêtements…)">✎</button></span>`; }).join('');
  };
  $('#ptMembres', page).onclick = e => {
    const b = e.target.closest('[data-mb],[data-mbe]'); if (!b) return;
    if (b.dataset.mbe) return fiche(b.dataset.mbe);
    const n = b.dataset.mb;
    if (P.actifs.has(n)) P.actifs.delete(n);
    else { if (P.membres[n].photo && toutesRefs().length >= MAX_REFS) return msg(TROP); P.actifs.add(n); msg(P.membres[n].photo ? '' : n + ' n\'a pas encore de photo de référence : ✎ pour en mettre une'); }
    majMembres(); majRefs();
  };
  // la fiche d'un membre (partagée avec tout le groupe)
  async function fiche(n) {
    const m = { ...P.membres[n] }; let nouvelle = null;
    const v = document.createElement('div'); v.className = 'voile';
    const dessiner = () => {
      v.innerHTML = `<div class="stopbox pt-fiche"><span class="dymo" style="align-self:center">${esc(n)}</span>
        <div class="pt-fiche-c"><div class="pt-ref pt-ref-grande" data-c="photo" title="Changer la photo">${nouvelle ? `<img src="${esc(nouvelle.apercu || '')}" alt="">` : m.photo ? `<img ${BK.img.src(m.photo)} alt="">` : '<span class="pt-plus">＋<small>Photo</small></span>'}</div>
          <div class="pt-fiche-ch">
            <label class="lb">Taille</label><input class="fld" data-k="taille" value="${esc(m.taille)}" placeholder="ex. 1,85 m">
            <label class="lb">Vêtements</label><input class="fld" data-k="vetements" value="${esc(m.vetements)}" placeholder="ex. veste en daim marron, chemise à grand col, pattes d'eph">
            <label class="lb">Attributs</label><textarea class="fld" data-k="attributs" rows="2" placeholder="ex. cheveux longs bouclés, moustache, lunettes rondes, basse Rickenbacker">${esc(m.attributs)}</textarea></div></div>
        <span class="nt">Tout le groupe voit cette fiche. En anglais ou en français, les deux marchent.</span>
        <div class="stopbox-btns"><button class="btn pri" data-c="ok">Garder</button><button class="btn" data-c="x">Annuler</button></div></div>`;
      BK.img.remplir && BK.img.remplir(v);
    };
    dessiner(); document.body.appendChild(v);
    v.oninput = e => { const k = e.target.dataset.k; if (k) m[k] = e.target.value; };
    v.onclick = async e => { const b = e.target.closest('[data-c]'); if (!b) return;
      if (b.dataset.c === 'x') return v.remove();
      if (b.dataset.c === 'photo') { const l = await choisirPhoto({ titre: 'Photo de ' + n, plusieurs: false }); if (l[0]) { nouvelle = l[0]; dessiner(); } return; }
      if (b.dataset.c === 'ok') { b.disabled = true; b.innerHTML = '<span class="spin"></span>Envoi…';
        try { if (nouvelle) m.photo = await versDrive(nouvelle); P.membres[n] = m; await garderMembres(); v.remove(); majMembres(); majRefs(); msg('Fiche de ' + n + ' gardée ✓'); }
        catch (er) { b.disabled = false; b.textContent = 'Garder'; msg('⚠ ' + (er.message || er)); } } };
  }

  // ---------- les boutons d'ambiance ----------
  const majPresets = () => {
    $('#ptPresets', page).innerHTML = P.presets.map(p => `<button class="btn xs${P.presetsOn.has(p.id) ? ' on' : ''}" data-pr="${esc(p.id)}" title="${esc(p.texte)} — clic droit : modifier">${esc(p.nom)}</button>`).join('')
      + '<button class="btn xs pt-plus-b" data-prn="1" title="Créer un bouton">＋</button>';
  };
  $('#ptPresets', page).onclick = e => { const b = e.target.closest('[data-pr],[data-prn]'); if (!b) return;
    if (b.dataset.prn) return editerPreset(null);
    const id = b.dataset.pr; P.presetsOn.has(id) ? P.presetsOn.delete(id) : P.presetsOn.add(id); majPresets(); };
  $('#ptPresets', page).oncontextmenu = e => { const b = e.target.closest('[data-pr]'); if (!b) return; e.preventDefault(); editerPreset(P.presets.find(p => p.id === b.dataset.pr)); };
  function editerPreset(p) {
    const neuf = !p; p = p || { id: 'p' + Date.now().toString(36), nom: '', texte: '' };
    const v = document.createElement('div'); v.className = 'voile';
    v.innerHTML = `<div class="stopbox pt-fiche"><span class="dymo" style="align-self:center">${neuf ? 'Nouveau bouton' : 'Modifier le bouton'}</span>
      <label class="lb">Nom du bouton</label><input class="fld" data-k="nom" value="${esc(p.nom)}" placeholder="ex. Plage au coucher du soleil">
      <label class="lb">Ce qu'il ajoute à l'idée</label><textarea class="fld" data-k="texte" rows="3" placeholder="ex. Sur une plage au coucher du soleil, lumière chaude, vagues derrière eux">${esc(p.texte)}</textarea>
      <span class="nt">Tout le groupe voit ce bouton.</span>
      <div class="stopbox-btns"><button class="btn pri" data-c="ok">Garder</button>${neuf ? '' : '<button class="btn" data-c="del">🗑 Retirer</button>'}<button class="btn" data-c="x">Annuler</button></div></div>`;
    document.body.appendChild(v);
    v.onclick = async e => { const b = e.target.closest('[data-c]'); if (!b) return;
      if (b.dataset.c === 'x') return v.remove();
      if (b.dataset.c === 'del') { P.presets = P.presets.filter(x => x.id !== p.id); P.presetsOn.delete(p.id); }
      if (b.dataset.c === 'ok') { const nom = $('[data-k="nom"]', v).value.trim(), texte = $('[data-k="texte"]', v).value.trim(); if (!nom || !texte) return msg('Donne un nom et un texte au bouton');
        Object.assign(p, { nom, texte }); if (neuf) P.presets.push(p); }
      v.remove(); majPresets(); await garderPresets(); };
  }

  // ---------- la boîte des références ----------
  const majRefs = () => {
    const l = toutesRefs(), nm = refsMembres().length;
    $('#ptRefs', page).innerHTML = l.map((r, i) => `<span class="pt-ref" title="${esc(r.nom)}">${r.apercu ? `<img src="${esc(r.apercu)}" alt="">` : r.ref ? `<img ${BK.img.src(r.ref)} alt="">` : `<span class="nt">${esc(r.nom)}</span>`}
        <small class="pt-ref-n">${esc(r.membre || 'Lieu / objet')}</small>${r.membre ? '' : `<button class="btn xs" data-x="${i - nm}" title="Retirer">✕</button>`}</span>`).join('')
      + `<button class="pt-ref pt-ref-plus" id="ptRefPlus" title="Ajouter un lieu, un objet… (PC ou Médias)"><span class="pt-plus">＋</span></button>`;
    BK.img.remplir && BK.img.remplir($('#ptRefs', page));
  };
  $('#ptRefs', page).onclick = async e => {
    const x = e.target.closest('[data-x]'); if (x) { P.manuels.splice(+x.dataset.x, 1); return majRefs(); }
    if (!e.target.closest('#ptRefPlus')) return;
    if (toutesRefs().length >= MAX_REFS) return msg(TROP);
    const l = await choisirPhoto({ titre: 'Ajouter une référence' });
    for (const r of l) { if (toutesRefs().length >= MAX_REFS) { msg(TROP); break; } P.manuels.push(r); }
    majRefs();
  };

  // ---------- installation (1re fois) ----------
  const montrerInstall = on => { $('#ptInstall', page).classList.toggle('hidden', !on); $('#ptGo', page).disabled = on; };
  const verifierInstalle = async () => {
    if (BK.reglage('painture.pret', false)) { montrerInstall(false); return; }
    montrerInstall(true);
    try { const p = await inv('pain_etat'); if (p) $('#ptInstN', page).textContent = '✓ Déjà installé sur ce PC.'; } catch (e) {}
  };
  $('#ptInst', page).onclick = async e => {
    const b = e.target.closest('button'); b.disabled = true; b.innerHTML = '<span class="spin"></span>Installation…';
    try { await inv('pain_installer'); $('#ptInstN', page).textContent = '✓ Installé. Passe à l\'étape 2.'; b.textContent = '✓ Installé'; }
    catch (er) { b.disabled = false; b.textContent = '⬇ Réessayer'; $('#ptInstN', page).textContent = '⚠ ' + (er.message || er); }
  };
  $('#ptCo', page).onclick = async () => {
    try { if (!(await inv('pain_etat'))) return ($('#ptInstN', page).textContent = '⚠ Fais d\'abord l\'étape 1.'); await inv('pain_connecter'); }
    catch (er) { $('#ptVerifN', page).textContent = '⚠ ' + (er.message || er); }
  };
  $('#ptVerif', page).onclick = async e => {
    const b = e.target.closest('button'), n = $('#ptVerifN', page); b.disabled = true; b.innerHTML = '<span class="spin"></span>Essai…';
    try {
      const d = await inv('pain_dossier');
      const r = JSON.parse(await inv('pain_generer', { dossier: d, demande: 'Reply with the single word OK. Do not use any tool.' }));
      if (r.status === 'SUCCESS') { BK.regler('painture.pret', true); n.textContent = '✓ Tout marche !'; montrerInstall(false); msg('Prêt : décris ton image.'); }
      else n.textContent = '⚠ Pas encore connecté (refais l\'étape 2). ' + String(r.reponse || r.erreur || r.brut || '').slice(0, 200);
    } catch (er) { n.textContent = '⚠ ' + (er.message || er); }
    b.disabled = false; b.textContent = '✓ Vérifier';
  };

  // ---------- la barre de progression : selon le temps moyen des dernières images (elle apprend toute seule) ----------
  const moyenne = () => { const l = BK.reglage('painture.durees', []); return l.length ? l.reduce((a, b) => a + b, 0) / l.length : 60; };
  const noterDuree = s => { const l = BK.reglage('painture.durees', []); l.push(s); BK.regler('painture.durees', l.slice(-6)); };
  let minuterie = null;
  const barre = (on, t0) => {
    const z = $('#ptBarre', page); z.classList.toggle('hidden', !on); clearInterval(minuterie); if (!on) return;
    const moy = moyenne();
    const maj = () => { const s = (Date.now() - t0) / 1000, pc = Math.min(95, s / moy * 95), reste = Math.max(0, Math.round(moy - s));
      z.querySelector('i').style.width = pc + '%';
      z.querySelector('span').textContent = `Fabrication… ${Math.round(pc)} %` + (reste ? ` · ~${reste} s restantes` : ' · encore un instant'); };
    maj(); minuterie = setInterval(maj, 500);
  };

  // ---------- les images ----------
  const majImages = () => {
    const z = $('#ptImages', page);
    if (!P.images.length) { z.innerHTML = '<span class="nt">Les images fabriquées arrivent ici (environ 1 minute chacune).</span>'; return; }
    z.innerHTML = P.images.map((im, i) => `<div class="pt-img"><img src="${esc(im.url)}" alt="" data-voir="${i}" title="Cliquer pour voir en grand">
        <span class="nt pt-idee">${esc(im.resume)}</span>
        <div class="chips">${im.garde ? '<span class="nt">☁ Gardée</span>' : `<button class="btn xs pri" data-g="${i}">☁ Garder</button>`}<button class="btn xs" data-r="${i}">↻ Refaire</button><button class="btn xs" data-j="${i}">🗑 Jeter</button></div></div>`).join('');
  };
  $('#ptImages', page).onclick = async e => {
    const b = e.target.closest('[data-g],[data-r],[data-j],[data-voir]'); if (!b) return;
    if (b.dataset.voir != null) { const im = P.images[+b.dataset.voir]; try { BK.T.opener.openPath(im.chemin); } catch (er) {} return; }
    if (b.dataset.j != null) { const im = P.images.splice(+b.dataset.j, 1)[0]; if (im) URL.revokeObjectURL(im.url); return majImages(); }
    if (b.dataset.r != null) { const im = P.images[+b.dataset.r]; return generer(im.texte, im.refs, im.resume); }
    if (b.dataset.g != null) {
      const im = P.images[+b.dataset.g]; b.disabled = true; b.innerHTML = '<span class="spin"></span>Envoi…';
      try {
        if (!BK.drive.relie()) throw new Error('relie d\'abord le Drive (Réglages › Drive)');
        await BK.drive.envoyerBlob(new Blob([im.octets], { type: im.type }), im.nom, await dossierPainTure());
        im.garde = true; BK.dossiers.oublier && BK.dossiers.oublier(); msg('☁ Gardée dans Médias › Photos/Vidéos › Pain Ture'); majImages();
      } catch (er) { b.disabled = false; b.textContent = '☁ Garder'; msg('⚠ ' + (er.message || er)); }
    }
  };

  // texte = la demande déjà prête (Refaire la renvoie telle quelle), refs = les photos à poser dans le dossier de travail
  async function generer(texte, refs, resume) {
    if (P.enCours) return msg('Une image est déjà en cours : attends-la.');
    P.enCours = true; $('#ptGo', page).disabled = true; msg('');
    const t0 = Date.now(); barre(true, t0);
    try {
      const d = await inv('pain_dossier');
      for (let i = 0; i < refs.length; i++) await BK.fichier.ecrireOctets(BK.chemin(d, 'ref' + (i + 1) + '.jpg'), await octetsDe(refs[i]));
      const r = JSON.parse(await inv('pain_generer', { dossier: d, demande: texte }));
      if (!r.images || !r.images.length) {
        const t = String(r.reponse || r.erreur || r.brut || '').toLowerCase();
        if (/quota|rate.?limit|exhaust|429/.test(t)) throw new Error('le quota gratuit est épuisé pour le moment : réessaie plus tard (quelques heures, parfois quelques jours).');
        if (/eligib|sign.?in|login|auth/.test(t)) { BK.regler('painture.pret', false); verifierInstalle(); throw new Error('le compte n\'est plus connecté : refais « Se connecter ».'); }
        throw new Error('aucune image reçue. ' + String(r.reponse || r.erreur || r.brut || '').slice(0, 200));
      }
      for (const chemin of r.images) {
        const octets = await BK.fichier.lireOctets(chemin), type = /\.png$/i.test(chemin) ? 'image/png' : /\.webp$/i.test(chemin) ? 'image/webp' : 'image/jpeg';
        const nom = 'PainTure_' + BK.auj() + '_' + new Date().toTimeString().slice(0, 8).replace(/:/g, '') + chemin.slice(chemin.lastIndexOf('.'));
        P.images.unshift({ chemin, octets, type, nom, url: URL.createObjectURL(new Blob([octets], { type })), texte, refs: [...refs], resume });
      }
      const s = Math.round((Date.now() - t0) / 1000); noterDuree(s); msg('✓ Prête en ' + s + ' s');
    } catch (er) { msg('⚠ ' + (er.message || er)); }
    barre(false); P.enCours = false; $('#ptGo', page).disabled = false; majImages();
  }
  $('#ptGo', page).onclick = () => {
    const idee = $('#ptIdee', page).value.trim();
    if (!idee && !P.actifs.size && !P.presetsOn.size) return msg('Choisis au moins un membre, une ambiance, ou décris ton image.');
    const refs = toutesRefs().slice(0, MAX_REFS);
    const resume = [[...P.actifs].join(', '), P.presets.filter(p => P.presetsOn.has(p.id)).map(p => p.nom).join(', '), idee].filter(Boolean).join(' · ');
    generer(demande(idee, P.format, refs, $('#ptSansTexte', page).checked), refs, resume);
  };

  verifierInstalle(); majImages();
  lireFiches().then(() => { majMembres(); majPresets(); majRefs(); });
});
})();
