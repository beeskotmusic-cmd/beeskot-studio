// =====================================================================
// BIBLIOTHÈQUE — une fiche par morceau, avec des tiroirs à déplier :
// exports, projets Ableton, paroles, partitions, infos, progression, notes.
// Sous-onglets : En chantier / Sortis / À ranger (fichiers pas encore reliés).
// =====================================================================
(() => {
const B = { vue: BK.reglage('biblio.vue', 'prochaine'), ouverts: new Set(BK.reglage('biblio.ouverts', [])), tiroirs: BK.reglage('biblio.tiroirs', {}), morceaux: [], fichiers: [], filtre: '' };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const date = iso => iso ? new Date(iso).toLocaleDateString('fr-CA', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase() : '—';

BK.module('biblio', function (page) {
  $('.sub', page).textContent = 'Tous vos morceaux : exports, projets Ableton, paroles, avancement';
  $('.hdr .right', page).innerHTML = `
    <div><span class="eng" style="font-size:9px">En chantier</span><span class="vfd" id="biNbC">00</span></div>
    <div><span class="eng" style="font-size:9px">Sortis</span><span class="vfd" id="biNbS">00</span></div>`;
  $('.grid', page).innerHTML = `
    <div class="cols">
      <section class="pane vit" aria-label="Vitrine">
        <div class="ligne-titre">
          <div class="chips" id="biVues"><button class="chip on" data-v="prochaine">Next release</button><button class="chip" data-v="chantier">Work in progress</button><button class="chip" data-v="sorti">Sortis</button><button class="chip" data-v="ranger">À ranger <span id="biNbR"></span></button></div>
          <input class="fld" id="biCherche" placeholder="chercher un morceau…" style="max-width:240px;margin-left:auto">
        </div>
        <div id="biListe" class="bi-liste"></div>
      </section>
      <section class="pane reg" aria-label="Réglages"><span class="ptitle">② Réglages</span>
        <div class="box"><span class="lb">🍞 Vérifier avec Miette</span>
          <span class="nt">Miette relit Discord : les BPM et tonalités que vous avez écrits passent devant ce qui a été deviné.</span>
          <button class="btn sm miette-aide" id="biVerif" style="margin-top:10px">Vérifier les infos des morceaux</button></div>
        <div class="box"><span class="lb">Nouveau morceau</span>
          <input class="fld" id="biNom" style="margin-top:10px" placeholder="nom du morceau">
          <div class="chips" style="margin-top:10px"><button class="chip" id="biAjout">+ Créer la fiche</button></div></div>
        <div class="box"><span class="lb">Dossiers de ce PC à fouiller <small class="nt" style="margin:0">(facultatif)</small></span>
          <span class="nt">Le Drive est lu tout seul : c'est là que tout devrait être. Ce PC sert seulement pour des fichiers pas encore dans le Drive. Clique l'étiquette d'un dossier pour choisir : exports audio ou projets Ableton.</span>
          <div id="biDossiers" class="bi-dossiers"></div>
          <div class="chips" style="margin-top:10px"><button class="chip" id="biAjDos">+ Ajouter un dossier</button><button class="chip" id="biScan" title="Cherche les exports et les projets Ableton dans les dossiers ci-dessus">Scanner ce PC</button></div>
          <span class="nt" id="biScanInfo" style="margin-top:6px">—</span></div>
      </section>
    </div>
    <div class="pane abar" aria-label="Barre">
      <span class="vfd" id="biMsg">PRÊT</span>
      <div class="right"><button class="btn" id="biDrive" title="Relit les dossiers du Drive BEESKOT (exports, projets)">↻ Relire le Drive</button></div></div>`;

  const msg = t => $('#biMsg').textContent = String(t).toUpperCase();

  // ---------- 🍞 vérifier les infos (BPM, tonalité) avec ce qui a été dit sur Discord ----------
  $('#biVerif').onclick = async () => {
    const b = $('#biVerif'); b.disabled = true; b.innerHTML = '<span class="spin"></span>Miette relit Discord…';
    let l = [];
    try { l = await BK.miette.infosDiscord(); } catch (e) { msg('Impossible : ' + (e.message || e)); }
    b.disabled = false; b.textContent = 'Vérifier les infos des morceaux';
    const src = { nous: 'écrit dans la fiche', ableton: 'lu dans Ableton', detecte: 'deviné', discord: 'déjà repris de Discord' };
    const diff = [];
    for (const o of l) for (const [k, nom] of [['bpm', 'BPM'], ['ton', 'Tonalité']]) {
      if (!o[k] || String(o.m[k] || '') === o[k].v) continue;
      diff.push({ o, k, nom, avant: o.m[k] || '—', apres: o[k].v, d: k === 'bpm' ? o.m.bpmSource : o.m.tonSource, l: o[k].l });
    }
    if (!diff.length) return msg(l.length ? 'Tout est déjà juste ✓' : 'Rien trouvé sur Discord (BPM, tonalité)');
    const v = document.createElement('div'); v.className = 'voile';
    v.innerHTML = `<div class="stopbox" style="width:640px;align-items:stretch">
      <span class="screw tl"></span><span class="screw tr"></span><span class="screw bl"></span><span class="screw br"></span>
      <span class="dymo" style="align-self:center">🍞 Ce que vous avez dit sur Discord</span>
      <div class="verif-l">${diff.map((x, i) => `<label class="verif"><input type="checkbox" data-v="${i}"${x.d === 'nous' ? '' : ' checked'}>
        <span><b>${esc(x.o.m.nom)}</b> · ${x.nom} : <s>${esc(x.avant)}</s> <span class="nt" style="margin:0">(${src[x.d] || 'deviné'})</span> → <b class="verif-n">${esc(x.apres)}</b>
        <span class="nt" style="margin:2px 0 0;display:block">« ${esc(String(x.l.txt || '').slice(0, 120))} »${x.l.qui ? ' — ' + esc(x.l.qui) : ''}${x.l.t ? ', ' + esc(String(x.l.t).slice(0, 10)) : ''}</span></span></label>`).join('')}</div>
      <span class="nt">Décoché : ce que vous aviez écrit vous-mêmes dans la fiche. Coche si Discord a raison.</span>
      <div class="stopbox-btns"><button class="btn pri" id="vfOk">Mettre à jour les fiches</button><button class="btn" id="vfNon">Annuler</button></div></div>`;
    document.body.appendChild(v);
    v.querySelector('#vfNon').onclick = () => v.remove();
    v.querySelector('#vfOk').onclick = async () => {
      const choisis = [...v.querySelectorAll('[data-v]:checked')].map(c => diff[+c.dataset.v]); v.remove();
      for (const x of choisis) { const m = x.o.m; m[x.k] = x.apres; if (x.k === 'bpm') m.bpmSource = 'discord'; else m.tonSource = 'discord'; await sauver(m); }
      msg(choisis.length + ' info(s) mise(s) à jour depuis Discord'); rendre();
    };
  };

  // ---------- chargement ----------
  window.addEventListener('bk:annule', () => charger());
  window.addEventListener('bk:distant', e => { if (e.detail.cols.includes('morceaux')) charger(); });   // un autre PC a changé une fiche   // après « ↶ Annuler » : on relit
  async function charger() {
    B.morceaux = await BK.db.liste('morceaux');
    B.fichiers = await BK.inv.tous();
    B.notesmix = await BK.db.liste('notesmix').catch(() => []);      // les retours d'Écoute (notes minutées), rangés par version dans chaque fiche
    rendre();
  }
  BK.biblioRecharger = charger;

  // fichiers liés à un morceau
  const fichiersDe = m => B.fichiers.filter(f => BK.inv.trouverMorceau(f.nom, [m]) && BK.inv.trouverMorceau(f.nom, B.morceaux) === m);
  const orphelins = () => {
    const vus = new Set(), ign = new Set(BK.reglage('biblio.ignores', []));     // les projets perso retirés (sur ce PC)
    return B.fichiers.filter(f => !BK.inv.trouverMorceau(f.nom, B.morceaux) && !f.sauvegarde && !ign.has(f.nom) && !vus.has(f.nom) && vus.add(f.nom));
  };

  // ---------- affichage ----------
  function rendre() {
    const C = B.morceaux.filter(m => m.statut !== 'sorti'), S = B.morceaux.filter(m => m.statut === 'sorti'), O = orphelins();
    $('#biNbC').textContent = String(C.length).padStart(2, '0'); $('#biNbS').textContent = String(S.length).padStart(2, '0');
    $('#biNbR').textContent = O.length ? `(${O.length})` : '';
    $$('#biVues .chip').forEach(c => c.classList.toggle('on', c.dataset.v === B.vue));
    const liste = $('#biListe');
    if (B.vue === 'ranger') { liste.innerHTML = '<div id="biDriveNeufs"></div>' + rendreOrphelins(O); brancherOrphelins(); neufsDuDrive(); return; }
    const f = BK.inv.normaliser(B.filtre);
    const auj = new Date().toISOString().slice(0, 10), prochaine = m => m.statut === 'prochaine' || (m.statut !== 'sorti' && m.sortie && m.sortie >= auj);
    const P = C.filter(prochaine), W = C.filter(m => !prochaine(m));
    // l'ordre : celui qu'on a choisi à la main (rang), sinon le plus récemment touché
    const l = (B.vue === 'sorti' ? S : B.vue === 'prochaine' ? P : W).filter(m => !f || BK.inv.normaliser(m.nom).includes(f))
      .sort((a, b) => (a.rang ?? 1e9) - (b.rang ?? 1e9)          // l'ordre choisi à la main d'abord…
        || (Math.min(b.fait || 0, 5) - Math.min(a.fait || 0, 5))   // …sinon le morceau le plus avancé en haut
        || (b.maj || '').localeCompare(a.maj || ''));
    B.affiches = l;
    liste.innerHTML = l.length ? l.map(fiche).join('') : `<span class="nt" style="padding:20px">${B.vue === 'sorti' ? 'Aucun morceau sorti pour l\'instant.' : B.vue === 'prochaine' ? 'Aucun morceau prévu pour la prochaine sortie. Ouvre une fiche et clique « ⭐ Next release ».' : 'Aucun morceau en chantier. Crée une fiche à droite (les fichiers du Drive se relient tout seuls).'}</span>`;
    brancherFiches(); lecteur.maj();
    remplirDrive();
  }

  // ---------- fichiers du Drive de ce morceau (par son nom, son dossier ou son étiquette), rangés par dossier du groupe ----------
  const trouves = {};
  const SECTIONS = [['cl', 'Exports clean (CL)'], ['mix', 'Mix et masters (Recording)'], ['ableton', 'Projets Ableton'], ['wavtournage', 'WAV de tournage'], ['medias', 'Photos et vidéos'], ['ailleurs', 'Ailleurs dans le Drive']];
  const ROLE_SECTION = { recording: 'mix', ableton: 'ableton', cl: 'cl', wavtournage: 'wavtournage', photovideo: 'medias', moodboard: 'medias', tournage: 'medias', outfits: 'medias', scenographie: 'medias' };
  const sectionsFermees = BK.reglage('biblio.sections', {});
  const icone = n => /\.(zip|rar|7z)$/i.test(n) ? '🗜' : /\.(wav|mp3|aiff?|flac)$/i.test(n) ? '♪' : /\.als$/i.test(n) ? '▤' : /\.(jpe?g|png|webp|heic|gif)$/i.test(n) ? '🖼' : /\.(mp4|mov|m4v)$/i.test(n) ? '🎬' : /\.pdf$/i.test(n) ? '📕' : '📄';
  const trierStems = l => BK.trierStems(l);
  async function fichiersDrive(m) {
    await BK.dossiers.assurer();
    const l = trierStems(await BK.dossiers.duMorceau(m, B.morceaux)), parts = {};
    for (const f of l) { const k = ROLE_SECTION[f.role] || (f.groupe ? 'stems' : 'ailleurs'); (parts[k] = parts[k] || []).push(f); }
    for (const f of l) if (f.groupe) { f.role = f.role || ''; }
    return [...SECTIONS, ['stems', 'Stems (pistes séparées)']].filter(([k]) => parts[k]).map(([k, titre]) => ({ k, titre, l: parts[k] }));
  }
  window.addEventListener('bk:change', e => { if (e.detail.col === 'config' && /etiquettes|dossiers/.test(e.detail.id)) for (const k in trouves) delete trouves[k]; });
  BK.biblioDrive = async m => {                                   // pour le lecteur et l'analyse (gardé 10 min)
    const x = trouves[m.id]; if (x && Date.now() - x.t < 10 * 60e3) return x.l;
    const l = await fichiersDrive(m); trouves[m.id] = { t: Date.now(), l }; return l;
  };
  // les exports du Drive (CL, mix, masters) dans le tiroir Exports, avec ☆ pour en faire la version principale
  async function remplirExportsDrive() {
    for (const el of $$('.exp-drive', page)) {
      const m = B.morceaux.find(x => x.id === el.dataset.m); if (!m) continue;
      try {
        const parts = await BK.biblioDrive(m); if (!el.isConnected) continue;
        const deja = new Set((m.exportsManuels || []).filter(x => x.drive).map(x => x.driveId));
        const l = parts.filter(p => p.k === 'cl' || p.k === 'mix' || p.k === 'ailleurs').flatMap(p => p.l).filter(f => !f.groupe && /\.(wav|mp3|aiff?|flac)$/i.test(f.name) && !/tournage/i.test(f.name) && !deja.has(f.id))
          .sort((a, b) => (b.modifiedTime || '').localeCompare(a.modifiedTime || ''));
        el.innerHTML = l.length ? `<span class="nt drive-sec" style="cursor:default">☁ Dans le Drive (${l.length})</span>` + l.slice(0, 15).map(f => `<div class="ligne-f">
            <button class="etoile etoile-b" data-dprinc="${f.id}" data-nom="${esc(f.name)}" data-t="${esc(f.modifiedTime || '')}" title="En faire la version principale">☆</button>
            <a href="#" class="mono f-nom lien" data-url="${esc(f.webViewLink)}">${esc(f.name)}</a>
            <span class="nt f-chemin">📁 ${esc((f.dossiers || []).map(BK.dossiers.joli).join(' / '))}</span><span class="nt f-meta">${date(f.modifiedTime)}</span>
            <button class="btn xs" data-ecoute="${f.id}" data-nom="${esc(f.name)}" title="Écouter">▶</button><button class="btn xs" data-dreel="${f.id}" data-nom="${esc(f.name)}">→ Reel</button></div>`).join('')
          : (deja.size ? '' : '<span class="nt">Aucun export de ce morceau dans le Drive (CL, mix, masters).</span>');
        $$('.lien', el).forEach(a => a.onclick = e => { e.preventDefault(); BK.ouvrirLien(a.dataset.url); });
        $$('[data-ecoute]', el).forEach(b => b.onclick = () => lecteur.jouer(m, { drive: b.dataset.ecoute, nom: b.dataset.nom }));
        $$('[data-dreel]', el).forEach(b => b.onclick = async () => { try { msg('Téléchargement depuis le Drive…'); const o = await BK.drive.telecharger(b.dataset.dreel); BK.ouvrir('reels'); await BK.reelsCharger(new File([o], b.dataset.nom)); } catch (e) { msg('Téléchargement impossible'); } });
        $$('[data-dprinc]', el).forEach(b => b.onclick = async () => {
          const x = { chemin: 'drive:' + b.dataset.dprinc, driveId: b.dataset.dprinc, drive: true, nom: b.dataset.nom, pc: 'Drive', modif: b.dataset.t || new Date().toISOString() };
          m.exportsManuels = (m.exportsManuels || []).filter(y => y.chemin !== x.chemin); m.exportsManuels.push(x); m.exportPrincipal = x.chemin;
          await sauver(m); msg('Version principale : ' + x.nom); rendre(); });
      } catch (e) { el.innerHTML = '<span class="nt">Drive injoignable pour l\'instant.</span>'; }
    }
  }
  async function remplirDrive() {
    remplirExportsDrive();
    for (const el of $$('.drive-res', page)) {
      const m = B.morceaux.find(x => x.id === el.dataset.m); if (!m) continue;
      try {
        const brut = await BK.biblioDrive(m), tags = await BK.etiquettes.tous().catch(() => ({}));
        if (!el.isConnected) continue;
        // on range par ce que c'est, pas par dossier du Drive
        const tous = brut.flatMap(p => p.l), vus = new Set(), G = { audio: [], ableton: [], medias: [], autres: [] };
        for (const f of tous) { if (vus.has(f.id)) continue; vus.add(f.id);
          const n = f.name || '';
          const k = f.groupe ? 'audio' : /\.(wav|mp3|aiff?|flac|m4a)$/i.test(n) ? 'audio' : /\.(als|alp|zip)$/i.test(n) || f.role === 'ableton' ? 'ableton'
            : /^(image|video)\//.test(f.mimeType || '') ? 'medias' : 'autres';
          G[k].push(f); }
        const parts = [['audio', '🎵 Audio (exports, mix, WAV tournage, stems)'], ['ableton', '🎛 Projets Ableton'], ['medias', '🖼 Photos et vidéos'], ['autres', '📄 Autres']]
          .filter(([k]) => G[k].length).map(([k, titre]) => ({ k, titre, l: G[k].sort((a, b) => (b.modifiedTime || '').localeCompare(a.modifiedTime || '')) }));
        const puces = f => { const l = BK.etiquettes.liste(tags, f.id).filter(x => /^[a-z]:/.test(x) && x !== 'c:masque');
          return l.map(x => `<em class="etq" style="--tc:${BK.couleurTag(x)}">${esc(BK.nomTag(x) || x.replace(/^[a-z]:/, ''))}</em>`).join(''); };
        el.innerHTML = parts.length ? parts.map(p => `<div class="drive-bloc${sectionsFermees[p.k] ? ' ferme' : ''}" data-sec="${p.k}">
            <button class="drive-sec"><span class="fleche">${sectionsFermees[p.k] ? '▸' : '▾'}</span>${p.titre} <em>(${p.l.length})</em></button>
            <div class="drive-l">${p.l.slice(0, 30).map((f, i) => f.groupe ? `<div class="ligne-f"><span class="etoile">🎚</span>
              <a href="#" class="f-nom lien" data-url="https://drive.google.com/drive/folders/${f.id}">Stems : ${f.n} fichier(s)</a>
              <span class="nt f-chemin">📁 ${esc((f.dossiers || []).map(BK.dossiers.joli).join(' / '))}</span><span class="nt f-meta">ouvrir le dossier</span></div>`
              : `<div class="ligne-f${i === 0 ? ' recent' : ''}"><span class="etoile">${i === 0 ? '★' : icone(f.name)}</span>
              <a href="#" class="f-nom lien" data-url="${esc(f.webViewLink)}" title="${esc([...(f.dossiers || []), f.name].join(' / '))}">${esc(f.name)}</a><span class="etqs">${puces(f)}</span>
              ${true ? `<span class="nt f-chemin" title="${esc((f.dossiers || []).join(' / '))}">📁 ${esc((f.dossiers || []).map(BK.dossiers.joli).join(' / ') || 'Mon Drive')}</span>` : ''}
              <span class="nt f-meta">${date(f.modifiedTime)}${f.size ? ' · ' + Math.max(1, Math.round(f.size / 1e6)) + ' Mo' : ''}</span>
              ${/\.(wav|mp3)$/i.test(f.name) ? `<button class="btn xs" data-ecoute="${f.id}" data-nom="${esc(f.name)}" title="Écouter">▶</button><button class="btn xs" data-dreel="${f.id}" data-nom="${esc(f.name)}">→ Reel</button>` : ''}</div>`).join('')}
              ${p.l.length > 30 ? `<span class="nt">… et ${p.l.length - 30} autre(s)</span>` : ''}</div></div>`).join('')
          : '<span class="nt">Rien d\'étiqueté pour ce morceau pour l\'instant. Clique « 🏷 Étiqueter d\'autres fichiers » juste au-dessus.</span>';
        $$('.drive-sec', el).forEach(b => b.onclick = () => { const bl = b.parentElement, k = bl.dataset.sec; sectionsFermees[k] = !sectionsFermees[k]; BK.regler('biblio.sections', sectionsFermees);
          bl.classList.toggle('ferme', !!sectionsFermees[k]); $('.fleche', b).textContent = sectionsFermees[k] ? '▸' : '▾'; });
        $$('.lien', el).forEach(a => a.onclick = e => { e.preventDefault(); BK.ouvrirLien(a.dataset.url); });
        $$('[data-dreel]', el).forEach(b => b.onclick = async () => { try { msg('Téléchargement depuis le Drive…'); const o = await BK.drive.telecharger(b.dataset.dreel); BK.ouvrir('reels'); await BK.reelsCharger(new File([o], b.dataset.nom)); } catch (e) { msg('Téléchargement impossible'); } });
        $$('[data-ecoute]', el).forEach(b => b.onclick = () => lecteur.jouer(m, { drive: b.dataset.ecoute, nom: b.dataset.nom }));
      } catch (e) { console.error(e); el.innerHTML = '<span class="nt">Drive injoignable pour l\'instant.</span>'; }
    }
  }

  // ---------- le lecteur : un seul son à la fois, sous chaque morceau ----------
  const lecteur = {
    audio: new Audio(), id: null, urls: {}, nom: {},
    // ce qu'on écoute : l'export principal (ce PC ou Drive), sinon le plus récent du Drive
    async source(m) {                                  // l'export ★ de la fiche : le même partout dans le logiciel
      const exps = BK.inv.exportsDe(m, B.fichiers, B.morceaux);
      const princ = exps.find(x => x.chemin === m.exportPrincipal) || exps[0];
      if (princ) return princ.drive ? { drive: princ.driveId, nom: princ.nom } : { chemin: princ.chemin, nom: princ.nom };
      return BK.sonDuMorceau(m, B.morceaux);
    },
    async octets(src) { return src.drive ? BK.drive.telecharger(src.drive) : BK.fichier.lireOctets(src.chemin); },
    async jouer(m, src) {
      const a = lecteur.audio;
      if (!src && lecteur.id === m.id && lecteur.urls[m.id]) { a.paused ? a.play() : a.pause(); return lecteur.maj(); }
      a.pause(); lecteur.id = m.id; lecteur.maj('…');
      try {
        src = src || await lecteur.source(m);
        if (!src) { lecteur.id = null; lecteur.maj(); return msg('Aucun export à écouter : ajoute-le dans la fiche'); }
        if (!BK.estExe && src.chemin) { lecteur.id = null; lecteur.maj(); return msg('Disponible dans le logiciel installé'); }
        const cle = m.id + '|' + (src.drive || src.chemin);
        if (!lecteur.urls[cle]) { msg('Chargement de ' + src.nom + '…'); lecteur.urls[cle] = URL.createObjectURL(new Blob([await lecteur.octets(src)])); }
        lecteur.urls[m.id] = lecteur.urls[cle]; lecteur.nom[m.id] = src.nom;
        a.src = lecteur.urls[cle]; await a.play(); msg('▶ ' + src.nom);
      } catch (e) { console.error(e); lecteur.id = null; msg('Lecture impossible'); }
      lecteur.maj();
    },
    maj(etat) {
      for (const el of $$('.lecteur', page)) {
        const moi = el.dataset.lect === lecteur.id, a = lecteur.audio, d = moi && a.duration ? a.duration : 0;
        $('.lect-play', el).textContent = moi && etat ? '…' : moi && !a.paused ? '❚❚' : '▶';
        $('.lect-barre i', el).style.width = d ? (a.currentTime / d * 100) + '%' : '0';
        $('.lect-t', el).textContent = d ? `${BK.audio.temps(a.currentTime).replace(/\.\d$/, '')} / ${BK.audio.temps(d).replace(/\.\d$/, '')}` : '';
        $('.lect-src', el).textContent = lecteur.nom[el.dataset.lect] || '';
      }
    },
  };
  BK.mini.suivre(lecteur.audio, { page: 'biblio', titre: () => { const m = B.morceaux.find(x => x.id === lecteur.id); return (m ? m.nom + ' · ' : '') + (lecteur.nom[lecteur.id] || ''); } });

  ['timeupdate', 'pause', 'play', 'ended', 'loadedmetadata'].forEach(ev => lecteur.audio.addEventListener(ev, () => lecteur.maj()));

  // morceaux qui ont un dossier dans « Ableton Projects » mais pas encore de fiche
  async function morceauxDuDrive() {
    if (!BK.drive.relie()) return [];
    const d = await BK.dossiers.get('ableton'); if (!d) return [];
    const ds = await BK.dossiers.enfants(d.id, true), out = [];
    for (const x of ds) {
      if (/^wip$/i.test(x.name)) { for (const y of await BK.dossiers.enfants(x.id, true)) if (!BK.inv.trouverMorceau(y.name, B.morceaux)) out.push(y.name); }
      else if (!BK.inv.trouverMorceau(x.name, B.morceaux)) out.push(x.name);
    }
    return out;
  }

  function fiche(m) {
    const ouvert = B.ouverts.has(m.id), fs = fichiersDe(m);
    const exps = BK.inv.exportsDe(m, B.fichiers, B.morceaux);
    const als = fs.filter(x => x.type === 'als').sort((a, b) => (b.modif || '').localeCompare(a.modif || ''));
    const pc = Math.round(BK.pourcent(m));
    const t = (id, titre, resume, corps) => { const o = (B.tiroirs[m.id] || []).includes(id);
      return `<div class="tiroir${o ? ' ouvert' : ''}" data-t="${id}"><button class="tiroir-tete"><span class="fleche">${o ? '▾' : '▸'}</span><span class="lb">${titre}</span><span class="nt tiroir-resume">${resume}</span></button>${o ? `<div class="tiroir-corps">${corps()}</div>` : ''}</div>`; };
    const tAvance = () => `${t('avance', 'Avancement', `${BK.etapes[Math.min(m.fait || 0, 5)].nom} · ${pc} %`, () => `
          <div class="etapes-clic">${BK.etapes.map((e, i) => `<button class="etape-b ${i < (m.fait || 0) ? 'fait' : i === (m.fait || 0) ? 'encours' + ((m.enCours || 0) > 0 ? ' demi' : '') : ''}" style="--sc:${e.c}" data-etape="${i}" title="Clic : fait / pas fait · clic droit : en cours">${e.nom}${i === (m.fait || 0) && (m.enCours || 0) > 0 ? ' <small>en cours</small>' : ''}</button>`).join('')}</div>
          `)}`;
    // RETOURS : les notes d'Écoute, par version (le fichier), en français et en anglais
    const tRetours = () => { const ns = (B.notesmix || []).filter(n => n.morceau === m.id), parV = {};
      for (const n of ns) (parV[n.version] ||= []).push(n);
      const vs = Object.entries(parV).sort((a, b) => (b[1][0].quand || '').localeCompare(a[1][0].quand || ''));
      const ouverts = ns.filter(n => !n.regle).length, tps = x => { x = +x || 0; return Math.floor(x / 60) + ':' + String(Math.floor(x % 60)).padStart(2, '0'); };
      return t('retours', 'Notes du mix', ns.length ? `${ns.length} note(s) · ${ouverts} à régler · ${vs.length} version(s)` : 'aucune (onglet Écoute)', () => vs.length ? vs.map(([v, l]) => `
          <div class="ret-v"><div class="ligne-titre"><span class="mono ret-nom">${esc(l[0].versionNom || 'version')}</span><button class="btn xs" data-retv="${esc(v)}" title="Ouvrir dans Écoute">▶ Écoute</button></div>
            ${l.sort((a, b) => a.t - b.t).map(n => `<div class="ret-n${n.regle ? ' regle' : ''}"><span class="mono ret-t">${tps(n.t)}${n.fin ? '–' + tps(n.fin) : ''}</span>
              <div><b>${esc(n.par)}</b> ${esc(n.texte)}${n.regle ? ' <em>✓ réglé</em>' : ''}${n.texteEn ? `<div class="ec-en"><span>EN</span>${esc(n.texteEn)}</div>` : ''}
              ${(n.reponses || []).map(r => `<div class="ret-rep"><b>${esc(r.par)}</b> ${esc(r.texte)}</div>`).join('')}</div></div>`).join('')}</div>`).join('')
        : '<span class="nt">Pas encore de note. Dans l\'onglet Écoute, choisis ce morceau et une version, puis laisse des notes minutées : elles arrivent ici, rangées par version.</span>'); };
    return `<article class="fiche${ouvert ? ' ouverte' : ''}" data-id="${m.id}" style="--av:${BK.couleurAvance(m)}">
      <div class="fiche-haut">
        <button class="fiche-photo${m.photo ? '' : ' vide'}" data-act="photo" title="Choisir la photo du morceau" ${BK.img.bg(m.photo)}>${m.photo ? '' : '🖼'}</button>
        <div class="fiche-droite">
          <button class="fiche-tete">
            <span class="fiche-nom">${esc(m.nom)}</span>
            <span class="dymo sm">${m.statut === 'sorti' ? 'Sorti' : BK.etapes[Math.min(m.fait || 0, 5)].nom}</span>
            <span class="mini-etapes">${(() => { const f = m.fait || 0, demi = (m.enCours || 0) > 0, bout = demi ? f : f - 1;   // le bout : là où on en est (il brille)
              return BK.etapes.map((e, i) => `<i class="${i < f ? 'fait' : i === f ? (demi ? 'demi' : 'suivante') : ''}${i === bout ? ' bout' : ''}" style="flex:${e.poids};--sc:${e.c}"></i>`).join(''); })()}</span>
            <span class="vfd fiche-pc">${pc} %</span><span class="fleche">${ouvert ? '▾' : '▸'}</span></button>
          <div class="lecteur" data-lect="${m.id}"><button class="lect-play" title="Écouter l'export principal">▶</button><div class="lect-barre"><i></i></div><span class="lect-t mono"></span><span class="nt lect-src"></span></div>
        </div>
      </div>
      ${ouvert ? `<div class="fiche-corps">
        ${tAvance()}
        <span class="eng fiche-grp">Fichiers</span>
        ${t('exports', 'Exports', exps.length ? `${exps.length} fichier(s) · principal : ${esc(exps[0].nom)}` : BK.drive.relie() ? 'voir ceux du Drive' : 'aucun', () => (exps.length ? exps.map((x, i) => `
          <div class="ligne-f${i === 0 ? ' recent' : ''}"><button class="etoile etoile-b${i === 0 ? ' on' : ''}" data-princ="${esc(x.chemin)}" title="${i === 0 ? 'Version principale' : 'En faire la version principale'}">${i === 0 ? '★' : '☆'}</button>
            <span class="mono f-nom" title="${esc(x.chemin)}">${esc(x.nom)}</span>
            <span class="nt f-meta">${date(x.modif)} · ${esc(x.pc)}${x.manuel ? ' · ajouté à la main' : ''}</span>
            <input class="fld f-note" data-f="${esc(x.nom)}" placeholder="note…" value="${esc((m.notesExports || {})[x.nom] || '')}">
            ${x.drive ? `<button class="btn xs" data-ecoute="${esc(x.driveId)}" data-nom="${esc(x.nom)}" title="Écouter">▶</button><button class="btn xs" data-dreel="${esc(x.driveId)}" data-nom="${esc(x.nom)}">→ Reel</button>`
              : x.ici ? `<button class="btn xs" data-reel="${esc(x.chemin)}" data-nom="${esc(x.nom)}">→ Reel</button>` : ''}
            <button class="btn xs" data-remplacer="${esc(x.chemin)}" title="Choisir une autre version à la place">Remplacer…</button>
            <button class="btn xs" data-expx="${esc(x.chemin)}" title="Retirer de la fiche (le fichier n'est pas effacé)">✕</button></div>`).join('') : '<span class="nt">Aucun export relié. Range-le dans le Drive (dossier du morceau), ou « + Ajouter un export ».</span>')
          + ((m.exportsDiscord || []).length ? `<span class="nt" style="margin-top:8px">Vu sur Discord (Miette) :</span>` + m.exportsDiscord.slice(0, 5).map(x => `<div class="ligne-f"><span class="etoile">💬</span><span class="mono f-nom">${esc(x.fichier || '—')}</span>
            <span class="nt f-meta">${x.date ? date(x.date) : ''}${x.detail ? ' · ' + esc(x.detail) : ''}</span>${x.lien ? `<a href="#" class="lien btn xs" data-url="${esc(x.lien)}">voir</a>` : ''}</div>`).join('') : '')
          + (BK.drive.relie() ? `<div class="exp-drive" data-m="${m.id}"><span class="nt"><span class="spin"></span>Exports dans le Drive…</span></div>` : '')
          + `<div class="chips" style="margin-top:8px"><button class="btn sm" data-act="ajexport">+ Ajouter un export</button></div>`)}
        ${t('projets', 'Projets Ableton', als.length ? `${als.filter(x => !x.sauvegarde).length} version(s) · ${als.some(x => !x.ici && als[0] === x) ? '⚠ la plus récente n\'est pas sur ce PC' : 'à jour'}` : 'aucun', () => als.length ? als.map((x, i) => `
          <div class="ligne-f${i === 0 ? ' recent' : ''}"><span class="etoile">${i === 0 ? '★' : ''}</span><span class="mono f-nom" title="${esc(x.chemin)}">${esc(x.nom)}${x.sauvegarde ? ' <em>(sauvegarde auto)</em>' : ''}</span>
            <span class="nt f-meta">${date(x.modif)} · ${esc(x.pc)}${/[\\/]my drive[\\/]|[\\/]mon drive[\\/]|^g:/i.test(x.chemin) ? ' · Drive ✓' : ''}</span>
            ${x.ici ? `<button class="btn xs" data-ouvrir="${esc(x.chemin)}">Ouvrir</button>` : '<span class="nt f-meta">sur un autre PC</span>'}</div>`).join('') : '<span class="nt">Aucun projet trouvé. Range-le dans le Drive (Recording › Ableton Project), ou ajoute un dossier de ce PC à droite.</span>')}
        <span class="eng fiche-grp">Orga</span>
        ${t('paroles', 'Paroles', m.paroles ? m.paroles.split('\n').filter(Boolean).length + ' lignes' : 'vides', () => `
          <textarea class="fld paroles" data-champ="paroles" placeholder="[COUPLET 1]&#10;…&#10;[REFRAIN]&#10;…">${esc(m.paroles || '')}</textarea>
          <div class="chips" style="margin-top:8px"><button class="chip" data-act="plein">Plein écran</button><button class="chip" data-act="copier">Copier pour le distributeur</button><button class="chip" data-act="paroles" title="Ouvre la recherche dans ton navigateur : copie-colle les paroles ici">🔎 Chercher les paroles</button><button class="chip bi-sauv ok" data-sauver="1" title="Enregistré (clique pour enregistrer maintenant ; ça s\'enregistre aussi tout seul quand tu cliques ailleurs)">✓</button></div>`)}
        ${t('infos', 'Infos', [m.bpm && m.bpm + ' BPM', m.ton, m.duree, m.sortie && 'sortie ' + m.sortie].filter(Boolean).join(' · ') || '—', () => `
          <div class="infos">
            <label><span class="eng">BPM <small class="nt" style="margin:0">${m.bpm ? ({ nous: '· écrit par vous', discord: '· dit sur Discord', ableton: '· lu dans Ableton', detecte: '· deviné (à vérifier)' })[m.bpmSource || 'detecte'] : ''}</small></span>
              <span class="bpm-ligne"><input class="fld${(m.aValider || {}).bpm ? ' mi-prop' : ''}" data-champ="bpm" value="${esc(m.bpm || '')}">${(m.aValider || {}).bpm ? `<button class="mi-val" data-act="val-bpm" title="Trouvé par Miette sur Discord : c'est bon ?">✓</button>` : ''}<button class="btn xs" data-act="bpmAbleton" title="Lit le tempo du projet ouvert dans Ableton (pont BEESKOT)">🎛 Ableton</button></span></label>
            <label><span class="eng">Tonalité</span><span class="bpm-ligne"><input class="fld${(m.aValider || {}).ton ? ' mi-prop' : ''}" data-champ="ton" value="${esc(m.ton || '')}" placeholder="ex. Mi mineur">${(m.aValider || {}).ton ? `<button class="mi-val" data-act="val-ton" title="Trouvé par Miette sur Discord : c'est bon ?">✓</button>` : ''}</span></label>
            <label><span class="eng">Durée</span><input class="fld" data-champ="duree" value="${esc(m.duree || '')}" placeholder="3:45"></label>
            <label><span class="eng">Date de sortie</span><span class="bpm-ligne"><input class="fld${(m.aValider || {}).sortie ? ' mi-prop' : ''}" type="date" data-champ="sortie" value="${esc(m.sortie || '')}">${(m.aValider || {}).sortie ? `<button class="mi-val" data-act="val-sortie" title="Trouvé par Miette sur Discord : c'est bon ?">✓</button>` : ''}</span></label>
            <label><span class="eng">Artiste original (reprise)</span><input class="fld" data-champ="artiste" value="${esc(m.artiste || '')}" placeholder="ex. Mika Nakashima"></label>
            <label><span class="eng">Autres noms du fichier</span><input class="fld" data-champ="alias" value="${esc((m.alias || []).join(', '))}" placeholder="ex. morceauA, MorcA"></label>
          </div>
          <div class="chips" style="margin-top:8px"><button class="chip bi-sauv ok" data-sauver="1" title="Enregistré (clique pour enregistrer maintenant ; ça s\'enregistre aussi tout seul quand tu cliques ailleurs)">✓</button><button class="chip" data-act="analyser" title="Lit l'export principal et remplit la durée, le BPM et la tonalité">🎚 Analyser l'export (durée, BPM, tonalité)</button></div>
          <span class="nt">La tonalité est une estimation : vérifie à l'oreille.</span>`)}
        ${t('liens', 'Étiquettes', ((m.liens || []).length ? m.liens.length + ' lien(s) · ' : '') + (BK.drive.relie() ? 'tout ce qui concerne ce morceau' : 'Drive non relié'), () => `
          ${BK.drive.relie() ? `<button class="btn xs etq-plus" data-act="etiqueter">🏷 Étiqueter d'autres fichiers pour ${esc(m.nom)}</button>
            <div class="drive-res" data-m="${m.id}"><span class="nt"><span class="spin"></span>Recherche…</span></div>` : ''}
          ${(m.liens || []).map((l, i) => `<div class="ligne-f"><span class="etoile">🔗</span><a href="#" class="f-nom lien" data-url="${esc(l.url)}" title="${esc(l.url)}">${esc(l.titre || l.url)}</a><button class="btn xs" data-lienx="${i}">✕</button></div>`).join('')}
          <div class="lien-aj"><input class="fld" data-lien="titre" placeholder="ex. Projet Ableton v8 (zipper)"><input class="fld" data-lien="url" placeholder="colle le lien Google Drive…"><button class="btn xs" data-act="lien">+ Ajouter</button></div>
          ${BK.drive.relie() ? '' : '<span class="nt">Relie le Drive (Réglages) : les fichiers déposés dans le Drive, par ex. par le zipper Discord, apparaîtront ici tout seuls.</span>'}`)}
        ${t('notes', 'Notes du groupe', m.resumeDiscord ? '🍞 résumé Discord · ' + date(m.resumeDiscord.t) : m.notes ? m.notes.split('\n')[0].slice(0, 50) : '—', () => `${m.resumeDiscord ? `<div class="box${m.resumeDiscord.ok ? '' : ' mi-prop'}" style="margin-bottom:8px"><span class="lb">${m.resumeDiscord.ok ? '' : '<button class="mi-val" data-act="val-resume" title="C\'est juste : valider" style="float:right">✓</button>'}🍞 Ce que Miette a compris de Discord (${m.resumeDiscord.nb} messages, ${date(m.resumeDiscord.t)})</span><p class="ac-texte" style="white-space:pre-wrap">${esc(m.resumeDiscord.texte)}</p></div>` : ''}${(m.aValider || {}).notes ? '<div class="mi-bandeau" style="margin-bottom:6px">Miette a ajouté des lignes 🍞 lues sur Discord : vérifie-les<button class="mi-val" data-act="val-notes" style="margin-left:auto">✓ C\'est bon</button></div>' : ''}<textarea class="fld${(m.aValider || {}).notes ? ' mi-prop' : ''}" data-champ="notes" placeholder="ex. attention au break à 2:10">${esc(m.notes || '')}</textarea>
          <div class="chips" style="margin-top:8px"><button class="chip bi-sauv ok" data-sauver="1" title="Enregistré (clique pour enregistrer maintenant ; ça s\'enregistre aussi tout seul quand tu cliques ailleurs)">✓</button><button class="btn xs miette-aide" data-act="resumeDiscord" title="Miette relit tout ce que le groupe a dit sur ce morceau dans Discord et fait le point">${m.resumeDiscord ? 'Refaire le point Discord' : 'Faire le point Discord'}</button></div>`)}
        <span class="eng fiche-grp">Retours</span>
        ${tRetours()}
        <div class="fiche-actions">
          ${[['prochaine', '⭐ Next release'], ['chantier', '🔧 Work in progress'], ['sorti', '✓ Sorti']].map(([k, t]) => `<button class="btn sm${(m.statut || 'chantier') === k ? ' pri' : ''}" data-act="st-${k}">${t}</button>`).join('')}
          <button class="btn sm" data-act="renommer">Renommer</button>
          <button class="btn sm" data-act="suppr">Retirer</button></div>
      </div>` : ''}
    </article>`;
  }

  async function neufsDuDrive() {
    const z = $('#biDriveNeufs'); if (!z) return;
    const l = await morceauxDuDrive().catch(() => []); if (!l.length || !$('#biDriveNeufs')) return;
    const joli = n => n.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
    z.innerHTML = `<div class="box" style="margin-bottom:12px"><span class="lb">Dans le Drive (Ableton Projects), sans fiche</span>
      ${l.map(n => `<div class="ligne-f"><span class="etoile">▤</span><span class="f-nom">${esc(joli(n))}</span><button class="btn xs" data-neuf="${esc(joli(n))}">+ Créer la fiche</button></div>`).join('')}</div>`;
    $$('[data-neuf]', z).forEach(b => b.onclick = async () => { await BK.db.ecrire('morceaux', { nom: b.dataset.neuf, statut: 'chantier', fait: 0 }); msg('Fiche créée'); await charger(); });
  }
  function rendreOrphelins(O) {
    if (!O.length) return '<span class="nt" style="padding:20px">Rien à ranger : tous les fichiers trouvés sont reliés à un morceau.</span>';
    const opts = B.morceaux.map(m => `<option value="${m.id}">${esc(m.nom)}</option>`).join('');
    return `<div class="ligne-titre"><span class="nt" style="margin:0">Fichiers trouvés mais pas encore reliés à une fiche. Relie-les à un morceau existant, ou crée une fiche.</span>
      <button class="btn sm pri" id="biTout" style="margin-left:auto;flex:none">Créer toutes les fiches d'un coup…</button></div>` +
      O.slice(0, 300).map(f => `<div class="ligne-f orph" data-nom="${esc(f.nom)}"><span class="mono f-nom">${esc(f.nom)}</span><span class="nt f-meta">${f.type === 'als' ? 'Ableton' : 'audio'} · ${date(f.modif)} · ${esc(f.pc)}</span>
        <select class="fld f-sel"><option value="">relier à…</option>${opts}</select><button class="btn xs" data-act="creer">+ Fiche</button><button class="btn xs" data-act="perso" title="Projet perso, pas BEESKOT : le retirer de la liste (le fichier n'est pas supprimé)">✕ Pas BEESKOT</button></div>`).join('')
      + (BK.reglage('biblio.ignores', []).length ? `<div class="ligne-titre" style="margin-top:10px"><span class="nt" style="margin:0">${BK.reglage('biblio.ignores', []).length} projet(s) perso retiré(s) sur ce PC.</span><button class="btn xs" id="biRemettre" style="margin-left:auto">↺ Les remettre</button></div>` : '');
  }

  // ---------- la photo du morceau (la fiche garde son adresse sur le Drive) ----------
  async function photo(m) {
    const fin = async v => { if (v === undefined) return; m.photo = v; await sauver(m); msg(v ? 'Photo enregistrée' : 'Photo enlevée'); rendre(); };
    if (!BK.drive.relie()) {                                           // sans Drive : une image de ce PC, comme avant
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
      inp.onchange = async () => { const f = inp.files[0]; if (f) fin(await BK.img.versDrive(f, f.name, 'photovideo')); }; return inp.click(); }
    // toujours par Médias : la fenêtre s'ouvre sur les photos du morceau
    const l = await BK.choisirDansMedias({ titre: 'Photo de ' + m.nom, bouton: 'Choisir cette photo', type: 'image', sujet: m.id, retirer: m.photo ? 'Enlever la photo' : '' });
    const x = l && l[0]; if (!x) return;
    if (x.retirer) return fin('');
    msg('Photo…'); try { fin((await BK.img.depuisChoix(x, 'photovideo')).ref); } catch (e) { msg('Image illisible'); }
  }

  // ---------- choisir un export : sur ce PC ou dans le Drive (un seul bouton, un petit menu) ----------
  function menuExport(el, suite, m) {
    $$('.md-menu').forEach(x => x.remove());
    const r = el.getBoundingClientRect(), menu = document.createElement('div'); menu.className = 'md-menu';
    menu.style.left = Math.min(r.left, innerWidth - 230) + 'px'; menu.style.top = Math.min(r.bottom + 4, innerHeight - 120) + 'px';
    menu.innerHTML = (BK.drive.relie() ? '<button data-ex="drive">☁ Dans le Drive…</button><button data-ex="discord">🍞 Posté sur Discord…</button>' : '')
      + '<button data-ex="pc">💻 Sur ce PC…</button>';
    document.body.appendChild(menu);
    const fermer = e => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('pointerdown', fermer, true); } };
    setTimeout(() => document.addEventListener('pointerdown', fermer, true));
    const duDrive = f => ({ chemin: 'drive:' + f.id, driveId: f.id, drive: true, nom: f.name, pc: 'Drive', modif: f.modifiedTime || new Date().toISOString() });
    menu.onclick = async e => { const b = e.target.closest('[data-ex]'); if (!b) return; menu.remove();
      if (b.dataset.ex === 'pc') { const f = await choisirExport(); if (f) suite(f); return; }
      if (b.dataset.ex === 'discord') {                                    // le fichier posté sur Discord est copié dans le Drive, puis relié à la fiche
        const l = await BK.choisirImages({ titre: '🍞 Les audios postés sur Discord', bouton: 'Mettre dans le Drive et relier',
          charger: async () => (await BK.discord.medias(5, 'audio')).map(x => ({ id: x.id, nom: x.nom, info: x.qui + ' · #' + x.salon + ' · ' + new Date(x.t).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' }), x })) });
        if (!l || !l[0]) return;
        const it = l[0];
        try {
          msg('Téléchargement de ' + it.nom + '…');
          const r = await BK.discord.fetch(it.x.url); if (!r.ok) throw new Error('fichier expiré sur Discord');
          const blob = await r.blob();
          await BK.dossiers.assurer();
          const d = (await BK.dossiers.get('cl')) || (await BK.dossiers.get('recording'));
          const dos = d ? d.id : await BK.drive.racine();
          const n = await BK.drive.envoyerBlob(new File([blob], it.nom, { type: blob.type || 'audio/wav' }), it.nom, dos, p => msg('Envoi dans le Drive · ' + Math.round(p * 100) + ' %'));
          BK.dossiers.oublier();
          msg('Copié dans ' + (d ? BK.dossiers.joli(d.nom) : 'le Drive'));
          suite({ chemin: 'drive:' + n.id, driveId: n.id, drive: true, nom: it.nom, pc: 'Drive (depuis Discord)', modif: new Date().toISOString(), discord: it.x.lien || '' });
        } catch (er) { msg('Impossible : ' + (er.message || er)); }
        return; }
      const l = await BK.explorerDrive({ titre: 'Export de « ' + m.nom + ' » dans le Drive', mode: 'audio', depart: 'cl' }); if (!l || !l[0]) return;
      suite(duDrive(l[0])); };
  }

  // ---------- actions ----------
  async function sauver(m) { await BK.db.ecrire('morceaux', m); }
  // glissé depuis Médias sur une fiche : une image devient sa photo, un son devient un de ses exports
  page.addEventListener('dragover', e => { if (BK.glisse.actif() && e.target.closest('.fiche[data-id]')) { e.preventDefault(); e.target.closest('.fiche').classList.add('survol-media'); } });
  page.addEventListener('dragleave', e => { const f = e.target.closest && e.target.closest('.fiche'); if (f && !f.contains(e.relatedTarget)) f.classList.remove('survol-media'); });
  page.addEventListener('drop', async e => { const fi = e.target.closest('.fiche[data-id]'); if (!BK.glisse.actif() || !fi) return; e.preventDefault(); fi.classList.remove('survol-media');
    const m = B.morceaux.find(y => y.id === fi.dataset.id); if (!m) return;
    const l = BK.glisse.items.filter(y => !y.dc); if (!l.length) return msg('Range d\'abord ce média de Discord dans le Drive (Médias)');
    let n = 0;
    for (const x of l) {
      if (/^image\//.test(x.mime || '')) { m.photo = BK.img.ref(x.id); n++; }
      else if (/^audio\//.test(x.mime || '') || /\.(wav|mp3|aiff?|flac|m4a)$/i.test(x.nom || '')) { const ex = { chemin: 'drive:' + x.id, driveId: x.id, drive: true, nom: x.nom, pc: 'Drive', modif: new Date().toISOString() };
        m.exportsManuels = (m.exportsManuels || []).filter(y => y.chemin !== ex.chemin); m.exportsManuels.push(ex); n++; }
    }
    if (!n) return msg('Ici : une image (photo du morceau) ou un son (export)');
    await sauver(m); msg(n + ' média(s) ajouté(s) à « ' + m.nom + ' »'); rendre(); });
  async function choisirExport() {                 // choisir un WAV / MP3 sur ce PC
    if (!BK.estExe) { msg('Disponible dans le logiciel installé'); return null; }
    const p = await BK.fichier.choisirFichier('Choisis l\'export (WAV ou MP3)', [{ name: 'Audio', extensions: ['wav', 'mp3', 'WAV', 'MP3'] }]); if (!p) return null;
    let modif = new Date().toISOString(); try { const st = await BK.fichier.infos(p); if (st && st.mtime) modif = new Date(st.mtime).toISOString(); } catch (e) {}
    return { chemin: p, nom: p.split(/[\\/]/).pop(), pc: BK.inv.monPc(), modif };
  }
  function brancherFiches() {
    $$('.fiche', page).forEach(el => {
      const m = B.morceaux.find(x => x.id === el.dataset.id);
      $('.lect-play', el).onclick = () => lecteur.jouer(m);
      $('.lect-barre', el).onclick = e => { if (lecteur.id !== m.id || !lecteur.audio.duration) return; const r = e.currentTarget.getBoundingClientRect(); lecteur.audio.currentTime = (e.clientX - r.left) / r.width * lecteur.audio.duration; };
      $$('[data-ecoute]', el).forEach(b => b.onclick = () => lecteur.jouer(m, { drive: b.dataset.ecoute, nom: b.dataset.nom }));
      $$('[data-dreel]', el).forEach(b => b.onclick = async () => { try { msg('Téléchargement depuis le Drive…'); const o = await BK.drive.telecharger(b.dataset.dreel); BK.ouvrir('reels'); await BK.reelsCharger(new File([o], b.dataset.nom)); } catch (e) { msg('Téléchargement impossible'); } });
      $('.fiche-tete', el).onclick = e => { if (e.currentTarget.dataset.pasClic) return; B.ouverts.has(m.id) ? B.ouverts.delete(m.id) : B.ouverts.add(m.id); BK.regler('biblio.ouverts', [...B.ouverts]); rendre(); };
      $$('.tiroir-tete', el).forEach(b => b.onclick = () => {
        const id = b.parentElement.dataset.t, l = B.tiroirs[m.id] = B.tiroirs[m.id] || [];
        l.includes(id) ? l.splice(l.indexOf(id), 1) : l.push(id); BK.regler('biblio.tiroirs', B.tiroirs); rendre(); });
      const etatSauv = (c, ok) => { const z = c.closest('.tiroir-corps'), b = z && z.querySelector('[data-sauver]'); if (!b) return;
        b.classList.toggle('ok', ok); b.classList.toggle('a-faire', !ok); b.title = ok ? 'Enregistré' : 'Pas encore enregistré : clique pour enregistrer'; };
      $$('[data-champ]', el).forEach(c => c.addEventListener('input', () => etatSauv(c, false)));
      $$('[data-sauver]', el).forEach(b => b.onclick = async () => { const z = b.closest('.tiroir-corps');
        for (const c of $$('[data-champ]', z)) await c.onchange();                          // enregistre tout ce qui est dans ce tiroir
        b.classList.add('ok'); b.classList.remove('a-faire'); b.title = 'Enregistré'; });
      $$('[data-champ]', el).forEach(c => c.onchange = async () => {
        const k = c.dataset.champ; m[k] = k === 'alias' ? c.value.split(',').map(s => s.trim()).filter(Boolean) : c.value;
        if (k === 'bpm') m.bpmSource = c.value.trim() ? 'nous' : '';
        if ((m.aValider || {})[k]) { delete m.aValider[k]; c.classList.remove('mi-prop'); }   // vous l'avez touché : c'est validé             // ce que vous écrivez passe devant Ableton et la détection
        await sauver(m); msg('Enregistré ✓'); etatSauv(c, true); if (k === 'alias' || k === 'bpm') { rendre(); } });
      $$('.f-note', el).forEach(c => c.onchange = async () => { (m.notesExports = m.notesExports || {})[c.dataset.f] = c.value; await sauver(m); msg('Note enregistrée'); });
      $$('[data-etape]', el).forEach(b => b.oncontextmenu = e => { e.preventDefault(); const i = +b.dataset.etape, enc = i === (m.fait || 0) && (m.enCours || 0) > 0;
        BK.menuCascade && $$('.md-menu').forEach(x => x.remove());
        const menu = document.createElement('div'); menu.className = 'md-menu'; menu.style.left = Math.min(e.clientX, innerWidth - 230) + 'px'; menu.style.top = Math.min(e.clientY, innerHeight - 120) + 'px';
        menu.innerHTML = `<span class="md-menu-t">${esc(BK.etapes[i].nom)}</span>` + (enc ? '<button data-ec="0">Retirer « en cours »</button>' : '<button data-ec="1">Mettre en cours</button>');
        document.body.appendChild(menu);
        const fermer = ev => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('pointerdown', fermer, true); } };
        setTimeout(() => document.addEventListener('pointerdown', fermer, true));
        menu.onclick = async ev => { const x = ev.target.closest('[data-ec]'); if (!x) return; menu.remove(); document.removeEventListener('pointerdown', fermer, true);
          if (x.dataset.ec === '1') { m.fait = i; m.enCours = 0.5; } else m.enCours = 0;          // en cours = la moitié de l'étape
          await sauver(m); msg(x.dataset.ec === '1' ? BK.etapes[i].nom + ' : en cours' : 'Plus en cours'); rendre(); }; });
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
      $$('[data-remplacer]', el).forEach(b => b.onclick = () => menuExport(b, async f => {
        const c = b.dataset.remplacer;
        m.exportsManuels = (m.exportsManuels || []).filter(x => x.chemin !== c && x.chemin !== f.chemin);
        if (B.fichiers.some(x => x.chemin === c)) (m.exportsCaches = m.exportsCaches || []).push(c);
        m.exportsManuels.push(f); m.exportPrincipal = f.chemin; await sauver(m); msg('Export remplacé'); rendre(); }, m));
      $$('[data-retv]', el).forEach(b => b.onclick = () => BK.ecouteOuvrir ? BK.ecouteOuvrir(m.id, b.dataset.retv) : BK.ouvrir('ecoute'));
      $$('[data-lienx]', el).forEach(b => b.onclick = async () => { m.liens.splice(+b.dataset.lienx, 1); await sauver(m); rendre(); });
      $$('[data-act]', el).forEach(b => b.onclick = async () => {
        const a = b.dataset.act;
        if (/^val-/.test(a)) { const k = a.slice(4); if (k === 'resume') { if (m.resumeDiscord) m.resumeDiscord.ok = true; } else if (m.aValider) delete m.aValider[k];
          await sauver(m); msg('Validé'); rendre(); return; }
        if (/^st-/.test(a)) { m.statut = a.slice(3); await sauver(m); rendre(); }
        if (a === 'renommer') { const n = await BK.saisir('Nouveau nom du morceau', m.nom); if (n && n.trim()) { (m.alias = m.alias || []).push(m.nom); m.nom = n.trim(); await sauver(m); rendre(); } }
        if (a === 'suppr') { if (await BK.confirmer(`Retirer « ${m.nom} » de la Bibliothèque ?\n(La fiche est rangée dans la corbeille du Drive, et aucun fichier audio ou Ableton n'est touché.)`)) { await BK.db.supprimer('morceaux', m.id); await charger(); } }
        if (a === 'ajexport') menuExport(b, async f => { m.exportsManuels = (m.exportsManuels || []).filter(x => x.chemin !== f.chemin); m.exportsManuels.push(f);
          m.exportsCaches = (m.exportsCaches || []).filter(c => c !== f.chemin); if (f.drive) m.exportPrincipal = f.chemin; await sauver(m); msg('Export ajouté'); rendre(); }, m);
        if (a === 'photo') photo(m);
        if (a === 'resumeDiscord') { b.disabled = true; b.innerHTML = '<span class="spin"></span>Miette relit Discord…';
          try { await BK.discord.resumerMorceau(m); msg('Point Discord fait pour ' + m.nom); } catch (e) { msg(e.message || 'Impossible'); } rendre(); return; }
        if (a === 'paroles') BK.ouvrirLien('https://www.google.com/search?q=' + encodeURIComponent(['paroles', m.artiste, m.nom, 'lyrics'].filter(Boolean).join(' ')));
        if (a === 'analyser') {
          const src = await lecteur.source(m); if (!src) return msg('Aucun export à analyser : ajoute-le dans la fiche');
          if (!BK.estExe && src.chemin) return msg('Disponible dans le logiciel installé');
          try { msg('Analyse de ' + src.nom + '…'); const buf = await BK.audio.decoder(await lecteur.octets(src));
            const r = await BK.audio.analyser(buf, p => msg('Analyse… ' + Math.round(p * 100) + ' %'));
            m.duree = r.duree; if (!m.ton) m.ton = r.ton;
            if (!m.bpm || m.bpmSource === 'detecte' || !m.bpmSource) { m.bpm = String(r.bpm); m.bpmSource = 'detecte'; }   // jamais par-dessus ce que vous ou Ableton avez dit
            await sauver(m); msg(`${r.duree} · ${m.bpm} BPM (${m.bpmSource === 'detecte' ? 'deviné' : 'gardé'}) · ${m.ton}`); rendre(); }
          catch (e) { console.error(e); msg('Analyse impossible'); } }
        if (a === 'copier') { await navigator.clipboard.writeText(BK.parolesPropres(m.paroles)); msg('Paroles copiées'); }
        if (a === 'etiqueter') { BK.ouvrirMediasMorceau ? BK.ouvrirMediasMorceau(m.id) : BK.ouvrir('medias'); return; }
        if (a === 'bpmAbleton') {
          if (!BK.ableton.relie) return msg('Ableton n\'est pas relié (ouvre Ableton avec le projet du morceau)');
          try { const r = await BK.ableton.req({ cmd: 'ping' }); const t = Math.round((r.tempo || 0) * 100) / 100; if (!t) return msg('Ableton ne donne pas de tempo');
            if ((m.bpmSource === 'nous' || m.bpmSource === 'discord') && m.bpm && String(m.bpm) !== String(t) && !await BK.confirmer(`Vous aviez dit ${m.bpm} BPM. Remplacer par ${t} lu dans Ableton ?`)) return;
            m.bpm = String(t); m.bpmSource = 'ableton'; await sauver(m); msg(`${t} BPM lu dans Ableton`); rendre(); }
          catch (e) { msg('Ableton ne répond pas : ' + (e.message || e)); } }
        if (a === 'plein') BK.pleinEcran(m.nom, m.paroles);
        if (a === 'lien') { const u = $('[data-lien="url"]', el).value.trim(); if (!/^https?:\/\//i.test(u)) return msg('Colle un lien qui commence par https://');
          (m.liens = m.liens || []).push({ titre: $('[data-lien="titre"]', el).value.trim(), url: u }); await sauver(m); msg('Lien ajouté'); rendre(); }
      });
    });
  }
  function brancherOrphelins() {
    const bt = $('#biTout', page); if (bt) bt.onclick = creerTout;
    const rm = $('#biRemettre', page); if (rm) rm.onclick = () => { BK.regler('biblio.ignores', []); msg('Projets perso remis dans la liste'); rendre(); };
    $$('.orph', page).forEach(el => {
      const nom = el.dataset.nom;
      $('.f-sel', el).onchange = async e => { const m = B.morceaux.find(x => x.id === e.target.value); if (!m) return;
        (m.alias = m.alias || []).push(BK.inv.normaliser(nom)); await sauver(m); msg('Relié à ' + m.nom); rendre(); };
      $('[data-act="perso"]', el).onclick = () => { const f = B.fichiers.find(x => x.nom === nom);
        BK.regler('biblio.ignores', [...new Set([...BK.reglage('biblio.ignores', []), nom])]);
        if (f && f.chemin) BK.regler('plugins.ignores', [...new Set([...BK.reglage('plugins.ignores', []), f.chemin])]);   // les plugins manquants l'oublient aussi
        el.remove(); msg('Retiré : ' + nom + ' (le fichier n\'est pas touché)'); const n = orphelins().length; $('#biNbR').textContent = n ? `(${n})` : ''; };
      $('[data-act="creer"]', el).onclick = async () => { const n = await BK.saisir('Nom du morceau', BK.inv.normaliser(nom).replace(/\b\w/g, c => c.toUpperCase())); if (!n) return;
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

  $$('#biVues .chip').forEach(c => c.onclick = () => { B.vue = c.dataset.v; BK.regler('biblio.vue', B.vue); rendre(); });
  // ---------- attraper un morceau et le glisser sur « Next release », « Work in progress » ou « Sortis » ----------
  let gl = null;
  const ongletSous = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest('#biVues .chip[data-v]:not([data-v="ranger"])'); };
  $('#biListe').addEventListener('pointerdown', e => {
    const t = e.target.closest('.fiche-tete'), bt = e.target.closest('button,input,select,a,.lecteur'); if (!t || e.button !== 0 || (bt && bt !== t)) return;
    const f = t.closest('.fiche');
    gl = { id: f.dataset.id, tete: t, x: e.clientX, y: e.clientY, fantome: null, pret: false };   // on attrape et on glisse, comme une tâche
  });
  window.addEventListener('pointermove', e => {
    if (!gl) return;
    if (!gl.pret) { if (Math.hypot(e.clientX - gl.x, e.clientY - gl.y) < 6) return;
      gl.pret = true; gl.tete.classList.add('prise'); $('#biVues').classList.add('cible'); $('#biListe').classList.add('en-ordre');
      msg('Lâche-le plus haut ou plus bas pour changer l\'ordre · ou sur un onglet pour le ranger'); }
    if (!gl.fantome) { const r = gl.tete.getBoundingClientRect(); gl.fantome = gl.tete.cloneNode(true); gl.fantome.className = 'fiche-tete fiche-fantome';
      gl.fantome.style.width = Math.min(r.width, 420) + 'px'; gl.dx = Math.min(gl.x - r.left, 400); gl.dy = gl.y - r.top; document.body.appendChild(gl.fantome); }
    gl.fantome.style.left = (e.clientX - gl.dx) + 'px'; gl.fantome.style.top = (e.clientY - gl.dy) + 'px';
    $$('#biVues .chip').forEach(c => c.classList.remove('survol')); const o = ongletSous(e.clientX, e.clientY); o && o.classList.add('survol');
    $$('#biListe .fiche').forEach(x => x.classList.remove('avant', 'apres'));
    if (!o) { const el = document.elementFromPoint(e.clientX, e.clientY), f2 = el && el.closest('.fiche');
      if (f2 && f2.dataset.id !== gl.id) { const r = f2.getBoundingClientRect(); f2.classList.add(e.clientY > r.top + r.height / 2 ? 'apres' : 'avant'); } }
  });
  window.addEventListener('pointerup', async e => {
    if (!gl) return; const d = gl; gl = null; clearTimeout(d.minuteur);
    d.tete.classList.remove('prise'); $('#biVues').classList.remove('cible'); $('#biListe').classList.remove('en-ordre'); $$('#biVues .chip').forEach(c => c.classList.remove('survol'));
    if (!d.pret) return;
    d.fantome && d.fantome.remove(); d.tete.dataset.pasClic = '1'; setTimeout(() => delete d.tete.dataset.pasClic, 50);
    const m = B.morceaux.find(x => x.id === d.id); if (!m) return msg('PRÊT');
    const o = ongletSous(e.clientX, e.clientY);
    if (o) {                                                            // lâché sur un onglet : on change d'état
      if ((m.statut || 'chantier') === o.dataset.v) return msg('Déjà là');
      m.statut = o.dataset.v; await sauver(m); rendre(); return msg(m.nom + ' → ' + o.textContent.trim());
    }
    // lâché dans la liste : on change l'ordre
    const el = document.elementFromPoint(e.clientX, e.clientY), f2 = el && el.closest('.fiche');
    if (!f2 || f2.dataset.id === m.id) return msg('PRÊT');
    const l = (B.affiches || []).slice(), de = l.findIndex(x => x.id === m.id), vers = l.findIndex(x => x.id === f2.dataset.id);
    if (de < 0 || vers < 0) return msg('PRÊT');
    const r = f2.getBoundingClientRect(), apres = e.clientY > r.top + r.height / 2;
    l.splice(de, 1); l.splice(vers + (apres ? (de < vers ? 0 : 1) : (de < vers ? -1 : 0)), 0, m);
    for (let i = 0; i < l.length; i++) if (l[i].rang !== i) { l[i].rang = i; await BK.db.ecrire('morceaux', l[i], { sansAnnuler: i > 0 }); }
    await charger(); msg(m.nom + ' déplacé');
  });
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
    b.disabled = false; b.textContent = 'Scanner ce PC';
  };
  // le Drive d'abord : on relit ses dossiers (pas besoin de scanner un PC)
  $('#biDrive').onclick = async () => { if (!BK.drive.relie()) return msg('Relie d\'abord le Drive (Réglages)');
    const b = $('#biDrive'); b.disabled = true; b.innerHTML = '<span class="spin"></span>Lecture du Drive…';
    try { BK.dossiers.oublier && BK.dossiers.oublier(); await charger(); msg('Drive relu ✓'); } catch (e) { msg('Drive injoignable'); }
    b.disabled = false; b.textContent = '↻ Relire le Drive'; };

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
