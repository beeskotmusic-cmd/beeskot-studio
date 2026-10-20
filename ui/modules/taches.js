// =====================================================================
// TO-DO LIST — en haut, les tâches « en vrac » (personne encore) ;
// en bas, une ligne de paniers : Yacine, Pierre, Baptiste, BEESKOT.
// On attrape une tâche (clic maintenu) et on la lâche dans un panier.
// Ou : un clic sur la tâche, puis un clic sur le panier.
// Une tâche = un petit fichier dans le Drive (partagé avec tout le groupe).
// =====================================================================
(() => {
const T = { taches: [], membres: [], masquerFaites: true, morceaux: [], choisie: null, serres: BK.reglage('todo.serres', {}), faitesPli: BK.reglage('todo.faitesPli', false) };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MEMBRES_DEFAUT = ['Yacine', 'Pierre', 'Baptiste'];
const GROUPE = 'BEESKOT';
const ANCIENS = { 'Dari': 'Yacine', 'Tout le groupe': GROUPE };       // anciens noms → nouveaux

BK.module('taches', function (page) {
  $('.sub', page).textContent = 'Attrape une tâche et lâche-la dans un panier';
  $('.hdr .right', page).innerHTML = `<div><span class="eng" style="font-size:9px">À faire</span><span class="vfd" id="taNb">00</span></div>
    <div><span class="eng" style="font-size:9px">En retard</span><span class="vfd" id="taRet">00</span></div>`;
  $('.grid', page).innerHTML = `
    <div class="cols">
      <section class="pane vit todo-vit">
        <div class="box todo-ajout">
          <input class="fld" id="taTexte" placeholder="Écris une tâche, puis Entrée…" autocomplete="off">
          <select class="fld" id="taMorceau"><option value="">morceau…</option></select>
          <input class="fld" id="taDate" type="date" title="Pour quand ?">
          <button class="btn pri" id="taAjout">+ Ajouter</button>
        </div>
        <div class="box grow todo-vrac zone" data-zone="">
          <span class="lb">Tâches en vrac</span>
          <div class="vrac-cartes" id="taVrac"></div>
        </div>
        <div class="paniers" id="taPaniers"></div>
      </section>
      <section class="pane reg" style="width:300px"><span class="ptitle">② Miette et réglages</span>
        <div class="box todo-miette" id="taMiette"></div>
        <div class="box grow ta-faites-box zone" data-zone="__fait"><button class="lb ta-plier" id="taFaitesPli">▾ ✓ Déjà fait <span id="taNbF"></span></button><div class="ta-faites" id="taFaites"></div></div>
        <div class="box" id="taPanBox"><button class="lb ta-plier" id="taPanPli">▾ Paniers</button>
          <span class="nt">Les membres, séparés par des virgules. Le panier BEESKOT est toujours là.</span>
          <input class="fld" id="taMembres" style="margin-top:8px"></div>
      </section>
    </div>
    <div class="pane abar"><span class="vfd" id="taMsg">PRÊT</span>
      <span class="nt" style="margin:0 12px">Double-clic sur une tâche pour la modifier · ✕ pour la retirer</span></div>`;
  const msg = t => $('#taMsg').textContent = String(t).toUpperCase();

  window.addEventListener('bk:annule', () => charger());   // après « ↶ Annuler » : on relit
  async function charger() {
    T.taches = await BK.db.liste('taches');
    const cfg = (await BK.db.liste('config')).find(c => c.id === 'membres');
    T.membres = (cfg && cfg.liste && cfg.liste.length ? cfg.liste : MEMBRES_DEFAUT).map(m => ANCIENS[m] || m).filter(m => m !== GROUPE);
    if (cfg && cfg.liste && cfg.liste.some(m => ANCIENS[m])) await BK.db.ecrire('config', { id: 'membres', liste: T.membres });
    for (const t of T.taches) if (ANCIENS[t.qui]) { t.qui = ANCIENS[t.qui]; await BK.db.ecrire('taches', t); }
    T.morceaux = (await BK.db.liste('morceaux')).map(m => m.nom).sort();
    $('#taMorceau').innerHTML = '<option value="">morceau…</option>' + T.morceaux.map(m => `<option>${esc(m)}</option>`).join('');
    $('#taMembres').value = T.membres.join(', ');
    rendre(); miette();
  }

  // ---------- 🍞 Miette propose des tâches lues sur Discord ----------
  async function miette() {
    const z = $('#taMiette'), pret = await BK.ia.pret().catch(() => false), d = BK.discord ? await BK.discord.config().catch(() => ({})) : {};
    const props = (await BK.db.liste('propositions')).filter(p => p.type === 'tache' && p.statut === 'attente').sort((a, b) => (b.vu || '').localeCompare(a.vu || ''));
    T.props = props;
    const bouton = `<button class="btn sm${props.length ? '' : ' pri'}" id="taLire"${!pret || !d.jeton ? ' disabled title="Il faut Miette (Discord) et la clé Gemini : Réglages"' : ''}>${T.lecture ? '<span class="spin"></span>Miette lit Discord…' : '🍞 Lire Discord et proposer des tâches'}</button>`;
    const ouvert = BK.reglage('todo.mietteOuvert', true);
    z.classList.toggle('replie', !ouvert);
    z.innerHTML = `<div class="ligne-titre"><button class="lb ta-plier" id="taPlier" title="Ouvrir / replier">${ouvert ? '▾' : '▸'} 🍞 Miette propose (${props.length})</button>
        ${props.length > 1 ? '<button class="btn xs pri" id="taToutOk" style="margin-left:auto">✓ Tout ajouter</button>' : ''}<span style="${props.length > 1 ? '' : 'margin-left:auto'}">${bouton}</span></div>
      ${props.length ? `<div class="ta-props">${props.slice(0, 12).map(p => `<div class="ta-prop" data-p="${p.id}">
          <div class="carte-c"><span class="carte-t">${esc(p.texte)}</span><span class="carte-m">${esc([p.qui && '→ ' + p.qui, p.morceau, p.date && 'pour le ' + p.date].filter(Boolean).join(' · '))}${p.pourquoi ? ' — « ' + esc(p.pourquoi) + ' »' : ''}</span></div>
          <button class="btn xs pri" data-pok="${p.id}" title="Ajouter à la liste">✓</button><button class="btn xs" data-pnon="${p.id}" title="Ignorer">✕</button></div>`).join('')}</div>`
        : `<span class="nt">${pret && d.jeton ? 'Miette lit vos messages Discord (toutes les 30 min) et prépare ici les tâches qui en ressortent. Tu valides d\'un clic.' : 'Ajoute Miette (Discord) et la clé Gemini dans les Réglages : elle lira vos messages et préparera les tâches ici.'}</span>`}`;
    $('#taPlier').onclick = () => { BK.regler('todo.mietteOuvert', !BK.reglage('todo.mietteOuvert', true)); miette(); };
    const lb = $('#taLire'); if (lb) lb.onclick = async () => {
      T.lecture = true; miette();
      try { await BK.discord.ronde(msg, true).catch(() => {}); const n = await BK.discord.tachesProposer(); msg(n ? n + ' tâche(s) proposée(s)' : 'Rien de nouveau à faire'); }
      catch (e) { msg(e.message); }
      T.lecture = false; miette();
    };
    $$('[data-pok]', z).forEach(b => b.onclick = () => accepter([T.props.find(p => p.id === b.dataset.pok)]));
    $$('[data-pnon]', z).forEach(b => b.onclick = async () => { const p = T.props.find(x => x.id === b.dataset.pnon); p.statut = 'non'; await BK.db.ecrire('propositions', p); miette(); });
    const to = $('#taToutOk'); if (to) to.onclick = () => accepter(T.props);
  }
  (BK.surOuvrir = BK.surOuvrir || {}).taches = () => { if (!T.lecture) miette(); };
  window.addEventListener('bk:change', e => { if (e.detail.col === 'propositions' && !T.lecture && !page.classList.contains('hidden')) { clearTimeout(T.mt); T.mt = setTimeout(miette, 400); } });
  async function accepter(l) {
    for (const p of l) {
      const qui = p.qui === GROUPE || T.membres.includes(p.qui) ? p.qui : '';
      const n = await BK.db.ecrire('taches', { texte: p.texte, qui, morceau: T.morceaux.includes(p.morceau) ? p.morceau : '', date: /^\d{4}-\d\d-\d\d$/.test(p.date || '') ? p.date : '', fait: false, ordre: Date.now(), discord: p.source || '' });
      T.taches.push(n); p.statut = 'ok'; await BK.db.ecrire('propositions', p);
    }
    msg(l.length > 1 ? l.length + ' tâches ajoutées' : 'Tâche ajoutée'); rendre(); miette();
  }
  BK.tachesRecharger = charger;

  const tri = (a, b) => (a.fait - b.fait) || (a.ordre ?? 0) - (b.ordre ?? 0);
  function carte(t, auj) {
    const meta = [t.morceau, t.date && 'pour le ' + new Date(t.date + 'T12:00').toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' })].filter(Boolean);
    return `<div class="carte${t.fait ? ' faite' : ''}${!t.fait && t.date && t.date < auj ? ' retard' : ''}${T.choisie === t.id ? ' choisie' : ''}" data-id="${t.id}">
      <button class="ta-case${t.fait ? ' on' : ''}" data-case="${t.id}" title="Fait">${t.fait ? '✓' : ''}</button>
      <div class="carte-c"><span class="carte-t">${esc(t.texte)}</span>${meta.length ? `<span class="carte-m">${meta.map(esc).join(' · ')}</span>` : ''}</div>
      <button class="carte-x" data-x="${t.id}" title="Retirer">✕</button></div>`;
  }

  function rendre() {
    const auj = new Date().toISOString().slice(0, 10), afaire = T.taches.filter(t => !t.fait);
    $('#taNb').textContent = String(afaire.length).padStart(2, '0');
    $('#taRet').textContent = String(afaire.filter(t => t.date && t.date < auj).length).padStart(2, '0');
    const de = qui => T.taches.filter(t => (t.qui || '') === qui && !(T.masquerFaites && t.fait)).sort(tri);
    const vrac = de('');
    $('#taVrac').innerHTML = vrac.length ? vrac.map(t => carte(t, auj)).join('')
      : '<span class="nt vrac-vide">Aucune tâche en vrac. Écris-en une au-dessus.</span>';
    $('#taPaniers').style.gridTemplateColumns = `repeat(${T.membres.length + 1}, minmax(0, 1fr))`;
    $('#taPaniers').innerHTML = [...T.membres, GROUPE].map(c => {
      const l = de(c);
      const serre = T.serres[c] ?? (l.length > 3);                    // beaucoup de tâches : une ligne chacune
      return `<div class="panier zone${c === GROUPE ? ' groupe' : ''}${serre ? ' serre' : ''}" data-zone="${esc(c)}">
        <button class="panier-tete" data-serre="${esc(c)}" title="${serre ? 'Tout afficher' : 'Mettre en liste'}"><span class="ta-nom">${esc(c)}</span>
          <span class="col-nb">${l.filter(t => !t.fait).length || ''}</span><span class="panier-pli">${serre ? '▸' : '▾'}</span></button>
        <div class="panier-cartes">${l.map(t => carte(t, auj)).join('')}</div></div>`;
    }).join('');
    $('.todo-vit').classList.toggle('en-choix', !!T.choisie);
    $$('[data-serre]').forEach(b => b.onclick = e => { e.stopPropagation(); const c = b.dataset.serre;
      const l = T.taches.filter(t => (t.qui || '') === c && !(T.masquerFaites && t.fait));
      T.serres[c] = !(T.serres[c] ?? (l.length > 3)); BK.regler('todo.serres', T.serres); rendre(); });
    // l'historique : tout ce qui a été fait, et par qui
    const faites = T.taches.filter(t => t.fait).sort((a, b) => (b.faitLe || b.maj || '').localeCompare(a.faitLe || a.maj || ''));
    $('.ta-faites-box').classList.toggle('replie', T.faitesPli);
    $('#taFaitesPli').innerHTML = `${T.faitesPli ? '▸' : '▾'} ✓ Déjà fait <span id="taNbF">${faites.length ? '(' + faites.length + ')' : ''}</span>`;
    $('#taFaites').innerHTML = faites.length ? faites.slice(0, 60).map(t => `<div class="ta-f"><span class="ta-f-t">${esc(t.texte)}</span>
        <span class="ta-f-m">${esc(t.qui || 'en vrac')}${t.faitLe ? ' · ' + new Date(t.faitLe).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' }) : ''}${t.faitPar ? ' · coché sur ' + esc(t.faitPar) : ''}</span>
        <button class="btn xs" data-case="${t.id}" title="Remettre à faire">↩</button></div>`).join('') : '<span class="nt">Rien de fait pour l\'instant.</span>';
  }

  // ---------- ajouter ----------
  async function ajouter() {
    const texte = $('#taTexte').value.trim(); if (!texte) return $('#taTexte').focus();
    const n = await BK.db.ecrire('taches', { texte, qui: '', morceau: $('#taMorceau').value, date: $('#taDate').value, fait: false, ordre: Date.now() });
    T.taches.push(n); $('#taTexte').value = ''; $('#taTexte').focus(); msg('Tâche ajoutée'); rendre();
  }
  $('#taAjout').onclick = ajouter;
  $('#taTexte').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); ajouter(); } });

  // ---------- déplacer une tâche vers un panier ----------
  async function deplacer(id, qui) {
    const t = T.taches.find(x => x.id === id); T.choisie = null;
    if (qui === '__fait') { if (!t || t.fait) return rendre(); t.fait = true; t.faitLe = new Date().toISOString(); t.faitPar = BK.reglage('nomPc', '') || 'ce PC'; rendre(); await BK.db.ecrire('taches', t); return msg('Bravo ! (rangée dans « Déjà fait »)'); }
    if (!t || (t.qui || '') === qui) return rendre();
    t.qui = qui; t.ordre = Date.now(); rendre();
    await BK.db.ecrire('taches', t); msg(qui ? 'Pour ' + qui : 'Remise en vrac');
  }

  // attraper au clic maintenu (souris ou doigt) ; un simple clic = choisir puis cliquer un panier
  const zoneSous = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest('.todo-vit .zone, .ta-faites-box.zone'); };
  let g = null;
  const vit = $('.todo-vit');
  vit.addEventListener('pointerdown', e => {
    const c = e.target.closest('.carte'); if (!c || e.button !== 0 || e.target.closest('button') || c.querySelector('[contenteditable=true]')) return;
    g = { id: c.dataset.id, carte: c, x: e.clientX, y: e.clientY, fantome: null };
  });
  window.addEventListener('pointermove', e => {
    if (!g) return;
    if (!g.fantome) {
      if (Math.hypot(e.clientX - g.x, e.clientY - g.y) < 6) return;
      const r = g.carte.getBoundingClientRect();
      g.fantome = g.carte.cloneNode(true); g.fantome.classList.add('fantome'); g.fantome.style.width = r.width + 'px';
      g.dx = g.x - r.left; g.dy = g.y - r.top; document.body.appendChild(g.fantome); g.carte.classList.add('glisse');
    }
    g.fantome.style.left = (e.clientX - g.dx) + 'px'; g.fantome.style.top = (e.clientY - g.dy) + 'px';
    $$('.todo-vit .zone, .ta-faites-box').forEach(z => z.classList.remove('survol'));
    const z = zoneSous(e.clientX, e.clientY); z && z.classList.add('survol');
  });
  window.addEventListener('pointerup', e => {
    if (!g) return; const d = g; g = null;
    $$('.todo-vit .zone, .ta-faites-box').forEach(z => z.classList.remove('survol'));
    if (d.fantome) { d.fantome.remove(); d.carte.classList.remove('glisse'); const z = zoneSous(e.clientX, e.clientY); if (z) deplacer(d.id, z.dataset.zone); return; }
    T.choisie = T.choisie === d.id ? null : d.id; rendre();             // simple clic : choisir
    if (T.choisie) msg('Clique sur un panier');
  });
  vit.addEventListener('click', e => {
    if (e.target.closest('.carte') || !T.choisie) return;
    const z = e.target.closest('.zone'); if (z) deplacer(T.choisie, z.dataset.zone);
  });

  // ---------- cocher, retirer, modifier ----------
  vit.addEventListener('click', async e => {
    const b = e.target.closest('[data-case]'), x = e.target.closest('[data-x]');
    if (b) { const t = T.taches.find(y => y.id === b.dataset.case); t.fait = !t.fait; if (t.fait) { t.faitLe = new Date().toISOString(); t.faitPar = BK.reglage('nomPc', '') || 'ce PC'; } else { delete t.faitLe; delete t.faitPar; }
      rendre(); await BK.db.ecrire('taches', t); msg(t.fait ? 'Bravo ! (rangée dans « Déjà fait »)' : 'Remise à faire'); }
    if (x) { T.taches = T.taches.filter(y => y.id !== x.dataset.x); rendre(); await BK.db.supprimer('taches', x.dataset.x); msg('Tâche retirée'); }
  });
  $('#taFaitesPli').onclick = () => { T.faitesPli = !T.faitesPli; BK.regler('todo.faitesPli', T.faitesPli); rendre(); };
  $('#taFaites').addEventListener('click', async e => { const b = e.target.closest('[data-case]'); if (!b) return;
    const t = T.taches.find(y => y.id === b.dataset.case); if (!t) return; t.fait = false; delete t.faitLe; delete t.faitPar; rendre(); await BK.db.ecrire('taches', t); msg('Remise à faire'); });
  $('.ta-faites-box').addEventListener('click', e => { if (T.choisie && !e.target.closest('[data-case]')) deplacer(T.choisie, '__fait'); });
  vit.addEventListener('dblclick', e => {
    const c = e.target.closest('.carte'); if (!c) return;
    const s = $('.carte-t', c), t = T.taches.find(x => x.id === c.dataset.id); T.choisie = null;
    s.contentEditable = 'true'; s.focus(); document.getSelection().selectAllChildren(s);
    const fin = async () => { s.contentEditable = 'false'; const v = s.textContent.trim(); if (v && v !== t.texte) { t.texte = v; await BK.db.ecrire('taches', t); msg('Modifiée'); } rendre(); };
    s.onblur = fin; s.onkeydown = ev => { ev.stopPropagation(); if (ev.key === 'Enter') { ev.preventDefault(); s.blur(); } };
  });

  
  const panPli = () => { const p = BK.reglage('todo.panPli', false); $('#taPanBox').classList.toggle('replie', p); $('#taPanPli').textContent = (p ? '▸' : '▾') + ' Paniers'; };
  $('#taPanPli').onclick = () => { BK.regler('todo.panPli', !BK.reglage('todo.panPli', false)); panPli(); };
  panPli();
  $('#taMembres').addEventListener('keydown', e => e.stopPropagation());
  $('#taMembres').onchange = async e => { const l = e.target.value.split(',').map(s => s.trim()).filter(s => s && s !== GROUPE); await BK.db.ecrire('config', { id: 'membres', liste: l }); msg('Paniers enregistrés'); charger(); };
  charger();
});
})();
