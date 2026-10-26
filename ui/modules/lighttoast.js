// =====================================================================
// LIGHT TOAST — TOAST by Beeskot (musique → vidéo pour les bandes LED) dans un onglet.
// Le programme est dans ui/lighttoast/toast.html (fabriqué par lighttoast-outils/adapter.py à partir
// du TOAST d'origine) : pour le mettre à jour, remplacer toast-original.html et relancer adapter.py.
// Ici : la page, les compteurs de l'en-tête, et le pont « enregistrer dans le Drive ».
// Drive : BEESKOT Studio / Light Toast / Projets (.json)  et  Vidéos (.mp4)
// =====================================================================
(() => {
// le pont : TOAST (dans le cadre) l'appelle par parent.BK.toast
BK.toast = {
  async dossier(sous) { const base = await BK.drive.dossier('Light Toast', await BK.drive.racine()); return BK.drive.dossier(sous, base); },
  async envoyer(blob, nom, sous) { if (!BK.drive.relie()) throw new Error('Drive non relié (Réglages)'); return BK.drive.envoyerBlob(blob, nom, await this.dossier(sous)); },
  async lister(sous) { if (!BK.drive.relie()) throw new Error('Drive non relié (Réglages)'); const d = await this.dossier(sous);
    const r = await (await BK.drive.api('/files?' + new URLSearchParams({ q: `${BK.drive.q(d)} in parents and trashed=false`, fields: 'files(id,name,modifiedTime)', orderBy: 'modifiedTime desc', pageSize: '100' }))).json();
    return r.files || []; },
  async lire(id) { return BK.drive.api('/files/' + id + '?alt=media'); },
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
  f.addEventListener('load', () => { compteurs(); clearInterval(obs); obs = setInterval(() => { if (!page.classList.contains('hidden')) compteurs(); }, 1500); });
  BK.surOuvrir = BK.surOuvrir || {};
  BK.surOuvrir.lighttoast = () => { if (!f.getAttribute('src')) f.src = 'lighttoast/toast.html'; };   // chargé à la première ouverture seulement : rien ne pèse au démarrage
});
})();
