// CALENDRIER (mobile) — le mois en petit (des points de couleur), puis la liste des jours.
// Sources : les rendez-vous du logiciel, l'agenda Google (la copie que les PC déposent dans le Drive),
// les sorties des morceaux, les tâches avec une date, les journées de Tournages. Lecture seule.
(() => {
const { esc, auj } = BKM;
const TYPES = {
  enreg: ['Enregistrement', '#d2722e'], repet: ['Répétition', '#b05a8c'], tournage: ['Tournage', '#2f7377'], shooting: ['Shooting photo', '#3f6f9a'],
  mixage: ['Mixage', '#c9682c'], sortie: ['Sortie', '#7a2430'], promo: ['Publication', '#6c8a3a'], autre: ['Autre', '#8a7a66'], tache: ['Tâche', '#d9b67a'],
};
const deviner = t => { t = (t || '').toLowerCase();               // comme sur le PC : le type d'un événement Google d'après son titre
  return /enregistr|record|voix|prise/.test(t) ? 'enreg' : /r[ée]p[ée]t/.test(t) ? 'repet' : /tourn|clip|reel/.test(t) ? 'tournage'
    : /shoot|photo/.test(t) ? 'shooting' : /mix|master/.test(t) ? 'mixage' : /sortie|release/.test(t) ? 'sortie' : /post|publi|promo/.test(t) ? 'promo' : 'autre'; };
const jourDe = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
let mois = null;

BKM.ecran('agenda', { nom: 'Calendrier', ordre: 20, async dessiner(z, plus, frais) {
  const [evs, ms, ts, tours, cfg] = await Promise.all([BKM.liste('evenements'), BKM.liste('morceaux'), BKM.liste('taches'), BKM.liste('tournages'), BKM.liste('config')]);
  const google = ((cfg.find(c => c.id === 'partage-agenda.google') || {}).v) || [];                // la copie de l'agenda Google déposée par les PC
  if (!frais()) return;
  const tous = [];
  for (const e of evs) if (e.date) tous.push({ d: e.date, h: e.heure || '', type: TYPES[e.type] ? e.type : 'autre', titre: e.titre || TYPES[e.type]?.[0] || 'Rendez-vous', sous: [e.morceau, e.lieu].filter(Boolean).join(' · '), fin: e.fin || '', tour: e.tournage || '' });
  for (const g of (Array.isArray(google) ? google : [])) { const d = new Date(g.debut); if (isNaN(d)) continue;
    tous.push({ d: jourDe(d), h: g.journee ? '' : d.toTimeString().slice(0, 5), type: deviner(g.titre), titre: g.titre || 'Agenda Google', sous: g.lieu || '', google: true }); }
  for (const m of ms) if (m.sortie) tous.push({ d: m.sortie, type: 'sortie', titre: 'Sortie · ' + m.nom });
  for (const t of ts) if (t.date && !t.fait) tous.push({ d: t.date, type: 'tache', titre: t.texte, sous: [t.qui, ...(t.aussi || [])].filter(Boolean).join(' + ') });
  for (const t of tours) if (t.niveau === 'tournage' && t.date && !tous.some(x => x.d === t.date && (x.tour === t.id || /tournage|shooting/.test(x.type))))
    tous.push({ d: t.date, h: t.heure || '', type: /photo/i.test(t.journee || '') ? 'shooting' : 'tournage', titre: t.titre || 'Tournage', sous: t.lieu || '', tour: t.id });
  tous.sort((a, b) => (a.d + a.h).localeCompare(b.d + b.h));

  const a = auj(); if (!mois) mois = a.slice(0, 7);
  const [an, mo] = mois.split('-').map(Number), premier = new Date(an, mo - 1, 1), nbJ = new Date(an, mo, 0).getDate(), decal = (premier.getDay() + 6) % 7;
  const parJour = {}; tous.forEach(e => (parJour[e.d] = parJour[e.d] || []).push(e));
  const nomMois = premier.toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' });
  const cases = [...Array(decal)].map(() => '<span class="mo-cal-j vide"></span>').join('') + [...Array(nbJ)].map((_, i) => { const d = `${mois}-${String(i + 1).padStart(2, '0')}`, l = parJour[d] || [];
    return `<button class="mo-cal-j${d === a ? ' auj' : ''}${l.length ? ' plein' : ''}" data-j="${d}"><b>${i + 1}</b><span>${l.slice(0, 3).map(e => `<i style="background:${TYPES[e.type][1]}"></i>`).join('')}</span></button>`; }).join('');
  const ceMois = mois === a.slice(0, 7), lim = (() => { const d = new Date(); d.setDate(d.getDate() + 60); return jourDe(d); })();
  // le mois en cours : tout ce qui arrive dans les 60 prochains jours ; un autre mois : ce mois-là
  const duMois = tous.filter(e => ceMois ? e.d >= a && e.d <= lim : e.d.startsWith(mois));
  const jours = [...new Set(duMois.map(e => e.d))];
  z.innerHTML = `
    <div class="mo-cal-tete"><button class="btn sm" data-m="-1">‹</button><b>${esc(nomMois.charAt(0).toUpperCase() + nomMois.slice(1))}</b><button class="btn sm" data-m="1">›</button></div>
    <div class="mo-cal">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(x => `<span class="mo-cal-n">${x}</span>`).join('')}${cases}</div>
    ${mois !== a.slice(0, 7) ? '<button class="chip" id="moAuj" style="margin:10px 0 0">Revenir à aujourd\'hui</button>' : ''}
    <h2 class="mo-sous">${ceMois ? 'À venir' : 'Ce mois-là'}</h2>
    ${jours.map(d => `<div class="mo-jour" id="j-${d}"><span class="mo-eng">${d === a ? 'Aujourd\'hui · ' : ''}${esc(BKM.dateFr(d))}</span>
      ${parJour[d].map(e => `<${e.tour ? 'button' : 'div'} class="mo-ev" style="--c:${TYPES[e.type][1]}"${e.tour ? ` data-tour="${esc(e.tour)}"` : ''}>
        <span class="mo-ev-h">${esc(e.h ? e.h.replace(':', ' h ') : 'journée')}</span>
        <span class="mo-ev-t"><b>${esc(e.titre)}</b><em>${esc([TYPES[e.type][0], e.sous, e.fin && 'jusqu\'au ' + BKM.dateFr(e.fin, { day: 'numeric', month: 'short' }), e.google && 'Google'].filter(Boolean).join(' · '))}</em></span>${e.tour ? '<span class="mo-ev-fl">›</span>' : ''}</${e.tour ? 'button' : 'div'}>`).join('')}</div>`).join('') || '<p class="mo-nt">Rien de prévu.</p>'}
    ${!(Array.isArray(google) && google.length) ? '<p class="mo-nt">L\'agenda Google arrive ici dès qu\'un PC l\'a relu (onglet Calendrier).</p>' : ''}`;
  z.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { const d = new Date(an, mo - 1 + +b.dataset.m, 1); mois = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); BKM.redessiner(); });
  const r = z.querySelector('#moAuj'); if (r) r.onclick = () => { mois = null; BKM.redessiner(); };
  z.querySelectorAll('[data-j]').forEach(b => b.onclick = () => { const el = document.getElementById('j-' + b.dataset.j); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  z.querySelectorAll('[data-tour]').forEach(b => b.onclick = () => BKM.ouvrir('tournage', { tour: b.dataset.tour }));
} });
})();
