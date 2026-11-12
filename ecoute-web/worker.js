// =====================================================================
// BEESKOT · ÉCOUTE — la page qu'on envoie à quelqu'un de l'extérieur pour écouter nos morceaux.
// Tourne chez Cloudflare (Worker gratuit « ecoute »). Mode d'emploi : LISEZ-MOI.txt à côté.
//
//   https://ecoute.beeskot-music.workers.dev/<id>          la page (pochette, titre, lecteur)
//   https://ecoute.beeskot-music.workers.dev/<id>/a/<n>    le son du morceau n (passe par ici)
//   https://ecoute.beeskot-music.workers.dev/<id>/c/<n>    la pochette du morceau n (passe par ici)
//
//   https://ecoute.beeskot-music.workers.dev/t/<id>        TOURNAGES pour le cameraman (lecture seule, même look que le logiciel)
//   https://ecoute.beeskot-music.workers.dev/t/<id>/i/<n>  l'image n de cette page (passe par ici)
//
// <id> = l'identifiant du fichier du lien dans le Drive (BEESKOT Studio/partages/ec-….json),
// fabriqué par BEESKOT Studio (Bibliothèque › Partager l'écoute). Le fichier n'est lisible que tant
// que le lien est actif : « Révoquer » dans le logiciel = la page répond « Ce lien n'est plus actif ».
// Date d'expiration (choisie dans le logiciel) : passée = « Ce lien a expiré ».
//
// L'invité ne passe JAMAIS par une page Google : pas de bug « plusieurs comptes Google ».
// Le son et les pochettes passent par ici : l'adresse des fichiers du Drive n'est jamais montrée.
// Pas de bouton de téléchargement ; le son refuse d'être ouvert directement dans un onglet.
//
// Réglage chez Cloudflare (Settings › Variables and Secrets) : CLE_API = la clé gratuite Google
// (la même que « La clé gratuite Google » dans BEESKOT Studio › Notes et retours › Externe).
// =====================================================================
const ASSETS = 'https://cdn.jsdelivr.net/gh/beeskotmusic-cmd/beeskot-studio@787cfcf/ui/';
const DRIVE = 'https://www.googleapis.com/drive/v3/files/';
// les styles du logiciel (pour la page Tournages : exactement le même look). Figé sur une version : à changer quand le look change.
const APP = 'https://cdn.jsdelivr.net/gh/beeskotmusic-cmd/beeskot-studio@dede2f0/ui/';
const ID_OK = /^[A-Za-z0-9_-]{20,80}$/;

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// la fiche du lien (gardée 30 s : « Révoquer » marche en moins d'une minute)
const estEcoute = j => j && j.type === 'ecoute' && Array.isArray(j.elements);
const estTournage = j => j && j.type === 'tournage' && typeof j.html === 'string' && Array.isArray(j.elements);
async function lireLien(id, env, ctx, valide = estEcoute) {
  const cache = caches.default, cle = new Request('https://cache.ecoute/lien/' + (valide === estTournage ? 't/' : '') + id);
  const deja = await cache.match(cle); if (deja) { const j = await deja.json(); return j && j.ok ? j.lien : null; }
  let lien = null;
  try {
    const r = await fetch(DRIVE + id + '?alt=media&key=' + encodeURIComponent(env.CLE_API || ''));
    if (r.ok) { const j = await r.json(); if (valide(j)) lien = j; }
  } catch (e) { lien = null; }
  ctx.waitUntil(cache.put(cle, new Response(JSON.stringify({ ok: !!lien, lien }), { headers: { 'Cache-Control': 'max-age=30' } })));
  return lien;
}

function reponseHtml(html, statut = 200) {
  return new Response(html, { status: statut, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' https://cdn.jsdelivr.net data:; style-src 'self' 'unsafe-inline'; font-src https://cdn.jsdelivr.net; script-src 'unsafe-inline'; media-src 'self'; frame-ancestors 'none'" } });
}

// ---------- EXTRAIT (lien.extrait = N secondes, depuis le début) ----------
// Cloudflare n'envoie que le début du fichier : l'invité ne peut pas écouter plus loin, même en bidouillant.
// On lit l'en-tête du fichier (WAV ou MP3) pour savoir combien d'octets font N secondes, et on corrige
// l'en-tête envoyé (durée) pour que le lecteur voie un fichier court. Autres formats : la page s'arrête à N s.
const MARGE = 1;                                                    // 1 s de plus, la page coupe pile à N s
const u32le = (b, o) => (b[o] | b[o + 1] << 8 | b[o + 2] << 16 | b[o + 3] << 24) >>> 0;
const u32be = (b, o) => (b[o] << 24 | b[o + 1] << 16 | b[o + 2] << 8 | b[o + 3]) >>> 0;
const le4 = v => [v & 255, v >>> 8 & 255, v >>> 16 & 255, v >>> 24 & 255];
const be4 = v => [v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255];
async function morceauDe(fichier, env, a, n) {                       // n octets du fichier à partir de a (+ sa taille totale)
  const r = await fetch(DRIVE + fichier + '?alt=media&key=' + encodeURIComponent(env.CLE_API || ''), { headers: { Range: `bytes=${a}-${a + n - 1}` } });
  if (r.status !== 206 && !r.ok) throw new Error('son ' + r.status);
  const m = /\/(\d+)$/.exec(r.headers.get('Content-Range') || ''); const b = new Uint8Array(await r.arrayBuffer());
  return { b: r.status === 206 ? b : b.subarray(a, a + n), total: m ? +m[1] : +(r.headers.get('Content-Length') || 0), type: r.headers.get('Content-Type') || '' };
}
async function analyser(fichier, secs, env) {
  const s = secs + MARGE, d = await morceauDe(fichier, env, 0, 16384), b = d.b, total = d.total;
  const txt = (o, n, x = b) => String.fromCharCode(...x.subarray(o, o + n));
  if (txt(0, 4) === 'RIFF' && txt(8, 4) === 'WAVE') {               // WAV : octets par seconde dans « fmt », le son commence à « data »
    let o = 12, debit = 0, bloc = 1;
    for (let i = 0; i < 64 && o + 8 <= total; i++) {
      const h = o + 8 <= b.length ? b.subarray(o, o + 8) : (await morceauDe(fichier, env, o, 8)).b, id = txt(0, 4, h), taille = u32le(h, 4);
      if (id === 'fmt ') { const f = o + 24 <= b.length ? b.subarray(o + 8, o + 24) : (await morceauDe(fichier, env, o + 8, 16)).b; debit = u32le(f, 8); bloc = f[12] | f[13] << 8 || 1; }
      if (id === 'data') { if (!debit) break; const debut = o + 8, lim = Math.min(total, debut + Math.floor(debit * s / bloc) * bloc);
        return { limite: lim, retouches: [{ o: 4, b: le4(lim - 8) }, { o: o + 4, b: le4(lim - debut) }] }; }
      o += 8 + taille + (taille & 1); }
    return null; }
  // MP3 : on saute l'étiquette ID3 (pochette, etc.), puis la première trame donne le débit (ou l'en-tête Xing / VBRI si débit variable)
  let debut = 0, x = b;
  if (txt(0, 3) === 'ID3') { debut = 10 + ((b[6] & 127) << 21 | (b[7] & 127) << 14 | (b[8] & 127) << 7 | (b[9] & 127)) + (b[5] & 16 ? 10 : 0); x = (await morceauDe(fichier, env, debut, 16384)).b; }
  let p = -1; for (let i = 0; i + 4 < x.length; i++) if (x[i] === 255 && (x[i + 1] & 0xE6) === 0xE2 && (x[i + 2] >> 4) !== 15 && (x[i + 2] >> 4) && ((x[i + 2] >> 2) & 3) !== 3) { p = i; break; }
  if (p < 0) return null;
  const v = (x[p + 1] >> 3) & 3, mp1 = v === 3, ch1 = (x[p + 3] >> 6) === 3;
  const KB = mp1 ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320] : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
  const sr = [44100, 48000, 32000][(x[p + 2] >> 2) & 3] / (mp1 ? 1 : v === 2 ? 2 : 4), spf = mp1 ? 1152 : 576;
  const xo = p + 4 + (mp1 ? (ch1 ? 17 : 32) : (ch1 ? 9 : 17)), vo = p + 36, audio = total - debut - p, nTrames = Math.ceil(s * sr / spf);
  const xing = ['Xing', 'Info'].includes(txt(xo, 4, x)), vbri = !xing && txt(vo, 4, x) === 'VBRI', fl = xing ? u32be(x, xo + 4) : 0;
  let parSec = KB[x[p + 2] >> 4] * 125, trames = 0, octets = 0;
  if (xing) { let q = xo + 8; if (fl & 1) { trames = u32be(x, q); q += 4; } if (fl & 2) octets = u32be(x, q); }
  if (vbri) { octets = u32be(x, vo + 10); trames = u32be(x, vo + 14); }
  let n = 0;                                                         // combien d'octets font s secondes
  if (trames) { const duree = trames * spf / sr, tout = octets || audio, q = xo + 8 + (fl & 1 ? 4 : 0) + (fl & 2 ? 4 : 0);
    if (xing && (fl & 4) && q + 100 <= x.length && duree > s) n = Math.ceil(x[q + Math.min(99, Math.ceil(s / duree * 100) + 1)] / 256 * tout);   // la table de saut : précis à 1 % près
    else n = Math.ceil(tout / duree * s * 1.2); }                    // sinon la moyenne, avec 20 % de marge (le début peut être plus « lourd »)
  else n = Math.ceil(parSec * s);                                    // débit fixe : exact
  if (!n) return null;
  const lim = Math.min(total, debut + p + n), R = [];
  if (xing) { R.push({ o: xo + 4, b: be4(fl & ~4) });                // on enlève la table de saut (elle décrit le fichier entier)
    let q = xo + 8; if (fl & 1) { R.push({ o: q, b: be4(nTrames) }); q += 4; } if (fl & 2) R.push({ o: q, b: be4(lim - debut - p) }); }
  if (vbri) R.push({ o: vo + 10, b: be4(lim - debut - p) }, { o: vo + 14, b: be4(nTrames) });
  return { limite: lim, retouches: R.map(r => ({ o: r.o + debut, b: r.b })) };
}
// gardé un jour : une version ★ = un fichier du Drive (une nouvelle ★ = un autre fichier)
async function infoExtrait(el, secs, env, ctx) {
  const cache = caches.default, cle = new Request('https://cache.ecoute/extrait/' + el.fichier + '/' + secs);
  const deja = await cache.match(cle); if (deja) return deja.json();
  let info = null; try { info = await analyser(el.fichier, secs, env); } catch (e) { info = null; }
  ctx.waitUntil(cache.put(cle, new Response(JSON.stringify(info), { headers: { 'Cache-Control': 'max-age=86400' } })));
  return info;
}
// on recopie les octets demandés en corrigeant ceux de l'en-tête (la durée), au passage
function retoucher(corps, debutPlage, retouches) {
  if (!retouches.length) return corps;
  let pos = debutPlage;
  return corps.pipeThrough(new TransformStream({ transform(bout, ctrl) {
    const fin = pos + bout.length; let copie = null;
    for (const r of retouches) for (let k = 0; k < r.b.length; k++) { const o = r.o + k; if (o >= pos && o < fin) { copie = copie || new Uint8Array(bout); copie[o - pos] = r.b[k]; } }
    pos = fin; ctrl.enqueue(copie || bout); } }));
}

// le son : on relaie le fichier du Drive par petits bouts (Range), sans jamais montrer son adresse
async function son(req, el, env, lien, ctx) {
  const dest = req.headers.get('Sec-Fetch-Dest'), site = req.headers.get('Sec-Fetch-Site');
  if ((dest && !['audio', 'video', 'empty'].includes(dest)) || (site && site !== 'same-origin')) return new Response('Écoute seulement.', { status: 403 });
  const secs = Math.round(+lien.extrait || 0), info = secs > 0 ? await infoExtrait(el, secs, env, ctx) : null;
  if (info) return sonCoupe(req, el, env, info);
  const h = {}; const range = req.headers.get('Range'); if (range) h.Range = range;
  const r = await fetch(DRIVE + el.fichier + '?alt=media&key=' + encodeURIComponent(env.CLE_API || ''), { headers: h });
  if (!r.ok && r.status !== 206) return new Response('Son indisponible.', { status: 404 });
  const out = new Headers();
  for (const k of ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges']) { const v = r.headers.get(k); if (v) out.set(k, v); }
  if (!out.get('Accept-Ranges')) out.set('Accept-Ranges', 'bytes');
  out.set('Cache-Control', 'private, no-store'); out.set('Content-Disposition', 'inline'); out.set('X-Robots-Tag', 'noindex');
  return new Response(r.body, { status: r.status, headers: out });
}

// le son d'un extrait : seulement les octets des N premières secondes, comme si le fichier s'arrêtait là
async function sonCoupe(req, el, env, info) {
  const lim = info.limite, rg = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('Range') || '');
  let a = 0, b = lim - 1;
  if (rg) { if (rg[1] === '') a = Math.max(0, lim - (+rg[2] || 0)); else { a = +rg[1]; if (rg[2] !== '') b = Math.min(+rg[2], lim - 1); } }
  if (a >= lim || a > b) return new Response('', { status: 416, headers: { 'Content-Range': 'bytes */' + lim } });
  const r = await fetch(DRIVE + el.fichier + '?alt=media&key=' + encodeURIComponent(env.CLE_API || ''), { headers: { Range: `bytes=${a}-${b}` } });
  if (r.status !== 206) return new Response('Son indisponible.', { status: 404 });
  const out = new Headers({ 'Content-Type': r.headers.get('Content-Type') || 'audio/mpeg', 'Accept-Ranges': 'bytes', 'Content-Length': String(b - a + 1),
    'Cache-Control': 'private, no-store', 'Content-Disposition': 'inline', 'X-Robots-Tag': 'noindex' });
  if (rg) out.set('Content-Range', `bytes ${a}-${b}/${lim}`);
  return new Response(retoucher(r.body, a, info.retouches), { status: rg ? 206 : 200, headers: out });
}

// ---------- LES ÉCOUTES : la page prévient quand un morceau a vraiment joué (10 s), on compte par lien et par morceau ----------
// Rangé chez Cloudflare (KV « ECOUTES », gratuit). Sans KV relié, rien n'est compté et la page marche quand même.
const rien = () => new Response(null, { status: 204 });
async function compter(req, id, n, el, env, ctx) {
  if (!env.ECOUTES) return rien();
  const site = req.headers.get('Sec-Fetch-Site'); if (site && site !== 'same-origin') return rien();
  const cache = caches.default, anti = new Request(`https://cache.ecoute/vu/${id}/${n}/${req.headers.get('CF-Connecting-IP') || ''}`);
  if (await cache.match(anti)) return rien();                       // pas deux écoutes du même morceau en 20 s (clics répétés)
  ctx.waitUntil(cache.put(anti, new Response('1', { headers: { 'Cache-Control': 'max-age=20' } })));
  const cle = 'e:' + id, j = (await env.ECOUTES.get(cle, 'json')) || { m: {} }, quand = new Date().toISOString(), k = el.id || String(n);
  const x = j.m[k] = j.m[k] || { n: 0 }; x.n++; x.nom = el.nom; x.dernier = quand; j.dernier = quand;
  await env.ECOUTES.put(cle, JSON.stringify(j));
  return rien();
}
// lu par BEESKOT Studio (Partager l'écoute) : marche aussi pour un lien révoqué ou expiré
async function stats(id, env) {
  const j = env.ECOUTES ? await env.ECOUTES.get('e:' + id, 'json') : null;
  return new Response(JSON.stringify({ ok: !!env.ECOUTES, m: (j && j.m) || {}, dernier: (j && j.dernier) || '' }),
    { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } });
}

// la pochette : gardée un jour chez Cloudflare (rapide), refaite si la photo change (autre fichier)
// une image de la page Tournages : le fichier s'il est une image, sinon (vidéo, PDF…) la vignette que Google en fait
async function imageT(fichier, env, ctx) {
  if (!fichier || !ID_OK.test(fichier)) return new Response('', { status: 404 });
  const cache = caches.default, cle = new Request('https://cache.ecoute/timg/' + fichier);
  const deja = await cache.match(cle); if (deja) return deja;
  const cleApi = encodeURIComponent(env.CLE_API || '');
  let r = await fetch(DRIVE + fichier + '?alt=media&key=' + cleApi), type = r.headers.get('Content-Type') || '';
  if (!r.ok || !/^image\//.test(type)) {
    try { const m = await (await fetch(DRIVE + fichier + '?fields=thumbnailLink&key=' + cleApi)).json();
      if (m && m.thumbnailLink) { r = await fetch(m.thumbnailLink.replace(/=s\d+$/, '=s1200')); type = r.headers.get('Content-Type') || ''; } } catch (e) {}
  }
  if (!r.ok || !/^image\//.test(type)) return new Response('', { status: 404 });
  const rep = new Response(r.body, { headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400' } });
  ctx.waitUntil(cache.put(cle, rep.clone()));
  return rep;
}
// la page Tournages : le HTML fabriqué par le logiciel (mode lecture, sans boutons), dans les mêmes boîtes, avec les mêmes styles
function pageTournage(id, l) {
  const okC = c => String(c || '').replace(/[^\w -]/g, ''), okT = t => /^(div|section|main|article|aside)$/.test(t) ? t : 'div';
  const chaine = (Array.isArray(l.chaine) ? l.chaine : []).slice(0, 12);
  const ouvre = chaine.map(x => `<${okT(x.t)}${x.id ? ` id="${okC(x.id)}"` : ''} class="tw-ch ${okC(x.c)}">`).join('');
  const ferme = chaine.slice().reverse().map(x => `</${okT(x.t)}>`).join('');
  const css = (Array.isArray(l.css) ? l.css : []).filter(h => /^style\/[\w.-]+\.css$/.test(h)).map(h => `<link rel="stylesheet" href="${APP}${h}">`).join('');
  const corps = String(l.html || '').replace(/<script[\s\S]*?<\/script>/gi, '').split('__IMG__/').join('/t/' + id + '/i/');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>BEESKOT · Tournages${l.nom ? ' · ' + esc(l.nom) : ''}</title>${css}<style>${CSS_T}</style></head>
<body class="${okC(l.corps)} tw-page" data-section="${okC(l.section || 'orga')}"><div class="tw-haut"><img src="${APP}look/logo-beeskot-flat.png" alt="BEESKOT"><span>Tournages · lecture seule</span></div>
<div class="tw-cadre">${ouvre}${corps}${ferme}</div><footer class="tw-pied">fait avec Dari Band Studio · mis à jour le ${esc(new Date(l.maj || Date.now()).toLocaleString('fr-CA', { timeZone: 'America/Toronto', dateStyle: 'long', timeStyle: 'short' }))}</footer></body></html>`;
}
// pour que la page défile normalement dans un navigateur (dans le logiciel, tout tient dans la fenêtre)
const CSS_T = `
html{height:auto!important;overflow:auto!important}
body.tw-page{height:auto!important;max-height:none!important;min-height:100%;overflow:visible!important;display:block!important;position:static!important}
.tw-page .tw-ch{display:block!important;width:auto!important;max-width:100%!important;min-width:0!important;height:auto!important;max-height:none!important;min-height:0!important;overflow:visible!important;position:static!important;margin:0!important;flex:none!important;grid-template-columns:none!important;transform:none!important;inset:auto!important}
.tw-page .tw-ch:not(.pane){padding:0!important;border:0!important;background:none!important;box-shadow:none!important}
.tw-page .tw-cadre{max-width:1180px;margin:0 auto;padding:14px 14px 30px}
.tw-page .tw-tour{margin-bottom:26px}
.tw-page .tw-tour .to-affiche{cursor:default;min-height:120px}
.tw-page .tw-tour .to-deplie{margin-top:10px}
.tw-page .tt-reel-corps{display:block!important}
.tw-haut{display:flex;align-items:center;gap:14px;padding:12px 18px;background:rgba(0,0,0,.35);box-shadow:0 3px 10px rgba(0,0,0,.4)}
.tw-haut img{height:40px}.tw-haut span{font:700 12px Jost,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#e7c796}
.tw-pied{text-align:center;font:600 11px Jost,system-ui,sans-serif;color:rgba(239,230,210,.5);padding:0 0 24px}
.tw-page .lect-txt{display:block;white-space:pre-wrap;overflow-wrap:break-word;height:auto!important;min-height:0!important;width:auto!important;max-width:100%}
.tw-page .lect-v{display:block}
.tw-page .tw-defile{overflow-x:auto;max-width:100%;-webkit-overflow-scrolling:touch}
@media (max-width:700px){.tw-page .tw-cadre{padding:6px}.tw-page .to-infos,.tw-page .tt-tenues,.tw-page .to-deux,.tw-page [class*="cols"]{grid-template-columns:1fr!important;display:grid!important}
  .tw-page .deux-box{display:flex!important;flex-direction:column!important}.tw-page .tw-defile .to-plans{min-width:980px}
  .tw-page .to-infos>label{grid-column:auto!important}.tw-haut span{font-size:10px}.tw-page .box{padding-left:10px!important;padding-right:10px!important}}
`;
async function pochette(el, env, ctx) {
  if (!el.image || !ID_OK.test(el.image)) return new Response('', { status: 404 });
  const cache = caches.default, cle = new Request('https://cache.ecoute/img/' + el.image);
  const deja = await cache.match(cle); if (deja) return deja;
  const r = await fetch(DRIVE + el.image + '?alt=media&key=' + encodeURIComponent(env.CLE_API || ''));
  const type = r.headers.get('Content-Type') || '';
  if (!r.ok || !/^image\//.test(type)) return new Response('', { status: 404 });
  const rep = new Response(r.body, { headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400' } });
  ctx.waitUntil(cache.put(cle, rep.clone()));
  return rep;
}

const CSS = `
@font-face{font-family:'Jost';font-weight:600;src:url(${ASSETS}fonts/jost-latin-600-normal.woff2) format('woff2')}
@font-face{font-family:'Jost';font-weight:700;src:url(${ASSETS}fonts/jost-latin-700-normal.woff2) format('woff2')}
@font-face{font-family:'Share Tech Mono';font-weight:400;src:url(${ASSETS}fonts/share-tech-mono-latin-400-normal.woff2) format('woff2')}
:root{--creme:#f3ece0;--creme2:#cdbfae;--rouge:#3a0d12}
*{box-sizing:border-box}
html,body{margin:0;min-height:100%}
body{background:linear-gradient(rgba(15,4,6,.6),rgba(15,4,6,.6)),url(${ASSETS}look/tweed-rouge-fond.jpg) 0 0/254px auto repeat fixed,#1a0508;color:var(--creme);font:600 14px Jost,system-ui,sans-serif;-webkit-user-select:none;user-select:none}
.haut{height:86px;display:flex;align-items:center;justify-content:center;background:linear-gradient(rgba(20,4,6,.12),rgba(20,4,6,.12)),url(${ASSETS}look/velours-orga.jpg) center/520px auto repeat-x;box-shadow:0 4px 14px rgba(0,0,0,.55);border-bottom:1px solid rgba(255,255,255,.12)}
.haut img{height:54px;filter:drop-shadow(0 3px 4px rgba(0,0,0,.6))}
main{max-width:980px;margin:0 auto;padding:26px 16px 40px}
.sous{display:flex;align-items:baseline;gap:10px;margin:0 4px 16px;color:var(--creme2);font-size:12px;letter-spacing:.14em;text-transform:uppercase}
.sous b{color:var(--creme);font-size:13px}
.m{display:flex;gap:16px;align-items:center;padding:12px;margin-bottom:10px;border-radius:12px;background:rgba(14,3,5,.55);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1),0 4px 12px rgba(0,0,0,.35)}
.m.joue{box-shadow:inset 0 0 0 1px rgba(255,255,255,.35),0 4px 16px rgba(0,0,0,.45)}
.ph{flex:none;width:76px;height:76px;border-radius:6px;background:#12060a center/cover no-repeat;box-shadow:0 2px 6px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.14)}
.ph.vide{display:grid;place-items:center;color:var(--creme2);font-size:26px}
.d{flex:1;min-width:0}
.t{font:700 15px Jost,sans-serif;letter-spacing:.06em;text-transform:uppercase;margin:2px 0 9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lect{display:flex;align-items:center;gap:10px;padding:8px 14px;border-radius:12px;background:linear-gradient(180deg,rgba(30,6,10,.82),rgba(14,3,5,.9));box-shadow:inset 0 1px 0 rgba(255,255,255,.12),inset 0 -2px 6px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.14),0 3px 8px rgba(0,0,0,.45)}
.b{flex:none;width:28px;height:28px;border-radius:50%;border:0;padding:0;cursor:pointer;display:grid;place-items:center;color:#f1ece4;background:linear-gradient(180deg,#3a1218,#1c0508);box-shadow:inset 0 1px 0 rgba(255,255,255,.15),0 1px 3px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.3)}
.b:hover{box-shadow:inset 0 1px 0 rgba(255,255,255,.15),0 1px 3px rgba(0,0,0,.5),0 0 0 1px #fff}
.b.p{width:34px;height:34px;background:linear-gradient(180deg,#fff,#d9d4cc);color:var(--rouge);box-shadow:0 2px 5px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.9)}
.b svg{width:12px;height:12px;fill:currentColor}.b.p svg{width:13px;height:13px}
.barre{flex:1;height:8px;border-radius:4px;background:#12060a;box-shadow:inset 0 1px 3px #000,0 0 0 1px rgba(255,255,255,.12);cursor:pointer;overflow:hidden}
.barre i{display:block;height:100%;width:0;background:linear-gradient(90deg,#e9e2d6,#fff);box-shadow:0 0 8px rgba(255,255,255,.55)}
.tps{flex:none;min-width:92px;text-align:right;font:400 12px 'Share Tech Mono',monospace;letter-spacing:.04em;color:var(--creme)}
.vide-l{text-align:center;padding:60px 20px;color:var(--creme2);font-size:15px}
footer{text-align:center;color:rgba(243,236,224,.45);font-size:11px;letter-spacing:.12em;text-transform:uppercase;padding:10px 0 30px}
@media (max-width:600px){.m{gap:10px;padding:10px}.ph{width:56px;height:56px}.lect{gap:7px;padding:7px 9px}.b{width:26px;height:26px}.b.p{width:32px;height:32px}.tps{min-width:0;font-size:11px;margin-left:auto}.lect{flex-wrap:wrap;row-gap:9px}.barre{order:5;flex-basis:100%}.haut{height:70px}.haut img{height:42px}}
`;
const ICO = {
  prec: '<svg viewBox="0 0 12 12"><path d="M2 1h1.6v10H2zM11 1v10L4.2 6z"/></svg>',
  jouer: '<svg viewBox="0 0 12 12"><path d="M2.5 1v10L11 6z"/></svg>',
  pause: '<svg viewBox="0 0 12 12"><path d="M2 1h3v10H2zm5 0h3v10H7z"/></svg>',
  stop: '<svg viewBox="0 0 12 12"><path d="M2 2h8v8H2z"/></svg>',
  suiv: '<svg viewBox="0 0 12 12"><path d="M8.4 1H10v10H8.4zM1 1v10l6.8-5z"/></svg>',
};

function page(id, lien) {
  const els = lien.elements || [], EX = Math.max(0, Math.round(+lien.extrait || 0));
  const lignes = els.map((e, i) => `<div class="m" data-i="${i}">
    ${e.image ? `<div class="ph" style="background-image:url('/${id}/c/${i}')"></div>` : '<div class="ph vide">♪</div>'}
    <div class="d"><div class="t">${esc(e.nom)}</div>
      <div class="lect"><button class="b" data-a="prec" title="Morceau précédent">${ICO.prec}</button><button class="b p" data-a="jouer" title="Écouter">${ICO.jouer}</button><button class="b" data-a="stop" title="Arrêter">${ICO.stop}</button><button class="b" data-a="suiv" title="Morceau suivant">${ICO.suiv}</button>
        <div class="barre"><i></i></div><span class="tps">0:00</span></div></div></div>`).join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>BEESKOT · Écoute</title><style>${CSS}</style></head>
<body oncontextmenu="return false"><div class="haut"><img src="${ASSETS}look/logo-beeskot-flat.png" alt="BEESKOT"></div>
<main><div class="sous"><b>Écoute privée</b>${els.length} morceau${els.length > 1 ? 'x' : ''}${EX ? ` · extrait${els.length > 1 ? 's' : ''} de ${EX} s` : ''}</div>
${lignes || '<div class="vide-l">Aucun morceau à écouter pour l\'instant.</div>'}</main>
<footer>fait avec Dari Band Studio</footer>
<script>
(function(){
  var ID=${JSON.stringify(id)}, N=${els.length}, EX=${EX}, a=new Audio(), cur=-1, joue=0, compte=false, avant=0;
  a.preload='none';
  var IC=${JSON.stringify({ jouer: ICO.jouer, pause: ICO.pause })};
  var lignes=[].slice.call(document.querySelectorAll('.m'));
  function t(s){s=Math.max(0,Math.floor(s||0));return Math.floor(s/60)+':'+('0'+s%60).slice(-2);}
  function dur(){var d=a.duration&&isFinite(a.duration)?a.duration:0;return EX?(d?Math.min(d,EX):EX):d;}
  function maj(){lignes.forEach(function(l,i){var moi=i===cur,p=l.querySelector('[data-a=jouer]');l.classList.toggle('joue',moi);
    p.innerHTML=moi&&!a.paused?IC.pause:IC.jouer;p.title=moi&&!a.paused?'Pause':'Écouter';
    var d=moi?dur():0;l.querySelector('.barre i').style.width=d?(Math.min(a.currentTime,d)/d*100)+'%':'0';
    l.querySelector('.tps').textContent=moi?t(Math.min(a.currentTime,d||a.currentTime))+(d?' / '+t(d):''):'0:00';});}
  function neuf(){joue=0;compte=false;avant=0;}
  function jouer(i){if(i<0||i>=N)return;if(i===cur){a.paused?a.play():a.pause();return;}cur=i;neuf();a.src='/'+ID+'/a/'+i;a.play().catch(function(){});maj();}
  function fini(){if(cur<N-1)jouer(cur+1);else{a.pause();a.currentTime=0;cur=-1;neuf();maj();}}
  lignes.forEach(function(l,i){
    l.querySelector('[data-a=jouer]').onclick=function(){jouer(i);};
    l.querySelector('[data-a=stop]').onclick=function(){if(cur===i){a.pause();a.currentTime=0;neuf();maj();}};
    l.querySelector('[data-a=prec]').onclick=function(){if(cur===i&&a.currentTime>3){a.currentTime=0;}else jouer((i-1+N)%N);};
    l.querySelector('[data-a=suiv]').onclick=function(){jouer((i+1)%N);};
    l.querySelector('.barre').onclick=function(e){if(cur!==i){jouer(i);return;}var d=dur();if(!d)return;var r=this.getBoundingClientRect();a.currentTime=Math.min(d-0.3,(e.clientX-r.left)/r.width*d);};
  });
  ['play','pause','loadedmetadata','durationchange'].forEach(function(ev){a.addEventListener(ev,maj);});
  // une écoute = 10 s vraiment jouées (5 s pour un extrait très court) ; l'extrait s'arrête pile à EX secondes
  a.addEventListener('timeupdate',function(){var c=a.currentTime,dt=c-avant;avant=c;if(!a.paused&&dt>0&&dt<1.5)joue+=dt;
    if(!compte&&cur>=0&&joue>=Math.min(10,EX?Math.max(5,EX/2):10)){compte=true;fetch('/'+ID+'/e/'+cur,{method:'POST',keepalive:true}).catch(function(){});}
    if(EX&&c>=EX){fini();return;}maj();});
  a.addEventListener('ended',fini);
  document.addEventListener('keydown',function(e){if(e.code==='Space'){e.preventDefault();if(cur<0)jouer(0);else a.paused?a.play():a.pause();}});
})();
</script></body></html>`;
}

function pageMessage(texte) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>BEESKOT · Écoute</title><style>${CSS}</style></head><body><div class="haut"><img src="${ASSETS}look/logo-beeskot-flat.png" alt="BEESKOT"></div>
<main><div class="vide-l">${esc(texte)}</div></main><footer>fait avec Dari Band Studio</footer></body></html>`;
}

// ---------- /t/<id> : la page Tournages du cameraman ----------
async function routeTournage(req, morceaux, env, ctx) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('', { status: 405 });
  const id = morceaux[1] || '';
  if (!ID_OK.test(id)) return reponseHtml(pageMessage('Ce lien n\'est pas valide.'), 404);
  const lien = await lireLien(id, env, ctx, estTournage);
  if (!lien || lien.actif === false) return reponseHtml(pageMessage('Ce lien n\'est plus actif.'), 404);
  if (lien.expire && Date.now() > Date.parse(lien.expire)) return reponseHtml(pageMessage('Ce lien a expiré.'), 410);
  if (morceaux.length === 2) return new Response(pageTournage(id, lien), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; img-src 'self' https://cdn.jsdelivr.net data:; style-src 'unsafe-inline' https://cdn.jsdelivr.net; font-src https://cdn.jsdelivr.net; base-uri 'none'; form-action 'none'" } });
  if (morceaux[2] === 'i' && /^\d+$/.test(morceaux[3] || '') && morceaux.length === 4) { const el = lien.elements[+morceaux[3]]; return imageT(el && el.image, env, ctx); }
  return new Response('', { status: 404 });
}

export default {
  async fetch(req, env, ctx) {
    const morceaux = new URL(req.url).pathname.split('/').filter(Boolean), id = morceaux[0] || '';
    const ping = req.method === 'POST' && morceaux[1] === 'e';
    if (req.method !== 'GET' && req.method !== 'HEAD' && !ping) return new Response('', { status: 405 });
    if (id === 't') return routeTournage(req, morceaux, env, ctx);
    if (!id) return reponseHtml(pageMessage('Ce lien n\'est pas complet.'), 404);
    if (!ID_OK.test(id)) return reponseHtml(pageMessage('Ce lien n\'est pas valide.'), 404);
    if (morceaux[1] === 'stats' && morceaux.length === 2) return stats(id, env);
    const lien = await lireLien(id, env, ctx);
    if (!lien || lien.actif === false) return reponseHtml(pageMessage('Ce lien n\'est plus actif.'), 404);
    if (lien.expire && Date.now() > Date.parse(lien.expire)) return reponseHtml(pageMessage('Ce lien a expiré.'), 410);   // l'expiration est vérifiée ici, même si aucun PC du groupe n'est allumé
    if (morceaux.length === 1) return reponseHtml(page(id, lien));
    const n = parseInt(morceaux[2], 10), el = (lien.elements || [])[n];
    if (!el || !/^\d+$/.test(morceaux[2] || '')) return new Response('', { status: 404 });
    if (ping) return compter(req, id, n, el, env, ctx);
    if (morceaux[1] === 'a') return son(req, el, env, lien, ctx);
    if (morceaux[1] === 'c') return pochette(el, env, ctx);
    return new Response('', { status: 404 });
  },
};
