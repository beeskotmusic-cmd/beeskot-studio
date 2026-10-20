// =====================================================================
// ACCUEIL — NEXT (le prochain rendez-vous) + À faire (toutes les tâches).
// Sur le côté : avancement des morceaux, alertes, et « Pour démarrer ».
// =====================================================================
BK.etapes = [            // les étapes d'un morceau et leur poids dans le pourcentage
  { id: 'maquette', nom: 'Maquette',   poids: 15 },
  { id: 'enreg',    nom: 'Enreg.',     poids: 25 },
  { id: 'mixage',   nom: 'Mixage',     poids: 20 },
  { id: 'master',   nom: 'Mastering',  poids: 10 },
  { id: 'release',  nom: 'Release',    poids: 10 },
  { id: 'promo',    nom: 'Promo',      poids: 20 },
];
BK.pourcent = m => BK.etapes.reduce((t, e, i) => t + (i < (m.fait || 0) ? e.poids : i === (m.fait || 0) ? e.poids * (m.enCours || 0) : 0), 0);

(() => {
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SUR_DRIVE = /[\\/](my drive|mon drive)[\\/]|^g:/i;

async function donnees() {
  const morceaux = await BK.db.liste('morceaux'), fichiers = await BK.inv.tous(), taches = await BK.db.liste('taches');
  const evs = BK.agendaTous ? BK.agendaTous() : [];
  const maintenant = Date.now(), auj = new Date().toISOString().slice(0, 10);
  const next = evs.find(e => e.debut >= maintenant - 36e5) || null;
  const afaire = taches.filter(t => !t.fait).sort((a, b) => (a.date || '9').localeCompare(b.date || '9'));
  const alertes = [];
  for (const m of morceaux.filter(m => m.statut !== 'sorti')) {
    const als = fichiers.filter(f => f.type === 'als' && !f.sauvegarde && BK.inv.trouverMorceau(f.nom, morceaux) === m).sort((a, b) => (b.modif || '').localeCompare(a.modif || ''));
    if (als[0] && !SUR_DRIVE.test(als[0].chemin) && !als.some(f => f.nom === als[0].nom && SUR_DRIVE.test(f.chemin)))
      alertes.push({ led: 'red', txt: `${m.nom} : dernier projet Ableton seulement chez ${als[0].pc}, pas sur le Drive` });
    if (m.maj && maintenant - new Date(m.maj) > 21 * 864e5) alertes.push({ led: 'amb', txt: `${m.nom} : rien n'a bougé depuis 3 semaines` });
  }
  const ret = afaire.filter(t => t.date && t.date < auj).length;
  if (ret) alertes.push({ led: 'amb', txt: `${ret} tâche(s) en retard` });
  const props = (await BK.db.liste('propositions')).filter(p => p.statut === 'attente').length;
  if (props) alertes.unshift({ led: 'amb', txt: `Miette a ${props} proposition(s) à valider (Renfort AI)` });
  const demarrer = [
    { ok: !!BK.reglage('dernierScan', ''), txt: 'Scanner ce PC', va: 'biblio' },
    { ok: morceaux.length > BK.FICHES_DEPART.length, txt: 'Créer les fiches de vos morceaux', va: 'biblio' },
    { ok: !!BK.ableton.relie, txt: 'Relier Ableton', va: 'mixprep' },
    { ok: false, txt: 'Relier le Drive BEESKOT (bientôt)', va: 'reglages' },
  ];
  return { next, afaire, morceaux: morceaux.filter(m => m.statut !== 'sorti'), alertes, demarrer, auj };
}

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
      return `<div class="avance mini"><span class="avance-nom">${esc(m.nom)}</span>
        <div class="avance-piste"><div class="etapes">${BK.etapes.map((e, i) => `<span class="seg-etape ${i < (m.fait || 0) ? 'fait' : i === (m.fait || 0) ? 'encours' : ''}" style="flex:${e.poids}"><i style="width:${i < (m.fait || 0) ? 100 : 0}%"></i></span>`).join('')}</div></div>
        <span class="vfd avance-pc">${p} %</span></div>`; };
    const toutFait = d.demarrer.slice(0, 3).every(x => x.ok);
    $('.grid', page).innerHTML = `
      <div class="cols">
        <section class="pane vit" aria-label="Vitrine"><span class="ptitle">① Vitrine</span>
          <div class="box next"><span class="lb">Next</span>
            ${n ? `<div class="next-l"><span class="nchip" style="--c:${t.c}"></span><span class="vfd next-q">${quand}</span>
              <div><span class="evt-type">${esc(t.nom)}</span><span class="nt" style="margin:2px 0 0;font-size:14px;color:var(--ink)">${esc(n.titre || '')}${n.morceau ? ' · ' + esc(n.morceau) : ''}</span></div></div>`
              : `<span class="nt">Aucun rendez-vous prévu. <a href="#" data-va="agenda">Ajouter dans le Calendrier</a></span>`}</div>
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
      <div class="pane abar" aria-label="Barre"><span class="ptitle">③ Barre</span>
        <span class="vfd">${new Date().toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}</span>
        <div class="right"><button class="btn" data-va="agenda">Calendrier</button><button class="btn pri" data-va="biblio">Bibliothèque ▶</button></div></div>`;
    $$('[data-va]', page).forEach(b => b.onclick = e => { e.preventDefault(); BK.ouvrir(b.dataset.va); });
    $$('.af-l .ta-case', page).forEach(b => b.onclick = async () => {
      const x = d.afaire.find(t => t.id === b.dataset.id); x.fait = true; await BK.db.ecrire('taches', x);
      BK.tachesRecharger && BK.tachesRecharger(); BK.surOuvrir.accueil(); });
  }
});
})();
