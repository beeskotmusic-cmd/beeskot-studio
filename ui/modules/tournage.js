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

// réduire une image (moodboard) : légère, rangée directement dans la fiche
function reduire(f, max = 520) {
  return new Promise((ok, ko) => { const im = new Image(), u = URL.createObjectURL(f);
    im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(u); ok(c.toDataURL('image/jpeg', 0.78)); };
    im.onerror = () => { URL.revokeObjectURL(u); ko(new Error('Image illisible')); }; im.src = u; });
}

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
    T.morceaux = (await BK.db.liste('morceaux')).map(m => m.nom).sort();
    if (T.courant) T.courant = T.liste.find(x => x.id === T.courant.id) || null;
    if (!T.courant) T.courant = T.liste.find(x => (x.date || '') >= new Date().toISOString().slice(0, 10)) || T.liste[0] || null;
    rendreListe(); rendreFiche();
  }
  BK.tournagesRecharger = charger;

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
    z.innerHTML = `
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
      <div class="box"><div class="ligne-titre"><span class="lb">Moodboard</span><span class="nt" style="margin:0 0 0 auto">Glisse des images ici (captures, photos, Pinterest…)</span></div>
        <div class="to-mood" id="toMood">${t.moodboard.map((u, i) => `<div class="to-img" style="background-image:url(${u})"><button class="md-x" data-mx="${i}">✕</button></div>`).join('')}
          <button class="to-img to-plus" id="toMoodPlus" title="Images de ce PC">+</button><button class="to-img to-plus to-plus-drive" id="toMoodDrive" title="Images du Drive">+ Drive</button></div>
        <input type="file" id="toMoodIn" accept="image/*" multiple hidden></div>
      <div class="box"><div class="ligne-titre"><span class="lb">Découpage</span>
          <button class="btn xs" id="toRenfort" style="margin-left:auto">🍞 Idées avec Miette</button></div>
        <table class="to-plans"><thead><tr><th>#</th><th>Cadrage</th><th>Ce qu'on voit / ce qui se passe</th><th>Durée</th><th>Notes</th><th></th></tr></thead>
          <tbody>${t.plans.map((p, i) => `<tr data-i="${i}"><td class="mono">${i + 1}</td>
            <td><select class="fld" data-p="cadrage"><option value="">—</option>${CADRAGES.map(c => `<option${p.cadrage === c ? ' selected' : ''}>${c}</option>`).join('')}</select></td>
            <td>${p.reel ? `<div class="to-reel"><b>${esc(p.reel)}</b><span>${esc([p.audio, p.horaire, p.lieu, p.camera ? '🎥 cameraman' : ''].filter(Boolean).join(' · '))}</span><button class="btn xs" data-audio="${i}">→ Audio</button></div>` : ''}<input class="fld" data-p="action" value="${esc(p.action)}"></td>
            <td><input class="fld court" data-p="duree" value="${esc(p.duree)}" placeholder="5 s"></td>
            <td><input class="fld" data-p="notes" value="${esc(p.notes)}"></td>
            <td class="to-btns"><button class="btn xs" data-haut="${i}" title="Monter">↑</button><button class="btn xs" data-px="${i}" title="Retirer">✕</button></td></tr>`).join('')}</tbody></table>
        <button class="btn xs" id="toPlan" style="margin-top:8px">+ Ajouter un plan</button></div>
      <div class="deux-box">
        <div class="box"><span class="lb">Tenues</span>
          ${T.membres.map(m => `<label class="to-tenue"><span class="eng">${esc(m)}</span><input class="fld" data-tenue="${esc(m)}" value="${esc(t.tenues[m])}" placeholder="ex. chemise noire, jean brut"></label>`).join('')}</div>
        <div class="box"><span class="lb">Matériel et notes</span>
          <textarea class="fld" data-c="materiel" rows="3" placeholder="ex. 2 caméras, trépied, lampes Globe en rouge, machine à fumée">${esc(t.materiel)}</textarea>
          <textarea class="fld" data-c="notes" rows="3" placeholder="Notes pour l'équipe…" style="margin-top:8px">${esc(t.notes)}</textarea>
          <button class="btn xs" id="toSuppr" style="margin-top:8px;align-self:flex-start">Retirer ce tournage</button></div>
      </div>`;
    brancher(t);
  }

  let minuteur = null;
  const sauver = (t, tout = false) => { if (tout) rendreListe(); clearTimeout(minuteur); minuteur = setTimeout(async () => { await BK.db.ecrire('tournages', t); msg('Enregistré'); }, 500); };

  function brancher(t) {
    const z = $('#toFiche');
    $$('[data-c]', z).forEach(c => c.oninput = c.onchange = () => { t[c.dataset.c] = c.value; sauver(t, /titre|date|morceau/.test(c.dataset.c)); });
    $$('[data-tenue]', z).forEach(c => c.oninput = () => { t.tenues[c.dataset.tenue] = c.value; sauver(t); });
    $$('.to-plans tr[data-i]', z).forEach(tr => $$('[data-p]', tr).forEach(c => c.oninput = c.onchange = () => { t.plans[+tr.dataset.i][c.dataset.p] = c.value; sauver(t); }));
    $('#toPlan').onclick = () => { t.plans.push({ cadrage: '', action: '', duree: '', notes: '' }); sauver(t); rendreFiche(); const l = $$('.to-plans [data-p="action"]'); l.length && l[l.length - 1].focus(); };
    $$('[data-px]', z).forEach(b => b.onclick = () => { t.plans.splice(+b.dataset.px, 1); sauver(t); rendreFiche(); });
    $$('[data-haut]', z).forEach(b => b.onclick = () => { const i = +b.dataset.haut; if (!i) return; [t.plans[i - 1], t.plans[i]] = [t.plans[i], t.plans[i - 1]]; sauver(t); rendreFiche(); });
    $$('[data-mx]', z).forEach(b => b.onclick = () => { t.moodboard.splice(+b.dataset.mx, 1); sauver(t); rendreFiche(); });
    $('#toMoodPlus').onclick = () => $('#toMoodIn').click();
    $('#toMoodDrive').onclick = async () => {
      if (!BK.drive.relie()) return msg('Relie d\'abord le Drive');
      const l = await BK.explorerDrive({ titre: 'Images du Drive pour le moodboard', mode: 'images', depart: 'moodboard' }); if (!l || !l.length) return;
      msg('Ajout des images…');
      for (const f of l) { try { const u = await BK.drive.vignette(f); if (u) t.moodboard.push(await enDataUrl(u)); } catch (e) {} }
      await BK.db.ecrire('tournages', t); msg('Moodboard enregistré'); rendreFiche();
    };
    $$('[data-audio]', z).forEach(b => b.onclick = () => versAudio(t.plans[+b.dataset.audio]));
    $('#toMoodIn').onchange = e => { ajouterImages(t, e.target.files); e.target.value = ''; };
    $('#toSuppr').onclick = async () => { if (!confirm(`Retirer « ${t.titre || 'ce tournage'} » ? (rangé dans la corbeille du Drive)`)) return; await BK.db.supprimer('tournages', t.id); T.courant = null; msg('Retiré'); charger(); };
    $('#toRenfort').onclick = () => BK.renfortDemander ? BK.renfortDemander('decoupage', { tournage: t }) : msg('Miette pas encore disponible');
    $$('input,textarea', z).forEach(c => c.addEventListener('keydown', e => e.stopPropagation()));
  }

  async function enDataUrl(u) { const b = await (await fetch(u)).blob(); return reduire(new File([b], 'i.jpg', { type: b.type || 'image/jpeg' })); }

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
    BK.regler('plan.lignes', rows.map(r => ({ reel: r.reel, audio: r.audio, jour: r.jour, plans: String(r.plans).slice(0, 80) })));   // l'Assistant audio retrouve les passages
    montrerPlan(rows, f);
  }
  function montrerPlan(rows, f) {
    const jours = [...new Set(rows.map(r => r.jour))];
    $('#toFiche').innerHTML = `<div class="box"><div class="ligne-titre"><span class="lb">PLAN.xlsx · ${rows.length} reels · ${jours.length} jour(s) de tournage</span>
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
    $$('[data-pa]').forEach(b => b.onclick = () => { const [j, i] = b.dataset.pa.split('|'); versAudio(rows.filter(r => r.jour === j)[+i]); });
    $$('[data-jour]').forEach(b => b.onclick = async () => {
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
    for (const f of fs) { try { t.moodboard.push(await reduire(f)); } catch (e) {} await BK.audio.pause(); }
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
      ${t.moodboard.length ? `<h2>Moodboard</h2><div class="imp-mood">${t.moodboard.map(u => `<img src="${u}">`).join('')}</div>` : ''}
      ${t.plans.length ? `<h2>Découpage</h2><table><tr><th>#</th><th>Cadrage</th><th>Ce qu'on voit</th><th>Durée</th><th>Notes</th></tr>${t.plans.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.cadrage)}</td><td>${esc(p.action)}</td><td>${esc(p.duree)}</td><td>${esc(p.notes)}</td></tr>`).join('')}</table>` : ''}
      ${Object.values(t.tenues).some(Boolean) ? `<h2>Tenues</h2><table>${T.membres.filter(m => t.tenues[m]).map(m => `<tr><td class="imp-nom">${esc(m)}</td><td>${esc(t.tenues[m])}</td></tr>`).join('')}</table>` : ''}
      ${t.materiel ? `<h2>Matériel</h2><p class="imp-txt">${esc(t.materiel)}</p>` : ''}
      ${t.notes ? `<h2>Notes</h2><p class="imp-txt">${esc(t.notes)}</p>` : ''}`;
    document.body.appendChild(d); document.body.classList.add('imprime');
    const fin = () => { document.body.classList.remove('imprime'); d.remove(); window.removeEventListener('afterprint', fin); };
    window.addEventListener('afterprint', fin);
    setTimeout(() => window.print(), 300);
    msg('Choisis « Enregistrer au format PDF » ou ton imprimante');
  };

  BK.surOuvrir = BK.surOuvrir || {}; BK.surOuvrir.tournage = charger;
  charger();
});
})();
