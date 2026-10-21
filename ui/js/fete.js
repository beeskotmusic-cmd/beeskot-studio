// =====================================================================
// ON FÊTE LES SORTIES 🎉 — quand un morceau passe en « Sorti », chaque PC
// le fête une fois (même s'il était éteint à ce moment-là).
// La toute première fois, on se souvient juste de ce qui est déjà sorti (pas de fête pour le passé).
// =====================================================================
BK.fete = {
  enCours: false,
  async verifier() {
    if (BK.fete.enCours) return;
    let ms = []; try { ms = await BK.db.liste('morceaux'); } catch (e) { return; }
    const sortis = ms.filter(m => m.statut === 'sorti').map(m => m.id);
    const vus = BK.reglage('fete.vus', null);
    if (vus === null) { BK.regler('fete.vus', sortis); return; }       // premier lancement : rien à fêter
    const neufs = ms.filter(m => m.statut === 'sorti' && !vus.includes(m.id));
    if (!neufs.length) return;
    BK.regler('fete.vus', [...new Set([...vus, ...sortis])]);
    for (const m of neufs) await BK.fete.montrer(m);
  },
  montrer(m) {
    return new Promise(ok => {
      BK.fete.enCours = true;
      const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const v = document.createElement('div'); v.className = 'voile fete-voile';
      const couleurs = ['#ffb23e', '#e08a2e', '#d9b67a', '#b23a2a', '#2f7377', '#6c9a52', '#f3cf62'];
      const confettis = Array.from({ length: 70 }, (_, i) => `<i style="left:${Math.random() * 100}%;background:${couleurs[i % couleurs.length]};animation-delay:${(Math.random() * 1.6).toFixed(2)}s;animation-duration:${(2.6 + Math.random() * 2).toFixed(2)}s;transform:rotate(${Math.round(Math.random() * 360)}deg)"></i>`).join('');
      v.innerHTML = `<div class="fete-confettis">${confettis}</div>
        <div class="fete-box"><img class="fete-biscotte" src="look/patch-biscotte.png" alt="">
          ${m.photo ? `<span class="fete-photo"${BK.img ? BK.img.bg(m.photo) : ''}></span>` : ''}
          <span class="dymo">C'est sorti !</span>
          <b class="fete-nom">« ${esc(m.nom)} »</b>
          <span class="nt">est dehors. Bravo BEESKOT 🍞</span>
          <button class="btn pri" data-f="ok">🎉 Trop bien</button></div>`;
      document.body.appendChild(v);
      const fin = () => { v.remove(); BK.fete.enCours = false; ok(); };
      v.querySelector('[data-f="ok"]').onclick = fin; v.addEventListener('click', e => { if (e.target === v) fin(); });
      setTimeout(() => v.isConnected && fin(), 12000);
    });
  },
};
// au démarrage (un peu après), puis quand une fiche de morceau change (ici ou sur un autre PC)
setTimeout(() => BK.fete.verifier(), 6000);
window.addEventListener('bk:change', e => { if (e.detail && e.detail.col === 'morceaux') setTimeout(() => BK.fete.verifier(), 800); });
window.addEventListener('bk:distant', e => { if (e.detail && (e.detail.cols || []).includes('morceaux')) setTimeout(() => BK.fete.verifier(), 800); });
