// =====================================================================
// DRIVE BEESKOT — le logiciel se connecte directement au Google Drive du groupe.
//
//   Chez Yacine (1 fois) : fichier client Google (JSON) → « Se connecter » → Autoriser
//                          → le logiciel fabrique une CARTE D'ACCÈS (petit fichier)
//   Autres PC           : « Importer la carte d'accès » → relié, sans mot de passe
//
//   Dans le Drive :  BEESKOT Studio/ morceaux/ taches/ evenements/ config/ inventaires/ corbeille/ Reels/ Mixages/
//   Un petit fichier JSON par fiche. Chaque PC relit le Drive toutes les minutes.
// =====================================================================
BK.drive = {
  SCOPE: 'https://www.googleapis.com/auth/drive',
  API: 'https://www.googleapis.com/drive/v3',
  jeton: null, expire: 0, dossiers: {}, ids: {},       // ids[col][nomFichier] = id Google

  conf() { return BK.reglage('drive.conf', null); },     // { client_id, client_secret, refresh_token, racine }
  relie() { const c = BK.drive.conf(); return !!(BK.estExe && c && c.refresh_token); },
  fetch(url, o) { return (BK.T && BK.T.http ? BK.T.http.fetch : window.fetch)(url, o); },

  // ---------- 1. le fichier client Google (téléchargé depuis console.cloud.google.com) ----------
  async importerClient() {
    const p = await BK.fichier.choisirFichier('Fichier client Google (JSON)', [{ name: 'JSON', extensions: ['json'] }]); if (!p) return false;
    const j = JSON.parse(await BK.fichier.lireTexte(p)), c = j.installed || j.web || j;
    if (!c.client_id || !c.client_secret) throw new Error('Ce fichier ne contient pas d\'ID client');
    BK.regler('drive.conf', { ...(BK.drive.conf() || {}), client_id: c.client_id, client_secret: c.client_secret });
    return true;
  },

  // ---------- 2. se connecter (la page Google s'ouvre, on clique Autoriser) ----------
  async connecter() {
    const c = BK.drive.conf(); if (!c || !c.client_id) throw new Error('Importe d\'abord le fichier client Google');
    const port = await BK.T.core.invoke('oauth_port'), redir = `http://127.0.0.1:${port}`;
    const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: c.client_id, redirect_uri: redir,
      response_type: 'code', scope: BK.drive.SCOPE, access_type: 'offline', prompt: 'consent' });
    BK.T.opener.openUrl(url);
    const code = await BK.T.core.invoke('oauth_code');
    const r = await BK.drive.fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: c.client_id, client_secret: c.client_secret, redirect_uri: redir, grant_type: 'authorization_code' }).toString() });
    const t = await r.json(); if (!t.refresh_token) throw new Error(t.error_description || 'Google a refusé');
    BK.regler('drive.conf', { ...c, refresh_token: t.refresh_token });
    BK.drive.jeton = t.access_token; BK.drive.expire = Date.now() + (t.expires_in - 60) * 1000;
    await BK.drive.preparer(); await BK.drive.envoyerLocal();
    return true;
  },

  // ---------- 3. la carte d'accès pour les autres PC ----------
  async exporterCarte() {
    const c = BK.drive.conf(); if (!c || !c.refresh_token) throw new Error('Connecte d\'abord le Drive');
    const txt = JSON.stringify({ type: 'carte-acces-beeskot', ...c }, null, 1);
    if (!BK.estExe) return BK.enregistrerFichier('', 'BEESKOT-carte-acces.json', new TextEncoder().encode(txt), 'application/json');
    const p = await BK.T.dialog.save({ title: 'Enregistrer la carte d\'accès', defaultPath: 'BEESKOT-carte-acces.json', filters: [{ name: 'Carte d\'accès', extensions: ['json'] }] });
    if (!p) return null;
    await BK.T.fs.writeTextFile(p, txt);
    return p;
  },
  async importerCarte() {
    const p = await BK.fichier.choisirFichier('Carte d\'accès BEESKOT', [{ name: 'Carte', extensions: ['json'] }]); if (!p) return false;
    const j = JSON.parse(await BK.fichier.lireTexte(p));
    if (j.type !== 'carte-acces-beeskot' || !j.refresh_token) throw new Error('Ce n\'est pas une carte d\'accès BEESKOT');
    delete j.type; BK.regler('drive.conf', j); await BK.drive.preparer(); await BK.drive.envoyerLocal();
    return true;
  },
  deconnecter() { BK.regler('drive.conf', null); BK.drive.jeton = null; BK.drive.dossiers = {}; },

  // ---------- jeton (renouvelé tout seul) ----------
  async token() {
    if (BK.drive.jeton && Date.now() < BK.drive.expire) return BK.drive.jeton;
    const c = BK.drive.conf();
    const r = await BK.drive.fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: c.client_id, client_secret: c.client_secret, refresh_token: c.refresh_token, grant_type: 'refresh_token' }).toString() });
    const t = await r.json(); if (!t.access_token) throw new Error('Connexion Drive expirée : reconnecte-toi dans Réglages');
    BK.drive.jeton = t.access_token; BK.drive.expire = Date.now() + (t.expires_in - 60) * 1000;
    return t.access_token;
  },
  async api(chemin, o = {}) {
    const r = await BK.drive.fetch(chemin.startsWith('http') ? chemin : BK.drive.API + chemin,
      { ...o, headers: { Authorization: 'Bearer ' + await BK.drive.token(), ...(o.headers || {}) } });
    if (!r.ok) throw new Error('Drive ' + r.status);
    return r;
  },
  q: s => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'",

  // ---------- dossiers : BEESKOT Studio/<collection> ----------
  async dossier(nom, parent) {
    const cle = (parent || 'root') + '/' + nom; if (BK.drive.dossiers[cle]) return BK.drive.dossiers[cle];
    const q = `name=${BK.drive.q(nom)} and mimeType='application/vnd.google-apps.folder' and trashed=false and ${BK.drive.q(parent || 'root')} in parents`;
    const l = await (await BK.drive.api('/files?' + new URLSearchParams({ q, fields: 'files(id)', pageSize: '5' }))).json();
    let id = l.files && l.files[0] && l.files[0].id;
    if (!id) id = (await (await BK.drive.api('/files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nom, mimeType: 'application/vnd.google-apps.folder', parents: [parent || 'root'] }) })).json()).id;
    return BK.drive.dossiers[cle] = id;
  },
  async racine() { return BK.drive.dossier(BK.SOUS_DOSSIER); },
  async preparer() { const r = await BK.drive.racine(); const c = BK.drive.conf(); BK.regler('drive.conf', { ...c, racine: r }); return r; },

  // ---------- fiches (JSON) ----------
  async liste(col) {
    const dos = await BK.drive.dossier(col, await BK.drive.racine());
    const cache = BK.reglage('drive.cache.' + col, {}), out = {}; BK.drive.ids[col] = {};
    let page = '';
    do {
      const r = await (await BK.drive.api('/files?' + new URLSearchParams({ q: `${BK.drive.q(dos)} in parents and trashed=false`, fields: 'nextPageToken,files(id,name,modifiedTime)', pageSize: '1000', pageToken: page }))).json();
      for (const f of r.files || []) {
        if (!f.name.endsWith('.json')) continue;
        BK.drive.ids[col][f.name] = f.id;
        const c = cache[f.id];
        if (c && c.t === f.modifiedTime) { out[c.fiche.id] = c.fiche; continue; }      // déjà à jour : on ne retélécharge pas
        try { const fiche = await (await BK.drive.api(`/files/${f.id}?alt=media`)).json(); out[fiche.id] = fiche; cache[f.id] = { t: f.modifiedTime, fiche }; } catch (e) {}
      }
      page = r.nextPageToken || '';
    } while (page);
    for (const k of Object.keys(cache)) if (!Object.values(BK.drive.ids[col]).includes(k)) delete cache[k];
    BK.regler('drive.cache.' + col, cache);
    return out;
  },
  async ecrire(col, fiche) {
    const dos = await BK.drive.dossier(col, await BK.drive.racine()), nom = fiche.id + '.json', corps = JSON.stringify(fiche, null, 1);
    let id = (BK.drive.ids[col] || {})[nom];
    if (!id) { const l = await (await BK.drive.api('/files?' + new URLSearchParams({ q: `name=${BK.drive.q(nom)} and ${BK.drive.q(dos)} in parents and trashed=false`, fields: 'files(id)' }))).json(); id = l.files && l.files[0] && l.files[0].id; }
    if (id) await BK.drive.api(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: corps });
    else {
      const b = 'bk' + Date.now(), multi = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: nom, parents: [dos] })}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${corps}\r\n--${b}--`;
      id = (await (await BK.drive.api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body: multi })).json()).id;
    }
    (BK.drive.ids[col] = BK.drive.ids[col] || {})[nom] = id;
  },
  async supprimer(col, idFiche) {              // jamais effacé : déplacé dans « corbeille »
    const nom = idFiche + '.json', id = (BK.drive.ids[col] || {})[nom]; if (!id) return;
    const dos = await BK.drive.dossier(col, await BK.drive.racine()), corb = await BK.drive.dossier('corbeille', await BK.drive.racine());
    await BK.drive.api(`/files/${id}?addParents=${corb}&removeParents=${dos}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    delete BK.drive.ids[col][nom];
  },

  // ---------- ce qui a été créé sur ce PC avant la connexion part dans le Drive ----------
  async envoyerLocal() {
    for (const col of ['morceaux', 'taches', 'evenements', 'config', 'inventaires']) {
      const loc = BK.reglage('db.' + col, {}); if (!Object.keys(loc).length) continue;
      const dist = await BK.drive.liste(col);
      for (const f of Object.values(loc)) if (!dist[f.id] || (f.maj || '') > (dist[f.id].maj || '')) await BK.drive.ecrire(col, f);
      BK.regler('db.envoye.' + col, true);
    }
  },

  // ---------- chercher des fichiers dans tout le Drive (ex. les zips du bot Discord) ----------
  async chercher(mots) {
    const q = mots.filter(m => m.length >= 3).map(m => `name contains ${BK.drive.q(m)}`).join(' and ');
    if (!q) return [];
    const r = await (await BK.drive.api('/files?' + new URLSearchParams({ q: q + " and trashed=false and mimeType!='application/vnd.google-apps.folder'",
      fields: 'files(id,name,modifiedTime,size,webViewLink,mimeType)', orderBy: 'modifiedTime desc', pageSize: '50' }))).json();
    return r.files || [];
  },
  async telecharger(id) { return new Uint8Array(await (await BK.drive.api(`/files/${id}?alt=media`)).arrayBuffer()); },

  // ---------- gros fichier (zip) → Drive, par morceaux, depuis le moteur ----------
  async envoyerFichier(chemin, nom, sousDossier) {
    const dos = await BK.drive.dossier(sousDossier, await BK.drive.racine());
    const r = await BK.T.core.invoke('drive_envoyer', { chemin, nom, dossier: dos, jeton: await BK.drive.token() });
    try { return JSON.parse(r); } catch (e) { return {}; }
  },
};

// enregistrer un fichier sur CE PC (carte d'accès…)
BK.enregistrerFichierLocal = async function (nom, octets) {
  const dos = await BK.fichier.choisirDossier('Où enregistrer ' + nom + ' ?'); if (!dos) return null;
  const p = BK.chemin(dos, nom); await BK.fichier.ecrireOctets(p, octets); return p;
};
