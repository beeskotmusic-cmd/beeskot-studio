// =====================================================================
// PRÉPA MIXAGE — en 5 étapes, sur le projet ouvert dans Ableton :
//   Ableton   (rechercher, installer le pont, vérifier le lien)
//   Renommer  (DRMS_ / PERC_ / VOX_ / INSTR_ + couleurs, après ton OK)
//   Trier     (automatique si Ableton le permet, sinon guidé pas à pas)
//   Geler     (automatique si Ableton le permet, sinon guidé + vérifié)
//   Zip       (dossier du projet → zip daté ; envoi Drive avec la 0.3.0)
// Rien n'est jamais supprimé. Le logiciel ne prend jamais la souris.
// =====================================================================
(() => {
const GROUPES = {
  DRMS:  { nom: 'Batterie',     couleur: 0xE0452B, mots: /kick|snare|caisse|hat|hh|tom|over|oh\b|cymb|crash|ride|drum|batt|addictive|bd\b|sd\b/i },
  PERC:  { nom: 'Percussions',  couleur: 0xE8A33A, mots: /perc|shak|conga|bongo|tamb|clap|cowbell|guiro|cabasa|djemb|timbal/i },
  VOX:   { nom: 'Voix',         couleur: 0x3A8FB7, mots: /vox|voix|vocal|chant|ch(oe|œ)ur|lead|bv\b|back|adlib|harmon|rap/i },
  INSTR: { nom: 'Instruments',  couleur: 0x6E9A3E, mots: /./ },
};
const ORDRE = ['DRMS', 'PERC', 'VOX', 'INSTR'];
const CARTES = [[1, '◎', 'Ableton'], [2, '✎', 'Renommer'], [3, '⇅', 'Trier'], [4, '❄', 'Geler'], [5, '▤', 'Zip + envoi'], [6, '⌁', 'Plugins manquants']];
const M = { etape: 1, pistes: [], choix: {}, tempo: 0, morceau: '', modele: BK.reglage('mix.modele', '{PREFIXE}_{MORCEAU}_{PISTE}_{BPM}'),
  couleurs: true, rassemble: false, cap: null, suivi: null };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const propre = s => String(s || '').trim().replace(/\s+/g, '-').replace(/[\\/:*?"<>|]/g, '');
const groupeDe = p => (p.nom.match(/^(DRMS|PERC|VOX|INSTR)_/) || [])[1] || M.choix[p.i] || '';

function deviner(p) {
  if (p.dossier) return '';
  const deja = (p.nom.match(/^(DRMS|PERC|VOX|INSTR)_/) || [])[1]; if (deja) return deja;
  for (const k of ['DRMS', 'PERC', 'VOX']) if (GROUPES[k].mots.test(p.nom + ' ' + (p.groupe || ''))) return k;
  return 'INSTR';
}
function base(nom) {
  let b = String(nom).replace(/^(DRMS|PERC|VOX|INSTR)_/i, '');
  if (M.morceau) b = b.replace(new RegExp('_?' + propre(M.morceau).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '_?', 'i'), '_');
  return b.replace(/_?\d+(\.\d+)?BPM_?/i, '_').replace(/^_+|_+$/g, '') || nom;
}
const bpm = () => (Math.round(M.tempo * 10) / 10).toString().replace(/\.0$/, '') + 'BPM';
function nouveauNom(p) {
  const g = M.choix[p.i]; if (!g) return p.nom;
  return M.modele.replace('{PREFIXE}', g).replace('{MORCEAU}', propre(M.morceau) || 'MORCEAU').replace('{PISTE}', propre(base(p.nom))).replace('{BPM}', bpm())
    .replace(/__+/g, '_').replace(/^_|_$/g, '');
}
// l'ordre idéal : batterie, percussions, voix, instruments (dans chaque groupe, l'ordre actuel est gardé)
function ordreIdeal(pistes) {
  const l = pistes.filter(p => !p.dossier);
  return [...l].sort((a, b) => (ORDRE.indexOf(groupeDe(a)) + 9) % 9 - (ORDRE.indexOf(groupeDe(b)) + 9) % 9 || a.i - b.i);
}

BK.module('mixprep', function (page) {
  setTimeout(() => { const z = document.getElementById('mpSauv'); if (z) BK.sauvegardes.case(z); }, 0);
  // les plugins manquants du projet ouvert, PC par PC (relu à chaque ouverture de l'onglet)
  BK.surOuvrir = BK.surOuvrir || {}; const avantOuv = BK.surOuvrir.mixprep;
  BK.surOuvrir.mixprep = () => { avantOuv && avantOuv(); if (M.etape === 6) rendre(); majCartes(); };
  $('.sub', page).textContent = 'Préparer le projet Ableton pour l\'envoyer au mixeur';
  $('.hdr .right', page).innerHTML = `<div><span class="eng" style="font-size:9px">Ableton</span><span class="vfd" id="mpEtatH">—</span></div>
    <div><span class="eng" style="font-size:9px">Tempo</span><span class="vfd" id="mpTempoH">—</span></div>`;
  $('.grid', page).innerHTML = `
    <div class="cols">
      <section class="pane vit mp-vit"><div class="mp-cartes" id="mpCartes">${CARTES.map(([e, ic, nom]) => `<button class="mp-carte" data-e="${e}"><span class="mp-c-ic">${ic}</span><b>${nom}</b><span class="nt mp-c-et" id="mpEt${e}">—</span></button>`).join('')}</div>
        <div class="mp-corps" id="mpVit"></div></section>
      <section class="pane reg"><span class="ptitle">Réglages</span>
        <div class="box"><span class="lb">Morceau</span>
          <input class="fld" id="mpMorceau" list="mpListe" style="margin-top:8px" placeholder="nom du morceau"><datalist id="mpListe"></datalist></div>
        <div class="box"><span class="lb">Modèle de nom</span>
          <input class="fld" id="mpModele" style="margin-top:8px" value="${esc(M.modele)}">
          <span class="nt">Mots magiques : {PREFIXE} {MORCEAU} {PISTE} {BPM}</span>
          <div class="chips" style="margin-top:8px"><button class="chip on" id="mpCoul">Couleurs par groupe</button></div></div>
        <div class="box" id="mpSauv"></div>
        <div class="box"><span class="lb">Clic</span>
          <div class="chips" style="margin-top:8px"><button class="chip" id="mpClic" disabled title="Arrive bientôt">＋ Ajouter un clic au projet</button></div>
          <span class="nt">Arrive bientôt.</span></div>
        <div class="box"><span class="lb">Groupes</span><div class="surv">${ORDRE.map(k => `<div class="surv-l"><i class="pastille" style="background:#${GROUPES[k].couleur.toString(16).padStart(6, '0')}"></i><span class="nt" style="margin:0"><b>${k}_</b> ${GROUPES[k].nom}</span></div>`).join('')}</div></div>
      </section>
    </div>
    <div class="pane abar"><span class="vfd" id="mpMsg">PRÊT</span></div>`;
  const msg = t => $('#mpMsg').textContent = String(t).toUpperCase();
  const vit = $('#mpVit');

  document.addEventListener('ableton', e => { $('#mpEtatH').textContent = e.detail ? 'RELIÉ' : 'NON RELIÉ'; if (M.etape === 1) rendre(); });
  BK.db.liste('morceaux').then(l => $('#mpListe').innerHTML = l.map(m => `<option value="${esc(m.nom)}">`).join(''));

  async function lire(discret) {
    const r = await BK.ableton.req({ cmd: 'pistes' });
    const avant = M.choix; M.pistes = r.pistes; M.tempo = r.tempo; M.choix = {};
    // le tempo lu dans Ableton va dans la fiche du morceau (sauf si vous l'avez écrit vous-même)
    if (r.tempo && M.morceau) { try { const ms = await BK.db.liste('morceaux'), m = BK.inv.trouverMorceau(M.morceau, ms);
      if (m && m.bpmSource !== 'nous' && m.bpmSource !== 'discord') { const t = String(Math.round(r.tempo * 100) / 100); if (m.bpm !== t || m.bpmSource !== 'ableton') { m.bpm = t; m.bpmSource = 'ableton'; await BK.db.ecrire('morceaux', m, { sansAnnuler: true }); } } } catch (e) {} }
    for (const p of M.pistes) M.choix[p.i] = avant[p.i] !== undefined && M.pistes.length === Object.keys(avant).length ? avant[p.i] : deviner(p);
    $('#mpTempoH').textContent = bpm(); discret || msg(`${r.pistes.length} pistes lues`);
  }
  async function detecter() { try { M.cap = await BK.ableton.req({ cmd: 'capacites' }); } catch (e) { M.cap = { deplacer: [], geler: [] }; } }
  function suivre(on) {                                         // relire Ableton toutes les 2 s (étapes 3 et 4)
    clearInterval(M.suivi); M.suivi = null;
    if (on) M.suivi = setInterval(async () => { if (page.classList.contains('hidden')) return; try { await lire(true); rendre(); } catch (e) {} }, 2000);
  }

  // ---------- Ableton ----------
  async function etape1() {
    const lignes = [
      { id: 'exe',   txt: 'Logiciel installé (pas l\'aperçu)', ok: BK.estExe },
      { id: 'live',  txt: 'Ableton Live trouvé sur ce PC', ok: null },
      { id: 'ul',    txt: 'Dossier « User Library » trouvé', ok: null },
      { id: 'pont',  txt: 'Pont BEESKOT installé et à jour', ok: null, act: 'Installer le pont' },
      { id: 'relie', txt: 'Ableton ouvert et relié', ok: BK.ableton.relie, act: 'Comment faire ?' },
    ];
    if (BK.estExe) {
      lignes[1].ok = await BK.fichier.existe('C:\\ProgramData\\Ableton');
      const ul = await BK.ableton.dossierUserLibrary(true); lignes[2].ok = !!ul;
      lignes[3].ok = !!ul && await BK.ableton.pontAJour(ul);
    }
    vit.innerHTML = `<div class="box"><div class="ligne-titre"><span class="lb">Vérification</span><button class="btn sm pri" id="mpRech" style="margin-left:auto">Rechercher Ableton</button></div>
        <div class="surv">${lignes.map(l => `<div class="surv-l"><span class="led ${l.ok ? 'grn' : l.ok === false ? 'red' : ''}"></span><span class="nt" style="margin:0;flex:1;font-size:14px">${l.txt}</span>
          ${!l.ok && l.act && BK.estExe ? `<button class="btn xs" data-a="${l.id}">${l.act}</button>` : ''}</div>`).join('')}</div></div>
      <div class="box"><span class="lb">Ce que ta version d'Ableton permet</span>
        <span class="nt">${!BK.ableton.relie ? 'Relie d\'abord Ableton pour le savoir.' : !M.cap ? 'Détection…' :
          `Live ${esc(M.cap.live || '?')} · Trier automatiquement : <b>${M.cap.deplacer && M.cap.deplacer.length ? 'oui ✅' : 'non → tri guidé'}</b> · Geler automatiquement : <b>${M.cap.geler && M.cap.geler.length ? 'oui ✅' : 'non → gel guidé'}</b>`}</span></div>`;
    $('#mpRech').onclick = () => { msg('Recherche…'); etape1().then(() => msg('Vérification terminée')); };
    $$('[data-a]', vit).forEach(b => b.onclick = async () => {
      if (b.dataset.a === 'pont') { try { const d = await BK.ableton.installerPont(); if (d) BK.ableton.fenetre(d); etape1(); } catch (e) { msg('Installation impossible'); } }
      if (b.dataset.a === 'relie') BK.ableton.fenetre();
    });
    if (BK.ableton.relie && !M.cap) { await detecter(); etape1(); }
  }

  // ---------- Renommer ----------
  function etape2() {
    vit.innerHTML = `<div class="box pick"><div><span class="lb">Pistes : avant → après</span><span class="nt" id="mpCompte">Ouvre ton projet dans Ableton, puis « Lire les pistes ».</span></div>
        <button class="btn sm" id="mpLire">Lire les pistes</button><button class="btn sm pri" id="mpAppliquer" ${M.pistes.length ? '' : 'disabled'}>Appliquer dans Ableton</button></div>
      <div class="box grow"><div class="mp-table" id="mpTable">${M.pistes.length ? table() : '<span class="nt">Aucune piste lue pour l\'instant.</span>'}</div></div>`;
    $('#mpLire').onclick = async () => { try { await lire(); etape2(); } catch (e) { msg(e.message); } };
    $('#mpAppliquer').onclick = async () => {
      if (!M.morceau.trim()) return msg('Indique d\'abord le nom du morceau (à droite)');
      const liste = M.pistes.filter(p => M.choix[p.i]).map(p => ({ i: p.i, ancien: p.nom, nom: nouveauNom(p), couleur: M.couleurs ? GROUPES[M.choix[p.i]].couleur : null }));
      try { const r = await BK.ableton.req({ cmd: 'appliquer', pistes: liste }); await lire(true); etape2(); msg(r.faits + ' pistes renommées (Ctrl+Z dans Ableton pour annuler)'); }
      catch (e) { msg(e.message); }
    };
    $$('.mp-g[data-i]', vit).forEach(s => s.onchange = () => { M.choix[+s.dataset.i] = s.value; etape2(); });
    if (M.pistes.length) $('#mpCompte').textContent = `${M.pistes.length} pistes · ${Object.values(M.choix).filter(Boolean).length} à renommer · tempo ${bpm()}`;
  }
  function table() {
    return `<div class="mp-l mp-tete"><span class="mp-n">#</span><span class="mp-av">Avant</span><span class="mp-g eng">Groupe</span><span class="mp-ap">Après</span><span class="mp-gel">❄</span></div>` +
      M.pistes.map(p => `<div class="mp-l${p.dossier ? ' dossier' : ''}">
        <span class="mp-n mono">${p.i + 1}</span><span class="mp-av" title="${esc(p.nom)}">${p.dossier ? '📁 ' : ''}${esc(p.nom)}</span>
        <select class="fld mp-g" data-i="${p.i}"><option value="">— ne pas toucher</option>${ORDRE.map(k => `<option value="${k}"${M.choix[p.i] === k ? ' selected' : ''}>${k} · ${GROUPES[k].nom}</option>`).join('')}</select>
        <span class="mp-ap mono${M.choix[p.i] ? '' : ' muet'}" title="${esc(nouveauNom(p))}">${M.choix[p.i] ? '<i class="pastille" style="background:#' + GROUPES[M.choix[p.i]].couleur.toString(16).padStart(6, '0') + '"></i>' : ''}${esc(nouveauNom(p))}</span>
        <span class="mp-gel">${p.gelee ? '❄' : p.gelable ? '·' : ''}</span></div>`).join('');
  }

  // ---------- Trier ----------
  function etape3() {
    const actuel = M.pistes.filter(p => !p.dossier), ideal = ordreIdeal(M.pistes);
    let k = 0; while (k < ideal.length && actuel[k] && actuel[k].i === ideal[k].i) k++;
    const fini = M.pistes.length && k >= ideal.length, auto = M.cap && M.cap.deplacer && M.cap.deplacer.length;
    const consigne = !M.pistes.length ? 'Lis d\'abord les pistes (étape « Renommer »).' : fini ? '✅ Les pistes sont dans le bon ordre.'
      : k === 0 ? `Glisse « <b>${esc(ideal[0].nom)}</b> » tout en haut.` : `Glisse « <b>${esc(ideal[k].nom)}</b> » juste sous « <b>${esc(ideal[k - 1].nom)}</b> ».`;
    vit.innerHTML = `<div class="box next"><div class="ligne-titre"><span class="lb">${auto ? 'Tri automatique' : 'Tri guidé'}</span>
        <span class="vfd" style="margin-left:auto">${Math.min(k, ideal.length)} / ${ideal.length} BIEN PLACÉES</span></div>
        <span class="nt mp-consigne">${consigne}</span>
        ${auto && !fini ? '<button class="btn pri" id="mpAuto" style="margin-top:10px">Trier automatiquement</button>' : ''}
        <span class="nt">Ordre : batterie, percussions, voix, instruments. Le logiciel voit tes changements tout seul (il relit Ableton toutes les 2 s).</span></div>
      <div class="box grow"><div class="mp-ordre">${ideal.map((p, j) => `<div class="mp-o${j < k ? ' ok' : j === k ? ' encours' : ''}"><span class="mp-n mono">${j + 1}</span>
        ${groupeDe(p) ? `<i class="pastille" style="background:#${(GROUPES[groupeDe(p)] || GROUPES.INSTR).couleur.toString(16).padStart(6, '0')}"></i>` : ''}<span>${esc(p.nom)}</span>${j < k ? '<span style="margin-left:auto">✓</span>' : ''}</div>`).join('')}</div></div>`;
    const b = $('#mpAuto'); if (b) b.onclick = async () => {
      try { for (let j = 0; j < ideal.length; j++) { await lire(true); const cur = M.pistes.findIndex(p => p.i === ideal[j].i); await BK.ableton.req({ cmd: 'deplacer', de: cur, vers: j }); } msg('Pistes triées'); }
      catch (e) { msg(e.message); } };
  }

  // ---------- Geler ----------
  function etape4() {
    const l = M.pistes.filter(p => p.gelable && !p.dossier), reste = l.filter(p => !p.gelee), auto = M.cap && M.cap.geler && M.cap.geler.length;
    vit.innerHTML = `<div class="box next"><div class="ligne-titre"><span class="lb">${auto ? 'Gel automatique' : 'Gel guidé'}</span>
        <span class="vfd" style="margin-left:auto">${l.length - reste.length} / ${l.length} GELÉES</span></div>
        <span class="nt mp-consigne">${!M.pistes.length ? 'Lis d\'abord les pistes (étape « Renommer »).' : !reste.length ? '✅ Toutes les pistes sont gelées.' : auto ? 'Clique pour geler les pistes restantes.' : 'Dans Ableton : sélectionne les pistes ci-dessous, clic droit › <b>Geler les pistes</b>. Je coche au fur et à mesure.'}</span>
        ${auto && reste.length ? '<button class="btn pri" id="mpGelAuto" style="margin-top:10px">Geler automatiquement</button>' : ''}</div>
      <div class="box grow"><div class="mp-ordre">${l.map(p => `<div class="mp-o${p.gelee ? ' ok' : ''}"><span>${p.gelee ? '❄' : '·'}</span><span>${esc(p.nom)}</span>${p.gelee ? '<span style="margin-left:auto">✓</span>' : ''}</div>`).join('')}</div></div>`;
    const b = $('#mpGelAuto'); if (b) b.onclick = async () => { try { for (const p of reste) await BK.ableton.req({ cmd: 'geler', i: p.i }); msg('Pistes gelées'); } catch (e) { msg(e.message); } };
  }

  // ---------- Zip + envoi ----------
  function etape5() {
    const l = M.pistes.filter(p => p.gelable && !p.dossier), gel = l.filter(p => p.gelee).length;
    vit.innerHTML = `<div class="box"><span class="lb">Avant de zipper</span>
        <div class="mp-check"><span class="led ${l.length && gel === l.length ? 'grn' : 'amb'}"></span><span class="nt" style="margin:0">Pistes gelées : ${gel} / ${l.length}</span></div>
        <div class="mp-check"><button class="ta-case${M.rassemble ? ' on' : ''}" id="mpRass">${M.rassemble ? '✓' : ''}</button><span class="nt" style="margin:0">J'ai fait <b>Fichier › Rassembler et sauvegarder</b> dans Ableton</span></div></div>
      <div class="box"><span class="lb">Zip</span>
        <span class="nt">Le zip est créé à côté du dossier du projet : <span class="mono">${esc(propre(M.morceau) || 'MORCEAU')}_MIX_${new Date().toISOString().slice(0, 10)}.zip</span>. Le PC reste utilisable pendant ce temps.</span>
        <button class="btn pri" id="mpZip" style="margin-top:10px;align-self:flex-start">Zipper le projet ▶</button></div>
      <div class="box"><span class="lb">Envoi dans le Drive BEESKOT</span>
        <span class="nt">${BK.drive.relie() ? (M.zip ? `Prêt à envoyer : <span class="mono">${esc(M.zip.split(/[\\/]/).pop())}</span> → Drive › BEESKOT Studio › Mixages` : 'Fais d\'abord le zip.') : 'Relie d\'abord le Drive (Réglages).'}</span>
        <button class="btn" id="mpEnvoi" style="margin-top:10px;align-self:flex-start" ${BK.drive.relie() && M.zip ? '' : 'disabled'}>Envoyer dans le Drive ▶</button></div>`;
    $('#mpEnvoi').onclick = async () => {
      const b = $('#mpEnvoi'); b.disabled = true; b.innerHTML = '<span class="spin"></span>Envoi…'; msg('Envoi dans le Drive (le PC reste utilisable)');
      try {
        const nom = M.zip.split(/[\\/]/).pop(), r = await BK.drive.envoyerFichier(M.zip, nom, 'Mixages');
        const fiche = (await BK.db.liste('morceaux')).find(x => BK.inv.normaliser(x.nom) === BK.inv.normaliser(M.morceau));
        if (fiche && r.webViewLink) { (fiche.liens = fiche.liens || []).push({ titre: 'Mixage · ' + nom, url: r.webViewLink }); await BK.db.ecrire('morceaux', fiche); }
        msg('Envoyé dans le Drive' + (fiche ? ' et relié à la fiche ' + fiche.nom : ''));
      } catch (e) { msg('Envoi impossible : ' + e); }
      b.disabled = false; b.textContent = 'Envoyer dans le Drive ▶';
    };
    $('#mpRass').onclick = () => { M.rassemble = !M.rassemble; etape5(); };
    $('#mpZip').onclick = async () => {
      if (!BK.estExe) return msg('Disponible dans le logiciel installé');
      if (!M.rassemble) return msg('Fais d\'abord « Rassembler et sauvegarder », puis coche la case');
      const dos = await BK.fichier.choisirDossier('Dossier du projet Ableton à zipper (celui qui contient le .als)'); if (!dos) return;
      const nom = `${propre(M.morceau) || 'PROJET'}_MIX_${new Date().toISOString().slice(0, 10)}.zip`;
      const parent = dos.replace(/[\\/][^\\/]+$/, ''); let dest = BK.chemin(parent, nom), n = 2;
      while (await BK.fichier.existe(dest)) dest = BK.chemin(parent, nom.replace('.zip', ` (${n++}).zip`));   // ne jamais écraser
      const b = $('#mpZip'); b.disabled = true; b.innerHTML = '<span class="spin"></span>Zip en cours…'; msg('Zip en cours (le PC reste utilisable)');
      try { const o = await BK.T.core.invoke('zipper', { dossier: dos, destination: dest }); M.zip = dest; etape5(); msg(`Zip prêt : ${dest.split(/[\\/]/).pop()} (${(o / 1e6).toFixed(0)} Mo)`); }
      catch (e) { msg('Zip impossible : ' + e); }
      b.disabled = false; b.textContent = 'Zipper le projet ▶';
    };
  }

  // ---------- Plugins manquants : on choisit un membre, on voit ce qu'il lui manque pour ouvrir les projets des autres ----------
  async function etape6() {
    const membres = [...(await BK.membres()), 'Studio'], qui = M.plugQui && membres.includes(M.plugQui) ? M.plugQui : (membres.find(m => m.toLowerCase() === (BK.reglage('nomPc', '') || '').toLowerCase()) || membres[0]);
    M.plugQui = qui;
    vit.innerHTML = `<div class="box"><div class="ligne-titre"><span class="lb">Ce qui manque chez…</span>
        <div class="seg mp-qui" style="margin-left:auto">${membres.map(m => `<button data-qui="${esc(m)}" class="${m === qui ? 'on' : ''}">${esc(m)}</button>`).join('')}</div></div>
        <div id="mpManque"><span class="nt"><span class="spin"></span>…</span></div></div>
      <div class="box" id="mpPlugIci"></div>`;
    $$('[data-qui]', vit).forEach(b => b.onclick = () => { M.plugQui = b.dataset.qui; etape6(); });
    BK.plugins.case($('#mpPlugIci'));                                  // le projet ouvert sur ce PC (comme avant)
    const z = $('#mpManque');
    if (!BK.drive.relie()) { z.innerHTML = '<span class="nt">Relie le Drive : c\'est là que chaque PC dit ce qu\'il a.</span>'; return; }
    const r = await BK.plugins.manquentChez(qui); if (M.plugQui !== qui || !z.isConnected) return;
    const autres = r.sources.length ? r.sources.join(', ') : 'personne pour l\'instant';
    if (!r.verifie) { z.innerHTML = `<span class="nt">Le PC de ${esc(qui)} n'a pas encore envoyé sa liste de plugins. Il le fait tout seul quelques minutes après l'ouverture de BEESKOT Studio.</span>`; return; }
    z.innerHTML = `<span class="nt">Comparé aux projets de : ${esc(autres)} · liste de ${esc(qui)} du ${esc(new Date(r.t).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long' }))}</span>`
      + (r.l.length ? `<ul class="mp-manque">${r.l.map(x => `<li><b>${esc(x.nom)}</b><span class="nt">${esc(x.projets.join(' · '))}</span></li>`).join('')}</ul>
          <div class="chips" style="margin-top:8px"><button class="chip" id="mpVersTodo">📋 Envoyer dans la To-do list (${esc(qui)})</button><button class="chip" id="mpCopierPl">Copier la liste</button></div>`
        : `<span class="nt mp-rien">✓ Rien ne manque à ${esc(qui)} pour ouvrir les projets des autres.</span>`);
    const noms = r.l.map(x => x.nom);
    const t = $('#mpVersTodo'); if (t) t.onclick = async () => {
      const id = 'plug-' + BK.plugins.norme(qui) + '-' + BK.plugins.norme(noms.join('')).slice(0, 60);
      if ((await BK.db.liste('taches')).some(x => x.id === id)) { t.textContent = 'Déjà dans la To-do ✓'; return; }
      await BK.db.ecrire('taches', { id, texte: `Installer : ${noms.join(', ')}${qui === 'Studio' ? ' (PC du Studio)' : ''}`, qui: qui === 'Studio' ? '' : qui, fait: false, ordre: Date.now() });
      BK.tachesRecharger && BK.tachesRecharger(); t.textContent = '✓ Dans la To-do de ' + qui; msg('Tâche ajoutée pour ' + qui); };
    const c = $('#mpCopierPl'); if (c) c.onclick = async () => { try { await navigator.clipboard.writeText(noms.join('\n')); msg(noms.length + ' plugin(s) copié(s)'); } catch (e) { msg('Copie impossible'); } };
    majCartes(r.l.length);
  }

  // les cartes : un mot sur où on en est
  function majCartes(nPlug) {
    const l = M.pistes.filter(p => p.gelable && !p.dossier), ideal = ordreIdeal(M.pistes), actuel = M.pistes.filter(p => !p.dossier);
    let k = 0; while (k < ideal.length && actuel[k] && actuel[k].i === ideal[k].i) k++;
    const et = { 1: BK.ableton.relie ? 'relié ✓' : 'pas relié', 2: M.pistes.length ? M.pistes.length + ' pistes' : 'lire les pistes', 3: M.pistes.length ? k + ' / ' + ideal.length + ' en place' : '—',
      4: M.pistes.length ? l.filter(p => p.gelee).length + ' / ' + l.length + ' gelées' : '—', 5: M.zip ? 'zip prêt ✓' : '—', 6: nPlug == null ? (M.nPlug == null ? '—' : M.nPlug ? M.nPlug + ' manquent' : 'rien ne manque ✓') : (nPlug ? nPlug + ' manquent' : 'rien ne manque ✓') };
    if (nPlug != null) M.nPlug = nPlug;
    for (const [e] of CARTES) { const x = $('#mpEt' + e); if (x) x.textContent = et[e]; }
    $$('#mpCartes .mp-carte').forEach(b => b.classList.toggle('on', +b.dataset.e === M.etape));
  }
  function rendre() {
    suivre(M.etape === 3 || M.etape === 4);
    [null, etape1, etape2, etape3, etape4, etape5, etape6][M.etape](); majCartes();
  }
  const aller = async e => { M.etape = e; if ((e === 3 || e === 4) && BK.ableton.relie) { try { await lire(true); if (!M.cap) await detecter(); } catch (er) {} } rendre(); };
  $$('#mpCartes .mp-carte').forEach(b => b.onclick = () => aller(+b.dataset.e));
  $('#mpMorceau').oninput = e => { M.morceau = e.target.value; if (M.etape === 2) etape2(); };
  $('#mpModele').onchange = e => { M.modele = e.target.value || '{PREFIXE}_{MORCEAU}_{PISTE}_{BPM}'; BK.regler('mix.modele', M.modele); if (M.etape === 2) etape2(); };
  $('#mpCoul').onclick = e => { M.couleurs = !M.couleurs; e.target.classList.toggle('on', M.couleurs); };
  rendre();
});
})();
