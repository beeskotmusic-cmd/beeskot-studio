// NOTES ET RETOURS (mobile) — choisir un morceau et une version, écouter, lire les notes minutées du groupe,
// en ajouter (à l'endroit où on en est, ou sur tout le morceau), répondre, cocher « réglé ».
// Mêmes notes que sur le PC (collection « notesmix ») : une note est liée à UN fichier (la version).
(() => {
const { $, esc, msg, moi, couleur, t2, L } = BKM;
const N = { m: BK.reglage('mobile.ecoute.m', ''), v: '', vs: [], notes: [], morceaux: [], tout: false, autres: false };
const auteur = n => n.auteur || n.par;

BKM.ecran('ecoute', { nom: 'Notes et retours', ordre: 40, async dessiner(z, plus, frais) {
  if (plus.m) N.m = plus.m;
  N.morceaux = (await BK.db.liste('morceaux')).sort((a, b) => String(a.nom).localeCompare(String(b.nom)));
  if (!frais()) return;
  const m = N.morceaux.find(x => x.id === N.m);
  z.innerHTML = `
    <label class="mo-champ"><span class="mo-eng">Morceau</span><select class="mo-fld" id="ecM"><option value="">— choisis —</option>${N.morceaux.map(x => `<option value="${esc(x.id)}"${x.id === N.m ? ' selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
    <div id="ecSuite">${m ? '<p class="mo-nt">Je cherche les versions…</p>' : '<p class="mo-nt">Choisis un morceau pour écouter ses versions et voir les notes.</p>'}</div>`;
  $('#ecM').onchange = e => { N.m = e.target.value; N.v = ''; BK.regler('mobile.ecoute.m', N.m); BKM.redessiner(); };
  if (!m) return;
  const [vs, notes] = await Promise.all([BKM.versions(m, N.morceaux), BK.db.liste('notesmix')]);
  if (!frais() || N.m !== m.id) return;
  N.vs = vs; N.notes = notes.filter(n => n.morceau === m.id);
  // la version : celle d'avant si elle existe encore, sinon celle choisie en A sur le PC, sinon la ★ / la plus récente
  if (!vs.some(v => v.v === N.v)) N.v = (vs.find(v => v.v === m.ecouteA) || vs[0] || {}).v || '';
  suite(m);
} });

function suite(m) {
  const z = $('#ecSuite'); if (!z) return;
  const brouillon = ($('#ecTexte') || {}).value || '';                 // ne jamais perdre ce qu'on est en train d'écrire
  if (!N.vs.length) { z.innerHTML = '<p class="mo-nt">Aucune version de ce morceau sur le Drive (seulement sur un PC).</p>' + listeAutres(); brancherListe(z, m); return; }
  const v = N.vs.find(x => x.v === N.v), cle = 'n:' + N.v;
  const ici = N.notes.filter(n => (n.version || '') === N.v).sort((a, b) => (a.tout ? -1 : a.t) - (b.tout ? -1 : b.t));
  const D = L.cle === cle && BKM.son.duration ? BKM.son.duration : 0;
  z.innerHTML = `
    <label class="mo-champ"><span class="mo-eng">Version</span><select class="mo-fld" id="ecV">${N.vs.map(x => `<option value="${esc(x.v)}"${x.v === N.v ? ' selected' : ''}>${x.princ ? '★ ' : ''}${esc(x.nom)}${(() => { const k = N.notes.filter(n => n.version === x.v && !n.regle).length; return k ? ` (${k} note${k > 1 ? 's' : ''})` : ''; })()}</option>`).join('')}</select></label>
    <div class="mo-carte mo-ec-lect">
      <button class="mo-play grand" id="ecPlay">${L.cle === cle && !BKM.son.paused ? '❚❚' : '▶'}</button>
      <div class="mo-ec-piste" id="ecPiste">${D ? ici.filter(n => !n.tout).map(n => `<i class="${n.fin ? 'pas' : ''}${n.regle ? ' regle' : ''}" style="left:${Math.min(100, n.t / D * 100)}%;${n.fin ? `width:${Math.max(1, (n.fin - n.t) / D * 100)}%;` : ''}--pc:${couleur(auteur(n))}" data-aller="${n.id}"></i>`).join('') : ''}<b id="ecCurseur"></b></div>
      <span class="mo-ec-temps" id="ecTemps">${L.cle === cle ? t2(BKM.son.currentTime) + ' / ' + t2(BKM.son.duration) : 'appuie sur ▶'}</span></div>
    <div class="mo-carte mo-ec-ajout">
      <textarea class="mo-fld" id="ecTexte" rows="2" placeholder="Ta note…"></textarea>
      <div class="mo-ec-boutons"><button class="chip${N.tout ? ' on' : ''}" id="ecTout">Sur tout le morceau</button>
        <button class="btn sm pri" id="ecAjout">+ Note à <span id="ecQuand">${N.tout ? 'TOUT' : L.cle === cle ? t2(BKM.son.currentTime) : '0:00'}</span></button></div>
      ${BK.reglage('nomPc', '') ? '' : '<p class="mo-alerte">Choisis ton nom dans Réglages pour signer tes notes.</p>'}</div>
    <h2 class="mo-sous">Notes sur cette version <em>${ici.filter(n => !n.regle).length} à régler</em></h2>
    ${ici.map(ligne).join('') || '<p class="mo-nt">Pas encore de note sur ce fichier.</p>'}
    ${listeAutres()}`;
  if (brouillon) $('#ecTexte').value = brouillon;
  $('#ecV').onchange = e => { N.v = e.target.value; suite(m); };
  $('#ecPlay').onclick = () => lire(m, v);
  $('#ecTout').onclick = () => { N.tout = !N.tout; suite(m); };
  $('#ecAjout').onclick = () => ajouter(m, v);
  $('#ecPiste').onclick = e => { if (L.cle !== cle || !BKM.son.duration) return lire(m, v);
    const r = e.currentTarget.getBoundingClientRect(); BKM.aller((e.clientX - r.left) / r.width * BKM.son.duration); };
  brancherListe(z, m, v);
  curseur();
}
// les notes laissées sur d'autres fichiers de ce morceau (repliées)
function listeAutres() {
  const l = N.notes.filter(n => (n.version || '') !== N.v).sort((a, b) => String(b.quand || '').localeCompare(String(a.quand || '')));
  if (!l.length) return '';
  return `<button class="mo-sous mo-plier" id="ecAutres">${N.autres ? '▾' : '▸'} Sur d'autres versions <em>${l.length}</em></button>` + (N.autres ? l.map(n => ligne(n, true)).join('') : '');
}
function ligne(n, autre) {
  return `<div class="mo-note${n.regle ? ' regle' : ''}" style="--pc:${couleur(auteur(n))}" data-n="${esc(n.id)}">
    <button class="mo-note-t" data-aller="${esc(n.id)}"${autre ? ' disabled' : ''}>${n.tout ? 'TOUT' : t2(n.t) + (n.fin ? ' → ' + t2(n.fin) : '')}</button>
    <div class="mo-note-c"><b>${esc(auteur(n))}</b> ${esc(n.texte)}${n.modifie ? ' <em>(modifiée)</em>' : ''}
      ${autre ? `<div class="mo-note-v">sur « ${esc(n.versionNom || 'une autre version')} »</div>` : ''}
      ${n.texteEn ? `<div class="mo-note-v">EN · ${esc(n.texteEn)}</div>` : ''}
      ${(n.reponses || []).map(r => `<div class="mo-rep" style="--pc:${couleur(r.par)}"><b>${esc(r.par)}</b> ${esc(r.texte)}</div>`).join('')}
      <div class="mo-note-o"><button class="chip" data-rep="${esc(n.id)}">Répondre${(n.reponses || []).length ? ' · ' + n.reponses.length : ''}</button>
        <button class="chip${n.regle ? ' on' : ''}" data-ok="${esc(n.id)}">${n.regle ? '✓ réglé' : 'Réglé ?'}</button></div>
      <div class="mo-rep-f" hidden><input class="mo-fld" placeholder="Ta réponse…"><button class="btn sm">Envoyer</button></div></div></div>`;
}
function brancherListe(z, m, v) {
  const a = z.querySelector('#ecAutres'); if (a) a.onclick = () => { N.autres = !N.autres; suite(m); };
  const trouver = id => N.notes.find(n => n.id === id);
  z.querySelectorAll('[data-aller]').forEach(b => b.onclick = async e => { e.stopPropagation(); const n = trouver(b.dataset.aller); if (!n || n.tout || !v) return;
    if (L.cle !== 'n:' + N.v) await lire(m, v, Math.max(0, n.t - 1)); else BKM.aller(Math.max(0, n.t - 1)); });
  z.querySelectorAll('[data-ok]').forEach(b => b.onclick = async () => { const n = trouver(b.dataset.ok); n.regle = !n.regle; await sauver(n); suite(m); });
  z.querySelectorAll('[data-rep]').forEach(b => b.onclick = () => { const f = b.closest('.mo-note-c').querySelector('.mo-rep-f'); f.hidden = !f.hidden; if (f.hidden) return;
    const i = f.querySelector('input'); i.focus();
    const envoyer = async () => { const t = i.value.trim(); if (!t) return; const n = trouver(b.dataset.rep);
      (n.reponses = n.reponses || []).push({ par: moi(), texte: t, quand: new Date().toISOString() }); await sauver(n); suite(m); };
    f.querySelector('button').onclick = envoyer; i.onkeydown = e => { if (e.key === 'Enter') envoyer(); }; });
}
async function sauver(n) { try { await BK.db.ecrire('notesmix', n); msg('Enregistré'); } catch (e) { msg('Pas enregistré : ' + (e.message || e)); } }

function lire(m, v, debut) { return BKM.lire({ cle: 'n:' + v.v, titre: m.nom + ' · ' + v.nom, id: v.id, nom: v.nom, debut }); }
async function ajouter(m, v) {
  const t = $('#ecTexte').value.trim(); if (!t) return $('#ecTexte').focus();
  const pos = L.cle === 'n:' + v.v ? BKM.son.currentTime : 0;
  const n = { morceau: m.id, version: v.v, versionNom: v.nom, contre: '', contreNom: '', t: N.tout ? 0 : Math.round(pos * 10) / 10, fin: null, tout: N.tout,
    texte: t, auteur: moi(), par: moi(), quand: new Date().toISOString(), reponses: [], regle: false, depuis: 'mobile' };
  $('#ecAjout').disabled = true;
  try { const f = await BK.db.ecrire('notesmix', n); N.notes.push(f); $('#ecTexte').value = ''; msg(N.tout ? 'Note ajoutée sur tout le morceau' : 'Note ajoutée à ' + t2(n.t)); N.tout = false; }
  catch (e) { msg('Pas enregistrée : ' + (e.message || e)); }
  suite(m);
}
// le curseur et le temps suivent la lecture
function curseur() {
  const cle = 'n:' + N.v, c = $('#ecCurseur'); if (!c) return;
  const D = BKM.son.duration;
  c.style.left = L.cle === cle && D ? (BKM.son.currentTime / D * 100) + '%' : '0%';
  const te = $('#ecTemps'); if (te && L.cle === cle) te.textContent = t2(BKM.son.currentTime) + ' / ' + t2(D);
  const q = $('#ecQuand'); if (q && !N.tout) q.textContent = L.cle === cle ? t2(BKM.son.currentTime) : '0:00';
  const p = $('#ecPlay'); if (p) p.textContent = L.cle === cle && !BKM.son.paused ? '❚❚' : '▶';
}
let marques = '';
L.ecouteurs.add(() => {
  if (BKM.actuel !== 'ecoute') return; curseur();
  // les marques des notes ont besoin de la durée : on redessine une fois qu'elle est connue
  const k = L.cle + '|' + Math.round(BKM.son.duration || 0);
  if (BKM.son.duration && k !== marques && L.cle === 'n:' + N.v) { marques = k; const m = N.morceaux.find(x => x.id === N.m); if (m) suite(m); }
});
})();
