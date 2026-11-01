// =====================================================================
// BUDGET (mobile) — qui doit combien à qui, les dépenses du mois, et « + Dépense » pour noter
// tout de suite ce qu'on vient de payer (le ticket à la main). Les remboursements et les abonnements
// se gèrent sur le PC. Même calcul que le PC (modules/budget.js, BK.budgetSoldes).
// =====================================================================
(() => {
const { esc, auj } = BKM;
const MEMBRES = ['Yacine', 'Pierre', 'Baptiste'];
const CATS = ['Studio', 'Abonnement', 'Mixage / master', 'Matériel', 'Tournage', 'Promo', 'Transport', 'Autre'];
const euros = n => (Math.round(n * 100) / 100).toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $';
// qui doit à qui (copie du calcul du PC : chacun paie sa part de ce qui est « pour » lui)
function soldes(dep) {
  const solde = Object.fromEntries(MEMBRES.map(m => [m, 0]));
  for (const d of dep) {
    if (d.type === 'remboursement') { solde[d.de] = (solde[d.de] || 0) + d.montant; solde[d.a] = (solde[d.a] || 0) - d.montant; continue; }
    const pour = (d.pour && d.pour.length ? d.pour : MEMBRES), part = d.montant / pour.length;
    solde[d.payePar] = (solde[d.payePar] || 0) + d.montant;
    for (const p of pour) solde[p] = (solde[p] || 0) - part;
  }
  const doit = Object.entries(solde).filter(([, v]) => v < -0.5).map(([n, v]) => ({ n, v: -v })).sort((a, b) => b.v - a.v);
  const recoit = Object.entries(solde).filter(([, v]) => v > 0.005).map(([n, v]) => ({ n, v })).sort((a, b) => b.v - a.v);
  const vir = [];
  for (const d of doit) for (const r of recoit) { if (d.v < 0.5) break; const x = Math.min(d.v, r.v); if (x < 0.5) continue; vir.push({ de: d.n, a: r.n, montant: x }); d.v -= x; r.v -= x; }
  return vir;
}

BKM.ecran('budget', { nom: 'Budget', ordre: 45, async dessiner(z, plus, frais) {
  const dep = (await BKM.liste('depenses')).filter(d => d && typeof d.montant === 'number');
  if (!frais()) return;
  const mois = auj().slice(0, 7), duMois = dep.filter(d => (d.date || '').startsWith(mois) && d.type !== 'remboursement').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const vir = soldes(dep), total = duMois.reduce((s, d) => s + d.montant, 0);
  z.innerHTML = `
    <button class="btn pri mo-ajout" id="moAjDep">+ Noter une dépense</button>
    <h2 class="mo-sous">Qui doit à qui</h2>
    ${vir.length ? vir.map(v => `<div class="mo-bu-v" style="--pc:${BKM.couleur(v.de)}"><b>${esc(v.de)}</b><span>doit</span><b>${euros(v.montant)}</b><span>à</span><b style="color:${BKM.couleur(v.a)}">${esc(v.a)}</b></div>`).join('')
      : '<p class="mo-nt">Tout le monde est quitte.</p>'}
    <h2 class="mo-sous">Ce mois-ci <em>${euros(total)}</em></h2>
    ${duMois.length ? duMois.map(d => `<div class="mo-bu-d"><span class="mo-bu-m">${euros(d.montant)}</span><span class="mo-bu-t"><b>${esc(d.titre || 'Dépense')}</b>
        <em>${esc([BKM.dateFr(d.date, { day: 'numeric', month: 'short' }), 'payé par ' + (d.payePar || '?'), d.cat, d.miette && 'proposée par Miette'].filter(Boolean).join(' · '))}</em></span></div>`).join('')
      : '<p class="mo-nt">Aucune dépense ce mois-ci.</p>'}
    <p class="mo-nt">Rembourser quelqu'un, les abonnements, les autres mois : sur le PC (onglet Budget).</p>`;
  z.querySelector('#moAjDep').onclick = ajouter;
} });

function ajouter() {
  const moi = BK.reglage('nomPc', ''), qui = MEMBRES.includes(moi) ? moi : MEMBRES[0];
  BKM.feuille({ titre: 'Nouvelle dépense', corps: `
      <input class="fld" id="dpTitre" maxlength="80" placeholder="Quoi ? (ex. Location caméra)" required>
      <div class="mo-ft-2"><label><span class="mo-eng">Montant ($)</span><input class="fld" id="dpMontant" inputmode="decimal" placeholder="0,00" required></label>
        <label><span class="mo-eng">Le</span><input class="fld" type="date" id="dpDate" value="${esc(auj())}"></label></div>
      <span class="mo-eng">Payé par</span><div class="mo-chips" data-un id="dpPaye">${MEMBRES.map(m => `<button type="button" class="chip${m === qui ? ' on' : ''}" data-c="${esc(m)}" style="--pc:${BKM.couleur(m)}">${esc(m)}</button>`).join('')}</div>
      <span class="mo-eng">Pour qui</span><div class="mo-chips" data-plusieurs id="dpPour">${MEMBRES.map(m => `<button type="button" class="chip on" data-c="${esc(m)}" style="--pc:${BKM.couleur(m)}">${esc(m)}</button>`).join('')}</div>
      <label><span class="mo-eng">Catégorie</span><select class="fld" id="dpCat">${CATS.map(c => `<option>${esc(c)}</option>`).join('')}</select></label>`,
    async ok(v) {
      const q = s => v.querySelector(s), titre = q('#dpTitre').value.trim(), montant = parseFloat(q('#dpMontant').value.replace(/\s/g, '').replace(',', '.'));
      if (!titre) { BKM.msg('Écris ce que c\'est'); q('#dpTitre').focus(); return false; }
      if (!(montant > 0)) { BKM.msg('Indique le montant'); q('#dpMontant').focus(); return false; }
      const pour = [...v.querySelectorAll('#dpPour .on')].map(b => b.dataset.c);
      if (!pour.length) { BKM.msg('Choisis pour qui'); return false; }
      await BK.db.ecrire('depenses', { titre, montant: Math.round(montant * 100) / 100, payePar: (q('#dpPaye .on') || {}).dataset?.c || qui, pour, date: q('#dpDate').value || auj(), cat: q('#dpCat').value, creePar: BKM.moi() + ' (téléphone)' });
      BKM.msg('Dépense notée');
    } });
}
})();
