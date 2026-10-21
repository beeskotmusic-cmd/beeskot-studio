// =====================================================================
// RENFORT AI — 3 volets :
//   Le Veilleur : lit le Discord, propose ce qui a été décidé (✓ / ✕)
//   Question    : on demande « c'est quoi le dernier export de Mother ? »
//   Aides       : idées de reels, légendes, découpage, bio…
// Avec une clé Gemini gratuite tout se fait ici ; sans clé, on copie la
// demande dans ChatGPT ou Gemini (rien à payer dans les deux cas).
// =====================================================================
(() => {
const R = { volet: BK.reglage('renfort.volet', 'question'), salons: [], aideCtx: null };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dateCourte = d => d ? new Date(d.length === 10 ? d + 'T12:00' : d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' }) : '';
const ICONES = { evenement: '📅', export: '🎵', tache: '✅', sortie: '🚀', note: '📝' };
const QUOI = { tournage: 'tournage', enregistrement: 'enreg', repetition: 'repet', shooting: 'shooting', mixage: 'mixage', sortie: 'sortie', publication: 'promo', autre: 'autre' };

const AIDES = {
  amelioration: { nom: '🔧 Améliorer BEESKOT Studio', besoin: 'texte', fiche: true,
    demande: c => `Voici ce qu'un membre du groupe raconte sur le logiciel BEESKOT Studio (problèmes rencontrés, choses pas claires, idées) :\n\n«\u00a0${c.detail}\u00a0»\n\nRange ça en une note courte et nette, en français simple, sous cette forme exacte :\n\nPROBLÈME 1 — <titre court>\nOù : <l'onglet ou l'endroit du logiciel>\nCe qui se passe : <en une phrase>\nCe qu'il faudrait : <la correction ou l'amélioration demandée, en une phrase>\n\n(puis PROBLÈME 2, etc. — une entrée par souci distinct, 5 au maximum)\n\nN'invente rien : si quelque chose n'est pas dit, écris « pas précisé ». Si c'est une idée et pas un problème, écris IDÉE à la place de PROBLÈME.` },
  reels:     { nom: 'Idées de reels', besoin: 'morceau', demande: c => `Propose 8 idées de reels Instagram/TikTok (15 à 30 s) pour le morceau « ${c.morceau} » de BEESKOT. Pour chaque idée : le concept en une phrase, le passage du morceau à utiliser, ce qu'on filme, et un texte à l'écran court. Idées faisables avec peu de moyens, au studio.` },
  legende:   { nom: 'Légende Insta / TikTok', besoin: 'morceau', demande: c => `Écris 5 légendes courtes pour un post Instagram/TikTok sur le morceau « ${c.morceau} » de BEESKOT${c.detail ? ' (contexte : ' + c.detail + ')' : ''}. Ton naturel, pas trop marketing, 1 ou 2 emojis maximum, et 8 hashtags pertinents à la fin de chaque proposition.` },
  decoupage: { nom: 'Découpage d\'un tournage', besoin: 'tournage', json: true, demande: c => `Propose un découpage technique pour ce tournage de BEESKOT : « ${c.tournage.titre} » (${c.tournage.type || 'clip'})${c.tournage.morceau ? ', morceau « ' + c.tournage.morceau + ' »' : ''}${c.tournage.idee ? ', idée : ' + c.tournage.idee : ''}${c.tournage.lieu ? ', lieu : ' + c.tournage.lieu : ''}. 8 à 14 plans. Réponds en JSON : un tableau d'objets {"cadrage":"Plan large|Plan moyen|Plan américain|Gros plan|Très gros plan|Plan d'ensemble|Insert|Plongée|Contre-plongée|Travelling","action":"ce qu'on voit","duree":"ex. 4 s","notes":"lumière, mouvement…"}.` },
  bio:       { nom: 'Bio / pitch du groupe', besoin: '', demande: c => `Écris une bio du groupe BEESKOT en 3 versions : très courte (1 phrase), courte (50 mots), longue (150 mots), pour un distributeur et les plateformes de streaming.${c.detail ? ' Infos à utiliser : ' + c.detail : ''}` },
  youtube:   { nom: 'Description YouTube', besoin: 'morceau', demande: c => `Écris la description YouTube du clip « ${c.morceau} » de BEESKOT : 2 phrases d'accroche, les crédits à compléter, les liens à mettre (placeholders), et 10 mots-clés.${c.detail ? ' Contexte : ' + c.detail : ''}` },
  promo:     { nom: 'Plan de promo', besoin: 'morceau', demande: c => `Fais un plan de promo sur 4 semaines pour la sortie du morceau « ${c.morceau} » de BEESKOT${c.sortie ? ' (sortie le ' + c.sortie + ')' : ''} : une publication tous les 2 ou 3 jours, avec pour chacune la date, le format (reel, story, carrousel…) et l'idée.` },
  paroles:   { nom: 'Relire les paroles', besoin: 'morceau', demande: c => `Relis ces paroles du morceau « ${c.morceau} » : corrige seulement l'orthographe et la ponctuation, sans changer le style ni les mots. Rends le texte corrigé, puis la liste des corrections.\n\n${c.paroles || '(paroles vides : remplis-les dans la Bibliothèque)'}` },
  libre:     { nom: 'Demande libre', besoin: '', demande: c => c.detail || '' },
};

BK.module('renforts', function (page) {
  $('.sub', page).textContent = 'Discord, questions, aides';
  $('.hdr .right', page).innerHTML = `<div><span class="eng" style="font-size:9px">À valider</span><span class="vfd" id="raNb">00</span></div>
    <div><span class="eng" style="font-size:9px">Gemini</span><span class="vfd" id="raGem">—</span></div>`;
  $('.grid', page).innerHTML = `
    <div class="cols">
      <section class="pane vit ra-vit">
        <div class="seg ra-volets" id="raVolets"><button data-v="question">Poser une question</button><button data-v="aides">Aides</button><button data-v="veilleur">🍞 Miette</button></div>
        <div class="ra-volet" id="raVolet"></div>
      </section>
      <section class="pane reg ra-reg" style="width:320px"><span class="ptitle">② Historique</span>
        <input class="fld" id="raHistQ" placeholder="chercher dans l'historique…" autocomplete="off">
        <div class="ra-hist" id="raHist"></div>
        <button class="btn sm" id="raVersReglages" style="margin-top:6px;align-self:flex-start">⚙ Clé Gemini, bot Discord, modèle</button>
      </section>
    </div>
    <div class="pane abar"><span class="vfd" id="raMsg">PRÊT</span></div>`;
  const msg = t => { const x = String(t).toUpperCase().slice(0, 90); $('#raMsg').textContent = x; const r = $('#rgMsg'); if (r) r.textContent = x; };
  // les réglages (clé Gemini, bot Discord, modèle) vivent dans l'onglet Réglages
  const reg = document.createElement('div'); reg.className = 'ra-reglages'; reg.id = 'raReglages';
  reg.innerHTML = `<span class="lb" style="margin:6px 0 4px">🍞 Miette</span><div class="box"><span class="lb">Clé Gemini (gratuite)</span>
          <span class="nt">Créée avec le Gmail BEESKOT sur Google AI Studio. Rangée dans votre Drive : tous les PC l'ont.</span>
          <input class="fld" id="raCle" type="password" placeholder="colle la clé ici" autocomplete="off" style="margin-top:8px">
          <div class="chips" style="margin-top:8px"><button class="chip" id="raCleOk">Enregistrer et tester</button></div>
          <span class="eng" style="font-size:9px;margin-top:10px">Modèle</span>
          <div class="chips" id="raNiveau" style="margin-top:6px">${Object.entries(BK.ia.NIVEAUX).map(([k, n]) => `<button class="chip" data-niv="${k}">${n}</button>`).join('')}</div>
          <span class="nt" id="raNivTxt"></span></div>
        <div class="box"><span class="lb">Bot Discord (lecture seule)</span>
          <input class="fld" id="raJeton" type="password" placeholder="colle le code du bot ici" autocomplete="off" style="margin-top:8px">
          <div class="chips" style="margin-top:8px"><button class="chip" id="raSalonsB">Enregistrer et chercher les salons</button></div>
          <div class="ra-salons" id="raSalons"></div></div>
        <div class="box"><span class="lb">À savoir</span><span class="nt">Avec la clé gratuite, Google peut se servir des messages envoyés pour améliorer Gemini. N'y mettez rien de secret.</span></div>
`;
  document.body.appendChild(reg); reg.classList.add('hidden');
  function placerReglages() { const cible = $('#p-reglages .pane.reg'); if (cible && reg.parentElement !== cible) { cible.appendChild(reg); reg.classList.remove('hidden'); } }
  setTimeout(placerReglages, 0); setTimeout(placerReglages, 1500);
  $('#raVersReglages').onclick = e => { e.preventDefault(); placerReglages(); BK.ouvrir('reglages'); setTimeout(() => reg.scrollIntoView({ behavior: 'smooth' }), 100); };

  const NIV_TXT = { rapide: 'Rapide : répond en quelques secondes, un peu moins fin.', normal: 'Normal : le bon équilibre (conseillé).', puissant: 'Puissant : plus intelligent mais plus lent, et la version gratuite en permet peu par jour.' };
  async function majEtat() {
    BK.ia.conf = null; const c = await BK.ia.config();
    $$('#raNiveau .chip').forEach(b => b.classList.toggle('on', b.dataset.niv === (c.niveau || 'normal')));
    $('#raNivTxt').textContent = NIV_TXT[c.niveau || 'normal'] + ((c.modeles || {})[c.niveau || 'normal'] ? ' (' + c.modeles[c.niveau || 'normal'].nom + ')' : '');
    $('#raGem').textContent = !BK.ia.active() ? 'COUPÉE' : c.gemini ? 'PRÊT' : 'SANS CLÉ';
    $('#raCle').placeholder = c.gemini ? '•••••••• (clé enregistrée)' : 'colle la clé ici';
    const d = await BK.discord.config();
    $('#raJeton').placeholder = d.jeton ? '•••••••• (code enregistré)' : 'colle le code du bot ici';
    R.discord = d; rendreSalons();
    const n = (await BK.db.liste('propositions')).filter(p => p.statut === 'attente').length;
    $('#raNb').textContent = String(n).padStart(2, '0');
  }

  function volet(v) {
    R.volet = v; BK.regler('renfort.volet', v);
    $$('#raVolets button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
    ({ veilleur: rendreVeilleur, question: rendreQuestion, aides: rendreAides })[v]();
  }
  $$('#raVolets button').forEach(b => b.onclick = () => volet(b.dataset.v));

  // ================= LE VEILLEUR =================
  async function rendreVeilleur() {
    const z = $('#raVolet'), d = await BK.discord.config(), pret = await BK.ia.pret();
    const verrou = (await BK.db.liste('config')).find(x => x.id === 'veilleur');
    const props = (await BK.db.liste('propositions')).sort((a, b) => (b.vu || '').localeCompare(a.vu || ''));
    const att = props.filter(p => p.statut === 'attente'), faites = props.filter(p => p.statut === 'ok').slice(0, 12);
    $('#raNb').textContent = String(att.length).padStart(2, '0');
    const manque = !d.jeton ? 'Colle le code du bot Discord dans Réglages.' : !(d.salons || []).length ? 'Choisis les salons à lire dans Réglages.' : '';
    const sansGemini = d.jeton && (d.salons || []).length && !pret ? ' Sans clé Gemini, Miette lit seulement les messages de Cracotte APP : ajoute la clé dans Réglages pour qu\'elle comprenne aussi vos conversations.' : '';
    z.innerHTML = `
      <div class="box ra-etat"><div class="ligne-titre"><span class="lb">🍞 Miette, la bot Discord</span>
          <button class="btn sm pri" id="raRonde" style="margin-left:auto"${!d.jeton || !(d.salons || []).length ? ' disabled' : ''}>↻ Lire Discord maintenant</button>
          <button class="btn sm" id="raTout"${!d.jeton || !(d.salons || []).length ? ' disabled' : ''} title="Relit TOUT l'historique des salons, puis Gemini range tout : rendez-vous, exports, tâches, et un résumé dans chaque fiche">🧹 Grand rangement</button></div>
        <span class="nt">${manque || `Miette lit ${d.salons.length} salon(s) toutes les 30 min quand le logiciel est ouvert, et te propose ce qui a été décidé.${sansGemini}${verrou && verrou.passage ? ` Dernière lecture : ${new Date(verrou.passage).toLocaleString('fr-CA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} (${esc(verrou.par || '')}).` : ''}`}</span></div>
      <div class="box grow ra-props"><span class="lb">À valider (${att.length})</span>
        ${att.length ? att.map(p => carte(p, true)).join('') : '<span class="nt" style="padding:14px 0">Rien à valider pour l\'instant.</span>'}
        ${faites.length ? `<span class="lb" style="margin-top:14px">Déjà ajouté</span>${faites.map(p => carte(p, false)).join('')}` : ''}</div>`;
    const rt = $('#raTout'); if (rt) rt.onclick = async () => {
      if (!confirm('Grand rangement : Miette relit TOUT l\'historique des salons cochés, puis Gemini range tout (ça peut prendre plusieurs minutes, le logiciel reste utilisable). On y va ?')) return;
      rt.disabled = true; rt.innerHTML = '<span class="spin"></span>Rangement…';
      try { const n = await BK.discord.toutRelire(msg); msg(n + ' ancien(s) message(s) ajoutés au journal'); const p = await BK.discord.ranger(msg);
        await BK.discord.resume(true); msg(`Rangement fini ✓ · ${p} proposition(s) · résumé ajouté dans les fiches`); }
      catch (e) { msg(e.message); }
      rendreVeilleur();
    };
    const rb = $('#raRonde'); if (rb) rb.onclick = async () => {
      rb.disabled = true; rb.innerHTML = '<span class="spin"></span>Lecture…';
      try { const r = await BK.discord.ronde(msg, true); msg(r.messages ? `${r.messages} message(s) lus · ${r.propositions || 0} proposition(s)` : 'Aucun nouveau message'); BK.discord.resume(!!r.messages).catch(() => {}); }
      catch (e) { msg(e.message); }
      rendreVeilleur();
    };
    $$('[data-ok]', z).forEach(b => b.onclick = () => appliquer(props.find(p => p.id === b.dataset.ok)));
    $$('[data-non]', z).forEach(b => b.onclick = async () => { const p = props.find(x => x.id === b.dataset.non); p.statut = 'non'; await BK.db.ecrire('propositions', p); rendreVeilleur(); });
    $$('.ra-lien', z).forEach(a => a.onclick = e => { e.preventDefault(); BK.ouvrirLien(a.dataset.url); });
  }
  function carte(p, actions) {
    const titre = p.type === 'evenement' ? `${p.titre || p.quoi} · ${dateCourte(p.date)}${p.heure ? ' ' + p.heure : ''}${p.lieu ? ' · ' + p.lieu : ''}`
      : p.type === 'export' ? `${p.morceau} : ${p.fichier || 'nouvel export'}${p.date ? ' (' + dateCourte(p.date) + ')' : ''}`
      : p.type === 'tache' ? `${p.texte}${p.qui ? ' → ' + p.qui : ''}`
      : p.type === 'sortie' ? `Sortie de ${p.morceau} : ${dateCourte(p.date)}` : `${p.morceau ? p.morceau + ' : ' : ''}${p.texte}`;
    const ou = { evenement: 'au Calendrier', export: 'dans la fiche du morceau', tache: 'à la To-do list', sortie: 'dans la fiche du morceau', note: 'aux notes du morceau' }[p.type] || '';
    return `<div class="ra-prop${actions ? '' : ' faite'}"><span class="ra-ic">${ICONES[p.type] || '•'}</span>
      <div class="ra-c"><b>${esc(titre)}</b><span class="nt">${esc(p.pourquoi || '')}${p.source ? ` · <a href="#" class="ra-lien" data-url="${esc(lienSource(p))}">voir le message</a>` : ''}</span></div>
      ${actions ? `<button class="btn xs pri" data-ok="${p.id}" title="Ajouter ${ou}">✓ Ajouter</button><button class="btn xs" data-non="${p.id}" title="Ignorer">✕</button>` : '<span class="nt">✓</span>'}</div>`;
  }
  function lienSource(p) { return p.lien || (R.journal || []).find(l => l.id === String(p.source).replace(/\D/g, ''))?.lien || 'https://discord.com/channels/@me'; }

  async function appliquer(p) {
    try {
      const ms = await BK.db.liste('morceaux'), m = ms.find(x => x.nom.toLowerCase() === String(p.morceau || '').toLowerCase());
      if (p.type === 'evenement') await BK.db.ecrire('evenements', { type: QUOI[p.quoi] || 'autre', titre: p.titre || '', morceau: m ? m.nom : '', date: p.date, heure: p.heure || '', lieu: p.lieu || '', discord: p.source });
      if (p.type === 'tache') await BK.db.ecrire('taches', { texte: p.texte, qui: ['Yacine', 'Pierre', 'Baptiste'].includes(p.qui) ? p.qui : '', fait: false, ordre: Date.now() });
      if (p.type === 'export' || p.type === 'sortie' || p.type === 'note') {
        if (!m && p.type !== 'note') return msg('Morceau inconnu : crée d\'abord sa fiche');
        if (p.type === 'export') (m.exportsDiscord = m.exportsDiscord || []).unshift({ fichier: p.fichier, date: p.date, detail: p.detail || '', lien: lienSource(p) });
        if (p.type === 'sortie') m.sortie = p.date;
        if (p.type === 'note' && m) m.notes = (m.notes ? m.notes + '\n' : '') + `[Discord ${dateCourte(p.date || p.vu)}] ${p.texte}`;
        if (m) await BK.db.ecrire('morceaux', m);
      }
      p.statut = 'ok'; await BK.db.ecrire('propositions', p);
      BK.agendaRecharger && BK.agendaRecharger(); BK.tachesRecharger && BK.tachesRecharger();
      msg('Ajouté ✓'); rendreVeilleur();
    } catch (e) { msg(e.message); }
  }
  BK.veilleurMaj = () => { if (R.volet === 'veilleur' && !page.classList.contains('hidden')) rendreVeilleur(); majEtat(); };

  // ================= QUESTION =================
  function rendreQuestion() {
    $('#raVolet').innerHTML = `
      <div class="box"><span class="lb">Ta question</span>
        <textarea class="fld" id="raQ" rows="3" placeholder="ex. On a validé quel jour pour le tournage de Mother ?"></textarea>
        <div class="chips" style="margin-top:8px">${['Quel est le dernier export de chaque morceau ?', 'On a validé quel jour pour le prochain tournage ?', 'Qu\'est-ce qui reste à faire avant la sortie ?', 'Qu\'est-ce qu\'on s\'est dit cette semaine ?']
          .map(q => `<button class="chip ra-ex">${q}</button>`).join('')}</div>
        <div class="chips" style="margin-top:10px"><button class="btn pri" id="raDemQ">Demander</button></div></div>
      <div class="box grow"><span class="lb">Réponse</span><div class="ra-rep" id="raRep"><span class="nt">Miette cherche dans le journal Discord et dans le logiciel (fiches, tâches, calendrier).</span></div></div>`;
    $$('.ra-ex').forEach(b => b.onclick = () => { $('#raQ').value = b.textContent; });
    $('#raQ').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#raDemQ').click(); } });
    $('#raDemQ').onclick = async (e, forcer) => {
      const q = $('#raQ').value.trim(); if (!q) return;
      // déjà posée aujourd'hui ? on remontre la réponse (pas besoin de redemander à Gemini)
      const deja = !forcer && (await historique()).find(h => h.type === 'question' && norm(h.q) === norm(q) && Date.now() - new Date(h.t) < 12 * 36e5);
      if (deja) { $('#raRep').innerHTML = `<div class="ra-texte">${esc(deja.r)}</div><span class="nt">Déjà demandé ${new Date(deja.t).toLocaleString('fr-CA', { weekday: 'short', hour: '2-digit', minute: '2-digit' })} · <a href="#" id="raRedem">redemander</a></span>`;
        $('#raRedem').onclick = ev => { ev.preventDefault(); $('#raDemQ').onclick(null, true); }; return; }
      if (!await BK.ia.pret()) return sansCle(`${await BK.ia.contexte()}\n\nJournal Discord :\n${BK.discord.texte((await BK.discord.journal(2)).slice(-600))}\n\nQuestion : ${q}`);
      const t0 = Date.now(), tic = setInterval(() => { const z = $('#raRep .ra-attente'); if (z) z.textContent = `Je cherche… ${Math.round((Date.now() - t0) / 1000)} s`; }, 1000);
      $('#raRep').innerHTML = '<span class="nt"><span class="spin"></span><span class="ra-attente">Je cherche…</span></span>';
      try { const r = await BK.discord.question(q); $('#raRep').innerHTML = `<div class="ra-texte">${esc(r)}</div><span class="nt">Réponse en ${Math.round((Date.now() - t0) / 1000)} s</span>`;
        await garder({ type: 'question', q, r }); }
      catch (e) { $('#raRep').innerHTML = `<span class="nt">${esc(e.message)}</span>`; }
      clearInterval(tic);
    };
  }

  // ================= AIDES =================
  async function rendreAides() {
    const ms = (await BK.db.liste('morceaux')).sort((a, b) => a.nom.localeCompare(b.nom)), tos = await BK.db.liste('tournages');
    const choix = R.aideCtx ? R.aideCtx.aide : BK.reglage('renfort.aide', 'reels');
    $('#raVolet').innerHTML = `
      <div class="box"><span class="lb">Quelle aide ?</span>
        <div class="chips" style="margin-top:8px" id="raAides">${Object.entries(AIDES).map(([k, a]) => `<button class="chip${k === choix ? ' on' : ''}" data-a="${k}">${a.nom}</button>`).join('')}</div>
        <div class="ra-champs">
          <label id="raMorceauL"><span class="eng">Morceau</span><select class="fld" id="raMorceau">${ms.map(m => `<option value="${m.id}">${esc(m.nom)}</option>`).join('')}</select></label>
          <label id="raTournageL"><span class="eng">Tournage</span><select class="fld" id="raTournage">${tos.map(t => `<option value="${t.id}"${R.aideCtx && R.aideCtx.tournage && R.aideCtx.tournage.id === t.id ? ' selected' : ''}>${esc(t.titre)}</option>`).join('')}</select></label>
          <label class="large" id="raDetailL"><span class="eng">Précisions (facultatif)</span><input class="fld" id="raDetail" placeholder="ex. ambiance, public visé, ce que vous voulez éviter…"></label>
          <label class="large hidden" id="raTexteL"><span class="eng">Raconte ce qui ne va pas (ou ce qui manque)</span>
            <textarea class="fld" id="raTexte" rows="4" placeholder="ex. Dans Médias, quand je clique sur une photo, je ne comprends pas où elle part…"></textarea>
            <div class="chips" style="margin-top:8px"><button class="btn sm" id="raMicro">🎤 Dicter</button><span class="nt" id="raMicroT" style="margin:0"></span></div></label></div>
        <div class="chips" style="margin-top:10px"><button class="btn pri" id="raGo">Demander</button></div></div>
      <div class="box grow"><div class="ligne-titre"><span class="lb">Réponse</span>
          <button class="btn xs hidden" id="raCopier" style="margin-left:auto">Copier</button><button class="btn xs hidden" id="raMettre">Mettre dans le découpage</button></div>
        <div class="ra-rep" id="raRep"><span class="nt">Choisis une aide, puis « Demander ».</span></div></div>`;
    const maj = () => { const a = AIDES[$('#raAides .on').dataset.a];
      $('#raMorceauL').classList.toggle('hidden', a.besoin !== 'morceau'); $('#raTournageL').classList.toggle('hidden', a.besoin !== 'tournage');
      $('#raTexteL').classList.toggle('hidden', a.besoin !== 'texte'); $('#raDetailL').classList.toggle('hidden', a.besoin === 'texte');
      $('#raGo').textContent = a.besoin === 'texte' ? 'Ranger en note' : 'Demander';
      if (a.besoin === 'texte') listeAmeliorations(); };
    $$('#raAides .chip').forEach(c => c.onclick = () => { $$('#raAides .chip').forEach(x => x.classList.toggle('on', x === c)); BK.regler('renfort.aide', c.dataset.a); maj(); });
    maj(); R.aideCtx = null;
    $('#raDetail').addEventListener('keydown', e => e.stopPropagation());
    $('#raTexte').addEventListener('keydown', e => e.stopPropagation());
    // 🎤 dicter : on parle, Miette écrit dans la case
    $('#raMicro').onclick = async () => {
      const b = $('#raMicro'), t = $('#raMicroT');
      if (BK.dicter.enCours()) {
        b.textContent = '🎤 Dicter'; b.classList.remove('pri'); t.textContent = 'Miette écoute ce que tu as dit…';
        try { const txt = await BK.dicter.arreter(); const z = $('#raTexte'); z.value = (z.value ? z.value.trim() + '\n' : '') + txt; t.textContent = 'Écrit ✓'; }
        catch (e) { t.textContent = e.message; }
        return;
      }
      if (!await BK.ia.pret()) return msg('La dictée a besoin de la clé Gemini et de l\'AI allumée');
      try { await BK.dicter.demarrer(); b.textContent = '⏹ Arrêter'; b.classList.add('pri'); t.textContent = 'Parle, puis clique « Arrêter »'; }
      catch (e) { t.textContent = e.message; }
    };
    // les notes déjà enregistrées (partagées avec tout le groupe)
    async function listeAmeliorations() {
      const l = (await BK.db.liste('ameliorations')).sort((a, b) => (b.quand || '').localeCompare(a.quand || ''));
      const att = l.filter(x => !x.fait);
      if (!att.length) return $('#raRep').innerHTML = '<span class="nt">Raconte ce qui ne va pas, puis « Ranger en note ». Les notes du groupe s\'affichent ici.</span>';
      $('#raRep').innerHTML = `<div class="ligne-titre"><span class="lb">${att.length} note(s) à transmettre</span>
          <button class="btn xs pri" id="raAmCop" style="margin-left:auto">Tout copier pour Dari</button></div>`
        + att.map(x => `<div class="ra-am"><div class="ra-texte">${esc(x.texte)}</div>
            <span class="nt">${esc(x.par)} · ${new Date(x.quand).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' })}</span>
            <button class="btn xs" data-amx="${x.id}" title="Réglé : retirer de la liste">✓ Réglé</button></div>`).join('');
      $('#raAmCop').onclick = async () => { const txt = att.map(x => `— ${x.par} (${new Date(x.quand).toLocaleDateString('fr-CA')}) —\n${x.texte}`).join('\n\n');
        try { await navigator.clipboard.writeText(txt); msg('Copié : colle-le à Claude'); } catch (e) { msg('Copie impossible'); } };
      $$('[data-amx]', $('#raRep')).forEach(b => b.onclick = async () => { const x = l.find(y => y.id === b.dataset.amx); x.fait = true; await BK.db.ecrire('ameliorations', x); listeAmeliorations(); });
    }
    $('#raGo').onclick = async () => {
      const k = $('#raAides .on').dataset.a, a = AIDES[k], m = ms.find(x => x.id === $('#raMorceau').value), t = tos.find(x => x.id === $('#raTournage').value);
      if (a.besoin === 'tournage' && !t) return msg('Crée d\'abord un tournage');
      const detail = a.besoin === 'texte' ? $('#raTexte').value.trim() : $('#raDetail').value.trim();
      if (a.besoin === 'texte' && !detail) { $('#raTexte').focus(); return msg('Raconte d\'abord ce qui ne va pas'); }
      const demande = a.demande({ morceau: m && m.nom, paroles: m && m.paroles, sortie: m && m.sortie, tournage: t, detail });
      if (!demande) return msg('Écris ta demande dans « Précisions »');
      if (!await BK.ia.pret()) return sansCle(`${await BK.ia.contexte()}\n\n${demande}`);
      $('#raRep').innerHTML = '<span class="nt"><span class="spin"></span>Miette réfléchit…</span>';
      try {
        const r = await BK.ia.demander(`${await BK.ia.contexte()}\n\n${demande}`, { json: !!a.json, systeme: 'Tu aides le groupe de musique BEESKOT. Réponds en français, simplement.' });
        if (a.json) {
          const plans = Array.isArray(r) ? r : r.plans || [];
          $('#raRep').innerHTML = `<table class="to-plans"><tr><th>#</th><th>Cadrage</th><th>Ce qu'on voit</th><th>Durée</th><th>Notes</th></tr>${plans.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.cadrage)}</td><td>${esc(p.action)}</td><td>${esc(p.duree)}</td><td>${esc(p.notes)}</td></tr>`).join('')}</table>`;
          $('#raMettre').classList.remove('hidden');
          $('#raMettre').onclick = async () => { t.plans = [...(t.plans || []), ...plans.map(p => ({ cadrage: p.cadrage || '', action: p.action || '', duree: p.duree || '', notes: p.notes || '' }))];
            await BK.db.ecrire('tournages', t); BK.tournagesRecharger && BK.tournagesRecharger(); msg('Ajouté au découpage ✓'); };
        } else {
          $('#raRep').innerHTML = `<div class="ra-texte">${esc(r)}</div>`;
          if (a.fiche) { await BK.db.ecrire('ameliorations', { texte: r, brut: detail, par: BK.reglage('nomPc', '') || 'ce PC', quand: new Date().toISOString(), fait: false });
            msg('Note enregistrée : Dari la verra'); listeAmeliorations(); }
          garder({ type: 'aide', q: a.nom + (m && a.besoin === 'morceau' ? ' · ' + m.nom : '') + ($('#raDetail').value.trim() ? ' · ' + $('#raDetail').value.trim() : ''), r });
          $('#raCopier').classList.remove('hidden'); $('#raCopier').onclick = async () => { await navigator.clipboard.writeText(r); msg('Copié'); };
        }
      } catch (e) { $('#raRep').innerHTML = `<span class="nt">${esc(e.message)}</span>`; }
    };
  }
  // ---------- l'historique : toutes les questions et réponses, gardées dans le Drive (tout le groupe les voit) ----------
  const norm = t => BK.inv.normaliser(t || '').replace(/\s+/g, ' ').trim();
  async function historique() { return (await BK.db.liste('renforts')).filter(h => h.q).sort((a, b) => (b.t || '').localeCompare(a.t || '')); }
  async function garder(h) { await BK.db.ecrire('renforts', { ...h, t: new Date().toISOString(), par: BK.reglage('nomPc', '') || 'CE PC' }); rendreHist(); }
  BK.renfortGarder = garder;
  async function rendreHist() {
    const f = norm($('#raHistQ').value), l = (await historique()).filter(h => !f || norm(h.q + ' ' + h.r).includes(f));
    $('#raHist').innerHTML = l.length ? l.slice(0, 200).map(h => `<button class="ra-h" data-h="${h.id}"><span class="ra-h-t">${h.type === 'aide' ? '✨' : h.type === 'legende' ? '✍' : h.type === 'resume' ? '🍞' : '❓'} ${esc(h.q)}</span>
        <span class="nt">${new Date(h.t).toLocaleString('fr-CA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${esc(h.par || '')}</span></button>`).join('')
      : '<span class="nt">Aucune question pour l\'instant. Elles seront toutes gardées ici.</span>';
    $$('#raHist .ra-h').forEach(b => b.onclick = async () => {
      const h = (await historique()).find(x => x.id === b.dataset.h); if (!h) return;
      volet('question'); $('#raQ').value = h.type === 'question' ? h.q : '';
      $('#raRep').innerHTML = `<span class="eng" style="font-size:9px">${esc(h.q)}</span><div class="ra-texte">${esc(typeof h.r === 'string' ? h.r : JSON.stringify(h.r, null, 1))}</div>
        <span class="nt">${new Date(h.t).toLocaleString('fr-CA')} · ${esc(h.par || '')}</span><div class="chips"><button class="chip" id="raHistCopier">Copier</button></div>`;
      $('#raHistCopier').onclick = async () => { await navigator.clipboard.writeText(typeof h.r === 'string' ? h.r : JSON.stringify(h.r)); msg('Copié'); };
    });
  }
  $('#raHistQ').oninput = rendreHist; $('#raHistQ').addEventListener('keydown', e => e.stopPropagation());

  BK.renfortDemander = (aide, ctx) => { R.aideCtx = { aide, ...ctx }; R.volet = 'aides'; BK.ouvrir('renforts'); };

  // sans clé : on copie la demande et on ouvre ChatGPT ou Gemini
  async function sansCle(texte) {
    try { await navigator.clipboard.writeText(texte); } catch (e) {}
    $('#raRep').innerHTML = `<div class="ra-sans"><span class="nt">Pas encore de clé Gemini : <b>la demande est copiée</b>. Ouvre un assistant, colle (Ctrl + V), puis envoie.</span>
      <div class="chips"><button class="btn sm" data-url="https://gemini.google.com/app">Ouvrir Gemini</button><button class="btn sm" data-url="https://chatgpt.com/">Ouvrir ChatGPT</button></div></div>`;
    $$('#raRep [data-url]').forEach(b => b.onclick = () => BK.ouvrirLien(b.dataset.url));
    msg('Demande copiée');
  }

  // ================= RÉGLAGES =================
  $('#raCle').addEventListener('keydown', e => e.stopPropagation());
  $('#raJeton').addEventListener('keydown', e => e.stopPropagation());
  $('#raCleOk').onclick = async () => {
    const k = $('#raCle').value.trim(); if (!k && !(await BK.ia.pret())) return msg('Colle d\'abord la clé');
    if (k) await BK.ia.enregistrer({ gemini: k, modeles: {} }); $('#raCle').value = '';
    msg('Test de Gemini…');
    try { const r = await BK.ia.demander('Réponds seulement : OK', { temperature: 0 }); msg(/ok/i.test(r) ? 'Gemini répond ✓ (' + (await BK.ia.modele()) + ')' : 'Réponse : ' + r); BK.discord.resume().catch(() => {}); }
    catch (e) { msg(e.message); }
    await majEtat(); if (R.volet === 'veilleur') rendreVeilleur();
  };
  $$('#raNiveau .chip').forEach(b => b.onclick = async () => { await BK.ia.enregistrer({ niveau: b.dataset.niv }); msg('Modèle : ' + BK.ia.NIVEAUX[b.dataset.niv]); await BK.ia.modele(b.dataset.niv).catch(() => {}); majEtat(); });
  $('#raSalonsB').onclick = async () => {
    const j = $('#raJeton').value.trim(), d = await BK.discord.config(), jeton = j || d.jeton;
    if (!jeton) return msg('Colle d\'abord le code du bot');
    msg('Recherche des salons…');
    try {
      R.salons = await BK.discord.salons(jeton);
      if (j) await BK.discord.enregistrer({ jeton: j }); $('#raJeton').value = '';
      if (!(d.salons || []).length && R.salons.length) {          // 1re fois : on coche les salons utiles (modifiable)
        const utiles = /^(g[ée]n[ée]ral|vrac|[ée]v[ée]nements|tournage|logistique|projets_able|maquettes|media|outfits|annonces|drum-record|\d+_.+)$/i;
        await BK.discord.enregistrer({ salons: R.salons.filter(x => utiles.test(x.nom)) });
      }
      msg(R.salons.length ? R.salons.length + ' salon(s) trouvés : coche ceux à lire' : 'Aucun salon : invite le bot sur votre serveur');
    } catch (e) { msg(e.message); }
    await majEtat(); if (R.volet === 'veilleur') rendreVeilleur();
  };
  function rendreSalons() {
    const d = R.discord || {}, choisis = new Set((d.salons || []).map(s => s.id));
    const liste = R.salons.length ? R.salons : (d.salons || []);
    const utile = n => /mail|fiverr|ing|annonce|g[ée]n[ée]ral|vrac|[ée]v[ée]nement|logistique|tournage|projet|maquette|id[ée]e/i.test(n);
    const oublies = liste.filter(s => !choisis.has(s.id) && /mail|fiverr/i.test(s.nom));
    $('#raSalons').innerHTML = (oublies.length ? `<span class="nt" style="color:#ffb23e">⚠ Coche ${oublies.map(s => '#' + esc(s.nom)).join(', ')} : c'est là qu'arrivent les mails (ingé son, factures). Miette en a besoin pour les résumés et le calendrier.</span>` : '')
      + liste.map(s => `<label class="ra-salon${utile(s.nom) ? ' utile' : ''}"><input type="checkbox" data-s="${s.id}"${choisis.has(s.id) ? ' checked' : ''}><span>#${esc(s.nom)}</span><em>${esc(s.serveur || '')}</em></label>`).join('');
    $$('#raSalons [data-s]').forEach(c => c.onchange = async () => {
      const tous = R.salons.length ? R.salons : (d.salons || []);
      const sel = $$('#raSalons [data-s]').filter(x => x.checked).map(x => tous.find(s => s.id === x.dataset.s)).filter(Boolean);
      R.discord = await BK.discord.enregistrer({ salons: sel }); msg(sel.length + ' salon(s) suivis'); if (R.volet === 'veilleur') rendreVeilleur();
    });
  }

  window.addEventListener('bk:ia', () => majEtat());
  BK.surOuvrir = BK.surOuvrir || {};
  BK.surOuvrir.renforts = async () => { rendreHist(); R.journal = await BK.discord.journal(3).catch(() => []); await majEtat(); volet(R.volet); };
  majEtat(); volet(R.volet);
});
})();
