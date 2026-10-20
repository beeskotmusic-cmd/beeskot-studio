// =====================================================================
// LIRE UN FICHIER EXCEL (.xlsx) sans rien installer : un .xlsx est un zip
// de fichiers XML. On lit la 1re feuille → un tableau de lignes de texte.
// (sert à lire le PLAN.xlsx des tournages, rangé dans le Drive)
// =====================================================================
BK.xlsx = {
  async dezipper(octets) {                       // { 'xl/worksheets/sheet1.xml': texte, … }
    const v = new DataView(octets.buffer, octets.byteOffset, octets.byteLength), out = {};
    let fin = octets.length - 22; while (fin > 0 && v.getUint32(fin, true) !== 0x06054b50) fin--;
    let p = v.getUint32(fin + 16, true); const n = v.getUint16(fin + 10, true);
    for (let i = 0; i < n; i++) {
      const meth = v.getUint16(p + 10, true), taille = v.getUint32(p + 20, true), ln = v.getUint16(p + 28, true), lx = v.getUint16(p + 30, true), lc = v.getUint16(p + 32, true), loc = v.getUint32(p + 42, true);
      const nom = new TextDecoder().decode(octets.subarray(p + 46, p + 46 + ln)); p += 46 + ln + lx + lc;
      if (!/^xl\/(sharedStrings|workbook|worksheets\/sheet\d+)\.xml$/.test(nom)) continue;
      const debut = loc + 30 + v.getUint16(loc + 26, true) + v.getUint16(loc + 28, true), brut = octets.subarray(debut, debut + taille);
      const data = meth === 0 ? brut : new Uint8Array(await new Response(new Blob([brut]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
      out[nom] = new TextDecoder().decode(data);
    }
    return out;
  },
  async lignes(octets) {
    const z = await BK.xlsx.dezipper(octets), xml = t => new DOMParser().parseFromString(t || '<x/>', 'application/xml');
    const partages = [...xml(z['xl/sharedStrings.xml']).getElementsByTagName('si')].map(si => [...si.getElementsByTagName('t')].map(t => t.textContent).join(''));
    const feuille = xml(z['xl/worksheets/sheet1.xml'] || z[Object.keys(z).find(k => /sheet\d+\.xml$/.test(k))]);
    const col = ref => { let c = 0; for (const ch of ref.replace(/\d+/g, '')) c = c * 26 + ch.charCodeAt(0) - 64; return c - 1; };
    const lignes = [];
    for (const r of feuille.getElementsByTagName('row')) {
      const l = [];
      for (const c of r.getElementsByTagName('c')) {
        const t = c.getAttribute('t'), vv = c.getElementsByTagName('v')[0], is = c.getElementsByTagName('is')[0];
        l[col(c.getAttribute('r'))] = t === 's' ? partages[+vv.textContent] : t === 'inlineStr' ? (is ? is.textContent : '') : (vv ? vv.textContent : '');
      }
      lignes.push(Array.from(l, x => (x || '').trim()));
    }
    return lignes;
  },
};
