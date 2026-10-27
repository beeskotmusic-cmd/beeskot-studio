// =====================================================================
// STORYLINE - MOOD — un grand tableau libre par chanson (dans Tournages) :
//   médias du Drive ou du PC, liens (YouTube, Instagram, TikTok, sites), textes, formes (rond, rectangle, flèche).
//   Tout se glisse ; les ronds et rectangles emportent ce qu'il y a dedans ; molette = zoom presque infini.
//   Partagé : chaque élément est une fiche « storyline » du Drive (tout le monde voit la même chose, relu toutes les 15 s).
// =====================================================================
(() => {
const S = { board: BK.reglage('sb.board', 'general'), items: {}, vues: BK.reglage('sb.vues', {}), sel: null, morceaux: [], url: {}, joue: null, zone: null, glisse: false };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const COUL = ['#e0a43c', '#c9682c', '#7a2430', '#2f7377', '#2a3f6a', '#8a8a4a', '#efe4cc'];
const vue = () => S.vues[S.board] || (S.vues[S.board] = { x: 60, y: 60, k: 1 });

// ---------- les liens : reconnaître YouTube / Instagram / TikTok / Vimeo ----------
function lienInfo(url) {
  let m;
  if ((m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/))) return { site: 'YouTube', ic: '▶', thumb: `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg`, embed: `https://www.youtube-nocookie.com/embed/${m[1]}?autoplay=1&rel=0`, ratio: 16 / 9 };
  if ((m = url.match(/instagram\.com\/(?:[\w.]+\/)?(reel|reels|p|tv)\/([\w-]+)/))) return { site: 'Instagram', ic: '◎', embed: `https://www.instagram.com/${m[1] === 'p' ? 'p' : 'reel'}/${m[2]}/embed`, ratio: 9 / 16 };
  if ((m = url.match(/tiktok\.com\/.*\/video\/(\d+)/))) return { site: 'TikTok', ic: '♪', embed: `https://www.tiktok.com/embed/v2/${m[1]}`, ratio: 9 / 16, oembed: 'https://www.tiktok.com/oembed?url=' + encodeURIComponent(url) };
  if ((m = url.match(/vimeo\.com\/(\d+)/))) return { site: 'Vimeo', ic: '▶', embed: `https://player.vimeo.com/video/${m[1]}?autoplay=1`, ratio: 16 / 9 };
  let site = ''; try { site = new URL(url).hostname.replace(/^www\./, ''); } catch (e) {}
  return { site, ic: '🔗', ratio: 4 / 3 };
}
// miniature d'un lien TikTok (si le site la donne) : gardée dans la fiche pour tout le monde
async function miniatureLien(it) {
  const L = lienInfo(it.url); if (it.thumb || !L.oembed || !BK.T || !BK.T.http) return;
  try { const j = await (await BK.T.http.fetch(L.oembed)).json(); if (j.thumbnail_url) { it.thumb = j.thumbnail_url; it.titre = it.titre || j.title || ''; await BK.db.ecrire('storyline', it, { sansAnnuler: true }); dessinerItem(it); } } catch (e) {}
}

// ---------- médias du Drive : image (grande vignette), vidéo (vignette puis lecture), son ----------
async function imageDrive(it) {
  if (S.url[it.fid] !== undefined) return S.url[it.fid];
  S.url[it.fid] = '';
  try { const f = await (await BK.drive.api(`/files/${it.fid}?fields=id,thumbnailLink,mimeType`)).json();
    if (f.thumbnailLink) { const r = await BK.drive.api(f.thumbnailLink.replace(/=s\d+$/, '=s1600')); S.url[it.fid] = URL.createObjectURL(await r.blob()); }
    else if (/^image\//.test(it.mime || '')) S.url[it.fid] = URL.createObjectURL(new Blob([await BK.drive.telecharger(it.fid)], { type: it.mime }));
  } catch (e) {}
  return S.url[it.fid];
}
async function jouerMedia(it, el) {
  const zone = el.querySelector('.sb-c'); zone.innerHTML = '<span class="sb-attente">Chargement…</span>';
  try { const b = new Blob([await BK.drive.telecharger(it.fid)], { type: it.mime || '' }), u = URL.createObjectURL(b);
    zone.innerHTML = /^audio\//.test(it.mime || '') ? `<audio src="${u}" controls autoplay></audio>` : `<video src="${u}" controls autoplay playsinline></video>`;
  } catch (e) { zone.innerHTML = '<span class="sb-attente">Lecture impossible (Drive)</span>'; }
}

// ---------- dessin ----------
function rendre() {
  const z = S.zone; if (!z) return;
  $('.sb-monde', z).innerHTML = '';
  Object.values(S.items).filter(it => it.board === S.board).sort(ordre).forEach(dessinerItem);
  appliquerVue(); $('#sbVide', z).classList.toggle('hidden', Object.values(S.items).some(it => it.board === S.board));
}
const couche = it => it.type === 'forme' && it.forme !== 'fleche' ? 0 : it.type === 'forme' ? 2 : 1;   // les boîtes derrière, les flèches devant
const ordre = (a, b) => couche(a) - couche(b) || (a.z || 0) - (b.z || 0);
function dessinerItem(it) {
  const monde = $('.sb-monde', S.zone); let el = monde.querySelector(`[data-id="${CSS.escape(it.id)}"]`);
  if (!el) { el = document.createElement('div'); el.dataset.id = it.id; monde.appendChild(el); }
  el.className = `sb-it sb-${it.type}${it.type === 'forme' ? ' sb-' + it.forme : ''}${S.sel === it.id ? ' sel' : ''}`;
  el.style.zIndex = couche(it) * 100000 + (it.z || 0);
  if (it.type === 'forme' && it.forme === 'fleche') return dessinerFleche(it, el);
  Object.assign(el.style, { left: it.x + 'px', top: it.y + 'px', width: it.w + 'px', height: it.h + 'px' }); el.style.setProperty('--c', it.couleur || COUL[0]);
  const outils = `<div class="sb-outils"><button data-a="couleur" title="Couleur">●</button><button data-a="devant" title="Mettre devant">⇡</button><button data-a="suppr" title="Retirer (rangé dans la corbeille du Drive)">✕</button></div><i class="sb-poi" title="Agrandir / rétrécir"></i>`;
  if (it.type === 'texte') el.innerHTML = `<div class="sb-c sb-txt" spellcheck="false">${esc(it.texte || '')}</div>${outils}`;
  else if (it.type === 'forme') el.innerHTML = `<div class="sb-c"><span class="sb-titre" spellcheck="false">${esc(it.texte || '')}</span></div>${outils}`;
  else if (it.type === 'lien') { const L = lienInfo(it.url);
    el.innerHTML = `<div class="sb-c">${it.thumb || L.thumb ? `<img src="${esc(it.thumb || L.thumb)}" alt="" draggable="false">` : `<div class="sb-carte-lien sb-${(L.site || '').toLowerCase()}"><i>${L.ic}</i><b>${esc(L.site)}</b><small>${L.embed ? 'Pas de miniature : ▶ pour essayer de le lire ici, ↗ pour l\'ouvrir' : '↗ pour ouvrir le site'}</small></div>`}
      ${L.embed ? '<button class="sb-play" data-a="jouer" title="Lire ici">▶</button>' : ''}</div>
      <div class="sb-pied"><b>${esc(L.site)}</b><span>${esc(it.titre || it.url)}</span><button data-a="ouvrir" title="Ouvrir dans le navigateur">↗</button></div>${outils}`; miniatureLien(it); }
  else if (it.type === 'media') { const video = /^video\//.test(it.mime || ''), son = /^audio\//.test(it.mime || '');
    el.innerHTML = `<div class="sb-c">${son ? '<div class="sb-logo">♫</div>' : '<span class="sb-attente">…</span>'}${video || son ? '<button class="sb-play" data-a="jouer" title="Lire ici">▶</button>' : ''}</div>
      <div class="sb-pied"><span>${esc(it.nom || '')}</span></div>${outils}`;
    if (!son) imageDrive(it).then(u => { const c = el.querySelector('.sb-c'); if (!c || c.querySelector('video,audio')) return; const a = c.querySelector('.sb-attente');
      if (u) { const img = document.createElement('img'); img.src = u; img.alt = ''; img.draggable = false; if (a) a.replaceWith(img); } else if (a) a.textContent = video ? '🎬' : '🖼'; }); }
}
function dessinerFleche(it, el) {
  const x = Math.min(it.x, it.x2), y = Math.min(it.y, it.y2), w = Math.abs(it.x2 - it.x) || 1, h = Math.abs(it.y2 - it.y) || 1, m = 20;
  Object.assign(el.style, { left: x - m + 'px', top: y - m + 'px', width: w + 2 * m + 'px', height: h + 2 * m + 'px' }); el.style.setProperty('--c', it.couleur || COUL[0]);
  const a = [it.x - x + m, it.y - y + m], b = [it.x2 - x + m, it.y2 - y + m], ang = Math.atan2(b[1] - a[1], b[0] - a[0]), L = 18;
  const p1 = [b[0] - L * Math.cos(ang - .45), b[1] - L * Math.sin(ang - .45)], p2 = [b[0] - L * Math.cos(ang + .45), b[1] - L * Math.sin(ang + .45)];
  el.innerHTML = `<svg width="100%" height="100%"><line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" class="sb-trait-l"/><line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" class="sb-trait"/><polygon points="${b.join(',')} ${p1.join(',')} ${p2.join(',')}" class="sb-pointe"/></svg>
    <i class="sb-bout" data-b="1" style="left:${a[0]}px;top:${a[1]}px"></i><i class="sb-bout" data-b="2" style="left:${b[0]}px;top:${b[1]}px"></i>
    <div class="sb-outils" style="left:${(a[0] + b[0]) / 2}px;top:${(a[1] + b[1]) / 2}px"><button data-a="couleur" title="Couleur">●</button><button data-a="suppr" title="Retirer">✕</button></div>`;
}
function appliquerVue() { const v = vue(), m = $('.sb-monde', S.zone); m.style.transform = `translate(${v.x}px,${v.y}px) scale(${v.k})`;
  const b = $('.sb-board', S.zone); b.style.backgroundSize = `${40 * v.k}px ${40 * v.k}px`; b.style.backgroundPosition = `${v.x}px ${v.y}px`;
  $('#sbZoom', S.zone).textContent = Math.round(v.k * 100) + ' %'; }
const garderVue = () => BK.regler('sb.vues', S.vues);

// ---------- enregistrer (chaque élément = une fiche ; on n'écrit que celui qui a bougé) ----------
async function garder(it) { try { await BK.db.ecrire('storyline', it); } catch (e) { msg('Pas enregistré : Drive injoignable'); } }
const msg = t => { const e = S.zone && $('#sbMsg', S.zone); if (e) e.textContent = String(t).toUpperCase(); };
function centreVue() { const r = $('.sb-board', S.zone).getBoundingClientRect(), v = vue(); return { x: (r.width / 2 - v.x) / v.k, y: (r.height / 2 - v.y) / v.k }; }
const zMax = () => Math.max(0, ...Object.values(S.items).filter(i => i.board === S.board).map(i => i.z || 0)) + 1;
async function ajouter(o, p) { let c = p; if (!c) { const n = Object.values(S.items).filter(i => i.board === S.board).length % 8; c = centreVue(); c = { x: c.x + n * 36 / vue().k, y: c.y + n * 28 / vue().k }; }   // pas tous les uns sur les autres
  const it = { board: S.board, z: zMax(), ...o };
  if (it.type === 'forme' && it.forme === 'fleche') Object.assign(it, { x: c.x - 120, y: c.y, x2: c.x + 120, y2: c.y });
  else Object.assign(it, { x: c.x - (it.w || 300) / 2, y: c.y - (it.h || 200) / 2, w: it.w || 300, h: it.h || 200 });
  const f = await BK.db.ecrire('storyline', it); S.items[f.id] = f; S.sel = f.id; rendre(); return f; }

// ---------- ajouter : le menu ----------
function menuAjouter(btn) {
  const m = $('#sbMenu', S.zone); if (!m.classList.contains('hidden')) return m.classList.add('hidden');
  m.innerHTML = [['media', '🖼 Média (Drive / Médias)'], ['pc', '💻 Média depuis ce PC'], ['lien', '🔗 Lien externe (YouTube, Insta, TikTok…)'], ['texte', '✎ Texte'], ['rond', '◯ Rond (boîte)'], ['rect', '▭ Rectangle (boîte)'], ['fleche', '➝ Flèche']]
    .map(([k, n]) => `<button data-k="${k}">${n}</button>`).join(''); m.classList.remove('hidden');
  m.onclick = async e => { const b = e.target.closest('[data-k]'); if (!b) return; m.classList.add('hidden'); const k = b.dataset.k;
    if (k === 'texte') ajouter({ type: 'texte', texte: 'Écris ici…', w: 260, h: 120, couleur: COUL[0] });
    else if (k === 'rond' || k === 'rect') ajouter({ type: 'forme', forme: k, texte: k === 'rond' ? 'Tenues' : 'Groupe', w: 520, h: k === 'rond' ? 520 : 360, couleur: COUL[k === 'rond' ? 1 : 3] });
    else if (k === 'fleche') ajouter({ type: 'forme', forme: 'fleche', couleur: COUL[0] });
    else if (k === 'lien') demanderLien();
    else if (k === 'media') { if (!BK.drive.relie()) return msg('Relie le Drive (Réglages) pour partager des médias');
      const l = await BK.choisirDansMedias({ titre: 'Des médias pour le board', bouton: 'Ajouter au board', type: 'tous' }); poserMedias(l || []); }
    else if (k === 'pc') $('#sbFichier', S.zone).click(); };
}
async function poserMedias(l, p) { const c = p || centreVue(); let i = 0;
  for (const x of l) { if (x.retirer) continue; let fid = x.f ? x.id : '', mime = x.mime || (x.fichier && x.fichier.type) || '', nom = x.nom || (x.fichier && x.fichier.name) || '';
    if (x.fichier || x.dc) { msg('Envoi de ' + nom + ' au Drive…'); try { fid = await envoyer(x.fichier || new File([await (await BK.discord.fetch(x.dc.url)).blob()], nom, { type: mime })); } catch (e) { msg('Envoi impossible : ' + nom); continue; } }
    if (!fid) continue; const port = /^video\/|^image\//.test(mime) ? 1 : 0;
    await ajouter({ type: 'media', fid, nom, mime, w: 320, h: port ? 240 : 120 }, { x: c.x + i * 40, y: c.y + i * 40 }); i++; }
  msg(i ? i + ' média(s) ajouté(s)' : 'PRÊT'); }
async function envoyer(fichier) { const dos = await BK.drive.dossier('Storyline', await BK.drive.racine()); const r = await BK.drive.envoyerBlob(fichier, fichier.name, dos); return r.id; }
function demanderLien() {
  const d = $('#sbLien', S.zone); d.classList.remove('hidden'); const i = d.querySelector('input'); i.value = ''; i.focus();
  const ok = async () => { const u = i.value.trim(); if (!/^https?:\/\//i.test(u)) return i.focus(); d.classList.add('hidden'); const L = lienInfo(u);
    const w = L.ratio < 1 ? 240 : 360; await ajouter({ type: 'lien', url: u, titre: '', w, h: Math.round(w / L.ratio) + 44 }); };
  d.querySelector('[data-l="ok"]').onclick = ok; d.querySelector('[data-l="non"]').onclick = () => d.classList.add('hidden');
  i.onkeydown = e => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') d.classList.add('hidden'); };
}

// ---------- souris : glisser le fond = se déplacer ; molette = zoom ; glisser un élément = le bouger ----------
function installerSouris(board) {
  board.addEventListener('wheel', e => { e.preventDefault(); const v = vue(), r = board.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const k2 = Math.max(.01, Math.min(60, v.k * Math.exp(-e.deltaY * .0015))); v.x = mx - (mx - v.x) * k2 / v.k; v.y = my - (my - v.y) * k2 / v.k; v.k = k2; appliquerVue(); clearTimeout(S.tv); S.tv = setTimeout(garderVue, 400); }, { passive: false });
  board.addEventListener('pointerdown', e => {
    if (e.target.closest(".sb-menu,.sb-saisie,.sb-barre") || e.button === 2) return;
    board.focus({ preventScroll: true });
    const el = e.target.closest('.sb-it'), v = vue();
    if (e.target.closest('[contenteditable="true"],video,audio,iframe,button')) return;
    if (!el || e.button === 1) {                                   // le fond (ou clic molette) : on déplace la vue
      if (S.sel) { S.sel = null; $$('.sb-it.sel', board).forEach(x => x.classList.remove('sel')); }
      const x0 = e.clientX, y0 = e.clientY, vx = v.x, vy = v.y; board.setPointerCapture(e.pointerId); board.classList.add('main');
      const mv = ev => { v.x = vx + ev.clientX - x0; v.y = vy + ev.clientY - y0; appliquerVue(); };
      const up = () => { board.removeEventListener('pointermove', mv); board.removeEventListener('pointerup', up); board.classList.remove('main'); garderVue(); };
      board.addEventListener('pointermove', mv); board.addEventListener('pointerup', up); return; }
    const it = S.items[el.dataset.id]; if (!it) return; if (!e.target.closest('.sb-txt,.sb-titre')) e.preventDefault();
    if (S.sel !== it.id) { S.sel = it.id; $$('.sb-it.sel', board).forEach(x => x.classList.remove('sel')); el.classList.add('sel'); }
    const x0 = e.clientX, y0 = e.clientY, avant = JSON.stringify(it), poi = e.target.closest('.sb-poi'), bout = e.target.closest('.sb-bout');
    const o = { x: it.x, y: it.y, w: it.w, h: it.h, x2: it.x2, y2: it.y2 };
    // un rond ou un rectangle emporte ce qu'il y a dedans
    const dedans = !poi && it.type === 'forme' && it.forme !== 'fleche' ? Object.values(S.items).filter(x => x.board === S.board && x.id !== it.id && contient(it, x)).map(x => ({ x, o: { x: x.x, y: x.y, x2: x.x2, y2: x.y2 } })) : [];
    S.glisse = true;
    const mv = ev => { const dx = (ev.clientX - x0) / v.k, dy = (ev.clientY - y0) / v.k;
      if (bout) { if (bout.dataset.b === '1') { it.x = o.x + dx; it.y = o.y + dy; } else { it.x2 = o.x2 + dx; it.y2 = o.y2 + dy; } }
      else if (poi) { const ratio = it.type === 'media' && /^image\//.test(it.mime || '') && !ev.shiftKey ? o.h / o.w : 0; it.w = Math.max(60, o.w + dx); it.h = ratio ? it.w * ratio : Math.max(40, o.h + dy); }
      else { it.x = o.x + dx; it.y = o.y + dy; if (it.x2 != null) { it.x2 = o.x2 + dx; it.y2 = o.y2 + dy; }
        dedans.forEach(d => { d.x.x = d.o.x + dx; d.x.y = d.o.y + dy; if (d.o.x2 != null) { d.x.x2 = d.o.x2 + dx; d.x.y2 = d.o.y2 + dy; } dessinerItem(d.x); }); }
      dessinerItem(it); };
    const up = async () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); S.glisse = false;
      if (JSON.stringify(it) === avant) return; await garder(it); for (const d of dedans) await garder(d.x); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  });
  // les boutons des éléments
  board.addEventListener('click', async e => { const b = e.target.closest('[data-a]'), el = e.target.closest('.sb-it'); if (!b || !el) return; const it = S.items[el.dataset.id]; if (!it) return; e.stopPropagation();
    const a = b.dataset.a;
    if (a === 'suppr') { if (!await BK.confirmer('Retirer cet élément du board ?')) return; delete S.items[it.id]; el.remove(); S.sel = null; await BK.db.supprimer('storyline', it.id); }
    else if (a === 'couleur') { it.couleur = COUL[(COUL.indexOf(it.couleur) + 1) % COUL.length]; dessinerItem(it); garder(it); }
    else if (a === 'devant') { it.z = zMax(); dessinerItem(it); garder(it); }
    else if (a === 'ouvrir') BK.ouvrirLien(it.url);
    else if (a === 'jouer') { S.sel = it.id; $$('.sb-it.sel', board).forEach(x => x.classList.remove('sel')); el.classList.add('sel'); if (it.type === 'media') jouerMedia(it, el); else { const L = lienInfo(it.url); el.querySelector('.sb-c').innerHTML = `<iframe src="${esc(L.embed)}" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`; } }
  });
  // double-clic sur un texte ou le titre d'une boîte : on écrit
  board.addEventListener('dblclick', e => { const t = e.target.closest('.sb-txt,.sb-titre'), el = e.target.closest('.sb-it'); if (!t || !el) return; const it = S.items[el.dataset.id];
    t.contentEditable = 'true'; t.focus(); document.getSelection().selectAllChildren(t);
    t.onblur = () => { t.contentEditable = 'false'; const v = t.innerText.trim(); if (v !== (it.texte || '')) { it.texte = v; garder(it); } }; });
  // Suppr : retirer l'élément choisi
  board.addEventListener('keydown', async e => { if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel && !e.target.closest('[contenteditable="true"],input')) { const el = board.querySelector(`.sb-it[data-id="${CSS.escape(S.sel)}"] [data-a="suppr"]`); el && el.click(); } });
  // glisser des fichiers du PC directement sur le board
  board.addEventListener('dragover', e => { e.preventDefault(); board.classList.add('survol'); });
  board.addEventListener('dragleave', () => board.classList.remove('survol'));
  board.addEventListener('drop', e => { e.preventDefault(); board.classList.remove('survol'); const fs = [...(e.dataTransfer.files || [])]; if (!fs.length) return;
    if (!BK.drive.relie()) return msg('Relie le Drive (Réglages) pour partager des médias');
    const r = board.getBoundingClientRect(), v = vue(); poserMedias(fs.map(f => ({ nom: f.name, mime: f.type, fichier: f })), { x: (e.clientX - r.left - v.x) / v.k, y: (e.clientY - r.top - v.y) / v.k }); });
}
function contient(b, x) { const cx = x.x2 != null ? (x.x + x.x2) / 2 : x.x + x.w / 2, cy = x.y2 != null ? (x.y + x.y2) / 2 : x.y + x.h / 2;
  if (b.forme === 'rond') { const rx = b.w / 2, ry = b.h / 2, dx = (cx - b.x - rx) / rx, dy = (cy - b.y - ry) / ry; return dx * dx + dy * dy <= 1; }
  return cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h; }
function toutVoir() { const l = Object.values(S.items).filter(i => i.board === S.board); const v = vue(), r = $('.sb-board', S.zone).getBoundingClientRect();
  if (!l.length) { Object.assign(v, { x: 60, y: 60, k: 1 }); return appliquerVue(); }
  const xs = l.flatMap(i => i.x2 != null ? [i.x, i.x2] : [i.x, i.x + i.w]), ys = l.flatMap(i => i.y2 != null ? [i.y, i.y2] : [i.y, i.y + i.h]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), k = Math.min(4, .9 * Math.min(r.width / (x1 - x0 || 1), r.height / (y1 - y0 || 1)));
  Object.assign(v, { k, x: r.width / 2 - (x0 + x1) / 2 * k, y: r.height / 2 - (y0 + y1) / 2 * k }); appliquerVue(); garderVue(); }

// ---------- relire (les autres membres) ----------
async function relire(force) {
  if (!S.zone || S.glisse || (!force && S.zone.closest('.hidden'))) return;
  if (document.activeElement && document.activeElement.isContentEditable) return;
  try { const l = await BK.db.liste('storyline'); const avant = JSON.stringify(S.items); S.items = Object.fromEntries(l.map(x => [x.id, x])); if (force || JSON.stringify(S.items) !== avant) rendre(); } catch (e) {}
}
async function remplirMorceaux() {
  S.morceaux = (await BK.db.liste('morceaux')).sort((a, b) => a.nom.localeCompare(b.nom));
  const s = $('#sbMorceau', S.zone); s.innerHTML = '<option value="general">— Général (toutes les chansons) —</option>' + S.morceaux.map(m => `<option value="${esc(m.id)}">${esc(m.nom)}</option>`).join('');
  s.value = S.board; if (s.value !== S.board) { S.board = 'general'; s.value = 'general'; }
}

BK.storyline = {
  async dessiner(zone) {
    if (S.zone === zone) { await relire(true); return; }
    S.zone = zone;
    zone.innerHTML = `<div class="sb-wrap">
      <div class="sb-barre box"><label class="sb-ch"><span class="eng">Chanson</span><select class="fld" id="sbMorceau"></select></label>
        <div class="sb-aj"><button class="btn pri sm" id="sbAjout">＋ Ajouter</button><div class="sb-menu hidden" id="sbMenu"></div></div>
        <span class="nt sb-aide">Glisser le fond = se déplacer · molette = zoom · double-clic = écrire · les ronds et rectangles emportent ce qu'il y a dedans</span>
        <button class="btn xs" id="sbMoins" title="Dézoomer">−</button><span class="vfd" id="sbZoom">100 %</span><button class="btn xs" id="sbPlus" title="Zoomer">+</button><button class="btn xs" id="sbTout">Tout voir</button>
        <span class="vfd" id="sbMsg">PRÊT</span></div>
      <div class="sb-board" tabindex="0"><div class="sb-monde"></div>
        <div class="sb-vide" id="sbVide"><b>Board vide</b><span>« ＋ Ajouter » : un média, un lien (YouTube, reel Insta, TikTok…), un texte, un rond pour regrouper les tenues, une flèche…<br>Tu peux aussi glisser des fichiers ici.</span></div>
        <div class="sb-saisie box hidden" id="sbLien"><span class="lb">Lien externe</span><input class="fld" placeholder="https://… (YouTube, Instagram, TikTok, Vimeo, site)"><div class="sb-l-b"><button class="btn sm" data-l="non">Annuler</button><button class="btn pri sm" data-l="ok">Ajouter</button></div></div>
      </div><input type="file" id="sbFichier" multiple hidden accept="image/*,video/*,audio/*"></div>`;
    await remplirMorceaux();
    $('#sbMorceau', zone).onchange = () => { S.board = $('#sbMorceau', zone).value; BK.regler('sb.board', S.board); S.sel = null; rendre(); };
    $('#sbAjout', zone).onclick = e => menuAjouter(e.currentTarget);
    $('#sbFichier', zone).onchange = e => { const fs = [...e.target.files]; e.target.value = ''; if (!BK.drive.relie()) return msg('Relie le Drive (Réglages) pour partager des médias'); poserMedias(fs.map(f => ({ nom: f.name, mime: f.type, fichier: f }))); };
    const zoomer = f => { const v = vue(), r = $('.sb-board', zone).getBoundingClientRect(), mx = r.width / 2, my = r.height / 2, k2 = Math.max(.01, Math.min(60, v.k * f)); v.x = mx - (mx - v.x) * k2 / v.k; v.y = my - (my - v.y) * k2 / v.k; v.k = k2; appliquerVue(); garderVue(); };
    $('#sbPlus', zone).onclick = () => zoomer(1.25); $('#sbMoins', zone).onclick = () => zoomer(.8); $('#sbTout', zone).onclick = toutVoir;
    installerSouris($('.sb-board', zone));
    await relire(true);
    clearInterval(S.minuterie); S.minuterie = setInterval(() => relire(false), 15000);
    window.addEventListener('bk:change', e => { if (e.detail && e.detail.col === 'morceaux' && S.zone) remplirMorceaux(); });
  },
  _S: S,
};
})();
