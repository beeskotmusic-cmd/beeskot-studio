// =====================================================================
// LUMIÈRES — les lampes connectées (Globe Suite = appareils Tuya) pilotées
// depuis le PC, et un bouton qui lance le programme LED vidéo de Pierre.
// Les lampes passent par le « cloud Tuya » (compte développeur gratuit) :
// les codes sont rangés dans le Drive BEESKOT (config « lumieres »).
// =====================================================================
(() => {
const REGIONS = { us: 'https://openapi.tuyaus.com', eu: 'https://openapi.tuyaeu.com', cn: 'https://openapi.tuyacn.com', in: 'https://openapi.tuyain.com' };
const SCENES = [
  { nom: 'Rouge tournage', h: 0, s: 1000, v: 1000 },
  { nom: 'Ambre chaud', h: 30, s: 900, v: 800 },
  { nom: 'Bleu nuit', h: 225, s: 1000, v: 600 },
  { nom: 'Violet', h: 280, s: 900, v: 800 },
  { nom: 'Vert', h: 120, s: 900, v: 700 },
  { nom: 'Blanc chaud', blanc: true, v: 900, temp: 150 },
  { nom: 'Blanc froid', blanc: true, v: 1000, temp: 1000 },
];
const L = { conf: null, jeton: null, expire: 0, lampes: [], choisies: new Set(BK.reglage('lum.choisies', [])) };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- le cloud Tuya (signature HMAC-SHA256, faite par le navigateur) ----------
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const sha256 = async t => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)));
async function hmac(cle, t) { const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(cle), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(t))).toUpperCase(); }
const fetchT = (u, o) => (BK.T && BK.T.http ? BK.T.http.fetch : window.fetch)(u, o);

async function tuya(methode, chemin, corps, sansJeton) {
  const c = L.conf, t = String(Date.now()), nonce = crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : t;
  if (!sansJeton && (!L.jeton || Date.now() > L.expire)) {
    const r = await tuya('GET', '/v1.0/token?grant_type=1', null, true);
    L.jeton = r.access_token; L.expire = Date.now() + (r.expire_time - 60) * 1000;
  }
  const b = corps ? JSON.stringify(corps) : '';
  const aSigner = [methode, await sha256(b), '', chemin].join('\n');
  const sign = await hmac(c.secret, c.acces + (sansJeton ? '' : L.jeton) + t + nonce + aSigner);
  const h = { client_id: c.acces, sign, t, nonce, sign_method: 'HMAC-SHA256', 'Content-Type': 'application/json' };
  if (!sansJeton) h.access_token = L.jeton;
  const r = await (await fetchT(REGIONS[c.region || 'us'] + chemin, { method: methode, headers: h, body: b || undefined })).json();
  if (!r.success) { if (/token/i.test(r.msg || '') && !sansJeton) L.jeton = null; throw new Error('Tuya : ' + (r.msg || r.code)); }
  return r.result;
}

BK.module('lumieres', function (page) {
  $('.sub', page).textContent = 'Lampes Globe et LED vidéo de Pierre, depuis le PC';
  $('.hdr .right', page).innerHTML = `<div><span class="eng" style="font-size:9px">Lampes</span><span class="vfd" id="luNb">—</span></div>`;
  $('.grid', page).innerHTML = `
    <div class="cols">
      <section class="pane vit lu-vit"><span class="ptitle">① Vitrine</span>
        <div class="box"><div class="ligne-titre"><span class="lb">LED vidéo de Pierre</span></div>
          <div class="lu-pierre"><button class="btn pri" id="luPierre">▶ Lancer le programme LED</button><span class="nt" id="luPierreTxt"></span></div></div>
        <div class="box"><div class="ligne-titre"><span class="lb">Ambiances</span><span class="nt" style="margin:0 0 0 auto">S'applique aux lampes cochées</span></div>
          <div class="lu-scenes">${SCENES.map((s, i) => `<button class="lu-scene" data-sc="${i}" style="--c:${s.blanc ? (s.temp > 500 ? '#dfe9ff' : '#ffd9a0') : `hsl(${s.h},90%,55%)`}"><i></i>${s.nom}</button>`).join('')}
            <button class="lu-scene" data-tout="1" style="--c:#fff8e0"><i></i>Tout allumer</button><button class="lu-scene" data-tout="0" style="--c:#222"><i></i>Tout éteindre</button></div></div>
        <div class="box grow"><span class="lb">Les lampes</span><div class="lu-lampes" id="luLampes"></div></div>
      </section>
      <section class="pane reg" style="width:300px"><span class="ptitle">② Réglages</span>
        <div class="box"><span class="lb">Programme de Pierre (ce PC)</span>
          <span class="nt" id="luExe">Pas encore choisi.</span>
          <button class="btn sm" id="luExeB" style="margin-top:8px">Choisir le programme…</button></div>
        <div class="box"><span class="lb">Lampes : compte Tuya (gratuit)</span>
          <input class="fld" id="luId" placeholder="Access ID" autocomplete="off" style="margin-top:8px">
          <input class="fld" id="luSecret" type="password" placeholder="Access Secret" autocomplete="off" style="margin-top:6px">
          <select class="fld" id="luRegion" style="margin-top:6px"><option value="us">Amérique (Canada, É.-U.)</option><option value="eu">Europe</option><option value="in">Inde</option><option value="cn">Chine</option></select>
          <div class="chips" style="margin-top:8px"><button class="chip" id="luOk">Enregistrer et chercher les lampes</button></div>
          <span class="nt">Rangé dans votre Drive : tous les PC l'ont.</span></div>
      </section>
    </div>
    <div class="pane abar"><span class="ptitle">③ Barre</span><span class="vfd" id="luMsg">PRÊT</span><div class="right"><button class="btn" id="luRelire">↻ Relire les lampes</button></div></div>`;
  const msg = t => $('#luMsg').textContent = String(t).toUpperCase().slice(0, 90);

  // ---------- programme de Pierre ----------
  function majPierre() {
    const p = BK.reglage('lum.pierreExe', '');
    $('#luExe').textContent = p ? p.split(/[\\/]/).pop() : 'Pas encore choisi.';
    $('#luPierre').disabled = !p;
    $('#luPierreTxt').textContent = p ? '' : 'Choisis d\'abord le programme dans les Réglages (à droite), sur le PC du studio.';
  }
  $('#luExeB').onclick = async () => {
    if (!BK.estExe) return msg('Disponible dans le logiciel installé');
    const p = await BK.fichier.choisirFichier('Le programme LED de Pierre', [{ name: 'Programme', extensions: ['exe', 'lnk', 'bat'] }]); if (!p) return;
    BK.regler('lum.pierreExe', p); majPierre(); msg('Programme enregistré pour ce PC');
  };
  $('#luPierre').onclick = async () => { try { await BK.fichier.ouvrir(BK.reglage('lum.pierreExe', '')); msg('Programme lancé'); } catch (e) { msg('Impossible de lancer le programme'); } };

  // ---------- lampes ----------
  async function config() { L.conf = (await BK.db.liste('config')).find(x => x.id === 'lumieres') || { id: 'lumieres' }; return L.conf; }
  async function chercher() {
    await config();
    if (!L.conf.acces || !L.conf.secret) { $('#luLampes').innerHTML = '<span class="nt">Ajoute les codes Tuya dans les Réglages (à droite) pour piloter les lampes.</span>'; $('#luNb').textContent = '—'; return; }
    $('#luLampes').innerHTML = '<span class="nt"><span class="spin"></span>Recherche des lampes…</span>';
    try {
      const r = await tuya('GET', '/v1.0/iot-01/associated-users/devices?size=100');
      L.lampes = (r.devices || r.list || r || []).filter(d => /dj|dd|xdd|fwd|dc|tgq|light|bulb/i.test(d.category || '') || /lamp|light|bulb|ampoule|globe/i.test(d.name || ''));
      if (!L.lampes.length) L.lampes = r.devices || r.list || [];
      if (!L.choisies.size) L.lampes.forEach(d => L.choisies.add(d.id));
      rendre();
    } catch (e) { $('#luLampes').innerHTML = `<span class="nt">${esc(e.message)}</span>`; }
  }
  function rendre() {
    $('#luNb').textContent = String(L.lampes.length).padStart(2, '0');
    $('#luLampes').innerHTML = L.lampes.length ? L.lampes.map(d => {
      const st = Object.fromEntries((d.status || []).map(x => [x.code, x.value])), allume = st.switch_led ?? st.switch_1 ?? false;
      return `<div class="lu-lampe${d.online === false ? ' horsligne' : ''}" data-id="${d.id}">
        <label class="lu-coche"><input type="checkbox" data-ch="${d.id}"${L.choisies.has(d.id) ? ' checked' : ''}></label>
        <span class="led ${allume ? 'amb' : ''}"></span><b>${esc(d.name)}</b><span class="nt">${d.online === false ? 'hors ligne' : ''}</span>
        <button class="btn xs" data-on="${d.id}">${allume ? 'Éteindre' : 'Allumer'}</button></div>`;
    }).join('') : '<span class="nt">Aucune lampe trouvée sur ce compte Tuya.</span>';
    $$('[data-ch]').forEach(c => c.onchange = () => { c.checked ? L.choisies.add(c.dataset.ch) : L.choisies.delete(c.dataset.ch); BK.regler('lum.choisies', [...L.choisies]); });
    $$('[data-on]').forEach(b => b.onclick = async () => { const d = L.lampes.find(x => x.id === b.dataset.on), st = Object.fromEntries((d.status || []).map(x => [x.code, x.value]));
      await commande([d], [{ code: 'switch_led', value: !(st.switch_led ?? st.switch_1) }]); });
  }
  async function commande(lampes, cmds) {
    if (!lampes.length) return msg('Coche au moins une lampe');
    msg('Envoi aux lampes…'); let ok = 0;
    await Promise.all(lampes.map(async d => { try { await tuya('POST', `/v1.0/devices/${d.id}/commands`, { commands: cmds }); ok++;
      const s = d.status || (d.status = []); for (const c of cmds) { const x = s.find(y => y.code === c.code); x ? (x.value = c.value) : s.push({ code: c.code, value: c.value }); } } catch (e) { msg(e.message); } }));
    if (ok) msg(`${ok} lampe(s) réglée(s)`); rendre();
  }
  const choisies = () => L.lampes.filter(d => L.choisies.has(d.id));
  $$('[data-sc]').forEach(b => b.onclick = () => { const s = SCENES[+b.dataset.sc];
    commande(choisies(), s.blanc ? [{ code: 'switch_led', value: true }, { code: 'work_mode', value: 'white' }, { code: 'bright_value_v2', value: s.v }, { code: 'temp_value_v2', value: s.temp }]
      : [{ code: 'switch_led', value: true }, { code: 'work_mode', value: 'colour' }, { code: 'colour_data_v2', value: { h: s.h, s: s.s, v: s.v } }]); });
  $$('[data-tout]').forEach(b => b.onclick = () => commande(choisies(), [{ code: 'switch_led', value: b.dataset.tout === '1' }]));

  $('#luOk').onclick = async () => {
    await config(); const id = $('#luId').value.trim(), sec = $('#luSecret').value.trim();
    if (!id && !L.conf.acces) return msg('Colle l\'Access ID');
    L.conf = { ...L.conf, id: 'lumieres', ...(id ? { acces: id } : {}), ...(sec ? { secret: sec } : {}), region: $('#luRegion').value }; L.jeton = null;
    await BK.db.ecrire('config', L.conf); $('#luSecret').value = ''; msg('Codes enregistrés'); chercher();
  };
  [$('#luId'), $('#luSecret')].forEach(c => c.addEventListener('keydown', e => e.stopPropagation()));
  $('#luRelire').onclick = chercher;
  BK.surOuvrir = BK.surOuvrir || {};
  BK.surOuvrir.lumieres = async () => { await config(); $('#luId').value = L.conf.acces || ''; $('#luSecret').placeholder = L.conf.secret ? '•••••••• (enregistré)' : 'Access Secret'; $('#luRegion').value = L.conf.region || 'us'; majPierre(); chercher(); };
  majPierre();
});
})();
