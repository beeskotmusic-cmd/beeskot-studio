// TOURNAGES (mobile) — les journées (la plus récente en premier), et dans chacune : les infos, les tenues, le matériel,
// puis chaque reel (passage du morceau à écouter, moodboard, découpage). Le PDF de la fiche s'ouvre sur le téléphone.
// Lecture seule : on modifie sur le PC.
(() => {
const { $, esc, msg, t2, L } = BKM;
const MEMBRES = ['Yacine', 'Pierre', 'Baptiste'];
let ouvert = '', reelOuvert = '', LISTE = [], MORCEAUX = [];
const nomJ = t => t.journee || 'Tournage';
const reelsDe = tr => LISTE.filter(x => x.niveau === 'reel' && x.parent === tr.id).sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
const passageTxt = txt => { const t = String(txt || '').replace(/\s*:\s*/g, ':'), m = t.match(/(\d{1,2}):(\d{2})\s*[-–—à→]\s*(\d{1,2}):(\d{2})/); return m ? { debut: +m[1] * 60 + +m[2], fin: +m[3] * 60 + +m[4] } : null; };
const pasDe = r => r.passage && r.passage.fin > r.passage.debut ? r.passage : passageTxt(((r.plans || [])[0] || {}).audio);
const img = (u, cls) => u ? `<span class="${cls || 'mo-img'}"${BK.img.bg(u)}></span>` : '';

BKM.ecran('tournage', { nom: 'Tournages', ordre: 50, async dessiner(z, plus, frais) {
  if (plus.tour) { ouvert = plus.tour; reelOuvert = ''; }
  [LISTE, MORCEAUX] = await Promise.all([BK.db.liste('tournages'), BK.db.liste('morceaux')]);
  if (!frais()) return;
  const tours = LISTE.filter(x => x.niveau === 'tournage').sort((a, b) => String(b.date || '9999').localeCompare(String(a.date || '9999')));
  const seuls = LISTE.filter(x => x.niveau === 'reel' && !LISTE.some(t => t.id === x.parent));
  const a = BKM.auj();
  const carte = tr => { const rs = reelsDe(tr);
    return `<div class="mo-tour${ouvert === tr.id ? ' ouvert' : ''}${tr.fini ? ' fini' : ''}${(tr.date || '9') < a ? ' passe' : ''}">
      <button class="mo-tour-t" data-tour="${esc(tr.id)}"${tr.couverture ? BK.img.bg(tr.couverture) : ''}>
        <span class="mo-tour-voile"></span>
        <span class="mo-eng">${esc(nomJ(tr))}${tr.fini ? ' · ✓ fait' : ''}</span><b>${esc(tr.titre || 'Sans titre')}</b>
        <em>${esc([tr.date ? BKM.dateFr(tr.date, { weekday: 'short', day: 'numeric', month: 'short' }) : 'date à fixer', tr.heure && tr.heure.replace(':', ' h '), tr.lieu].filter(Boolean).join(' · '))}${rs.length ? ' · ' + rs.length + ' reel' + (rs.length > 1 ? 's' : '') : ''}</em>
        <span class="mo-pli">${ouvert === tr.id ? '▴' : '▾'}</span></button>
      ${ouvert === tr.id ? detail(tr, rs) : ''}</div>`; };
  z.innerHTML = (tours.map(carte).join('') || '<p class="mo-nt">Pas encore de tournage.</p>')
    + (seuls.length ? `<h2 class="mo-sous">Reels sans tournage <em>${seuls.length}</em></h2>` + seuls.map(r => `<div class="mo-tour${ouvert === r.id ? ' ouvert' : ''}"><button class="mo-tour-t petit" data-tour="${esc(r.id)}"><span class="mo-eng">${esc(r.type || 'Reel')}${r.morceau ? ' · ' + esc(r.morceau) : ''}</span><b>${esc(r.titre || 'Reel')}</b><span class="mo-pli">${ouvert === r.id ? '▴' : '▾'}</span></button>${ouvert === r.id ? `<div class="mo-tour-c">${reel(r, true)}<button class="btn sm" data-pdf="${esc(r.id)}">Ouvrir la fiche PDF</button></div>` : ''}</div>`).join('') : '');
  z.querySelectorAll('[data-tour]').forEach(b => b.onclick = () => { ouvert = ouvert === b.dataset.tour ? '' : b.dataset.tour; reelOuvert = ''; BKM.redessiner();
    if (ouvert) setTimeout(() => { const el = document.querySelector(`[data-tour="${CSS.escape(ouvert)}"]`); el && el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80); });
  z.querySelectorAll('[data-reel]').forEach(b => b.onclick = () => { reelOuvert = reelOuvert === b.dataset.reel ? '' : b.dataset.reel; BKM.redessiner(); });
  z.querySelectorAll('[data-pas]').forEach(b => b.onclick = () => jouerPassage(LISTE.find(x => x.id === b.dataset.pas)));
  z.querySelectorAll('[data-pdf]').forEach(b => b.onclick = () => pdf(LISTE.find(x => x.id === b.dataset.pdf), b));
  z.querySelectorAll('[data-zoom]').forEach(b => b.onclick = () => zoom(b.dataset.zoom));
  majPassages();
} });

// une journée dépliée
function detail(tr, rs) {
  const ten = tenues(tr, 'Tenues · pour tous les reels');
  return `<div class="mo-tour-c">
    ${tr.idee ? `<p class="mo-idee">« ${esc(tr.idee)} »</p>` : ''}
    <button class="btn sm" data-pdf="${esc(tr.id)}">Ouvrir la fiche PDF</button>
    <span class="mo-eng">Les reels <em>${rs.length}</em></span>
    ${rs.map(r => `<div class="mo-reel${reelOuvert === r.id ? ' ouvert' : ''}">
      <button class="mo-reel-t" data-reel="${esc(r.id)}"><b>${esc(r.titre || 'Reel')}</b><em>${esc([r.type || 'Reel', r.morceau, pasDe(r) && '♪ ' + t2(pasDe(r).debut) + ' → ' + t2(pasDe(r).fin), (r.plans || []).length + ' plan(s)'].filter(Boolean).join(' · '))}</em><span class="mo-pli">${reelOuvert === r.id ? '▴' : '▾'}</span></button>
      ${reelOuvert === r.id ? reel(r) : ''}</div>`).join('') || '<p class="mo-nt">Pas encore de reel.</p>'}
    ${ten}
    ${tr.materiel ? `<span class="mo-eng">Matériel</span><p class="mo-texte">${esc(tr.materiel)}</p>` : ''}
    ${tr.notes ? `<span class="mo-eng">Notes</span><p class="mo-texte">${esc(tr.notes)}</p>` : ''}</div>`;
}
// un reel déplié
function reel(r, seul) {
  const p = pasDe(r), mood = r.moodboard || [];
  return `<div class="mo-reel-c">
    ${r.idee ? `<p class="mo-idee">« ${esc(r.idee)} »</p>` : ''}
    <div class="mo-pas"><span class="mo-eng">Passage du morceau</span>
      ${p ? `<b>${t2(p.debut)} → ${t2(p.fin)} · ${Math.round(p.fin - p.debut)} s</b>` : '<b class="vide">À choisir (sur le PC)</b>'}
      ${r.morceau ? `<button class="btn sm" data-pas="${esc(r.id)}">▶ Écouter</button>` : ''}</div>
    ${mood.length ? `<span class="mo-eng">Moodboard <em>${mood.length}</em></span><div class="mo-mood">${mood.map(u => `<button class="mo-img" data-zoom="${esc(u)}"${BK.img.bg(u)}></button>`).join('')}</div>` : ''}
    ${(r.references || []).length ? `<span class="mo-eng">Références</span><div class="mo-chips">${r.references.map(x => `<a class="chip" href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.note || x.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 28))}</a>`).join('')}</div>` : ''}
    ${(r.plans || []).length ? `<span class="mo-eng">Découpage <em>${r.plans.length} plan(s)</em></span>` + r.plans.map((pl, i) => `<div class="mo-plan">
        <span class="mo-plan-n">${i + 1}</span><div><b>${esc(pl.cadrage || 'Plan')}</b>${pl.duree ? ` <em>${esc(pl.duree)}</em>` : ''}<p>${esc(pl.action || '')}</p>${pl.notes ? `<p class="mo-nt">${esc(pl.notes)}</p>` : ''}
        ${(pl.imgs || []).length ? `<div class="mo-mood petit">${pl.imgs.map(u => `<button class="mo-img" data-zoom="${esc(u)}"${BK.img.bg(u)}></button>`).join('')}</div>` : ''}</div></div>`).join('') : ''}
    ${tenues(r, 'Tenues · ce reel')}
    ${seul && r.materiel ? `<span class="mo-eng">Matériel</span><p class="mo-texte">${esc(r.materiel)}</p>` : ''}
    ${r.notes ? `<span class="mo-eng">Notes</span><p class="mo-texte">${esc(r.notes)}</p>` : ''}</div>`;
}
function tenues(x, titre) {
  const l = MEMBRES.filter(m => (x.tenues || {})[m] || ((x.tenuesPhotos || {})[m] || []).length);
  if (!l.length) return '';
  return `<span class="mo-eng">${esc(titre)}</span>` + l.map(m => `<div class="mo-tenue" style="--pc:${BKM.couleur(m)}"><b>${esc(m)}</b>${(x.tenues || {})[m] ? `<p>${esc(x.tenues[m])}</p>` : ''}
    ${((x.tenuesPhotos || {})[m] || []).length ? `<div class="mo-mood petit">${x.tenuesPhotos[m].map(u => `<button class="mo-img" data-zoom="${esc(u)}"${BK.img.bg(u)}></button>`).join('')}</div>` : ''}</div>`).join('');
}

// ▶ le passage : la version ★ du morceau (sur le Drive), du début à la fin du passage
async function jouerPassage(r) {
  if (!r) return; const cle = 'p:' + r.id;
  if (L.cle === cle && BKM.son.src) return BKM.lire({ cle });
  const m = MORCEAUX.find(x => x.nom === r.morceau); if (!m) return msg('Morceau introuvable : ' + r.morceau);
  msg('Je cherche la version ★…');
  const v = await BKM.sonDe(m, MORCEAUX); if (!v) return msg('Pas de version de ' + m.nom + ' sur le Drive');
  const p = pasDe(r);
  BKM.lire({ cle, titre: m.nom + (p ? ` · ${t2(p.debut)} → ${t2(p.fin)}` : ''), id: v.id, nom: v.nom, debut: p ? p.debut : 0, fin: p ? p.fin : 0 });
}
function majPassages() { document.querySelectorAll('[data-pas]').forEach(b => { b.textContent = L.cle === 'p:' + b.dataset.pas && !BKM.son.paused ? '❚❚ Pause' : '▶ Écouter'; }); }
L.ecouteurs.add(() => { if (BKM.actuel === 'tournage') majPassages(); });

// une image en grand (on touche pour fermer)
async function zoom(u) {
  const v = document.createElement('div'); v.className = 'mo-zoom'; v.innerHTML = '<p class="mo-nt">Chargement…</p>'; v.onclick = () => v.remove(); document.body.appendChild(v);
  try { let src = BK.img.vite(u);
    if (BK.img.estDrive(u)) { const r = await BK.drive.api(`/files/${BK.img.id(u)}?alt=media`); src = URL.createObjectURL(await r.blob()); }
    if (v.isConnected) v.innerHTML = `<img src="${esc(src)}" alt="">`; } catch (e) { v.innerHTML = '<p class="mo-nt">Image illisible</p>'; }
}

// la fiche PDF (la même que sur le PC), ouverte dans le lecteur PDF du téléphone
async function pdf(t, b) {
  if (!t || !BK.pdfTournage) return msg('PDF indisponible');
  const avant = b.textContent; b.disabled = true; b.textContent = 'Fabrication du PDF…';
  try { const tour = t.niveau === 'tournage';
    const r = await BK.pdfTournage({ t, reels: tour ? reelsDe(t) : [], membres: MEMBRES, dateFr: d => d ? new Date(d + 'T12:00').toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '', mode: 'couleur' });
    const url = URL.createObjectURL(new Blob([r.bytes], { type: 'application/pdf' }));
    const a = document.createElement('a'); a.href = url; a.download = r.nom || 'fiche-tournage.pdf'; a.target = '_blank'; document.body.appendChild(a); a.click(); a.remove();
    msg(r.pages + ' page(s)');
  } catch (e) { console.error(e); msg('PDF impossible : ' + (e.message || e)); }
  b.disabled = false; b.textContent = avant;
}
})();
