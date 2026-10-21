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
  async enregistrer(champs) { const c = { ...(await BK.ia.config()), ...champs }; BK.ia.conf = c; BK.ia.couleur(c.niveau); await BK.db.ecrire('config', c); return c; },
  // la couleur de Miette dit à quel point elle réfléchit : rapide = vert, normal = turquoise, intelligent = rouge
  couleur(niveau) { document.body.dataset.miette = niveau || 'normal'; },
  active: () => BK.reglage('ia.active', true),              // l'interrupteur « AI » en bas du menu
  async pret() { return BK.ia.active() && !!(await BK.ia.config()).gemini; },
  fetch(url, o) { return (BK.T && BK.T.http ? BK.T.http.fetch : window.fetch)(url, o); },
  BASE: 'https://generativelanguage.googleapis.com/v1beta',

  // 3 niveaux : Rapide (Flash-Lite), Normal (Flash), Puissant (Pro). Le logiciel prend tout seul
  // la version la plus récente disponible sur le compte (les noms changent avec le temps).
  NIVEAUX: { rapide: 'Rapide', normal: 'Normal', puissant: 'Intelligent' },
  niveau() { return (BK.ia.conf && BK.ia.conf.niveau) || 'normal'; },
  async modele(niveau) {
    const c = await BK.ia.config(); niveau = niveau || c.niveau || 'normal';
    const memo = (c.modeles || {})[niveau]; if (memo && memo.t && Date.now() - memo.t < 7 * 864e5) return memo.nom;
    const defaut = { rapide: 'gemini-2.5-flash-lite', normal: 'gemini-2.5-flash', puissant: 'gemini-2.5-pro' }[niveau];
    try {
      const r = await (await BK.ia.fetch(`${BK.ia.BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': c.gemini } })).json();
      const test = { rapide: n => /flash-lite/.test(n), normal: n => /flash/.test(n) && !/lite/.test(n), puissant: n => /-pro/.test(n) }[niveau];
      const ok = (r.models || []).map(m => ({ ...m, n: m.name.replace('models/', '') }))
        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent') && /^gemini-/.test(m.n) && test(m.n) && !/image|tts|audio|live|exp|embedding|computer/.test(m.n));
      const ver = n => parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [0, 0])[1]), stable = n => /preview/.test(n) ? 0 : 1;
      ok.sort((a, b) => ver(b.n) - ver(a.n) || stable(b.n) - stable(a.n) || a.n.length - b.n.length);
      const choix = ok.length ? ok[0].n : defaut;
      await BK.ia.enregistrer({ modeles: { ...(c.modeles || {}), [niveau]: { nom: choix, t: Date.now() } } });
      return choix;
    } catch (e) { return (memo && memo.nom) || defaut; }
  },
  // moins de « réflexion » = réponse beaucoup plus rapide (pour les questions simples)
  reflexion(modele, peu) {
    if (!peu) return null;
    if (/gemini-[3-9]/.test(modele)) return { thinkingLevel: 'low' };
    if (/2\.5-(flash|flash-lite)/.test(modele)) return { thinkingBudget: 0 };
    if (/2\.5-pro/.test(modele)) return { thinkingBudget: 128 };
    return null;
  },

  // demander quelque chose à Gemini. json = true : réponse rangée (tableau / objet)
  // pendant qu'on attend Gemini : un petit voyant « 🍞 Réflexion en cours… » en bas de l'écran, partout
  enCours: 0,
  voyant() {
    let v = document.getElementById('bkReflexion');
    if (!v) { v = document.createElement('div'); v.id = 'bkReflexion'; v.className = 'bk-reflexion'; document.body.appendChild(v); }
    clearInterval(BK.ia.tic);
    if (!BK.ia.enCours) { v.classList.remove('on'); return; }
    const t0 = BK.ia.debut, maj = () => { v.innerHTML = `<span class="spin"></span>🍞 Miette réfléchit… <b>${Math.round((Date.now() - t0) / 1000)} s</b>`; };
    maj(); v.classList.add('on'); BK.ia.tic = setInterval(maj, 1000);
  },
  async demander(texte, opts = {}) {
    if (!BK.ia.enCours++) BK.ia.debut = Date.now(); BK.ia.voyant();
    try { return await BK.ia._demander(texte, opts); } finally { BK.ia.enCours--; BK.ia.voyant(); }
  },
  async _demander(texte, { systeme = '', json = false, temperature = 0.4, niveau = '', vite = false, delai = 90, audio = null, fichiers = null } = {}) {
    if (!BK.ia.active()) throw new Error('L\'AI est coupée (interrupteur en bas du menu)');
    const c = await BK.ia.config(); if (!c.gemini) throw new Error('Pas de clé Gemini (Réglages › Miette)');
    niveau = niveau || c.niveau || 'normal';
    let sansReflexion = false;
    for (let essai = 0; essai < 4; essai++) {
      const modele = await BK.ia.modele(niveau);
      const parts = [{ text: texte }];
      if (audio) parts.push({ inlineData: { mimeType: audio.mime, data: audio.base64 } });
      for (const f of fichiers || []) parts.push({ inlineData: { mimeType: f.mime, data: f.base64 } });
      const corps = { contents: [{ role: 'user', parts }], generationConfig: { temperature } };
      if (systeme) corps.systemInstruction = { parts: [{ text: systeme }] };
      if (json) corps.generationConfig.responseMimeType = 'application/json';
      const th = !sansReflexion && BK.ia.reflexion(modele, vite); if (th) corps.generationConfig.thinkingConfig = th;
      const arret = new AbortController(), minuteur = setTimeout(() => arret.abort(), delai * 1000);
      const r = await BK.ia.fetch(`${BK.ia.BASE}/models/${modele}:generateContent`,          // la clé passe dans l'en-tête (marche avec les clés AIza… et AQ.…)
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': c.gemini }, body: JSON.stringify(corps), signal: arret.signal })
        .catch(e => { throw new Error(arret.signal.aborted ? 'Gemini met trop de temps à répondre, réessaie' : 'Gemini injoignable (Internet ?)'); }).finally(() => clearTimeout(minuteur));
      if (r.status === 429 || r.status === 503) {                        // trop de demandes : on patiente (ou on passe à un modèle moins demandé)
        if (niveau === 'puissant' && essai >= 1) { niveau = 'normal'; continue; }
        await new Promise(ok => setTimeout(ok, 6000 * (essai + 1))); continue; }
      if (r.status === 404) { await BK.ia.enregistrer({ modeles: { ...(c.modeles || {}), [niveau]: null } }); continue; }   // modèle retiré : on en choisit un autre
      const j = await r.json();
      if (r.status === 400 && th && /think/i.test(JSON.stringify(j))) { sansReflexion = true; continue; }
      if (!r.ok) throw new Error('Gemini : ' + ((j.error && j.error.message) || r.status));
      const t = ((((j.candidates || [])[0] || {}).content || {}).parts || []).filter(p => !p.thought).map(p => p.text || '').join('');
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
      'Morceaux : ' + ms.map(m => `${m.nom} (${m.statut === 'sorti' ? 'sorti' : BK.etapes[Math.min(m.fait || 0, 5)].nom + (m.statut === 'prochaine' ? ', prévu pour la prochaine sortie' : '')}${m.bpm ? ', ' + m.bpm + ' BPM' : ''}${m.sortie ? ', sortie ' + m.sortie : ''})`).join(' ; '),
      'Tâches à faire : ' + (ts.filter(t => !t.fait).map(t => t.texte + (t.qui ? ' [' + t.qui + ']' : '')).join(' ; ') || 'aucune'),
      'Rendez-vous à venir : ' + (evs.filter(e => (e.date || '') >= auj).map(e => `${e.date} ${e.heure || ''} ${e.titre}`).join(' ; ') || 'aucun'),
    ].join('\n');
  },
};

// ---------- DICTER : on parle, Miette écrit (l'audio part chez Gemini, rien n'est gardé) ----------
BK.dicter = {
  rec: null, morceaux: [], flux: null,
  dispo() { return !!(navigator.mediaDevices && window.MediaRecorder); },
  async demarrer() {
    if (!BK.dicter.dispo()) throw new Error('Ce PC ne permet pas la dictée : écris ton message');
    BK.dicter.flux = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => { throw new Error('Micro refusé ou absent : écris ton message'); });
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', ''];
    const t = types.find(x => !x || (window.MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(x)));
    BK.dicter.morceaux = [];
    BK.dicter.rec = new MediaRecorder(BK.dicter.flux, t ? { mimeType: t } : undefined);
    BK.dicter.rec.ondataavailable = e => e.data.size && BK.dicter.morceaux.push(e.data);
    BK.dicter.rec.start();
  },
  enCours() { return !!(BK.dicter.rec && BK.dicter.rec.state === 'recording'); },
  async arreter() {
    const r = BK.dicter.rec; if (!r) return '';
    const fin = new Promise(ok => r.onstop = ok); r.stop(); await fin;
    (BK.dicter.flux.getTracks() || []).forEach(t => t.stop());
    BK.dicter.rec = null; BK.dicter.flux = null;
    const blob = new Blob(BK.dicter.morceaux, { type: (r.mimeType || 'audio/webm').split(';')[0] });
    if (blob.size < 1200) throw new Error('Rien n\'a été entendu, réessaie');
    const b64 = await new Promise(ok => { const f = new FileReader(); f.onload = () => ok(String(f.result).split(',')[1]); f.readAsDataURL(blob); });
    return BK.ia.demander('Écris exactement ce qui est dit dans cet enregistrement, en français, sans rien ajouter ni commenter.',
      { audio: { mime: blob.type || 'audio/webm', base64: b64 }, temperature: 0, vite: true, delai: 120 });
  },
};

// une image (ou une vignette) prête à être envoyée à Gemini
BK.ia.enBase64 = async function (url) {
  const b = await (await fetch(url)).blob();
  const petit = await BK.ia.reduireImage(b, 420);
  return { mime: 'image/jpeg', base64: await new Promise(ok => { const f = new FileReader(); f.onload = () => ok(String(f.result).split(',')[1]); f.readAsDataURL(petit); }) };
};
BK.ia.reduireImage = async function (blob, max) {
  try {
    const img = await createImageBitmap(blob), k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.75));
  } catch (e) { return blob; }
};

// au démarrage : la couleur de Miette suit le niveau choisi (partagé avec tout le groupe)
setTimeout(async () => { try { BK.ia.couleur((await BK.ia.config()).niveau); } catch (e) {} }, 2000);
