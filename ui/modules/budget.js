// =====================================================================
// BUDGET — les dépenses du groupe (loyer du studio, abonnements, ingés son…),
// qui a payé, pour qui, et le calcul « qui doit combien à qui » (comme Tricount).
// Tout est rangé dans le Drive BEESKOT (collections « depenses » et « abonnements »).
// =====================================================================
(() => {
const B = { dep: [], abos: [], membres: ['Yacine', 'Pierre', 'Baptiste'], mois: '' };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const argent = n => (Math.round(n * 100) / 100).toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $';
const CATS = ['Studio', 'Abonnement', 'Mixage / master', 'Matériel', 'Tournage', 'Promo', 'Transport', 'Autre'];
const auj = () => new Date().toISOString().slice(0, 10);

// le calcul : chacun = ce qu'il a payé − sa part ; puis le moins de remboursements possible
BK.budgetSoldes = function (dep, membres) {
  const solde = Object.fromEntries(membres.map(m => [m, 0]));
  for (const d of dep) {
    if (d.type === 'remboursement') { solde[d.de] = (solde[d.de] || 0) + d.montant; solde[d.a] = (solde[d.a] || 0) - d.montant; continue; }
    const pour = (d.pour && d.pour.length ? d.pour : membres), part = d.montant / pour.length;
    solde[d.payePar] = (solde[d.payePar] || 0) + d.montant;
    for (const p of pour) solde[p] = (solde[p] || 0) - part;
  }
  const doit = Object.entries(solde).filter(([, v]) => v < -0.5).map(([n, v]) => ({ n, v: -v })).sort((a, b) => b.v - a.v);
  const recoit = Object.entries(solde).filter(([, v]) => v > 0.005).map(([n, v]) => ({ n, v })).sort((a, b) => b.v - a.v);
  const virements = [];
  for (const d of doit) for (const r of recoit) { if (d.v < 0.5) break; const x = Math.min(d.v, r.v); if (x < 0.5) continue; virements.push({ de: d.n, a: r.n, montant: Math.round(x * 100) / 100 }); d.v -= x; r.v -= x; }
  return { solde, virements };
};

BK.module('budget', function (page) {
  $('.sub', page).textContent = 'Les dépenses du groupe et les remboursements';
  $('.hdr .right', page).innerHTML = `<div><span class="eng" style="font-size:9px">Ce mois</span><span class="vfd" id="buMoisH" style="width:130px">—</span></div>
    <div><span class="eng" style="font-size:9px">À rembourser</span><span class="vfd" id="buDuH" style="width:130px">—</span></div>`;
  $('.grid', page).innerHTML = `
    <div class="cols">
      <section class="pane vit">
        <div class="box bu-qui"><div class="ligne-titre"><span class="lb">Remboursements</span></div><div id="buVir" class="bu-vir"></div><div id="buSoldes" class="bu-soldes"></div></div>
        <div class="box" id="buMiette"></div>
        <div class="box grow"><div class="ligne-titre"><span class="lb">Dépenses</span>
            <select class="fld" id="buMois" style="margin-left:auto;width:auto"></select></div>
          <div id="buListe" class="bu-liste"></div></div>
      </section>
      <section class="pane reg" style="width:320px"><span class="ptitle">② Ajouter</span>
        <div class="box"><span class="lb">Nouvelle dépense</span>
          <div class="form-rdv">
            <label><span class="eng">Quoi</span><input class="fld" id="buTitre" placeholder="ex. Loyer du studio, mix de Mother…"></label>
            <div class="deux"><label><span class="eng">Montant ($)</span><input class="fld" id="buMontant" inputmode="decimal" placeholder="0,00"></label>
              <label><span class="eng">Date</span><input class="fld" type="date" id="buDate"></label></div>
            <label><span class="eng">Payé par</span><div class="chips" id="buPaye"></div></label>
            <label><span class="eng">Pour qui (partagé à parts égales)</span><div class="chips" id="buPour"></div></label>
            <label><span class="eng">Catégorie</span><select class="fld" id="buCat">${CATS.map(c => `<option>${c}</option>`).join('')}</select></label>
          </div>
          <div class="chips" style="margin-top:10px"><button class="btn sm pri" id="buAjout">+ Ajouter la dépense</button>
            <button class="btn sm" id="buAbo" title="La même dépense revient chaque mois (loyer, abonnement)">↻ Chaque mois</button>
            <button class="btn sm" id="buAboAn" title="La même dépense revient chaque année">↻ Chaque année</button></div></div>
        <div class="box grow"><span class="lb">Ça revient tout seul</span><div id="buAbos" class="bu-abos"></div></div>
      </section>
    </div>
    <div class="pane abar"><span class="vfd" id="buMsg">PRÊT</span></div>`;
  const msg = t => $('#buMsg').textContent = String(t).toUpperCase();
  let paye = '', pour = new Set();

  async function charger() {
    const cfg = (await BK.db.liste('config')).find(c => c.id === 'membres');
    B.membres = (cfg && cfg.liste && cfg.liste.length ? cfg.liste : B.membres).filter(m => m !== 'BEESKOT');
    [B.dep, B.abos] = await Promise.all([BK.db.liste('depenses'), BK.db.liste('abonnements')]);
    await reporterAbos();
    if (!paye) paye = B.membres.includes('Baptiste') ? 'Baptiste' : B.membres[0]; if (!pour.size) pour = new Set(B.membres);
    $('#buDate').value = $('#buDate').value || auj();
    B.props = (await BK.db.liste('propositions')).filter(p => p.type === 'depense' && p.statut === 'attente');
    rendre();
  }
  window.addEventListener('bk:annule', () => charger());
  BK.budgetRecharger = charger;

  // chaque mois, les dépenses « récurrentes » s'ajoutent toutes seules (une seule fois par mois)
  async function reporterAbos() {
    const ce = auj().slice(0, 7);
    for (const a of B.abos.filter(x => x.actif !== false)) {
      const parAn = a.cadence === 'an';
      let m = (a.depuis || ce).slice(0, 7);
      for (let k = 0; k < 36 && m <= ce; k++) {
        const id = 'abo-' + a.id + '-' + m;
        if (!B.dep.some(d => d.id === id)) { const j = String(Math.min(28, a.jour || 1)).padStart(2, '0');
          B.dep.push(await BK.db.ecrire('depenses', { id, titre: a.titre, montant: a.montant, payePar: a.payePar, pour: a.pour, date: m + '-' + j, cat: a.cat || 'Abonnement', abo: a.id }, { sansAnnuler: true })); }
        const [y, mo] = m.split('-').map(Number);
        m = parAn ? `${y + 1}-${String(mo).padStart(2, '0')}` : mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
      }
    }
  }

  function chips() {
    $('#buPaye').innerHTML = B.membres.map(m => `<button class="chip${paye === m ? ' on' : ''}" data-pa="${esc(m)}">${esc(m)}</button>`).join('');
    $('#buPour').innerHTML = B.membres.map(m => `<button class="chip${pour.has(m) ? ' on' : ''}" data-po="${esc(m)}">${esc(m)}</button>`).join('');
    $$('[data-pa]', page).forEach(b => b.onclick = () => { paye = b.dataset.pa; chips(); });
    $$('[data-po]', page).forEach(b => b.onclick = () => { pour.has(b.dataset.po) ? pour.delete(b.dataset.po) : pour.add(b.dataset.po); if (!pour.size) pour.add(b.dataset.po); chips(); });
  }

  // pour une dépense : la part de chacun, qui l'a déjà remboursée, qui la doit encore
  function partsRestantes(d) {
    const pour = (d.pour && d.pour.length ? d.pour : B.membres);
    const part = Math.floor((d.montant / pour.length) * 100) / 100;   // les centimes qui restent sont pour celui qui a avancé l'argent
    const payes = B.dep.filter(r => r.type === 'remboursement' && r.dep === d.id).map(r => r.de);
    return { part, payes, doivent: pour.filter(m => m !== d.payePar && !payes.includes(m)) };
  }

  function rendre() {
    chips();
    // 🍞 les paiements dont on a parlé sur Discord (le bouton jaune)
    const pr = B.props || [];
    $('#buMiette').style.display = pr.length ? '' : 'none';
    $('#buMiette').innerHTML = pr.length ? `<span class="lb">🍞 Miette a vu ces paiements sur Discord</span>${pr.map(p => `<div class="bu-d ta-prop"><span class="bu-d-c"><b>${esc(p.titre)}</b>
        <span class="nt">${esc(p.date || '')} · payé par ${esc(p.payePar || '?')}${p.pourquoi ? ' — « ' + esc(p.pourquoi) + ' »' : ''}</span></span><span class="vfd">${argent(p.montant)}</span>
        <button class="btn xs pri" data-pok="${p.id}">✓</button><button class="btn xs" data-pnon="${p.id}">✕</button></div>`).join('')}` : '';
    const { solde, virements } = BK.budgetSoldes(B.dep, B.membres);
    $('#buVir').innerHTML = virements.length ? virements.map(v => `<div class="bu-v"><b>${esc(v.de)}</b><span>→</span><b>${esc(v.a)}</b><span class="vfd">${argent(v.montant)}</span>
        <button class="btn xs pri" data-remb="${esc(v.de)}|${esc(v.a)}|${v.montant}" style="margin-left:auto">✓ Virement fait</button></div>`).join('')
      : '<span class="nt">Tout est à jour 🎉</span>';
    $('#buSoldes').innerHTML = B.membres.map(m => { const v = solde[m] || 0; return `<span class="bu-s ${v > 0.005 ? 'plus' : v < -0.005 ? 'moins' : ''}">${esc(m)} ${v > 0.005 ? '+' : ''}${argent(v)}</span>`; }).join('');
    const total = virements.reduce((a, v) => a + v.montant, 0); $('#buDuH').textContent = total ? argent(total) : '0 $';
    // les mois
    const mois = [...new Set(B.dep.map(d => (d.date || '').slice(0, 7)).filter(Boolean))].sort().reverse(), ce = auj().slice(0, 7);
    if (!mois.includes(ce)) mois.unshift(ce);
    B.mois = B.mois || ce;
    $('#buMois').innerHTML = '<option value="tout">Tout</option>' + mois.map(m => `<option value="${m}"${m === B.mois ? ' selected' : ''}>${new Date(m + '-15').toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' })}</option>`).join('');
    if (B.mois === 'tout') $('#buMois').value = 'tout';
    const l = B.dep.filter(d => B.mois === 'tout' || (d.date || '').startsWith(B.mois)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    $('#buMoisH').textContent = argent(B.dep.filter(d => d.type !== 'remboursement' && (d.date || '').startsWith(ce)).reduce((a, d) => a + d.montant, 0));
    const moi = B.membres.find(m => m.toLowerCase() === String(BK.reglage('nomPc', '')).trim().toLowerCase()) || '';
    B.rOuvert = B.rOuvert || new Set();
    $('#buListe').innerHTML = l.length ? l.map(d => d.type === 'remboursement'
      ? `<div class="bu-d remb"><span class="bu-d-c"><b>↩ ${esc(d.de)} a remboursé ${esc(d.a)}${d.dep ? ' — ' + esc(d.titre || '') : ''}</b><span class="nt">${esc(d.date || '')}</span></span><span class="vfd">${argent(d.montant)}</span><button class="btn xs" data-x="${d.id}" title="Retirer">✕</button></div>`
      : (() => {
        const pr = partsRestantes(d), part = pr.part, ouvert = B.rOuvert.has(d.id);
        const aPayer = moi && pr.doivent.includes(moi);
        return `<div class="bu-d"><span class="bu-d-c"><b>${esc(d.titre)}</b><span class="nt">${esc(d.date || '')} · payé par ${esc(d.payePar)} · pour ${esc((d.pour && d.pour.length && d.pour.length < B.membres.length ? d.pour : ['tout le monde']).join(', '))} · ${esc(d.cat || '')}${d.abo ? ' · ↻ revient tout seul' : ''}${pr.payes.length ? ' · part payée par ' + esc(pr.payes.join(', ')) : ''}</span></span>
          <span class="vfd">${argent(d.montant)}</span>
          ${aPayer ? `<button class="btn xs pri" data-part="${d.id}|${esc(moi)}" title="Tu fais le virement à ${esc(d.payePar)}">↩ J'ai payé ma part · ${argent(part)}</button>` : ''}
          ${pr.doivent.filter(m => m !== moi).length ? `<button class="btn xs" data-rp="${d.id}" title="Noter la part de quelqu'un d'autre">${ouvert ? '▾' : '↩'}</button>` : ''}
          <button class="btn xs" data-x="${d.id}" title="Retirer">✕</button>
          ${ouvert ? `<div class="bu-parts">${pr.doivent.filter(m => m !== moi).map(m => `<button class="chip" data-part="${d.id}|${esc(m)}">${esc(m)} a payé sa part · ${argent(part)}</button>`).join('')}</div>` : ''}</div>`;
      })()).join('')
      : '<span class="nt">Aucune dépense ce mois-ci.</span>';
    const ligneAbo = a => `<div class="bu-d"><span class="bu-d-c"><b>${esc(a.titre)}</b><span class="nt">${a.cadence === 'an'
        ? 'chaque ' + (a.jour || 1) + ' ' + new Date((a.depuis || auj().slice(0, 7)) + '-15').toLocaleDateString('fr-CA', { month: 'long' })
        : 'le ' + (a.jour || 1) + ' du mois'} · payé par ${esc(a.payePar)}${a.actif === false ? ' · arrêté' : ''}</span></span>
        <span class="vfd">${argent(a.montant)}</span><button class="btn xs" data-ab="${a.id}">${a.actif === false ? 'Reprendre' : 'Arrêter'}</button></div>`;
    const parMois = B.abos.filter(a => a.cadence !== 'an'), parAn = B.abos.filter(a => a.cadence === 'an');
    $('#buAbos').innerHTML = B.abos.length
      ? (parMois.length ? `<span class="bu-cad">Chaque mois</span>` + parMois.map(ligneAbo).join('') : '')
        + (parAn.length ? `<span class="bu-cad">Chaque année</span>` + parAn.map(ligneAbo).join('') : '')
      : '<span class="nt">Ex. le loyer du studio : écris-le à gauche avec son prix, puis « ↻ Chaque mois ».</span>';
  }

  function lire() {
    const titre = $('#buTitre').value.trim(), montant = parseFloat($('#buMontant').value.replace(/\s/g, '').replace(',', '.'));
    if (!titre) { $('#buTitre').focus(); msg('Écris ce que c\'est'); return null; }
    if (!(montant > 0)) { $('#buMontant').focus(); msg('Indique le montant'); return null; }
    return { titre, montant: Math.round(montant * 100) / 100, payePar: paye, pour: [...pour], date: $('#buDate').value || auj(), cat: $('#buCat').value };
  }
  $('#buAjout').onclick = async () => { const d = lire(); if (!d) return; B.dep.push(await BK.db.ecrire('depenses', d)); $('#buTitre').value = ''; $('#buMontant').value = ''; B.mois = d.date.slice(0, 7); msg('Dépense ajoutée'); rendre(); };
  const poserAbo = async cadence => { const d = lire(); if (!d) return;
    const a = await BK.db.ecrire('abonnements', { titre: d.titre, montant: d.montant, payePar: d.payePar, pour: d.pour, cat: d.cat === 'Autre' ? 'Abonnement' : d.cat, jour: +d.date.slice(8, 10) || 1, depuis: d.date.slice(0, 7), cadence, actif: true });
    B.abos.push(a); await reporterAbos(); $('#buTitre').value = ''; $('#buMontant').value = ''; msg(cadence === 'an' ? 'Ajouté chaque année' : 'Ajouté chaque mois'); rendre(); };
  $('#buAbo').onclick = () => poserAbo('mois');
  $('#buAboAn').onclick = () => poserAbo('an');
  ['#buTitre', '#buMontant'].forEach(s => $(s).addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') $('#buAjout').click(); }));
  $('#buMois').onchange = e => { B.mois = e.target.value; rendre(); };
  page.addEventListener('click', async e => {
    const x = e.target.closest('[data-x]'), r = e.target.closest('[data-remb]'), ab = e.target.closest('[data-ab]'), ok = e.target.closest('[data-pok]'), non = e.target.closest('[data-pnon]');
    const pt = e.target.closest('[data-part]'), rp = e.target.closest('[data-rp]');
    if (rp) { B.rOuvert.has(rp.dataset.rp) ? B.rOuvert.delete(rp.dataset.rp) : B.rOuvert.add(rp.dataset.rp); return rendre(); }
    if (pt) { const [id, qui] = pt.dataset.part.split('|'); const d = B.dep.find(y => y.id === id); if (!d) return;
      const { part } = partsRestantes(d);
      B.dep.push(await BK.db.ecrire('depenses', { type: 'remboursement', de: qui, a: d.payePar, montant: part, date: auj(), dep: d.id, titre: d.titre }));
      B.rOuvert.delete(id); msg(qui + ' a payé sa part de « ' + d.titre + ' »'); return rendre(); }
    if (ok || non) { const p = (B.props || []).find(y => y.id === (ok || non).dataset[ok ? 'pok' : 'pnon']); if (!p) return;
      if (ok) B.dep.push(await BK.db.ecrire('depenses', { titre: p.titre, montant: +p.montant, payePar: B.membres.includes(p.payePar) ? p.payePar : paye, pour: (p.pour || []).filter(m => B.membres.includes(m)), date: p.date || auj(), cat: 'Autre', discord: p.source || '' }));
      p.statut = ok ? 'ok' : 'non'; await BK.db.ecrire('propositions', p); B.props = B.props.filter(y => y !== p); msg(ok ? 'Dépense ajoutée' : 'Ignorée'); rendre(); return; }
    if (x) { B.dep = B.dep.filter(d => d.id !== x.dataset.x); await BK.db.supprimer('depenses', x.dataset.x); msg('Retirée'); rendre(); }
    if (r) { const [de, a, m] = r.dataset.remb.split('|'); B.dep.push(await BK.db.ecrire('depenses', { type: 'remboursement', de, a, montant: +m, date: auj() })); msg(de + ' a remboursé ' + a); rendre(); }
    if (ab) { const a = B.abos.find(y => y.id === ab.dataset.ab); a.actif = a.actif === false; if (a.actif) a.depuis = auj().slice(0, 7); await BK.db.ecrire('abonnements', a); msg(a.actif ? 'Repris' : 'Arrêté (plus ajouté les prochains mois)'); rendre(); }
  });
  charger();
});
})();
