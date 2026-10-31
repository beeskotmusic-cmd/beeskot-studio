// =====================================================================
// REELS — le suivi de chaque reel, de l'idée à la publication.
// Une carte par reel : le morceau, le passage audio (Reels Audio), le jour de
// tournage (fiche Tournages : heure, lieu, moodboard, tenues), les médias
// étiquetés, et où on en est. Tout est rangé dans le Drive (collection « reels »).
// =====================================================================
(() => {
const ETAPES = [
  { k: 'idee',    nom: 'Idée',      ic: '💡' },
  { k: 'audio',   nom: 'Audio prêt', ic: '🎵' },
  { k: 'tourne',  nom: 'Tourné',    ic: '🎬' },
  { k: 'monte',   nom: 'Monté',     ic: '🎞' },
  { k: 'publie',  nom: 'Publié',    ic: '🚀' },
];
const TYPES_R = ['Reel', 'TikTok', 'Clip', 'Post', 'Story', 'Live', 'Autre'];
const R = { l: [], morceaux: [], tournages: [], exports: [], tags: {}, fichiers: [], filtre: BK.reglage('suivi.filtre', 'encours'), ouvert: BK.reglage('suivi.ouvert', '') || null };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const date = d => d ? new Date(d.length === 10 ? d + 'T12:00' : d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' }) : '';
const t2 = s => BK.audio.temps(s).replace(/\.\d$/, '');

BK.module('suivi', function (page) {
  $('.sub', page).textContent = 'Chaque reel : l\'audio, le tournage, les médias, où on en est';
  $('.hdr .right', page).innerHTML = `<div><span class="eng" style="font-size:9px">En cours</span><span class="vfd" id="suNb">00</span></div>
    <div><span class="eng" style="font-size:9px">Publiés</span><span class="vfd" id="suPub">00</span></div>`;
  $('.grid', page).innerHTML = `
    <div class="cols">
      <section class="pane vit">
        <div class="ligne-titre">
          <div class="seg" id="suFiltre"><button data-f="encours">En cours</button><button data-f="tout">Tous</button><button data-f="publie">Publiés</button></div>
          <button class="btn sm miette-aide" id="suMiette" style="margin-left:auto" title="Miette relit Discord et crée une carte pour chaque reel dont vous avez parlé (en vert : à valider)">Chercher les reels</button>
          <button class="btn sm" id="suImport" title="Crée une carte pour chaque reel des fiches de tournage">📋 Depuis les tournages</button>
        </div>
        <div class="box grow su-liste" id="suListe"></div>
      </section>
      <section class="pane reg" style="width:300px"><span class="ptitle">② Nouveau reel</span>
        <div class="box">
          <div class="form-rdv">
            <label><span class="eng">Titre</span><input class="fld" id="suTitre" placeholder="ex. Reel refrain Mother"></label>
            <label><span class="eng">Morceau</span><select class="fld" id="suMorceau"><option value="">—</option></select></label>
          </div>
          <button class="btn sm pri" id="suAjout" style="margin-top:10px;width:100%;justify-content:center">+ Créer le reel</button></div>
        <div class="box grow"><span class="lb">Comment ça marche</span>
          <span class="nt">Ouvre une carte et remplis : le morceau, l'extrait (début / fin), le lieu, le cadrage, l'équipement, l'outfit, les notes et la sortie prévue.<br><br>« Envoyer dans Tournages » le range dans Tournages avec tout ça : glisse-le ensuite dans la bonne journée.<br><br>Clique une étape pour dire où vous en êtes.</span></div>
      </section>
    </div>
    <div class="pane abar"><span class="vfd" id="suMsg">PRÊT</span></div>`;
  const msg = t => $('#suMsg').textContent = String(t).toUpperCase().slice(0, 90);

  window.addEventListener('bk:annule', () => charger());
  window.addEventListener('bk:distant', e => { if (e.detail.cols.some(c => /reels|tournages|morceaux/.test(c))) charger(); });
  async function charger() {
    [R.l, R.morceaux, R.tournages] = await Promise.all([BK.db.liste('reels'), BK.db.liste('morceaux'), BK.db.liste('tournages')]);
    R.exports = await BK.exportsAudio.tous();
    $('#suMorceau').innerHTML = '<option value="">—</option>' + R.morceaux.map(m => `<option value="${m.id}">${esc(m.nom)}</option>`).join('');
    if (BK.drive.relie()) { try { R.tags = await BK.etiquettes.tous(); R.fichiers = await BK.dossiers.tousFichiers(); } catch (e) {} }
    rendre();
  }
  BK.suiviRecharger = charger;
  // une image glissée depuis Médias sur la carte d'un reel : elle devient son affiche
  page.addEventListener('dragover', e => { if (BK.glisse.actif() && e.target.closest('.su-aff')) e.preventDefault(); });
  page.addEventListener('drop', async e => { const c = e.target.closest('.su-aff[data-id]'); if (!BK.glisse.actif() || !c) return; e.preventDefault();
    const x = BK.glisse.items.find(y => /^image\//.test(y.mime || '')); if (!x) return msg('Ici, il faut une image'); if (x.dc) return msg('Range d\'abord cette image de Discord dans le Drive (Médias)');
    const r = R.l.find(y => y.id === c.dataset.id); if (!r) return; r.affiche = BK.img.ref(x.id); await BK.db.ecrire('reels', r); msg('Nouvelle affiche pour « ' + (r.titre || 'ce reel') + ' »'); rendre(); });
  BK.suiviOuvrir = async id => { R.ouvert = id; BK.regler('suivi.ouvert', id); R.filtre = 'tout'; BK.ouvrir('suivi'); await charger(); };

  const morceauDe = r => R.morceaux.find(m => m.id === r.morceau);
  const tournageDe = r => R.tournages.find(t => t.id === r.tournage) ||
    R.tournages.find(t => (t.plans || []).some(p => BK.inv.trouverMorceau(p.reel || '', R.morceaux) && (BK.inv.trouverMorceau(p.reel, R.morceaux) || {}).id === r.morceau));
  const audioDe = r => { const m = morceauDe(r); if (!m) return null;
    return R.exports.find(e => e.id === r.audio) || R.exports.find(e => BK.inv.normaliser(e.morceau || '') === BK.inv.normaliser(m.nom)) || null; };
  const mediasDe = r => { const m = morceauDe(r); if (!m) return [];
    return R.fichiers.filter(f => { const l = BK.etiquettes.liste(R.tags, f.id); return l.includes(m.id) || (r.tournage && l.includes('t:' + r.tournage)); })
      .filter(f => /^(image|video)\//.test(f.mimeType || '')); };

  // l'image du poster : d'abord le moodboard du tournage, sinon la photo du morceau,
  // sinon (chargée après coup) une image étiquetée pour ce reel
  function imageDe(r) {
    const t = tournageDe(r), m = morceauDe(r);
    return r.affiche || (t && (t.moodboard || [])[0]) || (m && m.photo) || '';
  }

  // ---------- le POSTER vertical ----------
  const nomCourt = r => { if (r.nom) return r.nom;
    if (r.titre && r.titre.length <= 18) return r.titre;
    const n = [...R.l].sort((a, b) => String(a.id).localeCompare(String(b.id))).findIndex(x => x.id === r.id) + 1;
    return (r.type || 'Reel') + ' ' + n; };
  function affiche(r) {
    const m = morceauDe(r), t = tournageDe(r), a = audioDe(r), md = mediasDe(r);
    const i = ETAPES.findIndex(e => e.k === (r.statut || 'idee'));
    const choisi = R.ouvert === r.id;
    const img = imageDe(r);
    const pas = r.passage || (a && a.duree ? { debut: a.debut || 0, fin: (a.debut || 0) + a.duree } : null);
    return `<button class="su-aff${choisi ? ' on' : ''}${r.miette ? ' mi-prop' : ''}${r.statut === 'publie' ? ' sorti' : ''}" data-ouv="${r.id}" data-id="${r.id}"
        ${BK.img.bg(img)} data-mdimg="${(md.find(f => /^image\//.test(f.mimeType || '')) || {}).id || ''}" data-vid="${(md.find(f => /^video\//.test(f.mimeType || '')) || {}).id || ''}"
        title="${esc(r.titre || 'Reel')}">
      ${img ? '' : '<span class="su-aff-vide">🎬</span>'}
      <span class="su-aff-jauge"><i style="width:${Math.round((i + 1) / ETAPES.length * 100)}%"></i></span>
      <span class="su-aff-bas">
        <span class="su-aff-type">${esc(r.type || 'Reel')}</span>
        <span class="su-aff-t">${esc(nomCourt(r))}</span>
        ${m ? `<span class="su-aff-m"><em style="--tc:${BK.couleurTag(m.id)}">♪ ${esc(m.nom)}</em></span>` : ''}
        <span class="su-aff-pas">${ETAPES.map((e, k) => `<i class="${k <= i ? 'faite' : ''}"></i>`).join('')}<em>${esc(ETAPES[Math.max(0, i)].nom)}</em></span>
      </span>
      ${pas ? '<span class="su-aff-son">♪</span>' : ''}
      <span class="su-aff-outils">${r.miette ? `<span class="mi-val" data-reval="${r.id}" title="Trouvé par Miette sur Discord${r.pourquoi ? ' : « ' + esc(r.pourquoi) + ' »' : ''} — c'est bon ?">✓</span>` : ''}<span class="su-aff-o" data-affiche="${r.id}" title="Changer l'image">🖼</span>${r.affiche ? `<span class="su-aff-o" data-imgx="${r.id}" title="Revenir à l'image automatique (moodboard)">↺</span>` : ''}</span>
      ${r.sortie ? `<span class="su-aff-date sortie" title="Sortie prévue">🚀 ${esc(date(r.sortie))}</span>` : t && t.date ? `<span class="su-aff-date" title="Tournage">${esc(date(t.date))}</span>` : ''}
    </button>`;
  }

  // ---------- le panneau qui s'ouvre en dessous : exactement la même ligne qu'avant ----------
  function carte(r) {
    const m = morceauDe(r), t = tournageDe(r), a = audioDe(r);
    const i = ETAPES.findIndex(e => e.k === (r.statut || 'idee'));
    const tp = t && t.parent ? R.tournages.find(x => x.id === t.parent) : null;     // le tournage (la journée) où ce reel est tourné
    const pas = r.passage || (a && a.duree ? { debut: a.debut || 0, fin: (a.debut || 0) + a.duree } : null);
    if (r.statut === 'publie') return carteStats(r, i);
    return `<div class="su-c ouverte" data-id="${r.id}">
      <div class="su-tete">
        <input class="fld su-nom" data-nom="${r.id}" value="${esc(nomCourt(r))}" title="Le nom sur le poster" placeholder="ex. Reel 1">
        <button class="su-titre" data-ouv="${r.id}">${r.titre && r.titre !== nomCourt(r) ? `<span class="nt su-long">${esc(r.titre)}</span>` : ''}${m ? `<span class="su-m">${esc(m.nom)}</span>` : ''}</button>
        <select class="fld su-type" data-type="${r.id}" title="C'est quoi ?">${TYPES_R.map(x => `<option${(r.type || 'Reel') === x ? ' selected' : ''}>${x}</option>`).join('')}</select>
        <div class="su-etapes">${ETAPES.map((e, k) => `<button class="su-e${k <= i ? ' ok' : ''}${k === i ? ' on' : ''}" data-st="${r.id}|${e.k}" title="${e.nom}">${e.ic}</button>`).join('')}</div>
        <button class="btn xs" data-ouv="${r.id}" title="Replier">▾ Fermer</button>
        <button class="btn xs" data-sx="${r.id}" title="Retirer">✕</button></div>
      <div class="su-form">
        <label class="su-f-m"><span class="eng">♪ Morceau</span>
          <select class="fld" data-fm="${r.id}"><option value="">—</option>${R.morceaux.map(x => `<option value="${x.id}"${r.morceau === x.id ? ' selected' : ''}>${esc(x.nom)}</option>`).join('')}<option value="autre"${!r.morceau && r.morceauAutre != null ? ' selected' : ''}>Autre…</option></select>
          ${!r.morceau && r.morceauAutre != null ? `<input class="fld" data-f="morceauAutre" value="${esc(r.morceauAutre)}" placeholder="Lequel ?">` : ''}</label>
        <div class="su-f-audio"><span class="eng">🎵 Extrait audio</span>
          <div class="su-tc"><span class="eng">Début</span><input class="fld vfd-in" data-tc="debut" value="${pas ? BK.audio.temps(pas.debut) : ''}" placeholder="0:00.0"></div>
          <div class="su-tc"><span class="eng">Fin</span><input class="fld vfd-in" data-tc="fin" value="${pas ? BK.audio.temps(pas.fin) : ''}" placeholder="0:30.0"></div>
          <select class="fld su-pass" data-pass="${r.id}"><option value="">Passage…</option></select>
          <button class="btn xs" data-play="${r.id}" title="Écouter l'extrait"${pas ? '' : ' disabled'}>▶</button>
          <button class="btn xs" data-au="${r.id}" title="Ouvre Reels Audio avec ce passage">→ Reels Audio</button>
          ${a ? `<span class="nt">✓ export : ${esc(a.nom)}</span>` : ''}</div>
        <label><span class="eng">📍 Localisation</span><input class="fld" data-f="lieu" value="${esc(r.lieu || '')}" placeholder="ex. extérieur, paysage d'automne, montagne au loin"></label>
        <label><span class="eng">🎥 Cadrage</span><input class="fld" data-f="cadrage" value="${esc(r.cadrage || '')}" placeholder="ex. plan fixe, plein pied"></label>
        <label><span class="eng">🎸 Équipement</span><input class="fld" data-f="equipement" value="${esc(r.equipement || '')}" placeholder="ex. tous les instruments, pour faire un vrai live"></label>
        <label><span class="eng">👕 Outfit</span><input class="fld" data-f="outfit" value="${esc(r.outfit || '')}" placeholder="ex. chill rétro, pull en laine, poncho"></label>
        <label class="su-f-large"><span class="eng">📝 Notes</span><textarea class="fld" data-f="notes" rows="2" placeholder="ex. tout le monde joue, regard vers la gauche, sous-titre au milieu">${esc(r.notes || '')}</textarea></label>
        <label><span class="eng">🚀 Sortie prévue</span><span class="su-sortie-l"><input class="fld" data-sortie="${r.id}" value="${esc(r.sortie || '')}" placeholder="une date ou « début novembre »"><button class="btn xs" data-cal="${r.id}" title="Choisir une date">📅</button><input type="date" data-cald="${r.id}" hidden></span>
          <span class="nt">${/^\d{4}-\d{2}-\d{2}$/.test(r.sortie || '') ? (r.evenement ? '✓ dans le Calendrier' : '') : r.sortie ? 'période : pas dans le Calendrier' : ''}</span></label>
      </div>
      <div class="su-pied">${t ? `<span class="nt">🎬 Dans Tournages${tp ? ' · ' + esc(tp.titre || 'Tournage') : ' · pas encore dans une journée'}${t.fini ? ' · ✓ tourné' : ''}</span><button class="btn sm pri" data-to="${r.id}">🎬 Voir dans Tournages</button>`
        : `<button class="btn sm pri" data-envt="${r.id}" title="Crée le reel dans Tournages avec ces infos (tu pourras le glisser dans la bonne journée)">🎬 Envoyer dans Tournages</button>`}</div>
    </div>`;
  }

  // ---------- un reel SORTI : sa page devient « Statistiques » (liens TikTok / Instagram, chiffres, commentaires) ----------
  const nb = x => x == null ? '—' : x >= 1e6 ? (x / 1e6).toFixed(1).replace('.0', '') + ' M' : x >= 1e4 ? Math.round(x / 1e3) + ' k' : String(x);
  function carteStats(r, i) {
    const st = r.stats || {}, L = r.liens || {};
    const bloc = (k, nom, lien) => { const s = st[k];
      return `<div class="su-st-b"><div class="ligne-titre"><span class="lb">${nom}</span>${lien ? `<button class="btn xs" data-url="${esc(lien)}" style="margin-left:auto">↗ Ouvrir</button>` : ''}</div>
        <input class="fld" data-lien="${k}" value="${esc(lien || '')}" placeholder="Colle le lien du ${nom === 'TikTok' ? 'TikTok' : 'post Instagram'}">
        ${s ? `<div class="su-st-ch">${[['Vues', s.vues], ['J\'aime', s.likes], ['Commentaires', s.comms], ['Partages', s.partages], ['Enregistrés', s.enreg]].filter(([, v]) => v != null).map(([n, v]) => `<div><span class="vfd">${nb(v)}</span><span class="eng">${n}</span></div>`).join('')}</div>
          <span class="nt">Mis à jour ${esc(new Date(s.t).toLocaleString('fr-CA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}</span>`
          : `<span class="nt">${lien ? 'Pas encore de chiffres : « ↻ Actualiser les stats ».' : 'Colle le lien pour voir les chiffres ici.'}</span>`}</div>`; };
    const comms = (st.insta && st.insta.commentaires) || [];
    return `<div class="su-c ouverte su-stats" data-id="${r.id}">
      <div class="su-tete">
        <span class="su-sorti-b">★ SORTI</span><input class="fld su-nom" data-nom="${r.id}" value="${esc(nomCourt(r))}" title="Le nom sur le poster">
        <span class="lb" style="margin:0">📈 Statistiques</span>
        <div class="su-etapes">${ETAPES.map((e, k) => `<button class="su-e${k <= i ? ' ok' : ''}${k === i ? ' on' : ''}" data-st="${r.id}|${e.k}" title="${e.nom}">${e.ic}</button>`).join('')}</div>
        <button class="btn xs" data-ouv="${r.id}" title="Replier">▾ Fermer</button></div>
      <div class="su-st">${bloc('tiktok', 'TikTok', L.tiktok)}${bloc('insta', 'Instagram', L.insta)}</div>
      <div class="su-pied"><span class="nt" id="suApi">${BK.reseaux && BK.reseaux.relie() ? '' : 'Les chiffres arrivent tout seuls une fois TikTok et Instagram reliés (⚙ Relier).'}</span>
        <button class="btn sm" data-relier="1">⚙ Relier TikTok / Instagram</button><button class="btn sm pri" data-stats="${r.id}">↻ Actualiser les stats</button></div>
      ${comms.length ? `<div class="box"><span class="lb">Commentaires Instagram (${comms.length})</span><div class="su-comms">${comms.map(c => `<div class="su-comm"><b>${esc(c.qui)}</b> ${esc(c.texte)}<span class="nt">${esc(new Date(c.t).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' }))}</span></div>`).join('')}</div></div>` : ''}
    </div>`;
  }
  function rendre() {
    $$('#suFiltre button').forEach(b => b.classList.toggle('on', b.dataset.f === R.filtre));
    const l = R.l.filter(r => R.filtre === 'tout' || (R.filtre === 'publie' ? r.statut === 'publie' : r.statut !== 'publie'))
      .sort((a, b) => (b.maj || '').localeCompare(a.maj || ''));
    $('#suNb').textContent = String(R.l.filter(r => r.statut !== 'publie').length).padStart(2, '0');
    $('#suPub').textContent = String(R.l.filter(r => r.statut === 'publie').length).padStart(2, '0');
    if (R.ouvert && !l.some(r => r.id === R.ouvert)) R.ouvert = null;
    const choisi = l.find(r => r.id === R.ouvert);
    $('#suListe').innerHTML = l.length
      ? `<div class="su-affs">${l.map(affiche).join('')}</div>${choisi ? carte(choisi) : ''}`
      : `<span class="nt" style="padding:20px">${R.filtre === 'publie' ? 'Aucun reel publié pour l\'instant.' : 'Aucun reel. Crée-en un à droite, ou reprends ceux des fiches de tournage.'}</span>`;
    brancher(); lectureForm();
  }

  // ---------- le formulaire d'un reel déjà rempli : en LECTURE (« ✎ Modifier » pour changer) ; un reel tout neuf : en édition ----------
  R.edits = R.edits || new Set(); R.neufs = R.neufs || new Set();
  function lectureForm() {
    const c = $('#suListe .su-c[data-id]'), f = c && c.querySelector('.su-form'); if (!f) return;
    const id = c.dataset.id, fm = f.querySelector('[data-fm]');
    const plein = [...f.querySelectorAll('input.fld:not([type=date]), textarea.fld')].some(i => i.value.trim()) || !!(fm && fm.value);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn xs su-edit'; f.appendChild(b);
    const appliquer = lect => { f.classList.toggle('lecture', lect); b.textContent = lect ? '✎ Modifier' : '✓ OK'; b.title = lect ? 'Modifier ce reel' : 'Fini : revenir en lecture';
      f.querySelectorAll('input.fld, textarea.fld').forEach(i => { i.readOnly = lect; i.tabIndex = lect ? -1 : 0; });
      f.querySelectorAll('select.fld').forEach(i => { i.disabled = lect; });
      f.querySelectorAll(':scope > label').forEach(l => { const x = l.querySelector('input.fld:not([type=date]), textarea.fld, select.fld'); l.classList.toggle('vide-l', lect && !!x && !String(x.value || '').trim()); });
      const au = f.querySelector('.su-f-audio'); if (au) au.classList.toggle('vide-l', lect && ![...au.querySelectorAll('input.fld')].some(i => i.value.trim()) && !au.querySelector('.nt'));
      f.querySelectorAll('textarea.fld').forEach(a => { a.style.height = ''; if (lect) a.style.height = (a.scrollHeight + 2) + 'px'; }); };
    appliquer(plein && !R.neufs.has(id) && !R.edits.has(id));
    b.onclick = e => { e.stopPropagation(); const lect = !f.classList.contains('lecture'); if (lect) R.edits.delete(id); else R.edits.add(id); appliquer(lect); };
  }

  // ---------- écouter le passage : on va chercher l'export, sinon le meilleur fichier du Drive ----------
  const lect = new Audio(); let lectFin = 0;
  BK.mini.suivre(lect, { page: 'suivi', titre: () => lect.titre || 'Passage du reel' });
  lect.addEventListener('timeupdate', () => { if (lectFin && lect.currentTime >= lectFin) lect.pause(); });
  const sources = {};
  async function jouerPassage(r) {
    const pas = r.passage || (() => { const a = audioDe(r); return a && a.duree ? { debut: a.debut || 0, fin: (a.debut || 0) + a.duree } : null; })();
    const m = morceauDe(r);
    if (!lect.paused && lect.dataset.r === r.id) { lect.pause(); return msg('Pause'); }
    msg('Chargement…');
    try {
      let url = sources[r.id];
      if (!url) {
        const a = audioDe(r);
        if (a && (BK.reelsExports || {})[a.id]) url = BK.reelsExports[a.id];
        else {                                          // sinon : l'export ★ de la fiche du morceau
          const src = await BK.sonDuMorceau(m, R.morceaux);
          if (!src) return msg('Aucun export dans la fiche de ' + (m ? m.nom : 'ce morceau'));
          msg('Chargement de ' + src.nom + '…');
          const oct = src.drive ? await BK.drive.telecharger(src.drive) : await BK.fichier.lireOctets(src.chemin);
          url = URL.createObjectURL(new Blob([oct], { type: 'audio/wav' }));
        }
        if (!url) return msg('Aucun son à écouter : choisis le passage dans Reels Audio');
        sources[r.id] = url;
      }
      if (lect.dataset.r !== r.id) { lect.src = url; lect.dataset.r = r.id; }
      lect.titre = (m ? m.nom + ' · ' : '') + (r.titre || 'Reel');
      lect.currentTime = (pas && pas.debut) || 0; lectFin = pas ? pas.fin : 0;
      await lect.play(); msg(pas ? `▶ ${t2(pas.debut)} → ${t2(pas.fin)}` : '▶ lecture');
    } catch (e) { console.error(e); msg('Lecture impossible'); }
  }

  // la vidéo d'un reel, téléchargée une fois (seulement si elle n'est pas trop lourde) et gardée pendant la session
  const VIDS = {};
  function videoDe(id) {
    if (VIDS[id] !== undefined) return VIDS[id];
    const f = R.fichiers.find(x => x.id === id);
    if (!f || (f.size && +f.size > 80e6)) return VIDS[id] = Promise.resolve('');
    return VIDS[id] = BK.drive.api(`/files/${id}?fields=size`).then(r => r.json()).then(x => { if (+x.size > 80e6) throw 0; return BK.drive.api(`/files/${id}?alt=media`); }).then(r => r.blob()).then(b => URL.createObjectURL(b)).catch(() => (delete VIDS[id], ''));
  }

  // ---------- l'extrait audio et le lien avec Tournages ----------
  const enSec = txt => { const t = String(txt || '').trim().replace(',', '.'); if (!t) return null;
    const m = t.match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/); return m ? (+(m[1] || 0)) * 60 + +m[2] : null; };
  // les passages gardés pour un morceau : ceux tapés ici, ceux de Reels Audio (exports, Discord)
  async function passagesDe(r) { const m = morceauDe(r); if (!m) return [];
    const l = [], vu = new Set(), ajout = p => { if (!p || !(p.fin > p.debut)) return; const k = Math.round(p.debut * 10) + '-' + Math.round(p.fin * 10); if (!vu.has(k)) { vu.add(k); l.push(p); } };
    ((await BK.partage.lire('passages.reels', {}))[m.id] || []).forEach(ajout);
    R.exports.filter(e => BK.inv.normaliser(e.morceau || '') === BK.inv.normaliser(m.nom) && e.duree).forEach(e => ajout({ debut: e.debut || 0, fin: (e.debut || 0) + e.duree }));
    ((await BK.partage.lire('passages.discord', {}))[m.id] || []).forEach(ajout);
    return l.sort((a, b) => a.debut - b.debut); }
  async function passage(r, p) {
    r.passage = { debut: Math.round(p.debut * 10) / 10, fin: Math.round(p.fin * 10) / 10 }; delete sources[r.id];
    await BK.db.ecrire('reels', r);
    const m = morceauDe(r);
    if (m) { const tout = await BK.partage.lire('passages.reels', {}), l = tout[m.id] = tout[m.id] || [];
      if (!l.some(x => Math.abs(x.debut - r.passage.debut) < .05 && Math.abs(x.fin - r.passage.fin) < .05)) { l.push(r.passage); await BK.partage.ecrire('passages.reels', tout); } }
    await versTournage(r); msg(`Extrait ${BK.audio.temps(r.passage.debut)} → ${BK.audio.temps(r.passage.fin)} gardé`); rendre();
  }
  // le reel dans Tournages : créé au premier envoi (dans « Reels sans tournage »), puis tenu à jour
  async function versTournage(r, creer) {
    let t = R.tournages.find(x => x.id === r.tournage);
    if (!t && !creer) return;
    const m = morceauDe(r), pas = r.passage ? BK.audio.temps(r.passage.debut).replace(/\.\d$/, '') + ' – ' + BK.audio.temps(r.passage.fin).replace(/\.\d$/, '') : '';
    const infos = { titre: nomCourt(r), morceau: m ? m.nom : (r.morceauAutre || ''), lieu: r.lieu || '', materiel: r.equipement || '', idee: r.notes || '',
      outfit: r.outfit || '', audio: pas };
    if (!t) t = { niveau: 'reel', parent: '', ordre: 0, type: r.type || 'Reel', date: '', heure: '', moodboard: [], tenues: {}, notes: '', plans: [] };
    // l'outfit va dans les notes du tournage (une ligne « Outfit : … » qu'on remplace)
    t.notes = [r.outfit ? 'Outfit : ' + r.outfit : '', ...String(t.notes || '').split('\n').filter(l => l && !/^Outfit : /.test(l))].filter(Boolean).join('\n');
    Object.assign(t, infos); t.passage = r.passage ? { debut: r.passage.debut, fin: r.passage.fin } : t.passage;
    t.plans = t.plans || []; if (r.cadrage || pas) { if (!t.plans.length) t.plans.push({ cadrage: '', action: '', duree: '', notes: '' }); t.plans[0].action = t.plans[0].action || r.cadrage || ''; t.plans[0].audio = pas; }
    t = await BK.db.ecrire('tournages', t);
    if (!R.tournages.includes(t)) R.tournages = R.tournages.filter(x => x.id !== t.id).concat(t);
    if (r.tournage !== t.id) { r.tournage = t.id; await BK.db.ecrire('reels', r); }
    BK.tournagesRecharger && BK.tournagesRecharger();
  }

  function brancher() {
    const z = $('#suListe');
    $$('[data-ouv]', z).forEach(b => b.onclick = () => { R.ouvert = R.ouvert === b.dataset.ouv ? null : b.dataset.ouv; BK.regler('suivi.ouvert', R.ouvert || ''); rendre();
      if (R.ouvert) setTimeout(() => { const c = $('.su-c', z); c && c.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 60); });
    $$('[data-lien]', z).forEach(i => { i.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') i.blur(); });
      i.onchange = async () => { const r = R.l.find(x => x.id === i.closest('.su-c').dataset.id); r.liens = { ...(r.liens || {}), [i.dataset.lien]: i.value.trim() }; await BK.db.ecrire('reels', r); msg('Lien enregistré'); rendre(); }; });
    $$('.su-stats [data-url]', z).forEach(b => b.onclick = () => BK.ouvrirLien(b.dataset.url));
    $$('[data-relier]', z).forEach(b => b.onclick = () => BK.reseaux && BK.reseaux.fenetre());
    $$('[data-stats]', z).forEach(b => b.onclick = async () => { const r = R.l.find(x => x.id === b.dataset.stats); b.disabled = true; b.innerHTML = '<span class="spin"></span>Stats…';
      try { const n = await BK.reseaux.actualiser(r); await BK.db.ecrire('reels', r); msg(n ? 'Stats à jour' : 'Rien à lire : relie TikTok / Instagram, et colle les liens'); }
      catch (e) { msg(e.message || 'Stats impossibles'); } rendre(); });
    $$('[data-reval]', z).forEach(b => b.onclick = async e => { e.stopPropagation(); const r = R.l.find(x => x.id === b.dataset.reval); if (!r) return;
      delete r.miette; await BK.db.ecrire('reels', r); msg('Reel validé'); rendre(); });
    $$('[data-play]', z).forEach(b => b.onclick = e => { e.stopPropagation(); jouerPassage(R.l.find(x => x.id === b.dataset.play)); });
    // la vignette : une image des médias du reel si la fiche du morceau n'en a pas
    (async () => { for (const b of $$('.su-aff[data-mdimg]', z)) { if (b.style.backgroundImage || b.dataset.img || b.classList.contains('img-charge') || !b.dataset.mdimg) continue;
      const f = R.fichiers.find(x => x.id === b.dataset.mdimg); if (!f) continue;
      try { const u = await BK.drive.vignette(f); if (u) { b.style.backgroundImage = `url(${u})`; const v = b.querySelector('.su-aff-vide'); v && v.remove(); } } catch (e) {} } })();
    // souris sur une carte : s'il y a une vidéo du reel, elle passe en priorité (sans le son, en boucle)
    $$('.su-aff[data-vid]', z).forEach(b => { if (!b.dataset.vid) return;
      b.addEventListener('mouseenter', async () => { b._dessus = true;
        try { const u = await videoDe(b.dataset.vid); if (!u || !b._dessus || b.querySelector('video')) return;
          const v = document.createElement('video'); v.className = 'su-aff-vid'; v.src = u; v.muted = true; v.loop = true; v.playsInline = true;
          b.prepend(v); await v.play().catch(() => {}); } catch (e) {} });
      b.addEventListener('mouseleave', () => { b._dessus = false; const v = b.querySelector('video'); if (v) { v.pause(); v.remove(); } }); });
    $$('[data-st]', z).forEach(b => b.onclick = async () => { const [id, k] = b.dataset.st.split('|'); const r = R.l.find(x => x.id === id);
      const avant = ETAPES.findIndex(e => e.k === (r.statut || 'idee'));
      r.statut = r.statut === k ? (ETAPES[Math.max(0, ETAPES.findIndex(e => e.k === k) - 1)] || {}).k || 'idee' : k;
      await BK.db.ecrire('reels', r);
      const t = tournageDe(r), apres = ETAPES.findIndex(e => e.k === r.statut), kt = ETAPES.findIndex(e => e.k === 'tourne');
      if (t && r.tournage === t.id && !!t.fini !== (apres >= kt)) { t.fini = apres >= kt; await BK.db.ecrire('tournages', t); BK.tournagesRecharger && BK.tournagesRecharger(); }
      await noterDansTodo(r, avant, ETAPES.findIndex(e => e.k === r.statut));
      msg(ETAPES.find(e => e.k === r.statut).nom); rendre(); });
    // la sortie prévue : une date (→ rendez-vous « Publication » dans le Calendrier) ou une période en mots (« début novembre »)
    const estDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
    const sortie = async (r, d) => {
      d = String(d || '').trim().slice(0, 40); r.sortie = d;
      if (estDate(d)) { const m = morceauDe(r);
        const ev = { id: r.evenement || undefined, type: 'promo', titre: 'Sortie du reel : ' + nomCourt(r), morceau: m ? m.nom : '', date: d, heure: '', lieu: '', reel: r.id };
        const e = await BK.db.ecrire('evenements', ev); r.evenement = e.id; }
      else if (r.evenement) { try { await BK.db.supprimer('evenements', r.evenement); } catch (e) {} delete r.evenement; }
      await BK.db.ecrire('reels', r); BK.agendaRecharger && BK.agendaRecharger();
      msg(!d ? 'Sortie prévue enlevée' : estDate(d) ? 'Sortie le ' + date(d) + ' · dans le Calendrier ✓' : 'Sortie prévue : ' + d); rendre();
    };
    $$('[data-sortie]', z).forEach(i => { i.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') i.blur(); }); i.onchange = () => sortie(R.l.find(x => x.id === i.dataset.sortie), i.value); });
    $$('[data-cal]', z).forEach(b => b.onclick = () => { const d = $(`[data-cald="${b.dataset.cal}"]`, z); const r = R.l.find(x => x.id === b.dataset.cal);
      if (estDate(r.sortie)) d.value = r.sortie; d.onchange = () => d.value && sortie(r, d.value); try { d.showPicker(); } catch (e) { d.hidden = false; d.focus(); } });
    // les champs du formulaire : enregistrés dans le reel, et recopiés dans Tournages s'il y est déjà
    const champ = async (r, k, v) => { r[k] = v; await BK.db.ecrire('reels', r); await versTournage(r); msg('Enregistré'); };
    $$('[data-f]', z).forEach(i => { const r = R.l.find(x => x.id === i.closest('.su-c').dataset.id);
      i.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && i.tagName === 'INPUT') i.blur(); });
      i.onchange = () => champ(r, i.dataset.f, i.value.trim()); });
    $$('[data-fm]', z).forEach(sel => sel.onchange = async () => { const r = R.l.find(x => x.id === sel.dataset.fm);
      if (sel.value === 'autre') { r.morceau = ''; r.morceauAutre = r.morceauAutre || ''; } else { r.morceau = sel.value; delete r.morceauAutre; }
      await BK.db.ecrire('reels', r); await versTournage(r); rendre(); if (sel.value === 'autre') setTimeout(() => { const x = $('[data-f="morceauAutre"]', z); x && x.focus(); }, 30); });
    // l'extrait : début / fin tapés à la main, gardés en mémoire pour ce morceau (menu « Passage »)
    $$('[data-tc]', z).forEach(i => { const c = i.closest('.su-c'), r = R.l.find(x => x.id === c.dataset.id);
      i.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') i.blur(); });
      i.onchange = async () => { const d = enSec($('[data-tc="debut"]', c).value), f = enSec($('[data-tc="fin"]', c).value);
        if (d == null || f == null) return msg(d == null && f == null ? 'Tape un temps, ex. 0:08.0' : 'Il manque ' + (d == null ? 'le début' : 'la fin'));
        if (f <= d) return msg('La fin doit être après le début');
        await passage(r, { debut: d, fin: f }); }; });
    $$('[data-pass]', z).forEach(sel => { const r = R.l.find(x => x.id === sel.dataset.pass);
      passagesDe(r).then(l => { sel._l = l; sel.innerHTML = `<option value="">${l.length ? 'Passage… (' + l.length + ')' : 'Aucun passage gardé'}</option>` + l.map((p, k) => `<option value="${k}">${BK.audio.temps(p.debut)} → ${BK.audio.temps(p.fin)}</option>`).join(''); });
      sel.onchange = async () => { const p = (sel._l || [])[+sel.value]; if (p) await passage(r, { debut: p.debut, fin: p.fin }); }; });
    $$('[data-envt]', z).forEach(b => b.onclick = async () => { const r = R.l.find(x => x.id === b.dataset.envt); b.disabled = true;
      try { await versTournage(r, true); msg('« ' + nomCourt(r) + ' » est dans Tournages (Reels sans tournage) : glisse-le dans la bonne journée'); rendre(); }
      catch (e) { b.disabled = false; msg('Envoi impossible'); } });
    $$('[data-nom]', z).forEach(i => { i.onclick = e => e.stopPropagation(); i.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') i.blur(); });
      i.onchange = async () => { const r = R.l.find(x => x.id === i.dataset.nom); r.nom = i.value.trim().slice(0, 24); await BK.db.ecrire('reels', r); msg('Nom : ' + nomCourt(r)); rendre(); }; });
    $$('[data-type]', z).forEach(sel => { sel.onclick = e => e.stopPropagation(); sel.onchange = async () => { const r = R.l.find(x => x.id === sel.dataset.type); r.type = sel.value; await BK.db.ecrire('reels', r); msg('Type : ' + r.type); rendre(); }; });
    $$('[data-imgx]', z).forEach(b => b.onclick = async e => { e.stopPropagation(); const r = R.l.find(x => x.id === b.dataset.imgx); delete r.affiche; delete r.afficheIA; await BK.db.ecrire('reels', r); msg('Image automatique'); rendre(); });
    $$('[data-affiche]', z).forEach(b => b.onclick = async e => { e.stopPropagation(); const r = R.l.find(x => x.id === b.dataset.affiche), m = morceauDe(r);
      const image = f => /^image\//.test(f.mimeType || '');
      const reduire = async (blob) => { const b = BK.ia.reduireImage ? await BK.ia.reduireImage(blob, 900) : blob;      // petite, rangée dans la fiche
        return new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(b); }); };
      const fin = async (v) => { if (!v) return; r.affiche = v; r.afficheIA = false; await BK.db.ecrire('reels', r); msg('Image du poster enregistrée'); rendre(); };
      if (!BK.drive.relie()) {                                    // sans Drive : une image de ce PC
        const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
        inp.onchange = async () => { if (inp.files[0]) fin(await reduire(inp.files[0])); }; return inp.click(); }
      const l = await BK.choisirDansMedias({ titre: 'Image du poster · ' + nomCourt(r), bouton: 'Choisir cette image', type: 'image', sujet: m ? m.id : '' });
      if (!l || !l[0]) return;
      msg('Image du poster…');
      try { fin((await BK.img.depuisChoix(l[0], 'photovideo')).ref); } catch (e) { msg('Image illisible'); }
    });
    $$('[data-sx]', z).forEach(b => b.onclick = async () => { const r = R.l.find(x => x.id === b.dataset.sx);
      if (!await BK.confirmer(`Retirer « ${r.titre || 'ce reel'} » du suivi ?`)) return;
      R.l = R.l.filter(x => x !== r); await BK.db.supprimer('reels', r.id); msg('Retiré'); rendre(); });
    $$('[data-au]', z).forEach(b => b.onclick = async () => { const r = R.l.find(x => x.id === b.dataset.au), m = morceauDe(r);
      if (!m) return msg(r.morceauAutre != null ? 'Reels Audio ne marche qu\'avec un morceau de la Bibliothèque' : 'Choisis d\'abord le morceau');
      BK.suiviEnCours = r.id;
      if (r.passage) BK.reelsPasser({ morceau: m, debut: r.passage.debut, fin: r.passage.fin });
      else { BK.ouvrir('reels'); BK.reelsPasser({ morceau: m }); } });
    $$('[data-tfini]', z).forEach(b => b.onclick = async () => { const r = R.l.find(x => x.id === b.dataset.tfini), t = tournageDe(r); if (!t) return;
      t.fini = !t.fini; await BK.db.ecrire('tournages', t); const kt = ETAPES.findIndex(e => e.k === 'tourne');
      if (t.fini && ETAPES.findIndex(e => e.k === (r.statut || 'idee')) < kt) { r.statut = 'tourne'; await BK.db.ecrire('reels', r); }
      BK.tournagesRecharger && BK.tournagesRecharger(); msg(t.fini ? 'Tourné ✓' : 'Tournage remis à faire'); rendre(); });
    $$('[data-to]', z).forEach(b => b.onclick = async () => { const r = R.l.find(x => x.id === b.dataset.to); let t = tournageDe(r);
      if (!t) { const m = morceauDe(r);
        t = await BK.db.ecrire('tournages', { titre: r.titre || 'Tournage', type: 'Reel', morceau: m ? m.nom : '', date: '', heure: '', lieu: '', idee: r.notes || '', moodboard: [], plans: [], tenues: {}, materiel: '', notes: '' });
        r.tournage = t.id; await BK.db.ecrire('reels', r); R.tournages.push(t); msg('Fiche de tournage créée'); }
      BK.tournageOuvrir ? BK.tournageOuvrir(t.id) : BK.ouvrir('tournage'); });
    // ＋ Insérer : la fenêtre Médias (jamais l'onglet Médias) ; ce qu'on choisit est étiqueté pour ce reel
    const assurerTournage = async r => { let t = tournageDe(r); if (t) return t; const m = morceauDe(r);
      t = await BK.db.ecrire('tournages', { titre: r.nom || r.titre || 'Tournage', type: 'Reel', morceau: m ? m.nom : '', date: '', heure: '', lieu: '', idee: '', moodboard: [], plans: [], tenues: {}, materiel: '', notes: '' });
      r.tournage = t.id; await BK.db.ecrire('reels', r); R.tournages.push(t); return t; };
    $$('[data-moodins]', z).forEach(b => b.onclick = async e => { e.stopPropagation(); const r = R.l.find(x => x.id === b.dataset.moodins);
      if (!BK.drive.relie()) return msg('Relie d\'abord le Drive');
      const l = await BK.choisirDansMedias({ titre: 'Moodboard · ' + nomCourt(r), bouton: 'Ajouter au moodboard', type: 'image', sujet: 'c:moodboard' }); if (!l || !l.length) return;
      const t = await assurerTournage(r); t.moodboard = t.moodboard || []; msg('Ajout au moodboard…');
      for (const x of l) { try { const d = await BK.img.depuisChoix(x, 'moodboard'); if (d.ref && !t.moodboard.includes(d.ref)) t.moodboard.push(d.ref);
        if (d.id) for (const k of ['t:' + t.id, 'c:moodboard', 'c:tournage']) await BK.etiquettes.basculer(d.id, k, true); } catch (er) { console.warn(er); } await BK.audio.pause(); }
      await BK.db.ecrire('tournages', t); msg(l.length + ' image(s) dans le moodboard'); rendre(); });
    $$('[data-medins]', z).forEach(b => b.onclick = async e => { e.stopPropagation(); const r = R.l.find(x => x.id === b.dataset.medins), m = morceauDe(r);
      if (!BK.drive.relie()) return msg('Relie d\'abord le Drive');
      const l = await BK.choisirDansMedias({ titre: 'Médias · ' + nomCourt(r), bouton: 'Ajouter au reel', type: 'tous', sujet: m ? m.id : '' }); if (!l || !l.length) return;
      msg('Étiquetage…'); const cles = [...(m ? [m.id] : []), ...(r.tournage ? ['t:' + r.tournage] : []), 'c:reel'];
      for (const x of l) { try { const d = await BK.img.depuisChoix(x, 'photovideo'); if (d.id) for (const k of cles) await BK.etiquettes.basculer(d.id, k, true); } catch (er) { console.warn(er); } await BK.audio.pause(); }
      R.tags = await BK.etiquettes.tous(); try { BK.dossiers.oublier && BK.dossiers.oublier(); R.fichiers = await BK.dossiers.tousFichiers(); } catch (er) {}
      msg(l.length + ' média(s) étiqueté(s) pour ce reel'); rendre(); });
  }

  // ---------- le lien avec la To-do list : ce qui est fait part dans le panier de la personne ----------
  // Chaque étape franchie devient une tâche déjà cochée, au nom de l'ordinateur (donc de la personne).
  async function noterDansTodo(r, avant, apres) {
    const qui = BK.reglage('nomPc', '').trim();
    const membres = (((await BK.db.liste('config')).find(c => c.id === 'membres') || {}).liste) || ['Yacine', 'Pierre', 'Baptiste'];
    const aLui = membres.find(m => m.toLowerCase() === qui.toLowerCase()) || '';
    const m = morceauDe(r), titre = r.titre || 'Reel';
    for (let i = 1; i < ETAPES.length; i++) {
      const e = ETAPES[i], id = 'reel-' + r.id + '-' + e.k, fait = i <= apres;
      const deja = (await BK.db.liste('taches')).find(t => t.id === id);
      if (fait && !deja) await BK.db.ecrire('taches', { id, texte: `${e.ic} ${e.nom} — ${titre}`, qui: aLui, morceau: m ? m.nom : '',
        fait: true, faitLe: new Date().toISOString(), faitPar: qui || 'ce PC', ordre: Date.now(), reel: r.id });
      else if (!fait && deja) await BK.db.supprimer('taches', id);
    }
    BK.tachesRecharger && BK.tachesRecharger();
    if (apres > avant && aLui) msg(ETAPES[apres].nom + ' · noté pour ' + aLui);
  }

  // ---------- créer ----------
  $('#suAjout').onclick = async () => {
    const titre = $('#suTitre').value.trim(), mid = $('#suMorceau').value;
    const m = R.morceaux.find(x => x.id === mid);
    if (!titre && !m) return msg('Donne un titre ou choisis un morceau');
    const r = await BK.db.ecrire('reels', { titre: titre || ('Reel ' + (m ? m.nom : '')), morceau: mid, statut: 'idee', notes: '' });
    R.neufs.add(r.id); R.l.push(r); $('#suTitre').value = ''; msg('Reel créé'); rendre();
  };
  $('#suTitre').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') $('#suAjout').click(); });
  $('#suMiette').onclick = async () => {
    const b = $('#suMiette'), avant = b.innerHTML; b.disabled = true; b.innerHTML = '<span class="spin"></span>Miette cherche…';
    try {
      await BK.discord.ronde(() => {}, true).catch(() => {});
      const l = await BK.discord.reelsTrouver(), n0 = BK.inv.normaliser; let n = 0;
      for (const x of l) {
        if (R.l.some(r => n0(r.titre || '') === n0(x.titre))) continue;
        const m = BK.inv.trouverMorceau(x.morceau || '', R.morceaux);
        const st = ETAPES.some(e => e.k === x.statut) ? x.statut : 'idee';
        R.l.push(await BK.db.ecrire('reels', { titre: String(x.titre).slice(0, 80), morceau: m ? m.id : '', statut: st, notes: x.idee || '', pourquoi: x.pourquoi || '', miette: true })); n++;
      }
      rendre(); msg(n ? `Miette a trouvé ${n} reel(s) : en vert, à valider` : 'Pas de nouveau reel trouvé sur Discord');
    } catch (e) { msg(e.message || 'Miette n\'a pas pu chercher'); }
    finally { b.disabled = false; b.innerHTML = avant; }
  };
  $('#suImport').onclick = async () => {
    let n = 0;
    for (const t of R.tournages) for (const p of (t.plans || [])) {
      const m = BK.inv.trouverMorceau(p.reel || '', R.morceaux); if (!m) continue;
      if (R.l.some(r => r.tournage === t.id && r.morceau === m.id)) continue;
      const ps = String(p.audio || '').replace(/\s*[:'’]\s*/g, ':').match(/(\d{1,2}):(\d{2})\s*[-–—à>]+\s*(\d{1,2}):(\d{2})/);
      R.l.push(await BK.db.ecrire('reels', { titre: (p.plans || p.action || 'Reel') + ' · ' + m.nom, morceau: m.id, tournage: t.id, statut: 'idee',
        passage: ps ? { debut: +ps[1] * 60 + +ps[2], fin: +ps[3] * 60 + +ps[4] } : null, notes: p.notes || '' }));
      n++;
    }
    msg(n ? n + ' reel(s) repris des tournages' : 'Rien de nouveau dans les fiches de tournage'); rendre();
  };
  $$('#suFiltre button').forEach(b => b.onclick = () => { R.filtre = b.dataset.f; BK.regler('suivi.filtre', R.filtre); rendre(); });
  (BK.surOuvrir = BK.surOuvrir || {}).suivi = charger;
  charger();
});
})();
