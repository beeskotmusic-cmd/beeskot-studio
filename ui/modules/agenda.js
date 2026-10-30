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

// la couleur de chaque membre (la même que dans l'onglet Écoute)
const COUL_M = { Yacine: '#f1c453', Pierre: '#5fb0ff', Baptiste: '#c58af0' };
const couleurM = m => COUL_M[m] || BK.couleurTag('m:' + m);
// les dispos partagées : { jour: { nom: 'oui' | 'non' } }. Les anciennes (une liste de noms dispo) sont reprises telles quelles.
async function lireDispos() {
  const d = await BK.partage.lire('dispos2', null);
  if (d) return d;
  const vieux = await BK.partage.lire('dispos', {}), out = {};
  for (const [j, l] of Object.entries(vieux || {})) if (Array.isArray(l)) { out[j] = {}; for (const m of l) out[j][m] = 'oui'; }
  return out;
}

BK.module('agenda', function (page) {
  $('.sub', page).textContent = 'Les rendez-vous du groupe et le planning de promo';
  $('.hdr .right', page).innerHTML = `<div><span class="eng" style="font-size:9px">Mois</span><span class="vfd" id="agMoisH" style="width:170px">—</span></div>`;
  $('.grid', page).innerHTML = `
    <div class="cols">
      <section class="pane vit" aria-label="Vitrine">
        <div class="ligne-titre">
          <button class="btn sm" id="agPrec">◀</button><span class="vfd" id="agMois" style="font-size:15px;min-width:200px;text-align:center">—</span><button class="btn sm" id="agSuiv">▶</button>
          <button class="btn sm" id="agAuj">Aujourd'hui</button>
          <div class="chips" style="margin-left:auto"><button class="chip" id="agPromo">Planning de promo seulement</button><button class="btn xs miette-aide" id="agMiette" title="Miette relit Discord et les mails, et place les dates dont vous parlez">Trouver les dates</button></div>
        </div>
        <div class="cal" id="agCal"></div>
        <div class="ag-legende" id="agLeg"></div>
      </section>
      <section class="pane reg" aria-label="Réglages"><span class="ptitle">② Nouveau rendez-vous</span>
        <div class="box">
          <div class="form-rdv">
            <label><span class="eng">Type</span><select class="fld" id="agType">${Object.entries(TYPES).map(([k, t]) => `<option value="${k}">${t.nom}</option>`).join('')}</select></label>
            <label><span class="eng">Titre</span><input class="fld" id="agTitre" placeholder="ex. Voix lead, Reel #2…"></label>
            <label><span class="eng">Morceau</span><select class="fld" id="agMorceau"><option value="">—</option></select></label>
            <div class="deux"><label><span class="eng">Date</span><input class="fld" type="date" id="agDate"></label>
              <label><span class="eng">Heure</span><input class="fld" type="time" id="agHeure" value="19:00"></label></div>
            <label><span class="eng">Jusqu'au (période, facultatif)</span><input class="fld" type="date" id="agFin"></label>
            <label><span class="eng">Lieu / réseau</span><input class="fld" id="agLieu" placeholder="studio, Instagram…"></label>
          </div>
          <div class="chips" style="margin-top:12px"><button class="chip" id="agAjout">+ Ajouter</button><button class="chip" id="agGoogle">Ajouter à Google Agenda ↗</button></div></div>
        <div class="box"><span class="lb">Agenda Google BEESKOT</span>
          <span class="nt">Colle ici l'« adresse secrète au format iCal » de l'agenda (Google Agenda › Paramètres de l'agenda). À faire une seule fois, pour tout le groupe.</span>
          <input class="fld" id="agIcs" style="margin-top:8px" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics">
          <div class="chips" style="margin-top:8px"><button class="chip" id="agLire">↻ Relire l'agenda</button></div></div>
        <div class="box miette-seul"><div class="ligne-titre"><span class="lb">Miette a repéré (Discord et mails)</span></div>
          <div id="agRepere" class="ag-repere"></div></div>
        <div class="box grow"><span class="lb">À venir</span><div id="agVenir" class="surv"></div></div>
      </section>
    </div>
    <div class="pane abar"><span class="vfd" id="agMsg">PRÊT</span></div>`;

  const msg = t => $('#agMsg').textContent = String(t).toUpperCase();
  $('#agDate').value = jour(new Date());

  window.addEventListener('bk:annule', () => charger());
  window.addEventListener('bk:ia', () => A.locaux && rendre());       // Miette allumée / coupée : ses dates apparaissent / disparaissent
  async function charger() {
    A.locaux = (await BK.db.liste('evenements')).map(e => ({ ...e, debut: new Date(e.date + 'T' + (e.heure || '00:00')), local: true, journee: e.journee || !!e.fin }));
    const cfg = (await BK.db.liste('config')).find(c => c.id === 'agenda');
    if (cfg && cfg.ics) { $('#agIcs').value = cfg.ics; await lireGoogle(cfg.ics, true); }
    const ms = await BK.db.liste('morceaux');
    // le pont avec la To-do list : une tâche avec une date apparaît aussi ici, avec le nom de qui s'en occupe
    A.taches = (await BK.db.liste('taches')).filter(t => t.date && !t.fait).map(t => ({ type: 'autre', tache: true, titre: '☐ ' + t.texte + (t.qui ? ' · ' + [t.qui, ...(t.aussi || [])].join(' + ') : ''), morceau: t.morceau, qui: t.qui, debut: new Date(t.date + 'T12:00'), journee: true }));
    A.sorties = ms.filter(m => m.sortie).map(m => ({ type: 'sortie', titre: 'Sortie · ' + m.nom, morceau: m.nom, debut: new Date(m.sortie + 'T12:00'), journee: true, fiche: true }));
    const pl = (await BK.db.liste('veille')).find(d => d.id === 'planning'); A.planning = pl;
    A.dispos = await lireDispos();
    A.dispMiette = await BK.partage.lire('dispos.miette', {}).catch(() => ({}));   // les absences lues par Miette sur Discord (à valider)                                    // { 'AAAA-MM-JJ': { Yacine: 'oui', Pierre: 'non' } } — partagé avec tout le groupe
    const cfgM = (await BK.db.liste('config')).find(c => c.id === 'membres');
    A.membres = (cfgM && cfgM.liste && cfgM.liste.length ? cfgM.liste : ['Yacine', 'Pierre', 'Baptiste']).map(m => m === 'Dari' ? 'Yacine' : m).filter(m => m && m !== 'BEESKOT');
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
    const tous = [...BK.agendaTous(), ...(BK.ia.active() ? A.miette || [] : []), ...(A.taches || [])]   // Miette coupée : ses dates pas encore validées disparaissent
      .filter(e => !A.promoSeule || e.type === 'promo');
    const parJour = {}; for (const e of tous) { const d0 = jour(new Date(e.debut.getTime() - e.debut.getTimezoneOffset() * 6e4));
      (parJour[d0] ||= []).push(e);
      if (e.fin && e.fin > d0) for (let x = new Date(d0 + 'T12:00'), i = 0; i < 120; i++) { x.setDate(x.getDate() + 1); const k = jour(x); if (k > e.fin) break;   // une période : elle continue les jours suivants
        (parJour[k] ||= []).push({ ...e, suite: true }); } }
    const premier = new Date(an, mo, 1), decal = (premier.getDay() + 6) % 7, nb = new Date(an, mo + 1, 0).getDate(), auj = jour(new Date());
    let h = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(j => `<span class="cal-j">${j}</span>`).join('');
    for (let i = 0; i < decal; i++) h += '<div class="cal-c vide"></div>';
    for (let d = 1; d <= nb; d++) {
      const k = `${an}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, evs = parJour[k] || [];
      const dj = (A.dispos || {})[k] || {}, dmi = BK.ia.active() ? (A.dispMiette || {})[k] || {} : {};
      const qui = (A.membres || []).filter(m => dj[m] || dmi[m]);
      const tousD = A.membres && A.membres.length && A.membres.every(m => dj[m] === 'oui');
      const titreD = qui.map(m => dj[m] ? m + (dj[m] === 'oui' ? ' : dispo' : ' : pas là') : m + ' : pas là, d\'après Discord (à valider) — « ' + (dmi[m].pourquoi || '') + ' »').join(' · ');
      const pastilles = qui.length ? `<span class="cal-dispo" title="${esc(titreD)}">${qui.map(m => `<i class="${dj[m] ? (dj[m] === 'oui' ? 'oui' : 'non') : 'non miette'}" style="--m:${couleurM(m)}">${esc(m[0])}</i>`).join('')}</span>` : '';
      h += `<div class="cal-c${k === auj ? ' auj' : ''}${tousD ? ' tous-dispo' : ''}${(A.sel || new Set()).has(k) ? ' sel' : ''}" data-d="${k}"><span class="cal-n">${d}</span>${pastilles}${evs.slice(0, 3).map(e =>
        `<span class="cal-ev${e.tache ? ' tache' : ''}${e.fin ? ' periode' + (e.suite ? ' suite' : '') : ''}${e.miette ? ' miette ' + (e.statut === 'valide' ? 'valide' : 'possible') : ''}${e.local && e.miette ? ' mi-ev' : ''}${e.type === 'sortie' ? ' sortie' : ''}" style="--c:${(TYPES[e.type] || TYPES.autre).c}" title="${esc((e.miette ? '🍞 ' + (e.statut === 'valide' ? 'Décidé sur Discord' : 'Possible (pas encore confirmé)') + ' · ' : '') + (TYPES[e.type] || TYPES.autre).nom + ' · ' + (e.titre || '') + (e.pourquoi ? ' — « ' + e.pourquoi + ' »' : ''))}"${e.miette ? ` data-mi="${esc(e.cle)}"` : ''}>${e.miette && e.statut !== 'valide' ? '? ' : ''}${e.suite ? '↔ ' : e.journee || e.fin ? '' : e.debut.toTimeString().slice(0, 5) + ' '}${esc(e.titre || TYPES[e.type].nom)}</span>`).join('')}${evs.length > 3 ? `<span class="nt cal-plus">+${evs.length - 3}</span>` : ''}</div>`;
    }
    $('#agCal').innerHTML = h;
    $('#agLeg').innerHTML = (A.membres || []).map(m => `<span><i style="--m:${couleurM(m)}">${esc(m[0])}</i>${esc(m)}</span>`).join('')
      + '<span><i class="oui"></i>dispo</span><span><i class="non"></i>pas là</span>' + (BK.ia.active() ? '<span><i class="non miette" style="background:transparent;border:1px dashed #d0574f"></i>pas là, lu par Miette (à valider)</span>' : '') + '<span class="nt">clic droit sur un jour · Maj + clic pour une période</span>';
    $$('.cal-c[data-d]').forEach(c => { c.onclick = e => { const mi = e.target.closest('[data-mi]');
      if (mi) return remplirDepuis(A.miette.find(x => x.cle === mi.dataset.mi && x.date === c.dataset.d));
      choisirJours(c.dataset.d, e.shiftKey);
      $('#agDate').value = [...A.sel].sort()[0]; $('#agTitre').focus(); };
      c.oncontextmenu = e => { e.preventDefault(); if (!A.sel || !A.sel.has(c.dataset.d)) choisirJours(c.dataset.d, e.shiftKey); menuJours(e.clientX, e.clientY); }; });
    repere();
    const venir = tous.filter(e => e.debut >= new Date(Date.now() - 36e5)).slice(0, 8);
    $('#agVenir').innerHTML = venir.length ? venir.map(e => `<div class="surv-l"><span class="nchip" style="width:5px;height:30px;border-radius:3px;background:${(TYPES[e.type] || TYPES.autre).c}"></span>
      <div><span class="nt" style="margin:0;color:var(--ink)">${esc(e.titre || TYPES[e.type].nom)}${e.morceau ? ' · ' + esc(e.morceau) : ''}</span>
      <span class="nt" style="margin:0;font-size:11px">${e.debut.toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' })}${e.fin ? ' → ' + new Date(e.fin + 'T12:00').toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' }) : e.journee ? '' : ' · ' + e.debut.toTimeString().slice(0, 5)} · ${(TYPES[e.type] || TYPES.autre).nom}${e.local ? '' : ' · Google'}</span></div>
      ${e.local ? `<button class="btn xs" data-suppr="${e.id}" style="margin-left:auto">✕</button>` : ''}</div>`).join('') : '<span class="nt">Rien de prévu.</span>';
    $$('[data-suppr]', page).forEach(b => b.onclick = async () => { await BK.db.supprimer('evenements', b.dataset.suppr); await charger(); });
  }

  // ---------- choisir des jours : clic = un jour, Maj + clic = toute une période ----------
  function choisirJours(d, periode) {
    A.sel = A.sel || new Set();
    if (periode && A.ancre) { const [a, b] = [A.ancre, d].sort(); A.sel = new Set();
      for (let x = new Date(a + 'T12:00'); jour(x) <= b; x.setDate(x.getDate() + 1)) A.sel.add(jour(x)); }
    else { A.sel = new Set([d]); A.ancre = d; }
    $$('.cal-c[data-d]').forEach(c => c.classList.toggle('sel', A.sel.has(c.dataset.d)));
    const n = A.sel.size; msg(n > 1 ? n + ' jours choisis · clic droit pour les dispos' : 'Clic droit : dispos, rendez-vous · Maj + clic : une période');
  }
  // ---------- le clic droit : dispos de chacun, ou un rendez-vous ----------
  function menuJours(x, y) {
    $$('.md-menu').forEach(m => m.remove());
    const jours = [...A.sel].sort(), moi = BK.reglage('nomPc', ''), qui = (A.membres || []).includes(moi) ? [moi] : (A.membres || []);
    const n = jours.length, court = d => new Date(d + 'T12:00').toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' });
    const titre = n > 1 ? `${n} jours · ${court(jours[0])} → ${court(jours[n - 1])}` : new Date(jours[0] + 'T12:00').toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
    const dejaLa = (A.membres || []).filter(m => jours.some(j => ((A.dispos || {})[j] || {})[m]));     // qui a déjà dit quelque chose ces jours-là (pour l'enlever)
    const autres = (A.membres || []).filter(m => !qui.includes(m));                                     // les autres : on peut les marquer aussi (ex. « Baptiste n'est pas là »)
    const deMiette = BK.ia.active() ? (A.membres || []).filter(m => jours.some(j => ((A.dispMiette || {})[j] || {})[m] && !((A.dispos || {})[j] || {})[m])) : [];
    const menu = document.createElement('div'); menu.className = 'md-menu';
    menu.style.left = Math.min(x, innerWidth - 250) + 'px'; menu.style.top = Math.min(y, innerHeight - 300) + 'px';
    menu.innerHTML = `<span class="md-menu-t">${esc(titre)}</span>`
      + qui.map(m => `<button data-dis="${esc(m)}|oui"><i class="ag-pt oui"></i>${qui.length > 1 ? esc(m) + ' dispo' : 'Je suis dispo'}</button><button data-dis="${esc(m)}|non"><i class="ag-pt non"></i>${qui.length > 1 ? esc(m) + ' pas là' : 'Je ne suis pas là'}</button>`).join('')
      + (deMiette.length ? '<span class="md-menu-sep"></span>' + deMiette.map(m => `<button data-dis="${esc(m)}|non" class="ag-valider"><i class="ag-pt non"></i>✓ Valider : ${esc(m)} pas là (lu sur Discord)</button>`).join('') : '')
      + (qui.length === 1 && autres.length ? '<span class="md-menu-sep"></span><button data-autres="1"><i class="ag-pt" style="background:linear-gradient(90deg,#6fbf5a 50%,#c8553d 50%)"></i>Autres disponibilités ▸</button>' : '')
      + (() => { const l = (A.locaux || []).filter(e => e.miette && jours.includes(e.date)); return l.length ? '<span class="md-menu-sep"></span>' + l.map(e => `<button data-evval="${e.id}" class="ag-valider"><i class="ag-pt" style="background:#7fc26a"></i>✓ Valider : ${esc(e.titre || 'rendez-vous')} (rangé par Miette)</button>`).join('') : ''; })()
      + (dejaLa.length ? '<span class="md-menu-sep"></span>' + dejaLa.map(m => `<button data-dis="${esc(m)}|"><i class="ag-pt" style="background:${couleurM(m)}"></i>Enlever ${m === moi ? 'ma dispo' : 'la dispo de ' + esc(m)}</button>`).join('') : '')
      + `<span class="md-menu-sep"></span><button data-rdv="1">＋ ${n > 1 ? 'Ajouter un événement sur cette période' : 'Ajouter un rendez-vous ici'}</button>`;
    document.body.appendChild(menu);
    const fermer = e => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('pointerdown', fermer, true); } };
    setTimeout(() => document.addEventListener('pointerdown', fermer, true));
    menu.onclick = async e => { const b = e.target.closest('button'); if (!b) return; menu.remove(); document.removeEventListener('pointerdown', fermer, true);
      if (b.dataset.rdv) { $('#agDate').value = jours[0]; $('#agFin').value = n > 1 ? jours[n - 1] : ''; $('#agTitre').focus();
        return msg(n > 1 ? `Période du ${court(jours[0])} au ${court(jours[n - 1])} : remplis à droite, puis « + Ajouter »` : 'Remplis le rendez-vous à droite, puis « + Ajouter »'); }
      if (b.dataset.evval) { const e = (await BK.db.liste('evenements')).find(x => x.id === b.dataset.evval); if (e) { delete e.miette; await BK.db.ecrire('evenements', e); } await BK.agendaRecharger(); return msg('Rendez-vous validé'); }
      if (b.dataset.autres) {                                         // « Autres disponibilités » ▸ Dispo / Pas dispo ▸ Pierre, Baptiste, Tout le monde
        const noms = e => autres.map(m => ({ k: m + '|' + e, nom: m, couleur: couleurM(m) })).concat(autres.length > 1 ? [{ k: '*|' + e, nom: 'Tout le monde', couleur: e === 'oui' ? '#6fbf5a' : '#c8553d' }] : []);
        return BK.menuCascade({ x, y }, [{ nom: 'Dispo', l: noms('oui') }, { nom: 'Pas dispo', l: noms('non') }],
          k => { if (!k) return; const [m, etat] = k.split('|'); poser(m === '*' ? autres : [m], etat); });
      }
      const [m, etat] = b.dataset.dis.split('|'); poser([m], etat); };
    async function poser(ms, etat) {
      const m = ms.join(', ');
      const d = await lireDispos();                                   // on relit juste avant : on n'efface pas ce que les autres viennent de cocher
      for (const j of jours) { const o = d[j] || {}; for (const q of ms) if (etat) o[q] = etat; else delete o[q]; if (Object.keys(o).length) d[j] = o; else delete d[j]; }
      const auj = jour(new Date()); for (const j of Object.keys(d)) if (j < auj) delete d[j];   // les jours passés s'en vont
      await BK.partage.ecrire('dispos2', d); A.dispos = d;
      const vieux = {}; for (const [j, o] of Object.entries(d)) { const l = Object.keys(o).filter(k => o[k] === 'oui'); if (l.length) vieux[j] = l; }
      BK.partage.ecrire('dispos', vieux).catch(() => {});             // pour les PC pas encore à jour : l'ancienne liste (seulement les « dispo »)
      rendre();
      msg(`${m} ${etat === 'oui' ? 'dispo' : etat === 'non' ? 'pas là' : ': dispo enlevée'} · ${n} jour(s)`); }
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
    b.disabled = false; b.textContent = 'Trouver les dates'; await charger(); };
  const lireForm = () => ({ type: $('#agType').value, titre: $('#agTitre').value.trim() || TYPES[$('#agType').value].nom, morceau: $('#agMorceau').value,
    date: $('#agDate').value, heure: $('#agHeure').value, lieu: $('#agLieu').value.trim(), fin: $('#agFin').value > $('#agDate').value ? $('#agFin').value : '' });
  $('#agAjout').onclick = async () => { const f = lireForm(); if (!f.date) return msg('Choisis une date'); if (!f.fin) delete f.fin; await BK.db.ecrire('evenements', f); $('#agTitre').value = ''; $('#agFin').value = ''; msg(f.fin ? 'Période ajoutée' : 'Rendez-vous ajouté'); await charger(); };
  $('#agGoogle').onclick = () => {           // ouvre Google Agenda pré-rempli : on n'a qu'à cliquer « Enregistrer »
    const f = lireForm(); if (!f.date) return msg('Choisis une date');
    const d = new Date(f.date + 'T' + (f.heure || '19:00')), fin = new Date(d.getTime() + 2 * 36e5), z = x => x.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const jf = x => x.replace(/-/g, ''), lendemain = x => { const t = new Date(x + 'T12:00'); t.setDate(t.getDate() + 1); return jour(t); };
    const url = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(`${TYPES[f.type].nom} · ${f.titre}${f.morceau ? ' · ' + f.morceau : ''}`) +
      `&dates=${f.fin ? jf(f.date) + '/' + jf(lendemain(f.fin)) : z(d) + '/' + z(fin)}&location=` + encodeURIComponent(f.lieu) + '&details=' + encodeURIComponent('Ajouté depuis BEESKOT Studio');
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
