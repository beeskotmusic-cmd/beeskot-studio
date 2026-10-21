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
          <button class="btn sm" id="suImport" style="margin-left:auto" title="Crée une carte pour chaque reel des fiches de tournage">📋 Depuis les tournages</button>
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
          <span class="nt">Chaque carte relie le passage choisi dans <b>Reels Audio</b>, le jour de tournage (fiche <b>Tournages</b>) et les médias étiquetés dans <b>Médias</b>.<br><br>Clique une étape pour dire où vous en êtes.</span></div>
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
    return `<button class="su-aff${choisi ? ' on' : ''}" data-ouv="${r.id}" data-id="${r.id}"
        ${BK.img.bg(img)} data-mdimg="${(md.find(f => /^image\//.test(f.mimeType || '')) || {}).id || ''}"
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
      <span class="su-aff-outils"><span class="su-aff-o" data-affiche="${r.id}" title="Changer l'image">🖼</span>${r.affiche ? `<span class="su-aff-o" data-imgx="${r.id}" title="Revenir à l'image automatique (moodboard)">↺</span>` : ''}</span>
      ${r.sortie ? `<span class="su-aff-date sortie" title="Sortie prévue">🚀 ${esc(date(r.sortie))}</span>` : t && t.date ? `<span class="su-aff-date" title="Tournage">${esc(date(t.date))}</span>` : ''}
    </button>`;
  }

  // ---------- le panneau qui s'ouvre en dessous : exactement la même ligne qu'avant ----------
  function carte(r) {
    const m = morceauDe(r), t = tournageDe(r), a = audioDe(r), md = mediasDe(r);
    const vid = md.filter(f => /^video\//.test(f.mimeType || '')).length, ph = md.length - vid;
    const i = ETAPES.findIndex(e => e.k === (r.statut || 'idee'));
    const tenues = t && t.tenues ? Object.entries(t.tenues).filter(([, v]) => v && String(v).trim()).map(([k, v]) => k + ' : ' + v) : [];
    const pas = r.passage || (a && a.duree ? { debut: a.debut || 0, fin: (a.debut || 0) + a.duree } : null);
    return `<div class="su-c ouverte" data-id="${r.id}">
      <div class="su-tete">
        <input class="fld su-nom" data-nom="${r.id}" value="${esc(nomCourt(r))}" title="Le nom sur le poster" placeholder="ex. Reel 1">
        <button class="su-titre" data-ouv="${r.id}">${r.titre && r.titre !== nomCourt(r) ? `<span class="nt su-long">${esc(r.titre)}</span>` : ''}${m ? `<span class="su-m">${esc(m.nom)}</span>` : ''}</button>
        <select class="fld su-type" data-type="${r.id}" title="C'est quoi ?">${TYPES_R.map(x => `<option${(r.type || 'Reel') === x ? ' selected' : ''}>${x}</option>`).join('')}</select>
        ${pas ? `<span class="su-lect"><button class="btn xs" data-play="${r.id}" title="Écouter le passage">▶</button><span class="mono">${t2(pas.debut)} → ${t2(pas.fin)}</span></span>` : '<span class="nt su-lect">passage à choisir</span>'}
        <div class="su-etapes">${ETAPES.map((e, k) => `<button class="su-e${k <= i ? ' ok' : ''}${k === i ? ' on' : ''}" data-st="${r.id}|${e.k}" title="${e.nom}">${e.ic}</button>`).join('')}</div>
        <button class="btn xs" data-ouv="${r.id}" title="Replier">▾ Fermer</button>
        <button class="btn xs" data-sx="${r.id}" title="Retirer">✕</button></div>
      <div class="su-l">
        <div class="su-b${a ? ' fait' : ''}"><span class="eng">🎵 Audio</span>
          ${a ? `<b>${esc(a.nom)}</b><span class="nt">${t2(a.debut || 0)} → ${t2((a.debut || 0) + (a.duree || 0))} · ${date(a.t)}</span>`
              : r.passage ? `<b>${t2(r.passage.debut)} → ${t2(r.passage.fin)}</b><span class="nt">passage choisi, export à faire</span>`
              : '<span class="nt">Pas encore d\'export</span>'}
          <button class="btn xs" data-au="${r.id}">${a ? 'Refaire' : 'Choisir le passage'}</button></div>
        <div class="su-b${md.length ? ' fait' : ''}"><span class="eng">🎥 Médias</span>
          <b>${vid} vidéo(s) · ${ph} photo(s)</b><span class="nt">étiquetés pour ce reel</span>
          <button class="btn xs" data-me="${r.id}">Ouvrir Médias</button></div>
        <div class="su-b${t && (t.moodboard || []).length ? ' fait' : ''}"><span class="eng">🖼 Moodboard</span>
          <b>${t ? (t.moodboard || []).length : 0} image(s)</b>
          ${tenues.length ? `<span class="nt">👕 ${esc(tenues.join(' · ')).slice(0, 70)}</span>` : '<span class="nt">tenues : rien de noté</span>'}
          <button class="btn xs" data-to="${r.id}">Voir</button></div>
        <div class="su-b${t ? ' fait' : ''}"><span class="eng">🎬 Tournage</span>
          ${t ? `<b>${esc(t.titre || 'Tournage')}</b><span class="nt">${[date(t.date), t.heure, t.lieu].filter(Boolean).map(esc).join(' · ') || 'date à fixer'}</span>`
              : '<span class="nt">Pas de fiche de tournage</span>'}
          <button class="btn xs" data-to="${r.id}">${t ? 'Ouvrir' : 'Créer la fiche'}</button></div>
      </div>
      <div class="su-sortie"><span class="eng">🚀 Sortie prévue</span>
        <input class="fld" type="date" data-sortie="${r.id}" value="${esc(r.sortie || '')}">
        <span class="nt">${r.sortie ? (r.evenement ? '✓ dans le Calendrier' : 'pas encore dans le Calendrier') : 'choisis une date : elle ira dans le Calendrier'}</span>
        ${r.sortie ? `<button class="btn xs" data-sortiex="${r.id}" title="Enlever la date">✕</button>` : ''}</div>

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
    brancher();
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

  function brancher() {
    const z = $('#suListe');
    $$('[data-ouv]', z).forEach(b => b.onclick = () => { R.ouvert = R.ouvert === b.dataset.ouv ? null : b.dataset.ouv; BK.regler('suivi.ouvert', R.ouvert || ''); rendre();
      if (R.ouvert) setTimeout(() => { const c = $('.su-c', z); c && c.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 60); });
    $$('[data-play]', z).forEach(b => b.onclick = e => { e.stopPropagation(); jouerPassage(R.l.find(x => x.id === b.dataset.play)); });
    // la vignette : une image des médias du reel si la fiche du morceau n'en a pas
    (async () => { for (const b of $$('.su-aff[data-mdimg]', z)) { if (b.style.backgroundImage || b.dataset.img || b.classList.contains('img-charge') || !b.dataset.mdimg) continue;
      const f = R.fichiers.find(x => x.id === b.dataset.mdimg); if (!f) continue;
      try { const u = await BK.drive.vignette(f); if (u) { b.style.backgroundImage = `url(${u})`; const v = b.querySelector('.su-aff-vide'); v && v.remove(); } } catch (e) {} } })();
    $$('[data-st]', z).forEach(b => b.onclick = async () => { const [id, k] = b.dataset.st.split('|'); const r = R.l.find(x => x.id === id);
      const avant = ETAPES.findIndex(e => e.k === (r.statut || 'idee'));
      r.statut = r.statut === k ? (ETAPES[Math.max(0, ETAPES.findIndex(e => e.k === k) - 1)] || {}).k || 'idee' : k;
      await BK.db.ecrire('reels', r);
      await noterDansTodo(r, avant, ETAPES.findIndex(e => e.k === r.statut));
      msg(ETAPES.find(e => e.k === r.statut).nom); rendre(); });
    // la date de sortie : dans la fiche, et un rendez-vous « Publication » dans le Calendrier (créé ou déplacé)
    const sortie = async (r, d) => {
      r.sortie = d || '';
      if (d) { const m = morceauDe(r);
        const ev = { id: r.evenement || undefined, type: 'promo', titre: 'Sortie du reel : ' + (r.titre || 'Reel'), morceau: m ? m.nom : '', date: d, heure: '', lieu: '', reel: r.id };
        const e = await BK.db.ecrire('evenements', ev); r.evenement = e.id; }
      else if (r.evenement) { try { await BK.db.supprimer('evenements', r.evenement); } catch (e) {} delete r.evenement; }
      await BK.db.ecrire('reels', r); BK.agendaRecharger && BK.agendaRecharger();
      msg(d ? 'Sortie le ' + date(d) + ' · dans le Calendrier ✓' : 'Date de sortie enlevée'); rendre();
    };
    $$('[data-sortie]', z).forEach(i => { i.addEventListener('keydown', e => e.stopPropagation()); i.onchange = () => sortie(R.l.find(x => x.id === i.dataset.sortie), i.value); });
    $$('[data-sortiex]', z).forEach(b => b.onclick = () => sortie(R.l.find(x => x.id === b.dataset.sortiex), ''));
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
      const l = await BK.choisirDansMedias({ titre: 'Image du poster · ' + (r.nom || r.titre || 'Reel'), bouton: 'Choisir cette image', type: 'image', sujet: m ? m.id : '' });
      if (!l || !l[0]) return;
      msg('Image du poster…');
      try { fin((await BK.img.depuisChoix(l[0], 'photovideo')).ref); } catch (e) { msg('Image illisible'); }
    });
    $$('[data-sx]', z).forEach(b => b.onclick = async () => { const r = R.l.find(x => x.id === b.dataset.sx);
      if (!confirm(`Retirer « ${r.titre || 'ce reel'} » du suivi ?`)) return;
      R.l = R.l.filter(x => x !== r); await BK.db.supprimer('reels', r.id); msg('Retiré'); rendre(); });
    $$('[data-au]', z).forEach(b => b.onclick = async () => { const r = R.l.find(x => x.id === b.dataset.au), m = morceauDe(r);
      if (!m) return msg('Choisis d\'abord le morceau');
      BK.suiviEnCours = r.id;
      if (r.passage) BK.reelsPasser({ morceau: m, debut: r.passage.debut, fin: r.passage.fin });
      else { BK.ouvrir('reels'); BK.reelsPasser({ morceau: m }); } });
    $$('[data-to]', z).forEach(b => b.onclick = async () => { const r = R.l.find(x => x.id === b.dataset.to); let t = tournageDe(r);
      if (!t) { const m = morceauDe(r);
        t = await BK.db.ecrire('tournages', { titre: r.titre || 'Tournage', type: 'Reel', morceau: m ? m.nom : '', date: '', heure: '', lieu: '', idee: '', moodboard: [], plans: [], tenues: {}, materiel: '', notes: '' });
        r.tournage = t.id; await BK.db.ecrire('reels', r); R.tournages.push(t); msg('Fiche de tournage créée'); }
      BK.tournageOuvrir ? BK.tournageOuvrir(t.id) : BK.ouvrir('tournage'); });
    $$('[data-me]', z).forEach(b => b.onclick = () => { const r = R.l.find(x => x.id === b.dataset.me), m = morceauDe(r);
      BK.ouvrirMedias && BK.ouvrirMedias(); if (m) setTimeout(() => { const s = document.getElementById('mdFiltre'); if (s) { s.value = m.id; s.onchange({ target: s }); } }, 400); });
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
    R.l.push(r); $('#suTitre').value = ''; msg('Reel créé'); rendre();
  };
  $('#suTitre').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') $('#suAjout').click(); });
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
