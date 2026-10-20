// =====================================================================
// ACCUEIL — « la semaine du groupe »
// Pour l'instant : données d'EXEMPLE (le Drive n'est pas encore relié).
// =====================================================================
BK.etapes = [            // les étapes d'un morceau et leur poids dans le pourcentage
  { id: 'maquette', nom: 'Maquette',   poids: 15 },
  { id: 'enreg',    nom: 'Enreg.',     poids: 25 },
  { id: 'mixage',   nom: 'Mixage',     poids: 20 },
  { id: 'master',   nom: 'Mastering',  poids: 10 },
  { id: 'release',  nom: 'Release',    poids: 10 },
  { id: 'promo',    nom: 'Promo',      poids: 20 },
];
BK.pourcent = m => BK.etapes.reduce((t, e, i) => t + (i < m.fait ? e.poids : i === m.fait ? e.poids * (m.enCours || 0) : 0), 0);

const EXEMPLE = {
  semaine: [
    { jour: 'MAR', heure: '19:00', type: 'Enregistrement', titre: 'Voix lead', morceau: 'Morceau A', c: 'var(--org)' },
    { jour: 'JEU', heure: '18:30', type: 'Répétition',     titre: 'Studio',    morceau: '',          c: 'var(--mus)' },
    { jour: 'SAM', heure: '14:00', type: 'Tournage',       titre: 'Reel #2',   morceau: 'Morceau B', c: 'var(--teal)' },
  ],
  morceaux: [
    { nom: 'Morceau A', fait: 2, enCours: .5 },
    { nom: 'Morceau B', fait: 5, enCours: .3 },
    { nom: 'Morceau C', fait: 2, enCours: .1 },
    { nom: 'Maquette D', fait: 0, enCours: .6 },
  ],
  surveiller: [
    { led: 'red', txt: 'Morceau A : projet Ableton v8 seulement chez Pierre, pas sur le Drive' },
    { led: 'amb', txt: 'Morceau C bloqué au mixage depuis 3 semaines' },
    { led: 'amb', txt: '2 tâches en retard' },
  ],
  ajouts: [
    { quand: 'HIER',   txt: 'Master Morceau B v4', qui: 'Yacine' },
    { quand: '18 OCT', txt: 'Photos shooting (24)', qui: 'Baptiste' },
    { quand: '16 OCT', txt: 'Reel « refrain » Morceau B', qui: 'Pierre' },
  ],
};

// ---------- vraies données (dès qu'il y en a), sinon l'exemple ----------
async function donneesReelles() {
  const morceaux = await BK.db.liste('morceaux'), fichiers = await BK.inv.tous(), taches = await BK.db.liste('taches');
  const evs = BK.agendaTous ? BK.agendaTous() : [];
  if (!morceaux.length && !evs.length && !taches.length) return null;
  const T = BK.typesRdv || {}, maintenant = Date.now(), dans7 = maintenant + 7 * 864e5, auj = new Date().toISOString().slice(0, 10);
  const semaine = evs.filter(e => e.debut >= maintenant - 36e5 && e.debut <= dans7).slice(0, 4).map(e => ({
    jour: e.debut.toLocaleDateString('fr-CA', { weekday: 'short' }).replace('.', '').toUpperCase(), heure: e.journee ? '—' : e.debut.toTimeString().slice(0, 5),
    type: (T[e.type] || { nom: 'Rendez-vous' }).nom, titre: e.titre || '', morceau: e.morceau || '', c: (T[e.type] || { c: 'var(--mus)' }).c }));
  const surveiller = [];
  for (const m of morceaux.filter(m => m.statut !== 'sorti')) {
    const als = fichiers.filter(f => f.type === 'als' && !f.sauvegarde && BK.inv.trouverMorceau(f.nom, morceaux) === m).sort((a, b) => (b.modif || '').localeCompare(a.modif || ''));
    if (als[0] && !/[\\/](my drive|mon drive)[\\/]|^g:/i.test(als[0].chemin) && !als.some(f => f.nom === als[0].nom && /[\\/](my drive|mon drive)[\\/]|^g:/i.test(f.chemin)))
      surveiller.push({ led: 'red', txt: `${m.nom} : dernier projet Ableton (${als[0].nom}) seulement chez ${als[0].pc}, pas sur le Drive` });
    if (m.maj && maintenant - new Date(m.maj) > 21 * 864e5) surveiller.push({ led: 'amb', txt: `${m.nom} : rien n'a bougé depuis 3 semaines (${BK.etapes[Math.min(m.fait || 0, 5)].nom})` });
  }
  const ret = taches.filter(t => !t.fait && t.date && t.date < auj).length;
  if (ret) surveiller.push({ led: 'amb', txt: `${ret} tâche(s) en retard` });
  const ajouts = fichiers.filter(f => !f.sauvegarde && f.modif).sort((a, b) => b.modif.localeCompare(a.modif)).slice(0, 4)
    .map(f => ({ quand: new Date(f.modif).toLocaleDateString('fr-CA', { day: '2-digit', month: 'short' }).replace('.', '').toUpperCase(), txt: f.nom, qui: f.pc }));
  return { semaine, morceaux: morceaux.filter(m => m.statut !== 'sorti').slice(0, 6), surveiller, ajouts };
}

BK.module('accueil', function (page) {
  BK.surOuvrir = BK.surOuvrir || {};
  BK.surOuvrir.accueil = async () => { try { const d = await donneesReelles(); if (d) dessiner(d, false); } catch (e) { console.error(e); } };
  dessiner(EXEMPLE, true);
  function dessiner(d, exemple) {
  const p0 = d.semaine[0];
  $('.hdr .right', page).innerHTML = `
    <div><span class="eng" style="font-size:9px">Prochain rendez-vous</span><span class="vfd" style="width:190px">${p0 ? `${p0.jour} ${p0.heure} · ${p0.type.toUpperCase()}` : 'RIEN DE PRÉVU'}</span></div>
    <div><span class="eng" style="font-size:9px">Morceaux</span><span class="vfd">${String(d.morceaux.length).padStart(2, '0')}</span></div>`;
  const barre = m => {
    const p = Math.round(BK.pourcent(m));
    const cases = BK.etapes.map((e, i) =>
      `<span class="seg-etape ${i < m.fait ? 'fait' : i === m.fait ? 'encours' : ''}" style="flex:${e.poids}" title="${e.nom}">
         <i style="width:${i < m.fait ? 100 : i === m.fait ? Math.round((m.enCours || 0) * 100) : 0}%"></i></span>`).join('');
    const etape = BK.etapes[Math.min(m.fait || 0, BK.etapes.length - 1)].nom; m.fait = m.fait || 0;
    return `<div class="avance">
      <span class="avance-nom">${String(m.nom).replace(/</g, '&lt;')}</span>
      <div class="avance-piste"><div class="etapes">${cases}</div><span class="nt avance-etape">En cours : ${etape}</span></div>
      <span class="vfd avance-pc">${String(p).padStart(3, ' ')} %</span></div>`;
  };

  $('.grid', page).innerHTML = `
    <div class="cols">
      <section class="pane vit" aria-label="Vitrine"><span class="ptitle">① Vitrine</span>
        <div class="box"><div class="ligne-titre"><span class="lb">Cette semaine</span>${exemple ? '<span class="dymo sm">Exemple</span>' : ''}</div>
          <div class="evts">${d.semaine.length ? '' : '<span class="nt">Rien de prévu cette semaine.</span>'}${d.semaine.map(e => `
            <div class="evt"><span class="vfd evt-jour">${e.jour}<br><small>${e.heure}</small></span>
              <span class="nchip" style="--c:${e.c}"></span>
              <div><span class="evt-type">${e.type}</span><span class="nt" style="margin:2px 0 0">${e.titre}${e.morceau ? ' · ' + e.morceau : ''}</span></div></div>`).join('')}
          </div></div>
        <div class="box grow"><span class="lb">Avancement des morceaux</span>
          <div class="avances"><div class="avance legende-l"><span class="avance-nom"></span>
              <div class="avance-piste legende">${BK.etapes.map(e => `<span style="flex:${e.poids}">${e.nom}</span>`).join('')}</div>
              <span class="avance-pc"></span></div>${d.morceaux.map(barre).join('')}</div></div>
      </section>
      <section class="pane reg" aria-label="Réglages"><span class="ptitle">② À surveiller</span>
        <div class="box"><span class="lb">Attention</span>
          <div class="surv">${d.surveiller.length ? '' : '<span class="nt">Tout va bien.</span>'}${d.surveiller.map(s => `<div class="surv-l"><span class="led ${s.led}"></span><span class="nt" style="margin:0">${s.txt}</span></div>`).join('')}</div></div>
        <div class="box grow"><span class="lb">Derniers ajouts</span>
          <div class="surv">${d.ajouts.length ? '' : '<span class="nt">Rien de nouveau.</span>'}${d.ajouts.map(a => `<div class="surv-l"><span class="vfd ajout-q">${a.quand}</span><div><span class="nt" style="margin:0;color:var(--ink)">${a.txt}</span><span class="nt" style="margin:0;font-size:11px">par ${a.qui}</span></div></div>`).join('')}</div></div>
      </section>
    </div>
    <div class="pane abar" aria-label="Barre"><span class="ptitle">③ Barre</span>
      <span class="vfd${exemple ? ' dim' : ''}">${exemple ? 'DONNÉES D\'EXEMPLE · DRIVE PAS ENCORE RELIÉ' : 'À JOUR'}</span>
      <div class="right"><button class="btn" data-va="agenda">Calendrier</button><button class="btn pri" data-va="biblio">Bibliothèque ▶</button></div></div>`;
  $$('[data-va]', page).forEach(b => b.onclick = () => BK.ouvrir(b.dataset.va));
  }
});
