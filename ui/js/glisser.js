// =====================================================================
// GLISSER UN MÉDIA D'UN ONGLET À L'AUTRE
// Dans Médias, on attrape une photo / vidéo → on la garde au-dessus d'un onglet du menu (½ s) → l'onglet s'ouvre
// → on la lâche là où on peut importer (Social Photo, Reels Vidéo, Tournages…). Rien n'est déplacé dans Médias.
// Pendant le glisser, les onglets qui ne prennent pas de média sont grisés.
// =====================================================================
BK.glisse = {
  items: [],                                       // [{ id, nom, mime, dc }] : ce qu'on tient
  PREND: ['medias', 'postvis', 'reelvis', 'tournage', 'ecoute', 'reels', 'suivi', 'biblio'],
  actif: () => BK.glisse.items.length > 0,
  debut(items) {
    BK.glisse.items = items || [];
    document.body.classList.add('glisse-media');
    for (const t of document.querySelectorAll('#nav .tab[data-p]')) t.classList.toggle('depot-ok', BK.glisse.PREND.includes(t.dataset.p));
  },
  fin() { BK.glisse.items = []; document.body.classList.remove('glisse-media'); clearTimeout(BK.glisse._t); BK.glisse._sur = null; },
  // les vrais fichiers (téléchargés une fois) pour les outils qui en ont besoin (Social Photo, Reels Vidéo)
  async fichiers(msg = () => {}) {
    const out = [], l = BK.glisse.items.slice(); let k = 0;
    for (const x of l) { k++; msg(`Récupération ${k}/${l.length}…`);
      try { const r = x.dc ? await BK.discord.fetch(x.dc.url) : await BK.drive.api(`/files/${x.id}?alt=media`); if (!r.ok) throw 0;
        const b = await r.blob(); out.push(new File([b], x.nom || 'media', { type: b.type || x.mime || '' })); } catch (e) { console.warn('glisser', e); } }
    return out;
  },
};
// au-dessus d'un onglet du menu : il s'ouvre après ½ seconde
document.addEventListener('dragover', e => {
  if (!BK.glisse.actif()) return;
  const t = e.target.closest && e.target.closest('#nav .tab[data-p]');
  if (!t || !BK.glisse.PREND.includes(t.dataset.p)) { if (BK.glisse._sur && BK.glisse._sur !== t) { clearTimeout(BK.glisse._t); BK.glisse._sur = null; } return; }
  e.preventDefault();
  if (BK.glisse._sur === t) return;
  BK.glisse._sur = t; clearTimeout(BK.glisse._t);
  BK.glisse._t = setTimeout(() => { if (BK.glisse._sur === t) BK.ouvrir(t.dataset.p); }, 550);
}, true);
document.addEventListener('dragend', () => BK.glisse.fin(), true);
document.addEventListener('drop', () => setTimeout(() => BK.glisse.fin(), 0));
