// =====================================================================
// INVENTAIRE — chaque PC fouille SES dossiers (projets Ableton, exports)
// tout doucement, puis dépose sa liste dans le Drive :
//   <Drive>/BEESKOT Studio/inventaires/<nom du PC>.json
// Comme ça, tout le monde voit où se trouve chaque version.
// On lit seulement les noms et les dates : on n'ouvre aucun fichier.
// =====================================================================
BK.inv = {
  EXT_ALS: /\.als$/i,
  EXT_AUDIO: /\.(wav|mp3)$/i,                   // exports : seulement WAV et MP3
  IGNORER: /^(\.|node_modules$|Samples$|Ableton Project Info$|\$RECYCLE|System Volume|BEESKOT Studio$)/i,
  PROF_MAX: 6,

  // ---------- reconnaître le morceau à partir d'un nom de fichier ----------
  normaliser(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\.(als|wav|mp3|aiff?|flac|m4a)$/, '')
      .replace(/\[.*?\]|\(.*?\)/g, ' ')
      .replace(/\b(drms|perc|vox|instr)_/g, ' ')
      .replace(/\b(v|ver|version)\s*\d+\b/g, ' ')
      .replace(/\b(final|finale|master|mastered|mix|mixdown|demo|maquette|wet|dry|bounce|export|stems?|edit|reel|montage|tournage|\d+\s*bpm|bpm|\d+s)\b/g, ' ')
      .replace(/[_\-.]+/g, ' ').replace(/\d+/g, ' ').replace(/\s+/g, ' ').trim();
  },
  version(nom) { const m = String(nom).match(/\bv(?:er(?:sion)?)?\s*(\d+)/i); return m ? +m[1] : null; },

  // à quelle fiche appartient ce fichier ? (la clé la plus longue qui correspond gagne)
  trouverMorceau(nomFichier, morceaux) {
    const n = BK.inv.normaliser(nomFichier).replace(/ /g, ''); let best = null, lg = 0;   // « Morceau A » = « MorceauA »
    for (const m of morceaux) for (const cle of [m.nom, ...(m.alias || [])].map(x => BK.inv.normaliser(x).replace(/ /g, ''))) {
      if (cle.length >= 3 && n.includes(cle) && cle.length > lg) { best = m; lg = cle.length; }
    }
    return best;
  },

  // ---------- fouiller les dossiers de CE PC ----------
  // dossiers de CE PC : [{ chemin, type: 'audio' | 'als' }] (les anciens réglages en simple texte = exports audio)
  dossiers() {
    return BK.reglage('dossiersScan', []).map(d => typeof d === 'string' ? { chemin: d, type: 'audio' } : d);
  },
  async scanner(progression) {
    if (!BK.estExe) return null;
    const trouves = [], vus = { n: 0 };
    async function fouiller(dos, prof, type) {
      if (prof > BK.inv.PROF_MAX) return;
      const entrees = await BK.fichier.liste(dos);
      for (const e of entrees) {
        if (!e.name || BK.inv.IGNORER.test(e.name)) continue;
        const p = BK.chemin(dos, e.name);
        if (e.isDirectory) { await fouiller(p, prof + 1, type); continue; }
        const als = type === 'als' && BK.inv.EXT_ALS.test(e.name), aud = type === 'audio' && BK.inv.EXT_AUDIO.test(e.name);
        if (!als && !aud) continue;
        const st = await BK.fichier.infos(p);
        trouves.push({ type: als ? 'als' : 'audio', nom: e.name, chemin: p, taille: st ? st.size : 0,
          modif: st && st.mtime ? new Date(st.mtime).toISOString() : '', sauvegarde: /[\\/]Backup[\\/]/i.test(p) });
      }
      if (++vus.n % 25 === 0) { progression && progression(vus.n, trouves.length); await new Promise(r => setTimeout(r, 15)); }   // pause : PC jamais bloqué
    }
    for (const d of BK.inv.dossiers()) await fouiller(d.chemin, 0, d.type);
    const inv = { id: 'pc-' + (BK.reglage('nomPc', '') || 'ce-pc').toLowerCase().replace(/[^a-z0-9]+/g, '-'), pc: BK.reglage('nomPc', '') || 'CE PC', date: new Date().toISOString(), fichiers: trouves };
    await BK.db.ecrire('inventaires', inv);
    BK.regler('dernierScan', inv.date);
    return inv;
  },

  // tous les fichiers connus, tous PC confondus
  async tous() {
    const invs = await BK.db.liste('inventaires'), monId = 'pc-' + (BK.reglage('nomPc', '') || 'ce-pc').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const out = [];
    for (const inv of invs) for (const f of inv.fichiers || []) out.push({ ...f, pc: inv.pc, ici: inv.id === monId });
    return out;
  },
  monPc() { return BK.reglage('nomPc', '') || 'CE PC'; },

  // les exports d'un morceau : trouvés au scan + ajoutés à la main ; la version principale (★) en premier
  exportsDe(m, tous, morceaux) {
    const caches = new Set(m.exportsCaches || []), ici = BK.inv.monPc();
    const scan = tous.filter(f => f.type === 'audio' && BK.inv.trouverMorceau(f.nom, morceaux) === m && !caches.has(f.chemin));
    const main = (m.exportsManuels || []).map(f => ({ ...f, type: 'audio', manuel: true, ici: f.pc === ici }));
    const l = [...main, ...scan.filter(f => !main.some(x => x.chemin === f.chemin))].sort((a, b) => (b.modif || '').localeCompare(a.modif || ''));
    const i = l.findIndex(f => f.chemin === m.exportPrincipal); if (i > 0) l.unshift(l.splice(i, 1)[0]);
    return l;
  },
};

// ---------- LE son de référence d'un morceau : l'export ★ de la Bibliothèque ----------
// Tout le logiciel passe par ici (lecteur, Reels, suivi, analyse) : pas de recherche en double.
BK.sonDuMorceau = async function (m, morceaux) {
  if (!m) return null;
  const ms = morceaux || await BK.db.liste('morceaux');
  const exps = BK.inv.exportsDe(m, await BK.inv.tous(), ms);
  const princ = exps.find(x => x.chemin === m.exportPrincipal) || exps[0];
  if (princ) return princ.drive ? { drive: princ.driveId, nom: princ.nom, princ: true }
    : { chemin: princ.chemin, nom: princ.nom, ici: princ.ici, princ: true };
  if (!BK.drive || !BK.drive.relie()) return null;
  // rien d'indiqué dans la fiche : on prend le meilleur export du Drive (CL d'abord)
  await BK.dossiers.assurer();
  const l = BK.trierStems(await BK.dossiers.duMorceau(m, ms))
    .filter(f => !f.groupe && /\.(wav|mp3|aiff?|flac)$/i.test(f.name) && !/tournage/i.test(f.name));
  const rang = f => ({ cl: 0, recording: 1, ableton: 2 }[f.role] ?? 3);
  const f = l.sort((a, b) => rang(a) - rang(b) || (b.modifiedTime || '').localeCompare(a.modifiedTime || ''))[0];
  return f ? { drive: f.id, nom: f.name } : null;
};
