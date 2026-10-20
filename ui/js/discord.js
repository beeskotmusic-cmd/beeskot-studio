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
  MEMBRES: { 'drumblebee.skot': 'Baptiste', 'pierrec1.': 'Pierre', 'yaya': 'Yacine' },
  prenom(a, nick, membres) {
    const t = { ...BK.discord.MEMBRES, ...(membres || {}) };
    for (const k of [a.username, a.global_name, nick]) if (k && t[String(k).toLowerCase()]) return t[String(k).toLowerCase()];
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
      if (props.length) await BK.discord.ranger(props);
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
Les dates relatives (« samedi », « demain ») se calculent à partir de la date du message. Noms de morceaux connus (avec leurs surnoms entre parenthèses ; réponds toujours avec le nom principal) : ${ms.map(m => m.nom + ((m.alias || []).length ? ' (' + m.alias.join(', ') + ')' : '')).join(', ')}. Membres : Yacine (Yaya), Pierre, Baptiste (Bat).
Si rien n'est décidé, réponds [].`;
    const r = await BK.ia.demander(`${await BK.ia.contexte()}\n\nMessages :\n${BK.discord.texte(lignes)}`, { systeme, json: true, temperature: 0.1 });
    return Array.isArray(r) ? r : (r && r.propositions) || [];
  },
  async ranger(props) {                                    // en attente de validation (sans doublons)
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
    return BK.ia.demander(`${await BK.ia.contexte()}\n\nMessages Discord utiles (du plus ancien au plus récent) :\n${BK.discord.texte(choisis) || '(aucun message lu pour l\'instant)'}\n\nQuestion : ${q}`, { systeme, temperature: 0.2 });
  },

  // toutes les 30 min, si le Veilleur est réglé (un seul PC le fait à la fois)
  surveiller() {
    const tour = async () => { try { const r = await BK.discord.ronde(); if (r.propositions) { BK.veilleurMaj && BK.veilleurMaj(); BK.surOuvrir && BK.surOuvrir.accueil && BK.surOuvrir.accueil(); } } catch (e) { console.warn(e); } };
    setTimeout(tour, 90e3); setInterval(tour, 30 * 60e3);
  },
};
