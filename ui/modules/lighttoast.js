// =====================================================================
// TOAST2 — le nouveau Light Toast (musique → vidéo pour les tubes LED), façon logiciel de montage.
// Le programme est dans ui/lighttoast2/ (moteur/ + ecran/). Ici : le chargement dans l'onglet (à la 1re ouverture),
// et les « sources » branchées sur BEESKOT Studio :
//   musique  → Bibliothèque (morceau → version), Médias, ou un fichier du PC
//   passages → ceux de Reels Audio / Tournages (BK.passagesDuMorceau)
//   poses    → Drive : BEESKOT Studio / Light Toast / Poses (fichiers Mixamo .fbx, jamais sur GitHub)
//   projets  → Drive : BEESKOT Studio / Light Toast / TOAST2 (.json) + copie de secours sur ce PC
// =====================================================================
(() => {
const esc = x => String(x ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// une petite fenêtre (Annuler = null)
const fenetre = (html, brancher) => new Promise(res => {
  const fond = document.createElement('div'); fond.className = 't2-fen-fond'; fond.innerHTML = `<div class="t2-fen">${html}</div>`; document.body.appendChild(fond);
  const fin = r => { fond.remove(); res(r); }; fond.addEventListener('click', e => { if (e.target === fond) fin(null); }); brancher(s => fond.querySelector(s), fin, fond);
});
const tampon = o => o.buffer.slice(o.byteOffset, o.byteOffset + o.byteLength);   // Uint8Array → ArrayBuffer
const SCRIPTS = ['moteur/base.js', 'moteur/materiel.js', 'moteur/effets.js', 'moteur/decompte.js', 'moteur/projet.js', 'moteur/moteur.js', 'moteur/analyse.js', 'moteur/declencheurs.js', 'moteur/ancien.js',
  'ecran/son.js', 'ecran/roue.js', 'ecran/inspecteur.js', 'vendor/three.min.js', 'vendor/chargeurs-3d.js', 'ecran/studio.js', 'ecran/vue3d.js', 'ecran/timeline.js', 'ecran/montage.js', 'ecran/export.js'];
const charger = src => new Promise((ok, ko) => { const s = document.createElement('script'); s.src = 'lighttoast2/' + src; s.onload = ok; s.onerror = () => ko(new Error(src)); document.head.appendChild(s); });

// ---------- le Drive ----------
BK.toast = {
  async dossier(sous) { const base = await BK.drive.dossier('Light Toast', await BK.drive.racine()); return BK.drive.dossier(sous, base); },
  async lister(sous) {
    if (!BK.drive.relie()) throw new Error('Drive non relié (Réglages)'); const d = await this.dossier(sous);
    const r = await (await BK.drive.api('/files?' + new URLSearchParams({ q: `${BK.drive.q(d)} in parents and trashed=false`, fields: 'files(id,name,modifiedTime)', orderBy: 'modifiedTime desc', pageSize: '200' }))).json();
    return r.files || [];
  },
  // un fichier : remplacé s'il existe déjà (même nom), créé sinon
  async ecrire(sous, nom, blob, id) {
    if (!BK.drive.relie()) throw new Error('Drive non relié (Réglages)');
    if (!id) { const f = (await this.lister(sous)).find(x => x.name === nom); id = f && f.id; }
    if (id) { await BK.drive.api(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': blob.type || 'application/octet-stream' }, body: blob }); return id; }
    return (await BK.drive.envoyerBlob(blob, nom, await this.dossier(sous))).id;
  },
  // tous les projets Light Toast du Drive, où qu'ils soient rangés (ex. « 8) LIGHTSHOW ») : les .json assez gros ou au nom parlant
  async projetsPartout() {
    if (!BK.drive.relie()) return [];
    const ici = new Set((await this.lister('TOAST2')).map(f => f.id)), l = []; let page = '';
    for (let i = 0; i < 6; i++) {
      const r = await (await BK.drive.api('/files?' + new URLSearchParams({ q: "name contains '.json' and trashed=false", fields: 'nextPageToken,files(id,name,modifiedTime,size)', orderBy: 'modifiedTime desc', pageSize: '1000', pageToken: page }))).json();
      for (const f of r.files || []) if (/\.json$/i.test(f.name) && (ici.has(f.id) || +f.size > 300000 || /^(led|projet-)|toast|light/i.test(f.name))) l.push(Object.assign(f, { ancien: !ici.has(f.id) }));
      page = r.nextPageToken || ''; if (!page) break;
    }
    return l.sort((a, b) => (a.ancien - b.ancien) || (b.modifiedTime || '').localeCompare(a.modifiedTime || ''));
  },
  async morceaux() { return (await BK.db.liste('morceaux')).sort((a, b) => a.nom.localeCompare(b.nom)); },
  // les versions d'un morceau, comme dans Reels Audio : l'export ★ de la fiche, ceux de ce PC, puis les sons du Drive
  async versions(id) {
    const ms = await this.morceaux(), m = ms.find(x => x.id === id); if (!m) return [];
    const ex = BK.inv.exportsDe(m, await BK.inv.tous(), ms).filter(f => f.ici || f.drive);
    const i0 = ex.findIndex(f => f.chemin === m.exportPrincipal); if (i0 > 0) ex.unshift(ex.splice(i0, 1)[0]);
    const opts = ex.map(f => ({ v: f.drive ? 'drive:' + f.driveId : f.chemin, nom: f.nom, ou: f.drive ? 'Drive' : 'PC' }));
    if (BK.drive.relie()) try {
      await BK.dossiers.assurer(); const l = BK.trierStems(await BK.dossiers.duMorceau(m, ms)).filter(f => !f.groupe), vus = new Set(opts.map(o => o.v));
      const rang = f => ({ cl: 0, recording: 1, ableton: 2 }[f.role] ?? 3);
      l.filter(f => /\.(wav|mp3|aiff?|flac|m4a|ogg)$/i.test(f.name) && !/tournage/i.test(f.name) && f.role !== 'wavtournage')
        .sort((a, b) => rang(a) - rang(b) || (b.modifiedTime || '').localeCompare(a.modifiedTime || ''))
        .forEach(f => { if (!vus.has('drive:' + f.id)) opts.push({ v: 'drive:' + f.id, nom: f.name, ou: 'Drive' }); });
    } catch (e) {}
    return opts;
  },
  async lireVersion(v) {
    if (v.startsWith('drive:')) return tampon(await BK.drive.telecharger(v.slice(6)));
    if (!BK.estExe) throw new Error('fichier de ce PC : seulement dans le logiciel installé');
    return tampon(await BK.fichier.lireOctets(v));
  },
};

const lireMedia = async x => x.fichier ? x.fichier.arrayBuffer() : x.dc ? (await (await BK.discord.fetch(x.dc.url)).blob()).arrayBuffer() : tampon(await BK.drive.telecharger(x.id));
// ---------- petite fenêtre « choisir la musique » : Bibliothèque, Médias ou PC ----------
const fichierPC = multiple => new Promise(res => {
  const i = Object.assign(document.createElement('input'), { type: 'file', accept: 'audio/*', multiple });
  i.onchange = async () => res(await Promise.all([...i.files].map(async f => ({ nom: f.name.replace(/\.[^.]+$/, ''), octets: await f.arrayBuffer() })))); i.click();
});
function fenetreMusique() {
  return new Promise(async res => {
    const fond = document.createElement('div'); fond.className = 't2-fen-fond';
    fond.innerHTML = `<div class="t2-fen"><b>Choisir la musique</b>
      <label>Morceau <select data-m><option value="">…</option></select></label>
      <label>Version <select data-v disabled></select></label>
      <div class="t2-fen-b"><button data-ok class="lt2-pri" disabled>Charger</button><button data-medias>Médias…</button><button data-pc>Fichier du PC…</button><button data-non>Annuler</button></div>
      <p class="t2-fen-e"></p></div>`;
    document.body.appendChild(fond);
    const $f = s => fond.querySelector(s), fin = r => { fond.remove(); res(r); }, err = t => { $f('.t2-fen-e').textContent = t; };
    let ms = [];
    try { ms = await BK.toast.morceaux(); $f('[data-m]').innerHTML = '<option value="">Choisis un morceau</option>' + ms.map(m => `<option value="${m.id}">${esc(m.nom)}</option>`).join(''); } catch (e) { err('Bibliothèque indisponible'); }
    $f('[data-m]').onchange = async e => {
      const v = $f('[data-v]'); v.disabled = true; $f('[data-ok]').disabled = true; v.innerHTML = '<option>Recherche…</option>';
      const l = e.target.value ? await BK.toast.versions(e.target.value).catch(() => []) : [];
      v.innerHTML = l.length ? l.map(o => `<option value="${esc(o.v)}">${esc(o.nom)} · ${o.ou}</option>`).join('') : '<option value="">Aucune version</option>';
      v.disabled = !l.length; $f('[data-ok]').disabled = !l.length;
    };
    $f('[data-ok]').onclick = async () => {
      const id = $f('[data-m]').value, v = $f('[data-v]').value, m = ms.find(x => x.id === id); if (!v) return;
      $f('[data-ok]').textContent = 'Téléchargement…';
      try { fin({ nom: m ? m.nom : 'Musique', octets: await BK.toast.lireVersion(v), morceau: id, version: v }); } catch (e) { $f('[data-ok]').textContent = 'Charger'; err('Impossible : ' + (e.message || e)); }
    };
    $f('[data-medias]').onclick = async () => {
      try {
        const l = await BK.choisirDansMedias({ titre: 'Musique pour TOAST2', bouton: 'Charger', type: 'audio' }); const x = l && l[0]; if (!x) return;
        const octets = await lireMedia(x);
        fin({ nom: (x.nom || 'Musique').replace(/\.[^.]+$/, ''), octets, version: x.id && !x.fichier ? 'drive:' + x.id : null });
      } catch (e) { err('Médias : ' + (e.message || e)); }
    };
    $f('[data-pc]').onclick = async () => { const l = await fichierPC(false); if (l[0]) fin(l[0]); };
    $f('[data-non]').onclick = () => fin(null);
  });
}

// une petite cave sur ce PC (IndexedDB) pour ne pas retélécharger les gros fichiers
const cave = {
  ouvrir: () => new Promise((ok, ko) => { const r = indexedDB.open('bk-toast2', 1); r.onupgradeneeded = () => r.result.createObjectStore('cave'); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); }),
  async lire(k) { const db = await this.ouvrir(); return new Promise((ok, ko) => { const q = db.transaction('cave').objectStore('cave').get(k); q.onsuccess = () => { db.close(); ok(q.result || null); }; q.onerror = () => ko(q.error); }); },
  async ecrire(k, v) { const db = await this.ouvrir(); return new Promise((ok, ko) => { const t = db.transaction('cave', 'readwrite'); t.objectStore('cave').put(v, k); t.oncomplete = () => { db.close(); ok(); }; t.onerror = () => ko(t.error); }); },
};
// ---------- les sources de TOAST2 dans BEESKOT Studio ----------
function brancher() {
  LT.sources = Object.assign(LT.sources || {}, {
    choisirMusique: fenetreMusique,
    // les stems : choisis dans Médias (Drive, Discord ou ce PC)
    async choisirStems() {
      const l = await BK.choisirDansMedias({ titre: 'Stems pour TOAST2', bouton: 'Ajouter', type: 'audio' }) || [], r = [];
      for (const x of l) r.push({ nom: (x.nom || 'Stem').replace(/\.[^.]+$/, ''), octets: await lireMedia(x) });
      return r;
    },
    async passages(id) {
      const ms = await BK.toast.morceaux(), m = ms.find(x => x.id === id); if (!m) return [];
      return (await BK.passagesDuMorceau(m, ms, { reels: true })).map(p => ({ debut: p.debut, fin: p.fin, nom: p.nom || p.titre || 'Passage' })).filter(p => p.fin > p.debut);
    },
    // les poses Mixamo : dans le Drive (envoyées une fois par « Charger les poses »)
    // gardées sur ce PC après la 1re fois (on ne retélécharge que si le fichier du Drive a changé)
    async poses() {
      const garde = await cave.lire('poses').catch(() => null);
      if (!BK.drive.relie()) return garde ? garde.o : null;
      let l = []; try { l = (await BK.toast.lister('Poses')).filter(f => /\.fbx$/i.test(f.name)); } catch (e) { return garde ? garde.o : null; }
      if (!l.length) return null;
      const cle = l.map(f => f.id + f.modifiedTime).sort().join('|'); if (garde && garde.cle === cle) return garde.o;
      const o = {}; for (const f of l) o[f.name] = tampon(await BK.drive.telecharger(f.id));
      cave.ecrire('poses', { cle, o }).catch(() => {}); return o;
    },
    async garderPoses(octets) {
      if (!BK.drive.relie()) return;
      for (const [nom, buf] of Object.entries(octets)) await BK.toast.ecrire('Poses', nom, new Blob([buf], { type: 'application/octet-stream' }));
      BK.toast.msg && BK.toast.msg('Poses envoyées dans le Drive (Light Toast / Poses) : les autres PC les auront tout seuls.');
    },
  });
  LT.sources.modeles.base = 'lighttoast2/modeles/';
}

// ---------- l'onglet ----------
BK.module('lighttoast', function (page) {
  $('.sub', page).textContent = 'Musique → vidéo pour les tubes LED : pistes, effets, vue 3D du studio';
  $('.hdr .right', page).innerHTML = `<div class="t2-barre"><span class="t2-nom">Nouveau projet</span>
    <button class="btn xs" data-t2="nouveau">Nouveau</button><button class="btn xs" data-t2="ouvrir">Ouvrir…</button><button class="btn xs" data-t2="enregistrer">Enregistrer</button><button class="btn xs" data-t2="exporter" title="Fabriquer la vidéo .mp4 pour les lumières">Exporter</button><span class="t2-etat"></span></div>`;
  const g = $('.grid', page); g.classList.add('lt-grid'); g.innerHTML = '<div class="t2-zone"><p class="lt2-vide" style="padding:16px">Chargement de TOAST2…</p></div>';
  let M = null, fichierId = null, pret = null, minuteur = null, exportEnCours = null;
  const etat = t => { $('.t2-etat', page).textContent = t || ''; }; BK.toast.msg = etat;
  const nomProjet = () => (M && M.projet.nom) || (M && M.projet.musique && M.projet.musique.nom) || 'Projet';
  const majNom = () => { $('.t2-nom', page).textContent = nomProjet(); };
  const secours = () => { try { localStorage.setItem('bk.toast2.dernier', JSON.stringify({ projet: M.projet, fichierId })); } catch (e) {} };
  // remettre la musique d'un projet rouvert (le .json ne garde que sa référence)
  const remettreMusique = async () => {
    const mu = M.projet.musique; if (!mu || !mu.version) return;
    try { etat('Musique…'); await M.poserMusique(await BK.toast.lireVersion(mu.version)); etat(''); } catch (e) { etat('Musique à recharger (' + (e.message || e) + ')'); }
  };
  // un projet de l'ancien Light Toast : converti, et sa musique (rangée dans le fichier) mise dans le Drive pour la retrouver ensuite
  const ouvrirAncien = async o => {
    etat('Conversion de l\'ancien projet…'); const octets = LT.ancien.musique(o); let buf = null;
    if (octets) try { buf = await M.son.decoder(octets); } catch (e) { }
    const r = LT.ancien.convertir(o, buf && buf.duration);
    M.remplacer(JSON.stringify(r.projet)); fichierId = null; majNom();
    if (buf) { await M.poserMusique(octets, buf); M.tl.toutVoir(); }
    if (octets && BK.drive.relie()) try { etat('Musique → Drive…'); M.projet.musique.version = 'drive:' + await BK.toast.ecrire('Musiques', o.audioName || (r.projet.nom + '.wav'), new Blob([octets])); } catch (e) { }
    secours(); etat(r.notes.length ? 'Converti. À vérifier : ' + r.notes.join(' · ') : 'Ancien projet converti (pense à Enregistrer)');
  };
  const ouvrirProjet = async (json, id) => { M.remplacer(typeof json === 'string' ? json : JSON.stringify(json)); fichierId = id || null; majNom(); await remettreMusique(); };

  const demarrer = async () => {
    if (!document.querySelector('link[href="lighttoast2/lt2.css"]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'lighttoast2/lt2.css'; document.head.appendChild(l); }
    for (const s of SCRIPTS) if (!(window.LT && LT._charge && LT._charge[s])) { await charger(s); (LT._charge = LT._charge || {})[s] = 1; }
    brancher();
    const zone = $('.t2-zone', g); zone.innerHTML = '';
    let depart = null; try { depart = JSON.parse(localStorage.getItem('bk.toast2.dernier') || 'null'); } catch (e) {}
    M = new LT.Montage(zone, depart && depart.projet ? depart.projet : LT.projet.nouveau());
    fichierId = depart && depart.fichierId || null; majNom(); remettreMusique();
    // à chaque changement : copie de secours sur ce PC (le Drive, c'est « Enregistrer »)
    // la liste des morceaux dans la Bibliothèque : un clic = un nouveau projet avec sa version principale
    M.surMorceau = async id => {
      const m = (M.morceaux || []).find(x => x.id === id); if (!m) return;
      if (M.projet.musique && !await BK.confirmer('Nouveau projet avec « ' + m.nom + ' » ? Pense à enregistrer celui-ci avant.')) return;
      try {
        etat('Recherche de « ' + m.nom + ' »…'); const v = (await BK.toast.versions(id))[0]; if (!v) { etat('Aucun son pour ce morceau'); return; }
        await ouvrirProjet(LT.projet.nouveau(m.nom)); etat('Téléchargement…');
        await M.chargerMusique({ nom: m.nom, octets: await BK.toast.lireVersion(v.v), morceau: id, version: v.v }); M.projet.nom = m.nom; majNom(); etat('');
      } catch (e) { etat('Impossible : ' + (e.message || e)); }
    };
    BK.toast.morceaux().then(l => { M.morceaux = l; M.biblio(); }).catch(() => {});
    const change0 = M.change.bind(M); M.change = (...a) => { change0(...a); clearTimeout(minuteur); minuteur = setTimeout(() => { secours(); majNom(); }, 800); etat('Pas enregistré'); };
  };
  $('.hdr .right', page).addEventListener('click', async e => {
    const b = e.target.closest('[data-t2]'); if (!b || !M) return; const a = b.dataset.t2;
    if (a === 'nouveau') { if (!await BK.confirmer('Nouveau projet ? Pense à enregistrer celui-ci avant.')) return; await ouvrirProjet(LT.projet.nouveau()); etat(''); }
    if (a === 'enregistrer') {
      const nom = await fenetre(`<b>Enregistrer dans le Drive</b><label>Nom du projet <input type="text" data-nom value="${esc(nomProjet())}"></label><div class="t2-fen-b"><button class="lt2-pri" data-ok>Enregistrer</button><button data-non>Annuler</button></div>`,
        ($f, fin) => { const i = $f('[data-nom]'); i.focus(); i.select(); $f('[data-ok]').onclick = () => fin(i.value.trim() || null); $f('[data-non]').onclick = () => fin(null); i.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') fin(i.value.trim() || null); }; });
      if (!nom) return; M.projet.nom = nom; majNom();
      try { etat('Enregistrement…'); fichierId = await BK.toast.ecrire('TOAST2', nom.replace(/[\\/:*?"<>|]/g, '-') + '.json', new Blob([JSON.stringify(M.projet)], { type: 'application/json' }), fichierId); secours(); etat('Enregistré dans le Drive'); }
      catch (err) { etat('Pas enregistré : ' + (err.message || err)); }
    }
    if (a === 'exporter') {
      if (exportEnCours) { exportEnCours.stop = true; return; }   // pendant un export, le bouton sert à l'annuler
      const passage = M.entree != null || M.sortie != null, mmss = t => Math.floor(Math.max(0, t) / 60) + ':' + String(Math.floor(Math.max(0, t) % 60)).padStart(2, '0');
      const choix = await fenetre(`<b>Exporter la vidéo des lumières</b>
        <label>Quoi <select data-quoi><option value="tout">Le morceau entier (${mmss(M.duree())})</option>${passage ? `<option value="passage" selected>Le passage choisi (${mmss(M.entree ?? 0)} → ${mmss(M.sortie ?? M.duree())})</option>` : ''}</select></label>
        <label><span><input type="checkbox" data-son checked> Avec la musique${M.projet.decompte && M.projet.decompte.actif ? ' et le clic du décompte' : ''}</span></label>
        <label><span><input type="checkbox" data-drive${BK.drive.relie() ? ' checked' : ' disabled'}> Mettre aussi dans le Drive (Light Toast / Vidéos)</span></label>
        <p class="t2-fen-e" style="color:inherit;opacity:.7">Fichier .mp4 en 1920 × 1080, 30 images par seconde. L'export se fait en fond : tu peux continuer à travailler.</p>
        <div class="t2-fen-b"><button class="lt2-pri" data-ok>Exporter</button><button data-non>Annuler</button></div>`,
        ($f, fin) => { $f('[data-ok]').onclick = () => fin({ quoi: $f('[data-quoi]').value, son: $f('[data-son]').checked, drive: $f('[data-drive]').checked }); $f('[data-non]').onclick = () => fin(null); });
      if (!choix) return;
      const fe = LT.decompte.fenetre(M.projet), debut = choix.quoi === 'passage' ? (fe && Math.abs((M.entree ?? 0) - fe.fin) < .01 ? fe.debut : M.entree ?? M.debutMin()) : M.debutMin(), fin = choix.quoi === 'passage' ? M.sortie ?? M.duree() : M.duree();
      const nom = (nomProjet() + (choix.quoi === 'passage' ? '_' + mmss(Math.max(0, debut)).replace(':', 'm') + 's' : '')).replace(/[\\/:*?"<>|]/g, '-') + '_LED.mp4';
      exportEnCours = { stop: false }; b.textContent = 'Annuler l\'export';
      try {
        const r = await LT.exporter(M, { debut, fin, son: choix.son, arret: () => exportEnCours.stop, progression: q => etat('Export… ' + Math.round(q * 100) + ' %') });
        if (!r) etat('Export annulé');
        else {
          const mp4 = r.mp4;
          const chemin = await BK.enregistrerFichier('Light Toast', nom, mp4, 'video/mp4'); let fait = chemin ? 'Vidéo prête : ' + chemin : 'Export annulé';
          if (chemin && choix.drive) try { etat('Envoi dans le Drive…'); await BK.toast.ecrire('Vidéos', nom, new Blob([mp4], { type: 'video/mp4' })); fait += ' · aussi dans le Drive'; } catch (err) { fait += ' · Drive : échec (' + (err.message || err) + ')'; }
          if (chemin && choix.son && !r.son) fait += ' · SANS le son (cet ordinateur ne sait pas l\'encoder, ou il n\'y a pas de musique)';
          etat(fait);
        }
      } catch (err) { etat('Export impossible : ' + (err.message || err)); console.error(err); }
      exportEnCours = null; b.textContent = 'Exporter'; return;
    }
    if (a === 'ouvrir') {
      try {
        etat('Liste…'); let l = [];
        if (BK.drive.relie()) l = await BK.toast.projetsPartout();
        etat('');
        const f = await fenetre(`<b>Ouvrir un projet</b>${l.length ? '' : '<p class="t2-fen-e">' + (BK.drive.relie() ? 'Aucun projet trouvé dans le Drive.' : 'Drive non relié (Réglages).') + '</p>'}<div class="t2-fen-l">${l.map((x, k) => `<button data-k="${k}">${esc(x.name.replace(/\.json$/i, ''))}${x.ancien ? ' <em>(Drive)</em>' : ''}<i>${new Date(x.modifiedTime).toLocaleDateString('fr-CA')}</i></button>`).join('')}</div><div class="t2-fen-b"><button data-pc>Fichier du PC…</button><button data-non>Annuler</button></div>`,
          ($f, fin, fond) => { fond.querySelectorAll('[data-k]').forEach(b => b.onclick = () => fin(l[+b.dataset.k])); $f('[data-non]').onclick = () => fin(null);
            $f('[data-pc]').onclick = () => { const i = Object.assign(document.createElement('input'), { type: 'file', accept: '.json' }); i.onchange = () => fin({ fichier: i.files[0] }); i.click(); }; });
        if (!f) return;
        if (f.fichier || f.ancien) {
          etat('Lecture…'); const o = JSON.parse(f.fichier ? await f.fichier.text() : await (await BK.drive.api('/files/' + f.id + '?alt=media')).text());
          if (LT.ancien.est(o)) await ouvrirAncien(o); else if (o && o.format === 'lighttoast') { await ouvrirProjet(o); etat(''); } else etat('Ce fichier n\'est pas un projet Light Toast');
          return;
        }
        etat('Ouverture…'); await ouvrirProjet(await (await BK.drive.api('/files/' + f.id + '?alt=media')).text(), f.id); etat('');
      } catch (err) { etat('Ouverture impossible : ' + (err.message || err)); }
    }
  });
  BK.surOuvrir = BK.surOuvrir || {};
  BK.surOuvrir.lighttoast = () => { if (!pret) pret = demarrer().catch(e => { g.innerHTML = '<p class="lt2-vide" style="padding:16px">TOAST2 ne démarre pas : ' + String(e.message || e).replace(/</g, '&lt;') + '</p>'; pret = null; }); };
});
})();
