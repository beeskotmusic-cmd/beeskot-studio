// =====================================================================
// LE VEILLEUR — lit le Discord BEESKOT (un « bot » en lecture seule),
// garde un journal des messages, et demande à Gemini ce qui a été décidé.
// Il PROPOSE (rendez-vous, exports, tâches, dates de sortie, notes) :
// rien n'est changé sans un clic « ✓ ».
// Pas de serveur : c'est BEESKOT Studio qui lit, quand il est ouvert.
// =====================================================================
BK.discord = {
  API: 'https://discord.com/api/v10',
  fetch(url, o) { return (BK.T && BK.T.http ? BK.T.http.fetch : window.fetch)(url, o); },
  async config() { return (await BK.db.liste('config')).find(x => x.id === 'discord') || { id: 'discord', jeton: '', salons: [], dernier: {} }; },
  async enregistrer(champs) { const c = { ...(await BK.discord.config()), ...champs }; await BK.db.ecrire('config', c); return c; },

  async api(chemin, jeton) {
    for (let essai = 0; essai < 4; essai++) {
      const r = await BK.discord.fetch(BK.discord.API + chemin, { headers: { Authorization: 'Bot ' + jeton } });
      if (r.status === 429) { const j = await r.json().catch(() => ({})); await new Promise(ok => setTimeout(ok, ((j.retry_after || 2) + 0.5) * 1000)); continue; }
      if (r.status === 401) throw new Error('Code du bot Discord refusé');
      if (r.status === 403) throw new Error('Le bot n\'a pas le droit de lire ce salon');
      if (!r.ok) throw new Error('Discord ' + r.status);
      return r.json();
    }
    throw new Error('Discord occupé');
  },

  // les salons texte de tous les serveurs où le bot est invité
  async salons(jeton) {
    const serveurs = await BK.discord.api('/users/@me/guilds', jeton), out = [];
    for (const g of serveurs) {
      const cs = await BK.discord.api(`/guilds/${g.id}/channels`, jeton);
      for (const c of cs) if (c.type === 0 || c.type === 5 || c.type === 15) out.push({ id: c.id, nom: c.name, serveur: g.name, gid: g.id, forum: c.type === 15 });
    }
    return out;
  },

  // nouveaux messages d'un salon depuis la dernière lecture (la 1re fois : les 300 derniers)
  async nouveaux(salon, jeton, apres) {
    let out = [], avant = null;
    if (apres) {
      let curseur = apres;
      for (let i = 0; i < 20; i++) {
        const l = await BK.discord.api(`/channels/${salon}/messages?limit=100&after=${curseur}`, jeton); if (!l.length) break;
        out.push(...l); curseur = l.reduce((m, x) => BigInt(x.id) > BigInt(m) ? x.id : m, curseur); if (l.length < 100) break;
        await BK.audio.pause();
      }
    } else {
      for (let i = 0; i < 3; i++) {
        const l = await BK.discord.api(`/channels/${salon}/messages?limit=100${avant ? '&before=' + avant : ''}`, jeton); if (!l.length) break;
        out.push(...l); avant = l[l.length - 1].id; if (l.length < 100) break;
      }
    }
    return out.sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
  },

  // pseudos Discord → prénoms (modifiable dans la config « discord », champ membres)
  // les pseudos Discord du groupe : sneakers = Yacine, drumbli.scott / drumblebee.skot = Baptiste, pierrec1. = Pierre
  MEMBRES: { 'sneakers': 'Yacine', 'drumblebee.skot': 'Baptiste', 'drumbli.scott': 'Baptiste', 'pierrec1.': 'Pierre', 'yaya': 'Yacine' },
  PSEUDOS: [[/sneaker|yaya|yacine|dari/, 'Yacine'], [/drumbl|drumblebee|baptiste|^bat$/, 'Baptiste'], [/pierre/, 'Pierre']],
  prenom(a, nick, membres) {
    const t = { ...BK.discord.MEMBRES, ...(membres || {}) };
    for (const k of [a.username, a.global_name, nick]) if (k && t[String(k).toLowerCase()]) return t[String(k).toLowerCase()];
    for (const k of [a.username, a.global_name, nick]) { if (!k) continue; const n = String(k).toLowerCase().replace(/[^a-z]/g, '');
      const r = BK.discord.PSEUDOS.find(([re]) => re.test(n)); if (r) return r[1]; }
    return nick || a.global_name || a.username;
  },
  // les messages du bot « zipper » (Cracotte APP) se lisent sans IA
  RE_BOT: /le projet\s+(.+?)\s+est upload/i,
  depuisBot(lignes, morceaux) {
    const out = [];
    for (const l of lignes) {
      const m = l.txt.match(BK.discord.RE_BOT); if (!m || !/\.(wav|mp3|aiff?|flac)$/i.test(m[1])) continue;
      const mo = BK.inv.trouverMorceau(m[1], morceaux); if (!mo) continue;
      out.push({ type: 'export', morceau: mo.nom, fichier: m[1], date: l.t.slice(0, 10), detail: 'déposé dans le Drive par le bot', source: 'msg ' + l.id, lien: l.lien, pourquoi: `Message du bot : « ${m[0]} »` });
    }
    return out;
  },

  // un message → une ligne lisible du journal
  // le texte d'un message, y compris les « cartes » (embeds) des bots, ex. le bot qui résume les mails (ingés son Fiverr…)
  texteDe(m) {
    const e = (m.embeds || []).map(x => [x.author && x.author.name, x.title, x.description, ...(x.fields || []).map(f => f.name + ' : ' + f.value), x.footer && x.footer.text].filter(Boolean).join(' · ')).join(' | ');
    return [(m.content || ''), e].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  },
  ligne(m, s, membres) {
    const qui = BK.discord.prenom(m.author, m.member && m.member.nick, membres);
    const pj = (m.attachments || []).map(a => a.filename).join(', ');
    const txt = BK.discord.texteDe(m);
    return { id: m.id, salon: s.nom, t: m.timestamp, qui: m.author && m.author.bot ? '🤖 ' + qui : qui, txt: txt.slice(0, 1500), pj, lien: `https://discord.com/channels/${s.gid || '@me'}/${m.channel_id}/${m.id}` };
  },

  // le journal, rangé par mois dans le Drive (collection « veille »)
  async journal(mois = 3) {
    const docs = (await BK.db.liste('veille')).filter(d => /^journal-/.test(d.id)).sort((a, b) => a.id.localeCompare(b.id)).slice(-mois);
    return docs.flatMap(d => d.lignes || []);
  },
  async ajouterAuJournal(lignes) {
    const parMois = {};
    for (const l of lignes) (parMois['journal-' + l.t.slice(0, 7)] = parMois['journal-' + l.t.slice(0, 7)] || []).push(l);
    const tous = await BK.db.liste('veille');
    for (const [id, ls] of Object.entries(parMois)) {
      const d = tous.find(x => x.id === id) || { id, lignes: [] }, vus = new Set(d.lignes.map(x => x.id));
      d.lignes.push(...ls.filter(x => !vus.has(x.id))); d.lignes.sort((a, b) => a.t.localeCompare(b.t));
      await BK.db.ecrire('veille', d);
    }
  },
  texte: ls => (ls.some(l => /^🤖/.test(l.qui || '')) ? '(IMPORTANT : les messages « 🤖 » viennent de bots. L\'un d\'eux recopie les MAILS reçus par le groupe : ingés son (Fiverr), distributeur, salles, factures, devis, livraisons de mix. Ce sont des informations réelles et fiables : traite-les exactement comme des messages du groupe, cite les noms et les montants qui s\'y trouvent, et tiens-en compte pour le résumé, les tâches, les dates et les dépenses.)\n' : '') + ls.map(l => `[${l.t.slice(0, 16).replace('T', ' ')}] #${l.salon} ${l.qui} : ${l.txt}${l.pj ? ' [fichiers : ' + l.pj + ']' : ''} (msg ${l.id})`).join('\n'),

  // ---------- une ronde du Veilleur ----------
  enCours: false,
  async ronde(progression = () => {}, force = false) {
    if (BK.discord.enCours) return { attente: true };
    const c = await BK.discord.config(); if (!c.jeton || !(c.salons || []).length) return { pasPret: true };
    const verrou = (await BK.db.liste('config')).find(x => x.id === 'veilleur') || { id: 'veilleur' };
    if (!force && verrou.passage && Date.now() - verrou.passage < 25 * 60e3) return { recent: true };   // un autre PC vient de le faire
    BK.discord.enCours = true;
    try {
      await BK.db.ecrire('config', { ...verrou, passage: Date.now(), par: BK.reglage('nomPc', '') || 'CE PC' });
      const nouvelles = [], dernier = { ...(c.dernier || {}) };
      for (const s of c.salons) {
        progression('Lecture de #' + s.nom + '…');
        try {
          const ms = await BK.discord.nouveaux(s.id, c.jeton, dernier[s.id]);
          if (ms.length) { dernier[s.id] = ms[ms.length - 1].id; nouvelles.push(...ms.filter(m => BK.discord.texteDe(m) || (m.attachments || []).length).map(m => BK.discord.ligne(m, s, c.membres))); }
        } catch (e) { progression('#' + s.nom + ' : ' + e.message); }
      }
      if (nouvelles.length) await BK.discord.ajouterAuJournal(nouvelles);
      await BK.discord.enregistrer({ dernier });
      const morceaux = await BK.db.liste('morceaux');
      let props = BK.discord.depuisBot(nouvelles, morceaux);
      const mois = new Date(Date.now() - 30 * 864e5).toISOString();
      const humains = nouvelles.filter(l => !BK.discord.RE_BOT.test(l.txt) && l.t >= mois);       // Gemini lit seulement le dernier mois (le journal garde tout)
      if (humains.length && await BK.ia.pret()) {
        progression(`Gemini lit ${humains.length} message(s)…`);
        for (let i = 0; i < humains.length; i += 400) props.push(...await BK.discord.analyser(humains.slice(i, i + 400)));
      }
      for (const p of props) { const l = nouvelles.find(x => x.id === String(p.source || '').replace(/\D/g, '')); if (l) { p.lien = p.lien || l.lien; p.date = p.date || l.t.slice(0, 10); } }
      if (props.length) await BK.discord.rangerPropositions(props);
      let pont = {}; try { pont = await BK.discord.pont(c, progression); } catch (e) { console.warn('pont', e); }   // les messages pointés à Miette (🍞 ou « Miette, … »)
      BK.discord.photoBot(c).catch(() => {});                       // la photo du bot = le patch de Miette (une seule fois pour tout le groupe)
      return { messages: nouvelles.length, propositions: props.length, pointes: pont.n || 0, ranges: pont.ranges || 0 };
    } finally { BK.discord.enCours = false; }
  },

  // ---------- LE PONT DISCORD → BEESKOT STUDIO ----------
  // Sur Discord, on POINTE un message à Miette : la réaction 🍞 dessous, ou un message qui commence par « Miette ».
  // Miette le lit (avec le message auquel il répond), range directement l'info au bon endroit (Calendrier, To-do,
  // fiche du morceau, Références d'un tournage, Budget), puis le bot met ✅ sous le message (ou ❓ s'il n'a rien compris).
  // Pas de serveur : c'est fait dès qu'un PC du groupe a BEESKOT Studio ouvert.
  RE_POINTE: /^\s*(@?miette|miat)\b[\s,:!-]*/i,
  async reagir(salon, msg, jeton, emoji) {
    try { await BK.discord.fetch(`${BK.discord.API}/channels/${salon}/messages/${msg}/reactions/${encodeURIComponent(emoji)}/@me`, { method: 'PUT', headers: { Authorization: 'Bot ' + jeton } }); } catch (e) {}
  },
  async repondre(salon, msg, jeton, texte) {                      // une réponse de Miette, juste sous le message
    try { await BK.discord.fetch(`${BK.discord.API}/channels/${salon}/messages`, { method: 'POST', headers: { Authorization: 'Bot ' + jeton, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: texte, message_reference: { message_id: msg }, allowed_mentions: { parse: [] } }) }); } catch (e) {}
  },
  // ---------- la photo du bot Miette sur Discord ----------
  // Une seule fois pour tout le groupe : le premier PC qui passe met le patch brodé de Miette comme photo du bot,
  // et le note dans le Drive. Pour une nouvelle photo plus tard : changer PHOTO_BOT (ex. 'miette-v2').
  PHOTO_BOT: 'miette-v1',
  async photoBot(c) {
    c = c || await BK.discord.config(); if (!c.jeton || !BK.db.drive()) return;
    if ((await BK.partage.lire('discord.photo', '')) === BK.discord.PHOTO_BOT) return;
    const blob = await (await fetch('look/miette-discord.png')).blob();
    const img = await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(blob); });
    const r = await BK.discord.fetch(BK.discord.API + '/users/@me', { method: 'PATCH', headers: { Authorization: 'Bot ' + c.jeton, 'Content-Type': 'application/json' }, body: JSON.stringify({ avatar: img }) });
    if (r.ok) await BK.partage.ecrire('discord.photo', BK.discord.PHOTO_BOT);         // si Discord refuse (trop de changements), on réessaiera à la prochaine ronde
  },
  async pont(c, progression = () => {}) {
    if (!(await BK.ia.pret())) return {};
    c = c || await BK.discord.config(); if (!c.jeton) return {};
    const doc = (await BK.db.liste('config')).find(x => x.id === 'pont') || { id: 'pont', faits: [] }, faits = new Set(doc.faits || []);
    const pointes = [];
    for (const s of c.salons || []) {
      let l = []; try { l = await BK.discord.api(`/channels/${s.id}/messages?limit=50`, c.jeton); } catch (e) { continue; }
      for (const m of l) {
        if (faits.has(m.id) || (m.author && m.author.bot && !BK.discord.texteDe(m))) continue;
        const bisc = (m.reactions || []).some(r => r.emoji && (r.emoji.name === '🍞' || r.emoji.name === '🥖')), dit = BK.discord.RE_POINTE.test(m.content || '');
        if (!bisc && !dit) continue;
        if (!bisc && Date.now() - new Date(m.timestamp).getTime() > 3 * 864e5) continue;   // « Miette, … » : seulement les messages récents (pas de vieilles questions d'avant)
        if ((m.reactions || []).some(r => r.emoji && (r.emoji.name === '✅' || r.emoji.name === '❓') && r.me)) { faits.add(m.id); continue; }
        const ref = m.referenced_message ? BK.discord.texteDe(m.referenced_message) : '';
        pointes.push({ m, s, texte: BK.discord.texteDe(m).replace(BK.discord.RE_POINTE, ''), ref, qui: BK.discord.prenom(m.author, m.member && m.member.nick, c.membres) });
      }
      await BK.audio.pause();
    }
    if (!pointes.length) return { n: 0 };
    // ---------- les QUESTIONS (« Miette ? … » ou « Miette, … ? ») : Miette répond sous le message ----------
    const estQuestion = p => /^\s*(@?miette|miat)\s*\?/i.test(p.m.content || '') || (BK.discord.RE_POINTE.test(p.m.content || '') && /\?\s*$/.test(p.texte));
    const questions = pointes.filter(estQuestion);
    if (questions.length && await BK.partage.lire('discord.repond', true)) {
      for (const q of questions) {
        progression('Miette répond à ' + q.qui + '…');
        let rep = ''; try { rep = await BK.discord.question(q.texte.replace(/^\?\s*/, '') + (q.ref ? `\n(À propos de ce message : « ${q.ref.slice(0, 500)} »)` : '')); } catch (e) { rep = ''; }
        if (rep) { await BK.discord.repondre(q.s.id, q.m.id, c.jeton, '🍞 ' + String(rep).slice(0, 1900)); faits.add(q.m.id); }
        await BK.audio.pause();
      }
    }
    pointes.splice(0, pointes.length, ...pointes.filter(p => !estQuestion(p)));
    if (!pointes.length) { doc.faits = [...faits].slice(-800); await BK.db.ecrire('config', doc, { sansAnnuler: true }).catch(() => {}); return { n: questions.length, ranges: 0, reponses: questions.length }; }
    progression(`Miette range ${pointes.length} message(s) pointé(s)…`);
    const [ms, tours] = await Promise.all([BK.db.liste('morceaux'), BK.db.liste('tournages')]);
    const auj = new Date().toISOString().slice(0, 10);
    const systeme = `Tu es Miette, l'assistante du groupe BEESKOT (Yacine, Pierre, Baptiste). Aujourd'hui : ${auj}.
Ces messages Discord t'ont été POINTÉS exprès : le groupe veut que tu ranges leur contenu dans le logiciel. Sois précis, n'invente rien.
Morceaux (nom exact) : ${ms.map(m => m.nom + ((m.alias || []).length ? ' (' + m.alias.join(', ') + ')' : '')).join(' ; ')}.
Tournages : ${tours.map(t => t.titre + (t.morceau ? ' [' + t.morceau + ']' : '')).join(' ; ') || 'aucun'}.
Réponds en JSON : {"items":[…]} avec, pour chaque info, un objet parmi :
{"type":"evenement","quoi":"tournage|shooting|enreg|repet|mixage|sortie|promo|autre","titre":"court","date":"AAAA-MM-JJ","heure":"HH:MM ou vide","lieu":"","morceau":"nom exact ou vide","source":"id"}
{"type":"tache","texte":"commence par un verbe","qui":"Yacine|Pierre|Baptiste|","date":"AAAA-MM-JJ ou vide","morceau":"","source":"id"}
{"type":"bpm","morceau":"nom exact","bpm":78,"source":"id"}   {"type":"ton","morceau":"nom exact","ton":"La mineur","source":"id"}
{"type":"sortie","morceau":"nom exact","date":"AAAA-MM-JJ","source":"id"}
{"type":"reference","url":"lien","note":"en quelques mots","tournage":"titre exact du tournage ou vide","morceau":"nom exact ou vide","source":"id"}
{"type":"depense","titre":"","montant":0,"payePar":"Yacine|Pierre|Baptiste","pour":["Yacine","Pierre","Baptiste"],"date":"AAAA-MM-JJ","source":"id"}
{"type":"note","morceau":"nom exact","texte":"à retenir","source":"id"}
Les dates relatives se calculent depuis la date du message. "source" = l'identifiant du message.
Si le message dit OÙ ranger (calendrier, to-do / tâche, tournage / références, budget / dépense, fiche du morceau / BPM / note), respecte-le. Sinon, choisis toi-même la bonne place.`;
    const txt = pointes.map(p => `[id ${p.m.id}] ${p.m.timestamp.slice(0, 16).replace('T', ' ')} · ${p.qui} · #${p.s.nom} : ${p.texte}${p.ref ? `\n   (en réponse à : « ${p.ref.slice(0, 600)} »)` : ''}`).join('\n');
    let r = {}; try { r = await BK.ia.demander(txt, { systeme, json: true, temperature: 0.1, vite: true, delai: 90 }); } catch (e) { console.warn(e); return { n: pointes.length, erreur: e.message }; }
    const items = Array.isArray(r) ? r : r.items || [], parSource = {};
    const membre = x => ['Yacine', 'Pierre', 'Baptiste'].find(n => n.toLowerCase() === String(x || '').toLowerCase()) || '';
    const morc = n => BK.inv.trouverMorceau(n || '', ms), TYPES_EV = ['tournage', 'shooting', 'enreg', 'repet', 'mixage', 'sortie', 'promo', 'autre'];
    let ranges = 0;
    for (const x of items) {
      const src = String(x.source || '').replace(/\D/g, ''), p = pointes.find(q => q.m.id === src) || (pointes.length === 1 ? pointes[0] : null);
      try {
        let ok = false;
        if (x.type === 'evenement' && /^\d{4}-\d\d-\d\d$/.test(x.date || '')) { await BK.db.ecrire('evenements', { type: TYPES_EV.includes(x.quoi) ? x.quoi : 'autre', titre: x.titre || 'Rendez-vous', morceau: (morc(x.morceau) || {}).nom || '', date: x.date, heure: x.heure || '', lieu: x.lieu || '', source: 'discord', miette: true }); ok = true; }
        else if (x.type === 'tache' && x.texte) { await BK.db.ecrire('taches', { texte: x.texte, qui: membre(x.qui), morceau: (morc(x.morceau) || {}).nom || '', date: /^\d{4}-\d\d-\d\d$/.test(x.date || '') ? x.date : '', fait: false, ordre: Date.now(), source: 'discord', miette: true }); ok = true; }
        else if ((x.type === 'bpm' || x.type === 'ton' || x.type === 'sortie' || x.type === 'note') && morc(x.morceau)) {
          const m = morc(x.morceau);
          if (x.type === 'bpm' && +x.bpm >= 50 && +x.bpm <= 220) { m.bpm = String(x.bpm); m.bpmSource = 'discord'; (m.aValider = m.aValider || {}).bpm = true; ok = true; }
          if (x.type === 'ton' && x.ton) { m.ton = x.ton; m.tonSource = 'discord'; (m.aValider = m.aValider || {}).ton = true; ok = true; }
          if (x.type === 'sortie' && /^\d{4}-\d\d-\d\d$/.test(x.date || '')) { m.sortie = x.date; (m.aValider = m.aValider || {}).sortie = true; ok = true; }
          if (x.type === 'note' && x.texte) { m.notes = ((m.notes ? m.notes + '\n' : '') + '🍞 ' + x.texte).slice(-4000); (m.aValider = m.aValider || {}).notes = true; ok = true; }
          if (ok) await BK.db.ecrire('morceaux', m);
        }
        else if (x.type === 'reference' && /^https?:\/\//.test(x.url || '')) {
          const n = BK.inv.normaliser, t = tours.find(t => x.tournage && n(t.titre) === n(x.tournage)) || tours.find(t => x.morceau && morc(x.morceau) && t.morceau === morc(x.morceau).nom);
          if (t && !(t.references || []).some(y => y.url === x.url)) { (t.references = t.references || []).push({ url: x.url, note: x.note || '', miette: true }); await BK.db.ecrire('tournages', t); ok = true; }
        }
        else if (x.type === 'depense' && +x.montant > 0) { await BK.db.ecrire('depenses', { titre: x.titre || 'Dépense', montant: +x.montant, payePar: membre(x.payePar) || (p && membre(p.qui)) || 'Yacine', pour: (x.pour || []).map(membre).filter(Boolean).length ? (x.pour || []).map(membre).filter(Boolean) : ['Yacine', 'Pierre', 'Baptiste'], date: /^\d{4}-\d\d-\d\d$/.test(x.date || '') ? x.date : auj, cat: '', source: 'discord', miette: true }); ok = true; }
        if (ok && p) { parSource[p.m.id] = (parSource[p.m.id] || 0) + 1; ranges++; }
      } catch (e) { console.warn(e); }
    }
    // la réponse sur Discord : ✅ = rangé dans BEESKOT Studio, ❓ = Miette n'a rien trouvé à ranger
    for (const p of pointes) { await BK.discord.reagir(p.s.id, p.m.id, c.jeton, parSource[p.m.id] ? '✅' : '❓'); faits.add(p.m.id); await BK.audio.pause(); }
    doc.faits = [...faits].slice(-800); await BK.db.ecrire('config', doc, { sansAnnuler: true });
    for (const f of ['tachesRecharger', 'agendaRecharger', 'budgetRecharger', 'tournagesRecharger']) try { BK[f] && BK[f](); } catch (e) {}
    BK.renfortGarder && BK.renfortGarder({ type: 'pont', q: `🍞 ${pointes.length} message(s) pointé(s) sur Discord`, r: `${ranges} info(s) rangée(s) dans BEESKOT Studio` });
    return { n: pointes.length, ranges };
  },

  // ---------- Gemini : ce qui a été décidé dans ces messages ----------
  async analyser(lignes) {
    const ms = await BK.db.liste('morceaux');
    const systeme = `Tu aides le groupe de musique BEESKOT à tenir son organisation à jour à partir de leurs messages Discord (en français, souvent familiers).
Repère UNIQUEMENT ce qui est clairement décidé ou fait, pas les simples idées. Réponds en JSON : un tableau d'objets.
Types possibles :
- {"type":"evenement","quoi":"tournage|enregistrement|repetition|shooting|mixage|sortie|publication|autre","titre":"…","date":"AAAA-MM-JJ","heure":"HH:MM ou vide","lieu":"…","morceau":"nom exact ou vide"}  (un rendez-vous validé)
- {"type":"export","morceau":"nom exact","fichier":"nom du fichier","date":"AAAA-MM-JJ","detail":"ex. mix v4 envoyé par Pierre"}  (un nouvel export / mix / master partagé)
- {"type":"tache","texte":"…","qui":"Yacine|Pierre|Baptiste|"}  (quelque chose que quelqu'un doit faire)
- {"type":"sortie","morceau":"nom exact","date":"AAAA-MM-JJ"}  (date de sortie décidée)
- {"type":"note","morceau":"nom exact ou vide","texte":"…"}  (décision importante à retenir)
Chaque objet a aussi "source" : l'identifiant (msg …) du message principal, et "pourquoi" : 1 phrase courte qui cite ce qui a été dit.
Les dates relatives (« samedi », « demain ») se calculent à partir de la date du message. Noms de morceaux connus (avec leurs surnoms entre parenthèses ; réponds toujours avec le nom principal) : ${ms.map(m => m.nom + ((m.alias || []).length ? ' (' + m.alias.join(', ') + ')' : '')).join(', ')}. Membres : Yacine (Yaya, Dari, pseudo Discord « sneakers »), Pierre (« pierrec1. »), Baptiste (Bat, « drumbli.scott »).
Si rien n'est décidé, réponds [].`;
    const r = await BK.ia.demander(`${await BK.ia.contexte()}\n\nMessages :\n${BK.discord.texte(lignes)}`, { systeme, json: true, temperature: 0.1 });
    return Array.isArray(r) ? r : (r && r.propositions) || [];
  },
  async rangerPropositions(props) {                         // en attente de validation (sans doublons)
    const deja = await BK.db.liste('propositions'), cle = p => [p.type, p.source, p.titre || p.fichier || p.texte || p.date].join('|');
    const vus = new Set(deja.map(cle));
    for (const p of props) { if (vus.has(cle(p))) continue; vus.add(cle(p)); await BK.db.ecrire('propositions', { ...p, statut: 'attente', vu: new Date().toISOString() }); }
  },

  // ---------- poser une question au journal ----------
  async question(q) {
    // on n'envoie pas tout le journal (trop long = trop lent) : les messages qui parlent de la question + les plus récents
    const j = await BK.discord.journal(6), ms = await BK.db.liste('morceaux');
    const n = t => BK.inv.normaliser(t || '');
    const mots = n(q).split(' ').filter(w => w.length >= 4 && !/^(quel|quelle|quand|comment|est-ce|cest|dernier|derniere|notre|nous|avec|pour|dans|vous|elle|sont)$/.test(w));
    const m = BK.inv.trouverMorceau(q, ms); if (m) mots.push(...[m.nom, ...(m.alias || [])].map(x => n(x).replace(/ /g, '')));
    const pertinents = mots.length ? j.filter(l => { const t = n(l.txt + ' ' + l.pj).replace(/ /g, ''); return mots.some(w => t.includes(w.replace(/ /g, ''))); }) : [];
    const choisis = [...new Map([...pertinents.slice(-250), ...j.slice(-150)].map(l => [l.id, l])).values()].sort((a, b) => a.t.localeCompare(b.t));
    const systeme = 'Tu es Miette, l\'assistante du groupe BEESKOT et du logiciel BEESKOT Studio. Réponds en français, très simplement, en 1 à 6 phrases. '
      + 'Si la question porte sur le groupe : appuie-toi sur les messages Discord et les infos du logiciel, donne les dates et qui l\'a dit. '
      + 'Si la question porte sur le LOGICIEL (comment faire, où trouver, à quoi sert un bouton, un problème) : réponds avec le GUIDE DU LOGICIEL ci-dessous, pas à pas (onglet → bouton → …), avec les noms exacts des boutons. '
      + 'Si tu ne trouves pas, dis-le franchement et propose « 🔧 Améliorer BEESKOT Studio » pour prévenir Dari.';
    const guide = BK.nouveautes && BK.nouveautes.texteGuide ? '\n\nGUIDE DU LOGICIEL BEESKOT STUDIO (version ' + BK.version + ') :\n' + BK.nouveautes.texteGuide() : '';
    return BK.ia.demander(`${await BK.ia.contexte()}${guide}\n\nMessages Discord utiles (du plus ancien au plus récent) :\n${BK.discord.texte(choisis) || '(aucun message lu pour l\'instant)'}\n\nQuestion : ${q}`, { systeme, temperature: 0.2, vite: true, delai: 60 });
  },

  // ---------- la consigne du résumé de la semaine (Accueil) : la même pour le bouton jaune et pour ↻ ----------
  CONSIGNE_SEMAINE: `"semaine": "ce qui s'est passé ces 7 derniers jours, 3 à 6 phrases courtes et simples : ce qu'on s'est dit, ce qui a été décidé, les dates",
 "avancement": ["2 à 6 lignes courtes : où on en est (en comptant aussi ce que disent les mails reçus : ingé son, distributeur…), ce qui a AVANCÉ cette semaine (un morceau passé au mix ou au master, un mix livré, un tournage fait ou calé, une sortie qui approche, une tâche finie) et ce qui bloque"],
 "afaire": ["3 à 6 lignes courtes : ce qui ressort à faire, avec qui (répondre à un mail et payer une facture en font partie)"]`,
  // ce qu'on garde du résumé
  garderResume(doc, r) { return Object.assign(doc, { texte: r.semaine || '', mails: Array.isArray(r.mails) ? r.mails.filter(Boolean) : [], avancement: Array.isArray(r.avancement) ? r.avancement.filter(Boolean) : [], afaire: Array.isArray(r.afaire) ? r.afaire.filter(Boolean) : [] }); },

  // ---------- le résumé de la semaine (pour l'Accueil), refait quand il y a du neuf, au plus une fois par heure ----------
  async resume(force = false) {
    if (!(await BK.ia.pret())) return null;
    const doc = (await BK.db.liste('veille')).find(d => d.id === 'resume') || { id: 'resume' };
    const j = await BK.discord.journal(2), semaine = new Date(Date.now() - 7 * 864e5).toISOString(), recents = j.filter(l => l.t >= semaine);
    const dernier = recents.length ? recents[recents.length - 1].id : '';
    if (!force && doc.texte && (doc.dernier === dernier || Date.now() - (doc.t || 0) < 20 * 60e3)) return doc;   // rien de nouveau : on garde le résumé
    if (!recents.length) return doc;
    BK.discord.resumeEnCours = true; window.dispatchEvent(new CustomEvent('bk:resume'));
    try {
      const systeme = 'Tu es l\'assistant du groupe BEESKOT. Écris en français simple, comme un message à un ami. Pas de titre, pas de blabla.';
      const r = await BK.ia.demander(`${await BK.ia.contexte()}\n\nMessages Discord des 7 derniers jours :\n${BK.discord.texte(recents.slice(-600))}\n\n`
        + 'Réponds en JSON : {' + BK.discord.CONSIGNE_SEMAINE + '}',
        { systeme, json: true, temperature: 0.3, vite: true, delai: 90 });
      BK.discord.garderResume(doc, r); Object.assign(doc, { dernier, t: Date.now(), nb: recents.length });
      await BK.db.ecrire('veille', doc);
      BK.regler('accueil.resume', { ...doc });          // gardé sur ce PC : s'affiche tout de suite
      BK.renfortGarder && BK.renfortGarder({ type: 'resume', q: 'Cette semaine sur Discord (' + new Date().toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' }) + ')', r: doc.texte + ((doc.afaire || []).length ? '\n\nÀ faire :\n• ' + doc.afaire.join('\n• ') : '') });
      return doc;
    } finally { BK.discord.resumeEnCours = false; window.dispatchEvent(new CustomEvent('bk:resume')); }
  },

  // ---------- MÉDIAS : les photos / vidéos postées dans les salons (surtout « media ») ----------
  async medias(pages = 4, quoi = 'media') {
    const c = await BK.discord.config(); if (!c.jeton) throw new Error('Règle d\'abord Miette (code du bot) dans Réglages');
    let salons = [];
    try { salons = (await BK.discord.salons(c.jeton)).filter(x => !x.forum); } catch (e) { salons = c.salons || []; }
    const rangMedia = s => /m[ée]dia/i.test(s.nom) ? 0 : /photo|video|vid[ée]o|outfit|tournage|shoot/i.test(s.nom) ? 1 : 9;
    const rangAudio = s => /maquette|mix|master|export|able|drum|record|son/i.test(s.nom) ? 0 : /m[ée]dia|projet|vrac|g[ée]n[ée]ral/i.test(s.nom) ? 1 : 9;
    const rang = quoi === 'audio' ? rangAudio : rangMedia;
    salons = salons.filter(x => rang(x) < 9).sort((a, b) => rang(a) - rang(b)).slice(0, quoi === 'audio' ? 6 : 4);
    const out = [];
    for (const s of salons) {
      let avant = null;
      for (let p = 0; p < pages; p++) {
        const l = await BK.discord.api(`/channels/${s.id}/messages?limit=100${avant ? '&before=' + avant : ''}`, c.jeton).catch(() => []);
        if (!l.length) break; avant = l[l.length - 1].id;
        const estBon = a => quoi === 'audio'
          ? (/^audio\//.test(a.content_type || '') || /\.(wav|mp3|aiff?|flac|m4a|ogg)$/i.test(a.filename))
          : (/^(image|video)\//.test(a.content_type || '') || /\.(jpe?g|png|webp|heic|mp4|mov|m4v|webm)$/i.test(a.filename));
        for (const m of l) for (const a of m.attachments || []) if (estBon(a))
          out.push({ id: a.id, nom: a.filename, url: a.url, apercu: a.proxy_url, video: /^video|\.(mp4|mov|m4v|webm)$/i.test(a.content_type || a.filename), taille: a.size,
            t: m.timestamp, salon: s.nom, qui: BK.discord.prenom(m.author, m.member && m.member.nick, c.membres), texte: (m.content || '').slice(0, 120) });
      }
    }
    return out.sort((a, b) => b.t.localeCompare(a.t));
  },

  // ---------- la liste des médias est gardée dans le Drive : l'ouverture est immédiate ----------
  // On ne redemande à Discord que les messages ARRIVÉS DEPUIS la dernière fois.
  async mediasGardes(quoi = 'media') {
    const d = (await BK.db.liste('veille')).find(x => x.id === 'medias-' + quoi);
    return d || { id: 'medias-' + quoi, l: [], apres: {}, t: 0 };
  },
  async mediasNeufs(doc, quoi = 'media') {
    const c = await BK.discord.config(); if (!c.jeton) throw new Error('Règle d\'abord Miette (code du bot) dans Réglages');
    let salons = [];
    try { salons = (await BK.discord.salons(c.jeton)).filter(x => !x.forum); } catch (e) { salons = c.salons || []; }
    const rangMedia = s => /m[ée]dia/i.test(s.nom) ? 0 : /photo|video|vid[ée]o|outfit|tournage|shoot/i.test(s.nom) ? 1 : 9;
    const rangAudio = s => /maquette|mix|master|export|able|drum|record|son/i.test(s.nom) ? 0 : /m[ée]dia|projet|vrac|g[ée]n[ée]ral/i.test(s.nom) ? 1 : 9;
    const rang = quoi === 'audio' ? rangAudio : rangMedia;
    salons = salons.filter(x => rang(x) < 9).sort((a, b) => rang(a) - rang(b)).slice(0, quoi === 'audio' ? 6 : 4);
    const estBon = a => quoi === 'audio'
      ? (/^audio\//.test(a.content_type || '') || /\.(wav|mp3|aiff?|flac|m4a|ogg)$/i.test(a.filename))
      : (/^(image|video)\//.test(a.content_type || '') || /\.(jpe?g|png|webp|heic|mp4|mov|m4v|webm)$/i.test(a.filename));
    const out = [], apres = { ...(doc.apres || {}) };
    for (const s of salons) {
      const depuis = apres[s.id];
      let avant = null, tours = depuis ? 1 : 4, vus = 0;
      for (let p = 0; p < tours; p++) {
        const l = await BK.discord.api(`/channels/${s.id}/messages?limit=100${depuis && !avant ? '&after=' + depuis : avant ? '&before=' + avant : ''}`, c.jeton).catch(() => []);
        if (!l.length) break;
        if (!vus) apres[s.id] = l[0].id;                      // le plus récent vu dans ce salon
        vus += l.length; avant = l[l.length - 1].id;
        for (const m of l) for (const a of m.attachments || []) if (estBon(a))
          out.push({ id: a.id, nom: a.filename, url: a.url, apercu: a.proxy_url, video: /^video|\.(mp4|mov|m4v|webm)$/i.test(a.content_type || a.filename), taille: a.size,
            t: m.timestamp, salon: s.nom, qui: BK.discord.prenom(m.author, m.member && m.member.nick, c.membres), texte: (m.content || '').slice(0, 120),
            lien: `https://discord.com/channels/${s.gid || '@me'}/${m.channel_id}/${m.id}` });
        if (depuis && l.length === 100) tours++;               // beaucoup de nouveautés : on continue
      }
    }
    return { out, apres };
  },
  // les liens Discord expirent : on les redemande (1 appel pour 50 fichiers)
  async rafraichirLiens(l) {
    const c = await BK.discord.config(); if (!c.jeton || !l.length) return l;
    for (let i = 0; i < l.length; i += 50) {
      const lot = l.slice(i, i + 50);
      try {
        const r = await BK.discord.fetch(BK.discord.API + '/attachments/refresh-urls',
          { method: 'POST', headers: { Authorization: 'Bot ' + c.jeton, 'Content-Type': 'application/json' }, body: JSON.stringify({ attachment_urls: lot.map(x => x.url) }) });
        const j = await r.json();
        (j.refreshed_urls || []).forEach((u, k) => { if (u && u.refreshed) { lot[k].url = u.refreshed; lot[k].apercu = u.refreshed; } });
      } catch (e) { /* tant pis : on gardera les anciens liens */ }
    }
    return l;
  },
  // la liste complète : d'abord ce qui est gardé, puis les nouveautés
  async mediasVite(quoi = 'media', { surMaj = null, rafraichir = false } = {}) {
    const doc = await BK.discord.mediasGardes(quoi);
    const vieux = Date.now() - (doc.t || 0) > 12 * 3600e3;
    if (doc.l.length && surMaj) surMaj(doc.l, true);                     // tout de suite : la liste gardée
    const { out, apres } = await BK.discord.mediasNeufs(doc, quoi);
    const vus = new Set(doc.l.map(x => x.id));
    const tout = [...out.filter(x => !vus.has(x.id)), ...doc.l].sort((a, b) => (b.t || '').localeCompare(a.t || '')).slice(0, 600);
    if (rafraichir || vieux || out.length) await BK.discord.rafraichirLiens(tout.slice(0, 150));
    Object.assign(doc, { l: tout, apres, t: Date.now() });
    await BK.db.ecrire('veille', doc, { sansAnnuler: true });
    return tout;
  },

  // ---------- PLANNING : les dates dont on a parlé (validées ou juste possibles) → le Calendrier ----------
  // les dates trouvées s'AJOUTENT à celles d'avant (une lecture qui en trouve moins n'efface plus rien) ;
  // une date passée ou « ✕ ignorée » s'en va
  // les absences trouvées s'AJOUTENT (jamais effacées par une lecture suivante) ; les jours passés s'en vont.
  // Rangées à part (« dispos.miette ») : ce que vous cochez vous-mêmes passe toujours devant.
  async rangerAbsences(l, auj) {
    const membres = ['Yacine', 'Pierre', 'Baptiste'], d = await BK.partage.lire('dispos.miette', {}), j = x => /^\d{4}-\d\d-\d\d$/.test(x || '');
    let n = 0;
    for (const a of l || []) {
      const qui = membres.find(m => m.toLowerCase() === String(a.qui || '').toLowerCase()); if (!qui || !j(a.du)) continue;
      const fin = j(a.au) && a.au >= a.du ? a.au : a.du;
      for (let x = new Date(a.du + 'T12:00'), k = 0; k < 62; k++, x.setDate(x.getDate() + 1)) {
        const jour = x.toISOString().slice(0, 10); if (jour > fin) break; if (jour < auj) continue;
        const o = d[jour] = d[jour] || {}; if (!o[qui]) { o[qui] = { e: 'non', pourquoi: String(a.pourquoi || '').slice(0, 160) }; n++; }
      }
    }
    for (const k of Object.keys(d)) if (k < auj) delete d[k];
    if (n) await BK.partage.ecrire('dispos.miette', d);
    return n;
  },
  rangerPlanning(doc, trouvees, auj) {
    const ign = new Set(doc.ignores || []), sujet = e => [e.type, BK.inv.normaliser(e.morceau || ''), BK.inv.normaliser(e.titre || '')].join('|');
    const neuves = trouvees.filter(e => e.dates.some(d => /^\d{4}-\d\d-\d\d$/.test(d) && d >= auj))
      .map(e => ({ ...e, dates: e.dates.filter(d => /^\d{4}-\d\d-\d\d$/.test(d) && d >= auj), cle: [e.type, e.morceau, e.titre, e.dates.join('+')].join('|') })).filter(e => !ign.has(e.cle));
    const vus = new Set(neuves.map(sujet));
    const anciennes = (doc.l || []).filter(e => !vus.has(sujet(e)) && !ign.has(e.cle) && (e.dates || []).some(d => d >= auj));
    doc.l = [...neuves, ...anciennes];
    return doc;
  },
  async planning() {
    if (!(await BK.ia.pret())) throw new Error('Il faut la clé Gemini et l\'AI allumée');
    const j = await BK.discord.journal(3), depuis = new Date(Date.now() - 45 * 864e5).toISOString(), recents = j.filter(l => l.t >= depuis);
    const doc = (await BK.db.liste('veille')).find(d => d.id === 'planning') || { id: 'planning', l: [] };
    if (!recents.length) return doc;
    const ms = await BK.db.liste('morceaux'), auj = new Date().toISOString().slice(0, 10);
    const systeme = `Tu tiens le calendrier du groupe de musique BEESKOT à partir de leurs messages Discord (français familier). Aujourd'hui : ${auj}.
Trouve TOUTES les dates à venir dont on parle : tournages, shootings photo, enregistrements, répétitions, mixages, sorties de morceaux, publications, concerts.
Les MAILS recopiés par un bot comptent autant : livraison d'un mix promise par l'ingé son, échéance de paiement, date de rendez-vous, délai annoncé par le distributeur.
Pour chacune, dis si c'est « valide » (décidé, confirmé) ou « possible » (proposé, hésitation entre plusieurs jours, « peut-être », pas encore confirmé).
Si on hésite entre plusieurs jours (« le 24 ou le 25 »), mets toutes les dates possibles dans "dates".
Les dates relatives se calculent depuis la date du message. Ne garde que les dates à partir d'aujourd'hui.
Trouve AUSSI les absences des membres (« je suis pas là cette semaine », « je rentre le 24 », « dispo seulement à partir de lundi ») : qui (Yacine, Pierre ou Baptiste), du = premier jour d'absence, au = dernier jour d'absence (la veille du retour).
Réponds en JSON : {"dates": [...], "absences": [{"qui":"Yacine|Pierre|Baptiste","du":"AAAA-MM-JJ","au":"AAAA-MM-JJ","pourquoi":"1 phrase qui cite ce qui a été dit"}]}, où chaque élément de "dates" est {"type":"tournage|shooting|enreg|repet|mixage|sortie|promo|autre","titre":"court","morceau":"nom exact ou vide","dates":["AAAA-MM-JJ"],"heure":"HH:MM ou vide","lieu":"","statut":"valide|possible","pourquoi":"1 phrase qui cite ce qui a été dit","source":"l'identifiant (msg …)"}.
Morceaux : ${ms.map(m => m.nom + ((m.alias || []).length ? ' (' + m.alias.join(', ') + ')' : '')).join(', ')}.`;
    const r = await BK.ia.demander(`Messages Discord des 45 derniers jours :\n${BK.discord.texte(recents.slice(-800))}`, { systeme, json: true, temperature: 0.1, vite: true, delai: 90 });
    const brut = (Array.isArray(r) ? r : Array.isArray(r && r.dates) ? r.dates : Array.isArray(r && r.planning) ? r.planning : []).filter(e => e && Array.isArray(e.dates));
    BK.discord.rangerPlanning(doc, brut, auj);
    // les absences dites sur Discord → le Calendrier (pastille « pas là » de Miette, à valider par le groupe)
    try { await BK.discord.rangerAbsences((r && Array.isArray(r.absences)) ? r.absences : [], auj); } catch (e) { console.warn('absences', e); }
    // ce que Miette a lu : pour comprendre quand une date n'apparaît pas
    const mails = recents.filter(l => /^🤖/.test(l.qui || ''));
    doc.lu = { messages: recents.length, mails: mails.length, de: (recents[0] || {}).t || '', a: (recents[recents.length - 1] || {}).t || '', trouvees: brut.length,
      passees: brut.filter(e => !e.dates.some(d => d >= auj)).length, t: Date.now() };
    doc.t = Date.now(); await BK.db.ecrire('veille', doc);
    BK.agendaRecharger && BK.agendaRecharger();
    return doc;
  },

  // ---------- PASSAGES : les timings de tournage donnés sur Discord (ex. « Mother 1:12 - 1:42 ») ----------
  async passages(m, morceaux) {
    if (!(await BK.ia.pret())) throw new Error('Il faut la clé Gemini et l\'AI allumée');
    const j = await BK.discord.journal(12), heure = /\d{1,2}\s*[:'’h]\s*\d{2}|\d+\s*s\b/i;
    const noms = [m.nom, ...(m.alias || [])].map(BK.inv.normaliser);
    const l = j.filter(x => heure.test(x.txt || '') || noms.some(n => BK.inv.normaliser((x.txt || '') + ' ' + (x.pj || '')).includes(n)));
    if (!l.length) return [];
    const r = await BK.ia.demander(`Morceau recherché : « ${m.nom} »${(m.alias || []).length ? ' (surnoms : ' + m.alias.join(', ') + ')' : ''}.\nAutres morceaux : ${morceaux.map(x => x.nom).join(', ')}.\n\nMessages Discord :\n${BK.discord.texte(l.slice(-700))}`,
      { systeme: 'Tu aides le groupe BEESKOT. Dans ces messages, trouve les passages du morceau recherché choisis pour des reels ou des tournages : un début et une fin dans le morceau (ex. « de 1:12 à 1:42 », « 0:45-1:15 »). Ignore les heures de rendez-vous (14h00) et les autres morceaux. Réponds en JSON : un tableau de {"debut":"m:ss","fin":"m:ss","note":"à quoi sert ce passage, très court","source":"l\'identifiant (msg …)"}. Si rien, [].',
        json: true, temperature: 0.1, vite: true, delai: 60 });
    const sec = t => { const x = String(t || '').match(/(\d{1,2})\s*[:'’]\s*(\d{2})/); return x ? +x[1] * 60 + +x[2] : (/^\d+(\.\d+)?$/.test(t) ? +t : null); };
    return (Array.isArray(r) ? r : []).map(p => ({ debut: sec(p.debut), fin: sec(p.fin), nom: '🍞 Discord · ' + (p.note || '') })).filter(p => p.debut != null && p.fin > p.debut);
  },

  // ---------- TÂCHES : Miette relit les 2 dernières semaines et prépare la to-do list ----------
  async tachesProposer() {
    if (!(await BK.ia.pret())) throw new Error('Il faut la clé Gemini et l\'AI allumée');
    const j = await BK.discord.journal(2), depuis = new Date(Date.now() - 14 * 864e5).toISOString(), recents = j.filter(l => l.t >= depuis);
    if (!recents.length) return 0;
    const [ts, ms, props] = await Promise.all([BK.db.liste('taches'), BK.db.liste('morceaux'), BK.db.liste('propositions')]);
    const deja = [...ts.map(t => t.texte + (t.fait ? ' (fait)' : '')), ...props.filter(p => p.type === 'tache').map(p => p.texte)];
    const systeme = `Tu prépares la to-do list du groupe de musique BEESKOT à partir de leurs messages Discord (français familier).
Trouve TOUT ce que quelqu'un doit faire : promis (« je m'en occupe », « faut que je… »), demandé (« tu peux… ? »), ou évident (une date validée → préparer, réserver, envoyer…).
Les MAILS recopiés par un bot en donnent aussi : répondre à l'ingé son, écouter un mix livré, payer ou relancer une facture, envoyer des fichiers.
Une tâche = une action concrète et courte qui commence par un verbe (ex. « Envoyer le mix v4 de Mother à Nico »).
Ne propose PAS ce qui est déjà fait dans les messages, ni ce qui est déjà dans la liste existante.
Réponds en JSON : un tableau de {"texte":"…","qui":"Yacine|Pierre|Baptiste|BEESKOT|","morceau":"nom exact ou vide","date":"AAAA-MM-JJ si une échéance est dite, sinon vide","source":"l'identifiant (msg …) du message","pourquoi":"1 phrase courte qui cite ce qui a été dit"}.
« BEESKOT » = tout le groupe. Membres : Yacine (Yaya, Dari, pseudo Discord « sneakers »), Pierre (« pierrec1. »), Baptiste (Bat, Drumblebee). Morceaux : ${ms.map(m => m.nom + ((m.alias || []).length ? ' (' + m.alias.join(', ') + ')' : '')).join(', ')}.`;
    const r = await BK.ia.demander(`${await BK.ia.contexte()}\n\nDéjà dans la liste (ne pas reproposer) :\n${deja.slice(-150).join('\n') || 'rien'}\n\nMessages Discord des 14 derniers jours :\n${BK.discord.texte(recents.slice(-700))}`,
      { systeme, json: true, temperature: 0.2, vite: true, delai: 90 });
    const l = (Array.isArray(r) ? r : (r && r.taches) || []).filter(t => t && t.texte).map(t => ({ ...t, type: 'tache' }));
    const avant = props.length; await BK.discord.rangerPropositions(l);
    return (await BK.db.liste('propositions')).length - avant;
  },

  // ---------- les dépenses dont on a parlé (bouton Miette du Budget) : des propositions, à valider ----------
  async depensesProposer() {
    if (!(await BK.ia.pret())) throw new Error('Il faut la clé Gemini et l\'AI allumée');
    const j = await BK.discord.journal(3), depuis = new Date(Date.now() - 60 * 864e5).toISOString(), recents = j.filter(l => l.t >= depuis);
    if (!recents.length) return 0;
    const [ds, props] = await Promise.all([BK.db.liste('depenses'), BK.db.liste('propositions')]);
    const deja = [...ds.map(d => `${d.date} ${d.titre} ${d.montant}$ (${d.payePar})`), ...props.filter(p => p.type === 'depense').map(p => `${p.date} ${p.titre} ${p.montant}$`)];
    const systeme = `Tu tiens le budget du groupe de musique BEESKOT à partir de leurs messages Discord (français familier) et des mails recopiés par un bot.
Trouve les PAIEMENTS faits pour le groupe : location de studio, matériel, pub, mix/master, distribution, transport, nourriture en session… (« j'ai payé », « j'ai avancé 40 $ », facture réglée, reçu).
Pas les prix seulement envisagés, pas ce qui est déjà dans la liste.
Réponds en JSON : un tableau de {"titre":"court","montant":nombre,"payePar":"Yacine|Pierre|Baptiste","pour":["Yacine","Pierre","Baptiste"],"date":"AAAA-MM-JJ","source":"l'identifiant (msg …) du message","pourquoi":"1 phrase courte qui cite ce qui a été dit"}.
Membres : Yacine (Yaya, Dari, pseudo Discord « sneakers »), Pierre (« pierrec1. »), Baptiste (Bat, Drumblebee).`;
    const r = await BK.ia.demander(`Déjà dans le budget (ne pas reproposer) :\n${deja.slice(-150).join('\n') || 'rien'}\n\nMessages Discord des 60 derniers jours :\n${BK.discord.texte(recents.slice(-700))}`,
      { systeme, json: true, temperature: 0.2, vite: true, delai: 90, prio: true });
    const l = (Array.isArray(r) ? r : (r && r.depenses) || []).filter(d => d && d.titre && +d.montant > 0).map(d => ({ ...d, montant: +d.montant, type: 'depense' }));
    const avant = props.length; await BK.discord.rangerPropositions(l);
    return (await BK.db.liste('propositions')).length - avant;
  },

  // ---------- les reels dont on a parlé (bouton Miette de l'onglet Reels) ----------
  async reelsTrouver() {
    if (!(await BK.ia.pret())) throw new Error('Il faut la clé Gemini et l\'AI allumée');
    const j = await BK.discord.journal(4);
    if (!j.length) return [];
    const [rs, ms] = await Promise.all([BK.db.liste('reels'), BK.db.liste('morceaux')]);
    const systeme = `Tu aides le groupe de musique BEESKOT à suivre leurs REELS (vidéos courtes Instagram / TikTok) à partir de leurs messages Discord (français familier).
Trouve chaque idée de reel dont ils ont parlé : un reel prévu, à tourner, à monter ou à poster (teaser, extrait, coulisses, live, tendance…).
Pas ce qui est déjà dans la liste. Regroupe les messages qui parlent du même reel.
Réponds en JSON : un tableau de {"titre":"très court, 18 caractères maximum, ex. Refrain Mother","morceau":"nom exact ou vide","idee":"1 phrase : ce qu'on voit / ce qu'on fait","statut":"idee|tournage|montage|publie","pourquoi":"1 phrase courte qui cite ce qui a été dit"}.
Morceaux : ${ms.map(m => m.nom + ((m.alias || []).length ? ' (' + m.alias.join(', ') + ')' : '')).join(', ')}.`;
    const r = await BK.ia.demander(`Reels déjà dans la liste (ne pas reproposer) :\n${rs.map(x => x.titre).join('\n') || 'aucun'}\n\nMessages Discord :\n${BK.discord.texte(j.slice(-900))}`,
      { systeme, json: true, temperature: 0.2, vite: true, delai: 90, prio: true });
    return (Array.isArray(r) ? r : (r && r.reels) || []).filter(x => x && x.titre);
  },

  // ---------- GRAND RANGEMENT : relire TOUT l'historique des salons, puis tout faire analyser ----------
  async toutRelire(progression = () => {}) {
    const c = await BK.discord.config(); if (!c.jeton || !(c.salons || []).length) throw new Error('Règle d\'abord Miette (code + salons)');
    const deja = new Set((await BK.discord.journal(999)).map(l => l.id)), tout = [];
    for (const s of c.salons) {
      let avant = null, n = 0;
      for (let page = 0; page < 60; page++) {                         // jusqu'à 6000 messages par salon
        const l = await BK.discord.api(`/channels/${s.id}/messages?limit=100${avant ? '&before=' + avant : ''}`, c.jeton);
        if (!l.length) break; avant = l[l.length - 1].id; n += l.length;
        tout.push(...l.filter(m => !deja.has(m.id) && (BK.discord.texteDe(m) || (m.attachments || []).length)).map(m => BK.discord.ligne(m, s, c.membres)));
        progression(`Lecture de #${s.nom} : ${n} messages`); await BK.audio.pause();
        if (l.length < 100) break;
      }
    }
    if (tout.length) await BK.discord.ajouterAuJournal(tout);
    return tout.length;
  },
  // le point sur UN morceau, d'après tout ce que le groupe en a dit sur Discord → fiche (Orga › Notes du groupe)
  async resumerMorceau(m, j) {
    j = j || await BK.discord.journal(999);
    const cles = [m.nom, ...(m.alias || [])].map(x => BK.inv.normaliser(x).replace(/ /g, '')).filter(x => x.length >= 3);
    const lignes = j.filter(l => cles.some(k => BK.inv.normaliser(l.txt + ' ' + l.pj + ' ' + l.salon).replace(/ /g, '').includes(k)));
    if (lignes.length < 3) throw new Error(lignes.length ? 'Trop peu de messages sur « ' + m.nom + ' » dans Discord' : 'Rien sur « ' + m.nom + ' » dans Discord (Miette a-t-elle déjà lu l\'historique ?)');
    m.resumeDiscord = { texte: await BK.ia.demander(`Voici les messages Discord du groupe BEESKOT qui parlent du morceau « ${m.nom} » :\n${BK.discord.texte(lignes.slice(-500))}\n\nFais le point en français simple, en 5 à 10 lignes : où en est le morceau, les dernières versions / exports, ce qui a été décidé, ce qui reste à faire (avec qui).`, { temperature: 0.3, vite: true }), t: new Date().toISOString(), nb: lignes.length };
    await BK.db.ecrire('morceaux', m); return m.resumeDiscord;
  },
  async ranger(progression = () => {}) {
    const j = await BK.discord.journal(999), ms = await BK.db.liste('morceaux');
    let props = BK.discord.depuisBot(j, ms);
    const humains = j.filter(l => !BK.discord.RE_BOT.test(l.txt)), PAQUET = 700;
    if (await BK.ia.pret()) for (let i = 0; i < humains.length; i += PAQUET) {
      progression(`Gemini range l'historique : ${Math.min(100, Math.round(i / humains.length * 100))} %`);
      try { props.push(...await BK.discord.analyser(humains.slice(i, i + PAQUET))); } catch (e) { progression('Pause (Gemini occupé)…'); await new Promise(ok => setTimeout(ok, 20000)); }
    }
    for (const p of props) { const l = j.find(x => x.id === String(p.source || '').replace(/\D/g, '')); if (l) { p.lien = p.lien || l.lien; p.date = p.date || l.t.slice(0, 10); } }
    // un résumé par morceau, rangé dans sa fiche (tiroir « Notes du groupe »)
    if (await BK.ia.pret()) for (const m of ms) {
      progression('Résumé de ' + m.nom + '…');
      try { await BK.discord.resumerMorceau(m, j); } catch (e) {}
    }
    await BK.discord.rangerPropositions(props);
    return props.length;
  },

  // toutes les 30 min, si le Veilleur est réglé (un seul PC le fait à la fois)
  surveiller() {
    const tour = async () => { try { const r = await BK.discord.ronde(); if (r.propositions) { BK.veilleurMaj && BK.veilleurMaj(); BK.surOuvrir && BK.surOuvrir.accueil && BK.surOuvrir.accueil(); }
      if (!r.pasPret && !r.attente) await BK.discord.resume();
      if (r.messages && Date.now() - BK.reglage('agenda.miette', 0) > 6 * 3600e3) { BK.regler('agenda.miette', Date.now()); await BK.discord.planning().catch(e => console.warn(e)); }   // le Calendrier se remplit tout seul
      if (r.messages && Date.now() - BK.reglage('todo.miette', 0) > 6 * 3600e3) { BK.regler('todo.miette', Date.now()); await BK.discord.tachesProposer(); BK.tachesRecharger && BK.tachesRecharger(); }   // la to-do se prépare toute seule (max 4 fois / jour)
    } catch (e) { console.warn(e); } };
    setTimeout(tour, 90e3); setInterval(tour, 30 * 60e3);
  },
};

// =====================================================================
// MIETTE ANNONCE SUR DISCORD (#annonce-miette) — pour l'instant : les retours de Notes et retours.
//   une note ajoutée ──► on attend 10 min sans nouvelle note ──► « Yacine a fait des retours sur One Point Perspective · OPP Master 10.23.26 »
// Seul le PC de celui qui écrit annonce (pas de doublon). Si le logiciel est fermé avant, l'annonce part à la prochaine ouverture.
// =====================================================================
(() => {
  const ATTENTE = 10 * 60e3, SALON = /annonce[-_ ]?miette/i;
  async function salonAnnonce(jeton) {
    const garde = BK.reglage('discord.annonce', null); if (garde && garde.id) return garde.id;
    const l = await BK.discord.salons(jeton).catch(() => []); const s = l.find(x => SALON.test(x.nom) && !x.forum);
    if (s) BK.regler('discord.annonce', { id: s.id, nom: s.nom }); return s ? s.id : null;
  }
  async function poster(texte) {
    const c = await BK.discord.config(); if (!c.jeton) return false;
    const id = await salonAnnonce(c.jeton); if (!id) return false;
    const r = await BK.discord.fetch(`${BK.discord.API}/channels/${id}/messages`, { method: 'POST', headers: { Authorization: 'Bot ' + c.jeton, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: texte, allowed_mentions: { parse: [] } }) });
    return !!(r && r.ok !== false);
  }
  async function vider() {
    const l = BK.reglage('discord.aAnnoncer', []), reste = [];
    for (const a of l) { if (Date.now() - a.t < ATTENTE) { reste.push(a); continue; }
      const txt = `🍞 ${a.qui} a fait des retours sur ${a.morceau}${a.version ? ' · ' + a.version.replace(/\.(wav|mp3|aiff?|flac|m4a)$/i, '') : ''}${a.n > 1 ? ' (' + a.n + ' notes)' : ''}. À lire dans Notes et retours.`;
      let ok = false; try { ok = await poster(txt); } catch (e) {}
      if (!ok && Date.now() - a.t < 3 * 864e5) reste.push(a);                  // pas pu : on réessaie plus tard (3 jours max)
    }
    BK.regler('discord.aAnnoncer', reste);
    clearTimeout(BK._annT); if (reste.length) BK._annT = setTimeout(vider, Math.max(30e3, Math.min(...reste.map(a => ATTENTE - (Date.now() - a.t))) + 2e3));
  }
  BK.annoncerRetours = (morceau, version) => {
    const qui = BK.reglage('nomPc', ''); if (!qui || !morceau) return;
    const l = BK.reglage('discord.aAnnoncer', []), k = morceau + '|' + (version || '');
    const a = l.find(x => x.k === k && x.qui === qui); if (a) { a.t = Date.now(); a.n = (a.n || 1) + 1; } else l.push({ k, qui, morceau, version: version || '', t: Date.now(), n: 1 });
    BK.regler('discord.aAnnoncer', l); clearTimeout(BK._annT); BK._annT = setTimeout(vider, ATTENTE + 2e3);
  };
  BK.annoncesVider = vider; setTimeout(vider, 60e3);                          // au démarrage : ce qui n'était pas parti
})();
