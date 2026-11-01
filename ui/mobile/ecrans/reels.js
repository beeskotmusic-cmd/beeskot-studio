// =====================================================================
// REELS (mobile) — où en est chaque reel : Idée → Audio prêt → Tourné → Monté → Publié.
// Un appui sur une étape la coche (comme sur le PC, onglet Reels › Suivi). C'est la seule chose
// que le téléphone change dans un reel : la fiche est relue juste avant, pour ne rien écraser.
// =====================================================================
(() => {
const { esc } = BKM;
const ETAPES = [['idee', 'Idée'], ['audio', 'Audio prêt'], ['tourne', 'Tourné'], ['monte', 'Monté'], ['publie', 'Publié']];
let voirPublies = false;

BKM.ecran('reels', { nom: 'Reels', ordre: 35, async dessiner(z, plus, frais) {
  const l = (await BKM.liste('reels')).filter(r => r && r.id);
  if (!frais()) return;
  const idx = r => Math.max(0, ETAPES.findIndex(e => e[0] === (r.statut || 'idee')));
  const enCours = l.filter(r => r.statut !== 'publie').sort((a, b) => idx(b) - idx(a) || String(a.titre || '').localeCompare(String(b.titre || '')));
  const publies = l.filter(r => r.statut === 'publie').sort((a, b) => String(b.sortie || '').localeCompare(String(a.sortie || '')));
  const carte = r => `<div class="mo-reel-c">
      <div class="mo-reel-h"><b>${esc(r.titre || r.nom || 'Sans titre')}</b><em>${esc([r.morceau, r.sortie && 'sortie ' + (/^\d{4}-\d{2}-\d{2}$/.test(r.sortie) ? BKM.dateFr(r.sortie, { day: 'numeric', month: 'short' }) : r.sortie)].filter(Boolean).join(' · '))}</em></div>
      <div class="mo-etapes" role="group" aria-label="Étape de ${esc(r.titre || 'ce reel')}">${ETAPES.map(([k, n], i) => `<button class="mo-etape${i <= idx(r) ? ' fait' : ''}${i === idx(r) ? ' ici' : ''}" data-st="${esc(r.id)}|${k}" aria-pressed="${i === idx(r)}">${esc(n)}</button>`).join('')}</div></div>`;
  z.innerHTML = `<h2 class="mo-sous">En cours <em>${enCours.length}</em></h2>
    ${enCours.length ? enCours.map(carte).join('') : '<p class="mo-nt">Aucun reel en cours. On les crée sur le PC (onglet Reels).</p>'}
    ${publies.length ? `<button class="mo-plier" id="moPub"><span class="mo-eng">${voirPublies ? '▾' : '▸'} Publiés <em>${publies.length}</em></span></button>${voirPublies ? publies.map(carte).join('') : ''}` : ''}`;
  const p = z.querySelector('#moPub'); if (p) p.onclick = () => { voirPublies = !voirPublies; BKM.redessiner(); };
  z.querySelectorAll('[data-st]').forEach(b => b.onclick = async () => {
    const [id, k] = b.dataset.st.split('|');
    z.querySelectorAll(`[data-st^="${CSS.escape(id)}|"]`).forEach(x => x.disabled = true);
    try {
      // la fiche la plus récente du Drive (un PC a pu la changer entre-temps) : on ne touche qu'à l'étape
      const frais0 = await BK.drive.liste('reels').catch(() => ({})), r = { ...(frais0[id] || l.find(x => x.id === id)) };
      if (!r.id) throw new Error('reel introuvable');
      const i = ETAPES.findIndex(e => e[0] === k);
      r.statut = (r.statut || 'idee') === k ? (ETAPES[Math.max(0, i - 1)] || ETAPES[0])[0] : k;     // ré-appuyer sur l'étape actuelle la décoche
      await BK.db.ecrire('reels', r);
      BKM.msg((ETAPES.find(e => e[0] === r.statut) || ETAPES[0])[1]);
    } catch (e) { BKM.msg('Pas enregistré : ' + (e.message || e)); }
    BKM.redessiner();
  });
} });
})();
