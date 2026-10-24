// =====================================================================
// RÉSEAUX — les chiffres d'un reel sorti (TikTok, Instagram), par leurs API officielles.
//   Instagram : compte Pro relié à une page Facebook + appli Meta validée → un « jeton d'accès » (Instagram Graph API)
//   TikTok    : appli TikTok for Developers validée (Display API, video.list) → un « jeton d'accès »
//   Les jetons sont collés par le groupe dans « ⚙ Relier » et rangés dans le Drive (comme la clé Gemini) : tous les PC les ont.
//   Rien n'est publié : on LIT seulement (vues, j'aime, commentaires, partages ; les commentaires écrits : Instagram seulement).
// =====================================================================
BK.reseaux = {
  conf: null,
  async config() { if (BK.reseaux.conf) return BK.reseaux.conf; return BK.reseaux.conf = (await BK.db.liste('config').catch(() => [])).find(x => x.id === 'reseaux') || { id: 'reseaux', insta: {}, tiktok: {} }; },
  relie() { const c = BK.reseaux.conf; return !!(c && ((c.insta && c.insta.jeton) || (c.tiktok && c.tiktok.jeton))); },
  http(url, o) { return (BK.T && BK.T.http ? BK.T.http.fetch : window.fetch)(url, o); },

  // ---------- Instagram : on retrouve le post par son lien, puis ses chiffres et ses commentaires ----------
  async insta(lien, c) {
    const code = (String(lien).match(/instagram\.com\/(?:[^/]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/) || [])[1]; if (!code) throw new Error('Lien Instagram pas reconnu');
    const G = 'https://graph.facebook.com/v21.0', tk = 'access_token=' + encodeURIComponent(c.jeton);
    const j = async u => { const r = await BK.reseaux.http(u); const x = await r.json(); if (x.error) throw new Error('Instagram : ' + (x.error.message || 'refus')); return x; };
    let compte = c.compte;
    if (!compte) { const p = await j(`${G}/me/accounts?fields=instagram_business_account&${tk}`); compte = ((p.data || []).find(x => x.instagram_business_account) || {}).instagram_business_account; compte = compte && compte.id; }
    if (!compte) throw new Error('Instagram : aucun compte Pro relié à la page Facebook');
    let m = null, url = `${G}/${compte}/media?fields=id,permalink,like_count,comments_count,timestamp&limit=50&${tk}`;
    for (let n = 0; n < 6 && url && !m; n++) { const p = await j(url); m = (p.data || []).find(x => String(x.permalink || '').includes('/' + code)); url = p.paging && p.paging.next; }
    if (!m) throw new Error('Instagram : post introuvable sur le compte');
    const out = { likes: m.like_count, comms: m.comments_count, t: Date.now() };
    try { const ins = await j(`${G}/${m.id}/insights?metric=views,saved,shares&${tk}`); for (const d of ins.data || []) { const v = (d.values && d.values[0] && d.values[0].value) ?? d.total_value?.value; if (d.name === 'views') out.vues = v; if (d.name === 'saved') out.enreg = v; if (d.name === 'shares') out.partages = v; } } catch (e) {}
    try { const cm = await j(`${G}/${m.id}/comments?fields=text,username,timestamp&limit=30&${tk}`); out.commentaires = (cm.data || []).map(x => ({ qui: x.username || '?', texte: x.text || '', t: x.timestamp })); } catch (e) {}
    return out;
  },
  // ---------- TikTok : l'identifiant de la vidéo est dans son lien ----------
  async tiktok(lien, c) {
    const id = (String(lien).match(/\/video\/(\d+)/) || [])[1]; if (!id) throw new Error('Lien TikTok pas reconnu (il faut le lien complet …/video/123…)');
    const r = await BK.reseaux.http('https://open.tiktokapis.com/v2/video/query/?fields=id,view_count,like_count,comment_count,share_count', {
      method: 'POST', headers: { Authorization: 'Bearer ' + c.jeton, 'Content-Type': 'application/json' }, body: JSON.stringify({ filters: { video_ids: [id] } }) });
    const x = await r.json(); if (x.error && x.error.code && x.error.code !== 'ok') throw new Error('TikTok : ' + (x.error.message || x.error.code));
    const v = ((x.data && x.data.videos) || [])[0]; if (!v) throw new Error('TikTok : vidéo introuvable sur le compte relié');
    return { vues: v.view_count, likes: v.like_count, comms: v.comment_count, partages: v.share_count, t: Date.now() };
  },
  // les chiffres d'un reel (r.liens.tiktok / r.liens.insta) → r.stats ; renvoie le nombre de réseaux lus
  async actualiser(r) {
    const c = await BK.reseaux.config(), L = r.liens || {}; let n = 0; const err = [];
    r.stats = r.stats || {};
    if (L.insta && c.insta && c.insta.jeton) { try { r.stats.insta = await BK.reseaux.insta(L.insta, c.insta); n++; } catch (e) { err.push(e.message); } }
    if (L.tiktok && c.tiktok && c.tiktok.jeton) { try { r.stats.tiktok = await BK.reseaux.tiktok(L.tiktok, c.tiktok); n++; } catch (e) { err.push(e.message); } }
    if (!n && err.length) throw new Error(err[0]);
    return n;
  },
  // ---------- ⚙ Relier : on colle les jetons (ils ne sont jamais réaffichés) ----------
  async fenetre() {
    const c = await BK.reseaux.config(), a = x => x && x.jeton ? '✓ relié' : 'pas relié';
    const v = document.createElement('div'); v.className = 'voile';
    v.innerHTML = `<div class="stopbox rs-box"><button class="btn xs rt-x" data-r="x">✕</button><span class="dymo" style="align-self:center">Relier TikTok et Instagram</span>
      <span class="nt">Pour lire les chiffres des reels, il faut une appli « développeur » validée chez Meta (Instagram en compte Pro, relié à une page Facebook) et chez TikTok (Display API). Une fois validées, colle ici le jeton d'accès. Il est rangé dans votre Drive : tous les PC l'ont. On ne publie rien, on lit seulement.</span>
      <label><span class="eng">Instagram · ${a(c.insta)}</span><input class="fld" type="password" id="rsInsta" placeholder="${c.insta && c.insta.jeton ? 'déjà relié · colle un nouveau jeton pour le changer' : 'jeton d\'accès Instagram Graph'}" autocomplete="off"></label>
      <label><span class="eng">TikTok · ${a(c.tiktok)}</span><input class="fld" type="password" id="rsTiktok" placeholder="${c.tiktok && c.tiktok.jeton ? 'déjà relié · colle un nouveau jeton pour le changer' : 'jeton d\'accès TikTok (video.list)'}" autocomplete="off"></label>
      <div class="stopbox-btns"><button class="btn pri" data-r="ok">✓ Enregistrer</button><button class="btn" data-r="x">Fermer</button></div></div>`;
    document.body.appendChild(v);
    v.querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => e.stopPropagation()));
    v.onclick = async e => { const b = e.target.closest('[data-r]'); if (e.target === v || (b && b.dataset.r === 'x')) return v.remove(); if (!b) return;
      const ig = v.querySelector('#rsInsta').value.trim(), tt = v.querySelector('#rsTiktok').value.trim();
      if (ig) c.insta = { jeton: ig }; if (tt) c.tiktok = { jeton: tt };
      if (ig || tt) { await BK.db.ecrire('config', c); BK.reseaux.conf = c; }
      v.remove(); BK.suiviRecharger && BK.suiviRecharger(); };
  },
};
BK.reseaux.config().catch(() => {});
