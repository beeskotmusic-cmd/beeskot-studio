// =====================================================================
// TO-DO LIST — un tableau façon Trello : une colonne par personne + BEESKOT.
// Chaque tâche est une petite carte qu'on glisse d'une colonne à l'autre.
// Une tâche = un petit fichier dans le Drive (partagé avec tout le groupe).
// =====================================================================
(() => {
const T = { taches: [], membres: [], masquerFaites: BK.reglage('todo.masquer', false), morceaux: [] };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MEMBRES_DEFAUT = ['Yacine', 'Pierre', 'Baptiste'];
const GROUPE = 'BEESKOT';
const ANCIENS = { 'Dari': 'Yacine', 'Tout le groupe': GROUPE };       // anciens noms → nouveaux

BK.module('taches', function (page) {
  $('.sub', page).textContent = 'Glisse les cartes d\'une colonne à l\'autre';
  $('.hdr .right', page).innerHTML = `<div><span class="eng" style="font-size:9px">À faire</span><span class="vfd" id="taNb">00</span></div>
    <div><span class="eng" style="font-size:9px">En retard</span><span class="vfd" id="taRet">00</span></div>`;
  $('.grid', page).innerHTML = `
    <div class="cols">
      <section class="pane vit"><span class="ptitle">① Tableau</span>
        <div class="tableau" id="taTab"></div>
      </section>
      <section class="pane reg" style="width:260px"><span class="ptitle">② Réglages</span>
        <div class="box"><span class="lb">Affichage</span>
          <div class="chips" style="margin-top:10px"><button class="chip${T.masquerFaites ? ' on' : ''}" id="taMasq">Masquer les tâches faites</button></div></div>
        <div class="box"><span class="lb">Colonnes</span>
          <span class="nt">Les membres, séparés par des virgules. La colonne BEESKOT est toujours là.</span>
          <input class="fld" id="taMembres" style="margin-top:8px"></div>
      </section>
    </div>
    <div class="pane abar"><span class="ptitle">③ Barre</span><span class="vfd" id="taMsg">PRÊT</span></div>`;
  const msg = t => $('#taMsg').textContent = String(t).toUpperCase();

  async function charger() {
    T.taches = await BK.db.liste('taches');
    const cfg = (await BK.db.liste('config')).find(c => c.id === 'membres');
    T.membres = (cfg && cfg.liste && cfg.liste.length ? cfg.liste : MEMBRES_DEFAUT).map(m => ANCIENS[m] || m).filter(m => m !== GROUPE);
    if (cfg && cfg.liste && cfg.liste.some(m => ANCIENS[m])) await BK.db.ecrire('config', { id: 'membres', liste: T.membres });
    for (const t of T.taches) if (!t.qui || ANCIENS[t.qui]) { t.qui = ANCIENS[t.qui] || GROUPE; await BK.db.ecrire('taches', t); }
    T.morceaux = (await BK.db.liste('morceaux')).map(m => m.nom).sort();
    $('#taMembres').value = T.membres.join(', ');
    rendre();
  }
  BK.tachesRecharger = charger;

  function carte(t, auj) {
    return `<div class="carte${t.fait ? ' faite' : ''}${!t.fait && t.date && t.date < auj ? ' retard' : ''}" draggable="true" data-id="${t.id}">
      <button class="ta-case${t.fait ? ' on' : ''}" data-case="${t.id}">${t.fait ? '✓' : ''}</button>
      <div class="carte-c"><span class="carte-t" data-edit="${t.id}" title="Double-clic pour modifier">${esc(t.texte)}</span>
        ${t.morceau || t.date ? `<span class="carte-m">${[t.morceau, t.date && 'pour le ' + new Date(t.date + 'T12:00').toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' })].filter(Boolean).map(esc).join(' · ')}</span>` : ''}</div>
      <button class="carte-x" data-x="${t.id}" title="Retirer">✕</button></div>`;
  }

  function rendre() {
    const auj = new Date().toISOString().slice(0, 10), afaire = T.taches.filter(t => !t.fait);
    $('#taNb').textContent = String(afaire.length).padStart(2, '0');
    $('#taRet').textContent = String(afaire.filter(t => t.date && t.date < auj).length).padStart(2, '0');
    const cols = [...T.membres, GROUPE];
    $('#taTab').innerHTML = cols.map(c => {
      const l = T.taches.filter(t => t.qui === c && !(T.masquerFaites && t.fait))
        .sort((a, b) => (a.fait - b.fait) || (a.ordre ?? 0) - (b.ordre ?? 0) || (a.date || '9').localeCompare(b.date || '9'));
      return `<div class="colonne${c === GROUPE ? ' groupe' : ''}" data-col="${esc(c)}">
        <div class="col-tete"><span class="ta-nom">${esc(c)}</span><span class="col-nb">${l.filter(t => !t.fait).length}</span></div>
        <div class="col-cartes">${l.map(t => carte(t, auj)).join('')}</div>
        <div class="col-ajout">
          <button class="btn xs col-plus">+ Ajouter une carte</button>
          <div class="col-form hidden">
            <textarea class="fld" placeholder="la tâche…" rows="2"></textarea>
            <div class="deux"><select class="fld"><option value="">morceau…</option>${T.morceaux.map(m => `<option>${esc(m)}</option>`).join('')}</select><input class="fld" type="date"></div>
            <div class="chips"><button class="chip col-ok">Ajouter</button><button class="chip col-annul">Annuler</button></div></div></div>
      </div>`; }).join('');
    brancher();
  }

  function brancher() {
    // ajouter une carte dans une colonne
    $$('.colonne').forEach(col => {
      const f = $('.col-form', col), plus = $('.col-plus', col);
      plus.onclick = () => { f.classList.remove('hidden'); plus.classList.add('hidden'); $('textarea', f).focus(); };
      $('.col-annul', f).onclick = () => { f.classList.add('hidden'); plus.classList.remove('hidden'); };
      const ok = async () => {
        const texte = $('textarea', f).value.trim(); if (!texte) return;
        const n = await BK.db.ecrire('taches', { texte, qui: col.dataset.col, morceau: $('select', f).value, date: $('input', f).value, fait: false, ordre: Date.now() });
        T.taches.push(n); msg('Carte ajoutée'); rendre();
      };
      $('.col-ok', f).onclick = ok;
      $('textarea', f).onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ok(); } if (e.key === 'Escape') $('.col-annul', f).click(); };
      // glisser-déposer
      col.ondragover = e => { e.preventDefault(); col.classList.add('survol'); };
      col.ondragleave = e => { if (!col.contains(e.relatedTarget)) col.classList.remove('survol'); };
      col.ondrop = async e => {
        e.preventDefault(); col.classList.remove('survol');
        const t = T.taches.find(x => x.id === e.dataTransfer.getData('text/plain')); if (!t) return;
        const apres = [...$$('.carte', col)].find(c => e.clientY < c.getBoundingClientRect().top + c.offsetHeight / 2);   // position dans la colonne
        const ref = apres && T.taches.find(x => x.id === apres.dataset.id);
        t.qui = col.dataset.col; t.ordre = ref ? (ref.ordre ?? 0) - 0.5 : Date.now();
        await BK.db.ecrire('taches', t); msg('Déplacée vers ' + t.qui); rendre();
      };
    });
    $$('.carte').forEach(c => {
      c.ondragstart = e => { e.dataTransfer.setData('text/plain', c.dataset.id); c.classList.add('glisse'); };
      c.ondragend = () => c.classList.remove('glisse');
    });
    $$('[data-case]').forEach(b => b.onclick = async () => { const t = T.taches.find(x => x.id === b.dataset.case); t.fait = !t.fait; await BK.db.ecrire('taches', t); msg(t.fait ? 'Bravo !' : 'Remise à faire'); rendre(); });
    $$('[data-x]').forEach(b => b.onclick = async () => { await BK.db.supprimer('taches', b.dataset.x); T.taches = T.taches.filter(x => x.id !== b.dataset.x); msg('Carte retirée'); rendre(); });
    $$('[data-edit]').forEach(s => s.ondblclick = () => {               // modifier le texte d'une carte
      const t = T.taches.find(x => x.id === s.dataset.edit);
      s.contentEditable = 'true'; s.focus(); document.getSelection().selectAllChildren(s);
      const fin = async () => { s.contentEditable = 'false'; const v = s.textContent.trim(); if (v && v !== t.texte) { t.texte = v; await BK.db.ecrire('taches', t); msg('Modifiée'); } };
      s.onblur = fin; s.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); s.blur(); } };
    });
  }

  $('#taMasq').onclick = e => { T.masquerFaites = !T.masquerFaites; BK.regler('todo.masquer', T.masquerFaites); e.target.classList.toggle('on', T.masquerFaites); rendre(); };
  $('#taMembres').onchange = async e => { const l = e.target.value.split(',').map(s => s.trim()).filter(s => s && s !== GROUPE); await BK.db.ecrire('config', { id: 'membres', liste: l }); msg('Colonnes enregistrées'); charger(); };
  charger();
});
})();
