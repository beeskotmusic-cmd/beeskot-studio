// =====================================================================
// MINI-LECTEUR — tout en bas de la fenêtre : ce qui joue en ce moment (Bibliothèque,
// Assistant audio…), visible partout. Pause, reculer / avancer, aller à la page.
// Un seul son à la fois dans tout le logiciel.
// =====================================================================
BK.mini = {
  actuel: null, sources: [],
  suivre(el, { page, titre }) {
    const s = { el, page, titre }; BK.mini.sources.push(s);
    el.addEventListener('play', () => {
      for (const x of BK.mini.sources) if (x !== s && !x.el.paused) x.el.pause();      // un seul son à la fois
      BK.mini.actuel = s; BK.mini.cache = false; BK.mini.maj();
    });
    ['pause', 'ended', 'timeupdate', 'durationchange'].forEach(t => el.addEventListener(t, () => { if (BK.mini.actuel === s) BK.mini.maj(); }));
  },
  maj() {
    const z = document.getElementById('bkMini'), s = BK.mini.actuel; if (!z) return;
    const montrer = s && !BK.mini.cache && s.el.currentSrc && (s.el.duration || 0) > 0;
    z.classList.toggle('hidden', !montrer); if (!montrer) return;
    const a = s.el, d = a.duration || 0, t = a.currentTime || 0, T = BK.audio ? BK.audio.temps : x => Math.round(x) + ' s';
    const nomPage = ((BK.onglets || []).find(m => m.id === s.page) || {}).titre || s.page;
    if (!z.dataset.pret) {
      z.dataset.pret = '1';
      z.innerHTML = `<button class="btn xs" data-mi="moins" title="Reculer de 10 s">« 10</button><button class="btn xs pri mini-jouer" data-mi="jouer">▶</button><button class="btn xs" data-mi="plus" title="Avancer de 10 s">10 »</button>
        <span class="mini-titre"></span><div class="mini-barre" title="Clique pour aller à cet endroit"><div class="mini-plein"></div></div><span class="mini-t mono"></span>
        <button class="btn xs" data-mi="page"></button><button class="btn xs" data-mi="fermer" title="Arrêter">✕</button>`;
      z.addEventListener('click', e => { const b = e.target.closest('[data-mi]'), s = BK.mini.actuel; if (!s) return; const a = s.el;
        if (!b) { const barre = e.target.closest('.mini-barre'); if (barre && a.duration) { const r = barre.getBoundingClientRect(); a.currentTime = (e.clientX - r.left) / r.width * a.duration; } return; }
        const k = b.dataset.mi;
        if (k === 'jouer') a.paused ? a.play() : a.pause();
        if (k === 'moins') a.currentTime = Math.max(0, a.currentTime - 10);
        if (k === 'plus') a.currentTime = Math.min(a.duration || 0, a.currentTime + 10);
        if (k === 'page') BK.ouvrir(s.page);
        if (k === 'fermer') { a.pause(); BK.mini.cache = true; }
        BK.mini.maj(); });
    }
    z.querySelector('.mini-jouer').textContent = a.paused ? '▶' : '❚❚';
    z.querySelector('.mini-titre').textContent = (typeof s.titre === 'function' ? s.titre() : s.titre) || '';
    z.querySelector('.mini-plein').style.width = (d ? t / d * 100 : 0) + '%';
    z.querySelector('.mini-t').textContent = `${T(t).replace(/\.\d$/, '')} / ${T(d).replace(/\.\d$/, '')}`;
    z.querySelector('[data-mi="page"]').textContent = '↗ ' + nomPage;
  },
};
