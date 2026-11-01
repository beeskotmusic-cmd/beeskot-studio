// =====================================================================
// AUJOURD'HUI (mobile) — l'écran d'ouverture : les prochains rendez-vous, mes tâches, la prochaine sortie
// et les retours à régler. Chaque carte mène à l'écran complet. Lecture seule.
// =====================================================================
(() => {
const { esc, auj } = BKM;
const ANCIENS = { 'Dari': 'Yacine', 'Tout le groupe': 'BEESKOT' };
const gens = t => [...new Set([t.qui, ...(t.aussi || [])].filter(Boolean).map(q => ANCIENS[q] || q))];

BKM.ecran('accueil', { nom: 'Aujourd\'hui', ordre: 5, async dessiner(z, plus, frais) {
  const [evs, ts, ms, nm, nv, tours] = await Promise.all(['evenements', 'taches', 'morceaux', 'notesmix', 'notesvid', 'tournages'].map(c => BKM.liste(c).catch(() => [])));
  if (!frais()) return;
  const a = auj(), qui = BK.reglage('nomPc', '');
  const rdv = [...evs.filter(e => e.date >= a).map(e => ({ d: e.date, h: e.heure || '', t: e.titre || 'Rendez-vous', s: e.lieu || e.morceau || '' })),
    ...tours.filter(t => t.niveau === 'tournage' && t.date >= a && !t.fini).map(t => ({ d: t.date, h: t.heure || '', t: '🎬 ' + (t.titre || 'Tournage'), s: t.lieu || '' }))]
    .sort((x, y) => (x.d + x.h).localeCompare(y.d + y.h)).slice(0, 3);
  const mes = ts.filter(t => !t.fait && (!qui || gens(t).includes(qui) || gens(t).includes('BEESKOT'))).sort((x, y) => String(x.date || '9').localeCompare(String(y.date || '9'))).slice(0, 4);
  const sortie = ms.filter(m => m.statut === 'prochaine' || (m.sortie && m.sortie >= a && m.statut !== 'sorti')).sort((x, y) => String(x.sortie || '9').localeCompare(String(y.sortie || '9')))[0];
  const aRegler = nm.filter(n => n && !n.regle).length + nv.filter(n => n && !n.regle).length;
  const jour = d => d === a ? 'Aujourd\'hui' : BKM.dateFr(d, { weekday: 'short', day: 'numeric', month: 'short' });
  const carte = (ecran, titre, corps) => `<button class="mo-reel-c mo-acc" data-va="${ecran}"><div class="mo-reel-h"><b>${titre}</b><em>›</em></div>${corps}</button>`;
  z.innerHTML = (qui ? '' : '<p class="mo-alerte">Choisis ton nom dans Réglages pour voir tes tâches.</p>')
    + carte('agenda', '📅 Prochains rendez-vous', rdv.length ? rdv.map(r => `<p class="mo-nt"><b>${esc(jour(r.d))}${r.h ? ' · ' + esc(r.h.replace(':', ' h ')) : ''}</b> — ${esc(r.t)}${r.s ? ' <i>(' + esc(r.s) + ')</i>' : ''}</p>`).join('') : '<p class="mo-nt">Rien de prévu.</p>')
    + carte('taches', '✅ ' + (qui ? 'Mes tâches' : 'Tâches'), mes.length ? mes.map(t => `<p class="mo-nt">• ${esc(t.texte)}${t.date ? ' <i>(' + (t.date < a ? 'en retard' : esc(jour(t.date))) + ')</i>' : ''}</p>`).join('') : '<p class="mo-nt">Rien à faire 👌</p>')
    + (sortie ? carte('biblio', '⭐ Prochaine sortie', `<p class="mo-nt"><b>${esc(sortie.nom)}</b>${sortie.sortie ? ' — ' + esc(jour(sortie.sortie)) : ''}</p>`) : '')
    + (aRegler ? carte(nm.some(n => n && !n.regle) ? 'ecoute' : 'notesvid', '💬 Retours à régler', `<p class="mo-nt">${aRegler} note${aRegler > 1 ? 's' : ''} pas encore réglée${aRegler > 1 ? 's' : ''}.</p>`) : '');
  z.querySelectorAll('[data-va]').forEach(b => b.onclick = () => BKM.ouvrir(b.dataset.va));
} });
})();
