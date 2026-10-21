// =====================================================================
// CALENDRIER — l'agenda Google BEESKOT (lu avec son « adresse secrète »)
// + les rendez-vous créés ici (tournages, enregistrements, publications…).
// Ajouter à Google : on ouvre Google Agenda déjà pré-rempli, il suffit d'enregistrer.
// =====================================================================
(() => {
const TYPES = {
  enreg:    { nom: 'Enregistrement', c: 'var(--org)' },
  repet:    { nom: 'Répétition',     c: 'var(--mus)' },
  tournage: { nom: 'Tournage',       c: 'var(--teal)' },
  shooting: { nom: 'Shooting photo', c: 'var(--navy)' },
  mixage:   { nom: 'Mixage',         c: 'var(--rust)' },
  sortie:   { nom: 'Sortie',         c: 'var(--ox)' },
  promo:    { nom: 'Publication',    c: 'var(--olv)' },
  autre:    { nom: 'Autre',          c: '#8a7a66' },
};
BK.typesRdv = TYPES;
const A = { mois: new Date(), google: [], locaux: [], sorties: [], miette: [], promoSeule: false };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const jour = d => d.toISOString().slice(0, 10);
const deviner = t => { t = (t || '').toLowerCase();               // type d'un événement Google d'après son titre
  return /enregistr|record|voix|prise/.test(t) ? 'enreg' : /r[ée]p[ée]t/.test(t) ? 'repet' : /tourn|clip|reel/.test(t) ? 'tournage'
    : /shoot|photo/.test(t) ? 'shooting' : /mix|master/.test(t) ? 'mixage' : /sortie|release/.test(t) ? 'sortie' : /post|publi|promo/.test(t) ? 'promo' : 'autre'; };

// ---------- lire un fichier d'agenda (.ics) ----------
BK.lireIcs = function (txt) {
  const lignes = txt.replace(/\r?\n[ \t]/g, '').split(/\r?\n/), out = []; let ev = null;
  const date = v => { const m = v.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/); if (!m) return null;
    return m[4] ? (m[7] ? new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5])) : new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5])) : new Date(+m[1], m[2] - 1, +m[3]); };
  for (const l of lignes) {
    if (l === 'BEGIN:VEVENT') ev = {};
    else if (l === 'END:VEVENT') { if (ev && ev.debut) out.push(ev); ev = null; }
    else if (ev) { const i = l.indexOf(':'), k = l.slice(0, i), v = l.slice(i + 1).replace(/\\n/g, '\n').replace(/\\,/g, ',');
      if (k.startsWith('DTSTART')) { ev.debut = date(v); ev.journee = !/T\d/.test(v); }
      else if (k === 'SUMMARY') ev.titre = v; else if (k === 'LOCATION') ev.lieu = v; else if (k === 'RRULE') ev.regle = v; }
  }
  // répétitions hebdomadaires simples (ex. la répète du jeudi) : sur 4 mois
  const plus = [];
  for (const e of out) if (/FREQ=WEEKLY/.test(e.regle || '')) {
    const fin = (e.regle.match(/UNTIL=(\d{8})/) || [])[1], n = +((e.regle.match(/COUNT=(\d+)/) || [])[1] || 999), lim = new Date(Date.now() + 120 * 864e5);
    for (let k = 1; k < n; k++) { const d = new Date(e.debut.getTime() + k * 7 * 864e5); if (d > lim || (fin && jour(d).replace(/-/g, '') > fin)) break; plus.push({ ...e, debut: d }); }
  }
  return out.concat(plus);
};

BK.module('agenda', function (page) {
  $('.sub', page).textContent = 'Les rendez-vous du groupe et le planning de promo';
  $('.hdr .right', page).innerHTML = `<div><span class="eng" style="font-size:9px">Mois</span><span class="vfd" id="agMoisH" style="width:170px">—</span></div>`;
  $('.grid', page).innerHTML = `
    <div class="cols">
      <section class="pane vit" aria-label="Vitrine">
        <div class="ligne-titre">
          <button class="btn sm" id="agPrec">◀</button><span class="vfd" id="agMois" style="font-size:15px;min-width:200px;text-align:center">—</span><button class="btn sm" id="agSuiv">▶</button>
          <button class="btn sm" id="agAuj">Aujourd'hui</button>
          <div class="chips" style="margin-left:auto"><button class="chip" id="agPromo">Planning de promo seulement</button></div>
        </div>
        <div class="cal" id="agCal"></div>
      </section>
      <section class="pane reg" aria-label="Réglages"><span class="ptitle">② Nouveau rendez-vous</span>
        <div class="box">
          <div class="form-rdv">
            <label><span class="eng">Type</span><select class="fld" id="agType">${Object.entries(TYPES).map(([k, t]) => `<option value="${k}">${t.nom}</option>`).join('')}</select></label>
            <label><span class="eng">Titre</span><input class="fld" id="agTitre" placeholder="ex. Voix lead, Reel #2…"></label>
            <label><span class="eng">Morceau</span><select class="fld" id="agMorceau"><option value="">—</option></select></label>
            <div class="deux"><label><span class="eng">Date</span><input class="fld" type="date" id="agDate"></label>
              <label><span class="eng">Heure</span><input class="fld" type="time" id="agHeure" value="19:00"></label></div>
            <label><span class="eng">Lieu / réseau</span><input class="fld" id="agLieu" placeholder="studio, Instagram…"></label>
          </div>
          <div class="chips" style="margin-top:12px"><button class="chip" id="agAjout">+ Ajouter</button><button class="chip" id="agGoogle">Ajouter à Google Agenda ↗</button></div></div>
        <div class="box"><span class="lb">Agenda Google BEESKOT</span>
          <span class="nt">Colle ici l'« adresse secrète au format iCal » de l'agenda (Google Agenda › Paramètres de l'agenda). À faire une seule fois, pour tout le groupe.</span>
          <input class="fld" id="agIcs" style="margin-top:8px" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics">
          <div class="chips" style="margin-top:8px"><button class="chip" id="agLire">↻ Relire l'agenda</button></div></div>
        <div class="box"><div class="ligne-titre"><span class="lb">🍞 Miette a repéré sur Discord</span><button class="btn xs pri" id="agMiette" style="margin-left:auto">🍞 Lire Discord et placer les dates</button></div>
          <div id="agRepere" class="ag-repere"></div></div>
        <div class="box grow"><span class="lb">À venir</span><div id="agVenir" class="surv"></div></div>
      </section>
    </div>
    <div class="pane abar"><span class="vfd" id="agMsg">PRÊT</span></div>`;

  const msg = t => $('#agMsg').textContent = String(t).toUpperCase();
  $('#agDate').value = jour(new Date());

  window.addEventListener('bk:annule', () => charger());   // après « ↶ Annuler » : on relit
  async function charger() {
    A.locaux = (await BK.db.liste('evenements')).map(e => ({ ...e, debut: new Date(e.date + 'T' + (e.heure || '00:00')), local: true }));
    const cfg = (await BK.db.liste('config')).find(c => c.id === 'agenda');
    if (cfg && cfg.ics) { $('#agIcs').value = cfg.ics; await lireGoogle(cfg.ics, true); }
    const ms = await BK.db.liste('morceaux');
    // le pont avec la To-do list : une tâche avec une date apparaît aussi ici, avec le nom de qui s'en occupe
    A.taches = (await BK.db.liste('taches')).filter(t => t.date && !t.fait).map(t => ({ type: 'autre', tache: true, titre: '☐ ' + t.texte + (t.qui ? ' · ' + t.qui : ''), morceau: t.morceau, qui: t.qui, debut: new Date(t.date + 'T12:00'), journee: true }));
    A.sorties = ms.filter(m => m.sortie).map(m => ({ type: 'sortie', titre: 'Sortie · ' + m.nom, morceau: m.nom, debut: new Date(m.sortie + 'T12:00'), journee: true, fiche: true }));
    const pl = (await BK.db.liste('veille')).find(d => d.id === 'planning'); A.planning = pl;
    A.miette = (pl && pl.l || []).flatMap(e => (e.dates || []).map(d => ({ ...e, debut: new Date(d + 'T' + (e.heure || '12:00')), journee: !e.heure, miette: true, date: d })))
      .filter(e => !A.locaux.some(x => x.date === e.date && x.type === e.type) && !A.sorties.some(x => e.type === 'sortie' && jour(x.debut) === e.date));
    $('#agMorceau').innerHTML = '<option value="">—</option>' + ms.map(m => `<option>${esc(m.nom)}</option>`).join('');
    rendre();
  }
  async function lireGoogle(url, discret) {
    try {
      const get = BK.T && BK.T.http ? BK.T.http.fetch : window.fetch;      // dans le .exe : sans blocage du navigateur
      const r = await get(url); if (!r.ok) throw new Error(r.status);
      A.google = BK.lireIcs(await r.text()).map(e => ({ ...e, type: deviner(e.titre) }));
      BK.regler('agenda.copie', A.google.map(e => ({ ...e, debut: e.debut.toISOString() })));     // copie pour marcher sans Internet
      discret || msg(A.google.length + ' événements Google');
    } catch (e) {
      A.google = BK.reglage('agenda.copie', []).map(x => ({ ...x, debut: new Date(x.debut) }));
      msg(A.google.length ? 'Hors ligne : dernière copie de l\'agenda' : 'Agenda Google illisible');
    }
  }
  BK.agendaTous = () => [...A.google, ...A.locaux, ...A.sorties].sort((a, b) => a.debut - b.debut);   // pour l'Accueil

  function rendre() {
    const m = A.mois, an = m.getFullYear(), mo = m.getMonth();
    const nomMois = m.toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' }).toUpperCase();
    $('#agMois').textContent = nomMois; $('#agMoisH').textContent = nomMois;
    const tous = [...BK.agendaTous(), ...A.miette, ...(A.taches || [])].filter(e => !A.promoSeule || e.type === 'promo');
    const parJour = {}; for (const e of tous) (parJour[jour(new Date(e.debut.getTime() - e.debut.getTimezoneOffset() * 6e4))] ||= []).push(e);
    const premier = new Date(an, mo, 1), decal = (premier.getDay() + 6) % 7, nb = new Date(an, mo + 1, 0).getDate(), auj = jour(new Date());
    let h = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(j => `<span class="cal-j">${j}</span>`).join('');
    for (let i = 0; i < decal; i++) h += '<div class="cal-c vide"></div>';
    for (let d = 1; d <= nb; d++) {
      const k = `${an}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, evs = parJour[k] || [];
      h += `<div class="cal-c${k === auj ? ' auj' : ''}" data-d="${k}"><span class="cal-n">${d}</span>${evs.slice(0, 3).map(e =>
        `<span class="cal-ev${e.tache ? ' tache' : ''}${e.miette ? ' miette ' + (e.statut === 'valide' ? 'valide' : 'possible') : ''}${e.type === 'sortie' ? ' sortie' : ''}" style="--c:${(TYPES[e.type] || TYPES.autre).c}" title="${esc((e.miette ? '🍞 ' + (e.statut === 'valide' ? 'Décidé sur Discord' : 'Possible (pas encore confirmé)') + ' · ' : '') + (TYPES[e.type] || TYPES.autre).nom + ' · ' + (e.titre || '') + (e.pourquoi ? ' — « ' + e.pourquoi + ' »' : ''))}"${e.miette ? ` data-mi="${esc(e.cle)}"` : ''}>${e.miette && e.statut !== 'valide' ? '? ' : ''}${e.journee ? '' : e.debut.toTimeString().slice(0, 5) + ' '}${esc(e.titre || TYPES[e.type].nom)}</span>`).join('')}${evs.length > 3 ? `<span class="nt cal-plus">+${evs.length - 3}</span>` : ''}</div>`;
    }
    $('#agCal').innerHTML = h;
    $$('.cal-c[data-d]').forEach(c => c.onclick = e => { const mi = e.target.closest('[data-mi]');
      if (mi) return remplirDepuis(A.miette.find(x => x.cle === mi.dataset.mi && x.date === c.dataset.d));
      $('#agDate').value = c.dataset.d; $('#agTitre').focus(); });
    repere();
    const venir = tous.filter(e => e.debut >= new Date(Date.now() - 36e5)).slice(0, 8);
    $('#agVenir').innerHTML = venir.length ? venir.map(e => `<div class="surv-l"><span class="nchip" style="width:5px;height:30px;border-radius:3px;background:${(TYPES[e.type] || TYPES.autre).c}"></span>
      <div><span class="nt" style="margin:0;color:var(--ink)">${esc(e.titre || TYPES[e.type].nom)}${e.morceau ? ' · ' + esc(e.morceau) : ''}</span>
      <span class="nt" style="margin:0;font-size:11px">${e.debut.toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' })}${e.journee ? '' : ' · ' + e.debut.toTimeString().slice(0, 5)} · ${(TYPES[e.type] || TYPES.autre).nom}${e.local ? '' : ' · Google'}</span></div>
      ${e.local ? `<button class="btn xs" data-suppr="${e.id}" style="margin-left:auto">✕</button>` : ''}</div>`).join('') : '<span class="nt">Rien de prévu.</span>';
    $$('[data-suppr]', page).forEach(b => b.onclick = async () => { await BK.db.supprimer('evenements', b.dataset.suppr); await charger(); });
  }

  // ---------- ce que Miette a repéré sur Discord ----------
  function remplirDepuis(e) { if (!e) return;
    $('#agType').value = TYPES[e.type] ? e.type : 'autre'; $('#agTitre').value = e.titre || ''; $('#agMorceau').value = e.morceau || ''; $('#agDate').value = e.date || (e.dates || [])[0] || '';
    if (e.heure) $('#agHeure').value = e.heure; $('#agLieu').value = e.lieu || ''; msg(e.statut === 'valide' ? 'Prêt : « + Ajouter » ou Google ↗' : 'Pas encore confirmé : vérifie la date, puis « + Ajouter »'); }
  function repere() {
    const z = $('#agRepere'), l = (A.planning && A.planning.l || []).filter(e => (e.dates || []).some(d => A.miette.some(x => x.cle === e.cle && x.date === d)));
    z.innerHTML = l.length ? l.map(e => `<div class="ag-rep ${e.statut === 'valide' ? 'valide' : 'possible'}" style="--c:${(TYPES[e.type] || TYPES.autre).c}">
        <div class="ag-rep-c"><b>${e.statut === 'valide' ? '' : '? '}${esc(e.titre || TYPES[e.type]?.nom || '')}${e.morceau ? ' · ' + esc(e.morceau) : ''}</b>
          <span class="nt">${e.dates.map(d => new Date(d + 'T12:00').toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' })).join(' ou ')}${e.heure ? ' · ' + e.heure : ''} · ${e.statut === 'valide' ? 'décidé' : 'possible'}${e.pourquoi ? ' — « ' + esc(e.pourquoi) + ' »' : ''}</span></div>
        <button class="btn xs" data-rep="${esc(e.cle)}" title="Remplir le formulaire">✎</button><button class="btn xs" data-repx="${esc(e.cle)}" title="Ignorer">✕</button></div>`).join('')
      : `<span class="nt">${A.planning && A.planning.t ? 'Rien de prévu dans les messages récents.' : 'Miette lit Discord et place ici les dates dont vous parlez (décidées ou possibles).'}</span>`;
    const lu = A.planning && A.planning.lu;                       // ce que Miette a lu la dernière fois : pour comprendre ce qui manque
    if (lu) { const j = d => d ? new Date(d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' }) : '?';
      z.insertAdjacentHTML('beforeend', `<span class="nt ag-lu">🍞 Dernière lecture : ${lu.messages} message(s) du ${j(lu.de)} au ${j(lu.a)}, dont <b>${lu.mails} mail(s)</b> · ${lu.trouvees} date(s) trouvée(s)${lu.passees ? `, ${lu.passees} déjà passée(s)` : ''}.
        ${lu.mails ? '' : '<br>⚠ Aucun mail lu : vérifie que le salon des mails est coché dans Réglages › Miette & Discord.'}</span>`); }
    $$('[data-rep]', z).forEach(b => b.onclick = () => { const e = A.miette.find(x => x.cle === b.dataset.rep); remplirDepuis(e); if (e) { A.mois = new Date(e.debut.getFullYear(), e.debut.getMonth(), 1); rendre(); } });
    $$('[data-repx]', z).forEach(b => b.onclick = async () => { const d = A.planning; d.ignores = [...(d.ignores || []), b.dataset.repx]; d.l = d.l.filter(x => x.cle !== b.dataset.repx); await BK.db.ecrire('veille', d); await charger(); });
  }
  $('#agMiette').onclick = async () => { const b = $('#agMiette'); b.disabled = true; b.innerHTML = '<span class="spin"></span>Miette lit Discord…';
    try { const d = await BK.discord.planning(); msg((d.l || []).length + ' date(s) repérée(s)'); } catch (e) { msg(e.message); }
    b.disabled = false; b.textContent = '🍞 Lire Discord et placer les dates'; await charger(); };
  const lireForm = () => ({ type: $('#agType').value, titre: $('#agTitre').value.trim() || TYPES[$('#agType').value].nom, morceau: $('#agMorceau').value,
    date: $('#agDate').value, heure: $('#agHeure').value, lieu: $('#agLieu').value.trim() });
  $('#agAjout').onclick = async () => { const f = lireForm(); if (!f.date) return msg('Choisis une date'); await BK.db.ecrire('evenements', f); $('#agTitre').value = ''; msg('Rendez-vous ajouté'); await charger(); };
  $('#agGoogle').onclick = () => {           // ouvre Google Agenda pré-rempli : on n'a qu'à cliquer « Enregistrer »
    const f = lireForm(); if (!f.date) return msg('Choisis une date');
    const d = new Date(f.date + 'T' + (f.heure || '19:00')), fin = new Date(d.getTime() + 2 * 36e5), z = x => x.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const url = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(`${TYPES[f.type].nom} · ${f.titre}${f.morceau ? ' · ' + f.morceau : ''}`) +
      `&dates=${z(d)}/${z(fin)}&location=` + encodeURIComponent(f.lieu) + '&details=' + encodeURIComponent('Ajouté depuis BEESKOT Studio');
    BK.estExe ? BK.T.opener.openUrl(url) : window.open(url, '_blank');
    msg('Google Agenda ouvert');
  };
  $('#agIcs').onchange = async e => { const url = e.target.value.trim(); await BK.db.ecrire('config', { id: 'agenda', ics: url }); if (url) { await lireGoogle(url); rendre(); } };
  $('#agLire').onclick = async () => { const url = $('#agIcs').value.trim(); if (!url) return msg('Colle d\'abord l\'adresse'); await lireGoogle(url); rendre(); };
  $('#agPrec').onclick = () => { A.mois = new Date(A.mois.getFullYear(), A.mois.getMonth() - 1, 1); rendre(); };
  $('#agSuiv').onclick = () => { A.mois = new Date(A.mois.getFullYear(), A.mois.getMonth() + 1, 1); rendre(); };
  $('#agAuj').onclick = () => { A.mois = new Date(); rendre(); };
  $('#agPromo').onclick = e => { A.promoSeule = !A.promoSeule; e.target.classList.toggle('on', A.promoSeule); rendre(); };
  BK.agendaRecharger = charger;
  charger();
});
})();
