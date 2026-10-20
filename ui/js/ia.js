// =====================================================================
// RENFORT AI — Gemini avec une clé GRATUITE (Google AI Studio, compte BEESKOT).
// Sans clé : le logiciel prépare la demande, on la copie dans ChatGPT / Gemini.
// La clé est rangée dans le Drive BEESKOT (config « ia »), jamais dans le code.
// =====================================================================
BK.ia = {
  conf: null,
  async config() {
    if (BK.ia.conf) return BK.ia.conf;
    const c = (await BK.db.liste('config')).find(x => x.id === 'ia');
    return BK.ia.conf = c || { id: 'ia', gemini: '', modele: '' };
  },
  async enregistrer(champs) { const c = { ...(await BK.ia.config()), ...champs }; BK.ia.conf = c; await BK.db.ecrire('config', c); return c; },
  active: () => BK.reglage('ia.active', true),              // l'interrupteur « AI » en bas du menu
  async pret() { return BK.ia.active() && !!(await BK.ia.config()).gemini; },
  fetch(url, o) { return (BK.T && BK.T.http ? BK.T.http.fetch : window.fetch)(url, o); },
  BASE: 'https://generativelanguage.googleapis.com/v1beta',

  // choisir tout seul le meilleur modèle « flash » gratuit disponible (les noms changent avec le temps)
  async modele() {
    const c = await BK.ia.config(); if (c.modele && c.modeleVerifie && Date.now() - c.modeleVerifie < 7 * 864e5) return c.modele;
    try {
      const r = await (await BK.ia.fetch(`${BK.ia.BASE}/models?pageSize=200&key=${encodeURIComponent(c.gemini)}`)).json();
      const ok = (r.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent') && /flash/.test(m.name) && !/lite|image|tts|audio|live|thinking|exp|preview/.test(m.name));
      const ver = n => parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [0, 0])[1]);
      ok.sort((a, b) => ver(b.name) - ver(a.name));
      const choix = ok.length ? ok[0].name.replace('models/', '') : 'gemini-2.5-flash';
      await BK.ia.enregistrer({ modele: choix, modeleVerifie: Date.now() });
      return choix;
    } catch (e) { return c.modele || 'gemini-2.5-flash'; }
  },

  // demander quelque chose à Gemini. json = true : réponse rangée (tableau / objet)
  async demander(texte, { systeme = '', json = false, temperature = 0.4 } = {}) {
    if (!BK.ia.active()) throw new Error('L\'AI est coupée (interrupteur en bas du menu)');
    const c = await BK.ia.config(); if (!c.gemini) throw new Error('Pas de clé Gemini (Renfort AI › Réglages)');
    const corps = { contents: [{ role: 'user', parts: [{ text: texte }] }], generationConfig: { temperature } };
    if (systeme) corps.systemInstruction = { parts: [{ text: systeme }] };
    if (json) corps.generationConfig.responseMimeType = 'application/json';
    for (let essai = 0; essai < 3; essai++) {
      const r = await BK.ia.fetch(`${BK.ia.BASE}/models/${await BK.ia.modele()}:generateContent?key=${encodeURIComponent(c.gemini)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
      if (r.status === 429 || r.status === 503) { await new Promise(ok => setTimeout(ok, 8000 * (essai + 1))); continue; }   // trop de demandes : on patiente
      if (r.status === 404) { await BK.ia.enregistrer({ modele: '', modeleVerifie: 0 }); continue; }                         // modèle retiré : on en choisit un autre
      const j = await r.json();
      if (!r.ok) throw new Error('Gemini : ' + ((j.error && j.error.message) || r.status));
      const t = ((((j.candidates || [])[0] || {}).content || {}).parts || []).map(p => p.text || '').join('');
      if (!json) return t.trim();
      try { return JSON.parse(t.replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch (e) { throw new Error('Réponse illisible, réessaie'); }
    }
    throw new Error('Gemini est occupé, réessaie dans une minute');
  },

  // ce que le groupe sait déjà (envoyé avec chaque demande pour que la réponse colle à BEESKOT)
  async contexte() {
    const [ms, ts, evs] = await Promise.all([BK.db.liste('morceaux'), BK.db.liste('taches'), BK.db.liste('evenements')]);
    const auj = new Date().toISOString().slice(0, 10);
    return [
      `Aujourd'hui : ${auj}. Groupe de musique BEESKOT (prononcé « Biscotte »), membres : Yacine, Pierre, Baptiste.`,
      'Morceaux : ' + ms.map(m => `${m.nom} (${m.statut === 'sorti' ? 'sorti' : BK.etapes[Math.min(m.fait || 0, 5)].nom}${m.bpm ? ', ' + m.bpm + ' BPM' : ''}${m.sortie ? ', sortie ' + m.sortie : ''})`).join(' ; '),
      'Tâches à faire : ' + (ts.filter(t => !t.fait).map(t => t.texte + (t.qui ? ' [' + t.qui + ']' : '')).join(' ; ') || 'aucune'),
      'Rendez-vous à venir : ' + (evs.filter(e => (e.date || '') >= auj).map(e => `${e.date} ${e.heure || ''} ${e.titre}`).join(' ; ') || 'aucun'),
    ].join('\n');
  },
};
