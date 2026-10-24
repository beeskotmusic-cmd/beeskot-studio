// =====================================================================
// PLUGINS MANQUANTS — pour un projet Ableton, ce qui manque sur chaque PC du groupe.
//
//   chaque PC  ──► note ses plugins installés (une fois par jour, en silence) ──► Drive (partage « plugins »)
//   le projet  ──► la liste de ses plugins (lue dans le fichier .als)
//   comparaison ──► « Chez Pierre : Soothe2 · Serum »  « Au Studio : rien ne manque ✓ »
//   [Envoyer dans les tâches] ──► une tâche par PC (au nom de la personne)
//
// On ne montre que ce qui MANQUE (pas la liste de tous les plugins).
// Pour ajouter un dossier de plugins : la liste DOSSIERS ci-dessous.
// =====================================================================
(() => {
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
BK.plugins = {
  DOSSIERS: [
    'C:\\Program Files\\Common Files\\VST3', 'C:\\Program Files\\Common Files\\VST2', 'C:\\Program Files\\Common Files\\Steinberg\\VST2',
    'C:\\Program Files\\VSTPlugins', 'C:\\Program Files\\Steinberg\\VSTPlugins', 'C:\\Program Files\\VstPlugins',
    'C:\\Program Files (x86)\\VSTPlugins', 'C:\\Program Files (x86)\\Steinberg\\VSTPlugins', 'C:\\Program Files (x86)\\Common Files\\VST3',
  ],
  // un nom comparable : « FabFilter Pro-Q 3 (x64).vst3 » → « fabfilterproq3 »
  norme: s => String(s || '').toLowerCase().replace(/\.(vst3|dll)$/i, '').replace(/\((x64|x86|64[- ]?bit|32[- ]?bit)\)|[_ -]?x64$/gi, '').replace(/[^a-z0-9]/g, ''),

  // ---------- les plugins installés sur CE PC ----------
  async installesIci() {
    const out = new Set();
    const fouiller = async (dos, prof) => {
      for (const e of await BK.fichier.liste(dos)) {
        const n = e.name || '';
        if (/\.vst3$/i.test(n) || /\.dll$/i.test(n)) { out.add(n.replace(/\.(vst3|dll)$/i, '')); continue; }   // un .vst3 peut être un dossier : c'est un plugin
        if (e.isDirectory && prof < 4) await fouiller(BK.chemin(dos, n), prof + 1);
      }
      await BK.audio.pause();                                          // doucement : ne jamais bloquer le PC
    };
    for (const d of BK.plugins.DOSSIERS) if (await BK.fichier.existe(d)) await fouiller(d, 0);
    return [...out].sort((a, b) => a.localeCompare(b));
  },
  // noté dans le Drive (une fois par jour au plus), sous le nom de ce PC
  async noter(force) {
    if (!BK.estExe) return;
    const pc = BK.reglage('nomPc', ''); if (!pc) return;
    if (!force && Date.now() - BK.reglage('plugins.note', 0) < 20 * 3600e3) return;
    const l = await BK.plugins.installesIci();
    const d = await BK.partage.lire('plugins', {});
    d[pc] = { t: new Date().toISOString(), l };
    await BK.partage.ecrire('plugins', d); BK.regler('plugins.note', Date.now());
    await BK.plugins.noterProjets(pc).catch(e => console.warn('plugins des projets', e));
    return l.length;
  },
  // les plugins de chaque projet BEESKOT de ce PC (le plus récent par morceau), pour que les autres sachent quoi installer
  async noterProjets(pc) {
    const tout = await BK.partage.lire('plugins.projets', {}), avant = (tout[pc] && tout[pc].l) || [], vus = new Set(), l = [];
    for (const p of await BK.plugins.projetsBeeskot()) {
      if (vus.has(p.morceau) || l.length >= 40) continue; vus.add(p.morceau);
      const deja = avant.find(x => x.chemin === p.chemin && x.modif === (p.modif || ''));      // pas changé : on ne relit pas
      if (deja) { l.push(deja); continue; }
      try { const pl = await BK.plugins.duProjet(await BK.fichier.lireOctets(p.chemin));
        l.push({ chemin: p.chemin, projet: BK.plugins.nomDe(p.chemin), morceau: p.morceau, modif: p.modif || '', plugins: pl.map(x => ({ nom: x.nom, fichier: x.fichier })) }); } catch (e) {}
      await BK.audio.pause();                                          // doucement : ne jamais bloquer le PC
    }
    tout[pc] = { t: new Date().toISOString(), l }; await BK.partage.ecrire('plugins.projets', tout);
  },
  // pour un membre : ce qui lui manque, projet par projet (les projets des AUTRES) → { verifie, l: [{ titre: 'Mother › Mother v9.als', plugins: [...] }] }
  async manquentChez(qui) {
    const inv = await BK.partage.lire('plugins', {}), pr = await BK.partage.lire('plugins.projets', {}), moi = inv[qui];
    const sources = Object.keys(pr).filter(pc => pc !== qui);
    if (!moi) return { verifie: false, l: [], sources };
    const l = [];
    for (const [pc, d] of Object.entries(pr)) { if (pc === qui) continue;
      for (const p of (d && d.l) || []) { const manque = [...new Set((p.plugins || []).filter(pl => !BK.plugins.present(pl, moi.l)).map(pl => pl.nom))].sort((a, b) => a.localeCompare(b));
        if (manque.length) l.push({ titre: (p.morceau ? p.morceau + ' › ' : '') + p.projet + '.als', pc, plugins: manque }); } }
    l.sort((a, b) => a.titre.localeCompare(b.titre));
    return { verifie: true, t: moi.t, l, sources };
  },
  // ---------- la comparaison : ce qui manque, PC par PC ----------
  present(pl, liste) { const a = BK.plugins.norme(pl.fichier || pl.nom), b = BK.plugins.norme(pl.nom);
    return (liste || []).some(x => { const n = BK.plugins.norme(x); return n === a || n === b || (b.length >= 4 && (n.includes(b) || b.includes(n) && n.length >= 4)); }); },
  manquants(projet, inv, membres) {
    const ok = BK.plugins.present;
    const pcs = [...new Set([...(membres || []), 'Studio', ...Object.keys(inv || {})])];
    return pcs.map(pc => { const i = (inv || {})[pc];
      return { pc, verifie: !!i, t: i && i.t, l: i ? projet.filter(p => !ok(p, i.l || [])).map(p => p.nom) : [] }; });
  },

  // ---------- la case dans l'onglet Ableton Live ----------
  async case(el) {
    if (!el) return;
    const P = BK.plugins._etat = BK.plugins._etat || {};
    const dire = h => { el.innerHTML = `<span class="lb">Le projet ouvert sur ce PC</span>${h}`; };
    if (!BK.estExe) return dire('<span class="nt">Disponible dans le logiciel installé.</span>');
    const rendre = async () => {
      if (!P.chemin) return dire(`<span class="nt">Aucun projet BEESKOT trouvé sur ce PC (seuls les projets qui portent le nom d'un morceau de la Bibliothèque comptent).</span><div class="chips" style="margin-top:8px"><button class="chip" data-pl="choisir">Choisir le projet ▾</button></div>`);
      const nomP = P.chemin.split(/[\\/]/).pop().replace(/\.als$/i, '');
      if (!P.liste) return dire(`<span class="nt mono">${esc(nomP)}</span><span class="nt"><span class="spin"></span>Lecture du projet…</span>`);
      const membres = await BK.membres(), inv = await BK.partage.lire('plugins', {});
      const r = BK.plugins.manquants(P.liste, inv, membres); P.r = r;
      const nom = pc => pc === 'Studio' ? 'Au Studio' : 'Chez ' + pc;
      const mo = await BK.plugins.morceauDe(P.chemin);
      dire(`<span class="nt mono pl-projet" title="${esc(P.chemin)}">${mo ? esc(mo.nom) + ' › ' : ''}${esc(nomP)} · ${P.liste.length} plugin(s)</span>
        <div class="pl-l">${r.map(x => `<div class="pl-pc"><b>${esc(nom(x.pc))}</b> ${!x.verifie ? '<span class="nt">pas encore vérifié</span>' : x.l.length ? `<span class="pl-manque">${x.l.map(esc).join(' · ')}</span>` : '<span class="pl-ok">rien ne manque ✓</span>'}</div>`).join('')}</div>
        <div class="chips" style="margin-top:8px">${r.some(x => x.l.length) ? '<button class="chip" data-pl="taches">Envoyer dans les tâches</button>' : ''}<button class="chip" data-pl="relire" title="Relire le projet ouvert dans Ableton">↻</button><button class="chip" data-pl="choisir">Autre projet ▾</button><button class="chip" data-pl="ignorer" title="Ce projet est perso : il ne sera plus jamais pris en compte">Pas un projet BEESKOT</button></div>`);
    };
    const charger = async chemin => { P.chemin = chemin || await BK.plugins.projetOuvert(); P.liste = null; await rendre();
      if (!P.chemin) return; try { P.liste = await BK.plugins.duProjet(await BK.fichier.lireOctets(P.chemin)); } catch (e) { P.liste = []; } await rendre(); };
    el.onclick = async e => { const b = e.target.closest('[data-pl]'); if (!b) return; const a = b.dataset.pl;
      if (a === 'relire') { await BK.plugins.noter(true).catch(() => {}); return charger(); }
      if (a === 'ignorer') { BK.regler('plugins.ignores', [...new Set([...BK.reglage('plugins.ignores', []), P.chemin])]);
        BK.regler('plugins.ajoutes', BK.reglage('plugins.ajoutes', []).filter(c => c !== P.chemin)); return charger(); }
      if (a === 'choisir') {                                          // Morceau ▸ ses projets (seulement les projets BEESKOT)
        const l = await BK.plugins.projetsBeeskot(), g = {};
        for (const x of l) (g[x.morceau] ||= []).push({ k: x.chemin, nom: x.nom + (x.modif ? ' · ' + x.modif.slice(0, 10) : '') });
        const r = b.getBoundingClientRect();
        return BK.menuCascade({ x: r.left, y: r.bottom + 4 }, Object.entries(g).map(([nom, l]) => ({ nom, l })), k => {
          if (!k) return choisirFichier(); charger(k); }, { actuel: P.chemin || '', aucun: 'Un autre fichier .als…' }); }
      if (a === 'fichier') return choisirFichier();
      if (a === 'taches') { const n = await BK.plugins.versTaches(P); b.textContent = n ? n + ' tâche(s) ajoutée(s) ✓' : 'Déjà dans les tâches ✓'; }
    };
    const choisirFichier = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.als';
        i.onchange = async () => { const f = i.files[0]; if (!f) return; P.chemin = f.name; P.liste = null; await rendre(); try { P.liste = await BK.plugins.duProjet(new Uint8Array(await f.arrayBuffer())); } catch (er) { P.liste = []; } rendre(); }; i.click(); };

    BK.plugins.noter().catch(() => {});                                  // ce PC dit ce qu'il a (au plus une fois par jour)
    await charger(P.chemin);
  },
  // une tâche par PC où il manque quelque chose (au nom de la personne) ; pas deux fois la même
  async versTaches(P) {
    const nomP = P.chemin.split(/[\\/]/).pop().replace(/\.als$/i, ''), taches = await BK.db.liste('taches'), membres = await BK.membres(); let n = 0;
    for (const x of P.r || []) { if (!x.l.length) continue;
      const id = 'plug-' + BK.plugins.norme(x.pc) + '-' + BK.plugins.norme(nomP) + '-' + BK.plugins.norme(x.l.join('')).slice(0, 40);
      if (taches.some(t => t.id === id)) continue;
      await BK.db.ecrire('taches', { id, texte: `Installer ${x.l.join(', ')} ${x.pc === 'Studio' ? 'sur le PC du Studio' : 'sur le PC de ' + x.pc} (projet ${nomP})`,
        qui: membres.includes(x.pc) ? x.pc : '', fait: false, ordre: Date.now() }); n++; }
    BK.tachesRecharger && BK.tachesRecharger();
    return n;
  },
};
// les membres du groupe (la même liste que le Calendrier)
BK.membres = BK.membres || (async () => { const c = (await BK.db.liste('config')).find(x => x.id === 'membres');
  return (c && c.liste && c.liste.length ? c.liste : ['Yacine', 'Pierre', 'Baptiste']).map(m => m === 'Dari' ? 'Yacine' : m).filter(m => m && m !== 'BEESKOT'); });
// chaque PC note ses plugins quelques minutes après le démarrage (en silence, au plus une fois par jour)
if (BK.estExe) setTimeout(() => BK.plugins.noter().catch(() => {}), 4 * 60e3);
})();
