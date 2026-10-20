// =====================================================================
// ABLETON — parler au petit pont BEESKOT installé dans Ableton Live.
//   BEESKOT Studio  ──(ce PC seulement)──►  pont BEESKOT (surface de contrôle)  ──►  Live
// =====================================================================
BK.ableton = {
  relie: false,
  VERSION_PONT: '2',

  async req(obj) {
    if (!BK.estExe) throw new Error('Disponible dans le logiciel installé');
    const r = JSON.parse(await BK.T.core.invoke('ableton', { requete: JSON.stringify(obj) }));
    if (!r.ok) throw new Error(r.erreur || 'Ableton a refusé');
    return r;
  },

  // voyant « Ableton Live » du menu : vérifié toutes les 6 s (très léger)
  async surveiller() {
    const maj = ok => { BK.ableton.relie = ok; const l = $('#ledLive'); if (l) l.classList.toggle('grn', ok); document.dispatchEvent(new CustomEvent('ableton', { detail: ok })); };
    if (!BK.estExe) return;
    BK.ableton.majPontSiBesoin();
    const tour = async () => { try { await BK.ableton.req({ cmd: 'ping' }); maj(true); } catch (e) { maj(false); } };
    tour(); setInterval(tour, 6000);
  },

  // ---------- installer le pont dans Ableton (1 fois par PC) ----------
  async dossierUserLibrary(sansDemander) {
    const memo = BK.reglage('ableton.userLibrary', '');
    if (memo && await BK.fichier.existe(memo)) return memo;
    const docs = await BK.T.path.documentDir();
    const defaut = BK.chemin(docs, 'Ableton', 'User Library');
    if (await BK.fichier.existe(defaut)) return defaut;
    if (sansDemander) return null;
    const d = await BK.fichier.choisirDossier('Où est ta « User Library » Ableton ? (Préférences Ableton › Bibliothèque)');
    if (d) BK.regler('ableton.userLibrary', d);
    return d;
  },
  // le pont installé est-il à jour ? (sinon, la mise à jour du logiciel le remplace toute seule)
  async pontAJour(ul) {
    try { const t = await BK.fichier.lireTexte(BK.chemin(ul, 'Remote Scripts', 'BEESKOT', '__init__.py'));
      return (t.match(/VERSION = "(\d+)"/) || [])[1] === BK.ableton.VERSION_PONT; } catch (e) { return false; }
  },
  async majPontSiBesoin() {
    if (!BK.estExe) return;
    try { const ul = await BK.ableton.dossierUserLibrary(true); if (!ul) return;
      if (await BK.fichier.existe(BK.chemin(ul, 'Remote Scripts', 'BEESKOT')) && !(await BK.ableton.pontAJour(ul))) await BK.ableton.installerPont(); } catch (e) {}
  },
  async installerPont() {
    const ul = await BK.ableton.dossierUserLibrary(); if (!ul) return null;
    const dos = BK.chemin(ul, 'Remote Scripts', 'BEESKOT');
    await BK.fichier.creerDossier(dos);
    const code = await (await fetch('ableton/BEESKOT/__init__.py')).text();
    await BK.fichier.ecrireTexte(BK.chemin(dos, '__init__.py'), code);
    return dos;
  },

  // fenêtre d'explication (une seule étape dans Ableton)
  fenetre(installeA) {
    const v = document.createElement('div'); v.className = 'voile';
    v.innerHTML = `<div class="stopbox" style="width:520px;align-items:stretch">
      <span class="screw tl"></span><span class="screw tr"></span><span class="screw bl"></span><span class="screw br"></span>
      <span class="dymo" style="align-self:center">Relier Ableton</span>
      ${installeA ? `<span class="nt">✅ Le pont est installé ici :<br><span class="mono" style="white-space:normal">${installeA}</span></span>` : ''}
      <span class="lb">Dernière étape, dans Ableton (une seule fois) :</span>
      <ol class="etapes-abl">
        <li>Ferme puis rouvre Ableton Live.</li>
        <li>Ouvre <b>Options › Préférences</b> (Ctrl + ,).</li>
        <li>Onglet <b>Link, Tempo & MIDI</b>.</li>
        <li>Dans une ligne <b>Surface de contrôle</b> libre, choisis <b>BEESKOT</b>. Laisse Entrée et Sortie sur « Aucun ».</li>
        <li>Ferme les préférences : le voyant <b>Ableton Live</b> devient vert ici.</li>
      </ol>
      <span class="nt">Le pont de Dari Audio Live peut rester dans une autre ligne : les deux marchent ensemble. Si le pont vient d'être mis à jour, redémarre simplement Ableton.</span>
      <button class="btn pri" style="justify-content:center">J'ai compris</button></div>`;
    document.body.appendChild(v);
    $('.btn', v).onclick = () => v.remove();
  },
};
