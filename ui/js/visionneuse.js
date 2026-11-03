// =====================================================================
// VISIONNEUSE — clic sur une image insérée (tenue, moodboard, asset, plan…) : elle s'ouvre en grand.
// Molette = zoom vers la souris · glisser = déplacer · double-clic = taille normale · ← → = image d'à côté · Échap / clic à côté = fermer.
// Utilisation : BK.voir(url) ou BK.voir([urls], index). Pour brancher une image sans code : lui mettre la classe « zoomable ».
// =====================================================================
BK.voir = (liste, i = 0) => {
  liste = [].concat(liste).filter(Boolean); if (!liste.length) return;
  document.querySelectorAll('.voir-voile').forEach(x => x.remove());
  const v = document.createElement('div'); v.className = 'voile voir-voile';
  v.innerHTML = '<img class="voir-img" draggable="false"><button class="voir-x" title="Fermer (Échap)">✕</button><button class="voir-p" title="Précédente (←)">‹</button><button class="voir-s" title="Suivante (→)">›</button><span class="voir-n"></span>';
  document.body.appendChild(v);
  const im = v.querySelector('img'), n = v.querySelector('.voir-n'); let k = i, z = 1, x = 0, y = 0;
  const pose = () => { im.style.transform = `translate(${x}px,${y}px) scale(${z})`; im.style.cursor = z > 1 ? 'grab' : 'zoom-in'; };
  const montre = () => { z = 1; x = y = 0; im.src = liste[k]; n.textContent = liste.length > 1 ? (k + 1) + ' / ' + liste.length : ''; v.querySelector('.voir-p').hidden = v.querySelector('.voir-s').hidden = liste.length < 2; pose(); };
  const ferme = () => { document.removeEventListener('keydown', touche, true); v.remove(); };
  const va = d => { k = (k + d + liste.length) % liste.length; montre(); };
  const touche = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); ferme(); } else if (e.key === 'ArrowLeft' && liste.length > 1) { e.preventDefault(); va(-1); } else if (e.key === 'ArrowRight' && liste.length > 1) { e.preventDefault(); va(1); } };
  document.addEventListener('keydown', touche, true);
  v.addEventListener('wheel', e => { e.preventDefault(); const r = im.getBoundingClientRect(), cx = e.clientX - (r.left + r.width / 2), cy = e.clientY - (r.top + r.height / 2), f = e.deltaY < 0 ? 1.15 : 1 / 1.15, z2 = Math.max(1, Math.min(12, z * f)), q = z2 / z;
    x = z2 === 1 ? 0 : x - cx * (q - 1); y = z2 === 1 ? 0 : y - cy * (q - 1); z = z2; pose(); }, { passive: false });
  let pris = null;
  im.addEventListener('pointerdown', e => { if (z <= 1) return; pris = { px: e.clientX - x, py: e.clientY - y }; im.setPointerCapture(e.pointerId); im.style.cursor = 'grabbing'; });
  im.addEventListener('pointermove', e => { if (!pris) return; x = e.clientX - pris.px; y = e.clientY - pris.py; pose(); });
  im.addEventListener('pointerup', () => { pris = null; pose(); });
  im.addEventListener('dblclick', () => { z = 1; x = y = 0; pose(); });
  v.addEventListener('click', e => { if (e.target === v) ferme(); });
  v.querySelector('.voir-x').onclick = ferme; v.querySelector('.voir-p').onclick = () => va(-1); v.querySelector('.voir-s').onclick = () => va(1);
  montre();
};
// l'adresse réelle d'une vignette (fond ou <img>), une fois qu'elle est chargée
BK.voirUrlDe = el => { if (!el) return ''; if (el.tagName === 'IMG') return /^data:image\/gif/.test(el.src) ? '' : el.src;
  const m = /url\(["']?(.*?)["']?\)/.exec(getComputedStyle(el).backgroundImage || ''); return m ? m[1] : ''; };
// toutes les vignettes zoomables de l'appli : un clic ouvre la visionneuse (sans gêner les boutons ni le glisser-déposer)
document.addEventListener('click', e => {
  const el = e.target.closest && e.target.closest('.zoomable,.to-tph:not(.mi-prop),.to-img[data-mi],.to-med:not(.audio):not(.mi-prop),.to-vig[data-vu]');
  if (!el || e.target.closest('button,a,input,select,textarea,.mi-val,.md-x') || el.closest('.voir-voile')) return;
  const u = BK.voirUrlDe(el); if (!u) return;
  const cadre = el.parentElement, freres = cadre ? [...cadre.children].filter(c => c.matches(el.className.split(/\s+/).filter(Boolean).slice(0, 1).map(c0 => '.' + c0).join('') || '*')) : [el];
  const avec = freres.filter(f => BK.voirUrlDe(f)), liste = avec.map(BK.voirUrlDe), idx = Math.max(0, avec.indexOf(el));
  e.preventDefault(); e.stopPropagation();
  BK.voir(liste.length ? liste : u, idx);
}, true);

// la petite loupe 🔍 : elle apparaît au survol d'une image qu'on ne peut pas ouvrir d'un simple clic (Médias, affiches des reels, affiche d'un tournage…)
(() => {
  const CIBLES = '.md-tuile .md-img:not(.video):not(.son),.su-aff:not(.su-aff-vide),.to-affiche:not(.sans),.tt-aff:not(.sans)';
  let b = null, cible = null;
  const loupe = () => b || (b = Object.assign(document.createElement('span'), { className: 'voir-loupe', textContent: '🔍', title: 'Voir en grand' }), b.hidden = true, document.body.appendChild(b), b);
  const urlDe = async el => {
    const t = el.closest('.md-tuile'), ref = t ? BK.img.ref(t.dataset.id) : el.dataset.ref;
    if (ref) { try { const u = await Promise.race([BK.img.url(ref), new Promise(r => setTimeout(r, 4000))]); if (u) return u; } catch (e) {} }
    return BK.voirUrlDe(el);
  };
  document.addEventListener('mouseover', e => {
    const el = e.target.closest && e.target.closest(CIBLES);
    if (el === cible || (b && e.target.closest('.voir-loupe'))) return;
    cible = el; const l = loupe(); if (!el || !BK.voirUrlDe(el) && !el.dataset.ref && !el.closest('.md-tuile')) { l.hidden = true; return; }
    const r = el.getBoundingClientRect(); l.style.left = (r.left + 6) + 'px'; l.style.top = (r.top + 6) + 'px'; l.hidden = false;
  }, true);
  document.addEventListener('click', async e => {
    if (!b || !e.target.closest('.voir-loupe') || !cible) return; e.preventDefault(); e.stopPropagation();
    const u = await urlDe(cible); if (u) BK.voir(u); else if (window.msg) msg('Image pas encore chargée');
  }, true);
  document.addEventListener('scroll', () => { if (b) b.hidden = true; cible = null; }, true);
})();
