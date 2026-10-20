// =====================================================================
// BIBLIOTHÈQUE — une fiche par morceau, avec des tiroirs à déplier :
// exports, projets Ableton, paroles, partitions, infos, progression, notes.
// Sous-onglets : En chantier / Sortis / À ranger (fichiers pas encore reliés).
// =====================================================================
(() => {
const B = { vue: 'chantier', ouverts: new Set(BK.reglage('biblio.ouverts', [])), tiroirs: BK.reglage('biblio.tiroirs', {}), morceaux: [], fichiers: [], filtre: '' };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const date = iso => iso ? new Date(iso).toLocaleDateString('fr-CA', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase() : '—';

BK.module('biblio', function (page) {
  $('.sub', page).textContent = 'Tous vos morceaux : exports, projets Ableton, paroles, avancement';
  $('.hdr .right', page).innerHTML = `
    <div><span class="eng" style="font-size:9px">En chantier</span><span class="vfd" id="biNbC">00</span></div>
    <div><span class="eng" style="font-size:9px">Sortis</span><span class="vfd" id="biNbS">00</span></div>`;
  $('.grid', page).innerHTML = `
    <div class="cols">
      <section class="pane vit" aria-label="Vitrine"><span class="ptitle">① Vitrine</span>
        <div class="ligne-titre">
          <div class="chips" id="biVues"><button class="chip on" data-v="chantier">En chantier</button><button class="chip" data-v="sorti">Sortis</button><button class="chip" data-v="ranger">À ranger <span id="biNbR"></span></button></div>
          <input class="fld" id="biCherche" placeholder="chercher un morceau…" style="max-width:240px;margin-left:auto">
        </div>
        <div id="biListe" class="bi-liste"></div>
      </section>
      <section class="pane reg" aria-label="Réglages"><span class="ptitle">② Réglages</span>
        <div class="box"><span class="lb">Nouveau morceau</span>
          <input class="fld" id="biNom" style="margin-top:10px" placeholder="nom du morceau">
          <div class="chips" style="margin-top:10px"><button class="chip" id="biAjout">+ Créer la fiche</button></div></div>
        <div class="box"><span class="lb">Dossiers de ce PC à fouiller</span>
          <span class="nt">Projets Ableton, exports… Le Drive BEESKOT est fouillé automatiquement.</span>
          <div id="biDossiers" class="bi-dossiers"></div>
          <div class="chips" style="margin-top:10px"><button class="chip" id="biAjDos">+ Ajouter un dossier</button></div></div>
        <div class="box"><span class="lb">Dernier inventaire</span><span class="nt" id="biScanInfo">—</span></div>
      </section>
    </div>
    <div class="pane abar" aria-label="Barre"><span class="ptitle">③ Barre</span>
      <span class="vfd" id="biMsg">PRÊT</span>
      <div class="right"><button class="btn pri" id="biScan">Scanner ce PC ▶</button></div></div>`;

  const msg = t => $('#biMsg').textContent = String(t).toUpperCase();

  // ---------- chargement ----------
  async function charger() {
    B.morceaux = await BK.db.liste('morceaux');
    if (!BK.estExe && !B.morceaux.length) B.morceaux = await exemples();
    B.fichiers = await BK.inv.tous();
    rendre();
  }
  BK.biblioRecharger = charger;

  // fichiers liés à un morceau
  const fichiersDe = m => B.fichiers.filter(f => BK.inv.trouverMorceau(f.nom, [m]) && BK.inv.trouverMorceau(f.nom, B.morceaux) === m);
  const orphelins = () => {
    const vus = new Set(); return B.fichiers.filter(f => !BK.inv.trouverMorceau(f.nom, B.morceaux) && !f.sauvegarde && !vus.has(f.nom) && vus.add(f.nom));
  };

  // ---------- affichage ----------
  function rendre() {
    const C = B.morceaux.filter(m => m.statut !== 'sorti'), S = B.morceaux.filter(m => m.statut === 'sorti'), O = orphelins();
    $('#biNbC').textContent = String(C.length).padStart(2, '0'); $('#biNbS').textContent = String(S.length).padStart(2, '0');
    $('#biNbR').textContent = O.length ? `(${O.length})` : '';
    $$('#biVues .chip').forEach(c => c.classList.toggle('on', c.dataset.v === B.vue));
    const liste = $('#biListe');
    if (B.vue === 'ranger') { liste.innerHTML = rendreOrphelins(O); brancherOrphelins(); return; }
    const f = BK.inv.normaliser(B.filtre);
    const l = (B.vue === 'sorti' ? S : C).filter(m => !f || BK.inv.normaliser(m.nom).includes(f)).sort((a, b) => (b.maj || '').localeCompare(a.maj || ''));
    liste.innerHTML = l.length ? l.map(fiche).join('') : `<span class="nt" style="padding:20px">${B.vue === 'sorti' ? 'Aucun morceau sorti pour l\'instant.' : 'Aucun morceau en chantier. Crée une fiche à droite, ou lance « Scanner ce PC ».'}</span>`;
    brancherFiches();
  }

  function fiche(m) {
    const ouvert = B.ouverts.has(m.id), fs = fichiersDe(m);
    const exps = fs.filter(x => x.type === 'audio').sort((a, b) => (b.modif || '').localeCompare(a.modif || ''));
    const als = fs.filter(x => x.type === 'als').sort((a, b) => (b.modif || '').localeCompare(a.modif || ''));
    const pc = Math.round(BK.pourcent(m));
    const t = (id, titre, resume, corps) => { const o = (B.tiroirs[m.id] || []).includes(id);
      return `<div class="tiroir${o ? ' ouvert' : ''}" data-t="${id}"><button class="tiroir-tete"><span class="fleche">${o ? '▾' : '▸'}</span><span class="lb">${titre}</span><span class="nt tiroir-resume">${resume}</span></button>${o ? `<div class="tiroir-corps">${corps()}</div>` : ''}</div>`; };
    return `<article class="fiche${ouvert ? ' ouverte' : ''}" data-id="${m.id}">
      <button class="fiche-tete">
        <span class="fiche-nom">${esc(m.nom)}</span>
        <span class="dymo sm">${m.statut === 'sorti' ? 'Sorti' : BK.etapes[Math.min(m.fait || 0, 5)].nom}</span>
        <span class="mini-etapes">${BK.etapes.map((e, i) => `<i class="${i < (m.fait || 0) ? 'fait' : i === (m.fait || 0) ? 'encours' : ''}" style="flex:${e.poids}"></i>`).join('')}</span>
        <span class="vfd fiche-pc">${pc} %</span><span class="fleche">${ouvert ? '▾' : '▸'}</span></button>
      ${ouvert ? `<div class="fiche-corps">
        ${t('exports', 'Exports', exps.length ? `${exps.length} fichier(s) · dernier : ${date(exps[0].modif)}` : 'aucun', () => exps.length ? exps.map((x, i) => `
          <div class="ligne-f${i === 0 ? ' recent' : ''}"><span class="etoile">${i === 0 ? '★' : ''}</span><span class="mono f-nom" title="${esc(x.chemin)}">${esc(x.nom)}</span>
            <span class="nt f-meta">${date(x.modif)} · ${esc(x.pc)}</span>
            <input class="fld f-note" data-f="${esc(x.nom)}" placeholder="note…" value="${esc((m.notesExports || {})[x.nom] || '')}">
            ${x.ici ? `<button class="btn xs" data-reel="${esc(x.chemin)}" data-nom="${esc(x.nom)}">→ Reel</button>` : ''}</div>`).join('') : '<span class="nt">Aucun export trouvé. Lance « Scanner ce PC ».</span>')}
        ${t('projets', 'Projets Ableton', als.length ? `${als.filter(x => !x.sauvegarde).length} version(s) · ${als.some(x => !x.ici && als[0] === x) ? '⚠ la plus récente n\'est pas sur ce PC' : 'à jour'}` : 'aucun', () => als.length ? als.map((x, i) => `
          <div class="ligne-f${i === 0 ? ' recent' : ''}"><span class="etoile">${i === 0 ? '★' : ''}</span><span class="mono f-nom" title="${esc(x.chemin)}">${esc(x.nom)}${x.sauvegarde ? ' <em>(sauvegarde auto)</em>' : ''}</span>
            <span class="nt f-meta">${date(x.modif)} · ${esc(x.pc)}${/[\\/]my drive[\\/]|[\\/]mon drive[\\/]|^g:/i.test(x.chemin) ? ' · Drive ✓' : ''}</span>
            ${x.ici ? `<button class="btn xs" data-ouvrir="${esc(x.chemin)}">Ouvrir</button>` : '<span class="nt f-meta">sur un autre PC</span>'}</div>`).join('') : '<span class="nt">Aucun projet trouvé. Ajoute ton dossier de projets Ableton à droite, puis « Scanner ce PC ».</span>')}
        ${t('paroles', 'Paroles', m.paroles ? m.paroles.split('\n').filter(Boolean).length + ' lignes' : 'vides', () => `
          <textarea class="fld paroles" data-champ="paroles" placeholder="[COUPLET 1]&#10;…&#10;[REFRAIN]&#10;…">${esc(m.paroles || '')}</textarea>
          <div class="chips" style="margin-top:8px"><button class="chip" data-act="plein">Plein écran</button><button class="chip" data-act="copier">Copier pour le distributeur</button></div>`)}
        ${t('infos', 'Infos', [m.bpm && m.bpm + ' BPM', m.ton, m.duree, m.sortie && 'sortie ' + m.sortie].filter(Boolean).join(' · ') || '—', () => `
          <div class="infos">
            <label><span class="eng">BPM</span><input class="fld" data-champ="bpm" value="${esc(m.bpm || '')}"></label>
            <label><span class="eng">Tonalité</span><input class="fld" data-champ="ton" value="${esc(m.ton || '')}" placeholder="ex. Mi mineur"></label>
            <label><span class="eng">Durée</span><input class="fld" data-champ="duree" value="${esc(m.duree || '')}" placeholder="3:45"></label>
            <label><span class="eng">Date de sortie</span><input class="fld" type="date" data-champ="sortie" value="${esc(m.sortie || '')}"></label>
            <label><span class="eng">Autres noms du fichier</span><input class="fld" data-champ="alias" value="${esc((m.alias || []).join(', '))}" placeholder="ex. morceauA, MorcA"></label>
          </div>`)}
        ${t('avance', 'Avancement', `${BK.etapes[Math.min(m.fait || 0, 5)].nom} · ${pc} %`, () => `
          <div class="etapes-clic">${BK.etapes.map((e, i) => `<button class="etape-b ${i < (m.fait || 0) ? 'fait' : i === (m.fait || 0) ? 'encours' : ''}" data-etape="${i}">${e.nom}</button>`).join('')}</div>
          <span class="nt">Clique sur une étape quand elle est terminée.</span>`)}
        ${t('notes', 'Notes du groupe', m.notes ? m.notes.split('\n')[0].slice(0, 50) : '—', () => `<textarea class="fld" data-champ="notes" placeholder="ex. attention au break à 2:10">${esc(m.notes || '')}</textarea>`)}
        <div class="fiche-actions">
          <button class="btn sm" data-act="statut">${m.statut === 'sorti' ? '↩ Remettre en chantier' : '✓ Marquer comme sorti'}</button>
          <button class="btn sm" data-act="renommer">Renommer</button>
          <button class="btn sm" data-act="suppr">Retirer</button></div>
      </div>` : ''}
    </article>`;
  }

  function rendreOrphelins(O) {
    if (!O.length) return '<span class="nt" style="padding:20px">Rien à ranger : tous les fichiers trouvés sont reliés à un morceau.</span>';
    const opts = B.morceaux.map(m => `<option value="${m.id}">${esc(m.nom)}</option>`).join('');
    return `<span class="nt">Fichiers trouvés mais pas encore reliés à une fiche. Relie-les à un morceau existant, ou crée une fiche.</span>` +
      O.slice(0, 300).map(f => `<div class="ligne-f orph" data-nom="${esc(f.nom)}"><span class="mono f-nom">${esc(f.nom)}</span><span class="nt f-meta">${f.type === 'als' ? 'Ableton' : 'audio'} · ${date(f.modif)} · ${esc(f.pc)}</span>
        <select class="fld f-sel"><option value="">relier à…</option>${opts}</select><button class="btn xs" data-act="creer">+ Fiche</button></div>`).join('');
  }

  // ---------- actions ----------
  async function sauver(m) { await BK.db.ecrire('morceaux', m); }
  function brancherFiches() {
    $$('.fiche', page).forEach(el => {
      const m = B.morceaux.find(x => x.id === el.dataset.id);
      $('.fiche-tete', el).onclick = () => { B.ouverts.has(m.id) ? B.ouverts.delete(m.id) : B.ouverts.add(m.id); BK.regler('biblio.ouverts', [...B.ouverts]); rendre(); };
      $$('.tiroir-tete', el).forEach(b => b.onclick = () => {
        const id = b.parentElement.dataset.t, l = B.tiroirs[m.id] = B.tiroirs[m.id] || [];
        l.includes(id) ? l.splice(l.indexOf(id), 1) : l.push(id); BK.regler('biblio.tiroirs', B.tiroirs); rendre(); });
      $$('[data-champ]', el).forEach(c => c.onchange = async () => {
        const k = c.dataset.champ; m[k] = k === 'alias' ? c.value.split(',').map(s => s.trim()).filter(Boolean) : c.value;
        await sauver(m); msg('Enregistré'); if (k === 'alias') { rendre(); } });
      $$('.f-note', el).forEach(c => c.onchange = async () => { (m.notesExports = m.notesExports || {})[c.dataset.f] = c.value; await sauver(m); msg('Note enregistrée'); });
      $$('[data-etape]', el).forEach(b => b.onclick = async () => { const i = +b.dataset.etape; m.fait = (m.fait || 0) === i + 1 ? i : i + 1; m.enCours = 0; await sauver(m); rendre(); });
      $$('[data-ouvrir]', el).forEach(b => b.onclick = async () => { try { await BK.fichier.ouvrir(b.dataset.ouvrir); msg('Ouverture dans Ableton…'); } catch (e) { msg('Impossible d\'ouvrir'); } });
      $$('[data-reel]', el).forEach(b => b.onclick = async () => {
        try { msg('Envoi vers Reels…'); const o = await BK.fichier.lireOctets(b.dataset.reel); BK.ouvrir('reels'); await BK.reelsCharger(new File([o], b.dataset.nom)); }
        catch (e) { msg('Fichier illisible'); } });
      $$('[data-act]', el).forEach(b => b.onclick = async () => {
        const a = b.dataset.act;
        if (a === 'statut') { m.statut = m.statut === 'sorti' ? 'chantier' : 'sorti'; await sauver(m); rendre(); }
        if (a === 'renommer') { const n = prompt('Nouveau nom du morceau', m.nom); if (n && n.trim()) { (m.alias = m.alias || []).push(m.nom); m.nom = n.trim(); await sauver(m); rendre(); } }
        if (a === 'suppr') { if (confirm(`Retirer « ${m.nom} » de la Bibliothèque ?\n(La fiche est rangée dans la corbeille du Drive, et aucun fichier audio ou Ableton n'est touché.)`)) { await BK.db.supprimer('morceaux', m.id); await charger(); } }
        if (a === 'copier') { await navigator.clipboard.writeText(BK.parolesPropres(m.paroles)); msg('Paroles copiées'); }
        if (a === 'plein') BK.pleinEcran(m.nom, m.paroles);
      });
    });
  }
  function brancherOrphelins() {
    $$('.orph', page).forEach(el => {
      const nom = el.dataset.nom;
      $('.f-sel', el).onchange = async e => { const m = B.morceaux.find(x => x.id === e.target.value); if (!m) return;
        (m.alias = m.alias || []).push(BK.inv.normaliser(nom)); await sauver(m); msg('Relié à ' + m.nom); rendre(); };
      $('[data-act="creer"]', el).onclick = async () => { const n = prompt('Nom du morceau', BK.inv.normaliser(nom).replace(/\b\w/g, c => c.toUpperCase())); if (!n) return;
        B.morceaux.push(await BK.db.ecrire('morceaux', { nom: n.trim(), statut: 'chantier', fait: 0 })); msg('Fiche créée'); rendre(); };
    });
  }

  $$('#biVues .chip').forEach(c => c.onclick = () => { B.vue = c.dataset.v; rendre(); });
  $('#biCherche').oninput = e => { B.filtre = e.target.value; rendre(); };
  $('#biAjout').onclick = async () => { const n = $('#biNom').value.trim(); if (!n) return;
    B.morceaux.push(await BK.db.ecrire('morceaux', { nom: n, statut: 'chantier', fait: 0 })); $('#biNom').value = ''; B.vue = 'chantier'; msg('Fiche créée'); rendre(); };
  $('#biNom').onkeydown = e => e.key === 'Enter' && $('#biAjout').click();

  function rendreDossiers() {
    const l = BK.reglage('dossiersScan', []);
    $('#biDossiers').innerHTML = (l.length ? l : []).map((d, i) => `<div class="dos"><span class="mono">${esc(d)}</span><button class="btn xs" data-i="${i}">✕</button></div>`).join('') || '<span class="nt">Aucun dossier ajouté.</span>';
    $$('#biDossiers [data-i]').forEach(b => b.onclick = () => { l.splice(+b.dataset.i, 1); BK.regler('dossiersScan', l); rendreDossiers(); });
    const ds = BK.reglage('dernierScan', ''); $('#biScanInfo').textContent = ds ? 'Ce PC : ' + new Date(ds).toLocaleString('fr-CA') : 'Ce PC n\'a pas encore été scanné.';
  }
  $('#biAjDos').onclick = async () => { if (!BK.estExe) return msg('Disponible dans le logiciel installé');
    const d = await BK.fichier.choisirDossier('Dossier à fouiller'); if (!d) return; const l = BK.reglage('dossiersScan', []); if (!l.includes(d)) l.push(d); BK.regler('dossiersScan', l); rendreDossiers(); };
  $('#biScan').onclick = async () => {
    if (!BK.estExe) return msg('Disponible dans le logiciel installé');
    if (!BK.inv.dossiers().length) return msg('Ajoute d\'abord un dossier');
    const b = $('#biScan'); b.disabled = true; b.innerHTML = '<span class="spin"></span>Scan…';
    try { const inv = await BK.inv.scanner((d, n) => msg(`${d} dossiers · ${n} fichiers`)); msg(inv.fichiers.length + ' fichiers trouvés'); await charger(); rendreDossiers(); }
    catch (e) { msg('Erreur pendant le scan'); console.error(e); }
    b.disabled = false; b.textContent = 'Scanner ce PC ▶';
  };

  rendreDossiers(); charger();
});

// ---------- paroles : version propre pour le distributeur (sans [COUPLET] etc.) ----------
BK.parolesPropres = t => String(t || '').split('\n').filter(l => !/^\s*\[.*\]\s*$/.test(l)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
BK.pleinEcran = function (titre, texte) {
  const v = document.createElement('div'); v.className = 'voile plein';
  v.innerHTML = `<div class="plein-txt"><span class="dymo">${esc(titre)}</span><pre>${esc(texte || '')}</pre></div><button class="btn sm plein-x">✕ Fermer</button>`;
  document.body.appendChild(v); const fermer = () => v.remove();
  $('.plein-x', v).onclick = fermer; document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { fermer(); document.removeEventListener('keydown', k); } });
};

// ---------- exemples (seulement dans l'aperçu navigateur, jamais dans le .exe) ----------
async function exemples() {
  const l = [
    { nom: 'Morceau A', statut: 'chantier', fait: 2, bpm: '92', ton: 'Mi mineur', paroles: '[COUPLET 1]\nPremière ligne d\'exemple\nDeuxième ligne\n\n[REFRAIN]\nLe refrain d\'exemple' },
    { nom: 'Morceau B', statut: 'chantier', fait: 5, bpm: '104' },
    { nom: 'Morceau C', statut: 'sorti', fait: 6, sortie: '2026-09-12' },
  ];
  const out = []; for (const m of l) out.push(await BK.db.ecrire('morceaux', m));
  await BK.db.ecrire('inventaires', { id: 'pc-exemple', pc: 'STUDIO', fichiers: [
    { type: 'audio', nom: 'MorceauA_Mix_v3.wav', chemin: 'E:\\exemple\\MorceauA_Mix_v3.wav', modif: '2026-10-18T10:00:00Z' },
    { type: 'audio', nom: 'MorceauA_Demo.wav', chemin: 'E:\\exemple\\MorceauA_Demo.wav', modif: '2026-09-15T10:00:00Z' },
    { type: 'als', nom: 'Morceau A v8.als', chemin: 'E:\\exemple\\Morceau A v8.als', modif: '2026-10-19T10:00:00Z' },
    { type: 'als', nom: 'Morceau A v7.als', chemin: 'G:\\Mon Drive\\BEESKOT\\Morceau A v7.als', modif: '2026-10-12T10:00:00Z' },
    { type: 'audio', nom: 'Jam_du_jeudi.wav', chemin: 'E:\\exemple\\Jam_du_jeudi.wav', modif: '2026-10-02T10:00:00Z' },
  ] });
  return out;
}
})();
