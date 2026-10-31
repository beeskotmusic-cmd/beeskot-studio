// TO-DO LIST (mobile) — les tâches de chacun ; cocher / décocher (c'est tout ce que le téléphone change ici)
(() => {
const { esc, msg, moi, couleur, auj } = BKM;
const GROUPE = 'BEESKOT', ANCIENS = { 'Dari': 'Yacine', 'Tout le groupe': GROUPE };
const gens = t => [t.qui, ...(t.aussi || [])].filter(Boolean).map(q => ANCIENS[q] || q);
let filtre = BK.reglage('mobile.todo', 'moi'), faitesOuvertes = false;

BKM.ecran('taches', { nom: 'To-do list', ordre: 30, async dessiner(z, plus, frais) {
  const T = await BKM.liste('taches'); if (!frais()) return;
  const qui = BK.reglage('nomPc', ''), a = auj();
  const tri = (x, y) => (x.date || '9999').localeCompare(y.date || '9999') || (x.ordre || 0) - (y.ordre || 0);
  const pourFiltre = t => filtre === 'tout' ? true : filtre === 'moi' ? (qui ? gens(t).includes(qui) || gens(t).includes(GROUPE) : true) : !gens(t).length;
  const afaire = T.filter(t => !t.fait && pourFiltre(t)).sort(tri);
  const faites = T.filter(t => t.fait && pourFiltre(t)).sort((x, y) => String(y.faitLe || '').localeCompare(String(x.faitLe || ''))).slice(0, 30);
  const carte = t => `<div class="mo-tache${t.fait ? ' faite' : ''}${!t.fait && t.date && t.date < a ? ' retard' : ''}">
      <button class="mo-case${t.fait ? ' on' : ''}" data-case="${esc(t.id)}" aria-label="Fait">${t.fait ? '✓' : ''}</button>
      <div class="mo-t-txt"><span>${esc(t.texte)}</span>
        <em>${gens(t).map(g => `<i style="--pc:${couleur(g)}">${esc(g)}</i>`).join('') || '<i>en vrac</i>'}${t.morceau ? ' · ' + esc(t.morceau) : ''}${t.date ? ' · ' + (t.date < a && !t.fait ? 'en retard · ' : '') + esc(BKM.dateFr(t.date, { weekday: 'short', day: 'numeric', month: 'short' })) : ''}</em></div></div>`;
  z.innerHTML = `
    <div class="mo-seg">${[['moi', qui ? 'Pour ' + qui : 'Pour moi'], ['vrac', 'En vrac'], ['tout', 'Tout le monde']].map(([k, n]) => `<button class="${filtre === k ? 'on' : ''}" data-f="${k}">${esc(n)}</button>`).join('')}</div>
    ${!qui && filtre === 'moi' ? '<p class="mo-alerte">Choisis ton nom dans Réglages pour ne voir que tes tâches.</p>' : ''}
    <h2 class="mo-sous">À faire <em>${afaire.length}</em></h2>
    ${afaire.map(carte).join('') || '<p class="mo-nt">Rien à faire ici. Profite.</p>'}
    ${faites.length ? `<button class="mo-sous mo-plier" id="moFaites">${faitesOuvertes ? '▾' : '▸'} Déjà fait <em>${faites.length}</em></button>${faitesOuvertes ? faites.map(carte).join('') : ''}` : ''}
    <p class="mo-nt">Ajouter, répartir ou modifier les tâches : sur le PC.</p>`;
  z.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filtre = b.dataset.f; BK.regler('mobile.todo', filtre); BKM.redessiner(); });
  const f = z.querySelector('#moFaites'); if (f) f.onclick = () => { faitesOuvertes = !faitesOuvertes; BKM.redessiner(); };
  z.querySelectorAll('[data-case]').forEach(b => b.onclick = async () => {
    const t = T.find(x => x.id === b.dataset.case); if (!t) return;
    t.fait = !t.fait;
    if (t.fait) { t.faitLe = new Date().toISOString(); t.faitPar = moi() + ' (téléphone)'; } else { delete t.faitLe; delete t.faitPar; }
    // à l'instant : la case, puis la ligne qui s'en va (le Drive est écrit pendant ce temps)
    b.classList.toggle('on', t.fait); b.textContent = t.fait ? '✓' : ''; b.disabled = true;
    const ligne = b.closest('.mo-tache'); ligne.classList.add('part');
    const ecrit = BK.db.ecrire('taches', t).then(() => msg(t.fait ? 'Bravo !' : 'Remise à faire')).catch(e => msg('Pas enregistré : ' + (e.message || e)));
    await new Promise(r => setTimeout(r, 180)); await ecrit;
    BKM.redessiner();
  });
} });
})();
