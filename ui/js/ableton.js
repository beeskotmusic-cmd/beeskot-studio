// =====================================================================
// ABLETON — parler au petit pont BEESKOT installé dans Ableton Live.
//   BEESKOT Studio  ──(ce PC seulement)──►  pont BEESKOT (surface de contrôle)  ──►  Live
// =====================================================================
BK.ableton = {
  relie: false,
  VERSION_PONT: '3',

  async req(obj) {
    if (!BK.estExe) throw new Error('Disponible dans le logiciel installé');
    const r = JSON.parse(await BK.T.core.invoke('ableton', { requete: JSON.stringify(obj) }));
    if (!r.ok) throw new Error(r.erreur || 'Ableton a refusé');
    if (obj.cmd === 'ping' && r.pont !== 'BEESKOT') throw new Error('Ce n\'est pas le pont BEESKOT qui répond');
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
  // le nom du dossier du pont : il commence par « 0 » pour être en HAUT de la liste des surfaces de contrôle d'Ableton
  NOM_PONT: '0_BEESKOT',
  // où est la « User Library » ? On la lit dans les réglages d'Ableton (Library.cfg), toutes versions confondues
  async userLibrariesAbleton() {
    const out = [];
    try {
      const base = BK.chemin(await BK.T.path.configDir(), 'Ableton');            // %APPDATA%\Ableton
      for (const v of await BK.fichier.liste(base)) {
        if (!/^Live /i.test(v.name)) continue;
        try { const t = await BK.fichier.lireTexte(BK.chemin(base, v.name, 'Preferences', 'Library.cfg'));
          const bloc = (t.match(/<UserLibrary>([\s\S]*?)<\/UserLibrary>/) || [])[1] || '';
          const chemin = (bloc.match(/ProjectPath Value="([^"]+)"/) || [])[1], nom = (bloc.match(/ProjectName Value="([^"]+)"/) || [])[1] || 'User Library';
          if (chemin) { const ul = BK.chemin(chemin.replace(/[\\/]+$/, ''), nom); if (await BK.fichier.existe(ul) && !out.includes(ul)) out.push(ul); } } catch (e) {}
      }
    } catch (e) {}
    return out;
  },
  async dossierUserLibrary(sansDemander) {
    const memo = BK.reglage('ableton.userLibrary', '');
    if (memo && await BK.fichier.existe(memo)) return memo;
    const lus = await BK.ableton.userLibrariesAbleton(); if (lus.length) { BK.regler('ableton.userLibrary', lus[0]); return lus[0]; }
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
    try { const t = await BK.fichier.lireTexte(BK.chemin(ul, 'Remote Scripts', BK.ableton.NOM_PONT, '__init__.py'));
      return (t.match(/VERSION = "(\d+)"/) || [])[1] === BK.ableton.VERSION_PONT; } catch (e) { return false; }
  },
  async majPontSiBesoin() {
    if (!BK.estExe) return;
    try { const ul = await BK.ableton.dossierUserLibrary(true); if (!ul) return;
      const ancien = await BK.fichier.existe(BK.chemin(ul, 'Remote Scripts', 'BEESKOT'));
      if ((ancien || await BK.fichier.existe(BK.chemin(ul, 'Remote Scripts', BK.ableton.NOM_PONT))) && !(await BK.ableton.pontAJour(ul))) await BK.ableton.installerPont(); } catch (e) {}
  },
  // installe le pont dans TOUTES les User Library trouvées (Live 11, Live 12…) : rien à chercher soi-même
  async installerPont() {
    const ul = await BK.ableton.dossierUserLibrary(); if (!ul) return null;
    const toutes = [...new Set([ul, ...(await BK.ableton.userLibrariesAbleton())])];
    const code = await (await fetch('ableton/BEESKOT/__init__.py')).text();
    let premier = null;
    for (const u of toutes) {
      const rs = BK.chemin(u, 'Remote Scripts'), dos = BK.chemin(rs, BK.ableton.NOM_PONT);
      await BK.fichier.creerDossier(dos);
      await BK.fichier.ecrireTexte(BK.chemin(dos, '__init__.py'), code);
      // l'ancien dossier « BEESKOT » est mis de côté (un nom qui commence par _ est caché par Ableton) : rien n'est effacé
      const ancien = BK.chemin(rs, 'BEESKOT');
      if (await BK.fichier.existe(ancien)) { let k = BK.chemin(rs, '_BEESKOT_ancien'), n = 2; while (await BK.fichier.existe(k)) k = BK.chemin(rs, '_BEESKOT_ancien' + n++); try { await BK.fichier.deplacer(ancien, k); } catch (e) {} }
      premier = premier || dos;
    }
    return premier;
  },

  // ce qu'Ableton a écrit sur le pont dans son journal (Log.txt) : pour comprendre si ça ne marche pas
  async journalAbleton() {
    try {
      const base = BK.chemin(await BK.T.path.configDir(), 'Ableton'), vs = (await BK.fichier.liste(base)).filter(v => /^Live /i.test(v.name)).map(v => v.name).sort().reverse();
      for (const v of vs) { try { const t = await BK.fichier.lireTexte(BK.chemin(base, v, 'Preferences', 'Log.txt'));
        const l = t.split(/\r?\n/).filter(x => /BEESKOT/i.test(x)).slice(-6); if (l.length) return l; } catch (e) {} }
    } catch (e) {}
    return [];
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
        <li><b>Ferme complètement</b> Ableton Live, puis rouvre-le (sinon il ne voit pas le pont).</li>
        <li>Menu <b>Options › Réglages</b> (Ctrl + ,).</li>
        <li>Onglet <b>Link, Tempo & MIDI</b>.</li>
        <li>Dans une ligne <b>Control Surface</b> libre (à « None »), choisis <b>0 BEESKOT</b> : c'est le <b>tout premier</b> de la liste, avant « Advance ». Laisse Input et Output sur « None ».</li>
        <li>Ferme les préférences : le voyant <b>Ableton Live</b> devient vert ici.</li>
      </ol>
      <span class="nt">Le pont de Dari Audio Live peut rester dans une autre ligne : les deux marchent ensemble. Si le pont vient d'être mis à jour, redémarre simplement Ableton.</span>
      <div class="box" id="ablJournal" style="display:none"><span class="lb">Ce qu'Ableton dit du pont</span><span class="nt mono" style="white-space:pre-wrap;font-size:10px"></span></div>
      <button class="btn pri" style="justify-content:center">J'ai compris</button></div>`;
    document.body.appendChild(v);
    $('.btn', v).onclick = () => v.remove();
    if (BK.estExe) BK.ableton.journalAbleton().then(l => { if (!l.length) return; const b = $('#ablJournal', v); b.style.display = ''; $('.nt', b).textContent = l.join('\n'); });
  },
};
