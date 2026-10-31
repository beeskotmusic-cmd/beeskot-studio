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
    <div class="mo-carte"><span class="dymo">Comme une appli</span>
      <p class="mo-nt">Pour l'avoir sur l'écran d'accueil, en plein écran.</p>
      <button class="btn sm" id="moInstaller">Installer sur ce téléphone</button>
      <p class="mo-nt" id="moInstTxt"></p></div>
    <div class="mo-carte"><span class="dymo">Ce téléphone</span>
      <p class="mo-nt">Relié au Drive BEESKOT. Si tu le perds ou le prêtes : « Délier ».</p>
      <button class="btn sm" id="moDelier">Délier ce téléphone</button></div>
    <p class="mo-nt" style="text-align:center">${esc(BK.version || '')} · mobile</p>`;
  z.querySelectorAll('[data-nom]').forEach(b => b.onclick = () => { BK.regler('nomPc', b.dataset.nom); BKM.redessiner(); });
  $('#moInstaller').onclick = async () => {
    if (installer) { installer.prompt(); await installer.userChoice; installer = null; return; }
    $('#moInstTxt').textContent = 'Dans Chrome : le menu ⋮ en haut à droite › « Ajouter à l\'écran d\'accueil » (ou « Installer l\'application »).';
  };
  $('#moDelier').onclick = () => { if (!confirm('Délier ce téléphone du Drive BEESKOT ?')) return;
    BK.regler('drive.conf', null); Object.keys(localStorage).filter(k => k.startsWith('bk.drive.cache.')).forEach(k => localStorage.removeItem(k)); location.reload(); };
  if (!nom) z.insertAdjacentHTML('afterbegin', '<p class="mo-alerte">Choisis ton nom ci-dessous : il signe tes tâches et tes notes.</p>');
} });
})();
