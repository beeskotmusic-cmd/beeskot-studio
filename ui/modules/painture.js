// =====================================================================
// PAIN-TURE — fabriquer une image à partir d'une idée (pour dépanner un reel, un moodboard…).
// Elle passe par « agy », l'outil gratuit de Google, connecté au compte BEESKOT.
//
//   idée + format (+ jusqu'à 3 photos de Médias)
//        │  le moteur (lib.rs) lance agy caché, en priorité basse : le PC n'est jamais bloqué
//        ▼
//   image → aperçu → Garder (Drive › Photos/Vidéos › Pain-ture) · Refaire · Jeter
//
// PC seulement (agy ne tourne pas sur téléphone). Une image à la fois.
// La 1re fois sur un PC : ① Installer ② Se connecter ③ Vérifier — puis plus jamais.
// =====================================================================
(() => {
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const FORMATS = { '9:16': 'Vertical 9:16 (reel)', '4:5': 'Portrait 4:5 (post)', '1:1': 'Carré 1:1', '16:9': 'Horizontal 16:9' };
const MAX_REFS = 3;                                       // la limite de l'outil Google
const P = { format: '9:16', refs: [], images: [], enCours: false, derniere: null };
const inv = (cmd, a) => BK.T.core.invoke(cmd, a);

// la demande envoyée à l'outil (en anglais : il comprend mieux), avec les garde-fous
function demande(idee, format, nbRefs, sansTexte) {
  return [
    'Generate exactly ONE image with your image generation tool.',
    `Aspect ratio: ${format}.`,
    `Description (may be in French): ${idee}`,
    nbRefs ? `Reference images in the current folder: ${Array.from({ length: nbRefs }, (_, i) => 'ref' + (i + 1) + '.jpg').join(', ')}. Use them as references (for people: keep the same faces, hair and outfits, recognizable).` : '',
    sansTexte ? 'No visible text, letters, signs, brand names or logos in the image.' : '',
    'Rules: do not run any shell command, do not create, copy or move any file yourself. Only generate the image, then answer with one short sentence.',
  ].filter(Boolean).join('\n');
}

// une photo de Médias (Drive, Discord ou ce PC) → ses octets
async function octetsDe(x) {
  if (x.fichier) return new Uint8Array(await x.fichier.arrayBuffer());
  if (x.f) return BK.drive.telecharger(x.f.id);
  if (x.dc && x.dc.url) return new Uint8Array(await (await BK.ia.fetch(x.dc.url)).arrayBuffer());
  throw new Error('photo illisible');
}

BK.module('painture', function (page) {
  $('.sub', page).textContent = 'Une idée → une image (compte BEESKOT, gratuit)';
  const g = $('.grid', page);
  if (!BK.estExe || window.BK_MOBILE) { g.innerHTML = '<div class="pane vit"><span class="nt">Pain-ture marche seulement dans le logiciel installé sur un PC.</span></div>'; return; }

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
          <span class="lb">Ton idée</span>
          <textarea class="fld" id="ptIdee" rows="4" placeholder="Ex. : les trois membres sur un toit de Montréal la nuit, néons rouges, grain de pellicule années 70"></textarea>
          <span class="lb" style="margin-top:8px">Format</span>
          <div class="seg" id="ptFmt">${Object.entries(FORMATS).map(([k, n]) => `<button data-f="${k}" title="${esc(n)}">${k}</button>`).join('')}</div>
          <div class="ligne-titre" style="margin-top:8px"><span class="lb">Photos de référence (option, ${MAX_REFS} max)</span>
            <button class="btn xs" id="ptRefB" style="margin-left:auto">🖼 Choisir dans Médias</button></div>
          <div class="pt-refs" id="ptRefs"></div>
          <label class="nt pt-case"><input type="checkbox" id="ptSansTexte" checked> Pas de texte ni de logo inventé</label>
          <div class="chips" style="margin-top:8px"><button class="btn pri" id="ptGo">✨ Générer</button><span class="nt" id="ptMsg"></span></div>
        </div>
      </section>
      <section class="pane vit">
        <div class="box grow"><span class="lb">Images</span>
          <div class="pt-images" id="ptImages"><span class="nt">Les images fabriquées arrivent ici (environ 1 minute chacune).</span></div></div>
      </section>
    </div>`;

  const msg = t => { $('#ptMsg', page).textContent = t || ''; };
  const majFmt = () => $$('#ptFmt button', page).forEach(b => b.classList.toggle('on', b.dataset.f === P.format));
  $('#ptFmt', page).onclick = e => { const b = e.target.closest('[data-f]'); if (b) { P.format = b.dataset.f; BK.regler('painture.format', P.format); majFmt(); } };
  P.format = BK.reglage('painture.format', '9:16'); majFmt();

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
      else n.textContent = '⚠ Pas encore connecté (refais l\'étape 2). ' + esc(r.reponse || r.erreur || r.brut || '').slice(0, 200);
    } catch (er) { n.textContent = '⚠ ' + (er.message || er); }
    b.disabled = false; b.textContent = '✓ Vérifier';
  };

  // ---------- photos de référence ----------
  const majRefs = () => {
    $('#ptRefs', page).innerHTML = P.refs.map((r, i) => `<span class="pt-ref" title="${esc(r.nom)}">${r.apercu ? `<img src="${esc(r.apercu)}" alt="">` : `<span class="nt">${esc(r.nom)}</span>`}<button class="btn xs" data-x="${i}" title="Retirer">✕</button></span>`).join('');
    $('#ptRefB', page).disabled = P.refs.length >= MAX_REFS;
  };
  $('#ptRefs', page).onclick = e => { const b = e.target.closest('[data-x]'); if (b) { P.refs.splice(+b.dataset.x, 1); majRefs(); } };
  $('#ptRefB', page).onclick = async () => {
    const l = await BK.choisirDansMedias({ titre: 'Photos de référence (' + MAX_REFS + ' max)', bouton: 'Prendre', type: 'image' });
    for (const x of l || []) { if (P.refs.length >= MAX_REFS) break; if (x.retirer) continue;
      if (x.fichier && !x.apercu) x.apercu = URL.createObjectURL(x.fichier);
      P.refs.push(x); }
    majRefs();
  };

  // ---------- les images ----------
  const majImages = () => {
    const z = $('#ptImages', page);
    if (!P.images.length && !P.enCours) { z.innerHTML = '<span class="nt">Les images fabriquées arrivent ici (environ 1 minute chacune).</span>'; return; }
    z.innerHTML = (P.enCours ? `<div class="pt-img pt-attente"><span class="spin"></span><span class="nt" id="ptChrono">Fabrication…</span></div>` : '')
      + P.images.map((im, i) => `<div class="pt-img"><img src="${esc(im.url)}" alt="" data-voir="${i}" title="Cliquer pour voir en grand">
        <span class="nt pt-idee">${esc(im.idee)}</span>
        <div class="chips">${im.garde ? '<span class="nt">☁ Gardée</span>' : `<button class="btn xs pri" data-g="${i}">☁ Garder</button>`}<button class="btn xs" data-r="${i}">↻ Refaire</button><button class="btn xs" data-j="${i}">🗑 Jeter</button></div></div>`).join('');
  };
  $('#ptImages', page).onclick = async e => {
    const b = e.target.closest('[data-g],[data-r],[data-j],[data-voir]'); if (!b) return;
    if (b.dataset.voir != null) { const im = P.images[+b.dataset.voir]; try { BK.T.opener.openPath(im.chemin); } catch (er) {} return; }
    if (b.dataset.j != null) { const im = P.images.splice(+b.dataset.j, 1)[0]; if (im) URL.revokeObjectURL(im.url); return majImages(); }
    if (b.dataset.r != null) { const im = P.images[+b.dataset.r]; return generer(im.idee, im.format, im.refs, im.sansTexte); }
    if (b.dataset.g != null) {
      const im = P.images[+b.dataset.g]; b.disabled = true; b.innerHTML = '<span class="spin"></span>Envoi…';
      try {
        if (!BK.drive.relie()) throw new Error('relie d\'abord le Drive (Réglages › Drive)');
        await BK.dossiers.assurer();
        const base = await BK.dossiers.get('photovideo'); if (!base) throw new Error('dossier Photos/Vidéos introuvable (Réglages › Vos dossiers du Drive)');
        const dos = await BK.drive.dossier('Pain-ture', base.id);
        await BK.drive.envoyerBlob(new Blob([im.octets], { type: im.type }), im.nom, dos);
        im.garde = true; BK.dossiers.oublier && BK.dossiers.oublier(); msg('☁ Gardée dans Médias › Photos/Vidéos › Pain-ture'); majImages();
      } catch (er) { b.disabled = false; b.textContent = '☁ Garder'; msg('⚠ ' + (er.message || er)); }
    }
  };

  async function generer(idee, format, refs, sansTexte) {
    if (P.enCours) return msg('Une image est déjà en cours : attends-la.');
    if (!idee) return msg('Décris d\'abord ton image.');
    P.enCours = true; $('#ptGo', page).disabled = true; majImages(); msg('');
    const t0 = Date.now(), chrono = setInterval(() => { const c = $('#ptChrono', page); if (c) c.textContent = 'Fabrication… ' + Math.round((Date.now() - t0) / 1000) + ' s'; }, 1000);
    try {
      const d = await inv('pain_dossier');
      for (let i = 0; i < refs.length; i++) await BK.fichier.ecrireOctets(BK.chemin(d, 'ref' + (i + 1) + '.jpg'), await octetsDe(refs[i]));
      const r = JSON.parse(await inv('pain_generer', { dossier: d, demande: demande(idee, format, refs.length, sansTexte) }));
      if (!r.images || !r.images.length) {
        const t = (r.reponse || r.erreur || r.brut || '').toLowerCase();
        if (/quota|rate.?limit|exhaust|429/.test(t)) throw new Error('le quota gratuit est épuisé pour le moment : réessaie plus tard (quelques heures, parfois quelques jours).');
        if (/eligib|sign.?in|login|auth/.test(t)) { BK.regler('painture.pret', false); verifierInstalle(); throw new Error('le compte n\'est plus connecté : refais « Se connecter ».'); }
        throw new Error('aucune image reçue. ' + (r.reponse || r.erreur || r.brut || '').slice(0, 200));
      }
      for (const chemin of r.images) {
        const octets = await BK.fichier.lireOctets(chemin), type = /\.png$/i.test(chemin) ? 'image/png' : /\.webp$/i.test(chemin) ? 'image/webp' : 'image/jpeg';
        const nom = 'Pain-ture_' + BK.auj() + '_' + new Date().toTimeString().slice(0, 8).replace(/:/g, '') + chemin.slice(chemin.lastIndexOf('.'));
        P.images.unshift({ chemin, octets, type, nom, url: URL.createObjectURL(new Blob([octets], { type })), idee, format, refs: [...refs], sansTexte });
      }
      msg('✓ Prête en ' + Math.round((Date.now() - t0) / 1000) + ' s');
    } catch (er) { msg('⚠ ' + (er.message || er)); }
    clearInterval(chrono); P.enCours = false; $('#ptGo', page).disabled = false; majImages();
  }
  $('#ptGo', page).onclick = () => generer($('#ptIdee', page).value.trim(), P.format, [...P.refs], $('#ptSansTexte', page).checked);

  verifierInstalle(); majRefs(); majImages();
});
})();
