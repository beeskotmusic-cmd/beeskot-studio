// =====================================================================
// TÂCHES — qui fait quoi. Une tâche = un petit fichier dans le Drive.
// =====================================================================
(() => {
const T = { voir: 'afaire', taches: [], membres: [] };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MEMBRES_DEFAUT = ['Dari', 'Pierre', 'Baptiste'];

BK.module('taches', function (page) {
  $('.sub', page).textContent = 'Qui fait quoi, et pour quel morceau';
  $('.hdr .right', page).innerHTML = `<div><span class="eng" style="font-size:9px">À faire</span><span class="vfd" id="taNb">00</span></div>
    <div><span class="eng" style="font-size:9px">En retard</span><span class="vfd" id="taRet">00</span></div>`;
  $('.grid', page).innerHTML = `
    <div class="cols">
      <section class="pane vit"><span class="ptitle">① Vitrine</span>
        <div class="chips" id="taVues"><button class="chip on" data-v="afaire">À faire</button><button class="chip" data-v="faites">Faites</button></div>
        <div id="taListe" class="ta-colonnes"></div>
      </section>
      <section class="pane reg"><span class="ptitle">② Nouvelle tâche</span>
        <div class="box"><div class="form-rdv">
          <label><span class="eng">Tâche</span><input class="fld" id="taTexte" placeholder="ex. refaire la basse du pont"></label>
          <label><span class="eng">Qui</span><select class="fld" id="taQui"></select></label>
          <label><span class="eng">Morceau</span><select class="fld" id="taMorceau"><option value="">—</option></select></label>
          <label><span class="eng">Pour le</span><input class="fld" type="date" id="taDate"></label></div>
          <div class="chips" style="margin-top:12px"><button class="chip" id="taAjout">+ Ajouter</button></div></div>
        <div class="box"><span class="lb">Membres du groupe</span>
          <span class="nt">Séparés par des virgules. Partagé avec tout le groupe.</span>
          <input class="fld" id="taMembres" style="margin-top:8px"></div>
      </section>
    </div>
    <div class="pane abar"><span class="ptitle">③ Barre</span><span class="vfd" id="taMsg">PRÊT</span></div>`;
  const msg = t => $('#taMsg').textContent = String(t).toUpperCase();

  async function charger() {
    T.taches = await BK.db.liste('taches');
    const cfg = (await BK.db.liste('config')).find(c => c.id === 'membres');
    T.membres = cfg && cfg.liste && cfg.liste.length ? cfg.liste : MEMBRES_DEFAUT;
    $('#taMembres').value = T.membres.join(', ');
    $('#taQui').innerHTML = [...T.membres, 'Tout le groupe'].map(m => `<option>${esc(m)}</option>`).join('');
    $('#taMorceau').innerHTML = '<option value="">—</option>' + (await BK.db.liste('morceaux')).map(m => `<option>${esc(m.nom)}</option>`).join('');
    rendre();
  }
  BK.tachesTout = () => T.taches;
  function rendre() {
    const auj = new Date().toISOString().slice(0, 10), afaire = T.taches.filter(t => !t.fait);
    $('#taNb').textContent = String(afaire.length).padStart(2, '0');
    $('#taRet').textContent = String(afaire.filter(t => t.date && t.date < auj).length).padStart(2, '0');
    const l = T.taches.filter(t => T.voir === 'faites' ? t.fait : !t.fait).sort((a, b) => (a.date || '9').localeCompare(b.date || '9'));
    const qui = [...T.membres, 'Tout le groupe'];
    $('#taListe').innerHTML = qui.map(m => { const lm = l.filter(t => t.qui === m); return `
      <div class="ta-col"><span class="dymo sm">${esc(m)}</span>${lm.length ? lm.map(t => `
        <div class="ta-t${t.date && t.date < auj && !t.fait ? ' retard' : ''}"><button class="ta-case${t.fait ? ' on' : ''}" data-id="${t.id}">${t.fait ? '✓' : ''}</button>
          <div><span class="nt" style="margin:0;color:var(--ink)">${esc(t.texte)}</span><span class="nt" style="margin:2px 0 0;font-size:11px">${[t.morceau, t.date && 'pour le ' + new Date(t.date + 'T12:00').toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' })].filter(Boolean).map(esc).join(' · ') || '&nbsp;'}</span></div>
          <button class="btn xs ta-x" data-x="${t.id}">✕</button></div>`).join('') : '<span class="nt">—</span>'}</div>`; }).join('');
    $$('.ta-case').forEach(b => b.onclick = async () => { const t = T.taches.find(x => x.id === b.dataset.id); t.fait = !t.fait; await BK.db.ecrire('taches', t); msg(t.fait ? 'Bravo !' : 'Remise à faire'); rendre(); });
    $$('.ta-x').forEach(b => b.onclick = async () => { await BK.db.supprimer('taches', b.dataset.x); T.taches = T.taches.filter(x => x.id !== b.dataset.x); rendre(); });
  }
  $$('#taVues .chip').forEach(c => c.onclick = () => { T.voir = c.dataset.v; $$('#taVues .chip').forEach(x => x.classList.toggle('on', x === c)); rendre(); });
  $('#taAjout').onclick = async () => {
    const texte = $('#taTexte').value.trim(); if (!texte) return msg('Écris la tâche');
    T.taches.push(await BK.db.ecrire('taches', { texte, qui: $('#taQui').value, morceau: $('#taMorceau').value, date: $('#taDate').value, fait: false }));
    $('#taTexte').value = ''; msg('Tâche ajoutée'); rendre();
  };
  $('#taTexte').onkeydown = e => e.key === 'Enter' && $('#taAjout').click();
  $('#taMembres').onchange = async e => { const l = e.target.value.split(',').map(s => s.trim()).filter(Boolean); await BK.db.ecrire('config', { id: 'membres', liste: l }); msg('Membres enregistrés'); charger(); };
  BK.tachesRecharger = charger;
  charger();
});
})();
