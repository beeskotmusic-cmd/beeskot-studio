// =====================================================================
// PRÉPA MIXAGE — sur le projet ouvert dans Ableton :
//   1. lire les pistes  2. proposer les noms (DRMS_ / PERC_ / VOX_ / INSTR_)
//   3. appliquer noms + couleurs (après ton OK)  4. vérifier les pistes gelées
//   5. zipper le dossier du projet (avec la date et le bon nom)
// =====================================================================
(() => {
const GROUPES = {
  DRMS:  { nom: 'Batterie',     couleur: 0xE0452B, mots: /kick|snare|caisse|hat|hh|tom|over|oh\b|cymb|crash|ride|drum|batt|addictive|bd\b|sd\b/i },
  PERC:  { nom: 'Percussions',  couleur: 0xE8A33A, mots: /perc|shak|conga|bongo|tamb|clap|cowbell|guiro|cabasa|djemb|timbal/i },
  VOX:   { nom: 'Voix',         couleur: 0x3A8FB7, mots: /vox|voix|vocal|chant|ch(oe|œ)ur|lead|bv\b|back|adlib|harmon|rap/i },
  INSTR: { nom: 'Instruments',  couleur: 0x6E9A3E, mots: /./ },
};
const M = { pistes: [], choix: {}, tempo: 0, morceau: '', modele: BK.reglage('mix.modele', '{PREFIXE}_{MORCEAU}_{PISTE}_{BPM}'), couleurs: true, rassemble: false };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const propre = s => String(s || '').trim().replace(/\s+/g, '-').replace(/[\\/:*?"<>|]/g, '');

function deviner(p) {
  if (p.dossier) return '';                                         // une piste « groupe » : on n'y touche pas par défaut
  for (const k of ['DRMS', 'PERC', 'VOX']) if (GROUPES[k].mots.test(p.nom + ' ' + (p.groupe || ''))) return k;
  return 'INSTR';
}
function base(nom) {                                                // enlève un ancien préfixe / morceau / BPM déjà posés
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

BK.module('mixprep', function (page) {
  $('.sub', page).textContent = 'Préparer le projet Ableton pour l\'envoyer au mixeur';
  $('.hdr .right', page).innerHTML = `<div><span class="eng" style="font-size:9px">Ableton</span><span class="vfd" id="mpEtatH">—</span></div>
    <div><span class="eng" style="font-size:9px">Tempo</span><span class="vfd" id="mpTempoH">—</span></div>`;
  $('.grid', page).innerHTML = `
    <div class="cols">
      <section class="pane vit"><span class="ptitle">① Vitrine</span>
        <div class="box pick"><span class="led" id="mpLed"></span>
          <div><span class="lb">Projet ouvert dans Ableton</span><span class="nt" id="mpInfo">Ouvre ton projet dans Ableton, puis clique « Lire les pistes ».</span></div>
          <button class="btn sm" id="mpRelier">Relier Ableton…</button><button class="btn sm pri" id="mpLire">Lire les pistes</button></div>
        <div class="box grow"><div class="ligne-titre"><span class="lb">Pistes : avant → après</span><span class="nt" id="mpCompte" style="margin:0 0 0 auto"></span></div>
          <div class="mp-table" id="mpTable"><span class="nt">Aucune piste lue pour l'instant.</span></div></div>
      </section>
      <section class="pane reg"><span class="ptitle">② Réglages</span>
        <div class="box"><span class="lb">Morceau</span>
          <input class="fld" id="mpMorceau" list="mpListe" style="margin-top:8px" placeholder="nom du morceau"><datalist id="mpListe"></datalist></div>
        <div class="box"><span class="lb">Modèle de nom</span>
          <input class="fld" id="mpModele" style="margin-top:8px" value="${esc(M.modele)}">
          <span class="nt">Mots magiques : {PREFIXE} {MORCEAU} {PISTE} {BPM}</span>
          <div class="chips" style="margin-top:8px"><button class="chip on" id="mpCoul">Couleurs par groupe</button></div></div>
        <div class="box"><span class="lb">Avant d'envoyer</span>
          <div class="mp-check"><span class="led" id="mpLedGel"></span><span class="nt" id="mpGel" style="margin:0">Pistes gelées : —</span></div>
          <div class="mp-check"><button class="ta-case" id="mpRass"></button><span class="nt" style="margin:0">J'ai fait <b>Fichier › Rassembler et sauvegarder</b> dans Ableton</span></div>
          <span class="nt">Ableton ne laisse pas un autre logiciel geler ou rassembler à sa place : fais-le dans Ableton, je vérifie.</span></div>
      </section>
    </div>
    <div class="pane abar"><span class="ptitle">③ Barre</span><span class="vfd" id="mpMsg">PRÊT</span>
      <div class="right"><button class="btn" id="mpAppliquer" disabled>Appliquer les noms ▶</button><button class="btn pri" id="mpZip">Zipper le projet ▶</button></div></div>`;
  const msg = t => $('#mpMsg').textContent = String(t).toUpperCase();

  document.addEventListener('ableton', e => { $('#mpLed').classList.toggle('grn', e.detail); $('#mpEtatH').textContent = e.detail ? 'RELIÉ' : 'NON RELIÉ'; });
  BK.db.liste('morceaux').then(l => $('#mpListe').innerHTML = l.map(m => `<option value="${esc(m.nom)}">`).join(''));

  function rendre() {
    if (!M.pistes.length) return;
    const lignes = M.pistes.map(p => `<div class="mp-l${p.dossier ? ' dossier' : ''}">
        <span class="mp-n mono">${p.i + 1}</span>
        <span class="mp-av" title="${esc(p.nom)}">${p.dossier ? '📁 ' : ''}${esc(p.nom)}</span>
        <select class="fld mp-g" data-i="${p.i}"><option value="">— ne pas toucher</option>${Object.entries(GROUPES).map(([k, g]) => `<option value="${k}"${M.choix[p.i] === k ? ' selected' : ''}>${k} · ${g.nom}</option>`).join('')}</select>
        <span class="mp-ap mono${M.choix[p.i] ? '' : ' muet'}" title="${esc(nouveauNom(p))}">${M.choix[p.i] ? '<i class="pastille" style="background:#' + GROUPES[M.choix[p.i]].couleur.toString(16).padStart(6, '0') + '"></i>' : ''}${esc(nouveauNom(p))}</span>
        <span class="mp-gel" title="${p.gelee ? 'gelée' : p.gelable ? 'pas gelée' : '—'}">${p.gelee ? '❄' : p.gelable ? '·' : ''}</span></div>`).join('');
    $('#mpTable').innerHTML = `<div class="mp-l mp-tete"><span class="mp-n">#</span><span class="mp-av">Avant</span><span class="mp-g eng">Groupe</span><span class="mp-ap">Après</span><span class="mp-gel">❄</span></div>` + lignes;
    $$('.mp-g[data-i]').forEach(s => s.onchange = () => { M.choix[+s.dataset.i] = s.value; rendre(); });
    const gelables = M.pistes.filter(p => p.gelable && !p.dossier), gelees = gelables.filter(p => p.gelee);
    $('#mpGel').textContent = `Pistes gelées : ${gelees.length} / ${gelables.length}`;
    $('#mpLedGel').className = 'led ' + (gelables.length && gelees.length === gelables.length ? 'grn' : 'amb');
    $('#mpCompte').textContent = `${M.pistes.length} pistes · ${Object.values(M.choix).filter(Boolean).length} à renommer`;
    $('#mpAppliquer').disabled = false;
  }

  $('#mpLire').onclick = async () => {
    try {
      msg('Lecture…'); const r = await BK.ableton.req({ cmd: 'pistes' });
      M.pistes = r.pistes; M.tempo = r.tempo; M.choix = {}; for (const p of M.pistes) M.choix[p.i] = deviner(p);
      $('#mpTempoH').textContent = bpm(); $('#mpInfo').textContent = `${r.pistes.length} pistes lues · tempo ${bpm()}`;
      rendre(); msg('Vérifie les groupes, puis « Appliquer »');
    } catch (e) { msg(e.message); }
  };
  $('#mpRelier').onclick = async () => {
    if (!BK.estExe) return msg('Disponible dans le logiciel installé');
    try { const d = await BK.ableton.installerPont(); if (d) BK.ableton.fenetre(d); } catch (e) { msg('Installation impossible : ' + e.message); }
  };
  $('#mpMorceau').oninput = e => { M.morceau = e.target.value; rendre(); };
  $('#mpModele').onchange = e => { M.modele = e.target.value || '{PREFIXE}_{MORCEAU}_{PISTE}_{BPM}'; BK.regler('mix.modele', M.modele); rendre(); };
  $('#mpCoul').onclick = e => { M.couleurs = !M.couleurs; e.target.classList.toggle('on', M.couleurs); };
  $('#mpRass').onclick = e => { M.rassemble = !M.rassemble; e.target.classList.toggle('on', M.rassemble); e.target.textContent = M.rassemble ? '✓' : ''; };

  $('#mpAppliquer').onclick = async () => {
    if (!M.morceau.trim()) return msg('Indique d\'abord le nom du morceau');
    const liste = M.pistes.filter(p => M.choix[p.i]).map(p => ({ i: p.i, ancien: p.nom, nom: nouveauNom(p), couleur: M.couleurs ? GROUPES[M.choix[p.i]].couleur : null }));
    try { const r = await BK.ableton.req({ cmd: 'appliquer', pistes: liste }); msg(r.faits + ' pistes renommées dans Ableton (Ctrl+Z dans Ableton pour annuler)'); $('#mpLire').click(); }
    catch (e) { msg(e.message); }
  };

  $('#mpZip').onclick = async () => {
    if (!BK.estExe) return msg('Disponible dans le logiciel installé');
    const gelables = M.pistes.filter(p => p.gelable && !p.dossier);
    if (M.pistes.length && gelables.some(p => !p.gelee)) msg('Attention : toutes les pistes ne sont pas gelées');
    if (!M.rassemble) return msg('Fais d\'abord « Rassembler et sauvegarder » dans Ableton, puis coche la case');
    const dos = await BK.fichier.choisirDossier('Dossier du projet Ableton à zipper (celui qui contient le .als)'); if (!dos) return;
    const d = new Date().toISOString().slice(0, 10), nom = `${propre(M.morceau) || 'PROJET'}_MIX_${d}.zip`;
    const parent = dos.replace(/[\\/][^\\/]+$/, ''); let dest = BK.chemin(parent, nom), n = 2;
    while (await BK.fichier.existe(dest)) dest = BK.chemin(parent, nom.replace('.zip', ` (${n++}).zip`));   // ne jamais écraser
    const b = $('#mpZip'); b.disabled = true; b.innerHTML = '<span class="spin"></span>Zip en cours…'; msg('Zip en cours (le PC reste utilisable)');
    try { const o = await BK.T.core.invoke('zipper', { dossier: dos, destination: dest }); msg(`Zip prêt : ${nom} (${(o / 1e6).toFixed(0)} Mo)`); }
    catch (e) { msg('Zip impossible : ' + e); }
    b.disabled = false; b.textContent = 'Zipper le projet ▶';
  };
});
})();
