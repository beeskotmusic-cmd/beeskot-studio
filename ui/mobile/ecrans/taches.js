// TO-DO LIST (mobile) — les tâches de chacun, comme sur le PC :
//   « + Ajouter » (la tâche, pour qui, une date, un morceau) · toucher une tâche : la modifier ou la supprimer
//   la case : fait / à refaire · appui long puis glisser : changer l'ordre (le même ordre que sur le PC : le champ « ordre »)
(() => {
const { $, esc, msg, moi, couleur, auj } = BKM;
const GROUPE = 'BEESKOT', ANCIENS = { 'Dari': 'Yacine', 'Tout le groupe': GROUPE }, MEMBRES0 = ['Yacine', 'Pierre', 'Baptiste'];
const gens = t => [...new Set([t.qui, ...(t.aussi || [])].filter(Boolean).map(q => ANCIENS[q] || q))];
let filtre = BK.reglage('mobile.todo', 'moi'), faitesOuvertes = false, T = [], MEMBRES = MEMBRES0, MORCEAUX = [];
const tri = (x, y) => (x.ordre ?? 0) - (y.ordre ?? 0);              // comme le PC : l'ordre choisi (une tâche neuve arrive en bas)
// pendant qu'on tient une tâche, la page ne défile pas (un seul écouteur pour toute l'appli)
let tient = false;
document.addEventListener('touchmove', e => { if (tient) e.preventDefault(); }, { passive: false });

BKM.ecran('taches', { nom: 'To-do list', ordre: 30, async dessiner(z, plus, frais) {
  const [l, cfg, ms] = await Promise.all([BKM.liste('taches'), BKM.liste('config').catch(() => []), BKM.liste('morceaux').catch(() => [])]); if (!frais()) return;
  T = l; MORCEAUX = ms; const m = (cfg || []).find(x => x.id === 'membres');
  MEMBRES = (m && Array.isArray(m.liste) && m.liste.length ? m.liste : MEMBRES0).map(x => ANCIENS[x] || x).filter(x => x !== GROUPE);
  const qui = BK.reglage('nomPc', ''), a = auj();
  const pourFiltre = t => filtre === 'tout' ? true : filtre === 'moi' ? (qui ? gens(t).includes(qui) || gens(t).includes(GROUPE) : true) : !gens(t).length;
  const afaire = T.filter(t => !t.fait && pourFiltre(t)).sort(tri);
  const faites = T.filter(t => t.fait && pourFiltre(t)).sort((x, y) => String(y.faitLe || '').localeCompare(String(x.faitLe || ''))).slice(0, 30);
  const carte = t => `<div class="mo-tache${t.fait ? ' faite' : ''}${!t.fait && t.date && t.date < a ? ' retard' : ''}" data-t="${esc(t.id)}">
      <button class="mo-case${t.fait ? ' on' : ''}" data-case="${esc(t.id)}" aria-label="Fait">${t.fait ? '✓' : ''}</button>
      <div class="mo-t-txt"><span>${esc(t.texte)}</span>
        <em>${gens(t).map(g => `<i style="--pc:${couleur(g)}">${esc(g)}</i>`).join('') || '<i>en vrac</i>'}${t.morceau ? ' · ' + esc(t.morceau) : ''}${t.date ? ' · ' + (t.date < a && !t.fait ? 'en retard · ' : '') + esc(BKM.dateFr(t.date, { weekday: 'short', day: 'numeric', month: 'short' })) : ''}</em></div>
      ${t.fait ? '' : '<span class="mo-poignee" aria-hidden="true"></span>'}</div>`;
  z.innerHTML = `
    <div class="mo-seg">${[['moi', qui ? 'Pour ' + qui : 'Pour moi'], ['vrac', 'En vrac'], ['tout', 'Tout le monde']].map(([k, n]) => `<button class="${filtre === k ? 'on' : ''}" data-f="${k}">${esc(n)}</button>`).join('')}</div>
    ${!qui && filtre === 'moi' ? '<p class="mo-alerte">Choisis ton nom dans Réglages pour ne voir que tes tâches.</p>' : ''}
    <button class="btn pri mo-ajout" id="moAjout">+ Ajouter une tâche</button>
    <h2 class="mo-sous">À faire <em>${afaire.length}</em></h2>
    <div class="mo-liste" id="moAfaire">${afaire.map(carte).join('') || '<p class="mo-nt">Rien à faire ici. Profite.</p>'}</div>
    ${afaire.length > 1 ? '<p class="mo-nt">Appui long sur une tâche, puis glisse : pour changer l\'ordre. Toucher le texte : la modifier.</p>' : ''}
    ${faites.length ? `<button class="mo-sous mo-plier" id="moFaites">${faitesOuvertes ? '▾' : '▸'} Déjà fait <em>${faites.length}</em></button>${faitesOuvertes ? faites.map(carte).join('') : ''}` : ''}`;
  z.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filtre = b.dataset.f; BK.regler('mobile.todo', filtre); BKM.redessiner(); });
  const f = z.querySelector('#moFaites'); if (f) f.onclick = () => { faitesOuvertes = !faitesOuvertes; BKM.redessiner(); };
  $('#moAjout').onclick = () => feuille(null);
  z.querySelectorAll('[data-case]').forEach(b => b.onclick = e => { e.stopPropagation(); cocher(b); });
  z.querySelectorAll('.mo-tache').forEach(c => { c.addEventListener('click', () => { if (BKM.glisseFini) return; const t = T.find(x => x.id === c.dataset.t); t && feuille(t); });
    c.addEventListener('contextmenu', e => e.preventDefault()); });
  brancherGlisser($('#moAfaire'), afaire);
} });

// ---------- cocher : la case tout de suite, la ligne s'en va, le Drive est écrit pendant ce temps ----------
async function cocher(b) {
  const t = T.find(x => x.id === b.dataset.case); if (!t) return;
  t.fait = !t.fait;
  if (t.fait) { t.faitLe = new Date().toISOString(); t.faitPar = moi() + ' (téléphone)'; } else { delete t.faitLe; delete t.faitPar; }
  b.classList.toggle('on', t.fait); b.textContent = t.fait ? '✓' : ''; b.disabled = true;
  b.closest('.mo-tache').classList.add('part');
  const ecrit = BK.db.ecrire('taches', t).then(() => msg(t.fait ? 'Bravo !' : 'Remise à faire')).catch(e => msg('Pas enregistré : ' + (e.message || e)));
  await new Promise(r => setTimeout(r, 180)); await ecrit;
  BKM.redessiner();
}

// ---------- le panneau « Ajouter » / « Modifier » (monte du bas de l'écran) ----------
function feuille(t) {
  const neuf = !t, qui = BK.reglage('nomPc', '');
  const choisis = new Set(neuf ? (filtre === 'moi' && qui ? [qui] : []) : gens(t));
  const ms = MORCEAUX.filter(m => m.statut !== 'sorti').map(m => m.nom).sort((x, y) => String(x).localeCompare(String(y)));
  if (t && t.morceau && !ms.includes(t.morceau)) ms.unshift(t.morceau);
  const v = document.createElement('div'); v.className = 'mo-feuille-voile';
  v.innerHTML = `<form class="mo-feuille" role="dialog" aria-label="${neuf ? 'Ajouter une tâche' : 'Modifier la tâche'}">
      <span class="mo-poignee-f" aria-hidden="true"></span>
      <span class="dymo">${neuf ? 'Nouvelle tâche' : 'La tâche'}</span>
      <textarea class="fld" id="ftTexte" rows="2" maxlength="200" placeholder="ex. Réserver le studio pour samedi" required>${esc(t ? t.texte : '')}</textarea>
      <span class="mo-eng">Pour qui</span>
      <div class="mo-chips" id="ftQui">${[...MEMBRES, GROUPE].map(m => `<button type="button" class="chip${choisis.has(m) ? ' on' : ''}" data-q="${esc(m)}" style="--pc:${couleur(m)}">${esc(m === GROUPE ? 'Tout le groupe' : m)}</button>`).join('')}</div>
      <p class="mo-nt" id="ftVrac">${choisis.size ? '' : 'Personne de choisi : la tâche va « en vrac ».'}</p>
      <div class="mo-ft-2"><label><span class="mo-eng">Pour quand</span><input class="fld" type="date" id="ftDate" value="${esc(t && t.date || '')}"></label>
        <label><span class="mo-eng">Morceau</span><select class="fld" id="ftMorceau"><option value="">—</option>${ms.map(n => `<option${t && t.morceau === n ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label></div>
      <div class="mo-chips mo-ft-btns"><button type="submit" class="btn pri" id="ftOk">${neuf ? 'Ajouter' : 'Enregistrer'}</button><button type="button" class="btn" id="ftNon">Annuler</button>
        ${neuf ? '' : '<button type="button" class="btn mo-ft-suppr" id="ftSuppr">Supprimer</button>'}</div></form>`;
  document.body.appendChild(v); document.body.classList.add('feuille-ouverte');
  const fermer = () => { v.classList.add('sort'); document.body.classList.remove('feuille-ouverte'); setTimeout(() => v.remove(), 200); };
  v.addEventListener('click', e => { if (e.target === v) fermer(); });
  v.querySelector('#ftNon').onclick = fermer;
  v.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { const q = b.dataset.q; choisis.has(q) ? choisis.delete(q) : choisis.add(q); b.classList.toggle('on', choisis.has(q));
    v.querySelector('#ftVrac').textContent = choisis.size ? '' : 'Personne de choisi : la tâche va « en vrac ».'; });
  if (neuf) setTimeout(() => v.querySelector('#ftTexte').focus(), 220);
  v.querySelector('form').onsubmit = async e => { e.preventDefault();
    const texte = v.querySelector('#ftTexte').value.trim().replace(/\s+/g, ' '); if (!texte) return v.querySelector('#ftTexte').focus();
    const l = [...choisis], x = t || { fait: false, ordre: Date.now() };
    Object.assign(x, { texte, qui: l[0] || '', date: v.querySelector('#ftDate').value, morceau: v.querySelector('#ftMorceau').value });
    if (l.length > 1) x.aussi = l.slice(1); else delete x.aussi;
    if (neuf) x.creePar = moi() + ' (téléphone)';
    v.querySelector('#ftOk').disabled = true;
    try { const r = await BK.db.ecrire('taches', x); if (neuf && r && !T.some(y => y.id === r.id)) T.push(r); msg(neuf ? 'Tâche ajoutée' + (l.length ? ' pour ' + l.join(' + ') : ' (en vrac)') : 'Tâche modifiée'); fermer(); BKM.redessiner(); }
    catch (er) { v.querySelector('#ftOk').disabled = false; msg('Pas enregistré : ' + (er.message || er)); } };
  const sup = v.querySelector('#ftSuppr'); if (sup) sup.onclick = async () => {
    if (!confirm('Supprimer cette tâche ? (rangée dans la corbeille du Drive)')) return;
    try { await BK.db.supprimer('taches', t.id); T = T.filter(y => y.id !== t.id); msg('Tâche supprimée'); fermer(); BKM.redessiner(); }
    catch (er) { msg('Pas supprimée : ' + (er.message || er)); } };
}

// ---------- appui long puis glisser : changer l'ordre ----------
// On attend 350 ms sans bouger (sinon c'est un défilement normal) ; le téléphone vibre, la tâche suit le doigt,
// les autres s'écartent. On lâche : seule la tâche déplacée est réécrite (son « ordre » passe entre ses deux voisines).
function brancherGlisser(liste, afaire) {
  if (!liste || afaire.length < 2) return;
  let g = null;
  liste.querySelectorAll('.mo-tache').forEach(c => c.addEventListener('pointerdown', e => {
    if (e.target.closest('[data-case]') || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const y0 = e.clientY, x0 = e.clientX;
    g = { c, y0, x0, actif: false, id: e.pointerId };
    g.minuteur = setTimeout(() => {
      if (!g || g.c !== c) return;
      const cartes = [...liste.querySelectorAll('.mo-tache')], i = cartes.indexOf(c), r = c.getBoundingClientRect();
      Object.assign(g, { actif: true, cartes, i, cible: i, h: r.height + 6, mid: cartes.map(x => { const b = x.getBoundingClientRect(); return b.top + b.height / 2; }) });
      try { c.setPointerCapture(g.id); } catch (er) {}
      navigator.vibrate && navigator.vibrate(15);
      c.classList.add('attrapee'); liste.classList.add('en-glisse'); tient = true;
    }, 350);
  }));
  liste.addEventListener('pointermove', e => {
    if (!g) return;
    if (!g.actif) { if (Math.abs(e.clientY - g.y0) > 8 || Math.abs(e.clientX - g.x0) > 8) { clearTimeout(g.minuteur); g = null; } return; }
    const dy = e.clientY - g.y0; g.c.style.transform = `translateY(${dy}px) scale(1.02)`;
    const y = g.mid[g.i] + dy; let cible = g.i;
    for (let k = 0; k < g.cartes.length; k++) { if (k < g.i && y < g.mid[k]) { cible = k; break; } if (k > g.i && y > g.mid[k]) cible = k; }
    g.cible = cible;
    g.cartes.forEach((x, k) => { if (k === g.i) return; x.style.transform = k >= cible && k < g.i ? `translateY(${g.h}px)` : k <= cible && k > g.i ? `translateY(${-g.h}px)` : ''; });
  });
  const lacher = async () => {
    if (!g) return; clearTimeout(g.minuteur); const x = g; g = null; tient = false; if (!x.actif) return;
    BKM.glisseFini = true; setTimeout(() => { BKM.glisseFini = false; }, 60);   // pas de « toucher » (ouvrir la tâche) juste après avoir lâché
    liste.classList.remove('en-glisse'); x.c.classList.remove('attrapee');
    if (x.cible === x.i) { x.cartes.forEach(c => { c.style.transform = ''; }); return; }
    const ordreDe = c => (T.find(t => t.id === c.dataset.t) || {}).ordre ?? 0;
    const reste = x.cartes.filter(c => c !== x.c), avant = reste[x.cible - 1], apres = reste[x.cible];
    const t = T.find(y => y.id === x.c.dataset.t); if (!t) return;
    const a = avant ? ordreDe(avant) : null, b = apres ? ordreDe(apres) : null;
    t.ordre = a == null ? b - 1000 : b == null ? a + 1000 : (a + b) / 2;
    // on pose la liste dans le nouvel ordre tout de suite (sans animation de retour), puis on écrit
    x.cartes.forEach(c => { c.style.transition = 'none'; c.style.transform = ''; });
    const l = reste.slice(); l.splice(x.cible, 0, x.c); l.forEach(c => liste.appendChild(c));
    requestAnimationFrame(() => x.cartes.forEach(c => { c.style.transition = ''; }));
    try { await BK.db.ecrire('taches', t); msg('Ordre enregistré'); } catch (er) { msg('Pas enregistré : ' + (er.message || er)); BKM.redessiner(); }
  };
  liste.addEventListener('pointerup', lacher); liste.addEventListener('pointercancel', lacher);
}
})();
