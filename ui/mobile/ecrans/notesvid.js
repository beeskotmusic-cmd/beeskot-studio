// =====================================================================
// NOTES VIDÉOS (mobile) — lire les retours minutés laissés sur les vidéos (clip, reel, live), rangés par
// morceau ou tournage puis par vidéo. Lecture seule : on regarde la vidéo et on répond sur le PC.
// Mêmes notes que le PC (collection « notesvid »).
// =====================================================================
(() => {
const { esc } = BKM;
let seulesOuvertes = true;
const tps = s => { s = Math.max(0, s || 0); return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); };

BKM.ecran('notesvid', { nom: 'Notes vidéos', ordre: 42, async dessiner(z, plus, frais) {
  const [notes, morceaux, tournages] = await Promise.all([BKM.liste('notesvid'), BKM.liste('morceaux'), BKM.liste('tournages')]);
  if (!frais()) return;
  const nomLien = id => { const m = morceaux.find(x => x.id === id); if (m) return '🎵 ' + m.nom; const t = tournages.find(x => x.id === id); return t ? '🎬 ' + (t.titre || 'Tournage') : 'Sans lien'; };
  const toutes = notes.filter(n => n && n.id && n.texte);
  const vues = toutes.filter(n => !seulesOuvertes || !n.regle);
  const parLien = {};
  for (const n of vues) ((parLien[nomLien(n.lien)] = parLien[nomLien(n.lien)] || {})[n.videoNom || 'Vidéo'] = (parLien[nomLien(n.lien)][n.videoNom || 'Vidéo'] || [])).push(n);
  const ligne = n => `<div class="mo-reel-c${n.regle ? ' fini' : ''}"><div class="mo-reel-h"><b>${n.tout ? 'Toute la vidéo' : tps(n.t) + (n.fin ? ' → ' + tps(n.fin) : '')}</b><em>${esc((n.auteur || n.par || '') + (n.regle ? ' · ✓ réglé' : '') + ((n.reponses || []).length ? ' · ' + n.reponses.length + ' réponse' + (n.reponses.length > 1 ? 's' : '') : '') + (n.dessin && n.dessin.length ? ' · ✏ dessin' : ''))}</em></div><p class="mo-nt" style="margin:4px 0 0">${esc(n.texte)}</p></div>`;
  const bloc = Object.keys(parLien).sort((a, b) => a.localeCompare(b)).map(l => `<h2 class="mo-sous">${esc(l)}</h2>`
    + Object.entries(parLien[l]).map(([v, ns]) => `<span class="mo-eng">${esc(v)} <em>${ns.length}</em></span>${ns.sort((a, b) => (a.tout ? -1 : a.t) - (b.tout ? -1 : b.t)).map(ligne).join('')}`).join('')).join('');
  z.innerHTML = `<div class="mo-chips"><button class="chip${seulesOuvertes ? ' on' : ''}" id="nvOuv">À régler</button><button class="chip${seulesOuvertes ? '' : ' on'}" id="nvTout">Toutes (${toutes.length})</button></div>`
    + (bloc || `<p class="mo-nt">${toutes.length ? 'Tout est réglé 👌' : 'Pas encore de note sur une vidéo.'}</p>`)
    + '<p class="mo-nt">Pour répondre, dessiner ou ajouter une note : sur le PC (onglet Retours › Vidéo).</p>';
  z.querySelector('#nvOuv').onclick = () => { seulesOuvertes = true; BKM.redessiner(); };
  z.querySelector('#nvTout').onclick = () => { seulesOuvertes = false; BKM.redessiner(); };
} });
})();
