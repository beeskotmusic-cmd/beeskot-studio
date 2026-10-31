// RÉGLAGES (mobile) — qui utilise ce téléphone, l'installer comme une appli, le délier
(() => {
const { $, esc } = BKM;
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
      <p class="mo-nt">Le mieux : l'appli Android. Sur un PC, Réglages › Aide › BEESKOT Studio Mobile › « 1. Installer l'appli ». Sinon, cette page peut aussi aller sur l'écran d'accueil.</p>
      <div class="mo-chips"><button class="btn sm pri" id="moOuvrirAppli">Ouvrir dans l'appli</button><button class="btn sm" id="moInstaller">Mettre cette page sur l'écran d'accueil</button></div>
      <p class="mo-nt" id="moInstTxt"></p></div>`}
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
} });
})();
