#!/usr/bin/env python3
"""Fabrique ui/lighttoast/toast.html à partir de toast-original.html (le TOAST de Pierre / Dari).
Pour une nouvelle version de TOAST : remplacer toast-original.html puis lancer  python3 adapter.py
Ce qu'il change : retire l'en-tête parasite, polices locales, mp4-muxer local, pistes audio en plus (stems),
pont avec BEESKOT Studio (enregistrer sur le Drive), cadre masqué quand TOAST est dans l'onglet."""
import re, os, sys
ici = os.path.dirname(os.path.abspath(__file__))
lire = lambda n: open(os.path.join(ici, n), encoding='utf8').read()
s = lire('toast-original.html')

def remplace(a, b, n=1):
    global s
    if a not in s: sys.exit('INTROUVABLE : ' + a[:80])
    s = s.replace(a, b, n)

# 1. l'en-tête parasite (première ligne) et la fin en double
lignes = s.split('\n')
if lignes[0].startswith('<!doctype html><html><head>'): s = '\n'.join(lignes[1:])
s = re.sub(r'</script></body></html>\s*</body></html>\s*$', '</script></body></html>\n', s)
# 2. polices du logiciel (fichiers locaux, pas internet)
s = re.sub(r'<link rel="preconnect"[^>]*><link rel="preconnect"[^>]*><link href="https://fonts\.googleapis\.com[^>]*>', '<link rel="stylesheet" href="../style/fonts.css">', s, 1)
s = s.replace('"Barlow Semi Condensed"', '"Work Sans"').replace("'Barlow Semi Condensed'", "'Work Sans'").replace('Barlow Semi Condensed', 'Work Sans')
# 3. mp4-muxer : le fichier du dossier d'abord, internet en secours
remplace('const vs=["5.1.3"', 'const loc=true;const vs=["5.1.3"')
remplace('const next=()=>{if(k>=vs.length)return res(false);const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/mp4-muxer@"+vs[k++]+"/build/mp4-muxer.js";',
         'let first=true;const next=()=>{if(k>=vs.length&&!first)return res(false);const s=document.createElement("script");if(first){first=false;s.src="mp4-muxer.js"}else s.src="https://cdn.jsdelivr.net/npm/mp4-muxer@"+vs[k++]+"/build/mp4-muxer.js";')
# 4. pistes audio en plus : le panneau
remplace('<input type="file" id="pfile" accept=".json,application/json" hidden></section>', '<input type="file" id="pfile" accept=".json,application/json" hidden></section>\n' + lire('stems.html'))
# 5. enregistrer sur le Drive : le choix dans la section 1
remplace('<input type="checkbox" id="psa" checked> avec l\'audio</label>', '<input type="checkbox" id="psa" checked> avec l\'audio</label>' + lire('dbs.html').strip())
remplace('async function writeProject(name,blob){', 'async function writeProject(name,blob){\n  if(toDrive()){await DBS.envoyer(blob,name,"Projets");return name+" (Drive)"}')
remplace('const a=$("dl");const bl=new Blob(ch,{type:mt});', 'const a=$("dl");const bl=new Blob(ch,{type:mt});setTimeout(()=>afterExport(bl,"video-led."+ext),0);')
remplace('dl._name=dl.download=is3?"video-3d.mp4":"video-led-"+mode+".mp4";', 'dl._name=dl.download=is3?"video-3d.mp4":"video-led-"+mode+".mp4";afterExport(bl,dl._name);')
# 6. les repères des pistes en plus sont gardés dans le projet
remplace('pal,ptypes,etypes,fxev,ecol};', 'pal,ptypes,etypes,fxev,ecol,stems:stemsSave()};')
remplace('manual=normPeches(o.manual,ptypes.length);', 'stemsLoad(o.stems);manual=normPeches(o.manual,ptypes.length);')
# 7. le code et le style ajoutés
remplace('</script></body></html>', lire('dbs.js') + '\n' + lire('stems.js') + '\n</script></body></html>')
remplace('</style>', lire('dbs.css') + '\n</style>')
# 8. titre
open(os.path.join(ici, '..', 'ui', 'lighttoast', 'toast.html'), 'w', encoding='utf8').write(s)
print('ok', len(s), 'caractères')
