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
          <span class="nt">Pour chaque dossier, clique sur l'étiquette pour choisir : exports audio (WAV / MP3) ou projets Ableton.</span>
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
    remplirDrive();
  }

  // ---------- fichiers du Drive qui parlent de ce morceau (ex. zips du bot Discord) ----------
  const trouves = {};
  async function remplirDrive() {
    for (const el of $$('.drive-res', page)) {
      const m = B.morceaux.find(x => x.id === el.dataset.m); if (!m) continue;
      try {
        if (!trouves[m.id]) {
          const mots = BK.inv.normaliser(m.nom).split(' ').sort((a, b) => b.length - a.length);
          const l = await BK.drive.chercher([mots[0] || m.nom]);
          trouves[m.id] = l.filter(f => BK.inv.trouverMorceau(f.name, [m]) === m && !/\.json$/.test(f.name));
        }
        const l = trouves[m.id];
        el.innerHTML = l.length ? l.map(f => `<div class="ligne-f"><span class="etoile">${/zip/i.test(f.name) ? '🗜' : /\.(wav|mp3)$/i.test(f.name) ? '♪' : /\.als$/i.test(f.name) ? '▤' : '📄'}</span>
            <a href="#" class="f-nom lien" data-url="${esc(f.webViewLink)}">${esc(f.name)}</a><span class="nt f-meta">${date(f.modifiedTime)}${f.size ? ' · ' + (f.size / 1e6).toFixed(0) + ' Mo' : ''}</span>
            ${/\.(wav|mp3)$/i.test(f.name) ? `<button class="btn xs" data-dreel="${f.id}" data-nom="${esc(f.name)}">→ Reel</button>` : ''}</div>`).join('')
          : '<span class="nt">Rien trouvé dans le Drive pour ce morceau.</span>';
        $$('.lien', el).forEach(a => a.onclick = e => { e.preventDefault(); BK.ouvrirLien(a.dataset.url); });
        $$('[data-dreel]', el).forEach(b => b.onclick = async () => { try { msg('Téléchargement depuis le Drive…'); const o = await BK.drive.telecharger(b.dataset.dreel); BK.ouvrir('reels'); await BK.reelsCharger(new File([o], b.dataset.nom)); } catch (e) { msg('Téléchargement impossible'); } });
      } catch (e) { el.innerHTML = '<span class="nt">Drive injoignable pour l\'instant.</span>'; }
    }
  }

  function fiche(m) {
    const ouvert = B.ouverts.has(m.id), fs = fichiersDe(m);
    const exps = BK.inv.exportsDe(m, B.fichiers, B.morceaux);
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
        ${t('exports', 'Exports', exps.length ? `${exps.length} fichier(s) · principal : ${esc(exps[0].nom)}` : 'aucun', () => (exps.length ? exps.map((x, i) => `
          <div class="ligne-f${i === 0 ? ' recent' : ''}"><button class="etoile etoile-b${i === 0 ? ' on' : ''}" data-princ="${esc(x.chemin)}" title="${i === 0 ? 'Version principale' : 'En faire la version principale'}">${i === 0 ? '★' : '☆'}</button>
            <span class="mono f-nom" title="${esc(x.chemin)}">${esc(x.nom)}</span>
            <span class="nt f-meta">${date(x.modif)} · ${esc(x.pc)}${x.manuel ? ' · ajouté à la main' : ''}</span>
            <input class="fld f-note" data-f="${esc(x.nom)}" placeholder="note…" value="${esc((m.notesExports || {})[x.nom] || '')}">
            ${x.ici ? `<button class="btn xs" data-reel="${esc(x.chemin)}" data-nom="${esc(x.nom)}">→ Reel</button>` : ''}
            <button class="btn xs" data-remplacer="${esc(x.chemin)}" title="Choisir une autre version à la place">Remplacer…</button>
            <button class="btn xs" data-expx="${esc(x.chemin)}" title="Retirer de la fiche (le fichier n'est pas effacé)">✕</button></div>`).join('') : '<span class="nt">Aucun export trouvé. Lance « Scanner ce PC », ou ajoute-le à la main.</span>')
          + ((m.exportsDiscord || []).length ? `<span class="nt" style="margin-top:8px">Vu sur Discord (Le Veilleur) :</span>` + m.exportsDiscord.slice(0, 5).map(x => `<div class="ligne-f"><span class="etoile">💬</span><span class="mono f-nom">${esc(x.fichier || '—')}</span>
            <span class="nt f-meta">${x.date ? date(x.date) : ''}${x.detail ? ' · ' + esc(x.detail) : ''}</span>${x.lien ? `<a href="#" class="lien btn xs" data-url="${esc(x.lien)}">voir</a>` : ''}</div>`).join('') : '')
          + `<div class="chips" style="margin-top:8px"><button class="chip" data-act="ajexport">+ Ajouter un export…</button></div>`)}
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
        ${t('liens', 'Drive', ((m.liens || []).length ? m.liens.length + ' lien(s)' : '') + (BK.drive.relie() ? ' · recherche dans le Drive' : ''), () => `
          ${BK.drive.relie() ? `<div class="drive-res" data-m="${m.id}"><span class="nt"><span class="spin"></span>Recherche dans le Drive…</span></div>` : ''}
          ${(m.liens || []).map((l, i) => `<div class="ligne-f"><span class="etoile">🔗</span><a href="#" class="f-nom lien" data-url="${esc(l.url)}" title="${esc(l.url)}">${esc(l.titre || l.url)}</a><button class="btn xs" data-lienx="${i}">✕</button></div>`).join('')}
          <div class="lien-aj"><input class="fld" data-lien="titre" placeholder="ex. Projet Ableton v8 (zipper)"><input class="fld" data-lien="url" placeholder="colle le lien Google Drive…"><button class="btn xs" data-act="lien">+ Ajouter</button></div>
          ${BK.drive.relie() ? '' : '<span class="nt">Relie le Drive (Réglages) : les fichiers déposés dans le Drive, par ex. par le zipper Discord, apparaîtront ici tout seuls.</span>'}`)}
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
    return `<div class="ligne-titre"><span class="nt" style="margin:0">Fichiers trouvés mais pas encore reliés à une fiche. Relie-les à un morceau existant, ou crée une fiche.</span>
      <button class="btn sm pri" id="biTout" style="margin-left:auto;flex:none">Créer toutes les fiches d'un coup…</button></div>` +
      O.slice(0, 300).map(f => `<div class="ligne-f orph" data-nom="${esc(f.nom)}"><span class="mono f-nom">${esc(f.nom)}</span><span class="nt f-meta">${f.type === 'als' ? 'Ableton' : 'audio'} · ${date(f.modif)} · ${esc(f.pc)}</span>
        <select class="fld f-sel"><option value="">relier à…</option>${opts}</select><button class="btn xs" data-act="creer">+ Fiche</button></div>`).join('');
  }

  // ---------- actions ----------
  async function sauver(m) { await BK.db.ecrire('morceaux', m); }
  async function choisirExport() {                 // choisir un WAV / MP3 sur ce PC
    if (!BK.estExe) { msg('Disponible dans le logiciel installé'); return null; }
    const p = await BK.fichier.choisirFichier('Choisis l\'export (WAV ou MP3)', [{ name: 'Audio', extensions: ['wav', 'mp3', 'WAV', 'MP3'] }]); if (!p) return null;
    let modif = new Date().toISOString(); try { const st = await BK.fichier.infos(p); if (st && st.mtime) modif = new Date(st.mtime).toISOString(); } catch (e) {}
    return { chemin: p, nom: p.split(/[\\/]/).pop(), pc: BK.inv.monPc(), modif };
  }
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
      $$('.lien', el).forEach(a => a.onclick = e => { e.preventDefault(); BK.ouvrirLien(a.dataset.url); });
      $$('[data-princ]', el).forEach(b => b.onclick = async () => { m.exportPrincipal = b.dataset.princ; await sauver(m); msg('Version principale choisie'); rendre(); });
      $$('[data-expx]', el).forEach(b => b.onclick = async () => {
        const c = b.dataset.expx; m.exportsManuels = (m.exportsManuels || []).filter(f => f.chemin !== c);
        if (B.fichiers.some(f => f.chemin === c)) (m.exportsCaches = m.exportsCaches || []).push(c);
        if (m.exportPrincipal === c) m.exportPrincipal = ''; await sauver(m); msg('Retiré de la fiche'); rendre(); });
      $$('[data-remplacer]', el).forEach(b => b.onclick = async () => {
        const f = await choisirExport(); if (!f) return; const c = b.dataset.remplacer;
        m.exportsManuels = (m.exportsManuels || []).filter(x => x.chemin !== c && x.chemin !== f.chemin);
        if (B.fichiers.some(x => x.chemin === c)) (m.exportsCaches = m.exportsCaches || []).push(c);
        m.exportsManuels.push(f); m.exportPrincipal = f.chemin; await sauver(m); msg('Export remplacé'); rendre(); });
      $$('[data-lienx]', el).forEach(b => b.onclick = async () => { m.liens.splice(+b.dataset.lienx, 1); await sauver(m); rendre(); });
      $$('[data-act]', el).forEach(b => b.onclick = async () => {
        const a = b.dataset.act;
        if (a === 'statut') { m.statut = m.statut === 'sorti' ? 'chantier' : 'sorti'; await sauver(m); rendre(); }
        if (a === 'renommer') { const n = prompt('Nouveau nom du morceau', m.nom); if (n && n.trim()) { (m.alias = m.alias || []).push(m.nom); m.nom = n.trim(); await sauver(m); rendre(); } }
        if (a === 'suppr') { if (confirm(`Retirer « ${m.nom} » de la Bibliothèque ?\n(La fiche est rangée dans la corbeille du Drive, et aucun fichier audio ou Ableton n'est touché.)`)) { await BK.db.supprimer('morceaux', m.id); await charger(); } }
        if (a === 'ajexport') { const f = await choisirExport(); if (!f) return; m.exportsManuels = (m.exportsManuels || []).filter(x => x.chemin !== f.chemin); m.exportsManuels.push(f);
          m.exportsCaches = (m.exportsCaches || []).filter(c => c !== f.chemin); await sauver(m); msg('Export ajouté'); rendre(); }
        if (a === 'copier') { await navigator.clipboard.writeText(BK.parolesPropres(m.paroles)); msg('Paroles copiées'); }
        if (a === 'plein') BK.pleinEcran(m.nom, m.paroles);
        if (a === 'lien') { const u = $('[data-lien="url"]', el).value.trim(); if (!/^https?:\/\//i.test(u)) return msg('Colle un lien qui commence par https://');
          (m.liens = m.liens || []).push({ titre: $('[data-lien="titre"]', el).value.trim(), url: u }); await sauver(m); msg('Lien ajouté'); rendre(); }
      });
    });
  }
  function brancherOrphelins() {
    const bt = $('#biTout', page); if (bt) bt.onclick = creerTout;
    $$('.orph', page).forEach(el => {
      const nom = el.dataset.nom;
      $('.f-sel', el).onchange = async e => { const m = B.morceaux.find(x => x.id === e.target.value); if (!m) return;
        (m.alias = m.alias || []).push(BK.inv.normaliser(nom)); await sauver(m); msg('Relié à ' + m.nom); rendre(); };
      $('[data-act="creer"]', el).onclick = async () => { const n = prompt('Nom du morceau', BK.inv.normaliser(nom).replace(/\b\w/g, c => c.toUpperCase())); if (!n) return;
        B.morceaux.push(await BK.db.ecrire('morceaux', { nom: n.trim(), statut: 'chantier', fait: 0 })); msg('Fiche créée'); rendre(); };
    });
  }

  // ---------- regrouper les fichiers « à ranger » par nom de morceau, puis créer les fiches cochées ----------
  function creerTout() {
    const groupes = {};
    for (const f of orphelins()) { const k = BK.inv.normaliser(f.nom); if (k.length < 3) continue; (groupes[k] = groupes[k] || []).push(f); }
    const l = Object.entries(groupes).sort((a, b) => b[1].length - a[1].length);
    if (!l.length) return msg('Aucun nom de morceau reconnu');
    const v = document.createElement('div'); v.className = 'voile';
    v.innerHTML = `<div class="stopbox" style="width:640px;max-height:80vh;align-items:stretch">
      <span class="dymo" style="align-self:center">Créer les fiches</span>
      <span class="nt">Décoche ce qui n'est pas un morceau, corrige les noms si besoin.</span>
      <div class="tout-liste">${l.map(([k, fs], i) => `<label class="tout-l"><input type="checkbox" checked data-i="${i}">
        <input class="fld" value="${esc(k.replace(/\b\w/g, c => c.toUpperCase()))}" data-n="${i}"><span class="nt" style="margin:0;white-space:nowrap">${fs.length} fichier(s)</span></label>`).join('')}</div>
      <div class="stopbox-btns"><button class="btn pri" id="toutOk">Créer les fiches cochées</button><button class="btn" id="toutNon">Annuler</button></div></div>`;
    document.body.appendChild(v);
    $('#toutNon', v).onclick = () => v.remove();
    $('#toutOk', v).onclick = async () => {
      let n = 0;
      for (const [i, [k]] of l.entries()) { if (!$(`[data-i="${i}"]`, v).checked) continue;
        const nom = $(`[data-n="${i}"]`, v).value.trim(); if (!nom) continue;
        const ex = B.morceaux.find(m => BK.inv.normaliser(m.nom) === BK.inv.normaliser(nom));
        if (ex) { (ex.alias = ex.alias || []).push(k); await sauver(ex); }
        else { B.morceaux.push(await BK.db.ecrire('morceaux', { nom, alias: [k], statut: 'chantier', fait: 0 })); n++; } }
      v.remove(); msg(n + ' fiche(s) créée(s)'); B.vue = 'chantier'; rendre();
    };
  }

  $$('#biVues .chip').forEach(c => c.onclick = () => { B.vue = c.dataset.v; rendre(); });
  $('#biCherche').oninput = e => { B.filtre = e.target.value; rendre(); };
  $('#biAjout').onclick = async () => { const n = $('#biNom').value.trim(); if (!n) return;
    B.morceaux.push(await BK.db.ecrire('morceaux', { nom: n, statut: 'chantier', fait: 0 })); $('#biNom').value = ''; B.vue = 'chantier'; msg('Fiche créée'); rendre(); };
  $('#biNom').onkeydown = e => e.key === 'Enter' && $('#biAjout').click();

  function rendreDossiers() {
    const l = BK.inv.dossiers();
    $('#biDossiers').innerHTML = l.map((d, i) => `<div class="dos"><span class="mono" title="${esc(d.chemin)}">${esc(d.chemin)}</span>
        <button class="chip dos-type" data-t="${i}" title="Cliquer pour changer">${d.type === 'als' ? 'Projets Ableton (.als)' : 'Exports audio (WAV / MP3)'}</button>
        <button class="btn xs" data-i="${i}">✕</button></div>`).join('') || '<span class="nt">Aucun dossier ajouté.</span>';
    const sauverL = () => { BK.regler('dossiersScan', l); rendreDossiers(); };
    $$('#biDossiers [data-i]').forEach(b => b.onclick = () => { l.splice(+b.dataset.i, 1); sauverL(); });
    $$('#biDossiers [data-t]').forEach(b => b.onclick = () => { const d = l[+b.dataset.t]; d.type = d.type === 'als' ? 'audio' : 'als'; sauverL(); });
    const ds = BK.reglage('dernierScan', ''); $('#biScanInfo').textContent = ds ? 'Ce PC : ' + new Date(ds).toLocaleString('fr-CA') : 'Ce PC n\'a pas encore été scanné.';
  }
  $('#biAjDos').onclick = async () => { if (!BK.estExe) return msg('Disponible dans le logiciel installé');
    const d = await BK.fichier.choisirDossier('Dossier à fouiller'); if (!d) return;
    const l = BK.inv.dossiers(); if (!l.some(x => x.chemin === d)) l.push({ chemin: d, type: /ableton|projet|project/i.test(d) ? 'als' : 'audio' });
    BK.regler('dossiersScan', l); rendreDossiers(); msg('Clique sur l\'étiquette pour choisir : exports audio ou projets Ableton'); };
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

})();
