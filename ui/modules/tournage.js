// =====================================================================
// TOURNAGES — une fiche par tournage : infos, moodboard, découpage,
// tenues, matériel. Une fiche = un petit fichier dans le Drive (partagé).
// « Imprimer / PDF » sort une feuille propre à donner à l'équipe.
// =====================================================================
(() => {
const T = { liste: [], courant: null, membres: ['Yacine', 'Pierre', 'Baptiste'], morceaux: [] };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TYPES = ['Clip', 'Reel', 'Shooting photo', 'Live', 'Autre'];
const CADRAGES = ['Plan large', 'Plan moyen', 'Plan américain', 'Gros plan', 'Très gros plan', 'Plan d\'ensemble', 'Insert', 'Plongée', 'Contre-plongée', 'Travelling'];
const dateFr = d => d ? new Date(d + 'T12:00').toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';

const iconeLien = u => /instagram\./i.test(u) ? '📸' : /tiktok\./i.test(u) ? '🎵' : /youtu\.?be/i.test(u) ? '▶' : /pinterest\./i.test(u) ? '📌' : '🔗';
const nomLien = u => { try { const x = new URL(u); return x.hostname.replace(/^www\./, '') + (x.pathname.length > 1 ? x.pathname.slice(0, 28) : ''); } catch (e) { return u.slice(0, 40); } };

BK.module('tournage', function (page) {
  $('.sub', page).textContent = 'Moodboard, découpage, tenues : une fiche à imprimer pour chaque tournage';
  $('.hdr .right', page).innerHTML = `<div><span class="eng" style="font-size:9px">Prochain</span><span class="vfd" id="toProchain" style="width:220px">—</span></div>`;
  $('.grid', page).innerHTML = `
    <div class="cols">
      <section class="pane vit to-vit"><div class="to-fiche" id="toFiche"></div></section>
      <section class="pane reg" style="width:270px"><span class="ptitle">② Tournages</span>
        <button class="btn pri" id="toNouveau" style="width:100%;justify-content:center">+ Nouveau tournage</button>
        <button class="btn" id="toPlanXl" style="width:100%;justify-content:center;margin-top:8px">📋 PLAN.xlsx du Drive</button>
        <div class="chips" style="margin-top:8px"><button class="chip" data-md="tournage">Dossier Tournages</button><button class="chip" data-md="outfits">Outfits</button><button class="chip" data-md="moodboard">Moodboards</button></div>
        <div id="toMiette"></div>
        <div class="box grow" style="margin-top:10px"><div class="to-liste" id="toListe"></div></div>
      </section>
    </div>
    <div class="pane abar"><span class="vfd" id="toMsg">PRÊT</span>
      <div class="right"><button class="btn" id="toCal" disabled>📅 Mettre au Calendrier</button><button class="btn pri" id="toPdf" disabled>🖨 Imprimer / PDF</button></div></div>`;
  const msg = t => $('#toMsg').textContent = String(t).toUpperCase();

  window.addEventListener('bk:annule', () => charger());   // après « ↶ Annuler » : on relit
  async function charger() {
    T.liste = (await BK.db.liste('tournages')).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const cfg = (await BK.db.liste('config')).find(c => c.id === 'membres'); if (cfg && cfg.liste && cfg.liste.length) T.membres = cfg.liste.map(m => m === 'Dari' ? 'Yacine' : m);
    T.fiches = (await BK.db.liste('morceaux')).sort((a, b) => a.nom.localeCompare(b.nom));
    T.morceaux = T.fiches.map(m => m.nom);
    if (T.courant) T.courant = T.liste.find(x => x.id === T.courant.id) || null;
    if (!T.courant) T.courant = T.liste.find(x => (x.date || '') >= new Date().toISOString().slice(0, 10)) || T.liste[0] || null;
    rendreListe(); rendreFiche(); proposes();
  }
  BK.tournagesRecharger = charger;
  BK.tournageOuvrir = async id => { BK.ouvrir('tournage'); await charger(); const t = T.liste.find(x => x.id === id); if (t) { T.courant = t; rendreListe(); rendreFiche(); } };
  // 🍞 les tournages dont on parle sur Discord (le bouton jaune) : un clic crée la fiche déjà remplie
  async function proposes() {
    const l = (await BK.db.liste('propositions')).filter(p => p.type === 'tournage' && p.statut === 'attente'), z = $('#toMiette');
    z.innerHTML = l.length ? `<div class="box" style="margin-top:10px"><span class="lb">🍞 Miette propose</span>${l.map(p => `<div class="ta-prop" style="margin-top:6px"><div class="carte-c"><span class="carte-t">${esc(p.titre)}</span>
        <span class="carte-m">${esc([p.morceau, p.date, p.lieu].filter(Boolean).join(' · '))}${p.pourquoi ? ' — « ' + esc(p.pourquoi) + ' »' : ''}</span></div>
        <button class="btn xs pri" data-tok="${p.id}" title="Créer la fiche">✓</button><button class="btn xs" data-tnon="${p.id}">✕</button></div>`).join('')}</div>` : '';
    $$('[data-tok]', z).forEach(b => b.onclick = async () => { const p = l.find(x => x.id === b.dataset.tok);
      const t = await BK.db.ecrire('tournages', { titre: p.titre, type: p.type === 'tournage' ? (p.typeT || 'Clip') : 'Clip', morceau: T.morceaux.includes(p.morceau) ? p.morceau : '', date: p.date || '', heure: p.heure || '', lieu: p.lieu || '',
        idee: p.idee || '', moodboard: [], plans: [], tenues: {}, materiel: p.materiel || '', notes: [p.tenues && 'Tenues : ' + p.tenues, p.pourquoi && 'Discord : « ' + p.pourquoi + ' »'].filter(Boolean).join('\n'), discord: p.source || '' });
      p.statut = 'ok'; await BK.db.ecrire('propositions', p); T.courant = t; msg('Fiche créée'); await charger();
      if (BK.drive.relie()) { msg('Miette cherche le moodboard dans le Drive…'); try { await BK.miette.moodboards(); } catch (e) {} await charger(); msg('Fiche prête'); } });
    $$('[data-tnon]', z).forEach(b => b.onclick = async () => { const p = l.find(x => x.id === b.dataset.tnon); p.statut = 'non'; await BK.db.ecrire('propositions', p); proposes(); });
  }

  function rendreListe() {
    const auj = new Date().toISOString().slice(0, 10), proch = T.liste.filter(x => (x.date || '') >= auj).sort((a, b) => a.date.localeCompare(b.date))[0];
    $('#toProchain').textContent = proch ? `${new Date(proch.date + 'T12:00').toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' }).toUpperCase()} · ${(proch.titre || '').toUpperCase()}` : '—';
    $('#toListe').innerHTML = T.liste.length ? T.liste.map(x => `<button class="to-item${T.courant && T.courant.id === x.id ? ' on' : ''}${(x.date || '') < auj ? ' passe' : ''}" data-id="${x.id}">
        <b>${esc(x.titre || 'Sans titre')}</b><span class="nt">${x.date ? new Date(x.date + 'T12:00').toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' }) : 'date à fixer'}${x.morceau ? ' · ' + esc(x.morceau) : ''}</span></button>`).join('')
      : '<span class="nt">Aucun tournage. Clique sur « + Nouveau tournage ».</span>';
    $$('.to-item').forEach(b => b.onclick = () => { T.courant = T.liste.find(x => x.id === b.dataset.id); rendreListe(); rendreFiche(); });
  }

  // ---------- la fiche ----------
  function rendreFiche() {
    const t = T.courant, z = $('#toFiche');
    $('#toPdf').disabled = $('#toCal').disabled = !t;
    if (!t) { z.innerHTML = '<div class="to-vide"><span class="dymo">Aucun tournage</span><span class="nt">Crée une fiche avec « + Nouveau tournage » à droite.</span></div>'; return; }
    t.plans = t.plans || []; t.tenues = t.tenues || {}; t.moodboard = t.moodboard || [];
    // ---------- l'affiche du projet : l'image du morceau, le titre, la date ----------
    const m = (T.fiches || []).find(x => x.nom === t.morceau);
    const img = (m && m.photo) || (t.moodboard || [])[0] || '';
    const ouvert = (BK.reglage('tournage.ouvert', {}))[t.id] ?? true;
    const quand = t.date ? new Date(t.date + 'T12:00').toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' }) : 'date à fixer';
    z.innerHTML = `
      <button class="to-affiche${img ? '' : ' sans'}${ouvert ? ' ouverte' : ''}" id="toAffiche"${BK.img.bg(img)}>
        <span class="to-af-voile"></span>
        <span class="to-af-txt">
          <span class="eng">${esc(t.type || 'Tournage')}${t.morceau ? ' · projet ' + esc(t.morceau) : ''}</span>
          <b class="dymo">${esc(t.titre || 'Sans titre')}</b>
          <span class="nt">${esc(quand)}${t.heure ? ' · ' + esc(t.heure) : ''}${t.lieu ? ' · ' + esc(t.lieu) : ''}</span>
          <span class="nt to-af-chiffres">🖼 ${(t.moodboard || []).length} · 🎬 ${(t.plans || []).length} plan(s)${Object.values(t.tenues || {}).filter(Boolean).length ? ' · 👕 tenues notées' : ''}</span>
        </span>
        <span class="to-af-pli">${ouvert ? '▾ Replier' : '▸ Tout voir'}</span></button>
      <div class="to-corps${ouvert ? '' : ' replie'}" id="toCorps">
      <div class="box"><span class="lb">Infos</span>
        <div class="to-infos">
          <label class="large"><span class="eng">Titre</span><input class="fld" data-c="titre" value="${esc(t.titre)}" placeholder="ex. Clip Mother – scène du salon"></label>
          <label><span class="eng">Type</span><select class="fld" data-c="type">${TYPES.map(x => `<option${t.type === x ? ' selected' : ''}>${x}</option>`).join('')}</select></label>
          <label><span class="eng">Morceau</span><select class="fld" data-c="morceau"><option value="">—</option>${T.morceaux.map(m => `<option${t.morceau === m ? ' selected' : ''}>${esc(m)}</option>`).join('')}</select></label>
          <label><span class="eng">Date</span><input class="fld" type="date" data-c="date" value="${esc(t.date)}"></label>
          <label><span class="eng">Heure</span><input class="fld" type="time" data-c="heure" value="${esc(t.heure)}"></label>
          <label class="large"><span class="eng">Lieu</span><input class="fld" data-c="lieu" value="${esc(t.lieu)}" placeholder="ex. Studio BEESKOT"></label>
          <label class="large"><span class="eng">L'idée en une phrase</span><input class="fld" data-c="idee" value="${esc(t.idee)}" placeholder="ex. ambiance VHS, lumière rouge, plans serrés sur les mains"></label>
        </div></div>
      <div class="box"><div class="ligne-titre"><span class="lb">Moodboard</span><button class="btn xs miette-aide" id="toMoodMiette" style="margin-left:auto" title="Miette cherche les images de moodboard de ce tournage dans le Drive et sur Discord">Miette trouve les moodboards</button></div>
        <div class="to-mood" id="toMood">${t.moodboard.map((u, i) => `<div class="to-img"${BK.img.bg(u)}><button class="md-x" data-mx="${i}">✕</button></div>`).join('')}
          <button class="to-img to-plus to-plus-tag" id="toMoodTag" title="Depuis Médias (dossiers, Discord, étiquettes)">＋<small>Ajouter des images</small></button><button class="to-img to-plus" id="toMoodPlus" title="Images de ce PC">💻<small>Ce PC</small></button></div>
        ${(t.moodboardDocs || []).length ? `<div class="to-docs">${t.moodboardDocs.map((d, i) => `<span class="to-doc"><a href="#" data-url="${esc(d.url)}">📄 ${esc(d.nom)}</a><button class="md-x" data-dx="${i}">✕</button></span>`).join('')}</div>` : ''}
        ${t.moodboardAuto ? '<span class="nt">🍞 Rempli par Miette depuis le dossier moodboard du Drive.</span>' : ''}
        <input type="file" id="toMoodIn" accept="image/*" multiple hidden>
        <div class="to-refs"><div class="ligne-titre"><span class="lb">Références</span><span class="nt" style="margin:0 0 0 auto">Des liens : Instagram, TikTok, YouTube, Pinterest…</span><button class="btn xs miette-aide" id="toRefMiette" title="Miette cherche les liens donnés sur Discord pour ce tournage">Miette trouve les références</button></div>
          <div class="to-refs-l">${(t.references || []).map((r, i) => `<span class="to-ref"><a href="#" data-url="${esc(r.url)}" title="${esc(r.url)}">${esc(iconeLien(r.url))} ${esc(r.note || nomLien(r.url))}</a><button class="md-x" data-rx="${i}">✕</button></span>`).join('')}</div>
          <div class="to-refs-add"><input class="fld" id="toRefUrl" placeholder="Colle un lien (https://…)"><input class="fld" id="toRefNote" placeholder="En un mot : pourquoi (facultatif)"><button class="btn sm" id="toRefAdd">+ Ajouter</button></div></div></div>
      <div class="box"><div class="ligne-titre"><span class="lb">Découpage</span>
          <button class="btn xs miette-aide" id="toRenfort" style="margin-left:auto">Miette propose un découpage</button></div>
        <table class="to-plans"><thead><tr><th>#</th><th>Cadrage</th><th>Ce qu'on voit / ce qui se passe</th><th>Durée</th><th>Notes</th><th></th></tr></thead>
          <tbody>${t.plans.map((p, i) => `<tr data-i="${i}"><td class="mono">${i + 1}</td>
            <td><select class="fld" data-p="cadrage"><option value="">—</option>${CADRAGES.map(c => `<option${p.cadrage === c ? ' selected' : ''}>${c}</option>`).join('')}</select></td>
            <td>${p.reel ? `<div class="to-reel"><b>${esc(p.reel)}</b><span>${esc([p.audio, p.horaire, p.lieu, p.camera ? '🎥 cameraman' : ''].filter(Boolean).join(' · '))}</span><button class="btn xs" data-audio="${i}">→ Audio</button></div>` : ''}<input class="fld" data-p="action" value="${esc(p.action)}"></td>
            <td><input class="fld court" data-p="duree" value="${esc(p.duree)}" placeholder="5 s"></td>
            <td><input class="fld" data-p="notes" value="${esc(p.notes)}"></td>
            <td class="to-btns"><button class="btn xs" data-haut="${i}" title="Monter">↑</button><button class="btn xs" data-px="${i}" title="Retirer">✕</button></td></tr>`).join('')}</tbody></table>
        <button class="btn xs" id="toPlan" style="margin-top:8px">+ Ajouter un plan</button></div>
      <div class="deux-box">
        <div class="box"><div class="ligne-titre"><span class="lb">Tenues</span><button class="btn xs miette-aide" id="toTenuesMiette" style="margin-left:auto" title="Miette cherche sur Discord les photos de tenues, et qui les porte">Miette : qui porte quoi ?</button></div>
          ${T.membres.map(m => `<div class="to-tenue2"><span class="eng">${esc(m)}</span>
            <div class="to-tenue-ph">${((t.tenuesPhotos || {})[m] || []).map((u, i) => `<div class="to-tph"${BK.img.bg(u)}><button class="md-x" data-tpx="${esc(m)}|${i}">✕</button></div>`).join('')}
              <button class="to-tph to-tph-plus" data-tph="${esc(m)}" title="Une photo de Médias, du cloud ou de Discord">＋<small>Photo</small></button></div>
            <input class="fld to-tenue-txt" data-tenue="${esc(m)}" value="${esc(t.tenues[m])}" placeholder="en quelques mots (facultatif) : chemise noire, jean brut"></div>`).join('')}</div>
        <div class="box"><span class="lb">Matériel et notes</span>
          <textarea class="fld" data-c="materiel" rows="3" placeholder="ex. 2 caméras, trépied, lampes Globe en rouge, machine à fumée">${esc(t.materiel)}</textarea>
          <textarea class="fld" data-c="notes" rows="3" placeholder="Notes pour l'équipe…" style="margin-top:8px">${esc(t.notes)}</textarea>
          <button class="btn xs" id="toSuppr" style="margin-top:8px;align-self:flex-start">Retirer ce tournage</button></div>
      </div></div>`;
    $('#toAffiche').onclick = () => { const o = BK.reglage('tournage.ouvert', {}); o[t.id] = !ouvert; BK.regler('tournage.ouvert', o); rendreFiche(); };
    brancher(t);
  }

  let minuteur = null;
  const sauver = (t, tout = false) => { if (tout) rendreListe(); clearTimeout(minuteur); minuteur = setTimeout(async () => { await BK.db.ecrire('tournages', t); msg('Enregistré'); }, 500); };

  function brancher(t) {
    const z = $('#toFiche');
    $$('[data-c]', z).forEach(c => c.oninput = c.onchange = () => { t[c.dataset.c] = c.value; sauver(t, /titre|date|morceau/.test(c.dataset.c)); });
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
    $$('[data-tpx]', z).forEach(b => b.onclick = async () => { const [qui, i] = b.dataset.tpx.split('|'); t.tenuesPhotos[qui].splice(+i, 1); await BK.db.ecrire('tournages', t); rendreFiche(); });
    // Miette : sur Discord, les photos de tenues (salon « outfit », ou un message qui parle de tenue) et qui les a postées
    $('#toTenuesMiette').onclick = async () => {
      const b = $('#toTenuesMiette'); b.disabled = true; b.innerHTML = '<span class="spin"></span>Miette cherche…';
      let l = []; try { l = await BK.discord.mediasVite('media', {}) || []; } catch (e) {}
      b.disabled = false; b.textContent = 'Miette : qui porte quoi ?';
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
    $('#toPlan').onclick = () => { t.plans.push({ cadrage: '', action: '', duree: '', notes: '' }); sauver(t); rendreFiche(); const l = $$('.to-plans [data-p="action"]'); l.length && l[l.length - 1].focus(); };
    $$('[data-px]', z).forEach(b => b.onclick = () => { t.plans.splice(+b.dataset.px, 1); sauver(t); rendreFiche(); });
    $$('[data-haut]', z).forEach(b => b.onclick = () => { const i = +b.dataset.haut; if (!i) return; [t.plans[i - 1], t.plans[i]] = [t.plans[i], t.plans[i - 1]]; sauver(t); rendreFiche(); });
    $$('.to-doc a', z).forEach(a => a.onclick = e => { e.preventDefault(); BK.ouvrirLien(a.dataset.url); });
    $$('[data-dx]', z).forEach(b => b.onclick = () => { t.moodboardDocs.splice(+b.dataset.dx, 1); sauver(t); rendreFiche(); });
    $$('[data-mx]', z).forEach(b => b.onclick = () => { t.moodboard.splice(+b.dataset.mx, 1); sauver(t); rendreFiche(); });
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
          box.classList.toggle('replie', p[cle]); lb.querySelector('.pli-fleche').textContent = p[cle] ? '▸' : '▾'; };
      }
    })();
    $('#toMoodTag').onclick = async () => {
      if (!BK.drive.relie()) return msg('Relie d\'abord le Drive');
      // toujours par Médias : la fenêtre s'ouvre sur l'étiquette « Moodboard »
      const l = await BK.choisirDansMedias({ titre: 'Images pour le moodboard', bouton: 'Ajouter au moodboard', type: 'image', sujet: 'c:moodboard' });
      if (!l || !l.length) return;
      msg('Ajout des images…');
      const tagsMood = ['t:' + t.id, 'c:moodboard', 'c:tournage'];
      for (const x of l) {
        try {
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
    $$('[data-rx]', z).forEach(b => b.onclick = async () => { t.references.splice(+b.dataset.rx, 1); await BK.db.ecrire('tournages', t); rendreFiche(); });
    $$('.to-ref a[data-url]', z).forEach(a => a.onclick = e => { e.preventDefault(); BK.ouvrirLien(a.dataset.url); });
    $$('[data-audio]', z).forEach(b => b.onclick = () => versAudio(t.plans[+b.dataset.audio]));
    $('#toMoodIn').onchange = e => { ajouterImages(t, e.target.files); e.target.value = ''; };
    $('#toSuppr').onclick = async () => { if (!confirm(`Retirer « ${t.titre || 'ce tournage'} » ? (rangé dans la corbeille du Drive)`)) return; await BK.db.supprimer('tournages', t.id); T.courant = null; msg('Retiré'); charger(); };
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
      const plans = rs.map(r => ({ reel: r.reel, audio: r.audio, horaire: r.horaire, lieu: r.lieu.split(/\n/)[0], camera: r.camera, cadrage: '', action: r.plans, duree: '', notes: [r.action, r.enjeux].filter(Boolean).join(' — ') }));
      if (t) { t.plans = plans; }
      else t = { titre: 'Tournage ' + j + ' (PLAN)', type: 'Reel', morceau: '', date: '', heure: (rs[0].horaire.match(/\d{1,2}h\d{0,2}/) || [''])[0].replace('h', ':').replace(/:$/, ':00').padStart(5, '0'), lieu: [...new Set(rs.map(r => r.lieu.split(/\n/)[0]))].join(' / '),
        idee: '', moodboard: [], plans, tenues: {}, materiel: [...new Set(rs.map(r => r.enjeux).filter(Boolean))].join('\n'), notes: '', source: 'plan-' + j };
      t = await BK.db.ecrire('tournages', t); msg('Fiche du tournage ' + j + ' prête'); T.courant = t; await charger();
    });
    msg('PLAN lu ✓');
  }
  $('#toPlanXl').onclick = () => lirePlan().catch(e => msg('Lecture impossible : ' + e.message));
  $$('[data-md]', page).forEach(b => b.onclick = () => BK.ouvrirMedias ? BK.ouvrirMedias(b.dataset.md) : null);

  async function ajouterImages(t, fichiers) {
    const fs = [...fichiers].filter(f => /^image\//.test(f.type)); if (!fs.length) return msg('Seulement des images');
    if (t.moodboard.length + fs.length > 24) return msg('24 images maximum par moodboard');
    msg('Ajout des images…');
    for (const f of fs) { try { const d = await BK.img.versDrive(f, f.name, 'moodboard'); t.moodboard.push(d.ref || d);   // rangée dans le dossier moodboard du Drive
        if (d.id) for (const k of ['t:' + t.id, 'c:moodboard', 'c:tournage']) await BK.etiquettes.basculer(d.id, k, true); } catch (e) { console.warn(e); } await BK.audio.pause(); }
    await BK.db.ecrire('tournages', t); msg('Moodboard enregistré'); rendreFiche();
  }
  page.addEventListener('dragover', e => { if (T.courant) e.preventDefault(); });
  page.addEventListener('drop', e => { e.preventDefault(); if (T.courant && e.dataTransfer.files.length) ajouterImages(T.courant, e.dataTransfer.files); });

  $('#toNouveau').onclick = async () => {
    const t = await BK.db.ecrire('tournages', { titre: 'Nouveau tournage', type: 'Clip', morceau: '', date: '', heure: '', lieu: '', idee: '', moodboard: [], plans: [], tenues: {}, materiel: '', notes: '' });
    T.liste.unshift(t); T.courant = t; rendreListe(); rendreFiche(); const c = $('[data-c="titre"]'); c && (c.focus(), c.select());
  };

  // ---------- Calendrier ----------
  $('#toCal').onclick = async () => {
    const t = T.courant; if (!t) return; if (!t.date) return msg('Choisis d\'abord une date');
    const ev = { id: t.evenement || undefined, type: t.type === 'Shooting photo' ? 'shooting' : 'tournage', titre: t.titre, morceau: t.morceau, date: t.date, heure: t.heure, lieu: t.lieu, tournage: t.id };
    const e = await BK.db.ecrire('evenements', ev); if (!t.evenement) { t.evenement = e.id; await BK.db.ecrire('tournages', t); }
    BK.agendaRecharger && BK.agendaRecharger(); msg('Dans le Calendrier ✓');
  };

  // ---------- Imprimer / PDF ----------
  $('#toPdf').onclick = () => {
    const t = T.courant; if (!t) return;
    const vieux = $('#impression'); vieux && vieux.remove();
    const d = document.createElement('div'); d.id = 'impression';
    d.innerHTML = `<div class="imp-tete"><div><h1>${esc(t.titre || 'Tournage')}</h1><p>${esc(t.type || '')}${t.morceau ? ' · ' + esc(t.morceau) : ''}</p></div><div class="imp-logo">BEESKOT</div></div>
      <div class="imp-infos"><p><b>Quand</b> ${esc(dateFr(t.date)) || 'à fixer'}${t.heure ? ' à ' + esc(t.heure) : ''}</p><p><b>Où</b> ${esc(t.lieu || '—')}</p>${t.idee ? `<p><b>L'idée</b> ${esc(t.idee)}</p>` : ''}</div>
      ${t.moodboard.length ? `<h2>Moodboard</h2><div class="imp-mood">${t.moodboard.map(u => `<img${BK.img.src(u)}>`).join('')}</div>` : ''}
      ${t.plans.length ? `<h2>Découpage</h2><table><tr><th>#</th><th>Cadrage</th><th>Ce qu'on voit</th><th>Durée</th><th>Notes</th></tr>${t.plans.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.cadrage)}</td><td>${esc(p.action)}</td><td>${esc(p.duree)}</td><td>${esc(p.notes)}</td></tr>`).join('')}</table>` : ''}
      ${Object.values(t.tenues).some(Boolean) || Object.values(t.tenuesPhotos || {}).some(l => l && l.length) ? `<h2>Tenues</h2><table>${T.membres.filter(m => t.tenues[m] || ((t.tenuesPhotos || {})[m] || []).length).map(m => `<tr><td class="imp-nom">${esc(m)}</td><td>${((t.tenuesPhotos || {})[m] || []).map(u => `<img${BK.img.src(u)} style="height:110px;margin:0 6px 6px 0;border-radius:4px">`).join('')}${t.tenues[m] ? '<br>' + esc(t.tenues[m]) : ''}</td></tr>`).join('')}</table>` : ''}
      ${t.materiel ? `<h2>Matériel</h2><p class="imp-txt">${esc(t.materiel)}</p>` : ''}
      ${t.notes ? `<h2>Notes</h2><p class="imp-txt">${esc(t.notes)}</p>` : ''}`;
    document.body.appendChild(d); document.body.classList.add('imprime');
    const fin = () => { document.body.classList.remove('imprime'); d.remove(); window.removeEventListener('afterprint', fin); };
    window.addEventListener('afterprint', fin);
    BK.img.toutes(d).then(() => setTimeout(() => window.print(), 200));          // les images du Drive d'abord
    msg('Choisis « Enregistrer au format PDF » ou ton imprimante');
  };

  BK.surOuvrir = BK.surOuvrir || {}; BK.surOuvrir.tournage = charger;
  charger();
});
})();
