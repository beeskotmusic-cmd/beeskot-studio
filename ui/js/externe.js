// =====================================================================
// EXTERNE — l'espace de partage : des liens secrets pour des gens de
// l'extérieur (ingé son, caméraman…). Ils ouvrent une page web (le
// « guichet », un Google Apps Script : dossier partage-externe/ du dépôt),
// écoutent / regardent un fichier DU DRIVE et laissent des notes minutées
// (et des dessins sur les vidéos) qui reviennent ici, marquées « Externe · prénom ».
//
//   Drive : BEESKOT Studio/partages/<id>.json   un lien = une personne, plusieurs morceaux / vidéos
//           BEESKOT Studio/notesmix|notesvid/ext-*.json   leurs notes (écrites par le guichet)
//   Réglages partagés (pour tous les PC) : « externe.url » (adresse de la page Google),
//   « externe.cleApi » (clé gratuite Google pour lire les fichiers), « externe.perms » (accès que NOUS avons ouverts).
//
// AUCUN fichier n'est fabriqué ni envoyé : le logiciel rend le fichier du Drive lisible « avec le lien »
// tant qu'au moins un lien actif l'utilise, et RETIRE cet accès dès que plus aucun lien actif ne s'en sert
// (lien coupé…). Un accès qui existait déjà avant nous n'est jamais retiré.
//
// Ce fichier dessine aussi les petits outils des notes (réactions, couleur, cacher) pour Notes et retours
// et Notes vidéos : BK.externe.reac.
// =====================================================================
(() => {
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const DROITS = [['voir-ecrire', 'Voir + écrire', 'Voit les notes laissées via ce lien (et vos réponses), et peut écrire'], ['ecrire', 'Écrire seulement', 'Écrit ses notes, sans voir celles des autres'], ['lire', 'Lire seulement', 'Écoute / regarde et lit, sans écrire']];
const nomDroit = d => (DROITS.find(x => x[0] === d) || DROITS[2])[1];
const cle = () => { const a = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789', u = crypto.getRandomValues(new Uint8Array(8)); return [...u].map(x => a[x % a.length]).join(''); };
const moi = () => BK.reglage('nomPc', '') || 'Quelqu\'un';
const COULEURS = { Yacine: '#f1c453', Pierre: '#5fb0ff', Baptiste: '#c58af0' };
const ICONE = { audio: '♪', video: '🎥' };

BK.externe = {
  COULEUR: '#e08a5a',                                               // la couleur des invités dans les notes
  est: n => !!(n && (n.externe || /^Externe · /.test(n.auteur || ''))),
  couleurDe: q => COULEURS[q] || (/^Externe · /.test(q || '') ? BK.externe.COULEUR : '#d9b67a'),
  async url() { return String(await BK.partage.lire('externe.url', '') || '').trim(); },
  async cleApi() { return String(await BK.partage.lire('externe.cleApi', '') || '').trim(); },
  // le lien court : une « porte d'entrée » (dossier porte/) qui renvoie vers la vraie page Google. Si elle change de nom : cette ligne seulement.
  PORTE: 'https://beeskot.beeskot-music.workers.dev/',
  lien: (l, url) => url ? BK.externe.PORTE + '?k=' + encodeURIComponent(l.cle) : '',
  zones: [],

  // ---------- l'accès au fichier du Drive : ouvert tant qu'un lien actif s'en sert ----------
  async ouvrirAcces(f) {
    const l = await (await BK.drive.api(`/files/${f}/permissions?supportsAllDrives=true&fields=permissions(id,type)`)).json();
    const deja = (l.permissions || []).find(p => p.type === 'anyone');
    if (deja) return { id: deja.id, nous: false };                   // déjà lisible avant nous : on n'y touchera jamais
    const r = await (await BK.drive.api(`/files/${f}/permissions?supportsAllDrives=true&fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone', allowFileDiscovery: false }) })).json();
    if (!r.id) throw new Error('Google a refusé de partager ce fichier');
    return { id: r.id, nous: true };
  },
  async fermerAcces(f, p) {
    if (!p || !p.nous) return;
    try { await BK.drive.api(`/files/${f}/permissions/${p.id}?supportsAllDrives=true`, { method: 'DELETE' }); }
    catch (e) { if (!/404/.test(String(e.message))) throw e; }       // déjà parti (fichier effacé…) : tant mieux
  },
  // remet les accès exactement comme il faut : ouverts pour les fichiers des liens actifs, fermés pour les autres.
  // Renvoie la liste des problèmes (vide = tout est bon).
  async synchroAcces(liens) {
    const besoin = new Set(); for (const l of liens) if (l.actif !== false) for (const e of l.elements || []) if (e.fichier) besoin.add(e.fichier);
    const perms = { ...(await BK.partage.lire('externe.perms', {})) }, pb = []; let change = false;
    for (const f of besoin) if (!perms[f]) { try { perms[f] = await BK.externe.ouvrirAcces(f); change = true; } catch (e) { pb.push('Impossible de partager un fichier (' + (e.message || e) + ')'); } }
    for (const f of Object.keys(perms)) if (!besoin.has(f)) { try { await BK.externe.fermerAcces(f, perms[f]); delete perms[f]; change = true; } catch (e) { pb.push('Accès non retiré (' + (e.message || e) + ')'); } }
    if (change) await BK.partage.ecrire('externe.perms', perms);
    return pb;
  },
  // le fichier répond-il à quelqu'un sans compte ? (la clé gratuite marche, l'accès est ouvert)
  async verifier(fichier, cleApi) {
    let st = 0;
    for (let i = 0; i < 3; i++) {
      try { const r = await BK.drive.fetch(`https://www.googleapis.com/drive/v3/files/${fichier}?alt=media&key=${encodeURIComponent(cleApi)}`, { headers: { Range: 'bytes=0-1' } }); st = r.status; if (r.ok || r.status === 206) return { ok: true }; }
      catch (e) { st = 0; }
      await new Promise(r => setTimeout(r, 2500));                   // Google met parfois quelques secondes à prendre en compte le partage
    }
    return { ok: false, status: st };
  },
  async infos(id) { return (await BK.drive.api(`/files/${id}?supportsAllDrives=true&fields=id,name,size,mimeType`)).json(); },

  // ---------- les petits outils sur une note : réactions, couleur (clic droit), cacher (notes d'invités) ----------
  // Partagés par Notes et retours (collection notesmix) et Notes vidéos (notesvid).
  reac: {
    REACS: [['pouce', '👍', 'J\'aime'], ['croix', '✕', 'Pas d\'accord']],
    MARQUES: ['#d9a93c', '#c65d2a', '#7a2430', '#3f6b3a', '#2f7377', '#2a3f6a'],
    html(n) {
      const r = n.reactions || {}, me = moi();
      return BK.externe.reac.REACS.map(([k, ic, t]) => { const qui = Object.keys(r).filter(p => r[p] === k);
        return `<button class="btn xs ec-reac${r[me] === k ? ' on' : ''}" data-reac="${k}" data-n="${n.id}" title="${t}${qui.length ? ' : ' + esc(qui.join(', ')) : ''}">${ic}${qui.length ? ' ' + qui.length : ''}${qui.map(p => `<i class="ec-reac-p" style="--pc:${BK.externe.couleurDe(p)}"></i>`).join('')}</button>`; }).join('');
    },
    cacherHtml: n => BK.externe.est(n) ? `<button class="btn xs${n.cache ? ' on' : ''}" data-cacher="${n.id}" title="${n.cache ? 'Cachée : l\'invité ne la voit plus. Clic = la remontrer' : 'Cacher cette note (l\'invité ne la voit plus ; rien n\'est effacé)'}">${n.cache ? 'Cachée' : 'Cacher'}</button>` : '',
    classes: n => (BK.externe.est(n) ? ' externe' : '') + (n.cache ? ' cache' : '') + (n.couleur ? ' marquee' : ''),
    style: n => n.couleur ? ';--marque:' + esc(n.couleur) : '',
    // z = la zone de la liste ; trouver(id) = la note ; col = 'notesmix' | 'notesvid'
    brancher(z, trouver, col, redessiner, msg) {
      const q = s => [...z.querySelectorAll(s)];
      q('[data-reac]').forEach(b => b.onclick = async () => { const n = trouver(b.dataset.n); if (!n) return; n.reactions = n.reactions || {};
        if (n.reactions[moi()] === b.dataset.reac) delete n.reactions[moi()]; else n.reactions[moi()] = b.dataset.reac; await BK.db.ecrire(col, n); redessiner(); });
      q('.ec-n').forEach(el => el.oncontextmenu = e => { e.preventDefault(); const n = trouver(el.dataset.n); if (n) BK.externe.reac.palette(n, col, e.clientX, e.clientY, redessiner); });
      q('[data-cacher]').forEach(b => b.onclick = async () => { const n = trouver(b.dataset.cacher); if (!n) return; n.cache = !n.cache; await BK.db.ecrire(col, n); redessiner();
        msg && msg(n.cache ? 'Note cachée : l\'invité ne la voit plus' : 'Note de nouveau visible pour l\'invité'); });
    },
    palette(n, col, x, y, redessiner) {
      document.querySelectorAll('.ec-palette').forEach(e => e.remove());
      const p = document.createElement('div'); p.className = 'ec-palette';
      p.innerHTML = BK.externe.reac.MARQUES.map(c => `<button data-c="${c}" class="${n.couleur === c ? 'on' : ''}" style="--c:${c}" title="Marquer de cette couleur"></button>`).join('') + '<button data-c="" class="aucune" title="Enlever la couleur">✕</button>';
      p.style.left = Math.min(x, innerWidth - 230) + 'px'; p.style.top = Math.min(y, innerHeight - 50) + 'px';
      p.onclick = async e => { const b = e.target.closest('[data-c]'); if (!b) return; p.remove();
        const c = b.dataset.c === n.couleur ? '' : b.dataset.c; if (c) n.couleur = c; else delete n.couleur; await BK.db.ecrire(col, n); redessiner(); };
      document.body.appendChild(p);
      setTimeout(() => document.addEventListener('pointerdown', e => { if (!p.contains(e.target)) p.remove(); }, { once: true }), 0);
    },
  },

  // ---------- le sous-onglet « Externe » ----------
  // ctx : { type: 'audio' | 'video', msg(t),
  //         audio : morceaux() → [{id, nom}], versions(m) → [{v, nom}], courant() → { m, v }
  //         video : (rien de plus : le choix passe par la fenêtre Médias) }
  dessiner(zone, ctx) {
    const X = { liens: [], notes: [], choisis: [], opts: [], morceaux: [], tournages: [] }, audio = ctx.type === 'audio';
    zone.innerHTML = `
      <section class="pane reg ex-liens"><span class="ptitle">Liens</span>
        <div class="box grow ex-liste" id="exListe"><span class="nt">Chargement…</span></div></section>
      <section class="pane vit ex-droite">
        <div class="box ex-nouveau">
          <span class="lb">Nouveau lien</span>
          <label><span class="eng">Où ?</span><select class="fld" id="exOu"><option value="">Un nouveau lien</option></select></label>
          <div class="ex-champs" id="exChamps">
            <div class="ex-ligne"><label><span class="eng">Pour qui</span><input class="fld" id="exNom" placeholder="Ex. Léo (mix)" maxlength="40"></label>
              <label><span class="eng">Droit</span><select class="fld" id="exDroit">${DROITS.map(d => `<option value="${d[0]}" title="${esc(d[2])}">${d[1]}</option>`).join('')}</select></label></div>
            <label><span class="eng">Petit mot pour l'invité (facultatif)</span><input class="fld" id="exMot" placeholder="Ex. Dis-nous surtout ce que tu penses des voix" maxlength="200"></label>
          </div>
          <span class="eng ex-t">${audio ? 'Morceaux (des exports qui sont dans le Drive)' : 'Vidéos (qui sont dans le Drive)'}</span>
          ${audio ? `<div class="ex-ligne ex-ajout"><select class="fld" id="exM"><option value="">— morceau</option></select><select class="fld" id="exV"><option value="">— version</option></select><button class="btn sm" id="exPlus">＋ Ajouter</button></div>`
            : `<div class="ex-ligne ex-ajout"><button class="btn sm" id="exMed">🎥 Choisir dans Médias…</button><select class="fld" id="exRel" title="Le morceau ou le tournage de cette vidéo (comme dans Notes)"><option value="">— relié à : morceau ou tournage —</option></select></div>`}
          <div class="ex-choisis" id="exChoisis"></div>
          <label class="ex-ab hidden" id="exABbox"><input type="checkbox" id="exAB"> <b>Proposer en A/B</b> <span class="nt">· l'invité bascule entre les 2 versions sans perdre sa place, et ses notes sont marquées A ou B</span></label>
          <div class="ex-ligne"><button class="btn pri" id="exCreer">🔗 Créer le lien</button><span class="nt">Rien n'est fabriqué ni envoyé : le fichier du Drive devient lisible avec le lien, et c'est retiré quand tu coupes le lien.</span></div>
        </div>
        <div class="box ex-url" id="exCleBox">
          <span class="lb">Clé gratuite Google (pour lire les fichiers)</span>
          <div class="ex-ligne"><input class="fld" id="exCle" placeholder="AIza…"><button class="btn sm" id="exCleOk">💾 Garder</button></div>
          <span class="nt">Une seule fois, pour tous les PC (voir le LISEZ-MOI du dossier partage-externe, étape 7). Gratuite, sans carte bancaire.</span>
        </div>
        <div class="box ex-url" id="exUrlBox">
          <span class="lb">La page web (chez Google)</span>
          <div class="ex-ligne"><input class="fld" id="exUrl" placeholder="https://script.google.com/macros/s/…/exec"><button class="btn sm" id="exUrlOk">💾 Garder</button></div>
          <span class="nt">Une seule fois, pour tous les PC : l'adresse de la page Apps Script (voir le LISEZ-MOI du dossier partage-externe).</span>
        </div>
      </section>`;
    const $ = (s, r) => (r || zone).querySelector(s), $$ = (s, r) => [...(r || zone).querySelectorAll(s)];
    const msg = ctx.msg || (() => {});

    // ---- la liste des liens ----
    async function charger() {
      const [liens, a, v] = await Promise.all([BK.db.liste('partages').catch(() => []), BK.db.liste('notesmix').catch(() => []), BK.db.liste('notesvid').catch(() => [])]);
      X.liens = liens; X.notes = [...a, ...v].filter(n => n.partage);
      [X.url, X.cle] = await Promise.all([BK.externe.url(), BK.externe.cleApi()]);
      $('#exUrl').value = X.url; $('#exUrlBox').classList.toggle('vide', !X.url); $('#exCle').value = X.cle; $('#exCleBox').classList.toggle('vide', !X.cle);
      const sel = $('#exOu'), avant = sel.value;
      sel.innerHTML = '<option value="">Un nouveau lien</option>' + liens.filter(l => l.actif !== false).sort((a, b) => (b.cree || '').localeCompare(a.cree || '')).map(l => `<option value="${l.id}">Ajouter au lien de ${esc(l.nom)}</option>`).join('');
      sel.value = avant; if (sel.value !== avant) sel.value = ''; majOu();
      dessinerListe();
    }
    function majOu() { const ex = !!$('#exOu').value; $('#exChamps').classList.toggle('hidden', ex); $('#exCreer').textContent = ex ? '＋ Ajouter au lien' : '🔗 Créer le lien'; }
    $('#exOu').onchange = () => { $('#exOu').blur(); majOu(); };
    const icones = l => (l.elements || []).map(e => `<div class="nt">${ICONE[e.type] || ''} ${esc(e.nom)}${e.versionNom ? ' <i>· ' + esc(e.versionNom) + '</i>' : ''}</div>`).join('') || '<div class="nt">aucun fichier</div>';
    function dessinerListe() {
      const l = [...X.liens].sort((a, b) => (b.cree || '').localeCompare(a.cree || ''));
      $('#exListe').innerHTML = l.length ? l.map(x => { const ns = X.notes.filter(n => n.partage === x.id), caches = ns.filter(n => n.cache).length, lien = BK.externe.lien(x, X.url);
        return `<div class="ex-lien${x.actif === false ? ' coupe' : ''}" data-l="${x.id}">
          <div class="ex-lien-t"><b>${esc(x.nom)}</b><span class="ex-etiq">${x.actif === false ? 'Coupé' : nomDroit(x.droit)}</span></div>
          ${icones(x)}
          <div class="nt">${ns.length} note(s) reçue(s)${caches ? ' · ' + caches + ' cachée(s)' : ''}${x.cree ? ' · créé le ' + new Date(x.cree).toLocaleDateString('fr-CA') : ''}</div>
          <div class="ex-lien-b">
            ${x.actif === false ? `<button class="btn xs" data-on="${x.id}">↻ Réactiver</button>` : `<button class="btn xs" data-copier="${x.id}" ${lien ? '' : 'disabled title="Colle d\'abord l\'adresse de la page web"'}>🔗 Copier le lien</button>
            <div class="seg ex-seg">${DROITS.map(d => `<button data-droit="${d[0]}" data-l="${x.id}" class="${x.droit === d[0] ? 'on' : ''}" title="${esc(d[2])}">${d[1]}</button>`).join('')}</div>
            <button class="btn xs" data-off="${x.id}" title="Le lien ne marche plus tout de suite et le fichier n'est plus lisible avec le lien. Rien n'est effacé, on peut le réactiver.">✕ Couper</button>`}
            <button class="btn xs" data-suppr="${x.id}" title="Enlève le lien de la liste (il va dans la corbeille du Drive). Les notes déjà reçues restent.">🗑 Supprimer</button>
          </div></div>`; }).join('')
        : '<span class="nt">Pas encore de lien. Crée-en un à droite : une personne, un ou plusieurs fichiers du Drive, un droit.</span>';
      $$('[data-copier]').forEach(b => b.onclick = async () => { const x = X.liens.find(y => y.id === b.dataset.copier); try { await navigator.clipboard.writeText(BK.externe.lien(x, X.url)); msg('Lien de ' + x.nom + ' copié : envoie-le en message privé'); } catch (e) { msg('Copie impossible'); } });
      $$('[data-droit]').forEach(b => b.onclick = async () => { const x = X.liens.find(y => y.id === b.dataset.l); if (!x || x.droit === b.dataset.droit) return; x.droit = b.dataset.droit; await BK.db.ecrire('partages', x, { sansAnnuler: true }); dessinerListe(); msg(x.nom + ' : ' + nomDroit(x.droit)); });
      $$('[data-off]').forEach(b => b.onclick = async () => { const x = X.liens.find(y => y.id === b.dataset.off);
        if (!await BK.confirmer('Couper le lien de ' + x.nom + ' ? Il ne marchera plus et le fichier ne sera plus lisible avec le lien (rien n\'est effacé).')) return;
        x.actif = false; await BK.db.ecrire('partages', x, { sansAnnuler: true }); const pb = await BK.externe.synchroAcces(X.liens).catch(e => [e.message]); dessinerListe();
        msg(pb.length ? 'Lien coupé, mais : ' + pb[0] : 'Lien de ' + x.nom + ' coupé, accès au fichier retiré'); });
      $$('[data-suppr]').forEach(b => b.onclick = async () => { const x = X.liens.find(y => y.id === b.dataset.suppr); if (!x) return;
        if (!await BK.confirmer('Supprimer le lien de ' + x.nom + ' ? Il ne marchera plus et disparaît de la liste (il va dans la corbeille du Drive). Les notes déjà reçues restent.')) return;
        b.disabled = true; x.actif = false; await BK.db.ecrire('partages', x, { sansAnnuler: true });
        const reste = X.liens.filter(y => y !== x), pb = await BK.externe.synchroAcces(reste).catch(e => [e.message]);
        await BK.db.supprimer('partages', x.id, { sansAnnuler: true }); X.liens = reste; const o = $('#exOu').querySelector('option[value="' + x.id + '"]'); if (o) { if ($('#exOu').value === x.id) { $('#exOu').value = ''; majOu(); } o.remove(); } dessinerListe();
        msg(pb.length ? 'Lien supprimé, mais : ' + pb[0] : 'Lien de ' + x.nom + ' supprimé, accès au fichier retiré'); });
      $$('[data-on]').forEach(b => b.onclick = async () => { const x = X.liens.find(y => y.id === b.dataset.on); x.actif = true;
        const pb = await BK.externe.synchroAcces(X.liens).catch(e => [e.message]); if (pb.length) { x.actif = false; await BK.externe.synchroAcces(X.liens).catch(() => {}); return msg('Réactivation impossible : ' + pb[0]); }
        await BK.db.ecrire('partages', x, { sansAnnuler: true }); dessinerListe(); msg('Lien de ' + x.nom + ' réactivé'); });
    }

    // ---- la clé gratuite et l'adresse de la page ----
    $('#exCleOk').onclick = async () => { const k = $('#exCle').value.trim(); if (k && !/^AIza[\w-]{20,}$/.test(k)) return msg('Une clé Google commence par AIza…');
      await BK.partage.ecrire('externe.cleApi', k); X.cle = k; $('#exCleBox').classList.toggle('vide', !k); msg(k ? 'Clé gardée pour tous les PC' : 'Clé retirée'); };
    $('#exUrlOk').onclick = async () => { const u = $('#exUrl').value.trim(); if (u && !/^https:\/\/script\.google\.com\//.test(u)) return msg('L\'adresse doit commencer par https://script.google.com/');
      await BK.partage.ecrire('externe.url', u); X.url = u; $('#exUrlBox').classList.toggle('vide', !u); dessinerListe(); msg(u ? 'Adresse de la page gardée pour tous les PC' : 'Adresse retirée'); };
    ['#exCle', '#exUrl', '#exNom', '#exMot'].forEach(s => $(s).addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && s === '#exCle') $('#exCleOk').click(); if (e.key === 'Enter' && s === '#exUrl') $('#exUrlOk').click(); }));

    // ---- les fichiers du nouveau lien ----
    function dessinerChoisis() {
      $('#exChoisis').innerHTML = X.choisis.length ? X.choisis.map((c, i) => `<div class="ex-choisi">${ICONE[c.type]} <b>${esc(c.nom)}</b><span class="nt">${c.versionNom ? '· ' + esc(c.versionNom) : ''}${c.taille ? ' · ' + Math.round(c.taille / 1e6) + ' Mo' : ''}</span><button class="btn xs" data-ret="${i}" title="Retirer">✕</button></div>`).join('')
        : `<span class="nt">${audio ? 'Aucun morceau pour l\'instant. Choisis un morceau et sa version, puis ＋ Ajouter.' : 'Aucune vidéo pour l\'instant. Choisis-en une dans Médias.'}</span>`;
      $$('[data-ret]').forEach(b => b.onclick = () => { X.choisis.splice(+b.dataset.ret, 1); dessinerChoisis(); });
      const peutAB = X.choisis.length === 2 && X.choisis[0].type === X.choisis[1].type; $('#exABbox').classList.toggle('hidden', !peutAB); if (!peutAB) $('#exAB').checked = false;
    }
    dessinerChoisis();
    const ajoutElement = async (el) => {
      if (X.choisis.some(c => c.id === el.id)) return msg('Déjà dans le lien');
      try { const i = await BK.externe.infos(el.fichier); el.taille = +i.size || 0; el.mime = i.mimeType || ''; } catch (e) { return msg('Fichier introuvable dans le Drive'); }
      X.choisis.push(el); dessinerChoisis();
    };
    if (audio) {
      const remplirMorceaux = async () => { X.morceaux = await ctx.morceaux(); const s = $('#exM'), avant = s.value;
        s.innerHTML = '<option value="">— morceau</option>' + X.morceaux.map(m => `<option value="${m.id}">${esc(m.nom)}</option>`).join(''); s.value = avant;
        if (!s.value) { const c = ctx.courant && ctx.courant(); if (c && c.m) { s.value = c.m.id; await remplirVersions(c.v); } } };
      const remplirVersions = async pref => { const m = X.morceaux.find(x => x.id === $('#exM').value), s = $('#exV');
        s.innerHTML = '<option value="">recherche…</option>'; X.opts = m ? (await ctx.versions(m)).filter(o => String(o.v).startsWith('drive:')) : [];
        s.innerHTML = X.opts.length ? '<option value="">— version</option>' + X.opts.map(o => `<option value="${esc(o.v)}">${o.v === (m || {}).exportPrincipal ? '★ ' : ''}${esc(o.nom)}</option>`).join('') : '<option value="">aucun export dans le Drive</option>';
        s.value = pref && X.opts.some(o => o.v === pref) ? pref : (X.opts.find(o => o.v === (m || {}).exportPrincipal) || X.opts[0] || {}).v || ''; };
      $('#exM').onchange = () => { $('#exM').blur(); remplirVersions(); };
      $('#exPlus').onclick = async () => { const m = X.morceaux.find(x => x.id === $('#exM').value), o = X.opts.find(x => x.v === $('#exV').value);
        if (!m || !o) return msg('Choisis un morceau et une version qui est dans le Drive');
        await ajoutElement({ id: 'a-' + m.id, type: 'audio', nom: m.nom, versionNom: o.nom, fichier: String(o.v).slice(6), morceau: m.id, version: o.v }); };
      zone._remplir = remplirMorceaux;
    } else {
      const remplirRel = async () => { [X.morceaux, X.tournages] = await Promise.all([BK.db.liste('morceaux').catch(() => []), BK.db.liste('tournages').catch(() => [])]);
        X.morceaux.sort((a, b) => a.nom.localeCompare(b.nom)); const tours = X.tournages.filter(t => t.niveau === 'tournage' || !t.parent).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        $('#exRel').innerHTML = '<option value="">— relié à : morceau ou tournage —</option><optgroup label="Morceaux">' + X.morceaux.map(m => `<option value="m:${esc(m.id)}">${esc(m.nom)}</option>`).join('') + '</optgroup>'
          + '<optgroup label="Tournages">' + tours.map(t => `<option value="t:${esc(t.id)}">${esc(t.titre || 'Tournage')}${t.date ? ' · ' + esc(t.date) : ''}</option>`).join('') + '</optgroup>'; };
      $('#exMed').onclick = async () => {
        const l = await BK.choisirDansMedias({ titre: 'Une vidéo à partager', bouton: 'Choisir', type: 'video' }); if (!l || !l[0]) return; const x = l[0];
        if (x.file || x.dc || !x.id) return msg('Il faut une vidéo qui est dans le Drive (Médias › Drive), pas sur un PC ni sur Discord');
        const nom = x.name || x.nom || 'vidéo', m = BK.inv && BK.inv.trouverMorceau(nom, X.morceaux);
        await ajoutElement({ id: 'v-' + x.id, type: 'video', nom, versionNom: '', fichier: String(x.id), lien: $('#exRel').value || (m ? 'm:' + m.id : '') }); };
      zone._remplir = remplirRel;
    }

    // un lien bloqué : fenêtre qui explique, et ce qu'il faut remplir brille en rouge
    const bloque = async (texte, cible) => { const el = typeof cible === 'string' ? $(cible) : cible;
      if (el) { el.classList.remove('ex-rouge'); void el.offsetWidth; el.classList.add('ex-rouge'); el.scrollIntoView && el.scrollIntoView({ block: 'center' }); setTimeout(() => el.classList.remove('ex-rouge'), 6000);
        const off = () => { el.classList.remove('ex-rouge'); el.removeEventListener('input', off); el.removeEventListener('change', off); }; el.addEventListener('input', off); el.addEventListener('change', off); }
      msg(texte); await BK.confirmer(texte, { oui: 'OK', non: 'Fermer' }); if (el && el.focus) el.focus(); };
    // ---- créer le lien (ou ajouter à un lien) : on ouvre l'accès aux fichiers, on vérifie, puis on range la fiche ----
    $('#exCreer').onclick = async () => {
      const existant = X.liens.find(l => l.id === $('#exOu').value), nom = $('#exNom').value.trim();
      if (!existant && !nom) return bloque('Écris d\'abord pour qui est ce lien (le prénom de la personne).', '#exNom');
      if (!X.choisis.length) return bloque(audio ? 'Tu dois d\'abord ajouter au moins un morceau ! Choisis un morceau et sa version, puis clique sur ＋ Ajouter.' : 'Tu dois d\'abord ajouter au moins une vidéo ! Clique sur « Choisir dans Médias… ».', audio ? '#exPlus' : '#exMed');
      if (!BK.drive.relie()) return bloque('Il faut d\'abord relier le Drive (Réglages › Drive).', null);
      if (!X.cle) return bloque('Il manque la clé gratuite Google (la case en bas à droite). Sans elle, le lien ne peut pas lire les fichiers.', '#exCle');
      if (!existant && !X.url) return bloque('Il manque l\'adresse de la page web (la case en bas à droite). Sans elle, le lien ne peut pas s\'ouvrir.', '#exUrl');
      const b = $('#exCreer'); b.disabled = true;
      try {
        const l = existant || { nom, droit: $('#exDroit').value, mot: $('#exMot').value.trim(), cle: cle(), actif: true, elements: [], cree: new Date().toISOString(), cleApi: X.cle };
        const avant = [...(l.elements || [])]; l.elements = [...avant, ...X.choisis.filter(c => !avant.some(a => a.id === c.id))]; l.cleApi = X.cle;
        l.ab = $('#exAB').checked && l.elements.length === 2 && l.elements[0].type === l.elements[1].type;
        msg('Ouverture de l\'accès aux fichiers…');
        const autres = existant ? X.liens : [...X.liens, l], pb = await BK.externe.synchroAcces(autres).catch(e => [e.message || String(e)]);
        if (pb.length) { l.elements = avant; await BK.externe.synchroAcces(X.liens).catch(() => {}); throw new Error(pb[0]); }
        msg('Vérification que le lien Drive répond…'); const t = await BK.externe.verifier(X.choisis[0].fichier, X.cle);
        await BK.db.ecrire('partages', l, { sansAnnuler: true }); if (!existant) X.liens.push(l);
        X.choisis = []; $('#exNom').value = ''; $('#exMot').value = ''; dessinerChoisis(); await charger();
        const url = BK.externe.lien(l, X.url); if (url && !existant) { try { await navigator.clipboard.writeText(url); } catch (e) {} }
        msg(!t.ok ? `Lien ${existant ? 'mis à jour' : 'créé'}, mais Google ne répond pas encore (${t.status || 'rien'}) : vérifie la clé, ou réessaie dans une minute`
          : existant ? 'Ajouté au lien de ' + l.nom : url ? 'Lien de ' + l.nom + ' créé et copié : envoie-le en message privé' : 'Lien créé. Colle l\'adresse de la page web pour pouvoir le copier');
      } catch (e) { msg('Impossible : ' + (e.message || e)); }
      b.disabled = false;
    };

    BK.externe.zones.push({ zone, charger });
    zone._ouvrir = async () => { await charger(); zone._remplir && await zone._remplir(); };
    return zone;
  },
};
// quand un autre PC change un lien : toutes les zones visibles se rafraîchissent
BK.externeRecharger = () => BK.externe.zones.forEach(z => { if (!z.zone.classList.contains('hidden') && z.zone.offsetParent !== null) z.charger(); });
})();
