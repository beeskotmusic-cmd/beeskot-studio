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
      const e = BK.mini.actuel; if (e && e.ext && e !== s && e.joue()) e.pause();       // (aussi Écoute, Reels Audio…)
      BK.mini.actuel = s; BK.mini.cache = false; BK.mini.maj();
    });
    ['pause', 'ended', 'timeupdate', 'durationchange'].forEach(t => el.addEventListener(t, () => { if (BK.mini.actuel === s) BK.mini.maj(); }));
  },
  // ---------- un lecteur « maison » (Écoute, Reels Audio : du son calculé, pas un fichier) ----------
  // src = { page, titre, temps(), duree(), joue(), jouer(), pause(), aller(t) } — on l'affiche en bas, et il coupe la Bibliothèque
  lance(src) {
    src.ext = true;
    for (const x of BK.mini.sources) if (!x.el.paused) x.el.pause();
    const e = BK.mini.actuel; if (e && e.ext && e !== src && e.joue()) e.pause();
    BK.mini.actuel = src; BK.mini.cache = false; BK.mini.maj();
    clearInterval(BK.mini._tic); BK.mini._tic = setInterval(() => { if (BK.mini.actuel !== src) return clearInterval(BK.mini._tic); BK.mini.maj(); if (!src.joue()) clearInterval(BK.mini._tic); }, 250);
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
    // un lecteur maison se lit comme un <audio>
    const a = !s ? null : s.ext ? { paused: !s.joue(), currentTime: s.temps() || 0, duration: s.duree() || 0, currentSrc: 'x' } : s.el;
    const montrer = s && !BK.mini.cache && a.currentSrc && (a.duration || 0) > 0;
    z.classList.toggle('hidden', !montrer); if (!montrer) return;
    const d = a.duration || 0, t = a.currentTime || 0, T = BK.audio ? BK.audio.temps : x => Math.round(x) + ' s';
    const nomPage = ((BK.onglets || []).find(m => m.id === s.page) || {}).titre || s.page;
    if (!z.dataset.pret) {
      z.dataset.pret = '1';
      z.innerHTML = `<span class="mini-titre"></span><div class="mini-barre" title="Clique pour aller à cet endroit"><div class="mini-plein"></div></div><span class="mini-t mono"></span>
        <span class="mini-vol" title="Volume"><span class="mini-hp" data-mi="muet">🔊</span><span class="mini-equerre"><span class="mini-niveau"></span><input type="range" min="0" max="1" step="0.01" class="mini-range"></span></span>
        <button class="btn xs pri mini-jouer" data-mi="jouer">▶</button><button class="btn xs" data-mi="page"></button><button class="btn xs" data-mi="fermer" title="Arrêter">✕</button>`;
      z.addEventListener('click', e => { const b = e.target.closest('[data-mi]'), s = BK.mini.actuel; if (!s) return;
        if (s.ext) { const k = b && b.dataset.mi;                        // Écoute, Reels Audio…
          if (!b) { const barre = e.target.closest('.mini-barre'), d = s.duree(); if (barre && d && s.aller) { const r = barre.getBoundingClientRect(); s.aller((e.clientX - r.left) / r.width * d); } }
          else if (k === 'jouer') { s.joue() ? s.pause() : s.jouer(); }
          else if (k === 'page') BK.ouvrir(s.page);
          else if (k === 'fermer') { if (s.joue()) s.pause(); BK.mini.cache = true; }
          else if (k === 'muet') { const v = BK.reglage('mini.volume', 1); BK.mini.volume(v > 0 ? 0 : (BK.mini.avantMuet || 1)); if (v > 0) BK.mini.avantMuet = v; }
          setTimeout(() => BK.mini.maj(), 60); return; }
        const a = s.el;
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
