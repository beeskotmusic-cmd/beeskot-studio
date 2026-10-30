// =====================================================================
// TOURNAGES — une fiche par tournage : infos, moodboard, découpage,
// tenues, matériel. Une fiche = un petit fichier dans le Drive (partagé).
// « Imprimer / PDF » sort une feuille propre à donner à l'équipe.
// =====================================================================
(() => {
const T = { vue: 'jours', jours: [], liste: [], courant: null, membres: ['Yacine', 'Pierre', 'Baptiste'], morceaux: [] };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TYPES = ['Clip', 'Reel', 'Shooting photo', 'Live', 'Autre'];
const JOURNEES = ['Tournage', 'Photoshoot', 'Live', 'Répétition', 'Autre'];
const nomJ = tr => (tr && tr.journee) || 'Tournage';
// ---------- qui a ajouté quoi : une pastille à la couleur de la personne (photos, plans) ----------
// Enregistré tout seul au moment d'écrire la fiche : ce qui n'était pas dans la dernière copie connue = ajouté par ce PC.
const moiNom = () => BK.reglage('nomPc', '') || '';
BK.db.signer = BK.db.signer || {};
BK.db.signer.tournages = (f, avant) => {
  const moi = moiNom(); if (!moi) return; let a = {}; try { a = avant ? JSON.parse(avant) : {}; } catch (e) {}
  const refs = x => new Set([...(x.moodboard || []), ...Object.values(x.tenuesPhotos || {}).flat(), ...(x.plans || []).flatMap(p => p.imgs || [])].filter(Boolean));
  const vieux = refs(a), neufs = refs(f); f.qui = f.qui || {};
  for (const r of neufs) if (!vieux.has(r) && !f.qui[r]) f.qui[r] = moi;
  for (const r of Object.keys(f.qui)) if (!neufs.has(r)) delete f.qui[r];
  const sans = p => JSON.stringify({ ...p, imgs: 0, par: 0 });
  (f.plans || []).forEach((p, i) => { const o = (a.plans || [])[i]; if (!p.par && (!o || sans(o) !== sans(p)) && (p.action || p.cadrage || p.notes || p.duree)) p.par = moi; });
};
const pastille = q => q ? `<i class="qui-pt" style="--pc:${BK.externe.couleurDe(q)}" title="Ajouté par ${String(q).replace(/"/g, '')}"></i>` : '';
const CADRAGES = ['Plan large', 'Plan moyen', 'Plan américain', 'Gros plan', 'Très gros plan', 'Plan d\'ensemble', 'Insert', 'Plongée', 'Contre-plongée', 'Travelling'];
const dateFr = d => d ? new Date(d + 'T12:00').toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';

const iconeLien = u => /instagram\./i.test(u) ? '📸' : /tiktok\./i.test(u) ? '🎵' : /youtu\.?be/i.test(u) ? '▶' : /pinterest\./i.test(u) ? '📌' : '🔗';
const nomLien = u => { try { const x = new URL(u); return x.hostname.replace(/^www\./, '') + (x.pathname.length > 1 ? x.pathname.slice(0, 28) : ''); } catch (e) { return u.slice(0, 40); } };

BK.module('tournage', function (page) {
  $('.sub', page).textContent = 'Moodboard, découpage, tenues : une fiche à imprimer pour chaque tournage';
  $('.hdr .right', page).innerHTML = `<div><span class="eng" style="font-size:9px">Prochain</span><span class="vfd" id="toProchain" style="width:220px">—</span></div>`;
  $('.grid', page).innerHTML = `
    <div class="seg ec-vues" id="toVues"><button data-v="tournages">Tournages</button><button data-v="storyline" title="Un grand board libre par chanson : médias, liens, textes, formes">Storyline - Mood</button></div>
    <div class="cols hidden" id="toVueS"><section class="pane vit sb-pane" id="toStory"></section></div>
    <div class="cols" id="toVueT">
      <section class="pane vit to-vit"><div class="to-fiche" id="toFiche"></div></section>
      <section class="pane reg" style="width:270px"><span class="ptitle">② Tournages</span>
        <button class="btn pri" id="toNouveau" style="width:100%;justify-content:center">+ Nouveau tournage</button>
        <button class="btn" id="toPlanXl" style="width:100%;justify-content:center;margin-top:8px">📋 PLAN.xlsx du Drive</button>
        <button class="btn" id="toMedia" style="width:100%;justify-content:center;margin-top:8px" title="Des images (moodboard, tenues, repérages…) à glisser ensuite sur un tournage ou une journée">＋ Ajouter un média</button>
        <div id="toMiette"></div>
        <div class="box grow" style="margin-top:10px"><div class="to-liste" id="toListe"></div></div>
      </section>
    </div>
    <div class="pane abar" id="toAbar"><span class="vfd" id="toMsg">PRÊT</span>
      <div class="right"><button class="btn" id="toCal" disabled>📅 Mettre au Calendrier</button><button class="btn" id="toVeo" disabled title="Un prompt Veo 3 par plan, pour tester le reel en IA avant de tourner">🎬 Prompts Veo 3</button><button class="btn pri" id="toPdf" disabled title="Le PDF de la fiche : aperçu, couleur ou noir et blanc, enregistrer, imprimer">📄 PDF / Imprimer</button></div></div>`;
  const msg = t => $('#toMsg').textContent = String(t).toUpperCase();
  // ---------- les deux sous-onglets : Tournages (les fiches) et Storyline - Mood (le grand board, js : modules/storyline.js) ----------
  function vueTo(v) { BK.regler('tournage.vue', v); $$('#toVues button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
    $('#toVueT').classList.toggle('hidden', v !== 'tournages'); $('#toAbar').classList.toggle('hidden', v !== 'tournages'); $('#toVueS').classList.toggle('hidden', v !== 'storyline');
    if (v === 'storyline') BK.storyline.dessiner($('#toStory')); }
  $$('#toVues button').forEach(b => b.onclick = () => vueTo(b.dataset.v));
  setTimeout(() => vueTo(BK.reglage('tournage.vue', 'tournages')), 0);

  window.addEventListener('bk:annule', () => charger());   // après « ↶ Annuler » : on relit
  async function charger() {
    T.liste = (await BK.db.liste('tournages')).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    if (await migrer().catch(e => (console.warn('migration tournages', e), false))) T.liste = await BK.db.liste('tournages');
    T.reels = await BK.db.liste('reels').catch(() => []);
    T.exports = await BK.exportsAudio.tous().catch(() => []);
    // les étiquettes et fichiers de Médias (pour proposer en vert) : relus au plus toutes les 2 minutes, sans bloquer l'affichage
    if (BK.drive.relie() && (!T.fichiersT || Date.now() - T.fichiersT > 120e3)) { T.fichiersT = Date.now();
      BK.etiquettes.tous().then(async tg => { T.tags = tg; T.fichiers = await BK.dossiers.tousFichiers(); rendreFiche(); }).catch(() => { T.fichiersT = 0; }); }
    const cfg = (await BK.db.liste('config')).find(c => c.id === 'membres'); if (cfg && cfg.liste && cfg.liste.length) T.membres = cfg.liste.map(m => m === 'Dari' ? 'Yacine' : m);
    T.fiches = (await BK.db.liste('morceaux')).sort((a, b) => a.nom.localeCompare(b.nom));
    T.morceaux = T.fiches.map(m => m.nom);
    if (T.courant) T.courant = T.liste.find(x => x.id === T.courant.id) || null;
    if (T.tour) T.tour = T.liste.find(x => x.id === T.tour.id) || null;
    rendreListe(); rendreFiche(); proposes();
  }
  BK.tournagesRecharger = charger;
  BK.tournageOuvrir = async id => { BK.ouvrir('tournage'); await charger(); const t = T.liste.find(x => x.id === id); if (t) { T.courant = t; T.vue = 'fiche'; rendreListe(); rendreFiche(); } };
  // 🍞 les tournages dont on parle sur Discord (le bouton jaune) : un clic crée la fiche déjà remplie
  async function proposes() {
    const l = (await BK.db.liste('propositions')).filter(p => p.type === 'tournage' && p.statut === 'attente'), z = $('#toMiette');
    z.innerHTML = l.length ? `<div class="box" style="margin-top:10px"><span class="lb"><img class="mi-ic" src="look/patch-miette.png" alt=""> Miette propose : à valider</span>${l.map(p => `<div class="ta-prop" style="margin-top:6px"><div class="carte-c"><span class="carte-t">${esc(p.titre)}</span>
        <span class="carte-m">${esc([p.morceau, p.date, p.lieu].filter(Boolean).join(' · '))}${p.pourquoi ? ' — « ' + esc(p.pourquoi) + ' »' : ''}</span></div>
        <button class="mi-val" data-tok="${p.id}" title="C'est bon : créer la fiche">✓</button><button class="btn xs" data-tnon="${p.id}">✕</button></div>`).join('')}</div>` : '';
    $$('[data-tok]', z).forEach(b => b.onclick = async () => { const p = l.find(x => x.id === b.dataset.tok);
      const t = await BK.db.ecrire('tournages', { niveau: 'reel', parent: '', titre: p.titre, type: p.type === 'tournage' ? (p.typeT || 'Clip') : 'Clip', morceau: T.morceaux.includes(p.morceau) ? p.morceau : '', date: p.date || '', heure: p.heure || '', lieu: p.lieu || '',
        idee: p.idee || '', moodboard: [], plans: [], tenues: {}, materiel: p.materiel || '', notes: [p.tenues && 'Tenues : ' + p.tenues, p.pourquoi && 'Discord : « ' + p.pourquoi + ' »'].filter(Boolean).join('\n'), discord: p.source || '' });
      p.statut = 'ok'; await BK.db.ecrire('propositions', p); msg('Reel créé : glisse-le sur un tournage'); await charger();
      if (BK.drive.relie()) { msg('Miette cherche le moodboard dans le Drive…'); try { await BK.miette.moodboards(); } catch (e) {} await charger(); msg('Fiche prête'); } });
    $$('[data-tnon]', z).forEach(b => b.onclick = async () => { const p = l.find(x => x.id === b.dataset.tnon); p.statut = 'non'; await BK.db.ecrire('propositions', p); proposes(); });
  }

  function rendreListe() {
    const auj = new Date().toISOString().slice(0, 10), proch = T.liste.filter(x => estTour(x) && (x.date || '') >= auj).sort((a, b) => a.date.localeCompare(b.date))[0];
    $('#toProchain').textContent = proch ? `${new Date(proch.date + 'T12:00').toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' }).toUpperCase()} · ${(proch.titre || '').toUpperCase()}` : '—';
    const trs = tournagesL(), seuls = T.liste.filter(x => !estTour(x) && !x.parent);
    $('#toListe').innerHTML = (trs.length ? trs.map(x => `<button class="to-item${T.tour && T.tour.id === x.id ? ' on' : ''}${(x.date || '9') < auj ? ' passe' : ''}" data-tour="${x.id}">
        <b>${esc(x.titre || 'Tournage')}</b><span class="nt">${esc(nomJ(x))} · ${esc(jourFr(x.date))}${reelsDe(x).length ? ' · ' + reelsDe(x).length + ' reel(s)' : ''}</span></button>`).join('') : '<span class="nt">Aucun tournage. Clique sur « + Nouveau tournage ».</span>')
      + (seuls.length ? `<span class="eng" style="font-size:9px;margin:8px 0 2px">Reels sans tournage</span>` + seuls.map(x => `<button class="to-item${T.courant && T.courant.id === x.id ? ' on' : ''}" data-id="${x.id}"><b>${esc(x.titre || 'Sans titre')}</b><span class="nt">${esc(x.morceau || '—')}</span></button>`).join('') : '');
    $$('.to-item[data-tour]').forEach(b => b.onclick = () => ouvrirTour(b.dataset.tour));
    $$('.to-item[data-id]').forEach(b => b.onclick = () => { T.courant = T.liste.find(x => x.id === b.dataset.id); T.vue = 'fiche'; rendreListe(); rendreFiche(); });
  }

  // ---------- la fiche ----------
  // largeurs des colonnes du découpage : celles que Dari a réglées sur ce PC, sinon des valeurs de départ
  const COLS0 = { cadrage: 150, duree: 70, notes: 300, imgs: 150 };
  const largeurCol = k => (BK.reglage('tournage.cols', {}) || {})[k] || COLS0[k];
  function rendreFiche() {
    const t = T.courant, z = $('#toFiche');
    $('#toPdf').disabled = $('#toVeo').disabled = !t || T.vue !== 'fiche'; $('#toCal').disabled = T.vue !== 'tournage';
    if (T.vue === 'tournage') return rendreTournages();                 // un tournage se déplie DANS la liste
    if (T.vue !== 'fiche' || !t) { T.vue = 'jours'; return rendreTournages(); }
    z.innerHTML = corpsFiche(t, false);
    $('#toRetour').onclick = () => { T.vue = 'jours'; rendreFiche(); };
    const vr = $('#toVersReels'); if (vr) vr.onclick = async () => { await versReels(t); rendreFiche(); };
    const vo = $('#toVoirReel'); if (vo) vo.onclick = () => { const r = T.reels.find(x => x.tournage === t.id); BK.suiviOuvrir ? BK.suiviOuvrir(r.id) : BK.ouvrir('suivi'); };
    $('#toFini').onclick = () => finir(t);
    const ouvert = (BK.reglage('tournage.ouvert', {}))[t.id] ?? true;
    $('#toAffiche').onclick = () => { const o = BK.reglage('tournage.ouvert', {}); o[t.id] = !ouvert; BK.regler('tournage.ouvert', o); rendreFiche(); };
    brancher(t); glisser(z); modeLecture(z, t);
  }
  // la fiche d'un reel : seule (affiche + barre), ou dépliée dans son tournage (inline : juste le contenu)
  function corpsFiche(t, inline) {
    t.plans = t.plans || []; t.tenues = t.tenues || {}; t.moodboard = t.moodboard || [];
    // ---------- l'affiche du projet : l'image du morceau, le titre, la date ----------
    const m = (T.fiches || []).find(x => x.nom === t.morceau);
    const img = t.couverture || '';
    const ouvert = (BK.reglage('tournage.ouvert', {}))[t.id] ?? true;
    const quand = t.date ? new Date(t.date + 'T12:00').toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' }) : 'date à fixer';
    return (inline ? '' : `
      <div class="to-fiche-barre"><button class="btn sm" id="toRetour">← Tous les tournages</button>
        <button class="btn sm to-fini${t.fini ? ' on' : ''}" id="toFini" style="margin-left:auto">${t.fini ? '✓ Tourné' : 'Tournage fini'}</button>
        ${(T.reels || []).some(r => r.tournage === t.id) ? `<button class="btn sm" id="toVoirReel">Voir le reel · ${esc(etapeReel(t))}</button>` : '<button class="btn sm" id="toVersReels" title="Crée une carte dans l\'onglet Reels avec les infos de ce tournage">→ Envoyer dans les Reels</button>'}</div>
      <button class="to-affiche${img ? '' : ' sans'}${ouvert ? ' ouverte' : ''}" id="toAffiche"${BK.img.bg(img)}>
        <span class="to-af-voile"></span>
        <span class="to-af-txt">
          <span class="eng">${esc(t.type || 'Tournage')}${t.morceau ? ' · projet ' + esc(t.morceau) : ''}</span>
          <b class="dymo">${esc(t.titre || 'Sans titre')}</b>
          <span class="nt">${esc(quand)}${t.heure ? ' · ' + esc(t.heure) : ''}${t.lieu ? ' · ' + esc(t.lieu) : ''}</span>
          <span class="nt to-af-chiffres">🖼 ${(t.moodboard || []).length} · 🎬 ${(t.plans || []).length} plan(s)${Object.values(t.tenues || {}).filter(Boolean).length ? ' · 👕 tenues notées' : ''}</span>
        </span>
        <span class="to-af-pli">${ouvert ? '▾ Replier' : '▸ Tout voir'}</span></button>`) + `
      <div class="to-corps${ouvert || inline ? '' : ' replie'}" id="toCorps">
      <div class="box"><span class="lb">Infos</span>
        <div class="to-infos">
          <label class="large"><span class="eng">Titre</span><input class="fld" data-c="titre" value="${esc(t.titre)}" placeholder="ex. Clip Mother – scène du salon"></label>
          <label><span class="eng">Type</span><select class="fld" data-c="type">${TYPES.map(x => `<option${t.type === x ? ' selected' : ''}>${x}</option>`).join('')}</select></label>
          <label><span class="eng">Morceau</span><select class="fld" data-c="morceau"><option value="">—</option>${T.morceaux.map(m => `<option${t.morceau === m ? ' selected' : ''}>${esc(m)}</option>`).join('')}</select></label>
          ${inline ? '' : `<label class="large"><span class="eng">Lieu</span><input class="fld" data-c="lieu" value="${esc(t.lieu)}" placeholder="ex. Studio BEESKOT"></label>`}
          <label class="large"><span class="eng">L'idée en une phrase</span><input class="fld" data-c="idee" value="${esc(t.idee)}" placeholder="ex. ambiance VHS, lumière rouge, plans serrés sur les mains"></label>
        </div></div>
      <div class="box"><div class="ligne-titre"><span class="lb">Moodboard</span><button class="btn xs miette-aide" id="toMoodMiette" style="margin-left:auto" title="Miette cherche les images de moodboard de ce tournage dans le Drive et sur Discord">Trouver</button></div>
        <div class="to-mood" id="toMood">${t.moodboard.map((u, i) => `<div class="to-img" draggable="true" data-mi="${i}" title="Glisse cette image sur un plan du découpage"${BK.img.bg(u)}><b class="to-n">${i + 1}</b>${pastille((t.qui || {})[u])}<button class="md-x" data-mx="${i}">✕</button></div>`).join('')}
          <button class="to-img to-plus to-plus-tag" id="toMoodTag" title="Depuis Médias (dossiers, Discord, étiquettes)">＋<small>Ajouter des images</small></button><button class="to-img to-plus" id="toMoodPlus" title="Images de ce PC">💻<small>Ce PC</small></button></div>
        ${(t.moodboardDocs || []).length ? `<div class="to-docs">${t.moodboardDocs.map((d, i) => `<span class="to-doc"${d.id ? ` data-drive="${esc(d.id)}"` : ''}><a href="#" data-url="${esc(d.url)}">📄 ${esc(d.nom)}</a><button class="md-x" data-dx="${i}">✕</button></span>`).join('')}</div>` : ''}
        ${t.moodboardAuto ? '<span class="nt">🍞 Rempli par Miette depuis le dossier moodboard du Drive.</span>' : ''}
        <input type="file" id="toMoodIn" accept="image/*,application/pdf,.pdf" multiple hidden>
        <div class="to-refs"><div class="ligne-titre"><span class="lb">Références</span><span class="nt" style="margin:0 0 0 auto">Des liens : Instagram, TikTok, YouTube, Pinterest…</span><button class="btn xs miette-aide" id="toRefMiette" title="Miette cherche les liens donnés sur Discord pour ce tournage">Trouver</button></div>
          <div class="to-refs-l">${(t.references || []).map((r, i) => `<span class="to-ref${r.miette ? ' mi-prop' : ''}"${r.miette ? ' title="Trouvée par Miette sur Discord : ✓ pour valider"' : ''}><a href="#" data-url="${esc(r.url)}" title="${esc(r.url)}">${esc(iconeLien(r.url))} ${esc(r.note || nomLien(r.url))}</a>${r.miette ? `<button class="mi-val" data-rval="${i}" title="C'est bon">✓</button>` : ''}<button class="md-x" data-rx="${i}">✕</button></span>`).join('')}</div>
          <div class="to-refs-add"><input class="fld" id="toRefUrl" placeholder="Colle un lien (https://…)"><input class="fld" id="toRefNote" placeholder="En un mot : pourquoi (facultatif)"><button class="btn sm" id="toRefAdd">+ Ajouter</button></div></div></div>
      <div class="box"><div class="ligne-titre"><span class="lb">Découpage</span>
          <button class="btn xs miette-aide" id="toRenfort" style="margin-left:auto" title="Miette propose un découpage plan par plan">Proposer</button></div>
        <table class="to-plans"><colgroup><col style="width:28px"><col style="width:${largeurCol('cadrage')}px"><col><col style="width:${largeurCol('duree')}px"><col style="width:${largeurCol('notes')}px"><col style="width:${largeurCol('imgs')}px"><col style="width:76px"></colgroup>
          <thead><tr><th>#</th><th>Cadrage<i class="to-rz" data-rz="cadrage" title="Tirer pour changer la largeur"></i></th><th>Ce qu'on voit / ce qui se passe</th><th>Durée<i class="to-rz" data-rz="duree" title="Tirer pour changer la largeur"></i></th><th>Notes<i class="to-rz" data-rz="notes" title="Tirer pour changer la largeur"></i></th><th>Images<i class="to-rz" data-rz="imgs" title="Tirer pour changer la largeur"></i></th><th></th></tr></thead>
          <tbody>${t.plans.map((p, i) => `<tr data-i="${i}"><td class="mono">${i + 1}${pastille(p.par)}</td>
            <td><select class="fld" data-p="cadrage"><option value="">—</option>${CADRAGES.map(c => `<option${p.cadrage === c ? ' selected' : ''}>${c}</option>`).join('')}</select></td>
            <td>${p.reel ? `<div class="to-reel"><b>${esc(p.reel)}</b><span>${esc([p.audio, p.horaire, p.lieu, p.camera ? '🎥 cameraman' : ''].filter(Boolean).join(' · '))}</span><button class="btn xs" data-audio="${i}">→ Audio</button></div>` : ''}<textarea class="fld auto" rows="1" data-p="action">${esc(p.action)}</textarea></td>
            <td><input class="fld court" data-p="duree" value="${esc(p.duree)}" placeholder="5 s"></td>
            <td><textarea class="fld auto" rows="1" data-p="notes">${esc(p.notes)}</textarea></td>
            <td class="to-pim" data-drop="${i}">${(p.imgs || []).map((u, k) => { const n = t.moodboard.indexOf(u) + 1; return `<span class="to-vig"${BK.img.bg(u)} data-vu="${i}|${k}" title="Agrandir">${n ? `<b class="to-n">${n}</b>` : ''}<button class="md-x" data-vx="${i}|${k}" title="Détacher de ce plan">✕</button></span>`; }).join('')}<button class="btn xs to-pim-plus" data-ia="${i}" title="Ajouter une image à ce plan (ou glisse-la ici depuis le moodboard)">＋</button></td>
            <td class="to-btns"><button class="btn xs" data-haut="${i}" title="Monter">↑</button><button class="btn xs" data-px="${i}" title="Retirer">✕</button></td></tr>`).join('')}</tbody></table>
        <button class="btn xs" id="toPlan" style="margin-top:8px">+ Ajouter un plan</button></div>
      <div class="deux-box">
        ${zoneTenues(t, 'Tenues · rien que pour ce reel').replace('<span class="lb">', '<div class="ligne-titre"><span class="lb">').replace('</span>', '</span><button class="btn xs miette-aide" id="toTenuesMiette" style="margin-left:auto" title="Miette cherche sur Discord les photos de tenues, et qui les porte">Qui porte quoi ?</button></div>')}
        <div class="box"><span class="lb">Matériel et notes</span>
          <textarea class="fld" data-c="materiel" rows="3" placeholder="ex. 2 caméras, trépied, lampes Globe en rouge, machine à fumée">${esc(t.materiel)}</textarea>
          <textarea class="fld" data-c="notes" rows="3" placeholder="Notes pour l'équipe…" style="margin-top:8px">${esc(t.notes)}</textarea>
          <button class="btn xs" id="toSuppr" style="margin-top:8px;align-self:flex-start">Retirer ce reel</button></div>
      </div></div>`;
  }

  // ---------- les modules en LECTURE (texte propre, sans cases), avec « ✎ Modifier » ----------
  // Un module rempli s'affiche en lecture ; vide, ou d'un reel tout neuf (créé pendant cette session) : en édition.
  T.neufs = T.neufs || new Set(); T.edits = T.edits || new Set();
  function modeLecture(racine, fiche, exclure) {
    if (!racine || !fiche) return;
    const neuf = T.neufs.has(fiche.id);
    for (const box of racine.querySelectorAll('.box')) {
      if (exclure && box.closest(exclure)) continue;
      if (box.classList.contains('tt-reels') || box.dataset.lect || !box.querySelector('.fld, .to-tenue-ph, .to-mood')) continue;
      const lb = box.querySelector(':scope > .lb, :scope > .ligne-titre > .lb'); if (!lb) continue;
      box.dataset.lect = '1';
      const cle = fiche.id + '|' + lb.textContent.replace(/[▸▾]/g, '').trim();
      const plein = [...box.querySelectorAll('input.fld:not([type=file]):not(#toRefUrl):not(#toRefNote), textarea.fld')].some(i => i.value.trim()) || !!box.querySelector('.to-img[data-mi], .to-tph[data-med], .to-doc, .to-vig, .to-ref, .to-plans tbody tr');
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn xs to-edit'; box.appendChild(b);
      const appliquer = lect => { box.classList.toggle('lecture', lect); box.classList.toggle('a-edit', !lect); b.textContent = lect ? '✎ Modifier' : '✓ OK'; b.title = lect ? 'Modifier ce module' : 'Fini : revenir en lecture';
        box.querySelectorAll('input.fld, textarea.fld').forEach(i => { i.readOnly = lect; i.tabIndex = lect ? -1 : 0; });
        box.querySelectorAll('select.fld').forEach(i => { i.disabled = lect; });
        box.querySelectorAll('.to-infos > label, .to-tenue2').forEach(l => { const f = l.querySelector('input.fld, textarea.fld'); const media = l.querySelector('.to-tph[data-med]');
          l.classList.toggle('vide-l', lect && !!f && !f.value.trim() && !media); });
        box.querySelectorAll('input[type=date].fld, input[type=time].fld').forEach(i => { let v = i.nextElementSibling; if (!v || !v.classList.contains('lect-v')) { v = document.createElement('span'); v.className = 'lect-v'; i.after(v); }
          v.textContent = i.type === 'date' ? (i.value ? dateFr(i.value) : '') : (i.value || '').replace(':', ' h '); i.classList.toggle('lect-cache', lect); v.hidden = !lect; });
        box.querySelectorAll('textarea.fld:not(.auto)').forEach(a => { a.style.height = ''; if (lect) a.style.height = (a.scrollHeight + 2) + 'px'; });
        box.querySelectorAll('[draggable="true"]').forEach(d => { if (lect) d.dataset.glisse = '1'; });
      };
      appliquer(plein && !neuf && !T.edits.has(cle));
      b.onclick = e => { e.stopPropagation(); const lect = !box.classList.contains('lecture'); if (lect) T.edits.delete(cle); else T.edits.add(cle); appliquer(lect); };
    }
  }

  let minuteur = null;
  const sauver = (t, tout = false) => { if (tout) rendreListe(); clearTimeout(minuteur); minuteur = setTimeout(async () => { await BK.db.ecrire('tournages', t); msg('Enregistré'); }, 500); };

  function brancher(t) {
    const z = T.zone || $('#toFiche');
    if (!T.zone) brancherMedias(z);
    let dateAvant = t.date || '';                                     // pour déplacer le rendez-vous de la journée si la date change
    $$('[data-c]', z).forEach(c => c.oninput = c.onchange = e => { const k = c.dataset.c; t[k] = c.value; sauver(t, /titre|date|morceau/.test(k));
      if (e.type === 'change' && /titre|morceau|idee/.test(k)) setTimeout(() => versReelLie(t), 900);
      if (e.type === 'change' && /titre/.test(k) && t.parent) setTimeout(() => synchroTour(T.liste.find(x => x.id === t.parent)), 1200); });
    $$('[data-tenue]', z).forEach(c => c.oninput = () => { t.tenues[c.dataset.tenue] = c.value; sauver(t); });
    // ---------- tenues : des photos (Médias, cloud, Discord), rangées dans la fiche et étiquetées « Tenues » + ce tournage ----------
    const image = f => /^image\//.test(f.mimeType || '');
    const enImage = async (x, role) => {                     // x : { f } (Drive) ou { dc } (Discord) → l'adresse de l'image sur le Drive, et étiquettes
      const d = await BK.img.depuisChoix(x, role);
      if (d.id) for (const k of ['c:outfits', 't:' + t.id]) await BK.etiquettes.basculer(d.id, k, true);
      return d.ref; };
    $$('[data-tph]', z).forEach(b => b.onclick = async () => {
      if (!BK.drive.relie()) return msg('Relie d\'abord le Drive');
      const qui = b.dataset.tph, l = await BK.choisirDansMedias({ titre: 'Tenue de ' + qui, bouton: 'Ajouter', type: 'image', sujet: 'c:outfits' });
      if (!l || !l.length) return;
      msg('Ajout des photos…'); t.tenuesPhotos = t.tenuesPhotos || {}; t.tenuesPhotos[qui] = t.tenuesPhotos[qui] || [];
      for (const x of l) { try { const u = await enImage(x, 'outfits'); if (u) t.tenuesPhotos[qui].push(u); } catch (e) { console.warn(e); } await BK.audio.pause(); }
      await BK.db.ecrire('tournages', t); msg(l.length + ' photo(s) pour ' + qui); rendreFiche(); });
    $$('[data-tpx]', z).forEach(b => b.onclick = async () => { if (!await BK.confirmer('Retirer cette photo de la tenue ? (elle reste dans le Drive)')) return; const [qui, i] = b.dataset.tpx.split('|'); t.tenuesPhotos[qui].splice(+i, 1); await BK.db.ecrire('tournages', t); rendreFiche(); });
    // Miette : sur Discord, les photos de tenues (salon « outfit », ou un message qui parle de tenue) et qui les a postées
    $('#toTenuesMiette').onclick = async () => {
      const b = $('#toTenuesMiette'); b.disabled = true; b.innerHTML = '<span class="spin"></span>Miette cherche…';
      let l = []; try { l = await BK.discord.mediasVite('media', {}) || []; } catch (e) {}
      b.disabled = false; b.textContent = 'Qui porte quoi ?';
      const RE = /tenue|outfit|fringue|look|porte|portera|habit|veste|chemise|pantalon|jean|robe|chaussure|sneaker|costume/i;
      const deja = new Set(Object.values(t.tenuesPhotos || {}).flat());
      const props = [];
      for (const x of l) { if (x.video || !/\.(jpe?g|png|webp)$/i.test(x.nom || '')) continue;
        if (!(/outfit|tenue|look|style/i.test(x.salon || '') || RE.test(x.texte || ''))) continue;
        // à qui : un prénom cité dans le message, sinon celui qui a posté
        const cite = T.membres.find(m => new RegExp('\\b' + m + '\\b', 'i').test(x.texte || ''));
        const qui = cite || T.membres.find(m => m.toLowerCase() === String(x.qui || '').toLowerCase());
        if (qui) props.push({ qui, x }); }
      if (!props.length) return msg('Miette n\'a pas trouvé de photo de tenue sur Discord');
      const v = document.createElement('div'); v.className = 'voile';
      v.innerHTML = `<div class="stopbox" style="width:720px;align-items:stretch">
        <span class="screw tl"></span><span class="screw tr"></span><span class="screw bl"></span><span class="screw br"></span>
        <span class="dymo" style="align-self:center">🍞 Les tenues vues sur Discord</span>
        <div class="tn-props">${T.membres.map(m => { const l = props.filter(p => p.qui === m); return l.length ? `<span class="eng">${esc(m)}</span><div class="tn-l">${l.map((p, i) => `<label class="tn-p" title="${esc(p.x.texte || p.x.nom)}"><input type="checkbox" data-tn="${props.indexOf(p)}" checked><span style="background-image:url(${esc(p.x.apercu || p.x.url)})"></span><small>${esc((p.x.texte || '').slice(0, 40))}</small></label>`).join('')}</div>` : ''; }).join('')}</div>
        <span class="nt">Décoche ce qui n'est pas une tenue pour ce tournage.</span>
        <div class="stopbox-btns"><button class="btn pri" id="tnOk">Ajouter aux tenues</button><button class="btn" id="tnNon">Annuler</button></div></div>`;
      document.body.appendChild(v);
      v.querySelector('#tnNon').onclick = () => v.remove();
      v.querySelector('#tnOk').onclick = async () => {
        const ch = [...v.querySelectorAll('[data-tn]:checked')].map(c => props[+c.dataset.tn]); v.remove();
        t.tenuesPhotos = t.tenuesPhotos || {}; let n = 0;
        for (const p of ch) { try { const u = await enImage({ dc: p.x, nom: p.x.nom }, 'outfits'); if (u && !deja.has(u)) { (t.tenuesPhotos[p.qui] = t.tenuesPhotos[p.qui] || []).push(u); n++; } } catch (e) { console.warn(e); }
          msg(`Ajout ${n}/${ch.length}…`); await BK.audio.pause(); }
        await BK.db.ecrire('tournages', t); msg(n + ' photo(s) de tenue ajoutée(s)'); rendreFiche(); };
    };
    $$('.to-plans tr[data-i]', z).forEach(tr => $$('[data-p]', tr).forEach(c => c.oninput = c.onchange = () => { t.plans[+tr.dataset.i][c.dataset.p] = c.value; sauver(t); }));
    // ---------- découpage : champs qui s'agrandissent, colonnes réglables, images liées aux plans ----------
    const grandir = ta => { if (!ta.offsetParent) return; ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
    const grandirTous = () => $$('.to-plans textarea.auto', z).forEach(grandir);
    $$('.to-plans textarea.auto', z).forEach(ta => ta.addEventListener('input', () => grandir(ta)));
    requestAnimationFrame(grandirTous);
    $$('[data-rz]', z).forEach(h => h.onpointerdown = e => {                       // tirer la bordure d'une colonne
      e.preventDefault(); e.stopPropagation(); h.setPointerCapture(e.pointerId);
      const k = h.dataset.rz, th = h.parentElement, col = $('.to-plans colgroup', z).children[[...th.parentElement.children].indexOf(th)], x0 = e.clientX, w0 = th.getBoundingClientRect().width;
      h.onpointermove = ev => { col.style.width = Math.max(50, Math.min(700, w0 + ev.clientX - x0)) + 'px'; };
      h.onpointerup = () => { h.onpointermove = h.onpointerup = null; const c = { ...BK.reglage('tournage.cols', {}) }; c[k] = Math.round(parseFloat(col.style.width)); BK.regler('tournage.cols', c); grandirTous(); }; });
    const ajouterAuPlan = (i, u) => { const p = t.plans[i]; p.imgs = p.imgs || []; if (u && !p.imgs.includes(u)) p.imgs.push(u); };
    // glisser une image du moodboard sur un plan
    $$('.to-img[data-mi]', z).forEach(el => el.addEventListener('dragstart', e => { e.dataTransfer.setData('text/bk-moodimg', el.dataset.mi); e.dataTransfer.effectAllowed = 'copy'; }));
    $$('.to-plans tr[data-i]', z).forEach(tr => {
      tr.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('text/bk-moodimg')) { e.preventDefault(); e.stopPropagation(); tr.classList.add('survol'); } }, true);
      tr.addEventListener('dragleave', e => { if (!tr.contains(e.relatedTarget)) tr.classList.remove('survol'); });
      tr.addEventListener('drop', e => { const m = e.dataTransfer.getData('text/bk-moodimg'); if (m === '') return; e.preventDefault(); e.stopPropagation(); tr.classList.remove('survol');
        ajouterAuPlan(+tr.dataset.i, t.moodboard[+m]); sauver(t); rendreFiche(); }, true); });
    $$('[data-vx]', z).forEach(b => b.onclick = e => { e.stopPropagation(); const [i, k] = b.dataset.vx.split('|'); t.plans[+i].imgs.splice(+k, 1); sauver(t); rendreFiche(); });
    $$('[data-vu]', z).forEach(b => b.onclick = () => { const [i, k] = b.dataset.vu.split('|'), u = t.plans[+i].imgs[+k];       // agrandir
      const v = document.createElement('div'); v.className = 'voile'; v.innerHTML = `<img${BK.img.src(u)} style="max-width:92vw;max-height:92vh;border-radius:4px;box-shadow:0 8px 30px #000">`; v.onclick = () => v.remove(); document.body.appendChild(v); });
    $$('[data-ia]', z).forEach(b => b.onclick = e => {                                                     // le petit « + » : le moodboard, ou Médias
      e.stopPropagation(); $$('.to-pop').forEach(x => x.remove()); const i = +b.dataset.ia, r = b.getBoundingClientRect();
      const pop = document.createElement('div'); pop.className = 'to-pop';
      pop.innerHTML = (t.moodboard.length ? `<span class="eng">Du moodboard</span><div class="to-pop-g">${t.moodboard.map((u, k) => `<span class="to-vig${(t.plans[i].imgs || []).includes(u) ? ' on' : ''}"${BK.img.bg(u)} data-pk="${k}"><b class="to-n">${k + 1}</b></span>`).join('')}</div>` : '<span class="nt">Le moodboard est vide.</span>')
        + '<button class="btn xs" data-pm="1">＋ Depuis Médias…</button>';
      pop.style.left = Math.max(8, Math.min(r.left, innerWidth - 300)) + 'px'; pop.style.top = Math.min(r.bottom + 4, innerHeight - 260) + 'px';
      document.body.appendChild(pop);
      pop.onclick = async ev => { ev.stopPropagation(); const k = ev.target.closest('[data-pk]'), m = ev.target.closest('[data-pm]');
        if (k) { const u = t.moodboard[+k.dataset.pk], p = t.plans[i]; p.imgs = p.imgs || []; const j = p.imgs.indexOf(u); if (j >= 0) p.imgs.splice(j, 1); else p.imgs.push(u); pop.remove(); sauver(t); rendreFiche(); }
        if (m) { pop.remove(); if (!BK.drive.relie()) return msg('Relie d\'abord le Drive');
          const l = await BK.choisirDansMedias({ titre: 'Images pour le plan ' + (i + 1), bouton: 'Ajouter au plan', type: 'image', sujet: 'c:moodboard' }); if (!l || !l.length) return;
          msg('Ajout des images…'); const tags = ['t:' + t.id, 'c:moodboard', 'c:tournage'];
          for (const x of l) { try { const d = await BK.img.depuisChoix(x, 'moodboard'); if (d.ref) { if (!t.moodboard.includes(d.ref)) t.moodboard.push(d.ref); ajouterAuPlan(i, d.ref); }
              if (d.id) for (const g of tags) await BK.etiquettes.basculer(d.id, g, true); } catch (er) { console.warn(er); } await BK.audio.pause(); }
          BK.dossiers.oublier && BK.dossiers.oublier(); t.moodboardAuto = false; await BK.db.ecrire('tournages', t); msg(l.length + ' image(s) ajoutée(s) au plan ' + (i + 1) + ' et au moodboard'); rendreFiche(); } };
      setTimeout(() => document.addEventListener('pointerdown', ev => { if (!pop.contains(ev.target)) pop.remove(); }, { once: true }), 0); });
    $('#toPlan').onclick = () => { t.plans.push({ cadrage: '', action: '', duree: '', notes: '' }); sauver(t); rendreFiche(); const l = $$('.to-plans [data-p="action"]'); l.length && l[l.length - 1].focus(); };
    $$('[data-px]', z).forEach(b => b.onclick = () => { t.plans.splice(+b.dataset.px, 1); sauver(t); rendreFiche(); });
    $$('[data-haut]', z).forEach(b => b.onclick = () => { const i = +b.dataset.haut; if (!i) return; [t.plans[i - 1], t.plans[i]] = [t.plans[i], t.plans[i - 1]]; sauver(t); rendreFiche(); });
    $$('.to-doc a', z).forEach(a => a.onclick = e => { e.preventDefault(); BK.ouvrirLien(a.dataset.url); });
    $$('[data-dx]', z).forEach(b => b.onclick = () => { t.moodboardDocs.splice(+b.dataset.dx, 1); sauver(t); rendreFiche(); });
    $$('[data-mx]', z).forEach(b => b.onclick = () => { const u = t.moodboard.splice(+b.dataset.mx, 1)[0]; t.plans.forEach(p => { if (p.imgs) p.imgs = p.imgs.filter(x => x !== u); }); sauver(t); rendreFiche(); });
    $('#toMoodPlus').onclick = () => $('#toMoodIn').click();
    // en priorité : ce qui est déjà étiqueté dans Médias (moodboard, tenues, ce tournage, le morceau)
    // chaque encadré de la fiche se replie d'un clic sur son titre (et on s'en souvient)
    (() => {
      const plis = BK.reglage('tournage.plis', {});
      for (const box of $$('#toCorps > .box, #toCorps .deux-box > .box, #toCorps .to-refs')) {
        const lb = box.querySelector(':scope > .lb, :scope > .ligne-titre > .lb'); if (!lb || lb.dataset.pli) continue;
        const cle = lb.textContent.trim().replace(/[^a-zà-ÿ]/gi, '').toLowerCase() || 'x';
        lb.dataset.pli = cle; lb.classList.add('pliable'); lb.title = 'Replier / déplier';
        const tete = lb.parentElement.classList.contains('ligne-titre') ? lb.parentElement : lb; tete.classList.add('box-tete');
        lb.insertAdjacentHTML('afterbegin', `<span class="pli-fleche">${plis[cle] ? '▸' : '▾'}</span>`);
        box.classList.toggle('replie', !!plis[cle]);
        lb.onclick = e => { e.stopPropagation(); const p = BK.reglage('tournage.plis', {}); p[cle] = !p[cle]; BK.regler('tournage.plis', p);
          box.classList.toggle('replie', p[cle]); lb.querySelector('.pli-fleche').textContent = p[cle] ? '▸' : '▾'; setTimeout(grandirTous, 0); };
      }
    })();
    $('#toMoodTag').onclick = async () => {
      if (!BK.drive.relie()) return msg('Relie d\'abord le Drive');
      // toujours par Médias : la fenêtre s'ouvre sur l'étiquette « Moodboard »
      const l = await BK.choisirDansMedias({ titre: 'Images et PDF pour le moodboard', bouton: 'Ajouter au moodboard', type: 'imagepdf', sujet: 'c:moodboard' });
      if (!l || !l.length) return;
      msg('Ajout des images…');
      const tagsMood = ['t:' + t.id, 'c:moodboard', 'c:tournage'];
      for (const x of l) {
        try {
          if (x.mime === 'application/pdf' || /\.pdf$/i.test(x.nom || '')) {                  // un PDF : en 📄 sous les images
            let pid = x.f ? x.id : ''; if (!pid && x.fichier) pid = (await BK.img.versDrive(x.fichier, x.nom, 'moodboard')).id;
            if (pid) { t.moodboardDocs = t.moodboardDocs || []; if (!t.moodboardDocs.some(q => q.id === pid)) t.moodboardDocs.push({ nom: x.nom || 'PDF', url: BK.driveUrl(pid), id: pid });
              for (const k of tagsMood) await BK.etiquettes.basculer(pid, k, true); }
            continue; }
          const d = await BK.img.depuisChoix(x, 'moodboard'), id = d.id, u = d.ref;   // Discord ou ce PC : rangé d'abord dans le Drive (moodboard)
          if (u && !t.moodboard.includes(u)) t.moodboard.push(u);                 // la fiche garde juste l'adresse de l'image
          if (id) for (const k of tagsMood) await BK.etiquettes.basculer(id, k, true);   // étiqueté tournage + moodboard, tout seul
        } catch (e) { console.warn(e); }
        await BK.audio.pause();
      }
      BK.dossiers.oublier && BK.dossiers.oublier();
      t.moodboardAuto = false; await BK.db.ecrire('tournages', t); msg(l.length + ' image(s) ajoutée(s) et étiquetées'); rendreFiche();
    };
    // les références (liens)
    const ajouterRef = async () => { const u = $('#toRefUrl').value.trim(), n = $('#toRefNote').value.trim();
      if (!/^https?:\/\//i.test(u)) { $('#toRefUrl').focus(); return msg('Colle un lien qui commence par https://'); }
      t.references = t.references || []; t.references.push({ url: u, note: n }); await BK.db.ecrire('tournages', t); msg('Référence ajoutée'); rendreFiche(); };
    $('#toRefAdd').onclick = ajouterRef;
    // ---------- Miette aide : les moodboards et les références dont on a parlé ----------
    const occupe = (b, oui) => { b.disabled = oui; if (oui) { b.dataset.t = b.textContent; b.innerHTML = '<span class="spin"></span>Miette cherche…'; } else b.textContent = b.dataset.t; };
    $('#toMoodMiette').onclick = async () => { const b = $('#toMoodMiette');
      if (!BK.drive.relie()) return msg('Relie d\'abord le Drive');
      occupe(b, true); let l = []; try { await BK.dossiers.assurer(); l = await BK.miette.moodboardPour(t); } catch (e) { console.warn(e); } occupe(b, false);
      const ch = await BK.miette.proposer({ titre: 'Miette a trouvé ces images', vide: 'Miette n\'a pas trouvé d\'image de moodboard pour ce tournage (dossier Moodboards du Drive, ou Discord).', bouton: 'Ajouter au moodboard', items: l });
      if (!ch.length) return; msg('Ajout des images…'); let n = 0;
      for (const x of ch) { try { const d = await BK.img.depuisChoix(x, 'moodboard');
          if (d.ref && !t.moodboard.includes(d.ref)) { t.moodboard.push(d.ref); n++; }
          if (d.id) for (const k of ['t:' + t.id, 'c:moodboard', 'c:tournage']) await BK.etiquettes.basculer(d.id, k, true); } catch (e) { console.warn(e); } await BK.audio.pause(); }
      await BK.db.ecrire('tournages', t); msg(n + ' image(s) ajoutée(s) par Miette'); rendreFiche(); };
    $('#toRefMiette').onclick = async () => { const b = $('#toRefMiette');
      occupe(b, true); let l = []; try { l = await BK.miette.referencesPour(t); } catch (e) { console.warn(e); } occupe(b, false);
      const ch = await BK.miette.proposer({ titre: 'Les références dites sur Discord', vide: 'Miette n\'a pas trouvé de lien (Instagram, TikTok, YouTube…) pour ce tournage sur Discord.', bouton: 'Ajouter aux références', items: l });
      if (!ch.length) return; t.references = t.references || [];
      for (const x of ch) t.references.push({ url: x.url, note: x.note });
      await BK.db.ecrire('tournages', t); msg(ch.length + ' référence(s) ajoutée(s) par Miette'); rendreFiche(); };
    ['#toRefUrl', '#toRefNote'].forEach(k => $(k).addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') ajouterRef(); }));
    $$('[data-rval]', z).forEach(b => b.onclick = async () => { const r = t.references[+b.dataset.rval]; if (r) delete r.miette; await BK.db.ecrire('tournages', t); msg('Validée'); rendreFiche(); });
    $$('[data-rx]', z).forEach(b => b.onclick = async () => { t.references.splice(+b.dataset.rx, 1); await BK.db.ecrire('tournages', t); rendreFiche(); });
    $$('.to-ref a[data-url]', z).forEach(a => a.onclick = e => { e.preventDefault(); BK.ouvrirLien(a.dataset.url); });
    $$('[data-audio]', z).forEach(b => b.onclick = () => versAudio(t.plans[+b.dataset.audio]));
    $('#toMoodIn').onchange = e => { ajouterImages(t, e.target.files); e.target.value = ''; };
    $('#toSuppr').onclick = async () => { if (!(await BK.confirmer(`Retirer « ${t.titre || 'ce reel'} » ? (rangé dans la corbeille du Drive)`))) return; await BK.db.supprimer('tournages', t.id); T.liste = T.liste.filter(x => x.id !== t.id); T.courant = null; if (T.vue !== 'tournage') T.vue = 'jours'; msg('Retiré'); if (t.parent) await synchroTour(T.liste.find(x => x.id === t.parent)); charger(); };
    $('#toRenfort').onclick = () => BK.renfortDemander ? BK.renfortDemander('decoupage', { tournage: t }) : msg('Miette pas encore disponible');
    $$('input,textarea', z).forEach(c => c.addEventListener('keydown', e => e.stopPropagation()));
  }


  // ---------- un plan du PLAN.xlsx → l'Assistant audio Reel (morceau + passage) ----------
  function passage(txt) {
    const t = String(txt || '').replace(/\s*:\s*/g, ':'), m = t.match(/(\d{1,2}):(\d{2})\s*[-–—à]\s*(\d{1,2}):(\d{2})/);
    return m ? { debut: +m[1] * 60 + +m[2], fin: +m[3] * 60 + +m[4] } : null;
  }
  async function versAudio(p) {
    const ms = await BK.db.liste('morceaux'), m = BK.inv.trouverMorceau(p.reel, ms);
    if (!m) return msg('Morceau inconnu : ' + p.reel);
    const ps = passage(p.audio);
    if (!BK.reelsPasser) return msg('Assistant audio indisponible');
    BK.reelsPasser({ morceau: m, ...(ps || {}) });
    if (!ps) setTimeout(() => BK.reelsMsg && BK.reelsMsg('Passage : ' + p.audio + ' → place le bloc à la main'), 1500);
  }

  // ---------- lire le PLAN.xlsx (dossier Tournages du Drive) ----------
  async function lirePlan() {
    if (!BK.drive.relie()) return msg('Relie d\'abord le Drive');
    msg('Lecture du PLAN.xlsx…');
    await BK.dossiers.assurer();
    const d = await BK.dossiers.get('tournage'); if (!d) return msg('Dossier Tournages introuvable (Réglages › Vos dossiers)');
    const f = (await BK.dossiers.enfants(d.id)).find(x => /plan.*\.xlsx$/i.test(x.name) || x.mimeType === 'application/vnd.google-apps.spreadsheet' && /plan/i.test(x.name));
    if (!f) return msg('Pas de PLAN.xlsx dans le dossier Tournages');
    const octets = f.mimeType === 'application/vnd.google-apps.spreadsheet'
      ? new Uint8Array(await (await BK.drive.api(`/files/${f.id}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`)).arrayBuffer())
      : await BK.drive.telecharger(f.id);
    const lignes = await BK.xlsx.lignes(octets);
    const h = lignes.findIndex(l => l.some(c => /^chanson$/i.test(c))); if (h < 0) return msg('Colonnes du PLAN non reconnues');
    const col = re => lignes[h].findIndex(c => re.test(c));
    const C = { num: col(/^$/) , chanson: col(/chanson/i), audio: col(/audio/i), plans: col(/^plans?$/i), action: col(/action/i), lieu: col(/lieu/i), jour: col(/tourn/i), enjeux: col(/enjeu/i), horaire: col(/horaire|heure/i), camera: col(/camera/i) };
    const rows = lignes.slice(h + 1).filter(l => l[C.chanson]).map(l => ({ reel: l[C.chanson], audio: l[C.audio] || '', plans: l[C.plans] || '', action: l[C.action] || '', lieu: l[C.lieu] || '',
      jour: l[C.jour] || '?', enjeux: l[C.enjeux] || '', horaire: l[C.horaire] || '', camera: C.camera >= 0 && /x/i.test(l[C.camera] || '') }));
    await BK.partage.ecrire('plan.lignes', rows.map(r => ({ reel: r.reel, audio: r.audio, jour: r.jour, plans: String(r.plans).slice(0, 80) })));   // l'Assistant audio retrouve les passages (sur tous les PC)
    montrerPlan(rows, f);
  }
  function montrerPlan(rows, f) {
    const jours = [...new Set(rows.map(r => r.jour))];
    $('#toFiche').innerHTML = `<div class="box"><div class="ligne-titre"><button class="btn sm" id="toPlanRetour">← Retour</button><span class="lb">PLAN.xlsx · ${rows.length} reels · ${jours.length} jour(s) de tournage</span>
        <button class="btn xs" id="toPlanOuvrir" style="margin-left:auto">Ouvrir dans le Drive</button></div>
        <span class="nt">Lu dans le Drive (rien n'est modifié). « Créer la fiche » range le jour de tournage dans BEESKOT Studio (moodboard, tenues, PDF…). « → Audio » prépare le passage dans l'Assistant audio Reel.</span></div>
      ${jours.map(j => { const rs = rows.filter(r => r.jour === j);
        return `<div class="box"><div class="ligne-titre"><span class="lb">Tournage ${esc(j)}</span><span class="nt" style="margin:0 12px">${esc([...new Set(rs.map(r => r.lieu.split(/\n/)[0]))].join(' · '))}</span>
          <button class="btn xs pri" data-jour="${esc(j)}" style="margin-left:auto">${T.liste.some(t => t.source === 'plan-' + j) ? '↻ Mettre à jour la fiche' : '+ Créer la fiche'}</button></div>
          ${rs.map((r, i) => `<div class="to-pl"><div class="to-pl-t"><b>${esc(r.reel)}</b><span class="nt">${esc(r.horaire)}${r.camera ? ' · 🎥' : ''}</span>
            <button class="btn xs" data-pa="${esc(j)}|${i}" title="Ouvrir ce morceau dans l'Assistant audio Reel${passage(r.audio) ? ' avec le passage déjà placé' : ''}">→ Audio</button></div>
            <span class="nt"><b>Audio :</b> ${esc(r.audio)}</span><span class="nt"><b>Plans :</b> ${esc(r.plans)}</span><span class="nt"><b>Action :</b> ${esc(r.action)}</span>
            ${r.enjeux ? `<span class="nt"><b>Enjeux :</b> ${esc(r.enjeux)}</span>` : ''}</div>`).join('')}</div>`; }).join('')}`;
    $('#toPlanOuvrir').onclick = () => BK.ouvrirLien(f.webViewLink);
    $('#toPlanRetour').onclick = () => { rendreFiche(); msg('PRÊT'); };
    $$('[data-pa]', page).forEach(b => b.onclick = () => { const [j, i] = b.dataset.pa.split('|'); versAudio(rows.filter(r => r.jour === j)[+i]); });
    $$('[data-jour]', page).forEach(b => b.onclick = async () => {
      const j = b.dataset.jour, rs = rows.filter(r => r.jour === j);
      let t = T.liste.find(x => x.source === 'plan-' + j);
      if (!t) t = await BK.db.ecrire('tournages', { niveau: 'tournage', titre: 'Tournage ' + j + ' (PLAN)', type: 'Reel', morceau: '', date: '', heure: (rs[0].horaire.match(/\d{1,2}h\d{0,2}/) || [''])[0].replace('h', ':').replace(/:$/, ':00').padStart(5, '0'), lieu: [...new Set(rs.map(r => r.lieu.split(/\n/)[0]))].join(' / '),
        idee: '', moodboard: [], plans: [], tenues: {}, materiel: [...new Set(rs.map(r => r.enjeux).filter(Boolean))].join('\n'), notes: '', source: 'plan-' + j });
      let k = 0;                                                         // chaque ligne du PLAN = un reel de ce tournage (mis à jour, jamais en double)
      for (const r of rs) { const src = 'plan-' + j + '-' + r.reel, m = BK.inv.trouverMorceau(r.reel, T.fiches || []);
        const ex = T.liste.find(x => x.source === src) || { niveau: 'reel', moodboard: [], tenues: {}, materiel: '', idee: '' };
        Object.assign(ex, { parent: t.id, ordre: k++, titre: ex.titre || r.reel, type: 'Reel', morceau: ex.morceau || (m ? m.nom : ''), source: src, notes: ex.notes || [r.audio && 'Audio : ' + r.audio, r.action, r.enjeux].filter(Boolean).join('\n'),
          plans: (ex.plans || []).length ? ex.plans : [{ cadrage: '', action: r.plans, duree: '', notes: [r.horaire, r.camera ? 'cameraman' : ''].filter(Boolean).join(' · ') }] });
        await BK.db.ecrire('tournages', ex); }
      msg('Tournage ' + j + ' prêt, avec ses ' + rs.length + ' reels'); T.tour = t; T.vue = 'tournage'; await charger(); await synchroTour(T.tour);
    });
    msg('PLAN lu ✓');
  }
  $('#toPlanXl').onclick = () => lirePlan().catch(e => msg('Lecture impossible : ' + e.message));
  // ---------- « + Ajouter un média » : des images en vrac, à glisser sur un tournage (son moodboard) ou sur une journée ----------
  $('#toMedia').onclick = async () => {
    if (!BK.drive.relie()) return msg('Relie d\'abord le Drive');
    const l = await BK.choisirDansMedias({ titre: 'Des médias pour les tournages', bouton: 'Ajouter', sujet: 'c:moodboard' });
    if (!l || !l.length) return;
    msg('Ajout des médias…'); const v = await BK.partage.lire('tournage.vrac', []).catch(() => []), vrac = Array.isArray(v) ? v : [];
    for (const x of l) { try { const d = await BK.img.depuisChoix(x, 'moodboard'); if (d.ref && !vrac.some(y => y.u === d.ref)) vrac.push({ u: d.ref, id: d.id || '', mime: x.mime || '', nom: x.nom || '' }); } catch (e) { console.warn(e); } await BK.audio.pause(); }
    await BK.partage.ecrire('tournage.vrac', vrac); T.vue = 'jours'; msg(l.length + ' média(s) ajouté(s) : glisse-les sur un tournage ou une journée'); rendreFiche();
  };

  async function ajouterImages(t, fichiers) {
    const tous = [...fichiers], pdfs = tous.filter(f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)), fs = tous.filter(f => /^image\//.test(f.type));
    if (!fs.length && !pdfs.length) return msg('Des images ou des PDF');
    if (pdfs.length) { msg('Envoi des PDF…'); t.moodboardDocs = t.moodboardDocs || [];
      for (const f of pdfs) { try { const d = await BK.img.versDrive(f, f.name, 'moodboard'); if (d.id) { t.moodboardDocs.push({ nom: f.name, url: BK.driveUrl(d.id), id: d.id });
          for (const k of ['t:' + t.id, 'c:moodboard', 'c:tournage']) await BK.etiquettes.basculer(d.id, k, true); } else msg('Relie le Drive pour joindre un PDF'); } catch (e) { console.warn(e); msg('PDF pas envoyé : ' + f.name); } }
      if (!fs.length) { await BK.db.ecrire('tournages', t); msg('PDF ajouté au moodboard'); return rendreFiche(); } }
    if (t.moodboard.length + fs.length > 24) return msg('24 images maximum par moodboard');
    msg('Ajout des images…');
    for (const f of fs) { try { const d = await BK.img.versDrive(f, f.name, 'moodboard'); t.moodboard.push(d.ref || d);   // rangée dans le dossier moodboard du Drive
        if (d.id) for (const k of ['t:' + t.id, 'c:moodboard', 'c:tournage']) await BK.etiquettes.basculer(d.id, k, true); } catch (e) { console.warn(e); } await BK.audio.pause(); }
    await BK.db.ecrire('tournages', t); msg('Moodboard enregistré'); rendreFiche();
  }
  page.addEventListener('dragover', e => { if (T.courant || BK.glisse.actif()) e.preventDefault(); });
  page.addEventListener('drop', async e => { e.preventDefault();
    if (BK.glisse.actif() && !e.dataTransfer.files.length) {           // venu de Médias, lâché ailleurs : dans « Médias à ranger »
      const v = await BK.partage.lire('tournage.vrac', []).catch(() => []), vrac = Array.isArray(v) ? v : [];
      for (const x of BK.glisse.items) if (!x.dc && !vrac.some(y => y.id === x.id)) vrac.push({ u: BK.img.ref(x.id), id: x.id, mime: x.mime, nom: x.nom });
      await BK.partage.ecrire('tournage.vrac', vrac); msg('Dans « Médias à ranger » : glisse-les sur une tenue, un moodboard ou un tournage'); return rendreFiche(); }
    if (T.courant && e.dataTransfer.files.length) ajouterImages(T.courant, e.dataTransfer.files); });

  // =====================================================================
  //  TOURNAGES (v2) : un TOURNAGE = une journée (affiche, date, lieu) → dedans, les REELS qu'on y tourne.
  //  Chaque reel se déplie : infos, moodboard, découpage, tenues, matériel. Tenues / matériel du tournage = pour tous ses reels.
  // =====================================================================
  const estTour = x => x && x.niveau === 'tournage';
  const tournagesL = () => T.liste.filter(estTour).sort((a, b) => String(b.id || '').localeCompare(String(a.id || '')));   // le plus récent (créé) en premier
  const reelsDe = tr => T.liste.filter(x => !estTour(x) && x.parent === tr.id).sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  const jourFr = d => d ? new Date(d + 'T12:00').toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' }) : 'date à fixer';
  const slug = n => String(n).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const idDe = u => /^drive:/.test(u || '') ? u.slice(6) : '';
  const imgDe = t => { const m = (T.fiches || []).find(y => y.nom === t.morceau); return (m && m.photo) || (t.moodboard || [])[0] || (Object.values(t.tenuesPhotos || {}).flat())[0] || ''; };

  // ---------- passage à la v2 (une seule fois, pour tout le groupe) ----------
  async function migrer() {
    if (T.liste.every(x => x.niveau)) return false;
    const deja = await BK.partage.lire('tournage.v2', false).catch(() => false);
    for (const t of T.liste.filter(x => !x.niveau)) {
      if (!deja && (t.plans || []).some(p => p.reel)) {                // une fiche du PLAN : elle devient le tournage, ses lignes deviennent ses reels
        t.niveau = 'tournage'; const vus = new Set(); let k = 0;
        for (const p of t.plans.filter(p => p.reel)) { const n = String(p.reel).trim(); if (vus.has(n.toLowerCase())) continue; vus.add(n.toLowerCase());
          const m = BK.inv.trouverMorceau(n, T.fiches || []);
          const r = await BK.db.ecrire('tournages', { niveau: 'reel', parent: t.id, ordre: k++, titre: n, type: 'Reel', morceau: m ? m.nom : '', idee: '', moodboard: [], tenues: {}, materiel: '', notes: [p.audio && 'Audio : ' + p.audio, p.notes].filter(Boolean).join('\n'),
            plans: t.plans.filter(q => String(q.reel).trim().toLowerCase() === n.toLowerCase()).map(q => ({ cadrage: q.cadrage || '', action: q.action || '', duree: q.duree || '', notes: [q.horaire, q.camera ? 'cameraman' : ''].filter(Boolean).join(' · ') })), source: (t.source || 'plan') + '-' + n });
          T.liste.push(r); }
        t.plans = [];
      } else { t.niveau = 'reel'; t.parent = ''; }
      await BK.db.ecrire('tournages', t);
    }
    // les « journées » de la 0.9.58 : chaque date devient un tournage, ses fiches deviennent ses reels
    if (!deja) {
      const jm = await BK.partage.lire('tournage.joursMedias', {}).catch(() => ({})) || {};
      const dates = [...new Set([...(await BK.partage.lire('tournage.jours', []).catch(() => []) || []), ...T.liste.filter(x => !estTour(x) && !x.parent && x.date).map(x => x.date)])];
      for (const d of dates) { const reels = T.liste.filter(x => !estTour(x) && !x.parent && x.date === d);
        let tr = T.liste.find(x => estTour(x) && x.date === d);
        if (!tr) { tr = await BK.db.ecrire('tournages', { niveau: 'tournage', titre: 'Tournage · ' + jourFr(d), type: 'Reel', date: d, heure: reels.map(x => x.heure).filter(Boolean).sort()[0] || '', lieu: [...new Set(reels.map(x => x.lieu).filter(Boolean))].join(' / '), idee: '', moodboard: [], plans: [], tenues: {}, materiel: '', notes: '' }); T.liste.push(tr); }
        tr.assets = [...(tr.assets || []), ...((jm[d] || []).map(x => typeof x === 'string' ? { u: x } : x))]; await BK.db.ecrire('tournages', tr);
        for (const r of reels) { r.parent = tr.id; await BK.db.ecrire('tournages', r); } }
      for (const e of (await BK.db.liste('evenements')).filter(e => e.tourJour)) await BK.db.supprimer('evenements', e.id).catch(() => {});
      await BK.partage.ecrire('tournage.v2', true);
      for (const tr of T.liste.filter(estTour)) await synchroTour(tr);
    }
    return true;
  }

  // ---------- Calendrier : un rendez-vous par tournage (sa date), qui cite ses reels ----------
  async function synchroTour(tr) {
    if (!tr) return;
    const evs = await BK.db.liste('evenements'), ev = evs.find(e => e.tourId === tr.id);
    if (!tr.date || !T.liste.some(x => x.id === tr.id)) { if (ev) await BK.db.supprimer('evenements', ev.id).catch(() => {}); }
    else { const rs = reelsDe(tr);
      await BK.db.ecrire('evenements', { ...(ev || {}), type: 'tournage', titre: (tr.titre || 'Tournage') + (rs.length ? ' · ' + rs.map(x => x.titre).join(', ') : ''), morceau: rs.length === 1 ? rs[0].morceau || '' : '', date: tr.date, heure: tr.heure || '', lieu: tr.lieu || '', tourId: tr.id }); }
    BK.agendaRecharger && BK.agendaRecharger();
  }
  const synchroJour = async () => {};                                   // (ancien nom, gardé pour les vieux appels)

  $('#toNouveau').onclick = async () => {
    const t = await BK.db.ecrire('tournages', { niveau: 'tournage', titre: 'Nouveau tournage', type: 'Reel', date: '', heure: '', lieu: '', idee: '', moodboard: [], plans: [], tenues: {}, materiel: '', notes: '' });
    T.neufs.add(t.id); T.liste.push(t); T.tour = t; T.courant = null; T.vue = 'tournage'; rendreListe(); rendreFiche(); const c = $('[data-tc="titre"]'); c && (c.focus(), c.select());
  };
  $('#toCal').onclick = async () => { const tr = T.vue === 'tournage' ? T.tour : null; if (!tr) return; if (!tr.date) return msg('Choisis d\'abord une date'); await synchroTour(tr); msg('Tournage dans le Calendrier ✓'); };

  // ---------- les médias : tenues (qui porte quoi), moodboard, assets — et leurs étiquettes, posées toutes seules ----------
  const meme = (a, b) => (a.id && a.id === b.id) || (a.u && a.u === b.u);
  async function etiqueter(x, cles) { const id = x.id || idDe(x.u); if (!id || /^audio:/.test(id)) return; for (const k of cles.filter(Boolean)) await BK.etiquettes.basculer(id, k, true).catch(() => {}); }
  const tagsDoc = d => { const m = (T.fiches || []).find(y => y.nom === d.morceau); return ['t:' + d.id, estTour(d) ? 'c:tournage' : '', m ? m.id : '']; };
  async function retirerDe(src, x) {
    if (src === 'vrac') { T.vrac = (T.vrac || []).filter(y => !meme(y, x)); await BK.partage.ecrire('tournage.vrac', T.vrac); }
    else if (src.startsWith('as:')) { const d = T.liste.find(y => y.id === src.slice(3)); if (d) { d.assets = (d.assets || []).filter(y => !meme(y, x)); await BK.db.ecrire('tournages', d); } }
  }
  // poser un média : sur une tenue (doc + membre), dans un moodboard, ou dans les assets d'un tournage
  async function poser(item, cible) {
    const { x, src } = item; if (!x || (!x.u && !x.id)) return;
    const u = x.u || (x.id && !/^audio:/.test(x.id) ? BK.img.ref(x.id) : ''); const d = T.liste.find(y => y.id === cible.doc); if (!d) return;
    if (cible.qui) {                                                  // une tenue : « c'est Pierre qui la porte » (une même photo peut aller à plusieurs)
      if (!u) return; d.tenuesPhotos = d.tenuesPhotos || {}; const l = d.tenuesPhotos[cible.qui] = d.tenuesPhotos[cible.qui] || [];
      if (!l.includes(u)) l.push(u); await BK.db.ecrire('tournages', d);
      await etiqueter({ ...x, u }, ['c:outfits', 'c:m-' + slug(cible.qui), ...tagsDoc(d)]);
      if (src === 'vrac' || src.startsWith('as:')) await retirerDe(src, x);
      msg(`Tenue de ${cible.qui}${estTour(d) ? ' (pour tous les reels)' : ' · ' + d.titre} ✓ étiquetée`); }
    else if (cible.mood) { if (!u || /^(audio|video)\//.test(x.mime || '')) return msg('Seules les images vont dans le moodboard');
      d.moodboard = d.moodboard || []; if (!d.moodboard.includes(u)) d.moodboard.push(u); await BK.db.ecrire('tournages', d);
      await etiqueter({ ...x, u }, ['c:moodboard', ...tagsDoc(d)]); if (src === 'vrac' || src.startsWith('as:')) await retirerDe(src, x); msg('Ajouté au moodboard de « ' + d.titre + ' »'); }
    else { if (src === 'as:' + d.id) return; d.assets = d.assets || []; if (!d.assets.some(y => meme(y, x))) d.assets.push(x); await BK.db.ecrire('tournages', d);
      await etiqueter(x, tagsDoc(d)); await retirerDe(src, x); msg('Rangé dans les Assets de « ' + d.titre + ' »'); }
    rendreFiche();
  }
  // ce que Médias connaît déjà (étiqueté pour ce tournage / ce reel) mais pas encore rangé : proposé en vert
  const fichiersTag = (...cles) => (T.fichiers || []).filter(f => { const l = BK.etiquettes.liste(T.tags || {}, f.id); return cles.every(k => l.includes(k)); });
  const propTenues = (d, qui) => fichiersTag('t:' + d.id, 'c:outfits', 'c:m-' + slug(qui)).filter(f => /^image\//.test(f.mimeType || '') && !((d.tenuesPhotos || {})[qui] || []).includes(BK.img.ref(f.id)) && !T.non.has(d.id + '|' + f.id));
  const propMood = d => fichiersTag('t:' + d.id, 'c:moodboard').filter(f => /^image\//.test(f.mimeType || '') && !(d.moodboard || []).includes(BK.img.ref(f.id)) && !T.non.has(d.id + '|' + f.id));
  const propAssets = d => { if (!estTour(d)) return []; const ids = new Set((d.assets || []).map(x => x.id || idDe(x.u)));
    const pris = new Set([...(d.moodboard || []), ...Object.values(d.tenuesPhotos || {}).flat()].map(idDe));
    return fichiersTag('t:' + d.id).filter(f => !ids.has(f.id) && !pris.has(f.id) && !T.non.has(d.id + '|' + f.id)).map(f => ({ id: f.id, mime: f.mimeType, nom: f.name })); };

  const vign = (x, src, prop) => { const audio = /^audio\//.test(x.mime || '') || x.audio, video = /^video\//.test(x.mime || '');
    const bg = audio ? '' : x.u ? BK.img.bg(x.u) : x.id ? BK.img.bg(BK.img.ref(x.id)) : '';
    return `<span class="to-med${prop ? ' mi-prop' : ''}${audio ? ' audio' : ''}" draggable="true" data-med="${esc(JSON.stringify(x))}" data-src="${esc(src)}"${bg} title="${esc(x.nom || '')}${prop ? ' · trouvé dans Médias : ✓ pour valider' : ' · glisse-le sur une tenue, un moodboard ou un tournage'}">${audio ? '♪' : video ? '<i class="to-med-v">▶</i>' : ''}
      ${prop ? `<button class="mi-val" data-pval="${esc(src)}" title="C'est bon">✓</button>` : ''}<button class="md-x" data-medx="${esc(src)}">✕</button></span>`; };
  const DOS = ['Tenues', 'Moodboard', 'Lumière / déco', 'Audio', 'Vidéo', 'Divers'];
  const dossierDe = x => { const tg = x.id ? BK.etiquettes.liste(T.tags || {}, x.id) : [];
    if (/^audio\//.test(x.mime || '') || x.audio) return 'Audio';
    if (tg.includes('c:outfits')) return 'Tenues';
    if (tg.includes('c:moodboard') || tg.includes('c:inspi')) return 'Moodboard';
    if (tg.includes('c:lumiere') || tg.includes('c:scenographie')) return 'Lumière / déco';
    if (/^video\//.test(x.mime || '')) return 'Vidéo';
    return 'Divers'; };
  // une zone « tenues » : une ligne par membre, on y glisse des photos
  const zoneTenues = (d, titre) => `<div class="box tt-tenues"><span class="lb">${titre}</span>
      ${T.membres.map(m => { const l = (d.tenuesPhotos || {})[m] || [], pr = propTenues(d, m);
        return `<div class="to-tenue2 tt-zone" data-tz="${d.id}|${esc(m)}"><span class="eng">${esc(m)}</span>
          <div class="to-tenue-ph">${l.map((u, i) => `<div class="to-tph" draggable="true" data-med="${esc(JSON.stringify({ u }))}" data-src="tenue"${BK.img.bg(u)}>${pastille((d.qui || {})[u])}<button class="md-x" data-ttx="${d.id}|${esc(m)}|${i}">✕</button></div>`).join('')}
            ${pr.map(f => `<div class="to-tph mi-prop"${BK.img.bg(BK.img.ref(f.id))} title="Étiqueté tenue de ${esc(m)} dans Médias : ✓ pour valider"><button class="mi-val" data-tpv="${d.id}|${esc(m)}|${f.id}">✓</button></div>`).join('')}
            <button class="to-tph to-tph-plus" data-tph2="${d.id}|${esc(m)}" title="Choisir dans Médias">＋<small>Photo</small></button></div>
          <input class="fld to-tenue-txt" data-tt="${d.id}|${esc(m)}" value="${esc((d.tenues || {})[m] || '')}" placeholder="en quelques mots (facultatif)"></div>`; }).join('')}</div>`;
  const zoneAssets = d => { const val = d.assets || [], pr = propAssets(d); if (!val.length && !pr.length) return '';
    const g = DOS.map(n => ({ n, v: val.filter(x => dossierDe(x) === n), p: pr.filter(x => dossierDe(x) === n) })).filter(x => x.v.length || x.p.length);
    const ouvert = BK.reglage('tournage.assetsOuverts', {})[d.id];
    if (!ouvert) return `<button class="to-assets ferme" data-asouv="${d.id}"><span class="eng">▸ Assets</span><b>${val.length + pr.length}</b><span class="nt">${g.map(x => esc(x.n) + ' ' + (x.v.length + x.p.length)).join(' · ')}</span>${pr.length ? `<span class="to-as-nb mi-txt">${pr.length} à valider</span>` : ''}</button>`;
    return `<div class="to-assets"><button class="to-as-tete" data-asouv="${d.id}"><span class="eng">▾ Assets</span><span class="nt">${val.length + pr.length} média(s) · glisse-les sur une tenue ou un moodboard</span></button><div class="to-as-rang">${g.map(x => `<div class="to-as-dos"><span class="to-as-t">${esc(x.n)} <small>${x.v.length + x.p.length}</small></span>
      <div class="to-meds">${x.v.map(y => vign(y, 'as:' + d.id)).join('')}${x.p.map(y => vign(y, 'prop:' + d.id, true)).join('')}</div></div>`).join('')}</div></div>`; };

  // ---------- la liste des tournages (les affiches) + les reels qui n'ont pas encore de tournage ----------
  async function rendreTournages() {
    const z = $('#toFiche'), auj = new Date().toISOString().slice(0, 10);
    const vr = await BK.partage.lire('tournage.vrac', []).catch(() => []); T.vrac = Array.isArray(vr) ? vr : [];
    const nonL = await BK.partage.lire('tournage.assetsNon', []).catch(() => []); T.non = new Set(Array.isArray(nonL) ? nonL : []);
    const affiche = tr => { const rs = reelsDe(tr), img = tr.couverture || '';
      return `<div class="to-affiche tt-aff${img ? '' : ' sans'}${(tr.date || '9') < auj ? ' passe' : ''}${tr.fini ? ' fini' : ''}" data-tour="${tr.id}"${BK.img.bg(img)} title="Clic : déplier / replier">
        <span class="to-af-voile"></span><span class="to-af-txt"><span class="eng">${esc(nomJ(tr))}${tr.fini ? ' · ✓ fait' : ''}</span><b class="dymo">${esc(tr.titre || 'Tournage')}</b>
          <span class="nt">${esc(jourFr(tr.date))}${tr.heure ? ' · ' + esc(tr.heure) : ''}${tr.lieu ? ' · ' + esc(tr.lieu) : ''}</span>
          ${rs.length ? `<span class="nt to-af-chiffres">${rs.length} reel(s) : ${esc(rs.map(x => x.titre).join(', ')).slice(0, 120)}</span>` : ''}</span>
        <button class="btn xs to-af-x" data-trx="${tr.id}" title="Retirer ce tournage (ses reels restent, le tournage va dans la corbeille du Drive)">🗑 Retirer</button><span class="to-af-pli">${T.vue === 'tournage' && T.tour && T.tour.id === tr.id ? '▾ Replier' : 'Ouvrir ▸'}</span></div>`; };
    const sans = T.liste.filter(x => !estTour(x) && !x.parent);
    const carteReel = x => `<div class="to-carte" draggable="true" data-tid="${x.id}"><span class="to-c-img"${BK.img.bg(imgDe(x))}>${imgDe(x) ? '' : '♪'}</span>
        <span class="to-c-txt"><span class="eng">${esc(x.type || 'Reel')}${x.morceau ? ' · ' + esc(x.morceau) : ''}</span><b>${esc(x.titre || 'Sans titre')}</b><span class="nt">${(x.plans || []).length} plan(s)</span></span>
        <span class="to-c-btns"><button class="btn xs" data-ouvre="${x.id}">Ouvrir</button><button class="btn xs" data-reelx="${x.id}" title="Retirer ce reel (corbeille du Drive)">🗑</button></span></div>`;
    z.innerHTML = `<div class="to-jours">
      ${T.vrac.length ? `<div class="to-vrac"><span class="eng">Médias à ranger</span><div class="to-meds">${T.vrac.map(x => vign(x, 'vrac')).join('')}</div></div>` : ''}
      <div class="ligne-titre"><span class="lb">Tournages</span><span class="nt" style="margin:0 0 0 10px">Un tournage = une journée. Glisse un reel sur un tournage pour l'y mettre.</span>
        <button class="btn sm pri" id="toNvTour" style="margin-left:auto">+ Nouveau tournage</button></div>
      ${tournagesL().length ? `<div class="to-grille">${tournagesL().map(affiche).join('')}</div>` : '<span class="nt">Pas encore de tournage.</span>'}
      <div class="to-jour sans" data-sans="1"><div class="to-jour-t"><span class="eng">Reels pas encore dans un tournage</span><span class="nt">${sans.length}</span></div>
        <div class="to-jour-l">${sans.map(carteReel).join('') || '<span class="nt to-jour-vide">Les reels validés (Miette propose) arrivent ici.</span>'}</div></div></div>`;
    $('#toNvTour').onclick = () => $('#toNouveau').click();
    $$('.tt-aff', z).forEach(a => a.onclick = e => { if (e.target.closest('[data-trx]')) return; ouvrirTour(a.dataset.tour); });
    $$('[data-trx]', z).forEach(b => b.onclick = async e => { e.stopPropagation(); const tr = T.liste.find(x => x.id === b.dataset.trx); if (!tr) return;
      if (!(await BK.confirmer(`Retirer le tournage « ${tr.titre || 'Tournage'} » ? Ses reels restent (dans « pas encore dans un tournage »). Le tournage va dans la corbeille du Drive.`))) return;
      for (const r of reelsDe(tr)) { r.parent = ''; await BK.db.ecrire('tournages', r); } await BK.db.supprimer('tournages', tr.id); T.liste = T.liste.filter(x => x.id !== tr.id); await synchroTour(tr).catch(() => {}); T.tour = null; msg('Tournage retiré'); charger(); });
    $$('[data-reelx]', z).forEach(b => b.onclick = async e => { e.stopPropagation(); const r = T.liste.find(x => x.id === b.dataset.reelx); if (!r) return;
      if (!(await BK.confirmer(`Retirer le reel « ${r.titre || 'ce reel'} » ? (rangé dans la corbeille du Drive)`))) return;
      await BK.db.supprimer('tournages', r.id); T.liste = T.liste.filter(x => x.id !== r.id); msg('Reel retiré'); charger(); });
    $$('[data-ouvre]', z).forEach(b => b.onclick = e => { e.stopPropagation(); T.courant = T.liste.find(x => x.id === b.dataset.ouvre); T.vue = 'fiche'; rendreListe(); rendreFiche(); });
    glisser(z);
    // le tournage ouvert se déplie juste sous sa rangée de cartes (toute la largeur) ; recliquer sa carte le replie
    if (T.tour && T.vue === 'tournage') {
      const carte = z.querySelector(`.tt-aff[data-tour="${CSS.escape(T.tour.id)}"]`), g = carte && carte.parentElement;
      if (carte) { carte.classList.add('on');
        const corps = document.createElement('div'); corps.className = 'to-deplie'; corps.id = 'toTourCorps';
        const placer = () => { const cartes = [...g.children].filter(x => x.classList.contains('tt-aff')), n = Math.max(1, getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length),
            i = cartes.indexOf(carte), fin = cartes[Math.min(cartes.length - 1, Math.floor(i / n) * n + n - 1)]; fin.after(corps); };
        placer(); await rendreTournage(corps);
        clearTimeout(T.tPlacer); new ResizeObserver(() => { clearTimeout(T.tPlacer); T.tPlacer = setTimeout(placer, 120); }).observe(g);
        if (T.defiler) { T.defiler = false; setTimeout(() => carte.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); } }
    }
  }
  // un clic sur un tournage : il se déplie ; un 2e clic : il se replie
  function ouvrirTour(id) { const deja = T.tour && T.tour.id === id && T.vue === 'tournage';
    T.tour = deja ? null : T.liste.find(x => x.id === id); T.courant = null; T.vue = deja ? 'jours' : 'tournage'; T.defiler = !deja; rendreListe(); rendreFiche(); }

  // ---------- un tournage ouvert : ses infos, ses tenues et son matériel (pour tous), ses assets, et ses reels qui se déplient ----------
  async function rendreTournage(z) {
    const tr = T.tour; if (!tr || !z) return;
    if (!T.non) { const nonL = await BK.partage.lire('tournage.assetsNon', []).catch(() => []); T.non = new Set(Array.isArray(nonL) ? nonL : []); }
    if (!T.vrac) { const vr = await BK.partage.lire('tournage.vrac', []).catch(() => []); T.vrac = Array.isArray(vr) ? vr : []; }
    const rs = reelsDe(tr), img = tr.couverture || '', ouvert = T.courant && T.courant.parent === tr.id ? T.courant.id : '';
    const etape = r => { const x = (T.reels || []).find(y => y.tournage === r.id); return x ? ETAPES_R[x.statut || 'idee'] : ''; };
    z.innerHTML = `
      <div class="to-fiche-barre"><button class="btn sm" id="toCouv" style="margin-left:auto" title="Une image en fond de l'en-tête (facultatif)">🖼 ${tr.couverture ? 'Changer la couverture' : 'Image de couverture'}</button>${tr.couverture ? '<button class="btn sm" id="toCouvX" title="Enlever l\'image de couverture">✕</button>' : ''}
        <button class="btn sm to-fini${tr.fini ? ' on' : ''}" id="toFiniT">${tr.fini ? '✓ Fait' : esc(nomJ(tr)) + ' fini'}</button></div>
      ${T.vrac.length ? `<div class="to-vrac"><span class="eng">Médias à ranger</span><div class="to-meds">${T.vrac.map(x => vign(x, 'vrac')).join('')}</div></div>` : ''}
      <div class="box"><span class="lb">Le tournage</span><div class="to-infos">
        <label class="large"><span class="eng">Nom</span><input class="fld" data-tc="titre" value="${esc(tr.titre)}"></label>
        <label><span class="eng">Type de journée</span><select class="fld" data-tc="journee">${JOURNEES.map(x => `<option${nomJ(tr) === x ? ' selected' : ''}>${x}</option>`).join('')}</select></label>
        <label><span class="eng">Date</span><input class="fld" type="date" data-tc="date" value="${esc(tr.date)}"></label>
        <label><span class="eng">Heure</span><input class="fld" type="time" data-tc="heure" value="${esc(tr.heure)}"></label>
        <label class="large"><span class="eng">Lieu</span><input class="fld" data-tc="lieu" value="${esc(tr.lieu)}" placeholder="ex. Studio BEESKOT"></label>
        <label class="large"><span class="eng">L'idée de la journée</span><input class="fld" data-tc="idee" value="${esc(tr.idee)}"></label></div></div>
      <div class="box tt-reels"><div class="ligne-titre"><span class="lb">Les reels de ce tournage</span><button class="btn xs" id="toNvReel" style="margin-left:auto">+ Ajouter un reel</button></div>
        ${rs.map(r => `<div class="tt-reel${r.id === ouvert ? ' ouvert' : ''}" data-rid="${r.id}">
          <div class="tt-reel-t to-carte" draggable="true" data-tid="${r.id}"><span class="to-c-img"${BK.img.bg(imgDe(r))}>${imgDe(r) ? '' : '♪'}</span>
            <span class="to-c-txt"><span class="eng">${esc(r.type || 'Reel')}${r.morceau ? ' · ' + esc(r.morceau) : ''}${etape(r) ? ' · reel : ' + esc(etape(r)) : ''}</span><b>${esc(r.titre || 'Sans titre')}</b>
              <span class="nt">${(r.plans || []).length} plan(s) · ${(r.moodboard || []).length} image(s) · ${Object.values(r.tenuesPhotos || {}).flat().length} tenue(s)</span></span>
            <span class="to-c-btns">${(T.reels || []).some(x => x.tournage === r.id) ? `<button class="btn xs" data-voir="${r.id}">Voir le reel</button>` : `<button class="btn xs" data-reel="${r.id}" title="Crée la carte dans l'onglet Reels">→ Reels</button>`}
              <button class="btn xs" data-sortir="${r.id}" title="Le sortir de ce tournage">↩</button><button class="btn xs tt-pli" data-plir="${r.id}">${r.id === ouvert ? '▾ Replier' : '▸ Déplier'}</button></span></div>
          ${r.id === ouvert ? '<div class="tt-reel-corps" id="toReelCorps"></div>' : ''}</div>`).join('') || '<span class="nt">Pas encore de reel : « + Ajouter un reel », ou glisse un reel sur ce tournage depuis la liste des tournages.</span>'}</div>
      ${zoneTenues(tr, 'Tenues · pour tous les reels du tournage')}
      ${zoneAssets(tr)}
      <div class="box"><span class="lb">Matériel et notes · tout le tournage</span>
        <textarea class="fld" data-tc="materiel" rows="3" placeholder="ex. 2 caméras, trépied, lampes Globe en rouge">${esc(tr.materiel)}</textarea>
        <textarea class="fld" data-tc="notes" rows="2" placeholder="Notes pour l'équipe…" style="margin-top:8px">${esc(tr.notes)}</textarea>
        <button class="btn xs" id="toSupprT" style="margin-top:8px;align-self:flex-start">Retirer ce tournage</button></div>`;
    $('#toPdf').disabled = $('#toVeo').disabled = false; $('#toCal').disabled = !tr.date;
    $('#toCouv').onclick = async () => { const l = await BK.choisirDansMedias({ titre: 'Image de couverture', bouton: 'Choisir', type: 'image' }); if (!l || !l.length) return;
      try { const d = await BK.img.depuisChoix(l[0], 'moodboard'); if (d.ref) { tr.couverture = d.ref; await BK.db.ecrire('tournages', tr); rendreFiche(); rendreListe(); } } catch (e) { msg('Image impossible'); } };
    const cx = $('#toCouvX'); if (cx) cx.onclick = async () => { delete tr.couverture; await BK.db.ecrire('tournages', tr); rendreFiche(); };
    $('#toFiniT').onclick = async () => { tr.fini = !tr.fini; await BK.db.ecrire('tournages', tr); for (const r of rs) if (!!r.fini !== tr.fini) await finir(r, true); msg(tr.fini ? nomJ(tr) + ' fini ✓' + (rs.length ? ' : ses reels passent à « Tourné »' : '') : nomJ(tr) + ' remis à faire'); rendreFiche(); };
    let dateAvant = tr.date;
    $$('[data-tc]', z).forEach(c => c.oninput = c.onchange = e => { tr[c.dataset.tc] = c.value; sauver(tr, c.dataset.tc === 'titre' || c.dataset.tc === 'date');
      if (e.type === 'change' && /titre|date|heure|lieu|journee/.test(c.dataset.tc)) setTimeout(() => synchroTour(tr), 900);
      if (e.type === 'change' && c.dataset.tc === 'journee') { rendreListe(); rendreFiche(); }
      if (e.type === 'change' && c.dataset.tc === 'date' && dateAvant !== tr.date) dateAvant = tr.date; });
    $('#toNvReel').onclick = async () => { const r = await BK.db.ecrire('tournages', { niveau: 'reel', parent: tr.id, ordre: rs.length, titre: 'Nouveau reel', type: 'Reel', morceau: '', idee: '', moodboard: [], plans: [], tenues: {}, materiel: '', notes: '' });
      T.neufs.add(r.id); T.liste.push(r); T.courant = r; await synchroTour(tr); rendreFiche(); const c = $('#toReelCorps [data-c="titre"]'); c && (c.focus(), c.select()); };
    $$('[data-plir]', z).forEach(b => b.onclick = e => { e.stopPropagation(); T.courant = T.courant && T.courant.id === b.dataset.plir ? null : T.liste.find(x => x.id === b.dataset.plir); rendreFiche(); });
    $$('.tt-reel-t', z).forEach(h => h.onclick = e => { if (e.target.closest('button')) return; h.querySelector('[data-plir]').click(); });
    $$('[data-sortir]', z).forEach(b => b.onclick = async e => { e.stopPropagation(); const r = T.liste.find(x => x.id === b.dataset.sortir); r.parent = ''; await BK.db.ecrire('tournages', r); if (T.courant === r) T.courant = null; await synchroTour(tr); msg('« ' + r.titre + ' » sorti du tournage'); rendreListe(); rendreFiche(); });
    $$('[data-reel]', z).forEach(b => b.onclick = async e => { e.stopPropagation(); await versReels(T.liste.find(x => x.id === b.dataset.reel)); rendreFiche(); });
    $$('[data-voir]', z).forEach(b => b.onclick = e => { e.stopPropagation(); const r = (T.reels || []).find(x => x.tournage === b.dataset.voir); r && BK.suiviOuvrir && BK.suiviOuvrir(r.id); });
    $('#toSupprT').onclick = async () => { if (!(await BK.confirmer(`Retirer le tournage « ${tr.titre} » ? Ses reels restent (dans « pas encore dans un tournage »).`))) return;
      for (const r of rs) { r.parent = ''; await BK.db.ecrire('tournages', r); } await BK.db.supprimer('tournages', tr.id); T.liste = T.liste.filter(x => x.id !== tr.id); await synchroTour(tr); T.tour = null; T.vue = 'jours'; msg('Tournage retiré'); charger(); };
    brancherMedias(z);
    glisser(z);
    if (ouvert) { const c = $('#toReelCorps'); c.innerHTML = corpsFiche(T.courant, true); T.zone = c; brancher(T.courant); T.zone = null; brancherMedias(c); glisser(c); modeLecture(c, T.courant); }
    modeLecture(z, tr, '#toReelCorps');
  }
  // les boutons des zones médias (tenues, assets, propositions vertes)
  function brancherMedias(z) {
    $$('[data-asouv]', z).forEach(b => b.onclick = () => { const o = BK.reglage('tournage.assetsOuverts', {}); o[b.dataset.asouv] = !o[b.dataset.asouv]; BK.regler('tournage.assetsOuverts', o); rendreFiche(); });
    $$('[data-tt]', z).forEach(c => c.oninput = () => { const [id, m] = c.dataset.tt.split('|'), d = T.liste.find(x => x.id === id); (d.tenues = d.tenues || {})[m] = c.value; sauver(d); });
    $$('[data-ttx]', z).forEach(b => b.onclick = async e => { e.stopPropagation(); if (!await BK.confirmer('Retirer cette photo de la tenue ? (elle reste dans le Drive)')) return; const [id, m, i] = b.dataset.ttx.split('|'), d = T.liste.find(x => x.id === id); d.tenuesPhotos[m].splice(+i, 1); await BK.db.ecrire('tournages', d); rendreFiche(); });
    $$('[data-tpv]', z).forEach(b => b.onclick = async e => { e.stopPropagation(); const [id, m, f] = b.dataset.tpv.split('|'); await poser({ x: { id: f }, src: 'prop' }, { doc: id, qui: m }); });
    $$('[data-tph2]', z).forEach(b => b.onclick = async () => { if (!BK.drive.relie()) return msg('Relie d\'abord le Drive'); const [id, m] = b.dataset.tph2.split('|');
      const l = await BK.choisirDansMedias({ titre: 'Tenue de ' + m, bouton: 'Ajouter', type: 'image', sujet: 'c:outfits' }); if (!l || !l.length) return;
      for (const x of l) { try { const d = await BK.img.depuisChoix(x, 'outfits'); await poser({ x: { u: d.ref, id: d.id || '' }, src: 'choix' }, { doc: id, qui: m }); } catch (er) { console.warn(er); } } });
    $$('[data-medx]', z).forEach(b => b.onclick = async e => { e.stopPropagation(); const x = JSON.parse(b.closest('[data-med]').dataset.med), src = b.dataset.medx;
      if (src.startsWith('prop:')) { T.non.add(src.slice(5) + '|' + x.id); await BK.partage.ecrire('tournage.assetsNon', [...T.non]); } else await retirerDe(src, x); rendreFiche(); });
    $$('[data-pval]', z).forEach(b => b.onclick = async e => { e.stopPropagation(); const x = JSON.parse(b.closest('[data-med]').dataset.med), d = T.liste.find(y => y.id === b.dataset.pval.slice(5));
      d.assets = d.assets || []; d.assets.push(x); await BK.db.ecrire('tournages', d); msg('Asset validé'); rendreFiche(); });
  }
  // ---------- glisser-déposer : reels sur un tournage, médias sur une tenue / un moodboard / un tournage ----------
  function glisser(z) {
    $$('[draggable="true"]', z).forEach(el => el.addEventListener('dragstart', e => { e.stopPropagation();
      if (el.dataset.tid && !el.dataset.med) { e.dataTransfer.setData('text/bk-tournage', el.dataset.tid); }
      else if (el.dataset.med) e.dataTransfer.setData('text/bk-tmedia', JSON.stringify({ x: JSON.parse(el.dataset.med), src: el.dataset.src }));
      e.dataTransfer.effectAllowed = 'copyMove'; el.classList.add('glisse'); }));
    $$('[draggable="true"]', z).forEach(el => el.addEventListener('dragend', () => el.classList.remove('glisse')));
    // (en « capture » : même lâché sur un champ texte de la zone, c'est la zone qui reçoit)
    const cible = (el, test, faire) => { el.addEventListener('dragover', e => { if (test([...e.dataTransfer.types])) { e.preventDefault(); e.stopPropagation(); el.classList.add('survol'); } }, true);
      el.addEventListener('dragleave', e => { if (!el.contains(e.relatedTarget)) el.classList.remove('survol'); });
      el.addEventListener('drop', e => { if (!test([...e.dataTransfer.types]) || e._pris) return; e._pris = true; e.preventDefault(); e.stopPropagation(); el.classList.remove('survol'); faire(e.dataTransfer); }, true); };
    const med = t => t.includes('text/bk-tmedia') || t.includes('text/bk-media'), tour = t => t.includes('text/bk-tournage');
    // ce qu'on lâche : un média de cette page, ou un ou plusieurs médias venus de l'onglet Médias
    const lus = dt => { const j = dt.getData('text/bk-tmedia'); if (j) return [JSON.parse(j)];
      return BK.glisse.items.map(x => ({ x: x.dc ? { u: '', id: '', nom: x.nom, mime: x.mime, dc: x.dc } : { u: BK.img.ref(x.id), id: x.id, mime: x.mime, nom: x.nom }, src: 'medias' })).filter(y => y.x.u); };
    const poserTous = async (dt, cible) => { const l = lus(dt); if (!l.length) return msg('Range d\'abord ce média de Discord dans le Drive (Médias)'); for (const it of l) await poser(it, cible); };
    $$('.tt-aff', z).forEach(a => cible(a, t => tour(t) || med(t), async dt => { const id = dt.getData('text/bk-tournage');
      if (id) { const r = T.liste.find(x => x.id === id), tr = T.liste.find(x => x.id === a.dataset.tour), avant = T.liste.find(x => x.id === r.parent);
        r.parent = tr.id; r.ordre = reelsDe(tr).length; await BK.db.ecrire('tournages', r); await synchroTour(tr); if (avant) await synchroTour(avant); msg(`« ${r.titre} » → ${tr.titre}`); rendreListe(); rendreFiche(); }
      else poserTous(dt, { doc: a.dataset.tour }); }));
    $$('[data-sans]', z).forEach(s => cible(s, tour, async dt => { const r = T.liste.find(x => x.id === dt.getData('text/bk-tournage')); if (!r || !r.parent) return; const avant = T.liste.find(x => x.id === r.parent);
      r.parent = ''; await BK.db.ecrire('tournages', r); if (avant) await synchroTour(avant); rendreFiche(); }));
    $$('[data-tz]', z).forEach(el => cible(el, med, dt => { const [doc, qui] = el.dataset.tz.split('|'); poserTous(dt, { doc, qui }); }));
    $$('.tt-reel-t', z).forEach(h => cible(h, med, dt => poserTous(dt, { doc: h.dataset.tid, mood: true })));
    $$('#toMood', z).forEach(m => cible(m, med, dt => poserTous(dt, { doc: (T.courant || {}).id, mood: true })));
  }
  async function versReels(t) {
    const rs = await BK.db.liste('reels'), deja = rs.find(r => r.tournage === t.id);
    if (deja) { msg('Déjà dans les Reels'); return; }
    const m = (T.fiches || []).find(x => x.nom === t.morceau);
    T.reels.push(await BK.db.ecrire('reels', { titre: t.titre || 'Reel', morceau: m ? m.id : '', tournage: t.id, statut: t.fini ? 'tourne' : 'idee', notes: t.idee || '', sortie: '' }));
    BK.suiviRecharger && BK.suiviRecharger(); msg(`« ${t.titre} » envoyé dans les Reels ✓`);
  }
  // ---------- le pont avec les Reels ----------
  const ETAPES_R = { idee: 'Idée', audio: 'Audio prêt', tourne: 'Tourné', monte: 'Monté', publie: 'Publié' };
  const etapeReel = t => { const r = (T.reels || []).find(x => x.tournage === t.id); return r ? ETAPES_R[r.statut || 'idee'] || 'Idée' : ''; };
  async function finir(t, silencieux) {
    if (!t) return; t.fini = estTour(T.tour) && silencieux ? T.tour.fini : !t.fini; await BK.db.ecrire('tournages', t);
    const ordre = Object.keys(ETAPES_R);
    for (const r of (T.reels || []).filter(x => x.tournage === t.id)) if (t.fini && ordre.indexOf(r.statut || 'idee') < ordre.indexOf('tourne')) { r.statut = 'tourne'; await BK.db.ecrire('reels', r); }
    BK.suiviRecharger && BK.suiviRecharger(); if (silencieux) return;
    msg(t.fini ? `« ${t.titre} » : tourné ✓ (le reel passe à « Tourné »)` : 'Remis à faire'); rendreListe(); rendreFiche();
  }
  async function versReelLie(t) {
    const m = (T.fiches || []).find(x => x.nom === t.morceau);
    for (const r of (T.reels || []).filter(x => x.tournage === t.id)) {
      const ch = { titre: t.titre || r.titre, morceau: m ? m.id : r.morceau, notes: t.idee || r.notes || '' };
      if (ch.titre !== r.titre || ch.morceau !== r.morceau || ch.notes !== (r.notes || '')) { Object.assign(r, ch); await BK.db.ecrire('reels', r); }
    }
    BK.suiviRecharger && BK.suiviRecharger();
  }
  const rendreJours = () => rendreTournages();

  // ---------- Imprimer / PDF ----------
  // ---------- Imprimer / PDF : un reel seul, ou un tournage entier (la journée, puis chacun de ses reels) ----------
  const tenuesHtml = t => { t.tenues = t.tenues || {};
    return Object.values(t.tenues).some(Boolean) || Object.values(t.tenuesPhotos || {}).some(l => l && l.length) ? `<table>${T.membres.filter(m => t.tenues[m] || ((t.tenuesPhotos || {})[m] || []).length).map(m => `<tr><td class="imp-nom">${esc(m)}</td><td>${((t.tenuesPhotos || {})[m] || []).map(u => `<img${BK.img.src(u)} style="height:110px;margin:0 6px 6px 0;border-radius:4px">`).join('')}${t.tenues[m] ? '<br>' + esc(t.tenues[m]) : ''}</td></tr>`).join('')}</table>` : ''; };
  const corpsPdf = (t, h) => { const H = h || 'h2', ten = tenuesHtml(t); t.moodboard = t.moodboard || []; t.plans = t.plans || [];
    return `${t.moodboard.length ? `<${H}>Moodboard</${H}><div class="imp-mood">${t.moodboard.map((u, i) => `<figure class="imp-f"><img${BK.img.src(u)}><figcaption>Image ${i + 1}</figcaption></figure>`).join('')}</div>` : ''}
      ${t.plans.length ? `<${H}>Découpage</${H}><table><tr><th>#</th><th>Cadrage</th><th>Ce qu'on voit</th><th>Durée</th><th>Notes</th><th>Images</th></tr>${t.plans.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.cadrage)}</td><td>${esc(p.action)}</td><td>${esc(p.duree)}</td><td>${esc([p.audio && '♪ ' + p.audio, p.notes].filter(Boolean).join(' · '))}</td><td>${(p.imgs || []).map(u => `<img class="imp-vig"${BK.img.src(u)}>`).join('')}</td></tr>`).join('')}</table>` : ''}
      ${ten ? `<${H}>Tenues</${H}>${ten}` : ''}
      ${t.materiel ? `<${H}>Matériel</${H}><p class="imp-txt">${esc(t.materiel)}</p>` : ''}
      ${t.notes ? `<${H}>Notes</${H}><p class="imp-txt">${esc(t.notes)}</p>` : ''}`; };
  const imprimerAncien = () => {
    const tour = T.vue === 'tournage' && T.tour, t = tour || T.courant; if (!t) return;
    const vieux = $('#impression'); vieux && vieux.remove();
    const d = document.createElement('div'); d.id = 'impression';
    const tete = `<div class="imp-tete"><div><h1>${esc(t.titre || 'Tournage')}</h1><p>${esc(tour ? nomJ(t) : t.type || '')}${t.morceau ? ' · ' + esc(t.morceau) : ''}</p></div><div class="imp-logo">BEESKOT</div></div>
      <div class="imp-infos"><p><b>Quand</b> ${esc(dateFr(t.date)) || 'à fixer'}${t.heure ? ' à ' + esc(t.heure) : ''}</p><p><b>Où</b> ${esc(t.lieu || '—')}</p>${t.idee ? `<p><b>L'idée</b> ${esc(t.idee)}</p>` : ''}</div>`;
    if (tour) { const rs = reelsDe(tour);
      d.innerHTML = tete + (rs.length ? `<h2>Au programme</h2><ol class="imp-txt">${rs.map(r => `<li>${esc(r.titre || 'Reel')}${r.morceau ? ' · ' + esc(r.morceau) : ''}</li>`).join('')}</ol>` : '')
        + corpsPdf(tour)
        + rs.map((r, i) => `<div class="imp-reel"><h2>${/^reel\b/i.test(r.titre || '') ? esc(r.titre) : 'Reel ' + (i + 1) + ' · ' + esc(r.titre || 'Sans titre')}</h2><p class="imp-txt">${[r.morceau && '♪ ' + esc(r.morceau), r.lieu && '📍 ' + esc(r.lieu), r.idee && '« ' + esc(r.idee) + ' »'].filter(Boolean).join(' · ')}</p>${corpsPdf(r, 'h3')}</div>`).join(''); }
    else d.innerHTML = tete + corpsPdf(t);
    document.body.appendChild(d); document.body.classList.add('imprime');
    const fin = () => { document.body.classList.remove('imprime'); d.remove(); window.removeEventListener('afterprint', fin); };
    window.addEventListener('afterprint', fin);
    BK.img.toutes(d).then(() => setTimeout(() => window.print(), 200));          // les images du Drive d'abord
    msg((tour ? 'Tournage entier · ' : '') + 'Choisis ton imprimante (ou « Enregistrer au format PDF »)');
  };
  // le vrai PDF : fabriqué par le logiciel, rangé dans Documents\BEESKOT Studio\Tournages PDF et dans le Drive, puis ouvert
  // 🎬 les prompts Veo 3 (js/veo.js) : du reel ouvert, ou de tous les reels du tournage
  $('#toVeo').onclick = () => { const tour = T.vue === 'tournage' && T.tour;
    const reels = tour ? (T.courant && T.courant.parent === tour.id ? [T.courant, ...reelsDe(tour).filter(r => r.id !== T.courant.id)] : reelsDe(tour)) : [T.courant];
    if (!reels.filter(Boolean).length) return msg('Ajoute d\'abord un reel à ce tournage');
    BK.veo.ouvrir({ tour: tour || T.liste.find(x => T.courant && x.id === T.courant.parent) || null, reels, membres: T.membres, garder: r => BK.db.ecrire('tournages', r) }); };
  // ---------- 📄 PDF / Imprimer : une fenêtre à nous (aperçu du vrai PDF, couleur ou noir et blanc, enregistrer, ouvrir, imprimer) ----------
  $('#toPdf').onclick = () => fenetrePdf();
  function fenetrePdf() {
    const tour = T.vue === 'tournage' && T.tour, t0 = tour || T.courant; if (!t0) return;
    const t = tour ? { ...t0, type: nomJ(t0) } : t0, faits = {}; let mode = BK.reglage('tournage.pdfMode', 'couleur');
    const v = document.createElement('div'); v.className = 'voile';
    v.innerHTML = `<div class="stopbox pdf-box"><span class="screw tl"></span><span class="screw tr"></span><span class="screw bl"></span><span class="screw br"></span>
      <span class="dymo" style="align-self:center">📄 PDF · ${esc(t0.titre || 'Tournage')}</span>
      <div class="pdf-barre"><div class="seg" id="pdfMode"><button data-m="couleur">🎨 Couleur</button><button data-m="nb">⚫ Noir et blanc</button></div>
        <span class="vfd" id="pdfEtat">…</span></div>
      <div class="pdf-zone"><div class="pdf-pages" id="pdfVue"></div><div class="pdf-attente" id="pdfAttente"><span class="spin"></span> Fabrication du PDF…</div></div>
      <div class="stopbox-btns pdf-btns"><button class="btn pri" id="pdfSave" title="Dans Documents › BEESKOT Studio › Tournages PDF et dans le Drive (dossier « Tournages PDF »)">💾 Enregistrer</button>
        <button class="btn" id="pdfOuvrir" title="Ouvre le PDF dans ton lecteur PDF (Acrobat, Edge…)">📂 Ouvrir dans le lecteur PDF</button>
        <button class="btn" id="pdfImp">🖨 Imprimer</button><button class="btn" id="pdfFermer">Fermer</button></div></div>`;
    document.body.appendChild(v);
    const q = s2 => v.querySelector(s2), etat = x => { q('#pdfEtat').textContent = String(x).toUpperCase(); };
    const fabriquer = async m => { if (!faits[m]) faits[m] = BK.pdfTournage({ t, reels: tour ? reelsDe(tour) : [], membres: T.membres, dateFr, mode: m }).then(r => ({ ...r, url: URL.createObjectURL(new Blob([r.bytes], { type: 'application/pdf' })) })); return faits[m]; };
    const montrer = async () => { $$('#pdfMode button', v).forEach(b => b.classList.toggle('on', b.dataset.m === mode)); q('#pdfAttente').hidden = false; etat('Fabrication…');
      try { const r = await fabriquer(mode); await BK.pdfApercu(r.bytes, q('#pdfVue'), Math.min(820, q('#pdfVue').clientWidth - 40)); etat(`${r.pages} page(s) · ${mode === 'nb' ? 'noir et blanc' : 'couleur'}`); }
      catch (e) { console.error(e); etat('PDF impossible : ' + (e.message || e)); }
      q('#pdfAttente').hidden = true; };
    // enregistrer : Documents + Drive ; renvoie le chemin sur ce PC (pour l'ouvrir)
    const enregistrer = async () => { const r = await fabriquer(mode), blob = new Blob([r.bytes], { type: 'application/pdf' }), ou = []; let ch = '';
      if (BK.estExe) { try { const dos = BK.chemin(await BK.T.path.documentDir(), 'BEESKOT Studio', 'Tournages PDF'); await BK.fichier.creerDossier(dos); ch = BK.chemin(dos, r.nom); await BK.fichier.ecrireOctets(ch, r.bytes); ou.push('Documents › BEESKOT Studio › Tournages PDF'); } catch (e) { console.warn(e); ch = ''; } }
      else { const a = document.createElement('a'); a.href = r.url; a.download = r.nom; document.body.appendChild(a); a.click(); a.remove(); ou.push('téléchargé'); }
      if (BK.drive.relie() && !r.envoye) { try { const dos = await BK.drive.dossier('Tournages PDF', await BK.drive.racine()); await BK.drive.envoyerBlob(new File([blob], r.nom, { type: 'application/pdf' }), r.nom, dos); r.envoye = true; ou.push('Drive › Tournages PDF'); } catch (e) { console.warn(e); } }
      return { ch, ou }; };
    q('#pdfMode').onclick = e => { const b = e.target.closest('[data-m]'); if (!b || b.dataset.m === mode) return; mode = b.dataset.m; BK.regler('tournage.pdfMode', mode); montrer(); };
    q('#pdfSave').onclick = async () => { const b = q('#pdfSave'); b.disabled = true; etat('Enregistrement…'); const { ou } = await enregistrer(); etat(ou.length ? 'Enregistré ✓' : 'Pas enregistré'); msg(ou.length ? 'PDF : ' + ou.join(' + ') : 'PDF pas enregistré (Drive ou dossier injoignable)'); b.disabled = false; };
    q('#pdfOuvrir').onclick = async () => { etat('Ouverture…'); const { ch } = await enregistrer(); if (ch) { try { await BK.T.opener.openPath(ch); etat('Ouvert ✓'); } catch (e) { etat('Ouverture impossible'); } } else { const r = await fabriquer(mode); window.open(r.url, '_blank'); } };
    q('#pdfImp').onclick = async () => { etat('Préparation de l\'impression…'); try { await BK.pdfImprimer((await fabriquer(mode)).bytes); etat('Impression'); } catch (e) { etat('Impression impossible : ouvre le PDF'); } };
    q('#pdfFermer').onclick = () => { Object.values(faits).forEach(p => p.then(r => URL.revokeObjectURL(r.url)).catch(() => {})); v.remove(); };
    montrer();
  }

  BK.surOuvrir = BK.surOuvrir || {}; BK.surOuvrir.tournage = charger;
  charger();
});
})();
