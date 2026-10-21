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
      // 4) les moodboards du Drive dans les fiches de tournage vides
      if (BK.drive && BK.drive.relie()) { BK.miette.etape('Miette range les moodboards…'); try { const n = await BK.miette.moodboards(); if (n) bilan.push(n + ' moodboard(s) rempli(s)'); } catch (e) { console.warn(e); } }
      // 5) chaque onglet se met à jour
      for (const f of ['tachesRecharger', 'agendaRecharger', 'budgetRecharger', 'tournagesRecharger', 'veilleurMaj', 'mediasRecharger']) try { BK[f] && BK[f](); } catch (e) {}
      try { BK.surOuvrir && BK.surOuvrir.accueil && BK.surOuvrir.accueil(); } catch (e) {}
      BK.regler('miette.dernierTour', Date.now());
      BK.miette.fin('Miette a tout relu' + (bilan.length ? ' · ' + bilan.join(' · ') : ''));
    } catch (e) { console.error(e); BK.miette.fin('Miette n\'a pas pu tout lire : ' + e.message); }
    BK.miette.enCours = false; document.body.classList.remove('miette-scan');
  },

  async grandeLecture() {
    const j = await BK.discord.journal(3), depuis = new Date(Date.now() - 45 * 864e5).toISOString(), recents = j.filter(l => l.t >= depuis);
    if (!recents.length) return ['rien de nouveau sur Discord'];
    const [ms, ts, evs, deps, tours, props] = await Promise.all(['morceaux', 'taches', 'evenements', 'depenses', 'tournages', 'propositions'].map(c => BK.db.liste(c)));
    const auj = new Date().toISOString().slice(0, 10), semaine = new Date(Date.now() - 7 * 864e5).toISOString();
    const systeme = `Tu es Miette, l'assistante du groupe de musique BEESKOT (prononcé « Biscotte »). Aujourd'hui : ${auj}.
Membres : Yacine (Yaya, Dari, pseudo « sneakers »), Pierre (« pierrec1. »), Baptiste (Bat, « drumbli.scott »). « BEESKOT » = tout le groupe.
Morceaux (nom exact, puis surnoms) : ${ms.map(m => m.nom + ((m.alias || []).length ? ' (' + m.alias.join(', ') + ')' : '')).join(' ; ')}.
Tu lis leurs messages Discord (français familier) et tu PRÉPARES leur organisation dans le logiciel. Sois concret et complet, n'invente rien.
Un bot recopie aussi les MAILS reçus par le groupe (ingé son sur Fiverr, distributeur, salles, factures) : ce sont des infos réelles, cite-les dans le résumé, et tires-en des tâches, des dates et des dépenses comme pour le reste.
Réponds en JSON, un seul objet :
{
 "semaine": "ce qu'on s'est dit ces 7 derniers jours, 3 à 6 phrases courtes et simples",
 "afaire": ["3 à 6 lignes courtes : ce qui ressort à faire, avec qui"],
 "taches": [{"texte":"action concrète qui commence par un verbe","qui":"Yacine|Pierre|Baptiste|BEESKOT|","morceau":"","date":"AAAA-MM-JJ ou vide","source":"msg …","pourquoi":"phrase citée"}],
 "planning": [{"type":"tournage|shooting|enreg|repet|mixage|sortie|promo|autre","titre":"","morceau":"","dates":["AAAA-MM-JJ"],"heure":"","lieu":"","statut":"valide|possible","source":"msg …","pourquoi":""}],
 "passages": [{"morceau":"nom exact","debut":"m:ss","fin":"m:ss","note":"à quoi il sert","source":"msg …"}],
 "depenses": [{"titre":"","montant":0,"payePar":"Yacine|Pierre|Baptiste","pour":["Yacine","Pierre","Baptiste"],"date":"AAAA-MM-JJ","source":"msg …","pourquoi":""}],
 "tournages": [{"titre":"","type":"Clip|Reel|Shooting photo","morceau":"","date":"AAAA-MM-JJ ou vide","heure":"","lieu":"","idee":"l'idée en une phrase","tenues":"","materiel":"","source":"msg …","pourquoi":""}]
}
Règles : "taches" = ce que quelqu'un doit faire et qui n'est pas déjà fait ni déjà dans la liste existante. "planning" = toutes les dates à venir (décidées = valide, proposées ou hésitantes = possible ; plusieurs jours possibles = plusieurs dates). "passages" = les timings d'un morceau donnés pour un reel ou un tournage (pas les heures de rendez-vous). "depenses" = un paiement réel dit dans les messages (qui a payé, combien), pas déjà dans la liste. "tournages" = les tournages ou shootings prévus qui n'ont pas encore de fiche. Tableaux vides si rien.`;
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
      Object.assign(doc, { texte: r.semaine, afaire: Array.isArray(r.afaire) ? r.afaire : [], dernier, t: Date.now(), nb: recents.filter(l => l.t >= semaine).length });
      await BK.db.ecrire('veille', doc); BK.regler('accueil.resume', { id: 'resume', texte: doc.texte, afaire: doc.afaire, t: doc.t });
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
    // Calendrier
    if (Array.isArray(r.planning)) {
      const doc = (await BK.db.liste('veille')).find(x => x.id === 'planning') || { id: 'planning', l: [] }, ign = new Set(doc.ignores || []);
      doc.l = r.planning.filter(e => e && Array.isArray(e.dates) && e.dates.some(d => /^\d{4}-\d\d-\d\d$/.test(d) && d >= auj))
        .map(e => ({ ...e, cle: [e.type, e.morceau, e.titre, e.dates.join('+')].join('|') })).filter(e => !ign.has(e.cle));
      doc.t = Date.now(); await BK.db.ecrire('veille', doc); nb(doc.l.length, 'date(s) au calendrier');
    }
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
      t.moodboard = [];
      for (const f of imgs) { try { const u = await BK.drive.vignette(f); if (u) t.moodboard.push(await BK.miette.reduire(u)); } catch (e) {} await BK.audio.pause(); }
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
BK.synchro = {
  dernier: new Date(Date.now() - 60e3).toISOString(),
  async tour() {
    if (!BK.drive || !BK.drive.relie() || document.hidden) return;
    try {
      const racine = await BK.drive.racine(), depuis = BK.synchro.dernier, maintenant = new Date().toISOString();
      const r = await (await BK.drive.api('/files?' + new URLSearchParams({ q: `modifiedTime > '${depuis}' and mimeType='application/json' and trashed=false`, fields: 'files(id,name,parents,lastModifyingUser(me))', pageSize: '200' }))).json();
      BK.synchro.dernier = maintenant;
      const parCol = {}; for (const [cle, id] of Object.entries(BK.drive.dossiers)) if (cle.startsWith(racine + '/')) parCol[id] = cle.slice(racine.length + 1);
      const cols = [...new Set((r.files || []).map(f => parCol[(f.parents || [])[0]]).filter(Boolean))];
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
    setInterval(BK.synchro.tour, 40e3);
    window.addEventListener('focus', () => BK.synchro.tour());
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
      config:       ['mediasRecharger'],
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
