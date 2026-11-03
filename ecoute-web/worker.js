// =====================================================================
// BEESKOT · ÉCOUTE — la page qu'on envoie à quelqu'un de l'extérieur pour écouter nos morceaux.
// Tourne chez Cloudflare (Worker gratuit « ecoute »). Mode d'emploi : LISEZ-MOI.txt à côté.
//
//   https://ecoute.beeskot-music.workers.dev/<id>          la page (pochette, titre, lecteur)
//   https://ecoute.beeskot-music.workers.dev/<id>/a/<n>    le son du morceau n (passe par ici)
//   https://ecoute.beeskot-music.workers.dev/<id>/c/<n>    la pochette du morceau n (passe par ici)
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
const ID_OK = /^[A-Za-z0-9_-]{20,80}$/;

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// la fiche du lien (gardée 30 s : « Révoquer » marche en moins d'une minute)
async function lireLien(id, env, ctx) {
  const cache = caches.default, cle = new Request('https://cache.ecoute/lien/' + id);
  const deja = await cache.match(cle); if (deja) { const j = await deja.json(); return j && j.ok ? j.lien : null; }
  let lien = null;
  try {
    const r = await fetch(DRIVE + id + '?alt=media&key=' + encodeURIComponent(env.CLE_API || ''));
    if (r.ok) { const j = await r.json(); if (j && j.type === 'ecoute' && Array.isArray(j.elements)) lien = j; }
  } catch (e) { lien = null; }
  ctx.waitUntil(cache.put(cle, new Response(JSON.stringify({ ok: !!lien, lien }), { headers: { 'Cache-Control': 'max-age=30' } })));
  return lien;
}

function reponseHtml(html, statut = 200) {
  return new Response(html, { status: statut, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' https://cdn.jsdelivr.net data:; style-src 'self' 'unsafe-inline'; font-src https://cdn.jsdelivr.net; script-src 'unsafe-inline'; media-src 'self'; frame-ancestors 'none'" } });
}

// le son : on relaie le fichier du Drive par petits bouts (Range), sans jamais montrer son adresse
async function son(req, el, env) {
  const dest = req.headers.get('Sec-Fetch-Dest'), site = req.headers.get('Sec-Fetch-Site');
  if ((dest && !['audio', 'video', 'empty'].includes(dest)) || (site && site !== 'same-origin')) return new Response('Écoute seulement.', { status: 403 });
  const h = {}; const range = req.headers.get('Range'); if (range) h.Range = range;
  const r = await fetch(DRIVE + el.fichier + '?alt=media&key=' + encodeURIComponent(env.CLE_API || ''), { headers: h });
  if (!r.ok && r.status !== 206) return new Response('Son indisponible.', { status: 404 });
  const out = new Headers();
  for (const k of ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges']) { const v = r.headers.get(k); if (v) out.set(k, v); }
  if (!out.get('Accept-Ranges')) out.set('Accept-Ranges', 'bytes');
  out.set('Cache-Control', 'private, no-store'); out.set('Content-Disposition', 'inline'); out.set('X-Robots-Tag', 'noindex');
  return new Response(r.body, { status: r.status, headers: out });
}

// la pochette : gardée un jour chez Cloudflare (rapide), refaite si la photo change (autre fichier)
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
  const els = lien.elements || [];
  const lignes = els.map((e, i) => `<div class="m" data-i="${i}">
    ${e.image ? `<div class="ph" style="background-image:url('/${id}/c/${i}')"></div>` : '<div class="ph vide">♪</div>'}
    <div class="d"><div class="t">${esc(e.nom)}</div>
      <div class="lect"><button class="b" data-a="prec" title="Morceau précédent">${ICO.prec}</button><button class="b p" data-a="jouer" title="Écouter">${ICO.jouer}</button><button class="b" data-a="stop" title="Arrêter">${ICO.stop}</button><button class="b" data-a="suiv" title="Morceau suivant">${ICO.suiv}</button>
        <div class="barre"><i></i></div><span class="tps">0:00</span></div></div></div>`).join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>BEESKOT · Écoute</title><style>${CSS}</style></head>
<body oncontextmenu="return false"><div class="haut"><img src="${ASSETS}look/logo-beeskot-flat.png" alt="BEESKOT"></div>
<main><div class="sous"><b>Écoute privée</b>${els.length} morceau${els.length > 1 ? 'x' : ''}</div>
${lignes || '<div class="vide-l">Aucun morceau à écouter pour l\'instant.</div>'}</main>
<footer>fait avec Dari Band Studio</footer>
<script>
(function(){
  var ID=${JSON.stringify(id)}, N=${els.length}, a=new Audio(), cur=-1;
  a.preload='none';
  var IC=${JSON.stringify({ jouer: ICO.jouer, pause: ICO.pause })};
  var lignes=[].slice.call(document.querySelectorAll('.m'));
  function t(s){s=Math.max(0,Math.floor(s||0));return Math.floor(s/60)+':'+('0'+s%60).slice(-2);}
  function maj(){lignes.forEach(function(l,i){var moi=i===cur,p=l.querySelector('[data-a=jouer]');l.classList.toggle('joue',moi);
    p.innerHTML=moi&&!a.paused?IC.pause:IC.jouer;p.title=moi&&!a.paused?'Pause':'Écouter';
    var d=moi&&a.duration?a.duration:0;l.querySelector('.barre i').style.width=d?(a.currentTime/d*100)+'%':'0';
    l.querySelector('.tps').textContent=moi?t(a.currentTime)+(d?' / '+t(d):''):'0:00';});}
  function jouer(i){if(i<0||i>=N)return;if(i===cur){a.paused?a.play():a.pause();return;}cur=i;a.src='/'+ID+'/a/'+i;a.play().catch(function(){});maj();}
  lignes.forEach(function(l,i){
    l.querySelector('[data-a=jouer]').onclick=function(){jouer(i);};
    l.querySelector('[data-a=stop]').onclick=function(){if(cur===i){a.pause();a.currentTime=0;maj();}};
    l.querySelector('[data-a=prec]').onclick=function(){if(cur===i&&a.currentTime>3){a.currentTime=0;}else jouer((i-1+N)%N);};
    l.querySelector('[data-a=suiv]').onclick=function(){jouer((i+1)%N);};
    l.querySelector('.barre').onclick=function(e){if(cur!==i){jouer(i);return;}if(!a.duration)return;var r=this.getBoundingClientRect();a.currentTime=(e.clientX-r.left)/r.width*a.duration;};
  });
  ['play','pause','timeupdate','loadedmetadata','durationchange'].forEach(function(ev){a.addEventListener(ev,maj);});
  a.addEventListener('ended',function(){if(cur<N-1)jouer(cur+1);else{cur=-1;maj();}});
  document.addEventListener('keydown',function(e){if(e.code==='Space'){e.preventDefault();if(cur<0)jouer(0);else a.paused?a.play():a.pause();}});
})();
</script></body></html>`;
}

function pageMessage(texte) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>BEESKOT · Écoute</title><style>${CSS}</style></head><body><div class="haut"><img src="${ASSETS}look/logo-beeskot-flat.png" alt="BEESKOT"></div>
<main><div class="vide-l">${esc(texte)}</div></main><footer>fait avec Dari Band Studio</footer></body></html>`;
}

export default {
  async fetch(req, env, ctx) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('', { status: 405 });
    const morceaux = new URL(req.url).pathname.split('/').filter(Boolean), id = morceaux[0] || '';
    if (!id) return reponseHtml(pageMessage('Ce lien n\'est pas complet.'), 404);
    if (!ID_OK.test(id)) return reponseHtml(pageMessage('Ce lien n\'est pas valide.'), 404);
    const lien = await lireLien(id, env, ctx);
    if (!lien || lien.actif === false) return reponseHtml(pageMessage('Ce lien n\'est plus actif.'), 404);
    if (lien.expire && Date.now() > Date.parse(lien.expire)) return reponseHtml(pageMessage('Ce lien a expiré.'), 410);   // l'expiration est vérifiée ici, même si aucun PC du groupe n'est allumé
    if (morceaux.length === 1) return reponseHtml(page(id, lien));
    const n = parseInt(morceaux[2], 10), el = (lien.elements || [])[n];
    if (!el || !/^\d+$/.test(morceaux[2] || '')) return new Response('', { status: 404 });
    if (morceaux[1] === 'a') return son(req, el, env);
    if (morceaux[1] === 'c') return pochette(el, env, ctx);
    return new Response('', { status: 404 });
  },
};
