// BIBLIOTHÈQUE (mobile) — les morceaux ; un appui : écouter la version ★ ; « ▾ » : toutes les versions, les paroles, les infos
(() => {
const { $, esc, msg, lire, versions, L } = BKM;
let MORCEAUX = [], ouvert = '', dernierOuvert = '';
const ETAPES = ['Maquette', 'Enreg.', 'Mixage', 'Mastering', 'Release', 'Promo'];   // comme sur le PC (Accueil)

BKM.ecran('biblio', { nom: 'Bibliothèque', ordre: 10, async dessiner(z, plus, frais) {
  MORCEAUX = (await BKM.liste('morceaux')).sort((a, b) => String(a.nom).localeCompare(String(b.nom)));
  if (!frais()) return;
  if (!MORCEAUX.length) { z.innerHTML = '<p class="mo-nt">Aucun morceau dans le Drive.</p>'; return; }
  const etape = m => m.statut === 'sorti' ? 'Sorti' : m.statut === 'prochaine' ? 'Next' : ETAPES[Math.min(m.fait || 0, 5)];
  const carte = m => `
    <div class="mo-morceau-b${ouvert === m.id ? ' ouvert' : ''}" data-mb="${esc(m.id)}">
      <div class="mo-morceau${L.cle === 'b:' + m.id ? ' joue' : ''}">
        <button class="mo-play" data-jouer="${esc(m.id)}" aria-label="Écouter">▶</button>
        <button class="mo-m-txt" data-ouvre="${esc(m.id)}"><b>${esc(m.nom)}</b><span>${esc([m.bpm && m.bpm + ' BPM', m.ton, m.sortie && 'sortie ' + BKM.dateFr(m.sortie, { day: 'numeric', month: 'short' })].filter(Boolean).join(' · ')) || '&nbsp;'}</span></button>
        <span class="dymo sm">${esc(etape(m))}</span>
        <button class="mo-pli" data-ouvre="${esc(m.id)}" aria-label="Détails">${ouvert === m.id ? '▴' : '▾'}</button></div>
      ${ouvert === m.id ? `<div class="mo-detail${ouvert !== dernierOuvert ? ' mo-entre' : ''}" id="moDetail"><p class="mo-nt">Je cherche les versions…</p></div>` : ''}</div>`;
  const groupe = (titre, l) => l.length ? `<h2 class="mo-sous">${titre} <em>${l.length}</em></h2>` + l.map(carte).join('') : '';
  z.innerHTML = groupe('En cours', MORCEAUX.filter(m => m.statut !== 'sorti')) + groupe('Sortis', MORCEAUX.filter(m => m.statut === 'sorti'));
  z.querySelectorAll('[data-jouer]').forEach(b => b.onclick = () => jouer(MORCEAUX.find(m => m.id === b.dataset.jouer)));
  z.querySelectorAll('[data-ouvre]').forEach(b => b.onclick = () => { ouvert = ouvert === b.dataset.ouvre ? '' : b.dataset.ouvre; BKM.redessiner(); });
  majBoutons(); dernierOuvert = ouvert;
  if (ouvert) detail(MORCEAUX.find(m => m.id === ouvert));
} });

// ▶ / ❚❚ sur la bonne ligne
function majBoutons() {
  document.querySelectorAll('[data-jouer]').forEach(b => { const j = L.cle.startsWith('b:' + b.dataset.jouer); b.textContent = j && !BKM.son.paused ? '❚❚' : '▶';
    b.closest('.mo-morceau').classList.toggle('joue', j); });
  document.querySelectorAll('[data-v]').forEach(b => b.classList.toggle('joue', L.cle === b.dataset.v && !BKM.son.paused));
}
L.ecouteurs.add(() => { if (BKM.actuel === 'biblio') majBoutons(); });

async function jouer(m) {
  if (!m) return;
  if (L.cle.startsWith('b:' + m.id)) return lire({ cle: L.cle });           // même morceau : pause / reprise
  msg('Je cherche la version ★…');
  const v = await BKM.sonDe(m, MORCEAUX);
  if (!v) return msg('Pas de version de ' + m.nom + ' sur le Drive (seulement sur un PC)');
  lire({ cle: 'b:' + m.id, titre: m.nom, id: v.id, nom: v.nom });
}

// le détail d'un morceau : ses versions (écouter chacune), ses paroles, ses liens
async function detail(m) {
  const z = $('#moDetail'); if (!z || !m) return;
  const vs = await versions(m, MORCEAUX); if (!$('#moDetail') || ouvert !== m.id) return;
  const liens = (Array.isArray(m.liens) ? m.liens : []).filter(l => l && /^https?:\/\//.test(l.url || ''));
  z.innerHTML = `
    <span class="mo-eng">Versions sur le Drive</span>
    ${vs.length ? vs.map(v => `<button class="mo-version" data-v="b:${esc(m.id)}:${esc(v.id)}" data-vid="${esc(v.id)}" data-vnom="${esc(v.nom)}">
        <span>${v.princ ? '★ ' : ''}${esc(v.nom)}</span><em>${v.t ? esc(BKM.dateFr(v.t.slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' })) : ''}</em></button>`).join('')
      : '<p class="mo-nt">Aucune version sur le Drive.</p>'}
    ${m.paroles ? `<span class="mo-eng">Paroles</span><pre class="mo-paroles">${esc(m.paroles)}</pre>` : ''}
    ${liens.length ? `<span class="mo-eng">Liens</span><div class="mo-chips">${liens.map(l => `<a class="chip" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.titre || l.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 30))}</a>`).join('')}</div>` : ''}
    ${m.notes ? `<span class="mo-eng">Notes</span><p class="mo-nt">${esc(m.notes)}</p>` : ''}`;
  z.querySelectorAll('[data-vid]').forEach(b => b.onclick = () => lire({ cle: b.dataset.v, titre: m.nom + ' · ' + b.dataset.vnom, id: b.dataset.vid, nom: b.dataset.vnom }));
  majBoutons();
}
})();
