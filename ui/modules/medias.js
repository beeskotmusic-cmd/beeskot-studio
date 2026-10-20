// =====================================================================
// MÉDIAS — les vrais dossiers du groupe dans le Drive :
//   Photos / Vidéos (moodboards, tournages, outfits…), Scénographie, Light Show…
// On navigue dans les dossiers, on voit les images, on ajoute des fichiers
// dans le dossier ouvert. Rien n'est jamais effacé (corbeille de BEESKOT Studio).
// =====================================================================
(() => {
const RACINES = [['photovideo', 'Photos / Vidéos'], ['moodboard', 'Moodboards'], ['tournage', 'Tournages'], ['outfits', 'Outfits'], ['scenographie', 'Scénographie'], ['lightshow', 'Light Show']];
const M = { racine: BK.reglage('medias.racine', 'photovideo'), pile: [], fichiers: [], envoi: false };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const DOSSIER = 'application/vnd.google-apps.folder';

BK.module('medias', function (page) {
  $('.sub', page).textContent = 'Les dossiers photos, vidéos, moodboards et tournages du Drive BEESKOT';
  $('.hdr .right', page).innerHTML = `<div><span class="eng" style="font-size:9px">Fichiers</span><span class="vfd" id="mdNb">—</span></div>`;
  $('.grid', page).innerHTML = `
    <div class="cols">
      <section class="pane vit md-vit"><span class="ptitle">① Vitrine</span>
        <div class="box md-barre">
          <div class="seg" id="mdRacines">${RACINES.map(([k, n]) => `<button data-r="${k}">${n}</button>`).join('')}</div>
          <div class="md-fil" id="mdFil"></div>
        </div>
        <div class="box grow md-zone" id="mdZone"><div class="md-grille" id="mdGrille"></div></div>
      </section>
      <section class="pane reg" style="width:260px"><span class="ptitle">② Réglages</span>
        <div class="box"><span class="lb">Ajouter</span>
          <span class="nt">Glisse des fichiers sur la page, ou « + » : ils vont dans le dossier ouvert.</span>
          <button class="btn sm" id="mdAjout" style="margin-top:10px">+ Choisir des fichiers…</button>
          <button class="btn sm" id="mdDossier" style="margin-top:8px">+ Nouveau dossier ici…</button>
          <input type="file" id="mdInput" multiple hidden></div>
        <div class="box"><span class="lb">Drive</span>
          <span class="nt mono" id="mdChemin">—</span>
          <button class="btn sm" id="mdOuvrirDos" style="margin-top:10px">Ouvrir ce dossier dans le Drive</button></div>
        <div class="box"><span class="lb">Rien n'est effacé</span><span class="nt">✕ range le fichier dans la corbeille de BEESKOT Studio (dans le Drive). On peut toujours le récupérer.</span></div>
      </section>
    </div>
    <div class="pane abar"><span class="ptitle">③ Barre</span><span class="vfd" id="mdMsg">PRÊT</span>
      <div class="right"><button class="btn" id="mdRelire">↻ Relire</button></div></div>`;
  const msg = t => $('#mdMsg').textContent = String(t).toUpperCase().slice(0, 90);
  const ici = () => M.pile[M.pile.length - 1];

  async function allerRacine(r) {
    M.racine = r; BK.regler('medias.racine', r);
    $$('#mdRacines button').forEach(b => b.classList.toggle('on', b.dataset.r === r));
    if (!BK.drive.relie()) return vide('Relie d\'abord le Drive (Réglages › Drive).');
    await BK.dossiers.assurer();
    const d = await BK.dossiers.get(r);
    if (!d) return vide('Ce dossier n\'a pas été trouvé dans le Drive. Choisis-le dans Réglages › Vos dossiers du Drive.');
    M.pile = [{ id: d.id, nom: BK.dossiers.joli(d.nom) }]; charger();
  }
  function vide(t) { $('#mdGrille').innerHTML = `<span class="nt md-vide">${t}</span>`; $('#mdNb').textContent = '—'; $('#mdFil').innerHTML = ''; }

  async function charger() {
    const cur = ici(); if (!cur) return;
    $('#mdFil').innerHTML = M.pile.map((p, i) => `<button class="ex-miette" data-i="${i}">${esc(p.nom)}</button>`).join('<span>›</span>');
    $$('#mdFil .ex-miette').forEach(b => b.onclick = () => { M.pile = M.pile.slice(0, +b.dataset.i + 1); charger(); });
    $('#mdChemin').textContent = M.pile.map(p => p.nom).join(' / ');
    $('#mdGrille').innerHTML = '<span class="nt md-vide"><span class="spin"></span>Lecture du Drive…</span>';
    try { M.fichiers = await BK.dossiers.enfants(cur.id); if (ici() === cur) rendre(); }
    catch (e) { vide('Drive injoignable pour l\'instant.'); console.error(e); }
  }
  BK.mediasRecharger = charger;

  function rendre() {
    const ds = M.fichiers.filter(f => f.mimeType === DOSSIER), fs = M.fichiers.filter(f => f.mimeType !== DOSSIER);
    $('#mdNb').textContent = String(fs.length).padStart(2, '0');
    $('#mdGrille').innerHTML = ds.map(d => `<button class="md-tuile md-dos" data-dos="${d.id}" data-nom="${esc(d.name)}"><span class="md-dos-ic">📁</span><span class="md-nom">${esc(d.name)}</span></button>`).join('')
      + `<button class="md-tuile md-plus" id="mdPlus"><span>+</span><span class="nt">Ajouter ici</span></button>`
      + fs.map(f => {
        const video = /^video\//.test(f.mimeType), d = f.videoMediaMetadata && f.videoMediaMetadata.durationMillis;
        return `<div class="md-tuile" data-id="${f.id}" title="${esc(f.name)}">
          <div class="md-img${video ? ' video' : ''}">${f.thumbnailLink ? '<span class="spin"></span>' : `<span class="md-ext">${esc((f.name.split('.').pop() || '').toUpperCase())}</span>`}
            ${video ? `<span class="md-duree">${d ? BK.audio.temps(d / 1000).replace(/\.\d$/, '') : '▶'}</span>` : ''}</div>
          <span class="md-nom">${esc(f.name)}</span>
          <button class="md-x" data-x="${f.id}" title="Ranger dans la corbeille">✕</button></div>`;
      }).join('');
    $$('.md-dos').forEach(b => b.onclick = () => { M.pile.push({ id: b.dataset.dos, nom: b.dataset.nom }); charger(); });
    $('#mdPlus').onclick = () => $('#mdInput').click();
    $$('.md-tuile[data-id]').forEach(t => t.onclick = e => { if (e.target.closest('.md-x')) return; const f = M.fichiers.find(x => x.id === t.dataset.id); f && BK.ouvrirLien(f.webViewLink); });
    $$('.md-x').forEach(b => b.onclick = async () => {
      const f = M.fichiers.find(x => x.id === b.dataset.x); if (!f || !confirm(`Ranger « ${f.name} » dans la corbeille de BEESKOT Studio ?`)) return;
      try { await BK.drive.corbeille(f.id); M.fichiers = M.fichiers.filter(x => x !== f); rendre(); msg('Rangé dans la corbeille'); } catch (e) { msg('Impossible pour l\'instant'); }
    });
    (async () => { for (const f of fs) {                               // vignettes une par une : léger
      if (!f.thumbnailLink) continue; const u = await BK.drive.vignette(f), el = $(`.md-tuile[data-id="${f.id}"] .md-img`);
      if (el) { const sp = $('.spin', el); sp && sp.remove(); if (u) el.style.backgroundImage = `url(${u})`; }
    } })();
  }

  // ---------- ajouter des fichiers dans le dossier ouvert ----------
  async function envoyer(liste) {
    const cur = ici(); if (!cur) return msg('Ouvre d\'abord un dossier');
    if (M.envoi) return msg('Un envoi est déjà en cours');
    const fs = [...liste]; if (!fs.length) return;
    M.envoi = true;
    try {
      for (let i = 0; i < fs.length; i++) await BK.drive.envoyerBlob(fs[i], fs[i].name, cur.id, p => msg(`Envoi ${i + 1}/${fs.length} · ${Math.round(p * 100)} %`));
      msg(fs.length > 1 ? fs.length + ' fichiers envoyés' : 'Fichier envoyé');
    } catch (e) { msg('Envoi impossible : ' + e.message); console.error(e); }
    M.envoi = false; charger();
  }
  $('#mdAjout').onclick = () => $('#mdInput').click();
  $('#mdInput').onchange = e => { envoyer(e.target.files); e.target.value = ''; };
  $('#mdDossier').onclick = async () => {
    const cur = ici(); if (!cur) return; const n = prompt('Nom du nouveau dossier'); if (!n || !n.trim()) return;
    try { await BK.drive.dossier(n.trim(), cur.id); msg('Dossier créé'); charger(); } catch (e) { msg('Impossible pour l\'instant'); }
  };
  page.addEventListener('dragover', e => { e.preventDefault(); $('#mdZone').classList.add('survol'); });
  page.addEventListener('dragleave', e => { if (!page.contains(e.relatedTarget)) $('#mdZone').classList.remove('survol'); });
  page.addEventListener('drop', e => { e.preventDefault(); $('#mdZone').classList.remove('survol'); if (e.dataTransfer.files.length) envoyer(e.dataTransfer.files); });

  $$('#mdRacines button').forEach(b => b.onclick = () => allerRacine(b.dataset.r));
  $('#mdRelire').onclick = charger;
  $('#mdOuvrirDos').onclick = () => ici() ? BK.ouvrirLien('https://drive.google.com/drive/folders/' + ici().id) : msg('Relie d\'abord le Drive');
  BK.surOuvrir = BK.surOuvrir || {};
  BK.surOuvrir.medias = () => { if (!M.pile.length) allerRacine(M.racine); };
  BK.ouvrirMedias = async role => { BK.ouvrir('medias'); allerRacine(role || 'photovideo'); };
  $$('#mdRacines button').forEach(b => b.classList.toggle('on', b.dataset.r === M.racine));
});
})();
