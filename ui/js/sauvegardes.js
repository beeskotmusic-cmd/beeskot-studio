// =====================================================================
// SAUVEGARDE AUTOMATIQUE DES PROJETS ABLETON
// Toutes les 30 minutes, tout doucement : chaque projet Ableton (.als) de CE PC
// qui a changé depuis la dernière fois est copié dans le Drive :
//   BEESKOT Studio / Sauvegardes Ableton / « Mother · 2026-10-21 14h05.als »
// Seulement le fichier .als (la session : petit, rapide), pas les samples.
// Rien n'est jamais effacé, ni sur le PC ni dans le Drive.
// =====================================================================
BK.sauvegardes = {
  DOSSIER: 'Sauvegardes Ableton',
  actif: () => BK.reglage('ableton.sauvegarde', true),
  enCours: false,
  // les .als des dossiers « Projets Ableton » de ce PC (Réglages / Bibliothèque › Scanner ce PC)
  async projets() {
    const out = [];
    async function fouiller(dos, prof) {
      if (prof > 6) return;
      let l = []; try { l = await BK.fichier.liste(dos); } catch (e) { return; }
      for (const e of l) {
        if (!e.name || BK.inv.IGNORER.test(e.name) || /^Backup$/i.test(e.name)) continue;
        const p = BK.chemin(dos, e.name);
        if (e.isDirectory) await fouiller(p, prof + 1);
        else if (/\.als$/i.test(e.name)) out.push(p);
      }
      await new Promise(r => setTimeout(r, 10));                      // jamais bloquer le PC
    }
    for (const d of BK.inv.dossiers().filter(d => d.type === 'als')) await fouiller(d.chemin, 0);
    return out;
  },
  async tour() {
    if (!BK.estExe || !BK.drive.relie() || !BK.sauvegardes.actif() || BK.sauvegardes.enCours) return;
    BK.sauvegardes.enCours = true;
    try {
      const vus = BK.reglage('sauv.vus', null), premier = vus === null, deja = vus || {}, faits = BK.reglage('sauv.faits', []);
      let n = 0;
      for (const p of await BK.sauvegardes.projets()) {
        const st = await BK.fichier.infos(p); if (!st || !st.mtime) continue;
        const t = new Date(st.mtime).getTime();
        if (deja[p] && deja[p] >= t) continue;
        // 1re fois sur ce PC : on sauvegarde seulement ce qui a bougé ces dernières 24 h (pas toute l'histoire d'un coup)
        if (premier && Date.now() - t > 864e5) { deja[p] = t; continue; }
        if (Date.now() - t < 2 * 60e3) continue;                     // il est peut-être en train d'être enregistré : la prochaine fois
        const nom = p.split(/[\\/]/).pop().replace(/\.als$/i, ''), d = new Date(t);
        const quand = d.toISOString().slice(0, 10) + ' ' + String(d.getHours()).padStart(2, '0') + 'h' + String(d.getMinutes()).padStart(2, '0');
        try { await BK.drive.envoyerFichier(p, `${nom} · ${quand}.als`, BK.sauvegardes.DOSSIER);
          deja[p] = t; faits.unshift({ nom, quand, pc: BK.reglage('nomPc', '') || 'ce PC' }); n++; }
        catch (e) { console.warn('sauvegarde', e); }
        if (n >= 8) break;                                            // pas trop d'un coup
        await new Promise(r => setTimeout(r, 300));
      }
      BK.regler('sauv.vus', deja); BK.regler('sauv.faits', faits.slice(0, 30));
      if (n) BK.sauvegardes.majCases();
    } finally { BK.sauvegardes.enCours = false; }
  },
  // la petite case « Sauvegardes » (onglet Ableton Live et Réglages › Ableton)
  cases: [],
  case(el) { BK.sauvegardes.cases.push(el); BK.sauvegardes.dessiner(el); },
  majCases() { BK.sauvegardes.cases.forEach(el => el.isConnected && BK.sauvegardes.dessiner(el)); },
  dessiner(el) {
    const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const on = BK.sauvegardes.actif(), l = BK.reglage('sauv.faits', []).slice(0, 4);
    el.innerHTML = `<span class="lb">💾 Sauvegardes automatiques</span>
      <span class="nt">Toutes les 30 min, les projets Ableton de ce PC qui ont changé sont copiés dans le Drive (dossier « ${BK.sauvegardes.DOSSIER} »). Rien n'est effacé.</span>
      <div class="chips" style="margin-top:8px"><button class="chip${on ? ' on' : ''}" data-sv="on">${on ? '✓ Activées sur ce PC' : 'Coupées sur ce PC'}</button><button class="chip" data-sv="go">Sauvegarder maintenant</button></div>
      ${l.length ? `<div class="sv-l">${l.map(x => `<span class="nt">💾 ${esc(x.nom)} · ${esc(x.quand)}</span>`).join('')}</div>` : ''}`;
    el.querySelector('[data-sv="on"]').onclick = () => { BK.regler('ableton.sauvegarde', !on); BK.sauvegardes.majCases(); };
    el.querySelector('[data-sv="go"]').onclick = async e => { const b = e.currentTarget;
      if (!BK.estExe) return; if (!BK.drive.relie()) { b.textContent = 'Relie d\'abord le Drive'; return; }
      b.disabled = true; b.innerHTML = '<span class="spin"></span>Sauvegarde…'; await BK.sauvegardes.tour(); BK.sauvegardes.majCases(); };
  },
};
setTimeout(() => BK.sauvegardes.tour(), 3 * 60e3);
setInterval(() => BK.sauvegardes.tour(), 30 * 60e3);
