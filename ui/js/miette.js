// =====================================================================
// LE BOUTON JAUNE — « Miette relit tout » : Discord + Drive + tous les onglets,
// en UNE seule demande à Gemini (moins de crédits), puis chaque onglet reçoit ses propositions :
//   Accueil (résumé) · To-do (tâches) · Calendrier (dates) · Assistant audio (passages)
//   Budget (dépenses) · Tournages (tournages à créer + moodboards du Drive)
// Rien n'est ajouté sans qu'on valide (sauf le résumé et les moodboards des fiches vides).
// =====================================================================
BK.miette = {
  // ---------- la fenêtre « Miette propose » : des cases à cocher, on garde ce qu'on veut ----------
  // items : [{ apercu?, titre, sous? }] → Promise des items cochés ([] si on annule)
  proposer({ titre, vide = 'Miette n\'a rien trouvé', bouton = 'Ajouter', items = [] }) {
    return new Promise(ok => {
      const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const v = document.createElement('div'); v.className = 'voile';
      v.innerHTML = `<div class="stopbox mi-box"><button class="btn xs rt-x" data-mi="x">✕</button>
        <span class="dymo mi-titre" style="align-self:center"><img src="look/patch-miette.png" alt="">${esc(titre)}</span>
        ${items.length ? `<div class="mi-l">${items.map((x, i) => `<label class="mi-p"><input type="checkbox" data-i="${i}" checked>
            ${x.apercu ? `<span class="mi-ph" style="background-image:url('${esc(x.apercu)}')"></span>` : ''}
            <span class="mi-t"><b>${esc(x.titre)}</b>${x.sous ? `<small>${esc(x.sous)}</small>` : ''}</span></label>`).join('')}</div>
          <span class="nt">Décoche ce qui ne va pas.</span>` : `<span class="nt" style="text-align:center;padding:18px">${esc(vide)}</span>`}
        <div class="stopbox-btns">${items.length ? `<button class="btn pri" data-mi="ok">${esc(bouton)}</button>` : ''}<button class="btn" data-mi="x">${items.length ? 'Annuler' : 'Fermer'}</button></div></div>`;
      document.body.appendChild(v);
      v.onclick = e => { const b = e.target.closest('[data-mi]'); if (!b) return; v.remove();
        ok(b.dataset.mi === 'ok' ? [...v.querySelectorAll('[data-i]:checked')].map(c => items[+c.dataset.i]) : []); };
    });
  },
  // les mots qui désignent un tournage : son titre, son morceau (et ses surnoms)
  motsDe(t, ms) {
    const m = BK.inv.trouverMorceau(t.morceau || '', ms), n = x => BK.inv.normaliser(x || '');
    return [t.titre, ...(m ? [m.nom, ...(m.alias || [])] : [t.morceau])].map(n).filter(x => x && x.length >= 3 && !/^(tournage|shooting|clip|reel|photo)$/.test(x));
  },
  // ---------- MOODBOARD d'un tournage : les images du dossier moodboard du Drive, et celles postées sur Discord ----------
  async moodboardPour(t) {
    const [ms, tous, carte] = await Promise.all([BK.db.liste('morceaux'), BK.dossiers.tousFichiers(), BK.dossiers.carte()]);
    const mots = BK.miette.motsDe(t, ms), parle = x => { const s = BK.inv.normaliser(x); return mots.some(w => s.includes(w)); };
    const deja = new Set(t.moodboard || []), out = [];
    for (const f of tous) {
      if (!/^image\//.test(f.mimeType || '') || deja.has(BK.img.ref(f.id))) continue;
      const p = (f.parents || [])[0]; if (!p) continue;
      const doss = BK.dossiers.ancetres(p, carte).map(a => carte[a].name);
      if (!doss.some(d => /mood/i.test(d))) continue;
      if (!parle(f.name + ' ' + doss.join(' '))) continue;
      out.push({ f, apercu: await BK.drive.vignette(f).catch(() => ''), titre: f.name, sous: '☁ Drive · ' + doss.slice(0, 2).reverse().join(' / ') });
      if (out.length >= 30) break;
    }
    const dc = await BK.discord.mediasVite('media', {}).catch(() => []) || [];
    for (const x of dc) {
      if (x.video || !/\.(jpe?g|png|webp)$/i.test(x.nom || '')) continue;
      if (!/mood|inspi|ref|vibe|ambiance|style/i.test((x.salon || '') + ' ' + (x.texte || ''))) continue;
      if (!parle((x.texte || '') + ' ' + (x.salon || '') + ' ' + x.nom) && !/mood/i.test(x.salon || '')) continue;
      out.push({ dc: x, nom: x.nom, apercu: x.apercu || x.url, titre: (x.texte || x.nom).slice(0, 70), sous: '🍞 Discord · ' + [x.qui, x.salon && '#' + x.salon].filter(Boolean).join(' · ') });
      if (out.length >= 50) break;
    }
    return out;
  },
  // ---------- RÉFÉRENCES d'un tournage : les liens (Instagram, TikTok, YouTube, Pinterest…) donnés sur Discord ----------
  async referencesPour(t) {
    const [ms, j] = await Promise.all([BK.db.liste('morceaux'), BK.discord.journal(6).catch(() => [])]);
    const mots = BK.miette.motsDe(t, ms), deja = new Set((t.references || []).map(r => r.url)), vus = new Set(), out = [];
    const RE = /https?:\/\/[^\s<>")]+/gi, SITES = /instagram\.com|tiktok\.com|youtu\.?be|pinterest\.|vimeo\.com/i;
    for (let i = j.length - 1; i >= 0 && out.length < 40; i--) {
      const l = j[i], txt = String(l.txt || ''), s = BK.inv.normaliser(txt + ' ' + (l.salon || ''));
      const sujet = mots.some(w => s.includes(w)) || /ref|inspi|mood|clip|tournage|shoot/i.test(l.salon || '');
      // un lien seul juste après un message qui parle du tournage compte aussi
      const avant = j[i - 1] ? BK.inv.normaliser(j[i - 1].txt || '') : '';
      if (!sujet && !mots.some(w => avant.includes(w))) continue;
      for (const u of txt.match(RE) || []) {
        if (!SITES.test(u) || deja.has(u) || vus.has(u)) continue; vus.add(u);
        const note = txt.replace(RE, '').replace(/\s+/g, ' ').trim().slice(0, 60);
        out.push({ url: u, note, titre: note || u, sous: `${l.qui || ''} · ${new Date(l.t).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' })} · ${u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 50)}` });
      }
    }
    return out;
  },
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
        try { const r = await BK.discord.ronde(() => {}, true); if (r.messages) bilan.push(r.messages + ' message(s) lus'); if (r.pointes) bilan.push(`🍞 ${r.pointes} message(s) pointé(s) → ${r.ranges || 0} info(s) rangée(s)`); } catch (e) { console.warn(e); }
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
  action: '', actionT: 0, dernierEnvoi: 0, vu: Date.now(),
  // AFK : rien fait (souris, clavier) depuis 20 min → les autres te voient hors ligne
  afk: () => Date.now() - BK.presence.vu > 20 * 60e3,
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
    const absent = parti || BK.presence.afk();
    if (absent && BK.presence._absent && !parti) return;                // déjà dit « hors ligne » : on ne répète pas
    BK.presence._absent = absent;
    try { await BK.db.ecrire('config', { id: 'ici-' + moi.toLowerCase().replace(/[^a-z0-9]+/g, '-'), qui: moi, onglet: o ? o.titre : '', action, t: absent ? 0 : Date.now() }, { sansAnnuler: true }); } catch (e) {}
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
         'inventaires', 'exportsaudio', 'config', 'veille', 'propositions', 'renforts', 'ameliorations', 'notesmix', 'activite'],
  async prevenir() {
    if (!BK.drive || !BK.drive.relie()) return;
    const racine = await BK.drive.racine();
    for (const c of BK.synchro.COLS) { try { await BK.drive.dossier(c, racine); } catch (e) {} }
  },
  demarrer() {
    BK.synchro.prevenir();
    // un seul tempo pour la présence et la synchro (deux appels au Drive, groupés, toutes les 45 s)
    const tic = () => { BK.synchro.tour(); BK.presence.maj(); };
    BK.presence.maj(true);                                           // à l'ouverture : « je suis là »
    // toutes les 15 s quand la fenêtre est devant toi (les changements des autres arrivent presque en direct), sinon toutes les minutes
    let dernierTic = 0; setInterval(() => { const vite = document.hasFocus() && !BK.presence.afk(); if (Date.now() - dernierTic >= (vite ? 15e3 : 60e3)) { dernierTic = Date.now(); tic(); } }, 5e3);
    // on bouge : « je suis là » (et si on était AFK, les autres le voient tout de suite)
    let vuT = 0; const bouge = () => { const etaitAfk = BK.presence.afk(); BK.presence.vu = Date.now(); if (etaitAfk) BK.presence.maj(true); };
    ['pointermove', 'keydown', 'pointerdown', 'wheel'].forEach(t => window.addEventListener(t, () => { const n = Date.now(); if (n - vuT > 2000) { vuT = n; bouge(); } }, { passive: true }));
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
      config:       ['mediasTags', 'agendaRecharger'],
      notesmix:     ['ecouteRecharger', 'biblioRecharger'],      // étiquettes, dispos du Calendrier…
      activite:     ['accueilDerniere', 'journalMaj'],
      renforts:     ['veilleurMaj'],
      ameliorations:['veilleurMaj'],
    };
    window.addEventListener('bk:distant', e => {
      const a = document.activeElement; if (a && (/^(INPUT|TEXTAREA)$/.test(a.tagName) || a.isContentEditable)) return;
      if (e.detail.cols.includes('config') && BK.etiquettes && !BK.etiquettes._min) BK.etiquettes.doc = null;   // (pas pendant un envoi en cours)
      if (e.detail.cols.includes('config')) BK.partageCache = {};        // PLAN.xlsx, passages Discord… relus
      const f = new Set(e.detail.cols.flatMap(c => QUI[c] || []));
      for (const n of f) try { BK[n] && BK[n](); } catch (er) {}
      if (e.detail.cols.some(c => /veille|taches|evenements|propositions|morceaux/.test(c))) try { BK.surOuvrir && BK.surOuvrir.accueil && BK.surOuvrir.accueil(); } catch (er) {}
      if (e.detail.cols.includes('morceaux')) for (const c of ['morceaux']) window.dispatchEvent(new CustomEvent('bk:change', { detail: { col: c, id: '' } }));
    });
  },
};

// =====================================================================
// LE JOURNAL — ce que les membres ont fait (« 10h25 · Pierre a ajouté des notes dans Notes et retours »).
// Une ligne par action (la même action dans l'heure ne fait qu'une ligne). Rangé dans le Drive (collection « activite »).
// =====================================================================
(() => {
  const PHRASES = {
    taches:     (f, n) => [n ? 'a ajouté une tâche dans la To-do list' : f.fait ? 'a coché une tâche dans la To-do list' : 'a modifié une tâche dans la To-do list', f.texte],
    evenements: (f, n) => [n ? 'a ajouté une date dans le Calendrier' : 'a modifié une date dans le Calendrier', f.titre],
    notesmix:   (f, n) => [n ? 'a ajouté des notes dans Notes et retours' : 'a mis à jour des notes dans Notes et retours', ((BK.db.cache.morceaux || {})[f.morceau] || {}).nom],
    morceaux:   (f, n) => [n ? 'a créé une fiche dans la Bibliothèque' : 'a modifié une fiche dans la Bibliothèque', f.nom],
    reels:      (f, n) => [n ? 'a créé un reel dans Reels' : 'a mis à jour un reel dans Reels', f.nom || f.titre],
    tournages:  (f, n) => [n ? 'a ajouté un tournage dans Tournages' : 'a modifié un tournage dans Tournages', f.titre],
    depenses:   (f, n) => [n ? 'a ajouté une dépense dans le Budget' : 'a modifié une dépense dans le Budget', f.quoi || f.titre || f.texte],
  };
  const norme = x => String(x || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '').slice(0, 40);
  BK.journal = async (quoi, onglet, sujet) => {
    const qui = BK.reglage('nomPc', ''); if (!qui) return;
    const h = new Date(), heure = h.toISOString().slice(0, 13);
    const id = 'j-' + norme(qui) + '-' + norme(quoi) + '-' + norme(sujet) + '-' + heure.replace(/\D/g, '');
    try { await BK.db.ecrire('activite', { id, qui, quoi, onglet: onglet || '', sujet: String(sujet || '').slice(0, 80), t: Date.now() }, { sansAnnuler: true }); } catch (e) {}
    BK.accueilDerniere && BK.accueilDerniere();
  };
  // appelé par BK.db.ecrire : seulement ce qu'un membre fait lui-même (pas Miette, pas le logiciel tout seul)
  BK.journalAuto = (col, f, neuf, opts) => {
    const p = PHRASES[col]; if (!p || (opts && (opts.sansAnnuler || opts.graine)) || f.miette || f.graine) return;
    const [quoi, sujet] = p(f, neuf); const ong = { taches: 'taches', evenements: 'agenda', notesmix: 'ecoute', morceaux: 'biblio', reels: 'suivi', tournages: 'tournage', depenses: 'budget' }[col];
    clearTimeout(BK._jt); const k = col + quoi + sujet; if (BK._jk === k && Date.now() - (BK._jkt || 0) < 60e3) return;
    BK._jk = k; BK._jkt = Date.now(); BK.journal(quoi, ong, sujet);
  };
  // les dernières lignes (les plus récentes d'abord) ; les vieilles (plus de 30 jours) partent toutes seules
  BK.journalLire = async () => {
    let l = []; try { l = await BK.db.liste('activite'); } catch (e) {}
    const vieux = l.filter(x => Date.now() - (x.t || 0) > 30 * 864e5).slice(0, 15);
    for (const x of vieux) BK.db.supprimer('activite', x.id).catch(() => {});
    return l.filter(x => !vieux.includes(x)).sort((a, b) => (b.t || 0) - (a.t || 0));
  };
  const hm = d => String(d.getHours()).padStart(2, '0') + 'h' + String(d.getMinutes()).padStart(2, '0');
  BK.journalPhrase = x => { const d = new Date(x.t), auj = new Date().toDateString() === d.toDateString();
    return { quand: (auj ? '' : d.toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ') + hm(d),
      txt: x.qui + ' ' + x.quoi + (x.sujet ? ' · ' + x.sujet : '') }; };
  // la fenêtre « Les updates des membres »
  BK.journalFenetre = async () => {
    const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const v = document.createElement('div'); v.className = 'voile'; v.id = 'jnVoile';
    v.innerHTML = `<div class="stopbox jn-box"><button class="btn xs rt-x" data-j="x" title="Fermer">✕</button><span class="dymo" style="align-self:center">Les updates des membres</span>
      <div class="jn-l" id="jnL"><span class="nt"><span class="spin"></span>…</span></div><div class="stopbox-btns"><button class="btn" data-j="x">Fermer</button></div></div>`;
    document.body.appendChild(v);
    v.onclick = e => { if (e.target === v || e.target.closest('[data-j="x"]')) v.remove(); const o = e.target.closest('[data-va]'); if (o) { v.remove(); BK.ouvrir(o.dataset.va); } };
    const remplir = async () => { const z = document.getElementById('jnL'); if (!z) return; const l = (await BK.journalLire()).slice(0, 120);
      const COUL = { Yacine: '#f1c453', Pierre: '#7ee08a', Baptiste: '#c58af0' };
      let jour = ''; z.innerHTML = l.length ? l.map(x => { const d = new Date(x.t).toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' }), p = BK.journalPhrase(x);
        const t = d !== jour ? `<span class="eng jn-jour">${esc(d)}</span>` : ''; jour = d;
        return t + `<button class="jn-p" data-va="${esc(x.onglet || 'accueil')}" style="--pc:${COUL[x.qui] || '#d9b67a'}"><span class="mono">${hm(new Date(x.t))}</span><b>${esc(x.qui)}</b><span>${esc(x.quoi)}${x.sujet ? ' · <i>' + esc(x.sujet) + '</i>' : ''}</span></button>`; }).join('')
        : '<span class="nt">Rien pour l\'instant. Ce que chacun fait (notes, tâches, dates, reels…) arrive ici.</span>'; };
    BK.journalMaj = remplir; await remplir();
  };
})();
