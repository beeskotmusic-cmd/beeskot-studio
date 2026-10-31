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
  relie() { const c = BK.drive.conf(); return !!((BK.estExe || window.BK_MOBILE) && c && c.refresh_token); },   // le téléphone (page mobile) aussi
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
    // rangée toute seule sur le Bureau : pas de fenêtre où se perdre
    const bureau = await BK.T.path.desktopDir().catch(() => null) || await BK.T.path.documentDir();
    const p = BK.chemin(bureau, 'BEESKOT-carte-acces.json');
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
  // la copie de chaque collection : en MÉMOIRE d'abord (lue une seule fois depuis le navigateur),
  // et réécrite dans le navigateur seulement si quelque chose a changé — et seulement si elle n'est pas énorme.
  memo: {},
  cacheDe(col) {
    if (!BK.drive.memo[col]) BK.drive.memo[col] = { c: BK.reglage('drive.cache.' + col, {}), sale: false };
    return BK.drive.memo[col];
  },
  garderCache(col) {
    const m = BK.drive.memo[col]; if (!m || !m.sale) return; m.sale = false;
    try { const txt = JSON.stringify(m.c);
      if (txt.length > 1_500_000) { localStorage.removeItem('bk.drive.cache.' + col); return; }     // trop gros pour le navigateur : on la garde en mémoire seulement
      localStorage.setItem('bk.drive.cache.' + col, txt); } catch (e) {}
  },
  async liste(col) {
    const dos = await BK.drive.dossier(col, await BK.drive.racine());
    const memo = BK.drive.cacheDe(col), cache = memo.c, out = {}; BK.drive.ids[col] = {};
    let page = '';
    do {
      const r = await (await BK.drive.api('/files?' + new URLSearchParams({ q: `${BK.drive.q(dos)} in parents and trashed=false`, fields: 'nextPageToken,files(id,name,modifiedTime)', pageSize: '1000', pageToken: page }))).json();
      for (const f of r.files || []) {
        if (!f.name.endsWith('.json')) continue;
        BK.drive.ids[col][f.name] = f.id;
        const c = cache[f.id];
        if (c && c.t === f.modifiedTime) { out[c.fiche.id] = c.fiche; continue; }      // déjà à jour : on ne retélécharge pas
        try { const fiche = await (await BK.drive.api(`/files/${f.id}?alt=media`)).json(); out[fiche.id] = fiche; cache[f.id] = { t: f.modifiedTime, fiche }; memo.sale = true; }
        catch (e) { if (c) out[c.fiche.id] = c.fiche; else throw e; }   // une fiche illisible : jamais une liste « à trous » (on croirait qu'elle n'existe pas, et on l'écraserait)
      }
      page = r.nextPageToken || '';
    } while (page);
    const vivants = new Set(Object.values(BK.drive.ids[col]));
    for (const k of Object.keys(cache)) if (!vivants.has(k)) { delete cache[k]; memo.sale = true; }
    BK.drive.garderCache(col);
    return out;
  },
  async ecrire(col, fiche) {
    const dos = await BK.drive.dossier(col, await BK.drive.racine()), nom = fiche.id + '.json', corps = JSON.stringify(fiche, null, 1);
    let id = (BK.drive.ids[col] || {})[nom];
    if (!id) { const l = await (await BK.drive.api('/files?' + new URLSearchParams({ q: `name=${BK.drive.q(nom)} and ${BK.drive.q(dos)} in parents and trashed=false`, fields: 'files(id)' }))).json(); id = l.files && l.files[0] && l.files[0].id; }
    if (id && fiche.graine) return;                                    // PROTECTION : une fiche de départ n'écrase JAMAIS une fiche qui existe déjà dans le Drive
    if (id) await BK.drive.api(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: corps });
    else {
      const b = 'bk' + Date.now(), multi = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: nom, parents: [dos] })}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${corps}\r\n--${b}--`;
      id = (await (await BK.drive.api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body: multi })).json()).id;
    }
    (BK.drive.ids[col] = BK.drive.ids[col] || {})[nom] = id;
    (BK.drive.ecrits = BK.drive.ecrits || {})[nom] = Date.now();      // on s'en souvient : ce n'est pas « un autre PC a changé quelque chose »
  },
  // les vignettes : gardées en mémoire, mais pas sans limite (les plus anciennes sont libérées)
  vignetteGarder(id, url) {
    const v = BK.drive.vignettes; v[id] = url;
    const cles = Object.keys(v);
    if (cles.length > 300) for (const k of cles.slice(0, cles.length - 300)) { try { URL.revokeObjectURL(v[k]); } catch (e) {} delete v[k]; }
    return url;
  },
  async supprimer(col, idFiche) {              // jamais effacé : déplacé dans « corbeille »
    const nom = idFiche + '.json', id = (BK.drive.ids[col] || {})[nom]; if (!id) return;
    const dos = await BK.drive.dossier(col, await BK.drive.racine()), corb = await BK.drive.dossier('corbeille', await BK.drive.racine());
    await BK.drive.api(`/files/${id}?addParents=${corb}&removeParents=${dos}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    delete BK.drive.ids[col][nom];
  },

  // ---------- ce qui a été créé sur ce PC avant la connexion part dans le Drive ----------
  async envoyerLocal() {
    for (const col of ['morceaux', 'taches', 'evenements', 'config', 'inventaires', 'tournages', 'renforts', 'veille', 'propositions']) {
      const loc = BK.reglage('db.' + col, {}); if (!Object.keys(loc).length) continue;
      const dist = await BK.drive.liste(col);
      for (const f of Object.values(loc)) {
        // PROTECTION (nouveau PC qui se relie) : le Drive du groupe gagne toujours.
        // On envoie seulement ce qui n'existe pas encore dans le Drive, et jamais les fiches de départ.
        if (f.graine || dist[f.id]) continue;
        await BK.drive.ecrire(col, f);
      }
      BK.regler('db.envoye.' + col, true);
    }
  },

  // ---------- RETOUR EN ARRIÈRE : Google garde les versions précédentes de chaque fiche (30 jours) ----------
  async idFichier(col, idFiche) {
    const nom = idFiche + '.json'; let id = (BK.drive.ids[col] || {})[nom];
    if (id) return id;
    const dos = await BK.drive.dossier(col, await BK.drive.racine());
    const l = await (await BK.drive.api('/files?' + new URLSearchParams({ q: `name=${BK.drive.q(nom)} and ${BK.drive.q(dos)} in parents and trashed=false`, fields: 'files(id)' }))).json();
    id = l.files && l.files[0] && l.files[0].id;
    if (id) (BK.drive.ids[col] = BK.drive.ids[col] || {})[nom] = id;
    return id;
  },
  async versions(col, idFiche) {
    const id = await BK.drive.idFichier(col, idFiche); if (!id) return [];
    const r = await (await BK.drive.api(`/files/${id}/revisions?` + new URLSearchParams({ fields: 'revisions(id,modifiedTime)', pageSize: '200' }))).json();
    return (r.revisions || []).map(v => ({ rev: v.id, t: v.modifiedTime, fichier: id })).sort((a, b) => a.t.localeCompare(b.t));
  },
  async lireVersion(fichier, rev) { return (await BK.drive.api(`/files/${fichier}/revisions/${rev}?alt=media`)).json(); },

  // remet toute une collection telle qu'elle était avant une date (rien n'est effacé : on réécrit par-dessus)
  async restaurer(col, avant, avancement) {
    const fiches = Object.values(await BK.drive.liste(col));
    let n = 0, vus = 0;
    for (const f of fiches) {
      vus++; avancement && avancement(`${vus}/${fiches.length} · ${f.nom || f.titre || f.id}`);
      let vs = []; try { vs = await BK.drive.versions(col, f.id); } catch (e) { continue; }
      const v = vs.filter(x => x.t < avant).pop();
      if (!v) continue;
      let ancienne = null; try { ancienne = await BK.drive.lireVersion(v.fichier, v.rev); } catch (e) { continue; }
      if (!ancienne || !ancienne.id || ancienne.id !== f.id) continue;
      if (JSON.stringify(ancienne) === JSON.stringify(f)) continue;           // déjà pareil : on ne touche à rien
      await BK.drive.ecrire(col, ancienne); n++;
    }
    return n;
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

  // ---------- médias : dossiers imbriqués, liste, envoi depuis le navigateur, vignettes ----------
  async chemin(noms) { let id = await BK.drive.racine(); for (const n of noms) id = await BK.drive.dossier(n, id); return id; },
  async contenu(dossierId) {
    const r = await (await BK.drive.api('/files?' + new URLSearchParams({ q: `${BK.drive.q(dossierId)} in parents and trashed=false`, orderBy: 'createdTime desc', pageSize: '200',
      fields: 'files(id,name,mimeType,thumbnailLink,webViewLink,size,createdTime,videoMediaMetadata(durationMillis))' }))).json();
    return r.files || [];
  },
  async envoyerBlob(blob, nom, dossierId, progression) {           // par morceaux de 8 Mo : léger pour le PC, marche pour les vidéos
    const debut = await BK.drive.api('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink', { method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': blob.type || 'application/octet-stream', 'X-Upload-Content-Length': String(blob.size) },
      body: JSON.stringify({ name: nom, parents: [dossierId] }) });
    const url = debut.headers.get('Location'); if (!url) throw new Error('Drive : envoi refusé');
    const BLOC = 8 * 1024 * 1024;
    for (let a = 0; a < blob.size || a === 0; a += BLOC) {
      const b = Math.min(blob.size, a + BLOC), morceau = new Uint8Array(await blob.slice(a, b).arrayBuffer());
      const r = await BK.drive.fetch(url, { method: 'PUT', headers: { 'Content-Range': blob.size ? `bytes ${a}-${b - 1}/${blob.size}` : 'bytes */0' }, body: morceau });
      progression && progression(b / (blob.size || 1));
      if (r.status === 200 || r.status === 201) return r.json();
      if (r.status !== 308) throw new Error('Drive ' + r.status);
      if (!blob.size) break;
    }
    throw new Error('Envoi interrompu');
  },
  vignettes: {},
  async vignette(f) {                                               // petite image d'aperçu (gardée en mémoire)
    if (BK.drive.vignettes[f.id]) return BK.drive.vignettes[f.id];
    if (!f.thumbnailLink) return '';
    try { const r = await BK.drive.api(f.thumbnailLink.replace(/=s\d+$/, '=s400')); return BK.drive.vignetteGarder(f.id, URL.createObjectURL(await r.blob())); }
    catch (e) { return ''; }
  },
  async corbeille(fileId) {                                         // jamais effacé : rangé dans « corbeille » de BEESKOT Studio
    const corb = await BK.drive.dossier('corbeille', await BK.drive.racine());
    const f = await (await BK.drive.api(`/files/${fileId}?fields=parents`)).json();
    await BK.drive.api(`/files/${fileId}?addParents=${corb}&removeParents=${(f.parents || []).join(',')}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  },

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
