// =====================================================================
// ÉCOUTE — deux versions d'un mix, A (bleu) et B (rouge), qu'on compare
// au même endroit d'un clic, et des notes minutées que tout le groupe voit
// (comme Frame.io) : sur un instant ou sur un passage, une couleur par
// personne, des réponses, « ✓ réglé ». « Copier pour l'ingé son » donne
// une liste propre. ★ : la version qu'on préfère devient l'export principal
// de la fiche (Bibliothèque).
// Les notes sont rangées dans le Drive (collection « notesmix »).
// =====================================================================
(() => {
const E = { m: null, opts: [], A: null, B: null, bufA: null, bufB: null, decal: 0, cote: 'A', ctx: null, srcs: [], gA: null, gB: null,
  joue: false, t0: 0, pos: 0, notes: [], sel: null, morceaux: [] };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tps = s => { s = Math.max(0, s || 0); return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); };
// une couleur par personne (pas de bleu ni de rouge : ce sont les couleurs de A et B)
const COULEURS = { Yacine: '#f1c453', Pierre: '#7ee08a', Baptiste: '#c58af0' };
const couleur = qui => COULEURS[qui] || '#d9b67a';
const moi = () => BK.reglage('nomPc', '') || 'Quelqu\'un';

BK.module('ecoute', function (page) {
  $('.sub', page).textContent = 'Comparer deux versions d\'un mix et laisser des notes minutées';
  $('.hdr .right', page).innerHTML = `<div><span class="eng" style="font-size:9px">Morceau</span><span class="vfd" id="ecNomH" style="width:200px">—</span></div>
    <div><span class="eng" style="font-size:9px">Notes</span><span class="vfd" id="ecNbH">—</span></div>`;
  $('.grid', page).innerHTML = `
    <div class="cols">
      <section class="pane vit ec-vit">
        <div class="box ec-choix">
          <label><span class="eng">Morceau</span><select class="fld" id="ecMorceau"><option value="">—</option></select></label>
          <label class="ec-a"><span class="eng">A <i class="ec-pt a"></i></span><span class="ec-l"><select class="fld" id="ecA"></select><button class="btn xs" id="ecStarA" title="Cette version devient l'export principal de la fiche (Bibliothèque)">★</button></span></label>
          <label class="ec-b"><span class="eng">B <i class="ec-pt b"></i></span><span class="ec-l"><select class="fld" id="ecB"></select><button class="btn xs" id="ecStarB" title="Cette version devient l'export principal de la fiche (Bibliothèque)">★</button></span></label>
        </div>
        <div class="box ec-onde-box">
          <div class="ec-onde" id="ecOnde"><canvas id="ecCanvas"></canvas><div class="ec-tete" id="ecTete"></div><div class="ec-selz hidden" id="ecSelz"></div>
            <span class="nt ec-vide" id="ecVide">Choisis un morceau et une version (B = « Aucun » pour écouter un seul mix)</span></div>
          <div class="ec-marques" id="ecMarques"></div>
          <div class="ec-transport">
            <button class="btn sm pri" id="ecPlay" disabled>▶</button><span class="vfd" id="ecTemps">0:00 / 0:00</span>
            <div class="seg ec-ab" id="ecAB"><button data-c="A" class="on">A</button><button data-c="B">B</button></div>
            <span class="nt ec-astuce">Clic = aller là · cliquer-glisser = un passage · <b>Espace</b> = lecture · <b>Tab</b> = A/B</span>
            <span class="ec-recal"><span class="eng">Recaler B</span><input class="fld rv-glisse" id="ecDecal" title="Glisse la souris (ou double-clic pour taper) : décale B en secondes"><button class="btn xs" id="ecAuto" title="Le logiciel cherche tout seul le décalage entre A et B">Caler tout seul</button></span>
          </div></div>
        <div class="box grow ec-notes-box">
          <div class="ec-form"><span class="vfd" id="ecQuand">0:00</span><span class="ec-sur" id="ecSur">sur A</span>
            <input class="fld" id="ecTexte" placeholder="Ta note à cet endroit… (Entrée pour ajouter)"><button class="btn sm pri" id="ecAjout">＋ Note</button></div>
          <div class="ec-filtres"><button class="chip on" data-f="tout">Toutes</button><button class="chip" data-f="ouvertes">À régler</button><button class="chip" data-f="A">Seulement A</button><button class="chip" data-f="B">Seulement B</button>
            <button class="btn xs miette-aide" id="ecTraduire" style="margin-left:auto" title="Miette traduit les notes en anglais, naturellement (pour l'ingé son). Le français reste.">Traduire en anglais</button>
            <button class="btn xs" id="ecCopier" title="Copie les notes à régler (en anglais si elles sont traduites)">📋 Copier pour l'ingé son</button></div>
          <div class="ec-liste" id="ecListe"><span class="nt">Pas encore de note.</span></div></div>
      </section>
    </div>
    <div class="pane abar"><span class="vfd" id="ecMsg">PRÊT</span></div>`;
  const msg = t => $('#ecMsg').textContent = String(t).toUpperCase().slice(0, 90);
  const cv = $('#ecCanvas'), onde = $('#ecOnde');
  const duree = () => Math.max(E.bufA ? E.bufA.duration : 0, E.bufB ? E.bufB.duration - E.decal : 0);

  // ---------- les morceaux et leurs versions (comme Reels Audio : l'export ★ d'abord, puis ce PC, puis le Drive) ----------
  async function remplirMorceaux() {
    E.morceaux = (await BK.db.liste('morceaux')).sort((a, b) => a.nom.localeCompare(b.nom));
    const s = $('#ecMorceau'), avant = s.value || BK.reglage('ecoute.morceau', '');
    s.innerHTML = '<option value="">—</option>' + E.morceaux.map(m => `<option value="${m.id}">${esc(m.nom)}</option>`).join('');
    s.value = avant; if (s.value !== avant) s.value = '';
  }
  async function versions(m) {
    const ex = BK.inv.exportsDe(m, await BK.inv.tous(), E.morceaux).filter(f => f.ici || f.drive);
    const opts = ex.map(f => ({ v: f.drive ? 'drive:' + f.driveId : f.chemin, nom: f.nom, ou: f.drive ? '☁' : '💻', f, t: f.modif || '' }));
    if (BK.drive.relie()) {
      try { await BK.dossiers.assurer(); const vus = new Set(opts.map(o => o.v));
        const l = BK.trierStems(await BK.dossiers.duMorceau(m, E.morceaux)).filter(f => !f.groupe && /\.(wav|mp3|aiff?|flac|m4a)$/i.test(f.name) && !/tournage|reel/i.test(f.name));
        l.sort((a, b) => (b.modifiedTime || '').localeCompare(a.modifiedTime || '')).forEach(f => { if (!vus.has('drive:' + f.id)) opts.push({ v: 'drive:' + f.id, nom: f.name, ou: '☁', drive: f, t: f.modifiedTime || '' }); });
      } catch (e) {}
    }
    return opts;
  }
  async function choisirMorceau() {
    stop(); const id = $('#ecMorceau').value; BK.regler('ecoute.morceau', id);
    E.m = E.morceaux.find(x => x.id === id) || null; $('#ecNomH').textContent = E.m ? E.m.nom.toUpperCase() : '—';
    E.bufA = E.bufB = null; E.A = E.B = null; dessiner();
    if (!E.m) { $('#ecA').innerHTML = $('#ecB').innerHTML = ''; return chargerNotes(); }
    $('#ecA').innerHTML = $('#ecB').innerHTML = '<option>recherche…</option>';
    E.opts = await versions(E.m);
    const html = E.opts.length ? E.opts.map(o => `<option value="${esc(o.v)}">${o.v === E.m.exportPrincipal ? '★ ' : ''}${o.ou} ${esc(o.nom)}</option>`).join('') : '<option value="">aucun export trouvé</option>';
    $('#ecA').innerHTML = html; $('#ecB').innerHTML = '<option value="">— Aucun (un seul mix)</option>' + (E.opts.length ? html : '');
    // par défaut : B = la plus récente, A = la précédente (ou la ★)
    const parDate = [...E.opts].sort((a, b) => (b.t || '').localeCompare(a.t || ''));
    const b0 = parDate[0], a0 = E.opts.find(o => o.v === E.m.exportPrincipal && o !== b0) || parDate[1] || parDate[0];
    if (a0) $('#ecA').value = a0.v; $('#ecB').value = b0 && a0 && b0 !== a0 ? b0.v : '';      // une seule version : B = aucun
    await Promise.all([chargerCote('A'), chargerCote('B')]);
    chargerNotes();
  }
  async function octetsDe(v) {
    if (v.startsWith('drive:')) return BK.drive.telecharger(v.slice(6));
    if (!BK.estExe) throw new Error('Disponible dans le logiciel installé');
    return BK.fichier.lireOctets(v);
  }
  async function chargerCote(c) {
    const v = $('#ec' + c).value;
    if (!v) { E[c] = null; E['buf' + c] = null; solo(); dessiner(); $('#ecPlay').disabled = !(E.bufA || E.bufB); return; }
    E[c] = v; msg('Chargement de la version ' + c + '…');
    try { E['buf' + c] = await BK.audio.decoder(await octetsDe(v)); }
    catch (e) { E['buf' + c] = null; msg('Version ' + c + ' illisible'); }
    E.decal = (BK.reglage('ecoute.decal', {})[E.A + '|' + E.B]) || 0; majDecal();
    $('#ecPlay').disabled = !(E.bufA || E.bufB); $('#ecVide').classList.toggle('hidden', !!(E.bufA || E.bufB));
    solo(); dessiner(); msg(E.bufA && E.bufB ? 'Prêt : A et B · Tab pour passer de l\'une à l\'autre' : 'Prêt');
  }
  // un seul mix (B = aucun) : pas de bouton A/B, pas de recalage, pas de filtres A/B
  function solo() { const un = !E.B; page.classList.toggle('ec-solo', un); if (un && E.cote === 'B') basculer('A'); }
  $('#ecMorceau').onchange = choisirMorceau;
  // un son glissé depuis Médias : il devient la version A (ou B si A est déjà là)
  page.addEventListener('dragover', e => { if (BK.glisse.actif()) e.preventDefault(); });
  page.addEventListener('drop', async e => { if (!BK.glisse.actif()) return; e.preventDefault();
    const x = BK.glisse.items.find(y => /^audio\//.test(y.mime || '') || /\.(wav|mp3|aiff?|flac|m4a|ogg)$/i.test(y.nom || ''));
    if (!x) return msg('Ici, il faut un son'); if (x.dc) return msg('Range d\'abord ce son de Discord dans le Drive (Médias)');
    const v = 'drive:' + x.id, c = E.A && !E.B ? 'B' : E.A && E.B ? 'B' : 'A';
    for (const s2 of ['#ecA', '#ecB']) if (![...$(s2).options].some(o => o.value === v)) $(s2).insertAdjacentHTML('beforeend', `<option value="${esc(v)}">📂 ${esc(x.nom || 'son')}</option>`);
    $('#ec' + c).value = v; stop(); await chargerCote(c); dessinerNotes(); msg('« ' + (x.nom || 'son') + ' » en version ' + c); });
  $('#ecA').onchange = async () => { stop(); await chargerCote('A'); dessinerNotes(); };
  $('#ecB').onchange = async () => { stop(); await chargerCote('B'); dessinerNotes(); };

  // ---------- ★ : cette version devient l'export principal de la fiche ----------
  const etoile = async c => {
    const o = E.opts.find(x => x.v === E[c]); if (!o || !E.m) return;
    const m = E.m;
    if (o.v.startsWith('drive:')) { const id = o.v.slice(6), x = { chemin: o.v, driveId: id, drive: true, nom: o.nom, pc: 'Drive', modif: o.t || new Date().toISOString() };
      m.exportsManuels = (m.exportsManuels || []).filter(y => y.chemin !== x.chemin); m.exportsManuels.push(x); }
    m.exportPrincipal = o.v; await BK.db.ecrire('morceaux', m);
    [...$('#ecA').options, ...$('#ecB').options].forEach(op => op.textContent = (op.value === m.exportPrincipal ? '★ ' : '') + op.textContent.replace(/^★ /, ''));
    msg('★ « ' + o.nom + ' » est maintenant l\'export principal de ' + m.nom);
  };
  $('#ecStarA').onclick = () => etoile('A'); $('#ecStarB').onclick = () => etoile('B');

  // ---------- la lecture : A et B jouent ensemble, on n'entend que celle choisie (bascule sans coupure) ----------
  function jouer(depuis) {
    stop(); if (!E.bufA && !E.bufB) return;
    E.ctx = BK.audio.contexte(); const ctx = E.ctx, now = ctx.currentTime + 0.05;
    E.pos = Math.max(0, Math.min(depuis ?? E.pos, duree() - 0.05));
    E.gA = ctx.createGain(); E.gB = ctx.createGain(); E.gA.connect(ctx.destination); E.gB.connect(ctx.destination);
    E.gA.gain.value = E.cote === 'A' || !E.bufB ? 1 : 0; E.gB.gain.value = E.cote === 'B' || !E.bufA ? 1 : 0;
    const lancer = (buf, g, dans) => { if (!buf) return; const s = ctx.createBufferSource(); s.buffer = buf; s.connect(g);
      if (dans >= 0) { if (dans < buf.duration) s.start(now, dans); } else s.start(now - dans, 0); E.srcs.push(s); };
    lancer(E.bufA, E.gA, E.pos); lancer(E.bufB, E.gB, E.pos + E.decal);
    E.t0 = now - E.pos; E.joue = true; $('#ecPlay').textContent = '⏸'; boucle();
    BK.mini.lance(E.mini = E.mini || { page: 'ecoute',                  // en bas : ce qu'on écoute ici (et la Bibliothèque s'arrête)
      titre: () => 'Écoute · ' + (E.m ? E.m.nom : '') + ' · version ' + E.cote,
      temps: () => E.joue && E.ctx ? E.ctx.currentTime - E.t0 : E.pos, duree: () => duree(), joue: () => E.joue,
      jouer: () => jouer(), pause: () => stop(), aller: t => { if (E.joue) jouer(t); else { E.pos = t; majTete(); } } });
  }
  function stop() { E.srcs.forEach(s => { try { s.stop(); } catch (e) {} }); E.srcs = []; if (E.joue && E.ctx) E.pos = E.ctx.currentTime - E.t0; E.joue = false; $('#ecPlay') && ($('#ecPlay').textContent = '▶'); }
  function boucle() {
    if (!E.joue) return;
    if (page.classList.contains('hidden')) return stop();             // on a changé d'onglet : on coupe
    E.pos = E.ctx.currentTime - E.t0; if (E.pos >= duree()) { stop(); E.pos = 0; }
    majTete(); requestAnimationFrame(boucle);
  }
  function basculer(c) {
    E.cote = c || (E.cote === 'A' ? 'B' : 'A');
    $$('#ecAB button').forEach(b => b.classList.toggle('on', b.dataset.c === E.cote));
    if (E.gA && E.ctx) { const t = E.ctx.currentTime; E.gA.gain.setTargetAtTime(E.cote === 'A' ? 1 : 0, t, 0.01); E.gB.gain.setTargetAtTime(E.cote === 'B' ? 1 : 0, t, 0.01); }
    $('#ecSur').textContent = 'sur ' + E.cote; msg('Tu écoutes ' + E.cote + ' : ' + ((E.opts.find(o => o.v === E[E.cote]) || {}).nom || ''));
  }
  $('#ecPlay').onclick = () => E.joue ? stop() : jouer();
  $$('#ecAB button').forEach(b => b.onclick = () => basculer(b.dataset.c));
  document.addEventListener('keydown', e => {
    if (page.classList.contains('hidden') || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.querySelector('.voile')) return;
    if (e.code === 'Space') { e.preventDefault(); E.joue ? stop() : jouer(); }
    if (e.key === 'Tab') { e.preventDefault(); if (E.B) basculer(); }
  });

  // ---------- recaler B (si les deux versions ne commencent pas pareil) ----------
  const champ = BK.rendu.champGlisse($('#ecDecal'), { min: -500, max: 500, val: 0, pas: 1, change: v => { E.decal = v / 100; garderDecal(); dessiner(); if (E.joue) jouer(); } });
  function majDecal() { champ.regler(Math.round(E.decal * 100)); const el = $('#ecDecal'); el.value = (E.decal > 0 ? '+' : '') + E.decal.toFixed(2) + ' s'; }
  function garderDecal() { const d = BK.reglage('ecoute.decal', {}); d[E.A + '|' + E.B] = E.decal; BK.regler('ecoute.decal', d); majDecal(); }
  $('#ecDecal').addEventListener('pointerup', majDecal); $('#ecDecal').addEventListener('blur', () => setTimeout(majDecal, 0));
  // calage automatique : on compare l'énergie des 40 premières secondes (100 points par seconde)
  $('#ecAuto').onclick = () => {
    if (!E.bufA || !E.bufB) return msg('Il faut A et B');
    const env = buf => { const d = buf.getChannelData(0), pas = Math.round(buf.sampleRate / 100), n = Math.min(4000, Math.floor(d.length / pas)), o = new Float32Array(n);
      for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < pas; j += 4) s += Math.abs(d[i * pas + j]); o[i] = s; } return o; };
    const a = env(E.bufA), b = env(E.bufB); let best = 0, bs = -Infinity;
    for (let lag = -300; lag <= 300; lag++) { let s = 0; for (let i = 300; i < a.length - 300; i++) { const j = i + lag; if (j >= 0 && j < b.length) s += a[i] * b[j]; } if (s > bs) { bs = s; best = lag; } }
    E.decal = best / 100; garderDecal(); dessiner(); if (E.joue) jouer();
    msg(best ? `B recalé de ${E.decal > 0 ? '+' : ''}${E.decal.toFixed(2)} s` : 'A et B sont déjà calés');
  };

  // ---------- la forme du son : A en bleu (en haut), B en rouge (en bas) ----------
  function dessiner() {
    const r = onde.getBoundingClientRect(), W = Math.max(300, Math.round(r.width)), H = 150;
    cv.width = W * devicePixelRatio; cv.height = H * devicePixelRatio; cv.style.height = H + 'px';
    const x = cv.getContext('2d'); x.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); x.clearRect(0, 0, W, H);
    const D = duree(); if (!D) return;
    const trace = (buf, y0, h, c, decal) => { if (!buf) return;
      const px = Math.round(W * buf.duration / D), p = BK.audio.pics(buf, Math.max(10, px)), x0 = -decal / D * W;
      x.fillStyle = c; for (let i = 0; i < px; i++) { const mn = p[i * 2], mx = p[i * 2 + 1]; x.fillRect(x0 + i, y0 + h / 2 - mx * h / 2, 1, Math.max(1, (mx - mn) * h / 2)); } };
    if (E.bufA && E.bufB) { trace(E.bufA, 4, 66, '#4f9bd0', 0); trace(E.bufB, 80, 66, '#d0574f', E.decal); x.fillStyle = 'rgba(239,230,210,.15)'; x.fillRect(0, 75, W, 1); }
    else trace(E.bufA || E.bufB, 6, 138, E.bufA ? '#4f9bd0' : '#d0574f', E.bufA ? 0 : E.decal);      // un seul mix : il prend toute la hauteur
    dessinerNotes(); majTete();
  }
  function majTete() { const D = duree(); if (!D) return; $('#ecTete').style.left = (E.pos / D * 100) + '%'; $('#ecTemps').textContent = tps(E.pos) + ' / ' + tps(D);
    if (!E.sel) $('#ecQuand').textContent = tps(E.pos); }
  addEventListener('resize', () => { if (!page.classList.contains('hidden')) dessiner(); });

  // clic = aller là ; cliquer-glisser = choisir un passage (pour une note)
  let g = null;
  const tA = ev => { const r = onde.getBoundingClientRect(); return Math.max(0, Math.min(duree(), (ev.clientX - r.left) / r.width * duree())); };
  onde.addEventListener('pointerdown', ev => { if (!duree()) return; g = { t: tA(ev), x: ev.clientX }; onde.setPointerCapture(ev.pointerId); });
  onde.addEventListener('pointermove', ev => { if (!g) return; if (Math.abs(ev.clientX - g.x) > 5) { const a = Math.min(g.t, tA(ev)), b = Math.max(g.t, tA(ev)); E.sel = { a, b }; majSel(); } });
  onde.addEventListener('pointerup', ev => { if (!g) return; const glisse = Math.abs(ev.clientX - g.x) > 5; g = null;
    if (!glisse) { E.sel = null; majSel(); E.joue ? jouer(tA(ev)) : (E.pos = tA(ev), majTete()); }
    else { E.joue ? jouer(E.sel.a) : (E.pos = E.sel.a, majTete()); $('#ecTexte').focus(); } });
  function majSel() { const z = $('#ecSelz'), D = duree();
    if (!E.sel || !D) { z.classList.add('hidden'); $('#ecQuand').textContent = tps(E.pos); return; }
    z.classList.remove('hidden'); z.style.left = (E.sel.a / D * 100) + '%'; z.style.width = ((E.sel.b - E.sel.a) / D * 100) + '%';
    $('#ecQuand').textContent = tps(E.sel.a) + ' → ' + tps(E.sel.b); }

  // ---------- les notes (partagées avec tout le groupe) ----------
  async function chargerNotes() {
    const l = E.m ? (await BK.db.liste('notesmix')).filter(n => n.morceau === E.m.id) : [];
    E.notes = l.sort((a, b) => a.t - b.t); dessinerNotes();
  }
  BK.ecouteRecharger = () => { if (E.m) chargerNotes(); };
  const nomVersion = v => ((E.opts.find(o => o.v === v) || {}).nom || 'autre version');
  function visibles() {
    const f = ($('.ec-filtres .chip.on') || {}).dataset ? $('.ec-filtres .chip.on').dataset.f : 'tout';
    return E.notes.filter(n => (n.version === E.A || n.version === E.B || !E.A) && (f === 'tout' || (f === 'ouvertes' && !n.regle) || (f === 'A' && n.version === E.A) || (f === 'B' && n.version === E.B)));
  }
  function dessinerNotes() {
    const l = visibles(), D = duree();
    $('#ecNbH').textContent = String(E.notes.filter(n => !n.regle).length).padStart(2, '0');
    // les marques sous la forme du son : un point (instant) ou une barre (passage), à la couleur de la personne
    $('#ecMarques').innerHTML = D ? l.map(n => `<span class="ec-mq${n.fin ? ' passage' : ''}${n.regle ? ' regle' : ''}" data-n="${n.id}" title="${esc(tps(n.t) + (n.fin ? ' → ' + tps(n.fin) : '') + ' · ' + n.par + ' : ' + n.texte)}"
      style="left:${Math.min(100, n.t / D * 100)}%;${n.fin ? `width:${Math.max(0.6, (n.fin - n.t) / D * 100)}%;` : ''}--pc:${couleur(n.par)};top:${n.version === E.B ? 12 : 0}px"></span>`).join('') : '';
    $('#ecListe').innerHTML = l.length ? l.map(n => `<div class="ec-n${n.regle ? ' regle' : ''}" data-n="${n.id}" style="--pc:${couleur(n.par)}">
        <button class="ec-n-t mono" data-aller="${n.id}" title="Écouter à cet endroit">${tps(n.t)}${n.fin ? ' → ' + tps(n.fin) : ''}</button>
        <div class="ec-n-c"><div class="ec-n-l"><b>${esc(n.par)}</b><span class="ec-v ${n.version === E.B ? 'b' : 'a'}" title="${esc(nomVersion(n.version))}">${n.version === E.B ? 'B' : 'A'}</span><span class="ec-n-txt">${esc(n.texte)}</span></div>${n.texteEn ? `<div class="ec-en"><span>EN</span>${esc(n.texteEn)}</div>` : ''}
          ${(n.reponses || []).map(r => `<div class="ec-rep" style="--pc:${couleur(r.par)}"><b>${esc(r.par)}</b> ${esc(r.texte)}${r.texteEn ? `<em class="ec-en-r"> · EN : ${esc(r.texteEn)}</em>` : ''}</div>`).join('')}
          <div class="ec-rep-f hidden"><input class="fld" placeholder="Ta réponse… (Entrée)"></div></div>
        <div class="ec-n-o"><button class="btn xs" data-rep="${n.id}" title="Répondre">💬 ${(n.reponses || []).length || ''}</button>
          <button class="btn xs${n.regle ? ' on' : ''}" data-ok="${n.id}" title="Réglé / pas réglé">${n.regle ? '✓ réglé' : '○'}</button>
          ${n.par === moi() ? `<button class="btn xs" data-x="${n.id}" title="Retirer ma note">✕</button>` : ''}</div></div>`).join('')
      : `<span class="nt">${E.m ? 'Pas encore de note. Écoute, clique à l\'endroit voulu (ou cliquer-glisser pour un passage), puis écris ta note.' : 'Choisis un morceau.'}</span>`;
    const trouver = id => E.notes.find(n => n.id === id);
    $$('[data-aller]', page).forEach(b => b.onclick = () => { const n = trouver(b.dataset.aller); if (n.version === E.B) basculer('B'); else if (n.version === E.A) basculer('A'); jouer(Math.max(0, n.t - 1)); });
    $$('.ec-mq', page).forEach(b => b.onclick = () => { const n = trouver(b.dataset.n); const el = $(`.ec-n[data-n="${n.id}"]`); el && el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); el && el.classList.add('flash'); setTimeout(() => el && el.classList.remove('flash'), 900); });
    $$('[data-ok]', page).forEach(b => b.onclick = async () => { const n = trouver(b.dataset.ok); n.regle = !n.regle; await BK.db.ecrire('notesmix', n); dessinerNotes(); });
    $$('[data-x]', page).forEach(b => b.onclick = async () => { const n = trouver(b.dataset.x); if (!await BK.confirmer('Retirer ta note ?')) return; E.notes = E.notes.filter(x => x !== n); await BK.db.supprimer('notesmix', n.id); dessinerNotes(); });
    $$('[data-rep]', page).forEach(b => b.onclick = () => { const f = b.closest('.ec-n').querySelector('.ec-rep-f'); f.classList.toggle('hidden'); const i = f.querySelector('input'); i.focus();
      i.onkeydown = async e => { e.stopPropagation(); if (e.key !== 'Enter' || !i.value.trim()) return; const n = trouver(b.dataset.rep);
        (n.reponses = n.reponses || []).push({ par: moi(), texte: i.value.trim(), quand: new Date().toISOString() }); await BK.db.ecrire('notesmix', n); dessinerNotes(); }; });
  }
  $$('.ec-filtres .chip').forEach(c => c.onclick = () => { $$('.ec-filtres .chip').forEach(x => x.classList.toggle('on', x === c)); dessinerNotes(); });
  async function ajouterNote() {
    const t = $('#ecTexte').value.trim(); if (!t) return $('#ecTexte').focus();
    if (!E.m || !E[E.cote]) return msg('Choisis d\'abord un morceau et une version');
    const n = { morceau: E.m.id, version: E[E.cote], versionNom: nomVersion(E[E.cote]), t: Math.round((E.sel ? E.sel.a : E.pos) * 10) / 10,
      fin: E.sel ? Math.round(E.sel.b * 10) / 10 : null, texte: t, par: moi(), quand: new Date().toISOString(), reponses: [], regle: false };
    const f = await BK.db.ecrire('notesmix', n); E.notes.push(f); E.notes.sort((a, b) => a.t - b.t);
    $('#ecTexte').value = ''; E.sel = null; majSel(); dessinerNotes(); msg('Note ajoutée à ' + tps(n.t) + ' sur ' + E.cote);
  }
  $('#ecAjout').onclick = ajouterNote;
  $('#ecTexte').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') ajouterNote(); });
  // la liste pour l'ingé son : les notes à régler de la version écoutée (B en général : le nouveau mix)
  $('#ecCopier').onclick = async () => {
    const v = E[E.cote], l = E.notes.filter(n => n.version === v && !n.regle); if (!l.length) return msg('Aucune note à régler sur ' + E.cote);
    const en = l.every(n => n.texteEn);                                 // tout est traduit : on copie l'anglais (sinon le français)
    const txt = `${E.m.nom} — ${nomVersion(v)}\n\n` + l.map(n => `${tps(n.t)}${n.fin ? '–' + tps(n.fin) : ''} : ${en ? n.texteEn : n.texte}${(n.reponses || []).length ? ' (' + n.reponses.map(r => en && r.texteEn ? r.texteEn : r.texte).join(' / ') + ')' : ''}`).join('\n');
    try { await navigator.clipboard.writeText(txt); msg(l.length + ' note(s) copiée(s)' + (en ? ' en anglais' : '') + ' : colle-les à l\'ingé son'); } catch (e) { msg('Copie impossible'); }
  };
  // ---------- Miette traduit les notes en anglais (naturel, vocabulaire d'ingé son). On garde les deux textes. ----------
  $('#ecTraduire').onclick = async () => {
    const l = E.notes.filter(n => !n.texteEn || (n.reponses || []).some(r => !r.texteEn)); if (!l.length) return msg('Tout est déjà traduit');
    const b = $('#ecTraduire'); b.disabled = true; const avant = b.textContent; b.innerHTML = '<span class="spin"></span>Miette traduit…';
    try {
      const entree = l.map(n => ({ id: n.id, texte: n.texte, reponses: (n.reponses || []).map(r => r.texte) }));
      const r = await BK.ia.demander(JSON.stringify(entree), { prio: true, json: true, temperature: 0.2, vite: true,
        systeme: 'Tu traduis en anglais des notes de mixage écrites en français par un groupe de musique, pour un ingénieur du son anglophone. Traduis de façon naturelle, comme un musicien parlerait à un ingé son (vocabulaire de studio : vocal, low end, punch, reverb tail, sidechain…), sans rien ajouter. Réponds en JSON : {"l":[{"id":"…","en":"…","reponses":["…"]}]} dans le même ordre.' });
      let n = 0;
      for (const x of (r && r.l) || []) { const note = E.notes.find(y => y.id === x.id); if (!note || !x.en) continue;
        note.texteEn = String(x.en).trim(); (note.reponses || []).forEach((rp, i) => { if (x.reponses && x.reponses[i]) rp.texteEn = String(x.reponses[i]).trim(); });
        await BK.db.ecrire('notesmix', note); n++; }
      dessinerNotes(); msg(n + ' note(s) traduite(s) en anglais');
    } catch (e) { msg('Traduction impossible : ' + (e.message || e)); }
    b.disabled = false; b.textContent = avant;
  };

  // depuis la Bibliothèque (Retours) : ouvrir Écoute sur ce morceau et cette version (en A)
  BK.ecouteOuvrir = async (id, version) => { BK.ouvrir('ecoute'); await remplirMorceaux(); $('#ecMorceau').value = id; await choisirMorceau();
    if (version && [...$('#ecA').options].some(o => o.value === version)) { $('#ecA').value = version; if ($('#ecB').value === version) $('#ecB').value = ''; await Promise.all([chargerCote('A'), chargerCote('B')]); dessinerNotes(); } };
  (BK.surOuvrir = BK.surOuvrir || {}).ecoute = async () => { await remplirMorceaux(); if (!E.m && $('#ecMorceau').value) choisirMorceau(); else { dessiner(); chargerNotes(); } };
  remplirMorceaux();
});
})();
