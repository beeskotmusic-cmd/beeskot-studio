// =====================================================================
// LIGHT TOAST — TOAST by Beeskot (musique → vidéo pour les bandes LED) dans un onglet.
// Le programme est dans ui/lighttoast/toast.html (fabriqué par lighttoast-outils/adapter.py à partir
// du TOAST d'origine) : pour le mettre à jour, remplacer toast-original.html et relancer adapter.py.
// Ici : la page, les compteurs de l'en-tête, et le pont « enregistrer dans le Drive ».
// Drive : BEESKOT Studio / Light Toast / Projets (.json)  et  Vidéos (.mp4)
// =====================================================================
(() => {
const tampon = o => o.buffer.slice(o.byteOffset, o.byteOffset + o.byteLength);   // Uint8Array → ArrayBuffer (ce que TOAST lit)
// le pont : TOAST (dans le cadre) l'appelle par parent.BK.toast
BK.toast = {
  async dossier(sous) { const base = await BK.drive.dossier('Light Toast', await BK.drive.racine()); return BK.drive.dossier(sous, base); },
  async envoyer(blob, nom, sous) { if (!BK.drive.relie()) throw new Error('Drive non relié (Réglages)'); return BK.drive.envoyerBlob(blob, nom, await this.dossier(sous)); },
  async lister(sous) { if (!BK.drive.relie()) throw new Error('Drive non relié (Réglages)'); const d = await this.dossier(sous);
    const r = await (await BK.drive.api('/files?' + new URLSearchParams({ q: `${BK.drive.q(d)} in parents and trashed=false`, fields: 'files(id,name,modifiedTime)', orderBy: 'modifiedTime desc', pageSize: '100' }))).json();
    return r.files || []; },
  async lire(id) { return BK.drive.api('/files/' + id + '?alt=media'); },

  // ----- la musique de la section 1 : Bibliothèque (morceau → version) et Médias -----
  async morceaux() { return (await BK.db.liste('morceaux')).sort((a, b) => a.nom.localeCompare(b.nom)); },
  // les versions d'un morceau, comme dans Reels Audio : l'export ★ de la fiche, ceux de ce PC, puis les sons du Drive
  async versions(id) {
    const ms = await this.morceaux(), m = ms.find(x => x.id === id); if (!m) return [];
    const ex = BK.inv.exportsDe(m, await BK.inv.tous(), ms).filter(f => f.ici || f.drive);
    const i0 = ex.findIndex(f => f.chemin === m.exportPrincipal); if (i0 > 0) ex.unshift(ex.splice(i0, 1)[0]);
    const opts = ex.map(f => ({ v: f.drive ? 'drive:' + f.driveId : f.chemin, nom: f.nom, ou: f.drive ? '☁' : '💻' }));
    if (BK.drive.relie()) try {
      await BK.dossiers.assurer(); const l = BK.trierStems(await BK.dossiers.duMorceau(m, ms)).filter(f => !f.groupe), vus = new Set(opts.map(o => o.v));
      const rang = f => ({ cl: 0, recording: 1, ableton: 2 }[f.role] ?? 3);
      l.filter(f => /\.(wav|mp3|aiff?|flac|m4a|ogg)$/i.test(f.name) && !/tournage/i.test(f.name) && f.role !== 'wavtournage')
        .sort((a, b) => rang(a) - rang(b) || (b.modifiedTime || '').localeCompare(a.modifiedTime || ''))
        .forEach(f => { if (!vus.has('drive:' + f.id)) opts.push({ v: 'drive:' + f.id, nom: f.name, ou: '☁' }); });
    } catch (e) {}
    return opts;
  },
  async lireVersion(v, nom) {
    if (v.startsWith('drive:')) return { bytes: tampon(await BK.drive.telecharger(v.slice(6))), nom };
    if (!BK.estExe) throw new Error('fichier de ce PC : seulement dans le logiciel installé');
    return { bytes: tampon(await BK.fichier.lireOctets(v)), nom: v.split(/[\\/]/).pop() };
  },
  choisirMusiques(titre) { return BK.choisirDansMedias({ titre, bouton: 'Charger', type: 'audio' }); },
  async lireMedia(x) {
    if (x.fichier) return { bytes: await x.fichier.arrayBuffer(), nom: x.nom };
    if (x.dc) return { bytes: await (await (await BK.discord.fetch(x.dc.url)).blob()).arrayBuffer(), nom: x.nom };
    return { bytes: tampon(await BK.drive.telecharger(x.id)), nom: x.nom };
  },
};

window.BKToast = BK.toast;                                             // TOAST (dans le cadre) le retrouve par parent.BKToast

BK.module('lighttoast', function (page) {
  $('.sub', page).textContent = 'Musique → vidéo pour les bandes LED : pêches, effets, vue 3D';
  $('.hdr .right', page).innerHTML = ['PÊCHES|lc1', 'EFFETS|lc2', 'SECTIONS|lc3', 'TEMPO|lc4'].map(x => { const [n, i] = x.split('|');
    return `<div><span class="eng" style="font-size:9px">${n}</span><span class="vfd" data-lt="${i}">—</span></div>`; }).join('');
  const g = $('.grid', page); g.classList.add('lt-grid');
  g.innerHTML = '<iframe class="lt-frame" title="Light Toast" allow="autoplay; fullscreen" allowfullscreen></iframe>';
  const f = $('.lt-frame', page); let obs = null;
  const compteurs = () => { try { const d = f.contentDocument; $$('[data-lt]', page).forEach(e => { const s = d.getElementById(e.dataset.lt); if (s) e.textContent = s.textContent.trim() || '—'; }); } catch (e) {} };

  // look « neuf » : métal brossé en fond, modules en tissu violet foncé, accents bleu canard (injecté dans la page Light Toast)
  const STYLE_NEUF = `html.bk-neuf,html.bk-neuf body{background:transparent!important}
html.bk-neuf{--ac:#3fb0a6!important}
html.bk-neuf #colA,html.bk-neuf #colB,html.bk-neuf #colC{background:transparent!important;box-shadow:none!important}
html.bk-neuf body section:nth-of-type(n){background-color:#1c1640!important;background-image:url(../look/toile-douce-show.png)!important;background-size:128px 128px!important;background-repeat:repeat!important;box-shadow:inset 0 0 0 1px #8a7fd055,inset 0 1px 0 #ffffff22,inset 0 0 26px #0009,0 4px 10px #000a!important}
html.bk-neuf body h2{color:#ece9e2!important}
html.bk-neuf .gh{color:#5fe0d2!important}
html.bk-neuf #play,html.bk-neuf #rec,html.bk-neuf #sgo,html.bk-neuf .lt-pri{background:linear-gradient(#3fb0a6,#1d5f66)!important;color:#eafffb!important}
html.bk-neuf #play:hover,html.bk-neuf #rec:hover,html.bk-neuf #sgo:hover,html.bk-neuf .lt-pri:hover{background:linear-gradient(#52c4ba,#257079)!important}
html.bk-neuf .db.on,html.bk-neuf .cc.on,html.bk-neuf #fsbar .chip.on,html.bk-neuf button[aria-pressed=true],html.bk-neuf .lt-seg button.on,html.bk-neuf #ltMembBt.on,html.bk-neuf #ltEdBt.on,html.bk-neuf button.on{background:linear-gradient(#3fb0a6,#1d5f66)!important;color:#eafffb!important;box-shadow:0 0 0 2px #2f9a94,inset 0 2px 5px rgba(0,0,0,.4)!important}
html.bk-neuf .sw.on{box-shadow:0 0 0 2px #3fb0a6,0 0 8px #3fb0a6aa!important}
html.bk-neuf select,html.bk-neuf input[type=number],html.bk-neuf input[type=text]{border-color:#3a3a3e!important;color:#7fe6da!important}
html.bk-neuf.bk-ecusson body button:not(.sw){background:none!important;background-color:#232325!important;color:#e6e6e6!important;border:0!important;border-radius:6px!important;text-shadow:none!important;box-shadow:0 2px 4px rgba(0,0,0,.45)!important}
html.bk-neuf.bk-ecusson body button:not(.sw):hover{filter:brightness(1.15)}
html.bk-neuf.bk-ecusson body #play,html.bk-neuf.bk-ecusson body #rec,html.bk-neuf.bk-ecusson body #sgo,html.bk-neuf.bk-ecusson body .lt-pri{background:none!important;background-color:#1f7f7a!important;color:#e8fffb!important}
html.bk-neuf.bk-ecusson body .db.on,html.bk-neuf.bk-ecusson body .cc.on,html.bk-neuf.bk-ecusson body #fsbar .chip.on,html.bk-neuf.bk-ecusson body button[aria-pressed=true],html.bk-neuf.bk-ecusson body .lt-seg button.on,html.bk-neuf.bk-ecusson body #ltMembBt.on,html.bk-neuf.bk-ecusson body #ltEdBt.on,html.bk-neuf.bk-ecusson body button.on{background:none!important;background-color:#a6f0e6!important;color:#0e2e2c!important;box-shadow:0 2px 4px rgba(0,0,0,.45)!important}`;
  const habiller = () => { try { const d = f.contentDocument; if (!d || !d.documentElement) return;
    if (!d.getElementById('bk-neuf')) { const st = d.createElement('style'); st.id = 'bk-neuf'; st.textContent = STYLE_NEUF; d.head.appendChild(st); }
    d.documentElement.classList.toggle('bk-neuf', document.body.classList.contains('look-neuf')); d.documentElement.classList.toggle('bk-ecusson', document.body.classList.contains('look-ecusson')); } catch (e) {} };
  f.addEventListener('load', () => { habiller(); compteurs(); clearInterval(obs); obs = setInterval(() => { if (!page.classList.contains('hidden')) { habiller(); compteurs(); } }, 1500); });
  BK.surOuvrir = BK.surOuvrir || {};
  BK.surOuvrir.lighttoast = () => { if (!f.getAttribute('src')) f.src = 'lighttoast/toast.html'; };   // chargé à la première ouverture seulement : rien ne pèse au démarrage
});
})();
