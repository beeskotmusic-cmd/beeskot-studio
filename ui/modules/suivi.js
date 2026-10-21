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
const R = { l: [], morceaux: [], tournages: [], exports: [], tags: {}, fichiers: [], filtre: BK.reglage('suivi.filtre', 'encours') };
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
    R.exports = BK.reglage('reels.exports', []);
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

  function carte(r) {
    const m = morceauDe(r), t = tournageDe(r), a = audioDe(r), md = mediasDe(r);
    const vid = md.filter(f => /^video\//.test(f.mimeType || '')).length, ph = md.length - vid;
    const i = ETAPES.findIndex(e => e.k === (r.statut || 'idee'));
    const tenues = t && t.tenues ? Object.entries(t.tenues).filter(([, v]) => v && String(v).trim()).map(([k, v]) => k + ' : ' + v) : [];
    const ouvert = (BK.reglage('suivi.ouverts', {}))[r.id] ?? false;
    const pas = r.passage || (a && a.duree ? { debut: a.debut || 0, fin: (a.debut || 0) + a.duree } : null);
    const vign = (m && m.photo) || '';
    return `<div class="su-c${ouvert ? ' ouverte' : ''}" data-id="${r.id}">
      <div class="su-tete">
        <button class="su-vign" data-ouv="${r.id}" title="${ouvert ? 'Replier' : 'Tout voir'}"${vign ? ` style="background-image:url(${vign})"` : ''} data-img="${(md.find(f => /^image\//.test(f.mimeType || '')) || {}).id || ''}">${vign ? '' : '🎬'}</button>
        <button class="su-titre" data-ouv="${r.id}"><b>${esc(r.titre || 'Reel')}</b>${m ? `<span class="su-m">${esc(m.nom)}</span>` : ''}</button>
        ${pas ? `<span class="su-lect"><button class="btn xs" data-play="${r.id}" title="Écouter le passage">▶</button><span class="mono">${t2(pas.debut)} → ${t2(pas.fin)}</span></span>` : '<span class="nt su-lect">passage à choisir</span>'}
        <div class="su-etapes">${ETAPES.map((e, k) => `<button class="su-e${k <= i ? ' ok' : ''}${k === i ? ' on' : ''}" data-st="${r.id}|${e.k}" title="${e.nom}">${e.ic}</button>`).join('')}</div>
        <button class="btn xs" data-ouv="${r.id}" title="${ouvert ? 'Replier' : 'Tout voir'}">${ouvert ? '▾' : '▸'}</button>
        <button class="btn xs" data-sx="${r.id}" title="Retirer">✕</button></div>
      <div class="su-l">
        <div class="su-b${a ? ' fait' : ''}"><span class="eng">🎵 Audio</span>
          ${a ? `<b>${esc(a.nom)}</b><span class="nt">${t2(a.debut || 0)} → ${t2((a.debut || 0) + (a.duree || 0))} · ${date(a.t)}</span>`
              : r.passage ? `<b>${t2(r.passage.debut)} → ${t2(r.passage.fin)}</b><span class="nt">passage choisi, export à faire</span>`
              : '<span class="nt">Pas encore d\'export</span>'}
          <button class="btn xs" data-au="${r.id}">${a ? 'Refaire' : 'Choisir le passage'}</button></div>
        <div class="su-b${t ? ' fait' : ''}"><span class="eng">🎬 Tournage</span>
          ${t ? `<b>${esc(t.titre || 'Tournage')}</b><span class="nt">${[date(t.date), t.heure, t.lieu].filter(Boolean).map(esc).join(' · ') || 'date à fixer'}</span>`
              : '<span class="nt">Pas de fiche de tournage</span>'}
          <button class="btn xs" data-to="${r.id}">${t ? 'Ouvrir' : 'Créer la fiche'}</button></div>
        <div class="su-b${t && (t.moodboard || []).length ? ' fait' : ''}"><span class="eng">🖼 Moodboard</span>
          <b>${t ? (t.moodboard || []).length : 0} image(s)</b>
          ${tenues.length ? `<span class="nt">👕 ${esc(tenues.join(' · ')).slice(0, 70)}</span>` : '<span class="nt">tenues : rien de noté</span>'}
          <button class="btn xs" data-to="${r.id}">Voir</button></div>
        <div class="su-b${md.length ? ' fait' : ''}"><span class="eng">🎥 Médias</span>
          <b>${vid} vidéo(s) · ${ph} photo(s)</b><span class="nt">étiquetés pour ce reel</span>
          <button class="btn xs" data-me="${r.id}">Ouvrir Médias</button></div>
      </div>
      ${r.notes ? `<span class="nt su-n">${esc(r.notes)}</span>` : ''}
    </div>`;
  }

  function rendre() {
    $$('#suFiltre button').forEach(b => b.classList.toggle('on', b.dataset.f === R.filtre));
    const l = R.l.filter(r => R.filtre === 'tout' || (R.filtre === 'publie' ? r.statut === 'publie' : r.statut !== 'publie'))
      .sort((a, b) => (b.maj || '').localeCompare(a.maj || ''));
    $('#suNb').textContent = String(R.l.filter(r => r.statut !== 'publie').length).padStart(2, '0');
    $('#suPub').textContent = String(R.l.filter(r => r.statut === 'publie').length).padStart(2, '0');
    $('#suListe').innerHTML = l.length ? l.map(carte).join('')
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
        else if (a && a.chemin && BK.estExe) url = URL.createObjectURL(new Blob([await BK.fichier.lireOctets(a.chemin)], { type: 'audio/wav' }));
        else if (m && BK.drive.relie()) {
          await BK.dossiers.assurer();
          const l = BK.trierStems(await BK.dossiers.duMorceau(m, R.morceaux)).filter(f => !f.groupe && /\.(wav|mp3|aiff?|flac)$/i.test(f.name) && !/tournage/i.test(f.name));
          const rang = f => ({ cl: 0, recording: 1, ableton: 2 }[f.role] ?? 3);
          const f = l.sort((x, y) => rang(x) - rang(y) || (y.modifiedTime || '').localeCompare(x.modifiedTime || ''))[0];
          if (!f) return msg('Aucun export à écouter pour ' + (m ? m.nom : 'ce reel'));
          msg('Téléchargement de ' + f.name + '…');
          url = URL.createObjectURL(new Blob([await BK.drive.telecharger(f.id)], { type: 'audio/wav' }));
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
    $$('[data-ouv]', z).forEach(b => b.onclick = () => { const o = BK.reglage('suivi.ouverts', {}); o[b.dataset.ouv] = !(o[b.dataset.ouv] ?? false); BK.regler('suivi.ouverts', o); rendre(); });
    $$('[data-play]', z).forEach(b => b.onclick = e => { e.stopPropagation(); jouerPassage(R.l.find(x => x.id === b.dataset.play)); });
    // la vignette : une image des médias du reel si la fiche du morceau n'en a pas
    (async () => { for (const b of $$('.su-vign[data-img]', z)) { if (b.style.backgroundImage || !b.dataset.img) continue;
      const f = R.fichiers.find(x => x.id === b.dataset.img); if (!f) continue;
      try { const u = await BK.drive.vignette(f); if (u) { b.style.backgroundImage = `url(${u})`; b.textContent = ''; } } catch (e) {} } })();
    $$('[data-st]', z).forEach(b => b.onclick = async () => { const [id, k] = b.dataset.st.split('|'); const r = R.l.find(x => x.id === id);
      const avant = ETAPES.findIndex(e => e.k === (r.statut || 'idee'));
      r.statut = r.statut === k ? (ETAPES[Math.max(0, ETAPES.findIndex(e => e.k === k) - 1)] || {}).k || 'idee' : k;
      await BK.db.ecrire('reels', r);
      await noterDansTodo(r, avant, ETAPES.findIndex(e => e.k === r.statut));
      msg(ETAPES.find(e => e.k === r.statut).nom); rendre(); });
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
