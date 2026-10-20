// =====================================================================
// MÉDIAS — la galerie de chaque morceau : photos, pochettes, reels prêts, vidéos.
// Tout est rangé dans le Drive : BEESKOT Studio/Médias/<morceau>/<catégorie>
// donc tout le groupe voit la même chose. Rien n'est jamais effacé (corbeille).
// =====================================================================
(() => {
const CATS = ['Photos', 'Pochettes', 'Reels prêts', 'Vidéos', 'Autres'];
const GENERAL = '— BEESKOT (général) —';
const M = { morceau: BK.reglage('medias.morceau', ''), cat: BK.reglage('medias.cat', 'Photos'), fichiers: [], dossier: null, envoi: false };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const devinerCat = f => /^image\//.test(f.type) ? (/pochette|cover|artwork/i.test(f.name) ? 'Pochettes' : 'Photos') : /^video\//.test(f.type) ? (/reel/i.test(f.name) ? 'Reels prêts' : 'Vidéos') : 'Autres';

BK.module('medias', function (page) {
  $('.sub', page).textContent = 'Photos, pochettes, reels et vidéos de chaque morceau, dans le Drive';
  $('.hdr .right', page).innerHTML = `<div><span class="eng" style="font-size:9px">Fichiers</span><span class="vfd" id="mdNb">—</span></div>`;
  $('.grid', page).innerHTML = `
    <div class="cols">
      <section class="pane vit md-vit"><span class="ptitle">① Vitrine</span>
        <div class="box md-barre">
          <label><span class="eng">Morceau</span><select class="fld" id="mdMorceau"></select></label>
          <div class="seg" id="mdCats">${CATS.map(c => `<button data-c="${c}">${c}</button>`).join('')}</div>
        </div>
        <div class="box grow md-zone" id="mdZone">
          <div class="md-grille" id="mdGrille"></div>
        </div>
      </section>
      <section class="pane reg" style="width:260px"><span class="ptitle">② Réglages</span>
        <div class="box"><span class="lb">Ajouter</span>
          <span class="nt">Glisse des fichiers n'importe où sur la page, ou clique sur la case « + ». Ils partent dans le Drive, dans la catégorie choisie.</span>
          <button class="btn sm" id="mdAjout" style="margin-top:10px">+ Choisir des fichiers…</button>
          <input type="file" id="mdInput" multiple hidden></div>
        <div class="box"><span class="lb">Drive</span>
          <span class="nt" id="mdChemin">—</span>
          <button class="btn sm" id="mdOuvrirDos" style="margin-top:10px">Ouvrir ce dossier dans le Drive</button></div>
        <div class="box"><span class="lb">Rien n'est effacé</span><span class="nt">✕ range le fichier dans la corbeille de BEESKOT Studio (dans le Drive). On peut toujours le récupérer.</span></div>
      </section>
    </div>
    <div class="pane abar"><span class="ptitle">③ Barre</span><span class="vfd" id="mdMsg">PRÊT</span>
      <div class="right"><button class="btn" id="mdRelire">↻ Relire</button></div></div>`;
  const msg = t => $('#mdMsg').textContent = String(t).toUpperCase();
  const nomDossier = () => M.morceau || GENERAL.replace(/[—\s]/g, ' ').trim();

  async function remplirMorceaux() {
    const ms = (await BK.db.liste('morceaux')).sort((a, b) => a.nom.localeCompare(b.nom));
    $('#mdMorceau').innerHTML = `<option value="">${GENERAL}</option>` + ms.map(m => `<option>${esc(m.nom)}</option>`).join('');
    $('#mdMorceau').value = ms.some(m => m.nom === M.morceau) ? M.morceau : '';
    M.morceau = $('#mdMorceau').value;
  }
  function majCats() { $$('#mdCats button').forEach(b => b.classList.toggle('on', b.dataset.c === M.cat)); }

  async function charger() {
    majCats();
    const g = $('#mdGrille');
    if (!BK.drive.relie()) { g.innerHTML = '<span class="nt md-vide">Relie d\'abord le Drive (Réglages › Drive) : les médias sont rangés dans le Drive BEESKOT.</span>'; $('#mdNb').textContent = '—'; return; }
    g.innerHTML = '<span class="nt md-vide"><span class="spin"></span>Lecture du Drive…</span>';
    try {
      M.dossier = await BK.drive.chemin(['Médias', nomDossier(), M.cat]);
      M.fichiers = await BK.drive.contenu(M.dossier);
      $('#mdChemin').textContent = `BEESKOT Studio / Médias / ${nomDossier()} / ${M.cat}`;
      rendre();
    } catch (e) { g.innerHTML = '<span class="nt md-vide">Drive injoignable pour l\'instant.</span>'; console.error(e); }
  }
  BK.mediasRecharger = charger;

  function rendre() {
    $('#mdNb').textContent = String(M.fichiers.length).padStart(2, '0');
    $('#mdGrille').innerHTML = `<button class="md-tuile md-plus" id="mdPlus"><span>+</span><span class="nt">Ajouter</span></button>` +
      M.fichiers.map(f => {
        const video = /^video\//.test(f.mimeType), d = f.videoMediaMetadata && f.videoMediaMetadata.durationMillis;
        return `<div class="md-tuile" data-id="${f.id}" title="${esc(f.name)}">
          <div class="md-img${video ? ' video' : ''}">${f.thumbnailLink ? '<span class="spin"></span>' : `<span class="md-ext">${esc((f.name.split('.').pop() || '').toUpperCase())}</span>`}
            ${video ? `<span class="md-duree">${d ? BK.audio.temps(d / 1000).replace(/\.\d$/, '') : '▶'}</span>` : ''}</div>
          <span class="md-nom">${esc(f.name)}</span>
          <button class="md-x" data-x="${f.id}" title="Ranger dans la corbeille">✕</button></div>`;
      }).join('');
    $('#mdPlus').onclick = () => $('#mdInput').click();
    $$('.md-tuile[data-id]').forEach(t => t.onclick = e => { if (e.target.closest('.md-x')) return; const f = M.fichiers.find(x => x.id === t.dataset.id); f && BK.ouvrirLien(f.webViewLink); });
    $$('.md-x').forEach(b => b.onclick = async () => {
      const f = M.fichiers.find(x => x.id === b.dataset.x); if (!f || !confirm(`Ranger « ${f.name} » dans la corbeille ?`)) return;
      try { await BK.drive.corbeille(f.id); M.fichiers = M.fichiers.filter(x => x !== f); rendre(); msg('Rangé dans la corbeille'); } catch (e) { msg('Impossible pour l\'instant'); }
    });
    (async () => { for (const f of M.fichiers) {                     // vignettes une par une : léger
      if (!f.thumbnailLink) continue; const u = await BK.drive.vignette(f), el = $(`.md-tuile[data-id="${f.id}"] .md-img`);
      if (el) { const sp = $('.spin', el); sp && sp.remove(); if (u) el.style.backgroundImage = `url(${u})`; }
    } })();
  }

  // ---------- envoyer des fichiers ----------
  async function envoyer(liste) {
    if (!BK.drive.relie()) return msg('Relie d\'abord le Drive (Réglages)');
    if (M.envoi) return msg('Un envoi est déjà en cours');
    const fs = [...liste]; if (!fs.length) return;
    M.envoi = true;
    try {
      for (let i = 0; i < fs.length; i++) {
        const f = fs[i], cat = liste.cat || M.cat, dos = await BK.drive.chemin(['Médias', nomDossier(), cat]);
        await BK.drive.envoyerBlob(f, f.name, dos, p => msg(`Envoi ${i + 1}/${fs.length} · ${Math.round(p * 100)} %`));
      }
      msg(fs.length > 1 ? fs.length + ' fichiers envoyés' : 'Fichier envoyé');
    } catch (e) { msg('Envoi impossible : ' + e.message); console.error(e); }
    M.envoi = false; charger();
  }
  $('#mdAjout').onclick = () => $('#mdInput').click();
  $('#mdInput').onchange = e => { envoyer(e.target.files); e.target.value = ''; };
  page.addEventListener('dragover', e => { e.preventDefault(); $('#mdZone').classList.add('survol'); });
  page.addEventListener('dragleave', e => { if (!page.contains(e.relatedTarget)) $('#mdZone').classList.remove('survol'); });
  page.addEventListener('drop', e => { e.preventDefault(); $('#mdZone').classList.remove('survol');
    const fs = [...e.dataTransfer.files]; if (!fs.length) return;
    if (fs.every(f => devinerCat(f) !== M.cat) && fs.every(f => devinerCat(f) === devinerCat(fs[0]))) { M.cat = devinerCat(fs[0]); BK.regler('medias.cat', M.cat); majCats(); }
    envoyer(fs); });

  $('#mdMorceau').onchange = e => { M.morceau = e.target.value; BK.regler('medias.morceau', M.morceau); charger(); };
  $$('#mdCats button').forEach(b => b.onclick = () => { M.cat = b.dataset.c; BK.regler('medias.cat', M.cat); charger(); });
  $('#mdRelire').onclick = charger;
  $('#mdOuvrirDos').onclick = () => M.dossier ? BK.ouvrirLien('https://drive.google.com/drive/folders/' + M.dossier) : msg('Relie d\'abord le Drive');
  BK.surOuvrir = BK.surOuvrir || {};
  BK.surOuvrir.medias = async () => { await remplirMorceaux(); charger(); };
  BK.ouvrirMedias = async nom => { M.morceau = nom; BK.regler('medias.morceau', nom); BK.ouvrir('medias'); };
  remplirMorceaux();
});
})();
