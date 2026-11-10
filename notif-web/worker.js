// =====================================================================
// BEESKOT · NOTIF — le petit facteur qui envoie les notifications sur les téléphones du groupe.
// Tourne chez Cloudflare (Worker gratuit « notif »). Mode d'emploi : LISEZ-MOI.txt à côté.
//
//   BEESKOT Studio (PC ou téléphone)  →  ce Worker  →  Firebase (gratuit)  →  les téléphones
//
// Tout passe par UNE adresse (POST https://notif.beeskot-music.workers.dev/) avec la clé du groupe :
//   { cle, inscrire: { appareil, qui, jeton, boite } }      un téléphone s'inscrit (ou change de prénom) ; boite = numéro de l'appli Android
//   { cle, oublier: appareil }                               un téléphone se désinscrit
//   { cle, de, pour, titre, texte, onglet, id }              envoyer maintenant. pour = 'autres' | 'tous' | ['Pierre', …]
//   { cle, rappel: { id, quand, titre, texte, onglet } }     envoyer plus tard (quand = date ISO) à tout le monde
//   { cle, annuler: id }                                     retirer un rappel
//   { cle, etat: true }                                      qui est inscrit (pour l'écran Réglages)
//
// Réglages chez Cloudflare (Settings › Variables and Secrets, et Bindings) :
//   CLE          (secret)  la clé du groupe, fabriquée dans BEESKOT Studio › Réglages › BEESKOT Mobile › Notifications
//   FCM_COMPTE   (secret)  le fichier « compte de service » de Firebase, collé en entier
//   CARNET       (KV)      le carnet : téléphones inscrits (j:…), rappels (r:…), déjà envoyés (vu:…)
//   Triggers › Cron : */15 * * * *   (toutes les 15 minutes : les rappels)
// =====================================================================
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' };
const json = (o, statut = 200) => new Response(JSON.stringify(o), { status: statut, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS } });
const court = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
const NOM_OK = /^[\p{L}\p{N} ._-]{1,30}$/u, ID_OK = /^[A-Za-z0-9_.:-]{1,120}$/;
const ONGLETS = ['accueil', 'biblio', 'agenda', 'taches', 'ecoute', 'notesvid', 'tournage', 'suivi', 'budget', 'medias'];

// deux textes égaux ? (sans donner d'indice par le temps de réponse)
function pareil(a, b) { a = String(a || ''); b = String(b || ''); let d = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return d === 0 && a.length > 0; }

// ---------- le laissez-passer Google (1 h), fabriqué à partir du compte de service ----------
let passe = { jeton: '', fin: 0 };
const b64u = x => btoa(typeof x === 'string' ? x : String.fromCharCode(...new Uint8Array(x))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function laissezPasser(env) {
  if (passe.jeton && Date.now() < passe.fin - 60e3) return passe.jeton;
  const c = JSON.parse(env.FCM_COMPTE), t = Math.floor(Date.now() / 1000);
  const tete = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' })), corps = b64u(JSON.stringify({ iss: c.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: t, exp: t + 3600 }));
  const der = Uint8Array.from(atob(c.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), ch => ch.charCodeAt(0));
  const cle = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = b64u(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cle, new TextEncoder().encode(tete + '.' + corps)));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + tete + '.' + corps + '.' + sig });
  if (!r.ok) throw new Error('Google a refusé le compte de service (' + r.status + ')');
  const j = await r.json(); passe = { jeton: j.access_token, fin: Date.now() + (j.expires_in || 3600) * 1000 };
  return passe.jeton;
}

// ---------- le carnet des téléphones ----------
async function telephones(env) {
  const out = []; let curseur;
  do { const l = await env.CARNET.list({ prefix: 'j:', cursor: curseur }); curseur = l.list_complete ? null : l.cursor;
    for (const k of l.keys) { const v = k.metadata || await env.CARNET.get(k.name, 'json'); if (v && v.jeton) out.push({ appareil: k.name.slice(2), qui: v.qui || '', jeton: v.jeton, boite: v.boite || 1 }); } } while (curseur);
  return out;
}
const memeNom = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

// ---------- envoyer une notification à une liste de téléphones ----------
async function envoyer(env, cibles, m) {
  if (!cibles.length) return { envoyes: 0, rates: 0 };
  const c = JSON.parse(env.FCM_COMPTE), jeton = await laissezPasser(env); let envoyes = 0, rates = 0;
  await Promise.all(cibles.map(async tel => {
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${c.project_id}/messages:send`, { method: 'POST', headers: { Authorization: 'Bearer ' + jeton, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: tel.boite >= 2
        // appli récente (boîte 2+) : on n'envoie que les données, c'est l'appli qui fabrique la notification avec le rond DARI en couleur
        ? { token: tel.jeton, data: { titre: m.titre, texte: m.texte || '', onglet: m.onglet || 'accueil', id: m.id || '' }, android: { priority: 'high' } }
        // ancienne appli : Google fabrique la notification lui-même
        : { token: tel.jeton, notification: { title: m.titre, body: m.texte }, data: { onglet: m.onglet || 'accueil' }, android: { priority: 'high', notification: { channel_id: 'beeskot', tag: m.id || undefined } } } }) });
    if (r.ok) { envoyes++; return; }
    rates++;
    if (r.status === 404 || r.status === 400) { const t = await r.text(); if (/UNREGISTERED|INVALID_ARGUMENT|registration token/i.test(t)) await env.CARNET.delete('j:' + tel.appareil); }   // l'appli a été désinstallée : on raye ce téléphone
  }));
  return { envoyes, rates };
}
const message = d => ({ titre: court(d.titre, 80) || 'BEESKOT Studio', texte: court(d.texte, 240), onglet: ONGLETS.includes(d.onglet) ? d.onglet : 'accueil', id: ID_OK.test(d.id || '') ? d.id : '' });

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (req.method !== 'POST') return new Response('BEESKOT · notif', { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CORS } });
    let d; try { d = JSON.parse((await req.text()).slice(0, 8000)); } catch (e) { return json({ erreur: 'demande illisible' }, 400); }
    if (!env.CLE || !pareil(d && d.cle, env.CLE)) return json({ erreur: 'clé refusée' }, 403);
    if (!env.CARNET) return json({ erreur: 'carnet (KV) non relié' }, 500);
    try {
      if (d.inscrire) { const i = d.inscrire;
        if (!ID_OK.test(i.appareil || '') || !NOM_OK.test(i.qui || '') || typeof i.jeton !== 'string' || i.jeton.length < 20 || i.jeton.length > 4096) return json({ erreur: 'inscription incomplète' }, 400);
        const v = { qui: court(i.qui, 30), jeton: i.jeton, t: Date.now(), boite: Math.max(1, Math.min(99, parseInt(i.boite, 10) || 1)) };
        await env.CARNET.put('j:' + i.appareil, JSON.stringify(v), { metadata: v }); return json({ ok: true }); }
      if (d.oublier) { if (ID_OK.test(d.oublier)) await env.CARNET.delete('j:' + d.oublier); return json({ ok: true }); }
      if (d.etat) { const l = await telephones(env); return json({ ok: true, pret: !!env.FCM_COMPTE, telephones: l.map(t => ({ appareil: t.appareil, qui: t.qui })) }); }
      if (d.annuler) { if (ID_OK.test(d.annuler)) await env.CARNET.delete('r:' + d.annuler); return json({ ok: true }); }
      if (!env.FCM_COMPTE) return json({ erreur: 'compte Firebase non collé (FCM_COMPTE)' }, 500);
      if (d.rappel) { const r = d.rappel, quand = Date.parse(r.quand);
        if (!ID_OK.test(r.id || '') || !isFinite(quand)) return json({ erreur: 'rappel incomplet' }, 400);
        if (quand < Date.now() - 60e3) { await env.CARNET.delete('r:' + r.id); return json({ ok: true, passe: true }); }        // déjà passé : pas de rappel
        if (quand > Date.now() + 400 * 864e5) return json({ erreur: 'rappel trop lointain' }, 400);
        await env.CARNET.put('r:' + r.id, JSON.stringify({ quand, ...message({ ...r, id: 'r-' + r.id }) }), { expiration: Math.floor(quand / 1000) + 2 * 86400 }); return json({ ok: true }); }
      // envoyer maintenant
      const m = message(d); if (!m.texte && !d.titre) return json({ erreur: 'message vide' }, 400);
      if (m.id) { if (await env.CARNET.get('vu:' + m.id)) return json({ ok: true, deja: true }); await env.CARNET.put('vu:' + m.id, '1', { expirationTtl: 7 * 86400 }); }   // deux PC voient la même chose : une seule notification
      let cibles = await telephones(env);
      if (Array.isArray(d.pour)) cibles = cibles.filter(t => d.pour.some(n => memeNom(n, t.qui)));
      else if (d.pour !== 'tous') cibles = cibles.filter(t => !memeNom(t.qui, d.de));                                             // « autres » : pas celui qui a fait l'action
      if (d.sauf) cibles = cibles.filter(t => t.appareil !== d.sauf);
      return json({ ok: true, ...(await envoyer(env, cibles, m)) });
    } catch (e) { return json({ erreur: String(e && e.message || e).slice(0, 200) }, 500); }
  },

  // toutes les 15 minutes : les rappels dont l'heure est arrivée partent, puis sont rayés
  async scheduled(evt, env, ctx) {
    if (!env.CARNET || !env.FCM_COMPTE) return;
    let curseur, cibles = null;
    do { const l = await env.CARNET.list({ prefix: 'r:', cursor: curseur }); curseur = l.list_complete ? null : l.cursor;
      for (const k of l.keys) { const r = await env.CARNET.get(k.name, 'json'); if (!r || r.quand > Date.now()) continue;
        await env.CARNET.delete(k.name);                                                    // rayé d'abord : jamais deux fois
        if (Date.now() - r.quand > 6 * 3600e3) continue;                                    // trop vieux (le facteur était en panne) : on n'envoie pas un rappel périmé
        cibles = cibles || await telephones(env); await envoyer(env, cibles, r); } } while (curseur);
  },
};
