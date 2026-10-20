// =====================================================================
// MINI-LECTEUR — tout en bas de la fenêtre : ce qui joue en ce moment (Bibliothèque,
// Assistant audio…), visible partout. Pause, cliquer dans la barre pour se déplacer, aller à la page.
// Un seul son à la fois dans tout le logiciel.
// =====================================================================
BK.mini = {
  actuel: null, sources: [],
  suivre(el, { page, titre }) {
    const s = { el, page, titre }; BK.mini.sources.push(s); el.volume = BK.reglage('mini.volume', 1);
    el.addEventListener('play', () => {
      for (const x of BK.mini.sources) if (x !== s && !x.el.paused) x.el.pause();      // un seul son à la fois
      BK.mini.actuel = s; BK.mini.cache = false; BK.mini.maj();
    });
    ['pause', 'ended', 'timeupdate', 'durationchange'].forEach(t => el.addEventListener(t, () => { if (BK.mini.actuel === s) BK.mini.maj(); }));
  },
  // le volume : un petit triangle comme sur VLC, il vaut pour tous les lecteurs du logiciel
  volume(v) {
    v = Math.max(0, Math.min(1, v)); BK.regler('mini.volume', v);
    for (const x of BK.mini.sources) x.el.volume = v;
    const z = document.getElementById('bkMini'); if (!z) return;
    const r = z.querySelector('.mini-range'); if (r && +r.value !== v) r.value = v;
    const n = z.querySelector('.mini-niveau'); if (n) n.style.width = (v * 100) + '%';
    const h = z.querySelector('.mini-hp'); if (h) h.textContent = v === 0 ? '🔇' : v < 0.5 ? '🔉' : '🔊';
  },
  maj() {
    const z = document.getElementById('bkMini'), s = BK.mini.actuel; if (!z) return;
    const montrer = s && !BK.mini.cache && s.el.currentSrc && (s.el.duration || 0) > 0;
    z.classList.toggle('hidden', !montrer); if (!montrer) return;
    const a = s.el, d = a.duration || 0, t = a.currentTime || 0, T = BK.audio ? BK.audio.temps : x => Math.round(x) + ' s';
    const nomPage = ((BK.onglets || []).find(m => m.id === s.page) || {}).titre || s.page;
    if (!z.dataset.pret) {
      z.dataset.pret = '1';
      z.innerHTML = `<span class="mini-titre"></span><div class="mini-barre" title="Clique pour aller à cet endroit"><div class="mini-plein"></div></div><span class="mini-t mono"></span>
        <span class="mini-vol" title="Volume"><span class="mini-hp" data-mi="muet">🔊</span><span class="mini-equerre"><span class="mini-niveau"></span><input type="range" min="0" max="1" step="0.01" class="mini-range"></span></span>
        <button class="btn xs pri mini-jouer" data-mi="jouer">▶</button><button class="btn xs" data-mi="page"></button><button class="btn xs" data-mi="fermer" title="Arrêter">✕</button>`;
      z.addEventListener('click', e => { const b = e.target.closest('[data-mi]'), s = BK.mini.actuel; if (!s) return; const a = s.el;
        if (!b) { const barre = e.target.closest('.mini-barre'); if (barre && a.duration) { const r = barre.getBoundingClientRect(); a.currentTime = (e.clientX - r.left) / r.width * a.duration; } return; }
        const k = b.dataset.mi;
        if (k === 'jouer') a.paused ? a.play() : a.pause();
        if (k === 'moins') a.currentTime = Math.max(0, a.currentTime - 10);
        if (k === 'plus') a.currentTime = Math.min(a.duration || 0, a.currentTime + 10);
        if (k === 'page') BK.ouvrir(s.page);
        if (k === 'fermer') { a.pause(); BK.mini.cache = true; }
        if (k === 'muet') { const v = BK.reglage('mini.volume', 1); BK.mini.volume(v > 0 ? 0 : (BK.mini.avantMuet || 1)); if (v > 0) BK.mini.avantMuet = v; }
        BK.mini.maj(); });
    }
    if (!z.dataset.vol) { z.dataset.vol = '1'; const r = z.querySelector('.mini-range'); r.value = BK.reglage('mini.volume', 1); r.oninput = () => BK.mini.volume(+r.value); BK.mini.volume(+r.value); }
    z.querySelector('.mini-jouer').textContent = a.paused ? '▶' : '❚❚';
    z.querySelector('.mini-titre').textContent = (typeof s.titre === 'function' ? s.titre() : s.titre) || '';
    z.querySelector('.mini-plein').style.width = (d ? t / d * 100 : 0) + '%';
    z.querySelector('.mini-t').textContent = `${T(t).replace(/\.\d$/, '')} / ${T(d).replace(/\.\d$/, '')}`;
    z.querySelector('[data-mi="page"]').textContent = '↗ ' + nomPage;
  },
};
