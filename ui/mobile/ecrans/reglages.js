// RÉGLAGES (mobile) — qui utilise ce téléphone, l'installer comme une appli, le délier
(() => {
const { $, esc, msg } = BKM;
let installer = null;                                             // Chrome propose « installer » : on garde l'occasion pour notre bouton
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installer = e; });

BKM.ecran('reglages', { nom: 'Réglages', ordre: 90, dessiner(z) {
  const nom = BK.reglage('nomPc', '');
  z.innerHTML = `
    <div class="mo-carte"><span class="dymo">Qui utilise ce téléphone ?</span>
      <p class="mo-nt">Ton nom signe ce que tu fais ici (tâches cochées, notes).</p>
      <div class="mo-chips">${['Yacine', 'Pierre', 'Baptiste'].map(n => `<button class="chip${nom === n ? ' on' : ''}" data-nom="${n}">${n}</button>`).join('')}</div></div>
    ${BKM.enAppli ? `<div class="mo-carte"><span class="dymo">L'appli</span>
      <p class="mo-nt">Tu es dans l'appli Android. Elle se met à jour toute seule : rien à réinstaller.</p></div>`
    : `<div class="mo-carte"><span class="dymo">Comme une appli</span>
      <p class="mo-nt">Le mieux : l'appli Android. Sur un PC, Réglages › BEESKOT Mobile › « Télécharger l'application ». Sinon, cette page peut aussi aller sur l'écran d'accueil.</p>
      <div class="mo-chips"><button class="btn sm pri" id="moOuvrirAppli">Ouvrir dans l'appli</button><button class="btn sm" id="moInstaller">Mettre cette page sur l'écran d'accueil</button></div>
      <p class="mo-nt" id="moInstTxt"></p></div>`}
    ${BKM.local.possible() ? `<div class="mo-carte" id="moSons"><span class="dymo">Sons sur ce téléphone</span>${sonsHtml()}</div>` : ''}
    <div class="mo-carte"><span class="dymo">Ce téléphone</span>
      <p class="mo-nt">Relié au Drive BEESKOT. Si tu le perds ou le prêtes : « Délier ».</p>
      <button class="btn sm" id="moDelier">Délier ce téléphone</button></div>
    <p class="mo-nt" style="text-align:center">${esc(BK.version || '')} · mobile</p>`;
  z.querySelectorAll('[data-nom]').forEach(b => b.onclick = () => { BK.regler('nomPc', b.dataset.nom); BKM.redessiner(); });
  const bo = $('#moOuvrirAppli'); if (bo) bo.onclick = () => BKM.ouvrirDansAppli();
  const bi = $('#moInstaller'); if (bi) bi.onclick = async () => {
    if (installer) { installer.prompt(); await installer.userChoice; installer = null; return; }
    $('#moInstTxt').textContent = 'Dans Chrome : le menu ⋮ en haut à droite › « Ajouter à l\'écran d\'accueil » (ou « Installer l\'application »).';
  };
  $('#moDelier').onclick = () => { if (!confirm('Délier ce téléphone du Drive BEESKOT ?')) return;
    BK.regler('drive.conf', null); Object.keys(localStorage).filter(k => k.startsWith('bk.drive.cache.')).forEach(k => localStorage.removeItem(k)); location.reload(); };
  if (!nom) z.insertAdjacentHTML('afterbegin', '<p class="mo-alerte">Choisis ton nom ci-dessous : il signe tes tâches et tes notes.</p>');
  brancherSons(z);
} });

// ---------- les sons gardés : la liste, la place prise, retirer, tout télécharger (les ★ des morceaux en cours) ----------
let toutes = null;                                                     // le téléchargement « toutes les ★ » en cours : { fait, total, stop }
function sonsHtml() {
  const D = BKM.local, l = D.tous().sort((a, b) => (a.morceau || a.nom).localeCompare(b.morceau || b.nom)), place = D.place();
  return `<p class="mo-nt">${l.length ? `${l.length} son${l.length > 1 ? 's' : ''} · ${D.mo(place)}. Ils se lisent tout de suite, même sans réseau.` : 'Aucun son gardé. Dans la Bibliothèque, ⬇ à côté d\'une version la garde ici.'}</p>
    <p class="mo-nt" id="moPlace"></p>
    ${l.length ? `<div class="mo-sons">${l.map(x => `<div class="mo-son"><div><b>${esc(x.morceau || x.nom)}</b><em>${esc(x.morceau ? x.nom : '')} · ${D.mo(x.taille || 0)}</em></div><button class="mo-x" data-sx="${esc(x.id)}" aria-label="Retirer du téléphone">✕</button></div>`).join('')}</div>` : ''}
    <div class="mo-chips">${toutes ? `<button class="btn sm" id="moToutesStop">Arrêter (${toutes.fait}/${toutes.total})</button>` : '<button class="btn sm" id="moToutes">Télécharger toutes les ★</button>'}${l.length ? '<button class="btn sm" id="moSonsX">Tout retirer</button>' : ''}</div>
    <p class="mo-nt">« Toutes les ★ » : la version ★ de chaque morceau en cours. Les WAV sont lourds (souvent 30 à 60 Mo) : mieux vaut le Wi-Fi.</p>`;
}
function majSons() { const c = $('#moSons'); if (c) { c.innerHTML = '<span class="dymo">Sons sur ce téléphone</span>' + sonsHtml(); brancherSons(c.parentElement); } }
function brancherSons(z) {
  const D = BKM.local; if (!D.possible()) return;
  if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(e => { const p = $('#moPlace'); if (p && e.quota) p.innerHTML = `<span class="mo-jauge"><i style="width:${Math.min(100, Math.round((e.usage || 0) / e.quota * 100))}%"></i></span>Place libre pour l'appli : ${D.mo(Math.max(0, e.quota - (e.usage || 0)))}`; }).catch(() => {});
  z.querySelectorAll('[data-sx]').forEach(b => b.onclick = async () => { await D.retirer(b.dataset.sx); msg('Retiré du téléphone'); majSons(); });
  const x = $('#moSonsX'); if (x) x.onclick = async () => { if (!confirm('Retirer tous les sons du téléphone ? (ils restent sur le Drive)')) return; for (const s of D.tous()) await D.retirer(s.id); msg('Place libérée'); majSons(); };
  const st = $('#moToutesStop'); if (st) st.onclick = () => { if (toutes) toutes.stop = true; };
  const t = $('#moToutes'); if (t) t.onclick = async () => {
    if (!confirm('Télécharger la version ★ de chaque morceau en cours ? (Wi-Fi conseillé)')) return;
    const ms = (await BKM.liste('morceaux')).filter(m => m.statut !== 'sorti');
    toutes = { fait: 0, total: ms.length, stop: false }; majSons(); let n = 0, deja = 0;
    for (const m of ms) { if (toutes.stop) break;
      try { const v = await BKM.sonDe(m, ms); if (v && !(D.info(v.id) && !D.perime(v.id, v.t))) { msg(m.nom + '…'); await D.garder({ id: v.id, nom: v.nom, t: v.t, morceau: m.nom }, p => { const b = $('#moToutesStop'); if (b) b.textContent = `Arrêter (${toutes.fait}/${toutes.total} · ${m.nom} ${p} %)`; }); n++; } else if (v) deja++; }
      catch (e) { console.warn(e); }
      toutes.fait++; }
    const arrete = toutes.stop; toutes = null; msg((arrete ? 'Arrêté · ' : '') + n + ' son(s) téléchargé(s)' + (deja ? ' · ' + deja + ' déjà là' : '')); majSons(); };
}
})();
