// =====================================================================
// ACCUEIL — Next, le résumé de Miette, la prochaine release (+ à droite : photo du jour et phrase qui motive) + À faire.
// Sur le côté : avancement des morceaux, alertes, et « Pour démarrer ».
// =====================================================================
BK.etapes = [            // les étapes d'un morceau et leur poids dans le pourcentage
  { id: 'maquette', nom: 'Maquette',   poids: 15, c: '#b23a2a' },   // chaque étape a SA couleur (celles du rail, rouge → vert)
  { id: 'enreg',    nom: 'Enreg.',     poids: 25, c: '#d2722e' },
  { id: 'mixage',   nom: 'Mixage',     poids: 20, c: '#d9a93c' },
  { id: 'master',   nom: 'Mastering',  poids: 10, c: '#2f7377' },
  { id: 'release',  nom: 'Release',    poids: 10, c: '#3f6f9a' },
  { id: 'promo',    nom: 'Promo',      poids: 20, c: '#6c9a52' },
];
BK.pourcent = m => BK.etapes.reduce((t, e, i) => t + (i < (m.fait || 0) ? e.poids : i === (m.fait || 0) ? e.poids * (m.enCours || 0) : 0), 0);
// la couleur de l'avancement : les mêmes que le rail sous les titres (rouge → orange → jaune → bleu → vert)
BK.couleurAvance = (m) => { const pc = m.statut === 'sorti' ? 100 : BK.pourcent(m);
  return pc >= 100 ? '#6c9a52' : pc >= 80 ? 'var(--teal)' : pc >= 60 ? 'var(--mus)' : pc >= 40 ? 'var(--org)' : pc >= 20 ? 'var(--rust)' : 'var(--ox)'; };

(() => {
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));


async function donnees() {
  const morceaux = await BK.db.liste('morceaux'), taches = await BK.db.liste('taches');
  const evs = BK.agendaTous ? BK.agendaTous() : [];
  const maintenant = Date.now(), auj = new Date().toISOString().slice(0, 10);
  const next = evs.find(e => e.debut >= maintenant - 36e5) || null;
  const afaire = taches.filter(t => !t.fait).sort((a, b) => (a.date || '9').localeCompare(b.date || '9'));
  const alertes = [];
  // (on ne prévient plus « projet Ableton seulement sur ce PC » : c'est normal quand on travaille dessus)
  for (const m of morceaux.filter(m => m.statut !== 'sorti'))
    if (m.maj && maintenant - new Date(m.maj) > 21 * 864e5) alertes.push({ led: 'amb', txt: `${m.nom} : rien n'a bougé depuis 3 semaines` });
  const release = morceaux.filter(m => m.statut === 'prochaine' || (m.statut !== 'sorti' && m.sortie && m.sortie >= auj))
    .sort((a, b) => (a.sortie || '9').localeCompare(b.sortie || '9') || (a.rang || 0) - (b.rang || 0));
  const ret = afaire.filter(t => t.date && t.date < auj).length;
  if (ret) alertes.push({ led: 'amb', txt: `${ret} tâche(s) en retard` });
  const props = (await BK.db.liste('propositions')).filter(p => p.statut === 'attente').length;
  if (props) alertes.unshift({ led: 'amb', txt: `Miette a ${props} proposition(s) à valider` });
  const demarrer = [
    { ok: BK.drive.relie(), txt: 'Relier le Drive BEESKOT', va: 'reglages' },          // le Drive d'abord : tout passe par lui
    { ok: morceaux.length > BK.FICHES_DEPART.length, txt: 'Créer les fiches de vos morceaux', va: 'biblio' },
    { ok: !!BK.ableton.relie, txt: 'Relier Ableton', va: 'mixprep' },
  ];
  return { next, afaire, release, morceaux: morceaux.filter(m => m.statut !== 'sorti'), sortis: morceaux.filter(m => m.statut === 'sorti').length, alertes, demarrer, auj };
}

// ---------- LA PHOTO DU JOUR (Accueil) ----------
// une image étiquetée « Affiches / flyers » ou « Presse / EPK », tirée au hasard UNE fois par jour,
// avec un look d'époque (cadre Polaroid ou pellicule + couleur chaude légère). Gardée sur ce PC jusqu'au lendemain.
// Si la photo est trop sombre, trop claire ou trop petite : pas d'effet de couleur (juste le cadre), pour qu'elle reste belle.
BK.photoDuJour = async () => {
  const jour = new Date().toISOString().slice(0, 10), garde = BK.reglage('accueil.photo', null);
  if (garde && garde.jour === jour) return garde.u || '';
  if (!BK.drive.relie() || !BK.etiquettes) return '';
  const tags = await BK.etiquettes.tous();
  const ids = Object.keys(tags).filter(id => !/^dc:/.test(id) && BK.etiquettes.liste(tags, id).some(k => k === 'c:affiche' || k === 'c:presse'));
  if (!ids.length) { BK.regler('accueil.photo', { jour, u: '' }); return ''; }
  let h = 0; for (const c of jour) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  for (let essai = 0; essai < Math.min(4, ids.length); essai++) {
    const id = ids[(h + essai) % ids.length];
    try {
      const r = await BK.drive.api(`/files/${id}?alt=media`), blob = await r.blob(); if (!/^image\//.test(blob.type) && blob.size > 15e6) continue;
      const img = await createImageBitmap(await BK.img.reduire(blob, 1200));
      // la photo est-elle « sûre » pour un effet ? (lumière moyenne et taille)
      const t = document.createElement('canvas'); t.width = t.height = 32; const x = t.getContext('2d'); x.drawImage(img, 0, 0, 32, 32);
      const d = x.getImageData(0, 0, 32, 32).data; let lum = 0; for (let i = 0; i < d.length; i += 4) lum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
      lum /= 1024; const sur = lum > 0.2 && lum < 0.8 && Math.min(img.width, img.height) >= 400;
      const L = 600, H = 750, rr = BK.rendu.creer(L, H);
      rr.dessiner(img, { zoom: 1, x: 0, y: 0 }, 0, '', sur ? { type: h % 2 ? 'kodak' : 'polaroid', t: 0, k: 0.45 } : null);
      const c = document.createElement('canvas'); c.width = L; c.height = H;
      BK.rendu.cadre(c.getContext('2d'), rr.sortie, L, H, h % 2 ? 'pellicule' : 'polaroid', 28, h);
      const u = c.toDataURL('image/jpeg', 0.86); BK.regler('accueil.photo', { jour, u, id }); return u;
    } catch (e) { console.warn('photo du jour', e); }
  }
  return '';
};

// ---------- LA PHRASE QUI MOTIVE : selon l'avancement des prochaines releases (une différente chaque jour) ----------
BK.phraseDuJour = d => {
  const rel = (d.release || []).slice(0, 2), noms = rel.map(m => m.nom), pc = rel.length ? Math.round(rel.reduce((a, m) => a + BK.pourcent(m), 0) / rel.length) : 0;
  const qui = noms.length > 1 ? noms.slice(0, -1).join(', ') + ' et ' + noms[noms.length - 1] : noms[0] || '';
  const P = {
    rien: ['Pas de release prévue ? Parfait, c\'est le moment d\'en lancer une.', 'Page blanche. Les meilleurs morceaux commencent toujours comme ça.', 'Choisissez le prochain son, et on fonce.'],
    debut: [`${qui} : ${pc} %. Le plus dur, c'est de commencer. Et c'est fait.`, `${pc} % sur ${qui}. Chaque grand morceau a commencé par une boucle pourrie.`, `${qui} démarre. Un pas par jour, les gars.`],
    route: [`${qui} : ${pc} %. Ça avance, on garde le rythme.`, `${pc} % sur ${qui}. On tient le bon bout, on lâche rien.`, `${qui} prend forme. Encore quelques sessions et ça sonne.`],
    moitie: [`${qui} : ${pc} %. Plus de la moitié de faite. On lâche pas les gars !`, `${pc} % ! ${qui}, on voit le bout. Pas maintenant qu'on s'arrête.`, `${qui} à ${pc} %. Le gros du boulot est derrière, putain on y est presque.`],
    fin: [`${qui} : ${pc} %. Dernière ligne droite, on finit en beauté !`, `${pc} %. Plus que les détails : mix, master, et ça part.`, `${qui} est presque prêt. Préparez-vous à le crier partout.`],
    fini: [`${qui} : 100 %. Putain, on l'a fait !`, `C'est fini. ${qui} est prêt. Bordel, quelle fierté.`, `100 %. On l'a fait, les gars. Maintenant on le fait écouter à tout le monde.`],
  };
  const s = d.sortis || 0;
  const disco = s >= 2 ? [`${s} morceaux déjà sortis : la discographie BEESKOT a commencé, et c'est que le début.`, `${s} sorties au compteur. On construit quelque chose, là.`] : s === 1 ? ['Un morceau déjà dehors. Le prochain va faire encore plus mal.'] : [];
  const cle = !rel.length ? 'rien' : pc >= 100 ? 'fini' : pc >= 90 ? 'fin' : pc >= 50 ? 'moitie' : pc >= 10 ? 'route' : 'debut';
  const l = [...P[cle], ...(cle === 'rien' || cle === 'debut' ? disco : [])];
  let h = 0; for (const c of new Date().toISOString().slice(0, 10)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return l[h % l.length];
};

BK.module('accueil', function (page) {
  BK.surOuvrir = BK.surOuvrir || {};
  BK.surOuvrir.accueil = async () => { try { dessiner(await donnees()); } catch (e) { console.error(e); } };
  setTimeout(BK.surOuvrir.accueil, 300);

  function dessiner(d) {
    const T = BK.typesRdv || {}, n = d.next, t = n && (T[n.type] || { nom: 'Rendez-vous', c: 'var(--mus)' });
    const quand = n ? n.debut.toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase() + (n.journee ? '' : ' · ' + n.debut.toTimeString().slice(0, 5)) : '';
    $('.hdr .right', page).innerHTML = `<div><span class="eng" style="font-size:9px">À faire</span><span class="vfd">${String(d.afaire.length).padStart(2, '0')}</span></div>
      <div><span class="eng" style="font-size:9px">Morceaux en chantier</span><span class="vfd">${String(d.morceaux.length).padStart(2, '0')}</span></div>`;
    const barre = m => { const p = Math.round(BK.pourcent(m));
      return `<div class="avance mini" style="--av:${BK.couleurAvance(m)}"><span class="avance-nom">${esc(m.nom)}</span>
        <div class="avance-piste"><div class="etapes">${BK.etapes.map((e, i) => `<span class="seg-etape ${i < (m.fait || 0) ? 'fait' : i === (m.fait || 0) ? 'encours' : ''}" style="flex:${e.poids};--sc:${e.c}"><i style="width:${i < (m.fait || 0) ? 100 : i === (m.fait || 0) ? Math.round((m.enCours || 0) * 100) : 0}%"></i></span>`).join('')}</div></div>
        <span class="vfd avance-pc">${p} %</span></div>`; };
    const toutFait = d.demarrer.slice(0, 3).every(x => x.ok);
    $('.grid', page).innerHTML = `
      <div class="cols">
        <section class="pane vit" aria-label="Vitrine">
          <div class="ac-haut">
            <div class="ac-col">
              <div class="box next"><span class="lb">Next</span>
                ${n ? `<div class="next-l"><span class="nchip" style="--c:${t.c}"></span><span class="vfd next-q">${quand}</span>
                  <div><span class="evt-type">${esc(t.nom)}</span><span class="nt" style="margin:2px 0 0;font-size:14px;color:var(--ink)">${esc(n.titre || '')}${n.morceau ? ' · ' + esc(n.morceau) : ''}</span></div></div>`
                  : `<span class="nt">Aucun rendez-vous prévu. <a href="#" data-va="agenda">Ajouter dans le Calendrier</a></span>`}</div>
              <div class="box ac-resume" id="acResume"></div>
              ${d.release.length ? `<div class="box ac-rel"><span class="lb">Prochaine release</span>
                <div class="ac-rel-l">${d.release.slice(0, 2).map(m => `<button class="ac-rel-m" data-va="biblio" title="Ouvrir la Bibliothèque">
                  <span class="ac-rel-p${m.photo ? '' : ' vide'}"${BK.img.bg(m.photo)}>${m.photo ? '' : '♪'}</span>
                  <span class="ac-rel-n">${esc(m.nom)}</span><span class="vfd ac-rel-pc">${Math.round(BK.pourcent(m))} %</span></button>`).join('')}</div></div>` : ''}
            </div>
            <div class="box ac-cote"><div class="ac-photo" id="acPhoto"></div><p class="ac-phrase"><img class="mi-ic" src="look/patch-miette.png" alt="Miette"><b>Miette :</b> « ${esc(BK.phraseDuJour(d))} »</p></div>
          </div>
          <div class="box grow"><div class="ligne-titre"><span class="lb">À faire</span><button class="btn xs" data-va="taches" style="margin-left:auto">Ouvrir la To-do list</button></div>
            <div class="af-liste">${d.afaire.length ? d.afaire.map(x => `<div class="af-l${x.date && x.date < d.auj ? ' retard' : ''}">
                <button class="ta-case" data-id="${x.id}"></button><span class="af-t">${esc(x.texte)}</span>
                <span class="nt af-m">${esc(x.qui || 'Pas encore attribuée')}${x.morceau ? ' · ' + esc(x.morceau) : ''}${x.date ? ' · pour le ' + new Date(x.date + 'T12:00').toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' }) : ''}</span></div>`).join('')
              : '<span class="nt">Rien à faire pour l\'instant 🎉</span>'}</div></div>
        </section>
        <section class="pane reg" aria-label="Côté"><span class="ptitle">② En bref</span>
          ${toutFait ? '' : `<div class="box"><span class="lb">Pour démarrer</span><div class="surv">${d.demarrer.map(x => `<div class="surv-l"><span class="led ${x.ok ? 'grn' : ''}"></span><span class="nt" style="margin:0;flex:1">${x.txt}</span>${x.ok ? '' : `<button class="btn xs" data-va="${x.va}">Y aller</button>`}</div>`).join('')}</div></div>`}
          <div class="box"><span class="lb">Alertes</span><div class="surv">${d.alertes.length ? d.alertes.map(a => `<div class="surv-l"><span class="led ${a.led}"></span><span class="nt" style="margin:0">${esc(a.txt)}</span></div>`).join('') : '<span class="nt">Tout va bien.</span>'}</div></div>
          <div class="box grow"><span class="lb">Avancement</span><div class="avances">${d.morceaux.length ? d.morceaux.map(barre).join('') : '<span class="nt">Aucun morceau en chantier.</span>'}</div></div>
        </section>
      </div>
      <div class="pane abar" aria-label="Barre">
        <span class="vfd">${new Date().toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}</span>
        <div class="right"><button class="btn" data-va="agenda">Calendrier</button><button class="btn pri" data-va="biblio">Bibliothèque ▶</button></div></div>`;
    $$('[data-va]', page).forEach(b => b.onclick = e => { e.preventDefault(); BK.ouvrir(b.dataset.va); });
    resume(); colonneDroite();
    $$('.af-l .ta-case', page).forEach(b => b.onclick = async e => {
      e.stopPropagation(); const x = d.afaire.find(t => t.id === b.dataset.id); if (!x || x.fait) return;
      b.classList.add('on'); b.textContent = '✓'; b.closest('.af-l').classList.add('faite');          // on voit tout de suite que c'est coché
      x.fait = true; x.faitLe = new Date().toISOString(); x.faitPar = BK.reglage('nomPc', '') || 'ce PC';
      try { await BK.db.ecrire('taches', x); } catch (er) {}
      BK.tachesRecharger && BK.tachesRecharger();
      setTimeout(() => BK.surOuvrir.accueil(), 700); });
  }

  // ---------- « Cette semaine » : le résumé de Miette (Discord + Gemini) ----------
  // le dernier résumé est gardé sur ce PC : il s'affiche tout de suite, sans attendre ni clignoter.
  // On ne le refait que s'il y a de nouveaux messages (ou si on clique ↻).
  function afficherResume(doc, { pret = true, enCours = false, regle = true } = {}) {
    const z = $('#acResume', page); if (!z) return;
    if (!regle && !(doc && doc.texte)) { z.innerHTML = `<span class="lb"><img class="mi-ic" src="look/patch-miette.png" alt=""> La semaine dernière, résumée par Miette</span><span class="nt">Règle Miette (Réglages) pour voir ici le résumé de ce que vous vous êtes dit sur Discord.</span>`; return; }
    z.innerHTML = `<div class="ligne-titre"><span class="lb"><img class="mi-ic" src="look/patch-miette.png" alt=""> La semaine dernière, résumée par Miette</span>
        <span class="nt" style="margin:0 0 0 auto">${enCours ? '<span class="spin"></span>AI en cours de lecture…' : doc && doc.t ? 'mis à jour ' + new Date(doc.t).toLocaleString('fr-CA', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
        ${pret && !enCours ? '<button class="btn xs" id="acResumeMaj" title="Refaire le résumé maintenant">↻</button>' : ''}</div>
      ${doc && doc.texte ? `<p class="ac-texte">${esc(doc.texte)}</p>${(doc.avancement || []).length ? `<span class="eng" style="font-size:9px">Où on en est</span><ul class="ac-afaire">${doc.avancement.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}${(doc.afaire || []).length ? `<span class="eng" style="font-size:9px">Ce qui ressort à faire</span><ul class="ac-afaire">${doc.afaire.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}`
        : `<span class="nt">${!pret ? 'Ajoute la clé Gemini (Réglages) et allume l\'interrupteur AI pour avoir le résumé.' : enCours ? 'Miette lit les messages de la semaine…' : 'Pas encore de résumé : clique ↻ (ou attends la prochaine lecture de Miette).'}</span>`}`;
    const b = $('#acResumeMaj', z); if (b) b.onclick = async () => { b.disabled = true;
      try { await BK.discord.ronde(() => {}, true).catch(() => {}); await BK.discord.resume(true); } catch (e) { z.insertAdjacentHTML('beforeend', `<span class="nt">${esc(e.message)}</span>`); } resume(); };
  }
  // ---------- colonne de droite : la photo du jour ----------
  function colonneDroite() {
    BK.photoDuJour().then(u => { const z = $('#acPhoto', page); if (z) z.innerHTML = u ? `<img src="${u}" alt="Photo du jour">` : ''; }).catch(() => {});
  }
  async function resume() {
    let doc = BK.reglage('accueil.resume', null);
    afficherResume(doc, { enCours: BK.discord.resumeEnCours });                 // tout de suite, la dernière version connue
    const pret = BK.ia && await BK.ia.pret(), d = await BK.discord.config().catch(() => ({}));
    const dist = (await BK.db.liste('veille').catch(() => [])).find(x => x.id === 'resume');
    if (dist && dist.texte && (!doc || (dist.t || 0) > (doc.t || 0))) { doc = dist; BK.regler('accueil.resume', { id: 'resume', texte: dist.texte, afaire: dist.afaire, t: dist.t }); }
    afficherResume(doc, { pret, enCours: BK.discord.resumeEnCours, regle: !!d.jeton });
  }
  window.addEventListener('bk:resume', () => { if (!page.classList.contains('hidden')) resume(); });
  window.addEventListener('bk:ia', () => resume());
});
})();
