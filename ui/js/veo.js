// =====================================================================
// PROMPTS VEO 3 — un prompt par plan du découpage, pour tester un reel en IA (Google Flow / Veo 3) avant de tourner.
//   BK.veo.ouvrir({ tour, reels, membres, garder })
//   Rien n'est généré ici : on prépare le texte (anglais), on copie, on colle dans Flow.
//   « Miette réécrit » : la clé Gemini gratuite du groupe transforme la fiche en prompts anglais soignés (+ résumé en français).
//   Les prompts retouchés sont gardés dans la fiche du reel (r.veo) → tout le groupe les retrouve.
// =====================================================================
(() => {
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CAMERA = { 'Plan large': 'Wide shot', 'Plan moyen': 'Medium shot', 'Plan américain': 'Cowboy shot (from mid-thigh up)', 'Gros plan': 'Close-up', 'Très gros plan': 'Extreme close-up',
  "Plan d'ensemble": 'Establishing extreme wide shot', 'Insert': 'Insert detail shot', 'Plongée': 'High-angle shot looking down', 'Contre-plongée': 'Low-angle shot looking up', 'Travelling': 'Smooth tracking shot (dolly move)' };
const ROLES = { Yacine: 'lead singer (also plays guitar, piano or congas), the tallest of the three', Baptiste: 'drummer, tall', Pierre: 'bass player, the shortest of the three' };
const secondes = d => { d = String(d || '').trim(); let m; if ((m = d.match(/^(\d+):(\d{1,2})$/))) return +m[1] * 60 + +m[2]; if ((m = d.match(/(\d+(?:[.,]\d+)?)/))) return parseFloat(m[1].replace(',', '.')); return 0; };
const persoDefaut = (membres, x) => 'BEESKOT is a three-piece, 70s-inspired rock band.\n' + (membres || ['Yacine', 'Baptiste', 'Pierre']).map(m => `- ${m}: ${ROLES[m] || 'band member'}${((x && x.tenues) || {})[m] ? ` — outfit: ${x.tenues[m]}` : ''}`).join('\n')
  + '\nKeep the same faces, hair and outfits in every shot.';

// le prompt d'un plan, construit à partir de la fiche (sans IA)
function prompt(r, p, i, n, perso, tour) {
  const vertical = /reel/i.test(r.type || 'Reel'), s = secondes(p.duree);
  return [`Shot ${i + 1}/${n} — music video "${r.titre || 'BEESKOT'}"${r.morceau ? ` (song: ${r.morceau})` : ''}.`,
    `Format: ${vertical ? 'vertical 9:16' : 'horizontal 16:9'}, cinematic, 70s-inspired look, natural film grain, realistic.`,
    `Camera: ${CAMERA[p.cadrage] || p.cadrage || 'Medium shot'}.`,
    `Action: ${p.action || '(describe what we see)'}.`,
    (r.lieu || (tour && tour.lieu)) ? `Location: ${r.lieu || tour.lieu}.` : '',
    r.idee ? `Mood: ${r.idee}.` : '',
    p.notes ? `Notes: ${p.notes}.` : '',
    `Characters:\n${perso}`,
    `Audio: ${p.audio ? `the band performs (${p.audio}); ` : ''}natural ambience only — no added music, no voice-over (the real song is added in editing).`,
    `Length: ${s ? `about ${s} seconds, ` : ''}one continuous shot.`,
    'No text, no subtitles, no logos, no watermark.'].filter(Boolean).join('\n');
}
function resume(r, p) { return [p.cadrage, p.action, p.duree].filter(Boolean).join(' · ') || 'Plan sans description'; }

BK.veo = {
  ouvrir({ tour, reels, membres, garder }) {
    reels = (reels || []).filter(Boolean); if (!reels.length) return BK.toast && BK.toast('Pas de reel');
    let cur = reels[0];
    const v = document.createElement('div'); v.className = 'voile';
    v.innerHTML = `<div class="stopbox veo-box"><span class="screw tl"></span><span class="screw tr"></span><span class="screw bl"></span><span class="screw br"></span>
      <span class="dymo" style="align-self:center">🎬 Prompts Veo 3</span>
      <div class="veo-barre">${reels.length > 1 ? `<select class="fld" id="veoReel">${reels.map(r => `<option value="${esc(r.id)}">${esc(r.titre || 'Reel')}</option>`).join('')}</select>` : `<b class="veo-t">${esc(cur.titre || 'Reel')}</b>`}
        <button class="btn sm miette-aide" id="veoMiette" title="Miette (clé Gemini gratuite) réécrit chaque prompt en bon anglais de cinéma, avec un résumé en français">Miette réécrit</button>
        <button class="btn sm" id="veoRecalc" title="Refaire les prompts à partir de la fiche (efface les retouches)">↺ Depuis la fiche</button>
        <button class="btn sm" id="veoTxt" title="Un fichier texte avec tous les prompts">💾 .txt</button>
        <button class="btn sm pri" id="veoTout">📋 Tout copier</button></div>
      <div class="veo-corps" id="veoCorps"></div>
      <span class="nt">Rien n'est généré ici. Copie un prompt, colle-le dans Google Flow (Veo 3), et ajoute les images de référence du plan (clic droit sur une image → Ouvrir sur le Drive). Veo fait 8 secondes au maximum par clip.</span>
      <div class="stopbox-btns"><button class="btn" id="veoFermer">Fermer</button></div></div>`;
    document.body.appendChild(v);
    const q = s => v.querySelector(s), msg = t => BK.toast ? BK.toast(t) : null;
    const persoDe = r => (r.veoPerso || (tour && tour.veoPerso) || persoDefaut(membres, { tenues: { ...((tour && tour.tenues) || {}), ...(r.tenues || {}) } }));
    const liste = r => { const P = r.plans || [], perso = persoDe(r), deja = r.veo || [];
      return P.map((p, i) => { const d = deja[i] || {}; return { en: d.en || prompt(r, p, i, P.length, perso, tour), fr: d.fr || resume(r, p), p, retouche: !!d.en }; }); };
    const sauver = async r => { try { await garder(r); } catch (e) { msg('Pas enregistré : Drive injoignable'); } };
    function dessiner() {
      const r = cur, L = liste(r), z = q('#veoCorps');
      z.innerHTML = `<div class="veo-perso"><span class="eng">Les personnages (le même bloc dans chaque prompt)</span><textarea class="fld" id="veoPerso" rows="5">${esc(persoDe(r))}</textarea></div>`
        + (L.length ? L.map((x, i) => { const s = secondes(x.p.duree);
          return `<div class="veo-plan"><div class="veo-plan-t"><b>Plan ${i + 1}</b><span class="nt">${esc(x.fr)}</span>${s > 8 ? '<span class="veo-alerte">⚠ plus de 8 s : à couper en deux prompts</span>' : ''}${x.retouche ? '<span class="veo-ret">retouché</span>' : ''}
              <button class="btn xs" data-cp="${i}">📋 Copier</button></div>
            <textarea class="fld veo-p" data-pi="${i}" rows="9">${esc(x.en)}</textarea>
            ${(x.p.imgs || []).length ? `<div class="veo-refs"><span class="eng">Images de référence</span>${x.p.imgs.map(u => `<span class="veo-ref"${BK.img.bg(u)} title="Clic droit : ouvrir sur le Drive"></span>`).join('')}</div>` : ''}</div>`; }).join('')
          : '<span class="nt">Ce reel n\'a pas encore de découpage : ajoute des plans dans la fiche (Découpage), puis reviens ici.</span>');
      z.querySelector('#veoPerso').onchange = async e => { r.veoPerso = e.target.value.trim(); r.veo = []; await sauver(r); dessiner(); };
      z.querySelectorAll('[data-pi]').forEach(t => t.onchange = async () => { const i = +t.dataset.pi; r.veo = r.veo || []; r.veo[i] = { ...(r.veo[i] || {}), en: t.value, fr: (r.veo[i] || {}).fr || L[i].fr }; await sauver(r); });
      z.querySelectorAll('[data-cp]').forEach(b => b.onclick = async () => { await navigator.clipboard.writeText(z.querySelector(`[data-pi="${b.dataset.cp}"]`).value); b.textContent = '✓ Copié'; setTimeout(() => b.textContent = '📋 Copier', 1500); });
    }
    const tout = () => liste(cur).map((x, i) => `=== Plan ${i + 1} — ${x.fr} ===\n${x.en}`).join('\n\n');
    q('#veoFermer').onclick = () => v.remove();
    const sel = q('#veoReel'); if (sel) sel.onchange = () => { cur = reels.find(r => r.id === sel.value) || reels[0]; dessiner(); };
    q('#veoTout').onclick = async () => { await navigator.clipboard.writeText(tout()); msg('Tous les prompts sont copiés'); };
    q('#veoTxt').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([tout()], { type: 'text/plain' })); a.download = `Prompts Veo 3 - ${cur.titre || 'reel'}.txt`; document.body.appendChild(a); a.click(); a.remove(); };
    q('#veoRecalc').onclick = async () => { if (!(await BK.confirmer('Refaire tous les prompts depuis la fiche ? Les retouches de ce reel seront perdues.'))) return; cur.veo = []; await sauver(cur); dessiner(); };
    q('#veoMiette').onclick = async () => {
      const r = cur, P = r.plans || []; if (!P.length) return msg('Pas de plan à réécrire');
      if (!(await BK.ia.pret())) return msg('Miette n\'a pas de clé Gemini (Réglages › Miette)');
      const b = q('#veoMiette'), avant = b.textContent; b.disabled = true; b.innerHTML = '<span class="spin"></span>Miette écrit…';
      try {
        const entree = { reel: r.titre, morceau: r.morceau, format: /reel/i.test(r.type || 'Reel') ? '9:16 vertical' : '16:9', lieu: r.lieu || (tour && tour.lieu) || '', idee: r.idee || '', personnages: persoDe(r),
          plans: P.map((p, i) => ({ n: i + 1, cadrage: p.cadrage || '', action: p.action || '', duree: p.duree || '', notes: p.notes || '', audio: p.audio || '' })) };
        const rep = await BK.ia.demander(JSON.stringify(entree), { prio: true, json: true, temperature: 0.5,
          systeme: 'Tu es réalisateur de clips. À partir du découpage (en français) d\'un reel de musique du groupe BEESKOT, écris pour CHAQUE plan un prompt en ANGLAIS pour Google Veo 3 : un seul plan continu de 8 secondes maximum, langage de caméra précis (cadrage, mouvement, optique), action, lieu, lumière, ambiance, style années 70 réaliste, et le bloc « personnages » recopié à l\'identique dans chaque prompt pour garder les mêmes personnes. Audio : ambiance naturelle seulement, pas de musique ajoutée ni de voix off (la vraie chanson est ajoutée au montage). Termine par « No text, no subtitles, no logos, no watermark. ». N\'invente pas de personnages en plus. Réponds en JSON : {"plans":[{"n":1,"en":"…","fr":"résumé très simple en français, une phrase"}]}' });
        r.veo = P.map((p, i) => { const x = ((rep && rep.plans) || []).find(y => +y.n === i + 1) || {}; return x.en ? { en: String(x.en).trim(), fr: String(x.fr || '').trim() || resume(r, p) } : (r.veo || [])[i] || null; });
        await sauver(r); dessiner(); msg('Miette a réécrit les prompts');
      } catch (e) { msg('Miette n\'a pas pu : ' + (e.message || e)); }
      b.disabled = false; b.textContent = avant; };
    dessiner();
  },
};
})();
