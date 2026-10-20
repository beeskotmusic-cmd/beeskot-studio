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
  ligne(m, s, membres) {
    const qui = BK.discord.prenom(m.author, m.member && m.member.nick, membres);
    const pj = (m.attachments || []).map(a => a.filename).join(', ');
    const txt = (m.content || '').replace(/\s+/g, ' ').trim();
    return { id: m.id, salon: s.nom, t: m.timestamp, qui, txt: txt.slice(0, 1500), pj, lien: `https://discord.com/channels/${s.gid || '@me'}/${m.channel_id}/${m.id}` };
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
  texte: ls => ls.map(l => `[${l.t.slice(0, 16).replace('T', ' ')}] #${l.salon} ${l.qui} : ${l.txt}${l.pj ? ' [fichiers : ' + l.pj + ']' : ''} (msg ${l.id})`).join('\n'),

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
          if (ms.length) { dernier[s.id] = ms[ms.length - 1].id; nouvelles.push(...ms.filter(m => (m.content || '').trim() || (m.attachments || []).length).map(m => BK.discord.ligne(m, s, c.membres))); }
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
      return { messages: nouvelles.length, propositions: props.length };
    } finally { BK.discord.enCours = false; }
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
    const systeme = 'Tu es l\'assistant du groupe BEESKOT. Réponds en français, très simplement, en 1 à 5 phrases, en t\'appuyant sur les messages Discord et les infos du logiciel. Donne les dates et qui l\'a dit. Si tu ne trouves pas, dis-le franchement.';
    return BK.ia.demander(`${await BK.ia.contexte()}\n\nMessages Discord utiles (du plus ancien au plus récent) :\n${BK.discord.texte(choisis) || '(aucun message lu pour l\'instant)'}\n\nQuestion : ${q}`, { systeme, temperature: 0.2, vite: true, delai: 60 });
  },

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
        + 'Réponds en JSON : {"semaine": "ce qu\'on s\'est dit cette semaine, en 3 à 6 phrases courtes (décisions, dates, nouveautés)", "afaire": ["les choses à faire qui ressortent, 3 à 6 lignes courtes, avec qui si on le sait"]}',
        { systeme, json: true, temperature: 0.3, vite: true, delai: 90 });
      Object.assign(doc, { texte: r.semaine || '', afaire: Array.isArray(r.afaire) ? r.afaire : [], dernier, t: Date.now(), nb: recents.length });
      await BK.db.ecrire('veille', doc);
      BK.regler('accueil.resume', { id: 'resume', texte: doc.texte, afaire: doc.afaire, t: doc.t });          // gardé sur ce PC : s'affiche tout de suite
      BK.renfortGarder && BK.renfortGarder({ type: 'resume', q: 'Cette semaine sur Discord (' + new Date().toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' }) + ')', r: doc.texte + ((doc.afaire || []).length ? '\n\nÀ faire :\n• ' + doc.afaire.join('\n• ') : '') });
      return doc;
    } finally { BK.discord.resumeEnCours = false; window.dispatchEvent(new CustomEvent('bk:resume')); }
  },

  // ---------- MÉDIAS : les photos / vidéos postées dans les salons (surtout « media ») ----------
  async medias(pages = 4) {
    const c = await BK.discord.config(); if (!c.jeton) throw new Error('Règle d\'abord Miette (code du bot) dans Réglages');
    let salons = [];
    try { salons = (await BK.discord.salons(c.jeton)).filter(x => !x.forum); } catch (e) { salons = c.salons || []; }
    const rang = s => /m[ée]dia/i.test(s.nom) ? 0 : /photo|video|vid[ée]o|outfit|tournage|shoot/i.test(s.nom) ? 1 : 9;
    salons = salons.filter(x => rang(x) < 9).sort((a, b) => rang(a) - rang(b)).slice(0, 4);
    const out = [];
    for (const s of salons) {
      let avant = null;
      for (let p = 0; p < pages; p++) {
        const l = await BK.discord.api(`/channels/${s.id}/messages?limit=100${avant ? '&before=' + avant : ''}`, c.jeton).catch(() => []);
        if (!l.length) break; avant = l[l.length - 1].id;
        for (const m of l) for (const a of m.attachments || []) if (/^(image|video)\//.test(a.content_type || '') || /\.(jpe?g|png|webp|heic|mp4|mov|m4v|webm)$/i.test(a.filename))
          out.push({ id: a.id, nom: a.filename, url: a.url, apercu: a.proxy_url, video: /^video|\.(mp4|mov|m4v|webm)$/i.test(a.content_type || a.filename), taille: a.size,
            t: m.timestamp, salon: s.nom, qui: BK.discord.prenom(m.author, m.member && m.member.nick, c.membres), texte: (m.content || '').slice(0, 120) });
      }
    }
    return out.sort((a, b) => b.t.localeCompare(a.t));
  },

  // ---------- PLANNING : les dates dont on a parlé (validées ou juste possibles) → le Calendrier ----------
  async planning() {
    if (!(await BK.ia.pret())) throw new Error('Il faut la clé Gemini et l\'AI allumée');
    const j = await BK.discord.journal(3), depuis = new Date(Date.now() - 45 * 864e5).toISOString(), recents = j.filter(l => l.t >= depuis);
    const doc = (await BK.db.liste('veille')).find(d => d.id === 'planning') || { id: 'planning', l: [] };
    if (!recents.length) return doc;
    const ms = await BK.db.liste('morceaux'), auj = new Date().toISOString().slice(0, 10);
    const systeme = `Tu tiens le calendrier du groupe de musique BEESKOT à partir de leurs messages Discord (français familier). Aujourd'hui : ${auj}.
Trouve TOUTES les dates à venir dont on parle : tournages, shootings photo, enregistrements, répétitions, mixages, sorties de morceaux, publications, concerts.
Pour chacune, dis si c'est « valide » (décidé, confirmé) ou « possible » (proposé, hésitation entre plusieurs jours, « peut-être », pas encore confirmé).
Si on hésite entre plusieurs jours (« le 24 ou le 25 »), mets toutes les dates possibles dans "dates".
Les dates relatives se calculent depuis la date du message. Ne garde que les dates à partir d'aujourd'hui.
Réponds en JSON : un tableau de {"type":"tournage|shooting|enreg|repet|mixage|sortie|promo|autre","titre":"court","morceau":"nom exact ou vide","dates":["AAAA-MM-JJ"],"heure":"HH:MM ou vide","lieu":"","statut":"valide|possible","pourquoi":"1 phrase qui cite ce qui a été dit","source":"l'identifiant (msg …)"}.
Morceaux : ${ms.map(m => m.nom + ((m.alias || []).length ? ' (' + m.alias.join(', ') + ')' : '')).join(', ')}.`;
    const r = await BK.ia.demander(`Messages Discord des 45 derniers jours :\n${BK.discord.texte(recents.slice(-800))}`, { systeme, json: true, temperature: 0.1, vite: true, delai: 90 });
    const ignores = new Set(doc.ignores || []);
    doc.l = (Array.isArray(r) ? r : []).filter(e => e && Array.isArray(e.dates) && e.dates.some(d => /^\d{4}-\d\d-\d\d$/.test(d) && d >= auj))
      .map(e => ({ ...e, cle: [e.type, e.morceau, e.titre, e.dates.join('+')].join('|') })).filter(e => !ignores.has(e.cle));
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

  // ---------- GRAND RANGEMENT : relire TOUT l'historique des salons, puis tout faire analyser ----------
  async toutRelire(progression = () => {}) {
    const c = await BK.discord.config(); if (!c.jeton || !(c.salons || []).length) throw new Error('Règle d\'abord Miette (code + salons)');
    const deja = new Set((await BK.discord.journal(999)).map(l => l.id)), tout = [];
    for (const s of c.salons) {
      let avant = null, n = 0;
      for (let page = 0; page < 60; page++) {                         // jusqu'à 6000 messages par salon
        const l = await BK.discord.api(`/channels/${s.id}/messages?limit=100${avant ? '&before=' + avant : ''}`, c.jeton);
        if (!l.length) break; avant = l[l.length - 1].id; n += l.length;
        tout.push(...l.filter(m => !deja.has(m.id) && ((m.content || '').trim() || (m.attachments || []).length)).map(m => BK.discord.ligne(m, s, c.membres)));
        progression(`Lecture de #${s.nom} : ${n} messages`); await BK.audio.pause();
        if (l.length < 100) break;
      }
    }
    if (tout.length) await BK.discord.ajouterAuJournal(tout);
    return tout.length;
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
      const cles = [m.nom, ...(m.alias || [])].map(x => BK.inv.normaliser(x).replace(/ /g, '')).filter(x => x.length >= 3);
      const lignes = j.filter(l => cles.some(k => BK.inv.normaliser(l.txt + ' ' + l.pj + ' ' + l.salon).replace(/ /g, '').includes(k)));
      if (lignes.length < 3) continue;
      progression('Résumé de ' + m.nom + '…');
      try { m.resumeDiscord = { texte: await BK.ia.demander(`Voici les messages Discord du groupe BEESKOT qui parlent du morceau « ${m.nom} » :\n${BK.discord.texte(lignes.slice(-500))}\n\nFais le point en français simple, en 5 à 10 lignes : où en est le morceau, les dernières versions / exports, ce qui a été décidé, ce qui reste à faire (avec qui).`, { temperature: 0.3, vite: true }), t: new Date().toISOString(), nb: lignes.length };
        await BK.db.ecrire('morceaux', m); } catch (e) {}
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
