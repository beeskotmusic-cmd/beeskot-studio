// =====================================================================
// PREMIER LANCEMENT — un petit guide qui ne s'affiche QU'UNE FOIS par PC.
// Il accompagne l'installation : nom du PC, Drive, Ableton, Miette (Discord + Gemini).
// On peut le passer, le reprendre plus tard (Réglages › Revoir le guide), et il
// se ferme tout seul quand tout est prêt. Il ne touche à rien : il ouvre juste les bonnes fenêtres.
// =====================================================================
BK.bienvenue = {
  v: null, i: 0,

  async etapes() {
    const d = BK.discord ? await BK.discord.config().catch(() => ({})) : {};
    const ia = BK.ia ? await BK.ia.config().catch(() => ({})) : {};
    const miettePrete = !!(d.jeton && (d.salons || []).length && ia.gemini);
    return [
      { id: 'nom', titre: 'Bienvenue dans BEESKOT Studio', ic: '🍞',
        txt: 'Le logiciel du groupe : les morceaux, les tournages, les reels, le calendrier et le budget, au même endroit pour tout le monde.<br><br><b>Qui va utiliser cet ordinateur ?</b> Écris ton prénom (<b>Yacine</b>, <b>Pierre</b>, <b>Baptiste</b>), ou <b>Studio</b> si c\'est l\'ordinateur du studio.<br><br>Ça sert à savoir qui a fait quoi : quand tu coches une tâche ou qu\'un reel avance, ça part à ton nom.',
        champ: { id: 'bvNom', val: BK.reglage('nomPc', ''), ph: 'ton prénom, ou Studio' },
        fait: () => !!BK.reglage('nomPc', ''),
        action: null },
      { id: 'drive', titre: 'Le Drive BEESKOT', ic: '☁',
        txt: 'Tout le travail du groupe est rangé dans le Drive BEESKOT : chaque PC voit les mêmes fiches, tâches, dépenses… et Miette, la bot Discord, arrive avec.<br><br>Yacine t\'a envoyé une <b>carte d\'accès</b> (un petit fichier <span class="mono">BEESKOT-carte-acces.json</span>). Clique ci-dessous et choisis-la : <b>aucun code, aucun mot de passe à taper</b>.',
        bouton: 'Importer la carte d\'accès…',
        fait: () => BK.drive && BK.drive.relie(),
        action: async () => { if (await BK.drive.importerCarte()) { try { await BK.pousser(); } catch (e) {} return 'Drive relié ✓'; } return null; } },
      { id: 'ableton', titre: 'Ableton Live (si ce PC l\'a)', ic: '🎛',
        txt: 'Le logiciel peut préparer les projets pour le mixage (renommer, colorer, geler, zipper). Pour ça, il installe un petit « pont » dans Ableton.<br><br>Clique, puis dans Ableton : <b>Options › Réglages › Link, Tempo & MIDI</b>, et choisis <b>A BEESKOT</b> dans une ligne <i>Control Surface</i> libre.',
        bouton: 'Installer le pont Ableton',
        option: true,
        fait: () => BK.ableton && BK.ableton.relie,
        action: async () => { const p = await BK.ableton.installerPont(); if (p) { BK.ableton.fenetre(p); return 'Pont installé ✓'; } return null; } },
      // Miette : cette étape n'apparaît QUE si personne du groupe ne l'a encore réglée
      ...(miettePrete ? [] : [{ id: 'miette', titre: 'Miette, la bot Discord', ic: '🍞',
        txt: 'Miette lit votre Discord et prépare tout : le résumé de la semaine, les tâches, les dates du calendrier.<br><br>Personne du groupe ne l\'a encore réglée. Il faut le faire <b>une seule fois</b> : après, elle arrivera toute seule sur les autres PC avec la carte d\'accès.',
        bouton: 'Ouvrir les réglages de Miette',
        option: true,
        fait: () => false,
        action: async () => { BK.bienvenue.fermer(); BK.ouvrir('reglages'); BK.reglagesOnglet && BK.reglagesOnglet('miette'); return null; } }]),
      { id: 'fin', titre: 'C\'est prêt !', ic: '✓',
        txt: 'Quelques repères :<br><br>• Le <b>bouton jaune</b> (la biscotte) en haut : Miette relit Discord et le Drive, et remplit tous les onglets.<br>• Le <b>menu de gauche</b> : chaque titre (Audio, Organisation…) se replie d\'un clic.<br>• Tout ce que tu fais arrive sur les autres PC tout seul.<br>• <b>Ctrl + Z</b> annule la dernière action.<br><br>Ce guide ne reviendra plus. Pour le revoir : <b>Réglages › Revoir le guide</b>.',
        fait: () => true, action: null },
    ];
  },

  async ouvrir(force) {
    if (!force && BK.reglage('bienvenue.vue', false)) return;
    if (BK.bienvenue.v) return;
    BK.bienvenue.i = 0;
    const v = document.createElement('div'); v.className = 'voile bv-voile'; BK.bienvenue.v = v;
    v.innerHTML = '<div class="bv-box"><span class="screw tl"></span><span class="screw tr"></span><span class="screw bl"></span><span class="screw br"></span><div class="bv-c"></div></div>';
    document.body.appendChild(v);
    await BK.bienvenue.dessiner();
  },
  fermer() { if (BK.bienvenue.v) { BK.bienvenue.v.remove(); BK.bienvenue.v = null; } BK.regler('bienvenue.vue', true); },

  async dessiner(msg) {
    const v = BK.bienvenue.v; if (!v) return;
    const l = await BK.bienvenue.etapes(), n = l.length;
    if (BK.bienvenue.i >= n) BK.bienvenue.i = n - 1;                    // une étape a pu disparaître (Miette déjà réglée)
    const e = l[BK.bienvenue.i], fait = e.fait();
    const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    v.querySelector('.bv-c').innerHTML = `
      <div class="bv-pas">${l.map((x, k) => `<span class="bv-p${k === BK.bienvenue.i ? ' on' : ''}${x.fait() ? ' fini' : ''}"></span>`).join('')}</div>
      <span class="bv-ic">${e.ic}</span>
      <span class="dymo">${esc(e.titre)}</span>
      <p class="bv-txt">${e.txt}</p>
      ${e.champ ? `<input class="fld bv-champ" id="${e.champ.id}" value="${esc(e.champ.val)}" placeholder="${esc(e.champ.ph)}">` : ''}
      ${e.bouton ? `<button class="btn pri bv-act"${fait ? ' disabled' : ''}>${fait ? '✓ Déjà fait' : esc(e.bouton)}</button>` : ''}
      ${msg ? `<span class="bv-msg">${esc(msg)}</span>` : ''}
      ${e.option && !fait ? '<span class="nt">Pas maintenant ? Passe cette étape, tu pourras le faire dans Réglages.</span>' : ''}
      <div class="bv-btns">
        ${BK.bienvenue.i > 0 ? '<button class="btn sm" data-bv="prec">◀ Retour</button>' : '<button class="btn sm" data-bv="passer">Passer le guide</button>'}
        <button class="btn pri" data-bv="suiv">${BK.bienvenue.i === n - 1 ? 'Commencer ▶' : 'Suivant ▶'}</button>
      </div>
      <span class="nt bv-num">Étape ${BK.bienvenue.i + 1} sur ${n}</span>`;
    const champ = e.champ && v.querySelector('#' + e.champ.id);
    if (champ) { champ.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Enter') v.querySelector('[data-bv="suiv"]').click(); });
      champ.oninput = () => { BK.regler('nomPc', champ.value.trim()); BK.majNomPc && BK.majNomPc(); }; setTimeout(() => champ.focus(), 100); }
    const act = v.querySelector('.bv-act');
    if (act) act.onclick = async () => { act.disabled = true; const t = act.textContent; act.innerHTML = '<span class="spin"></span>…';
      try { const r = await e.action(); await BK.bienvenue.dessiner(r || 'Pas fait pour l\'instant'); } catch (er) { act.disabled = false; act.textContent = t; await BK.bienvenue.dessiner('Problème : ' + (er.message || er)); } };
    v.querySelectorAll('[data-bv]').forEach(b => b.onclick = async () => {
      const a = b.dataset.bv;
      if (a === 'passer') return BK.bienvenue.fermer();
      if (a === 'prec') { BK.bienvenue.i--; return BK.bienvenue.dessiner(); }
      if (BK.bienvenue.i === n - 1) { BK.bienvenue.fermer(); BK.etatDrive && BK.etatDrive(); return; }
      BK.bienvenue.i++; BK.bienvenue.dessiner();
    });
  },
};
