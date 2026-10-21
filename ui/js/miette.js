// =====================================================================
// LE BOUTON JAUNE — « Miette relit tout » : Discord + Drive + tous les onglets,
// en UNE seule demande à Gemini (moins de crédits), puis chaque onglet reçoit ses propositions :
//   Accueil (résumé) · To-do (tâches) · Calendrier (dates) · Assistant audio (passages)
//   Budget (dépenses) · Tournages (tournages à créer + moodboards du Drive)
// Rien n'est ajouté sans qu'on valide (sauf le résumé et les moodboards des fiches vides).
// =====================================================================
BK.miette = {
  enCours: false,
  etape(txt) {
    let v = document.getElementById('bkScan');
    if (!v) { v = document.createElement('div'); v.id = 'bkScan'; v.className = 'bk-reflexion bk-scan'; document.body.appendChild(v); }
    if (!txt) { v.classList.remove('on'); return; }
    v.innerHTML = `<span class="spin"></span>🍞 ${txt}`; v.classList.add('on');
  },
  fin(txt) {
    const v = document.getElementById('bkScan'); if (!v) return;
    v.innerHTML = '✓ ' + txt; v.classList.add('on'); clearTimeout(BK.miette.min); BK.miette.min = setTimeout(() => v.classList.remove('on'), 7000);
  },

  async toutLire() {
    if (BK.miette.enCours) return;
    BK.miette.enCours = true; document.body.classList.add('miette-scan');
    const bilan = [];
    try {
      // 1) Discord : les nouveaux messages
      const d = await BK.discord.config().catch(() => ({}));
      if (d.jeton && (d.salons || []).length) {
        BK.miette.etape('Miette lit Discord…');
        try { const r = await BK.discord.ronde(() => {}, true); if (r.messages) bilan.push(r.messages + ' message(s) lus'); } catch (e) { console.warn(e); }
      }
      // 2) Drive : on relit la liste des fichiers
      if (BK.drive && BK.drive.relie()) { BK.miette.etape('Miette regarde le Drive…'); try { BK.dossiers.oublier(); await BK.dossiers.assurer(); await BK.dossiers.tousFichiers(); } catch (e) { console.warn(e); } }
      // 3) une seule grande lecture par l'AI
      if (await BK.ia.pret()) { BK.miette.etape('Miette réfléchit à tout ce qui a été dit…'); const n = await BK.miette.grandeLecture(); bilan.push(...n); }
      else bilan.push('pas de clé Gemini : seulement Discord et Drive relus');
      // 3 bis) les BPM et tonalités dits sur Discord vont dans les fiches (sauf ce que vous avez écrit dans la fiche)
      try { const n = await BK.miette.appliquerInfos(await BK.miette.infosDiscord({ avecMiette: false })); if (n) bilan.push(n + ' tempo(s) / tonalité(s) repris de Discord'); } catch (e) { console.warn(e); }
      // 4) les moodboards du Drive dans les fiches de tournage vides
      if (BK.drive && BK.drive.relie()) { BK.miette.etape('Miette range les moodboards…'); try { const n = await BK.miette.moodboards(); if (n) bilan.push(n + ' moodboard(s) rempli(s)'); } catch (e) { console.warn(e); } }
      // 5) chaque onglet se met à jour
      for (const f of ['tachesRecharger', 'agendaRecharger', 'budgetRecharger', 'tournagesRecharger', 'veilleurMaj', 'mediasTags']) try { BK[f] && BK[f](); } catch (e) {}
      try { BK.surOuvrir && BK.surOuvrir.accueil && BK.surOuvrir.accueil(); } catch (e) {}
      BK.regler('miette.dernierTour', Date.now());
      BK.miette.fin('Miette a tout relu' + (bilan.length ? ' · ' + bilan.join(' · ') : ''));
    } catch (e) { console.error(e); BK.miette.fin('Miette n\'a pas pu tout lire : ' + e.message); }
    BK.miette.enCours = false; document.body.classList.remove('miette-scan');
  },

  // ---------- les infos des morceaux dites sur Discord (BPM, tonalité) ----------
  // 1) lecture directe des messages : « Mother 78 BPM », « moon blue en 75bpm », « tempo de Mother : 78 »
  // 2) puis Miette (Gemini) pour les phrases moins évidentes
  // Ce qui est écrit sur Discord, c'est vous : ça passe devant Ableton et la détection.
  async infosDiscord({ avecMiette = true } = {}) {
    const [ms, j] = await Promise.all([BK.db.liste('morceaux'), BK.discord.journal(12).catch(() => [])]);
    const norm = t => BK.inv.normaliser(t).replace(/\s+/g, ' ');
    const cles = ms.map(m => ({ m, k: [m.nom, ...(m.alias || [])].map(norm).filter(x => x.length >= 3) }));
    const out = {};                                                     // id du morceau → { bpm, ton, ligne }
    const noter = (m, champ, val, l) => { const o = out[m.id] = out[m.id] || { m };
      if (!o[champ] || (l.t || '') >= (o[champ].l.t || '')) o[champ] = { v: val, l }; };        // le plus récent gagne
    for (const l of j) {
      const brut = String(l.txt || ''); if (!/bpm|tempo|tonalit|\b[a-g](#|b)?\s*(m|min|maj|mineur|majeur)\b/i.test(brut)) continue;
      const t = norm(brut);
      const cites = cles.filter(c => c.k.some(k => t.includes(k))).map(c => c.m);
      // les BPM : un nombre collé à « bpm », ou après « tempo »
      const bpms = [...brut.matchAll(/(\d{2,3}(?:[.,]\d)?)\s*bpm|bpm\s*[:=]?\s*(\d{2,3}(?:[.,]\d)?)|tempo\s*(?:de\s+[^:\d]{0,30})?[:=]?\s*(\d{2,3}(?:[.,]\d)?)/gi)]
        .map(x => parseFloat((x[1] || x[2] || x[3]).replace(',', '.'))).filter(v => v >= 50 && v <= 220);
      if (cites.length === 1 && bpms.length) noter(cites[0], 'bpm', String(bpms[bpms.length - 1]), l);
      else if (cites.length > 1 && bpms.length) {                       // plusieurs morceaux dans le message : on associe chaque nombre au nom le plus proche avant lui
        for (const x of brut.matchAll(/(\d{2,3}(?:[.,]\d)?)\s*bpm/gi)) {
          const avant = norm(brut.slice(0, x.index)); let best = null, pos = -1;
          for (const c of cites) for (const k of cles.find(y => y.m === c).k) { const i = avant.lastIndexOf(k); if (i > pos) { pos = i; best = c; } }
          const v = parseFloat(x[1].replace(',', '.')); if (best && v >= 50 && v <= 220) noter(best, 'bpm', String(v), l);
        } }
    }
    // Miette : les tonalités et ce que la lecture directe n'a pas su attribuer
    if (avecMiette && await BK.ia.pret()) {
      const lignes = j.filter(l => /bpm|tempo|tonalit|mineur|majeur|\bkey\b/i.test(l.txt || '')).slice(-200);
      if (lignes.length) { try {
        const r = await BK.ia.demander(`Morceaux : ${ms.map(m => m.nom + ((m.alias || []).length ? ' (' + m.alias.join(', ') + ')' : '')).join(' ; ')}.\n\nMessages :\n${BK.discord.texte(lignes)}\n\n`
          + 'Pour chaque morceau dont le TEMPO (BPM) ou la TONALITÉ est dit dans ces messages, donne la dernière valeur dite. Réponds en JSON : [{"morceau":"nom exact","bpm":"78 ou vide","ton":"ex. Mi mineur ou vide","source":"l\'identifiant (msg …)"}]. N\'invente rien. Si rien, [].',
          { json: true, temperature: 0.1, vite: true, delai: 60 });
        for (const x of Array.isArray(r) ? r : []) { const m = BK.inv.trouverMorceau(x.morceau || '', ms); if (!m) continue;
          const l = j.find(y => String(x.source || '').includes(y.id)) || { t: '', txt: '(lu par Miette)', qui: '' };
          if (x.bpm && !(out[m.id] && out[m.id].bpm)) { const v = parseFloat(String(x.bpm).replace(',', '.')); if (v >= 50 && v <= 220) noter(m, 'bpm', String(v), l); }
          if (x.ton) noter(m, 'ton', String(x.ton), l); }
      } catch (e) { console.warn(e); } }
    }
    return Object.values(out);
  },
  // applique sans demander quand la fiche n'a qu'une valeur devinée ou lue dans Ableton
  async appliquerInfos(l, { tout = false } = {}) {
    let n = 0;
    for (const o of l) { const m = o.m; let change = false;
      if (o.bpm && m.bpm !== o.bpm.v && (tout || m.bpmSource !== 'nous')) { m.bpm = o.bpm.v; m.bpmSource = 'discord'; change = true; }
      if (o.ton && m.ton !== o.ton.v && (tout || !m.tonSource || m.tonSource !== 'nous')) { m.ton = o.ton.v; m.tonSource = 'discord'; change = true; }
      if (change) { await BK.db.ecrire('morceaux', m, { sansAnnuler: !tout }); n++; } }
    return n;
  },

  async grandeLecture() {
    const j = await BK.discord.journal(3), depuis = new Date(Date.now() - 45 * 864e5).toISOString(), recents = j.filter(l => l.t >= depuis);
    if (!recents.length) return ['rien de nouveau sur Discord'];
    const [ms, ts, evs, deps, tours, props] = await Promise.all(['morceaux', 'taches', 'evenements', 'depenses', 'tournages', 'propositions'].map(c => BK.db.liste(c)));
    const auj = new Date().toISOString().slice(0, 10), semaine = new Date(Date.now() - 7 * 864e5).toISOString();
    const systeme = `Tu es Miette, l'assistante du groupe de musique BEESKOT (prononcé « Biscotte »). Aujourd'hui : ${auj}.
Membres : Yacine (Yaya, Dari, pseudo « sneakers »), Pierre (« pierrec1. »), Baptiste (Bat, « drumbli.scott »). « BEESKOT » = tout le groupe.
Morceaux (nom exact, puis surnoms, puis où il en est) : ${ms.map(m => m.nom + ((m.alias || []).length ? ' (' + m.alias.join(', ') + ')' : '') + ' [' + (m.statut === 'sorti' ? 'sorti' : BK.etapes[Math.min(m.fait || 0, 5)].nom) + (m.sortie ? ', sortie ' + m.sortie : '') + ']').join(' ; ')}.
Tu lis leurs messages Discord (français familier) et tu PRÉPARES leur organisation dans le logiciel. Sois concret et complet, n'invente rien.
Un bot recopie aussi les MAILS reçus par le groupe (ingé son sur Fiverr, distributeur, salles, factures) : ce sont des infos réelles, cite-les dans le résumé, et tires-en des tâches, des dates et des dépenses comme pour le reste.
Réponds en JSON, un seul objet :
{
 ${BK.discord.CONSIGNE_SEMAINE},
 "taches": [{"texte":"action concrète qui commence par un verbe","qui":"Yacine|Pierre|Baptiste|BEESKOT|","morceau":"","date":"AAAA-MM-JJ ou vide","source":"msg …","pourquoi":"phrase citée"}],
 "passages": [{"morceau":"nom exact","debut":"m:ss","fin":"m:ss","note":"à quoi il sert","source":"msg …"}],
 "depenses": [{"titre":"","montant":0,"payePar":"Yacine|Pierre|Baptiste","pour":["Yacine","Pierre","Baptiste"],"date":"AAAA-MM-JJ","source":"msg …","pourquoi":""}],
 "tournages": [{"titre":"","type":"Clip|Reel|Shooting photo","morceau":"","date":"AAAA-MM-JJ ou vide","heure":"","lieu":"","idee":"l'idée en une phrase","tenues":"","materiel":"","source":"msg …","pourquoi":""}]
}
Règles : "taches" = ce que quelqu'un doit faire et qui n'est pas déjà fait ni déjà dans la liste existante. "passages" = les timings d'un morceau donnés pour un reel ou un tournage (pas les heures de rendez-vous). "depenses" = un paiement réel dit dans les messages (qui a payé, combien), pas déjà dans la liste. "tournages" = les tournages ou shootings prévus qui n'ont pas encore de fiche. Tableaux vides si rien.`;
    const existe = [
      'Tâches déjà dans la liste : ' + (ts.map(t => t.texte + (t.fait ? ' (fait)' : '')).slice(-120).join(' ; ') || 'aucune'),
      'Rendez-vous déjà au calendrier : ' + (evs.map(e => `${e.date} ${e.titre}`).join(' ; ') || 'aucun'),
      'Dépenses déjà notées : ' + (deps.filter(x => x.type !== 'remboursement').slice(-60).map(x => `${x.date} ${x.titre} ${x.montant}$ (${x.payePar})`).join(' ; ') || 'aucune'),
      'Fiches de tournage existantes : ' + (tours.map(t => `${t.titre} ${t.date || ''}`).join(' ; ') || 'aucune'),
    ].join('\n');
    const r = await BK.ia.demander(`${existe}\n\nMessages Discord des 45 derniers jours :\n${BK.discord.texte(recents.slice(-900))}`, { systeme, json: true, temperature: 0.2, vite: true, delai: 150 });
    const out = [], nb = (l, n) => { if (l) out.push(l + ' ' + n); };

    // Accueil : le résumé de la semaine
    if (r.semaine) {
      const doc = (await BK.db.liste('veille')).find(x => x.id === 'resume') || { id: 'resume' };
      const dernier = (recents[recents.length - 1] || {}).id || '';
      BK.discord.garderResume(doc, r); Object.assign(doc, { dernier, t: Date.now(), nb: recents.filter(l => l.t >= semaine).length });
      await BK.db.ecrire('veille', doc); BK.regler('accueil.resume', { ...doc });
      BK.renfortGarder && BK.renfortGarder({ type: 'resume', q: 'Miette a tout relu (' + new Date().toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' }) + ')', r: doc.texte });
    }
    const av = props.length, l = [];
    // To-do
    for (const t of (r.taches || []).filter(t => t && t.texte)) l.push({ ...t, type: 'tache' });
    // Budget
    for (const x of (r.depenses || []).filter(x => x && x.titre && +x.montant > 0)) l.push({ type: 'depense', titre: x.titre, montant: +x.montant, payePar: x.payePar, pour: x.pour, date: x.date || auj, source: x.source, pourquoi: x.pourquoi });
    // Tournages
    for (const x of (r.tournages || []).filter(x => x && x.titre)) l.push({ ...x, type: 'tournage' });
    await BK.discord.rangerPropositions(l);
    const nouv = (await BK.db.liste('propositions')).length - av; if (nouv) out.push(nouv + ' proposition(s)');
    // Calendrier : une lecture À PART, rien que pour les dates (plus fiable que dans la grande lecture), qui s'ajoute à ce qu'on avait
    try { const doc = await BK.discord.planning(); nb((doc.l || []).length, 'date(s) au calendrier'); }
    catch (e) { console.warn(e); out.push('calendrier : ' + e.message); }
    // Assistant audio : les passages
    if (Array.isArray(r.passages)) {
      const sec = t => { const x = String(t || '').match(/(\d{1,2})\s*[:'’]\s*(\d{2})/); return x ? +x[1] * 60 + +x[2] : null; };
      const tout = await BK.partage.lire('passages.discord', {}); let n = 0;
      for (const p of r.passages) { const m = BK.inv.trouverMorceau(p.morceau || '', ms); const debut = sec(p.debut), fin = sec(p.fin);
        if (!m || debut == null || !(fin > debut)) continue;
        const ls = tout[m.id] = tout[m.id] || []; if (!ls.some(x => x.debut === debut && x.fin === fin)) { ls.push({ debut, fin, nom: '🍞 Discord · ' + (p.note || '') }); n++; } }
      await BK.partage.ecrire('passages.discord', tout); nb(n, 'passage(s) de morceaux');
    }
    return out;
  },

  // ---------- moodboards : les images du Drive (dossiers « moodboard ») dans les fiches de tournage qui n'en ont pas ----------
  async moodboards() {
    const [tours, ms, tous, carte] = await Promise.all([BK.db.liste('tournages'), BK.db.liste('morceaux'), BK.dossiers.tousFichiers(), BK.dossiers.carte()]);
    const mood = tous.filter(f => { const p = (f.parents || [])[0]; return p && BK.dossiers.ancetres(p, carte).some(a => /mood/i.test(carte[a].name)); })
      .map(f => ({ ...f, dossiers: BK.dossiers.ancetres(f.parents[0], carte).reverse().map(a => carte[a].name) }));
    if (!mood.length) return 0;
    let n = 0;
    for (const t of tours) {
      if ((t.moodboard || []).length || (t.moodboardDocs || []).length) continue;
      const noms = [t.morceau, ...(t.plans || []).map(p => p.reel)].filter(Boolean), ids = new Set(noms.map(x => (BK.inv.trouverMorceau(x, ms) || {}).id).filter(Boolean));
      const duMorceau = f => { const m = BK.inv.trouverMorceau(f.name, ms) || f.dossiers.map(d => BK.inv.trouverMorceau(d, ms)).find(Boolean); return m && ids.has(m.id); };
      let l = mood.filter(duMorceau);
      if (!l.length && /shoot|photo/i.test((t.type || '') + ' ' + (t.titre || ''))) l = mood.filter(f => /shoot|photo/i.test(f.dossiers.join(' ') + ' ' + f.name));
      if (!l.length) continue;
      const imgs = l.filter(f => /^image\//.test(f.mimeType || '')).slice(0, 12), docs = l.filter(f => !/^image\//.test(f.mimeType || '')).slice(0, 10);
      t.moodboard = imgs.map(f => BK.img.ref(f.id));                 // juste l'adresse des images du Drive : rien n'est recopié
      t.moodboardDocs = docs.map(f => ({ nom: f.name, url: f.webViewLink, id: f.id }));
      if (t.moodboard.length || t.moodboardDocs.length) { t.moodboardAuto = true; await BK.db.ecrire('tournages', t, { sansAnnuler: true }); n++; }
    }
    return n;
  },
  async reduire(url, max = 520) {
    const b = await (await fetch(url)).blob(), img = await createImageBitmap(b), k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  },
};

// =====================================================================
// SYNCHRO ENTRE LES PC — toutes les 40 s (fenêtre ouverte), on demande au Drive :
// « quelles fiches ont changé depuis la dernière fois ? ». Si un autre PC a modifié
// la To-do, le Budget, le résumé de la semaine, les étiquettes des Médias…
// l'onglet se relit tout seul. Une seule petite question au Drive : très léger.
// =====================================================================
// ---------- qui travaille sur BEESKOT Studio en même temps que toi ----------
// Chaque PC laisse un petit mot sur le Drive toutes les 40 s : son nom et l'onglet ouvert.
BK.presence = {
  action: '', actionT: 0, dernierEnvoi: 0,
  // ce que ce PC est en train de faire : la petite ligne d'état de l'onglet ouvert (« Export 2/3 », « Image prête »…)
  noter(t) { t = String(t || '').trim(); if (!t || t === BK.presence.action) return; BK.presence.action = t.slice(0, 60); BK.presence.actionT = Date.now();
    const attente = 15e3 - (Date.now() - BK.presence.dernierEnvoi);                   // on prévient les autres vite, mais pas plus d'une fois toutes les 15 s
    clearTimeout(BK.presence._t); BK.presence._t = setTimeout(() => BK.presence.maj(true), Math.max(0, attente)); },
  async battre(parti) {
    if (!BK.drive || !BK.drive.relie()) return;
    const moi = BK.reglage('nomPc', '') || 'ce PC';
    const o = (BK.onglets || []).find(x => x.id === BK.reglage('dernierOnglet', 'accueil'));
    const action = Date.now() - BK.presence.actionT < 10 * 60e3 ? BK.presence.action : '';            // une action trop vieille ne compte plus
    BK.presence.dernierEnvoi = Date.now();
    try { await BK.db.ecrire('config', { id: 'ici-' + moi.toLowerCase().replace(/[^a-z0-9]+/g, '-'), qui: moi, onglet: o ? o.titre : '', action, t: parti ? 0 : Date.now() }, { sansAnnuler: true }); } catch (e) {}
  },
  async lire() {
    if (!BK.drive || !BK.drive.relie()) return [];
    const moi = (BK.reglage('nomPc', '') || 'ce PC').toLowerCase();
    try {
      return (await BK.db.liste('config')).filter(d => /^ici-/.test(d.id) && Date.now() - (d.t || 0) < 7 * 60e3 && String(d.qui || '').toLowerCase() !== moi);
    } catch (e) { return []; }
  },
  async maj(ecrire) {
    const z = document.getElementById('syQuiL'), b = document.getElementById('syQui'); if (!z) return;
    if (ecrire || Date.now() - BK.presence.dernierEnvoi > 3 * 60e3) await BK.presence.battre();
    const l = await BK.presence.lire();
    if (!b) return;
    b.style.display = BK.drive && BK.drive.relie() ? '' : 'none';
    const moi = BK.reglage('nomPc', '') || 'ce PC';
    const tous = [{ qui: moi, onglet: '', moi: true }, ...l];                 // toi d'abord, puis les autres
    z.innerHTML = tous.map(x => `<span class="sy-p${x.moi ? ' moi' : ''}" title="${String(x.qui + (x.onglet ? ' — ' + x.onglet : '')).replace(/"/g, '')}">● ${String(x.qui).toUpperCase().replace(/[<>&]/g, '')}${x.onglet ? `<small>${String(x.onglet).replace(/[<>&]/g, '')}</small>` : ''}</span>`).join('');
    b.title = l.length ? l.map(x => x.qui + (x.onglet ? ' — ' + x.onglet : '')).join('\n') : 'Tu es seul sur BEESKOT Studio en ce moment';
    b.classList.toggle('qui-on', !!l.length);
    // la ligne d'équipe en bas de chaque page : qui fait quoi, en ce moment
    const txt = l.filter(x => x.action || x.onglet).map(x => `<b>${String(x.qui).replace(/[<>&]/g, '')}</b> ${String(x.action || x.onglet).replace(/[<>&]/g, '')}`).join('<i>·</i>');
    for (const bar of document.querySelectorAll('.pane.abar')) {
      let e = bar.querySelector('.abar-equipe');
      if (!e) { e = document.createElement('span'); e.className = 'abar-equipe'; const r = bar.querySelector('.right'); r ? bar.insertBefore(e, r) : bar.appendChild(e); }
      e.innerHTML = txt ? '<em>EN CE MOMENT</em>' + txt : ''; e.classList.toggle('hidden', !txt);
    }
  },
};

BK.synchro = {
  dernier: new Date(Date.now() - 60e3).toISOString(),
  async tour() {
    if (!BK.drive || !BK.drive.relie() || document.hidden) return;
    try {
      const racine = await BK.drive.racine(), depuis = BK.synchro.dernier, maintenant = new Date().toISOString();
      const r = await (await BK.drive.api('/files?' + new URLSearchParams({ q: `modifiedTime > '${depuis}' and mimeType='application/json' and trashed=false`, fields: 'files(id,name,parents,lastModifyingUser(me))', pageSize: '200' }))).json();
      BK.synchro.dernier = maintenant;
      const parCol = {}; for (const [cle, id] of Object.entries(BK.drive.dossiers)) if (cle.startsWith(racine + '/')) parCol[id] = cle.slice(racine.length + 1);
      const recents = BK.drive.ecrits || {};                         // ce que CE PC vient d'écrire ne revient pas faire tout relire
      const utiles = (r.files || []).filter(f => !/^ici-/.test(f.name || '') && !(recents[f.name] && Date.now() - recents[f.name] < 120e3));
      const cols = [...new Set(utiles.map(f => parCol[(f.parents || [])[0]]).filter(Boolean))];
      if (cols.length) window.dispatchEvent(new CustomEvent('bk:distant', { detail: { cols } }));
    } catch (e) { /* hors ligne : on réessaie au prochain tour */ }
  },
  // les collections connues : on va chercher l'identifiant de leur dossier Drive une fois,
  // sinon un changement venu d'un autre PC dans une collection jamais ouverte passe inaperçu
  COLS: ['morceaux', 'taches', 'evenements', 'tournages', 'reels', 'depenses', 'abonnements',
         'inventaires', 'exportsaudio', 'config', 'veille', 'propositions', 'renforts', 'ameliorations'],
  async prevenir() {
    if (!BK.drive || !BK.drive.relie()) return;
    const racine = await BK.drive.racine();
    for (const c of BK.synchro.COLS) { try { await BK.drive.dossier(c, racine); } catch (e) {} }
  },
  demarrer() {
    BK.synchro.prevenir();
    // un seul tempo pour la présence et la synchro (deux appels au Drive, groupés, toutes les 45 s)
    const tic = () => { BK.synchro.tour(); BK.presence.maj(); };
    BK.presence.maj(true); setInterval(tic, 45e3);                 // à l'ouverture : « je suis là »
    window.addEventListener('focus', tic);
    window.addEventListener('beforeunload', () => { BK.presence.battre(true); });   // à la fermeture : « je pars » (si Internet le permet)
    // quand une fiche change ailleurs, l'onglet concerné se relit (sauf si on est en train d'écrire dedans)
    // tout ce qui est fait sur un PC se retrouve sur les autres : chaque collection dit quels onglets relire
    const QUI = {
      taches:       ['tachesRecharger'],
      propositions: ['tachesRecharger', 'budgetRecharger', 'tournagesRecharger', 'veilleurMaj'],
      evenements:   ['agendaRecharger'],
      depenses:     ['budgetRecharger'],
      abonnements:  ['budgetRecharger'],
      tournages:    ['tournagesRecharger', 'suiviRecharger'],
      reels:        ['suiviRecharger'],
      exportsaudio: ['suiviRecharger'],
      inventaires:  ['biblioRecharger', 'suiviRecharger'],
      morceaux:     ['biblioRecharger', 'suiviRecharger'],
      veille:       ['agendaRecharger'],
      config:       ['mediasTags'],
      renforts:     ['veilleurMaj'],
      ameliorations:['veilleurMaj'],
    };
    window.addEventListener('bk:distant', e => {
      const a = document.activeElement; if (a && (/^(INPUT|TEXTAREA)$/.test(a.tagName) || a.isContentEditable)) return;
      if (e.detail.cols.includes('config') && BK.etiquettes) BK.etiquettes.doc = null;
      if (e.detail.cols.includes('config')) BK.partageCache = {};        // PLAN.xlsx, passages Discord… relus
      const f = new Set(e.detail.cols.flatMap(c => QUI[c] || []));
      for (const n of f) try { BK[n] && BK[n](); } catch (er) {}
      if (e.detail.cols.some(c => /veille|taches|evenements|propositions|morceaux/.test(c))) try { BK.surOuvrir && BK.surOuvrir.accueil && BK.surOuvrir.accueil(); } catch (er) {}
      if (e.detail.cols.includes('morceaux')) for (const c of ['morceaux']) window.dispatchEvent(new CustomEvent('bk:change', { detail: { col: c, id: '' } }));
    });
  },
};
