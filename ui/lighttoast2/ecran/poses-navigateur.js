// =====================================================================
// LIGHT TOAST — garder les poses Mixamo (.fbx) dans le NAVIGATEUR (pages d'essai seulement).
//   1re fois : « Charger les poses » → elles sont rangées ici (IndexedDB) → les fois suivantes, elles reviennent seules.
//   Dans DBS, LT.sources.poses viendra du Drive BEESKOT (les fichiers Mixamo ne vont jamais sur GitHub).
// =====================================================================
(function (G) {
const LT = G.LT, BASE = 'lt2-poses', TABLE = 'poses';
const ouvrir = () => new Promise((ok, ko) => {
  const r = indexedDB.open(BASE, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(TABLE);
  r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
});
const fait = t => new Promise((ok, ko) => { t.oncomplete = () => ok(); t.onerror = () => ko(t.error); });
LT.sources.garderPoses = async octets => {
  const db = await ouvrir(), t = db.transaction(TABLE, 'readwrite'), s = t.objectStore(TABLE);
  for (const [nom, buf] of Object.entries(octets)) s.put(buf, nom);
  await fait(t); db.close();
};
LT.sources.poses = async () => {
  try {
    const db = await ouvrir(), t = db.transaction(TABLE, 'readonly'), s = t.objectStore(TABLE), o = {};
    await new Promise((ok, ko) => { const c = s.openCursor(); c.onsuccess = () => { const k = c.result; if (!k) return ok(); o[k.key] = k.value; k.continue(); }; c.onerror = () => ko(c.error); });
    db.close(); return Object.keys(o).length ? o : null;
  } catch (e) { return null; }
};
})(typeof self !== 'undefined' ? self : this);
