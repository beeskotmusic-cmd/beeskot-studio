// =====================================================================
// LES IMAGES DES FICHES — on ne recopie plus les photos dans les fiches.
// La fiche garde juste l'adresse de l'image sur le Drive : « drive:<id> ».
// On la lit (en petit) quand on l'affiche. Les anciennes images, recopiées
// dans les fiches avant, marchent toujours : rien n'est cassé.
//
//   fiche ──► "drive:1AbC…" ──► Drive ──► petite image à l'écran
//
// Dans le HTML : BK.img.bg(v) pour un fond, BK.img.src(v) pour une <img>.
// Les images pas encore chargées se remplissent toutes seules.
// =====================================================================
BK.img = {
  estDrive: v => typeof v === 'string' && v.startsWith('drive:'),
  id: v => v.slice(6),
  ref: id => 'drive:' + id,
  attente: {},

  // l'image prête à afficher tout de suite (ou '' si elle doit encore venir du Drive)
  vite(v) { if (!v) return ''; if (!BK.img.estDrive(v)) return v; return BK.drive.vignettes[BK.img.id(v)] || ''; },

  // l'image à afficher (va la chercher sur le Drive si besoin)
  async url(v) {
    if (!v) return '';
    if (!BK.img.estDrive(v)) return v;
    const id = BK.img.id(v);
    if (BK.drive.vignettes[id]) return BK.drive.vignettes[id];
    if (!BK.drive.relie()) return '';
    if (!BK.img.attente[id]) BK.img.attente[id] = (async () => {
      try {
        const f = await (await BK.drive.api(`/files/${id}?fields=id,thumbnailLink,size,mimeType,trashed`)).json();
        let u = f.thumbnailLink ? await BK.drive.vignette(f) : '';
        if (!u && (+f.size || 0) < 15e6) {               // pas encore d'aperçu (image toute neuve) : on lit l'image elle-même
          const r = await BK.drive.api(`/files/${id}?alt=media`);
          u = BK.drive.vignetteGarder(id, URL.createObjectURL(await BK.img.reduire(await r.blob(), 600)));
        }
        return u || '';
      } catch (e) { return ''; }
      finally { setTimeout(() => delete BK.img.attente[id], 0); }
    })();
    return BK.img.attente[id];
  },

  // dans le HTML : un fond d'image, ou une image
  bg(v) {
    if (!v) return '';
    const u = BK.img.vite(v), r = BK.img.estDrive(v) ? ` data-ref="${v}"` : '';
    return (u ? ` style="background-image:url('${u}')"` : ` data-img="${v}"`) + r;
  },
  src(v) {
    const u = BK.img.vite(v);
    const r = BK.img.estDrive(v) ? ` data-ref="${v}"` : '';
    return (u ? ` src="${u}"` : ` data-img="${v || ''}" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="`) + r;
  },
  // remplit les images qui attendaient (appelé tout seul quand l'écran change)
  remplir(racine = document) {
    const l = racine.querySelectorAll ? racine.querySelectorAll('[data-img]') : [];
    for (const el of l) {
      const v = el.dataset.img; el.removeAttribute('data-img'); if (!v) continue;
      el.classList.add('img-charge');
      BK.img.url(v).then(u => {
        el.classList.remove('img-charge');
        if (!u) { el.classList.add('img-absente'); return; }
        if (el.tagName === 'IMG') el.src = u; else el.style.backgroundImage = `url('${u}')`;
      });
    }
  },
  // avant d'imprimer : toutes les images prêtes
  async toutes(racine) {
    const refs = [...racine.querySelectorAll('[data-img]')].map(el => el.dataset.img || '');     // AVANT de remplir (remplir retire l'attribut)
    BK.img.remplir(racine);
    await Promise.all(refs.map(v => BK.img.url(v)));
    await new Promise(ok => setTimeout(ok, 60));                                                  // le temps que chaque image reçoive son adresse
    await Promise.all([...racine.querySelectorAll('img')].map(i => i.complete ? 0 : new Promise(ok => { i.onload = i.onerror = ok; setTimeout(ok, 4000); })));
  },

  // ---------- ranger une image dans le Drive → son adresse pour la fiche ----------
  // role : le dossier du groupe où la ranger (moodboard, outfits, photovideo…)
  async versDrive(blob, nom, role) {
    if (!BK.drive.relie()) return BK.img.enDataUrl(blob, 520);          // sans Drive (aperçu) : comme avant, dans la fiche
    const dos = await BK.img.dossier(role);
    const f = await BK.drive.envoyerBlob(blob instanceof File ? blob : new File([blob], nom, { type: blob.type || 'image/jpeg' }), nom, dos, () => {});
    try { BK.drive.vignetteGarder(f.id, URL.createObjectURL(await BK.img.reduire(blob, 600))); } catch (e) {}   // tout de suite à l'écran
    return { ref: BK.img.ref(f.id), id: f.id };
  },
  // une image de Discord : rangée UNE fois dans le Drive (on se souvient de la copie, pas de doublon)
  async depuisDiscord(dc, nom, role) {
    if (BK.drive.relie() && BK.etiquettes) { await BK.etiquettes.charger(); const deja = BK.etiquettes.copieDe(dc.id); if (deja) return { ref: BK.img.ref(deja), id: deja }; }
    const r = await BK.discord.fetch(dc.url); if (!r.ok) throw new Error('expiré sur Discord');
    const d = await BK.img.versDrive(await r.blob(), nom || dc.nom || 'image.jpg', role);
    if (typeof d === 'string') return { ref: d, id: null };                    // sans Drive
    try { await BK.etiquettes.noterCopie(dc.id, d.id); } catch (e) {}
    return d;
  },
  // un fichier choisi dans la fenêtre Médias → son adresse sur le Drive (Discord et ce PC y sont rangés d'abord, une seule fois)
  async depuisChoix(x, role) {
    if (x.f) return { ref: BK.img.ref(x.f.id), id: x.f.id };
    if (x.dc) return BK.img.depuisDiscord(x.dc, x.nom, role);
    if (x.fichier) { const d = await BK.img.versDrive(x.fichier, x.nom, role); return typeof d === 'string' ? { ref: d, id: null } : d; }
    return { ref: '', id: null };
  },
  async dossier(role) {
    const d = role && BK.dossiers ? await BK.dossiers.get(role).catch(() => null) : null;
    if (d && d.id) return d.id;
    return BK.drive.dossier('Images', await BK.drive.racine());          // pas de dossier du groupe trouvé : « BEESKOT Studio / Images »
  },

  // ---------- petits outils ----------
  async reduire(blob, max = 600) {
    const im = await createImageBitmap(blob), k = Math.min(1, max / Math.max(im.width, im.height));
    const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); im.close && im.close();
    return new Promise(ok => c.toBlob(b => ok(b || blob), 'image/jpeg', 0.85));
  },
  async enDataUrl(blob, max = 520) {
    const b = await BK.img.reduire(blob, max);
    return new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(b); });
  },
  estCopie: v => typeof v === 'string' && v.startsWith('data:image'),

  // ---------- alléger les fiches : les vieilles images recopiées → rangées dans le Drive ----------
  // (on garde une sauvegarde de chaque fiche avant ; et la Time Machine reste là)
  async alleger(progression = () => {}) {
    if (!BK.drive.relie()) throw new Error('Drive pas relié');
    const dos = await BK.drive.dossier('Images des fiches', await BK.drive.racine());
    let n = 0, i = 0;
    const ranger = async (v, nom) => {
      if (!BK.img.estCopie(v)) return v;
      const blob = await (await fetch(v)).blob();
      const f = await BK.drive.envoyerBlob(new File([blob], nom, { type: blob.type || 'image/jpeg' }), nom, dos, () => {});
      BK.drive.vignetteGarder(f.id, URL.createObjectURL(blob)); n++;
      return BK.img.ref(f.id);
    };
    const propre = s => String(s || 'image').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 40) || 'image';
    const sauvegarde = {};
    const [ms, rs, ts] = await Promise.all(['morceaux', 'reels', 'tournages'].map(c => BK.db.liste(c)));
    const total = ms.length + rs.length + ts.length;
    for (const m of ms) { progression(++i / total, m.nom);
      if (!BK.img.estCopie(m.photo)) continue;
      sauvegarde['morceaux/' + m.id] = m.photo;
      m.photo = await ranger(m.photo, propre(m.nom) + ' - photo.jpg'); await BK.db.ecrire('morceaux', m, { sansAnnuler: true }); await BK.audio.pause(); }
    for (const r of rs) { progression(++i / total, r.titre);
      if (!BK.img.estCopie(r.affiche)) continue;
      sauvegarde['reels/' + r.id] = r.affiche;
      r.affiche = await ranger(r.affiche, propre(r.nom || r.titre) + ' - poster.jpg'); await BK.db.ecrire('reels', r, { sansAnnuler: true }); await BK.audio.pause(); }
    for (const t of ts) { progression(++i / total, t.titre);
      const avant = JSON.stringify({ m: t.moodboard || [], p: t.tenuesPhotos || {} });
      if (!/data:image/.test(avant)) continue;
      sauvegarde['tournages/' + t.id] = avant;
      const mood = []; let k = 0;
      for (const v of t.moodboard || []) { mood.push(await ranger(v, propre(t.titre) + ' - moodboard ' + (++k) + '.jpg')); await BK.audio.pause(); }
      t.moodboard = mood;
      for (const qui of Object.keys(t.tenuesPhotos || {})) {
        const l = []; k = 0;
        for (const v of t.tenuesPhotos[qui] || []) { l.push(await ranger(v, propre(t.titre) + ' - tenue ' + qui + ' ' + (++k) + '.jpg')); await BK.audio.pause(); }
        t.tenuesPhotos[qui] = l;
      }
      await BK.db.ecrire('tournages', t, { sansAnnuler: true });
    }
    if (Object.keys(sauvegarde).length) {                              // la sauvegarde : un fichier dans le Drive, au cas où
      const nom = 'sauvegarde-images-fiches-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.json';
      await BK.drive.envoyerBlob(new Blob([JSON.stringify(sauvegarde)], { type: 'application/json' }), nom, dos, () => {});
    }
    return n;
  },
  combienDeCopies(ms, rs, ts) {
    let n = 0; const c = v => { if (BK.img.estCopie(v)) n++; };
    (ms || []).forEach(m => c(m.photo)); (rs || []).forEach(r => c(r.affiche));
    (ts || []).forEach(t => { (t.moodboard || []).forEach(c); Object.values(t.tenuesPhotos || {}).forEach(l => (l || []).forEach(c)); });
    return n;
  },
};

// les images qui attendent se remplissent toutes seules dès qu'elles arrivent à l'écran
new MutationObserver(ms => {
  for (const m of ms) for (const n of m.addedNodes) {
    if (n.nodeType !== 1) continue;
    if (n.dataset && n.dataset.img) BK.img.remplir(n.parentNode || document);
    else if (n.querySelector && n.querySelector('[data-img]')) BK.img.remplir(n);
  }
}).observe(document.documentElement, { childList: true, subtree: true });

// ---------- clic droit « ☁ Ouvrir sur le Drive » : sur toute image venue du Drive (data-ref="drive:ID") ou tout élément data-drive="ID" ----------
BK.driveUrl = id => 'https://drive.google.com/file/d/' + id + '/view';
BK.menuDrive = (e, id, plus) => {
  document.querySelectorAll('.cd-menu').forEach(x => x.remove());
  const m = document.createElement('div'); m.className = 'md-menu cd-menu';
  m.innerHTML = (plus || []).map((p, i) => `<button data-p="${i}">${p.nom}</button>`).join('') + '<button data-d="1">☁ Ouvrir sur le Drive</button>';
  m.style.left = Math.min(e.clientX, innerWidth - 230) + 'px'; m.style.top = Math.min(e.clientY, innerHeight - 90) + 'px'; document.body.appendChild(m);
  m.onclick = ev => { const b = ev.target.closest('button'); if (!b) return; m.remove(); if (b.dataset.d) BK.ouvrirLien(BK.driveUrl(id)); else (plus[+b.dataset.p] || {}).f && plus[+b.dataset.p].f(); };
  setTimeout(() => document.addEventListener('pointerdown', ev => { if (!m.contains(ev.target)) m.remove(); }, { once: true, capture: true }), 0);
};
document.addEventListener('contextmenu', e => {
  if (e.defaultPrevented) return;
  const el = e.target.closest && e.target.closest('[data-drive],[data-ref^="drive:"]'); if (!el) return;
  const id = el.dataset.drive || String(el.dataset.ref).slice(6); if (!id) return;
  e.preventDefault(); BK.menuDrive(e, id);
});
